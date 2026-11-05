/* QuizGrinder 版面風格：Google Sheets 風（試算表）
 *
 * 題庫畫面是一張試算表：工具列、公式列（顯示選取儲存格的完整內容）、欄字母與列號、凍結的標題列；
 * 欄位：編號、科目、主題、題目、A–D、答案（預設隱藏，按「顯示答案欄」才出現）、出處、你的正確率。
 * 點選或方向鍵移動儲存格；Enter、雙擊或列號上的 ▶ 從該題開始練習。下方工作表分頁：L11／L12／錯題／收藏。
 * 試算表在自己的容器內捲動，頁面本身不水平捲動。只借用版面、互動與配色；標誌用 QuizGrinder 焊墊圖示。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon } = SK;
  const S = () => QG.S();
  const PAGE = 100;

  Object.assign(SK.ICONS, {
    'sh-play': '<path d="M8 5v14l11-7z"/>',
    'sh-filter': '<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>',
    'sh-sort': '<path d="M7 4v16M3 16l4 4 4-4M14 6h7M14 11h5M14 16h3"/>',
    'sh-eye': '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    'sh-eyeoff': '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    'sh-fx': '<path d="M14 4h-2a2 2 0 0 0-2 2v12a2 2 0 0 1-2 2H6M7 10h7M15 11l5 6M20 11l-5 6"/>',
    'sh-grid': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    'sh-star': '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
  });

  let NUM = null;
  const numOf = (q) => {
    if (!NUM) { NUM = new Map(); QG.QS.forEach((x, i) => NUM.set(x.id, i + 1)); }
    return NUM.get(q.id) || 0;
  };
  const accOf = (q) => { const r = S().q[q.id]; return r && (r.c + r.w) ? r.c / (r.c + r.w) : null; };

  /* 欄位定義：字母依原始位置固定，隱藏欄的字母會跳過（和試算表一樣） */
  const COLS = [
    { k: 'num', label: '編號', w: 64, cls: 'num', get: (q) => String(numOf(q)) },
    { k: 'subj', label: '科目', w: 56, cls: 'center', get: (q) => QG.SUBJ_CODE[q.s] },
    { k: 'topic', label: '主題', w: 132, get: (q) => q.t.join('、') },
    { k: 'q', label: '題目', w: 380, get: (q) => q.q },
    { k: 'A', label: 'A', w: 150, get: (q) => q.o.A },
    { k: 'B', label: 'B', w: 150, get: (q) => q.o.B },
    { k: 'C', label: 'C', w: 150, get: (q) => q.o.C },
    { k: 'D', label: 'D', w: 150, get: (q) => q.o.D },
    { k: 'ans', label: '答案', w: 64, cls: 'center', get: (q) => (q.all ? 'ABCD' : q.a.join(',')) },
    { k: 'src', label: '出處', w: 168, get: (q) => q.src.map(QG.srcLabel).join('、') },
    { k: 'acc', label: '你的正確率', w: 96, cls: 'num', get: (q) => { const r = S().q[q.id]; return r && (r.c + r.w) ? `${Math.round((r.c / (r.c + r.w)) * 100)}%` : ''; } },
  ];
  COLS.forEach((c, i) => { c.letter = String.fromCharCode(65 + i); });

  const TABS = [
    { k: 'L11', label: 'L11 產業概論', fn: (q) => q.s === 'industry' },
    { k: 'L12', label: 'L12 製造概論', fn: (q) => q.s === 'process' },
    { k: 'wrong', label: '錯題', fn: (q) => { const r = S().q[q.id]; return !!(r && r.b > 0); } },
    { k: 'star', label: '收藏', fn: (q) => { const r = S().q[q.id]; return !!(r && r.s); } },
  ];

  const saved = (S().settings.skinData || {}).sheets || {};
  const sh = { tab: saved.tab || 'L11', tag: '', kw: '', sort: 'num', showAns: false, limit: PAGE, r: 0, c: 3 };
  const persist = () => { const st = S().settings; st.skinData = st.skinData || {}; st.skinData.sheets = { tab: sh.tab }; QG.Store.save(); };

  function rows() {
    const tab = TABS.find((t) => t.k === sh.tab) || TABS[0];
    const kw = sh.kw.trim().toLowerCase();
    let list = QG.QS.filter((q) => tab.fn(q) && (!sh.tag || q.t.includes(sh.tag)) && (!kw || q.text.includes(kw)));
    const nullLast = (x, y, dir) => (x === null && y === null ? 0 : x === null ? 1 : y === null ? -1 : (x - y) * dir);
    if (sh.sort === 'year-desc') list = list.slice().sort((a, b) => b.year - a.year || numOf(a) - numOf(b));
    else if (sh.sort === 'year-asc') list = list.slice().sort((a, b) => (a.year || 9999) - (b.year || 9999) || numOf(a) - numOf(b));
    else if (sh.sort === 'acc-asc') list = list.slice().sort((a, b) => nullLast(accOf(a), accOf(b), 1));
    else if (sh.sort === 'acc-desc') list = list.slice().sort((a, b) => nullLast(accOf(a), accOf(b), -1));
    return list;
  }

  /** 從第 i 列（含）開始練習：保持試算表的順序，不洗牌 */
  function practiceFrom(list, i) {
    const ids = list.slice(i).map((q) => q.id);
    if (!ids.length) return;
    const tab = TABS.find((t) => t.k === sh.tab);
    S().practice = { key: 'custom', label: `試算表：${tab.label} 第 ${i + 2} 列起`, queue: ids, idx: 0, n: 0, c: 0 };
    QG.Store.save();
    location.hash = '#practice';
  }

  /* ---------------------------------------------------------------- 畫面 */
  let app = null;
  function sheetView() {
    app = h('div', { class: 'sheets-app' });
    draw();
    return app;
  }

  function draw(keepFocus) {
    if (!app) return;
    const list = rows();
    const cols = COLS.filter((c) => sh.showAns || c.k !== 'ans');
    const shown = list.slice(0, sh.limit);
    sh.r = Math.max(0, Math.min(sh.r, shown.length - 1));
    sh.c = Math.max(0, Math.min(sh.c, cols.length - 1));
    const prevScroll = app.querySelector('.sheets-scroll');
    const sx = prevScroll ? prevScroll.scrollLeft : 0, sy = prevScroll ? prevScroll.scrollTop : 0;

    const nameBox = h('div', { class: 'sheets-namebox', 'aria-label': '選取的儲存格' });
    const fxText = h('div', { class: 'sheets-fxtext', 'aria-live': 'polite' });
    const sel = () => ({ q: shown[sh.r], col: cols[sh.c] });
    const updateFx = () => {
      const { q, col } = sel();
      nameBox.textContent = q ? `${col.letter}${sh.r + 2}` : '';
      fxText.textContent = q ? col.get(q) : '';
    };

    // 工具列
    const search = h('input', { type: 'search', class: 'sheets-search', placeholder: '搜尋題目或選項', value: sh.kw, 'aria-label': '搜尋' });
    let tmr;
    search.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => { sh.kw = search.value; sh.limit = PAGE; sh.r = 0; draw(); const s = app.querySelector('.sheets-search'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }, 220); });
    const tagSel = h('select', { class: 'sheets-select', 'aria-label': '依主題篩選', onchange: (e) => { sh.tag = e.target.value; sh.limit = PAGE; sh.r = 0; draw(); } },
      h('option', { value: '', text: '全部主題' }), QG.TAGS.map(([t, n]) => h('option', { value: t, text: `${t}（${n}）`, selected: sh.tag === t })));
    const sortSel = h('select', { class: 'sheets-select', 'aria-label': '排序', onchange: (e) => { sh.sort = e.target.value; sh.r = 0; draw(); } },
      [['num', '依編號 A→Z'], ['year-desc', '年份：新→舊'], ['year-asc', '年份：舊→新'], ['acc-asc', '正確率：低→高'], ['acc-desc', '正確率：高→低']].map(([v, l]) => h('option', { value: v, text: l, selected: sh.sort === v })));
    const toolbar = h('div', { class: 'sheets-toolbar', role: 'toolbar', 'aria-label': '工具列' },
      h('label', { class: 'sheets-tool search' }, icon('search'), search),
      h('span', { class: 'sheets-sep' }),
      h('label', { class: 'sheets-tool', title: '篩選' }, icon('sh-filter'), tagSel),
      h('label', { class: 'sheets-tool', title: '排序' }, icon('sh-sort'), sortSel),
      h('span', { class: 'sheets-sep' }),
      h('button', { type: 'button', class: 'sheets-tool btn', 'aria-pressed': sh.showAns ? 'true' : 'false', onclick: () => { sh.showAns = !sh.showAns; draw(); } },
        icon(sh.showAns ? 'sh-eye' : 'sh-eyeoff'), h('span', { text: '顯示答案欄' })),
      h('button', { type: 'button', class: 'sheets-tool btn play', disabled: shown.length ? null : true, onclick: () => practiceFrom(list, sh.r) },
        icon('sh-play'), h('span', { text: shown.length ? `從第 ${sh.r + 2} 列練習` : '從此列練習' })));

    // 表格
    const colgroup = h('colgroup', null, h('col', { style: 'width:46px' }), cols.map((c) => h('col', { style: `width:${c.w}px` })));
    const letters = h('tr', { class: 'sheets-letters' }, h('th', { class: 'sheets-corner', 'aria-hidden': 'true' }),
      cols.map((c, ci) => {
        const afterHidden = !sh.showAns && c.k === 'src';
        return h('th', { class: 'sheets-colhead' + (ci === sh.c ? ' on' : ''), dataset: { c: ci }, scope: 'col' }, c.letter,
          afterHidden ? h('button', { type: 'button', class: 'sheets-unhide', title: '顯示隱藏的答案欄（I）', 'aria-label': '顯示隱藏的答案欄', onclick: () => { sh.showAns = true; draw(); } }, '◂▸') : null);
      }));
    const headRow = h('tr', { class: 'sheets-headrow' }, h('th', { class: 'sheets-rownum', scope: 'row' }, '1'),
      cols.map((c) => h('th', { class: 'sheets-hcell ' + (c.cls || ''), scope: 'col', text: c.label })));
    const body = h('tbody', null, shown.map((q, ri) => h('tr', { class: ri === sh.r ? 'on' : null, dataset: { r: ri } },
      h('th', { class: 'sheets-rownum' + (ri === sh.r ? ' on' : ''), scope: 'row' },
        h('span', { text: String(ri + 2) }),
        h('button', { type: 'button', class: 'sheets-rowplay', tabindex: '-1', 'aria-label': `從第 ${ri + 2} 列開始練習`, title: '從這一題開始練習', onclick: (e) => { e.stopPropagation(); practiceFrom(list, ri); } }, icon('sh-play'))),
      cols.map((c, ci) => {
        const v = c.get(q);
        let extra = '';
        if (c.k === 'acc' && v) { const a = accOf(q); extra = a < 0.5 ? ' low' : a >= 0.8 ? ' high' : ''; }
        return h('td', { id: `sh-${ri}-${ci}`, class: (c.cls || '') + extra + (ri === sh.r && ci === sh.c ? ' sel' : ''), dataset: { r: ri, c: ci }, role: 'gridcell', text: v });
      }))),
    list.length > shown.length ? h('tr', { class: 'sheets-morerow' }, h('th', { class: 'sheets-rownum' }, String(shown.length + 2)),
      h('td', { colspan: String(cols.length) }, h('button', { type: 'button', class: 'sheets-more', onclick: () => { sh.limit += PAGE; draw(); } },
        `載入更多（還有 ${QG.fmtNum(list.length - shown.length)} 列）`))) : null,
    !list.length ? h('tr', { class: 'sheets-morerow' }, h('th', { class: 'sheets-rownum', text: '2' }), h('td', { colspan: String(cols.length), class: 'sheets-empty', text: sh.tab === 'wrong' ? '錯題本目前是空的。' : sh.tab === 'star' ? '還沒有收藏的題目。' : '沒有符合的列。' })) : null);
    const table = h('table', { class: 'sheets-grid', style: `width:${46 + cols.reduce((a, c) => a + c.w, 0)}px` }, colgroup, h('thead', null, letters, headRow), body);
    const scroll = h('div', { class: 'sheets-scroll', tabindex: '0', role: 'grid', 'aria-label': '題庫試算表，方向鍵移動、Enter 從選取列開始練習', 'aria-rowcount': String(list.length + 1),
      'aria-activedescendant': shown.length ? `sh-${sh.r}-${sh.c}` : null }, table);

    const select = (r, c, ensure) => {
      if (!shown.length) return;
      r = Math.max(0, Math.min(r, shown.length - 1));
      c = Math.max(0, Math.min(c, cols.length - 1));
      const old = scroll.querySelector('td.sel');
      if (old) old.classList.remove('sel');
      scroll.querySelectorAll('.on').forEach((e) => e.classList.remove('on'));
      sh.r = r; sh.c = c;
      const td = scroll.querySelector(`#sh-${r}-${c}`);
      td.classList.add('sel');
      td.parentElement.classList.add('on');
      td.parentElement.querySelector('.sheets-rownum').classList.add('on');
      const ch = scroll.querySelector(`.sheets-colhead[data-c="${c}"]`);
      if (ch) ch.classList.add('on');
      scroll.setAttribute('aria-activedescendant', td.id);
      const play = toolbar.querySelector('.play span');
      if (play) play.textContent = `從第 ${r + 2} 列練習`;
      updateFx();
      if (ensure) td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    scroll.addEventListener('click', (e) => {
      const td = e.target.closest('td[data-c]');
      if (td) { select(+td.dataset.r, +td.dataset.c); scroll.focus({ preventScroll: true }); }
    });
    scroll.addEventListener('dblclick', (e) => { const td = e.target.closest('td[data-c]'); if (td) practiceFrom(list, +td.dataset.r); });
    scroll.addEventListener('keydown', (e) => {
      if (e.target !== scroll || e.altKey || e.metaKey) return;
      let { r, c } = sh;
      const k = e.key;
      if (k === 'ArrowDown') r++;
      else if (k === 'ArrowUp') r--;
      else if (k === 'ArrowRight' || (k === 'Tab' && !e.shiftKey && c < cols.length - 1)) c++;
      else if (k === 'ArrowLeft' || (k === 'Tab' && e.shiftKey && c > 0)) c--;
      else if (k === 'PageDown') r += 20;
      else if (k === 'PageUp') r -= 20;
      else if (k === 'Home') { c = 0; if (e.ctrlKey) r = 0; }
      else if (k === 'End') { c = cols.length - 1; if (e.ctrlKey) r = shown.length - 1; }
      else if (k === 'Enter') { e.preventDefault(); practiceFrom(list, sh.r); return; }
      else return;
      e.preventDefault();
      if (r > shown.length - 1 && list.length > shown.length) { sh.limit += PAGE; sh.r = r; sh.c = c; draw(true); return; }
      select(r, c, true);
    });

    const counts = TABS.map((t) => QG.QS.filter(t.fn).length);
    const tabsBar = h('div', { class: 'sheets-tabs', role: 'tablist', 'aria-label': '工作表' },
      h('span', { class: 'sheets-tabs-ico', 'aria-hidden': 'true' }, icon('sh-grid')),
      TABS.map((t, i) => h('button', { type: 'button', role: 'tab', class: 'sheets-tab', 'aria-selected': sh.tab === t.k ? 'true' : 'false',
        onclick: () => { if (sh.tab === t.k) return; sh.tab = t.k; sh.limit = PAGE; sh.r = 0; persist(); draw(); } },
        t.label, h('span', { class: 'sheets-tabn', text: QG.fmtNum(counts[i]) }))),
      h('span', { class: 'spacer' }),
      h('span', { class: 'sheets-sum', text: `計數：${QG.fmtNum(list.length)}` }));

    fill(app, toolbar,
      h('div', { class: 'sheets-fxbar' }, nameBox, h('span', { class: 'sheets-fxsep' }), h('span', { class: 'sheets-fxico', 'aria-hidden': 'true' }, icon('sh-fx')), fxText),
      scroll, tabsBar);
    updateFx();
    scroll.scrollLeft = sx; scroll.scrollTop = sy;
    if (keepFocus === true) { scroll.focus({ preventScroll: true }); select(sh.r, sh.c, true); }
    fit();
  }

  /** 試算表高度＝視窗高度扣掉頂部列與底部（手機底部導覽、切換列），頁面本身不捲動 */
  function fit() {
    if (!app || !app.isConnected) return;
    const top = document.getElementById('topbar');
    const t = top ? top.getBoundingClientRect().height : 0;
    const bottom = innerWidth <= 720 ? 118 : 60;
    app.style.height = Math.max(320, innerHeight - t - bottom) + 'px';
  }
  addEventListener('resize', () => { if (SK.skin() === 'sheets') fit(); });

  /* ---------------------------------------------------------------- 外框 */
  const MENUS = [
    { v: 'home', label: '首頁' }, { v: 'practice', label: '練習' }, { v: 'review', label: '錯題本', badge: true },
    { v: 'exam', label: '模擬考' }, { v: 'browse', label: '題庫' }, { v: 'stats', label: '統計' },
  ];
  function top(view) {
    return h('div', { class: 'sheets-top' },
      h('a', { class: 'sheets-docico', href: '#home', 'aria-label': 'QuizGrinder 首頁' }, icon('pad')),
      h('div', { class: 'sheets-titles' },
        h('div', { class: 'sheets-titlerow' }, h('span', { class: 'sheets-doctitle', text: 'QuizGrinder 題庫' }),
          h('span', { class: 'sheets-saved', text: S().updated ? '變更已自動儲存' : '' })),
        h('nav', { class: 'sheets-menus', 'aria-label': '主要功能' }, MENUS.map((m) => h('a', { href: '#' + m.v, class: 'sheets-menu', 'aria-current': SK.isCurrent(view, m.v) ? 'page' : null },
          m.label, m.badge ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null)))),
      h('div', { class: 'sk-right' },
        h('a', { class: 'sheets-share', href: '#practice' }, icon('sh-play'), h('span', { text: '開始練習' })),
        h('a', { class: 'sk-avatar sheets-av', href: '#stats', 'aria-label': '我的統計', text: 'Q' })));
  }

  const NAV = [
    { v: 'home', label: '首頁', icon: 'home' },
    { v: 'browse', label: '試算表', icon: 'sh-grid' },
    { v: 'practice', label: '練習', icon: 'practice' },
    { v: 'review', label: '錯題本', icon: 'review', badge: true },
    { v: 'stats', label: '統計', icon: 'stats' },
  ];
  SK.register({
    id: 'sheets', label: 'Google Sheets 風', group: '生產力', top, nav: NAV,
    views: { browse: sheetView },
    after: (view) => { if (view === 'browse') fit(); else app = null; },
  });
})();
