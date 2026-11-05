/* 蔚藍檔案風：清爽的白＋天藍校園 UI、平行四邊形按鈕、淡網點、圓潤無襯線字。
 *   大廳：頂部資源列（今日作答、連續天數、待複習——都是真實數字）、右側選單磚
 *   訊息 App：家教機器人用聊天訊息出題，回覆按鈕作答，批改結果與解析也以訊息呈現（作答寫入學習紀錄）
 *   課程表：每週七天各排一個主題（存在 skinData.bluearchive），今天的格子有「上課」→ 練該主題
 * 只借用版面、互動與配色；不使用任何角色、立繪、標誌或遊戲專有名詞。 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon, hue } = SK;
  const S = () => QG.S();
  const ID = 'bluearchive';

  SK.ICONS.baChat = SK.ICONS.baChat || '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>';
  SK.ICONS.baCal = SK.ICONS.baCal || '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>';
  SK.ICONS.baBot = SK.ICONS.baBot || '<rect x="5" y="8" width="14" height="11" rx="4"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5"/><circle cx="12" cy="3.5" r="1"/>';
  SK.ICONS.baPen = SK.ICONS.baPen || '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>';

  const DAYS = ['一', '二', '三', '四', '五', '六', '日'];
  const DAY_EN = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  /* ---------------------------------------------------------------- 資料 */
  function data() {
    const st = S().settings;
    if (!st.skinData) st.skinData = {};
    const d = st.skinData[ID] || (st.skinData[ID] = {});
    if (!d.sched || typeof d.sched !== 'object') d.sched = {};
    return d;
  }
  const weekday = () => (new Date().getDay() + 6) % 7; // 0＝星期一
  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const today = () => S().days[QG.dayKey()] || { n: 0, c: 0 };
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function topics() {
    return QG.TAGS.filter(([t]) => t !== '其他').map(([t]) => {
      const ids = QG.QS.filter((q) => q.t.includes(t)).map((q) => q.id);
      const p = SK.progressOf(ids);
      return { t, ids, p, cov: ids.length ? p.seen / ids.length : 0 };
    });
  }
  const topicIds = (t) => QG.QS.filter((q) => q.t.includes(t)).map((q) => q.id);
  function answeredToday(ids) {
    const t0 = startOfToday();
    return ids.filter((id) => { const r = S().q[id]; return r && r.t >= t0; }).length;
  }
  function startLesson(t) {
    QG.startCustomPractice(QG.buildQueue(topicIds(t), 'weak').slice(0, 10), `課程：${t}`);
  }

  /* ---------------------------------------------------------------- 頂部資源列 */
  const NAV = [
    { v: 'home', label: '大廳', icon: 'home' },
    { v: 'practice', label: '任務', icon: 'practice' },
    { v: 'review', label: '複習', icon: 'review', badge: true },
    { v: 'exam', label: '模擬考', icon: 'exam' },
    { v: 'stats', label: '檔案', icon: 'stats' },
  ];
  function res(ic, v, label, href) {
    return h('a', { class: 'ba-res', href, title: label, 'aria-label': `${label} ${v}` },
      h('span', { class: 'ba-res-ico' }, icon(ic)), h('span', { class: 'ba-res-txt' }, h('small', { text: label }), h('b', { text: String(v) })));
  }
  function baTop(view) {
    return h('div', { class: 'sk-top ba-top' },
      SK.brand('QuizGrinder'),
      h('div', { class: 'ba-resbar' },
        res('practice', QG.fmtNum(today().n), '今日作答', '#practice'),
        res('flame', QG.streak(), '連續天數', '#stats'),
        res('review', QG.dueReviewIds().length, '待複習', '#review')),
      h('nav', { class: 'ba-topnav', 'aria-label': '主要功能' }, NAV.concat([{ v: 'browse', label: '題庫', icon: 'browse' }]).map((n) => h('a', {
        href: '#' + n.v, class: 'ba-tn', 'aria-current': SK.isCurrent(view, n.v) ? 'page' : null, title: n.label, 'aria-label': n.label,
      }, icon(n.icon)))));
  }
  function refreshTop() {
    const top = document.getElementById('topbar');
    if (top && SK.skin() === ID) fill(top, baTop(QG.currentView));
    QG.updateBadges();
  }

  /* ---------------------------------------------------------------- 訊息 App */
  const chat = { msgs: [], mode: null, queue: [], q: null, done: false, n: 0, c: 0, seen: new Set() };
  let chatBody = null, chatReplies = null, chatHead = null;

  function bot(text, extra) { chat.msgs.push(Object.assign({ from: 'bot', text }, extra || {})); }
  function me(text) { chat.msgs.push({ from: 'me', text }); }
  function greet() {
    if (chat.msgs.length) return;
    const t = data().sched[weekday()];
    const n = today().n;
    bot(n ? `今天已經作答 ${n} 題了，繼續加油！` : '早安！今天也一起練習吧。');
    bot(t ? `今天（星期${DAYS[weekday()]}）的課程是「${t}」。要從哪裡開始？` : '要從哪裡開始？也可以先在課程表排好今天的主題。');
  }

  function nextQuestion() {
    const st = S().q;
    let id = null;
    if (chat.mode === 'review') {
      id = QG.dueReviewIds().find((x) => !chat.seen.has(x) && !QG.QMAP.get(x).prev) || null;
    } else {
      while (chat.queue.length && !id) { const x = chat.queue.shift(); if (!chat.seen.has(x)) id = x; }
    }
    if (!id) {
      chat.q = null;
      bot(chat.mode === 'review' ? '到期的錯題都複習完了！' : '這一組題目都問完了，換個主題吧。');
      return;
    }
    chat.seen.add(id);
    chat.q = id;
    chat.done = false;
    bot('', { qid: id, prior: st[id] ? st[id].c + st[id].w : 0 });
  }
  function begin(mode, label) {
    chat.mode = mode;
    const pool = (ids) => QG.buildQueue(ids.filter((id) => !QG.QMAP.get(id).prev), 'weak');
    if (mode === 'mix') chat.queue = pool(QG.filterQuestions(S().settings.filters).map((q) => q.id));
    if (mode === 'topic') chat.queue = pool(topicIds(data().sched[weekday()]));
    me(label);
    nextQuestion();
    drawChat();
  }
  function reply(L) {
    const q = QG.QMAP.get(chat.q);
    if (!q || chat.done) return;
    const ok = q.all || q.a.includes(L);
    chat.done = true;
    chat.n++; if (ok) chat.c++;
    QG.record(q.id, ok, { review: chat.mode === 'review' });
    QG.Store.save();
    me(`${L}. ${q.o[L]}`);
    const ans = q.all ? '這題官方釋疑所有選項都給分。' : `正解是 ${q.a.join('、')}. ${q.o[q.a[0]]}`;
    bot(ok ? `答對了！${q.all ? '（本題全部給分）' : ''}` : `可惜～${ans}`, { result: ok ? 'ok' : 'ng' });
    if (q.x) bot(q.x, { note: true });
    if (!ok) bot('這題已經幫你加進錯題本了。');
    refreshTop();
    drawChat();
  }
  function rest() {
    me('先到這裡');
    chat.mode = null; chat.q = null;
    bot(chat.n ? `辛苦了！這次聊天答對 ${chat.c} / ${chat.n} 題，今天共作答 ${today().n} 題。` : '好的，隨時再來找我。');
    drawChat();
  }

  function bubble(m) {
    if (m.qid) {
      const q = QG.QMAP.get(m.qid);
      return h('div', { class: 'ba-msg bot q' },
        h('p', { class: 'ba-qmeta', text: `${q.t.filter((t) => t !== '其他').slice(0, 2).join('・') || '綜合'}｜${q.src.map(QG.srcLabel).join('・')}` }),
        h('p', { class: 'ba-qtext', text: q.q }),
        q.fig ? h('img', { class: 'ba-qfig', src: q.fig, alt: '題目附圖', loading: 'lazy' }) : null,
        h('ol', { class: 'ba-qopts' }, QG.LETTERS.map((L) => h('li', null, h('b', { text: L }), h('span', { text: q.o[L] })))));
    }
    return h('div', { class: 'ba-msg ' + m.from + (m.result ? ' ' + m.result : '') + (m.note ? ' note' : '') }, m.note ? h('b', { text: '解析' }) : null, h('span', { text: m.text }));
  }
  function replies() {
    const t = data().sched[weekday()];
    const due = QG.dueReviewIds().length;
    const rb = (label, fn, cls) => h('button', { type: 'button', class: 'ba-reply' + (cls ? ' ' + cls : ''), onclick: fn }, h('span', { text: label }));
    if (chat.q && !chat.done) {
      const q = QG.QMAP.get(chat.q);
      return QG.LETTERS.map((L) => h('button', { type: 'button', class: 'ba-reply opt', onclick: () => reply(L), 'aria-label': `回覆 ${L}：${q.o[L]}` },
        h('b', { text: L }), h('span', { text: q.o[L] })));
    }
    if (chat.q && chat.done) return [rb('下一題', () => { me('下一題'); nextQuestion(); drawChat(); }, 'main'), rb('換個主題', () => { me('換個主題'); chat.q = null; chat.mode = null; bot('好，要練什麼呢？'); drawChat(); }), rb('先到這裡', rest)];
    return [
      t ? rb(`練今天的課程（${t}）`, () => begin('topic', `練今天的課程：${t}`), 'main') : null,
      rb('隨便出一題', () => begin('mix', '隨便出一題給我'), t ? '' : 'main'),
      due ? rb(`複習錯題（${due}）`, () => begin('review', '幫我複習錯題')) : null,
    ];
  }
  function drawChat() {
    if (!chatBody || !chatBody.isConnected) return;
    const msgs = chat.msgs.slice(-40);
    fill(chatBody, msgs.map((m, i) => {
      const prevFrom = i ? msgs[i - 1].from : null;
      const row = h('div', { class: 'ba-row ' + m.from + (reduced() ? '' : ' pop') });
      if (m.from === 'bot' && prevFrom !== 'bot') row.append(h('span', { class: 'ba-av', 'aria-hidden': 'true' }, icon('baBot')));
      else if (m.from === 'bot') row.append(h('span', { class: 'ba-av ghost', 'aria-hidden': 'true' }));
      const col = h('div', { class: 'ba-col' });
      if (m.from === 'bot' && prevFrom !== 'bot') col.append(h('span', { class: 'ba-name', text: '電路板家教' }));
      col.append(bubble(m));
      row.append(col);
      return row;
    }));
    chatBody.querySelectorAll('.ba-row.pop').forEach((r, i, all) => { if (i < all.length - 3) r.classList.remove('pop'); });
    fill(chatReplies, replies());
    fill(chatHead, chat.n ? `本次 ${chat.c}/${chat.n}` : '線上');
    chatBody.scrollTop = chatBody.scrollHeight;
    QG.setKeys((e) => {
      if (!chat.q || chat.done || !chatBody || !chatBody.isConnected) return false;
      const i = '1234'.indexOf(e.key);
      if (i >= 0) { reply(QG.LETTERS[i]); return true; }
      return false;
    });
  }
  function chatPanel() {
    greet();
    chatBody = h('div', { class: 'ba-chat-body', role: 'log', 'aria-live': 'polite', 'aria-label': '對話' });
    chatReplies = h('div', { class: 'ba-replies', role: 'group', 'aria-label': '回覆' });
    chatHead = h('span', { class: 'ba-chat-state' });
    const panel = h('section', { class: 'ba-chat', 'aria-label': '訊息' },
      h('header', { class: 'ba-chat-head' },
        h('span', { class: 'ba-chat-app' }, icon('baChat'), '訊息'),
        h('span', { class: 'ba-chat-who' }, h('span', { class: 'ba-av small' }, icon('baBot')), h('b', { text: '電路板家教' })),
        chatHead),
      chatBody, chatReplies);
    requestAnimationFrame(drawChat);
    return panel;
  }

  /* ---------------------------------------------------------------- 課程表 */
  let editSched = false;
  let schedEl = null;
  function schedulePanel() {
    const d = data();
    const tps = topics();
    const wd = weekday();
    const cells = DAYS.map((name, i) => {
      const t = d.sched[i];
      const tp = tps.find((x) => x.t === t);
      const isToday = i === wd;
      const body = editSched
        ? h('select', { class: 'ba-sel', 'aria-label': `星期${name}的主題`, onchange: (e) => { const v = e.target.value; if (v) d.sched[i] = v; else delete d.sched[i]; QG.Store.save(); redrawSched(); } },
          h('option', { value: '', text: '（不排課）', selected: !t }), tps.map((x) => h('option', { value: x.t, text: x.t, selected: x.t === t })))
        : tp ? h('div', { class: 'ba-slot', style: `--h:${hue(tp.t)}` }, h('b', { text: tp.t }), h('span', { class: 'ba-slot-bar' }, h('i', { style: `width:${Math.floor(tp.cov * 100)}%` })), h('small', { text: `已練 ${Math.floor(tp.cov * 100)}%` }))
          : h('div', { class: 'ba-slot empty' }, h('small', { text: '自習' }));
      return h('div', { class: 'ba-day' + (isToday ? ' today' : ''), role: 'listitem' },
        h('div', { class: 'ba-day-h' }, h('b', { text: '週' + name }), h('small', { text: DAY_EN[i] }), isToday ? h('span', { class: 'ba-today', text: 'TODAY' }) : null),
        body,
        isToday && tp && !editSched ? h('button', { type: 'button', class: 'ba-btn yellow small', onclick: () => startLesson(tp.t) }, h('span', { text: '上課' })) : null);
    });
    return h('section', { class: 'ba-card ba-sched', 'aria-label': '課程表' },
      h('header', { class: 'ba-card-h' }, h('span', { class: 'ba-card-ico' }, icon('baCal')), h('h2', { text: '課程表' }),
        h('span', { class: 'spacer' }),
        editSched ? h('button', { type: 'button', class: 'ba-btn ghost small', onclick: autoSched }, h('span', { text: '依弱點自動排課' })) : null,
        h('button', { type: 'button', class: 'ba-btn small' + (editSched ? ' blue' : ''), 'aria-pressed': editSched ? 'true' : 'false', onclick: () => { editSched = !editSched; redrawSched(); } },
          h('span', null, icon('baPen'), editSched ? '完成' : '排課'))),
      h('div', { class: 'ba-week', role: 'list' }, cells),
      h('p', { class: 'ba-note', text: editSched ? '每天選一個主題；「依弱點自動排課」會把目前正確率最低、練得最少的 7 個主題排進一週（會覆蓋現有課表）。' : '今天的格子按「上課」會練該主題 10 題（弱點優先）。課表只存在這台裝置的學習紀錄裡。' }));
  }
  function autoSched() {
    const d = data();
    const tps = topics().sort((a, b) => ((a.p.c + 1) / (a.p.n + 2)) * (0.4 + 0.6 * a.cov) - ((b.p.c + 1) / (b.p.n + 2)) * (0.4 + 0.6 * b.cov));
    d.sched = {};
    tps.slice(0, 7).forEach((tp, i) => { d.sched[i] = tp.t; });
    QG.Store.save();
    redrawSched();
  }
  function redrawSched() {
    if (schedEl && schedEl.isConnected) fill(schedEl, schedulePanel());
    if (lessonEl && lessonEl.isConnected) fill(lessonEl, lessonBanner());
    if (chatReplies && chatReplies.isConnected) fill(chatReplies, replies());
  }

  let lessonEl = null;
  function lessonBanner() {
    const wd = weekday();
    const t = data().sched[wd];
    const n = t ? answeredToday(topicIds(t)) : 0;
    return h('section', { class: 'ba-lesson' },
      h('div', { class: 'ba-lesson-tag' }, h('span', { text: `星期${DAYS[wd]}` }), h('small', { text: DAY_EN[wd] })),
      h('div', { class: 'ba-lesson-main' },
        h('p', { class: 'ba-eyebrow', text: '今日課程' }),
        h('h1', { text: t || '今天還沒有排課' }),
        h('p', { class: 'ba-note', text: t ? (n ? `今天已練這個主題 ${n} 題。` : '今天還沒練這個主題。') : '在下方課程表替每天排一個主題，大廳就會提醒你上課。' })),
      t ? h('button', { type: 'button', class: 'ba-btn yellow big', onclick: () => startLesson(t) }, h('span', { text: '上課' }))
        : h('button', { type: 'button', class: 'ba-btn blue big', onclick: () => { editSched = true; redrawSched(); if (schedEl) schedEl.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); } }, h('span', { text: '排課' })));
  }

  /* ---------------------------------------------------------------- 大廳 */
  function tiles() {
    const t = QG.totals();
    const due = QG.dueReviewIds().length;
    const list = [
      ['#practice', 'practice', '任務', `今日 ${today().n} 題`],
      ['#review', 'review', '錯題複習', due ? `待複習 ${due}` : '沒有到期題'],
      ['#exam', 'exam', '模擬考', `已考 ${S().exams.length} 次`],
      ['#browse', 'browse', '題庫', `${QG.fmtNum(QG.QS.length)} 題`],
      ['#stats', 'stats', '我的檔案', `正確率 ${QG.pct(t.c, t.n)}`],
    ];
    return h('nav', { class: 'ba-tiles', 'aria-label': '大廳選單' }, list.map(([href, ic, label, sub]) => h('a', { class: 'ba-tile', href },
      h('span', { class: 'ba-tile-in' }, h('span', { class: 'ba-tile-ico' }, icon(ic)), h('b', { text: label }), h('small', { text: sub }),
        href === '#review' ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null))));
  }
  function baHome() {
    lessonEl = h('div', { class: 'ba-lesson-box' }, lessonBanner());
    schedEl = h('div', { class: 'ba-sched-box' }, schedulePanel());
    return h('div', { class: 'ba-lobby' },
      h('div', { class: 'ba-left' }, chatPanel()),
      h('div', { class: 'ba-center' }, lessonEl, schedEl),
      h('div', { class: 'ba-right' }, tiles()));
  }

  function baStats(base) {
    const el = base.stats();
    const t = QG.totals();
    const d = data();
    const planned = Object.keys(d.sched).length;
    el.prepend(h('section', { class: 'ba-card ba-profile' },
      h('header', { class: 'ba-card-h' }, h('span', { class: 'ba-card-ico' }, icon('stats')), h('h2', { text: '我的檔案' })),
      h('div', { class: 'ba-prof-grid' },
        [[QG.fmtNum(t.n), '累計作答'], [QG.pct(t.c, t.n), '正確率'], [String(QG.streak()), '連續天數'], [`${planned} / 7`, '已排課天數']]
          .map(([v, l]) => h('div', { class: 'ba-prof' }, h('b', { text: v }), h('span', { text: l }))))));
    return el;
  }

  /* ---------------------------------------------------------------- 結算（模擬考結果） */
  function baResult(base) {
    const el = base.result();
    const r = S().lastResult;
    if (!r) return el;
    const grade = r.score >= 90 ? 'S' : r.score >= 75 ? 'A' : r.score >= 60 ? 'B' : 'C';
    el.prepend(h('section', { class: 'ba-result' + (r.score >= 60 ? '' : ' fail') },
      h('div', { class: 'ba-result-band' }, h('span', { text: r.score >= 60 ? 'MISSION COMPLETE' : 'MISSION FAILED' })),
      h('div', { class: 'ba-result-body' },
        h('b', { class: 'ba-grade', 'aria-label': `評等 ${grade}` }, h('span', { text: grade })),
        h('div', null, h('p', { class: 'ba-result-t', text: r.score >= 60 ? '任務完成！' : '再挑戰一次吧' }),
          h('p', { class: 'ba-note', text: `${r.score} 分・答對 ${r.correct} / ${r.total}・評等 S≥90、A≥75、B≥60` })))));
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
    return h('div', { class: 'ba-drillhud', 'aria-hidden': 'true' },
      h('span', { class: 'ba-dh-tag' }, h('span', { text: view === 'review' ? 'REVIEW' : 'MISSION' })),
      h('b', { text: view === 'review' ? '錯題複習' : '任務進行中' }),
      h('span', { class: 'ba-dh-r', text: `今日 ${d.c} / ${d.n}・連續 ${QG.streak()} 天` }));
  }
  function baAfter(view, changed) {
    const page = document.getElementById('app').firstElementChild;
    if ((view === 'practice' || view === 'review') && page && page.querySelector('.qhead')) document.getElementById('app').prepend(drillHud(view));
    if (reduced()) { entryPending = false; firstRender = false; switched = false; return; }
    if (switched) entryPending = false;
    if (page && ((changed && !firstRender) || switched)) page.classList.add('ba-scene');
    firstRender = false;
    switched = false;
    if (entryPending) {
      entryPending = false;
      try { sessionStorage.setItem(ENTRY_KEY, '1'); } catch (e) { /* 無法使用 sessionStorage 時每次載入都播放 */ }
      const o = h('div', { class: 'ba-entry', 'aria-hidden': 'true' }, h('i', { class: 'a' }), h('i', { class: 'b' }), h('i', { class: 'c' }));
      document.body.append(o);
      setTimeout(() => o.remove(), 1100);
    }
  }

  SK.register({
    id: ID, label: '蔚藍檔案風', group: '二次元手遊',
    top: baTop, nav: NAV,
    views: { home: baHome, stats: baStats, result: baResult },
    after: baAfter,
  });
})();
