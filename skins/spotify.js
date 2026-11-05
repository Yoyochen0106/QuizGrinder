/* Spotify 風：深色串流音樂介面——左側「你的資料庫」（主題、考卷＝播放清單）、依時段問候的首頁、
 * 快速選擇格、卡片書架、播放清單頁（大封面＋綠色播放鈕＋曲目表）與常駐的「正在播放」列。
 * 只借用版面、互動與配色；標誌一律用 QuizGrinder 的焊墊圖示。 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon, hue } = SK;
  const S = () => QG.S();
  const ID = 'spotify';

  Object.assign(SK.ICONS, {
    'sp-play': '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
    'sp-lib': '<path d="M4 3v18M9 3v18M14 4l6 16"/>',
    'sp-back': '<path d="M15 5l-7 7 7 7"/>',
    'sp-clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  });

  const st = { pl: null, lib: 'all' };

  /* ---------------------------------------------------------------- 播放清單資料 */
  const official = () => QG.QS.filter((q) => q.official);
  function examName(e) {
    if (!e.official) return '明志模擬試題';
    const s = e.session === 'S' ? '樣題' : `第${e.session === '1' ? '一' : '二'}次`;
    const subj = e.subject === 'mixed' ? '兩科' : QG.SUBJ_SHORT[e.subject];
    return `${e.year} ${s}・${subj}`;
  }
  function examIds(eid) {
    return QG.QS.filter((q) => q.src.some((s) => s.exam === eid))
      .sort((a, b) => a.src.find((s) => s.exam === eid).n - b.src.find((s) => s.exam === eid).n).map((q) => q.id);
  }
  /** key → {key, title, type, ids, desc} */
  function pl(key) {
    const [kind, ...rest] = key.split(':');
    const v = rest.join(':');
    const byYear = (qs) => qs.sort((a, b) => b.year - a.year || a.id.localeCompare(b.id)).map((q) => q.id);
    if (kind === 't') return { key, title: v, type: '主題播放清單', ids: byYear(official().filter((q) => q.t.includes(v))), desc: `歷屆官方試題中與「${v}」有關的題目` };
    if (kind === 'e') {
      const e = QG.EXAM_MAP.get(v);
      return { key, title: examName(e), type: '考卷', ids: examIds(v), desc: e.title };
    }
    if (kind === 's') return { key, title: `${QG.SUBJ_CODE[v]} ${QG.SUBJ_SHORT[v]}`, type: '科目合輯', ids: byYear(official().filter((q) => q.s === v)), desc: `${QG.SUBJ[v]}全部官方試題` };
    if (kind === 'due') return { key, title: '錯題本', type: '待複習', ids: QG.dueReviewIds(), desc: '答錯的題目依間隔排程回來複習，現在到期的都在這裡' };
    if (kind === 'star') return { key, title: '收藏的題目', type: '播放清單', ids: QG.QS.filter((q) => S().q[q.id] && S().q[q.id].s).map((q) => q.id), desc: '你按過收藏的題目' };
    if (kind === 'hot') return { key, title: '高頻重複題', type: '精選', ids: byYear(official().filter((q) => q.src.length > 1)), desc: '在兩次以上考試出現過的題目' };
    return { key, title: '練習範圍', type: '播放清單', ids: QG.filterQuestions(S().settings.filters).map((q) => q.id), desc: QG.filterLabel(S().settings.filters) };
  }
  const topicKeys = () => QG.TAGS.filter(([t]) => t !== '其他').map(([t]) => 't:' + t);
  const examKeys = () => [...QG.EXAM_MAP.values()].sort((a, b) => (b.year || 0) - (a.year || 0) || b.id.localeCompare(a.id)).map((e) => 'e:' + e.id);

  function cover(p, size) {
    const k = p.key.split(':')[0];
    const small = size === 'sm' || size === 'xs';
    let label = k === 't' ? p.title : k === 'e' ? p.title.split('・')[0] : k === 's' ? p.title.split(' ')[0] : p.title;
    if (small) label = k === 't' ? p.title.replace(/\s/g, '').slice(0, 2) : k === 'e' || k === 's' ? label : k === 'hot' ? '×2' : '';
    return h('span', { class: 'spotify-cover ' + (size || '') + ' k-' + k, style: `--h:${hue(p.key)}`, 'aria-hidden': 'true' },
      k === 'due' ? icon('review') : k === 'star' ? icon('star') : null,
      h('span', { class: 'spotify-cover-t', text: label }));
  }

  function openPl(key) {
    st.pl = key;
    if (location.hash === '#browse') { QG.render(); window.scrollTo(0, 0); } else location.hash = '#browse';
  }

  function playFrom(ids, i, label) {
    S().practice = { key: 'custom', label, queue: ids.slice(i).concat(ids.slice(0, i)), idx: 0, n: 0, c: 0 };
    QG.Store.save();
    location.hash = '#practice';
  }

  function playBtn(p, cls) {
    return h('button', { class: 'spotify-play ' + (cls || ''), type: 'button', 'aria-label': `播放「${p.title}」`, title: '隨機播放',
      disabled: p.ids.length ? null : true,
      onclick: (e) => { e.stopPropagation(); if (p.ids.length) QG.startCustomPractice(p.ids, p.title); } }, icon('sp-play'));
  }

  /* ---------------------------------------------------------------- 外框 */
  function top(view) {
    const input = h('input', { type: 'search', id: 'spotify-q', placeholder: '想練習什麼？', value: QG.browse.kw, 'aria-label': '搜尋題目' });
    return h('div', { class: 'sk-top spotify-top' },
      SK.brand(),
      h('div', { class: 'spotify-top-mid' },
        h('a', { class: 'spotify-round' + (view === 'home' ? ' on' : ''), href: '#home', 'aria-label': '首頁', title: '首頁' }, icon('home')),
        h('form', { class: 'spotify-search', role: 'search', onsubmit: (e) => { e.preventDefault(); QG.browse.kw = input.value.trim(); st.pl = null; if (location.hash === '#browse') QG.render(); else location.hash = '#browse'; } },
          icon('search'), input)),
      h('div', { class: 'sk-right' },
        h('a', { class: 'sk-iconbtn', href: '#exam', 'aria-label': '模擬考', title: '模擬考' }, icon('exam')),
        h('a', { class: 'sk-iconbtn', href: '#review', 'aria-label': '錯題本', title: '錯題本' }, icon('review'), h('span', { class: 'badge', 'data-badge': 'review', hidden: true })),
        h('a', { class: 'spotify-me', href: '#stats', 'aria-label': '我的統計', title: '我的統計', text: 'Q' })));
  }

  function library(compact) {
    const filters = [['all', '全部'], ['t', '主題'], ['e', '考卷']];
    const keys = ['due', 'star', 'hot', 's:industry', 's:process'].concat(topicKeys(), examKeys())
      .filter((k) => st.lib === 'all' || k.startsWith(st.lib + ':'));
    const list = h('div', { class: 'spotify-lib-list', role: 'list' });
    fill(list, keys.map((k) => {
      const p = pl(k);
      const pr = SK.progressOf(p.ids);
      return h('button', { class: 'spotify-lib-item' + (st.pl === k && QG.currentView === 'browse' ? ' on' : ''), type: 'button', role: 'listitem', onclick: () => openPl(k) },
        cover(p, 'sm'),
        h('span', { class: 'spotify-lib-text' }, h('span', { class: 'spotify-lib-name', text: p.title }),
          h('span', { class: 'spotify-lib-sub', text: `${p.type}・${p.ids.length} 題${pr.seen ? `・已練 ${pr.seen}` : ''}` })));
    }));
    const wrap = h('section', { class: 'spotify-lib' + (compact ? ' inline' : ''), 'aria-label': '你的資料庫' },
      h('div', { class: 'spotify-lib-head' }, icon('sp-lib'), h('h2', { text: '你的資料庫' })),
      h('div', { class: 'spotify-chips' }, filters.map(([k, l]) => h('button', { class: 'spotify-chip', type: 'button', 'aria-pressed': st.lib === k ? 'true' : 'false', text: l,
        onclick: () => { st.lib = k; const n = library(compact); wrap.replaceWith(n); } }))),
      list);
    return wrap;
  }

  /* ---------------------------------------------------------------- 首頁 */
  function greeting() {
    const hr = new Date().getHours();
    return hr >= 5 && hr < 12 ? '早安' : hr >= 12 && hr < 18 ? '午安' : '晚安';
  }

  function shelf(title, keys, sub) {
    return h('section', { class: 'spotify-shelf' },
      h('div', { class: 'spotify-shelf-head' }, h('h2', { text: title }), sub ? h('span', { class: 'spotify-dim', text: sub }) : null),
      h('div', { class: 'spotify-row' }, keys.map((k) => {
        const p = pl(k);
        const pr = SK.progressOf(p.ids);
        return h('div', { class: 'spotify-card', role: 'button', tabindex: '0', onclick: () => openPl(k),
          onkeydown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) openPl(k); } },
          h('span', { class: 'spotify-card-art' }, cover(p, 'lg'), playBtn(p, 'float')),
          h('strong', { class: 'spotify-card-title', text: p.title }),
          h('span', { class: 'spotify-card-sub', text: pr.seen ? `${p.ids.length} 題・正確率 ${QG.pct(pr.c, pr.n)}` : `${p.type}・${p.ids.length} 題` }));
      })));
  }

  function home() {
    const pr = S().practice;
    const quick = ['due', 'star', 's:industry', 's:process', 'hot'];
    // 第 6 格：最弱的主題（練過的主題中正確率最低；都沒練過就取題數最多的）
    const weak = topicKeys().map((k) => ({ k, p: SK.progressOf(pl(k).ids) })).filter((x) => x.p.n >= 3).sort((a, b) => a.p.c / a.p.n - b.p.c / b.p.n)[0];
    quick.push(weak ? weak.k : topicKeys()[0]);
    const topics = topicKeys();
    const weakTopics = topics.map((k) => ({ k, p: SK.progressOf(pl(k).ids) })).sort((a, b) => (a.p.n ? a.p.c / a.p.n : 0.5) - (b.p.n ? b.p.c / b.p.n : 0.5)).map((x) => x.k);
    return h('div', { class: 'spotify-page spotify-home' },
      h('div', { class: 'spotify-grad', style: `--h:${hue(greeting())}` }),
      h('h1', { class: 'spotify-greet', text: greeting() }),
      h('div', { class: 'spotify-quick' }, quick.map((k) => {
        const p = pl(k);
        return h('div', { class: 'spotify-qk', role: 'button', tabindex: '0', onclick: () => openPl(k),
          onkeydown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) openPl(k); } },
          cover(p, 'xs'), h('span', { class: 'spotify-qk-t', text: p.title }), playBtn(p, 'mini'));
      })),
      pr && pr.queue && pr.idx < pr.queue.length ? h('section', { class: 'spotify-resume' },
        h('span', { class: 'spotify-dim', text: '跳回' }),
        h('a', { class: 'spotify-resume-card', href: '#practice' },
          h('span', { class: 'spotify-cover sm', style: `--h:${hue(pr.label)}` }, icon('sp-play')),
          h('span', { class: 'spotify-lib-text' }, h('strong', { text: pr.label }), h('span', { class: 'spotify-dim', text: `第 ${pr.idx + 1} / ${pr.queue.length} 題・本輪 ${pr.c}/${pr.n}` })))) : null,
      shelf('依主題練習', topics.slice(0, 10), `${topics.length} 個播放清單`),
      shelf('為你推薦：你的弱點', weakTopics.slice(0, 8), '依你的正確率排序'),
      shelf('歷屆考卷', examKeys().slice(0, 12), '依年份'),
      library(true));
  }

  /* ---------------------------------------------------------------- 播放清單頁 */
  function plPage(key) {
    const p = pl(key);
    const pr = SK.progressOf(p.ids);
    const stQ = S().q;
    const ids = p.ids;
    const row = (q) => {
      const i = ids.indexOf(q.id);
      const r = stQ[q.id];
      const acc = r && (r.c + r.w) ? QG.pct(r.c, r.c + r.w) : '—';
      const topics = q.t.filter((t) => t !== '其他');
      return h('div', { class: 'spotify-tr', role: 'row', tabindex: '0', title: '從這題開始播放',
        onclick: () => playFrom(ids, i, p.title), onkeydown: (e) => { if (e.key === 'Enter') playFrom(ids, i, p.title); } },
        h('span', { class: 'spotify-tn', role: 'cell' }, h('span', { class: 'n', text: String(i + 1) }), icon('sp-play')),
        h('span', { class: 'spotify-tt', role: 'cell' },
          h('span', { class: 'spotify-tq' + (r && r.c + r.w ? ' seen' : ''), text: q.q }),
          h('span', { class: 'spotify-tsub' }, q.fig ? h('span', { class: 'spotify-e', text: '圖', title: '附圖' }) : null, q.src.length > 1 ? h('span', { class: 'spotify-e', text: `×${q.src.length}`, title: `考過 ${q.src.length} 次` }) : null,
            h('span', { text: QG.SUBJ_CODE[q.s] + '・' + QG.srcLabel(q.src[0]) }))),
        h('span', { class: 'spotify-ttopic', role: 'cell', text: topics.slice(0, 2).join('、') || '—' }),
        h('span', { class: 'spotify-tsrc', role: 'cell', text: q.src.map(QG.srcLabel).join('、') }),
        h('span', { class: 'spotify-tacc', role: 'cell', text: acc }));
    };
    return h('div', { class: 'spotify-page spotify-pl' },
      h('header', { class: 'spotify-pl-head', style: `--h:${hue(key)}` },
        cover(p, 'xl'),
        h('div', { class: 'spotify-pl-meta' },
          h('span', { class: 'spotify-pl-type', text: p.type }),
          h('h1', { class: 'spotify-pl-title' + (p.title.length > 8 ? ' long' : ''), text: p.title }),
          h('p', { class: 'spotify-dim', text: p.desc }),
          h('p', { class: 'spotify-pl-count' }, h('span', { class: 'spotify-mini-pad' }, icon('pad')), h('b', { text: 'QuizGrinder' }),
            ` ・ ${p.ids.length} 題・已練 ${pr.seen}${pr.n ? `・正確率 ${QG.pct(pr.c, pr.n)}` : ''}`))),
      h('div', { class: 'spotify-pl-actions' },
        playBtn(p, 'big'),
        h('span', { class: 'spotify-dim', text: p.ids.length ? '隨機播放全部' : '這個清單還沒有題目' })),
      p.ids.length ? h('div', { class: 'spotify-tracks', role: 'table', 'aria-label': '題目清單' },
        h('div', { class: 'spotify-tr head', role: 'row' },
          h('span', { class: 'spotify-tn', role: 'columnheader', text: '#' }), h('span', { role: 'columnheader', text: '題目' }),
          h('span', { class: 'spotify-ttopic', role: 'columnheader', text: '主題' }), h('span', { class: 'spotify-tsrc', role: 'columnheader', text: '出處' }),
          h('span', { class: 'spotify-tacc', role: 'columnheader', title: '你的正確率' }, icon('sp-clock'), h('span', { class: 'sr-only', text: '正確率' }))),
        SK.infiniteList(ids, row, 'spotify-tbody')) : h('p', { class: 'spotify-dim spotify-empty', text: key === 'due' ? '目前沒有到期的錯題，做得好！' : '還沒有題目。' }));
  }

  /* ---------------------------------------------------------------- 搜尋頁 */
  function search() {
    const input = h('input', { type: 'search', id: 'spotify-q2', placeholder: '搜尋題目、選項或主題', value: QG.browse.kw, 'aria-label': '搜尋題目' });
    const out = h('div');
    const draw = () => {
      const kw = input.value.trim().toLowerCase();
      if (!kw) {
        fill(out, h('h2', { class: 'spotify-h2', text: '瀏覽全部' }),
          h('div', { class: 'spotify-genres' }, ['s:industry', 's:process', 'hot', 'due'].concat(topicKeys()).map((k) => {
            const p = pl(k);
            return h('button', { class: 'spotify-genre', type: 'button', style: `--h:${hue(k)}`, onclick: () => openPl(k) },
              h('span', { text: p.title }), cover(p, 'tilt'));
          })));
        return;
      }
      const ids = QG.QS.filter((q) => q.text.includes(kw)).map((q) => q.id);
      const tps = QG.TAGS.filter(([t]) => t.toLowerCase().includes(kw)).map(([t]) => 't:' + t);
      const p = { key: 'search', title: `搜尋：${input.value.trim()}`, ids };
      fill(out,
        tps.length ? h('div', { class: 'spotify-chips' }, tps.map((k) => h('button', { class: 'spotify-chip', type: 'button', text: pl(k).title, onclick: () => openPl(k) }))) : null,
        h('div', { class: 'spotify-pl-actions' }, ids.length ? playBtn(p, 'big') : null, h('span', { class: 'spotify-dim', text: `${ids.length} 題符合「${input.value.trim()}」` })),
        ids.length ? h('div', { class: 'spotify-tracks', role: 'list' }, SK.infiniteList(ids, (q) => {
          const i = ids.indexOf(q.id);
          return h('div', { class: 'spotify-tr', role: 'listitem', tabindex: '0', onclick: () => playFrom(ids, i, p.title), onkeydown: (e) => { if (e.key === 'Enter') playFrom(ids, i, p.title); } },
            h('span', { class: 'spotify-tn' }, h('span', { class: 'n', text: String(i + 1) }), icon('sp-play')),
            h('span', { class: 'spotify-tt' }, h('span', { class: 'spotify-tq' }, SK.highlight(q.q, kw)), h('span', { class: 'spotify-tsub', text: QG.SUBJ_CODE[q.s] + '・' + QG.srcLabel(q.src[0]) })),
            h('span', { class: 'spotify-ttopic', text: q.t.filter((t) => t !== '其他').slice(0, 2).join('、') || '—' }),
            h('span', { class: 'spotify-tsrc', text: q.src.map(QG.srcLabel).join('、') }),
            h('span', { class: 'spotify-tacc', text: S().q[q.id] && S().q[q.id].c + S().q[q.id].w ? QG.pct(S().q[q.id].c, S().q[q.id].c + S().q[q.id].w) : '—' }));
        }, 'spotify-tbody')) : null);
    };
    let t;
    input.addEventListener('input', () => { QG.browse.kw = input.value; clearTimeout(t); t = setTimeout(draw, 200); });
    draw();
    return h('div', { class: 'spotify-page spotify-searchpage' },
      h('div', { class: 'spotify-search big' }, icon('search'), input), out);
  }

  function browse() { return st.pl ? plPage(st.pl) : search(); }

  /* ---------------------------------------------------------------- 正在播放列 */
  function nowPlaying(view) {
    let bar = document.getElementById('spotify-np');
    if (!bar) { bar = h('div', { id: 'spotify-np', class: 'spotify-np', role: 'region', 'aria-label': '正在播放' }); document.body.append(bar); }
    const p = S().practice;
    const has = p && p.queue && p.queue.length;
    const idx = has ? Math.min(p.idx, p.queue.length) : 0;
    const playing = view === 'practice';
    const q = has && idx < p.queue.length ? QG.QMAP.get(p.queue[idx]) : null;
    fill(bar,
      h('div', { class: 'spotify-np-now' },
        h('span', { class: 'spotify-cover xs', style: `--h:${hue(has ? p.label : 'none')}`, 'aria-hidden': 'true' }, icon('pad')),
        h('span', { class: 'spotify-np-text' },
          h('strong', { text: has ? p.label : '還沒有播放中的練習' }),
          h('span', { text: has ? (q ? `第 ${idx + 1} / ${p.queue.length} 題・${QG.srcLabel(q.src[0])}` : `已完成 ${p.queue.length} 題・本輪 ${p.c}/${p.n}`) : '選一個播放清單開始' }))),
      h('div', { class: 'spotify-np-mid' },
        h('a', { class: 'spotify-np-btn' + (playing ? ' on' : ''), href: '#practice', 'aria-label': playing ? '正在練習' : '繼續練習' },
          playing ? h('span', { class: 'spotify-eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')) : icon('sp-play'),
          h('span', { text: playing ? '練習中' : has ? '繼續' : '開始' })),
        h('div', { class: 'spotify-np-prog' },
          h('span', { class: 'mono', text: String(has ? idx : 0) }),
          h('span', { class: 'spotify-np-track' }, h('i', { style: `width:${has ? Math.round((idx / p.queue.length) * 100) : 0}%` })),
          h('span', { class: 'mono', text: String(has ? p.queue.length : 0) }))),
      h('div', { class: 'spotify-np-right' }, has ? h('span', { class: 'spotify-dim', text: `本輪正確率 ${QG.pct(p.c, p.n)}` }) : null),
      h('span', { class: 'spotify-np-line', 'aria-hidden': 'true' }, h('i', { style: `width:${has ? Math.round((idx / p.queue.length) * 100) : 0}%` })));
  }

  function after(view) {
    nowPlaying(view);
    const app = document.getElementById('app');
    const page = app.firstElementChild;
    if (page && !page.classList.contains('spotify-page')) page.classList.add('spotify-base');
    if (view === 'practice' && page && page.querySelector('#qcard') && !page.querySelector('.spotify-np-head')) {
      const p = S().practice;
      if (p) page.prepend(h('div', { class: 'spotify-np-head' }, h('span', { class: 'spotify-cover sm', style: `--h:${hue(p.label)}`, 'aria-hidden': 'true' }, icon('pad')),
        h('span', { class: 'spotify-lib-text' }, h('span', { class: 'spotify-dim', text: '正在播放' }), h('strong', { text: p.label }))));
    }
  }

  // 點「搜尋」相關連結時回到搜尋頁（播放清單頁同樣在 #browse）
  document.addEventListener('click', (e) => {
    if (SK.skin() !== ID) return;
    const a = e.target.closest && e.target.closest('#bottomnav a[href="#browse"]');
    if (!a) return;
    st.pl = null;
    if (location.hash === '#browse') { e.preventDefault(); QG.render(); }
  }, true);

  const prevBefore = QG.hooks.beforeRender;
  QG.hooks.beforeRender = (view) => {
    prevBefore(view);
    if (SK.skin() !== ID) { const bar = document.getElementById('spotify-np'); if (bar) bar.remove(); }
  };

  SK.register({
    id: ID, label: 'Spotify 風', group: '社群內容',
    top, side: () => library(false),
    nav: [
      { v: 'home', label: '首頁', icon: 'home' },
      { v: 'browse', label: '搜尋', icon: 'search' },
      { v: 'exam', label: '模擬考', icon: 'exam' },
      { v: 'review', label: '錯題本', icon: 'review', badge: true },
      { v: 'stats', label: '統計', icon: 'stats' },
    ],
    views: { home, browse },
    after,
  });
})();
