/* QuizGrinder 版面風格實驗（skins）
 *
 * 在不改動題庫與學習邏輯的前提下，切換三種常見網站的「版面與互動模式」：
 *   feed    影音牆：左側選單、分類膠囊列、卡片牆（縮圖＋進度條）、作答頁右側「接下來」清單
 *   search  極簡搜尋：置中大搜尋框＋即時建議、搜尋結果頁（精選摘要、相關問題、分頁）
 *   docs    文件站：頂部分頁列、左側分組目錄、右側「本頁內容」、⌘K 指令面板、上一頁／下一頁
 *   classic 原版
 * 只借用版面與互動慣例，不使用任何品牌的標誌、字型或商標。
 * 依賴 app.js 暴露的 window.QG；移除本檔與 skins.css 即回到原版。
 */
(function () {
  'use strict';
  const QG = window.QG;
  if (!QG) return;
  // 只在實驗版啟用：Artifact 實驗版設定 window.QG_SKINS，網站版在網址加 ?skins
  if (!window.QG_SKINS && !/[?&]skins\b/.test(location.search)) return;
  const { h, fill } = QG;
  const root = document.documentElement;

  const SKINS = [
    { id: 'classic', label: '原版' },
    { id: 'feed', label: '影音牆' },
    { id: 'search', label: '極簡搜尋' },
    { id: 'docs', label: '文件站' },
  ];
  const skin = () => {
    const s = QG.S().settings.skin;
    return SKINS.some((k) => k.id === s) ? s : 'classic';
  };

  /* ---------------------------------------------------------------- 圖示 */
  const ICONS = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    practice: '<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
    review: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/>',
    exam: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
    browse: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    apps: '<circle cx="5" cy="5" r="1.6"/><circle cx="12" cy="5" r="1.6"/><circle cx="19" cy="5" r="1.6"/><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/><circle cx="5" cy="19" r="1.6"/><circle cx="12" cy="19" r="1.6"/><circle cx="19" cy="19" r="1.6"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
    pad: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/>',
  };
  const FILLED = new Set(['apps']);
  function icon(name, cls) {
    const span = document.createElement('span');
    span.className = 'ico' + (cls ? ' ' + cls : '');
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = `<svg viewBox="0 0 24 24" ${FILLED.has(name) ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'}>${ICONS[name] || ''}</svg>`;
    return span;
  }

  const NAV = [
    { v: 'home', label: '首頁', icon: 'home' },
    { v: 'practice', label: '練習', icon: 'practice' },
    { v: 'review', label: '錯題本', icon: 'review', badge: true },
    { v: 'exam', label: '模擬考', icon: 'exam' },
    { v: 'browse', label: '題庫', icon: 'browse' },
    { v: 'stats', label: '統計', icon: 'stats' },
  ];
  const isCurrent = (view, v) => view === v || (view === 'result' && v === 'exam');

  function go(view) {
    if (location.hash === '#' + view) QG.render();
    else location.hash = '#' + view;
  }

  /** 以字串雜湊產生穩定色相，給「縮圖」用 */
  function hue(str) {
    let x = 0;
    for (const ch of str) x = (x * 31 + ch.codePointAt(0)) >>> 0;
    return x % 360;
  }

  function brand(text) {
    return h('a', { class: 'sk-brand', href: '#home', 'aria-label': 'QuizGrinder 首頁' },
      icon('pad', 'brand-ico'), h('span', { class: 'sk-brand-name', text: text || 'QuizGrinder' }));
  }

  function progressOf(ids) {
    const st = QG.S().q;
    let seen = 0, c = 0, n = 0;
    for (const id of ids) { const r = st[id]; if (r && (r.c + r.w)) { seen++; c += r.c; n += r.c + r.w; } }
    return { seen, c, n };
  }

  /* ---------------------------------------------------------------- 外框 */
  let classicTop = null;

  function buildShell(view) {
    const s = skin();
    root.dataset.skin = s;
    const top = document.getElementById('topbar');
    if (top && !classicTop) classicTop = [...top.childNodes].map((n) => n.cloneNode(true));
    const side = document.getElementById('sidebar');
    const toc = document.getElementById('toc');
    const bottom = document.getElementById('bottomnav');
    if (s === 'classic') {
      if (top && classicTop) top.replaceChildren(...classicTop.map((n) => n.cloneNode(true)));
      side.hidden = true; toc.hidden = true; bottom.hidden = true;
      fill(side); fill(toc); fill(bottom);
    } else {
      fill(top, s === 'feed' ? feedTop() : s === 'search' ? searchTop(view) : docsTop(view));
      side.hidden = s === 'search';
      fill(side, s === 'feed' ? feedSide(view) : s === 'docs' ? docsSide(view) : null);
      toc.hidden = true;
      fill(toc);
      bottom.hidden = false;
      fill(bottom, NAV.map((n) => h('a', { href: '#' + n.v, 'aria-current': isCurrent(view, n.v) ? 'page' : null },
        icon(n.icon), h('span', { text: n.label }), n.badge ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null)));
    }
    buildSkinbar();
  }

  function buildSkinbar() {
    const bar = document.getElementById('skinbar');
    if (!bar) return;
    fill(bar, h('span', { class: 'sk-bar-label', text: '版面風格' }),
      h('div', { class: 'sk-bar-btns', role: 'group', 'aria-label': '版面風格' }, SKINS.map((k) =>
        h('button', { type: 'button', 'aria-pressed': skin() === k.id ? 'true' : 'false', text: k.label,
          onclick: () => setSkin(k.id) }))));
  }

  function setSkin(id) {
    if (id === skin()) return;
    QG.S().settings.skin = id;
    QG.Store.save();
    closePalette();
    QG.render();
    window.scrollTo(0, 0);
    QG.toast(`已切換為「${SKINS.find((k) => k.id === id).label}」版面`);
  }

  /* ================================================================ 影音牆 feed */

  function feedTop() {
    const input = h('input', { type: 'search', id: 'sk-feed-q', placeholder: '搜尋題目、選項或主題', value: QG.browse.kw, 'aria-label': '搜尋題目' });
    return h('div', { class: 'sk-top feed-top' },
      h('button', { class: 'sk-iconbtn', type: 'button', 'aria-label': '收合側邊選單', onclick: () => {
        const st = QG.S().settings; st.feedMini = !st.feedMini; QG.Store.save(); root.classList.toggle('side-mini', !!st.feedMini);
      } }, icon('menu')),
      brand(),
      h('form', { class: 'feed-search', role: 'search', onsubmit: (e) => { e.preventDefault(); QG.browse.kw = input.value.trim(); QG.browse.limit = 30; go('browse'); } },
        input, h('button', { type: 'submit', 'aria-label': '搜尋' }, icon('search'))),
      h('div', { class: 'sk-right' },
        h('a', { class: 'sk-iconbtn', href: '#review', 'aria-label': '錯題本' }, icon('review'), h('span', { class: 'badge', 'data-badge': 'review', hidden: true })),
        h('a', { class: 'sk-avatar', href: '#stats', 'aria-label': '我的統計', text: 'Q' })));
  }

  function feedSide(view) {
    root.classList.toggle('side-mini', !!QG.S().settings.feedMini);
    const starred = Object.keys(QG.S().q).filter((id) => QG.S().q[id].s && QG.QMAP.has(id));
    const item = (label, ico, opts) => h(opts.href ? 'a' : 'button', {
      class: 'feed-item', href: opts.href, type: opts.href ? null : 'button', onclick: opts.onclick,
      'aria-current': opts.current ? 'page' : null, title: label,
    }, icon(ico), h('span', { class: 'feed-item-label', text: label }), opts.badge ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null);
    return h('nav', { class: 'feed-side', 'aria-label': '側邊選單' },
      h('div', { class: 'feed-group' }, NAV.slice(0, 4).map((n) => item(n.label, n.icon, { href: '#' + n.v, current: isCurrent(view, n.v), badge: n.badge }))),
      h('div', { class: 'feed-group' },
        h('h3', { class: 'feed-group-title', text: '我的' }),
        item('統計', 'stats', { href: '#stats', current: view === 'stats' }),
        item('題庫', 'browse', { href: '#browse', current: view === 'browse' }),
        item(`收藏（${starred.length}）`, 'star', { onclick: () => starred.length ? QG.startCustomPractice(starred, '收藏題目') : QG.toast('還沒有收藏的題目') })),
      h('div', { class: 'feed-group feed-topics' },
        h('h3', { class: 'feed-group-title', text: '主題' }),
        QG.TAGS.filter(([t]) => t !== '其他').map(([t, n]) => h('button', { class: 'feed-item', type: 'button', title: t,
          onclick: () => QG.startCustomPractice(QG.QS.filter((q) => q.official && q.t.includes(t)).map((q) => q.id), `主題：${t}`) },
          h('span', { class: 'feed-dot', style: `--h:${hue(t)}` }), h('span', { class: 'feed-item-label', text: t }), h('span', { class: 'feed-count', text: n })))));
  }

  const feedState = { chip: 'all' };

  /** 所有可練習的「題組」：考卷、主題、特殊題組 */
  function feedSets(chip) {
    const subj = chip === 'industry' || chip === 'process' ? chip : null;
    const pool = QG.QS.filter((q) => (!subj || q.s === subj));
    const sets = [];
    const exams = [...QG.EXAM_MAP.values()].sort((a, b) => (b.year || 0) - (a.year || 0) || b.id.localeCompare(a.id));
    const maxYear = QG.YEARS[QG.YEARS.length - 1];
    const addExam = (e) => {
      const ids = pool.filter((q) => q.src.some((s) => s.exam === e.id)).map((q) => q.id);
      if (!ids.length) return;
      const code = e.subject === 'industry' ? 'L11' : e.subject === 'process' ? 'L12' : '兩科';
      sets.push({ key: e.id, kind: '考卷', title: e.title, big: e.official ? `${e.year}${e.session === 'S' ? ' 樣題' : '-' + e.session}` : '模擬題', small: code, avatar: e.official ? code.slice(0, 3) : '模', ids });
    };
    const addTopic = (t) => {
      const ids = pool.filter((q) => q.official && q.t.includes(t)).map((q) => q.id);
      if (ids.length) sets.push({ key: 'tag:' + t, kind: '主題', title: `主題：${t}`, big: t, small: subj ? QG.SUBJ_CODE[subj] : '主題', avatar: '主', ids });
    };
    const addSpecial = (key, title, big, filterFn) => {
      const ids = pool.filter((q) => q.official && filterFn(q)).map((q) => q.id);
      if (ids.length) sets.push({ key, kind: '精選', title, big, small: '精選', avatar: '★', ids });
    };
    if (chip === 'all' || chip === 'hot') addSpecial('hot', '高頻重複題：考過 2 次以上', '高頻', (q) => q.src.length > 1);
    if (chip === 'all' || chip === 'fig') addSpecial('fig', '看圖題：需要搭配附圖的題目', '看圖', (q) => !!q.fig);
    if (chip === 'all' || chip === 'exams' || subj || chip === 'recent') {
      exams.filter((e) => chip !== 'recent' || (e.year && e.year >= maxYear - 2)).forEach(addExam);
    }
    if (chip === 'all' || chip === 'topics' || subj) QG.TAGS.filter(([t]) => t !== '其他').forEach(([t]) => addTopic(t));
    return sets;
  }

  function thumb(key, big, small, ids, opts = {}) {
    const p = progressOf(ids);
    return h('div', { class: 'feed-thumb' + (opts.vertical ? ' vertical' : ''), style: `--h:${hue(key)}` },
      h('span', { class: 'feed-thumb-big', text: big }),
      small ? h('span', { class: 'feed-thumb-small', text: small }) : null,
      opts.badge !== false ? h('span', { class: 'feed-badge', text: opts.badge || `${ids.length} 題` }) : null,
      p.seen ? h('span', { class: 'feed-progress', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.round((p.seen / ids.length) * 100)}%` })) : null);
  }

  function feedCard(set) {
    const p = progressOf(set.ids);
    return h('button', { class: 'feed-card', type: 'button', onclick: () => QG.startCustomPractice(set.ids, set.title) },
      thumb(set.key, set.big, set.small, set.ids),
      h('div', { class: 'feed-card-body' },
        h('span', { class: 'feed-avatar', style: `--h:${hue(set.avatar)}`, text: set.avatar }),
        h('div', { class: 'feed-card-text' },
          h('span', { class: 'feed-card-title', text: set.title }),
          h('span', { class: 'feed-card-meta', text: `${set.kind}・${set.ids.length} 題` }),
          h('span', { class: 'feed-card-meta', text: p.seen ? `已練 ${p.seen} 題・正確率 ${QG.pct(p.c, p.n)}` : '還沒練習過' }))));
  }

  function feedHome() {
    const st = QG.S();
    const chips = [['all', '全部'], ['exams', '考卷'], ['topics', '主題'], ['industry', 'L11 產業概論'], ['process', 'L12 製造概論'], ['recent', '近三年'], ['hot', '高頻重複'], ['fig', '看圖題']];
    const wrap = h('div', { class: 'feed' });
    const draw = () => {
      const sets = feedSets(feedState.chip);
      const due = QG.dueReviewIds();
      const p = st.practice;
      const resume = p && p.idx > 0 && p.idx < p.queue.length ? p : null;
      fill(wrap,
        h('div', { class: 'feed-chips', role: 'toolbar', 'aria-label': '分類' }, chips.map(([k, l]) =>
          h('button', { class: 'feed-chip', type: 'button', 'aria-pressed': feedState.chip === k ? 'true' : 'false', text: l, onclick: () => { feedState.chip = k; draw(); } }))),
        resume && feedState.chip === 'all' ? h('section', { class: 'feed-section' },
          h('h2', { class: 'feed-h', text: '繼續練習' }),
          h('button', { class: 'feed-resume', type: 'button', onclick: () => go('practice') },
            thumb('resume' + resume.label, `${resume.idx}/${resume.queue.length}`, '進行中', resume.queue.slice(0, resume.idx), { badge: `剩 ${resume.queue.length - resume.idx} 題` }),
            h('div', { class: 'feed-card-text' },
              h('span', { class: 'feed-card-title', text: resume.label }),
              h('span', { class: 'feed-card-meta', text: `本輪答對 ${resume.c}/${resume.n}・${QG.pct(resume.c, resume.n)}` }),
              h('span', { class: 'feed-card-meta', text: '從上次停下的地方接著練' })))) : null,
        due.length && feedState.chip === 'all' ? h('section', { class: 'feed-section' },
          h('h2', { class: 'feed-h' }, icon('review'), `錯題快練（${due.length}）`),
          h('div', { class: 'feed-shelf' }, due.slice(0, 12).map((id, i) => {
            const q = QG.QMAP.get(id);
            return h('button', { class: 'feed-short', type: 'button', style: `--h:${hue(q.t[0] || id)}`,
              onclick: () => QG.startReview([id].concat(due.filter((x) => x !== id))) },
              h('span', { class: 'feed-short-text', text: q.q }),
              h('span', { class: 'feed-short-meta', text: `${QG.SUBJ_CODE[q.s]}・第 ${QG.S().q[id].b} 盒` }));
          }))) : null,
        h('section', { class: 'feed-section' },
          h('h2', { class: 'feed-h', text: feedState.chip === 'all' ? '全部題組' : chips.find(([k]) => k === feedState.chip)[1] }),
          sets.length ? h('div', { class: 'feed-grid' }, sets.map(feedCard)) : h('p', { class: 'muted', text: '這個分類沒有題組。' })),
      );
    };
    draw();
    return wrap;
  }

  function feedResults() {
    const kw = QG.browse.kw.trim().toLowerCase();
    const list = QG.QS.filter((q) => (QG.browse.subject === 'all' || q.s === QG.browse.subject) && (!kw || q.text.includes(kw))
      && (!QG.browse.tag || q.t.includes(QG.browse.tag)) && (!QG.browse.exam || q.src.some((s) => s.exam === QG.browse.exam)));
    const wrap = h('div', { class: 'feed feed-results' });
    const shown = list.slice(0, QG.browse.limit);
    fill(wrap,
      h('div', { class: 'feed-chips' }, [['all', '全部'], ['industry', 'L11 產業概論'], ['process', 'L12 製造概論']].map(([k, l]) =>
        h('button', { class: 'feed-chip', type: 'button', 'aria-pressed': QG.browse.subject === k ? 'true' : 'false', text: l, onclick: () => { QG.browse.subject = k; QG.render(); } })),
        h('span', { class: 'spacer' }),
        list.length ? h('button', { class: 'btn primary small', type: 'button', text: `練習這 ${QG.fmtNum(list.length)} 題`, onclick: () => QG.startCustomPractice(list.map((q) => q.id), kw ? `搜尋：${QG.browse.kw}` : '題庫') }) : null),
      h('p', { class: 'muted feed-count-line', text: kw ? `「${QG.browse.kw}」共 ${QG.fmtNum(list.length)} 題` : `共 ${QG.fmtNum(list.length)} 題` }),
      h('div', { class: 'feed-rows' }, shown.map((q, i) => {
        const r = QG.S().q[q.id];
        return h('button', { class: 'feed-row', type: 'button', onclick: () => QG.startCustomPractice([q.id].concat(list.filter((x) => x !== q).slice(0, 49).map((x) => x.id)), kw ? `搜尋：${QG.browse.kw}` : '題庫') },
          thumb(q.id, QG.SUBJ_CODE[q.s], q.t[0], [q.id], { badge: QG.srcLabel(q.src[0]) }),
          h('div', { class: 'feed-card-text' },
            h('span', { class: 'feed-card-title', text: q.q }),
            h('span', { class: 'feed-card-meta', text: [q.src.length > 1 ? `考過 ${q.src.length} 次` : null, r && (r.c + r.w) ? `你答對 ${r.c}/${r.c + r.w}` : '未作答', q.fig ? '附圖' : null].filter(Boolean).join('・') }),
            h('span', { class: 'feed-row-desc', text: QG.LETTERS.map((L) => `${L}. ${q.o[L]}`).join('　') })));
      })),
      list.length > shown.length ? h('button', { class: 'btn', type: 'button', text: '顯示更多', onclick: () => { QG.browse.limit += 30; QG.render(); } }) : null,
    );
    return wrap;
  }

  /** 作答頁右側「接下來」 */
  function feedUpNext(view) {
    const run = view === 'practice' ? QG.S().practice : QG.reviewRun;
    const app = document.getElementById('app');
    const main = app.firstElementChild;
    if (!run || !main || !main.querySelector('#qcard')) return;
    const upcoming = run.queue.slice(run.idx + 1, run.idx + 13);
    const aside = h('aside', { class: 'feed-upnext', 'aria-label': '接下來' },
      h('div', { class: 'feed-upnext-head' }, h('strong', { text: '接下來' }), h('span', { class: 'muted', text: `${run.queue.length - run.idx - 1} 題` })),
      upcoming.map((id, k) => {
        const q = QG.QMAP.get(id);
        if (!q) return null;
        return h('button', { class: 'feed-next', type: 'button', title: '先作答這題', onclick: () => {
          const j = run.idx + 1 + k;
          run.queue.splice(j, 1);
          run.queue.splice(run.idx, 0, id);
          QG.Store.save();
          QG.render();
        } },
          thumb(id, QG.SUBJ_CODE[q.s], q.t[0], [id], { badge: false }),
          h('div', { class: 'feed-card-text' },
            h('span', { class: 'feed-card-title', text: q.q }),
            h('span', { class: 'feed-card-meta', text: q.src.map(QG.srcLabel).join('・') })));
      }));
    const watch = h('div', { class: 'feed-watch' });
    main.replaceWith(watch);
    watch.append(main, aside);
  }

  /* ================================================================ 極簡搜尋 search */

  function appsMenu() {
    const pop = h('div', { class: 'g-apps-pop', hidden: true, role: 'menu' },
      NAV.map((n) => h('a', { class: 'g-app', href: '#' + n.v, role: 'menuitem', onclick: () => { pop.hidden = true; } },
        h('span', { class: 'g-app-ico', style: `--h:${hue(n.v)}` }, icon(n.icon)), h('span', { text: n.label }))));
    const btn = h('button', { class: 'sk-iconbtn', type: 'button', 'aria-label': '所有功能', 'aria-haspopup': 'menu', onclick: (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; } }, icon('apps'));
    document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target)) pop.hidden = true; });
    return h('div', { class: 'g-apps' }, btn, pop);
  }

  function searchBox(opts = {}) {
    const input = h('input', { type: 'text', id: opts.id || 'sk-g-q', autocomplete: 'off', value: opts.value || '', placeholder: opts.placeholder || '', 'aria-label': '搜尋題庫', role: 'combobox', 'aria-expanded': 'false', 'aria-controls': (opts.id || 'sk-g-q') + '-list' });
    const list = h('ul', { class: 'g-suggest', id: (opts.id || 'sk-g-q') + '-list', role: 'listbox', hidden: true });
    const clear = h('button', { class: 'g-clear', type: 'button', 'aria-label': '清除', hidden: !input.value, onclick: () => { input.value = ''; clear.hidden = true; list.hidden = true; input.focus(); } }, icon('close'));
    let items = [];
    let active = -1;
    const submit = (text) => { QG.browse.kw = (text !== undefined ? text : input.value).trim(); QG.browse.page = 0; QG.browse.tag = ''; QG.browse.exam = ''; go('browse'); };
    const pick = (it) => { list.hidden = true; it.run(); };
    const suggest = () => {
      const v = input.value.trim().toLowerCase();
      clear.hidden = !input.value;
      if (!v) { list.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
      const tags = QG.TAGS.filter(([t]) => t.toLowerCase().includes(v)).slice(0, 3).map(([t, n]) => ({
        kind: 'tag', text: t, sub: `主題・${n} 題`, run: () => { QG.browse.kw = ''; QG.browse.tag = t; QG.browse.page = 0; go('browse'); } }));
      const qs = QG.QS.filter((q) => q.text.includes(v)).slice(0, 7 - tags.length).map((q) => ({
        kind: 'q', text: q.q, sub: QG.srcLabel(q.src[0]), run: () => submit(input.value) }));
      items = [{ kind: 'search', text: input.value.trim(), sub: '搜尋題庫', run: () => submit() }].concat(tags, qs);
      active = -1;
      fill(list, items.map((it, i) => h('li', { role: 'option', id: `g-opt-${i}`, class: 'g-sug', 'aria-selected': 'false', onmousedown: (e) => { e.preventDefault(); pick(it); } },
        icon(it.kind === 'tag' ? 'tag' : it.kind === 'q' ? 'doc' : 'search'),
        h('span', { class: 'g-sug-text' }, highlight(it.text, v, true)),
        h('span', { class: 'g-sug-sub', text: it.sub }))));
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    };
    input.addEventListener('input', suggest);
    input.addEventListener('focus', () => { if (input.value) suggest(); });
    input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 120));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (list.hidden) return;
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        [...list.children].forEach((li, i) => li.setAttribute('aria-selected', i === active ? 'true' : 'false'));
        input.setAttribute('aria-activedescendant', `g-opt-${active}`);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (active >= 0 && !list.hidden) pick(items[active]); else submit();
      } else if (e.key === 'Escape') { list.hidden = true; }
    });
    const box = h('div', { class: 'g-box' + (opts.big ? ' big' : '') }, icon('search', 'g-box-ico'), input, clear, list);
    return { box, input, submit };
  }

  /** 把 text 中的關鍵字標粗（invert=true 時改成標粗「其餘」部分，像搜尋建議） */
  function highlight(text, kw, invert) {
    if (!kw) return text;
    const lower = text.toLowerCase();
    const out = [];
    let i = 0;
    let j;
    while ((j = lower.indexOf(kw, i)) >= 0) {
      if (j > i) out.push(invert ? h('b', { text: text.slice(i, j) }) : text.slice(i, j));
      out.push(invert ? text.slice(j, j + kw.length) : h('b', { text: text.slice(j, j + kw.length) }));
      i = j + kw.length;
    }
    if (i < text.length) out.push(invert ? h('b', { text: text.slice(i) }) : text.slice(i));
    return out;
  }

  function searchTop(view) {
    const links = h('div', { class: 'g-links' }, NAV.slice(1).map((n) => h('a', { href: '#' + n.v, 'aria-current': isCurrent(view, n.v) ? 'page' : null, text: n.label })));
    const right = h('div', { class: 'sk-right' }, links, appsMenu(), h('a', { class: 'sk-avatar', href: '#stats', 'aria-label': '我的統計', text: 'Q' }));
    if (view === 'home') return h('div', { class: 'sk-top g-top home' }, right);
    const sb = searchBox({ id: 'sk-g-top', value: view === 'browse' ? QG.browse.kw : '' });
    return h('div', { class: 'sk-top g-top' }, h('a', { class: 'g-mini-brand', href: '#home', text: 'QuizGrinder' }), sb.box, right);
  }

  function searchHome() {
    const sb = searchBox({ big: true, placeholder: '搜尋題目、選項或主題，例如：棕化' });
    const t = QG.totals();
    const randomTen = () => {
      const ids = QG.shuffle(QG.QS.filter((q) => q.official).map((q) => q.id)).slice(0, 10);
      QG.startCustomPractice(ids, '隨機 10 題');
    };
    const view = h('div', { class: 'g-home' },
      h('h1', { class: 'g-logo' }, h('span', { class: 'g-logo-q', text: 'Quiz' }), 'Grinder'),
      sb.box,
      h('div', { class: 'g-btns' },
        h('button', { class: 'g-btn', type: 'button', text: '搜尋題庫', onclick: () => sb.submit() }),
        h('button', { class: 'g-btn', type: 'button', text: '隨機 10 題', onclick: randomTen })),
      h('p', { class: 'g-offered' }, '依科目瀏覽：',
        h('a', { href: '#browse', onclick: () => { Object.assign(QG.browse, { subject: 'industry', kw: '', tag: '', exam: '', page: 0 }); }, text: 'L11 產業概論' }),
        h('a', { href: '#browse', onclick: () => { Object.assign(QG.browse, { subject: 'process', kw: '', tag: '', exam: '', page: 0 }); }, text: 'L12 製造概論' })),
      h('footer', { class: 'g-foot' },
        h('div', { class: 'g-foot-top', text: 'IPAS 初級電路板製程工程師・歷屆試題' }),
        h('div', { class: 'g-foot-links' },
          h('div', null, h('span', { text: `題庫 ${QG.fmtNum(QG.QS.length)} 題` }), h('span', { text: `已練 ${QG.fmtNum(t.seen)} 題` }), h('span', { text: `正確率 ${QG.pct(t.c, t.n)}` })),
          h('div', null, h('a', { href: '#exam', text: '模擬考' }), h('a', { href: '#review', text: '錯題本' }), h('a', { href: '#stats', text: '統計' })))));
    setTimeout(() => sb.input.focus({ preventScroll: true }), 0);
    return view;
  }

  function searchResults() {
    const b = QG.browse;
    if (b.page === undefined) b.page = 0;
    const kw = b.kw.trim().toLowerCase();
    const t0 = performance.now();
    const st = QG.S().q;
    const tab = b.only === 'fig' || b.only === 'wrong' || b.only === 'star' ? b.only : b.subject;
    const list = QG.QS.filter((q) => (b.subject === 'all' || q.s === b.subject)
      && (!kw || q.text.includes(kw))
      && (!b.tag || q.t.includes(b.tag))
      && (!b.exam || q.src.some((s) => s.exam === b.exam))
      && (b.only === 'all' || (b.only === 'fig' && q.fig) || (b.only === 'wrong' && st[q.id] && st[q.id].w > 0) || (b.only === 'star' && st[q.id] && st[q.id].s) || (b.only === 'hot' && q.src.length > 1)));
    const ms = Math.max(1, Math.round(performance.now() - t0));
    const PER = 10;
    const pages = Math.ceil(list.length / PER);
    b.page = Math.min(b.page, Math.max(0, pages - 1));
    const pageItems = list.slice(b.page * PER, b.page * PER + PER);
    const setTab = (k) => {
      if (k === 'fig' || k === 'wrong' || k === 'star') { b.only = k; b.subject = 'all'; } else { b.only = 'all'; b.subject = k; }
      b.page = 0; QG.render();
    };
    const tabs = [['all', '全部'], ['industry', 'L11 產業概論'], ['process', 'L12 製造概論'], ['fig', '附圖'], ['wrong', '答錯過'], ['star', '收藏']];
    const featured = kw && b.page === 0 && list[0] ? list[0] : null;
    const relatedTag = (featured || pageItems[0] || {}).t ? (featured || pageItems[0]).t[0] : null;
    const related = relatedTag ? QG.shuffle(QG.QS.filter((q) => q.t.includes(relatedTag) && !pageItems.includes(q))).slice(0, 4) : [];

    const results = pageItems.filter((q) => q !== featured).map((q) => resultItem(q, kw));
    if (results.length > 3 && related.length) results.splice(3, 0, peopleAlsoAsk(related));

    return h('div', { class: 'g-results' },
      h('nav', { class: 'g-tabs', 'aria-label': '結果分類' }, tabs.map(([k, l]) => h('button', { type: 'button', 'aria-current': tab === k ? 'page' : null, text: l, onclick: () => setTab(k) }))),
      h('p', { class: 'g-stats' }, `約 ${QG.fmtNum(list.length)} 項結果（${(ms / 1000).toFixed(3)} 秒）`,
        b.tag ? h('span', null, '　主題：', h('b', { text: b.tag }), ' ', h('button', { class: 'g-x', type: 'button', text: '清除', onclick: () => { b.tag = ''; QG.render(); } })) : null,
        b.exam ? h('span', null, '　考卷：', h('b', { text: (QG.EXAM_MAP.get(b.exam) || {}).title || b.exam }), ' ', h('button', { class: 'g-x', type: 'button', text: '清除', onclick: () => { b.exam = ''; QG.render(); } })) : null),
      list.length ? null : h('div', { class: 'g-empty' },
        h('p', null, '找不到符合「', h('b', { text: b.kw }), '」的題目。'),
        h('p', { text: '建議：' }),
        h('ul', null, h('li', { text: '確認關鍵字是否有錯字' }), h('li', { text: '改用較短或較通用的詞，例如「蝕刻」而不是「蝕刻因子計算」' }), h('li', { text: '切換到「全部」分類' }))),
      featured ? featuredSnippet(featured, kw) : null,
      results,
      pages > 1 ? h('nav', { class: 'g-pager', 'aria-label': '分頁' },
        b.page > 0 ? h('button', { type: 'button', class: 'g-pg-edge', text: '‹ 上一頁', onclick: () => { b.page--; QG.render(); window.scrollTo(0, 0); } }) : null,
        Array.from({ length: Math.min(pages, 10) }, (_, i) => {
          const start = Math.max(0, Math.min(b.page - 4, pages - 10));
          const p = start + i;
          return h('button', { type: 'button', 'aria-current': p === b.page ? 'page' : null, text: String(p + 1), onclick: () => { b.page = p; QG.render(); window.scrollTo(0, 0); } });
        }),
        b.page < pages - 1 ? h('button', { type: 'button', class: 'g-pg-edge', text: '下一頁 ›', onclick: () => { b.page++; QG.render(); window.scrollTo(0, 0); } }) : null) : null,
      list.length ? h('div', { class: 'g-practice' }, h('button', { class: 'g-btn', type: 'button', text: `用這 ${QG.fmtNum(list.length)} 題練習`, onclick: () => QG.startCustomPractice(list.map((q) => q.id), kw ? `搜尋：${b.kw}` : '搜尋結果') })) : null,
    );
  }

  function crumb(q) {
    const s = q.src[0];
    const e = QG.EXAM_MAP.get(s.exam) || {};
    return h('div', { class: 'g-crumb' },
      h('span', { class: 'g-fav', style: `--h:${hue(q.s)}`, text: QG.SUBJ_CODE[q.s].slice(1) }),
      h('span', { class: 'g-site' }, h('span', { class: 'g-site-name', text: 'QuizGrinder 題庫' }),
        h('span', { class: 'g-path', text: `${e.official ? e.year + ' 年' : '模擬題'} › ${QG.SUBJ_CODE[q.s]} ${QG.SUBJ_SHORT[q.s]} › ${s.label || '#' + s.n}` })));
  }

  function answerText(q) {
    if (q.all) return '官方釋疑：所有選項均給分';
    return q.a.map((L) => `${L}. ${q.o[L]}`).join('；') + (q.a.length > 1 ? '（均給分）' : '');
  }

  function resultItem(q, kw) {
    let open = false;
    const ans = h('div', { class: 'g-ans', hidden: true });
    const r = QG.S().q[q.id];
    const el = h('div', { class: 'g-res' },
      crumb(q),
      h('h3', null, h('button', { class: 'g-title', type: 'button', 'aria-expanded': 'false', onclick: (e) => {
        open = !open; ans.hidden = !open; e.currentTarget.setAttribute('aria-expanded', String(open));
      } }, highlight(q.q, kw))),
      h('p', { class: 'g-snip' }, QG.LETTERS.map((L) => [h('span', { class: 'g-opt-l', text: `(${L}) ` }), highlight(q.o[L], kw), '　'])),
      h('div', { class: 'g-meta' },
        q.src.length > 1 ? h('span', { text: `考過 ${q.src.length} 次` }) : null,
        q.t.filter((t) => t !== '其他').slice(0, 3).map((t) => h('button', { class: 'g-chip', type: 'button', text: t, onclick: () => { QG.browse.tag = t; QG.browse.kw = ''; QG.browse.page = 0; QG.render(); } })),
        r && (r.c + r.w) ? h('span', { text: `你答對 ${r.c}/${r.c + r.w}` }) : null,
        h('button', { class: 'g-link', type: 'button', text: '作答這題 ›', onclick: () => QG.startCustomPractice([q.id], '單題作答') })),
      ans);
    fill(ans, h('p', null, h('b', { text: '答案　' }), answerText(q)),
      q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖', loading: 'lazy' })) : null,
      q.x ? h('p', { class: 'note', text: q.x }) : null);
    return el;
  }

  function featuredSnippet(q, kw) {
    let reveal = false;
    const box = h('section', { class: 'g-featured', 'aria-label': '精選摘要' });
    const draw = () => fill(box,
      h('div', { class: 'g-feat-label', text: '最相關的題目' }),
      h('p', { class: 'g-feat-q' }, highlight(q.q, kw)),
      q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖', loading: 'lazy' })) : null,
      h('ol', { class: 'g-feat-opts' }, QG.LETTERS.map((L) => h('li', { class: reveal && (q.all || q.a.includes(L)) ? 'ans' : '' }, h('b', { text: L }), h('span', null, highlight(q.o[L], kw))))),
      h('div', { class: 'g-feat-foot' },
        reveal ? h('span', { class: 'g-feat-a', text: `答案：${answerText(q)}` }) : h('button', { class: 'g-btn', type: 'button', text: '顯示答案', onclick: () => { reveal = true; draw(); } }),
        h('button', { class: 'g-link', type: 'button', text: '作答這題 ›', onclick: () => QG.startCustomPractice([q.id], '單題作答') })),
      crumb(q));
    draw();
    return box;
  }

  function peopleAlsoAsk(qs) {
    return h('section', { class: 'g-paa', 'aria-label': '相關題目' },
      h('h2', { text: '相關題目' }),
      qs.map((q) => h('details', { class: 'g-paa-item' },
        h('summary', { text: q.q }),
        h('div', { class: 'g-paa-body' },
          h('ol', null, QG.LETTERS.map((L) => h('li', { class: q.all || q.a.includes(L) ? 'ans' : '' }, h('b', { text: L }), h('span', { text: q.o[L] })))),
          crumb(q)))));
  }

  /* ================================================================ 文件站 docs */

  function docsTop(view) {
    return h('div', { class: 'sk-top d-top' },
      h('div', { class: 'd-top-row' },
        brand(),
        h('span', { class: 'd-pill', text: '學習手冊' }),
        h('button', { class: 'd-search', type: 'button', onclick: openPalette, 'aria-label': '搜尋（⌘K）' },
          icon('search'), h('span', { text: '搜尋題目與頁面…' }), h('kbd', { text: navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl K' })),
        h('span', { class: 'spacer' }),
        h('a', { class: 'd-cta', href: '#practice', text: '開始練習' })),
      h('nav', { class: 'd-tabs', 'aria-label': '主要分頁' }, NAV.map((n) => h('a', { href: '#' + n.v, 'aria-current': isCurrent(view, n.v) ? 'page' : null }, n.label,
        n.badge ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null))));
  }

  function docsSide(view) {
    const b = QG.browse;
    const link = (label, opts) => h(opts.href ? 'a' : 'button', {
      class: 'd-link', href: opts.href, type: opts.href ? null : 'button', 'aria-current': opts.current ? 'page' : null,
      onclick: opts.onclick,
    }, label, opts.count !== undefined ? h('span', { class: 'd-count', text: opts.count }) : null);
    const browseTo = (patch) => () => { Object.assign(b, { kw: '', tag: '', exam: '', subject: 'all', only: 'all', limit: 30, page: 0 }, patch); go('browse'); };
    const inBrowse = view === 'browse';
    const exams = [...QG.EXAM_MAP.values()].sort((x, y) => (y.year || 0) - (x.year || 0) || y.id.localeCompare(x.id));
    const group = (title, kids) => h('div', { class: 'd-group' }, h('h3', { class: 'd-group-title', text: title }), kids);
    return h('nav', { class: 'd-side', 'aria-label': '文件目錄' },
      group('開始使用', [
        link('概覽', { href: '#home', current: view === 'home' }),
        link('練習', { href: '#practice', current: view === 'practice' }),
        link('錯題本', { href: '#review', current: view === 'review' }),
        link('模擬考', { href: '#exam', current: view === 'exam' || view === 'result' }),
        link('學習統計', { href: '#stats', current: view === 'stats' }),
      ]),
      group('依科目', [
        link('L11 電路板產業概論', { onclick: browseTo({ subject: 'industry' }), current: inBrowse && b.subject === 'industry' && !b.tag && !b.exam }),
        link('L12 電路板製造概論', { onclick: browseTo({ subject: 'process' }), current: inBrowse && b.subject === 'process' && !b.tag && !b.exam }),
        link('全部題目', { onclick: browseTo({}), current: inBrowse && b.subject === 'all' && !b.tag && !b.exam && !b.kw }),
      ]),
      group('依主題', QG.TAGS.map(([t, n]) => link(t, { onclick: browseTo({ tag: t }), current: inBrowse && b.tag === t, count: n }))),
      group('考卷', exams.map((e) => link(e.title.replace(/（.*?）/, ''), { onclick: browseTo({ exam: e.id }), current: inBrowse && b.exam === e.id }))));
  }

  function callout(kind, ...kids) {
    return h('div', { class: 'd-callout ' + kind, role: 'note' }, icon(kind === 'tip' ? 'bulb' : 'info'), h('div', null, kids));
  }

  function docsHome() {
    const st = QG.S();
    const t = QG.totals();
    const due = QG.dueReviewIds().length;
    const today = st.days[QG.dayKey()] || { n: 0, c: 0 };
    const card = (href, ico, title, desc) => h('a', { class: 'd-card', href }, icon(ico), h('strong', { text: title }), h('span', { text: desc }));
    const key = (k) => h('kbd', { text: k });
    return h('div', { class: 'view d-page' },
      h('div', { class: 'hero' },
        h('span', { class: 'eyebrow', text: '開始使用' }),
        h('h1', { text: '概覽' }),
        h('p', { class: 'd-lead', text: `QuizGrinder 收錄 IPAS 初級電路板製程工程師 L11 電路板產業概論與 L12 電路板製造概論的歷屆試題，共 ${QG.fmtNum(QG.QS.length)} 題，答案已逐題對照官方答案與疑義釋覆。這份手冊說明如何用它準備考試，左側目錄也能直接依科目、主題或考卷翻閱題目。` })),
      callout('info', '按 ', key(navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl K'), ' 可以隨時搜尋題目與頁面。'),
      h('h2', { text: '快速開始' }),
      h('div', { class: 'd-cards' },
        card('#practice', 'practice', '練習', '依範圍出題，同一輪不重複，答完立刻看對錯。'),
        card('#review', 'review', `錯題本（${due}）`, '答錯的題目依間隔排程回來複習。'),
        card('#exam', 'exam', '模擬考', `隨機 ${QG.EXAM_LEN} 題、${QG.EXAM_MIN} 分鐘，交卷後一次對答。`),
        card('#browse', 'browse', '題庫', '全文搜尋，依主題、收藏或答錯過篩選。')),
      h('h2', { text: '你的進度' }),
      h('div', { class: 'tablewrap' }, h('table', { class: 'd-table' },
        h('thead', null, h('tr', null, h('th', { text: '項目' }), h('th', { class: 'num', text: '數值' }))),
        h('tbody', null,
          [['今日作答', QG.fmtNum(today.n)], ['總正確率', QG.pct(t.c, t.n)], ['已練題目', `${QG.fmtNum(t.seen)} / ${QG.fmtNum(QG.QS.length)}`], ['錯題待複習', String(due)], ['連續天數', String(QG.streak())]]
            .map(([k, v]) => h('tr', null, h('td', { text: k }), h('td', { class: 'num', text: v })))))),
      h('h2', { text: '設定練習範圍' }),
      h('p', { text: '選好範圍後按下方按鈕開始新的一輪。範圍設定會記住，下次打開時沿用。' }),
      QG.rangePanel(),
      h('h2', { text: '鍵盤快速鍵' }),
      h('div', { class: 'tablewrap' }, h('table', { class: 'd-table' },
        h('thead', null, h('tr', null, h('th', { text: '按鍵' }), h('th', { text: '作用' }))),
        h('tbody', null,
          [[['1', '–', '4'], '作答（也可按 A–D）'], [['Enter'], '下一題'], [['S'], '收藏目前題目'], [['←', '→'], '模擬考換題'], [['F'], '模擬考標記'], [[navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl K'], '搜尋（文件站版面）']]
            .map(([ks, d]) => h('tr', null, h('td', null, ks.map((k) => (k === '–' ? '–' : key(k)))), h('td', { text: d })))))),
      callout('tip', '錯題本採 Leitner 五盒法：答錯回第 1 盒，複習答對升一盒，間隔依序為當天、1、3、7、14 天。'),
    );
  }

  let tocObserver = null;
  function docsAfter(view) {
    const app = document.getElementById('app');
    const page = app.firstElementChild;
    if (!page) return;
    page.classList.add('d-page');
    // 上一頁／下一頁
    const i = NAV.findIndex((n) => isCurrent(view, n.v));
    if (i >= 0) {
      const prev = NAV[i - 1];
      const next = NAV[i + 1];
      page.append(h('nav', { class: 'd-pager', 'aria-label': '上一頁與下一頁' },
        prev ? h('a', { class: 'd-pg prev', href: '#' + prev.v }, h('span', { text: '上一頁' }), h('strong', { text: prev.label })) : h('span'),
        next ? h('a', { class: 'd-pg next', href: '#' + next.v }, h('span', { text: '下一頁' }), h('strong', { text: next.label })) : h('span')),
        h('p', { class: 'd-updated', text: `題庫版本 ${QG.BANK.build || ''}・共 ${QG.fmtNum(QG.QS.length)} 題` }));
    }
    // 本頁內容
    const toc = document.getElementById('toc');
    const heads = [...page.querySelectorAll('h2, h3')].filter((x) => !x.closest('.qitem, .card, .g-paa, .confirm'));
    if (tocObserver) tocObserver.disconnect();
    if (heads.length < 2) { toc.hidden = true; return; }
    heads.forEach((x, k) => { if (!x.id) x.id = `sec-${k}`; });
    const links = heads.map((x) => h('a', { href: '#' + view, class: x.tagName === 'H3' ? 'sub' : '', dataset: { target: x.id }, text: x.textContent,
      onclick: (e) => { e.preventDefault(); x.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); } }));
    fill(toc, h('div', { class: 'd-toc' }, h('p', { class: 'd-toc-title' }, icon('doc'), '本頁內容'), links));
    toc.hidden = false;
    tocObserver = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting) links.forEach((a) => a.classList.toggle('active', a.dataset.target === en.target.id));
      }
    }, { rootMargin: '-120px 0px -70% 0px' });
    heads.forEach((x) => tocObserver.observe(x));
  }

  /* ---------------------------------------------------------------- ⌘K 指令面板 */
  let palette = null;
  function openPalette() {
    if (palette) return;
    const input = h('input', { type: 'text', id: 'sk-palette-q', placeholder: '搜尋題目、主題或頁面', autocomplete: 'off', 'aria-label': '搜尋' });
    const list = h('ul', { class: 'd-pal-list', role: 'listbox' });
    let items = [];
    let active = 0;
    const draw = () => {
      const v = input.value.trim().toLowerCase();
      const pages = NAV.filter((n) => !v || n.label.includes(v)).map((n) => ({ group: '頁面', ico: n.icon, text: n.label, run: () => go(n.v) }));
      const tags = v ? QG.TAGS.filter(([t]) => t.toLowerCase().includes(v)).slice(0, 4).map(([t, n]) => ({ group: '主題', ico: 'tag', text: `${t}（${n} 題）`,
        run: () => { Object.assign(QG.browse, { kw: '', tag: t, exam: '', subject: 'all', only: 'all', page: 0 }); go('browse'); } })) : [];
      const qs = v ? QG.QS.filter((q) => q.text.includes(v)).slice(0, 8).map((q) => ({ group: '題目', ico: 'doc', text: q.q, sub: QG.srcLabel(q.src[0]),
        run: () => QG.startCustomPractice([q.id], '單題作答') })) : [];
      items = pages.concat(tags, qs);
      if (v && qs.length) items.push({ group: '題目', ico: 'browse', text: `在題庫搜尋「${input.value.trim()}」`, run: () => { Object.assign(QG.browse, { kw: input.value.trim(), tag: '', exam: '', subject: 'all', only: 'all', page: 0 }); go('browse'); } });
      active = Math.min(active, Math.max(0, items.length - 1));
      let lastGroup = '';
      const rows = [];
      items.forEach((it, i) => {
        if (it.group !== lastGroup) { rows.push(h('li', { class: 'd-pal-group', role: 'presentation', text: it.group })); lastGroup = it.group; }
        rows.push(h('li', { class: 'd-pal-item', role: 'option', 'aria-selected': i === active ? 'true' : 'false', id: `pal-${i}`,
          onmousemove: () => { if (active !== i) { active = i; mark(); } }, onclick: () => { closePalette(); it.run(); } },
          icon(it.ico), h('span', { class: 'd-pal-text' }, v ? highlight(it.text, v) : it.text), it.sub ? h('span', { class: 'd-pal-sub', text: it.sub }) : null));
      });
      if (!items.length) rows.push(h('li', { class: 'd-pal-empty', text: '沒有符合的結果' }));
      fill(list, rows);
    };
    const mark = () => {
      list.querySelectorAll('.d-pal-item').forEach((li) => li.setAttribute('aria-selected', li.id === `pal-${active}` ? 'true' : 'false'));
      const el = list.querySelector(`#pal-${active}`);
      if (el) el.scrollIntoView({ block: 'nearest' });
    };
    input.addEventListener('input', () => { active = 0; draw(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(1, items.length); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % Math.max(1, items.length); mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); const it = items[active]; if (it) { closePalette(); it.run(); } }
      else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    });
    palette = h('div', { class: 'd-pal-backdrop', onclick: (e) => { if (e.target === palette) closePalette(); } },
      h('div', { class: 'd-pal', role: 'dialog', 'aria-modal': 'true', 'aria-label': '搜尋' },
        h('div', { class: 'd-pal-input' }, icon('search'), input, h('kbd', { text: 'Esc' })),
        list,
        h('div', { class: 'd-pal-foot' }, h('span', null, h('kbd', { text: '↑' }), h('kbd', { text: '↓' }), ' 選擇'), h('span', null, h('kbd', { text: '↵' }), ' 開啟'), h('span', null, h('kbd', { text: 'Esc' }), ' 關閉'))));
    document.body.append(palette);
    draw();
    input.focus();
  }
  function closePalette() {
    if (!palette) return;
    palette.remove();
    palette = null;
  }
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && skin() === 'docs') {
      e.preventDefault();
      if (palette) closePalette(); else openPalette();
    }
  });

  /* ---------------------------------------------------------------- 接上主程式 */
  const base = Object.assign({}, QG.views);
  QG.views.home = () => (skin() === 'feed' ? feedHome() : skin() === 'search' ? searchHome() : skin() === 'docs' ? docsHome() : base.home());
  QG.views.browse = () => (skin() === 'search' ? searchResults() : skin() === 'feed' ? feedResults() : base.browse());

  QG.hooks.beforeRender = (view) => { closePalette(); buildShell(view); };
  QG.hooks.afterRender = (view) => {
    const s = skin();
    if (s === 'feed' && (view === 'practice' || view === 'review')) feedUpNext(view);
    if (s === 'docs') docsAfter(view);
  };

  root.dataset.skin = skin();
})();
