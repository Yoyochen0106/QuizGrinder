/* QuizGrinder 版面風格：Apple 健身風（fitness）
 *
 * 黑底霓虹三環：今天的「作答」（20 題）、「答對」（15 題）、「正確率」（目標 80%）三個同心圓環，
 * 最近 7 天的小圓環、本週與上週比較的趨勢卡、由真實紀錄算出的獎章（鎖定／解鎖與進度）。
 * 刻意只有一種深色外觀。只借用版面、互動與配色；標誌用 QuizGrinder 的焊墊圖示。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon } = SK;
  const S = () => QG.S();
  const GOAL = { n: 20, c: 15, acc: 0.8 };
  const WD = ['日', '一', '二', '三', '四', '五', '六'];
  const RINGS = [
    { k: 'n', label: '作答', unit: '題', c1: '#ff2d6f', c2: '#ff6aa0' },
    { k: 'c', label: '答對', unit: '題', c1: '#7be000', c2: '#c9ff3d' },
    { k: 'acc', label: '正確率', unit: '%', c1: '#00c8f0', c2: '#5ff7ff' },
  ];
  const NS = 'http://www.w3.org/2000/svg';
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  Object.assign(SK.ICONS, {
    fitRings: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="2"/>',
    fitMedal: '<circle cx="12" cy="15" r="6"/><path d="M8.5 10L6 3h4l2 5 2-5h4l-2.5 7"/>',
    fitUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    fitDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    fitPlay: '<path d="M7 4l13 8-13 8z"/>',
  });

  /* ---------------------------------------------------------------- 資料 */
  const dayRec = (d) => S().days[QG.dayKey(d)] || { n: 0, c: 0 };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  function progress(rec) {
    return { n: rec.n / GOAL.n, c: rec.c / GOAL.c, acc: rec.n ? rec.c / rec.n / GOAL.acc : 0 };
  }
  function sumRange(fromBack, len) {
    const now = new Date();
    let n = 0, c = 0, active = 0;
    for (let i = fromBack; i < fromBack + len; i++) { const r = dayRec(addDays(now, -i)); n += r.n; c += r.c; if (r.n) active++; }
    return { n, c, active };
  }
  function bestStreak() {
    const keys = Object.keys(S().days).filter((k) => S().days[k].n).sort();
    let best = 0, run = 0, prev = null;
    for (const k of keys) {
      const [y, m, d] = k.split('-').map(Number);
      const t = new Date(y, m - 1, d).getTime();
      run = prev !== null && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = t;
    }
    return best;
  }
  function awards() {
    const st = S();
    const t = QG.totals();
    const days = Object.values(st.days);
    const bs = bestStreak();
    const best = st.exams.length ? Math.max(...st.exams.map((e) => e.score)) : 0;
    const mastered = Object.entries(st.q).filter(([id, r]) => r.m && QG.QMAP.has(id)).length;
    const perfect = days.filter((d) => d.n >= GOAL.n && d.c >= GOAL.c && d.c / d.n >= GOAL.acc).length;
    const maxDay = days.reduce((a, d) => Math.max(a, d.n), 0);
    return [
      { k: 'first', mark: '1st', name: '第一次作答', desc: '答完第一題', v: t.n, goal: 1, tone: 'red' },
      { k: 'n100', mark: '100', name: '累計 100 題', desc: '總作答 100 次', v: t.n, goal: 100, tone: 'red' },
      { k: 'n500', mark: '500', name: '累計 500 題', desc: '總作答 500 次', v: t.n, goal: 500, tone: 'red' },
      { k: 'n1000', mark: '1K', name: '累計 1000 題', desc: '總作答 1000 次', v: t.n, goal: 1000, tone: 'gold' },
      { k: 's3', mark: '3', name: '連續 3 天', desc: `最長連續 ${bs} 天`, v: bs, goal: 3, tone: 'green' },
      { k: 's7', mark: '7', name: '連續 7 天', desc: `最長連續 ${bs} 天`, v: bs, goal: 7, tone: 'green' },
      { k: 's30', mark: '30', name: '連續 30 天', desc: `最長連續 ${bs} 天`, v: bs, goal: 30, tone: 'gold' },
      { k: 'ring', mark: '3環', name: '三環全滿', desc: '一天內 20 題、答對 15、正確率 80%', v: perfect, goal: 1, tone: 'cyan' },
      { k: 'day50', mark: '50', name: '單日 50 題', desc: `單日最多 ${maxDay} 題`, v: maxDay, goal: 50, tone: 'cyan' },
      { k: 'e70', mark: '70', name: '模擬考 70 分', desc: best ? `最佳 ${best} 分` : '還沒考過模擬考', v: best, goal: 70, tone: 'blue' },
      { k: 'e85', mark: '85', name: '模擬考 85 分', desc: best ? `最佳 ${best} 分` : '還沒考過模擬考', v: best, goal: 85, tone: 'gold' },
      { k: 'm10', mark: '10', name: '熟練 10 題', desc: '錯題本第 5 盒畢業', v: mastered, goal: 10, tone: 'blue' },
    ].map((a) => ({ ...a, done: a.v >= a.goal, p: Math.min(1, a.v / a.goal) }));
  }

  /* ---------------------------------------------------------------- 圓環 */
  let gid = 0;
  function rings(p, size, opts = {}) {
    const sw = opts.sw || size * 0.11;
    const gap = opts.gap != null ? opts.gap : size * 0.012;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('class', 'fit-rings' + (opts.cls ? ' ' + opts.cls : ''));
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', opts.label || '活動圓環');
    const add = (parent, tag, attrs) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); parent.append(el); return el; };
    const defs = add(svg, 'defs', {});
    const arcs = [];
    RINGS.forEach((R, i) => {
      const id = 'fitg' + ++gid;
      const lg = add(defs, 'linearGradient', { id, x1: '0', y1: '0', x2: '1', y2: '1' });
      add(lg, 'stop', { offset: '0', 'stop-color': R.c1 });
      add(lg, 'stop', { offset: '1', 'stop-color': R.c2 });
      const r = size / 2 - sw / 2 - i * (sw + gap);
      const C = 2 * Math.PI * r;
      const g = add(svg, 'g', { transform: `rotate(-90 ${size / 2} ${size / 2})` });
      add(g, 'circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: R.c1, 'stroke-opacity': '.22', 'stroke-width': sw });
      const v = Math.max(0, p[R.k] || 0);
      const first = add(g, 'circle', { class: 'fit-arc', cx: size / 2, cy: size / 2, r, fill: 'none', stroke: `url(#${id})`, 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-dasharray': C, 'stroke-dashoffset': C });
      arcs.push([first, C * (1 - Math.min(1, v) * 0.9999), v > 0]);
      if (v > 1) {
        const over = add(g, 'circle', { class: 'fit-arc over', cx: size / 2, cy: size / 2, r, fill: 'none', stroke: R.c2, 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-dasharray': C, 'stroke-dashoffset': C });
        arcs.push([over, C * (1 - Math.min(1, v - 1)), true]);
      }
    });
    const go = () => arcs.forEach(([el, off, show]) => { el.style.strokeDashoffset = show ? off : el.getAttribute('stroke-dasharray'); if (!show) el.style.opacity = '0'; });
    if (reduced() || opts.still) { arcs.forEach(([el]) => el.classList.add('still')); go(); }
    else requestAnimationFrame(() => requestAnimationFrame(go));
    return svg;
  }

  /* ---------------------------------------------------------------- 元件 */
  function header(title, sub) {
    return h('header', { class: 'fit-head' },
      h('div', null, h('p', { class: 'fit-date', text: sub }), h('h1', { class: 'fit-title', text: title })),
      h('a', { class: 'fit-avatar', href: '#stats', 'aria-label': '獎章與統計' }, icon('pad')));
  }

  function todayCard() {
    const rec = dayRec(new Date());
    const p = progress(rec);
    const acc = rec.n ? Math.round((rec.c / rec.n) * 100) : 0;
    const vals = [[`${rec.n}`, `/${GOAL.n} 題`], [`${rec.c}`, `/${GOAL.c} 題`], [rec.n ? `${acc}` : '—', `/${GOAL.acc * 100}%`]];
    return h('section', { class: 'fit-card fit-today', 'aria-label': '今天的活動圓環' },
      h('h2', { class: 'fit-h', text: '活動圓環' }),
      h('div', { class: 'fit-today-body' },
        rings(p, 220, { label: `作答 ${rec.n}/${GOAL.n}、答對 ${rec.c}/${GOAL.c}、正確率 ${rec.n ? acc + '%' : '—'}／目標 80%` }),
        h('dl', { class: 'fit-legend' }, RINGS.map((R, i) => h('div', { class: 'fit-leg ' + R.k },
          h('dt', { text: R.label }), h('dd', null, h('b', { text: vals[i][0] }), h('span', { text: vals[i][1] })))))),
      h('div', { class: 'fit-actions' },
        h('a', { class: 'fit-btn primary', href: '#practice' }, icon('fitPlay'), '開始作答'),
        h('a', { class: 'fit-btn', href: '#review' }, '錯題複習', h('span', { class: 'badge', 'data-badge': 'review', hidden: true })),
        h('a', { class: 'fit-btn', href: '#exam', text: '模擬考' })));
  }

  function weekRow() {
    const now = new Date();
    return h('section', { class: 'fit-card fit-week', 'aria-label': '最近 7 天' },
      h('h2', { class: 'fit-h', text: '最近 7 天' }),
      h('div', { class: 'fit-weekrow' }, [6, 5, 4, 3, 2, 1, 0].map((i) => {
        const d = addDays(now, -i);
        const r = dayRec(d);
        return h('div', { class: 'fit-wday' + (i === 0 ? ' today' : '') },
          h('span', { class: 'fit-wl', text: WD[d.getDay()] }),
          rings(progress(r), 60, { sw: 7, gap: 1, label: `${d.getMonth() + 1}/${d.getDate()}：作答 ${r.n}、答對 ${r.c}` }),
          h('span', { class: 'fit-wn', text: r.n ? String(r.n) : '–' }));
      })));
  }

  function trendCard(name, cur, prev, fmt, tone) {
    const up = cur >= prev;
    const same = Math.abs(cur - prev) < 1e-9;
    return h('div', { class: 'fit-trend ' + (same ? 'flat' : up ? 'up ' + tone : 'down') },
      h('span', { class: 'fit-tarrow', 'aria-hidden': 'true' }, icon(same ? 'fitRings' : up ? 'fitUp' : 'fitDown')),
      h('div', { class: 'fit-tbody' },
        h('span', { class: 'fit-tname', text: name }),
        h('b', { class: 'fit-tval', text: fmt(cur) }),
        h('span', { class: 'fit-tprev', text: `前 7 天 ${fmt(prev)}・${same ? '持平' : up ? '↑ 上升' : '↓ 下降'}` })));
  }

  function trends() {
    const a = sumRange(0, 7);
    const b = sumRange(7, 7);
    const pctOf = (x) => (x.n ? x.c / x.n : 0);
    const exams = S().exams;
    const now = Date.now();
    const ex = (lo, hi) => { const xs = exams.filter((e) => now - e.ts >= lo * 864e5 && now - e.ts < hi * 864e5); return xs.length ? xs.reduce((s, e) => s + e.score, 0) / xs.length : 0; };
    return h('section', { class: 'fit-sec' },
      h('div', { class: 'fit-sec-h' }, h('h2', { text: '趨勢' }), h('span', { class: 'fit-muted', text: '最近 7 天 vs 前 7 天' })),
      h('div', { class: 'fit-trends' },
        trendCard('每日平均作答', a.n / 7, b.n / 7, (v) => `${v.toFixed(1)} 題`, 'red'),
        trendCard('正確率', pctOf(a), pctOf(b), (v) => `${Math.round(v * 100)}%`, 'green'),
        trendCard('作答天數', a.active, b.active, (v) => `${v} 天`, 'cyan'),
        trendCard('模擬考平均', ex(0, 7), ex(7, 14), (v) => (v ? `${Math.round(v)} 分` : '—'), 'blue')));
  }

  function medal(a) {
    const deg = Math.round(a.p * 360);
    return h('div', { class: 'fit-medal ' + a.tone + (a.done ? ' done' : ' locked'), role: 'listitem',
      'aria-label': `${a.name}：${a.done ? '已獲得' : `尚未獲得，進度 ${Math.min(a.v, a.goal)} / ${a.goal}`}` },
      h('span', { class: 'fit-badge', style: `--deg:${deg}deg` }, h('span', { class: 'fit-badge-in' }, h('b', { text: a.mark }))),
      h('strong', { text: a.name }),
      h('span', { class: 'fit-mdesc', text: a.done ? a.desc : `${Math.min(a.v, a.goal)} / ${a.goal}` }));
  }

  function awardsSection(all) {
    const list = awards();
    const got = list.filter((a) => a.done).length;
    const shown = all ? list : [...list].sort((x, y) => (y.done - x.done) || (y.p - x.p)).slice(0, 6);
    return h('section', { class: 'fit-sec' },
      h('div', { class: 'fit-sec-h' }, h('h2', { text: '獎章' }), h('span', { class: 'fit-muted', text: `已獲得 ${got} / ${list.length}` }),
        all ? null : h('a', { class: 'fit-link', href: '#stats', text: '顯示全部' })),
      h('div', { class: 'fit-medals', role: 'list' }, shown.map(medal)));
  }

  function history() {
    const now = new Date();
    const start = addDays(now, -now.getDay() - 21);
    const cells = [];
    for (let i = 0; i < 28; i++) {
      const d = addDays(start, i);
      const future = d > now;
      const r = dayRec(d);
      cells.push(h('div', { class: 'fit-hday' + (QG.dayKey(d) === QG.dayKey(now) ? ' today' : '') + (future ? ' future' : '') },
        future ? h('span', { class: 'fit-hblank' }) : rings(progress(r), 44, { sw: 5, gap: 1, still: true, label: `${d.getMonth() + 1}/${d.getDate()}：作答 ${r.n}、答對 ${r.c}` }),
        h('span', { text: String(d.getDate()) })));
    }
    return h('section', { class: 'fit-card' },
      h('h2', { class: 'fit-h', text: '最近 4 週' }),
      h('div', { class: 'fit-hist' }, WD.map((w) => h('span', { class: 'fit-hw', text: w })), cells));
  }

  /* ---------------------------------------------------------------- 畫面 */
  function home() {
    const d = new Date();
    return h('div', { class: 'fit-page' },
      header('摘要', `${d.getMonth() + 1}月${d.getDate()}日 星期${WD[d.getDay()]}`),
      todayCard(),
      weekRow(),
      trends(),
      awardsSection(false));
  }

  function stats(base) {
    const t = QG.totals();
    const el = base.stats();
    el.classList.add('fit-basestats');
    return h('div', { class: 'fit-page' },
      header('紀錄', `累計 ${QG.fmtNum(t.n)} 題・正確率 ${QG.pct(t.c, t.n)}・連續 ${QG.streak()} 天`),
      awardsSection(true),
      history(),
      h('h2', { class: 'fit-subtitle', text: '詳細數據' }),
      el);
  }

  function top(view) {
    const links = [['home', '摘要'], ['practice', '練習'], ['review', '錯題本'], ['exam', '模擬考'], ['browse', '題庫'], ['stats', '獎章']];
    return h('div', { class: 'sk-top fit-top' },
      h('a', { class: 'fit-brand', href: '#home', 'aria-label': 'QuizGrinder 摘要' }, icon('pad', 'fit-brand-ico'), h('span', { text: '健身' })),
      h('nav', { class: 'fit-nav', 'aria-label': '主要功能' }, links.map(([v, l]) => h('a', { href: '#' + v, 'aria-current': SK.isCurrent(view, v) ? 'page' : null }, l,
        v === 'review' ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null))),
      h('a', { class: 'fit-topsearch', href: '#browse', 'aria-label': '題庫' }, icon('search')));
  }

  const NAV = [
    { v: 'home', label: '摘要', icon: 'fitRings' },
    { v: 'practice', label: '練習', icon: 'practice' },
    { v: 'review', label: '錯題', icon: 'review', badge: true },
    { v: 'exam', label: '模擬考', icon: 'exam' },
    { v: 'stats', label: '獎章', icon: 'fitMedal' },
  ];

  SK.register({ id: 'fitness', label: 'Apple 健身風', group: '生活遊戲化', top, nav: NAV, views: { home, stats } });
})();
