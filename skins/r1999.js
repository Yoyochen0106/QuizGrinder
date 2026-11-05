/* 重返未來：1999 風：復古 1920s–1999 編輯排版——泛黃紙張、襯線標題、墨綠／酒紅／金、打字機等寬標籤、票根與郵戳。
 *   首頁＝卡牌合成：手上 7 張題卡（依弱點主題抽出，主題配色，等級 I）；按「整理」讓相鄰、同主題、同等級的卡合成升階（II、III），
 *   被合併的那題回到牌堆底；出牌＝作答該卡題目，答對得 等級 × 100 分；一手出 7 張後結算，最佳分數存在 skinData.r1999
 *   「今日報導」：報紙版面的真實學習數據
 * 只借用版面、互動與配色；卡面、紋樣全為原創 CSS 圖形，不使用任何角色、標誌或遊戲專有名詞。 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon, hue } = SK;
  const S = () => QG.S();
  const ID = 'r1999';
  const HAND = 7, PLAYS = 7, MAXLV = 3;
  const ROMAN = ['', 'I', 'II', 'III'];

  SK.ICONS.r9Cards = SK.ICONS.r9Cards || '<rect x="3" y="6" width="11" height="15" rx="1.5"/><path d="M8 3h11.5A1.5 1.5 0 0 1 21 4.5V18"/>';
  SK.ICONS.r9Paper = SK.ICONS.r9Paper || '<path d="M4 4h13v16H6a2 2 0 0 1-2-2z"/><path d="M17 8h3v10a2 2 0 0 1-2 2M7 8h7M7 12h7M7 16h4"/>';
  SK.ICONS.r9Merge = SK.ICONS.r9Merge || '<path d="M6 3v6a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><path d="M12 15v6M9 18l3 3 3-3"/>';

  /* ---------------------------------------------------------------- 資料 */
  function data() {
    const st = S().settings;
    if (!st.skinData) st.skinData = {};
    return st.skinData[ID] || (st.skinData[ID] = { best: 0, hands: 0 });
  }
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const today = () => S().days[QG.dayKey()] || { n: 0, c: 0 };
  function topics() {
    return QG.TAGS.filter(([t]) => t !== '其他').map(([t]) => {
      const ids = QG.QS.filter((q) => q.t.includes(t)).map((q) => q.id);
      const p = SK.progressOf(ids);
      return { t, ids, p, cov: ids.length ? p.seen / ids.length : 0, acc: p.n ? p.c / p.n : 0 };
    });
  }
  const weakness = (tp) => 1 - ((tp.p.c + 1) / (tp.p.n + 2)) * (0.4 + 0.6 * tp.cov);
  const dateStr = (d) => `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日・星期${'日一二三四五六'[d.getDay()]}`;

  /* ---------------------------------------------------------------- 頂部列 */
  const NAV = [
    { v: 'home', label: '牌局', icon: 'r9Cards' },
    { v: 'practice', label: '練習', icon: 'practice' },
    { v: 'review', label: '勘誤', icon: 'review', badge: true },
    { v: 'exam', label: '模擬考', icon: 'exam' },
    { v: 'browse', label: '檔案館', icon: 'browse' },
    { v: 'stats', label: '年鑑', icon: 'stats' },
  ];
  function r9Top(view) {
    const d = new Date();
    return h('div', { class: 'sk-top r9-top' },
      SK.brand('QuizGrinder'),
      h('span', { class: 'r9-mono r9-date', text: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}` }),
      h('nav', { class: 'r9-nav', 'aria-label': '主要功能' }, NAV.map((n) => h('a', { href: '#' + n.v, 'aria-current': SK.isCurrent(view, n.v) ? 'page' : null },
        h('span', { text: n.label }), n.badge ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null))),
      h('span', { class: 'r9-topbest' }, h('small', { class: 'r9-mono', text: 'BEST' }), h('b', { text: QG.fmtNum(data().best || 0) })));
  }
  function refreshTop() {
    const top = document.getElementById('topbar');
    if (top && SK.skin() === ID) fill(top, r9Top(QG.currentView));
    QG.updateBadges();
  }

  /* ---------------------------------------------------------------- 牌局 */
  let hand = null;
  let uid = 0;
  function newHand() {
    const tps = topics().sort((a, b) => weakness(b) - weakness(a) || a.t.localeCompare(b.t)).slice(0, 4);
    let deck = [];
    tps.forEach((tp) => {
      const ids = QG.buildQueue(tp.ids.filter((id) => !QG.QMAP.get(id).prev), 'weak').slice(0, 6);
      deck = deck.concat(ids.map((id) => ({ id, topic: tp.t })));
    });
    // 去除重複（同一題可能屬於多個弱點主題）
    const seen = new Set();
    deck = QG.shuffle(deck.filter((c) => (seen.has(c.id) ? false : seen.add(c.id))));
    hand = { cards: [], deck, plays: 0, score: 0, log: [], sel: null, flash: new Set(), done: false, pending: null };
    refill();
  }
  function refill() {
    while (hand.cards.length < HAND && hand.deck.length) {
      const c = hand.deck.shift();
      hand.cards.push({ id: c.id, topic: c.topic, lv: 1, uid: ++uid });
    }
  }
  function mergeable() {
    let n = 0;
    const cs = hand.cards;
    for (let i = 0; i < cs.length - 1; i++) {
      if (cs[i].topic === cs[i + 1].topic && cs[i].lv === cs[i + 1].lv && cs[i].lv < MAXLV) { n++; i++; }
    }
    return n;
  }
  /** 整理：由左到右，相鄰同主題同等級的兩張合成一張（升一階），被合併的題目回到牌堆底，再補滿手牌 */
  function tidy() {
    const cs = hand.cards;
    hand.flash = new Set();
    for (let i = 0; i < cs.length - 1; i++) {
      const a = cs[i], b = cs[i + 1];
      if (a.topic === b.topic && a.lv === b.lv && a.lv < MAXLV) {
        a.lv++;
        hand.deck.push({ id: b.id, topic: b.topic });
        cs.splice(i + 1, 1);
        hand.flash.add(a.uid);
        if (hand.sel === b.uid) hand.sel = a.uid;
      }
    }
    refill();
    drawTable();
  }
  /** 作答當下就計分並寫入紀錄；卡片留在桌上顯示結果，按「收下」才移除並補牌 */
  function answer(card, ok) {
    const pts = ok ? card.lv * 100 : 0;
    hand.score += pts;
    hand.plays++;
    hand.log.push({ id: card.id, topic: card.topic, lv: card.lv, ok, pts });
    hand.pending = { uid: card.uid, ok, pts };
    refreshTop();
  }
  function commit() {
    if (!hand.pending) return;
    const uid0 = hand.pending.uid;
    const card = hand.cards.find((c) => c.uid === uid0);
    hand.lastPlayed = { card, ok: hand.pending.ok, pts: hand.pending.pts };
    hand.cards = hand.cards.filter((c) => c.uid !== uid0);
    hand.pending = null;
    hand.sel = null;
    hand.flash = new Set();
    refill();
    if (hand.plays >= PLAYS || !hand.cards.length) finishHand();
    drawTable();
  }
  function finishHand() {
    const d = data();
    hand.done = true;
    hand.newBest = hand.score > (d.best || 0);
    d.best = Math.max(d.best || 0, hand.score);
    d.hands = (d.hands || 0) + 1;
    d.last = { ts: Date.now(), score: hand.score, c: hand.log.filter((x) => x.ok).length, n: hand.log.length };
    QG.Store.save();
  }

  let tableEl = null;
  function cardEl(c, i) {
    const q = QG.QMAP.get(c.id);
    return h('button', {
      type: 'button', class: `r9-card lv${c.lv}` + (hand.sel === c.uid ? ' sel' : '') + (hand.pending && hand.pending.uid !== c.uid ? ' wait' : '') + (hand.flash.has(c.uid) && !reduced() ? ' flash' : ''),
      style: `--h:${hue(c.topic)}`, 'aria-pressed': hand.sel === c.uid ? 'true' : 'false',
      'aria-label': `第 ${i + 1} 張，${c.topic}，等級 ${ROMAN[c.lv]}，答對得 ${c.lv * 100} 分`,
      onclick: () => { if (hand.pending) return; hand.sel = hand.sel === c.uid ? null : c.uid; drawTable(); const p = tableEl && tableEl.querySelector('.r9-ticket'); if (p && matchMedia('(max-width: 720px)').matches) p.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); },
    },
    h('span', { class: 'r9-card-frame' }),
    h('span', { class: 'r9-card-lv', text: ROMAN[c.lv] }),
    h('span', { class: 'r9-card-art', 'aria-hidden': 'true' }, h('i')),
    h('span', { class: 'r9-card-topic', text: c.topic }),
    h('span', { class: 'r9-card-no r9-mono', text: q.src[0] ? QG.srcLabel(q.src[0]).replace(/\s.*$/, '') : '' }),
    h('span', { class: 'r9-card-pts r9-mono', text: `${c.lv * 100}` }));
  }

  function ticket() {
    const c = hand.cards.find((x) => x.uid === hand.sel);
    if (!c) {
      const lp = hand.lastPlayed;
      return h('div', { class: 'r9-hint' },
        lp ? h('p', { class: 'r9-last ' + (lp.ok ? 'ok' : 'ng') }, h('span', { class: 'r9-stamp small', text: lp.ok ? `+${lp.pts}` : '未得分' }),
          `上一張：${lp.card.topic}・${ROMAN[lp.card.lv]}　${lp.ok ? '答對' : '答錯，已加入錯題本'}`) : null,
        h('p', { text: '選一張卡出牌（作答）。相鄰的同主題、同等級卡可以先按「整理」合成升階：II 答對 200 分、III 答對 300 分。' }));
    }
    const q = QG.QMAP.get(c.id);
    const fb = h('div', { class: 'r9-fb', role: 'status' });
    const result = (ok, pts) => {
      fill(fb, h('span', { class: 'r9-stamp' + (ok ? '' : ' ng'), text: ok ? `+${pts}` : '未得分' }),
        h('p', { class: 'r9-fb-t', text: ok ? `答對！等級 ${ROMAN[c.lv]} 卡得 ${pts} 分。` : `答錯。正解 ${q.all ? '全部給分' : q.a.join('、')}，已加入錯題本。` }),
        q.x ? h('p', { class: 'r9-fb-x', text: q.x }) : null,
        h('button', { type: 'button', class: 'r9-btn gold', id: 'r9-next', onclick: commit }, hand.plays >= PLAYS ? '結算本手' : '收下，補一張牌'));
      const b = fb.querySelector('#r9-next'); if (b) b.focus({ preventScroll: true });
      QG.setKeys((e) => { if (e.key === 'Enter' && fb.isConnected) { commit(); return true; } return false; });
    };
    let body;
    if (hand.pending && hand.pending.uid === c.uid) {
      body = h('ol', { class: 'r9-recap' }, QG.LETTERS.map((L) => h('li', { class: q.all || q.a.includes(L) ? 'ans' : '' }, h('b', { text: L }), h('span', { text: q.o[L] }))));
      setTimeout(() => { if (hand.pending && fb.isConnected) result(hand.pending.ok, hand.pending.pts); }, 0);
    } else {
      body = SK.answerOptions(q, { cls: 'r9-ans', onDone: (ok) => { answer(c, ok); result(ok, hand.pending.pts); const tb = tableEl && tableEl.querySelector('.r9-tidy'); if (tb) tb.disabled = true; } });
      QG.setKeys((e) => { const k = '1234'.indexOf(e.key); if (k >= 0 && body.isConnected) { body.pick(k); return true; } return false; });
    }
    return h('section', { class: 'r9-ticket', style: `--h:${hue(c.topic)}`, 'aria-label': '出牌：作答' },
      h('div', { class: 'r9-ticket-stub' }, h('span', { class: 'r9-mono', text: 'ADMIT' }), h('b', { text: ROMAN[c.lv] }), h('span', { class: 'r9-mono', text: `${c.lv * 100} PTS` })),
      h('div', { class: 'r9-ticket-main' },
        h('p', { class: 'r9-mono r9-ticket-h', text: `${c.topic}・${q.src.map(QG.srcLabel).join('・')}` }),
        h('p', { class: 'r9-q', text: q.q }),
        q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖', loading: 'lazy' })) : null,
        body, fb));
  }

  function summary() {
    const d = data();
    const c = hand.log.filter((x) => x.ok).length;
    const wrong = hand.log.filter((x) => !x.ok).map((x) => x.id);
    return h('section', { class: 'r9-summary' },
      h('p', { class: 'r9-mono', text: 'END OF HAND' }),
      h('h2', { class: 'r9-serif', text: '本手結算' }),
      h('div', { class: 'r9-score' }, h('b', { text: QG.fmtNum(hand.score) }), h('span', { text: '分' }),
        hand.newBest ? h('span', { class: 'r9-stamp', text: '新紀錄' }) : null),
      h('p', { class: 'r9-sub', text: `出牌 ${hand.log.length} 張・答對 ${c} 張・最佳紀錄 ${QG.fmtNum(d.best)} 分・累計 ${d.hands} 手` }),
      h('ol', { class: 'r9-log' }, hand.log.map((x) => h('li', { class: x.ok ? 'ok' : 'ng', style: `--h:${hue(x.topic)}` },
        h('span', { class: 'r9-log-lv', text: ROMAN[x.lv] }), h('span', { class: 'r9-log-t', text: x.topic }), h('b', { text: x.ok ? `+${x.pts}` : '0' })))),
      h('div', { class: 'r9-btns' },
        h('button', { type: 'button', class: 'r9-btn gold', onclick: () => { newHand(); drawTable(); } }, icon('r9Cards'), '新的一手'),
        wrong.length ? h('button', { type: 'button', class: 'r9-btn', onclick: () => QG.startCustomPractice(wrong, '牌局複盤') }, `複習答錯（${wrong.length}）`) : null));
  }

  function drawTable(force) {
    if (!tableEl || (!force && !tableEl.isConnected)) return;
    QG.setKeys(null);
    if (hand.done) { fill(tableEl, tableHead(), summary()); return; }
    const m = mergeable();
    fill(tableEl,
      tableHead(),
      h('div', { class: 'r9-hand', role: 'list', 'aria-label': '手牌' }, hand.cards.map((c, i) => h('div', { class: 'r9-slot', role: 'listitem' }, cardEl(c, i)))),
      h('div', { class: 'r9-actions' },
        h('button', { type: 'button', class: 'r9-btn gold r9-tidy', disabled: m && !hand.pending ? null : true, onclick: tidy }, icon('r9Merge'), m ? `整理（可合成 ${m} 組）` : '整理（沒有可合成的卡）'),
        h('span', { class: 'r9-mono r9-deck', text: `牌堆 ${hand.deck.length}` })),
      ticket());
  }
  function tableHead() {
    return h('header', { class: 'r9-thead' },
      h('div', null, h('p', { class: 'r9-mono', text: 'CARD ARCANA' }), h('h1', { class: 'r9-serif', text: '題卡合成' })),
      h('dl', { class: 'r9-counters' },
        h('div', null, h('dt', { text: '出牌' }), h('dd', { text: `${hand.plays} / ${PLAYS}` })),
        h('div', null, h('dt', { text: '得分' }), h('dd', { text: QG.fmtNum(hand.score) })),
        h('div', null, h('dt', { text: '最佳' }), h('dd', { text: QG.fmtNum(data().best || 0) }))));
  }

  /* ---------------------------------------------------------------- 今日報導 */
  function newspaper() {
    const st = S();
    const t = today();
    const tot = QG.totals();
    const issue = Object.values(st.days).filter((d) => d && d.n).length;
    const tps = topics().filter((x) => x.p.n >= 3).sort((a, b) => a.acc - b.acc);
    const weak = tps[0];
    const strong = tps.length > 1 ? tps[tps.length - 1] : null;
    const due = QG.dueReviewIds().length;
    const lastExam = st.exams[st.exams.length - 1];
    const head = t.n ? `今日作答 ${t.n} 題　正確率 ${QG.pct(t.c, t.n)}` : '本日尚無作答紀錄';
    const lead = t.n
      ? `截至發稿，今日共答對 ${t.c} 題、答錯 ${t.n - t.c} 題。累計作答 ${QG.fmtNum(tot.n)} 次，已練 ${QG.fmtNum(tot.seen)} / ${QG.fmtNum(QG.QS.length)} 題。`
      : `累計作答 ${QG.fmtNum(tot.n)} 次，已練 ${QG.fmtNum(tot.seen)} / ${QG.fmtNum(QG.QS.length)} 題。今天出一手牌，就能登上明天的頭條。`;
    const d = data();
    return h('article', { class: 'r9-paper', 'aria-label': '今日報導' },
      h('header', { class: 'r9-mast' },
        h('p', { class: 'r9-mono r9-mast-top' }, h('span', { text: `第 ${issue} 期` }), h('span', { text: '今日報導' }), h('span', { text: '每日一份' })),
        h('h2', { class: 'r9-mast-title', text: '學習日報' }),
        h('p', { class: 'r9-mono r9-mast-date', text: dateStr(new Date()) })),
      h('section', { class: 'r9-lead' },
        h('div', { class: 'r9-lead-head' },
          h('h3', { class: 'r9-serif r9-headline', text: head }),
          t.n ? h('span', { class: 'r9-stamp postal', text: '本日已作答' }) : null),
        h('p', { class: 'r9-body', text: lead })),
      h('section', { class: 'r9-cols' },
        h('div', { class: 'r9-col' },
          h('h4', { class: 'r9-kicker', text: '專欄｜弱點觀察' }),
          h('p', { class: 'r9-body', text: weak ? `本報觀察，「${weak.t}」正確率 ${Math.round(weak.acc * 100)}%（${weak.p.c}/${weak.p.n}），為目前最需加強的主題。${strong ? `表現最佳的是「${strong.t}」，正確率 ${Math.round(strong.acc * 100)}%。` : ''}` : '作答資料還不夠，各主題累積 3 次作答後，本欄將刊出弱點分析。' })),
        h('div', { class: 'r9-col' },
          h('h4', { class: 'r9-kicker', text: '簡訊' }),
          h('ul', { class: 'r9-briefs' },
            h('li', null, h('b', { text: `${QG.streak()} 天` }), '連續學習'),
            h('li', null, h('b', { text: `${due} 題` }), '錯題待複習'),
            h('li', null, h('b', { text: lastExam ? `${lastExam.score} 分` : '—' }), lastExam ? '最近一次模擬考' : '尚無模擬考紀錄')))),
      h('footer', { class: 'r9-stub' },
        h('span', { class: 'r9-mono', text: 'BEST HAND' }), h('b', { text: `${QG.fmtNum(d.best || 0)} 分` }),
        h('span', { class: 'r9-mono', text: `共 ${d.hands || 0} 手` })));
  }

  /* ---------------------------------------------------------------- 首頁 */
  function r9Home() {
    if (!hand) newHand();
    tableEl = h('section', { class: 'r9-table', 'aria-label': '牌局' });
    const root = h('div', { class: 'r9-home' }, tableEl, newspaper());
    drawTable(true);
    return root;
  }

  function r9Stats(base) {
    const el = base.stats();
    el.prepend(newspaper());
    return el;
  }

  /* ---------------------------------------------------------------- 號外（模擬考結果） */
  function r9Result(base) {
    const el = base.result();
    const r = S().lastResult;
    if (!r) return el;
    el.prepend(h('section', { class: 'r9-extra' },
      h('p', { class: 'r9-mono r9-extra-top' }, h('span', { text: '號外' }), h('span', { text: dateStr(new Date(r.ts || Date.now())) })),
      h('h2', { class: 'r9-extra-title', text: r.score >= 60 ? `模擬考 ${r.score} 分　順利過關` : `模擬考 ${r.score} 分　仍待努力` }),
      h('p', { class: 'r9-body', text: `${QG.SUBJ_CODE[r.subject]} ${QG.SUBJ[r.subject]}，共 ${r.total} 題答對 ${r.correct} 題。答錯的題目已收入勘誤（錯題本），可於下一手牌局中再次抽到。` }),
      h('span', { class: 'r9-stamp' + (r.score >= 60 ? '' : ' ng'), text: r.score >= 60 ? '及格' : '未及格' })));
    return el;
  }

  /* ---------------------------------------------------------------- 進場與換頁轉場 */
  // 進場（載入）動畫：每個分頁工作階段第一次以本風格載入時播放一次
  const ENTRY_KEY = 'qg-entry-' + ID;
  let entryPending = (() => { try { return !sessionStorage.getItem(ENTRY_KEY); } catch (e) { return true; } })();
  let firstRender = true; // 頁面剛載入的第一次繪製不做換頁動畫
  let switched = false; // 從切換列換到本風格時只做換頁動畫（完整進場動畫留給頁面載入）
  document.addEventListener('change', (e) => { if (e.target && e.target.id === 'sk-select') switched = true; }, true);
  document.addEventListener('click', (e) => { if (e.target && e.target.closest && e.target.closest('.sk-bar-step')) switched = true; }, true);
  function drillHud(view) {
    const d = today();
    const issue = Object.values(S().days).filter((x) => x && x.n).length;
    return h('div', { class: 'r9-drillhud', 'aria-hidden': 'true' },
      h('span', { class: 'r9-mono', text: `第 ${issue} 期` }),
      h('b', { class: 'r9-serif', text: view === 'review' ? '勘誤專欄' : '練習簿' }),
      h('span', { class: 'r9-mono', text: `今日 ${d.c}/${d.n}` }));
  }
  function r9After(view, changed) {
    const page = document.getElementById('app').firstElementChild;
    if ((view === 'practice' || view === 'review') && page && page.querySelector('.qhead')) document.getElementById('app').prepend(drillHud(view));
    if (reduced()) { entryPending = false; firstRender = false; switched = false; return; }
    if (switched) entryPending = false;
    if (page && ((changed && !firstRender) || switched)) page.classList.add('r9-scene');
    firstRender = false;
    switched = false;
    if (entryPending) {
      entryPending = false;
      try { sessionStorage.setItem(ENTRY_KEY, '1'); } catch (e) { /* 無法使用 sessionStorage 時每次載入都播放 */ }
      const o = h('div', { class: 'r9-entry', 'aria-hidden': 'true' }, h('span', { class: 'r9-iris' }), h('span', { class: 'r9-entry-num', text: '1999' }));
      document.body.append(o);
      setTimeout(() => o.remove(), 1200);
    }
  }

  SK.register({
    id: ID, label: '重返未來：1999 風', group: '二次元手遊',
    top: r9Top, nav: NAV.filter((n) => n.v !== 'browse'),
    views: { home: r9Home, stats: r9Stats, result: r9Result },
    after: r9After,
  });
})();
