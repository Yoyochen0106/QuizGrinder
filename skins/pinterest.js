/* Pinterest 風：瀑布流（CSS 多欄）釘圖牆——附圖題是圖片釘、文字題是高低不一的彩色卡片；
 * 滑過出現紅色「收藏」膠囊與出處；頂部大膠囊搜尋框＋主題分類膠囊；點開為特寫：左圖右作答、
 * 答案、出處與「更多類似的題目」。只借用版面、互動與配色；標誌一律用 QuizGrinder 的焊墊圖示。 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon, hue } = SK;
  const S = () => QG.S();
  const ID = 'pinterest';

  Object.assign(SK.ICONS, {
    'pn-share': '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v7h14v-7"/>',
    'pn-dots': '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    'pn-back': '<path d="M15 5l-7 7 7 7"/>',
  });

  const pn = { chip: '', cache: {}, tab: 'star' };
  const isStar = (q) => !!(S().q[q.id] && S().q[q.id].s);
  const topicsOf = (q) => q.t.filter((t) => t !== '其他');
  const stable = (ids, key) => {
    if (!pn.cache[key] || pn.cache[key].n !== ids.length) pn.cache[key] = { n: ids.length, ids: QG.shuffle(ids.slice()) };
    return pn.cache[key].ids;
  };

  /* ---------------------------------------------------------------- 釘圖 */
  function saveBtn(q, cls) {
    const b = h('button', { type: 'button', class: 'pinterest-save ' + (cls || '') });
    const draw = () => {
      const on = isStar(q);
      b.textContent = on ? '已收藏' : '收藏';
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('aria-label', on ? '取消收藏這題' : '收藏這題');
    };
    b.addEventListener('click', (e) => { e.stopPropagation(); QG.toggleStar(q.id); draw(); document.querySelectorAll(`.pinterest-save[data-id="${q.id}"]`).forEach((x) => { if (x !== b && x.redraw) x.redraw(); }); });
    b.dataset.id = q.id;
    b.redraw = draw;
    draw();
    return b;
  }

  function textCard(q, big) {
    const v = hue(q.id) % 3;
    const t = topicsOf(q)[0] || QG.SUBJ_SHORT[q.s];
    return h('div', { class: `pinterest-card v${v}${big ? ' big' : ''}`, style: `--h:${hue('t:' + t)}` },
      h('span', { class: 'pinterest-card-tag', text: t }),
      h('p', { class: 'pinterest-card-q', text: q.q }),
      h('span', { class: 'pinterest-card-foot', text: `${QG.SUBJ_CODE[q.s]}・四選一` }));
  }

  function pin(q, onOpen) {
    const r = S().q[q.id];
    const seen = r && (r.c + r.w);
    return h('div', { class: 'pinterest-pin' },
      h('div', { class: 'pinterest-media' + (q.fig ? ' fig' : '') },
        h('button', { type: 'button', class: 'pinterest-open', 'aria-label': `打開題目：${q.q}`, onclick: () => (onOpen ? onOpen(q) : closeup(q)) },
          q.fig ? h('img', { src: q.fig, alt: '', loading: 'lazy' }) : textCard(q)),
        saveBtn(q, 'hover'),
        h('span', { class: 'pinterest-src', 'aria-hidden': 'true' }, icon('pad'), QG.srcLabel(q.src[0])),
        seen ? h('span', { class: 'pinterest-done ' + (r.w && !r.c ? 'ng' : 'ok'), title: `你答對 ${r.c}／答錯 ${r.w}`, text: r.c && !r.w ? '✓' : r.w && !r.c ? '✗' : `${r.c}/${r.c + r.w}` }) : null),
      h('div', { class: 'pinterest-foot' },
        q.fig ? h('p', { class: 'pinterest-title', text: q.q }) : null,
        h('p', { class: 'pinterest-by' }, h('span', { class: 'pinterest-av', style: `--h:${hue(q.s)}`, text: QG.SUBJ_CODE[q.s].slice(1) }),
          h('span', { text: QG.SUBJ_SHORT[q.s] + (q.src.length > 1 ? `・考過 ${q.src.length} 次` : '') }))));
  }

  /* ---------------------------------------------------------------- 特寫 */
  let cm = null;
  function closeup(q) {
    const wrap = h('div', { class: 'pinterest-cw' });
    const show = (qq) => {
      fill(wrap, closeupBody(qq, show));
      wrap.scrollTop = 0;
      const f = wrap.querySelector('.ans-opt');
      if (f) f.focus({ preventScroll: true });
    };
    if (cm) cm.close();
    cm = SK.modal(wrap, 'pinterest-modal', () => { cm = null; });
    if (SK.setOpenModal) SK.setOpenModal(cm);
    show(q);
  }

  function closeupBody(q, show) {
    const r = S().q[q.id];
    const reveal = h('div', { class: 'pinterest-reveal', hidden: true });
    const doReveal = () => {
      const rr = S().q[q.id] || { c: 0, w: 0 };
      fill(reveal,
        h('p', { class: 'pinterest-ans' }, h('b', { text: '正解 ' }), q.all ? '官方釋疑：所有選項均給分' : q.a.map((L) => `(${L}) ${q.o[L]}`).join('；')),
        q.x ? h('p', { text: q.x }) : null,
        h('div', { class: 'pinterest-srcs' }, h('b', { text: '出處' }), h('ul', null, q.src.map((s) => {
          const e = QG.EXAM_MAP.get(s.exam);
          return h('li', null, h('span', { text: QG.srcLabel(s) }), e ? h('span', { class: 'pinterest-dim', text: e.title }) : null);
        }))),
        h('p', { class: 'pinterest-dim', text: `你的紀錄：答對 ${rr.c} 次、答錯 ${rr.w} 次` }));
      reveal.hidden = false;
    };
    const opts = SK.answerOptions(q, { cls: 'pinterest-opts', onDone: doReveal });
    const tps = topicsOf(q);
    const simIds = stable(QG.QS.filter((x) => x.id !== q.id && (tps.length ? x.t.some((t) => tps.includes(t)) : x.s === q.s)).map((x) => x.id), 'sim:' + q.id);
    let lim = 20;
    const simGrid = h('div', { class: 'pinterest-grid' });
    const moreBtn = h('button', { type: 'button', class: 'pinterest-btn', text: '載入更多' });
    const drawSim = () => {
      fill(simGrid, simIds.slice(0, lim).map((id) => pin(QG.QMAP.get(id), show)));
      moreBtn.hidden = lim >= simIds.length;
    };
    moreBtn.addEventListener('click', () => { lim += 20; drawSim(); });
    drawSim();
    return h('div', { class: 'pinterest-cu-page' },
      h('article', { class: 'pinterest-cu' },
        h('div', { class: 'pinterest-cu-media' + (q.fig ? ' fig' : '') },
          q.fig ? h('img', { src: q.fig, alt: '題目附圖（自原始試卷裁切）' }) : textCard(q, true)),
        h('div', { class: 'pinterest-cu-side' },
          h('div', { class: 'pinterest-cu-bar' },
            h('button', { type: 'button', class: 'pinterest-icon', 'aria-label': '複製題目', title: '複製題目', onclick: () => SK.copyQuestion(q) }, icon('pn-share')),
            h('button', { type: 'button', class: 'pinterest-icon', 'aria-label': '加入錯題本', title: '加入錯題本', onclick: () => SK.addToReview(q) }, icon('review')),
            h('span', { class: 'spacer' }),
            saveBtn(q, 'big')),
          h('p', { class: 'pinterest-cu-src' }, icon('pad'), QG.srcLabel(q.src[0]), q.src.length > 1 ? h('span', { class: 'pinterest-dim', text: `・考過 ${q.src.length} 次` }) : null),
          h('h2', { class: 'pinterest-cu-title', text: q.fig ? q.q : '選出正確答案' }),
          q.prev && QG.QMAP.get(q.prev) ? h('p', { class: 'pinterest-dim pinterest-prev', text: '承上題：' + QG.QMAP.get(q.prev).q }) : null,
          h('div', { class: 'pinterest-cu-tags' }, tps.map((t) => h('button', { type: 'button', class: 'pinterest-chip small', text: t,
            onclick: () => { pn.chip = 't:' + t; if (cm) cm.close(); if (location.hash === '#home') QG.render(); else location.hash = '#home'; } }))),
          opts,
          reveal,
          h('div', { class: 'pinterest-cu-by' }, h('span', { class: 'pinterest-av big', style: `--h:${hue(q.s)}`, text: QG.SUBJ_CODE[q.s] }),
            h('span', null, h('strong', { text: QG.SUBJ[q.s] }), h('span', { class: 'pinterest-dim', text: r && (r.c + r.w) ? `你答過 ${r.c + r.w} 次・${SK.relTime(r.t)}` : '你還沒作答過這題' }))))),
      h('section', { class: 'pinterest-more' }, h('h2', { text: '更多類似的題目' }), simGrid, h('div', { class: 'pinterest-center' }, moreBtn)));
  }

  /* ---------------------------------------------------------------- 外框 */
  function top(view) {
    const input = h('input', { type: 'search', id: 'pinterest-q', placeholder: '搜尋題目、選項或主題', value: QG.browse.kw, 'aria-label': '搜尋題目' });
    const pill = (v, label) => h('a', { class: 'pinterest-nav', href: '#' + v, 'aria-current': SK.isCurrent(view, v) ? 'page' : null, text: label });
    return h('div', { class: 'sk-top pinterest-top' },
      h('a', { class: 'pinterest-logo', href: '#home', 'aria-label': 'QuizGrinder 首頁' }, icon('pad')),
      h('nav', { class: 'pinterest-navs', 'aria-label': '主要功能' }, pill('home', '首頁'), pill('browse', '探索'), pill('practice', '練習'), pill('exam', '模擬考')),
      h('form', { class: 'pinterest-search', role: 'search', onsubmit: (e) => { e.preventDefault(); QG.browse.kw = input.value.trim(); if (location.hash === '#browse') QG.render(); else location.hash = '#browse'; } },
        icon('search'), input),
      h('div', { class: 'sk-right' },
        h('a', { class: 'sk-iconbtn', href: '#review', 'aria-label': '錯題本', title: '錯題本' }, icon('review'), h('span', { class: 'badge', 'data-badge': 'review', hidden: true })),
        h('a', { class: 'pinterest-me', href: '#stats', 'aria-label': '我的收藏與統計', title: '我的收藏與統計', text: 'Q' })));
  }

  function chips() {
    const list = [['', '全部'], ['fig', '附圖題'], ['hot', '高頻題']].concat(QG.TAGS.filter(([t]) => t !== '其他').map(([t]) => ['t:' + t, t]));
    return h('div', { class: 'pinterest-chips', role: 'list', 'aria-label': '分類' }, list.map(([k, l]) => h('button', { type: 'button', role: 'listitem',
      class: 'pinterest-chip', 'aria-pressed': pn.chip === k ? 'true' : 'false', style: k.startsWith('t:') ? `--h:${hue(k)}` : null, text: l,
      onclick: () => { pn.chip = k; QG.render(); } })));
  }

  function poolIds() {
    const k = pn.chip;
    if (!k) {
      // 圖片釘比較少，平均穿插在文字卡之間，讓牆面更像圖片牆
      const base = SK.feedPool('pinterest', S().settings.order === 'weak' ? 'weak' : 'random');
      const figs = base.filter((id) => QG.QMAP.get(id).fig);
      const rest = base.filter((id) => !QG.QMAP.get(id).fig);
      const out = [];
      rest.forEach((id, i) => { if (i % 5 === 2 && figs.length) out.push(figs.shift()); out.push(id); });
      return out.concat(figs);
    }
    const qs = k === 'fig' ? QG.QS.filter((q) => q.fig) : k === 'hot' ? QG.QS.filter((q) => q.src.length > 1) : QG.QS.filter((q) => q.t.includes(k.slice(2)));
    return stable(qs.map((q) => q.id), 'chip:' + k);
  }

  function home() {
    const ids = poolIds();
    return h('div', { class: 'pinterest-page' },
      chips(),
      !pn.chip ? h('p', { class: 'pinterest-dim pinterest-scope' }, `首頁範圍：${QG.filterLabel(S().settings.filters)}・`, h('a', { href: '#practice', text: '專心練習' })) : null,
      SK.infiniteList(ids, pin, 'pinterest-grid'));
  }

  function browse() {
    const kw = (QG.browse.kw || '').trim();
    if (kw) {
      const ids = QG.QS.filter((q) => q.text.includes(kw.toLowerCase())).map((q) => q.id);
      return h('div', { class: 'pinterest-page' },
        h('div', { class: 'pinterest-res-head' }, h('h1', { text: kw }), h('span', { class: 'pinterest-dim', text: `${ids.length} 個釘圖` }),
          h('button', { type: 'button', class: 'pinterest-btn', text: '清除', onclick: () => { QG.browse.kw = ''; QG.render(); } }),
          ids.length ? h('button', { type: 'button', class: 'pinterest-btn red', text: '練習這些題目', onclick: () => QG.startCustomPractice(ids, `搜尋：${kw}`) }) : null),
        ids.length ? SK.infiniteList(ids, pin, 'pinterest-grid') : h('p', { class: 'pinterest-dim pinterest-center', text: '找不到符合的題目，換個關鍵字試試。' }));
    }
    const boards = [['fig', '附圖題', QG.QS.filter((q) => q.fig)], ['hot', '高頻題', QG.QS.filter((q) => q.src.length > 1)]]
      .concat(QG.TAGS.filter(([t]) => t !== '其他').map(([t]) => ['t:' + t, t, QG.QS.filter((q) => q.t.includes(t))]));
    return h('div', { class: 'pinterest-page' },
      h('div', { class: 'pinterest-res-head center' }, h('h1', { text: '探索題目' }), h('p', { class: 'pinterest-dim', text: '依主題瀏覽，或在上方搜尋關鍵字' })),
      h('div', { class: 'pinterest-boards' }, boards.map(([k, l, qs]) => {
        const p = SK.progressOf(qs.map((q) => q.id));
        const sample = stable(qs.map((q) => q.id), 'board:' + k).slice(0, 3).map((id) => QG.QMAP.get(id));
        return h('button', { type: 'button', class: 'pinterest-board', onclick: () => { pn.chip = k; location.hash = '#home'; } },
          h('span', { class: 'pinterest-collage', style: `--h:${hue(k)}` }, sample.map((q, i) => h('span', { class: 'pinterest-cl c' + i, style: `--h:${hue(q.id)}` },
            q.fig ? h('img', { src: q.fig, alt: '', loading: 'lazy' }) : h('span', { text: q.q })))),
          h('strong', { text: l }), h('span', { class: 'pinterest-dim', text: `${qs.length} 個釘圖${p.seen ? `・已練 ${p.seen}` : ''}` }));
      })));
  }

  function stats(base) {
    const st = S();
    const t = QG.totals();
    const starred = QG.QS.filter((q) => st.q[q.id] && st.q[q.id].s).map((q) => q.id);
    const wrong = QG.QS.filter((q) => st.q[q.id] && st.q[q.id].w > 0).map((q) => q.id);
    const tabs = [['star', `已收藏 ${starred.length}`], ['wrong', `答錯過 ${wrong.length}`], ['data', '數據']];
    const ids = pn.tab === 'star' ? starred : wrong;
    return h('div', { class: 'pinterest-page' },
      h('header', { class: 'pinterest-prof' },
        h('span', { class: 'pinterest-prof-av', text: 'Q' }),
        h('h1', { text: '我的學習' }),
        h('p', { class: 'pinterest-dim', text: '@quizgrinder.learner' }),
        h('p', { text: `${QG.fmtNum(t.seen)} 題已練・正確率 ${QG.pct(t.c, t.n)}・連續 ${QG.streak()} 天` }),
        h('div', { class: 'pinterest-prof-btns' }, h('a', { class: 'pinterest-btn', href: '#review', text: '錯題本' }), h('a', { class: 'pinterest-btn red', href: '#practice', text: '開始練習' }))),
      h('nav', { class: 'pinterest-tabs', 'aria-label': '個人檔案分頁' }, tabs.map(([k, l]) => h('button', { type: 'button', 'aria-current': pn.tab === k ? 'page' : null, text: l,
        onclick: () => { pn.tab = k; QG.render(); } }))),
      pn.tab === 'data' ? base.stats()
        : ids.length ? SK.infiniteList(ids, pin, 'pinterest-grid')
          : h('p', { class: 'pinterest-dim pinterest-center', text: pn.tab === 'star' ? '還沒有收藏。在釘圖上按紅色「收藏」就會出現在這裡。' : '還沒有答錯的題目。' }));
  }

  SK.register({
    id: ID, label: 'Pinterest 風', group: '社群內容',
    top,
    nav: [
      { v: 'home', label: '首頁', icon: 'home' },
      { v: 'browse', label: '搜尋', icon: 'search' },
      { v: 'exam', label: '模擬考', icon: 'plus' },
      { v: 'review', label: '錯題本', icon: 'review', badge: true },
      { v: 'stats', label: '已收藏', icon: 'user' },
    ],
    views: { home, browse, stats },
  });
})();
