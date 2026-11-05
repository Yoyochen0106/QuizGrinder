/* Anki 風：樸素桌面程式外觀。首頁＝牌組表（新／學習中／到期），點牌組進入學習畫面：
 * 題目＋選項 →「顯示答案」（空白鍵）→ 自評 重來／困難／良好／簡單（1–4），按鈕上顯示下次間隔。
 * 自評結果寫回學習紀錄（錯題盒 b 與下次複習時間 d）。只借用版面、互動與配色。 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon } = SK;
  const S = () => QG.S();

  const DAY = 864e5;
  const BOX_DAYS = [0, 0, 1, 3, 7, 14];
  const NEW_LIMIT = 20;
  const GRADES = [
    { k: 'again', label: '重來', key: '1' },
    { k: 'hard', label: '困難', key: '2' },
    { k: 'good', label: '良好', key: '3' },
    { k: 'easy', label: '簡單', key: '4' },
  ];

  /* ---------------------------------------------------------------- 牌組與計數 */
  function decks() {
    const official = QG.QS.filter((q) => q.official);
    const topics = QG.TAGS.filter(([t]) => t !== '其他').map(([t]) => ({ key: 'tag:' + t, name: t, ids: official.filter((q) => q.t.includes(t)).map((q) => q.id) }));
    const topicIds = official.filter((q) => q.t.some((t) => t !== '其他')).map((q) => q.id);
    return [
      { key: 'L11', name: 'L11 電路板產業概論', ids: official.filter((q) => q.s === 'industry').map((q) => q.id) },
      { key: 'L12', name: 'L12 電路板製造概論', ids: official.filter((q) => q.s === 'process').map((q) => q.id) },
      { key: 'topics', name: '主題', ids: topicIds, children: topics },
    ];
  }
  const findDeck = (key) => {
    for (const d of decks()) {
      if (d.key === key) return d;
      for (const c of d.children || []) if (c.key === key) return c;
    }
    return null;
  };

  function kind(id, now) {
    const r = S().q[id];
    if (!r || !(r.c + r.w)) return 'new';
    if (r.b > 0) return (r.d || 0) <= now ? 'due' : 'learn';
    return 'done';
  }
  function counts(ids) {
    const now = Date.now();
    let n = 0, l = 0, d = 0;
    for (const id of ids) {
      const k = kind(id, now);
      if (k === 'new') n++;
      else if (k === 'due') { l++; d++; } else if (k === 'learn') l++;
    }
    return { n, l, d };
  }

  /* ---------------------------------------------------------------- 排程 */
  const curBox = (id) => { const r = S().q[id]; return r && r.b > 0 ? r.b : 1; };
  function planFor(id, grade) {
    const b = curBox(id);
    if (grade === 'again') return { b: 1, days: 0, label: '<1 分' };
    if (grade === 'hard') return { b, days: 1, label: '1 天' };
    const nb = b + (grade === 'easy' ? 2 : 1);
    if (nb > 5) return { b: 0, m: 1, label: '熟練' };
    const days = BOX_DAYS[nb];
    return { b: nb, days, label: days ? `${days} 天` : '<10 分' };
  }
  function applyGrade(id, grade) {
    QG.record(id, grade !== 'again');
    const r = S().q[id];
    const p = planFor(id, grade);
    const now = Date.now();
    if (p.b === 0) { r.b = 0; r.m = 1; delete r.d; } else { r.b = p.b; r.d = now + p.days * DAY; delete r.m; }
    QG.Store.save();
    QG.updateBadges();
  }

  /* ---------------------------------------------------------------- 狀態 */
  const st = { deck: null, queue: [], i: 0, shown: false, studied: 0, collapsed: false, custom: false };

  function openDeck(key) {
    const d = findDeck(key);
    if (!d) return;
    const now = Date.now();
    const due = d.ids.filter((id) => kind(id, now) === 'due').sort((a, b) => curBox(a) - curBox(b));
    const fresh = QG.shuffle(d.ids.filter((id) => kind(id, now) === 'new')).slice(0, NEW_LIMIT);
    Object.assign(st, { deck: key, queue: due.concat(fresh), i: 0, shown: false, studied: 0, custom: false });
  }

  /* ---------------------------------------------------------------- 頂部工具列 */
  const NAV = [
    { v: 'home', label: '牌組', icon: 'stack' },
    { v: 'practice', label: '練習', icon: 'practice' },
    { v: 'review', label: '錯題', icon: 'review', badge: true },
    { v: 'browse', label: '瀏覽', icon: 'browse' },
    { v: 'stats', label: '統計', icon: 'stats' },
  ];
  function akTop(view) {
    return h('div', { class: 'sk-top anki-top' },
      h('a', { class: 'anki-logo', href: '#home', 'aria-label': 'QuizGrinder 首頁', onclick: () => { st.deck = null; } }, icon('pad')),
      h('nav', { class: 'anki-tools', 'aria-label': '主要功能' },
        [['home', '牌組'], ['practice', '練習'], ['review', '錯題'], ['exam', '模擬考'], ['browse', '瀏覽'], ['stats', '統計']].map(([v, l]) =>
          h('a', { href: '#' + v, 'aria-current': SK.isCurrent(view, v) ? 'page' : null, onclick: v === 'home' ? () => { st.deck = null; } : null }, l,
            v === 'review' ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null))),
      h('span', { class: 'anki-sync', title: '學習進度自動儲存' }, icon('review')));
  }

  /* ---------------------------------------------------------------- 牌組列表 */
  function num(v, cls) { return h('td', { class: 'num ' + cls + (v ? '' : ' zero'), text: String(v) }); }

  function deckList(wrap, redraw) {
    QG.setKeys(null);
    const day = S().days[QG.dayKey()] || { n: 0, c: 0 };
    const row = (d, depth, parent) => {
      const c = counts(d.ids);
      return h('tr', { class: 'anki-row' + (depth ? ' child' : '') },
        h('td', { class: 'anki-name' },
          h('span', { class: 'anki-indent', style: `width:${depth * 1.4}rem` }),
          parent ? h('button', { class: 'anki-exp', type: 'button', 'aria-expanded': st.collapsed ? 'false' : 'true', 'aria-label': st.collapsed ? '展開' : '收合',
            text: st.collapsed ? '+' : '−', onclick: () => { st.collapsed = !st.collapsed; redraw(); } }) : h('span', { class: 'anki-exp-sp' }),
          h('button', { class: 'anki-deck', type: 'button', text: d.name, onclick: () => { openDeck(d.key); redraw(); } })),
        num(c.n, 'new'), num(c.l, 'learn'), num(c.d, 'due'));
    };
    const rows = [];
    for (const d of decks()) {
      rows.push(row(d, 0, !!d.children));
      if (d.children && !st.collapsed) d.children.forEach((c) => rows.push(row(c, 1)));
    }
    fill(wrap,
      h('div', { class: 'anki-decks-wrap' },
        h('table', { class: 'anki-decks' },
          h('thead', null, h('tr', null, h('th', { text: '牌組' }), h('th', { class: 'num', text: '新' }), h('th', { class: 'num', text: '學習中' }), h('th', { class: 'num', text: '到期' }))),
          h('tbody', null, rows)),
        h('p', { class: 'anki-today', text: day.n ? `今天已學習 ${day.n} 張卡片，答對 ${day.c} 張（${QG.pct(day.c, day.n)}）。` : '今天還沒有學習任何卡片。' }),
        h('div', { class: 'anki-btnrow' },
          h('a', { class: 'anki-btn', href: '#browse', text: '瀏覽題庫' }),
          h('a', { class: 'anki-btn', href: '#review', text: '錯題本' }),
          h('a', { class: 'anki-btn', href: '#exam', text: '模擬考' })),
        h('p', { class: 'anki-note', text: `新卡片每次最多 ${NEW_LIMIT} 張。間隔依錯題盒：第 1–5 盒為當天、當天、1、3、7、14 天，超過第 5 盒即熟練。` })));
  }

  /* ---------------------------------------------------------------- 學習畫面 */
  function study(wrap, redraw) {
    const d = findDeck(st.deck);
    if (!d) { st.deck = null; deckList(wrap, redraw); return; }
    const now = Date.now();
    const q = st.i < st.queue.length ? QG.QMAP.get(st.queue[st.i]) : null;
    const back = () => { st.deck = null; redraw(); };
    const bottomLeft = h('button', { class: 'anki-btn anki-back', type: 'button', text: '牌組列表', onclick: back });
    if (!q) {
      QG.setKeys(null);
      const weak = () => {
        Object.assign(st, { queue: QG.buildQueue(d.ids, 'weak').slice(0, 20), i: 0, shown: false, custom: true });
        redraw();
      };
      fill(wrap, h('div', { class: 'anki-study anki-congrats' },
        h('div', { class: 'anki-card' },
          h('h2', { text: '恭喜！你已經完成這個牌組目前的進度。' }),
          h('p', { text: st.studied ? `這次學習了 ${st.studied} 張卡片。` : '這個牌組現在沒有新卡片或到期的卡片。' }),
          h('p', { class: 'muted', text: '到期的卡片會依間隔在之後回來。也可以用自訂學習，先練這個牌組中最弱的題目。' }),
          h('div', { class: 'anki-btnrow' }, h('button', { class: 'anki-btn', type: 'button', text: '自訂學習：最弱的 20 張', onclick: weak }))),
        h('div', { class: 'anki-bar' }, bottomLeft, h('span'), h('span'))));
      bottomLeft.focus({ preventScroll: true });
      return;
    }
    const rest = st.queue.slice(st.i);
    const type = (id) => kind(id, now);
    const nN = rest.filter((id) => type(id) === 'new').length;
    const nL = rest.filter((id) => type(id) === 'learn' || (st.custom && type(id) === 'done')).length;
    const nD = rest.filter((id) => type(id) === 'due').length;
    const curType = type(q.id);
    const correct = new Set(q.all ? QG.LETTERS : q.a);
    const showAnswer = () => { if (!st.shown) { st.shown = true; redraw(); } };
    const grade = (g) => {
      if (!st.shown) return;
      applyGrade(q.id, g);
      st.studied++;
      if (g === 'again') st.queue.splice(Math.min(st.i + 4, st.queue.length), 0, q.id);
      st.i++;
      st.shown = false;
      redraw();
    };
    QG.setKeys((e) => {
      if (!st.shown && (e.key === ' ' || e.key === 'Enter')) { showAnswer(); return true; }
      const g = GRADES.find((x) => x.key === e.key);
      if (st.shown && g) { grade(g.k); return true; }
      if (e.key === 'Escape') { back(); return true; }
      return false;
    });
    const card = h('div', { class: 'anki-card' },
      h('div', { class: 'anki-q', text: q.q }),
      q.fig ? h('img', { class: 'anki-fig', src: q.fig, alt: '題目附圖' }) : null,
      h('ol', { class: 'anki-opts' }, QG.LETTERS.map((L) => h('li', { class: st.shown && correct.has(L) ? 'anki-ans' : '' }, h('b', { text: L + '.' }), h('span', { text: q.o[L] })))),
      st.shown ? h('hr', { class: 'anki-hr', id: 'answer' }) : null,
      st.shown ? h('div', { class: 'anki-a' },
        h('p', { class: 'anki-a-main', text: q.all ? '官方釋疑：所有選項均給分' : q.a.map((L) => `${L}. ${q.o[L]}`).join('；') }),
        q.x ? h('p', { class: 'anki-a-x', text: q.x }) : null,
        h('p', { class: 'anki-a-src', text: `${QG.SUBJ_CODE[q.s]}・${q.src.map(QG.srcLabel).join('、')}` })) : null);
    const countLine = h('div', { class: 'anki-counts' },
      h('span', { class: 'new' + (curType === 'new' ? ' cur' : ''), text: String(nN) }), ' + ',
      h('span', { class: 'learn' + (curType === 'learn' || curType === 'done' ? ' cur' : ''), text: String(nL) }), ' + ',
      h('span', { class: 'due' + (curType === 'due' ? ' cur' : ''), text: String(nD) }));
    const mid = st.shown
      ? h('div', { class: 'anki-ease', role: 'group', 'aria-label': '自評' }, GRADES.map((g) => {
        const p = planFor(q.id, g.k);
        return h('div', { class: 'anki-ease-cell' }, h('span', { class: 'anki-ivl', text: p.label }),
          h('button', { class: 'anki-btn ' + g.k, type: 'button', dataset: { g: g.k }, 'aria-label': `${g.label}（${g.key}），下次 ${p.label}`, onclick: () => grade(g.k) }, g.label));
      }))
      : h('div', { class: 'anki-show' }, countLine, h('button', { class: 'anki-btn anki-showbtn', type: 'button', onclick: showAnswer }, '顯示答案'));
    const star = h('button', { class: 'anki-btn', type: 'button', text: S().q[q.id] && S().q[q.id].s ? '★ 已收藏' : '☆ 收藏', onclick: () => { QG.toggleStar(q.id); redraw(); } });
    fill(wrap, h('div', { class: 'anki-study' },
      h('div', { class: 'anki-studyhead' }, h('span', { class: 'anki-deckname', text: d.name }), h('span', { class: 'muted', text: st.custom ? '自訂學習' : `本次已學 ${st.studied} 張` })),
      card,
      h('div', { class: 'anki-bar' }, bottomLeft, mid, star),
      h('p', { class: 'anki-keys' }, st.shown
        ? [h('kbd', { text: '1' }), ' 重來 ', h('kbd', { text: '2' }), ' 困難 ', h('kbd', { text: '3' }), ' 良好 ', h('kbd', { text: '4' }), ' 簡單']
        : [h('kbd', { text: '空白' }), ' 顯示答案・', h('kbd', { text: 'Esc' }), ' 回牌組列表'])));
    const focusEl = st.shown ? wrap.querySelector('.anki-btn.good') : wrap.querySelector('.anki-showbtn');
    if (focusEl) focusEl.focus({ preventScroll: true });
  }

  function akHome() {
    const wrap = h('div', { class: 'anki-page' });
    const redraw = () => { if (st.deck) study(wrap, redraw); else deckList(wrap, redraw); window.scrollTo(0, 0); };
    if (st.deck) study(wrap, redraw); else deckList(wrap, redraw);
    return wrap;
  }

  SK.register({
    id: 'anki', label: 'Anki 風', group: '學習測驗',
    top: akTop, nav: NAV,
    views: { home: akHome },
  });
})();
