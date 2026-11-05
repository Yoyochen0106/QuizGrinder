/* Duolingo 風：學習路徑（主題＝關卡節點、皇冠等級）、連續天數／今日 XP／每日目標、課程內愛心與進度條。
 * 只借用版面、互動與配色；不使用任何吉祥物、標誌或專屬字型。 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon } = SK;
  const S = () => QG.S();

  SK.ICONS.duoCrown = SK.ICONS.duoCrown || '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>';
  SK.ICONS.duoGem = SK.ICONS.duoGem || '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9 3l3 18M15 3l-3 18"/>';
  SK.ICONS.duoTarget = SK.ICONS.duoTarget || '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>';
  SK.ICONS.duoCheck = SK.ICONS.duoCheck || '<path d="M5 12.5l4.5 4.5L19 7.5"/>';

  const GOAL = 20;
  const LESSON = '關卡：';
  const UNIT_SIZE = 4;
  const UNIT_HUES = ['#58cc02', '#ce82ff', '#1cb0f6', '#ff9600', '#ff4b4b'];
  const OFFSETS = [0, 46, 72, 46, 0, -46, -72, -46];

  const today = () => S().days[QG.dayKey()] || { n: 0, c: 0 };

  /** 每個主題的熟練度：覆蓋率 × 正確率 × 5 → 皇冠 0–5 */
  function topics() {
    const official = QG.QS.filter((q) => q.official);
    return QG.TAGS.filter(([t]) => t !== '其他').map(([t]) => {
      const ids = official.filter((q) => q.t.includes(t)).map((q) => q.id);
      const p = SK.progressOf(ids);
      const acc = p.n ? p.c / p.n : 0;
      const score = (p.seen / ids.length) * acc * 5;
      const crown = Math.min(5, Math.floor(score + 1e-9));
      return { t, ids, p, acc, crown, prog: crown >= 5 ? 1 : score - crown };
    });
  }

  function startLesson(tp) {
    QG.startCustomPractice(QG.buildQueue(tp.ids, 'weak').slice(0, 10), LESSON + tp.t);
  }

  /* ---------------------------------------------------------------- 頂部列與側欄 */
  function statChip(cls, ico, value, label) {
    return h('span', { class: 'duolingo-chip ' + cls, title: label, 'aria-label': `${label} ${value}` }, icon(ico), h('b', { text: String(value) }));
  }

  function goalRing(n) {
    const f = Math.min(1, n / GOAL);
    const c = 2 * Math.PI * 9;
    const span = h('span', { class: 'duolingo-ring', 'aria-hidden': 'true' });
    span.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" class="duolingo-ring-bg"/><circle cx="12" cy="12" r="9" class="duolingo-ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}"/></svg>`;
    return span;
  }

  function duoTop() {
    const d = today();
    return h('div', { class: 'sk-top duolingo-top' },
      h('a', { class: 'duolingo-brand', href: '#home', 'aria-label': 'QuizGrinder 首頁' }, icon('pad'), h('span', { text: 'QuizGrinder' })),
      h('div', { class: 'duolingo-stats' },
        statChip('flame' + (d.n ? ' on' : ''), 'flame', QG.streak(), '連續天數'),
        statChip('gem', 'duoGem', d.c * 10, '今日 XP'),
        h('a', { class: 'duolingo-chip goal', href: '#practice', title: '每日目標', 'aria-label': `每日目標 ${Math.min(d.n, GOAL)}/${GOAL}` }, goalRing(d.n), h('b', { text: `${Math.min(d.n, GOAL)}/${GOAL}` }))));
  }

  const NAV = [
    { v: 'home', label: '學習', icon: 'home' },
    { v: 'review', label: '複習', icon: 'review', badge: true },
    { v: 'exam', label: '測驗', icon: 'exam' },
    { v: 'browse', label: '題庫', icon: 'browse' },
    { v: 'stats', label: '個人', icon: 'user' },
  ];

  function duoSide(view) {
    return h('nav', { class: 'duolingo-side', 'aria-label': '主要功能' },
      NAV.concat([{ v: 'practice', label: '自由練習', icon: 'practice' }]).map((n) => h('a', { class: 'duolingo-side-item', href: '#' + n.v, 'aria-current': SK.isCurrent(view, n.v) ? 'page' : null },
        h('span', { class: 'duolingo-side-ico ' + n.v }, icon(n.icon)), h('span', { text: n.label }),
        n.badge ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null)));
  }

  /* ---------------------------------------------------------------- 首頁：學習路徑 */
  const pathState = { open: null };

  function node(tp, i, isNext) {
    const pos = OFFSETS[i % OFFSETS.length];
    const label = `${tp.t}，皇冠等級 ${tp.crown} / 5`;
    const btn = h('button', { class: 'duolingo-node lv' + tp.crown + (isNext ? ' next' : '') + (tp.p.seen ? ' started' : ''), type: 'button', 'aria-label': label,
      'aria-expanded': pathState.open === tp.t ? 'true' : 'false',
      onclick: () => { pathState.open = pathState.open === tp.t ? null : tp.t; QG.render(); } },
      h('span', { class: 'duolingo-node-face' }, icon(tp.crown >= 5 ? 'duoCrown' : tp.p.seen ? 'star' : 'practice')),
      h('span', { class: 'duolingo-crown', 'aria-hidden': 'true' }, icon('duoCrown'), h('b', { text: String(tp.crown) })));
    const pop = pathState.open === tp.t ? h('div', { class: 'duolingo-pop', role: 'dialog', 'aria-label': tp.t },
      h('strong', { text: tp.t }),
      h('span', { text: `皇冠等級 ${tp.crown} / 5・已練 ${tp.p.seen} / ${tp.ids.length} 題・正確率 ${QG.pct(tp.p.c, tp.p.n)}` }),
      h('span', { class: 'duolingo-pop-bar' }, h('i', { style: `width:${Math.round(tp.prog * 100)}%` })),
      h('button', { class: 'duolingo-btn white', type: 'button', text: tp.crown >= 5 ? '複習 +100 XP' : '開始 +100 XP', onclick: () => startLesson(tp) })) : null;
    return h('div', { class: 'duolingo-step', style: `--x:${pos}px` },
      h('div', { class: 'duolingo-step-in' },
        isNext && !pop ? h('span', { class: 'duolingo-bubble', text: tp.p.seen ? '繼續' : '開始' }) : null,
        btn,
        h('span', { class: 'duolingo-node-label', text: tp.t })),
      pop);
  }

  function duoHome() {
    const tps = topics();
    const nextIdx = Math.max(0, tps.findIndex((tp) => tp.crown < 5));
    const units = [];
    for (let i = 0; i < tps.length; i += UNIT_SIZE) units.push(tps.slice(i, i + UNIT_SIZE));
    const d = today();
    const crowns = tps.reduce((a, tp) => a + tp.crown, 0);
    const due = QG.dueReviewIds().length;
    const path = h('div', { class: 'duolingo-path' }, units.map((u, k) => h('section', { class: 'duolingo-unit', style: `--unit:${UNIT_HUES[k % UNIT_HUES.length]}` },
      h('header', { class: 'duolingo-unit-head' },
        h('div', null, h('span', { class: 'duolingo-unit-no', text: `第 ${k + 1} 部分・單元 ${k + 1}` }), h('h2', { text: u.map((tp) => tp.t).join('、') })),
        h('a', { class: 'duolingo-guide', href: '#browse', onclick: () => Object.assign(QG.browse, { kw: '', tag: u[0].t, exam: '', subject: 'all', only: 'all', limit: 30 }) }, icon('doc'), h('span', { text: '題目一覽' }))),
      h('div', { class: 'duolingo-steps' }, u.map((tp, j) => node(tp, k * UNIT_SIZE + j, k * UNIT_SIZE + j === nextIdx))))));
    const aside = h('aside', { class: 'duolingo-aside' },
      h('div', { class: 'duolingo-card' },
        h('h3', { text: '每日目標' }),
        h('div', { class: 'duolingo-goal' }, h('span', { class: 'duolingo-goal-bar' }, h('i', { style: `width:${Math.min(100, Math.round((d.n / GOAL) * 100))}%` })),
          h('b', { text: `${Math.min(d.n, GOAL)} / ${GOAL}` })),
        h('p', { class: 'muted', text: d.n >= GOAL ? '今天的目標達成了！' : `再答 ${GOAL - d.n} 題就達成今日目標` })),
      h('div', { class: 'duolingo-card' },
        h('h3', { text: '今日成績' }),
        h('div', { class: 'duolingo-mini' },
          h('span', null, icon('flame'), h('b', { text: String(QG.streak()) }), h('small', { text: '天連續' })),
          h('span', null, icon('duoGem'), h('b', { text: String(d.c * 10) }), h('small', { text: '今日 XP' })),
          h('span', null, icon('duoCrown'), h('b', { text: String(crowns) }), h('small', { text: `皇冠 / ${tps.length * 5}` })))),
      h('a', { class: 'duolingo-card duolingo-review' + (due ? '' : ' calm'), href: '#review' },
        h('h3', { text: due ? `${due} 題待複習` : '沒有待複習的題目' }),
        h('p', { class: 'muted', text: '答錯的題目會依間隔回來，複習答對就升級。' })));
    return h('div', { class: 'duolingo-home' }, path, aside);
  }

  /* ---------------------------------------------------------------- 課程中：愛心、進度條、底部回饋 */
  let lessonObs = null;
  function lessonAfter(view) {
    const root = document.documentElement;
    if (lessonObs) { lessonObs.disconnect(); lessonObs = null; }
    const run = S().practice;
    const inLesson = view === 'practice' && run && run.label && run.label.startsWith(LESSON);
    root.classList.toggle('duolingo-in-lesson', !!inLesson);
    if (!inLesson) return;
    const app = document.getElementById('app');
    const wrap = app.firstElementChild;
    if (!wrap) return;
    wrap.classList.add('duolingo-lesson');
    if (run.idx >= run.queue.length) { lessonDone(wrap, run); return; }
    const bar = h('i');
    const hearts = h('span', { class: 'duolingo-hearts' });
    const head = h('div', { class: 'duolingo-lesson-head' },
      h('a', { class: 'duolingo-x', href: '#home', 'aria-label': '離開課程' }, icon('close')),
      h('span', { class: 'duolingo-lbar', role: 'progressbar', 'aria-label': '課程進度' }, bar),
      hearts);
    const title = h('p', { class: 'duolingo-lesson-title', text: run.label.slice(LESSON.length) + '・選出正確的答案' });
    const sync = () => {
      const left = Math.max(0, 5 - (run.n - run.c));
      const answered = wrap.querySelector('.feedback') ? 1 : 0;
      bar.style.width = `${Math.round(((run.idx + answered) / run.queue.length) * 100)}%`;
      fill(hearts, icon('heart'), h('b', { text: String(left) }));
      hearts.setAttribute('aria-label', `剩 ${left} 顆愛心`);
      hearts.classList.toggle('empty', !left);
      const fb = wrap.querySelector('.feedback');
      const next = wrap.querySelector('#nextBtn');
      if (fb && next && !fb.contains(next)) {
        next.classList.add('duolingo-btn');
        next.classList.toggle('red', fb.classList.contains('bad'));
        next.textContent = '繼續';
        fb.append(next);
        next.focus({ preventScroll: true });
        if (matchMedia('(max-width: 720px)').matches) fb.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
    };
    wrap.prepend(head, title);
    sync();
    lessonObs = new MutationObserver(() => { if (!wrap.isConnected) { lessonObs.disconnect(); return; } lessonObs.disconnect(); sync(); if (!wrap.contains(head)) wrap.prepend(head, title); lessonObs.observe(wrap, { childList: true }); });
    lessonObs.observe(wrap, { childList: true });
  }

  function lessonDone(wrap, run) {
    const left = Math.max(0, 5 - (run.n - run.c));
    fill(wrap, h('section', { class: 'duolingo-done' },
      h('span', { class: 'duolingo-done-badge' }, icon('duoCrown')),
      h('h1', { text: '課程完成！' }),
      h('p', { class: 'muted', text: run.label.slice(LESSON.length) }),
      h('div', { class: 'duolingo-done-stats' },
        h('div', { class: 'duolingo-done-box xp' }, h('span', { text: '總 XP' }), h('b', null, icon('duoGem'), String(run.c * 10))),
        h('div', { class: 'duolingo-done-box acc' }, h('span', { text: '正確率' }), h('b', null, icon('duoTarget'), QG.pct(run.c, run.n))),
        h('div', { class: 'duolingo-done-box heart' }, h('span', { text: '剩餘愛心' }), h('b', null, icon('heart'), String(left)))),
      h('div', { class: 'duolingo-done-btns' },
        h('a', { class: 'duolingo-btn', href: '#home', text: '繼續' }),
        run.n > run.c ? h('a', { class: 'duolingo-btn ghost', href: '#review', text: '複習答錯的題目' }) : null)));
  }

  /* ---------------------------------------------------------------- 個人檔案（統計頁上方） */
  function duoStats(base) {
    const el = base.stats();
    const t = QG.totals();
    const tps = topics();
    const crowns = tps.reduce((a, tp) => a + tp.crown, 0);
    el.prepend(h('section', { class: 'duolingo-profile' },
      h('div', { class: 'duolingo-avatar', 'aria-hidden': 'true' }, icon('pad')),
      h('div', null, h('h1', { text: '我的學習檔案' }), h('p', { class: 'muted', text: `已練 ${QG.fmtNum(t.seen)} / ${QG.fmtNum(QG.QS.length)} 題` })),
      h('div', { class: 'duolingo-profile-grid' },
        [['flame', String(QG.streak()), '連續天數'], ['duoGem', QG.fmtNum(t.c * 10), '總 XP'], ['duoCrown', String(crowns), '皇冠'], ['duoTarget', QG.pct(t.c, t.n), '總正確率']]
          .map(([ic, v, l]) => h('div', { class: 'duolingo-pstat ' + ic }, icon(ic), h('b', { text: v }), h('span', { text: l }))))));
    return el;
  }

  SK.register({
    id: 'duolingo', label: 'Duolingo 風', group: '學習測驗',
    top: duoTop, side: duoSide, nav: NAV,
    views: { home: duoHome, stats: duoStats },
    after: (view) => lessonAfter(view),
  });
})();
