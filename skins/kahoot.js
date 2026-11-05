/* Kahoot! 風：大廳（選科目與題數）→ 20 秒倒數、四色形狀答案方塊 → 全螢幕答對／答錯與得分、連勝 →
 * 頒獎台（只和自己過去的成績比，不捏造其他玩家）。每題作答都寫入學習紀錄。
 * 只借用版面、互動與配色；不使用任何標誌、角色或專屬字型。 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon } = SK;
  const S = () => QG.S();

  const LIMIT = 20;
  const SHAPES = [
    { name: '三角形', svg: '<polygon points="12,2.5 22.5,21 1.5,21"/>' },
    { name: '菱形', svg: '<polygon points="12,1.5 22.5,12 12,22.5 1.5,12"/>' },
    { name: '圓形', svg: '<circle cx="12" cy="12" r="10.5"/>' },
    { name: '方形', svg: '<rect x="2.5" y="2.5" width="19" height="19"/>' },
  ];
  const SUBJS = [['industry', 'L11 產業概論'], ['process', 'L12 製造概論'], ['both', '兩科混合']];

  function shape(i) {
    const s = h('span', { class: 'kahoot-shape', 'aria-hidden': 'true' });
    s.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor">${SHAPES[i].svg}</svg>`;
    return s;
  }

  /** skinData.kahoot：{subj, n, history:[{ts, score, correct, total, subj, streak}]} */
  function data() {
    const st = S().settings;
    if (!st.skinData) st.skinData = {};
    const d = st.skinData.kahoot || (st.skinData.kahoot = {});
    if (!d.subj) d.subj = 'both';
    if (!d.n) d.n = 10;
    if (!Array.isArray(d.history)) d.history = [];
    return d;
  }
  const best = () => data().history.reduce((m, r) => Math.max(m, r.score), 0);
  const fmtDate = (ts) => { const t = new Date(ts); return `${t.getMonth() + 1}/${t.getDate()} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`; };

  const g = { phase: 'lobby', ids: [], i: 0, score: 0, streak: 0, maxStreak: 0, results: [], deadline: 0, runTs: 0, last: null };
  let timer = null;
  const stop = () => { clearInterval(timer); timer = null; };

  function start() {
    const d = data();
    const pool = QG.QS.filter((q) => q.official && !q.prev && (d.subj === 'both' || q.s === d.subj)).map((q) => q.id);
    Object.assign(g, { phase: 'q', ids: QG.shuffle(pool).slice(0, d.n), i: 0, score: 0, streak: 0, maxStreak: 0, results: [], deadline: Date.now() + LIMIT * 1000, runTs: Date.now(), last: null });
  }

  function answer(letter) {
    if (g.phase !== 'q') return;
    stop();
    const q = QG.QMAP.get(g.ids[g.i]);
    const left = Math.max(0, (g.deadline - Date.now()) / 1000);
    const ok = !!letter && (q.all || q.a.includes(letter));
    const pts = ok ? Math.round(1000 * (0.5 + 0.5 * (left / LIMIT))) : 0;
    g.streak = ok ? g.streak + 1 : 0;
    g.maxStreak = Math.max(g.maxStreak, g.streak);
    g.score += pts;
    g.last = { id: q.id, ok, pts, letter, timeout: !letter };
    g.results.push(g.last);
    QG.record(q.id, ok);
    QG.Store.save();
    QG.updateBadges();
    g.phase = 'res';
  }

  function next() {
    if (g.phase !== 'res') return;
    g.i++;
    if (g.i >= g.ids.length) {
      const d = data();
      const correct = g.results.filter((r) => r.ok).length;
      d.history.push({ ts: g.runTs, score: g.score, correct, total: g.ids.length, subj: d.subj, streak: g.maxStreak });
      if (d.history.length > 60) {
        const keep = new Set(d.history.slice().sort((a, b) => b.score - a.score).slice(0, 10));
        d.history = d.history.filter((r, k) => keep.has(r) || k >= d.history.length - 50);
      }
      QG.Store.save();
      g.phase = 'end';
    } else {
      g.phase = 'q';
      g.deadline = Date.now() + LIMIT * 1000;
    }
  }

  /* ---------------------------------------------------------------- 頂部列 */
  function khTop() {
    const b = best();
    return h('div', { class: 'sk-top kahoot-top' },
      h('a', { class: 'kahoot-brand', href: '#home', 'aria-label': 'QuizGrinder 首頁' }, icon('pad'), h('span', { text: 'QuizGrinder!' })),
      h('div', { class: 'sk-right' },
        g.phase === 'q' || g.phase === 'res' ? h('span', { class: 'kahoot-pill', text: `${g.i + 1} / ${g.ids.length}` }) : null,
        h('span', { class: 'kahoot-pill', title: '你的最高分' }, icon('star'), b ? QG.fmtNum(b) : '—')));
  }

  const NAV = [
    { v: 'home', label: '大廳', icon: 'home' },
    { v: 'practice', label: '練習', icon: 'practice' },
    { v: 'review', label: '錯題', icon: 'review', badge: true },
    { v: 'exam', label: '模擬考', icon: 'exam' },
    { v: 'stats', label: '戰績', icon: 'stats' },
  ];

  /* ---------------------------------------------------------------- 畫面 */
  function lobby(wrap, redraw) {
    QG.setKeys((e) => { if (e.key === 'Enter') { start(); redraw(); return true; } return false; });
    const d = data();
    const hist = d.history;
    const seg = (cur, opts, set) => h('div', { class: 'kahoot-seg', role: 'group' }, opts.map(([v, l]) =>
      h('button', { type: 'button', 'aria-pressed': cur === v ? 'true' : 'false', text: l, onclick: () => { set(v); QG.Store.save(); redraw(); } })));
    const pool = QG.QS.filter((q) => q.official && !q.prev && (d.subj === 'both' || q.s === d.subj)).length;
    fill(wrap,
      h('div', { class: 'kahoot-lobby' },
        h('div', { class: 'kahoot-logo' }, icon('pad'), h('span', { text: 'QuizGrinder!' })),
        h('section', { class: 'kahoot-card', 'aria-label': '開始遊戲' },
          h('p', { class: 'kahoot-card-label', text: '科目' }),
          seg(d.subj, SUBJS, (v) => { d.subj = v; }),
          h('p', { class: 'kahoot-card-label', text: '題數' }),
          seg(d.n, [[10, '10 題'], [20, '20 題']], (v) => { d.n = v; }),
          h('button', { class: 'kahoot-start', type: 'button', text: '開始', onclick: () => { start(); redraw(); } }),
          h('p', { class: 'kahoot-card-note', text: `從 ${QG.fmtNum(pool)} 題官方試題隨機出題・每題 ${LIMIT} 秒・答得越快分數越高` })),
        hist.length ? h('p', { class: 'kahoot-lobby-best' }, '你的最高分 ', h('b', { text: QG.fmtNum(best()) }), `・已玩 ${hist.length} 場`) : h('p', { class: 'kahoot-lobby-best', text: '還沒有紀錄——第一場就是你的新紀錄！' })));
  }

  function ring(left) {
    const c = 2 * Math.PI * 44;
    const el = h('div', { class: 'kahoot-timer', role: 'timer', 'aria-label': `剩 ${Math.ceil(left)} 秒` });
    el.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="kahoot-ring-bg" cx="50" cy="50" r="44"/><circle class="kahoot-ring-fg" cx="50" cy="50" r="44" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - left / LIMIT)}"/></svg><b>${Math.ceil(left)}</b>`;
    el.update = (t) => {
      el.querySelector('.kahoot-ring-fg').setAttribute('stroke-dashoffset', String(c * (1 - t / LIMIT)));
      el.querySelector('b').textContent = String(Math.ceil(t));
      el.classList.toggle('low', t <= 5);
    };
    return el;
  }

  function play(wrap, redraw) {
    const q = QG.QMAP.get(g.ids[g.i]);
    const left = Math.max(0, (g.deadline - Date.now()) / 1000);
    const pick = (i) => { answer(QG.LETTERS[i]); redraw(); };
    QG.setKeys((e) => {
      const k = e.key.toUpperCase();
      const i = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : QG.LETTERS.indexOf(k);
      if (i >= 0) { pick(i); return true; }
      return false;
    });
    const t = ring(left);
    fill(wrap, h('div', { class: 'kahoot-play' },
      h('div', { class: 'kahoot-qbar' }, h('p', { class: 'kahoot-q', text: q.q })),
      h('div', { class: 'kahoot-mid' },
        t,
        q.fig ? h('figure', { class: 'kahoot-fig' }, h('img', { src: q.fig, alt: '題目附圖' })) : h('div', { class: 'kahoot-fig empty', 'aria-hidden': 'true' }, icon('pad')),
        h('div', { class: 'kahoot-side' },
          h('span', { class: 'kahoot-side-n', text: `${g.i + 1} / ${g.ids.length}` }),
          h('span', { class: 'kahoot-side-l', text: '題' }),
          h('span', { class: 'kahoot-side-n', text: QG.fmtNum(g.score) }),
          h('span', { class: 'kahoot-side-l', text: '分數' }))),
      h('div', { class: 'kahoot-tiles', role: 'group', 'aria-label': '選項' }, QG.LETTERS.map((L, i) =>
        h('button', { class: 'kahoot-tile c' + i, type: 'button', 'aria-label': `${SHAPES[i].name} ${L}：${q.o[L]}（按 ${i + 1}）`, onclick: () => pick(i) },
          shape(i), h('span', { class: 'kahoot-tile-l', text: L }), h('span', { class: 'kahoot-tile-t', text: q.o[L] }))))));
    stop();
    timer = setInterval(() => {
      if (!t.isConnected) { stop(); return; }
      const rem = Math.max(0, (g.deadline - Date.now()) / 1000);
      t.update(rem);
      if (rem <= 0) { answer(null); redraw(); }
    }, 100);
  }

  function resultScreen(wrap, redraw) {
    const r = g.last;
    const q = QG.QMAP.get(r.id);
    const go = () => { next(); redraw(); };
    QG.setKeys((e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { go(); return true; } return false; });
    const ans = q.all ? '所有選項均給分' : q.a.map((L) => `${L}. ${q.o[L]}`).join('；');
    const btn = h('button', { class: 'kahoot-next', type: 'button', text: g.i + 1 >= g.ids.length ? '看頒獎台' : '下一題', onclick: go });
    fill(wrap, h('div', { class: 'kahoot-result ' + (r.ok ? 'ok' : 'ng'), role: 'status' },
      h('p', { class: 'kahoot-res-title', text: r.ok ? '答對！' : r.timeout ? '時間到！' : '答錯' }),
      h('span', { class: 'kahoot-res-mark', 'aria-hidden': 'true', text: r.ok ? '✓' : '✕' }),
      r.ok
        ? h('p', { class: 'kahoot-streak' }, icon('flame'), `答題連勝 ${g.streak}`)
        : h('p', { class: 'kahoot-streak', text: g.results.length > 1 && g.results[g.results.length - 2].ok ? '連勝中斷了，下一題再接再厲！' : '下一題扳回來！' }),
      h('p', { class: 'kahoot-pts', text: r.ok ? `+ ${QG.fmtNum(r.pts)}` : '+ 0' }),
      r.ok ? null : h('p', { class: 'kahoot-res-ans' }, '正確答案：', h('b', { text: ans })),
      h('p', { class: 'kahoot-res-total', text: `總分 ${QG.fmtNum(g.score)}・第 ${g.i + 1} / ${g.ids.length} 題` }),
      btn));
    setTimeout(() => btn.focus({ preventScroll: true }), 0);
  }

  function endScreen(wrap, redraw) {
    const d = data();
    QG.setKeys(null);
    const correct = g.results.filter((r) => r.ok).length;
    const wrong = g.results.filter((r) => !r.ok).map((r) => r.id);
    const top = d.history.slice().sort((a, b) => b.score - a.score || a.ts - b.ts).slice(0, 3);
    const rankOf = top.findIndex((r) => r.ts === g.runTs);
    const place = (r, k) => r ? h('div', { class: 'kahoot-pod p' + (k + 1) + (r.ts === g.runTs ? ' me' : ''), style: `--d:${[1, 0, 2][k] * .35}s` },
      h('div', { class: 'kahoot-pod-name' }, h('b', { text: r.ts === g.runTs ? '本次' : fmtDate(r.ts) }), h('span', { text: `${QG.fmtNum(r.score)} 分` }),
        h('small', { text: `答對 ${r.correct}/${r.total}` })),
      h('div', { class: 'kahoot-pod-block' }, h('span', { class: 'kahoot-medal', text: String(k + 1) }))) : h('div', { class: 'kahoot-pod empty p' + (k + 1) });
    fill(wrap, h('div', { class: 'kahoot-end' },
      h('h1', { class: 'kahoot-end-title', text: '頒獎台' }),
      h('p', { class: 'kahoot-end-sub', text: d.history.length > 1 ? '和你自己過去的最佳成績比一比' : '第一場紀錄誕生！' }),
      h('div', { class: 'kahoot-podium' }, place(top[1], 1), place(top[0], 0), place(top[2], 2)),
      h('section', { class: 'kahoot-card kahoot-summary' },
        h('div', { class: 'kahoot-sum-row' },
          h('div', null, h('b', { text: QG.fmtNum(g.score) }), h('span', { text: '總分' })),
          h('div', null, h('b', { text: `${correct}/${g.ids.length}` }), h('span', { text: '答對' })),
          h('div', null, h('b', { text: String(g.maxStreak) }), h('span', { text: '最長連勝' }))),
        h('p', { class: 'kahoot-card-note', text: rankOf >= 0 ? `這場排在你的第 ${rankOf + 1} 名！` : `你的最高分是 ${QG.fmtNum(best())}，這場還差 ${QG.fmtNum(best() - g.score)} 分。` }),
        h('div', { class: 'kahoot-end-btns' },
          h('button', { class: 'kahoot-start', type: 'button', text: '再玩一次', onclick: () => { start(); redraw(); } }),
          wrong.length ? h('button', { class: 'kahoot-btn', type: 'button', text: `複習答錯的 ${wrong.length} 題`, onclick: () => QG.startReview(wrong) }) : null,
          h('button', { class: 'kahoot-btn ghost', type: 'button', text: '回大廳', onclick: () => { g.phase = 'lobby'; redraw(); } })))));
  }

  function khHome() {
    const wrap = h('div', { class: 'kahoot-page' });
    if (g.phase === 'q' && Date.now() > g.deadline + 2000) g.phase = 'lobby';
    const redraw = () => {
      if (g.phase !== 'q') stop();
      wrap.dataset.phase = g.phase;
      document.documentElement.classList.toggle('kahoot-ingame', g.phase === 'q' || g.phase === 'res');
      if (g.phase === 'q') play(wrap, redraw);
      else if (g.phase === 'res') resultScreen(wrap, redraw);
      else if (g.phase === 'end') endScreen(wrap, redraw);
      else lobby(wrap, redraw);
      const top = document.querySelector('#topbar');
      if (top && wrap.isConnected) fill(top, khTop());
    };
    redraw();
    return wrap;
  }

  SK.register({
    id: 'kahoot', label: 'Kahoot! 風', group: '學習測驗',
    top: khTop, nav: NAV,
    views: { home: khHome },
    after: (view) => {
      document.documentElement.classList.toggle('kahoot-ingame', view === 'home' && (g.phase === 'q' || g.phase === 'res'));
      if (view !== 'home') { stop(); if (g.phase === 'q' || g.phase === 'res') g.phase = 'lobby'; }
    },
  });
})();
