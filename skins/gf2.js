/* 少女前線2風：粗獷戰術軍事 UI——深橄欖／炭灰、琥珀橘重點、模版噴字感標題、六角格戰術地圖。
 *   首頁＝戰術地圖：選一份考卷，每個六角格是一題；未作答＝迷霧、答對＝已佔領、答錯（仍在錯題本）＝交戰中
 *   「規劃路線」模式點相鄰六角格排出作答順序；選取六角格開啟情報面板（主題、出處）與作答面板
 *   「結束任務」顯示任務簡報：本次正確率與地圖佔領率；小隊面板＝你的兩科真實數據
 * 只借用版面、互動與配色；不使用任何角色、標誌或遊戲專有名詞。 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon } = SK;
  const S = () => QG.S();
  const ID = 'gf2';
  const COLS = 8;

  SK.ICONS.gfHex = SK.ICONS.gfHex || '<path d="M12 2l8.7 5v10L12 22l-8.7-5V7z"/>';
  SK.ICONS.gfRoute = SK.ICONS.gfRoute || '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6"/>';
  SK.ICONS.gfIntel = SK.ICONS.gfIntel || '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 8h8M8 12h8M8 16h5"/>';
  SK.ICONS.gfFlag = SK.ICONS.gfFlag || '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>';

  /* ---------------------------------------------------------------- 資料 */
  function data() {
    const st = S().settings;
    if (!st.skinData) st.skinData = {};
    return st.skinData[ID] || (st.skinData[ID] = {});
  }
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function exams() {
    return [...QG.EXAM_MAP.values()].sort((a, b) => (b.official - a.official) || (b.year || 0) - (a.year || 0) || String(b.session).localeCompare(String(a.session)) || a.id.localeCompare(b.id));
  }
  function examQs(examId) {
    const n = (q) => (q.src.find((s) => s.exam === examId) || {}).n || 0;
    return QG.QS.filter((q) => q.src.some((s) => s.exam === examId)).sort((a, b) => n(a) - n(b));
  }
  function status(id) {
    const r = S().q[id];
    if (!r || !(r.c + r.w)) return 'fog';
    if (r.b || !r.c) return 'hot';
    return 'own';
  }
  const STATUS_LABEL = { fog: '未偵察', own: '已佔領', hot: '交戰中' };
  const rc = (i) => [Math.floor(i / COLS), i % COLS];
  function adjacent(a, b) {
    const [r1, c1] = rc(a), [r2, c2] = rc(b);
    if (r1 === r2) return Math.abs(c1 - c2) === 1;
    if (Math.abs(r1 - r2) !== 1) return false;
    const off = r1 % 2 ? [0, 1] : [-1, 0]; // odd-r 位移座標
    return c2 - c1 === off[0] || c2 - c1 === off[1];
  }
  const coord = (i) => { const [r, c] = rc(i); return `${String.fromCharCode(65 + r)}-${String(c + 1).padStart(2, '0')}`; };

  /* ---------------------------------------------------------------- 頂部列 */
  const NAV = [
    { v: 'home', label: '作戰', icon: 'gfHex' },
    { v: 'practice', label: '訓練', icon: 'practice' },
    { v: 'review', label: '修復', icon: 'review', badge: true },
    { v: 'exam', label: '演習', icon: 'exam' },
    { v: 'browse', label: '情報庫', icon: 'browse' },
    { v: 'stats', label: '戰報', icon: 'stats' },
  ];
  function gfTop(view) {
    const t = QG.totals();
    const d = new Date();
    return h('div', { class: 'sk-top gf-top' },
      SK.brand('QuizGrinder'),
      h('span', { class: 'gf-mono gf-clock', text: `OPS//${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}` }),
      h('nav', { class: 'gf-nav', 'aria-label': '主要功能' }, NAV.map((n) => h('a', { href: '#' + n.v, 'aria-current': SK.isCurrent(view, n.v) ? 'page' : null },
        h('span', { text: n.label }), n.badge ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null))),
      h('span', { class: 'gf-hudchips' },
        h('span', { class: 'gf-hc' }, h('small', { text: 'HIT' }), h('b', { text: QG.pct(t.c, t.n) })),
        h('span', { class: 'gf-hc' }, h('small', { text: 'STREAK' }), h('b', { text: String(QG.streak()) }))));
  }
  function refreshTop() {
    const top = document.getElementById('topbar');
    if (top && SK.skin() === ID) fill(top, gfTop(QG.currentView));
    QG.updateBadges();
  }

  /* ---------------------------------------------------------------- 任務狀態 */
  const ops = { exam: null, pos: null, route: [], sel: null, plan: false, log: {}, order: [], debrief: false };
  function resetOps(examId) {
    Object.assign(ops, { exam: examId, pos: null, route: [], sel: null, plan: false, log: {}, order: [], debrief: false });
  }
  let els = {};
  let qs = [];

  function mapEl() {
    const rows = Math.ceil(qs.length / COLS);
    const span = 0.75 * (rows - 1) + 1;
    const pos = (i) => {
      const [r, c] = rc(i);
      return { x: ((c + (r % 2 ? 0.5 : 0)) / (COLS + 0.5)) * 100, y: ((r * 0.75) / span) * 100, w: 100 / (COLS + 0.5), hh: 100 / span };
    };
    const chain = (ops.pos != null ? [ops.pos] : []).concat(ops.route);
    const svg = document.createElement('span');
    svg.className = 'gf-path';
    svg.setAttribute('aria-hidden', 'true');
    if (chain.length > 1) {
      const pts = chain.map((i) => { const p = pos(i); return `${(p.x + p.w / 2).toFixed(2)},${(p.y + p.hh / 2).toFixed(2)}`; });
      svg.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${pts.join(' ')}"/></svg>`;
    }
    const grid = h('div', { class: 'gf-grid' + (ops.plan ? ' plan' : ''), style: `aspect-ratio:${(COLS + 0.5).toFixed(2)} / ${(1.1547 * span).toFixed(3)}`, role: 'grid', 'aria-label': '戰術地圖：每個六角格是一題' },
      qs.map((q, i) => {
        const p = pos(i);
        const st = status(q.id);
        const ri = ops.route.indexOf(i);
        const n = (q.src.find((s) => s.exam === ops.exam) || {}).n || i + 1;
        return h('button', {
          type: 'button', class: `gf-hex ${st}` + (ops.sel === i ? ' sel' : '') + (ri >= 0 ? ' route' : '') + (ops.pos === i ? ' here' : '') + (ops.log[q.id] ? ' done' : ''),
          style: `left:${p.x.toFixed(3)}%;top:${p.y.toFixed(3)}%;width:${p.w.toFixed(3)}%;height:${p.hh.toFixed(3)}%`,
          'aria-label': `${coord(i)} 第 ${n} 題，${STATUS_LABEL[st]}${ri >= 0 ? `，路線第 ${ri + 1} 步` : ''}`,
          'aria-pressed': ops.sel === i ? 'true' : 'false',
          onclick: () => clickHex(i),
        }, h('span', { class: 'gf-hex-n', text: String(n) }),
        ri >= 0 ? h('span', { class: 'gf-hex-r', text: String(ri + 1) }) : null,
        ops.pos === i ? h('span', { class: 'gf-unit', 'aria-hidden': 'true' }) : null);
      }), svg);
    return grid;
  }

  function clickHex(i) {
    if (ops.debrief) ops.debrief = false;
    if (ops.plan) {
      const anchor = ops.route.length ? ops.route[ops.route.length - 1] : ops.pos;
      if (ops.route.length && i === ops.route[ops.route.length - 1]) ops.route.pop();
      else if (ops.route.includes(i) || i === ops.pos) QG.toast('這一格已在路線上');
      else if (anchor == null || adjacent(anchor, i)) ops.route.push(i);
      else { QG.toast('路線只能連接相鄰的六角格'); return; }
      redraw();
      return;
    }
    ops.sel = i;
    redraw();
    if (matchMedia('(max-width: 960px)').matches && els.intel) els.intel.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
  }

  function answered(q, ok) {
    ops.log[q.id] = ok ? 'ok' : 'ng';
    ops.order.push(q.id);
    if (ops.route[0] === ops.sel) ops.route.shift();
    ops.pos = ops.sel;
    refreshTop();
    redraw(true);
  }

  /* ---------------------------------------------------------------- 面板 */
  function intelPanel() {
    if (ops.debrief) return debrief();
    if (ops.sel == null) {
      return h('section', { class: 'gf-panel gf-intel gf-idle' },
        panelHead('INTEL', '情報'),
        h('p', { class: 'gf-dim', text: '選取地圖上的六角格以查看該題的主題、出處並作答。' }),
        h('p', { class: 'gf-dim', text: '或切到「規劃路線」：從任一格開始，依序點相鄰的六角格排出作答順序，再按「執行路線」。' }),
        qs.some((q) => status(q.id) !== 'own') ? h('button', { type: 'button', class: 'gf-btn amber', onclick: () => { ops.sel = qs.findIndex((q) => status(q.id) === 'fog') >= 0 ? qs.findIndex((q) => status(q.id) === 'fog') : qs.findIndex((q) => status(q.id) === 'hot'); redraw(); } }, icon('gfHex'), '部署至第一個未佔領格') : null);
    }
    const q = qs[ops.sel];
    const st = status(q.id);
    const r = S().q[q.id];
    const src = q.src.find((s) => s.exam === ops.exam) || q.src[0];
    const done = ops.log[q.id];
    const fb = h('div', { class: 'gf-fb', role: 'status' });
    const opts = done ? null : SK.answerOptions(q, { cls: 'gf-ans', onDone: (ok) => answered(q, ok) });
    if (opts) QG.setKeys((e) => { const k = '1234'.indexOf(e.key); if (k >= 0 && opts.isConnected) { opts.pick(k); return true; } return false; });
    else QG.setKeys(null);
    const nextHex = ops.route[0];
    return h('section', { class: 'gf-panel gf-intel' },
      panelHead('INTEL', `情報・${coord(ops.sel)}`),
      h('dl', { class: 'gf-dl' },
        h('dt', { text: '題號' }), h('dd', { text: `第 ${src.n} 題・${QG.SUBJ_CODE[q.s]} ${QG.SUBJ_SHORT[q.s]}` }),
        h('dt', { text: '主題' }), h('dd', { text: q.t.join('、') }),
        h('dt', { text: '出處' }), h('dd', { text: q.src.map(QG.srcLabel).join('・') }),
        h('dt', { text: '狀態' }), h('dd', null, h('span', { class: 'gf-st ' + st, text: STATUS_LABEL[st] }), r && (r.c + r.w) ? h('span', { class: 'gf-dim', text: `　答對 ${r.c}・答錯 ${r.w}` }) : null)),
      q.prev && QG.QMAP.get(q.prev) ? h('details', { class: 'gf-prev' }, h('summary', { text: '承上題：展開上一題' }), h('p', { text: QG.QMAP.get(q.prev).q })) : null,
      h('p', { class: 'gf-q', text: q.q }),
      q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖', loading: 'lazy' })) : null,
      done ? h('div', { class: 'gf-fb show' },
        h('b', { class: done === 'ok' ? 'ok' : 'ng', text: done === 'ok' ? '目標已佔領' : `交戰中・正解 ${q.all ? '全部給分' : q.a.join('、')}` }),
        h('ol', { class: 'gf-recap' }, QG.LETTERS.map((L) => h('li', { class: q.all || q.a.includes(L) ? 'ans' : '' }, h('b', { text: L }), h('span', { text: q.o[L] })))),
        q.x ? h('p', { class: 'gf-x', text: q.x }) : null) : opts,
      fb,
      done && nextHex != null ? h('button', { type: 'button', class: 'gf-btn amber', onclick: () => { ops.sel = nextHex; redraw(); } }, icon('arrow'), `前進至 ${coord(nextHex)}`) : null);
  }
  function panelHead(code, title) {
    return h('header', { class: 'gf-ph' }, h('span', { class: 'gf-stencil', 'aria-hidden': 'true', text: code }), h('h2', { class: 'gf-title', text: title }));
  }

  function mapStats() {
    const counts = { fog: 0, own: 0, hot: 0 };
    qs.forEach((q) => counts[status(q.id)]++);
    return counts;
  }
  function debrief() {
    const ids = ops.order;
    const c = ids.filter((id) => ops.log[id] === 'ok').length;
    const m = mapStats();
    const sec = Math.round((m.own / qs.length) * 100);
    return h('section', { class: 'gf-panel gf-intel gf-debrief' },
      panelHead('DEBRIEF', '任務簡報'),
      h('p', { class: 'gf-dim', text: QG.EXAM_MAP.get(ops.exam).title || ops.exam }),
      h('div', { class: 'gf-bigstats' },
        h('div', null, h('small', { class: 'gf-mono', text: 'ACCURACY' }), h('b', { text: ids.length ? Math.round((c / ids.length) * 100) + '%' : '—' }), h('span', { text: `本次 ${c} / ${ids.length} 題` })),
        h('div', null, h('small', { class: 'gf-mono', text: 'SECURED' }), h('b', { text: sec + '%' }), h('span', { text: `地圖 ${m.own} / ${qs.length} 格` }))),
      h('div', { class: 'gf-legendbar' },
        h('i', { class: 'own', style: `flex:${m.own}` }), h('i', { class: 'hot', style: `flex:${m.hot}` }), h('i', { class: 'fog', style: `flex:${m.fog}` })),
      h('p', { class: 'gf-dim', text: `已佔領 ${m.own}・交戰中 ${m.hot}・迷霧 ${m.fog}` }),
      h('div', { class: 'gf-btns' },
        h('button', { type: 'button', class: 'gf-btn amber', onclick: () => { ops.debrief = false; redraw(); } }, '繼續作戰'),
        h('button', { type: 'button', class: 'gf-btn', onclick: () => { resetOps(ops.exam); redraw(); } }, '新任務'),
        m.hot ? h('button', { type: 'button', class: 'gf-btn', onclick: () => QG.startReview(qs.filter((q) => status(q.id) === 'hot').map((q) => q.id)) }, `修復交戰格（${m.hot}）`) : null));
  }
  function endMission() {
    const d = data();
    const m = mapStats();
    if (ops.order.length) {
      d.ops = (d.ops || 0) + 1;
      d.last = { exam: ops.exam, n: ops.order.length, c: ops.order.filter((id) => ops.log[id] === 'ok').length, secured: Math.round((m.own / qs.length) * 100), ts: Date.now() };
      QG.Store.save();
    }
    ops.debrief = true;
    ops.plan = false;
    redraw();
  }

  function squadPanel() {
    const units = ['industry', 'process'].map((s) => {
      const ids = QG.QS.filter((q) => q.s === s).map((q) => q.id);
      const p = SK.progressOf(ids);
      const hot = ids.filter((id) => { const r = S().q[id]; return r && r.b; }).length;
      return { s, ids, p, hot };
    });
    const best = S().exams.reduce((a, e) => Math.max(a, e.score), 0);
    const d = data();
    const bar = (label, v, text) => h('div', { class: 'gf-stat' }, h('span', { class: 'gf-mono', text: label }), h('span', { class: 'gf-sbar' }, h('i', { style: `width:${Math.min(100, v)}%` })), h('b', { text }));
    return h('section', { class: 'gf-panel gf-squad' },
      panelHead('SQUAD', '小隊狀態'),
      units.map((u) => h('div', { class: 'gf-unitcard' },
        h('div', { class: 'gf-unit-h' }, h('span', { class: 'gf-tag', text: QG.SUBJ_CODE[u.s] }), h('b', { text: QG.SUBJ_SHORT[u.s] })),
        bar('HIT', u.p.n ? (u.p.c / u.p.n) * 100 : 0, u.p.n ? QG.pct(u.p.c, u.p.n) : '—'),
        bar('COVER', (u.p.seen / u.ids.length) * 100, `${u.p.seen}/${u.ids.length}`),
        h('p', { class: 'gf-dim', text: u.hot ? `待修復 ${u.hot} 題` : '無待修復' }))),
      h('dl', { class: 'gf-dl small' },
        h('dt', { text: '連續作戰' }), h('dd', { text: `${QG.streak()} 天` }),
        h('dt', { text: '演習最佳' }), h('dd', { text: S().exams.length ? `${best} 分` : '尚未演習' }),
        h('dt', { text: '完成任務' }), h('dd', { text: `${d.ops || 0} 次` }),
        d.last ? h('dt', { text: '上次任務' }) : null, d.last ? h('dd', { text: `${d.last.c}/${d.last.n}・佔領 ${d.last.secured}%` }) : null));
  }

  function controls() {
    const m = mapStats();
    const sel = h('select', { class: 'gf-select', 'aria-label': '選擇作戰區域（考卷）', onchange: (e) => { data().exam = e.target.value; QG.Store.save(); resetOps(e.target.value); qs = examQs(ops.exam); redraw(); } },
      exams().map((e) => h('option', { value: e.id, text: e.title || e.id, selected: e.id === ops.exam })));
    return h('div', { class: 'gf-controls' },
      h('div', { class: 'gf-ctl-row' },
        h('label', { class: 'gf-field' }, h('span', { class: 'gf-mono', text: 'AREA' }), sel),
        h('div', { class: 'gf-seg', role: 'group', 'aria-label': '模式' },
          h('button', { type: 'button', 'aria-pressed': ops.plan ? 'false' : 'true', onclick: () => { ops.plan = false; redraw(); } }, icon('gfIntel'), '偵察'),
          h('button', { type: 'button', 'aria-pressed': ops.plan ? 'true' : 'false', onclick: () => { ops.plan = true; ops.debrief = false; redraw(); } }, icon('gfRoute'), '規劃路線'))),
      h('div', { class: 'gf-ctl-row' },
        h('span', { class: 'gf-route', 'aria-live': 'polite' }, h('span', { class: 'gf-mono', text: 'ROUTE' }),
          ops.route.length ? ops.route.map((i) => coord(i)).join(' → ') : ops.plan ? (ops.pos == null ? '點任一格作為起點' : `從 ${coord(ops.pos)} 出發，點相鄰的格子`) : '尚未規劃'),
        h('span', { class: 'spacer' }),
        ops.route.length ? h('button', { type: 'button', class: 'gf-btn small', onclick: () => { ops.route = []; redraw(); } }, '清除') : null,
        ops.route.length ? h('button', { type: 'button', class: 'gf-btn amber small', onclick: () => { ops.plan = false; ops.sel = ops.route[0]; redraw(); } }, icon('arrow'), '執行路線') : null,
        h('button', { type: 'button', class: 'gf-btn small', onclick: endMission }, icon('gfFlag'), '結束任務')),
      h('div', { class: 'gf-legend' },
        h('span', { class: 'gf-lg own' }, `已佔領 ${m.own}`), h('span', { class: 'gf-lg hot' }, `交戰中 ${m.hot}`), h('span', { class: 'gf-lg fog' }, `迷霧 ${m.fog}`),
        h('span', { class: 'gf-dim' }, `佔領率 ${Math.round((m.own / qs.length) * 100)}%`)));
  }

  function redraw(keepIntelFocus) {
    if (!els.root || !els.root.isConnected) return;
    fill(els.ctl, controls());
    fill(els.map, mapEl());
    fill(els.intel, intelPanel());
    fill(els.squad, squadPanel());
    if (keepIntelFocus) { const b = els.intel.querySelector('.gf-btn.amber'); if (b) b.focus({ preventScroll: true }); }
  }

  function gfHome() {
    const d = data();
    const list = exams();
    const examId = d.exam && QG.EXAM_MAP.has(d.exam) ? d.exam : list[0].id;
    if (ops.exam !== examId) resetOps(examId);
    qs = examQs(examId);
    els = {
      ctl: h('div', { class: 'gf-ctlbox' }), map: h('div', { class: 'gf-mapbox' }),
      intel: h('div', { class: 'gf-intelbox' }), squad: h('div', { class: 'gf-squadbox' }),
    };
    els.root = h('div', { class: 'gf-home' },
      els.squad,
      h('section', { class: 'gf-panel gf-tac' }, panelHead('TACTICAL MAP', '戰術地圖'), els.ctl, els.map),
      els.intel);
    // 首次在 DOM 中填入內容（setKeys 需要在 render 之後才不會被清掉）
    fill(els.ctl, controls()); fill(els.map, mapEl()); fill(els.squad, squadPanel());
    fill(els.intel, intelPanel());
    return els.root;
  }

  function gfStats(base) {
    const el = base.stats();
    const d = data();
    el.prepend(h('section', { class: 'gf-panel gf-report' }, panelHead('AFTER ACTION REPORT', '戰報摘要'),
      h('div', { class: 'gf-bigstats' },
        h('div', null, h('small', { class: 'gf-mono', text: 'OPS' }), h('b', { text: String(d.ops || 0) }), h('span', { text: '完成任務' })),
        h('div', null, h('small', { class: 'gf-mono', text: 'LAST' }), h('b', { text: d.last ? d.last.secured + '%' : '—' }), h('span', { text: d.last ? `${QG.EXAM_MAP.has(d.last.exam) ? QG.EXAM_MAP.get(d.last.exam).title : d.last.exam} 佔領率` : '尚未完成任務' })))));
    return el;
  }

  /* ---------------------------------------------------------------- 演習簡報（模擬考結果） */
  function gfResult(base) {
    const el = base.result();
    const r = S().lastResult;
    if (!r) return el;
    const rating = r.score >= 90 ? 'S' : r.score >= 75 ? 'A' : r.score >= 60 ? 'B' : 'C';
    el.prepend(h('section', { class: 'gf-panel gf-result' + (r.score >= 60 ? '' : ' fail') },
      panelHead('EXERCISE DEBRIEF', '演習簡報'),
      h('div', { class: 'gf-result-row' },
        h('b', { class: 'gf-rating', 'aria-label': `評等 ${rating}`, text: rating }),
        h('div', { class: 'gf-bigstats' },
          h('div', null, h('small', { class: 'gf-mono', text: 'SCORE' }), h('b', { text: String(r.score) }), h('span', { text: r.score >= 60 ? '達成目標（60 分）' : '未達目標（60 分）' })),
          h('div', null, h('small', { class: 'gf-mono', text: 'HIT' }), h('b', { text: `${r.correct}/${r.total}` }), h('span', { text: '命中題數' }))))));
    return el;
  }

  /* ---------------------------------------------------------------- 進場與換頁轉場 */
  const bootLines = ['TACTICAL TERMINAL', 'LINK ........ OK', 'MAP DATA .... OK', 'STANDBY'];
  // 進場（載入）動畫：每個分頁工作階段第一次以本風格載入時播放一次
  const ENTRY_KEY = 'qg-entry-' + ID;
  let entryPending = (() => { try { return !sessionStorage.getItem(ENTRY_KEY); } catch (e) { return true; } })();
  let firstRender = true; // 頁面剛載入的第一次繪製不做換頁動畫
  let switched = false; // 從切換列換到本風格時只做換頁動畫（完整進場動畫留給頁面載入）
  document.addEventListener('change', (e) => { if (e.target && e.target.id === 'sk-select') switched = true; }, true);
  document.addEventListener('click', (e) => { if (e.target && e.target.closest && e.target.closest('.sk-bar-step')) switched = true; }, true);
  function drillHud(view) {
    const t = QG.totals();
    const d = S().days[QG.dayKey()] || { n: 0, c: 0 };
    return h('div', { class: 'gf-drillhud', 'aria-hidden': 'true' },
      h('span', { class: 'gf-stencil', text: view === 'review' ? 'REPAIR' : 'DRILL' }),
      h('span', { class: 'gf-mono', text: `HIT ${QG.pct(t.c, t.n)}` }),
      h('span', { class: 'gf-mono', text: `TODAY ${d.c}/${d.n}` }),
      h('span', { class: 'gf-dh-bar' }, h('i', { style: `width:${Math.min(100, d.n * 2)}%` })));
  }
  function gfAfter(view, changed) {
    const page = document.getElementById('app').firstElementChild;
    if ((view === 'practice' || view === 'review') && page && page.querySelector('.qhead')) document.getElementById('app').prepend(drillHud(view));
    if (reduced()) { entryPending = false; firstRender = false; switched = false; return; }
    if (switched) entryPending = false;
    if (page && ((changed && !firstRender) || switched)) page.classList.add('gf-scene');
    firstRender = false;
    switched = false;
    if (entryPending) {
      entryPending = false;
      try { sessionStorage.setItem(ENTRY_KEY, '1'); } catch (e) { /* 無法使用 sessionStorage 時每次載入都播放 */ }
      const o = h('div', { class: 'gf-entry', 'aria-hidden': 'true' },
        h('div', { class: 'gf-boot' }, bootLines.map((t, i) => h('p', { style: `--d:${i * 0.1}s`, text: t })), h('span', { class: 'gf-boot-bar' }, h('i'))));
      document.body.append(o);
      setTimeout(() => o.remove(), 1150);
    }
  }

  SK.register({
    id: ID, label: '少女前線2風', group: '二次元手遊',
    top: gfTop, nav: NAV.filter((n) => n.v !== 'browse'),
    views: { home: gfHome, stats: gfStats, result: gfResult },
    after: gfAfter,
  });
})();
