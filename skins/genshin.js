/* 原神風：奇幻冒險 UI——羊皮紙面板與金色描邊、右上角圓形選單鈕。
 *   首頁＝「知識大陸」世界地圖：每個區域是一個主題，探索度＝該主題已練比例；點區域開啟區域面板，「傳送」直接練該主題
 *   每日委託：每天依弱點主題固定選出 4 題（以日期為種子），今天答過就算完成
 *   冒險等級：依累積答對次數計算
 * 只借用版面、互動與配色；地圖、圖示全是原創 CSS／SVG 圖形，不使用任何角色、標誌或遊戲專有名詞。 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon, hue } = SK;
  const S = () => QG.S();
  const ID = 'genshin';

  SK.ICONS.gsWay = SK.ICONS.gsWay || '<path d="M12 2l5 7-5 13-5-13z"/><path d="M7 9h10"/>';
  SK.ICONS.gsBook = SK.ICONS.gsBook || '<path d="M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z"/><path d="M20 4h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z"/>';
  SK.ICONS.gsMark = SK.ICONS.gsMark || '<path d="M12 2l9 10-9 10-9-10z"/><path d="M12 7v6M12 16v.5"/>';
  SK.ICONS.gsCompass = SK.ICONS.gsCompass || '<circle cx="12" cy="12" r="9"/><path d="M12 5l2 7-2 7-2-7z"/>';
  SK.ICONS.gsCheck = SK.ICONS.gsCheck || '<path d="M5 12.5l4.5 4.5L19 7.5"/>';

  /* ---------------------------------------------------------------- 資料 */
  function data() {
    const st = S().settings;
    if (!st.skinData) st.skinData = {};
    return st.skinData[ID] || (st.skinData[ID] = {});
  }
  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  function hash(str) { let x = 2166136261; for (const ch of str) { x ^= ch.codePointAt(0); x = Math.imul(x, 16777619) >>> 0; } return x; }
  function rng(seed) { let x = seed >>> 0 || 1; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; }

  function regions() {
    const list = QG.TAGS.filter(([t]) => t !== '其他').map(([t]) => {
      const ids = QG.QS.filter((q) => q.t.includes(t)).map((q) => q.id);
      const p = SK.progressOf(ids);
      return { t, ids, p, cov: ids.length ? p.seen / ids.length : 0, acc: p.n ? p.c / p.n : 0 };
    });
    const max = Math.max(...list.map((r) => r.ids.length));
    list.forEach((r) => { r.size = 0.72 + 0.5 * Math.sqrt(r.ids.length / max); });
    return list;
  }
  /** 弱點分數：正確率（拉普拉斯平滑）低、探索度低的主題分數高 */
  const weakness = (r) => 1 - ((r.p.c + 1) / (r.p.n + 2)) * (0.4 + 0.6 * r.cov);

  /** 冒險等級：第 L 級升到 L+1 需要 10 + 2L 次答對，上限 60 */
  function rank() {
    const xp = QG.totals().c;
    let L = 1, base = 0;
    while (L < 60 && xp >= base + 10 + 2 * L) { base += 10 + 2 * L; L++; }
    const span = 10 + 2 * L;
    return { L, xp, into: L >= 60 ? span : xp - base, span };
  }

  /** 每日委託：今天第一次開啟時以日期為種子，從 4 個最弱主題各選 1 題，存進 skinData 固定一整天 */
  function commissions() {
    const d = data();
    const day = QG.dayKey();
    if (!d.daily || d.daily.day !== day || !Array.isArray(d.daily.ids) || !d.daily.ids.length || d.daily.ids.some((id) => !QG.QMAP.has(id))) {
      const rand = rng(hash('commission:' + day));
      const st = S().q;
      const score = (id) => { const r = st[id]; if (!r || !(r.c + r.w)) return 0.6; return (r.w + 1) / (r.c + r.w + 2) + (r.b ? 0.3 : 0); };
      const t0 = startOfToday();
      const tps = regions().sort((a, b) => weakness(b) - weakness(a) || a.t.localeCompare(b.t));
      const ids = [], topics = [];
      for (const tp of tps) {
        if (ids.length >= 4) break;
        // 今天已經答過的題目不選，避免委託一出現就是完成狀態
        const pool = tp.ids.filter((id) => !ids.includes(id) && !QG.QMAP.get(id).prev && !(st[id] && st[id].t >= t0));
        if (!pool.length) continue;
        const best = Math.max(...pool.map(score));
        const top = pool.filter((id) => score(id) >= best - 0.05).sort();
        ids.push(top[Math.floor(rand() * top.length)]);
        topics.push(tp.t);
      }
      d.daily = { day, ids, topics };
      QG.Store.save();
    }
    const t0 = startOfToday();
    return d.daily.ids.map((id, i) => {
      const q = QG.QMAP.get(id);
      const r = S().q[id];
      const topic = (d.daily.topics && d.daily.topics[i]) || q.t.find((t) => t !== '其他') || '其他';
      return { q, topic, done: !!(r && r.t >= t0 && (r.c + r.w)) };
    });
  }

  /* ---------------------------------------------------------------- 頂部列 */
  const NAV = [
    { v: 'home', label: '地圖', icon: 'gsCompass' },
    { v: 'practice', label: '冒險', icon: 'practice' },
    { v: 'review', label: '錯題', icon: 'review', badge: true },
    { v: 'exam', label: '挑戰', icon: 'exam' },
    { v: 'browse', label: '圖鑑', icon: 'gsBook' },
    { v: 'stats', label: '手冊', icon: 'stats' },
  ];

  function arBadge(L) {
    return h('span', { class: 'gs-ar', 'aria-hidden': 'true' }, h('b', { text: String(L) }));
  }

  function gsTop(view) {
    const ar = rank();
    return h('div', { class: 'sk-top gs-top' },
      SK.brand('QuizGrinder'),
      h('a', { class: 'gs-rank', href: '#stats', 'aria-label': `冒險等級 ${ar.L}` }, arBadge(ar.L),
        h('span', { class: 'gs-rank-info' }, h('span', { class: 'gs-rank-name', text: `冒險等級 ${ar.L}` }),
          h('span', { class: 'gs-rank-bar' }, h('i', { style: `width:${Math.round((ar.into / ar.span) * 100)}%` })))),
      h('nav', { class: 'gs-circles', 'aria-label': '主要功能' }, NAV.map((n) => h('a', {
        class: 'gs-circle', href: '#' + n.v, title: n.label, 'aria-label': n.label, 'aria-current': SK.isCurrent(view, n.v) ? 'page' : null,
      }, icon(n.icon), h('span', { class: 'gs-circle-label', text: n.label }), n.badge ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null))));
  }
  function refreshTop() {
    const top = document.getElementById('topbar');
    if (top && SK.skin() === ID) fill(top, gsTop(QG.currentView));
    QG.updateBadges();
  }

  /* ---------------------------------------------------------------- 地圖 */
  // 橫式 6/5/5、直式 4×4 的格位；再以主題名稱雜湊做小幅偏移，讓區域不像棋盤
  function slots(n, rows, wide) {
    const out = [];
    let k = 0;
    rows.forEach((cnt, ri) => {
      for (let i = 0; i < cnt && k < n; i++, k++) {
        const x = wide ? 9 + (i + (cnt < 6 ? 0.5 : 0)) * (82 / 5) : 13 + (i + (ri % 2 ? 0.35 : 0)) * 22.5;
        const y = wide ? 17 + ri * 32 : 11 + ri * 24.5;
        out.push([x, y]);
      }
    });
    return out;
  }
  const jitter = (t, salt, amp) => ((hash(t + salt) % 1000) / 1000 - 0.5) * amp;
  /** 以主題名稱為種子產生不規則海岸線（clip-path 多邊形） */
  function coast(t) {
    const rand = rng(hash('coast:' + t));
    const n = 18;
    const amp = [];
    for (let i = 0; i < n; i++) amp.push(0.64 + rand() * 0.36);
    const pts = amp.map((a, i) => {
      const s = (a + amp[(i + 1) % n] + amp[(i + n - 1) % n]) / 3; // 平滑
      const ang = (i / n) * Math.PI * 2;
      return `${(50 + Math.cos(ang) * 50 * s).toFixed(1)}% ${(50 + Math.sin(ang) * 50 * s).toFixed(1)}%`;
    });
    return `polygon(${pts.join(',')})`;
  }
  function roads(pts) {
    const span = document.createElement('span');
    span.className = 'gs-roads';
    span.setAttribute('aria-hidden', 'true');
    const d = pts.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
    span.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${d}" /></svg>`;
    return span;
  }

  let sel = null;
  function mapView(regs, onPick) {
    const wide = slots(regs.length, [6, 5, 5], true);
    const tall = slots(regs.length, [4, 4, 4, 4], false);
    regs.forEach((r, i) => {
      r.x = wide[i][0] + jitter(r.t, 'x', 4); r.y = wide[i][1] + jitter(r.t, 'y', 6);
      r.mx = tall[i][0] + jitter(r.t, 'mx', 3); r.my = tall[i][1] + jitter(r.t, 'my', 3);
    });
    const total = regs.reduce((a, r) => a + r.ids.length, 0);
    const seen = regs.reduce((a, r) => a + r.p.seen, 0);
    return h('section', { class: 'gs-frame gs-mapwrap', 'aria-label': '知識大陸地圖：每個區域是一個主題' },
      h('header', { class: 'gs-maphead' },
        h('h1', { class: 'gs-title', text: '知識大陸' }),
        h('span', { class: 'gs-maptotal' }, '整體探索度 ', h('b', { text: Math.floor((seen / total) * 100) + '%' }))),
      h('div', { class: 'gs-map' },
        h('div', { class: 'gs-roads-w' }, roads(regs.map((r) => [r.x, r.y]))),
        h('div', { class: 'gs-roads-t' }, roads(regs.map((r) => [r.mx, r.my]))),
        h('span', { class: 'gs-compass', 'aria-hidden': 'true' }, h('i'), h('b', { text: 'N' })),
        regs.map((r) => {
          const pctNum = Math.floor(r.cov * 100);
          return h('button', {
            type: 'button', class: 'gs-region' + (sel === r.t ? ' sel' : '') + (r.p.seen ? ' lit' : ''),
            style: `--x:${r.x.toFixed(1)}%;--y:${r.y.toFixed(1)}%;--mx:${r.mx.toFixed(1)}%;--my:${r.my.toFixed(1)}%;--h:${hue(r.t)};--s:${r.size.toFixed(2)};--fog:${(0.8 * (1 - r.cov)).toFixed(2)};--coast:${coast(r.t)}`,
            'aria-pressed': sel === r.t ? 'true' : 'false', 'aria-label': `${r.t}，探索度 ${pctNum}%`,
            onclick: () => onPick(r),
          },
          h('span', { class: 'gs-landwrap' }, h('span', { class: 'gs-land' }, h('span', { class: 'gs-fog' }))),
          h('span', { class: 'gs-way' }),
          h('span', { class: 'gs-pct', text: pctNum + '%' }),
          h('span', { class: 'gs-rname', text: r.t }));
        })),
      h('p', { class: 'gs-legend' }, h('span', { class: 'gs-way demo lit' }), '已啟動的傳送錨點（練過該主題）', h('span', { class: 'gs-way demo' }), '未啟動・雲霧越淡表示探索度越高'));
  }

  function regionPanel(r) {
    const pctNum = Math.floor(r.cov * 100);
    const unseen = r.ids.filter((id) => { const x = S().q[id]; return !x || !(x.c + x.w); });
    const wrong = r.ids.filter((id) => { const x = S().q[id]; return x && x.b; });
    return h('section', { class: 'gs-panel gs-regpanel', 'aria-live': 'polite' },
      h('header', { class: 'gs-phead' }, h('span', { class: 'gs-dia', 'aria-hidden': 'true' }), h('h2', { text: r.t })),
      h('div', { class: 'gs-pbody' },
        h('div', { class: 'gs-explore' },
          h('span', { class: 'gs-ring', style: `--p:${pctNum}`, 'aria-hidden': 'true' }, h('b', { text: pctNum + '%' })),
          h('div', { class: 'gs-explore-txt' },
            h('p', { class: 'gs-label', text: '探索度' }),
            h('p', null, h('b', { text: `${r.p.seen} / ${r.ids.length}` }), ' 題已練'),
            h('p', null, '正確率 ', h('b', { text: r.p.n ? QG.pct(r.p.c, r.p.n) : '—' })),
            h('p', { class: 'gs-way-state' + (r.p.seen ? ' lit' : '') }, h('span', { class: 'gs-way demo' + (r.p.seen ? ' lit' : '') }), r.p.seen ? '傳送錨點已啟動' : '傳送錨點未啟動'))),
        h('div', { class: 'gs-btns' },
          h('button', { type: 'button', class: 'gs-btn primary', onclick: () => QG.startCustomPractice(QG.buildQueue(r.ids, 'weak'), `傳送：${r.t}`) },
            h('span', { class: 'gs-btn-ico' }, icon('gsWay')), '傳送'),
          unseen.length ? h('button', { type: 'button', class: 'gs-btn', onclick: () => QG.startCustomPractice(unseen, `探索：${r.t}`) },
            h('span', { class: 'gs-btn-ico' }, icon('gsCompass')), `探索未練（${unseen.length}）`) : null,
          wrong.length ? h('button', { type: 'button', class: 'gs-btn', onclick: () => QG.startReview(wrong) },
            h('span', { class: 'gs-btn-ico' }, icon('review')), `清除錯題（${wrong.length}）`) : null)));
  }

  /* ---------------------------------------------------------------- 每日委託 */
  function commissionPanel() {
    const list = commissions();
    const done = list.filter((c) => c.done).length;
    const panel = h('section', { class: 'gs-panel gs-daily' },
      h('header', { class: 'gs-phead' }, h('span', { class: 'gs-dia', 'aria-hidden': 'true' }), h('h2', { text: '每日委託' }),
        h('span', { class: 'gs-count', text: `${done} / ${list.length}` })),
      h('div', { class: 'gs-pbody' },
        h('ol', { class: 'gs-comms' }, list.map((c, i) => h('li', null, h('button', {
          type: 'button', class: 'gs-comm' + (c.done ? ' done' : ''), onclick: () => openCommission(c, i),
          'aria-label': `委託 ${i + 1}：${c.topic}${c.done ? '，已完成' : ''}`,
        },
        h('span', { class: 'gs-comm-ico', 'aria-hidden': 'true' }, icon(c.done ? 'gsCheck' : 'gsMark')),
        h('span', { class: 'gs-comm-txt' }, h('b', { text: `委託・${c.topic}` }), h('span', { text: c.q.q.length > 34 ? c.q.q.slice(0, 34) + '…' : c.q.q })),
        h('span', { class: 'gs-comm-state', text: c.done ? '已完成' : '前往' }))))),
        h('p', { class: 'gs-note', text: done >= list.length ? '今日委託已全部完成，明天會依你的弱點主題換一組。' : '依你目前最弱的 4 個主題每天選出 4 題；今天作答過（不論對錯）即完成。' })));
    return panel;
  }

  function openCommission(c, i) {
    let m = null;
    const fb = h('div', { class: 'gs-fb', role: 'status' });
    const opts = SK.answerOptions(c.q, { cls: 'gs-ans', onDone: (ok) => {
      fill(fb, h('p', { class: 'gs-fb-head ' + (ok ? 'ok' : 'ng'), text: ok ? '委託完成：回答正確' : '委託完成：已將本題加入錯題本' }),
        c.q.x ? h('p', { class: 'gs-fb-x', text: c.q.x }) : null,
        h('button', { type: 'button', class: 'gs-btn primary', onclick: () => m.close() }, h('span', { class: 'gs-btn-ico' }, icon('gsCheck')), '確認'));
      const b = fb.querySelector('button'); if (b) b.focus({ preventScroll: true });
      redrawHome();
    } });
    m = SK.modal(h('div', { class: 'gs-dialog gs-frame' },
      h('header', { class: 'gs-dhead' }, h('span', { class: 'gs-label', text: `每日委託 ${i + 1} / 4` }), h('h2', { text: c.topic })),
      h('div', { class: 'gs-dbody' },
        h('p', { class: 'gs-src', text: c.q.src.map(QG.srcLabel).join('・') }),
        h('p', { class: 'gs-qtext', text: c.q.q }),
        c.q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: c.q.fig, alt: '題目附圖', loading: 'lazy' })) : null,
        opts, fb)), 'gs-modal', () => QG.setKeys(null));
    SK.setOpenModal(m);
    QG.setKeys((e) => { const k = '1234'.indexOf(e.key); if (k >= 0) { opts.pick(k); return true; } return false; });
  }

  /* ---------------------------------------------------------------- 首頁 */
  let homeEl = null;
  function redrawHome() {
    if (!homeEl || !homeEl.isConnected) return;
    fill(homeEl, ...homeParts());
    refreshTop();
  }
  function homeParts() {
    const regs = regions();
    if (!sel || !regs.some((r) => r.t === sel)) sel = regs[0].t;
    const ar = rank();
    const regBox = h('div', { class: 'gs-regbox' }, regionPanel(regs.find((r) => r.t === sel)));
    const pick = (r) => {
      sel = r.t;
      homeEl.querySelectorAll('.gs-region').forEach((b) => { const on = b.getAttribute('aria-label').startsWith(r.t + '，'); b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      fill(regBox, regionPanel(r));
      if (matchMedia('(max-width: 960px)').matches) regBox.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    };
    const due = QG.dueReviewIds().length;
    return [
      mapView(regs, pick),
      h('aside', { class: 'gs-aside' },
        h('section', { class: 'gs-panel gs-arpanel' },
          h('div', { class: 'gs-arrow' }, arBadge(ar.L),
            h('div', { class: 'gs-arinfo' },
              h('p', { class: 'gs-label', text: '冒險等級' }),
              h('span', { class: 'gs-arbar' }, h('i', { style: `width:${Math.round((ar.into / ar.span) * 100)}%` })),
              h('p', { class: 'gs-note', text: ar.L >= 60 ? `已達最高等級・累積答對 ${QG.fmtNum(ar.xp)} 次` : `經驗 ${ar.into} / ${ar.span}・每答對 1 題 +1 經驗` }))),
          h('div', { class: 'gs-quick' },
            h('a', { class: 'gs-btn primary', href: '#practice' }, h('span', { class: 'gs-btn-ico' }, icon('practice')), '繼續冒險'),
            h('a', { class: 'gs-btn', href: '#review' }, h('span', { class: 'gs-btn-ico' }, icon('review')), due ? `錯題（${due}）` : '錯題'))),
        regBox,
        commissionPanel()),
    ];
  }
  function gsHome() {
    homeEl = h('div', { class: 'gs-home' });
    fill(homeEl, ...homeParts());
    return homeEl;
  }

  /* ---------------------------------------------------------------- 冒險手冊（統計頁） */
  function gsStats(base) {
    const el = base.stats();
    const regs = regions();
    const ar = rank();
    const total = regs.reduce((a, r) => a + r.ids.length, 0);
    const seen = regs.reduce((a, r) => a + r.p.seen, 0);
    const list = commissions();
    el.prepend(h('section', { class: 'gs-panel gs-handbook' },
      h('header', { class: 'gs-phead' }, h('span', { class: 'gs-dia', 'aria-hidden': 'true' }), h('h2', { text: '冒險手冊' })),
      h('div', { class: 'gs-pbody gs-hb-grid' },
        [[String(ar.L), '冒險等級'], [Math.floor((seen / total) * 100) + '%', '整體探索度'],
          [`${list.filter((c) => c.done).length}/4`, '今日委託'], [String(regs.filter((r) => r.p.seen).length) + '/' + regs.length, '傳送錨點'],
          [String(QG.streak()), '連續天數'], [QG.fmtNum(ar.xp), '累積答對']].map(([v, l]) => h('div', { class: 'gs-hb' }, h('b', { text: v }), h('span', { text: l }))))));
    return el;
  }

  /* ---------------------------------------------------------------- 結算（模擬考結果） */
  function gsResult(base) {
    const el = base.result();
    const r = S().lastResult;
    if (!r) return el;
    const stars = r.score >= 85 ? 3 : r.score >= 70 ? 2 : r.score >= 60 ? 1 : 0;
    el.prepend(h('section', { class: 'gs-clear' + (stars ? '' : ' fail') },
      h('p', { class: 'gs-clear-sub', text: stars ? '挑戰完成' : '挑戰結束' }),
      h('h1', { class: 'gs-clear-title', text: `${r.score} 分` }),
      h('div', { class: 'gs-clear-stars', role: 'img', 'aria-label': `${stars} 顆星（60／70／85 分各 1 顆）` },
        [1, 2, 3].map((i) => h('span', { class: 'gs-star' + (i <= stars ? ' on' : ''), style: `--d:${i * 0.18}s` }))),
      h('p', { class: 'gs-clear-note', text: `答對 ${r.correct} / ${r.total}・冒險經驗 +${r.correct}` })));
    return el;
  }

  /* ---------------------------------------------------------------- 進場與換頁轉場 */
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 進場（載入）動畫：每個分頁工作階段第一次以本風格載入時播放一次
  const ENTRY_KEY = 'qg-entry-' + ID;
  let entryPending = (() => { try { return !sessionStorage.getItem(ENTRY_KEY); } catch (e) { return true; } })();
  let firstRender = true; // 頁面剛載入的第一次繪製不做換頁動畫
  let switched = false; // 從切換列換到本風格時只做換頁動畫（完整進場動畫留給頁面載入）
  document.addEventListener('change', (e) => { if (e.target && e.target.id === 'sk-select') switched = true; }, true);
  document.addEventListener('click', (e) => { if (e.target && e.target.closest && e.target.closest('.sk-bar-step')) switched = true; }, true);
  function drillHud(view) {
    const ar = rank();
    const d = S().days[QG.dayKey()] || { n: 0, c: 0 };
    return h('div', { class: 'gs-drillhud', 'aria-hidden': 'true' },
      h('span', { class: 'gs-dia' }), h('b', { text: view === 'review' ? '清除錯題' : '冒險進行中' }),
      h('span', { class: 'gs-dh-sep' }), h('span', { text: `冒險等級 ${ar.L}` }),
      h('span', { class: 'gs-dh-bar' }, h('i', { style: `width:${Math.round((ar.into / ar.span) * 100)}%` })),
      h('span', { class: 'gs-dh-r', text: `今日 ${d.c} / ${d.n}` }));
  }
  function gsAfter(view, changed) {
    const page = document.getElementById('app').firstElementChild;
    if ((view === 'practice' || view === 'review') && page && page.querySelector('.qhead')) document.getElementById('app').prepend(drillHud(view));
    if (reduced()) { entryPending = false; firstRender = false; switched = false; return; }
    if (switched) entryPending = false;
    if (page && ((changed && !firstRender) || switched)) page.classList.add('gs-scene');
    firstRender = false;
    switched = false;
    if (entryPending) {
      entryPending = false;
      try { sessionStorage.setItem(ENTRY_KEY, '1'); } catch (e) { /* 無法使用 sessionStorage 時每次載入都播放 */ }
      const o = h('div', { class: 'gs-entry', 'aria-hidden': 'true' }, h('span', { class: 'gs-entry-star' }), h('span', { class: 'gs-entry-ring' }));
      document.body.append(o);
      setTimeout(() => o.remove(), 1100);
    }
  }

  SK.register({
    id: ID, label: '原神風', group: '二次元手遊',
    top: gsTop, nav: NAV.filter((n) => n.v !== 'browse'),
    views: { home: gsHome, stats: gsStats, result: gsResult },
    after: gsAfter,
  });
})();
