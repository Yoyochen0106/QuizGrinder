/* QuizGrinder 版面風格：Notion 風（工作區）
 *
 *   左側頁面樹：概覽、題庫資料庫（主題為子頁面）、錯題本、模擬考、統計
 *   概覽：大標題＋頁面圖示、提示框、可展開區塊、今日目標（唯讀待辦，依真實紀錄打勾）
 *   題庫資料庫：表格／看板／圖庫／清單四種檢視、篩選（科目、主題）與排序（年份、你的正確率），
 *              點一列在右側開啟預覽（屬性、答案切換區塊、可作答選項）
 * 只借用版面、互動與配色；標誌用 QuizGrinder 焊墊圖示。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon } = SK;
  const S = () => QG.S();

  Object.assign(SK.ICONS, {
    'nt-check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'nt-page': '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
    'nt-db': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
    'nt-board': '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>',
    'nt-gallery': '<rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="3" y="13" width="8" height="7" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/>',
    'nt-list': '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    'nt-caret': '<path d="M9 6l6 6-6 6"/>',
    'nt-text': '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
    'nt-select': '<circle cx="12" cy="12" r="9"/><path d="M8.5 11l3.5 3.5 3.5-3.5"/>',
    'nt-multi': '<path d="M4 7h10M4 12h16M4 17h8"/><circle cx="18" cy="7" r="2"/>',
    'nt-num': '<path d="M9 4L7 20M17 4l-2 16M4 9h16M3 15h16"/>',
    'nt-link': '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    'nt-clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'nt-sort': '<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>',
    'nt-filter': '<path d="M4 6h16M7 12h10M10 18h4"/>',
    'nt-side': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
    'nt-gear': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  });

  /* 標籤色（Notion 的九色調色盤），依字串穩定取色 */
  const COLORS = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];
  const colorOf = (s) => (s === 'industry' ? 'blue' : s === 'process' ? 'green' : COLORS[SK.hue(s) % COLORS.length]);
  const tagEl = (text, color) => h('span', { class: 'notion-tag c-' + color, text });
  const topics = (q) => q.t.filter((t) => t !== '其他');
  const accOf = (id) => { const r = S().q[id]; return r && (r.c + r.w) ? r.c / (r.c + r.w) : null; };
  const titleOf = (q) => (q.q.length > 60 ? q.q.slice(0, 60) + '…' : q.q);
  const fmtDT = (ts) => new Date(ts).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' });

  /** 頁面圖示（SVG，取代表情符號） */
  function pageIcon(name, big) {
    return h('span', { class: 'notion-picon' + (big ? ' big' : ''), 'aria-hidden': 'true' }, icon(name));
  }

  /* ---------------------------------------------------------------- 狀態 */
  const db = Object.assign({ view: 'table', group: 'subject', subj: 'all', tag: '', sort: 'none', kw: '', limit: 50 }, (S().settings.skinData || {}).notion || {});
  db.limit = 50;
  function saveDb() {
    const st = S().settings;
    st.skinData = st.skinData || {};
    st.skinData.notion = { view: db.view, group: db.group, subj: db.subj, tag: db.tag, sort: db.sort };
    QG.Store.save();
  }
  let treeOpen = true;

  /* ---------------------------------------------------------------- 側欄與頂部 */
  const PAGES = [
    { v: 'home', label: '概覽', icon: 'nt-page' },
    { v: 'browse', label: '題庫資料庫', icon: 'nt-db', tree: true },
    { v: 'review', label: '錯題本', icon: 'review', badge: true },
    { v: 'exam', label: '模擬考', icon: 'exam' },
    { v: 'stats', label: '統計', icon: 'stats' },
  ];

  function side(view) {
    const root = document.documentElement;
    root.classList.remove('notion-drawer');
    const item = (p) => {
      const cur = SK.isCurrent(view, p.v) && !(p.tree && db.tag);
      const row = h('div', { class: 'notion-tree-row' + (cur ? ' cur' : '') },
        p.tree ? h('button', { type: 'button', class: 'notion-caret' + (treeOpen ? ' open' : ''), 'aria-label': treeOpen ? '收合子頁面' : '展開子頁面', 'aria-expanded': treeOpen ? 'true' : 'false',
          onclick: (e) => { treeOpen = !treeOpen; const s = document.getElementById('sidebar'); fill(s, side(QG.currentView)); e.stopPropagation(); } }, icon('nt-caret'))
          : h('span', { class: 'notion-caret-space' }),
        h('a', { href: '#' + p.v, class: 'notion-tree-link', 'aria-current': cur ? 'page' : null,
          onclick: p.v === 'browse' ? () => { db.tag = ''; saveDb(); } : null },
          pageIcon(p.icon), h('span', { class: 'notion-tree-label', text: p.label }),
          p.badge ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null));
      if (!p.tree || !treeOpen) return row;
      return [row, h('div', { class: 'notion-tree-children', role: 'group' },
        QG.TAGS.filter(([t]) => t !== '其他').map(([t, n]) => {
          const on = view === 'browse' && db.tag === t;
          return h('div', { class: 'notion-tree-row sub' + (on ? ' cur' : '') }, h('span', { class: 'notion-caret-space' }),
            h('button', { type: 'button', class: 'notion-tree-link', 'aria-current': on ? 'page' : null,
              onclick: () => { db.tag = t; db.limit = 50; saveDb(); SK.go('browse'); } },
              pageIcon('nt-page'), h('span', { class: 'notion-tree-label', text: t }), h('span', { class: 'notion-tree-n', text: n })));
        }))];
    };
    return h('nav', { class: 'notion-side', 'aria-label': '頁面' },
      h('div', { class: 'notion-ws' },
        h('span', { class: 'notion-ws-ico' }, icon('pad')),
        h('span', { class: 'notion-ws-name', text: 'QuizGrinder 的工作區' }),
        h('button', { type: 'button', class: 'notion-side-close', 'aria-label': '關閉側欄', onclick: () => root.classList.remove('notion-drawer') }, icon('close'))),
      h('div', { class: 'notion-quick' },
        h('a', { class: 'notion-tree-link', href: '#browse', onclick: () => { db.tag = ''; db.kw = ''; } }, pageIcon('search'), h('span', { class: 'notion-tree-label', text: '搜尋' })),
        h('a', { class: 'notion-tree-link', href: '#practice', 'aria-current': view === 'practice' ? 'page' : null }, pageIcon('practice'), h('span', { class: 'notion-tree-label', text: '專心練習' }))),
      h('div', { class: 'notion-sec-title', text: '私人' }),
      h('div', { class: 'notion-tree', role: 'tree' }, PAGES.map(item)));
  }

  const CRUMB = { home: '概覽', browse: '題庫資料庫', review: '錯題本', exam: '模擬考', result: '考試結果', stats: '統計', practice: '專心練習' };
  function lastEdit() {
    let t = 0;
    for (const r of Object.values(S().q)) if (r.t > t) t = r.t;
    return t;
  }
  function top(view) {
    const t = lastEdit();
    return h('div', { class: 'sk-top notion-top' },
      h('button', { type: 'button', class: 'notion-menu-btn', 'aria-label': '開啟側欄', onclick: () => document.documentElement.classList.add('notion-drawer') }, icon('menu')),
      h('div', { class: 'notion-crumbs' },
        h('a', { href: '#home', class: 'notion-crumb' }, pageIcon('pad'), h('span', { text: 'QuizGrinder' })),
        h('span', { class: 'notion-crumb-sep', text: '/' }),
        h('span', { class: 'notion-crumb cur' }, h('span', { text: CRUMB[view] || '' })),
        view === 'browse' && db.tag ? [h('span', { class: 'notion-crumb-sep', text: '/' }), h('span', { class: 'notion-crumb cur', text: db.tag })] : null),
      h('div', { class: 'sk-right' },
        h('span', { class: 'notion-edited', text: t ? `最後作答 ${SK.relTime(t)}` : '尚未作答' }),
        h('a', { class: 'notion-top-btn', href: '#practice', text: '開始練習' })));
  }

  /* ---------------------------------------------------------------- 概覽 */
  function toggleBlock(title, body, open) {
    const d = h('details', { class: 'notion-toggle', open: open ? true : null },
      h('summary', null, h('span', { class: 'notion-tri', 'aria-hidden': 'true' }, icon('nt-caret')), h('span', { text: title })));
    const inner = h('div', { class: 'notion-toggle-body' });
    d.append(inner);
    let built = false;
    const build = () => { if (!built && d.open) { built = true; fill(inner, typeof body === 'function' ? body() : body); } };
    d.addEventListener('toggle', build);
    build();
    return d;
  }
  function todo(label, done, sub) {
    return h('div', { class: 'notion-todo' + (done ? ' done' : ''), role: 'checkbox', 'aria-checked': done ? 'true' : 'false', 'aria-readonly': 'true' },
      h('span', { class: 'notion-check', 'aria-hidden': 'true' }, done ? icon('nt-check') : null),
      h('span', { class: 'notion-todo-text' }, h('span', { class: 'notion-todo-label', text: label }), sub ? h('span', { class: 'notion-todo-sub', text: sub }) : null));
  }

  function homePage() {
    const st = S();
    const today = st.days[QG.dayKey()] || { n: 0, c: 0 };
    const t = QG.totals();
    const due = QG.dueReviewIds().length;
    const examsToday = st.exams.filter((e) => QG.dayKey(new Date(e.ts)) === QG.dayKey()).length;
    const p = st.practice;
    const goals = [
      ['今天作答 20 題', today.n >= 20, `目前 ${today.n} 題`],
      ['今天答對 15 題', today.c >= 15, `目前 ${today.c} 題`],
      ['清空到期的錯題', due === 0, due ? `還有 ${due} 題到期` : '沒有到期的錯題'],
      ['完成 1 場模擬考', examsToday >= 1, examsToday ? `今天已考 ${examsToday} 場` : '今天還沒考'],
    ];
    const doneN = goals.filter((g) => g[1]).length;
    const subjRow = (s) => {
      const ids = QG.QS.filter((q) => q.s === s && q.official).map((q) => q.id);
      const pr = SK.progressOf(ids);
      return QG.barRow(`${QG.SUBJ_CODE[s]} ${QG.SUBJ_SHORT[s]}`, pr.seen, ids.length);
    };
    const exams = st.exams.slice(-5).reverse();
    return h('article', { class: 'notion-page' },
      h('div', { class: 'notion-cover', 'aria-hidden': 'true' }),
      h('div', { class: 'notion-page-inner' },
        pageIcon('pad', true),
        h('h1', { class: 'notion-title', text: '概覽' }),
        h('div', { class: 'notion-callout' }, h('span', { class: 'notion-callout-ico' }, icon('bulb')),
          h('div', null,
            h('p', null, `今天已作答 `, h('b', { text: String(today.n) }), ` 題、答對 `, h('b', { text: String(today.c) }), ` 題；累計已練 ${QG.fmtNum(t.seen)} / ${QG.fmtNum(QG.QS.length)} 題，總正確率 ${QG.pct(t.c, t.n)}。`),
            h('p', null, due ? h('a', { href: '#review', text: `錯題本有 ${due} 題到期待複習 →` }) : '錯題本目前沒有到期的題目。', QG.streak() ? `　連續練習 ${QG.streak()} 天。` : ''))),
        h('h2', { class: 'notion-h2', text: '今日目標' }),
        h('p', { class: 'notion-muted', text: `${doneN} / ${goals.length} 完成・依今天的作答紀錄自動勾選` }),
        h('div', { class: 'notion-todos' }, goals.map(([l, d, s]) => todo(l, d, s))),
        h('h2', { class: 'notion-h2', text: '快速開始' }),
        toggleBlock(p && p.idx > 0 && p.idx < p.queue.length ? `繼續練習：${p.label}` : '開始練習', () => [
          h('p', { text: p && p.idx < p.queue.length ? `${p.label}・第 ${p.idx + 1} / ${p.queue.length} 題` : `從「${QG.filterLabel(st.settings.filters)}」開始新的一輪。` }),
          h('div', { class: 'notion-btnrow' },
            h('a', { class: 'notion-btn primary', href: '#practice', text: '開啟練習' }),
            due ? h('a', { class: 'notion-btn', href: '#review', text: `複習錯題 ${due} 題` }) : null,
            h('a', { class: 'notion-btn', href: '#exam', text: '模擬考' }))], true),
        toggleBlock('練習範圍設定', () => QG.rangePanel()),
        toggleBlock('各科進度', () => h('div', { class: 'bars' }, subjRow('industry'), subjRow('process'))),
        toggleBlock('最近的模擬考', () => exams.length
          ? h('ul', { class: 'notion-bullets' }, exams.map((e) => h('li', null, `${fmtDT(e.ts)}・${QG.SUBJ_CODE[e.subject]} ${QG.SUBJ_SHORT[e.subject]}・`, h('b', { text: `${e.score} 分` }), `（${e.correct}/${e.total}）`)))
          : h('p', { class: 'notion-muted', text: '還沒有模擬考紀錄。' })),
        h('h2', { class: 'notion-h2', text: '主題' }),
        h('div', { class: 'notion-subpages' }, QG.TAGS.filter(([x]) => x !== '其他').map(([x, n]) =>
          h('button', { type: 'button', class: 'notion-subpage', onclick: () => { db.tag = x; db.limit = 50; saveDb(); SK.go('browse'); } },
            pageIcon('nt-page'), h('span', { class: 'notion-link-text', text: x }), h('span', { class: 'notion-muted', text: `${n} 題` }))))));
  }

  /* ---------------------------------------------------------------- 題庫資料庫 */
  function rows() {
    const kw = db.kw.trim().toLowerCase();
    let list = QG.QS.filter((q) => (db.subj === 'all' || q.s === db.subj) && (!db.tag || q.t.includes(db.tag)) && (!kw || q.text.includes(kw)));
    const accKey = (q) => { const a = accOf(q.id); return a === null ? null : a; };
    if (db.sort === 'year-desc') list = list.slice().sort((a, b) => b.year - a.year);
    else if (db.sort === 'year-asc') list = list.slice().sort((a, b) => (a.year || 9999) - (b.year || 9999));
    else if (db.sort === 'acc-asc' || db.sort === 'acc-desc') {
      const dir = db.sort === 'acc-asc' ? 1 : -1;
      list = list.slice().sort((a, b) => {
        const x = accKey(a), y = accKey(b);
        if (x === null && y === null) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        return (x - y) * dir;
      });
    }
    return list;
  }

  const accText = (id) => { const r = S().q[id]; return r && (r.c + r.w) ? `${QG.pct(r.c, r.c + r.w)}（${r.c}/${r.c + r.w}）` : '—'; };
  const yearText = (q) => (q.year ? `${q.year} 年` : '—');
  const subjTag = (q) => tagEl(`${QG.SUBJ_CODE[q.s]} ${QG.SUBJ_SHORT[q.s]}`, colorOf(q.s));

  function selectPill(label, ico, value, options, onChange) {
    const sel = h('select', { 'aria-label': label, onchange: (e) => onChange(e.target.value) },
      options.map(([v, l]) => h('option', { value: v, text: l, selected: v === value })));
    const active = value && value !== 'all' && value !== 'none';
    return h('label', { class: 'notion-pill' + (active ? ' active' : '') }, icon(ico), h('span', { class: 'notion-pill-label', text: label }), sel);
  }

  function tableView(list) {
    const shown = list.slice(0, db.limit);
    const head = (ico, text, cls) => h('th', { class: cls || null }, h('span', { class: 'notion-th' }, icon(ico), h('span', { text })));
    return h('div', { class: 'notion-tablewrap' },
      h('table', { class: 'notion-table' },
        h('thead', null, h('tr', null, head('nt-text', '題目', 'title'), head('nt-select', '科目'), head('nt-multi', '主題'), head('nt-link', '出處'), head('nt-num', '年份'), head('nt-num', '你的正確率'))),
        h('tbody', null, shown.map((q) => h('tr', { tabindex: '0', onclick: () => peek(q.id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); peek(q.id); } } },
          h('td', { class: 'title' }, h('span', { class: 'notion-cell-title' }, pageIcon(q.fig ? 'nt-gallery' : 'nt-page'), h('span', { class: 'notion-ellip', text: q.q }),
            h('span', { class: 'notion-open', 'aria-hidden': 'true' }, icon('nt-side'), '開啟'))),
          h('td', null, subjTag(q)),
          h('td', null, h('span', { class: 'notion-tags' }, topics(q).map((t) => tagEl(t, colorOf(t))))),
          h('td', { class: 'mutedcell', text: q.src.map(QG.srcLabel).join('、') }),
          h('td', { class: 'num', text: q.year ? String(q.year) : '' }),
          h('td', { class: 'num', text: accText(q.id) }))))),
      moreRow(list.length));
  }
  function moreRow(total) {
    return total > db.limit
      ? h('button', { type: 'button', class: 'notion-more', onclick: () => { db.limit += 50; drawDb(); } }, `載入更多（還有 ${total - db.limit} 筆）`)
      : h('div', { class: 'notion-count', text: `計數 ${total}` });
  }

  function boardView(list) {
    const groups = db.group === 'subject'
      ? [['industry', 'L11 產業概論', (q) => q.s === 'industry'], ['process', 'L12 製造概論', (q) => q.s === 'process']]
      : QG.TAGS.map(([t]) => [t, t, (q) => q.t.includes(t)]);
    return h('div', { class: 'notion-board' }, groups.map(([k, label, fn]) => {
      const items = list.filter(fn);
      if (!items.length && db.group !== 'subject') return null;
      return h('section', { class: 'notion-col', 'aria-label': `${label}，${items.length} 筆` },
        h('header', { class: 'notion-col-head' }, tagEl(label, colorOf(k)), h('span', { class: 'notion-muted', text: String(items.length) })),
        items.slice(0, 25).map((q) => h('button', { type: 'button', class: 'notion-bcard', onclick: () => peek(q.id) },
          h('span', { class: 'notion-bcard-title', text: q.q }),
          h('span', { class: 'notion-tags' }, db.group === 'subject' ? topics(q).slice(0, 2).map((t) => tagEl(t, colorOf(t))) : subjTag(q)),
          h('span', { class: 'notion-bcard-meta', text: `${yearText(q)}・正確率 ${accText(q.id)}` }))),
        items.length > 25 ? h('p', { class: 'notion-muted notion-col-more', text: `還有 ${items.length - 25} 筆，切到表格檢視看全部` }) : null);
    }));
  }

  function galleryView(list) {
    const figs = list.filter((q) => q.fig);
    if (!figs.length) return h('p', { class: 'notion-empty', text: '這個篩選條件沒有附圖的題目。圖庫檢視只列出有附圖的題目。' });
    return h('div', { class: 'notion-gallery' }, figs.map((q) => h('button', { type: 'button', class: 'notion-gcard', onclick: () => peek(q.id) },
      h('span', { class: 'notion-gcover' }, h('img', { src: q.fig, alt: '', loading: 'lazy' })),
      h('span', { class: 'notion-gbody' },
        h('span', { class: 'notion-gtitle', text: q.q }),
        h('span', { class: 'notion-tags' }, subjTag(q), topics(q).slice(0, 1).map((t) => tagEl(t, colorOf(t))))))));
  }

  function listView(list) {
    return h('div', { class: 'notion-listv' }, list.slice(0, db.limit).map((q) => h('button', { type: 'button', class: 'notion-lrow', onclick: () => peek(q.id) },
      pageIcon('nt-page'), h('span', { class: 'notion-ellip notion-lrow-title', text: q.q }),
      h('span', { class: 'notion-lrow-props' }, subjTag(q), h('span', { class: 'notion-muted', text: accText(q.id) })))), moreRow(list.length));
  }

  let dbEl = null;
  function drawDb(initial) {
    if (!dbEl || (initial !== true && !dbEl.isConnected)) return;
    const list = rows();
    const VIEWS = [['table', '表格', 'nt-db'], ['board', '看板', 'nt-board'], ['gallery', '圖庫', 'nt-gallery'], ['list', '清單', 'nt-list']];
    const search = h('input', { type: 'search', class: 'notion-search', placeholder: '搜尋…', value: db.kw, 'aria-label': '搜尋題目' });
    let tmr;
    search.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => { db.kw = search.value; db.limit = 50; drawDb(); const s = dbEl.querySelector('.notion-search'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 200); });
    const body = db.view === 'board' ? boardView(list) : db.view === 'gallery' ? galleryView(list) : db.view === 'list' ? listView(list) : tableView(list);
    fill(dbEl,
      h('div', { class: 'notion-dbbar' },
        h('div', { class: 'notion-views', role: 'tablist', 'aria-label': '檢視' }, VIEWS.map(([k, l, ic]) => h('button', { type: 'button', role: 'tab', class: 'notion-viewtab',
          'aria-selected': db.view === k ? 'true' : 'false', onclick: () => { db.view = k; db.limit = 50; saveDb(); drawDb(); } }, icon(ic), h('span', { text: l })))),
        h('div', { class: 'notion-tools' },
          selectPill('科目', 'nt-filter', db.subj, [['all', '全部'], ['industry', 'L11 產業概論'], ['process', 'L12 製造概論']], (v) => { db.subj = v; db.limit = 50; saveDb(); drawDb(); }),
          selectPill('主題', 'nt-filter', db.tag, [['', '全部']].concat(QG.TAGS.map(([t, n]) => [t, `${t}（${n}）`])), (v) => { db.tag = v; db.limit = 50; saveDb(); QG.render(); }),
          selectPill('排序', 'nt-sort', db.sort, [['none', '預設'], ['year-desc', '年份：新→舊'], ['year-asc', '年份：舊→新'], ['acc-asc', '你的正確率：低→高'], ['acc-desc', '你的正確率：高→低']], (v) => { db.sort = v; saveDb(); drawDb(); }),
          db.view === 'board' ? selectPill('分組', 'nt-board', db.group, [['subject', '依科目'], ['tag', '依主題']], (v) => { db.group = v; saveDb(); drawDb(); }) : null,
          search,
          h('button', { type: 'button', class: 'notion-new', disabled: list.length ? null : true, onclick: () => QG.startCustomPractice(list.map((q) => q.id), `資料庫：${db.tag || (db.subj === 'all' ? '全部' : QG.SUBJ_SHORT[db.subj])}`) }, `練習 ${QG.fmtNum(list.length)} 題`))),
      body);
  }

  function browsePage() {
    dbEl = h('div', { class: 'notion-db' });
    const el = h('article', { class: 'notion-page wide' },
      h('div', { class: 'notion-page-inner' },
        pageIcon(db.tag ? 'nt-page' : 'nt-db', true),
        h('h1', { class: 'notion-title', text: db.tag || '題庫資料庫' }),
        h('p', { class: 'notion-desc', text: db.tag ? `「${db.tag}」主題的所有題目。點任一列在右側預覽、直接作答。` : `IPAS 初級電路板製程工程師歷屆試題 ${QG.fmtNum(QG.QS.length)} 題。點任一列在右側預覽、直接作答。` }),
        dbEl));
    drawDb(true);
    return el;
  }

  /* ---------------------------------------------------------------- 側邊預覽 */
  function peek(id) {
    const q = QG.QMAP.get(id);
    const props = h('div', { class: 'notion-props' });
    const drawProps = () => {
      const r = S().q[id];
      const prop = (ico, name, val) => h('div', { class: 'notion-prop' }, h('span', { class: 'notion-prop-name' }, icon(ico), h('span', { text: name })), h('div', { class: 'notion-prop-val' }, val));
      fill(props,
        prop('nt-select', '科目', subjTag(q)),
        prop('nt-multi', '主題', topics(q).length ? h('span', { class: 'notion-tags' }, topics(q).map((t) => tagEl(t, colorOf(t)))) : h('span', { class: 'notion-muted', text: '空白' })),
        prop('nt-link', '出處', h('span', { text: q.src.map(QG.srcLabel).join('、') + (q.src.length > 1 ? `（考過 ${q.src.length} 次）` : '') })),
        prop('nt-clock', '你的紀錄', r && (r.c + r.w)
          ? h('span', { text: `答對 ${r.c}・答錯 ${r.w}・正確率 ${QG.pct(r.c, r.c + r.w)}・最後作答 ${SK.relTime(r.t)}` + (r.b > 0 ? `・錯題第 ${r.b} 盒` : r.m ? '・已熟練' : '') })
          : h('span', { class: 'notion-muted', text: '尚未作答' })));
    };
    drawProps();
    const ansBody = h('div', { class: 'notion-toggle-body' },
      h('p', null, h('b', { text: '答案：' }), q.all ? '官方釋疑，所有選項均給分' : q.a.map((L) => `(${L}) ${q.o[L]}`).join('；')),
      q.x ? h('p', { class: 'notion-muted', text: q.x }) : null);
    const ansToggle = h('details', { class: 'notion-toggle' }, h('summary', null, h('span', { class: 'notion-tri', 'aria-hidden': 'true' }, icon('nt-caret')), h('span', { text: '答案' })), ansBody);
    const opts = SK.answerOptions(q, { cls: 'notion-opts', onDone: () => { ansToggle.open = true; drawProps(); } });
    const content = h('aside', { class: 'notion-peek', 'aria-label': '題目預覽' },
      h('div', { class: 'notion-peek-bar' },
        h('span', { class: 'notion-muted' }, pageIcon('nt-db'), ' 題庫資料庫'),
        h('span', { class: 'spacer' }),
        h('button', { type: 'button', class: 'notion-btn small', onclick: () => { m.close(); QG.startCustomPractice([id], '單題練習'); } }, '在練習中開啟')),
      h('div', { class: 'notion-peek-body' },
        pageIcon(q.fig ? 'nt-gallery' : 'nt-page', true),
        h('h2', { class: 'notion-peek-title', text: titleOf(q) }),
        props,
        h('hr', { class: 'notion-hr' }),
        h('p', { class: 'notion-qtext', text: q.q }),
        q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖' })) : null,
        opts,
        ansToggle));
    const m = SK.modal(content, 'notion-peekwrap', () => { SK.setOpenModal(null); drawDb(); });
    SK.setOpenModal(m);
  }

  document.addEventListener('pointerdown', (e) => {
    const root = document.documentElement;
    if (!root.classList.contains('notion-drawer')) return;
    const sideEl = document.getElementById('sidebar');
    if (sideEl && !sideEl.contains(e.target) && !e.target.closest('.notion-menu-btn')) root.classList.remove('notion-drawer');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.documentElement.classList.remove('notion-drawer'); });

  /* ---------------------------------------------------------------- 註冊 */
  const NAV = [
    { v: 'home', label: '概覽', icon: 'nt-page' },
    { v: 'browse', label: '資料庫', icon: 'nt-db' },
    { v: 'practice', label: '練習', icon: 'practice' },
    { v: 'review', label: '錯題本', icon: 'review', badge: true },
    { v: 'stats', label: '統計', icon: 'stats' },
  ];
  SK.register({
    id: 'notion', label: 'Notion 風', group: '生產力', top, side, nav: NAV,
    views: { home: homePage, browse: browsePage },
  });
})();
