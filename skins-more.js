/* QuizGrinder 版面風格實驗（續）：社群與遊戲類版面
 *
 *   ig       照片牆：限時動態圈（全螢幕快閃題組）、方形貼文動態、探索格狀牆、個人檔案頁
 *   threads  串文：極簡單欄動態、投票式作答、串文回覆線、推薦主題、個人檔案
 *   game     要塞：手機策略遊戲介面——頂部資源列與等級盾牌、工廠基地（主題＝建築，依熟練度升級）、
 *            每日任務、出擊（模擬考）與勝利星數
 * 只借用版面與互動慣例；名稱、標誌、角色與美術都是 QuizGrinder 自己的設計。
 * 依賴 app.js 的 window.QG 與 skins.js 的 window.QGSkins。
 */
(function () {
  'use strict';
  const QG = window.QG;
  const SK = window.QGSkins;
  if (!QG || !SK) return;
  const { h, fill } = QG;
  const { icon, hue } = SK;
  const S = () => QG.S();

  Object.assign(SK.ICONS, {
    heart: '<path d="M12 20s-7-4.4-9.2-8.6C1.2 8.2 3.1 4.5 6.6 4.5c2 0 3.4 1.1 4.4 2.6 1-1.5 2.4-2.6 4.4-2.6 3.5 0 5.4 3.7 3.8 6.9C19 15.6 12 20 12 20z"/>',
    comment: '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/>',
    send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    plus: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/>',
    repost: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h16"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    stack: '<rect x="7" y="7" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
    swords: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 17.5L21 6V3h-3L6.5 14.5M11 19l-6-6M8 16l-4 4M5 21l-2-2"/>',
    hammer: '<path d="M15 12l-8.5 8.5a2.1 2.1 0 0 1-3-3L12 9"/><path d="M17.6 15L22 10.6 13.4 2 9 6.4z"/>',
    factory: '<path d="M2 20V9l6 4V9l6 4V5h6v15z"/><path d="M6 17h2M11 17h2M16 17h2"/>',
    scroll: '<path d="M8 21h11a2 2 0 0 0 2-2v-1H10v1a2 2 0 0 1-4 0V5a2 2 0 0 0-2-2h11a2 2 0 0 1 2 2v13"/><path d="M10 7h5M10 11h5"/>',
    coin: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>',
    flame: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-4-12-3 2-5 5-5 8-1-1-2-2-2-4-2 2-3 5-3 8 0 4 3 7 7 7z"/>',
  });

  /* ---------------------------------------------------------------- 共用元件 */

  /** 全螢幕對話框；回傳 {close} */
  function modal(content, cls, onClose) {
    const back = h('div', { class: 'mx-backdrop ' + (cls || ''), role: 'dialog', 'aria-modal': 'true',
      onclick: (e) => { if (e.target === back) close(); } },
      h('button', { class: 'mx-close', type: 'button', 'aria-label': '關閉', onclick: () => close() }, icon('close')),
      content);
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    function close() {
      if (!back.isConnected) return;
      back.remove();
      document.removeEventListener('keydown', onKey, true);
      document.body.classList.remove('mx-open');
      if (onClose) onClose();
      QG.updateBadges();
    }
    document.addEventListener('keydown', onKey, true);
    document.body.append(back);
    document.body.classList.add('mx-open');
    const f = back.querySelector('.ans-opt, input, a, button:not(.mx-close):not(.st-zone)');
    if (f) f.focus({ preventScroll: true });
    return { close, el: back };
  }
  let openModal = null;
  function closeModals() { if (openModal) { openModal.close(); openModal = null; } }

  /** 可直接作答的四個選項（作答會寫入學習紀錄） */
  function answerOptions(q, { cls, onDone } = {}) {
    let chosen = null;
    const wrap = h('div', { class: 'ans ' + (cls || ''), role: 'group', 'aria-label': '選項' });
    const draw = () => fill(wrap, QG.LETTERS.map((L) => {
      const correct = q.all || q.a.includes(L);
      let state = '';
      if (chosen) state = correct ? 'ok' : L === chosen ? 'ng' : 'dim';
      return h('button', { type: 'button', class: 'ans-opt ' + state, disabled: chosen ? true : null, onclick: () => pick(L) },
        h('span', { class: 'ans-l', text: L }), h('span', { class: 'ans-t', text: q.o[L] }),
        chosen && correct ? h('span', { class: 'ans-m', text: '✓' }) : chosen === L ? h('span', { class: 'ans-m', text: '✗' }) : null);
    }));
    function pick(L) {
      if (chosen) return;
      chosen = L;
      const ok = q.all || q.a.includes(L);
      QG.record(q.id, ok);
      QG.Store.save();
      QG.updateBadges();
      draw();
      if (onDone) onDone(ok, L);
    }
    draw();
    wrap.pick = (i) => { if (!chosen) pick(QG.LETTERS[i]); };
    return wrap;
  }

  function starBtn(q, cls, filledIcon) {
    const btn = h('button', { type: 'button', class: cls });
    const draw = () => {
      const on = !!(S().q[q.id] && S().q[q.id].s);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? '取消收藏' : '收藏');
      fill(btn, icon(filledIcon || 'heart'));
      btn.classList.toggle('on', on);
    };
    btn.addEventListener('click', () => { QG.toggleStar(q.id); draw(); });
    draw();
    return btn;
  }

  async function copyQuestion(q) {
    const text = `${q.q}\n` + QG.LETTERS.map((L) => `(${L}) ${q.o[L]}`).join('\n') + `\n— ${q.src.map(QG.srcLabel).join('、')}`;
    try { await navigator.clipboard.writeText(text); QG.toast('已複製題目'); } catch (e) { QG.toast('這個瀏覽器不允許複製'); }
  }

  function addToReview(q) {
    const r = S().q[q.id] || (S().q[q.id] = { c: 0, w: 0 });
    if (!r.b) r.b = 1;
    r.d = Date.now();
    QG.Store.save();
    QG.updateBadges();
    QG.toast('已加入錯題本');
  }

  function relTime(ts) {
    if (!ts) return '尚未作答';
    const d = (Date.now() - ts) / 1000;
    if (d < 60) return '剛剛';
    if (d < 3600) return `${Math.floor(d / 60)} 分鐘前`;
    if (d < 86400) return `${Math.floor(d / 3600)} 小時前`;
    return `${Math.floor(d / 86400)} 天前`;
  }

  const handle = (q) => (q.mock ? 'mock.模擬題' : q.s === 'industry' ? 'l11.產業概論' : 'l12.製造概論');

  /** 依目前練習範圍產生的動態題目順序（同一次瀏覽內保持穩定） */
  const pools = {};
  function feedPool(key, order) {
    const f = S().settings.filters;
    const sig = JSON.stringify([f, order]);
    if (!pools[key] || pools[key].sig !== sig) {
      let ids = QG.filterQuestions(f).map((q) => q.id);
      if (order === 'latest') ids = ids.sort((a, b) => QG.QMAP.get(b).year - QG.QMAP.get(a).year || (Math.random() - 0.5));
      else ids = QG.buildQueue(ids, order === 'weak' ? 'weak' : 'random');
      pools[key] = { sig, ids };
    }
    return pools[key].ids;
  }

  /** 無限捲動清單 */
  let activeIO = null;
  function infiniteList(ids, renderItem, cls) {
    if (activeIO) activeIO.disconnect();
    const list = h('div', { class: cls });
    const sentinel = h('div', { class: 'inf-end' }, h('span', { class: 'muted', text: '載入中…' }));
    let n = 0;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) more(); }, { rootMargin: '800px 0px' });
    function more() {
      const next = ids.slice(n, n + 6);
      n += next.length;
      next.forEach((id) => { const q = QG.QMAP.get(id); if (q) list.append(renderItem(q)); });
      if (n >= ids.length) {
        fill(sentinel, h('span', { class: 'muted', text: ids.length ? '沒有更多了' : '這個範圍沒有題目' }));
        io.disconnect();
      }
    }
    more();
    activeIO = io;
    setTimeout(() => io.observe(sentinel), 0);
    return h('div', null, list, sentinel);
  }

  function tileGrid(qs, cls) {
    return h('div', { class: cls }, qs.map((q) => h('button', { class: 'tile', type: 'button', style: `--h:${hue(q.t[0] || q.id)}`, 'aria-label': q.q,
      onclick: () => { openModal = modal(h('div', { class: 'ig-modal-post' }, igPost(q)), 'ig-modal'); } },
      q.fig ? h('img', { src: q.fig, alt: '', loading: 'lazy' }) : h('span', { class: 'tile-text', text: q.q }),
      q.src.length > 1 ? h('span', { class: 'tile-badge', title: `考過 ${q.src.length} 次` }, icon('stack')) : null)));
  }

  /* ================================================================ 照片牆 ig */

  const IG_NAV = [
    { v: 'home', label: '首頁', icon: 'home' },
    { v: 'browse', label: '探索', icon: 'compass' },
    { v: 'exam', label: '模擬考', icon: 'plus' },
    { v: 'review', label: '錯題', icon: 'heart', badge: true },
    { v: 'stats', label: '個人檔案', icon: 'user' },
  ];

  function igWordmark() {
    return h('a', { class: 'ig-word', href: '#home', 'aria-label': 'QuizGrinder 首頁', text: 'QuizGrinder' });
  }

  function igTop() {
    return h('div', { class: 'sk-top ig-top' }, igWordmark(), h('div', { class: 'sk-right' },
      h('a', { class: 'sk-iconbtn', href: '#review', 'aria-label': '錯題本' }, icon('heart'), h('span', { class: 'badge', 'data-badge': 'review', hidden: true }))));
  }

  function igSide(view) {
    return h('nav', { class: 'ig-side', 'aria-label': '主要功能' },
      igWordmark(),
      h('div', { class: 'ig-side-items' },
        IG_NAV.map((n) => h('a', { class: 'ig-side-item', href: '#' + n.v, 'aria-current': SK.isCurrent(view, n.v) ? 'page' : null },
          icon(n.icon), h('span', { text: n.label }), n.badge ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null)),
        h('a', { class: 'ig-side-item', href: '#practice', 'aria-current': view === 'practice' ? 'page' : null }, icon('practice'), h('span', { text: '專心練習' }))));
  }

  function igAvatar(label, key, big) {
    return h('span', { class: 'ig-ring' + (big ? ' big' : '') }, h('span', { class: 'ig-av', style: `--h:${hue(key)}`, text: label }));
  }

  function igPost(q) {
    const r = S().q[q.id];
    const code = QG.SUBJ_CODE[q.s];
    const comments = h('div', { class: 'ig-comments', hidden: true });
    const showComments = () => {
      fill(comments,
        h('p', null, h('strong', { text: 'quizgrinder' }), ' 出處：', q.src.map(QG.srcLabel).join('、')),
        h('p', null, h('strong', { text: 'quizgrinder' }), ' 答案：', q.all ? '官方釋疑，所有選項均給分' : q.a.map((L) => `${L}. ${q.o[L]}`).join('；')),
        q.x ? h('p', null, h('strong', { text: 'quizgrinder' }), ' ' + q.x) : null);
      comments.hidden = false;
    };
    const opts = answerOptions(q, { cls: 'ig-opts', onDone: showComments });
    return h('article', { class: 'ig-post' },
      h('header', { class: 'ig-post-head' }, igAvatar(code, q.s),
        h('div', { class: 'ig-post-who' }, h('strong', { text: handle(q) }), h('span', { text: QG.srcLabel(q.src[0]) }))),
      q.fig
        ? h('div', { class: 'ig-media fig' }, h('img', { src: q.fig, alt: '題目附圖', loading: 'lazy' }))
        : h('div', { class: 'ig-media text', style: `--h:${hue(q.t[0] || q.id)}` }, h('p', { text: q.q })),
      h('div', { class: 'ig-actions' },
        starBtn(q, 'ig-act', 'heart'),
        h('button', { class: 'ig-act', type: 'button', 'aria-label': '看答案與出處', onclick: showComments }, icon('comment')),
        h('button', { class: 'ig-act', type: 'button', 'aria-label': '複製題目', onclick: () => copyQuestion(q) }, icon('send')),
        h('span', { class: 'spacer' }),
        h('button', { class: 'ig-act', type: 'button', 'aria-label': '加入錯題本', onclick: () => addToReview(q) }, icon('bookmark'))),
      h('p', { class: 'ig-likes', text: r && (r.c + r.w) ? `你答過 ${r.c + r.w} 次・答對 ${r.c} 次` : '還沒作答過這題' }),
      h('p', { class: 'ig-cap' }, h('strong', { text: handle(q) }), ' ', q.fig ? q.q : '選出正確答案',
        h('span', { class: 'ig-tags', text: ' ' + q.t.filter((t) => t !== '其他').map((t) => '#' + t).concat(q.src.length > 1 ? [`#考過${q.src.length}次`] : []).join(' ') })),
      opts,
      comments,
      h('time', { class: 'ig-time', text: relTime(r && r.t) }));
  }

  function igStories() {
    const due = QG.dueReviewIds();
    const official = QG.QS.filter((q) => q.official);
    const st = S().q;
    const items = [];
    if (due.length) items.push({ key: 'due', label: `錯題 ${due.length}`, ids: due, av: '錯' });
    items.push({ key: 'industry', label: 'L11 產業', ids: official.filter((q) => q.s === 'industry').map((q) => q.id), av: 'L11' });
    items.push({ key: 'process', label: 'L12 製造', ids: official.filter((q) => q.s === 'process').map((q) => q.id), av: 'L12' });
    QG.TAGS.filter(([t]) => t !== '其他').slice(0, 12).forEach(([t]) => items.push({ key: t, label: t, ids: official.filter((q) => q.t.includes(t)).map((q) => q.id), av: t.slice(0, 2) }));
    return h('div', { class: 'ig-stories', role: 'list', 'aria-label': '快閃題組' }, items.map((it) => {
      const fresh = it.key === 'due' || it.ids.some((id) => !st[id]);
      return h('button', { class: 'ig-story' + (fresh ? ' fresh' : ''), type: 'button', role: 'listitem', onclick: () => openStory(it) },
        igAvatar(it.av, it.key, true), h('span', { class: 'ig-story-name', text: it.label }));
    }));
  }

  /** 快閃題組：全螢幕、上方分段進度、點左右兩側切換、作答後自動下一題 */
  function openStory(it) {
    const ids = it.key === 'due' ? it.ids.slice(0, 10) : QG.buildQueue(it.ids, 'weak').slice(0, 10);
    let i = 0;
    let timer = null;
    const result = {};
    const bars = h('div', { class: 'st-bars' });
    const body = h('div', { class: 'st-body' });
    const counter = h('span', { class: 'st-count' });
    let opts = null;
    const drawBars = () => fill(bars, ids.map((_, k) => h('span', { class: 'st-seg' + (k < i || result[k] !== undefined ? ' done' : '') + (result[k] === false ? ' ng' : '') })));
    const show = () => {
      clearTimeout(timer);
      drawBars();
      if (i >= ids.length) {
        const c = Object.values(result).filter(Boolean).length;
        counter.textContent = '完成';
        fill(body, h('div', { class: 'st-done' }, h('strong', { text: '這組完成了' }), h('p', { text: `答對 ${c} / ${Object.keys(result).length}` }),
          h('button', { class: 'st-btn', type: 'button', text: '關閉', onclick: () => m.close() })));
        return;
      }
      const q = QG.QMAP.get(ids[i]);
      counter.textContent = `${i + 1}/${ids.length}・${QG.srcLabel(q.src[0])}`;
      opts = answerOptions(q, { cls: 'st-opts', onDone: (ok) => { result[i] = ok; drawBars(); timer = setTimeout(next, ok ? 1100 : 2200); } });
      fill(body, h('div', { class: 'st-card', style: `--h:${hue(q.t[0] || q.id)}` },
        h('p', { class: 'st-q', text: q.q }),
        q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖' })) : null,
        opts));
    };
    const next = () => { if (i < ids.length) { i++; show(); } };
    const prev = () => { if (i > 0) { i--; show(); } };
    const onKey = (e) => {
      if (e.key === 'ArrowRight') { next(); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { prev(); e.preventDefault(); }
      else if ('1234'.includes(e.key) && opts) { opts.pick(+e.key - 1); }
      else if ('abcdABCD'.includes(e.key) && e.key.length === 1 && opts) { opts.pick('ABCD'.indexOf(e.key.toUpperCase())); }
      else return;
      e.stopPropagation();
    };
    document.addEventListener('keydown', onKey, true);
    const m = modal(h('div', { class: 'st' },
      bars,
      h('div', { class: 'st-head' }, igAvatar(it.av, it.key), h('strong', { text: it.label }), counter),
      h('button', { class: 'st-zone prev', type: 'button', 'aria-label': '上一題', onclick: prev }),
      h('button', { class: 'st-zone next', type: 'button', 'aria-label': '下一題', onclick: next }),
      body), 'st-backdrop', () => { clearTimeout(timer); document.removeEventListener('keydown', onKey, true); });
    openModal = m;
    show();
  }

  function igHome() {
    const ids = feedPool('ig', S().settings.order);
    return h('div', { class: 'ig-home' }, igStories(),
      h('p', { class: 'ig-scope' }, `動態範圍：${QG.filterLabel(S().settings.filters)}・`, h('a', { href: '#practice', text: '改用專心練習' })),
      infiniteList(ids, igPost, 'ig-feed'));
  }

  const igExploreState = { limit: 30 };
  function igExplore() {
    const input = h('input', { type: 'search', id: 'ig-q', placeholder: '搜尋', value: QG.browse.kw, 'aria-label': '搜尋題目' });
    const gridWrap = h('div');
    const draw = () => {
      const kw = input.value.trim().toLowerCase();
      const list = QG.QS.filter((q) => !kw || q.text.includes(kw));
      fill(gridWrap, tileGrid(list.slice(0, igExploreState.limit), 'ig-grid'),
        list.length > igExploreState.limit ? h('div', { class: 'inf-end' }, h('button', { class: 'btn', type: 'button', text: '載入更多', onclick: () => { igExploreState.limit += 30; draw(); } })) : null,
        !list.length ? h('p', { class: 'muted', text: '沒有符合的題目' }) : null);
    };
    input.addEventListener('input', () => { QG.browse.kw = input.value; igExploreState.limit = 30; draw(); });
    draw();
    return h('div', { class: 'ig-explore' }, h('div', { class: 'ig-search' }, icon('search'), input), gridWrap);
  }

  const igProfileState = { tab: 'wrong' };
  function igProfile(base) {
    const st = S();
    const t = QG.totals();
    const wrong = QG.QS.filter((q) => st.q[q.id] && st.q[q.id].w > 0);
    const starred = QG.QS.filter((q) => st.q[q.id] && st.q[q.id].s);
    const tabs = [['wrong', 'grid', `答錯過 ${wrong.length}`], ['star', 'bookmark', `收藏 ${starred.length}`], ['data', 'stats', '數據']];
    const content = igProfileState.tab === 'data' ? base.stats()
      : (igProfileState.tab === 'wrong' ? wrong : starred).length ? tileGrid(igProfileState.tab === 'wrong' ? wrong : starred, 'ig-grid')
        : h('div', { class: 'ig-empty' }, icon(igProfileState.tab === 'wrong' ? 'grid' : 'bookmark'), h('p', { text: igProfileState.tab === 'wrong' ? '答錯的題目會出現在這裡' : '按愛心收藏的題目會出現在這裡' }));
    const exams = st.exams.slice(-8).reverse();
    return h('div', { class: 'ig-profile' },
      h('header', { class: 'ig-prof-head' },
        igAvatar('Q', 'me', true),
        h('div', { class: 'ig-prof-info' },
          h('div', { class: 'ig-prof-name' }, h('h1', { text: 'quizgrinder.learner' }),
            h('a', { class: 'ig-btn', href: '#practice', text: '開始練習' }), h('a', { class: 'ig-btn', href: '#exam', text: '模擬考' })),
          h('ul', { class: 'ig-counts' },
            h('li', null, h('b', { text: QG.fmtNum(t.n) }), ' 次作答'), h('li', null, h('b', { text: QG.pct(t.c, t.n) }), ' 正確率'), h('li', null, h('b', { text: String(QG.streak()) }), ' 天連續')),
          h('p', { class: 'ig-bio' }, h('strong', { text: '我的學習' }), h('br'), 'IPAS 初級電路板製程工程師備考中', h('br'), `已練 ${QG.fmtNum(t.seen)} / ${QG.fmtNum(QG.QS.length)} 題・錯題本 ${QG.dueReviewIds().length} 題待複習`))),
      exams.length ? h('div', { class: 'ig-highlights', 'aria-label': '模擬考精選' }, exams.map((e) => h('a', { class: 'ig-story', href: '#exam' },
        h('span', { class: 'ig-ring hl' }, h('span', { class: 'ig-av', style: `--h:${hue(e.subject)}`, text: String(e.score) })),
        h('span', { class: 'ig-story-name', text: `${QG.SUBJ_CODE[e.subject]} ${new Date(e.ts).getMonth() + 1}/${new Date(e.ts).getDate()}` })))) : null,
      h('nav', { class: 'ig-tabs', 'aria-label': '個人檔案分頁' }, tabs.map(([k, ic, l]) => h('button', { type: 'button', 'aria-current': igProfileState.tab === k ? 'page' : null,
        onclick: () => { igProfileState.tab = k; QG.render(); } }, icon(ic), h('span', { text: l })))),
      content);
  }

  /* ================================================================ 串文 threads */

  const TH_NAV = [
    { v: 'home', label: '首頁', icon: 'home' },
    { v: 'browse', label: '搜尋', icon: 'search' },
    { v: 'exam', label: '模擬考', icon: 'plus' },
    { v: 'review', label: '錯題', icon: 'heart', badge: true },
    { v: 'stats', label: '個人檔案', icon: 'user' },
  ];
  const TH_TITLE = { home: '首頁', practice: '練習', review: '錯題本', exam: '模擬考', result: '考試結果', browse: '搜尋', stats: '個人檔案' };

  function thTop(view) {
    return h('div', { class: 'sk-top th-top' }, h('a', { class: 'th-logo', href: '#home', 'aria-label': 'QuizGrinder 首頁' }, icon('pad')),
      h('span', { class: 'th-title', text: TH_TITLE[view] || '' }));
  }

  function thSide(view) {
    return h('nav', { class: 'th-side', 'aria-label': '主要功能' },
      h('a', { class: 'th-logo', href: '#home', 'aria-label': 'QuizGrinder 首頁' }, icon('pad')),
      h('div', { class: 'th-side-items' }, TH_NAV.map((n) => h('a', { class: 'th-side-item', href: '#' + n.v, title: n.label, 'aria-label': n.label,
        'aria-current': SK.isCurrent(view, n.v) ? 'page' : null }, icon(n.icon), n.badge ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null))),
      h('a', { class: 'th-side-item', href: '#practice', title: '專心練習', 'aria-label': '專心練習', 'aria-current': view === 'practice' ? 'page' : null }, icon('practice')));
  }

  function thAvatar(label, key, small) {
    return h('span', { class: 'th-av' + (small ? ' small' : ''), style: `--h:${hue(key)}`, text: label });
  }

  function thPost(q) {
    const code = QG.SUBJ_CODE[q.s];
    const r = S().q[q.id];
    const thread = h('div', { class: 'th-thread' });
    const reply = h('div', { class: 'th-post th-sub', hidden: true },
      h('div', { class: 'th-rail' }, thAvatar('Q', 'quizgrinder', true)),
      h('div', { class: 'th-main' },
        h('div', { class: 'th-head' }, h('strong', { text: 'quizgrinder' }), h('span', { class: 'th-time', text: '作者回覆' })),
        h('p', { class: 'th-text', text: (q.all ? '官方釋疑：所有選項均給分。' : `答案是 ${q.a.join('、')}。`) + `\n出處：${q.src.map(QG.srcLabel).join('、')}${q.src.length > 1 ? `（考過 ${q.src.length} 次）` : ''}` }),
        q.t.filter((t) => t !== '其他').length ? h('p', { class: 'th-tags' }, q.t.filter((t) => t !== '其他').map((t) => h('button', { class: 'th-tag', type: 'button', text: t,
          onclick: () => { Object.assign(QG.browse, { kw: t, tag: '', exam: '' }); SK.go('browse'); } }))) : null,
        q.x ? h('p', { class: 'th-text', text: q.x }) : null));
    const openReply = () => { reply.hidden = false; thread.classList.add('has-reply'); };
    const poll = answerOptions(q, { cls: 'th-poll', onDone: openReply });
    fill(thread,
      h('article', { class: 'th-post' },
        h('div', { class: 'th-rail' }, thAvatar(code, q.s), h('span', { class: 'th-line' })),
        h('div', { class: 'th-main' },
          h('div', { class: 'th-head' }, h('strong', { text: handle(q) }), h('span', { class: 'th-time', text: QG.srcLabel(q.src[0]) })),
          h('p', { class: 'th-text', text: q.q }),
          q.fig ? h('figure', { class: 'qfig th-fig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖', loading: 'lazy' })) : null,
          poll,
          h('p', { class: 'th-pollmeta', text: r && (r.c + r.w) ? `你答過 ${r.c + r.w} 次・${relTime(r.t)}` : '投下你的答案' }),
          h('div', { class: 'th-actions' },
            starBtn(q, 'th-act', 'heart'),
            h('button', { class: 'th-act', type: 'button', 'aria-label': '看作者回覆', onclick: openReply }, icon('comment')),
            h('button', { class: 'th-act', type: 'button', 'aria-label': '加入錯題本', onclick: () => addToReview(q) }, icon('repost')),
            h('button', { class: 'th-act', type: 'button', 'aria-label': '複製題目', onclick: () => copyQuestion(q) }, icon('send'))))),
      reply);
    return thread;
  }

  const thState = { tab: 'weak' };
  function thHome() {
    const input = h('input', { type: 'text', id: 'th-compose', placeholder: '搜尋串文…', 'aria-label': '搜尋題目' });
    const ids = feedPool('th-' + thState.tab, thState.tab);
    return h('div', { class: 'th-col' },
      h('div', { class: 'th-tabs', role: 'tablist' }, [['weak', '為你推薦'], ['latest', '最新考卷']].map(([k, l]) =>
        h('button', { type: 'button', role: 'tab', 'aria-selected': thState.tab === k ? 'true' : 'false', text: l, onclick: () => { thState.tab = k; QG.render(); } }))),
      h('div', { class: 'th-card' },
        h('form', { class: 'th-compose', onsubmit: (e) => { e.preventDefault(); Object.assign(QG.browse, { kw: input.value.trim(), tag: '', exam: '' }); SK.go('browse'); } },
          thAvatar('Q', 'me'), input, h('button', { class: 'th-pill', type: 'submit', text: '搜尋' })),
        infiniteList(ids, thPost, 'th-feed')));
  }

  function thSearch() {
    const input = h('input', { type: 'search', id: 'th-q', placeholder: '搜尋', value: QG.browse.kw, 'aria-label': '搜尋題目' });
    const out = h('div');
    const draw = () => {
      const kw = input.value.trim().toLowerCase();
      if (!kw) {
        fill(out, h('h2', { class: 'th-sec', text: '推薦主題' }), QG.TAGS.filter(([t]) => t !== '其他').map(([t, n]) => {
          const ids = QG.QS.filter((q) => q.official && q.t.includes(t)).map((q) => q.id);
          const p = SK.progressOf(ids);
          return h('div', { class: 'th-acct' }, thAvatar(t.slice(0, 1), t),
            h('div', { class: 'th-acct-text' }, h('strong', { text: t }), h('span', { text: `${n} 題・已練 ${p.seen}` })),
            h('button', { class: 'th-pill', type: 'button', text: '練習', onclick: () => QG.startCustomPractice(ids, `主題：${t}`) }));
        }));
        return;
      }
      const ids = QG.QS.filter((q) => q.text.includes(kw)).map((q) => q.id);
      fill(out, h('p', { class: 'muted th-count', text: `「${input.value.trim()}」共 ${ids.length} 則` }), infiniteList(ids, thPost, 'th-feed'));
    };
    let t;
    input.addEventListener('input', () => { QG.browse.kw = input.value; clearTimeout(t); t = setTimeout(draw, 200); });
    draw();
    return h('div', { class: 'th-col' }, h('div', { class: 'th-card' }, h('div', { class: 'th-search' }, icon('search'), input), out));
  }

  const thProfState = { tab: 'wrong' };
  function thProfile(base) {
    const st = S();
    const t = QG.totals();
    const wrong = QG.QS.filter((q) => st.q[q.id] && st.q[q.id].w > 0).map((q) => q.id);
    const starred = QG.QS.filter((q) => st.q[q.id] && st.q[q.id].s).map((q) => q.id);
    const tabs = [['wrong', '答錯過'], ['star', '收藏'], ['data', '數據']];
    const content = thProfState.tab === 'data' ? base.stats() : infiniteList(thProfState.tab === 'wrong' ? wrong : starred, thPost, 'th-feed');
    return h('div', { class: 'th-col' }, h('div', { class: 'th-card' },
      h('header', { class: 'th-prof' },
        h('div', null, h('h1', { text: '我的學習' }), h('p', { class: 'th-handle', text: 'quizgrinder.learner' }),
          h('p', { class: 'th-bio', text: 'IPAS 初級電路板製程工程師備考中' }),
          h('p', { class: 'muted th-meta', text: `${QG.fmtNum(t.n)} 次作答・正確率 ${QG.pct(t.c, t.n)}・連續 ${QG.streak()} 天` })),
        thAvatar('Q', 'me')),
      h('div', { class: 'th-tabs under', role: 'tablist' }, tabs.map(([k, l]) =>
        h('button', { type: 'button', role: 'tab', 'aria-selected': thProfState.tab === k ? 'true' : 'false', text: l, onclick: () => { thProfState.tab = k; QG.render(); } }))),
      thProfState.tab !== 'data' && !(thProfState.tab === 'wrong' ? wrong : starred).length
        ? h('p', { class: 'muted th-emptyline', text: thProfState.tab === 'wrong' ? '還沒有答錯的題目。' : '還沒有收藏的題目，按愛心即可收藏。' })
        : content));
  }

  /* ================================================================ 要塞 game */

  const GAME_NAV = [
    { v: 'home', label: '基地', icon: 'factory' },
    { v: 'practice', label: '訓練', icon: 'practice' },
    { v: 'exam', label: '出擊', icon: 'swords', big: true },
    { v: 'review', label: '修復', icon: 'hammer', badge: true },
    { v: 'stats', label: '戰績', icon: 'scroll' },
  ];
  const starsFor = (score) => (score >= 85 ? 3 : score >= 70 ? 2 : score >= 60 ? 1 : 0);
  const TITLES = [[1, '見習生'], [3, '作業員'], [5, '技術員'], [8, '工程師'], [12, '資深工程師'], [16, '製程專家']];

  /** 經驗值＝答對次數 × 10；第 L 級需要累積 250 × L × (L − 1) / 2 XP */
  function levelInfo() {
    const xp = QG.totals().c * 10;
    let L = 1;
    const need = (n) => (250 * n * (n - 1)) / 2;
    while (xp >= need(L + 1)) L++;
    const lo = need(L);
    const hi = need(L + 1);
    const title = TITLES.filter(([lv]) => L >= lv).pop()[1];
    return { L, xp, into: xp - lo, span: hi - lo, title };
  }

  function shield(level) {
    const span = document.createElement('span');
    span.className = 'gm-shield';
    span.innerHTML = '<svg viewBox="0 0 40 46" aria-hidden="true"><path d="M20 2l17 6v14c0 11-8 18-17 22C11 40 3 33 3 22V8z" fill="#3a7bd5" stroke="#1d2b4a" stroke-width="3"/><path d="M20 6l13 4.5V22c0 8.5-6 14-13 17.5" fill="#5b9cf0"/></svg>';
    span.append(h('b', { text: String(level) }));
    return span;
  }

  function resPill(ic, value, label, cls) {
    return h('span', { class: 'gm-pill ' + (cls || ''), title: label, 'aria-label': `${label} ${value}` },
      h('span', { class: 'gm-pill-ico' }, icon(ic)), h('span', { class: 'gm-pill-num', text: QG.fmtNum(value) }));
  }

  function gameTop() {
    const lv = levelInfo();
    const stars = S().exams.reduce((a, e) => a + starsFor(e.score), 0);
    return h('div', { class: 'sk-top gm-hud' },
      h('a', { class: 'gm-player', href: '#stats', 'aria-label': `等級 ${lv.L} ${lv.title}` }, shield(lv.L),
        h('span', { class: 'gm-player-info' }, h('span', { class: 'gm-name', text: lv.title }),
          h('span', { class: 'gm-xp' }, h('i', { style: `width:${Math.round((lv.into / lv.span) * 100)}%` }), h('span', { text: `${QG.fmtNum(lv.into)} / ${QG.fmtNum(lv.span)} XP` })))),
      h('span', { class: 'spacer' }),
      resPill('coin', QG.totals().c, '銅幣（答對題數）', 'coin'),
      resPill('star', stars, '星星（模擬考）', 'star'),
      resPill('flame', QG.streak(), '連續天數', 'flame'));
  }

  function buildingsData() {
    const official = QG.QS.filter((q) => q.official);
    return QG.TAGS.filter(([t]) => t !== '其他').map(([t]) => {
      const ids = official.filter((q) => q.t.includes(t)).map((q) => q.id);
      const p = SK.progressOf(ids);
      const acc = p.n ? p.c / p.n : 0;
      const score = (p.seen / ids.length) * acc * 5; // 0–5
      const level = Math.min(5, Math.floor(score + 1e-9));
      return { t, ids, p, acc, level, prog: level >= 5 ? 1 : score - level };
    });
  }

  function openBuilding(b) {
    const up = QG.buildQueue(b.ids, 'weak').slice(0, 10);
    openModal = modal(h('div', { class: 'gm-panel gm-dialog' },
      h('div', { class: 'gm-ribbon', text: b.t }),
      h('div', { class: 'gm-dialog-body' },
        h('div', { class: 'gm-bld big', style: `--h:${hue(b.t)};--lv:${b.level}` }, buildingArt()),
        h('div', { class: 'gm-dialog-stats' },
          h('p', null, h('b', { text: `等級 ${b.level} / 5` })),
          h('p', { text: `已練 ${b.p.seen} / ${b.ids.length} 題` }),
          h('p', { text: `正確率 ${QG.pct(b.p.c, b.p.n)}` }),
          h('p', { class: 'gm-note', text: b.level >= 5 ? '已升到最高等級！' : '練過的題目越多、正確率越高，建築等級越高。' }))),
      h('div', { class: 'gm-dialog-btns' },
        h('button', { class: 'gm-btn green', type: 'button', onclick: () => { openModal.close(); QG.startCustomPractice(up, `升級：${b.t}`); } }, icon('hammer'), '升級（10 題）'),
        h('button', { class: 'gm-btn', type: 'button', onclick: () => { openModal.close(); QG.startCustomPractice(b.ids, `主題：${b.t}`); } }, `全部 ${b.ids.length} 題`))), 'gm-modal');
  }

  function buildingArt() {
    return h('span', { class: 'gm-art', 'aria-hidden': 'true' },
      h('span', { class: 'gm-roof' }), h('span', { class: 'gm-body' }, h('span', { class: 'gm-win' }), h('span', { class: 'gm-win' }), h('span', { class: 'gm-door' })),
      h('span', { class: 'gm-base' }));
  }

  function missions() {
    const st = S();
    const today = st.days[QG.dayKey()] || { n: 0, c: 0 };
    const examsToday = st.exams.filter((e) => QG.dayKey(new Date(e.ts)) === QG.dayKey()).length;
    const list = [
      ['今日作答 20 題', today.n, 20, '#practice'],
      ['今日答對 15 題', today.c, 15, '#practice'],
      ['完成 1 場模擬考', examsToday, 1, '#exam'],
      ['連續練習 3 天', QG.streak(), 3, '#practice'],
    ];
    return h('section', { class: 'gm-panel gm-missions' },
      h('div', { class: 'gm-ribbon small', text: '每日任務' }),
      list.map(([label, v, goal, href]) => {
        const done = v >= goal;
        return h('a', { class: 'gm-mission' + (done ? ' done' : ''), href },
          h('span', { class: 'gm-m-label', text: label }),
          h('span', { class: 'gm-bar' }, h('i', { style: `width:${Math.min(100, Math.round((v / goal) * 100))}%` }), h('span', { text: done ? '完成！' : `${Math.min(v, goal)}/${goal}` })));
      }));
  }

  function gameHome() {
    const blds = buildingsData();
    const due = QG.dueReviewIds().length;
    const lv = levelInfo();
    return h('div', { class: 'gm-home' },
      h('section', { class: 'gm-field', 'aria-label': '工廠基地：每棟建築是一個主題' },
        h('div', { class: 'gm-field-head' }, h('span', { class: 'gm-ribbon small', text: '電路板工廠基地' }),
          h('span', { class: 'gm-tip', text: `${blds.filter((b) => b.level >= 5).length} / ${blds.length} 棟滿級` })),
        h('div', { class: 'gm-town' }, blds.map((b) => h('button', { class: 'gm-bld', type: 'button', style: `--h:${hue(b.t)};--lv:${b.level}`,
          onclick: () => openBuilding(b), 'aria-label': `${b.t}，等級 ${b.level}` },
          buildingArt(),
          h('span', { class: 'gm-lv', text: String(b.level) }),
          h('span', { class: 'gm-plate', text: b.t }),
          h('span', { class: 'gm-bar thin' }, h('i', { style: `width:${Math.round(b.prog * 100)}%` })))))),
      h('aside', { class: 'gm-aside' },
        h('a', { class: 'gm-attack', href: '#exam' }, icon('swords'), h('span', null, h('b', { text: '出擊！' }), h('small', { text: `模擬考 ${QG.EXAM_LEN} 題` }))),
        h('a', { class: 'gm-btn repair' + (due ? '' : ' muted'), href: '#review' }, icon('hammer'), due ? `修復錯題（${due}）` : '沒有待修復的錯題'),
        missions(),
        h('p', { class: 'gm-note light', text: `等級 ${lv.L}・累積 ${QG.fmtNum(lv.xp)} XP。答對 1 題 = 1 銅幣 + 10 XP；模擬考 60／70／85 分分別拿 1／2／3 顆星。` })));
  }

  function gameResult(base) {
    const r = S().lastResult;
    const view = base.result();
    if (!r) return view;
    const stars = starsFor(r.score);
    const banner = h('div', { class: 'gm-victory ' + (stars ? 'win' : 'lose') },
      h('div', { class: 'gm-ribbon big', text: stars ? '勝利！' : '再接再厲' }),
      h('div', { class: 'gm-stars', role: 'img', 'aria-label': `${stars} 顆星` }, [1, 2, 3].map((i) => h('span', { class: 'gm-star s' + i + (i <= stars ? ' on' : '') }, icon('star')))),
      h('p', { class: 'gm-score', text: `${r.score} 分` }),
      h('p', { class: 'gm-loot' }, resPill('coin', r.correct, '獲得銅幣', 'coin'), h('span', { text: `+${r.correct * 10} XP` })));
    view.prepend(banner);
    return view;
  }

  /* ---------------------------------------------------------------- 註冊 */
  SK.register({ id: 'ig', label: '照片牆', top: igTop, side: igSide, nav: IG_NAV,
    views: { home: igHome, browse: igExplore, stats: igProfile } });
  SK.register({ id: 'threads', label: '串文', top: thTop, side: thSide, nav: TH_NAV,
    views: { home: thHome, browse: thSearch, stats: thProfile } });
  SK.register({ id: 'game', label: '要塞', top: gameTop, nav: GAME_NAV,
    views: { home: gameHome, result: gameResult } });

  const prevBefore = QG.hooks.beforeRender;
  QG.hooks.beforeRender = (view) => { closeModals(); if (activeIO) { activeIO.disconnect(); activeIO = null; } prevBefore(view); };
})();
