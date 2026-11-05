/* QuizGrinder 版面風格：Google 日曆風（gcal）
 *
 * 首頁變成月曆／週曆：過去的日子顯示當天作答紀錄、未來的日子顯示錯題本的複習排程、
 * 考過模擬考的日子顯示成績；點一天打開詳細面板，可直接開始那天的複習。
 * 左側欄：＋ 建立、迷你月曆、圖層勾選（作答紀錄／複習排程／模擬考）。
 * 只借用版面、互動與配色；標誌用 QuizGrinder 的焊墊圖示。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon } = SK;
  const S = () => QG.S();
  const WD = ['日', '一', '二', '三', '四', '五', '六'];
  const LAYERS = [
    ['log', '作答紀錄'],
    ['due', '複習排程'],
    ['exam', '模擬考'],
  ];

  Object.assign(SK.ICONS, {
    gcalPrev: '<path d="M15 5l-7 7 7 7"/>',
    gcalNext: '<path d="M9 5l7 7-7 7"/>',
    gcalPlus: '<path d="M12 5v14M5 12h14"/>',
    gcalCal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  });

  /* 小狀態：檢視模式與圖層存在 settings.skinData.gcal；游標日期與選取日只在本次瀏覽 */
  function data() {
    const s = S().settings;
    if (!s.skinData) s.skinData = {};
    const d = s.skinData.gcal || (s.skinData.gcal = {});
    if (d.mode !== 'week') d.mode = 'month';
    if (!d.layers) d.layers = { log: true, due: true, exam: true };
    return d;
  }
  const ui = { cur: new Date(), sel: null };

  const keyOf = (d) => QG.dayKey(d);
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return x; };
  const monthTitle = (d) => `${d.getFullYear()}年${d.getMonth() + 1}月`;

  /** 依日期整理所有事件 */
  function collect() {
    const s = S();
    const today = keyOf(new Date());
    const due = {};
    const touched = {};
    for (const [id, r] of Object.entries(s.q)) {
      if (!QG.QMAP.has(id)) continue;
      if (r.b > 0) {
        let k = keyOf(new Date(r.d || Date.now()));
        if (k < today) k = today; // 逾期的併到今天
        (due[k] || (due[k] = [])).push(id);
      }
      if (r.t) { const k = keyOf(new Date(r.t)); (touched[k] || (touched[k] = [])).push(id); }
    }
    const exams = {};
    s.exams.forEach((e) => { const k = keyOf(new Date(e.ts)); (exams[k] || (exams[k] = [])).push(e); });
    return { today, log: s.days, due, exams, touched };
  }

  function eventsOf(ev, k) {
    const L = data().layers;
    const out = [];
    const d = ev.log[k];
    if (L.log && d && d.n) out.push({ type: 'log', long: `作答 ${d.n} 題・答對 ${d.c}`, short: `${d.n}題`, title: `作答 ${d.n} 題`, sub: `答對 ${d.c}・${QG.pct(d.c, d.n)}` });
    if (L.exam && ev.exams[k]) ev.exams[k].forEach((e) => out.push({ type: 'exam', long: `模擬考 ${QG.SUBJ_CODE[e.subject] || ''} ${e.score} 分`, short: `考${e.score}`,
      title: `模擬考 ${QG.SUBJ_CODE[e.subject] || ''}`, sub: `${e.score} 分・答對 ${e.correct}/${e.total}` }));
    if (L.due && ev.due[k] && k >= ev.today) out.push({ type: 'due', long: `複習 ${ev.due[k].length} 題`, short: `複習${ev.due[k].length}`, title: `複習 ${ev.due[k].length} 題`, sub: k === ev.today ? '今天到期' : '錯題本排程' });
    return out;
  }

  function chip(e, onclick) {
    return h('button', { type: 'button', class: 'gcal-ev ' + e.type, title: e.long, onclick },
      h('span', { class: 'gcal-ev-l', text: e.long }), h('span', { class: 'gcal-ev-s', 'aria-hidden': 'true', text: e.short }));
  }

  /* ---------------------------------------------------------------- 操作 */
  function setCur(d) { ui.cur = d; }
  function shift(dir) {
    const c = ui.cur;
    setCur(data().mode === 'week' ? addDays(c, dir * 7) : new Date(c.getFullYear(), c.getMonth() + dir, 1));
    ui.sel = null;
    show();
  }
  function goToday() { setCur(new Date()); ui.sel = null; show(); }
  function setMode(m) { data().mode = m; QG.Store.save(); show(); }
  function show() { if (QG.currentView === 'home') QG.render(); else SK.go('home'); }
  function openDay(k) {
    ui.sel = k;
    const d = parseKey(k);
    if (data().mode === 'month' && (d.getMonth() !== ui.cur.getMonth() || d.getFullYear() !== ui.cur.getFullYear())) ui.cur = d;
    if (data().mode === 'week') ui.cur = d;
    if (window.matchMedia('(max-width: 720px)').matches && QG.currentView === 'home') {
      const m =SK.modal(h('div', { class: 'gcal-sheet-body' }, dayPanel(k, () => m.close())), 'gcal-sheet', () => { ui.sel = null; markSel(); });
      if (SK.setOpenModal) SK.setOpenModal(m);
      markSel();
      return;
    }
    show();
  }
  function markSel() {
    document.querySelectorAll('.gcal-cell, .gcal-wcol').forEach((el) => el.classList.toggle('sel', el.dataset.k === ui.sel));
  }

  /* ---------------------------------------------------------------- 頂部列 */
  function top(view) {
    const d = data();
    const c = ui.cur;
    let title = monthTitle(c);
    if (d.mode === 'week' && view === 'home') {
      const a = addDays(c, -c.getDay());
      const b = addDays(a, 6);
      title = a.getMonth() === b.getMonth() ? monthTitle(a) : `${a.getFullYear()}年${a.getMonth() + 1}月 – ${b.getFullYear() !== a.getFullYear() ? b.getFullYear() + '年' : ''}${b.getMonth() + 1}月`;
    }
    const names = { practice: '練習', review: '錯題本', exam: '模擬考', result: '考試結果', browse: '題庫', stats: '統計' };
    return h('div', { class: 'sk-top gcal-top' },
      h('a', { class: 'gcal-logo', href: '#home', 'aria-label': 'QuizGrinder 日曆首頁' }, icon('pad', 'gcal-logo-ico'), h('span', { class: 'gcal-logo-t', text: '日曆' })),
      h('button', { type: 'button', class: 'gcal-today', onclick: goToday, text: '今天' }),
      h('span', { class: 'gcal-arrows' },
        h('button', { type: 'button', class: 'gcal-iconbtn', 'aria-label': d.mode === 'week' ? '上一週' : '上個月', onclick: () => shift(-1) }, icon('gcalPrev')),
        h('button', { type: 'button', class: 'gcal-iconbtn', 'aria-label': d.mode === 'week' ? '下一週' : '下個月', onclick: () => shift(1) }, icon('gcalNext'))),
      h('h1', { class: 'gcal-title' }, title, view !== 'home' && names[view] ? h('span', { class: 'gcal-title-sub', text: '・' + names[view] }) : null),
      h('span', { class: 'spacer' }),
      h('a', { class: 'gcal-iconbtn gcal-search', href: '#browse', 'aria-label': '搜尋題庫' }, icon('search')),
      h('div', { class: 'gcal-switch', role: 'group', 'aria-label': '檢視方式' },
        [['month', '月'], ['week', '週']].map(([m, l]) => h('button', { type: 'button', 'aria-pressed': d.mode === m && view === 'home' ? 'true' : 'false', text: l, onclick: () => setMode(m) }))),
      h('a', { class: 'gcal-avatar', href: '#stats', 'aria-label': '我的統計', text: 'Q' }));
  }

  /* ---------------------------------------------------------------- 左側欄 */
  function miniCal(ev) {
    const c = ui.cur;
    const first = new Date(c.getFullYear(), c.getMonth(), 1);
    const start = addDays(first, -first.getDay());
    const rows = Math.ceil((first.getDay() + new Date(c.getFullYear(), c.getMonth() + 1, 0).getDate()) / 7);
    const cells = [];
    for (let i = 0; i < rows * 7; i++) {
      const d = addDays(start, i);
      const k = keyOf(d);
      const busy = (ev.log[k] && ev.log[k].n) || ev.exams[k] || (ev.due[k] && k >= ev.today);
      cells.push(h('button', { type: 'button', class: 'gcal-mini-d' + (d.getMonth() !== c.getMonth() ? ' out' : '') + (k === ev.today ? ' today' : '') + (k === ui.sel ? ' sel' : '') + (busy ? ' busy' : ''),
        'aria-label': `${d.getMonth() + 1}月${d.getDate()}日`, text: String(d.getDate()), onclick: () => openDay(k) }));
    }
    return h('div', { class: 'gcal-mini' },
      h('div', { class: 'gcal-mini-head' }, h('span', { text: monthTitle(c) }),
        h('button', { type: 'button', class: 'gcal-iconbtn sm', 'aria-label': '上個月', onclick: () => { ui.cur = new Date(c.getFullYear(), c.getMonth() - 1, 1); show(); } }, icon('gcalPrev')),
        h('button', { type: 'button', class: 'gcal-iconbtn sm', 'aria-label': '下個月', onclick: () => { ui.cur = new Date(c.getFullYear(), c.getMonth() + 1, 1); show(); } }, icon('gcalNext'))),
      h('div', { class: 'gcal-mini-grid' }, WD.map((w) => h('span', { class: 'gcal-mini-w', text: w })), cells));
  }

  function layerToggles(cls) {
    const L = data().layers;
    return h('div', { class: 'gcal-layers ' + (cls || '') }, LAYERS.map(([k, l]) => h('label', { class: 'gcal-layer ' + k },
      h('input', { type: 'checkbox', checked: !!L[k], onchange: (e) => { L[k] = e.target.checked; QG.Store.save(); QG.render(); } }),
      h('span', { text: l }))));
  }

  function side(view) {
    const ev = collect();
    const links = [['practice', '練習', 'practice'], ['review', '錯題本', 'review'], ['exam', '模擬考', 'exam'], ['browse', '題庫', 'browse'], ['stats', '統計', 'stats']];
    return h('nav', { class: 'gcal-side', 'aria-label': '日曆側欄' },
      h('button', { type: 'button', class: 'gcal-create', onclick: () => SK.go('practice') }, icon('gcalPlus'), h('span', { text: '建立' })),
      miniCal(ev),
      h('div', { class: 'gcal-side-sec' }, h('h2', { class: 'gcal-side-h', text: '我的日曆' }), layerToggles()),
      h('div', { class: 'gcal-side-sec' }, h('h2', { class: 'gcal-side-h', text: '前往' }),
        h('a', { class: 'gcal-link', href: '#home', 'aria-current': view === 'home' ? 'page' : null }, icon('gcalCal'), h('span', { text: '日曆' })),
        links.map(([v, l, ic]) => h('a', { class: 'gcal-link', href: '#' + v, 'aria-current': SK.isCurrent(view, v) ? 'page' : null }, icon(ic), h('span', { text: l }),
          v === 'review' ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null))));
  }

  /* ---------------------------------------------------------------- 月／週 */
  function monthGrid(ev) {
    const c = ui.cur;
    const first = new Date(c.getFullYear(), c.getMonth(), 1);
    const start = addDays(first, -first.getDay());
    const rows = Math.ceil((first.getDay() + new Date(c.getFullYear(), c.getMonth() + 1, 0).getDate()) / 7);
    const cells = [];
    for (let i = 0; i < rows * 7; i++) {
      const d = addDays(start, i);
      const k = keyOf(d);
      const evs = eventsOf(ev, k);
      const max = 3;
      cells.push(h('div', { class: 'gcal-cell' + (d.getMonth() !== c.getMonth() ? ' out' : '') + (k === ev.today ? ' today' : '') + (k === ui.sel ? ' sel' : '') + (k < ev.today ? ' past' : ''),
        dataset: { k }, onclick: (e) => { if (e.target === e.currentTarget) openDay(k); } },
        h('button', { type: 'button', class: 'gcal-dnum', 'aria-label': `${d.getMonth() + 1}月${d.getDate()}日，${evs.length ? evs.map((x) => x.long).join('、') : '沒有活動'}`, onclick: () => openDay(k) },
          d.getDate() === 1 ? `${d.getMonth() + 1}月${d.getDate()}日` : String(d.getDate())),
        h('div', { class: 'gcal-evs' }, evs.slice(0, max).map((e) => chip(e, () => openDay(k))),
          evs.length > max ? h('button', { type: 'button', class: 'gcal-more', text: `還有 ${evs.length - max} 項`, onclick: () => openDay(k) }) : null)));
    }
    return h('div', { class: 'gcal-month', style: `--rows:${rows}` },
      WD.map((w) => h('div', { class: 'gcal-wd', text: w })), cells);
  }

  function weekGrid(ev) {
    const start = addDays(ui.cur, -ui.cur.getDay());
    const cols = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const k = keyOf(d);
      const evs = eventsOf(ev, k);
      cols.push(h('div', { class: 'gcal-wcol' + (k === ev.today ? ' today' : '') + (k === ui.sel ? ' sel' : '') + (k < ev.today ? ' past' : ''), dataset: { k } },
        h('button', { type: 'button', class: 'gcal-whead', onclick: () => openDay(k), 'aria-label': `${d.getMonth() + 1}月${d.getDate()}日 星期${WD[i]}` },
          h('span', { class: 'gcal-wname', text: WD[i] }), h('span', { class: 'gcal-wnum', text: String(d.getDate()) })),
        h('div', { class: 'gcal-wbody', onclick: (e) => { if (e.target === e.currentTarget) openDay(k); } },
          evs.map((e) => h('button', { type: 'button', class: 'gcal-ev tall ' + e.type, title: e.long, onclick: () => openDay(k) },
            h('span', { class: 'gcal-ev-t', text: e.title }), h('span', { class: 'gcal-ev-sub', text: e.sub }))))));
    }
    return h('div', { class: 'gcal-week' }, cols);
  }

  /* ---------------------------------------------------------------- 單日詳細 */
  function qLine(id) {
    const q = QG.QMAP.get(id);
    return h('li', null, h('span', { class: 'gcal-q', text: q.q }), h('span', { class: 'gcal-qsrc', text: QG.srcLabel(q.src[0]) }));
  }

  function dayPanel(k, onClose) {
    const ev = collect();
    const d = parseKey(k);
    const log = ev.log[k];
    const due = k >= ev.today ? (ev.due[k] || []) : [];
    const exams = ev.exams[k] || [];
    const touched = ev.touched[k] || [];
    const isToday = k === ev.today;
    const future = k > ev.today;
    const secs = [];
    if (log && log.n) {
      secs.push(h('section', { class: 'gcal-dsec log' },
        h('h3', null, h('i', { class: 'gcal-dot' }), '作答紀錄'),
        h('p', { class: 'gcal-big', text: `作答 ${log.n} 題・答對 ${log.c} 題（${QG.pct(log.c, log.n)}）` }),
        touched.length ? h('p', { class: 'gcal-note', text: `其中 ${touched.length} 題最後一次作答是在這天：` }) : null,
        touched.length ? h('ul', { class: 'gcal-qs' }, touched.slice(0, 4).map(qLine)) : null,
        touched.length ? h('button', { type: 'button', class: 'gcal-btn', text: `重練這 ${touched.length} 題`, onclick: () => QG.startCustomPractice(touched, `${d.getMonth() + 1}/${d.getDate()} 作答過的題目`) }) : null));
    }
    if (due.length) {
      secs.push(h('section', { class: 'gcal-dsec due' },
        h('h3', null, h('i', { class: 'gcal-dot' }), '複習排程'),
        h('p', { class: 'gcal-big', text: isToday ? `${due.length} 題今天到期（含逾期）` : `${due.length} 題排在這天複習` }),
        h('ul', { class: 'gcal-qs' }, due.slice(0, 4).map(qLine)),
        h('button', { type: 'button', class: 'gcal-btn primary', text: isToday ? `開始複習 ${due.length} 題` : `提前複習這 ${due.length} 題`, onclick: () => QG.startReview(due) })));
    }
    exams.forEach((e) => {
      const t = new Date(e.ts);
      secs.push(h('section', { class: 'gcal-dsec exam' },
        h('h3', null, h('i', { class: 'gcal-dot' }), '模擬考'),
        h('p', { class: 'gcal-big', text: `${QG.SUBJ_CODE[e.subject] || ''} ${QG.SUBJ_SHORT[e.subject] || ''}：${e.score} 分` }),
        h('p', { class: 'gcal-note', text: `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}・答對 ${e.correct} / ${e.total}・用時 ${Math.round((e.dur || 0) / 60)} 分鐘` })));
    });
    if (exams.length) secs.push(h('a', { class: 'gcal-btn', href: '#exam', text: '再考一次模擬考' }));
    if (!secs.length) {
      secs.push(h('div', { class: 'gcal-dempty' },
        h('p', { text: future ? '這天還沒有排程的複習。' : isToday ? '今天還沒有作答。' : '這天沒有作答紀錄。' }),
        !future || isToday ? h('button', { type: 'button', class: 'gcal-btn primary', onclick: () => SK.go('practice') }, icon('gcalPlus'), '建立練習') : null));
    }
    return h('aside', { class: 'gcal-day', 'aria-label': `${d.getMonth() + 1}月${d.getDate()}日詳細` },
      h('header', { class: 'gcal-day-head' },
        h('div', { class: 'gcal-day-date' + (isToday ? ' today' : '') },
          h('span', { class: 'gcal-day-w', text: '星期' + WD[d.getDay()] }), h('span', { class: 'gcal-day-n', text: String(d.getDate()) })),
        h('div', { class: 'gcal-day-t' }, h('strong', { text: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日` }),
          h('span', { text: isToday ? '今天' : future ? `${Math.round((d - parseKey(ev.today)) / 864e5)} 天後` : `${Math.round((parseKey(ev.today) - d) / 864e5)} 天前` })),
        onClose ? h('button', { type: 'button', class: 'gcal-iconbtn', 'aria-label': '關閉詳細', onclick: onClose }, icon('close')) : null),
      secs);
  }

  /* ---------------------------------------------------------------- 首頁 */
  function home() {
    const ev = collect();
    const mode = data().mode;
    const due = QG.dueReviewIds().length;
    const today = ev.log[ev.today] || { n: 0, c: 0 };
    const wide = !window.matchMedia('(max-width: 720px)').matches;
    const panel = wide && ui.sel ? dayPanel(ui.sel, () => { ui.sel = null; QG.render(); }) : null;
    return h('div', { class: 'gcal-home' + (panel ? ' has-day' : '') },
      h('div', { class: 'gcal-mobilebar' }, layerToggles('chips')),
      h('div', { class: 'gcal-main' },
        mode === 'week' ? weekGrid(ev) : monthGrid(ev),
        h('p', { class: 'gcal-foot' }, `今天作答 ${today.n} 題・答對 ${today.c}・`, due ? h('button', { type: 'button', class: 'gcal-linkbtn', text: `${due} 題到期待複習`, onclick: () => QG.startReview() }) : '沒有到期的錯題',
          `・連續 ${QG.streak()} 天`)),
      panel,
      h('button', { type: 'button', class: 'gcal-fab', 'aria-label': '建立練習', onclick: () => SK.go('practice') }, icon('gcalPlus')));
  }

  const NAV = [
    { v: 'home', label: '日曆', icon: 'gcalCal' },
    { v: 'practice', label: '練習', icon: 'practice' },
    { v: 'review', label: '錯題', icon: 'review', badge: true },
    { v: 'exam', label: '模擬考', icon: 'exam' },
    { v: 'stats', label: '統計', icon: 'stats' },
  ];

  SK.register({ id: 'gcal', label: 'Google 日曆風', group: '生產力', top, side, nav: NAV, views: { home } });
})();
