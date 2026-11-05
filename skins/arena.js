/* QuizGrinder 版面風格：Are.na 風（arena）
 *
 * 極簡灰階的「頻道＋區塊」：
 *   - 頻道索引：自動頻道（答錯過、收藏、各主題，全部由學習紀錄算出）＋你自己建立的頻道
 *   - 頻道頁：方形區塊格（文字區塊／圖片區塊），每格「Connect →」可加入你的頻道（頁內選單）
 *   - 區塊檢視：題目、可作答的選項、Connections（哪些頻道包含它）
 *   - 練習頻道 → QG.startCustomPractice
 * 使用者頻道存在 S().settings.skinData.arena = { channels: [{ id, title, ids[], ts, up }] }。
 * 只借用版面與互動慣例；標誌用 QuizGrinder 的焊墊圖示。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const S = () => QG.S();

  /* ---------------------------------------------------------------- 資料 */
  function store() {
    const s = S().settings;
    if (!s.skinData || typeof s.skinData !== 'object') s.skinData = {};
    let d = s.skinData.arena;
    if (!d || typeof d !== 'object') d = s.skinData.arena = { channels: [] };
    if (!Array.isArray(d.channels)) d.channels = [];
    return d;
  }
  const userChannels = () => store().channels;

  function autoChannels() {
    const st = S().q;
    const wrong = QG.QS.filter((q) => st[q.id] && st[q.id].w > 0).sort((a, b) => (st[b.id].t || 0) - (st[a.id].t || 0)).map((q) => q.id);
    const star = QG.QS.filter((q) => st[q.id] && st[q.id].s).map((q) => q.id);
    const lastT = (ids) => ids.reduce((m, id) => Math.max(m, (st[id] && st[id].t) || 0), 0);
    const list = [
      { id: 'auto:wrong', title: '答錯過', ids: wrong, auto: true, desc: '你答錯過至少一次的題目，最近作答的在前。' },
      { id: 'auto:star', title: '收藏', ids: star, auto: true, desc: '你收藏的題目。' },
    ];
    QG.TAGS.forEach(([t]) => list.push({ id: 'auto:t:' + t, title: t, ids: QG.QS.filter((q) => q.t.includes(t)).map((q) => q.id), auto: true, desc: `主題「${t}」的所有題目（依題庫標籤自動整理）。` }));
    list.forEach((c) => { c.up = lastT(c.ids); });
    return list;
  }
  function allChannels() { return userChannels().map((c) => Object.assign({ mine: true }, c)).concat(autoChannels()); }
  function findChannel(id) { return allChannels().find((c) => c.id === id) || null; }

  function createChannel(title, firstId) {
    const t = title.trim().slice(0, 60);
    if (!t) return null;
    const c = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), title: t, ids: firstId ? [firstId] : [], ts: Date.now(), up: Date.now() };
    userChannels().unshift(c);
    QG.Store.save();
    return c;
  }
  function toggleIn(c, id) {
    const raw = userChannels().find((x) => x.id === c.id);
    if (!raw) return false;
    const i = raw.ids.indexOf(id);
    if (i >= 0) raw.ids.splice(i, 1); else raw.ids.unshift(id);
    raw.up = Date.now();
    QG.Store.save();
    return i < 0;
  }
  function connectionsOf(id) {
    return allChannels().filter((c) => c.ids.includes(id));
  }

  const state = { page: 'index', ch: null, limit: 48, creating: false, exLimit: 48 };
  function goChannel(id) { state.page = 'ch'; state.ch = id; state.limit = 48; if (location.hash !== '#home') location.hash = '#home'; else QG.render(); }
  function goIndex() { state.page = 'index'; state.ch = null; if (location.hash !== '#home') location.hash = '#home'; else QG.render(); }

  const nBlocks = (n) => `${QG.fmtNum(n)} 個區塊`;
  const ago = (ts) => (ts ? SK.relTime(ts).replace('尚未作答', '') : '—');

  /* ---------------------------------------------------------------- 外框 */
  const AR_NAV = [
    { v: 'home', label: '頻道', icon: 'grid' },
    { v: 'browse', label: '探索', icon: 'compass' },
    { v: 'practice', label: '練習', icon: 'practice' },
    { v: 'review', label: '錯題', icon: 'review', badge: true },
    { v: 'exam', label: '模擬考', icon: 'exam' },
    { v: 'stats', label: '我', icon: 'user' },
  ];

  function arTop(view) {
    const input = h('input', { type: 'search', class: 'ar-search-in', placeholder: '搜尋區塊…', 'aria-label': '搜尋題目', value: view === 'browse' ? QG.browse.kw : '' });
    return h('div', { class: 'sk-top ar-top' },
      h('a', { class: 'ar-logo', href: '#home', 'aria-label': 'QuizGrinder 首頁' }, SK.icon('pad')),
      h('form', { class: 'ar-search', role: 'search', onsubmit: (e) => { e.preventDefault(); QG.browse.kw = input.value.trim(); state.exLimit = 48; SK.go('browse'); } }, input),
      h('nav', { class: 'ar-links', 'aria-label': '主要功能' }, AR_NAV.map((n) => h('a', { href: '#' + n.v, 'aria-current': SK.isCurrent(view, n.v) ? 'page' : null,
        text: n.label },
        n.badge ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null))),
      h('button', { type: 'button', class: 'ar-newbtn', onclick: () => { state.page = 'index'; state.creating = true; if (location.hash !== '#home') location.hash = '#home'; else QG.render(); } }, '＋ 新頻道'));
  }

  /* ---------------------------------------------------------------- 區塊 */
  let pop = null;
  function closePop() {
    if (!pop) return;
    const p = pop;
    pop = null;
    p.el.remove();
    document.removeEventListener('pointerdown', p.out, true);
    document.removeEventListener('keydown', p.key, true);
    if (p.dirty) setTimeout(() => { if (QG.currentView === 'home' && state.page === 'ch' && !pop) QG.render(); }, 0);
  }

  /** 「Connect →」面板：勾選你的頻道、或就地建立新頻道 */
  function connectPanel(q, onChange) {
    const wrap = h('div', { class: 'ar-conn' });
    let filter = '';
    const draw = () => {
      const mine = userChannels().filter((c) => !filter || c.title.toLowerCase().includes(filter.toLowerCase()));
      const name = h('input', { type: 'text', class: 'ar-conn-in', placeholder: userChannels().length ? '搜尋或輸入新頻道名稱' : '新頻道名稱', 'aria-label': '頻道名稱', value: filter, maxlength: '60' });
      name.addEventListener('input', () => { filter = name.value; const pos = name.selectionStart; draw(); const n = wrap.querySelector('.ar-conn-in'); n.focus(); n.setSelectionRange(pos, pos); });
      const create = () => {
        const c = createChannel(name.value, q.id);
        if (!c) { name.focus(); return; }
        filter = '';
        QG.toast(`已建立頻道「${c.title}」並加入`);
        if (onChange) onChange();
        draw();
      };
      name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } });
      fill(wrap,
        h('div', { class: 'ar-conn-h', text: 'Connect → 加入頻道' }),
        name,
        h('div', { class: 'ar-conn-list', role: 'group', 'aria-label': '你的頻道' },
          mine.length ? mine.map((c) => {
            const on = c.ids.includes(q.id);
            return h('button', { type: 'button', class: 'ar-conn-item' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false',
              onclick: () => { const added = toggleIn(c, q.id); QG.toast(added ? `已加入「${c.title}」` : `已從「${c.title}」移除`); if (onChange) onChange(); draw(); } },
              h('span', { class: 'ar-conn-box', text: on ? '✓' : '' }), h('span', { class: 'ar-conn-t', text: c.title }), h('small', { text: String(c.ids.length) }));
          }) : h('p', { class: 'ar-muted ar-conn-empty', text: userChannels().length ? '沒有符合的頻道' : '你還沒有自己的頻道，輸入名稱建立第一個。' })),
        filter.trim() && !userChannels().some((c) => c.title === filter.trim())
          ? h('button', { type: 'button', class: 'ar-conn-new', onclick: create }, '＋ 建立「', h('b', { text: filter.trim() }), '」並加入')
          : null);
    };
    draw();
    return wrap;
  }

  function openConnect(q, anchor) {
    closePop();
    const holder = anchor.closest('.ar-block') || anchor.parentElement;
    const p = { dirty: false };
    p.el = h('div', { class: 'ar-pop', role: 'dialog', 'aria-label': '加入頻道' }, connectPanel(q, () => { p.dirty = true; }));
    p.out = (e) => { if (!p.el.contains(e.target) && e.target !== anchor) closePop(); };
    p.key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closePop(); anchor.focus(); } };
    holder.append(p.el);
    // 選單超出視窗右緣時改向左展開
    const r = p.el.getBoundingClientRect();
    if (r.right > document.documentElement.clientWidth - 8) p.el.classList.add('left');
    document.addEventListener('pointerdown', p.out, true);
    document.addEventListener('keydown', p.key, true);
    pop = p;
    const f = p.el.querySelector('input');
    if (f) f.focus({ preventScroll: true });
  }

  function blockEl(q) {
    const r = S().q[q.id];
    const n = r ? r.c + r.w : 0;
    return h('div', { class: 'ar-block' },
      h('button', { type: 'button', class: 'ar-sq ' + (q.fig ? 'img' : 'text'), 'aria-label': `打開區塊：${q.q.slice(0, 60)}`, onclick: () => openBlock(q) },
        q.fig ? h('img', { src: q.fig, alt: '', loading: 'lazy' }) : h('p', { text: q.q })),
      h('button', { type: 'button', class: 'ar-connect', 'aria-haspopup': 'dialog', onclick: (e) => openConnect(q, e.currentTarget) }, 'Connect →'),
      h('div', { class: 'ar-bmeta' },
        h('span', { class: 'ar-btitle', text: q.fig ? q.q : QG.srcLabel(q.src[0]) }),
        h('span', { class: 'ar-muted', text: n ? `你答過 ${n} 次・${Math.round((r.c / n) * 100)}%` : (q.fig ? QG.srcLabel(q.src[0]) : '尚未作答') })));
  }

  function openBlock(q) {
    closePop();
    let dirty = false;
    const conns = h('div', { class: 'ar-conns' });
    const connArea = h('div', { class: 'ar-conn-inline', hidden: true });
    const drawConns = () => {
      const list = connectionsOf(q.id);
      fill(conns, h('h3', { class: 'ar-h3', text: `Connections（${list.length}）` }),
        h('ul', { class: 'ar-conn-ul' }, list.map((c) => h('li', null, h('button', { type: 'button', class: 'ar-chlink ' + (c.mine ? 'mine' : 'auto'),
          onclick: () => { m.close(); goChannel(c.id); } }, h('span', { text: c.title }), h('small', { text: nBlocks(c.ids.length) }))))));
    };
    drawConns();
    const result = h('div', { class: 'ar-result', hidden: true });
    const opts = SK.answerOptions(q, { cls: 'ar-ans', onDone: (ok) => {
      dirty = true;
      fill(result, h('strong', { class: ok ? 'ok' : 'ng', text: ok ? '答對了' : '答錯了，已加入錯題本' }),
        h('span', { text: q.all ? '官方釋疑：所有選項均給分' : `正解 ${q.a.join('、')}` }), q.x ? h('p', { text: q.x }) : null);
      result.hidden = false;
      drawConns();
    } });
    const content = h('div', { class: 'ar-view' },
      h('div', { class: 'ar-view-main' }, q.fig
        ? h('figure', { class: 'ar-view-fig' }, h('img', { src: q.fig, alt: '題目附圖' }), h('figcaption', { text: q.q }))
        : h('p', { class: 'ar-view-text', text: q.q })),
      h('aside', { class: 'ar-view-side' },
        h('h2', { class: 'ar-view-title', text: QG.srcLabel(q.src[0]) }),
        h('dl', { class: 'ar-dl' },
          h('dt', { text: '科目' }), h('dd', { text: `${QG.SUBJ_CODE[q.s]} ${QG.SUBJ_SHORT[q.s]}` }),
          h('dt', { text: '出處' }), h('dd', { text: q.src.map(QG.srcLabel).join('、') + (q.mock ? '（非官方）' : '') }),
          h('dt', { text: '主題' }), h('dd', { text: q.t.join('、') })),
        opts, result,
        h('div', { class: 'ar-view-acts' },
          h('button', { type: 'button', class: 'ar-btn', 'aria-expanded': 'false', onclick: (e) => {
            connArea.hidden = !connArea.hidden; e.currentTarget.setAttribute('aria-expanded', connArea.hidden ? 'false' : 'true');
            if (!connArea.hidden) { fill(connArea, connectPanel(q, () => { dirty = true; drawConns(); })); const i = connArea.querySelector('input'); if (i) i.focus(); }
          } }, 'Connect →'),
          SK.starBtn(q, 'ar-btn icon', 'star'),
          h('button', { type: 'button', class: 'ar-btn', text: '複製', onclick: () => SK.copyQuestion(q) })),
        connArea,
        conns));
    const m = SK.modal(content, 'ar-modal', () => {
      if (dirty) setTimeout(() => { if (QG.currentView === 'home' && !document.querySelector('.mx-backdrop')) QG.render(); }, 0);
    });
    SK.setOpenModal(m);
  }

  /* ---------------------------------------------------------------- 頻道索引 */
  function newChannelForm(onDone) {
    const input = h('input', { type: 'text', class: 'ar-input', id: 'ar-new-title', placeholder: '頻道名稱，例如：考前必看、蝕刻易錯', maxlength: '60', 'aria-label': '新頻道名稱' });
    return h('form', { class: 'ar-newform', onsubmit: (e) => {
      e.preventDefault();
      const c = createChannel(input.value);
      if (!c) { input.focus(); return; }
      state.creating = false;
      QG.toast(`已建立頻道「${c.title}」`);
      onDone(c);
    } },
      h('label', { class: 'ar-label', for: 'ar-new-title', text: '新頻道' }), input,
      h('div', { class: 'ar-row' },
        h('button', { type: 'submit', class: 'ar-btn solid', text: '建立頻道' }),
        h('button', { type: 'button', class: 'ar-btn', text: '取消', onclick: () => { state.creating = false; QG.render(); } })));
  }

  function preview(ids) {
    return h('div', { class: 'ar-strip', 'aria-hidden': 'true' }, ids.slice(0, 6).map((id) => {
      const q = QG.QMAP.get(id);
      return h('span', { class: 'ar-mini' + (q.fig ? ' img' : '') }, q.fig ? h('img', { src: q.fig, alt: '', loading: 'lazy' }) : h('span', { text: q.q }));
    }));
  }

  function chRow(c) {
    return h('article', { class: 'ar-chrow' },
      h('div', { class: 'ar-chrow-info' },
        h('button', { type: 'button', class: 'ar-chtitle ' + (c.mine ? 'mine' : 'auto'), onclick: () => goChannel(c.id), text: c.title }),
        h('p', { class: 'ar-muted' }, `${c.mine ? '你' : 'QuizGrinder'}・${nBlocks(c.ids.length)}`, c.up ? `・${ago(c.up)}更新` : '')),
      c.ids.length ? h('button', { type: 'button', class: 'ar-strip-btn', 'aria-label': `打開頻道 ${c.title}`, onclick: () => goChannel(c.id) }, preview(c.ids))
        : h('p', { class: 'ar-muted ar-empty-strip', text: c.mine ? '還沒有區塊。在任何區塊按「Connect →」加進來。' : '還沒有區塊' }));
  }

  function indexPage() {
    const mine = userChannels();
    const auto = autoChannels();
    const total = new Set(allChannels().flatMap((c) => c.ids)).size;
    const wrap = h('div', { class: 'ar-page' });
    fill(wrap,
      h('header', { class: 'ar-head' },
        h('p', { class: 'ar-crumb ar-muted', text: 'QuizGrinder 學習者' }),
        h('h1', { class: 'ar-h1', text: '頻道' }),
        h('p', { class: 'ar-muted', text: `${mine.length + auto.length} 個頻道・${nBlocks(total)}・自動頻道由你的作答紀錄即時整理` }),
        state.creating ? newChannelForm((c) => goChannel(c.id))
          : h('button', { type: 'button', class: 'ar-btn', onclick: () => { state.creating = true; QG.render(); setTimeout(() => { const i = document.getElementById('ar-new-title'); if (i) i.focus(); }, 0); } }, '＋ 新頻道')),
      h('section', { class: 'ar-sec' }, h('h2', { class: 'ar-h2', text: '你的頻道' }),
        mine.length ? mine.map((c) => chRow(Object.assign({ mine: true }, c)))
          : h('p', { class: 'ar-muted ar-note', text: '還沒有自己的頻道。按「＋ 新頻道」建立，或在任何區塊上按「Connect →」直接建立並加入。' })),
      h('section', { class: 'ar-sec' }, h('h2', { class: 'ar-h2', text: '自動頻道' }), auto.map(chRow)));
    if (state.creating) setTimeout(() => { const i = document.getElementById('ar-new-title'); if (i && document.activeElement !== i) i.focus({ preventScroll: true }); }, 0);
    return wrap;
  }

  /* ---------------------------------------------------------------- 頻道頁 */
  let confirmDel = false;
  let renaming = false;
  function channelPage(c) {
    const ids = c.ids.filter((id) => QG.QMAP.has(id));
    const shown = ids.slice(0, state.limit);
    const head = h('header', { class: 'ar-head' },
      h('p', { class: 'ar-crumb' }, h('button', { type: 'button', class: 'ar-link', text: c.mine ? '你' : 'QuizGrinder', onclick: goIndex }), ' / ',
        h('span', { class: c.mine ? 'ar-c-mine' : 'ar-c-auto', text: c.title })),
      renaming ? renameForm(c) : h('h1', { class: 'ar-h1 ' + (c.mine ? 'mine' : 'auto'), text: c.title }),
      h('p', { class: 'ar-muted' }, nBlocks(ids.length), c.up ? `・${ago(c.up)}更新` : '', c.mine ? '・你的頻道' : '・自動頻道'),
      c.desc ? h('p', { class: 'ar-desc', text: c.desc }) : null,
      h('div', { class: 'ar-row' },
        h('button', { type: 'button', class: 'ar-btn solid', disabled: ids.length ? null : true, text: `練習這個頻道（${ids.length}）→`, onclick: () => QG.startCustomPractice(ids, `頻道：${c.title}`) }),
        c.mine && !renaming ? h('button', { type: 'button', class: 'ar-btn', text: '重新命名', onclick: () => { renaming = true; QG.render(); } }) : null,
        c.mine && !confirmDel ? h('button', { type: 'button', class: 'ar-btn ghost', text: '刪除頻道', onclick: () => { confirmDel = true; QG.render(); } }) : null),
      c.mine && confirmDel ? h('div', { class: 'ar-confirm', role: 'alertdialog', 'aria-label': '確認刪除頻道' },
        h('span', { text: `刪除「${c.title}」？區塊本身（題目與作答紀錄）不會受影響。` }),
        h('button', { type: 'button', class: 'ar-btn solid danger', text: '刪除', onclick: () => {
          const list = userChannels(); const i = list.findIndex((x) => x.id === c.id); if (i >= 0) list.splice(i, 1);
          QG.Store.save(); confirmDel = false; QG.toast('已刪除頻道'); goIndex();
        } }),
        h('button', { type: 'button', class: 'ar-btn', text: '取消', onclick: () => { confirmDel = false; QG.render(); } })) : null);
    const grid = h('div', { class: 'ar-grid' },
      c.mine ? h('div', { class: 'ar-block add' }, h('div', { class: 'ar-sq hint' },
        h('p', null, '在任何區塊按 ', h('b', { text: 'Connect →' }), ' 加進這個頻道'),
        h('a', { class: 'ar-link', href: '#browse', text: '到「探索」找題目 →' }))) : null,
      shown.map((id) => blockEl(QG.QMAP.get(id))));
    return h('div', { class: 'ar-page' }, head,
      ids.length || c.mine ? grid : h('p', { class: 'ar-muted ar-note', text: c.id === 'auto:wrong' ? '還沒有答錯的題目。' : c.id === 'auto:star' ? '還沒有收藏的題目。' : '這個頻道沒有區塊。' }),
      ids.length > state.limit ? h('div', { class: 'ar-more' }, h('button', { type: 'button', class: 'ar-btn', text: `載入更多（還有 ${ids.length - state.limit}）`, onclick: () => { state.limit += 48; QG.render(); } })) : null);
  }

  function renameForm(c) {
    const input = h('input', { type: 'text', class: 'ar-input ar-h1in', value: c.title, maxlength: '60', 'aria-label': '頻道名稱' });
    setTimeout(() => input.focus(), 0);
    return h('form', { class: 'ar-newform inline', onsubmit: (e) => {
      e.preventDefault();
      const t = input.value.trim();
      if (!t) return;
      const raw = userChannels().find((x) => x.id === c.id);
      if (raw) { raw.title = t.slice(0, 60); raw.up = Date.now(); QG.Store.save(); }
      renaming = false; QG.render();
    } }, input, h('button', { type: 'submit', class: 'ar-btn solid', text: '儲存' }),
      h('button', { type: 'button', class: 'ar-btn', text: '取消', onclick: () => { renaming = false; QG.render(); } }));
  }

  function arHome() {
    if (state.page === 'ch') {
      const c = findChannel(state.ch);
      if (c) return channelPage(c);
      state.page = 'index';
    }
    confirmDel = false; renaming = false;
    return indexPage();
  }

  /* ---------------------------------------------------------------- 探索 */
  function arExplore() {
    const kw = (QG.browse.kw || '').trim().toLowerCase();
    const list = QG.QS.filter((q) => !kw || q.text.includes(kw));
    const input = h('input', { type: 'search', class: 'ar-input', id: 'ar-ex-q', placeholder: '搜尋題目、選項…', value: QG.browse.kw || '', 'aria-label': '搜尋區塊' });
    let t;
    input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { QG.browse.kw = input.value; state.exLimit = 48; const pos = input.selectionStart; QG.render(); const n = document.getElementById('ar-ex-q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 250); });
    return h('div', { class: 'ar-page' },
      h('header', { class: 'ar-head' },
        h('p', { class: 'ar-crumb ar-muted', text: '探索' }),
        h('h1', { class: 'ar-h1', text: kw ? `「${QG.browse.kw.trim()}」` : '所有區塊' }),
        h('p', { class: 'ar-muted', text: `${nBlocks(list.length)}・在區塊上按「Connect →」收進你的頻道` }),
        input,
        h('div', { class: 'ar-tags' }, QG.TAGS.filter(([x]) => x !== '其他').map(([x]) => h('button', { type: 'button', class: 'ar-tag', text: x, onclick: () => goChannel('auto:t:' + x) })))),
      list.length ? h('div', { class: 'ar-grid' }, list.slice(0, state.exLimit).map(blockEl)) : h('p', { class: 'ar-muted ar-note', text: '沒有符合的區塊' }),
      list.length > state.exLimit ? h('div', { class: 'ar-more' }, h('button', { type: 'button', class: 'ar-btn', text: `載入更多（還有 ${list.length - state.exLimit}）`, onclick: () => { state.exLimit += 48; QG.render(); } })) : null);
  }

  // 任何指向 #home 的連結（標誌、頂部、底部導覽）都回到頻道索引
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href="#home"]');
    if (!a || SK.skin() !== 'arena' || a.closest('.mx-backdrop')) return;
    state.page = 'index'; state.ch = null;
    if (location.hash === '#home' || !location.hash) { e.preventDefault(); QG.render(); window.scrollTo(0, 0); }
  });

  const prevBefore = QG.hooks.beforeRender;
  QG.hooks.beforeRender = (view) => { closePop(); prevBefore(view); };

  SK.register({ id: 'arena', label: 'Are.na 風', group: '設計界', top: arTop, nav: AR_NAV,
    views: { home: arHome, browse: arExplore } });
})();
