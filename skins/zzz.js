/* QuizGrinder 版面風格：絕區零風（電視格探索）
 *
 * 借用：街頭潮流平面設計（粗體窄字、貼紙、黃黑高對比、網點）、由一格格映像管電視組成的探索地圖、櫃台式大廳。
 * 大廳：選一個主題當作這一輪的「錄影帶」，看最佳紀錄後開始探索。
 * 探索：每輪依主題隨機產生 5×5 電視格地圖——起點、出口、題目格（必須作答才能離開）、
 *       提示格（下一題刪去一個錯誤選項）、情報格（顯示一題你以前答錯的題目與正解）；
 *       方向鍵／WASD 或點相鄰的格子移動，走到出口即結算。
 * 作答用 SK.answerOptions（寫入學習紀錄）；地圖與本輪狀態只在記憶體，
 * 每個主題的最佳通關紀錄存在 S().settings.skinData.zzz[主題]。不使用任何角色、標誌或遊戲專有名詞。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon, hue } = SK;
  const S = () => QG.S();
  const N = 5;
  const DIRS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], W: [-1, 0], S: [1, 0], A: [0, -1], D: [0, 1] };

  Object.assign(SK.ICONS, {
    'zzz-tv': '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M8 2l4 4 4-4"/><path d="M7 22h10"/>',
    'zzz-exit': '<path d="M14 4h6v16h-6"/><path d="M4 12h11M11 8l4 4-4 4"/>',
    'zzz-intel': '<path d="M4 6h6l2 2h8v11H4z"/><path d="M9 14h6"/>',
    'zzz-q': '<path d="M9.2 9.2a2.9 2.9 0 1 1 3.9 2.7c-.7.3-1.1.9-1.1 1.7v.6"/><path d="M12 18h.01"/><rect x="3" y="3" width="18" height="18" rx="4"/>',
  });

  /* ---------------------------------------------------------------- 資料 */

  function store() {
    const st = S().settings;
    if (!st.skinData || typeof st.skinData !== 'object') st.skinData = {};
    if (!st.skinData.zzz || typeof st.skinData.zzz !== 'object') st.skinData.zzz = {};
    return st.skinData.zzz;
  }
  const bestOf = (t) => { const sd = S().settings.skinData; return (sd && sd.zzz && sd.zzz[t]) || null; };

  function topics() {
    const off = QG.QS.filter((q) => q.official);
    const st = S().q;
    return QG.TAGS.filter(([t]) => t !== '其他').map(([t]) => {
      const qs = off.filter((q) => q.t.includes(t));
      const ids = qs.map((q) => q.id);
      const p = SK.progressOf(ids);
      const missed = ids.filter((id) => st[id] && st[id].w > 0);
      return { t, ids, usable: qs.filter((q) => !q.prev).map((q) => q.id), seen: p.seen, acc: p.n ? p.c / p.n : null, missed };
    }).filter((x) => x.usable.length >= 12);
  }

  const rand = (n) => Math.floor(Math.random() * n);
  const key = (r, c) => r * N + c;

  /** 產生一張 5×5 地圖：保證起點到出口有一條路，再加幾條死巷放提示與情報 */
  function genMap(tp) {
    const r0 = rand(N), r1 = rand(N);
    const path = [];
    const add = (r, c) => { const k = key(r, c); if (!path.includes(k)) path.push(k); };
    let r = r0, c = 0;
    add(r, c);
    while (c < N - 1) {
      // 每一欄隨機上下走 0–2 格，再往右
      let steps = rand(3);
      const dir = r === 0 ? 1 : r === N - 1 ? -1 : Math.random() < 0.5 ? -1 : 1;
      while (steps-- > 0 && r + dir >= 0 && r + dir < N) { r += dir; add(r, c); }
      c++; add(r, c);
    }
    while (r !== r1) { r += r1 > r ? 1 : -1; add(r, c); }
    const active = new Set(path);
    const branches = [];
    let guard = 0;
    while (branches.length < 4 && guard++ < 200) {
      const from = path[1 + rand(path.length - 2)];
      const fr = Math.floor(from / N), fc = from % N;
      const [dr, dc] = [[-1, 0], [1, 0], [0, -1], [0, 1]][rand(4)];
      const nr = fr + dr, nc = fc + dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      const k = key(nr, nc);
      if (active.has(k)) continue;
      active.add(k); branches.push(k);
    }
    const tiles = Array.from({ length: N * N }, (_, k) => ({ k, type: active.has(k) ? 'q' : 'off', seen: false }));
    tiles[path[0]].type = 'start';
    tiles[path[path.length - 1]].type = 'exit';
    const intelPool = QG.buildQueue(tp.missed, 'weak');
    branches.forEach((k, i) => {
      if (i < 2) tiles[k].type = 'hint';
      else if (intelPool.length > i - 2) tiles[k].type = 'intel';
    });
    // 題目：弱點優先
    const qTiles = tiles.filter((t) => t.type === 'q');
    const qIds = QG.buildQueue(tp.usable, 'weak').slice(0, qTiles.length);
    qTiles.forEach((t, i) => { t.qid = qIds[i]; });
    const used = new Set(qIds);
    const intelIds = intelPool.filter((id) => !used.has(id));
    tiles.filter((t) => t.type === 'intel').forEach((t, i) => { if (intelIds[i]) t.qid = intelIds[i]; else t.type = 'hint'; });
    return { tiles, start: path[0], exit: path[path.length - 1] };
  }

  /* ---------------------------------------------------------------- 狀態 */

  const ui = { mode: 'lobby', topic: null, run: null, sum: null };
  let host = null, panel = null;

  let lastMode = null;
  function draw() {
    if (!host || !host.isConnected) return;
    if (lastMode !== ui.mode) { lastMode = ui.mode; window.scrollTo(0, 0); }
    host.dataset.mode = ui.mode;
    fill(host, ui.mode === 'run' && ui.run ? runView() : ui.mode === 'done' && ui.sum ? doneView() : lobbyView());
  }

  /* ---------------------------------------------------------------- 大廳 */

  function lobbyView() {
    const list = topics();
    let tp = list.find((x) => x.t === ui.topic);
    if (!tp) { tp = list[0]; ui.topic = tp && tp.t; }
    const b = tp && bestOf(tp.t);
    QG.setKeys((e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return false;
      const i = list.findIndex((x) => x.t === ui.topic);
      const j = Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1)));
      ui.topic = list[j].t; draw();
      const el = host.querySelector('.zzz-tape.sel'); if (el) el.focus({ preventScroll: true });
      return true;
    });
    const totalClears = Object.values(store()).reduce((a, x) => a + (x.clears || 0), 0);
    return h('div', { class: 'zzz-lobby' },
      h('div', { class: 'zzz-tape-strip', 'aria-hidden': 'true' }, h('span', { text: 'QUIZGRINDER ✕ TV GRID ✕ IPAS PCB ✕ '.repeat(4) })),
      h('header', { class: 'zzz-lhead' },
        h('span', { class: 'zzz-sticker y rot-l', text: 'RUN SETUP' }),
        h('h1', { class: 'zzz-title' }, '電視格', h('em', { text: '探索' })),
        h('span', { class: 'zzz-open', 'aria-hidden': 'true' }, h('i'), '營業中'),
        h('p', { class: 'zzz-lsub', text: `挑一卷主題帶，走過 5×5 的電視牆到出口。累計通關 ${totalClears} 次。` })),
      h('section', { class: 'zzz-shelf', 'aria-label': '主題錄影帶架' },
        h('div', { class: 'zzz-shelf-h' }, h('span', { class: 'zzz-sticker w', text: '主題帶' }), h('span', { class: 'zzz-small', text: `${list.length} 卷・方向鍵切換` })),
        h('div', { class: 'zzz-tapes' }, list.map((x) => {
          const xb = bestOf(x.t);
          return h('button', { type: 'button', class: 'zzz-tape' + (x.t === ui.topic ? ' sel' : ''), style: `--h:${hue(x.t)}`, 'aria-pressed': x.t === ui.topic ? 'true' : 'false',
            onclick: () => { ui.topic = x.t; draw(); const c = host.querySelector('.zzz-counter'); if (c && matchMedia('(max-width: 960px)').matches) c.scrollIntoView({ block: 'start' }); } },
            h('span', { class: 'zzz-tape-win', 'aria-hidden': 'true' }, h('i'), h('i')),
            h('b', { class: 'zzz-tape-t', text: x.t }),
            h('span', { class: 'zzz-tape-n', text: `${x.ids.length} 題` }),
            xb && xb.clears ? h('span', { class: 'zzz-tape-clear', text: `CLEAR ×${xb.clears}` }) : null);
        }))),
      tp ? h('section', { class: 'zzz-counter', 'aria-label': '櫃台：本輪設定' },
        h('div', { class: 'zzz-counter-top' },
          h('span', { class: 'zzz-sticker k rot-r', text: 'NOW RENTING' }),
          h('h2', { text: tp.t }),
          h('div', { class: 'zzz-facts' },
            fact('題數', String(tp.ids.length)),
            fact('已練', `${tp.seen}`),
            fact('正確率', tp.acc === null ? '—' : Math.round(tp.acc * 100) + '%'),
            fact('錯題情報', `${tp.missed.length}`))),
        h('div', { class: 'zzz-best' },
          h('span', { class: 'zzz-best-h', text: '最佳紀錄' }),
          b ? h('div', { class: 'zzz-facts' },
            fact('通關', `${b.clears} 次`), fact('最佳正確率', Math.round(b.bestAcc * 100) + '%'), fact('最少步數', String(b.bestMoves)), fact('最快', fmtTime(b.bestTime)))
            : h('p', { class: 'zzz-small', text: '這卷還沒有通關紀錄。' })),
        h('ul', { class: 'zzz-legend' },
          legend('start', '起點'), legend('q', '題目：答完才能離開'), legend('hint', '提示：下一題刪去一個錯誤選項'),
          legend('intel', tp.missed.length ? '情報：看一題以前答錯的題目與正解' : '情報：需要這個主題的錯題紀錄'), legend('exit', '出口：抵達即結算')),
        h('button', { type: 'button', class: 'zzz-go', onclick: () => startRun(tp) }, h('span', { text: '開始探索' }), icon('arrow'))) : null);
  }
  function fact(k, v) { return h('div', { class: 'zzz-fact' }, h('span', { text: k }), h('b', { text: v })); }
  function legend(type, text) { return h('li', null, h('span', { class: 'zzz-lg zzz-t-' + type, 'aria-hidden': 'true' }, tileGlyph(type)), h('span', { text })); }
  const fmtTime = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  /* ---------------------------------------------------------------- 探索 */

  function startRun(tp) {
    const map = genMap(tp);
    ui.run = { tp, tiles: map.tiles, pos: map.start, exit: map.exit, hints: 0, hintsUsed: 0, intel: 0, moves: 0, answered: 0, correct: 0, wrong: [], t0: Date.now(), msg: '從起點出發，走到出口。題目格必須作答才能離開。', visited: new Set([map.start]) };
    reveal();
    ui.mode = 'run';
    draw();
  }

  function neighbors(k) {
    const r = Math.floor(k / N), c = k % N, out = [];
    if (r > 0) out.push(k - N);
    if (r < N - 1) out.push(k + N);
    if (c > 0) out.push(k - 1);
    if (c < N - 1) out.push(k + 1);
    return out;
  }
  function reveal() {
    const run = ui.run;
    run.tiles[run.pos].seen = true;
    for (const k of neighbors(run.pos)) run.tiles[k].seen = true;
  }
  const blocked = () => { const t = ui.run.tiles[ui.run.pos]; return t.type === 'q' && !t.done; };

  function tryMove(k) {
    const run = ui.run;
    if (panel) return;
    if (blocked()) { openTile(run.tiles[run.pos]); return; }
    if (k === run.pos) { openTile(run.tiles[k]); return; }
    if (!neighbors(run.pos).includes(k)) { say('只能移動到上下左右相鄰的電視。'); return; }
    const t = run.tiles[k];
    if (t.type === 'off') { say('這台電視沒有訊號，過不去。'); return; }
    run.pos = k;
    run.fresh = k;
    run.moves++;
    run.visited.add(k);
    reveal();
    run.msg = '';
    redrawGrid();
    redrawStatus();
    enter(t);
  }
  function say(m) { ui.run.msg = m; const el = host && host.querySelector('.zzz-msg'); if (el) el.textContent = m; }

  function enter(t) {
    const run = ui.run;
    if (t.type === 'hint' && !t.done) {
      t.done = true; run.hints++;
      run.msg = `取得提示！下一題會刪去一個錯誤選項（存量 ${run.hints}）。`;
      redrawGrid();
      redrawStatus();
    } else if (t.type === 'intel' && !t.done) {
      openTile(t);
    } else if (t.type === 'q' && !t.done) {
      openTile(t);
    } else if (t.type === 'exit') {
      finish();
    }
  }

  function openTile(t) {
    if (t.type === 'q' && !t.done) openQuestion(t);
    else if (t.type === 'intel') openIntel(t);
    else if (t.type === 'exit') finish();
  }
  function track(m) { if (SK.setOpenModal) SK.setOpenModal(m); return m; }

  function openQuestion(t) {
    const run = ui.run;
    const q = QG.QMAP.get(t.qid);
    const foot = h('div', { class: 'zzz-pfoot' });
    let cut = null;
    const opts = SK.answerOptions(q, { cls: 'zzz-ans', onDone: (ok, L) => {
      t.done = true; t.ok = ok;
      run.answered++;
      if (ok) run.correct++; else run.wrong.push(q.id);
      const ans = q.all ? '所有選項均給分' : `正解 ${q.a.join('、')}`;
      fill(foot,
        h('div', { class: 'zzz-verdict ' + (ok ? 'ok' : 'ng') }, h('b', { text: ok ? 'CLEAR!' : 'DAMAGED' }), h('span', { text: ok ? '答對，這格已清除。' : `答錯（你選 ${L}，${ans}），已加入錯題本。這格算已作答，可以繼續前進。` })),
        q.x ? h('p', { class: 'zzz-x', text: q.x }) : null,
        h('button', { type: 'button', class: 'zzz-go small', id: 'zzz-cont', onclick: closePanel }, '繼續探索', h('kbd', { text: 'Enter' })));
      const b = foot.querySelector('#zzz-cont'); if (b) b.focus({ preventScroll: true });
      redrawGrid(); redrawStatus();
    } });
    if (run.hints > 0 && !q.all) {
      const wrong = QG.LETTERS.map((L, i) => [L, i]).filter(([L]) => !q.a.includes(L));
      const [, i] = wrong[rand(wrong.length)];
      const btn = opts.querySelectorAll('.ans-opt')[i];
      if (btn) { btn.disabled = true; btn.classList.add('zzz-cut'); cut = QG.LETTERS[i]; }
      run.hints--; run.hintsUsed++;
    }
    const content = h('div', { class: 'zzz-panel', role: 'document' },
      h('div', { class: 'zzz-panel-h' }, h('span', { class: 'zzz-sticker y rot-l', text: 'QUESTION' }), h('span', { class: 'zzz-small', text: q.src.map(QG.srcLabel).join('・') })),
      cut ? h('p', { class: 'zzz-hintnote', text: `提示生效：已刪去選項 ${cut}` }) : null,
      h('p', { class: 'zzz-qtext', text: q.q }),
      q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖（自原始試卷裁切）', loading: 'lazy' })) : null,
      opts, foot);
    panel = track(SK.modal(content, 'zzz-modal', () => { panel = null; panelOpts = null; redrawGrid(); redrawStatus(); }));
    panelOpts = opts;
    panelOpts.done = () => t.done;
    redrawStatus();
  }
  let panelOpts = null;

  function openIntel(t) {
    const q = QG.QMAP.get(t.qid);
    const r = S().q[q.id] || { c: 0, w: 0 };
    if (!t.done) { t.done = true; ui.run.intel++; }
    const content = h('div', { class: 'zzz-panel intel', role: 'document' },
      h('div', { class: 'zzz-panel-h' }, h('span', { class: 'zzz-sticker k rot-r', text: 'INTEL' }), h('span', { class: 'zzz-small', text: `你在這題答錯過 ${r.w} 次、答對 ${r.c} 次` })),
      h('p', { class: 'zzz-qtext', text: q.q }),
      q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖（自原始試卷裁切）', loading: 'lazy' })) : null,
      h('ol', { class: 'zzz-intel-opts' }, QG.LETTERS.map((L) => h('li', { class: q.all || q.a.includes(L) ? 'ans' : null }, h('b', { text: L }), h('span', { text: q.o[L] }), q.all || q.a.includes(L) ? h('em', { text: '正解' }) : null))),
      q.x ? h('p', { class: 'zzz-x', text: q.x }) : null,
      h('button', { type: 'button', class: 'zzz-go small', onclick: closePanel }, '記住了，繼續', h('kbd', { text: 'Esc' })));
    panel = track(SK.modal(content, 'zzz-modal', () => { panel = null; redrawGrid(); redrawStatus(); }));
    redrawGrid(); redrawStatus();
  }
  function closePanel() { if (panel) panel.close(); }

  function tileGlyph(type, t) {
    if (type === 'q') return t && t.done ? h('span', { class: 'zzz-glyph', text: t.ok ? '✓' : '✗' }) : h('span', { class: 'zzz-glyph', text: '?' });
    if (type === 'hint') return icon('bulb', 'zzz-gi');
    if (type === 'intel') return icon('zzz-intel', 'zzz-gi');
    if (type === 'exit') return h('span', { class: 'zzz-word', text: 'EXIT' });
    if (type === 'start') return h('span', { class: 'zzz-word', text: 'START' });
    return null;
  }
  const TYPE_ZH = { q: '題目', hint: '提示', intel: '情報', exit: '出口', start: '起點', off: '無訊號' };

  function gridEl() {
    const run = ui.run;
    const adj = new Set(neighbors(run.pos));
    return h('div', { class: 'zzz-grid', role: 'grid', 'aria-label': '電視格地圖，用方向鍵移動' },
      [0, 1, 2, 3, 4].map((r) => h('div', { class: 'zzz-grow', role: 'row' }, [0, 1, 2, 3, 4].map((c) => {
        const k = key(r, c);
        const t = run.tiles[k];
        const here = k === run.pos;
        const shown = t.seen ? t.type : 'unknown';
        const state = t.done ? (t.type === 'q' ? (t.ok ? ' ok' : ' ng') : ' used') : '';
        const label = here ? `目前位置：${TYPE_ZH[t.type]}` : t.seen ? `${TYPE_ZH[t.type]}${t.done ? '（已完成）' : ''}` : '未知';
        return h('button', { type: 'button', role: 'gridcell', class: `zzz-tv zzz-t-${shown}${state}${here ? ' here' : ''}${here && run.fresh === k ? ' fresh' : ''}${adj.has(k) && t.seen && t.type !== 'off' ? ' adj' : ''}${run.visited.has(k) ? ' vis' : ''}`,
          'aria-label': label, tabindex: here ? '0' : '-1', onclick: () => tryMove(k) },
          h('span', { class: 'zzz-screen' }, t.seen ? tileGlyph(t.type, t) : h('span', { class: 'zzz-nosig', text: 'NO SIGNAL' }),
            t.seen && t.type !== 'off' && !here ? h('span', { class: 'zzz-cap', text: TYPE_ZH[t.type] }) : null),
          h('span', { class: 'zzz-knobs', 'aria-hidden': 'true' }, h('i'), h('i')),
          here ? h('span', { class: 'zzz-me', 'aria-hidden': 'true', text: 'YOU' }) : null);
      }))));
  }
  function redrawGrid() {
    const g = host && host.querySelector('.zzz-grid');
    if (!g) return;
    const n = gridEl();
    g.replaceWith(n);
    if (!panel) { const me = n.querySelector('.here'); if (me && host.contains(document.activeElement)) me.focus({ preventScroll: true }); }
  }

  function statusEl() {
    const run = ui.run;
    const qTotal = run.tiles.filter((t) => t.type === 'q').length;
    const qDone = run.tiles.filter((t) => t.type === 'q' && t.done).length;
    return h('section', { class: 'zzz-status', 'aria-label': '本輪狀態' },
      h('div', { class: 'zzz-status-h' }, h('span', { class: 'zzz-sticker y rot-r', text: 'ON AIR' }), h('b', { text: run.tp.t })),
      h('div', { class: 'zzz-facts' },
        fact('題目格', `${qDone}/${qTotal}`), fact('答對', `${run.correct}/${run.answered}`),
        fact('提示存量', String(run.hints)), fact('步數', String(run.moves)),
        h('div', { class: 'zzz-fact zzz-rec' }, h('span', null, h('i', { class: 'zzz-rec-dot' }), 'REC'), h('b', { class: 'zzz-clock', text: fmtTime(Date.now() - run.t0) }))),
      h('p', { class: 'zzz-msg', role: 'status', text: run.msg || (blocked() ? '這格的題目還沒作答，按 Enter 或點這格作答。' : '用方向鍵／WASD 或點相鄰的電視移動。') }),
      h('div', { class: 'zzz-status-btns' },
        h('button', { type: 'button', class: 'zzz-btn', onclick: () => { ui.run = null; ui.mode = 'lobby'; draw(); } }, '撤退回櫃台')));
  }
  function redrawStatus() {
    const s = host && host.querySelector('.zzz-status');
    if (s && ui.run) s.replaceWith(statusEl());
  }

  function runView() {
    const run = ui.run;
    const view = h('div', { class: 'zzz-run' },
      h('header', { class: 'zzz-rhead' }, h('h1', { class: 'zzz-title sm' }, '電視格', h('em', { text: '探索中' })),
        h('span', { class: 'zzz-small', text: '方向鍵／WASD 移動・Enter 打開目前的格子' })),
      h('div', { class: 'zzz-wall' }, gridEl()),
      statusEl());
    const tick = setInterval(() => {
      const el = view.querySelector('.zzz-clock');
      if (!view.isConnected || ui.run !== run) { clearInterval(tick); return; }
      if (el) el.textContent = fmtTime(Date.now() - run.t0);
    }, 1000);
    QG.setKeys((e) => {
      if (panel) {
        const k = e.key.toUpperCase();
        const i = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : QG.LETTERS.indexOf(k);
        if (panelOpts && k.length === 1 && i >= 0 && !panelOpts.done()) {
          const b = panelOpts.querySelectorAll('.ans-opt')[i];
          if (b && !b.disabled) panelOpts.pick(i);
          return true;
        }
        if (e.key === 'Enter') { const c = document.getElementById('zzz-cont'); if (c) { c.click(); return true; } }
        return false;
      }
      const d = DIRS[e.key] || DIRS[e.key.toUpperCase()];
      if (d && (e.key.length > 1 || 'WASD'.includes(e.key.toUpperCase()))) {
        const r = Math.floor(run.pos / N) + d[0], c = run.pos % N + d[1];
        if (r >= 0 && r < N && c >= 0 && c < N) tryMove(key(r, c));
        return true;
      }
      if (e.key === 'Enter' || e.key === ' ') { openTile(run.tiles[run.pos]); return true; }
      return false;
    });
    return view;
  }

  function finish() {
    const run = ui.run;
    const time = Date.now() - run.t0;
    const acc = run.answered ? run.correct / run.answered : 0;
    const sd = store();
    const prev = sd[run.tp.t];
    const rec = {
      clears: (prev ? prev.clears : 0) + 1,
      bestAcc: Math.max(acc, prev ? prev.bestAcc : 0),
      bestMoves: Math.min(run.moves, prev ? prev.bestMoves : Infinity),
      bestTime: Math.min(time, prev ? prev.bestTime : Infinity),
      ts: Date.now(),
    };
    sd[run.tp.t] = rec;
    QG.Store.save();
    const active = run.tiles.filter((t) => t.type !== 'off').length;
    ui.sum = { run, time, acc, active, newAcc: !prev || acc > prev.bestAcc, newMoves: !prev || run.moves < prev.bestMoves, newTime: !prev || time < prev.bestTime, rec };
    ui.run = null;
    ui.mode = 'done';
    draw();
  }

  function doneView() {
    const s = ui.sum, run = s.run;
    QG.setKeys((e) => { if (e.key === 'Enter') { ui.mode = 'lobby'; draw(); return true; } return false; });
    const grade = s.acc >= 0.9 ? 'S' : s.acc >= 0.75 ? 'A' : s.acc >= 0.6 ? 'B' : 'C';
    const stat = (k, v, isNew) => h('div', { class: 'zzz-fact big' }, h('span', { text: k }), h('b', { text: v }), isNew ? h('em', { class: 'zzz-new', text: 'NEW BEST' }) : null);
    return h('div', { class: 'zzz-done' },
      h('header', { class: 'zzz-dhead' },
        h('span', { class: 'zzz-sticker y rot-l', text: 'RUN COMPLETE' }),
        h('h1', { class: 'zzz-title' }, 'CLEAR', h('em', { text: '！' })),
        h('span', { class: 'zzz-grade', text: grade, 'aria-label': `評級 ${grade}` })),
      h('p', { class: 'zzz-lsub', text: `「${run.tp.t}」探索完成：走過 ${run.visited.size} / ${s.active} 台電視。` }),
      h('div', { class: 'zzz-dstats' },
        stat('答對', `${run.correct} / ${run.answered}`, false),
        stat('正確率', run.answered ? Math.round(s.acc * 100) + '%' : '—', s.newAcc && run.answered > 0),
        stat('步數', String(run.moves), s.newMoves),
        stat('時間', fmtTime(s.time), s.newTime),
        stat('使用提示', String(run.hintsUsed), false),
        stat('查看情報', String(run.intel), false)),
      h('p', { class: 'zzz-small', text: `這卷累計通關 ${s.rec.clears} 次。作答都已寫入學習紀錄，答錯的題目已進錯題本。` }),
      h('div', { class: 'zzz-status-btns' },
        h('button', { type: 'button', class: 'zzz-go', onclick: () => startRun(topics().find((x) => x.t === run.tp.t) || run.tp) }, h('span', { text: '再探一次（新地圖）' }), icon('arrow')),
        h('button', { type: 'button', class: 'zzz-btn', onclick: () => { ui.mode = 'lobby'; draw(); } }, '回櫃台'),
        run.wrong.length ? h('button', { type: 'button', class: 'zzz-btn', onclick: () => QG.startCustomPractice(run.wrong, `電視格探索：${run.tp.t} 答錯題`) }, `練習答錯的 ${run.wrong.length} 題`) : null));
  }

  /* ---------------------------------------------------------------- 模擬考結果 */

  function zzzResult(baseViews) {
    const view = baseViews.result();
    const r = S().lastResult;
    if (!r) return view;
    const grade = r.score >= 85 ? 'S' : r.score >= 70 ? 'A' : r.score >= 60 ? 'B' : 'C';
    view.prepend(h('section', { class: 'zzz-exres', 'aria-label': `模擬考 ${r.score} 分，評級 ${grade}` },
      h('span', { class: 'zzz-sticker y rot-l', text: 'MOCK EXAM RESULT' }),
      h('div', { class: 'zzz-exres-main' },
        h('b', { class: 'zzz-exres-score', text: String(r.score) }),
        h('span', { class: 'zzz-exres-unit', text: '分' }),
        h('span', { class: 'zzz-grade', text: grade })),
      h('p', { class: 'zzz-bubble', text: r.score >= 60 ? `答對 ${r.correct} / ${r.total}，這輪過關了！` : `答對 ${r.correct} / ${r.total}，錯的題目已經進錯題本，回去補強再來。` })));
    return view;
  }

  /* ---------------------------------------------------------------- 入場：轉台 */

  let booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    try { if (sessionStorage.getItem('qg-boot-zzz')) return; sessionStorage.setItem('qg-boot-zzz', '1'); } catch (e) { /* 無法使用時每次載入都播放 */ }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = h('div', { class: 'zzz-boot', 'aria-hidden': 'true' },
      h('span', { class: 'zzz-boot-line' }), h('span', { class: 'zzz-boot-noise' }),
      h('span', { class: 'zzz-boot-osd', text: 'CH 01 ▶ TV GRID' }));
    document.body.append(el);
    setTimeout(() => el.remove(), 1000);
  }

  /* ---------------------------------------------------------------- 外框 */

  function zzzHome() {
    // 重畫首頁時，進行中的探索保留（地圖只在記憶體）；對話框由 beforeRender 關閉
    panel = null; panelOpts = null;
    lastMode = ui.mode;
    host = h('div', { class: 'zzz-home' });
    host.dataset.mode = ui.mode;
    fill(host, ui.mode === 'run' && ui.run ? runView() : ui.mode === 'done' && ui.sum ? doneView() : lobbyView());
    return host;
  }

  function zzzTop() {
    const t = QG.totals();
    const due = QG.dueReviewIds().length;
    return h('div', { class: 'sk-top zzz-top' },
      h('a', { class: 'zzz-brand', href: '#home', 'aria-label': 'QuizGrinder 電視格探索' }, icon('pad', 'zzz-brand-ico'), h('b', { text: 'QUIZGRINDER' })),
      h('span', { class: 'zzz-tagline', 'aria-hidden': 'true', text: 'IPAS PCB // TV GRID' }),
      h('span', { class: 'spacer' }),
      h('span', { class: 'zzz-pill' }, h('small', { text: '答對' }), h('b', { text: QG.fmtNum(t.c) })),
      h('a', { class: 'zzz-pill y', href: '#review' }, h('small', { text: '錯題' }), h('b', { text: String(due) })));
  }

  SK.register({
    id: 'zzz', label: '絕區零風', group: '二次元手遊',
    top: zzzTop,
    nav: [
      { v: 'home', label: '探索', icon: 'zzz-tv' },
      { v: 'practice', label: '練習', icon: 'practice' },
      { v: 'exam', label: '模擬考', icon: 'exam', big: true },
      { v: 'review', label: '錯題', icon: 'review', badge: true },
      { v: 'stats', label: '統計', icon: 'stats' },
    ],
    views: { home: zzzHome, result: zzzResult },
    after: () => boot(),
  });
})();
