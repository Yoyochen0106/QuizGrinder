/* LINE 風：聊天 App——左側聊天列表（科目、錯題本、各主題各一個聊天室），右側對話：
 * 出題機器人以左側泡泡出題，下方快速回覆按鈕 A–D；你的答案是右側綠色泡泡（已讀＋時間），
 * 機器人回覆對錯、正解與出處後接著出下一題。未讀數＝該聊天室還沒作答的題數（真實）。
 * 每個聊天室的進度存在 settings.skinData.line，重新打開會接著出題。
 * 只借用版面、互動與配色；不使用貼圖、角色或標誌，頭像一律用 QuizGrinder 的焊墊圖示。 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon, hue } = SK;
  const S = () => QG.S();
  const ID = 'line';
  const LOG_MAX = 12;

  Object.assign(SK.ICONS, {
    'ln-chat': '<path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.5s6-3.5 8.2-6.1C21.6 14 22 12.6 22 11c0-4.4-4.5-8-10-8z"/>',
    'ln-back': '<path d="M15 5l-7 7 7 7"/>',
  });

  /* ---------------------------------------------------------------- 狀態 */
  function store() {
    const set = S().settings;
    if (!set.skinData || typeof set.skinData !== 'object') set.skinData = {};
    const d = set.skinData.line || (set.skinData.line = {});
    if (!d.rooms) d.rooms = {};
    if (!d.cur) d.cur = 's:industry';
    return d;
  }
  const roomState = (key) => { const d = store(); return d.rooms[key] || (d.rooms[key] = { p: 0, log: [] }); };
  const ui = { open: false, kw: '' };
  const mem = { due: null, duePos: 0 };

  function fnv(str) {
    let x = 2166136261;
    for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); }
    return x >>> 0;
  }
  const orderCache = {};
  function ordered(key, ids) {
    if (!orderCache[key] || orderCache[key].length !== ids.length) orderCache[key] = ids.slice().sort((a, b) => fnv(key + a) - fnv(key + b));
    return orderCache[key];
  }

  function rooms() {
    const off = QG.QS.filter((q) => q.official);
    const list = [
      { key: 's:industry', name: 'L11 產業概論', av: 'L11', ids: off.filter((q) => q.s === 'industry').map((q) => q.id) },
      { key: 's:process', name: 'L12 製造概論', av: 'L12', ids: off.filter((q) => q.s === 'process').map((q) => q.id) },
      { key: 'due', name: '錯題本', av: '錯', due: true },
    ];
    QG.TAGS.filter(([t]) => t !== '其他').forEach(([t]) => list.push({ key: 't:' + t, name: t, av: t.replace(/\s/g, '').slice(0, 2), ids: off.filter((q) => q.t.includes(t)).map((q) => q.id) }));
    return list;
  }
  const roomByKey = (key) => rooms().find((r) => r.key === key) || rooms()[0];

  /** 目前這個聊天室要問的題目 id（沒有則 null）與剩餘未作答數 */
  function current(room) {
    if (room.due) {
      const live = QG.dueReviewIds();
      if (!mem.due || mem.duePos >= mem.due.length) { mem.due = live; mem.duePos = 0; }
      while (mem.duePos < mem.due.length && !live.includes(mem.due[mem.duePos])) mem.duePos++;
      if (mem.duePos >= mem.due.length && live.length) { mem.due = live; mem.duePos = 0; }
      return { id: mem.due[mem.duePos] || null, left: live.length, total: live.length };
    }
    const q = ordered(room.key, room.ids);
    const st = roomState(room.key);
    if (st.p > q.length) st.p = q.length;
    return { id: q[st.p] || null, left: q.length - st.p, total: q.length };
  }

  /* ---------------------------------------------------------------- 小工具 */
  function clock(ts) {
    const d = new Date(ts);
    const hh = d.getHours();
    return `${hh < 12 ? '上午' : '下午'} ${hh % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function shortTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const today = QG.dayKey();
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (QG.dayKey(d) === today) return clock(ts);
    if (QG.dayKey(d) === QG.dayKey(y)) return '昨天';
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  function dayLabel(ts) {
    const d = new Date(ts);
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (QG.dayKey(d) === QG.dayKey()) return '今天';
    if (QG.dayKey(d) === QG.dayKey(y)) return '昨天';
    return `${d.getMonth() + 1}/${d.getDate()}（${'日一二三四五六'[d.getDay()]}）`;
  }
  const avatar = (room, cls) => h('span', { class: 'line-av ' + (cls || '') + (room.due ? ' due' : ''), style: `--h:${hue(room.key)}`, 'aria-hidden': 'true', text: room.av });
  const botAv = () => h('span', { class: 'line-av bot', 'aria-hidden': 'true' }, icon('pad'));
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ansText = (q) => (q.all ? '官方釋疑：所有選項均給分' : q.a.map((L) => `(${L}) ${q.o[L]}`).join('、') + (q.a.length > 1 ? '（均給分）' : ''));

  /* ---------------------------------------------------------------- 訊息泡泡 */
  function botBubble(kids, ts, extra) {
    return h('div', { class: 'line-msg bot' + (extra ? ' ' + extra : '') }, botAv(),
      h('div', { class: 'line-col' }, h('div', { class: 'line-bub' }, kids)), ts ? h('span', { class: 'line-meta', text: clock(ts) }) : null);
  }
  function questionBubbles(q, ts) {
    const out = [];
    if (q.prev && QG.QMAP.get(q.prev)) out.push(botBubble([h('span', { class: 'line-small', text: '（承上題）' + QG.QMAP.get(q.prev).q })], null, 'cont'));
    out.push(botBubble([
      h('span', { class: 'line-qsrc', text: `${QG.SUBJ_CODE[q.s]}・${QG.srcLabel(q.src[0])}${q.src.length > 1 ? `・考過 ${q.src.length} 次` : ''}` }),
      h('span', { class: 'line-qtext', text: q.q }),
      h('span', { class: 'line-opts' }, QG.LETTERS.map((L) => h('span', { class: 'line-opt' }, h('b', { text: L }), h('span', { text: q.o[L] })))),
    ], q.fig ? null : ts));
    if (q.fig) out.push(h('div', { class: 'line-msg bot cont' }, h('span', { class: 'line-av-sp' }), h('figure', { class: 'line-img' }, h('img', { src: q.fig, alt: '題目附圖', loading: 'lazy' })), ts ? h('span', { class: 'line-meta', text: clock(ts) }) : null));
    return out;
  }
  function userBubble(q, L, ts, read) {
    return h('div', { class: 'line-msg me' },
      h('span', { class: 'line-meta' }, read ? h('span', { class: 'line-read', text: '已讀' }) : null, h('span', { text: clock(ts) })),
      h('div', { class: 'line-bub', text: `${L}. ${q.o[L]}` }));
  }
  function replyBubble(q, L, ok, ts) {
    return botBubble([
      h('strong', { class: 'line-verdict ' + (ok ? 'ok' : 'ng'), text: ok ? '✓ 答對了！' : '✗ 答錯了，已加入錯題本' }),
      h('span', null, '正解：', ansText(q)),
      q.x ? h('span', { class: 'line-small', text: q.x }) : null,
      h('span', { class: 'line-small', text: '出處：' + q.src.map(QG.srcLabel).join('、') }),
    ], ts, 'cont');
  }
  function sysChip(text) { return h('div', { class: 'line-sys' }, h('span', { text })); }

  /* ---------------------------------------------------------------- 畫面 */
  function home() {
    const d = store();
    const all = rooms();
    const wide = matchMedia('(min-width: 721px)').matches;
    const curRoom = roomByKey(d.cur);
    const showRoom = wide || ui.open;
    const list = h('div', { class: 'line-rows', role: 'list' });
    const roomEl = h('section', { class: 'line-room', 'aria-label': '對話' });

    const drawList = () => {
      const kw = ui.kw.trim().toLowerCase();
      const items = all.filter((r) => !kw || r.name.toLowerCase().includes(kw)).map((r) => {
        const st = roomState(r.key);
        const last = st.log[st.log.length - 1];
        return { r, st, last, ts: last ? last[3] : 0 };
      }).sort((a, b) => b.ts - a.ts);
      fill(list, items.map(({ r, st, last, ts }) => {
        const cur = current(r);
        const q = cur.id ? QG.QMAP.get(cur.id) : null;
        let preview;
        if (!last && !st.p) preview = r.due ? (cur.left ? `有 ${cur.left} 題錯題到期，點開開始複習` : '目前沒有到期的錯題') : `${cur.total} 題，點開開始練習`;
        else if (q) preview = q.q;
        else preview = r.due ? '目前沒有到期的錯題' : '這個聊天室的題目都答完了';
        const active = showRoom && d.cur === r.key;
        return h('button', { type: 'button', role: 'listitem', class: 'line-row' + (active ? ' on' : ''), 'aria-current': active ? 'true' : null,
          onclick: () => { d.cur = r.key; ui.open = true; QG.Store.save(); QG.render(); } },
          avatar(r),
          h('span', { class: 'line-row-text' }, h('span', { class: 'line-row-name' }, h('strong', { text: r.name }), r.due ? null : h('span', { class: 'line-row-n', text: `(${cur.total})` })),
            h('span', { class: 'line-row-prev', text: preview })),
          h('span', { class: 'line-row-side' }, h('span', { class: 'line-row-time', text: shortTime(ts) }),
            cur.left ? h('span', { class: 'line-unread', title: `還有 ${cur.left} 題未作答`, 'aria-label': `${cur.left} 題未作答`, text: cur.left > 999 ? '999+' : String(cur.left) }) : null));
      }));
    };

    function drawRoom() {
      const room = curRoom;
      const st = roomState(room.key);
      const msgs = h('div', { class: 'line-msgs', role: 'log', 'aria-live': 'polite' });
      const quick = h('div', { class: 'line-quick', role: 'group', 'aria-label': '快速回覆' });
      const sub = h('span', { class: 'line-room-sub' });
      let busy = false;
      // 歷史紀錄
      let lastDay = '';
      const pushDay = (ts) => { const k = QG.dayKey(new Date(ts)); if (k !== lastDay) { lastDay = k; msgs.append(sysChip(dayLabel(ts))); } };
      if (!st.log.length) {
        pushDay(Date.now());
        msgs.append(botBubble([h('strong', { text: `歡迎來到「${room.name}」` }),
          h('span', { text: room.due ? '這裡會依序出到期的錯題。答對會升一盒、隔幾天再複習；答錯會留在今天。' : `這裡有 ${current(room).total} 題官方試題，我會一題一題問你，用下方的按鈕回答就可以。進度會自動記住。` })], null));
      }
      st.log.forEach(([id, L, ok, ts]) => {
        const q = QG.QMAP.get(id);
        if (!q) return;
        pushDay(ts);
        questionBubbles(q, null).forEach((m) => msgs.append(m));
        msgs.append(userBubble(q, L, ts, true), replyBubble(q, L, !!ok, ts));
      });

      const scrollDown = (smooth) => requestAnimationFrame(() => msgs.scrollTo({ top: msgs.scrollHeight, behavior: smooth && !reduce() ? 'smooth' : 'auto' }));

      const ask = () => {
        const cur = current(room);
        sub.textContent = room.due ? `到期 ${cur.left} 題` : `已答 ${cur.total - cur.left} / ${cur.total}`;
        if (!cur.id) {
          pushDay(Date.now());
          const doneN = st.log.filter((x) => x[2]).length;
          msgs.append(botBubble([h('strong', { text: room.due ? '錯題都複習完了！' : '這個聊天室的題目都答完了！' }),
            h('span', { text: room.due ? '目前沒有到期的錯題，明天再來看看。' : `最近 ${st.log.length} 題答對 ${doneN} 題。要再從頭來一輪嗎？` })], Date.now()));
          fill(quick, room.due
            ? h('a', { class: 'line-qr', href: '#practice', text: '去練習新題目' })
            : h('button', { type: 'button', class: 'line-qr', text: '從頭再來一輪', onclick: () => { st.p = 0; QG.Store.save(); QG.render(); } }));
          QG.setKeys(null);
          scrollDown(true);
          return;
        }
        const q = QG.QMAP.get(cur.id);
        pushDay(Date.now());
        questionBubbles(q, Date.now()).forEach((m) => msgs.append(m));
        fill(quick, QG.LETTERS.map((L, i) => h('button', { type: 'button', class: 'line-qr', 'aria-label': `回答 ${L}：${q.o[L]}`, title: `${L}. ${q.o[L]}（按 ${i + 1} 或 ${L}）`, onclick: () => answer(q, L) },
          h('b', { text: L }), h('span', { text: q.o[L] }))));
        QG.setKeys((e) => {
          const k = e.key.toUpperCase();
          const i = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : QG.LETTERS.indexOf(k);
          if (i >= 0 && !busy) { answer(q, QG.LETTERS[i]); return true; }
          return false;
        });
        scrollDown(true);
      };

      function answer(q, L) {
        if (busy) return;
        busy = true;
        const ok = !!(q.all || q.a.includes(L));
        const ts = Date.now();
        QG.record(q.id, ok, { review: !!room.due });
        if (room.due) mem.duePos++;
        else st.p++;
        st.log.push([q.id, L, ok ? 1 : 0, ts]);
        if (st.log.length > LOG_MAX) st.log.splice(0, st.log.length - LOG_MAX);
        QG.Store.save();
        QG.updateBadges();
        fill(quick);
        const mine = userBubble(q, L, ts, false);
        msgs.append(mine);
        scrollDown(true);
        const fast = reduce();
        setTimeout(() => {
          const meta = mine.querySelector('.line-meta');
          if (meta) meta.prepend(h('span', { class: 'line-read', text: '已讀' }));
          const typing = h('div', { class: 'line-msg bot cont' }, botAv(), h('div', { class: 'line-bub line-typing', 'aria-label': '輸入中' }, h('i'), h('i'), h('i')));
          msgs.append(typing);
          scrollDown(true);
          setTimeout(() => {
            typing.replaceWith(replyBubble(q, L, ok, Date.now()));
            drawList();
            setTimeout(() => { busy = false; if (roomEl.isConnected) ask(); }, fast ? 0 : 450);
          }, fast ? 0 : 650);
        }, fast ? 0 : 350);
      }

      fill(roomEl,
        h('header', { class: 'line-room-head' },
          h('button', { type: 'button', class: 'line-back', 'aria-label': '回聊天列表', onclick: () => { ui.open = false; QG.render(); } }, icon('ln-back')),
          avatar(room, 'sm'),
          h('span', { class: 'line-room-title' }, h('strong', { text: room.name }), sub),
          h('span', { class: 'spacer' }),
          room.due ? h('a', { class: 'line-head-btn', href: '#review', text: '錯題本' })
            : h('button', { type: 'button', class: 'line-head-btn', title: '用一般練習畫面做這個聊天室的題目', onclick: () => QG.startCustomPractice(room.ids, room.name) }, '專心練習')),
        msgs,
        h('footer', { class: 'line-foot' }, quick));
      ask();
      scrollDown(false);
    }

    const search = h('input', { type: 'search', id: 'line-q', placeholder: '搜尋聊天室', value: ui.kw, 'aria-label': '搜尋聊天室' });
    search.addEventListener('input', () => { ui.kw = search.value; drawList(); });
    if (showRoom) drawRoom();
    drawList();
    document.documentElement.classList.toggle('line-room-open', !wide && ui.open);
    return h('div', { class: 'line-app' + (ui.open ? ' open' : '') + (showRoom ? ' has-room' : '') },
      h('aside', { class: 'line-list', 'aria-label': '聊天列表' },
        h('div', { class: 'line-list-head' }, h('h1', { text: '聊天' }), h('span', { class: 'line-dim', text: `${all.length} 個聊天室` })),
        h('label', { class: 'line-search' }, icon('search'), search),
        list),
      showRoom ? roomEl : h('section', { class: 'line-room empty' }));
  }

  /* ---------------------------------------------------------------- 外框 */
  const NAV = [
    { v: 'home', label: '聊天', icon: 'ln-chat' },
    { v: 'practice', label: '練習', icon: 'practice' },
    { v: 'review', label: '錯題本', icon: 'review', badge: true },
    { v: 'exam', label: '模擬考', icon: 'exam' },
    { v: 'stats', label: '統計', icon: 'stats' },
  ];
  const TITLE = { home: '聊天', practice: '練習', review: '錯題本', exam: '模擬考', result: '考試結果', browse: '題庫', stats: '統計' };

  function top(view) {
    return h('div', { class: 'sk-top line-top' },
      h('a', { class: 'line-logo', href: '#home', 'aria-label': 'QuizGrinder 首頁' }, icon('pad')),
      h('strong', { class: 'line-top-title', text: TITLE[view] || '' }),
      h('div', { class: 'sk-right' },
        h('a', { class: 'sk-iconbtn', href: '#browse', 'aria-label': '題庫搜尋', title: '題庫搜尋' }, icon('search')),
        h('a', { class: 'sk-iconbtn', href: '#review', 'aria-label': '錯題本', title: '錯題本' }, icon('review'), h('span', { class: 'badge', 'data-badge': 'review', hidden: true }))));
  }

  function side(view) {
    return h('nav', { class: 'line-rail', 'aria-label': '主要功能' },
      h('a', { class: 'line-rail-me', href: '#stats', 'aria-label': '我的統計', title: '我的統計' }, icon('pad')),
      NAV.concat([{ v: 'browse', label: '題庫', icon: 'browse' }]).map((n) => h('a', { class: 'line-rail-item', href: '#' + n.v, title: n.label, 'aria-label': n.label,
        'aria-current': SK.isCurrent(view, n.v) ? 'page' : null }, icon(n.icon), n.badge ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null)));
  }

  const prevBefore = QG.hooks.beforeRender;
  QG.hooks.beforeRender = (view) => {
    prevBefore(view);
    if (SK.skin() !== ID || view !== 'home') document.documentElement.classList.remove('line-room-open');
  };
  window.addEventListener('resize', () => {
    if (SK.skin() !== ID) return;
    const wide = matchMedia('(min-width: 721px)').matches;
    document.documentElement.classList.toggle('line-room-open', !wide && ui.open && QG.currentView === 'home');
  });

  SK.register({
    id: ID, label: 'LINE 風', group: '社群內容',
    top, side, nav: NAV,
    views: { home },
  });
})();
