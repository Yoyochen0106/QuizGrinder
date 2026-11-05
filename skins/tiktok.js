/* QuizGrinder 版面風格：TikTok 風（直式短影音動態）
 *
 * 借用：全螢幕直式動態（上下滑動、逐則吸附）、右側動作列（頭像／愛心／留言／分享／收藏）、
 * 左下帳號名稱＋說明文字＋#標籤、頂部「推薦｜錯題」分頁、留言面板、探索格狀牆、個人檔案頁。
 * 每一則「影片」是一題：選項直接疊在畫面上作答。數字都是自己的紀錄，不顯示假的按讚數或觀看數。
 * 鍵盤：↑／↓（或 K／J）換題，1–4（或 A–D）作答目前這題，X 開關解答面板。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon, hue } = SK;
  const S = () => QG.S();
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  Object.assign(SK.ICONS, {
    'tt-share': '<path d="M14 4l7 7-7 7v-4c-5 0-8.5 1.5-11 5 1-5 4-10 11-11z"/>',
    'tt-note': '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    'tt-up': '<path d="M6 15l6-6 6 6"/>',
    'tt-down': '<path d="M6 9l6 6 6-6"/>',
  });

  const ttState = { tab: 'fyp', chip: '', kw: '', limit: 24, prof: 'wrong' };
  const realTags = (q) => q.t.filter((t) => t !== '其他');

  /* ---------------------------------------------------------------- 作答元件（錯題分頁用複習模式記錄） */

  function reviewOptions(q, onDone) {
    let chosen = null;
    const wrap = h('div', { class: 'ans tt-opts', role: 'group', 'aria-label': '選項' });
    const draw = () => fill(wrap, QG.LETTERS.map((L) => {
      const ok = q.all || q.a.includes(L);
      const state = chosen ? (ok ? 'ok' : L === chosen ? 'ng' : 'dim') : '';
      return h('button', { type: 'button', class: 'ans-opt ' + state, disabled: chosen ? true : null, onclick: () => pick(L) },
        h('span', { class: 'ans-l', text: L }), h('span', { class: 'ans-t', text: q.o[L] }),
        chosen && ok ? h('span', { class: 'ans-m', text: '✓' }) : chosen === L ? h('span', { class: 'ans-m', text: '✗' }) : null);
    }));
    function pick(L) {
      if (chosen) return;
      chosen = L;
      const ok = q.all || q.a.includes(L);
      QG.record(q.id, ok, { review: true });
      QG.Store.save();
      QG.updateBadges();
      draw();
      onDone(ok, L);
    }
    draw();
    wrap.pick = (i) => { if (!chosen) pick(QG.LETTERS[i]); };
    return wrap;
  }

  /* ---------------------------------------------------------------- 一則「影片」 */

  function railBtn(ico, label, onclick, extraCls) {
    return h('div', { class: 'tt-act' },
      h('button', { class: 'tt-actbtn ' + (extraCls || ''), type: 'button', 'aria-label': label, title: label, onclick }, icon(ico)),
      h('span', { class: 'tt-actlbl', 'aria-hidden': 'true', text: label }));
  }

  function ttItem(q, review) {
    const r = S().q[q.id];
    const flash = h('p', { class: 'tt-flash', hidden: true, role: 'status' });
    const sheetBody = h('div', { class: 'tt-sheet-body' });
    const sheet = h('div', { class: 'tt-sheet', hidden: true, role: 'region', 'aria-label': '解答與出處' },
      h('div', { class: 'tt-sheet-head' }, h('strong', { text: '解答與出處' }),
        h('button', { class: 'tt-sheet-x', type: 'button', 'aria-label': '關閉解答', onclick: () => { sheet.hidden = true; } }, icon('close'))),
      sheetBody);
    const openSheet = () => {
      const rr = S().q[q.id];
      fill(sheetBody,
        h('div', { class: 'tt-cmt' },
          h('span', { class: 'tt-cmt-av', text: '解' }),
          h('div', null, h('b', { text: '正確答案' }),
            h('p', { text: q.all ? '官方釋疑：所有選項均給分' : q.a.map((L) => `(${L}) ${q.o[L]}`).join('　') + (q.a.length > 1 ? '（均給分）' : '') }))),
        q.x ? h('div', { class: 'tt-cmt' }, h('span', { class: 'tt-cmt-av', text: '析' }), h('div', null, h('b', { text: '解析' }), h('p', { text: q.x }))) : null,
        h('div', { class: 'tt-cmt' },
          h('span', { class: 'tt-cmt-av', style: `--h:${hue(q.src[0].exam)}`, text: '源' }),
          h('div', null, h('b', { text: `出處（考過 ${q.src.length} 次）` }),
            q.src.map((s) => h('p', { text: `${QG.srcLabel(s)}・${(QG.EXAM_MAP.get(s.exam) || {}).title || s.exam}` })))),
        h('div', { class: 'tt-cmt' },
          h('span', { class: 'tt-cmt-av me', text: 'Q' }),
          h('div', null, h('b', { text: '你的紀錄' }),
            h('p', { text: rr && (rr.c + rr.w) ? `作答 ${rr.c + rr.w} 次・答對 ${rr.c} 次・${SK.relTime(rr.t)}` : '還沒作答過這題' }),
            rr && rr.b ? h('p', { class: 'tt-muted', text: `在錯題本第 ${rr.b} 盒` }) : null)));
      sheet.hidden = false;
    };
    const onDone = (ok) => {
      flash.textContent = ok ? '答對了！' : review ? '答錯了，回到第 1 盒' : '答錯了・已加入錯題本';
      flash.className = 'tt-flash ' + (ok ? 'ok' : 'ng');
      flash.hidden = false;
      more.hidden = false;
    };
    const opts = review ? reviewOptions(q, onDone) : SK.answerOptions(q, { cls: 'tt-opts', onDone });
    const more = h('button', { class: 'tt-more', type: 'button', hidden: true, onclick: openSheet }, icon('comment'), '看解答與出處');
    const tags = realTags(q).map((t) => '#' + t.replace(/\s+/g, '')).concat(q.src.length > 1 ? [`#考過${q.src.length}次`] : [], q.fig ? ['#看圖題'] : []);
    const subjIds = () => QG.QS.filter((x) => x.official && x.s === q.s).map((x) => x.id);
    const el = h('section', { class: 'tt-item', style: `--h:${hue(q.t[0] || q.id)}`, 'aria-label': `題目：${q.q.slice(0, 40)}` },
      h('div', { class: 'tt-video' },
        h('div', { class: 'tt-stage' },
          flash,
          h('p', { class: 'tt-q' + (q.q.length > 110 ? ' long' : '') + (q.fig ? ' withfig' : ''), text: q.q }),
          q.fig ? h('figure', { class: 'tt-fig' }, h('img', { src: q.fig, alt: '題目附圖', loading: 'lazy' })) : null,
          opts,
          more),
        h('div', { class: 'tt-cap' },
          h('strong', { class: 'tt-handle' }, '@' + SK.handle(q), h('span', { class: 'tt-dot', text: '・' }), h('span', { class: 'tt-when', text: q.year ? `${q.year} 年` : '模擬題' })),
          h('p', { class: 'tt-text' }, review ? '錯題複習，答對就升一盒 ' : r && (r.c + r.w) ? `你答過 ${r.c + r.w} 次、答對 ${r.c} 次 ` : '選出正確答案 ',
            tags.map((t) => h('span', { class: 'tt-tag', text: t + ' ' }))),
          h('p', { class: 'tt-sound' }, icon('tt-note'), h('span', { class: 'tt-marquee' }, h('span', { text: `原題出處・${q.src.map(QG.srcLabel).join('、')}　　原題出處・${q.src.map(QG.srcLabel).join('、')}` })))),
        sheet),
      h('div', { class: 'tt-rail' },
        h('div', { class: 'tt-act avatar' },
          h('span', { class: 'tt-av', style: `--h:${q.s === 'industry' ? 200 : 340}`, text: QG.SUBJ_CODE[q.s] }),
          h('button', { class: 'tt-follow', type: 'button', 'aria-label': `練習 ${QG.SUBJ_CODE[q.s]} ${QG.SUBJ_SHORT[q.s]} 全部題目`, title: `練習 ${QG.SUBJ_SHORT[q.s]}`,
            onclick: () => QG.startCustomPractice(subjIds(), `${QG.SUBJ_CODE[q.s]} ${QG.SUBJ_SHORT[q.s]}`), text: '+' })),
        h('div', { class: 'tt-act' }, SK.starBtn(q, 'tt-actbtn heart', 'heart'), h('span', { class: 'tt-actlbl', 'aria-hidden': 'true', text: '收藏' })),
        railBtn('comment', '解答', () => { if (sheet.hidden) openSheet(); else sheet.hidden = true; }),
        railBtn('tt-share', '複製', () => SK.copyQuestion(q)),
        railBtn('bookmark', '錯題本', () => SK.addToReview(q)),
        h('span', { class: 'tt-disc', 'aria-hidden': 'true' }, icon('pad'))));
    el.opts = opts;
    el.toggleSheet = () => { if (sheet.hidden) openSheet(); else sheet.hidden = true; };
    return el;
  }

  function endItem(title, text, btns) {
    return h('section', { class: 'tt-item tt-end', style: '--h:340' },
      h('div', { class: 'tt-video' }, h('div', { class: 'tt-stage center' },
        h('span', { class: 'tt-end-ico' }, icon('pad')),
        h('h2', { text: title }), h('p', { text }), h('div', { class: 'tt-end-btns' }, btns))));
  }

  /* ---------------------------------------------------------------- 首頁：動態 */

  function ttHome() {
    const due = QG.dueReviewIds();
    const review = ttState.tab === 'due';
    const ids = review ? due : SK.feedPool('tiktok', S().settings.order === 'weak' ? 'weak' : 'random');
    const feed = h('div', { class: 'tt-feed', 'aria-label': review ? '錯題動態' : '推薦動態' });
    const items = [];
    let n = 0;
    const append = () => {
      const next = ids.slice(n, n + 5);
      n += next.length;
      next.forEach((id) => { const q = QG.QMAP.get(id); if (q) { const it = ttItem(q, review); items.push(it); feed.append(it); } });
      if (n >= ids.length) {
        feed.append(review
          ? (ids.length
            ? endItem('錯題都看完了', `這一輪 ${ids.length} 題已經全部出現過。`, [h('button', { class: 'tt-pill red', type: 'button', text: '回到推薦', onclick: () => setTab('fyp') })])
            : endItem('目前沒有到期的錯題', '答錯的題目會依間隔排程回到這裡。', [h('button', { class: 'tt-pill red', type: 'button', text: '去看推薦', onclick: () => setTab('fyp') })]))
          : endItem('這個範圍的題目都刷完了', `共 ${ids.length} 題。可以到首頁設定換一個練習範圍。`, [
            h('a', { class: 'tt-pill red', href: '#practice', text: '專心練習' }), h('a', { class: 'tt-pill', href: '#exam', text: '模擬考' })]));
      }
    };
    append();
    const cur = () => Math.round(feed.scrollTop / Math.max(1, feed.clientHeight));
    feed.addEventListener('scroll', () => {
      if (n < ids.length && cur() >= items.length - 2) append();
    }, { passive: true });
    const goTo = (i) => {
      const all = feed.children;
      i = Math.max(0, Math.min(all.length - 1, i));
      if (i >= items.length - 2 && n < ids.length) append();
      feed.scrollTo({ top: all[i].offsetTop, behavior: reduced() ? 'auto' : 'smooth' });
    };
    const setTab = (k) => { ttState.tab = k; QG.render(); };

    QG.setKeys((e) => {
      if (document.body.classList.contains('mx-open')) return false;
      const k = e.key;
      if (k === 'ArrowDown' || k === 'j' || k === 'J' || k === 'PageDown') { goTo(cur() + 1); return true; }
      if (k === 'ArrowUp' || k === 'k' || k === 'K' || k === 'PageUp') { goTo(cur() - 1); return true; }
      const it = items[cur()];
      if (!it) return false;
      if ('1234'.includes(k) && k.length === 1) { it.opts.pick(+k - 1); return true; }
      if ('abcdABCD'.includes(k) && k.length === 1) { it.opts.pick('ABCD'.indexOf(k.toUpperCase())); return true; }
      if (k === 'x' || k === 'X') { it.toggleSheet(); return true; }
      return false;
    });

    return h('div', { class: 'tt-feedwrap' },
      h('div', { class: 'tt-tabs', role: 'tablist', 'aria-label': '動態分頁' },
        [['fyp', '推薦'], ['due', due.length ? `錯題 ${due.length > 99 ? '99+' : due.length}` : '錯題']].map(([k, l]) =>
          h('button', { type: 'button', role: 'tab', 'aria-selected': ttState.tab === k ? 'true' : 'false', text: l, onclick: () => setTab(k) }))),
      feed,
      h('div', { class: 'tt-arrows' },
        h('button', { class: 'tt-arrow', type: 'button', 'aria-label': '上一題（↑）', onclick: () => goTo(cur() - 1) }, icon('tt-up')),
        h('button', { class: 'tt-arrow', type: 'button', 'aria-label': '下一題（↓）', onclick: () => goTo(cur() + 1) }, icon('tt-down'))));
  }

  /* ---------------------------------------------------------------- 探索 */

  function tile(q) {
    const r = S().q[q.id];
    return h('div', { class: 'tt-tilewrap' },
      h('button', { class: 'tt-tile', type: 'button', style: `--h:${hue(q.t[0] || q.id)}`, 'aria-label': q.q, onclick: () => openOne(q) },
        q.fig ? h('img', { src: q.fig, alt: '', loading: 'lazy' }) : h('span', { class: 'tt-tile-text', text: q.q }),
        h('span', { class: 'tt-tile-meta' }, icon('stack'), `考過 ${q.src.length} 次`),
        r && (r.c + r.w) ? h('span', { class: 'tt-tile-mine', text: `你 ${r.c}/${r.c + r.w}` }) : null),
      h('p', { class: 'tt-tile-cap', text: realTags(q).map((t) => '#' + t.replace(/\s+/g, '')).join(' ') || '#綜合' }),
      h('p', { class: 'tt-tile-user' }, h('span', { class: 'tt-av mini', style: `--h:${q.s === 'industry' ? 200 : 340}`, text: QG.SUBJ_CODE[q.s].slice(1) }), SK.handle(q)));
  }

  function openOne(q) {
    const it = ttItem(q, false);
    const m = SK.modal(h('div', { class: 'tt-one' }, it), 'tt-modal');
    const onKey = (e) => {
      if (!it.isConnected) { document.removeEventListener('keydown', onKey, true); return; }
      if ('1234'.includes(e.key) && e.key.length === 1) { it.opts.pick(+e.key - 1); e.stopPropagation(); }
    };
    document.addEventListener('keydown', onKey, true);
    SK.setOpenModal(m);
  }

  function ttExplore() {
    const chips = [['', '全部']].concat(QG.TAGS.filter(([t]) => t !== '其他').map(([t]) => [t, t]));
    const input = h('input', { type: 'search', id: 'tt-q', placeholder: '搜尋題目', value: ttState.kw, 'aria-label': '搜尋題目' });
    const grid = h('div', { class: 'tt-grid' });
    const out = h('div');
    const draw = () => {
      const kw = ttState.kw.trim().toLowerCase();
      const list = QG.QS.filter((q) => (!ttState.chip || q.t.includes(ttState.chip)) && (!kw || q.text.includes(kw)))
        .sort((a, b) => b.src.length - a.src.length || b.year - a.year);
      fill(grid, list.slice(0, ttState.limit).map(tile));
      fill(out, grid,
        !list.length ? h('p', { class: 'tt-muted tt-empty', text: '沒有符合的題目' }) : null,
        list.length > ttState.limit ? h('div', { class: 'inf-end' }, h('button', { class: 'tt-pill', type: 'button', text: `載入更多（還有 ${list.length - ttState.limit} 題）`, onclick: () => { ttState.limit += 24; draw(); } })) : null);
    };
    let t;
    input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { ttState.kw = input.value; ttState.limit = 24; draw(); }, 180); });
    draw();
    return h('div', { class: 'tt-page' },
      h('div', { class: 'tt-search mobile' }, icon('search'), input),
      h('div', { class: 'tt-chips', role: 'toolbar', 'aria-label': '主題' }, chips.map(([k, l]) =>
        h('button', { type: 'button', class: 'tt-chip', 'aria-pressed': ttState.chip === k ? 'true' : 'false', text: l, onclick: (e) => {
          ttState.chip = k; ttState.limit = 24;
          e.currentTarget.parentNode.querySelectorAll('.tt-chip').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
          draw();
        } }))),
      out);
  }

  /* ---------------------------------------------------------------- 個人檔案 */

  function ttProfile(base) {
    const st = S();
    const t = QG.totals();
    const wrong = QG.QS.filter((q) => st.q[q.id] && st.q[q.id].w > 0);
    const starred = QG.QS.filter((q) => st.q[q.id] && st.q[q.id].s);
    const tabs = [['wrong', 'grid', '答錯過'], ['star', 'heart', '收藏'], ['data', 'stats', '數據']];
    const list = ttState.prof === 'wrong' ? wrong : starred;
    const content = ttState.prof === 'data' ? base.stats()
      : list.length ? h('div', { class: 'tt-grid' }, list.slice(0, 60).map(tile))
        : h('div', { class: 'tt-emptybox' }, icon(ttState.prof === 'wrong' ? 'grid' : 'heart'),
          h('strong', { text: ttState.prof === 'wrong' ? '還沒有答錯的題目' : '還沒有收藏' }),
          h('p', { class: 'tt-muted', text: ttState.prof === 'wrong' ? '答錯的題目會出現在這裡。' : '在動態按愛心，就會收進這裡。' }));
    return h('div', { class: 'tt-page tt-profile' },
      h('header', { class: 'tt-prof-head' },
        h('span', { class: 'tt-av big', style: '--h:345', text: 'Q' }),
        h('div', { class: 'tt-prof-info' },
          h('h1', { text: 'quizgrinder.learner' }),
          h('p', { class: 'tt-prof-sub', text: '我的學習' }),
          h('div', { class: 'tt-prof-btns' }, h('a', { class: 'tt-pill red', href: '#practice', text: '開始練習' }), h('a', { class: 'tt-pill', href: '#exam', text: '模擬考' })),
          h('ul', { class: 'tt-counts' },
            h('li', null, h('b', { text: QG.fmtNum(t.seen) }), ' 已練題目'),
            h('li', null, h('b', { text: QG.fmtNum(t.c) }), ' 答對'),
            h('li', null, h('b', { text: QG.pct(t.c, t.n) }), ' 正確率'),
            h('li', null, h('b', { text: String(QG.streak()) }), ' 天連續')),
          h('p', { class: 'tt-bio', text: `IPAS 初級電路板製程工程師備考中・錯題本 ${QG.dueReviewIds().length} 題待複習` }))),
      h('nav', { class: 'tt-ptabs', role: 'tablist', 'aria-label': '個人檔案分頁' }, tabs.map(([k, ic, l]) =>
        h('button', { type: 'button', role: 'tab', 'aria-selected': ttState.prof === k ? 'true' : 'false', onclick: () => { ttState.prof = k; QG.render(); } },
          icon(ic), h('span', { text: k === 'wrong' ? `${l} ${wrong.length}` : k === 'star' ? `${l} ${starred.length}` : l })))),
      content);
  }

  /* ---------------------------------------------------------------- 外框 */

  function ttTop() {
    const input = h('input', { type: 'search', id: 'tt-topq', placeholder: '搜尋題目', value: ttState.kw, 'aria-label': '搜尋題目' });
    return h('div', { class: 'sk-top tt-top' },
      h('a', { class: 'tt-brand', href: '#home', 'aria-label': 'QuizGrinder 首頁' }, icon('pad', 'tt-logo'), h('span', { text: 'QuizGrinder' })),
      h('form', { class: 'tt-search', role: 'search', onsubmit: (e) => { e.preventDefault(); ttState.kw = input.value.trim(); ttState.limit = 24; SK.go('browse'); } },
        input, h('span', { class: 'tt-search-sep', 'aria-hidden': 'true' }), h('button', { type: 'submit', 'aria-label': '搜尋' }, icon('search'))),
      h('div', { class: 'sk-right' },
        h('a', { class: 'tt-upload', href: '#practice' }, h('span', { text: '+', 'aria-hidden': 'true' }), '練習'),
        h('a', { class: 'tt-av top', style: '--h:345', href: '#stats', 'aria-label': '個人檔案', text: 'Q' })));
  }

  function ttSide(view) {
    const items = [
      ['home', '推薦', 'home'], ['browse', '探索', 'compass'], ['review', '錯題本', 'review'],
      ['exam', '模擬考', 'exam'], ['practice', '專心練習', 'practice'], ['stats', '個人檔案', 'user'],
    ];
    return h('nav', { class: 'tt-side', 'aria-label': '主要功能' },
      items.map(([v, l, ic]) => h('a', { class: 'tt-side-item', href: '#' + v, 'aria-current': SK.isCurrent(view, v) ? 'page' : null },
        icon(ic), h('span', { text: l }), v === 'review' ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null)),
      h('div', { class: 'tt-side-sep' }),
      h('p', { class: 'tt-side-note', text: '每一則都是一題歷屆考題。往下滑換題，直接點選項作答。' }),
      h('a', { class: 'tt-pill red block', href: '#home', onclick: () => { ttState.tab = 'due'; } }, '刷錯題'),
      h('p', { class: 'tt-side-foot', text: `題庫 ${QG.fmtNum(QG.QS.length)} 題・IPAS 電路板製程工程師` }));
  }

  SK.register({
    id: 'tiktok',
    label: 'TikTok 風',
    group: '社群內容',
    top: ttTop,
    side: ttSide,
    nav: [
      { v: 'home', label: '首頁', icon: 'home' },
      { v: 'browse', label: '探索', icon: 'compass' },
      { v: 'exam', label: '模擬考', icon: 'plus', big: true },
      { v: 'review', label: '錯題', icon: 'review', badge: true },
      { v: 'stats', label: '我', icon: 'user' },
    ],
    views: { home: ttHome, browse: ttExplore, stats: ttProfile },
    after: (view) => { document.documentElement.classList.toggle('tt-feedview', view === 'home'); },
  });
})();
