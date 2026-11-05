/* QuizGrinder 版面風格：Trello 風（看板）
 *
 * 首頁與錯題本（未在複習中時）是一塊「錯題看板」：
 *   新題目（目前練習範圍內還沒作答過的題目）→ 第 1 盒 … 第 5 盒（Leitner 錯題盒）→ 已熟練
 * 卡片可用 HTML5 拖放或卡片上的「移到…」選單搬移；搬移會照實寫入 .b／.d／.m 並存檔。
 * 點卡片開啟卡片詳情（可直接作答）。只借用版面、互動與配色；標誌用 QuizGrinder 焊墊圖示。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon } = SK;
  const S = () => QG.S();
  const DAY = 864e5;
  const BOX_DAYS = [0, 0, 1, 3, 7, 14];
  const NEW_SHOW = 30;
  const LIST_SHOW = 60;

  Object.assign(SK.ICONS, {
    'tr-clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'tr-board': '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7.5 7v9M12 7v5M16.5 7v7"/>',
    'tr-move': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'tr-check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'tr-x': '<path d="M7 7l10 10M17 7L7 17"/>',
    'tr-img': '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-8 8"/>',
    'tr-desc': '<path d="M4 6h16M4 10h16M4 14h10M4 18h7"/>',
    'tr-list': '<rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="10" rx="1.5"/>',
    'tr-activity': '<path d="M4 6h16M4 12h10M4 18h13"/>',
    'tr-filter': '<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>',
  });

  /* 標籤色：依主題在題庫中的排序取色，跨畫面穩定 */
  const LABELS = ['green', 'yellow', 'orange', 'red', 'purple', 'blue', 'sky', 'lime', 'pink', 'black'];
  const labelOf = (t) => {
    const i = QG.TAGS.findIndex(([x]) => x === t);
    return LABELS[(i < 0 ? 0 : i) % LABELS.length];
  };
  const topics = (q) => q.t.filter((t) => t !== '其他');

  const LISTS = [
    { key: 'new', title: '新題目' },
    { key: '1', title: '第 1 盒', note: '當天複習' },
    { key: '2', title: '第 2 盒', note: '隔 1 天' },
    { key: '3', title: '第 3 盒', note: '隔 3 天' },
    { key: '4', title: '第 4 盒', note: '隔 7 天' },
    { key: '5', title: '第 5 盒', note: '隔 14 天' },
    { key: 'done', title: '已熟練' },
  ];
  const titleOf = (key) => LISTS.find((l) => l.key === key).title;

  function whereOf(id) {
    const r = S().q[id];
    if (!r) return 'new';
    if (r.m) return 'done';
    if (r.b > 0) return String(r.b);
    if (!(r.c + r.w)) return 'new';
    return null; // 答過、不在錯題盒也未熟練
  }

  function columns() {
    const st = S().q;
    const cols = { new: [], 1: [], 2: [], 3: [], 4: [], 5: [], done: [] };
    for (const q of QG.filterQuestions(S().settings.filters)) {
      const r = st[q.id];
      if (!r || (!(r.c + r.w) && !r.b && !r.m)) cols.new.push(q.id);
    }
    for (const [id, r] of Object.entries(st)) {
      if (!QG.QMAP.has(id)) continue;
      if (r.m) cols.done.push(id);
      else if (r.b > 0 && r.b <= 5) cols[r.b].push(id);
    }
    for (let b = 1; b <= 5; b++) cols[b].sort((a, c) => (st[a].d || 0) - (st[c].d || 0));
    cols.done.sort((a, c) => (st[c].t || 0) - (st[a].t || 0));
    return cols;
  }

  /** 搬移卡片：照實寫入學習紀錄 */
  function move(id, to) {
    if (to === 'new') return false;
    const st = S();
    const r = st.q[id] || (st.q[id] = { c: 0, w: 0 });
    if (to === 'done') {
      r.m = 1; r.b = 0; delete r.d;
    } else {
      const n = +to;
      if (!(n >= 1 && n <= 5)) return false;
      r.b = n; r.d = Date.now() + BOX_DAYS[n] * DAY; delete r.m;
    }
    QG.Store.save();
    QG.updateBadges();
    QG.toast(`已移到「${titleOf(to)}」` + (to === 'done' ? '' : `，${n2due(to)}`));
    return true;
  }
  const n2due = (to) => (+to <= 1 ? '今天就會出現在複習' : `${BOX_DAYS[+to]} 天後複習`);

  const fmtDue = (ts) => { const d = new Date(ts); return `${d.getMonth() + 1}月${d.getDate()}日`; };
  function dueBadge(r) {
    if (!r || !(r.b > 0) || !r.d) return null;
    const now = Date.now();
    const cls = r.d <= now ? 'over' : r.d - now < DAY ? 'soon' : '';
    return h('span', { class: 'trello-badge due ' + cls, title: r.d <= now ? '已到期' : '下次複習日' }, icon('tr-clock'), h('span', { text: fmtDue(r.d) }));
  }

  /* ---------------------------------------------------------------- 看板 */
  let board = null; // { el, draw }
  let menu = null;

  function closeMenu() {
    if (!menu) return;
    const { el, btn } = menu;
    menu = null;
    el.remove();
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onDocDown, true);
    document.removeEventListener('scroll', onScroll, true);
  }
  function onScroll(e) { if (menu && !menu.el.contains(e.target)) closeMenu(); }
  function onDocDown(e) { if (menu && !menu.el.contains(e.target) && e.target !== menu.btn) closeMenu(); }

  function openMenu(btn, id, from) {
    if (menu && menu.btn === btn) { closeMenu(); return; }
    closeMenu();
    const items = LISTS.filter((l) => l.key !== 'new' && l.key !== from);
    const el = h('div', { class: 'trello-menu', role: 'menu', 'aria-label': '移到哪個列表',
      onkeydown: (e) => {
        const btns = [...el.querySelectorAll('button')];
        const i = btns.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); btn.focus(); }
      } },
      h('div', { class: 'trello-menu-head', text: '移到…' }),
      items.map((l) => h('button', { type: 'button', role: 'menuitem', class: 'trello-menu-item',
        onclick: (e) => { e.stopPropagation(); closeMenu(); if (move(id, l.key)) redraw(); } },
        h('span', { text: l.title }), l.note ? h('small', { text: l.note }) : null)));
    btn.setAttribute('aria-expanded', 'true');
    document.body.append(el);
    const rc = btn.getBoundingClientRect();
    const w = el.offsetWidth, hh = el.offsetHeight;
    el.style.left = Math.max(8, Math.min(rc.right - w, innerWidth - w - 8)) + 'px';
    el.style.top = (rc.bottom + 4 + hh > innerHeight - 8 ? Math.max(8, rc.top - hh - 4) : rc.bottom + 4) + 'px';
    menu = { el, btn };
    document.addEventListener('pointerdown', onDocDown, true);
    document.addEventListener('scroll', onScroll, true);
    el.querySelector('button').focus();
  }

  function card(id, from) {
    const q = QG.QMAP.get(id);
    const r = S().q[id];
    const labels = topics(q).slice(0, 3);
    const moveBtn = h('button', { type: 'button', class: 'trello-card-move', 'aria-haspopup': 'menu', 'aria-expanded': 'false',
      'aria-label': '移到…', title: '移到…', onclick: (e) => { e.stopPropagation(); openMenu(moveBtn, id, from); } }, icon('tr-move'));
    const el = h('div', { class: 'trello-card', draggable: 'true', dataset: { id },
      ondragstart: (e) => {
        closeMenu();
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
        requestAnimationFrame(() => el.classList.add('dragging'));
        board && board.el.classList.add('is-dragging');
      },
      ondragend: () => { el.classList.remove('dragging'); board && board.el.classList.remove('is-dragging'); } },
      h('button', { type: 'button', class: 'trello-card-open', onclick: () => openCard(id),
        'aria-label': `${q.q.slice(0, 60)}（${titleOf(from)}）` },
        labels.length ? h('span', { class: 'trello-labels' }, labels.map((t) => h('span', { class: 'trello-label l-' + labelOf(t), text: t }))) : null,
        h('span', { class: 'trello-card-title', text: q.q }),
        h('span', { class: 'trello-badges' },
          dueBadge(r),
          h('span', { class: 'trello-badge', title: QG.SUBJ[q.s] , text: QG.SUBJ_CODE[q.s] }),
          q.fig ? h('span', { class: 'trello-badge', title: '附圖' }, icon('tr-img')) : null,
          r && (r.c + r.w) ? h('span', { class: 'trello-badge', title: `答對 ${r.c} 次・答錯 ${r.w} 次` }, icon('tr-check'), h('span', { text: `${r.c}/${r.c + r.w}` })) : null,
          r && r.s ? h('span', { class: 'trello-badge star', title: '已收藏' }, icon('star')) : null)),
      moveBtn);
    return el;
  }

  function listEl(l, ids, total) {
    const droppable = l.key !== 'new';
    const shown = l.key === 'new' ? NEW_SHOW : LIST_SHOW;
    const cards = h('div', { class: 'trello-cards' }, ids.slice(0, shown).map((id) => card(id, l.key)),
      !ids.length ? h('p', { class: 'trello-empty', text: l.key === 'new' ? '這個練習範圍的題目都作答過了' : droppable ? '把卡片拖到這裡' : '' }) : null);
    const more = total > shown ? total - shown : 0;
    const sec = h('section', { class: 'trello-list' + (droppable ? ' drop' : ' nodrop'), dataset: { key: l.key }, 'aria-label': `${l.title}，${total} 張卡片`,
      ondragover: (e) => { if (!droppable) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; sec.classList.add('over'); },
      ondragleave: (e) => { if (!sec.contains(e.relatedTarget)) sec.classList.remove('over'); },
      ondrop: (e) => {
        sec.classList.remove('over');
        if (!droppable) return;
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        if (!QG.QMAP.has(id) || whereOf(id) === l.key) return;
        if (move(id, l.key)) redraw();
      } },
      h('header', { class: 'trello-list-head' },
        h('h2', { text: l.title }),
        h('span', { class: 'trello-count', text: String(total) }),
        l.note ? h('span', { class: 'trello-list-note', text: l.note }) : null),
      cards,
      h('footer', { class: 'trello-list-foot' },
        l.key === 'new'
          ? h('span', { text: more ? `顯示前 ${NEW_SHOW} 張，共 ${QG.fmtNum(total)} 張` : `共 ${total} 張` })
          : more ? h('span', { text: `另有 ${more} 張未顯示` })
            : h('span', { text: l.key === 'done' ? '第 5 盒再答對就會畢業到這裡' : '拖放或用「移到…」搬移卡片' })));
    return sec;
  }

  function boardView(mode, finished) {
    const el = h('div', { class: 'trello-board' });
    const draw = () => {
      const keep = el.querySelector('.trello-lists');
      const sx = keep ? keep.scrollLeft : 0;
      const cols = columns();
      const due = QG.dueReviewIds().length;
      const inBook = [1, 2, 3, 4, 5].reduce((a, b) => a + cols[b].length, 0);
      const lists = h('div', { class: 'trello-lists' }, LISTS.map((l) => listEl(l, cols[l.key], cols[l.key].length)));
      fill(el,
        h('header', { class: 'trello-board-head' },
          h('h1', { class: 'trello-board-title' }, icon('tr-board'), h('span', { text: '錯題看板' })),
          h('span', { class: 'trello-head-meta', text: `錯題盒 ${inBook} 張・到期 ${due} 張・已熟練 ${cols.done.length} 張` }),
          h('span', { class: 'spacer' }),
          h('button', { type: 'button', class: 'trello-head-btn', onclick: openRange }, icon('tr-filter'), h('span', { text: '練習範圍：' + QG.filterLabel(S().settings.filters) })),
          mode === 'review'
            ? h('button', { type: 'button', class: 'trello-head-btn primary', disabled: due ? null : true, onclick: () => QG.startReview() }, due ? `開始複習 ${due} 張` : '沒有到期的卡片')
            : h('a', { class: 'trello-head-btn primary', href: '#practice', text: '開始練習' }),
          mode === 'home' ? h('a', { class: 'trello-head-btn', href: '#review', text: due ? `複習到期 ${due}` : '錯題複習' }) : null),
        finished ? h('div', { class: 'trello-banner' }, `這批複習完成：答對 ${finished.c} / ${finished.n}（${QG.pct(finished.c, finished.n)}）`) : null,
        lists);
      lists.scrollLeft = sx;
    };
    draw();
    board = { el, draw };
    return el;
  }
  function redraw() { if (board && board.el.isConnected) board.draw(); }

  function openRange() {
    const m = SK.modal(h('div', { class: 'trello-modal trello-range' },
      h('h2', { class: 'trello-modal-title', text: '練習範圍' }),
      h('p', { class: 'trello-muted', text: '「新題目」列表只列出這個範圍內還沒作答過的題目。' }),
      QG.rangePanel()), 'trello-backdrop', () => { SK.setOpenModal(null); redraw(); });
    SK.setOpenModal(m);
  }

  /* ---------------------------------------------------------------- 卡片詳情 */
  function openCard(id) {
    closeMenu();
    const q = QG.QMAP.get(id);
    const r0 = S().q[id];
    const answer = h('div', { class: 'trello-answer', hidden: true });
    const activity = h('div', { class: 'trello-activity' });
    const drawActivity = () => {
      const r = S().q[id];
      fill(activity, r && (r.c + r.w)
        ? [h('p', null, h('b', { text: `答對 ${r.c} 次・答錯 ${r.w} 次` }), `（正確率 ${QG.pct(r.c, r.c + r.w)}）`),
          h('p', { class: 'trello-muted', text: `最後作答：${new Date(r.t).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' })}（${SK.relTime(r.t)}）` }),
          r.b > 0 && r.d ? h('p', { class: 'trello-muted', text: `目前在第 ${r.b} 盒，${r.d <= Date.now() ? '已到期' : '下次複習 ' + fmtDue(r.d)}` }) : null,
          r.m ? h('p', { class: 'trello-muted', text: '已熟練' }) : null]
        : h('p', { class: 'trello-muted', text: '還沒有作答紀錄。' }));
    };
    drawActivity();
    const opts = SK.answerOptions(q, { cls: 'trello-opts', onDone: (ok) => {
      fill(answer, h('strong', { text: ok ? '答對了' : '答錯了，這張卡片回到第 1 盒' }),
        h('p', { text: q.all ? '官方釋疑：所有選項均給分。' : `答案：${q.a.map((L) => `${L}. ${q.o[L]}`).join('；')}` }),
        q.x ? h('p', { class: 'trello-muted', text: q.x }) : null);
      answer.className = 'trello-answer ' + (ok ? 'ok' : 'ng');
      answer.hidden = false;
      drawActivity();
      syncWhere();
    } });
    const moveBtns = LISTS.filter((l) => l.key !== 'new').map((l) => h('button', { type: 'button', class: 'trello-side-btn', dataset: { key: l.key },
      onclick: () => { if (move(id, l.key)) { m.close(); } } }, icon('tr-move'), h('span', { text: l.title })));
    const whereEl = h('u');
    const syncWhere = () => {
      const w = whereOf(id);
      whereEl.textContent = w ? titleOf(w) : '已答對（不在看板上）';
      moveBtns.forEach((b) => { b.disabled = b.dataset.key === w; });
    };
    syncWhere();
    const content = h('div', { class: 'trello-modal', role: 'document' },
      h('header', { class: 'trello-modal-head' },
        icon('tr-desc', 'trello-modal-ico'),
        h('div', null,
          h('h2', { class: 'trello-modal-title', text: q.q.length > 48 ? q.q.slice(0, 48) + '…' : q.q }),
          h('p', { class: 'trello-muted' }, '在列表 ', whereEl, ' 中'))),
      h('div', { class: 'trello-modal-body' },
        h('div', { class: 'trello-modal-main' },
          h('div', { class: 'trello-meta-row' },
            topics(q).length ? h('div', { class: 'trello-meta' }, h('h3', { text: '標籤' }),
              h('div', { class: 'trello-labels big' }, topics(q).map((t) => h('span', { class: 'trello-label l-' + labelOf(t), text: t })))) : null,
            r0 && r0.b > 0 && r0.d ? h('div', { class: 'trello-meta' }, h('h3', { text: '到期日' }), dueBadge(r0)) : null,
            h('div', { class: 'trello-meta' }, h('h3', { text: '科目' }), h('span', { class: 'trello-badge plain', text: `${QG.SUBJ_CODE[q.s]} ${QG.SUBJ_SHORT[q.s]}` }))),
          h('section', { class: 'trello-sec' },
            h('h3', null, icon('tr-desc'), '描述'),
            h('p', { class: 'trello-q', text: q.q }),
            q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖' })) : null),
          h('section', { class: 'trello-sec' }, h('h3', null, icon('tr-check'), '作答'), opts, answer),
          h('section', { class: 'trello-sec' }, h('h3', null, icon('tr-activity'), '活動'), activity,
            h('p', { class: 'trello-muted', text: '出處：' + q.src.map(QG.srcLabel).join('、') }))),
        h('aside', { class: 'trello-modal-side', 'aria-label': '卡片動作' },
          h('h3', { text: '移到列表' }), moveBtns,
          h('h3', { text: '動作' }),
          (() => {
            const b = h('button', { type: 'button', class: 'trello-side-btn star' });
            const draw = () => {
              const on = !!(S().q[id] && S().q[id].s);
              b.setAttribute('aria-pressed', on ? 'true' : 'false');
              fill(b, icon('star'), h('span', { text: on ? '已收藏' : '收藏' }));
            };
            b.addEventListener('click', () => { QG.toggleStar(id); draw(); });
            draw();
            return b;
          })(),
          h('button', { type: 'button', class: 'trello-side-btn', onclick: () => SK.copyQuestion(q) }, icon('tr-desc'), h('span', { text: '複製題目' })))));
    const m = SK.modal(content, 'trello-backdrop', () => { SK.setOpenModal(null); redraw(); });
    SK.setOpenModal(m);
  }

  /* ---------------------------------------------------------------- 外框 */
  const NAV = [
    { v: 'home', label: '看板', icon: 'tr-board' },
    { v: 'practice', label: '練習', icon: 'practice' },
    { v: 'review', label: '錯題', icon: 'review', badge: true },
    { v: 'exam', label: '模擬考', icon: 'exam' },
    { v: 'browse', label: '題庫', icon: 'browse' },
    { v: 'stats', label: '統計', icon: 'stats' },
  ];

  function top(view) {
    return h('div', { class: 'sk-top trello-top' },
      SK.brand(),
      h('nav', { class: 'trello-nav', 'aria-label': '主要功能' }, NAV.map((n) => h('a', { href: '#' + n.v, class: 'trello-nav-item',
        'aria-current': SK.isCurrent(view, n.v) ? 'page' : null }, h('span', { text: n.label }),
        n.badge ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null))),
      h('div', { class: 'sk-right' },
        h('a', { class: 'trello-create', href: '#practice', text: '開始練習' }),
        h('a', { class: 'sk-avatar trello-av', href: '#stats', 'aria-label': '我的統計', text: 'Q' })));
  }

  SK.register({
    id: 'trello', label: 'Trello 風', group: '生產力', top, nav: NAV,
    views: {
      home: () => boardView('home'),
      review: (base) => {
        const el = base.review();
        const run = QG.reviewRun;
        if (run && run.idx < run.queue.length) return el;
        const fb = el.querySelector('.feedback.ok .mono');
        const m = fb && fb.textContent.match(/(\d+)\s*\/\s*(\d+)/);
        return boardView('review', m ? { c: +m[1], n: +m[2] } : null);
      },
    },
  });

  const prevBefore = QG.hooks.beforeRender;
  QG.hooks.beforeRender = (view) => { closeMenu(); board = null; prevBefore(view); };
})();
