/* 崩壞：星穹鐵道風：深藍黑底、白色細線、金色重點、玻璃面板、斜體窄長標題。
 *   首頁＝「星圖航線」：主題是沿著彎曲軌道排列的站點，站點圓環＝已練比例；選站後「出發」練該主題
 *   闖關挑戰：3 層 × 5 題，耐久 3；每過一層三選一增益（延長時間／刪去一個錯誤選項／答錯不中斷），
 *   增益只改變下一層的作答條件；上方行動序條顯示接下來的題目；結束時總結，最佳層數存在 skinData.hsr
 * 作答一律以 QG.record 寫入學習紀錄。只借用版面、互動與配色；圖形全為原創，不使用角色、標誌或遊戲專有名詞。 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon, hue } = SK;
  const S = () => QG.S();
  const ID = 'hsr';

  SK.ICONS.hsTrack = SK.ICONS.hsTrack || '<path d="M3 18c4-9 14-3 18-12"/><circle cx="3" cy="18" r="1.6"/><circle cx="12" cy="11.5" r="1.6"/><circle cx="21" cy="6" r="1.6"/>';
  SK.ICONS.hsClock = SK.ICONS.hsClock || '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6M12 2v3"/>';
  SK.ICONS.hsCut = SK.ICONS.hsCut || '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9l8 6M16 9l-8 6"/>';
  SK.ICONS.hsShield = SK.ICONS.hsShield || '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-4.5"/>';
  SK.ICONS.hsDia = SK.ICONS.hsDia || '<path d="M12 3l7 9-7 9-7-9z"/>';

  const FLOORS = 3, PER = 5, HP = 3, BASE_SEC = 45, BONUS_SEC = 25;
  const BOONS = [
    { k: 'time', ico: 'hsClock', name: '延長時間', desc: `下一層每題作答時間 +${BONUS_SEC} 秒（${BASE_SEC} → ${BASE_SEC + BONUS_SEC} 秒）。` },
    { k: 'elim', ico: 'hsCut', name: '刪去一個錯誤選項', desc: '接下來 2 題各刪去 1 個錯誤選項。' },
    { k: 'guard', ico: 'hsShield', name: '答錯不中斷', desc: '下一層第 1 次答錯或逾時不扣耐久，挑戰不會因此中斷。' },
  ];

  /* ---------------------------------------------------------------- 資料 */
  function data() {
    const st = S().settings;
    if (!st.skinData) st.skinData = {};
    return st.skinData[ID] || (st.skinData[ID] = { best: 0, runs: 0 });
  }
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function stations() {
    return QG.TAGS.filter(([t]) => t !== '其他').map(([t]) => {
      const ids = QG.QS.filter((q) => q.t.includes(t)).map((q) => q.id);
      const p = SK.progressOf(ids);
      return { t, ids, p, cov: ids.length ? p.seen / ids.length : 0 };
    });
  }
  /** 旅程等級：每 25 次答對升 1 級 */
  function level() {
    const c = QG.totals().c;
    return { L: 1 + Math.floor(c / 25), into: c % 25, span: 25, c };
  }
  const topicOf = (q) => q.t.find((t) => t !== '其他') || '其他';

  /* ---------------------------------------------------------------- 頂部列 */
  const NAV = [
    { v: 'home', label: '星圖', icon: 'hsTrack' },
    { v: 'practice', label: '任務', icon: 'practice' },
    { v: 'review', label: '修復', icon: 'review', badge: true },
    { v: 'exam', label: '模擬考', icon: 'exam' },
    { v: 'browse', label: '資料庫', icon: 'browse' },
    { v: 'stats', label: '紀錄', icon: 'stats' },
  ];
  function hsTop(view) {
    const lv = level();
    const today = S().days[QG.dayKey()] || { n: 0 };
    return h('div', { class: 'sk-top hs-top' },
      SK.brand('QuizGrinder'),
      h('a', { class: 'hs-lv', href: '#stats', 'aria-label': `旅程等級 ${lv.L}` },
        h('span', { class: 'hs-lv-n' }, h('small', { text: 'LV' }), String(lv.L)),
        h('span', { class: 'hs-lv-bar' }, h('i', { style: `width:${Math.round((lv.into / lv.span) * 100)}%` }))),
      h('nav', { class: 'hs-nav', 'aria-label': '主要功能' }, NAV.map((n) => h('a', {
        href: '#' + n.v, 'aria-current': SK.isCurrent(view, n.v) ? 'page' : null,
      }, h('span', { text: n.label }), n.badge ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null))),
      h('span', { class: 'hs-res' },
        h('span', { class: 'hs-chip', title: '今日作答' }, icon('hsDia'), h('b', { text: QG.fmtNum(today.n) }), h('small', { text: '今日' })),
        h('span', { class: 'hs-chip', title: '連續天數' }, icon('flame'), h('b', { text: String(QG.streak()) }), h('small', { text: '連續' }))));
  }
  function refreshTop() {
    const top = document.getElementById('topbar');
    if (top && SK.skin() === ID) fill(top, hsTop(QG.currentView));
    QG.updateBadges();
  }

  /* ---------------------------------------------------------------- 星圖航線 */
  /** Catmull-Rom → 三次貝茲，畫出通過所有站點的平滑軌道 */
  function smooth(pts) {
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
    }
    return d;
  }
  function trackSvg(pts, cls, covIdx) {
    const span = document.createElement('span');
    span.className = 'hs-track ' + cls;
    span.setAttribute('aria-hidden', 'true');
    const d = smooth(pts);
    const done = covIdx > 0 ? smooth(pts.slice(0, covIdx + 1)) : '';
    span.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path class="rail" d="${d}"/><path class="line" d="${d}"/>${done ? `<path class="done" d="${done}"/>` : ''}</svg>`;
    return span;
  }

  let selStation = null;
  function stationPanel(s, i) {
    const pc = Math.floor(s.cov * 100);
    const unseen = s.ids.filter((id) => { const r = S().q[id]; return !r || !(r.c + r.w); });
    const wrong = s.ids.filter((id) => { const r = S().q[id]; return r && r.b; }).length;
    return h('section', { class: 'hs-glass hs-station', 'aria-live': 'polite' },
      h('p', { class: 'hs-mono', text: `STATION ${String(i + 1).padStart(2, '0')} / ${String(stations().length).padStart(2, '0')}` }),
      h('h2', { class: 'hs-it', text: s.t }),
      h('div', { class: 'hs-meters' },
        meter('已練比例', pc, `${s.p.seen} / ${s.ids.length}`),
        meter('正確率', s.p.n ? Math.round((s.p.c / s.p.n) * 100) : 0, s.p.n ? QG.pct(s.p.c, s.p.n) : '—')),
      h('p', { class: 'hs-sub', text: wrong ? `此站有 ${wrong} 題在錯題本中。` : '此站目前沒有錯題。' }),
      h('div', { class: 'hs-btns' },
        h('button', { type: 'button', class: 'hs-btn gold', onclick: () => QG.startCustomPractice(QG.buildQueue(s.ids, 'weak'), `出發：${s.t}`) }, icon('arrow'), '出發'),
        unseen.length ? h('button', { type: 'button', class: 'hs-btn', onclick: () => QG.startCustomPractice(unseen, `未到訪：${s.t}`) }, `只練未作答（${unseen.length}）`) : null));
  }
  function meter(label, p, text) {
    return h('div', { class: 'hs-meter' }, h('span', { class: 'hs-mono', text: label }), h('b', { text }),
      h('span', { class: 'hs-mbar' }, h('i', { style: `width:${p}%` })));
  }

  function starMap(list, onPick) {
    const n = list.length;
    const wide = list.map((_, i) => [3 + (94 * i) / (n - 1), 50 + 30 * Math.sin(i * 0.78 + 0.4)]);
    const tall = list.map((_, i) => [50 + 30 * Math.sin(i * 0.9 + 0.3), 3 + (94 * i) / (n - 1)]);
    let lastSeen = -1;
    list.forEach((s, i) => { if (s.p.seen) lastSeen = i; });
    const seenAll = list.filter((s) => s.p.seen).length;
    return h('section', { class: 'hs-glass hs-mapwrap', 'aria-label': '星圖航線：每個站點是一個主題' },
      h('header', { class: 'hs-head' },
        h('span', { class: 'hs-mono', text: 'ROUTE MAP' }),
        h('h1', { class: 'hs-it', text: '星圖航線' }),
        h('span', { class: 'hs-head-r' }, h('b', { text: `${seenAll}` }), ` / ${n} 站已到訪`)),
      h('div', { class: 'hs-map' },
        trackSvg(wide, 'w', lastSeen), trackSvg(tall, 't', lastSeen),
        list.map((s, i) => h('button', {
          type: 'button', class: 'hs-node' + (s.p.seen ? ' seen' : '') + (selStation === s.t ? ' sel' : '') + (i % 2 ? ' dn' : ' up') + (tall[i][0] > 50 ? ' lft' : ' rgt'),
          style: `--x:${wide[i][0].toFixed(2)}%;--y:${wide[i][1].toFixed(2)}%;--vx:${tall[i][0].toFixed(2)}%;--vy:${tall[i][1].toFixed(2)}%;--p:${Math.floor(s.cov * 100)};--h:${hue(s.t)}`,
          'aria-pressed': selStation === s.t ? 'true' : 'false', 'aria-label': `${s.t}，已練 ${Math.floor(s.cov * 100)}%`, dataset: { t: s.t },
          onclick: () => onPick(s, i),
        }, h('span', { class: 'hs-dot' }), h('span', { class: 'hs-lab' }, h('b', { text: s.t }), h('small', { text: Math.floor(s.cov * 100) + '%' }))))));
  }

  function challengeCard() {
    const d = data();
    return h('section', { class: 'hs-glass hs-chal' },
      h('span', { class: 'hs-mono', text: 'CHALLENGE' }),
      h('h2', { class: 'hs-it big', text: '闖關挑戰' }),
      h('ul', { class: 'hs-rules' },
        h('li', null, h('b', { text: `${FLOORS} 層 × ${PER} 題` }), '・題目依練習範圍挑選，弱點優先'),
        h('li', null, h('b', { text: `耐久 ${HP}` }), `・答錯或逾時扣 1，歸零即中斷；每題限時 ${BASE_SEC} 秒`),
        h('li', null, h('b', { text: '三選一增益' }), '・每過一層選一個，只影響下一層')),
      h('div', { class: 'hs-best' },
        h('span', null, h('small', { class: 'hs-mono', text: 'BEST' }), h('b', { text: d.best ? `第 ${d.best} 層` : '—' })),
        h('span', null, h('small', { class: 'hs-mono', text: 'RUNS' }), h('b', { text: String(d.runs || 0) })),
        d.bestAcc != null ? h('span', null, h('small', { class: 'hs-mono', text: 'BEST ACC' }), h('b', { text: d.bestAcc + '%' })) : null),
      h('button', { type: 'button', class: 'hs-btn gold big', onclick: startRun }, icon('arrow'), '開始挑戰'));
  }

  /* ---------------------------------------------------------------- 闖關挑戰 */
  let run = null;
  let timer = null;
  let runEl = null;

  function startRun() {
    const pool = QG.filterQuestions(S().settings.filters).filter((q) => !q.prev).map((q) => q.id);
    const all = pool.length >= FLOORS * PER ? pool : QG.QS.filter((q) => !q.prev).map((q) => q.id);
    const ids = QG.buildQueue(all, 'weak').slice(0, FLOORS * PER);
    run = { ids, floor: 0, qi: 0, hp: HP, shield: 0, elim: 0, bonus: 0, boons: [], log: [], phase: 'q', cur: null };
    newQuestion();
    QG.render();
    window.scrollTo(0, 0);
  }
  const curId = () => run.ids[run.floor * PER + run.qi];

  function newQuestion() {
    const q = QG.QMAP.get(curId());
    let hidden = [];
    if (run.elim > 0) {
      const wrong = q.all ? [] : QG.LETTERS.filter((L) => !q.a.includes(L));
      if (wrong.length > 1) hidden = [wrong[(run.floor * 7 + run.qi * 3) % wrong.length]];
      run.elim--;
    }
    const sec = BASE_SEC + run.bonus;
    run.cur = { chosen: null, hidden, sec, remain: sec * 1000, deadline: Date.now() + sec * 1000, note: '' };
  }

  function answer(L) {
    const c = run.cur;
    if (!c || c.chosen) return;
    const q = QG.QMAP.get(curId());
    const ok = L !== 'timeout' && (q.all || q.a.includes(L));
    c.chosen = L;
    clearInterval(timer);
    QG.record(q.id, ok);
    QG.Store.save();
    if (!ok) {
      if (run.shield > 0) { run.shield--; c.note = '答錯不中斷：本次失誤不扣耐久。'; }
      else { run.hp--; c.note = run.hp > 0 ? `耐久 -1，剩餘 ${run.hp}。` : '耐久歸零，挑戰中斷。'; }
    } else c.note = '';
    run.log.push({ id: q.id, ok, floor: run.floor });
    refreshTop();
    drawRun();
  }

  function proceed() {
    if (run.hp <= 0) return finish();
    run.qi++;
    if (run.qi >= PER) {
      if (run.floor >= FLOORS - 1) return finish();
      run.phase = 'boon';
      run.cur = null;
      return drawRun();
    }
    newQuestion();
    drawRun();
  }

  function chooseBoon(b) {
    run.floor++;
    run.qi = 0;
    run.bonus = 0;
    run.shield = 0;
    if (b.k === 'time') run.bonus = BONUS_SEC;
    if (b.k === 'elim') run.elim += 2;
    if (b.k === 'guard') run.shield = 1;
    run.boons.push(b.name);
    run.phase = 'q';
    newQuestion();
    drawRun();
  }

  function finish() {
    clearInterval(timer);
    const cleared = run.hp > 0 ? FLOORS : run.floor;
    const c = run.log.filter((x) => x.ok).length;
    const acc = run.log.length ? Math.round((c / run.log.length) * 100) : 0;
    const d = data();
    run.result = { cleared, c, n: run.log.length, acc, newBest: cleared > (d.best || 0) };
    d.best = Math.max(d.best || 0, cleared);
    d.runs = (d.runs || 0) + 1;
    if (cleared === FLOORS) d.bestAcc = Math.max(d.bestAcc || 0, acc);
    d.last = { ts: Date.now(), cleared, c, n: run.log.length };
    QG.Store.save();
    run.phase = 'end';
    run.cur = null;
    drawRun();
  }

  function tick() {
    if (!run || !run.cur || run.cur.chosen) { clearInterval(timer); return; }
    const bar = runEl && runEl.querySelector('.hs-timer');
    if (!runEl || !runEl.isConnected || !bar) { // 離開畫面時暫停計時
      run.cur.remain = Math.max(0, run.cur.deadline - Date.now());
      run.cur.paused = true;
      clearInterval(timer);
      return;
    }
    const left = Math.max(0, run.cur.deadline - Date.now());
    bar.style.setProperty('--t', (left / (run.cur.sec * 1000)).toFixed(4));
    const num = runEl.querySelector('.hs-timer-n');
    if (num) num.textContent = Math.ceil(left / 1000) + 's';
    bar.classList.toggle('low', left < 10000);
    if (left <= 0) answer('timeout');
  }

  function turnOrder() {
    const start = run.floor * PER + run.qi;
    const upto = Math.min(run.ids.length, start + 8);
    const active = run.phase === 'q';
    const curFloor = Math.floor(start / PER);
    const items = [];
    for (let k = start; k < upto; k++) {
      const q = QG.QMAP.get(run.ids[k]);
      const t = topicOf(q);
      const fl = Math.floor(k / PER);
      const now = active && k === start;
      items.push(h('li', { class: 'hs-tok' + (now ? ' now' : '') + (fl !== curFloor ? ' next' : ''), style: `--h:${hue(t)}` },
        h('span', { class: 'hs-tok-n', text: `Q${k + 1}` }), h('span', { class: 'hs-tok-t', text: t }),
        now ? h('span', { class: 'hs-tok-now', text: '行動中' }) : k % PER === 0 ? h('span', { class: 'hs-tok-now', text: `第 ${fl + 1} 層` }) : null));
    }
    return h('ol', { class: 'hs-order', 'aria-label': '行動序：接下來的題目' }, items);
  }

  function runHud() {
    return h('div', { class: 'hs-hud' },
      h('div', { class: 'hs-floor' }, h('span', { class: 'hs-mono', text: 'FLOOR' }), h('b', { class: 'hs-it', text: `${run.floor + 1}` }), h('small', { text: `/ ${FLOORS}` })),
      h('div', { class: 'hs-hp', 'aria-label': `耐久 ${run.hp} / ${HP}` }, h('span', { class: 'hs-mono', text: '耐久' }),
        Array.from({ length: HP }, (_, i) => h('i', { class: i < run.hp ? 'on' : '' }))),
      h('div', { class: 'hs-buffs' },
        run.bonus ? h('span', { class: 'hs-buff' }, icon('hsClock'), `+${run.bonus} 秒`) : null,
        run.elim > 0 || (run.cur && run.cur.hidden.length) ? h('span', { class: 'hs-buff' }, icon('hsCut'), `刪去選項・剩 ${run.elim + (run.cur && run.cur.hidden.length && !run.cur.chosen ? 1 : 0)} 題`) : null,
        run.shield ? h('span', { class: 'hs-buff' }, icon('hsShield'), '答錯不中斷') : null),
      h('button', { type: 'button', class: 'hs-btn ghost small', onclick: () => { clearInterval(timer); run = null; QG.render(); } }, '放棄挑戰'));
  }

  function questionPanel() {
    const q = QG.QMAP.get(curId());
    const c = run.cur;
    const reveal = !!c.chosen;
    const opts = QG.LETTERS.map((L, i) => {
      const gone = c.hidden.includes(L);
      const correct = q.all || q.a.includes(L);
      let cls = 'hs-opt';
      if (gone) cls += ' gone';
      if (reveal) cls += correct ? ' ok' : c.chosen === L ? ' ng' : ' dim';
      return h('button', { type: 'button', class: cls, disabled: reveal || gone ? true : null, onclick: () => answer(L), 'aria-label': gone ? `${L} 已刪去` : null },
        h('span', { class: 'hs-opt-k', text: String(i + 1) }), h('span', { class: 'hs-opt-t', text: q.o[L] }),
        gone ? h('span', { class: 'hs-opt-m', text: '已刪去' }) : reveal && correct ? h('span', { class: 'hs-opt-m', text: '正解' }) : null);
    });
    const left = c.paused ? c.remain : Math.max(0, c.deadline - Date.now());
    return h('section', { class: 'hs-glass hs-qpanel' },
      h('div', { class: 'hs-timer' + (reveal ? ' stop' : ''), style: `--t:${(left / (c.sec * 1000)).toFixed(4)}`, role: 'timer', 'aria-label': '剩餘時間' },
        h('i'), h('span', { class: 'hs-timer-n', text: reveal ? (c.chosen === 'timeout' ? '逾時' : '—') : Math.ceil(left / 1000) + 's' })),
      h('p', { class: 'hs-mono hs-qsrc', text: `${topicOf(q)}・${q.src.map(QG.srcLabel).join('・')}` }),
      h('p', { class: 'hs-qtext', text: q.q }),
      q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖', loading: 'lazy' })) : null,
      h('div', { class: 'hs-opts', role: 'group', 'aria-label': '選項' }, opts),
      reveal ? h('div', { class: 'hs-fb ' + (run.log[run.log.length - 1].ok ? 'ok' : 'ng'), role: 'status' },
        h('b', { text: c.chosen === 'timeout' ? '逾時未作答' : run.log[run.log.length - 1].ok ? '答對了' : `答錯了・正解 ${q.all ? '全部給分' : q.a.join('、')}` }),
        c.note ? h('span', { text: c.note }) : null,
        q.x ? h('p', { class: 'hs-x', text: q.x }) : null,
        h('button', { type: 'button', class: 'hs-btn gold', id: 'hs-next', onclick: proceed },
          run.hp <= 0 ? '查看結算' : run.qi + 1 >= PER ? (run.floor + 1 >= FLOORS ? '完成挑戰' : '本層完成') : '繼續', icon('arrow'))) : null);
  }

  function boonPanel() {
    return h('section', { class: 'hs-boons' },
      h('p', { class: 'hs-mono', text: `FLOOR ${run.floor + 1} CLEAR` }),
      h('h2', { class: 'hs-it big', text: `第 ${run.floor + 1} 層通過・選擇一個增益` }),
      h('p', { class: 'hs-sub', text: `本層 ${run.log.filter((x) => x.floor === run.floor && x.ok).length} / ${PER} 題答對，耐久剩 ${run.hp}。增益只作用於第 ${run.floor + 2} 層。` }),
      h('div', { class: 'hs-boon-row' }, BOONS.map((b, i) => h('button', { type: 'button', class: 'hs-boon', onclick: () => chooseBoon(b) },
        h('span', { class: 'hs-boon-ico' }, icon(b.ico)), h('span', { class: 'hs-mono', text: `0${i + 1}` }),
        h('b', { class: 'hs-it', text: b.name }), h('span', { class: 'hs-boon-d', text: b.desc })))));
  }

  function endPanel() {
    const r = run.result;
    const wrong = run.log.filter((x) => !x.ok).map((x) => x.id);
    return h('section', { class: 'hs-glass hs-end' },
      h('p', { class: 'hs-mono', text: r.cleared === FLOORS ? 'ALL FLOORS CLEAR' : 'RUN INTERRUPTED' }),
      h('h2', { class: 'hs-it big', text: r.cleared === FLOORS ? '挑戰完成' : '挑戰中斷' }),
      h('div', { class: 'hs-endstats' },
        [[`${r.cleared} / ${FLOORS}`, '通過層數'], [`${r.c} / ${r.n}`, '答對題數'], [r.acc + '%', '正確率'], [`第 ${data().best} 層`, '最佳紀錄']]
          .map(([v, l]) => h('div', null, h('b', { text: v }), h('span', { text: l })))),
      r.newBest ? h('p', { class: 'hs-newbest', text: '刷新最佳紀錄' }) : null,
      run.boons.length ? h('p', { class: 'hs-sub', text: '取得增益：' + run.boons.join('、') }) : null,
      h('ol', { class: 'hs-endlog' }, run.log.map((x, i) => h('li', { class: x.ok ? 'ok' : 'ng', title: QG.QMAP.get(x.id).q }, h('span', { text: `Q${i + 1}` }), h('b', { text: x.ok ? '✓' : '✗' })))),
      h('div', { class: 'hs-btns' },
        h('button', { type: 'button', class: 'hs-btn gold', onclick: startRun }, icon('review'), '再次挑戰'),
        wrong.length ? h('button', { type: 'button', class: 'hs-btn', onclick: () => { const ids = wrong; run = null; QG.startCustomPractice(ids, '挑戰複盤'); } }, `複習本次答錯（${wrong.length}）`) : null,
        h('button', { type: 'button', class: 'hs-btn ghost', onclick: () => { run = null; QG.render(); } }, '返回星圖')));
  }

  let lastKey = '';
  function drawRun() {
    if (!runEl) return;
    QG.setKeys(null);
    const key = run.phase + ':' + run.floor + ':' + run.qi;
    runEl.classList.toggle('anim', key !== lastKey && !reduced());
    lastKey = key;
    if (run.phase === 'q') {
      if (run.cur.paused) { run.cur.deadline = Date.now() + run.cur.remain; run.cur.paused = false; }
      fill(runEl, runHud(), turnOrder(), questionPanel());
      clearInterval(timer);
      if (!run.cur.chosen) timer = setInterval(tick, 200);
      QG.setKeys((e) => {
        if (!run || run.phase !== 'q') return false;
        if (!run.cur.chosen) {
          const i = '1234'.indexOf(e.key);
          if (i >= 0 && !run.cur.hidden.includes(QG.LETTERS[i])) { answer(QG.LETTERS[i]); return true; }
        } else if (e.key === 'Enter' || e.key === 'ArrowRight') { proceed(); return true; }
        return false;
      });
      const nb = runEl.querySelector('#hs-next');
      if (nb) nb.focus({ preventScroll: true });
    } else if (run.phase === 'boon') {
      fill(runEl, runHud(), turnOrder(), boonPanel());
      const b = runEl.querySelector('.hs-boon'); if (b) b.focus({ preventScroll: true });
      QG.setKeys((e) => { const i = '123'.indexOf(e.key); if (i >= 0 && run && run.phase === 'boon') { chooseBoon(BOONS[i]); return true; } return false; });
    } else {
      fill(runEl, endPanel());
    }
  }

  /* ---------------------------------------------------------------- 首頁 */
  function hsHome() {
    if (run) {
      runEl = h('div', { class: 'hs-run' });
      lastKey = '';
      drawRun();
      return h('div', { class: 'hs-home run' }, runEl);
    }
    runEl = null;
    const list = stations();
    if (!selStation || !list.some((s) => s.t === selStation)) selStation = (list.find((s) => !s.p.seen) || list[0]).t;
    const idx = list.findIndex((s) => s.t === selStation);
    const box = h('div', { class: 'hs-stbox' }, stationPanel(list[idx], idx));
    const map = starMap(list, (s, i) => {
      selStation = s.t;
      map.querySelectorAll('.hs-node').forEach((b) => { const on = b.dataset.t === s.t; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      fill(box, stationPanel(s, i));
      if (matchMedia('(max-width: 720px)').matches) box.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    });
    return h('div', { class: 'hs-home' }, challengeCard(), map, box);
  }

  function hsStats(base) {
    const el = base.stats();
    const d = data();
    const lv = level();
    const list = stations();
    el.prepend(h('section', { class: 'hs-glass hs-log' },
      h('span', { class: 'hs-mono', text: 'JOURNEY LOG' }),
      h('h2', { class: 'hs-it', text: '旅程紀錄' }),
      h('div', { class: 'hs-endstats' },
        [[`LV ${lv.L}`, '旅程等級'], [`${list.filter((s) => s.p.seen).length} / ${list.length}`, '已到訪站點'],
          [d.best ? `第 ${d.best} 層` : '—', '挑戰最佳'], [String(d.runs || 0), '挑戰次數']]
          .map(([v, l]) => h('div', null, h('b', { text: v }), h('span', { text: l }))))));
    return el;
  }

  /* ---------------------------------------------------------------- 結算（模擬考結果） */
  function hsResult(base) {
    const el = base.result();
    const r = S().lastResult;
    if (!r) return el;
    const grade = r.score >= 90 ? 'S' : r.score >= 75 ? 'A' : r.score >= 60 ? 'B' : 'C';
    el.prepend(h('section', { class: 'hs-glass hs-result' },
      h('span', { class: 'hs-mono', text: 'RESULT' }),
      h('div', { class: 'hs-result-row' },
        h('b', { class: 'hs-grade hs-it', text: grade, 'aria-label': `評等 ${grade}` }),
        h('div', null, h('p', { class: 'hs-it big', text: r.score >= 60 ? '模擬考通過' : '模擬考未達標' }),
          h('p', { class: 'hs-sub', text: `${r.score} 分・答對 ${r.correct} / ${r.total}・評等 S≥90、A≥75、B≥60` })))));
    return el;
  }

  /* ---------------------------------------------------------------- 進場與換頁轉場 */
  // 進場（載入）動畫：每個分頁工作階段第一次以本風格載入時播放一次
  const ENTRY_KEY = 'qg-entry-' + ID;
  let entryPending = (() => { try { return !sessionStorage.getItem(ENTRY_KEY); } catch (e) { return true; } })();
  let firstRender = true; // 頁面剛載入的第一次繪製不做換頁動畫
  let switched = false; // 從切換列換到本風格時只做換頁動畫（完整進場動畫留給頁面載入）
  document.addEventListener('change', (e) => { if (e.target && e.target.id === 'sk-select') switched = true; }, true);
  document.addEventListener('click', (e) => { if (e.target && e.target.closest && e.target.closest('.sk-bar-step')) switched = true; }, true);
  function drillHud(view) {
    const lv = level();
    const d = S().days[QG.dayKey()] || { n: 0, c: 0 };
    return h('div', { class: 'hs-drillhud', 'aria-hidden': 'true' },
      h('span', { class: 'hs-mono', text: view === 'review' ? 'REPAIR' : 'MISSION' }),
      h('b', { class: 'hs-it', text: view === 'review' ? '修復' : '任務進行中' }),
      h('span', { class: 'hs-dh-r' }, h('span', { text: `LV ${lv.L}` }), h('span', { text: `今日 ${d.c}/${d.n}` })));
  }
  function hsAfter(view, changed) {
    const page = document.getElementById('app').firstElementChild;
    if ((view === 'practice' || view === 'review') && page && page.querySelector('.qhead')) document.getElementById('app').prepend(drillHud(view));
    if (reduced()) { entryPending = false; firstRender = false; switched = false; return; }
    if (switched) entryPending = false;
    if (page && ((changed && !firstRender) || switched)) page.classList.add('hs-scene');
    firstRender = false;
    switched = false;
    if (entryPending) {
      entryPending = false;
      try { sessionStorage.setItem(ENTRY_KEY, '1'); } catch (e) { /* 無法使用 sessionStorage 時每次載入都播放 */ }
      const o = h('div', { class: 'hs-entry', 'aria-hidden': 'true' }, h('span', { class: 'hs-entry-line' }), h('span', { class: 'hs-entry-txt', text: 'NEXT STATION' }));
      document.body.append(o);
      setTimeout(() => o.remove(), 1100);
    }
  }

  SK.register({
    id: ID, label: '崩壞：星穹鐵道風', group: '二次元手遊',
    top: hsTop, nav: NAV.filter((n) => n.v !== 'browse'),
    views: { home: hsHome, stats: hsStats, result: hsResult },
    after: hsAfter,
  });
})();
