/* QuizGrinder 版面風格：賽馬娘風（育成模擬介面）
 *
 * 借用：明亮圓潤的粉彩介面、粗大的屬性條與等級字母、回合（週）進度、訓練選擇卡、目標賽事卡、育成評價。
 * 首頁「備考培育」：
 *   回合＝距目標考試日（S().settings.skinData.uma.target，可在頁面上修改，預設 8 週後）的第幾週；
 *   五條屬性＝題數最多的 5 個主題的分數（已練比例 × 正確率 × 100）；
 *   訓練卡＝選一個主題練 10 題（弱點優先，QG.startCustomPractice）；
 *   目標賽事＝模擬考與倒數；育成評價 G→S 由整體準備度算出；狀態由近 3 天的正確率走勢算出。
 * 不使用任何角色、立繪、標誌或遊戲專有名詞；沒有抽獎、隨機獎勵或付費機制，所有數字都來自學習紀錄。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon } = SK;
  const S = () => QG.S();
  const DAY = 864e5;
  const GOAL = 20;
  const GRADES = [[85, 'S'], [70, 'A'], [55, 'B'], [40, 'C'], [30, 'D'], [20, 'E'], [10, 'F'], [0, 'G']];
  const gradeOf = (v) => GRADES.find(([t]) => v >= t)[1];
  const nextGrade = (v) => { const i = GRADES.findIndex(([t]) => v >= t); return i > 0 ? GRADES[i - 1] : null; };

  Object.assign(SK.ICONS, {
    'uma-flag': '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    'uma-run': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'uma-train': '<path d="M4 15l4-4 3 3 5-6 4 4"/><path d="M4 20h16"/>',
    'uma-book': '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h7M8 11h5"/>',
  });

  /* ---------------------------------------------------------------- 資料 */

  const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const parseDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : NaN; };
  const fmtDate = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  /** 育成期：{start 開始日（毫秒）, target 'YYYY-MM-DD'}；第一次使用時預設 8 週後 */
  function plan() {
    const st = S().settings;
    if (!st.skinData || typeof st.skinData !== 'object') st.skinData = {};
    let u = st.skinData.uma;
    if (!u || typeof u !== 'object' || !Number.isFinite(parseDate(u.target)) || !Number.isFinite(u.start)) {
      const start = dayStart(Date.now());
      u = st.skinData.uma = { start, target: fmtDate(start + 56 * DAY) };
      QG.Store.save();
    }
    const today = dayStart(Date.now());
    const target = parseDate(u.target);
    const total = Math.max(1, Math.ceil((target - u.start) / (7 * DAY)));
    const week = Math.min(total, Math.max(1, Math.floor((today - u.start) / (7 * DAY)) + 1));
    const daysLeft = Math.round((target - today) / DAY);
    return { start: u.start, target, total, week, daysLeft };
  }
  function setTarget(str) {
    const st = S().settings;
    st.skinData.uma = { start: dayStart(Date.now()), target: str };
    QG.Store.save();
  }

  function topics() {
    const off = QG.QS.filter((q) => q.official);
    const st = S().q;
    return QG.TAGS.filter(([t]) => t !== '其他').map(([t]) => {
      const ids = off.filter((q) => q.t.includes(t)).map((q) => q.id);
      const p = SK.progressOf(ids);
      let wrong = 0;
      for (const id of ids) if (st[id] && st[id].b > 0) wrong++;
      const cov = ids.length ? p.seen / ids.length : 0;
      const acc = p.n ? p.c / p.n : 0;
      return { t, ids, seen: p.seen, n: p.n, c: p.c, wrong, cov, acc, score: Math.round(cov * acc * 100) };
    }).filter((x) => x.ids.length);
  }

  /** 整體準備度：全部官方題的已練比例 × 正確率；有模擬考時與最近 3 場平均各占 70%／30% */
  function readiness() {
    const off = QG.QS.filter((q) => q.official).map((q) => q.id);
    const p = SK.progressOf(off);
    const know = off.length && p.n ? (p.seen / off.length) * (p.c / p.n) * 100 : 0;
    const ex = S().exams.slice(-3);
    const exAvg = ex.length ? ex.reduce((a, e) => a + e.score, 0) / ex.length : null;
    const v = exAvg === null ? know : know * 0.7 + exAvg * 0.3;
    return { v: Math.round(v), know: Math.round(know), exAvg: exAvg === null ? null : Math.round(exAvg) };
  }

  const MOODS = [
    { k: 'top', label: '絕佳', rot: -90 },
    { k: 'good', label: '良好', rot: -45 },
    { k: 'norm', label: '普通', rot: 0 },
    { k: 'low', label: '低落', rot: 45 },
    { k: 'bad', label: '不佳', rot: 90 },
  ];
  /** 狀態：近 3 天（含今天）有作答的日子的平均正確率定基準，第一天到最後一天的升降再調整一級 */
  function mood() {
    const days = S().days;
    const pts = [];
    for (let i = 2; i >= 0; i--) {
      const k = QG.dayKey(new Date(Date.now() - i * DAY));
      const d = days[k];
      if (d && d.n) pts.push({ i, acc: d.c / d.n, n: d.n });
    }
    if (!pts.length) return Object.assign({ note: '近 3 天沒有作答紀錄', pts }, MOODS[2]);
    const avg = pts.reduce((a, p) => a + p.acc * p.n, 0) / pts.reduce((a, p) => a + p.n, 0);
    let lv = avg >= 0.85 ? 0 : avg >= 0.7 ? 1 : avg >= 0.55 ? 2 : avg >= 0.4 ? 3 : 4;
    const diff = pts.length > 1 ? pts[pts.length - 1].acc - pts[0].acc : 0;
    if (diff >= 0.08) lv--; else if (diff <= -0.08) lv++;
    lv = Math.max(0, Math.min(4, lv));
    const note = pts.length > 1
      ? `近 3 天正確率 ${pts.map((p) => Math.round(p.acc * 100) + '%').join(' → ')}`
      : `近 3 天只有 1 天作答，正確率 ${Math.round(pts[0].acc * 100)}%`;
    return Object.assign({ note, pts }, MOODS[lv]);
  }

  /* ---------------------------------------------------------------- 元件 */

  const ui = { editing: false, err: '' };

  function gradeBadge(g, cls) {
    return h('span', { class: `uma-grade g-${g} ${cls || ''}`, text: g });
  }

  function moodChip(m) {
    return h('span', { class: `uma-mood m-${m.k}`, title: m.note },
      h('span', { class: 'uma-mood-arrow', style: `--rot:${m.rot}deg`, 'aria-hidden': 'true' }),
      h('b', { text: m.label }));
  }

  function umaTop() {
    const p = plan();
    return h('div', { class: 'sk-top uma-top' },
      h('a', { class: 'uma-brand', href: '#home', 'aria-label': 'QuizGrinder 備考培育' }, icon('pad', 'uma-brand-ico'), h('b', { text: 'QuizGrinder' })),
      h('span', { class: 'uma-top-turn' }, h('small', { text: '育成' }), h('b', { text: `第 ${p.week} 週` }), h('span', { text: `/ ${p.total}` })),
      h('a', { class: 'uma-top-race', href: '#exam' }, icon('uma-flag'),
        h('span', { text: p.daysLeft > 0 ? `目標賽事 ${p.daysLeft} 天` : p.daysLeft === 0 ? '今天是目標賽事' : '目標賽事已結束' })),
      h('span', { class: 'spacer' }),
      moodChip(mood()));
  }

  function turnBar(p) {
    const dots = [];
    for (let i = 1; i <= Math.min(p.total, 26); i++) {
      dots.push(h('span', { class: 'uma-wk' + (i < p.week ? ' done' : i === p.week ? ' now' : ''), title: `第 ${i} 週` }, i === p.week ? h('b', { text: String(i) }) : null));
    }
    const editor = ui.editing ? dateForm(p) : null;
    const today = S().days[QG.dayKey()] || { n: 0, c: 0 };
    return h('section', { class: 'uma-turn', 'aria-label': '育成回合' },
      h('div', { class: 'uma-cal', 'aria-label': `第 ${p.week} 週，共 ${p.total} 週` },
        h('span', { class: 'uma-cal-rings', 'aria-hidden': 'true' }, h('i'), h('i')),
        h('span', { class: 'uma-cal-k', text: '第' }), h('b', { text: String(p.week) }), h('span', { class: 'uma-cal-k', text: `週 / ${p.total}` })),
      h('div', { class: 'uma-goal' },
        h('div', { class: 'uma-goal-plate' },
          h('span', { class: 'uma-goal-tag', text: '目標' }),
          h('span', { class: 'uma-goal-t', text: p.daysLeft >= 0 ? '考前衝刺・目標賽事＝模擬考' : '考試日已過，請設定新日期' }),
          h('span', { class: 'uma-count' }, p.daysLeft >= 0 ? [h('span', { text: '還有' }), h('b', { text: String(p.daysLeft) }), h('span', { text: '天' })] : null)),
        h('div', { class: 'uma-energy-row' },
          h('span', { class: 'uma-turn-k', text: '今日訓練量' }),
          h('span', { class: 'uma-energy', role: 'img', 'aria-label': `今日作答 ${today.n} / ${GOAL} 題` },
            h('i', { style: `width:${Math.min(100, (today.n / GOAL) * 100)}%` }), h('span', { text: `${today.n} / ${GOAL}` })),
          h('button', { type: 'button', class: 'uma-link', 'aria-expanded': ui.editing ? 'true' : 'false',
            onclick: () => { ui.editing = !ui.editing; ui.err = ''; redraw(); } }, `考試日 ${fmtDate(p.target)}・變更`))),
      h('div', { class: 'uma-turn-track', 'aria-hidden': 'true' }, dots, h('span', { class: 'uma-wk goal' }, icon('uma-flag'))),
      editor);
  }

  function dateForm(p) {
    const input = h('input', { type: 'date', id: 'uma-date', value: fmtDate(p.target), min: fmtDate(Date.now() + DAY), 'aria-label': '目標考試日' });
    return h('form', { class: 'uma-dateform', novalidate: true, onsubmit: (e) => {
      e.preventDefault();
      const t = parseDate(input.value);
      if (!Number.isFinite(t)) { ui.err = '請選擇日期'; redraw(); return; }
      if (t <= dayStart(Date.now())) { ui.err = '考試日要在今天之後'; redraw(); return; }
      setTarget(input.value);
      ui.editing = false; ui.err = '';
      QG.toast('已設定目標考試日，育成期從今天重新起算');
      QG.render();
    } },
      h('label', { class: 'uma-df-l', for: 'uma-date', text: '目標考試日' }), input,
      h('button', { type: 'submit', class: 'uma-btn green small', text: '確定' }),
      h('button', { type: 'button', class: 'uma-btn small', text: '取消', onclick: () => { ui.editing = false; ui.err = ''; redraw(); } }),
      ui.err ? h('span', { class: 'uma-df-err', role: 'alert', text: ui.err }) : null,
      h('span', { class: 'uma-df-note', text: '設定後，育成期從今天起算到考試日，每 7 天為一週（一回合）。' }));
  }

  function statusCard(r, m) {
    const g = gradeOf(r.v);
    const nx = nextGrade(r.v);
    const today = S().days[QG.dayKey()] || { n: 0, c: 0 };
    return h('section', { class: 'uma-card uma-status' },
      h('div', { class: 'uma-eval' },
        h('span', { class: 'uma-eval-k', text: '育成評價' }),
        gradeBadge(g, 'big'),
        h('span', { class: 'uma-eval-v' }, h('b', { text: String(r.v) }), ' 分'),
        h('span', { class: 'uma-eval-n', text: nx ? `距 ${nx[1]} 還差 ${nx[0] - r.v} 分` : '已達最高評價' })),
      h('div', { class: 'uma-status-r' },
        h('div', { class: 'uma-row' }, h('span', { class: 'uma-k', text: '狀態' }), moodChip(m), h('span', { class: 'uma-sub', text: m.note })),
        h('div', { class: 'uma-row' }, h('span', { class: 'uma-k', text: '今日' }), h('span', { class: 'uma-sub', text: `作答 ${today.n} 題・答對 ${today.c} 題` })),
        h('div', { class: 'uma-trend', role: 'img', 'aria-label': '近 7 天每日正確率' }, [6, 5, 4, 3, 2, 1, 0].map((d) => {
          const k = QG.dayKey(new Date(Date.now() - d * DAY));
          const x = S().days[k];
          const acc = x && x.n ? x.c / x.n : null;
          return h('span', { class: 'uma-tr' + (d === 0 ? ' today' : '') },
            h('i', { style: `height:${acc === null ? 0 : Math.max(6, Math.round(acc * 100))}%` }),
            h('small', { text: d === 0 ? '今天' : `${new Date(Date.now() - d * DAY).getDate()}日` }),
            h('b', { text: acc === null ? '—' : Math.round(acc * 100) + '' }));
        })),
        h('p', { class: 'uma-sub', text: r.exAvg === null
          ? `準備度＝全部官方題已練比例 × 正確率（${r.know} 分）。完成模擬考後也會算進評價。`
          : `準備度＝知識 ${r.know} 分 × 70% ＋ 最近模擬考平均 ${r.exAvg} 分 × 30%。` })));
  }

  function statBars(list) {
    return h('section', { class: 'uma-card uma-stats', 'aria-label': '五項屬性（題數最多的 5 個主題）' },
      h('div', { class: 'uma-card-h' }, h('h2', { text: '屬性' }), h('span', { class: 'uma-sub', text: '分數＝已練比例 × 正確率 × 100' })),
      list.map((s, i) => h('div', { class: `uma-stat uma-c${i}` },
        h('span', { class: 'uma-stat-name' }, h('span', { class: 'uma-stat-t', text: s.t })),
        gradeBadge(gradeOf(s.score)),
        h('span', { class: 'uma-stat-bar', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.max(2, s.score)}%` })),
        h('b', { class: 'uma-stat-v', text: String(s.score) }))));
  }

  function raceCard(p) {
    const ex = S().exams;
    const best = ex.reduce((a, e) => Math.max(a, e.score), 0);
    const last = ex[ex.length - 1];
    return h('section', { class: 'uma-card uma-race' },
      h('div', { class: 'uma-race-ribbon', text: '目標賽事' }),
      h('h2', { text: '模擬考' }),
      h('p', { class: 'uma-race-sub', text: `${QG.EXAM_LEN} 題・${QG.EXAM_MIN} 分鐘・考後一次對答` }),
      h('div', { class: 'uma-race-count' }, p.daysLeft > 0
        ? [h('span', { text: '正式考試還有' }), h('b', { text: String(p.daysLeft) }), h('span', { text: '天' })]
        : h('span', { text: p.daysLeft === 0 ? '就是今天！' : '考試日已過' })),
      h('div', { class: 'uma-race-rec' },
        h('div', null, h('span', { text: '最佳' }), h('b', { text: ex.length ? String(best) : '—' })),
        h('div', null, h('span', { text: '最近' }), h('b', { text: last ? String(last.score) : '—' })),
        h('div', null, h('span', { text: '出賽' }), h('b', { text: String(ex.length) }))),
      h('a', { class: 'uma-btn pink big', href: '#exam' }, icon('uma-flag'), S().examRun ? '繼續賽事' : '出賽'));
  }

  function trainCards(all, top5) {
    const rec = top5.slice().sort((a, b) => a.score - b.score)[0];
    const start = (s) => QG.startCustomPractice(QG.buildQueue(s.ids, 'weak').slice(0, 10), `訓練：${s.t}`);
    const rest = all.filter((s) => !top5.includes(s));
    return h('section', { class: 'uma-train', 'aria-label': '訓練選擇' },
      h('div', { class: 'uma-card-h' }, h('h2', { text: '選擇訓練' }), h('span', { class: 'uma-sub', text: '每次 10 題，答錯過與沒練過的題目優先' })),
      h('div', { class: 'uma-tcards' }, top5.map((s, i) => {
        const lv = Math.min(5, Math.floor(s.score / 20) + 1);
        return h('button', { type: 'button', class: `uma-tcard uma-c${i}` + (s === rec ? ' rec' : ''), onclick: () => start(s),
          'aria-label': `訓練 ${s.t}，等級 ${lv}，未練 ${s.ids.length - s.seen} 題，錯題 ${s.wrong} 題${s === rec ? '，推薦' : ''}` },
          s === rec ? h('span', { class: 'uma-tag-rec', text: '推薦' }) : null,
          h('span', { class: 'uma-tlv', text: `Lv${lv}` }),
          h('span', { class: 'uma-temblem', 'aria-hidden': 'true', text: s.t.slice(0, 1) }),
          h('b', { class: 'uma-tname', text: s.t }),
          h('span', { class: 'uma-tinfo' }, h('span', { text: `未練 ${s.ids.length - s.seen}` }), h('span', { text: `錯題 ${s.wrong}` })));
      })),
      rest.length ? h('div', { class: 'uma-more' },
        h('span', { class: 'uma-k', text: '其他訓練' }),
        h('div', { class: 'uma-chips' }, rest.map((s) => h('button', { type: 'button', class: 'uma-chip', onclick: () => start(s) },
          h('span', { text: s.t }), gradeBadge(gradeOf(s.score), 'tiny'))))) : null);
  }

  let host = null;
  function redraw() { if (host && host.isConnected) fill(host, ...homeKids()); }

  function homeKids() {
    const p = plan();
    const all = topics();
    const top5 = all.slice(0, 5);
    const r = readiness();
    const m = mood();
    return [
      turnBar(p),
      h('div', { class: 'uma-grid' },
        h('div', { class: 'uma-col' }, statusCard(r, m), statBars(top5)),
        raceCard(p)),
      trainCards(all, top5),
    ];
  }

  function umaHome() {
    host = h('div', { class: 'uma-home' });
    fill(host, ...homeKids());
    return host;
  }

  function umaAfter(view) {
    boot();
    if (view !== 'practice' && view !== 'review') return;
    const app = document.getElementById('app');
    const v = app && app.querySelector('.view');
    if (!v || !app.querySelector('#qcard') || app.querySelector('.uma-strip')) return;
    const p = plan();
    const today = S().days[QG.dayKey()] || { n: 0 };
    app.insertBefore(h('div', { class: 'uma-strip' },
      h('span', { class: 'uma-strip-turn' }, h('b', { text: `第 ${p.week} 週` }), ` / ${p.total}`),
      h('span', { class: 'uma-strip-t', text: view === 'review' ? '複習訓練' : '訓練中' }),
      h('span', { class: 'spacer' }),
      h('span', { class: 'uma-strip-n', text: `今日 ${today.n}/${GOAL}` })), v);
  }

  /* ---------------------------------------------------------------- 模擬考結果：賽事結果 */

  function umaResult(baseViews) {
    const view = baseViews.result();
    const r = S().lastResult;
    if (!r) return view;
    const g = gradeOf(r.score);
    const prevBest = S().exams.slice(0, -1).reduce((a, e) => Math.max(a, e.score), 0);
    const isBest = S().exams.length <= 1 || r.score > prevBest;
    view.prepend(h('section', { class: 'uma-result', 'aria-label': `賽事結果 ${r.score} 分，評價 ${g}` },
      h('span', { class: 'uma-sparkles', 'aria-hidden': 'true' }, [0, 1, 2, 3, 4, 5].map((i) => h('i', { style: `--i:${i}` }))),
      h('div', { class: 'uma-race-ribbon', text: '目標賽事・結果' }),
      h('div', { class: 'uma-res-main' },
        gradeBadge(g, 'big'),
        h('div', { class: 'uma-res-score' }, h('b', { text: String(r.score) }), h('span', { text: '分' })),
        h('div', { class: 'uma-res-info' },
          h('span', null, '答對 ', h('b', { text: `${r.correct} / ${r.total}` })),
          isBest ? h('span', { class: 'uma-res-best', text: '自己的最佳紀錄！' }) : h('span', { text: `最佳 ${prevBest} 分` }))),
      h('p', { class: 'uma-sub', text: '評價字母與首頁相同：S 85、A 70、B 55、C 40、D 30、E 20、F 10 分以上。' })));
    return view;
  }

  /* ---------------------------------------------------------------- 入場：斜向色帶 */

  let booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    try { if (sessionStorage.getItem('qg-boot-uma')) return; sessionStorage.setItem('qg-boot-uma', '1'); } catch (e) { /* 無法使用時每次載入都播放 */ }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = h('div', { class: 'uma-boot', 'aria-hidden': 'true' },
      h('span', { class: 'uma-boot-band b1' }), h('span', { class: 'uma-boot-band b2' }), h('span', { class: 'uma-boot-band b3' }),
      h('b', { class: 'uma-boot-t', text: '備考培育' }));
    document.body.append(el);
    setTimeout(() => el.remove(), 1100);
  }

  SK.register({
    id: 'uma', label: '賽馬娘風', group: '二次元手遊',
    top: umaTop,
    nav: [
      { v: 'home', label: '培育', icon: 'home' },
      { v: 'practice', label: '訓練', icon: 'uma-train' },
      { v: 'exam', label: '賽事', icon: 'uma-flag', big: true },
      { v: 'review', label: '複習', icon: 'review', badge: true },
      { v: 'stats', label: '資料', icon: 'stats' },
    ],
    views: { home: umaHome, result: umaResult },
    after: umaAfter,
  });
})();
