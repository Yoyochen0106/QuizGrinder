/* QuizGrinder 版面風格：Netflix 風（串流影音首頁）
 *
 * 借用：深色單一外觀、透明漸層頂部列、大型主打看板（hero billboard）＋白色播放鈕與灰色「更多資訊」、
 * 一排排可水平捲動的卡片列（繼續觀看進度條、Top 10 大型描邊數字、直式海報）、卡片懸停放大、列左右翻頁箭頭、詳細資訊對話框。
 * 主打主題＝你正確率最低的主題（作答 3 次以上）；沒有紀錄時隨機挑一個。
 * 所有數字都來自題庫或自己的紀錄。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon, hue } = SK;
  const S = () => QG.S();
  const root = document.documentElement;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  Object.assign(SK.ICONS, {
    'nf-play': '<path d="M7 4.5v15l12.5-7.5z"/>',
    'nf-left': '<path d="M15 5l-7 7 7 7"/>',
    'nf-right': '<path d="M9 5l7 7-7 7"/>',
    'nf-down': '<path d="M6 9l6 6 6-6"/>',
    'nf-check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  });

  const TOPIC_SYN = {
    '基材與材料': '從玻纖布、樹脂到銅箔基板，一塊電路板的骨架從這裡開始。',
    '檢測與品質': '電測、AOI、切片與可靠度試驗——找出每一個缺陷的來龍去脈。',
    '載板與封裝': 'IC 載板、BGA 與覆晶封裝，細線路製程的極限挑戰。',
    '產業與市場': '產業鏈上下游、應用市場與產品類型，掌握整個產業的地圖。',
    '鑽孔與成孔': '機械鑽、雷射鑽、盲埋孔——每一個孔都是層與層之間的通道。',
    '環保與安全': '廢水、廢氣、化學品與法規，製程背後不能忽略的責任。',
    '電鍍與金屬化': '除膠渣、化學銅到填孔電鍍，讓孔壁導通的關鍵一步。',
    '內層與壓合': '內層線路、棕化與疊構壓合，多層板就此成形。',
    '高頻高速': '介電常數、損耗與阻抗控制，訊號跑得又快又穩的秘密。',
    '軟板': '能彎能折的軟性電路板與軟硬結合板。',
    '影像轉移': '乾膜、曝光、顯影，把線路圖形精準搬到板面上。',
    'HDI 與增層': '微盲孔與增層法，高密度互連的世界。',
    '蝕刻': '蝕刻因子與側蝕，線寬控制的毫米之爭。',
    '表面處理': 'ENIG、OSP、噴錫、化銀——最後一道保護與可焊性。',
    '發展歷史': '電路板技術一路走來的重要里程碑。',
    '防焊與文字': '綠漆塗佈、開窗與文字印刷，板子的最後外衣。',
  };

  /* ---------------------------------------------------------------- 資料 */

  function topicData() {
    const official = QG.QS.filter((q) => q.official);
    return QG.TAGS.filter(([t]) => t !== '其他').map(([t]) => {
      const qs = official.filter((q) => q.t.includes(t));
      const ids = qs.map((q) => q.id);
      const p = SK.progressOf(ids);
      return { t, qs, ids, p, acc: p.n ? p.c / p.n : null, l11: qs.filter((q) => q.s === 'industry').length, l12: qs.filter((q) => q.s === 'process').length,
        hot: qs.filter((q) => q.src.length > 1).length, years: [...new Set(qs.flatMap((q) => q.years))].sort((a, b) => a - b) };
    });
  }

  let randomPick = null;
  function featured(topics) {
    const answered = topics.filter((d) => d.p.n >= 3);
    if (answered.length) {
      const d = answered.slice().sort((a, b) => a.acc - b.acc || b.p.n - a.p.n)[0];
      return { d, why: 'weak' };
    }
    if (!randomPick || !topics.find((d) => d.t === randomPick)) randomPick = topics[Math.floor(Math.random() * topics.length)].t;
    return { d: topics.find((d) => d.t === randomPick), why: 'random' };
  }

  const synopsis = (d) => TOPIC_SYN[d.t] || `${d.t}相關的歷屆考題。`;
  const metaLine = (d) => [
    h('span', { class: 'nf-match', text: d.acc === null ? '新主題' : `正確率 ${Math.round(d.acc * 100)}%` }),
    h('span', { text: d.years.length ? `${d.years[0]}–${d.years[d.years.length - 1]}` : '' }),
    h('span', { class: 'nf-rating', text: d.l11 && d.l12 ? 'L11・L12' : d.l11 ? 'L11' : 'L12' }),
    h('span', { text: `${d.ids.length} 題` }),
    d.hot ? h('span', { class: 'nf-hd', text: `${d.hot} 題重複考` }) : null,
  ];

  const playTopic = (d) => QG.startCustomPractice(QG.buildQueue(d.ids, 'weak').slice(0, 30), `主題：${d.t}`);

  /* ---------------------------------------------------------------- 對話框 */

  function detailModal(d, topics) {
    const exams = [...QG.EXAM_MAP.values()]
      .map((e) => ({ e, qs: d.qs.filter((q) => q.src.some((s) => s.exam === e.id)) }))
      .filter((x) => x.qs.length)
      .sort((a, b) => (a.e.year || 999) - (b.e.year || 999) || a.e.id.localeCompare(b.e.id));
    const similar = topics.filter((x) => x.t !== d.t).sort((a, b) => {
      const share = (x) => d.qs.filter((q) => q.t.includes(x.t)).length;
      return share(b) - share(a);
    }).slice(0, 6);
    let m = null;
    const body = h('div', { class: 'nf-detail' },
      h('div', { class: 'nf-detail-art', style: `--h:${hue(d.t)}` },
        h('span', { class: 'nf-art-word', 'aria-hidden': 'true', text: d.t }),
        h('div', { class: 'nf-detail-head' },
          h('h2', { class: 'nf-title-treat', text: d.t }),
          h('div', { class: 'nf-btns' },
            h('button', { class: 'nf-btn play', type: 'button', onclick: () => { m.close(); playTopic(d); } }, icon('nf-play'), '開始練習'),
            h('button', { class: 'nf-round', type: 'button', 'aria-label': '只練錯過的題目', title: '只練錯過的題目', onclick: () => {
              const wrong = d.ids.filter((id) => S().q[id] && S().q[id].w > 0);
              if (!wrong.length) { QG.toast('這個主題還沒有答錯過的題目'); return; }
              m.close(); QG.startCustomPractice(wrong, `錯過的題目：${d.t}`);
            } }, icon('review'))))),
      h('div', { class: 'nf-detail-body' },
        h('div', { class: 'nf-detail-cols' },
          h('div', null,
            h('p', { class: 'nf-meta' }, metaLine(d)),
            h('p', { class: 'nf-syn', text: synopsis(d) }),
            h('p', { class: 'nf-syn muted', text: d.p.seen ? `你已練過 ${d.p.seen} / ${d.ids.length} 題，作答 ${d.p.n} 次、答對 ${d.p.c} 次。` : '你還沒有練過這個主題。' })),
          h('div', { class: 'nf-detail-side' },
            h('p', null, h('span', { text: '科目：' }), [d.l11 ? `L11 產業概論 ${d.l11} 題` : null, d.l12 ? `L12 製造概論 ${d.l12} 題` : null].filter(Boolean).join('、')),
            h('p', null, h('span', { text: '出題年度：' }), d.years.join('、') || '—'),
            h('p', null, h('span', { text: '重複考過：' }), `${d.hot} 題`))),
        h('h3', { class: 'nf-detail-h' }, '考卷', h('span', { text: `${exams.length} 份` })),
        h('ol', { class: 'nf-eps' }, exams.map((x, i) => {
          const p = SK.progressOf(x.qs.map((q) => q.id));
          return h('li', null, h('button', { class: 'nf-ep', type: 'button', onclick: () => { m.close(); QG.startCustomPractice(x.qs.map((q) => q.id), `${x.e.title}・${d.t}`); } },
            h('span', { class: 'nf-ep-n', text: String(i + 1) }),
            h('span', { class: 'nf-ep-art', style: `--h:${hue(x.e.id)}` }, icon('nf-play')),
            h('span', { class: 'nf-ep-text' },
              h('span', { class: 'nf-ep-title' }, h('b', { text: x.e.title.replace(/（.*?）/, '') }), h('span', { text: `${x.qs.length} 題` })),
              h('span', { class: 'nf-ep-desc', text: x.qs[0].q })),
            p.seen ? h('span', { class: 'nf-bar', 'aria-label': `已練 ${p.seen}/${x.qs.length}` }, h('i', { style: `width:${Math.round((p.seen / x.qs.length) * 100)}%` })) : null));
        })),
        h('h3', { class: 'nf-detail-h', text: '更多類似主題' }),
        h('div', { class: 'nf-similar' }, similar.map((x) => h('button', { class: 'nf-sim', type: 'button', onclick: () => { m.close(); detailModal(x, topics); } },
          h('span', { class: 'nf-sim-art', style: `--h:${hue(x.t)}` }, h('span', { text: x.t })),
          h('span', { class: 'nf-sim-body' },
            h('span', { class: 'nf-meta small' }, h('span', { class: 'nf-match', text: x.acc === null ? '新主題' : `正確率 ${Math.round(x.acc * 100)}%` }), h('span', { text: `${x.ids.length} 題` })),
            h('span', { class: 'nf-sim-syn', text: synopsis(x) })))))));
    m = SK.modal(body, 'nf-modal');
    SK.setOpenModal(m);
  }

  function questionModal(q) {
    const r = S().q[q.id];
    let m = null;
    const opts = SK.answerOptions(q, { cls: 'nf-opts', onDone: () => { note.hidden = false; } });
    const note = h('p', { class: 'nf-syn muted', hidden: true, text: `出處：${q.src.map(QG.srcLabel).join('、')}${q.x ? '。' + q.x : ''}` });
    const body = h('div', { class: 'nf-detail q' },
      h('div', { class: 'nf-detail-art small', style: `--h:${hue(q.t[0] || q.id)}` },
        h('span', { class: 'nf-art-word', 'aria-hidden': 'true', text: q.t[0] || QG.SUBJ_SHORT[q.s] }),
        h('div', { class: 'nf-detail-head' },
          h('p', { class: 'nf-meta' },
            h('span', { class: 'nf-match', text: r && (r.c + r.w) ? `你答對 ${r.c}/${r.c + r.w}` : '未作答' }),
            h('span', { text: q.year ? `${q.year}` : '模擬題' }),
            h('span', { class: 'nf-rating', text: QG.SUBJ_CODE[q.s] }),
            q.src.length > 1 ? h('span', { class: 'nf-hd', text: `考過 ${q.src.length} 次` }) : null))),
      h('div', { class: 'nf-detail-body' },
        h('p', { class: 'nf-q', text: q.q }),
        q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖' })) : null,
        opts, note,
        h('div', { class: 'nf-btns' },
          SK.starBtn(q, 'nf-round', 'star'),
          h('button', { class: 'nf-round', type: 'button', 'aria-label': '加入錯題本', title: '加入錯題本', onclick: () => SK.addToReview(q) }, icon('bookmark')),
          h('span', { class: 'nf-meta small', text: q.t.filter((t) => t !== '其他').join('・') }))));
    m = SK.modal(body, 'nf-modal');
    SK.setOpenModal(m);
    const onKey = (e) => {
      if (!body.isConnected) { document.removeEventListener('keydown', onKey, true); return; }
      if ('1234'.includes(e.key) && e.key.length === 1) { opts.pick(+e.key - 1); e.stopPropagation(); }
    };
    document.addEventListener('keydown', onKey, true);
  }

  /* ---------------------------------------------------------------- 卡片與列 */

  function card({ key, title, sub, art, onPlay, onInfo, extra, progress, cls, label, starQ }) {
    return h('div', { class: 'nf-card ' + (cls || '') },
      h('button', { class: 'nf-card-art', type: 'button', style: `--h:${hue(key)}`, 'aria-label': label || title, onclick: onPlay },
        h('span', { class: 'nf-card-badge', 'aria-hidden': 'true' }, icon('pad')),
        h('span', { class: 'nf-card-title', text: art || title }),
        progress !== undefined ? h('span', { class: 'nf-bar nf-bar-card', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.round(progress * 100)}%` })) : null),
      h('div', { class: 'nf-card-info' },
        h('div', { class: 'nf-card-btns' },
          h('button', { class: 'nf-round white', type: 'button', 'aria-label': `播放：${title}`, tabindex: '-1', onclick: onPlay }, icon('nf-play')),
          starQ ? SK.starBtn(starQ, 'nf-round', 'star') : null,
          onInfo ? h('button', { class: 'nf-round right', type: 'button', 'aria-label': `更多資訊：${title}`, onclick: onInfo }, icon('nf-down')) : null),
        h('p', { class: 'nf-card-name', text: title }),
        sub ? h('p', { class: 'nf-meta small' }, sub) : null,
        extra || null));
  }

  function row(title, cards, opts = {}) {
    if (!cards.length) return null;
    const track = h('div', { class: 'nf-track' + (opts.cls ? ' ' + opts.cls : ''), role: 'list' }, cards.map((c) => { c.setAttribute('role', 'listitem'); return c; }));
    const prev = h('button', { class: 'nf-arrow prev', type: 'button', 'aria-label': `${title}：上一頁`, hidden: true, onclick: () => page(-1) }, icon('nf-left'));
    const next = h('button', { class: 'nf-arrow next', type: 'button', 'aria-label': `${title}：下一頁`, onclick: () => page(1) }, icon('nf-right'));
    const dots = h('span', { class: 'nf-dots', 'aria-hidden': 'true' });
    const sync = () => {
      const max = track.scrollWidth - track.clientWidth;
      prev.hidden = track.scrollLeft <= 4;
      next.hidden = track.scrollLeft >= max - 4;
      const pages = Math.max(1, Math.ceil(track.scrollWidth / Math.max(1, track.clientWidth)));
      const cur = Math.min(pages - 1, Math.round(track.scrollLeft / Math.max(1, track.clientWidth)));
      if (dots.childElementCount !== pages) fill(dots, Array.from({ length: pages }, () => h('i')));
      [...dots.children].forEach((d, i) => d.classList.toggle('on', i === cur));
      dots.hidden = pages < 2;
    };
    function page(dir) { track.scrollBy({ left: dir * track.clientWidth * 0.9, behavior: reduced() ? 'auto' : 'smooth' }); }
    track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    requestAnimationFrame(sync);
    return h('section', { class: 'nf-row' + (opts.top10 ? ' top10' : ''), 'aria-label': title },
      h('h2', { class: 'nf-row-h' }, opts.href ? h('a', { href: opts.href }, title, h('span', { class: 'nf-explore', text: '查看全部 ›' })) : title, dots),
      h('div', { class: 'nf-rowbox' }, prev, track, next));
  }

  function qCard(q, extra) {
    const r = S().q[q.id];
    return card({
      key: q.t[0] || q.id, title: q.q, art: q.q, cls: 'q', label: `作答：${q.q}`, starQ: q,
      onPlay: () => questionModal(q),
      sub: [h('span', { class: 'nf-match', text: r && (r.c + r.w) ? `答對 ${r.c}/${r.c + r.w}` : '未作答' }), h('span', { class: 'nf-rating', text: QG.SUBJ_CODE[q.s] }), h('span', { text: QG.srcLabel(q.src[0]) })],
      extra,
    });
  }

  /* ---------------------------------------------------------------- 首頁 */

  function nfHome() {
    const st = S();
    const topics = topicData();
    const { d, why } = featured(topics);
    const due = QG.dueReviewIds();
    const p = st.practice;
    const resume = p && p.queue && p.idx < p.queue.length && (p.idx > 0 || p.n > 0) ? p : null;

    const hero = h('section', { class: 'nf-hero', style: `--h:${hue(d.t)}`, 'aria-label': '主打主題' },
      h('div', { class: 'nf-hero-art', 'aria-hidden': 'true' },
        h('span', { class: 'nf-art-word big', text: d.t }),
        h('span', { class: 'nf-art-grid' })),
      h('div', { class: 'nf-hero-text' },
        h('p', { class: 'nf-series' }, icon('pad'), h('span', { text: why === 'weak' ? '弱 點 主 題' : '主 題' })),
        h('h1', { class: 'nf-title-treat hero', text: d.t }),
        why === 'weak' ? h('p', { class: 'nf-top10tag' }, h('b', { text: '補強' }), `你目前正確率最低的主題（${Math.round(d.acc * 100)}%）`) : null,
        h('p', { class: 'nf-syn', text: synopsis(d) }),
        h('div', { class: 'nf-btns' },
          h('button', { class: 'nf-btn play', type: 'button', onclick: () => playTopic(d) }, icon('nf-play'), '開始練習'),
          h('button', { class: 'nf-btn info', type: 'button', onclick: () => detailModal(d, topics) }, icon('info'), '更多資訊'))),
      h('span', { class: 'nf-hero-rating', text: `${d.ids.length} 題` }));

    // 繼續練習：目前練習回合＋練到一半的主題
    const cont = [];
    if (resume) {
      cont.push(card({ key: 'resume' + resume.label, title: resume.label, art: resume.label, cls: 'resume',
        progress: resume.idx / resume.queue.length, onPlay: () => SK.go('practice'),
        sub: [h('span', { class: 'nf-match', text: `第 ${resume.idx + 1} / ${resume.queue.length} 題` }), h('span', { text: `本輪答對 ${resume.c}/${resume.n}` })] }));
    }
    topics.filter((x) => x.p.seen && x.p.seen < x.ids.length).sort((a, b) => b.p.seen / b.ids.length - a.p.seen / a.ids.length).slice(0, 12).forEach((x) => {
      cont.push(card({ key: x.t, title: x.t, cls: 'topic', progress: x.p.seen / x.ids.length, onPlay: () => playTopic(x), onInfo: () => detailModal(x, topics),
        sub: [h('span', { class: 'nf-match', text: `已練 ${x.p.seen}/${x.ids.length}` }), h('span', { text: `正確率 ${QG.pct(x.p.c, x.p.n)}` })] }));
    });

    const reviewCards = due.slice(0, 20).map((id) => {
      const q = QG.QMAP.get(id);
      const r = st.q[id];
      return card({ key: q.t[0] || id, title: q.q, art: q.q, cls: 'q', label: `複習：${q.q}`,
        onPlay: () => QG.startReview([id].concat(due.filter((x) => x !== id))), onInfo: () => questionModal(q),
        sub: [h('span', { class: 'nf-match red', text: `第 ${r.b} 盒` }), h('span', { class: 'nf-rating', text: QG.SUBJ_CODE[q.s] }), h('span', { text: `答錯 ${r.w} 次` })] });
    });

    const top10 = QG.QS.filter((q) => q.official).slice().sort((a, b) => b.src.length - a.src.length || b.year - a.year).slice(0, 10);
    const top10Cards = top10.map((q, i) => {
      const c = card({ key: q.t[0] || q.id, title: q.q, art: q.q, cls: 'poster', label: `第 ${i + 1} 名：${q.q}`, starQ: q, onPlay: () => questionModal(q),
        sub: [h('span', { class: 'nf-hd', text: `考過 ${q.src.length} 次` }), h('span', { class: 'nf-rating', text: QG.SUBJ_CODE[q.s] })] });
      c.prepend(h('span', { class: 'nf-rank', 'aria-hidden': 'true', text: String(i + 1) }));
      c.classList.add('ranked');
      return c;
    });

    const subjRows = ['industry', 'process'].map((s) => {
      const list = topics.map((x) => ({ x, n: x.qs.filter((q) => q.s === s).length })).filter((o) => o.n).sort((a, b) => b.n - a.n);
      return row(`${QG.SUBJ_CODE[s]} ${QG.SUBJ[s]}`, list.map(({ x, n }) => {
        const ids = x.qs.filter((q) => q.s === s).map((q) => q.id);
        const pp = SK.progressOf(ids);
        return card({ key: s + x.t, title: x.t, cls: 'topic', progress: pp.seen ? pp.seen / ids.length : undefined,
          onPlay: () => QG.startCustomPractice(ids, `${QG.SUBJ_CODE[s]}・${x.t}`), onInfo: () => detailModal(x, topics),
          sub: [h('span', { class: 'nf-match', text: pp.n ? `正確率 ${QG.pct(pp.c, pp.n)}` : '新主題' }), h('span', { text: `${n} 題` })] });
      }));
    });

    const topicRows = topics.slice().sort((a, b) => b.ids.length - a.ids.length).map((x) =>
      row(x.t, QG.buildQueue(x.ids, 'weak').slice(0, 14).map((id) => qCard(QG.QMAP.get(id)))));

    const exams = [...QG.EXAM_MAP.values()].sort((a, b) => (b.year || 0) - (a.year || 0) || b.id.localeCompare(a.id));
    const posters = exams.map((e) => {
      const ids = QG.QS.filter((q) => q.src.some((s) => s.exam === e.id)).map((q) => q.id);
      const pp = SK.progressOf(ids);
      const c = card({ key: e.id, title: e.title, art: e.official ? String(e.year) : '模擬', cls: 'poster exam', progress: pp.seen ? pp.seen / ids.length : undefined,
        onPlay: () => QG.startCustomPractice(ids, e.title),
        sub: [h('span', { class: 'nf-rating', text: e.subject === 'industry' ? 'L11' : e.subject === 'process' ? 'L12' : '兩科' }), h('span', { text: `${ids.length} 題` }),
          h('span', { text: e.session === 'S' ? '樣題' : e.official ? `第 ${e.session} 次` : '模擬' })] });
      c.querySelector('.nf-card-title').after(h('span', { class: 'nf-poster-sub', text: e.official ? (e.session === 'S' ? '樣題' : `第 ${e.session} 次`) + (e.subject === 'mixed' ? '・兩科' : '') : '明志科大' }),
        h('span', { class: 'nf-poster-code', text: e.subject === 'industry' ? 'L11 產業概論' : e.subject === 'process' ? 'L12 製造概論' : 'L11＋L12' }));
      return c;
    });

    return h('div', { class: 'nf-home' },
      hero,
      h('div', { class: 'nf-rows' },
        row('繼續練習', cont),
        row(`錯題本（${due.length}）`, reviewCards, { href: '#review' }),
        row('高頻考題 Top 10', top10Cards, { top10: true }),
        subjRows,
        row('考卷', posters, { cls: 'posters' }),
        topicRows));
  }

  /* ---------------------------------------------------------------- 外框 */

  function nfTop(view) {
    const links = [['home', '首頁'], ['practice', '練習'], ['review', '錯題本'], ['exam', '模擬考'], ['browse', '題庫'], ['stats', '統計']];
    return h('div', { class: 'sk-top nf-top' },
      h('a', { class: 'nf-logo', href: '#home', 'aria-label': 'QuizGrinder 首頁' }, icon('pad'), h('span', { text: 'QUIZGRINDER' })),
      h('nav', { class: 'nf-links', 'aria-label': '主要功能' }, links.map(([v, l]) => h('a', { href: '#' + v, 'aria-current': SK.isCurrent(view, v) ? 'page' : null },
        l, v === 'review' ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null))),
      h('div', { class: 'sk-right nf-right' },
        h('a', { class: 'nf-ico', href: '#browse', 'aria-label': '搜尋題庫', title: '搜尋題庫' }, icon('search')),
        h('a', { class: 'nf-ico', href: '#review', 'aria-label': '錯題本', title: '錯題本' }, icon('review'), h('span', { class: 'badge', 'data-badge': 'review', hidden: true })),
        h('a', { class: 'nf-profile', href: '#stats', 'aria-label': '我的統計' }, h('span', { class: 'nf-pav', text: 'Q' }), icon('nf-down', 'nf-caret'))));
  }

  function onScroll() {
    if (SK.skin() !== 'netflix') return;
    root.classList.toggle('nf-scrolled', window.scrollY > 40);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  SK.register({
    id: 'netflix',
    label: 'Netflix 風',
    group: '社群內容',
    top: nfTop,
    nav: [
      { v: 'home', label: '首頁', icon: 'home' },
      { v: 'practice', label: '練習', icon: 'practice' },
      { v: 'review', label: '錯題本', icon: 'review', badge: true },
      { v: 'exam', label: '模擬考', icon: 'exam' },
      { v: 'stats', label: '我的', icon: 'user' },
    ],
    views: { home: nfHome },
    after: (view) => { root.classList.toggle('nf-homeview', view === 'home'); onScroll(); },
  });
})();
