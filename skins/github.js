/* QuizGrinder 版面風格：GitHub 風（個人頁／儀表板）
 *
 *   概覽：個人側欄、釘選的「儲存庫」（＝主題）、過去一年作答熱度圖（QG.S().days）、作答動態
 *   主題：全部主題的儲存庫清單
 *   Issues（錯題本）：答錯過的題目就是 issue——在錯題盒（b>0）為 Open，曾答錯但已移出錯題盒為 Closed；
 *          issue 頁可直接作答，答對後可「Close issue」（把錯題盒歸零並存檔），時間軸只列真實紀錄
 * 只借用版面、互動與配色；標誌用 QuizGrinder 焊墊圖示，頭像是自己的幾何圖樣。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon, hue } = SK;
  const S = () => QG.S();
  const DAY = 864e5;
  const LOGIN = 'quizgrinder-learner';

  Object.assign(SK.ICONS, {
    'gh-repo': '<path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v16H7.5A2.5 2.5 0 0 0 5 20.5z"/><path d="M5 20.5A2.5 2.5 0 0 0 7.5 23H19v-5M9 18v5l1.5-1.2L12 23v-5"/>',
    'gh-book': '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
    'gh-open': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
    'gh-closed': '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16.5 9.5"/>',
    'gh-check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'gh-x': '<path d="M7 7l10 10M17 7L7 17"/>',
    'gh-clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'gh-flame': '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-4-12-3 2-5 5-5 8-1-1-2-2-2-4-2 2-3 5-3 8 0 4 3 7 7 7z"/>',
    'gh-pulse': '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    'gh-pin': '<path d="M15 3l6 6-3 1-4 4 1 5-2 2-4-4-5 5M9 15l-4-4 2-2 5 1 4-4 1-3"/>',
    'gh-tag': '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    'gh-box': '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
    'gh-back': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    'gh-trophy': '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/>',
  });

  let NUM = null;
  const numOf = (id) => {
    if (!NUM) { NUM = new Map(); QG.QS.forEach((q, i) => NUM.set(q.id, i + 1)); }
    return NUM.get(id) || 0;
  };
  const topics = (q) => q.t.filter((t) => t !== '其他');
  const short = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);
  const fmtDay = (ts) => { const d = new Date(ts); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`; };
  const fmtDT = (ts) => new Date(ts).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' });
  const label = (t) => h('span', { class: 'gh-label', style: `--h:${hue(t)}`, text: t });

  /** 幾何頭像（5×5 左右對稱，由字串雜湊產生） */
  function identicon(seed, cls) {
    let x = 0;
    for (const ch of seed) x = (x * 131 + ch.codePointAt(0)) >>> 0;
    const hh = x % 360;
    const cells = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
      x = (x * 1103515245 + 12345) >>> 0;
      if ((x >>> 16) & 1) { cells.push([r, c]); if (c < 2) cells.push([r, 4 - c]); }
    }
    const span = document.createElement('span');
    span.className = 'gh-avatar ' + (cls || '');
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = `<svg viewBox="-0.5 -0.5 6 6"><rect x="-0.5" y="-0.5" width="6" height="6" fill="var(--gh-avatar-bg)"/>${cells.map(([r, c]) => `<rect x="${c + 0.5 - 0.5}" y="${r}" width="1.02" height="1.02" fill="hsl(${hh} 55% 55%)"/>`).join('')}</svg>`;
    return span;
  }

  /* ---------------------------------------------------------------- 資料 */
  function issues() {
    const st = S().q;
    const open = [], closed = [];
    for (const [id, r] of Object.entries(st)) {
      if (!QG.QMAP.has(id)) continue;
      if (r.b > 0) open.push(id);
      else if (r.w > 0) closed.push(id);
    }
    open.sort((a, b) => (st[a].d || 0) - (st[b].d || 0));
    closed.sort((a, b) => (st[b].t || 0) - (st[a].t || 0));
    return { open, closed };
  }

  function topicRepos() {
    const st = S().q;
    return QG.TAGS.filter(([t]) => t !== '其他').map(([t]) => {
      const qs = QG.QS.filter((q) => q.t.includes(t));
      const ids = qs.map((q) => q.id);
      const p = SK.progressOf(ids);
      const l11 = qs.filter((q) => q.s === 'industry').length;
      const stars = ids.filter((id) => st[id] && st[id].s).length;
      let last = 0;
      for (const id of ids) if (st[id] && st[id].t > last) last = st[id].t;
      return { t, ids, n: ids.length, p, l11, l12: ids.length - l11, stars, last, main: l11 >= ids.length - l11 ? 'industry' : 'process' };
    });
  }

  /* ---------------------------------------------------------------- 熱度圖 */
  function heatmap() {
    const days = S().days;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today); start.setDate(start.getDate() - start.getDay() - 52 * 7);
    const cells = [];
    let total = 0, max = 0;
    for (let d = new Date(start), i = 0; d <= today; d.setDate(d.getDate() + 1), i++) {
      const k = QG.dayKey(d);
      const v = days[k] || { n: 0, c: 0 };
      total += v.n; max = Math.max(max, v.n);
      cells.push({ k, n: v.n, c: v.c, col: Math.floor(i / 7), row: d.getDay(), m: d.getMonth(), date: d.getDate(), y: d.getFullYear() });
    }
    const lvl = (n) => (!n ? 0 : Math.min(4, Math.max(1, Math.ceil((n / max) * 4))));
    const grid = h('div', { class: 'gh-graph', role: 'img', 'aria-label': `過去一年共 ${total} 次作答的每日熱度圖` });
    // 月份標籤：每欄第一天換月時標出
    let prevM = -1;
    for (let col = 0; col <= cells[cells.length - 1].col; col++) {
      const first = cells.find((c) => c.col === col);
      if (first && first.m !== prevM) {
        if (col < 52 || prevM === -1) grid.append(h('span', { class: 'gh-mlab', style: `grid-column:${col + 2} / span 3;grid-row:1`, text: `${first.m + 1}月` }));
        prevM = first.m;
      }
    }
    [['一', 2], ['三', 4], ['五', 6]].forEach(([t, r]) => grid.append(h('span', { class: 'gh-dlab', style: `grid-row:${r + 1};grid-column:1`, text: t })));
    for (const c of cells) {
      grid.append(h('span', { class: 'gh-cell l' + lvl(c.n), style: `grid-column:${c.col + 2};grid-row:${c.row + 2}`,
        title: c.n ? `${c.y}/${c.m + 1}/${c.date}：作答 ${c.n} 次，答對 ${c.c} 次` : `${c.y}/${c.m + 1}/${c.date}：沒有作答` }));
    }
    const active = cells.filter((c) => c.n).length;
    return h('section', { class: 'gh-section' },
      h('h2', { class: 'gh-h2', text: `過去一年共 ${QG.fmtNum(total)} 次作答` }),
      h('div', { class: 'gh-graph-box' },
        h('div', { class: 'gh-graph-scroll' }, grid),
        h('div', { class: 'gh-graph-foot' },
          h('span', { class: 'gh-muted', text: `${active} 天有作答・最長單日 ${max} 次` }),
          h('span', { class: 'gh-legend' }, h('span', { text: '少' }), [0, 1, 2, 3, 4].map((l) => h('span', { class: 'gh-cell l' + l, 'aria-hidden': 'true' })), h('span', { text: '多' })))));
  }

  /* ---------------------------------------------------------------- 外框 */
  const ghState = { tab: 'overview', issue: null, filter: 'open', label: '', limit: 25, repoQ: '' };

  function top(view) {
    const { open } = issues();
    const input = h('input', { type: 'search', id: 'gh-q', placeholder: '輸入 / 搜尋題目', 'aria-label': '搜尋題目', value: '' });
    const tab = (key, ico, text, href, count, onclick) => {
      const cur = key === 'overview' ? view === 'home' && ghState.tab === 'overview' : key === 'repos' ? view === 'home' && ghState.tab === 'repos' : SK.isCurrent(view, key);
      return h('a', { class: 'gh-unav-item', href, 'aria-current': cur ? 'page' : null, onclick }, icon(ico), h('span', { text }),
        count !== undefined ? h('span', { class: 'gh-counter', text: QG.fmtNum(count) }) : null);
    };
    return h('div', { class: 'gh-top' },
      h('div', { class: 'sk-top gh-head' },
        h('a', { class: 'gh-logo', href: '#home', 'aria-label': 'QuizGrinder 首頁', onclick: () => { ghState.tab = 'overview'; } }, icon('pad')),
        h('a', { class: 'gh-ctx', href: '#home', onclick: () => { ghState.tab = 'overview'; }, text: LOGIN }),
        h('form', { class: 'gh-search', role: 'search', onsubmit: (e) => { e.preventDefault(); QG.browse.kw = input.value.trim(); QG.browse.limit = 30; SK.go('browse'); } },
          icon('search'), input, h('kbd', { text: '/' })),
        h('div', { class: 'sk-right' },
          h('a', { class: 'gh-iconbtn', href: '#review', 'aria-label': 'Issues（錯題本）', title: 'Issues', onclick: () => { ghState.issue = null; } }, icon('gh-open'), h('span', { class: 'badge', 'data-badge': 'review', hidden: true })),
          h('a', { class: 'gh-iconbtn', href: '#practice', 'aria-label': '開始練習', title: '開始練習' }, icon('practice')),
          h('a', { href: '#stats', 'aria-label': '我的統計', class: 'gh-avlink' }, identicon(LOGIN, 'sm')))),
      h('nav', { class: 'gh-unav', 'aria-label': '個人頁分頁' },
        tab('overview', 'gh-book', '概覽', '#home', undefined, () => { ghState.tab = 'overview'; if (location.hash === '#home') QG.render(); }),
        tab('repos', 'gh-repo', '主題', '#home', QG.TAGS.filter(([t]) => t !== '其他').length, () => { ghState.tab = 'repos'; if (location.hash === '#home') QG.render(); }),
        tab('review', 'gh-open', 'Issues', '#review', open.length, () => { ghState.issue = null; }),
        tab('practice', 'practice', '練習', '#practice'),
        tab('exam', 'exam', '模擬考', '#exam'),
        tab('browse', 'browse', '題庫', '#browse'),
        tab('stats', 'gh-pulse', '統計', '#stats')));
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || SK.skin() !== 'github' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
    const q = document.getElementById('gh-q');
    if (q) { e.preventDefault(); q.focus(); }
  });

  /* ---------------------------------------------------------------- 個人頁 */
  function profileSide() {
    const t = QG.totals();
    const st = S();
    const best = st.exams.reduce((a, e) => Math.max(a, e.score), 0);
    const meta = (ico, text) => h('li', null, icon(ico), h('span', { text }));
    return h('aside', { class: 'gh-profile' },
      identicon(LOGIN, 'xl'),
      h('div', { class: 'gh-names' }, h('h1', { class: 'gh-name', text: '我的學習' }), h('p', { class: 'gh-login', text: LOGIN })),
      h('p', { class: 'gh-bio', text: 'IPAS 初級電路板製程工程師備考中。L11 產業概論・L12 製造概論。' }),
      h('a', { class: 'gh-btn block', href: '#practice', text: '開始練習' }),
      h('ul', { class: 'gh-meta' },
        meta('gh-book', `已練 ${QG.fmtNum(t.seen)} / ${QG.fmtNum(QG.QS.length)} 題`),
        meta('gh-check', `總正確率 ${QG.pct(t.c, t.n)}（${QG.fmtNum(t.c)} / ${QG.fmtNum(t.n)}）`),
        meta('gh-flame', `連續 ${QG.streak()} 天`),
        meta('gh-trophy', st.exams.length ? `模擬考 ${st.exams.length} 場・最佳 ${best} 分` : '還沒有模擬考紀錄')));
  }

  function repoCard(r, pinned) {
    return h('div', { class: 'gh-repo' + (pinned ? ' pinned' : '') },
      h('div', { class: 'gh-repo-head' }, icon('gh-repo'),
        h('button', { type: 'button', class: 'gh-repo-name', text: r.t, onclick: () => QG.startCustomPractice(r.ids, `主題：${r.t}`) }),
        h('span', { class: 'gh-pill', text: '主題' })),
      h('p', { class: 'gh-repo-desc', text: `L11 ${r.l11} 題・L12 ${r.l12} 題。已練 ${r.p.seen} 題` + (r.last ? `，最後作答 ${SK.relTime(r.last)}` : '，尚未作答') + '。' }),
      h('div', { class: 'gh-repo-foot' },
        h('span', { class: 'gh-lang' }, h('span', { class: 'gh-dot', style: `--h:${hue(r.t)}` }), h('span', { text: QG.SUBJ_SHORT[r.main] })),
        h('span', { title: '題數' }, icon('gh-book'), h('span', { text: QG.fmtNum(r.n) })),
        h('span', { title: '你的正確率' }, icon('gh-check'), h('span', { text: QG.pct(r.p.c, r.p.n) })),
        h('span', { title: '你收藏的題數' }, icon('star'), h('span', { text: String(r.stars) }))),
      pinned ? null : h('div', { class: 'gh-repo-bar', title: `已練 ${r.p.seen} / ${r.n}` }, h('i', { style: `width:${Math.round((r.p.seen / r.n) * 100)}%` })));
  }

  function activity() {
    const st = S();
    const items = [];
    for (const [k, v] of Object.entries(st.days)) if (v.n) items.push({ ts: new Date(k + 'T12:00:00').getTime(), kind: 'day', k, v });
    for (const e of st.exams) items.push({ ts: e.ts, kind: 'exam', e });
    items.sort((a, b) => b.ts - a.ts);
    const list = items.slice(0, 10);
    if (!list.length) return h('section', { class: 'gh-section' }, h('h2', { class: 'gh-h2', text: '作答動態' }), h('p', { class: 'gh-blank', text: '還沒有作答紀錄。開始練習後，每天的作答會出現在這裡。' }));
    let prevMonth = '';
    return h('section', { class: 'gh-section' }, h('h2', { class: 'gh-h2', text: '作答動態' }),
      h('div', { class: 'gh-activity' }, list.map((it) => {
        const d = new Date(it.ts);
        const m = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
        const head = m !== prevMonth ? h('h3', { class: 'gh-month' }, h('span', { text: m })) : null;
        prevMonth = m;
        const body = it.kind === 'day'
          ? h('div', { class: 'gh-act' }, h('span', { class: 'gh-act-ico' }, icon('gh-pulse')),
            h('div', { class: 'gh-act-main' },
              h('p', null, `作答 `, h('b', { text: String(it.v.n) }), ` 題，答對 ${it.v.c} 題`),
              h('div', { class: 'gh-act-bar' }, h('i', { class: 'ok', style: `width:${Math.round((it.v.c / it.v.n) * 100)}%` }), h('i', { class: 'ng', style: `width:${Math.round(((it.v.n - it.v.c) / it.v.n) * 100)}%` }))),
            h('time', { class: 'gh-muted', text: `${d.getMonth() + 1}月${d.getDate()}日` }))
          : h('div', { class: 'gh-act' }, h('span', { class: 'gh-act-ico' }, icon('gh-trophy')),
            h('div', { class: 'gh-act-main' }, h('p', null, `完成模擬考 ${QG.SUBJ_CODE[it.e.subject]} ${QG.SUBJ_SHORT[it.e.subject]}：`, h('b', { text: `${it.e.score} 分` }), `（${it.e.correct}/${it.e.total}）`)),
            h('time', { class: 'gh-muted', text: `${d.getMonth() + 1}月${d.getDate()}日` }));
        return [head, body];
      })));
  }

  function homeView() {
    const repos = topicRepos();
    let main;
    if (ghState.tab === 'repos') {
      const input = h('input', { type: 'search', class: 'gh-input', placeholder: '尋找主題…', value: ghState.repoQ, 'aria-label': '尋找主題' });
      const listEl = h('div', { class: 'gh-repolist' });
      const draw = () => {
        const kw = ghState.repoQ.trim();
        const rs = repos.filter((r) => !kw || r.t.includes(kw));
        fill(listEl, rs.length ? rs.map((r) => repoCard(r, false)) : h('p', { class: 'gh-blank', text: '沒有符合的主題。' }));
      };
      input.addEventListener('input', () => { ghState.repoQ = input.value; draw(); });
      draw();
      main = h('div', { class: 'gh-main' }, h('div', { class: 'gh-repo-tools' }, input, h('a', { class: 'gh-btn primary', href: '#browse', text: '瀏覽題庫' })), listEl);
    } else {
      const pinned = repos.slice(0, 6);
      main = h('div', { class: 'gh-main' },
        h('section', { class: 'gh-section' },
          h('div', { class: 'gh-sec-head' }, h('h2', { class: 'gh-h2' }, '釘選的主題'), h('button', { type: 'button', class: 'gh-link', text: `全部 ${repos.length} 個主題`, onclick: () => { ghState.tab = 'repos'; QG.render(); } })),
          h('div', { class: 'gh-pins' }, pinned.map((r) => repoCard(r, true)))),
        heatmap(),
        activity());
    }
    return h('div', { class: 'gh-container gh-user' }, profileSide(), main);
  }

  /* ---------------------------------------------------------------- Issues */
  function issueRow(id) {
    const q = QG.QMAP.get(id);
    const r = S().q[id];
    const isOpen = r.b > 0;
    const meta = [`#${numOf(id)}`, `答錯 ${r.w} 次`, `最後作答 ${SK.relTime(r.t)}`];
    if (isOpen) meta.push(`第 ${r.b} 盒・${r.d && r.d <= Date.now() ? '已到期' : '下次複習 ' + (r.d ? `${new Date(r.d).getMonth() + 1}/${new Date(r.d).getDate()}` : '—')}`);
    else if (r.m) meta.push('已熟練');
    return h('div', { class: 'gh-irow' },
      h('span', { class: 'gh-istate ' + (isOpen ? 'open' : 'closed'), title: isOpen ? 'Open' : 'Closed' }, icon(isOpen ? 'gh-open' : 'gh-closed')),
      h('div', { class: 'gh-imain' },
        h('div', { class: 'gh-ititle' },
          h('a', { href: '#review', class: 'gh-ilink', onclick: (e) => { e.preventDefault(); ghState.issue = id; QG.render(); window.scrollTo(0, 0); }, text: short(q.q, 70) }),
          ' ', topics(q).map(label)),
        h('p', { class: 'gh-imeta', text: meta.join(' · ') })),
      h('span', { class: 'gh-icount', title: `作答 ${r.c + r.w} 次` }, icon('comment'), h('span', { text: String(r.c + r.w) })));
  }

  function issuesList(finished) {
    const { open, closed } = issues();
    const all = ghState.filter === 'open' ? open : closed;
    const lab = ghState.label;
    const list = lab ? all.filter((id) => QG.QMAP.get(id).t.includes(lab)) : all;
    const counts = new Map();
    for (const id of open.concat(closed)) for (const t of topics(QG.QMAP.get(id))) counts.set(t, (counts.get(t) || 0) + 1);
    const due = QG.dueReviewIds().length;
    const filt = (k) => ghState.filter === k;
    return h('div', { class: 'gh-container gh-issues' },
      finished ? h('div', { class: 'gh-flash ok' }, icon('gh-check'), `這批複習完成：答對 ${finished.c} / ${finished.n}`) : null,
      h('div', { class: 'gh-itools' },
        h('div', { class: 'gh-filterbox' }, icon('search'), h('span', { class: 'gh-mono', text: `is:issue is:${ghState.filter}${lab ? ` label:${lab}` : ''}` })),
        h('button', { type: 'button', class: 'gh-btn primary', disabled: due ? null : true, onclick: () => QG.startReview() }, due ? `開始複習 ${due} 題` : '沒有到期的 issue')),
      h('div', { class: 'gh-labels-bar', role: 'group', 'aria-label': '依標籤（主題）篩選' },
        h('span', { class: 'gh-muted' }, icon('gh-tag'), ' Labels'),
        [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => h('button', { type: 'button', class: 'gh-label btn', style: `--h:${hue(t)}`, 'aria-pressed': lab === t ? 'true' : 'false',
          onclick: () => { ghState.label = lab === t ? '' : t; ghState.limit = 25; QG.render(); } }, `${t} ${n}`)),
        lab ? h('button', { type: 'button', class: 'gh-link', text: '× 清除篩選', onclick: () => { ghState.label = ''; QG.render(); } }) : null),
      h('div', { class: 'gh-box' },
        h('div', { class: 'gh-box-head' },
          h('button', { type: 'button', class: 'gh-statebtn' + (filt('open') ? ' on' : ''), 'aria-pressed': filt('open') ? 'true' : 'false', onclick: () => { ghState.filter = 'open'; ghState.limit = 25; QG.render(); } },
            icon('gh-open'), `${QG.fmtNum(lab ? open.filter((id) => QG.QMAP.get(id).t.includes(lab)).length : open.length)} Open`),
          h('button', { type: 'button', class: 'gh-statebtn' + (filt('closed') ? ' on' : ''), 'aria-pressed': filt('closed') ? 'true' : 'false', onclick: () => { ghState.filter = 'closed'; ghState.limit = 25; QG.render(); } },
            icon('gh-closed'), `${QG.fmtNum(lab ? closed.filter((id) => QG.QMAP.get(id).t.includes(lab)).length : closed.length)} Closed`)),
        list.length ? list.slice(0, ghState.limit).map(issueRow)
          : h('div', { class: 'gh-blankslate' }, icon(ghState.filter === 'open' ? 'gh-open' : 'gh-closed'),
            h('h3', { text: ghState.filter === 'open' ? '沒有 open 的 issue' : '沒有 closed 的 issue' }),
            h('p', { class: 'gh-muted', text: ghState.filter === 'open' ? '答錯的題目會開成 issue（進錯題本）。' : '答錯過、後來移出錯題盒的題目會顯示為 closed。' })),
        list.length > ghState.limit ? h('button', { type: 'button', class: 'gh-more', onclick: () => { ghState.limit += 25; QG.render(); } }, `載入更多（還有 ${list.length - ghState.limit} 個）`) : null),
      h('p', { class: 'gh-tip' }, icon('info'), ' Open＝目前在錯題盒（第 1–5 盒）；Closed＝曾經答錯、現在不在錯題盒。答對 open 的 issue 後可以直接關閉。'));
  }

  function issuePage(id) {
    const q = QG.QMAP.get(id);
    let note = null; // 本次頁面上剛發生的事
    const rec = () => S().q[id] || { c: 0, w: 0 };
    const statusEl = h('div', { class: 'gh-istatus' });
    const boxEl = h('p');
    const timeline = h('div', { class: 'gh-timeline' });
    const offer = h('div', { class: 'gh-offer', hidden: true });
    let el = null;
    const syncState = () => {
      const r = rec();
      const isOpen = r.b > 0;
      fill(statusEl,
        h('span', { class: 'gh-statepill ' + (isOpen ? 'open' : 'closed') }, icon(isOpen ? 'gh-open' : 'gh-closed'), isOpen ? 'Open' : 'Closed'),
        h('span', { class: 'gh-muted' }, h('b', { text: LOGIN }), ` 答錯 ${r.w} 次・答對 ${r.c} 次`));
      boxEl.textContent = isOpen ? `第 ${r.b} 盒` : r.m ? '已熟練' : '不在錯題盒';
      const item = (ico, cls, content) => h('div', { class: 'gh-tl-item' }, h('span', { class: 'gh-tl-badge ' + (cls || '') }, icon(ico)), h('div', { class: 'gh-tl-body' }, content));
      fill(timeline,
        item('gh-x', 'ng', [h('b', { text: LOGIN }), ` 答錯 ${r.w} 次`]),
        item('gh-check', 'ok', [h('b', { text: LOGIN }), ` 答對 ${r.c} 次`, r.c + r.w ? `（正確率 ${QG.pct(r.c, r.c + r.w)}）` : '']),
        r.t ? item('gh-clock', '', ['最後作答 ', h('time', { title: fmtDT(r.t), text: `${fmtDT(r.t)}（${SK.relTime(r.t)}）` })]) : null,
        r.b > 0 ? item('gh-box', 'open', [`目前在錯題第 ${r.b} 盒`, r.d ? `・${r.d <= Date.now() ? '已到期' : '下次複習 ' + fmtDay(r.d)}` : ''])
          : item('gh-closed', 'closed', r.m ? '已熟練，不在錯題盒' : '不在錯題盒'),
        note === 'closed' ? item('gh-closed', 'closed solid', [h('b', { text: LOGIN }), ' 剛剛關閉了這個 issue（錯題盒歸零）']) : null,
        note === 'reopened' ? item('gh-open', 'open solid', [h('b', { text: LOGIN }), ' 剛剛答錯，issue 重新開啟']) : null);
      if (el && el.isConnected) refreshTop();
    };
    const closeIssue = () => {
      const r = S().q[id];
      r.b = 0; delete r.d;
      QG.Store.save();
      note = 'closed';
      fill(offer, h('p', null, h('b', { text: `已關閉 issue #${numOf(id)}。` }), ' 這題已移出錯題本。'));
      offer.className = 'gh-offer closed';
      QG.toast(`已關閉 issue #${numOf(id)}`);
      syncState();
    };
    const opts = SK.answerOptions(q, { cls: 'gh-opts', onDone: (ok) => {
      const r = rec();
      const wasOpen = statusEl.querySelector('.gh-statepill.open') !== null;
      if (ok && r.b > 0) {
        fill(offer,
          h('p', null, h('b', { text: '答對了。' }), '要關閉這個 issue 嗎？關閉會把這題的錯題盒歸零（移出錯題本），之後不會再排進錯題複習；以後再答錯會自動重新開啟。'),
          h('div', { class: 'gh-offer-btns' },
            h('button', { type: 'button', class: 'gh-btn close', onclick: closeIssue }, icon('gh-closed'), 'Close issue'),
            h('span', { class: 'gh-muted', text: '或保留 open，照錯題盒排程再複習' })));
        offer.className = 'gh-offer';
      } else if (ok) {
        fill(offer, h('p', null, h('b', { text: '答對了。' }), ' 這個 issue 已經是 closed。'));
        offer.className = 'gh-offer ok';
      } else {
        if (!wasOpen) note = 'reopened';
        fill(offer, h('p', null, h('b', { text: '答錯了。' }), wasOpen ? ' 這題回到第 1 盒，issue 維持 open。' : ' 這個 issue 已重新開啟（回到第 1 盒）。',
          ' 正確答案：', q.all ? '所有選項均給分' : q.a.join('、')));
        offer.className = 'gh-offer ng';
      }
      offer.hidden = false;
      syncState();
    } });
    el = h('div', { class: 'gh-container gh-issue' },
      h('a', { href: '#review', class: 'gh-backlink', onclick: (e) => { e.preventDefault(); ghState.issue = null; QG.render(); } }, icon('gh-back'), '所有 issues'),
      h('h1', { class: 'gh-ihead' }, h('span', { text: short(q.q, 80) + ' ' }), h('span', { class: 'gh-inum', text: `#${numOf(id)}` })),
      statusEl,
      h('div', { class: 'gh-ilayout' },
        h('div', { class: 'gh-imain-col' },
          h('div', { class: 'gh-comment' },
            identicon(LOGIN, 'md'),
            h('div', { class: 'gh-comment-box' },
              h('div', { class: 'gh-comment-head' }, h('b', { text: LOGIN }), h('span', { class: 'gh-muted', text: ` 的錯題・${q.src.map(QG.srcLabel).join('、')}` }), h('span', { class: 'gh-pill', text: '題目' })),
              h('div', { class: 'gh-comment-body' },
                h('p', { class: 'gh-qtext', text: q.q }),
                q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖' })) : null,
                h('p', { class: 'gh-muted gh-hint', text: '直接作答：答對 open 的 issue 就能關閉它。' }),
                opts, offer,
                q.x ? h('details', { class: 'gh-details' }, h('summary', { text: '解析' }), h('p', { text: q.x })) : null))),
          timeline),
        h('aside', { class: 'gh-iside' },
          h('div', { class: 'gh-iside-sec' }, h('h3', { text: 'Labels' }), topics(q).length ? h('div', { class: 'gh-labels' }, topics(q).map(label)) : h('p', { class: 'gh-muted', text: '無' })),
          h('div', { class: 'gh-iside-sec' }, h('h3', { text: '科目' }), h('p', { text: `${QG.SUBJ_CODE[q.s]} ${QG.SUBJ[q.s]}` })),
          h('div', { class: 'gh-iside-sec' }, h('h3', { text: '錯題盒' }), boxEl),
          h('div', { class: 'gh-iside-sec' }, h('h3', { text: '出處' }), h('p', { text: q.src.map(QG.srcLabel).join('、') })),
          h('div', { class: 'gh-iside-sec' }, h('h3', { text: '收藏' }), SK.starBtn(q, 'gh-btn small gh-star', 'star')))));
    syncState();
    return el;
  }

  function refreshTop() {
    const topEl = document.getElementById('topbar');
    if (topEl && SK.skin() === 'github') fill(topEl, top(QG.currentView));
    QG.updateBadges();
  }

  /* ---------------------------------------------------------------- 註冊 */
  const NAV = [
    { v: 'home', label: '概覽', icon: 'gh-book' },
    { v: 'practice', label: '練習', icon: 'practice' },
    { v: 'review', label: 'Issues', icon: 'gh-open', badge: true },
    { v: 'exam', label: '模擬考', icon: 'exam' },
    { v: 'stats', label: '統計', icon: 'gh-pulse' },
  ];
  SK.register({
    id: 'github', label: 'GitHub 風', group: '生產力', top, nav: NAV,
    views: {
      home: homeView,
      review: (base) => {
        const el = base.review();
        const run = QG.reviewRun;
        if (run && run.idx < run.queue.length) { ghState.issue = null; return el; }
        if (ghState.issue && QG.QMAP.has(ghState.issue)) return issuePage(ghState.issue);
        const fb = el.querySelector('.feedback.ok .mono');
        const m = fb && fb.textContent.match(/(\d+)\s*\/\s*(\d+)/);
        return issuesList(m ? { c: +m[1], n: +m[2] } : null);
      },
    },
    after: (view) => {
      const sc = document.querySelector('.gh-graph-scroll');
      if (sc) sc.scrollLeft = sc.scrollWidth;
      const nav = document.querySelector('.gh-unav [aria-current="page"]');
      if (nav && nav.parentElement.scrollWidth > nav.parentElement.clientWidth) nav.scrollIntoView({ block: 'nearest', inline: 'center' });
      if (view !== 'review') ghState.issue = null;
    },
  });
})();
