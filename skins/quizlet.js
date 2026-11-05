/* Quizlet 風：學習集頁（目前練習範圍）＋學習模式卡片：單字卡（3D 翻面、還不會／會了分類）、學習、測驗、配對遊戲。
 * 只借用版面、互動與配色；不使用任何標誌或專屬字型。 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon } = SK;
  const S = () => QG.S();

  SK.ICONS.qzCards = SK.ICONS.qzCards || '<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>';
  SK.ICONS.qzLearn = SK.ICONS.qzLearn || '<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7v5l3 2"/><path d="M17 3h4v4"/>';
  SK.ICONS.qzTest = SK.ICONS.qzTest || '<path d="M6 3h12v18H6z"/><path d="M9 8l1.5 1.5L13 7M9 14l1.5 1.5L13 13M15 8.5h0M15 14.5h0"/>';
  SK.ICONS.qzMatch = SK.ICONS.qzMatch || '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/><path d="M13 7h4a2 2 0 0 1 2 2v2M11 17H7a2 2 0 0 1-2-2v-2"/>';
  SK.ICONS.qzLeft = SK.ICONS.qzLeft || '<path d="M19 12H5M11 6l-6 6 6 6"/>';
  SK.ICONS.qzCheck = SK.ICONS.qzCheck || '<path d="M5 12.5l4.5 4.5L19 7.5"/>';

  /** skinData.quizlet：{know:{id:1}, learn:{id:1}, best: 秒數, games: 次數} */
  function data() {
    const st = S().settings;
    if (!st.skinData) st.skinData = {};
    const d = st.skinData.quizlet || (st.skinData.quizlet = {});
    if (!d.know) d.know = {};
    if (!d.learn) d.learn = {};
    if (d.best === undefined) d.best = null;
    if (!d.games) d.games = 0;
    return d;
  }

  const ansText = (q) => (q.all ? '官方釋疑：所有選項均給分' : q.a.map((L) => q.o[L]).join('／'));
  const deck = () => SK.feedPool('quizlet', 'random');

  const state = { mode: 'set', i: 0, flipped: false, terms: 20, sortIds: null, si: 0, match: null };

  /* ---------------------------------------------------------------- 頂部列 */
  function qzTop() {
    const input = h('input', { type: 'search', id: 'quizlet-q', placeholder: '搜尋題目、選項或主題', value: QG.browse.kw, 'aria-label': '搜尋題目' });
    return h('div', { class: 'sk-top quizlet-top' },
      h('a', { class: 'quizlet-brand', href: '#home', 'aria-label': 'QuizGrinder 首頁', onclick: () => { state.mode = 'set'; } }, icon('pad'), h('span', { text: 'QuizGrinder' })),
      h('form', { class: 'quizlet-search', role: 'search', onsubmit: (e) => { e.preventDefault(); Object.assign(QG.browse, { kw: input.value.trim(), tag: '', exam: '', limit: 30 }); SK.go('browse'); } },
        icon('search'), input),
      h('div', { class: 'sk-right' },
        h('a', { class: 'quizlet-top-link', href: '#exam', text: '測驗' }),
        h('a', { class: 'sk-iconbtn', href: '#review', 'aria-label': '錯題本' }, icon('review'), h('span', { class: 'badge', 'data-badge': 'review', hidden: true })),
        h('a', { class: 'quizlet-avatar', href: '#stats', 'aria-label': '我的統計', text: 'Q' })));
  }

  const NAV = [
    { v: 'home', label: '學習集', icon: 'home' },
    { v: 'practice', label: '學習', icon: 'practice' },
    { v: 'review', label: '錯題', icon: 'review', badge: true },
    { v: 'exam', label: '測驗', icon: 'exam' },
    { v: 'stats', label: '個人', icon: 'user' },
  ];

  /* ---------------------------------------------------------------- 翻面卡片 */
  function flashCard(q, flipped, onFlip) {
    const front = h('div', { class: 'quizlet-face front', 'aria-hidden': flipped ? 'true' : 'false' },
      h('span', { class: 'quizlet-face-label', text: '題目' }),
      h('div', { class: 'quizlet-face-body' },
        h('p', { class: 'quizlet-term', text: q.q }),
        q.fig ? h('img', { class: 'quizlet-fig', src: q.fig, alt: '題目附圖', loading: 'lazy' }) : null));
    const back = h('div', { class: 'quizlet-face back', 'aria-hidden': flipped ? 'false' : 'true' },
      h('span', { class: 'quizlet-face-label', text: '答案' }),
      h('div', { class: 'quizlet-face-body' },
        h('p', { class: 'quizlet-def', text: ansText(q) }),
        q.x ? h('p', { class: 'quizlet-x', text: q.x }) : null,
        h('p', { class: 'quizlet-src', text: q.src.map(QG.srcLabel).join('・') })));
    return h('button', { class: 'quizlet-flash' + (flipped ? ' flipped' : ''), type: 'button', dataset: { fk: 'card' }, 'aria-label': flipped ? '翻回題目（空白鍵）' : '翻面看答案（空白鍵）', onclick: onFlip },
      h('span', { class: 'quizlet-inner' }, front, back));
  }

  /* ---------------------------------------------------------------- 學習集頁 */
  function setPage(wrap, redraw) {
    const ids = deck();
    const d = data();
    if (state.i >= ids.length) state.i = 0;
    const known = ids.filter((id) => d.know[id]).length;
    const learning = ids.filter((id) => d.learn[id]).length;
    const q = ids.length ? QG.QMAP.get(ids[state.i]) : null;
    const go = (k) => { if (!ids.length) return; state.i = (state.i + k + ids.length) % ids.length; state.flipped = false; redraw(); };
    const flip = () => { state.flipped = !state.flipped; redraw(); };
    QG.setKeys((e) => {
      if (e.key === ' ') { flip(); return true; }
      if (e.key === 'ArrowRight') { go(1); return true; }
      if (e.key === 'ArrowLeft') { go(-1); return true; }
      return false;
    });
    const mode = (cls, ico, label, onclick) => h('button', { class: 'quizlet-mode ' + cls, type: 'button', onclick }, h('span', { class: 'quizlet-mode-ico' }, icon(ico)), h('span', { text: label }));
    const terms = ids.slice(0, state.terms).map((id) => QG.QMAP.get(id));
    const p = SK.progressOf(ids);
    fill(wrap,
      h('header', { class: 'quizlet-head' },
        h('p', { class: 'quizlet-crumb', text: 'IPAS 電路板製程工程師・學習集' }),
        h('h1', { text: QG.filterLabel(S().settings.filters) }),
        h('p', { class: 'quizlet-meta' }, h('span', { text: `${QG.fmtNum(ids.length)} 個詞語` }), h('span', { text: `已作答 ${QG.fmtNum(p.seen)}` }), h('span', { text: `正確率 ${QG.pct(p.c, p.n)}` }))),
      h('nav', { class: 'quizlet-modes', 'aria-label': '學習模式' },
        mode('cards', 'qzCards', '單字卡', () => { startSort(); redraw(); }),
        mode('learn', 'qzLearn', '學習', () => SK.go('practice')),
        mode('test', 'qzTest', '測驗', () => SK.go('exam')),
        mode('match', 'qzMatch', '配對', () => { state.mode = 'match'; state.match = null; redraw(); })),
      q ? h('section', { class: 'quizlet-preview', 'aria-label': '單字卡預覽' },
        flashCard(q, state.flipped, flip),
        h('div', { class: 'quizlet-ctrl' },
          h('span', { class: 'quizlet-ctrl-side' }, h('span', { class: 'quizlet-hint' }, h('kbd', { text: '空白' }), ' 翻面')),
          h('div', { class: 'quizlet-arrows' },
            h('button', { class: 'quizlet-round', type: 'button', dataset: { fk: 'prev' }, 'aria-label': '上一張（←）', onclick: () => go(-1) }, icon('qzLeft')),
            h('span', { class: 'quizlet-count', text: `${state.i + 1} / ${QG.fmtNum(ids.length)}` }),
            h('button', { class: 'quizlet-round', type: 'button', dataset: { fk: 'next' }, 'aria-label': '下一張（→）', onclick: () => go(1) }, icon('arrow'))),
          h('span', { class: 'quizlet-ctrl-side end' }, SK.starBtn(q, 'quizlet-star', 'star')))) : h('p', { class: 'muted', text: '這個範圍沒有題目，請調整練習範圍。' }),
      h('section', { class: 'quizlet-progress' },
        h('h2', { text: '你的單字卡進度' }),
        h('div', { class: 'quizlet-prog-row' },
          h('div', { class: 'quizlet-prog learn' }, h('b', { text: QG.fmtNum(learning) }), h('span', { text: '還不會' })),
          h('div', { class: 'quizlet-prog know' }, h('b', { text: QG.fmtNum(known) }), h('span', { text: '會了' })),
          h('div', { class: 'quizlet-prog new' }, h('b', { text: QG.fmtNum(ids.length - known - learning) }), h('span', { text: '尚未分類' })))),
      h('details', { class: 'quizlet-range' }, h('summary', { text: '變更學習範圍' }), QG.rangePanel()),
      h('section', { class: 'quizlet-terms' },
        h('h2', { text: `這個學習集中的詞語（${QG.fmtNum(ids.length)}）` }),
        terms.map((t) => h('div', { class: 'quizlet-term-row' },
          h('div', { class: 'quizlet-term-q', text: t.q }),
          h('div', { class: 'quizlet-term-a' }, h('span', { text: ansText(t) }),
            d.know[t.id] ? h('span', { class: 'quizlet-pill know', text: '會了' }) : d.learn[t.id] ? h('span', { class: 'quizlet-pill learn', text: '還不會' }) : null),
          SK.starBtn(t, 'quizlet-star', 'star'))),
        ids.length > state.terms ? h('button', { class: 'quizlet-btn outline', type: 'button', text: `查看更多（還有 ${QG.fmtNum(ids.length - state.terms)} 個）`, onclick: () => { state.terms += 20; redraw(); } }) : null));
  }

  /* ---------------------------------------------------------------- 單字卡分類模式 */
  function startSort(onlyLearning) {
    const d = data();
    const ids = deck();
    state.sortIds = ids.filter((id) => (onlyLearning ? d.learn[id] : !d.know[id]));
    state.si = 0;
    state.flipped = false;
    state.mode = 'cards';
  }

  function sortPage(wrap, redraw) {
    const d = data();
    if (!state.sortIds) startSort();
    const ids = state.sortIds;
    const learnN = ids.filter((id) => d.learn[id]).length;
    const knowN = ids.filter((id) => d.know[id]).length;
    const done = state.si >= ids.length;
    const q = done ? null : QG.QMAP.get(ids[state.si]);
    const mark = (ok) => {
      if (!q) return;
      if (ok) { d.know[q.id] = 1; delete d.learn[q.id]; } else { d.learn[q.id] = 1; delete d.know[q.id]; }
      QG.Store.save();
      state.si++;
      state.flipped = false;
      redraw();
    };
    const back = () => { if (state.si > 0) { state.si--; state.flipped = false; redraw(); } };
    QG.setKeys((e) => {
      if (done) return false;
      if (e.key === ' ') { state.flipped = !state.flipped; redraw(); return true; }
      if (e.key === 'ArrowLeft') { mark(false); return true; }
      if (e.key === 'ArrowRight') { mark(true); return true; }
      if (e.key === 'Backspace') { back(); return true; }
      return false;
    });
    const head = h('div', { class: 'quizlet-modebar' },
      h('button', { class: 'quizlet-back', type: 'button', onclick: () => { state.mode = 'set'; redraw(); } }, icon('qzLeft'), h('span', { text: '返回學習集' })),
      h('strong', { class: 'quizlet-modebar-title' }, icon('qzCards'), ' 單字卡'),
      h('span', { class: 'quizlet-count', text: done ? '完成' : `${state.si + 1} / ${QG.fmtNum(ids.length)}` }));
    const bar = h('div', { class: 'quizlet-sortbar', 'aria-hidden': 'true' }, h('i', { style: `width:${ids.length ? (state.si / ids.length) * 100 : 100}%` }));
    if (done) {
      fill(wrap, head, bar, h('section', { class: 'quizlet-sortdone' },
        h('h2', { text: ids.length ? '做得好！這一輪卡片都分類完了。' : '沒有需要分類的卡片' }),
        h('div', { class: 'quizlet-prog-row' },
          h('div', { class: 'quizlet-prog learn' }, h('b', { text: String(learnN) }), h('span', { text: '還不會' })),
          h('div', { class: 'quizlet-prog know' }, h('b', { text: String(knowN) }), h('span', { text: '會了' }))),
        h('div', { class: 'quizlet-row' },
          learnN ? h('button', { class: 'quizlet-btn', type: 'button', text: `繼續複習還不會的 ${learnN} 張`, onclick: () => { startSort(true); redraw(); } }) : null,
          h('button', { class: 'quizlet-btn outline', type: 'button', text: '重設並從頭開始', onclick: () => {
            for (const id of deck()) { delete d.know[id]; delete d.learn[id]; }
            QG.Store.save(); startSort(); redraw();
          } }),
          h('button', { class: 'quizlet-btn outline', type: 'button', text: '用「學習」模式作答', onclick: () => SK.go('practice') }))));
      return;
    }
    fill(wrap, head, bar,
      h('div', { class: 'quizlet-tally' },
        h('span', { class: 'quizlet-pill learn big' }, h('b', { text: String(learnN) }), ' 還不會'),
        h('span', { class: 'quizlet-pill know big' }, '會了 ', h('b', { text: String(knowN) }))),
      flashCard(q, state.flipped, () => { state.flipped = !state.flipped; redraw(); }),
      h('div', { class: 'quizlet-sortctrl' },
        h('button', { class: 'quizlet-sort learn', type: 'button', dataset: { fk: 'learn' }, 'aria-label': '還不會（←）', onclick: () => mark(false) }, icon('close'), h('span', { text: '還不會' })),
        h('div', { class: 'quizlet-sortmid' },
          h('button', { class: 'quizlet-undo', type: 'button', disabled: state.si ? null : true, onclick: back, text: '↶ 上一張' }),
          h('span', { class: 'quizlet-hint' }, h('kbd', { text: '←' }), ' 還不會・', h('kbd', { text: '空白' }), ' 翻面・', h('kbd', { text: '→' }), ' 會了')),
        h('button', { class: 'quizlet-sort know', type: 'button', dataset: { fk: 'know' }, 'aria-label': '會了（→）', onclick: () => mark(true) }, icon('qzCheck'), h('span', { text: '會了' }))));
  }

  /* ---------------------------------------------------------------- 配對遊戲 */
  function matchCandidates() {
    const okQ = (q) => !q.fig && !q.all && !q.prev && q.q.length <= 70 && ansText(q).length <= 32 && !/以上|皆|均/.test(ansText(q));
    let pool = deck().map((id) => QG.QMAP.get(id)).filter(okQ);
    if (pool.length < 6) pool = QG.QS.filter((q) => q.official && okQ(q));
    const seen = new Set();
    const out = [];
    for (const q of QG.shuffle(pool)) {
      const a = ansText(q);
      if (seen.has(a)) continue;
      seen.add(a);
      out.push(q);
      if (out.length === 6) break;
    }
    return out;
  }

  let matchTimer = null;
  function matchPage(wrap, redraw) {
    const d = data();
    const m = state.match;
    QG.setKeys(null);
    const head = h('div', { class: 'quizlet-modebar' },
      h('button', { class: 'quizlet-back', type: 'button', onclick: () => { clearInterval(matchTimer); state.mode = 'set'; state.match = null; redraw(); } }, icon('qzLeft'), h('span', { text: '返回學習集' })),
      h('strong', { class: 'quizlet-modebar-title' }, icon('qzMatch'), ' 配對'),
      h('span', { class: 'quizlet-count', text: d.best ? `最佳 ${d.best.toFixed(1)} 秒` : '尚無紀錄' }));
    if (!m) {
      fill(wrap, head, h('section', { class: 'quizlet-match-intro' },
        h('span', { class: 'quizlet-mode-ico big' }, icon('qzMatch')),
        h('h2', { text: '準備好了嗎？' }),
        h('p', { text: '把 6 道題目和它們的正確答案配成一對，配對成功的卡片會消失。越快越好！' }),
        h('p', { class: 'muted', text: d.best ? `你的最佳紀錄：${d.best.toFixed(1)} 秒（已玩 ${d.games} 次）` : '還沒有紀錄，來創下第一個吧。' }),
        h('button', { class: 'quizlet-btn big quizlet-match-start', type: 'button', text: '開始遊戲', onclick: () => {
          const qs = matchCandidates();
          const tiles = QG.shuffle(qs.flatMap((q) => [{ k: q.id, text: q.q, kind: 'q' }, { k: q.id, text: ansText(q), kind: 'a' }]));
          state.match = { tiles, sel: null, gone: new Set(), t0: performance.now(), end: null, record: false };
          redraw();
        } })));
      return;
    }
    if (m.end !== null) {
      fill(wrap, head, h('section', { class: 'quizlet-match-done' },
        m.record ? h('span', { class: 'quizlet-pill know big', text: '新紀錄！' }) : null,
        h('h2', { text: `完成！${m.end.toFixed(1)} 秒` }),
        h('p', { class: 'muted', text: `最佳紀錄 ${d.best.toFixed(1)} 秒・已玩 ${d.games} 次` }),
        h('div', { class: 'quizlet-row' },
          h('button', { class: 'quizlet-btn', type: 'button', text: '再玩一次', onclick: () => { state.match = null; redraw(); } }),
          h('button', { class: 'quizlet-btn outline', type: 'button', text: '返回學習集', onclick: () => { state.mode = 'set'; state.match = null; redraw(); } }))));
      return;
    }
    const clock = h('span', { class: 'quizlet-clock', 'aria-live': 'off' });
    const tick = () => {
      if (!clock.isConnected) { clearInterval(matchTimer); return; }
      clock.textContent = `${((performance.now() - m.t0) / 1000).toFixed(1)} 秒`;
    };
    const grid = h('div', { class: 'quizlet-tiles' });
    const els = m.tiles.map((t, i) => {
      const b = h('button', { class: 'quizlet-tile ' + t.kind, type: 'button', dataset: { k: t.k }, onclick: () => pick(i) }, h('span', { text: t.text }));
      if (m.gone.has(i)) b.classList.add('gone');
      return b;
    });
    function pick(i) {
      if (m.gone.has(i) || m.lock) return;
      const b = els[i];
      if (m.sel === null) { m.sel = i; b.classList.add('sel'); return; }
      if (m.sel === i) { m.sel = null; b.classList.remove('sel'); return; }
      const a = els[m.sel];
      const j = m.sel;
      m.sel = null;
      if (m.tiles[j].k === m.tiles[i].k) {
        m.gone.add(i); m.gone.add(j);
        a.classList.remove('sel'); a.classList.add('ok'); b.classList.add('ok');
        setTimeout(() => { a.classList.add('gone'); b.classList.add('gone'); a.disabled = true; b.disabled = true; }, 250);
        if (m.gone.size === m.tiles.length) {
          clearInterval(matchTimer);
          m.end = (performance.now() - m.t0) / 1000;
          d.games++;
          if (d.best === null || m.end < d.best) { d.best = Math.round(m.end * 10) / 10; m.record = true; }
          QG.Store.save();
          setTimeout(redraw, 450);
        }
      } else {
        a.classList.remove('sel');
        a.classList.add('ng'); b.classList.add('ng');
        m.lock = true;
        setTimeout(() => { a.classList.remove('ng'); b.classList.remove('ng'); m.lock = false; }, 550);
      }
    }
    fill(grid, els);
    fill(wrap, head, h('div', { class: 'quizlet-match-bar' }, clock, h('span', { class: 'muted', text: '點一張題目，再點它的答案' })), grid);
    clearInterval(matchTimer);
    matchTimer = setInterval(tick, 100);
    tick();
  }

  function qzHome() {
    const wrap = h('div', { class: 'quizlet-page' });
    const redraw = () => {
      const fk = document.activeElement && wrap.contains(document.activeElement) ? document.activeElement.dataset.fk : null;
      if (state.mode === 'cards') sortPage(wrap, redraw);
      else if (state.mode === 'match') matchPage(wrap, redraw);
      else setPage(wrap, redraw);
      wrap.dataset.mode = state.mode;
      const again = fk && wrap.querySelector(`[data-fk="${fk}"]`);
      if (again) again.focus({ preventScroll: true });
    };
    redraw();
    return wrap;
  }

  SK.register({
    id: 'quizlet', label: 'Quizlet 風', group: '學習測驗',
    top: qzTop, nav: NAV,
    views: { home: qzHome },
    after: (view) => { if (view !== 'home') clearInterval(matchTimer); },
  });
})();
