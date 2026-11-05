/* QuizGrinder 版面風格：Steam 風（steam）
 *
 * 深藍遊戲平台用戶端：首頁是「收藏庫」——左側清單把每個主題與每份考卷當成一款遊戲（已練 N 題），
 * 選一款顯示主視覺橫幅、綠色「▶ 開始」、題數／已練／正確率／最後作答、該遊戲的成就（由真實紀錄算出）
 * 與近期動態；統計頁是個人檔案（等級＝已解鎖成就數、徽章、最近遊玩）；題庫頁上方加「特別推薦」。
 * 刻意只有一種深色外觀。只借用版面、互動與配色；標誌用 QuizGrinder 的焊墊圖示。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon, hue } = SK;
  const S = () => QG.S();

  Object.assign(SK.ICONS, {
    stPlay: '<path d="M7 4l13 8-13 8z"/>',
    stTrophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8M9 18h6"/>',
    stLock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    stLib: '<path d="M4 4h4v16H4zM10 4h4v16h-4z"/><path d="M16 5l3.5-1 3 15.5-3.5 1z"/>',
    stStore: '<path d="M3 9l2-5h14l2 5"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v7h14v-7"/>',
    stUser: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>',
    stClock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  });

  /* ---------------------------------------------------------------- 遊戲＝主題與考卷 */
  let cache = null;
  function games() {
    if (cache && cache.n === QG.QS.length) return cache.list;
    const official = QG.QS.filter((q) => q.official);
    const list = [];
    QG.TAGS.filter(([t]) => t !== '其他').forEach(([t]) => list.push({ key: 'tag:' + t, kind: 'tag', name: t, short: t.slice(0, 1), ids: official.filter((q) => q.t.includes(t)).map((q) => q.id), tag: t }));
    [...QG.EXAM_MAP.values()].sort((a, b) => (b.year || 0) - (a.year || 0) || b.id.localeCompare(a.id)).forEach((e) => {
      const ids = QG.QS.filter((q) => q.src.some((s) => s.exam === e.id)).map((q) => q.id);
      if (!ids.length) return;
      list.push({ key: 'exam:' + e.id, kind: 'exam', name: e.title, short: e.official ? String(e.year) : '模', ids, exam: e.id });
    });
    cache = { n: QG.QS.length, list };
    return list;
  }

  function info(g) {
    const st = S().q;
    const p = SK.progressOf(g.ids);
    let last = 0, inBox = 0, mastered = 0;
    for (const id of g.ids) { const r = st[id]; if (!r) continue; if (r.t > last) last = r.t; if (r.b > 0) inBox++; if (r.m) mastered++; }
    const len = g.ids.length;
    const half = Math.ceil(len / 2);
    const ach = [
      { name: '初次遊玩', desc: '在這款作答第一題', v: p.seen, goal: 1 },
      { name: '練完一半', desc: `練過 ${half} 題`, v: p.seen, goal: half },
      { name: '全部練過', desc: `練過全部 ${len} 題`, v: p.seen, goal: len },
      { name: '正確率 80%', desc: `至少作答 ${Math.min(10, len)} 次且正確率 80% 以上`, v: p.n >= Math.min(10, len) ? Math.round((p.c / p.n) * 100) : 0, goal: 80,
        state: p.n >= Math.min(10, len) ? `${Math.round((p.c / p.n) * 100)}%` : `作答 ${p.n}/${Math.min(10, len)}` },
      { name: '錯題清零', desc: '練過一半以上且沒有待複習錯題', v: p.seen >= half && !inBox ? 1 : 0, goal: 1 },
      { name: `熟練 ${Math.min(5, len)} 題`, desc: '錯題本第 5 盒畢業', v: mastered, goal: Math.min(5, len) },
    ].map((a) => ({ ...a, done: a.v >= a.goal }));
    return { p, last, inBox, mastered, ach, got: ach.filter((a) => a.done).length };
  }

  function data() {
    const s = S().settings;
    if (!s.skinData) s.skinData = {};
    return s.skinData.steam || (s.skinData.steam = {});
  }
  function selected() {
    const list = games();
    const k = data().sel;
    return list.find((g) => g.key === k) || list[0];
  }
  function gameIcon(g, cls) {
    return h('span', { class: 'st-gico ' + (cls || ''), style: `--h:${hue(g.key)}`, 'aria-hidden': 'true', text: g.short });
  }
  function start(g) {
    QG.startCustomPractice(QG.buildQueue(g.ids, 'weak'), g.kind === 'tag' ? `主題：${g.name}` : g.name);
  }
  const fmtDay = (k) => { const [, m, d] = k.split('-').map(Number); return `${m}月${d}日`; };

  /* ---------------------------------------------------------------- 頂部列 */
  function top(view) {
    const lv = levelInfo();
    const tabs = [['browse', '商店'], ['home', '收藏庫'], ['stats', '個人檔案']];
    return h('div', { class: 'sk-top st-top' },
      h('a', { class: 'st-brand', href: '#home', 'aria-label': 'QuizGrinder 收藏庫' }, icon('pad', 'st-brand-ico'), h('span', { text: 'QUIZGRINDER' })),
      h('nav', { class: 'st-tabs', 'aria-label': '主要功能' }, tabs.map(([v, l]) => h('a', { href: '#' + v, 'aria-current': SK.isCurrent(view, v) ? 'page' : null, text: l }))),
      h('span', { class: 'spacer' }),
      h('a', { class: 'st-topbtn', href: '#exam', 'aria-current': SK.isCurrent(view, 'exam') ? 'page' : null }, '模擬考'),
      h('a', { class: 'st-topbtn', href: '#review', 'aria-current': view === 'review' ? 'page' : null }, '錯題本', h('span', { class: 'badge', 'data-badge': 'review', hidden: true })),
      h('a', { class: 'st-topuser', href: '#stats', 'aria-label': `個人檔案，等級 ${lv.level}` },
        h('span', { class: 'st-avatar sm' }, icon('pad')), h('span', { class: 'st-topname', text: '學員' }), h('span', { class: 'st-lvl sm', text: String(lv.level) })));
  }

  /* ---------------------------------------------------------------- 收藏庫 */
  const libUI = { q: '' };
  function libList(sel) {
    const list = games();
    const box = h('div', { class: 'st-list' });
    const draw = () => {
      const kw = libUI.q.trim().toLowerCase();
      const group = (kind, title) => {
        const items = list.filter((g) => g.kind === kind && (!kw || g.name.toLowerCase().includes(kw)));
        if (!items.length) return null;
        return h('div', { class: 'st-group' },
          h('h3', { class: 'st-group-h' }, title, h('span', { text: ` (${items.length})` })),
          items.map((g) => {
            const p = SK.progressOf(g.ids);
            return h('button', { type: 'button', class: 'st-item' + (g.key === sel.key ? ' on' : '') + (p.seen ? '' : ' unplayed'), 'aria-current': g.key === sel.key ? 'true' : null,
              onclick: () => { data().sel = g.key; QG.Store.save(); QG.render(); } },
              gameIcon(g), h('span', { class: 'st-item-name', text: g.name }), h('span', { class: 'st-item-sub', text: p.seen ? `已練 ${p.seen} 題` : '未遊玩' }));
          }));
      };
      fill(box, group('tag', '主題'), group('exam', '考卷'));
      if (!box.children.length) box.append(h('p', { class: 'st-empty', text: '沒有符合的項目' }));
    };
    const input = h('input', { type: 'search', class: 'st-filter', placeholder: '搜尋', value: libUI.q, 'aria-label': '搜尋收藏庫', oninput: (e) => { libUI.q = e.target.value; draw(); } });
    draw();
    return h('aside', { class: 'st-lib-side', 'aria-label': '收藏庫清單' },
      h('div', { class: 'st-lib-home' }, icon('stLib'), h('span', { text: '首頁' }), h('span', { class: 'st-count', text: `${list.length} 款` })),
      h('div', { class: 'st-filterwrap' }, icon('search'), input), box);
  }

  function activity(g) {
    const st = S();
    const ids = new Set(g.ids);
    const byDay = {};
    for (const [id, r] of Object.entries(st.q)) if (ids.has(id) && r.t) { const k = QG.dayKey(new Date(r.t)); byDay[k] = (byDay[k] || 0) + 1; }
    const exByDay = {};
    st.exams.forEach((e) => { const k = QG.dayKey(new Date(e.ts)); (exByDay[k] || (exByDay[k] = [])).push(e); });
    const keys = [...new Set([...Object.keys(st.days).filter((k) => st.days[k].n), ...Object.keys(exByDay)])].sort().reverse().slice(0, 6);
    return h('section', { class: 'st-panel st-activity' },
      h('h2', { class: 'st-panel-h', text: '近期動態' }),
      keys.length ? keys.map((k) => {
        const d = st.days[k];
        return h('div', { class: 'st-act' },
          h('h4', { class: 'st-act-date', text: k === QG.dayKey() ? '今天' : fmtDay(k) }),
          d && d.n ? h('div', { class: 'st-act-row' }, h('span', { class: 'st-avatar xs' }, icon('pad')),
            h('p', null, h('b', { text: '你' }), ` 作答了 ${d.n} 題，答對 ${d.c} 題（${QG.pct(d.c, d.n)}）`,
              byDay[k] ? h('span', { class: 'st-act-game' }, `，其中 ${byDay[k]} 題的最後一次作答是在「${g.name}」`) : null)) : null,
          (exByDay[k] || []).map((e) => h('div', { class: 'st-act-row' }, h('span', { class: 'st-avatar xs' }, icon('stTrophy')),
            h('p', null, h('b', { text: '你' }), ` 完成了模擬考 ${QG.SUBJ_CODE[e.subject] || ''}，得到 `, h('b', { class: 'st-hl', text: `${e.score} 分` }), `（${e.correct}/${e.total}）`))));
      }) : h('p', { class: 'st-empty', text: '還沒有任何動態。按「▶ 開始」玩第一局吧。' }));
  }

  function achPanel(g, inf) {
    const pct = Math.round((inf.got / inf.ach.length) * 100);
    return h('section', { class: 'st-panel st-ach' },
      h('h2', { class: 'st-panel-h', text: '成就' }),
      h('p', { class: 'st-ach-sum' }, `已解鎖 ${inf.got} / ${inf.ach.length}`, h('span', { text: `（${pct}%）` })),
      h('span', { class: 'st-bar', role: 'img', 'aria-label': `成就進度 ${pct}%` }, h('i', { style: `width:${pct}%` })),
      h('ul', { class: 'st-achlist' }, inf.ach.map((a) => h('li', { class: a.done ? 'done' : 'locked' },
        h('span', { class: 'st-achico', style: `--h:${hue(g.key + a.name)}` }, icon(a.done ? 'stTrophy' : 'stLock')),
        h('span', { class: 'st-achtext' }, h('strong', { text: a.name }), h('span', { text: a.desc }),
          !a.done && a.goal > 1 ? h('span', { class: 'st-bar thin' }, h('i', { style: `width:${Math.round(Math.min(1, a.v / a.goal) * 100)}%` })) : null),
        h('span', { class: 'st-achstate', text: a.done ? '已解鎖' : a.state || `${Math.min(a.v, a.goal)}/${a.goal}` })))));
  }

  function library() {
    const g = selected();
    const inf = info(g);
    const p = inf.p;
    const len = g.ids.length;
    const browseIt = () => { Object.assign(QG.browse, { kw: '', tag: g.tag || '', exam: g.exam || '', subject: 'all', limit: 30 }); SK.go('browse'); };
    return h('div', { class: 'st-lib' },
      libList(g),
      h('div', { class: 'st-game' },
        h('header', { class: 'st-hero', style: `--h:${hue(g.key)}` },
          h('span', { class: 'st-hero-art', 'aria-hidden': 'true' }, icon('pad', 'st-hero-ico')),
          h('div', { class: 'st-hero-text' },
            h('span', { class: 'st-hero-kind', text: g.kind === 'tag' ? '主題練習' : '歷屆考卷' }),
            h('h1', { class: 'st-hero-title', text: g.name }))),
        h('div', { class: 'st-playbar' },
          h('button', { type: 'button', class: 'st-play', onclick: () => start(g) }, icon('stPlay'), h('span', { text: '開始' })),
          h('dl', { class: 'st-stats' },
            h('div', null, h('dt', { text: '題數' }), h('dd', { text: String(len) })),
            h('div', null, h('dt', { text: '已練' }), h('dd', { text: `${p.seen} 題` })),
            h('div', null, h('dt', { text: '正確率' }), h('dd', { text: QG.pct(p.c, p.n) })),
            h('div', null, h('dt', { text: '最後作答' }), h('dd', { text: inf.last ? SK.relTime(inf.last) : '從未' })),
            h('div', null, h('dt', { text: '成就' }), h('dd', null, `${inf.got}/${inf.ach.length}`, h('span', { class: 'st-bar inline' }, h('i', { style: `width:${Math.round((inf.got / inf.ach.length) * 100)}%` }))))),
          h('div', { class: 'st-playbar-r' },
            inf.inBox ? h('button', { type: 'button', class: 'st-btn', text: `複習錯題 ${inf.inBox}`, onclick: () => QG.startReview(g.ids.filter((id) => (S().q[id] || {}).b > 0)) }) : null,
            h('button', { type: 'button', class: 'st-btn', text: '瀏覽題目', onclick: browseIt }))),
        h('div', { class: 'st-cols' },
          h('div', { class: 'st-col-main' }, activity(g)),
          h('div', { class: 'st-col-side' }, achPanel(g, inf),
            h('section', { class: 'st-panel' }, h('h2', { class: 'st-panel-h', text: '進度' }),
              h('p', { class: 'st-note', text: `已練 ${p.seen} / ${len} 題（${Math.round((p.seen / len) * 100)}%）` }),
              h('span', { class: 'st-bar' }, h('i', { style: `width:${Math.round((p.seen / len) * 100)}%` })),
              h('p', { class: 'st-note', text: `錯題本中 ${inf.inBox} 題・已熟練 ${inf.mastered} 題` }))))));
  }

  /* ---------------------------------------------------------------- 個人檔案 */
  function levelInfo() {
    let level = 0, perfect = 0, played = 0;
    for (const g of games()) { const i = info(g); level += i.got; if (i.got === i.ach.length) perfect++; if (i.p.seen) played++; }
    return { level, perfect, played };
  }

  function profile(base) {
    const lv = levelInfo();
    const t = QG.totals();
    const list = games().map((g) => ({ g, i: info(g) }));
    const recent = list.filter((x) => x.i.last).sort((a, b) => b.i.last - a.i.last).slice(0, 4);
    const badges = list.filter((x) => x.i.got > 0).sort((a, b) => b.i.got - a.i.got).slice(0, 12);
    const el = base.stats();
    el.classList.add('st-basestats');
    const ring = lv.level >= 100 ? 'r100' : lv.level >= 50 ? 'r50' : lv.level >= 20 ? 'r20' : lv.level >= 10 ? 'r10' : 'r0';
    return h('div', { class: 'st-profile' },
      h('header', { class: 'st-prof-head' },
        h('span', { class: 'st-avatar big' }, icon('pad')),
        h('div', { class: 'st-prof-id' }, h('h1', { text: 'QuizGrinder 學員' }), h('p', { text: 'IPAS 初級電路板製程工程師備考中' })),
        h('div', { class: 'st-prof-lv' }, h('span', { text: '等級' }), h('span', { class: 'st-lvl ' + ring, text: String(lv.level) }), h('small', { text: '＝已解鎖成就數' }))),
      h('div', { class: 'st-prof-body' },
        h('div', { class: 'st-col-main' },
          h('section', { class: 'st-panel' }, h('h2', { class: 'st-panel-h', text: '徽章' }),
            badges.length ? h('div', { class: 'st-badges' }, badges.map(({ g, i }) => h('button', { type: 'button', class: 'st-badge' + (i.got === i.ach.length ? ' perfect' : ''),
              title: `${g.name}：${i.got}/${i.ach.length} 成就`, onclick: () => { data().sel = g.key; QG.Store.save(); SK.go('home'); } },
              gameIcon(g, 'big'), h('span', { class: 'st-badge-n', text: `${i.got}/${i.ach.length}` }), h('span', { class: 'st-badge-t', text: g.name }))))
              : h('p', { class: 'st-empty', text: '解鎖第一個成就後，徽章會出現在這裡。' })),
          h('section', { class: 'st-panel' }, h('h2', { class: 'st-panel-h', text: '最近遊玩' }),
            recent.length ? recent.map(({ g, i }) => h('div', { class: 'st-recent' },
              gameIcon(g, 'mid'),
              h('div', { class: 'st-recent-t' }, h('button', { type: 'button', class: 'st-linkbtn', text: g.name, onclick: () => { data().sel = g.key; QG.Store.save(); SK.go('home'); } }),
                h('span', { text: `已練 ${i.p.seen}/${g.ids.length} 題・最後作答 ${SK.relTime(i.last)}` })),
              h('div', { class: 'st-recent-ach' }, h('span', { text: `成就 ${i.got}/${i.ach.length}` }), h('span', { class: 'st-bar' }, h('i', { style: `width:${Math.round((i.got / i.ach.length) * 100)}%` })))))
              : h('p', { class: 'st-empty', text: '還沒有遊玩紀錄。' }))),
        h('aside', { class: 'st-col-side' },
          h('section', { class: 'st-panel st-prof-stats' }, h('h2', { class: 'st-panel-h', text: '統計' }),
            [['遊玩過', `${lv.played} / ${list.length} 款`], ['成就', `${lv.level} 個`], ['全成就', `${lv.perfect} 款`], ['總作答', QG.fmtNum(t.n)], ['正確率', QG.pct(t.c, t.n)], ['連續天數', `${QG.streak()} 天`], ['模擬考', `${S().exams.length} 場`]]
              .map(([k, v]) => h('div', { class: 'st-kv' }, h('span', { text: k }), h('b', { text: v })))))),
      h('h2', { class: 'st-sec-h', text: '詳細數據' }),
      el);
  }

  /* ---------------------------------------------------------------- 商店：特別推薦 */
  function store(base) {
    const hot = QG.QS.filter((q) => q.src.length > 1);
    const sets = [
      { t: '高頻題合輯', s: `考過 2 次以上・${hot.length} 題`, ids: hot.map((q) => q.id), big: true },
      { t: '最常考', s: `考過 3 次・${hot.filter((q) => q.src.length > 2).length} 題`, ids: hot.filter((q) => q.src.length > 2).map((q) => q.id) },
      { t: 'L11 高頻', s: `${hot.filter((q) => q.s === 'industry').length} 題`, ids: hot.filter((q) => q.s === 'industry').map((q) => q.id) },
      { t: 'L12 高頻', s: `${hot.filter((q) => q.s === 'process').length} 題`, ids: hot.filter((q) => q.s === 'process').map((q) => q.id) },
    ].filter((x) => x.ids.length);
    const el = base.browse();
    el.classList.add('wide');
    return h('div', { class: 'st-store' },
      h('section', { class: 'st-feature' },
        h('h2', { class: 'st-sec-h', text: '特別推薦' }),
        h('div', { class: 'st-caps' }, sets.map((x) => {
          const p = SK.progressOf(x.ids);
          return h('button', { type: 'button', class: 'st-cap' + (x.big ? ' big' : ''), style: `--h:${hue(x.t)}`, onclick: () => QG.startCustomPractice(QG.buildQueue(x.ids, 'weak'), x.t) },
            h('span', { class: 'st-cap-art' }, icon('pad', 'st-cap-ico'), h('b', { text: x.t })),
            h('span', { class: 'st-cap-foot' }, h('span', { text: x.s }), h('span', { class: 'st-price', text: p.seen ? `已練 ${p.seen}` : '免費遊玩' })));
        }))),
      el);
  }

  const NAV = [
    { v: 'browse', label: '商店', icon: 'stStore' },
    { v: 'home', label: '收藏庫', icon: 'stLib' },
    { v: 'exam', label: '模擬考', icon: 'exam' },
    { v: 'review', label: '錯題', icon: 'review', badge: true },
    { v: 'stats', label: '個人檔案', icon: 'stUser' },
  ];

  SK.register({ id: 'steam', label: 'Steam 風', group: '生活遊戲化', top, nav: NAV, views: { home: library, stats: profile, browse: store } });
})();
