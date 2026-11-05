/* Reddit 風：論壇動態——左側社群清單（科目、主題）、排序分頁（熱門／最新／弱點）、
 * 左側投票欄（分數＝你自己答對減答錯；▲＝收藏、▼＝加入錯題本，不是假的投票）、
 * 貼文內直接作答，答完出現 u/quizgrinder 的置頂留言（答案、解析、出處）；右側社群資訊卡顯示真實統計。
 * 只借用版面、互動與配色；標誌一律用 QuizGrinder 的焊墊圖示。 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon, hue } = SK;
  const S = () => QG.S();
  const ID = 'reddit';

  Object.assign(SK.ICONS, {
    'rd-up': '<path d="M12 4l7 8h-4.5v8h-5v-8H5z"/>',
    'rd-down': '<path d="M12 20l7-8h-4.5V4h-5v8H5z"/>',
    'rd-pin': '<path d="M9 3h6l-1 6 4 4H6l4-4zM12 13v8"/>',
    'rd-hot': '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-4-12-3 2-5 5-5 8-1-1-2-2-2-4-2 2-3 5-3 8 0 4 3 7 7 7z"/>',
    'rd-new': '<path d="M12 3l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 8.3l5-.7z"/>',
    'rd-weak': '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    'rd-share': '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v7h14v-7"/>',
  });

  const rd = { sort: 'hot', comm: '', cache: {} };

  /* ---------------------------------------------------------------- 社群 */
  function comm(key) {
    if (!key) return { key: '', name: 'r/全部', title: '全部題目', ids: QG.QS.map((q) => q.id), desc: 'IPAS 初級電路板製程工程師兩科的所有題目，包含歷屆官方試題與模擬題。' };
    const [k, v] = [key.slice(0, 1), key.slice(2)];
    if (k === 's') return { key, name: 'r/' + QG.SUBJ_SHORT[v], title: `${QG.SUBJ_CODE[v]} ${QG.SUBJ[v]}`, ids: QG.QS.filter((q) => q.s === v).map((q) => q.id), desc: `第${v === 'industry' ? '一' : '二'}科「${QG.SUBJ[v]}」的歷屆試題與模擬題。` };
    return { key, name: 'r/' + v.replace(/\s/g, ''), title: v, ids: QG.QS.filter((q) => q.t.includes(v)).map((q) => q.id), desc: `兩科中與「${v}」有關的題目。` };
  }
  const subjComm = (q) => 'r/' + QG.SUBJ_SHORT[q.s];
  const commIcon = (key, label, cls) => h('span', { class: 'reddit-cicon ' + (cls || ''), style: `--h:${hue(key || 'all')}`, 'aria-hidden': 'true', text: label });

  function setComm(key) {
    rd.comm = key;
    if (location.hash === '#home' || location.hash === '') { QG.render(); window.scrollTo(0, 0); } else location.hash = '#home';
  }

  function sorted(ids, sort, cacheKey) {
    const k = sort + '|' + cacheKey;
    if (rd.cache[k] && rd.cache[k].n === ids.length) return rd.cache[k].ids;
    const qs = ids.map((id) => QG.QMAP.get(id));
    const tie = (q) => SK.hue(q.id);
    let out;
    if (sort === 'hot') out = qs.sort((a, b) => b.src.length - a.src.length || b.year - a.year || tie(a) - tie(b)).map((q) => q.id);
    else if (sort === 'new') out = qs.sort((a, b) => b.year - a.year || tie(a) - tie(b)).map((q) => q.id);
    else out = QG.buildQueue(ids, 'weak');
    rd.cache[k] = { n: ids.length, ids: out };
    return out;
  }

  /* ---------------------------------------------------------------- 貼文 */
  function scoreOf(q) {
    const r = S().q[q.id];
    return r ? { c: r.c || 0, w: r.w || 0, s: !!r.s, b: r.b > 0, t: r.t } : { c: 0, w: 0, s: false, b: false, t: 0 };
  }

  function post(q) {
    const art = h('article', { class: 'reddit-post' });
    const vote = h('div', { class: 'reddit-vote' });
    const drawVote = () => {
      const r = scoreOf(q);
      const sc = r.c - r.w;
      fill(vote,
        h('button', { type: 'button', class: 'reddit-up' + (r.s ? ' on' : ''), 'aria-pressed': r.s ? 'true' : 'false',
          'aria-label': r.s ? '▲ 已收藏，按一下取消收藏' : '▲ 收藏這題', title: r.s ? '已收藏（再按一次取消）' : '▲ 收藏這題',
          onclick: () => { QG.toggleStar(q.id); drawVote(); } }, icon('rd-up'), h('span', { class: 'reddit-vlabel', text: '收藏' })),
        h('span', { class: 'reddit-score' + (sc > 0 ? ' pos' : sc < 0 ? ' neg' : ''), title: `你的分數＝答對 ${r.c} 次 − 答錯 ${r.w} 次`,
          'aria-label': `你的分數 ${sc}（答對 ${r.c}、答錯 ${r.w}）`, text: r.c + r.w ? (sc > 0 ? '+' : '') + sc : '•' }),
        h('button', { type: 'button', class: 'reddit-down' + (r.b ? ' on' : ''), 'aria-label': r.b ? '▼ 已在錯題本' : '▼ 加入錯題本',
          title: r.b ? '已在錯題本（再按一次重新排入今天複習）' : '▼ 加入錯題本', onclick: () => { SK.addToReview(q); drawVote(); } },
          icon('rd-down'), h('span', { class: 'reddit-vlabel', text: '錯題' })));
    };
    const comments = h('section', { class: 'reddit-comments', hidden: true, 'aria-label': '留言' });
    const showComments = () => {
      const r = scoreOf(q);
      fill(comments,
        h('div', { class: 'reddit-sort-line', text: '1 則留言・置頂' }),
        h('div', { class: 'reddit-comment' },
          h('span', { class: 'reddit-c-av', 'aria-hidden': 'true' }, icon('pad')),
          h('div', { class: 'reddit-c-body' },
            h('div', { class: 'reddit-c-meta' }, h('strong', { text: 'u/quizgrinder' }), h('span', { class: 'reddit-mod', text: 'MOD' }),
              h('span', { class: 'reddit-pinned' }, icon('rd-pin'), '置頂'), h('span', { class: 'reddit-dim', text: '題庫解答' })),
            h('p', null, h('b', { text: '正解：' }), q.all ? '官方釋疑，所有選項均給分' : q.a.map((L) => `(${L}) ${q.o[L]}`).join('；') + (q.a.length > 1 ? '（官方釋疑均給分）' : '')),
            q.x ? h('p', { text: q.x }) : null,
            h('p', { class: 'reddit-dim' }, '出處：', q.src.map(QG.srcLabel).join('、'), q.src.length > 1 ? `（考過 ${q.src.length} 次）` : ''),
            h('p', { class: 'reddit-dim', text: r.c + r.w ? `你的紀錄：答對 ${r.c} 次、答錯 ${r.w} 次${r.b ? '・在錯題本中' : ''}` : '你還沒作答過這題' }))));
      comments.hidden = false;
    };
    const opts = SK.answerOptions(q, { cls: 'reddit-opts', onDone: () => { drawVote(); showComments(); drawFoot(); } });
    const foot = h('div', { class: 'reddit-actions' });
    const drawFoot = () => fill(foot,
      h('button', { type: 'button', class: 'reddit-act', 'aria-expanded': comments.hidden ? 'false' : 'true', onclick: () => { if (comments.hidden) showComments(); else comments.hidden = true; drawFoot(); } },
        icon('comment'), comments.hidden ? '解答與出處' : '收起解答'),
      h('button', { type: 'button', class: 'reddit-act', onclick: () => SK.copyQuestion(q) }, icon('rd-share'), '複製題目'),
      h('button', { type: 'button', class: 'reddit-act', onclick: () => QG.startCustomPractice([q.id], '單題作答') }, icon('practice'), '專心作答'));
    drawVote();
    drawFoot();
    const r0 = scoreOf(q);
    const topics = q.t.filter((t) => t !== '其他');
    fill(art,
      vote,
      h('div', { class: 'reddit-main' },
        h('div', { class: 'reddit-meta' },
          commIcon('s:' + q.s, QG.SUBJ_CODE[q.s].slice(1)),
          h('button', { type: 'button', class: 'reddit-sub', text: subjComm(q), onclick: () => setComm('s:' + q.s) }),
          h('span', { class: 'reddit-dim', text: '・' + QG.srcLabel(q.src[0]) }),
          r0.t ? h('span', { class: 'reddit-dim', text: '・你 ' + SK.relTime(r0.t) + '答過' }) : null),
        h('h3', { class: 'reddit-title', text: q.q }),
        h('div', { class: 'reddit-flairs' },
          topics.map((t) => h('button', { type: 'button', class: 'reddit-flair', style: `--h:${hue('t:' + t)}`, text: t, onclick: () => setComm('t:' + t) })),
          q.src.length > 1 ? h('span', { class: 'reddit-flair hot', text: `考過 ${q.src.length} 次` }) : null,
          q.mock ? h('span', { class: 'reddit-flair mock', text: '非官方模擬題' }) : null),
        q.prev && QG.QMAP.get(q.prev) ? h('p', { class: 'reddit-dim reddit-prev', text: '承上題：' + QG.QMAP.get(q.prev).q }) : null,
        q.fig ? h('figure', { class: 'qfig reddit-fig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖', loading: 'lazy' })) : null,
        opts,
        foot,
        comments));
    return art;
  }

  /* ---------------------------------------------------------------- 外框 */
  function top() {
    const c = comm(rd.comm);
    const input = h('input', { type: 'search', id: 'reddit-q', placeholder: rd.comm ? `搜尋 ${c.name}` : '搜尋題目', value: QG.browse.kw, 'aria-label': '搜尋題目' });
    return h('div', { class: 'sk-top reddit-top' },
      h('a', { class: 'reddit-brand', href: '#home', 'aria-label': 'QuizGrinder 首頁', onclick: () => { rd.comm = ''; } },
        h('span', { class: 'reddit-logo' }, icon('pad')), h('span', { class: 'reddit-word', text: 'quizgrinder' })),
      h('form', { class: 'reddit-search', role: 'search', onsubmit: (e) => { e.preventDefault(); QG.browse.kw = input.value.trim(); if (location.hash === '#browse') QG.render(); else location.hash = '#browse'; } },
        icon('search'), input),
      h('div', { class: 'sk-right' },
        h('a', { class: 'reddit-create', href: '#practice' }, icon('practice'), h('span', { text: '練習' })),
        h('a', { class: 'sk-iconbtn', href: '#review', 'aria-label': '錯題本', title: '錯題本' }, icon('review'), h('span', { class: 'badge', 'data-badge': 'review', hidden: true })),
        h('a', { class: 'reddit-me', href: '#stats', 'aria-label': '我的統計', title: '我的統計' }, icon('user'))));
  }

  function side(view) {
    const item = (label, ico, opts) => h(opts.href ? 'a' : 'button', { class: 'reddit-nav', href: opts.href, type: opts.href ? null : 'button', onclick: opts.onclick,
      'aria-current': opts.current ? 'page' : null }, ico, h('span', { class: 'reddit-nav-t', text: label }), opts.count != null ? h('span', { class: 'reddit-nav-n', text: String(opts.count) }) : null,
    opts.badge ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null);
    const onHome = view === 'home';
    const cItem = (key, label, n) => item(comm(key).name, commIcon(key, label), { onclick: () => setComm(key), current: onHome && rd.comm === key, count: n });
    return h('nav', { class: 'reddit-side', 'aria-label': '社群與功能' },
      item('首頁', icon('home'), { onclick: () => setComm(''), current: onHome && !rd.comm }),
      item('專心練習', icon('practice'), { href: '#practice', current: view === 'practice' }),
      item('錯題本', icon('review'), { href: '#review', current: view === 'review', badge: true }),
      item('模擬考', icon('exam'), { href: '#exam', current: SK.isCurrent(view, 'exam') }),
      item('搜尋', icon('search'), { href: '#browse', current: view === 'browse' }),
      item('統計', icon('stats'), { href: '#stats', current: view === 'stats' }),
      h('h3', { class: 'reddit-side-h', text: '科目' }),
      ['industry', 'process'].map((s) => cItem('s:' + s, QG.SUBJ_CODE[s].slice(1), QG.QS.filter((q) => q.s === s).length)),
      h('h3', { class: 'reddit-side-h', text: '主題社群' }),
      QG.TAGS.filter(([t]) => t !== '其他').map(([t, n]) => cItem('t:' + t, t.slice(0, 1), n)));
  }

  function infoCard(c) {
    const p = SK.progressOf(c.ids);
    const due = QG.dueReviewIds().filter((id) => c.ids.includes(id)).length;
    const years = QG.YEARS;
    return h('section', { class: 'reddit-card reddit-info' },
      h('div', { class: 'reddit-banner', style: `--h:${hue(c.key || 'all')}` }),
      h('div', { class: 'reddit-info-body' },
        h('div', { class: 'reddit-info-head' }, commIcon(c.key, c.key.startsWith('s:') ? QG.SUBJ_CODE[c.key.slice(2)].slice(1) : c.key ? c.title.slice(0, 1) : '全', 'big'),
          h('div', null, h('strong', { text: c.name }), h('span', { class: 'reddit-dim', text: c.title }))),
        h('p', { class: 'reddit-info-desc', text: c.desc }),
        h('dl', { class: 'reddit-stats' },
          h('div', null, h('dt', { text: '題數' }), h('dd', { text: QG.fmtNum(c.ids.length) })),
          h('div', null, h('dt', { text: '已練' }), h('dd', { text: QG.fmtNum(p.seen) })),
          h('div', null, h('dt', { text: '你的正確率' }), h('dd', { text: p.n ? QG.pct(p.c, p.n) : '—' }))),
        h('p', { class: 'reddit-dim reddit-small', text: `收錄 ${years[0]}–${years[years.length - 1]} 年試題${due ? `・${due} 題錯題到期` : ''}` }),
        h('button', { type: 'button', class: 'reddit-btn', onclick: () => QG.startCustomPractice(c.ids, c.name) }, `練習 ${c.name}`),
        due ? h('button', { type: 'button', class: 'reddit-btn ghost', onclick: () => QG.startReview(QG.dueReviewIds().filter((id) => c.ids.includes(id))) }, `複習到期錯題 ${due}`) : null));
  }

  function rulesCard() {
    return h('section', { class: 'reddit-card reddit-rules' },
      h('h3', { text: '社群規則' }),
      h('ol', null,
        h('li', null, h('b', { text: '分數＝你自己的成績' }), h('span', { text: '每題的數字是你答對次數減答錯次數，不是別人的投票。' })),
        h('li', null, h('b', { text: '▲ 收藏' }), h('span', { text: '收藏的題目可以在錯題本頁一次練習。' })),
        h('li', null, h('b', { text: '▼ 加入錯題本' }), h('span', { text: '排入今天的錯題複習（Leitner 五盒）。' })),
        h('li', null, h('b', { text: '置頂留言' }), h('span', { text: '作答後由 u/quizgrinder 公布答案與出處。' }))));
  }

  function sortTabs() {
    return h('div', { class: 'reddit-sorts', role: 'tablist', 'aria-label': '排序' },
      [['hot', '熱門', 'rd-hot', '考過次數最多的優先'], ['new', '最新', 'rd-new', '最新年度的考題優先'], ['weak', '弱點', 'rd-weak', '你最常答錯、還沒練過的優先']].map(([k, l, ic, tip]) =>
        h('button', { type: 'button', role: 'tab', class: 'reddit-sortbtn', 'aria-selected': rd.sort === k ? 'true' : 'false', title: tip,
          onclick: () => { rd.sort = k; if (k === 'weak') Object.keys(rd.cache).forEach((x) => { if (x.startsWith('weak|')) delete rd.cache[x]; }); QG.render(); } }, icon(ic), l)));
  }

  function mobileComms() {
    const keys = ['', 's:industry', 's:process'].concat(QG.TAGS.filter(([t]) => t !== '其他').map(([t]) => 't:' + t));
    return h('div', { class: 'reddit-mchips', role: 'list', 'aria-label': '社群' }, keys.map((k) => h('button', { type: 'button', role: 'listitem', class: 'reddit-mchip',
      'aria-pressed': rd.comm === k ? 'true' : 'false', onclick: () => setComm(k) }, commIcon(k, k ? (k.startsWith('s:') ? QG.SUBJ_CODE[k.slice(2)].slice(1) : k.slice(2, 3)) : '全'), comm(k).name)));
  }

  function feedPage(c, ids, heading) {
    return h('div', { class: 'reddit-page' },
      h('div', { class: 'reddit-feedcol' },
        heading || (c.key ? h('header', { class: 'reddit-chead' }, h('div', { class: 'reddit-banner tall', style: `--h:${hue(c.key)}` }),
          h('div', { class: 'reddit-chead-row' }, commIcon(c.key, c.key.startsWith('s:') ? QG.SUBJ_CODE[c.key.slice(2)].slice(1) : c.title.slice(0, 1), 'huge'),
            h('div', null, h('h1', { text: c.name }), h('span', { class: 'reddit-dim', text: `${c.title}・${c.ids.length} 題` })),
            h('button', { type: 'button', class: 'reddit-btn', onclick: () => QG.startCustomPractice(c.ids, c.name) }, '全部練習'))) : null),
        mobileComms(),
        sortTabs(),
        ids.length ? SK.infiniteList(ids, post, 'reddit-feed') : h('p', { class: 'reddit-card reddit-empty', text: '這裡還沒有貼文。' })),
      h('aside', { class: 'reddit-aside' }, infoCard(c), rulesCard()));
  }

  function home() {
    const c = comm(rd.comm);
    return feedPage(c, sorted(c.ids, rd.sort, rd.comm));
  }

  function browse() {
    const kw = (QG.browse.kw || '').trim();
    const low = kw.toLowerCase();
    if (!kw) {
      const keys = ['s:industry', 's:process'].concat(QG.TAGS.filter(([t]) => t !== '其他').map(([t]) => 't:' + t));
      return h('div', { class: 'reddit-page one' }, h('div', { class: 'reddit-feedcol' },
        h('h1', { class: 'reddit-h1', text: '探索社群' }),
        h('div', { class: 'reddit-dir' }, keys.map((k, i) => {
          const c = comm(k);
          const p = SK.progressOf(c.ids);
          return h('button', { type: 'button', class: 'reddit-card reddit-dir-item', onclick: () => setComm(k) },
            h('span', { class: 'reddit-rank', text: String(i + 1) }),
            commIcon(k, k.startsWith('s:') ? QG.SUBJ_CODE[k.slice(2)].slice(1) : c.title.slice(0, 1), 'big'),
            h('span', { class: 'reddit-dir-t' }, h('strong', { text: c.name }), h('span', { class: 'reddit-dim', text: `${c.ids.length} 題・已練 ${p.seen}${p.n ? `・正確率 ${QG.pct(p.c, p.n)}` : ''}` })));
        }))));
    }
    const c = comm(rd.comm);
    const ids = c.ids.filter((id) => QG.QMAP.get(id).text.includes(low));
    return feedPage(c, sorted(ids, rd.sort, rd.comm + '|kw:' + low),
      h('header', { class: 'reddit-sres' }, h('h1', { class: 'reddit-h1', text: `「${kw}」的搜尋結果` }),
        h('p', { class: 'reddit-dim' }, `${c.name} 中有 ${ids.length} 則貼文・`, h('button', { type: 'button', class: 'reddit-link', text: '清除搜尋', onclick: () => { QG.browse.kw = ''; QG.render(); } }))));
  }

  function stats(base) {
    const el = base.stats();
    const t = QG.totals();
    const karma = t.c - (t.n - t.c);
    el.prepend(h('section', { class: 'reddit-card reddit-profile' },
      h('div', { class: 'reddit-banner', style: `--h:${hue('me')}` }),
      h('div', { class: 'reddit-prof-row' },
        h('span', { class: 'reddit-prof-av', 'aria-hidden': 'true' }, icon('user')),
        h('div', null, h('h1', { text: 'u/我的學習' }), h('span', { class: 'reddit-dim', text: 'IPAS 初級電路板製程工程師備考中' }))),
      h('dl', { class: 'reddit-stats' },
        h('div', { title: '答對次數減答錯次數' }, h('dt', { text: '學習 karma' }), h('dd', { text: (karma > 0 ? '+' : '') + QG.fmtNum(karma) })),
        h('div', null, h('dt', { text: '作答' }), h('dd', { text: QG.fmtNum(t.n) })),
        h('div', null, h('dt', { text: '正確率' }), h('dd', { text: QG.pct(t.c, t.n) })),
        h('div', null, h('dt', { text: '連續天數' }), h('dd', { text: String(QG.streak()) })))));
    return el;
  }

  SK.register({
    id: ID, label: 'Reddit 風', group: '社群內容',
    top, side,
    nav: [
      { v: 'home', label: '首頁', icon: 'home' },
      { v: 'browse', label: '探索', icon: 'compass' },
      { v: 'exam', label: '模擬考', icon: 'exam' },
      { v: 'review', label: '錯題本', icon: 'review', badge: true },
      { v: 'stats', label: '我', icon: 'user' },
    ],
    views: { home, browse, stats },
    after: () => {
      const on = document.querySelector('.reddit-mchip[aria-pressed="true"]');
      if (on && on.parentElement) on.parentElement.scrollLeft = Math.max(0, on.offsetLeft - 12);
    },
  });
})();
