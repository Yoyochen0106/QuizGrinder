/* QuizGrinder 版面風格：蝦皮風（shopee）
 *
 * 首頁變成購物網站首頁：橘色頁首與大搜尋框、自動輪播橫幅（模擬考／錯題本／高頻題）、
 * 圓形分類圖示＝主題、「限時挑戰」倒數到午夜＋高頻題（誠實標示「考過 N 次」）、
 * 每日任務券（真的達成才能領取，領取狀態按日存在 settings.skinData.shopee）、
 * 「每日新發現」商品格狀牆（顯示你的正確率），點開為商品詳情式的作答對話框。
 * 只借用版面、互動與配色；沒有假銷量、假評價。標誌用 QuizGrinder 的焊墊圖示。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon, hue } = SK;
  const S = () => QG.S();

  Object.assign(SK.ICONS, {
    spCart: '<path d="M3 4h2.5l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17.5" cy="20" r="1.3"/>',
    spBolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    spTicket: '<path d="M3 7a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4z"/><path d="M9 5v14" stroke-dasharray="2 2"/>',
    spPause: '<path d="M8 5v14M16 5v14"/>',
    spPlay: '<path d="M7 4l13 8-13 8z"/>',
    spPrev: '<path d="M15 5l-7 7 7 7"/>',
    spNext: '<path d="M9 5l7 7-7 7"/>',
    spUser: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>',
    spShop: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5 11v9h14v-9"/>',
  });

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hotQs = () => QG.QS.filter((q) => q.src.length > 1);
  const recOf = (id) => S().q[id];
  const accText = (id) => { const r = recOf(id); return r && (r.c + r.w) ? `你的正確率 ${QG.pct(r.c, r.c + r.w)}` : '尚未作答'; };

  /** 依日期產生的穩定亂數（同一天同一組限時挑戰） */
  function seeded(seed) {
    let x = 0;
    for (const ch of seed) x = (x * 31 + ch.codePointAt(0)) >>> 0;
    return () => { x = (x * 1103515245 + 12345) >>> 0; return x / 4294967296; };
  }

  function skinData() {
    const s = S().settings;
    if (!s.skinData) s.skinData = {};
    const d = s.skinData.shopee || (s.skinData.shopee = {});
    const today = QG.dayKey();
    if (d.day !== today) { d.day = today; d.claimed = {}; }
    if (!d.claimed) d.claimed = {};
    return d;
  }

  /* ---------------------------------------------------------------- 頁首 */
  function top(view) {
    const input = h('input', { type: 'search', id: 'sp-q', placeholder: '搜尋題目、選項或主題，例如：蝕刻', value: QG.browse.kw, 'aria-label': '搜尋題目' });
    const go = (kw) => { Object.assign(QG.browse, { kw, tag: '', exam: '', limit: 30 }); SK.go('browse'); };
    const hot = QG.TAGS.filter(([t]) => t !== '其他').slice(0, 7);
    const links = [['home', '首頁'], ['practice', '練習'], ['exam', '模擬考'], ['browse', '題庫'], ['stats', '我的學習']];
    return h('div', { class: 'sk-top sp-top' },
      h('nav', { class: 'sp-toplinks', 'aria-label': '主要功能' }, links.map(([v, l]) => h('a', { href: '#' + v, 'aria-current': SK.isCurrent(view, v) ? 'page' : null, text: l }))),
      h('div', { class: 'sp-headrow' },
        h('a', { class: 'sp-logo', href: '#home', 'aria-label': 'QuizGrinder 首頁' }, icon('pad', 'sp-logo-ico'), h('span', { class: 'sp-logo-t', text: 'QuizGrinder' })),
        h('div', { class: 'sp-searchwrap' },
          h('form', { class: 'sp-search', role: 'search', onsubmit: (e) => { e.preventDefault(); go(input.value.trim()); } },
            input, h('button', { type: 'submit', 'aria-label': '搜尋' }, icon('search'))),
          h('div', { class: 'sp-hotwords' }, hot.map(([t]) => h('button', { type: 'button', text: t, onclick: () => go(t) })))),
        h('a', { class: 'sp-cart', href: '#review', 'aria-label': '錯題本' }, icon('spCart'), h('span', { class: 'badge', 'data-badge': 'review', hidden: true }))));
  }

  /* ---------------------------------------------------------------- 輪播 */
  function carousel() {
    const st = S();
    const due = QG.dueReviewIds();
    const hot = hotQs();
    const best = st.exams.length ? Math.max(...st.exams.map((e) => e.score)) : null;
    const slides = [
      { cls: 'exam', kicker: '模擬考專區', title: `${QG.EXAM_LEN} 題・${QG.EXAM_MIN} 分鐘`, text: best !== null ? `你的最佳成績 ${best} 分，再挑戰一次！` : '還沒考過？現在就來第一場', cta: '立即開考', act: () => SK.go('exam') },
      { cls: 'review', kicker: '錯題本', title: due.length ? `${due.length} 題待複習` : '目前沒有到期錯題', text: '答對升盒、答錯回第 1 盒，照遺忘曲線排程', cta: due.length ? '立即複習' : '看看錯題本', act: () => (due.length ? QG.startReview() : SK.go('review')) },
      { cls: 'hot', kicker: '高頻題特輯', title: `考過 2 次以上・${hot.length} 題`, text: '歷屆重複出現的題目，最值得先練', cta: '開始練習', act: () => QG.startCustomPractice(QG.buildQueue(hot.map((q) => q.id), 'weak'), '高頻題特輯') },
    ];
    let i = 0;
    let paused = reduced();
    let hover = false;
    const track = h('div', { class: 'sp-track' });
    const dots = h('div', { class: 'sp-dots' });
    const pauseBtn = h('button', { type: 'button', class: 'sp-pause' });
    const slideEls = slides.map((s, k) => h('div', { class: 'sp-slide ' + s.cls, role: 'group', 'aria-roledescription': '橫幅', 'aria-label': `${k + 1} / ${slides.length}：${s.kicker}` },
      h('div', { class: 'sp-slide-art', 'aria-hidden': 'true' }, h('span', { class: 'sp-blob a' }), h('span', { class: 'sp-blob b' }), icon('pad', 'sp-slide-ico')),
      h('div', { class: 'sp-slide-text' },
        h('span', { class: 'sp-kicker', text: s.kicker }), h('strong', { text: s.title }), h('p', { text: s.text }),
        h('button', { type: 'button', class: 'sp-cta', text: s.cta, onclick: s.act }))));
    fill(track, slideEls);
    const draw = () => {
      track.style.transform = `translateX(${-i * 100}%)`;
      slideEls.forEach((el, k) => { el.setAttribute('aria-hidden', k === i ? 'false' : 'true'); el.querySelector('.sp-cta').tabIndex = k === i ? 0 : -1; });
      fill(dots, slides.map((s, k) => h('button', { type: 'button', class: k === i ? 'on' : '', 'aria-label': `第 ${k + 1} 張：${s.kicker}`, 'aria-current': k === i ? 'true' : null, onclick: () => { i = k; draw(); } })));
      pauseBtn.setAttribute('aria-label', paused ? '播放輪播' : '暫停輪播');
      fill(pauseBtn, icon(paused ? 'spPlay' : 'spPause'));
    };
    const step = (d) => { i = (i + d + slides.length) % slides.length; draw(); };
    pauseBtn.addEventListener('click', () => { paused = !paused; draw(); });
    const box = h('section', { class: 'sp-carousel', 'aria-roledescription': '輪播', 'aria-label': '活動橫幅',
      onmouseenter: () => { hover = true; }, onmouseleave: () => { hover = false; }, onfocusin: () => { hover = true; }, onfocusout: () => { hover = false; } },
      h('div', { class: 'sp-viewport' }, track),
      h('button', { type: 'button', class: 'sp-arrow prev', 'aria-label': '上一張', onclick: () => step(-1) }, icon('spPrev')),
      h('button', { type: 'button', class: 'sp-arrow next', 'aria-label': '下一張', onclick: () => step(1) }, icon('spNext')),
      h('div', { class: 'sp-dotbar' }, dots, pauseBtn));
    draw();
    const timer = setInterval(() => {
      if (!box.isConnected) { clearInterval(timer); return; }
      if (!paused && !hover && document.visibilityState === 'visible') step(1);
    }, 4500);
    return box;
  }

  function sideBanners() {
    const st = S();
    const today = st.days[QG.dayKey()] || { n: 0, c: 0 };
    const starred = Object.keys(st.q).filter((id) => st.q[id].s && QG.QMAP.has(id));
    const p = st.practice;
    return h('div', { class: 'sp-sidebanners' },
      h('a', { class: 'sp-sb a', href: '#practice' }, h('span', { class: 'sp-kicker', text: p && p.idx > 0 && p.idx < p.queue.length ? '繼續練習' : '隨機練習' }),
        h('strong', { text: `今日已答 ${today.n} 題` }), h('span', { text: QG.filterLabel(st.settings.filters) })),
      h('button', { type: 'button', class: 'sp-sb b', onclick: () => (starred.length ? QG.startCustomPractice(starred, '收藏題目') : SK.go('browse')) },
        h('span', { class: 'sp-kicker', text: '我的收藏' }), h('strong', { text: starred.length ? `${starred.length} 題收藏` : '還沒有收藏' }),
        h('span', { text: starred.length ? '一次練完收藏的題目' : '在商品頁按「收藏」' })));
  }

  /* ---------------------------------------------------------------- 分類 */
  function categories() {
    const official = QG.QS.filter((q) => q.official);
    return h('section', { class: 'sp-panel' },
      h('h2', { class: 'sp-h', text: '分類' }),
      h('div', { class: 'sp-cats' }, QG.TAGS.filter(([t]) => t !== '其他').map(([t, n]) => {
        const ids = official.filter((q) => q.t.includes(t)).map((q) => q.id);
        return h('button', { type: 'button', class: 'sp-cat', onclick: () => QG.startCustomPractice(ids, `主題：${t}`) },
          h('span', { class: 'sp-cat-ico', style: `--h:${hue(t)}`, text: t.slice(0, 2) }), h('span', { class: 'sp-cat-t', text: t }), h('span', { class: 'sp-cat-n', text: `${n} 題` }));
      })));
  }

  /* ---------------------------------------------------------------- 任務券 */
  function coupons() {
    const st = S();
    const sd = skinData();
    const today = st.days[QG.dayKey()] || { n: 0, c: 0 };
    const examsToday = st.exams.filter((e) => QG.dayKey(new Date(e.ts)) === QG.dayKey()).length;
    const list = [
      { k: 'a20', big: '20', unit: '題', title: '今日作答 20 題', v: today.n, goal: 20, href: '#practice' },
      { k: 'c15', big: '15', unit: '對', title: '今日答對 15 題', v: today.c, goal: 15, href: '#practice' },
      { k: 'ex1', big: '1', unit: '場', title: '完成 1 場模擬考', v: examsToday, goal: 1, href: '#exam' },
    ];
    const claimed = list.filter((c) => sd.claimed[c.k]).length;
    return h('section', { class: 'sp-panel sp-coupons' },
      h('div', { class: 'sp-hrow' }, h('h2', { class: 'sp-h' }, icon('spTicket'), '每日任務券'), h('span', { class: 'sp-muted', text: `今日已領 ${claimed} / ${list.length}・每天午夜重置` })),
      h('div', { class: 'sp-couponrow' }, list.map((c) => {
        const done = c.v >= c.goal;
        const got = !!sd.claimed[c.k];
        const btn = got ? h('span', { class: 'sp-stamp', text: '已領取' })
          : done ? h('button', { type: 'button', class: 'sp-claim', text: '領取', onclick: () => { sd.claimed[c.k] = Date.now(); QG.Store.save(); QG.toast(`已領取「${c.title}」任務券`); QG.render(); } })
            : h('a', { class: 'sp-todo', href: c.href, text: '去完成' });
        return h('div', { class: 'sp-coupon' + (got ? ' got' : done ? ' ready' : '') },
          h('div', { class: 'sp-coupon-stub' }, h('b', { text: c.big }), h('span', { text: c.unit })),
          h('div', { class: 'sp-coupon-body' },
            h('strong', { text: c.title }),
            h('span', { class: 'sp-cbar', role: 'img', 'aria-label': `進度 ${Math.min(c.v, c.goal)} / ${c.goal}` }, h('i', { style: `width:${Math.min(100, Math.round((c.v / c.goal) * 100))}%` })),
            h('span', { class: 'sp-muted', text: `${Math.min(c.v, c.goal)} / ${c.goal}${done ? '・已達成' : ''}` })),
          h('div', { class: 'sp-coupon-act' }, btn));
      })));
  }

  /* ---------------------------------------------------------------- 限時挑戰 */
  function countdown() {
    const box = h('span', { class: 'sp-count', role: 'timer', 'aria-label': '距離今天結束' });
    const draw = () => {
      const now = new Date();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      let s = Math.max(0, Math.floor((end - now) / 1000));
      const parts = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0'));
      fill(box, parts.map((p, k) => [k ? h('i', { text: ':' }) : null, h('b', { text: p })]));
    };
    draw();
    const t = setInterval(() => { if (!box.isConnected) { clearInterval(t); return; } draw(); }, 1000);
    return box;
  }

  function flashPicks() {
    const rnd = seeded(QG.dayKey());
    const hot = hotQs().map((q) => ({ q, k: rnd() }));
    const st = S().q;
    const need = (q) => { const r = st[q.id]; return !r || r.w > 0 || !(r.c + r.w) ? 0 : 1; };
    hot.sort((a, b) => need(a.q) - need(b.q) || b.q.src.length - a.q.src.length || a.k - b.k);
    return hot.slice(0, 6).map((x) => x.q);
  }

  function thumb(q, cls) {
    return q.fig
      ? h('span', { class: 'sp-thumb fig ' + (cls || '') }, h('img', { src: q.fig, alt: '', loading: 'lazy' }))
      : h('span', { class: 'sp-thumb text ' + (cls || ''), style: `--h:${hue(q.t[0] || q.id)}` }, h('span', { text: q.q }));
  }

  /** 商品主圖：有附圖用附圖，否則用科目＋主題的色塊 */
  function art(q, cls) {
    if (q.fig) return thumb(q, cls);
    const topic = q.t.filter((t) => t !== '其他')[0] || QG.SUBJ_SHORT[q.s];
    return h('span', { class: 'sp-thumb art ' + (cls || ''), style: `--h:${hue(q.t[0] || q.id)}` }, icon('pad', 'sp-art-ico'), h('b', { text: QG.SUBJ_CODE[q.s] }), h('span', { text: topic }));
  }

  function flashSale() {
    const picks = flashPicks();
    const hotIds = hotQs().map((q) => q.id);
    return h('section', { class: 'sp-panel sp-flash' },
      h('div', { class: 'sp-hrow' },
        h('h2', { class: 'sp-flash-h' }, icon('spBolt'), '限時挑戰'), countdown(),
        h('span', { class: 'spacer' }),
        h('button', { type: 'button', class: 'sp-more', onclick: () => QG.startCustomPractice(QG.buildQueue(hotIds, 'weak'), '限時挑戰：高頻題') }, '全部高頻題', icon('spNext'))),
      h('div', { class: 'sp-flashrow' }, picks.map((q) => {
        const r = recOf(q.id);
        const n = r ? r.c + r.w : 0;
        return h('button', { type: 'button', class: 'sp-fitem', onclick: () => openProduct(q), 'aria-label': `考過 ${q.src.length} 次：${q.q}` },
          h('span', { class: 'sp-fimg' }, thumb(q), h('span', { class: 'sp-fbadge', text: '高頻' })),
          h('span', { class: 'sp-fprice' }, h('small', { text: '考過' }), String(q.src.length), h('small', { text: '次' })),
          h('span', { class: 'sp-fbar' }, h('i', { style: `width:${n ? Math.round((r.c / n) * 100) : 0}%` }), h('span', { text: n ? `你答對 ${r.c}/${n}` : '尚未作答' })));
      })));
  }

  /* ---------------------------------------------------------------- 每日新發現 */
  const discover = { limit: 24 };
  function productCard(q) {
    const r = recOf(q.id);
    const n = r ? r.c + r.w : 0;
    return h('button', { type: 'button', class: 'sp-card', onclick: () => openProduct(q) },
      h('span', { class: 'sp-cimg' }, art(q),
        q.src.length > 1 ? h('span', { class: 'sp-tagribbon', text: '高頻' }) : null,
        r && r.b > 0 ? h('span', { class: 'sp-tagwrong', text: '錯題' }) : null),
      h('span', { class: 'sp-cbody' },
        h('span', { class: 'sp-ctitle' }, h('span', { class: 'sp-csubj', text: QG.SUBJ_CODE[q.s] }), q.q),
        h('span', { class: 'sp-cfoot' },
          h('span', { class: 'sp-cprice' + (n ? '' : ' none'), text: n ? QG.pct(r.c, n) : '尚未作答' }),
          h('span', { class: 'sp-csold', text: n ? `答過 ${n} 次` : q.src.length > 1 ? `考過 ${q.src.length} 次` : QG.srcLabel(q.src[0]).split(' ')[0] }))));
  }

  function discoverGrid() {
    const ids = SK.feedPool('shopee', 'random');
    const grid = h('div', { class: 'sp-grid' });
    const more = h('button', { type: 'button', class: 'sp-loadmore', text: '查看更多' });
    const draw = () => {
      fill(grid, ids.slice(0, discover.limit).map((id) => productCard(QG.QMAP.get(id))));
      more.hidden = discover.limit >= ids.length;
    };
    more.addEventListener('click', () => { discover.limit += 24; draw(); });
    draw();
    return h('section', { class: 'sp-discover' },
      h('h2', { class: 'sp-dhead' }, h('span', { text: '每日新發現' })),
      h('p', { class: 'sp-scope', text: `範圍：${QG.filterLabel(S().settings.filters)}・橘色數字是你自己的正確率` }),
      grid, h('div', { class: 'sp-morewrap' }, more));
  }

  /* ---------------------------------------------------------------- 商品詳情（作答） */
  function openProduct(q) {
    const r = recOf(q.id);
    const n = r ? r.c + r.w : 0;
    const after = h('div', { class: 'sp-after', hidden: true });
    const opts = SK.answerOptions(q, { cls: 'sp-variants', onDone: (ok) => {
      fill(after,
        h('p', { class: 'sp-result ' + (ok ? 'ok' : 'ng'), text: ok ? '答對了！' : `答錯了，正確答案是 ${q.all ? '全部給分' : q.a.join('、')}` }),
        q.x ? h('p', { class: 'sp-expl', text: q.x }) : null);
      after.hidden = false;
    } });
    const official = QG.QS.filter((x) => x.official);
    const topics = q.t.filter((t) => t !== '其他');
    const m = SK.modal(h('div', { class: 'sp-pd' },
      h('div', { class: 'sp-pd-media' }, art(q, 'big')),
      h('div', { class: 'sp-pd-info' },
        h('h2', { class: 'sp-pd-title' }, q.src.length > 1 ? h('span', { class: 'sp-pd-tag', text: '高頻' }) : null, q.q),
        h('div', { class: 'sp-pd-meta' },
          h('span', null, h('b', { text: String(q.src.length) }), ' 次出題'),
          h('span', null, h('b', { text: String(n) }), ' 次作答'),
          h('span', null, h('b', { text: r ? String(r.c) : '0' }), ' 次答對')),
        h('div', { class: 'sp-pd-price' }, h('span', { class: 'sp-pd-big', text: n ? QG.pct(r.c, n) : '尚未作答' }), n ? h('span', { class: 'sp-muted', text: '你的正確率' }) : null),
        h('dl', { class: 'sp-pd-rows' },
          h('dt', { text: '出處' }), h('dd', { text: q.src.map(QG.srcLabel).join('、') }),
          topics.length ? h('dt', { text: '分類' }) : null,
          topics.length ? h('dd', null, topics.map((t) => h('button', { type: 'button', class: 'sp-pd-chip', text: t, onclick: () => { m.close(); QG.startCustomPractice(official.filter((x) => x.t.includes(t)).map((x) => x.id), `主題：${t}`); } }))) : null,
          h('dt', { text: '選擇答案' }), h('dd', null, opts)),
        after,
        h('div', { class: 'sp-pd-btns' },
          h('button', { type: 'button', class: 'sp-btn-outline', onclick: () => SK.addToReview(q) }, icon('spCart'), '加入錯題本'),
          SK.starBtn(q, 'sp-btn-star', 'heart')))), 'sp-modal');
    if (SK.setOpenModal) SK.setOpenModal(m);
  }

  /* ---------------------------------------------------------------- 首頁 */
  function home() {
    return h('div', { class: 'sp-home' },
      h('div', { class: 'sp-bannerrow' }, carousel(), sideBanners()),
      categories(),
      coupons(),
      flashSale(),
      discoverGrid());
  }

  const NAV = [
    { v: 'home', label: '首頁', icon: 'spShop' },
    { v: 'browse', label: '題庫', icon: 'browse' },
    { v: 'exam', label: '模擬考', icon: 'exam' },
    { v: 'review', label: '錯題', icon: 'spCart', badge: true },
    { v: 'stats', label: '我', icon: 'spUser' },
  ];

  SK.register({ id: 'shopee', label: '蝦皮風', group: '生活遊戲化', top, nav: NAV, views: { home } });
})();
