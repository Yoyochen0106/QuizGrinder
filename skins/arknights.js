/* QuizGrinder 版面風格：明日方舟風（冷色工業科技戰術介面）
 *
 * 借用：深灰石板底＋白／黃／青色點綴、細技術線、斜切角面板、自創英數代碼標籤、等寬數字；
 *       首頁是「作戰終端」：大「作戰」入口（模擬考）、每科一張節點連線的關卡地圖（關卡＝主題，
 *       節點狀態依熟練度）、「基地」產能面板（各主題的已練比例與正確率畫成生產條）。
 * 不借用：任何角色、標誌、遊戲專有名詞、體力制度。每日只顯示「今日建議量」作答數／20 的提醒。
 * 所有數字都由學習紀錄算出；作答頁只換成「戰術簡報」外觀。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon } = SK;
  const S = () => QG.S();
  const GOAL = 20;
  const pad2 = (n) => String(n).padStart(2, '0');

  Object.assign(SK.ICONS, {
    'arknights-op': '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    'arknights-node': '<path d="M12 3l9 9-9 9-9-9z"/><path d="M12 8l4 4-4 4-4-4z"/>',
    'arknights-base': '<path d="M3 21V9l5-3v4l5-3v4l5-3v13z"/><path d="M7 17h2M12 17h2M17 17h1"/>',
    'arknights-file': '<path d="M4 4h10l6 6v10H4z"/><path d="M14 4v6h6M8 14h8M8 17h5"/>',
    'arknights-drill': '<path d="M4 4h16v16H4z"/><path d="M4 9h16M9 9v11"/>',
  });

  /* ---------------------------------------------------------------- 資料 */

  const subjOf = () => {
    const sd = S().settings.skinData;
    return (sd && sd.arknights && sd.arknights.subj) || 'process';
  };
  function saveSubj(s) {
    const st = S().settings;
    if (!st.skinData || typeof st.skinData !== 'object') st.skinData = {};
    st.skinData.arknights = Object.assign({}, st.skinData.arknights, { subj: s });
    QG.Store.save();
  }

  /** 每個主題（只算官方題）的進度；subj 給定時只算該科 */
  function stages(subj) {
    const off = QG.QS.filter((q) => q.official && (!subj || q.s === subj));
    const st = S().q;
    const today = QG.dayKey();
    return QG.TAGS.filter(([t]) => t !== '其他').map(([t]) => {
      const ids = off.filter((q) => q.t.includes(t)).map((q) => q.id);
      if (!ids.length) return null;
      const p = SK.progressOf(ids);
      let wrong = 0, todayN = 0;
      for (const id of ids) {
        const r = st[id];
        if (!r) continue;
        if (r.b > 0) wrong++;
        if (r.t && QG.dayKey(new Date(r.t)) === today) todayN++;
      }
      const cov = p.seen / ids.length;
      const acc = p.n ? p.c / p.n : 0;
      const state = !p.seen ? 'new' : cov >= 0.9 && acc >= 0.85 ? 'elite' : cov >= 0.5 && acc >= 0.7 ? 'clear' : 'run';
      return { t, ids, seen: p.seen, c: p.c, n: p.n, cov, acc, wrong, todayN, state };
    }).filter(Boolean);
  }
  const STATE_LABEL = { new: '未偵察', run: '作戰中', clear: '已攻克', elite: '精通' };

  const ui = { sel: null };

  /* ---------------------------------------------------------------- 頂部列 */

  function today() { return S().days[QG.dayKey()] || { n: 0, c: 0 }; }

  function akTop(view) {
    const d = today();
    const due = QG.dueReviewIds().length;
    return h('div', { class: 'sk-top arknights-top' },
      h('a', { class: 'arknights-brand', href: '#home', 'aria-label': 'QuizGrinder 作戰終端' },
        icon('pad', 'arknights-brand-ico'),
        h('span', { class: 'arknights-brand-txt' }, h('b', { text: 'QUIZGRINDER' }), h('small', { text: 'QG-TERMINAL // IPAS-PCB' }))),
      h('span', { class: 'arknights-top-code', 'aria-hidden': 'true', text: `SYS.${view.toUpperCase()}` }),
      h('div', { class: 'arknights-hud' },
        h('a', { class: 'arknights-hud-item arknights-quota', href: '#practice', title: '今日建議量（作答題數／20，只是提醒，不限制使用）' },
          h('span', { class: 'arknights-hud-k', text: '今日建議量' }),
          h('span', { class: 'arknights-hud-v' }, h('b', { text: String(Math.min(d.n, 999)) }), `/${GOAL}`),
          h('span', { class: 'arknights-hud-bar', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.min(100, (d.n / GOAL) * 100)}%` }))),
        h('a', { class: 'arknights-hud-item arknights-hide-sm', href: '#stats', title: '連續天數' },
          h('span', { class: 'arknights-hud-k', text: '連續' }), h('span', { class: 'arknights-hud-v' }, h('b', { text: String(QG.streak()) }), 'D')),
        h('a', { class: 'arknights-hud-item', href: '#review', title: '到期錯題' },
          h('span', { class: 'arknights-hud-k', text: '待整備' }), h('span', { class: 'arknights-hud-v' }, h('b', { text: String(due) })))));
  }

  /* ---------------------------------------------------------------- 首頁：作戰終端 */

  function menu() {
    const st = S();
    const p = st.practice;
    const due = QG.dueReviewIds().length;
    const t = QG.totals();
    const resume = p && p.idx < p.queue.length ? `${p.label}・${p.idx + 1}/${p.queue.length}` : '依練習範圍出題';
    const best = st.exams.reduce((a, e) => Math.max(a, e.score), 0);
    const tile = (href, ic, zh, code, sub, cls) => h('a', { class: 'arknights-tile ' + (cls || ''), href },
      h('span', { class: 'arknights-tile-code', text: code }), icon(ic, 'arknights-tile-ico'),
      h('b', { class: 'arknights-tile-zh', text: zh }), h('span', { class: 'arknights-tile-sub', text: sub }));
    return h('nav', { class: 'arknights-menu', 'aria-label': '作戰終端選單' },
      h('a', { class: 'arknights-op', href: '#exam' },
        h('span', { class: 'arknights-op-code', text: 'QG-EX/OPS · MOCK EXAMINATION' }),
        h('span', { class: 'arknights-op-main' }, h('b', { text: '作戰' }), h('span', { class: 'arknights-op-en', text: 'START' })),
        h('span', { class: 'arknights-op-sub', text: st.examRun ? '繼續進行中的模擬考' : `模擬考 ${QG.EXAM_LEN} 題・${QG.EXAM_MIN} 分鐘` }),
        h('span', { class: 'arknights-op-rec' }, h('span', { text: '最佳紀錄' }), h('b', { text: st.exams.length ? `${best}` : '—' }), h('span', { text: `出擊 ${st.exams.length} 次` })),
        h('span', { class: 'arknights-op-arrow', 'aria-hidden': 'true' }),
        h('span', { class: 'arknights-op-barcode', 'aria-hidden': 'true' }),
        h('span', { class: 'arknights-op-num', 'aria-hidden': 'true', text: '01' })),
      h('div', { class: 'arknights-tiles' },
        tile('#practice', 'arknights-drill', '演習', 'DRL-01', resume),
        tile('#review', 'review', '整備', 'RPR-02', due ? `${due} 題錯題到期` : '無到期錯題', due ? 'alert' : ''),
        tile('#browse', 'arknights-file', '資料庫', 'DB-03', `${QG.fmtNum(QG.QS.length)} 筆題目`),
        tile('#stats', 'stats', '作戰紀錄', 'LOG-04', `正確率 ${QG.pct(t.c, t.n)}`)));
  }

  function quota() {
    const d = today();
    const segs = [];
    for (let i = 0; i < GOAL; i++) segs.push(h('i', { class: i < d.n ? 'on' : null }));
    return h('section', { class: 'arknights-panel arknights-quota-panel', 'aria-label': `今日建議量 ${d.n} / ${GOAL} 題` },
      h('div', { class: 'arknights-ph' }, h('span', { class: 'arknights-code', text: 'DLY/QUOTA' }), h('h2', { text: '今日建議量' }),
        h('span', { class: 'arknights-ph-r mono', text: `${Math.min(d.n, 999)} / ${GOAL}` })),
      h('div', { class: 'arknights-segs', 'aria-hidden': 'true' }, segs),
      h('p', { class: 'arknights-note', text: d.n >= GOAL ? `今日已達建議量，答對 ${d.c} 題。想多練也沒問題。` : `再作答 ${GOAL - d.n} 題達成今日建議量（只是提醒，不會限制練習）。` }));
  }

  function stageMap() {
    const subj = subjOf();
    const list = stages(subj);
    const code = QG.SUBJ_CODE[subj];
    if (!ui.sel || !list.some((s) => s.t === ui.sel)) {
      const next = list.find((s) => s.state === 'run') || list.find((s) => s.state === 'new') || list[0];
      ui.sel = next && next.t;
    }
    const COLW = 172, ROWS = [96, 22, 170, 96, 170, 22], NW = 136, NH = 52;
    const W = list.length * COLW + 32, H = 236;
    const pos = list.map((s, i) => ({ x: 24 + i * COLW, y: ROWS[i % ROWS.length] }));
    let lines = '';
    for (let i = 0; i < list.length - 1; i++) {
      const a = pos[i], b = pos[i + 1];
      const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2, mx = Math.round((x1 + x2) / 2);
      const on = list[i].state === 'clear' || list[i].state === 'elite';
      lines += `<path class="${on ? 'on' : ''}" d="M${x1} ${y1}H${mx}V${y2}H${x2}"/><rect class="arknights-joint" x="${mx - 3}" y="${y1 - 3}" width="6" height="6"/>`;
    }
    const svgWrap = h('span', { class: 'arknights-lines', 'aria-hidden': 'true' });
    svgWrap.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><g>${lines}</g></svg>`;
    const scroller = h('div', { class: 'arknights-map-scroll', tabindex: '0', 'aria-label': '關卡地圖（可左右捲動）' },
      h('div', { class: 'arknights-map', style: `width:${W}px;height:${H}px` }, svgWrap,
        list.map((s, i) => h('button', { type: 'button', class: `arknights-node ${s.state}${ui.sel === s.t ? ' sel' : ''}`,
          style: `left:${pos[i].x}px;top:${pos[i].y}px`, 'aria-pressed': ui.sel === s.t ? 'true' : 'false',
          'aria-label': `${code}-${pad2(i + 1)} ${s.t}，${STATE_LABEL[s.state]}，已練 ${Math.round(s.cov * 100)}%`,
          onclick: () => { ui.sel = s.t; redrawMap(); } },
          h('span', { class: 'arknights-node-code' }, icon('arknights-node'), `${code}-${pad2(i + 1)}`),
          h('span', { class: 'arknights-node-name', text: s.t }),
          h('span', { class: 'arknights-node-bar' }, h('i', { style: `width:${Math.round(s.cov * 100)}%` }))))));
    const i = list.findIndex((s) => s.t === ui.sel);
    const s = list[i];
    requestAnimationFrame(() => {
      if (!scroller.isConnected || i < 0) return;
      const target = pos[i].x - Math.max(24, (scroller.clientWidth - NW) / 2);
      scroller.scrollLeft = Math.max(0, target);
    });
    const seg = h('div', { class: 'arknights-seg', role: 'group', 'aria-label': '科目' },
      ['industry', 'process'].map((k) => h('button', { type: 'button', 'aria-pressed': k === subj ? 'true' : 'false',
        onclick: () => { saveSubj(k); ui.sel = null; redrawMap(); } },
        h('span', { class: 'mono', text: QG.SUBJ_CODE[k] }), QG.SUBJ_SHORT[k])));
    const cleared = list.filter((x) => x.state === 'clear' || x.state === 'elite').length;
    return h('section', { class: 'arknights-panel arknights-mapwrap', id: 'arknights-map' },
      h('div', { class: 'arknights-ph' }, h('span', { class: 'arknights-code', text: `QG-${code}/MAP` }), h('h2', { text: '作戰地圖' }),
        h('span', { class: 'arknights-ph-r mono', text: `攻克 ${cleared}/${list.length}` }), seg),
      scroller,
      h('div', { class: 'arknights-legend', 'aria-hidden': 'true' },
        ['new', 'run', 'clear', 'elite'].map((k) => h('span', { class: 'arknights-lg ' + k }, h('i'), STATE_LABEL[k])),
        h('span', { class: 'arknights-lg-note', text: '攻克＝已練 ≥50% 且正確率 ≥70%；精通＝已練 ≥90% 且正確率 ≥85%' })),
      s ? briefing(s, `${code}-${pad2(i + 1)}`) : null);
  }

  function redrawMap() {
    const old = document.getElementById('arknights-map');
    if (old) old.replaceWith(stageMap());
    const n = document.querySelector('#arknights-map .arknights-node.sel');
    if (n) n.focus({ preventScroll: true });
  }

  function briefing(s, code) {
    const up = QG.buildQueue(s.ids, 'weak').slice(0, 10);
    const stat = (k, v, unit) => h('div', { class: 'arknights-stat' }, h('span', { text: k }), h('b', { class: 'mono' }, v, unit ? h('small', { text: unit }) : null));
    return h('div', { class: 'arknights-brief-panel ' + s.state },
      h('div', { class: 'arknights-brief-head' },
        h('span', { class: 'arknights-brief-code mono', text: code }),
        h('h3', { text: s.t }),
        h('span', { class: 'arknights-badge ' + s.state, text: STATE_LABEL[s.state] })),
      h('div', { class: 'arknights-stats' },
        stat('題數', String(s.ids.length)),
        stat('已偵察', String(Math.round(s.cov * 100)), '%'),
        stat('正確率', s.n ? String(Math.round(s.acc * 100)) : '—', s.n ? '%' : ''),
        stat('錯題本', String(s.wrong))),
      h('div', { class: 'arknights-brief-btns' },
        h('button', { type: 'button', class: 'arknights-btn primary', onclick: () => QG.startCustomPractice(up, `作戰 ${code}：${s.t}`) },
          h('span', { class: 'arknights-btn-en', text: 'START' }), '開始行動（10 題・弱點優先）'),
        h('button', { type: 'button', class: 'arknights-btn', onclick: () => QG.startCustomPractice(s.ids, `全面演習 ${code}：${s.t}`) },
          `全題演習 ${s.ids.length} 題`)));
  }

  function base() {
    const list = stages(null);
    const totalC = list.reduce((a, s) => a + s.c, 0);
    const running = list.filter((s) => s.todayN > 0).length;
    return h('section', { class: 'arknights-panel arknights-base' },
      h('div', { class: 'arknights-ph' }, h('span', { class: 'arknights-code', text: 'QG-BASE/PRD' }), h('h2', { text: '基地' }),
        h('span', { class: 'arknights-ph-r mono', text: `運轉 ${running}/${list.length}・總產出 ${QG.fmtNum(totalC)}` })),
      h('p', { class: 'arknights-note', text: '每座設施對應一個主題：進度條＝已練比例，效率＝正確率，產出＝累計答對次數，「今日作業」＝今天練過的題數。' }),
      h('div', { class: 'arknights-facs' }, list.map((s, i) => h('button', { type: 'button', class: 'arknights-fac' + (s.todayN ? ' live' : ''),
        onclick: () => QG.startCustomPractice(QG.buildQueue(s.ids, 'weak').slice(0, 10), `基地作業：${s.t}`),
        'aria-label': `${s.t}：已練 ${Math.round(s.cov * 100)}%，正確率 ${s.n ? Math.round(s.acc * 100) + '%' : '無資料'}，點擊練 10 題` },
        h('span', { class: 'arknights-fac-top' },
          h('span', { class: 'arknights-fac-code mono', text: `FAC-${pad2(i + 1)}` }),
          h('span', { class: 'arknights-fac-state', text: s.todayN ? `今日作業 ${s.todayN}` : '待機' })),
        h('b', { class: 'arknights-fac-name', text: s.t }),
        h('span', { class: 'arknights-prod', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.round(s.cov * 100)}%` })),
        h('span', { class: 'arknights-fac-nums mono' },
          h('span', null, '進度 ', h('b', { text: `${s.seen}/${s.ids.length}` })),
          h('span', null, '效率 ', h('b', { text: s.n ? `${Math.round(s.acc * 100)}%` : '—' })),
          h('span', null, '產出 ', h('b', { text: QG.fmtNum(s.c) })))))));
  }

  function akHome() {
    const now = new Date();
    return h('div', { class: 'arknights-home' },
      h('header', { class: 'arknights-head' },
        h('span', { class: 'arknights-head-bg', 'aria-hidden': 'true', text: 'TERMINAL' }),
        h('span', { class: 'arknights-code' }, `OPS-TERMINAL // ${now.getFullYear()}.${pad2(now.getMonth() + 1)}.${pad2(now.getDate())}`, h('i', { class: 'arknights-caret', 'aria-hidden': 'true' })),
        h('h1', null, '作戰終端', h('span', { class: 'arknights-h1-en', text: 'OPERATIONS' })),
        h('p', { class: 'arknights-sub', text: `IPAS 初級電路板製程工程師・題庫 ${QG.fmtNum(QG.QS.length)} 題・連續 ${QG.streak()} 天` }),
        h('span', { class: 'arknights-head-deco', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('b', { text: '///' }))),
      h('div', { class: 'arknights-col-main' }, stageMap(), base()),
      h('div', { class: 'arknights-col-side' }, menu(), quota()));
  }

  /* ---------------------------------------------------------------- 模擬考結果：作戰結束 */

  const starsFor = (score) => (score >= 85 ? 3 : score >= 70 ? 2 : score >= 60 ? 1 : 0);
  function akResult(baseViews) {
    const view = baseViews.result();
    const r = S().lastResult;
    if (!r) return view;
    const stars = starsFor(r.score);
    const ok = r.score >= 60;
    view.prepend(h('section', { class: 'arknights-result' + (ok ? ' ok' : ' ng'), 'aria-label': `作戰結束，${r.score} 分，${stars} 星` },
      h('span', { class: 'arknights-res-band', 'aria-hidden': 'true' }),
      h('span', { class: 'arknights-code', text: `QG-EX/OPS // ${QG.SUBJ_CODE[r.subject]} // RESULT` }),
      h('div', { class: 'arknights-res-main' },
        h('div', { class: 'arknights-res-title' }, h('b', { text: ok ? '作戰結束' : '作戰失敗' }), h('span', { text: ok ? 'MISSION COMPLETE' : 'MISSION FAILED' })),
        h('div', { class: 'arknights-res-stars', 'aria-hidden': 'true' }, [1, 2, 3].map((i) => h('i', { class: i <= stars ? 'on' : null, style: `--d:${i * 0.12}s` })))),
      h('div', { class: 'arknights-res-nums' },
        h('div', null, h('span', { text: '評分' }), h('b', { class: 'mono', text: String(r.score) })),
        h('div', null, h('span', { text: '命中' }), h('b', { class: 'mono', text: `${r.correct}/${r.total}` })),
        h('div', null, h('span', { text: '評價' }), h('b', { class: 'mono', text: `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}` }))),
      h('p', { class: 'arknights-note', text: '三星判定：60 分 ★、70 分 ★★、85 分 ★★★。' })));
    return view;
  }

  /* ---------------------------------------------------------------- 入場：終端連線 */

  let booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    try { if (sessionStorage.getItem('qg-boot-arknights')) return; sessionStorage.setItem('qg-boot-arknights', '1'); } catch (e) { /* 無法使用時每次載入都播放 */ }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = h('div', { class: 'arknights-boot', 'aria-hidden': 'true' },
      h('span', { class: 'arknights-boot-stripe' }),
      h('div', { class: 'arknights-boot-box' },
        h('span', { class: 'arknights-boot-code', text: 'QG-TERMINAL // ESTABLISHING LINK' }),
        h('b', { text: '連線至作戰終端' }),
        h('span', { class: 'arknights-boot-bar' }, h('i')),
        h('span', { class: 'arknights-boot-meta' }, h('span', { text: 'IPAS-PCB' }), h('span', { text: `${QG.fmtNum(QG.QS.length)} RECORDS` }))));
    document.body.append(el);
    setTimeout(() => el.remove(), 1000);
  }

  /* ---------------------------------------------------------------- 作答頁：戰術簡報 */

  function akAfter(view) {
    boot();
    const app = document.getElementById('app');
    if (!app) return;
    if (view === 'practice' || view === 'review' || view === 'exam') {
      const v = app.querySelector('.view');
      if (!v || app.querySelector('.arknights-briefbar')) return;
      const inRun = !!app.querySelector('#qcard');
      const code = view === 'exam' ? 'QG-EX/OPS' : view === 'review' ? 'QG-RPR/OPS' : 'QG-DRL/OPS';
      const title = view === 'exam' ? (inRun ? '作戰進行中' : '作戰部署') : view === 'review' ? (inRun ? '整備作業' : '整備區') : '戰術簡報';
      app.insertBefore(h('div', { class: 'arknights-briefbar', 'aria-hidden': 'true' },
        h('span', { class: 'arknights-bb-code', text: code }), h('b', { text: title }),
        h('span', { class: 'arknights-bb-line' }),
        h('span', { class: 'arknights-bb-r', text: inRun ? 'KEY 1–4 / A–D' : 'STANDBY' })), v);
    }
  }

  SK.register({
    id: 'arknights', label: '明日方舟風', group: '二次元手遊',
    top: akTop,
    nav: [
      { v: 'home', label: '終端', icon: 'home' },
      { v: 'practice', label: '演習', icon: 'arknights-drill' },
      { v: 'exam', label: '作戰', icon: 'arknights-op', big: true },
      { v: 'review', label: '整備', icon: 'review', badge: true },
      { v: 'stats', label: '紀錄', icon: 'stats' },
    ],
    views: { home: akHome, result: akResult },
    after: akAfter,
  });
})();
