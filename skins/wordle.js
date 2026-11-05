/* QuizGrinder 版面風格：Wordle 風（每日 5 題）
 *
 * 借用：置中窄欄、頂部標題列（說明／統計圖示）、方格棋盤翻牌、統計對話框與分享格子。
 * 每天依日期（QG.dayKey）雜湊挑出 5 題官方題，所有人同一天拿到同一組；每題當天只能作答一次。
 * 每一列是一題，作答後整列翻牌：綠色＝答對、灰色＝答錯，格子上顯示正確答案的前幾個字。
 * 紀錄存在 S().settings.skinData.wordle['YYYY-MM-DD'] = {ids, r:[1|0|null], p:[選的字母]}。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon } = SK;
  const S = () => QG.S();
  const N = 5;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  Object.assign(SK.ICONS, {
    'wd-help': '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.6c-.6.3-1 .8-1 1.5v.7"/><path d="M12 17h.01"/>',
    'wd-share': '<path d="M4 13v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6"/><path d="M12 15V3M7 8l5-5 5 5"/>',
  });

  /* ---------------------------------------------------------------- 資料 */

  function store() {
    const st = S().settings;
    if (!st.skinData || typeof st.skinData !== 'object') st.skinData = {};
    if (!st.skinData.wordle || typeof st.skinData.wordle !== 'object') st.skinData.wordle = {};
    return st.skinData.wordle;
  }

  /** FNV-1a 字串雜湊 → mulberry32 亂數：同一天、同一份題庫，每個人拿到的 5 題都一樣 */
  function hash(str) {
    let x = 2166136261;
    for (const ch of str) { x ^= ch.codePointAt(0); x = Math.imul(x, 16777619) >>> 0; }
    return x >>> 0;
  }
  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pickIds(date) {
    const pool = QG.QS.filter((q) => q.official && !q.prev);
    const r = rng(hash('quizgrinder-daily-' + date));
    const used = new Set();
    const out = [];
    while (out.length < N && used.size < pool.length) {
      const i = Math.floor(r() * pool.length);
      if (used.has(i)) continue;
      used.add(i);
      out.push(pool[i].id);
    }
    return out;
  }

  const answered = (d) => (d && Array.isArray(d.r) ? d.r.filter((v) => v === 0 || v === 1).length : 0);
  const correct = (d) => (d && Array.isArray(d.r) ? d.r.filter((v) => v === 1).length : 0);
  const isDone = (d) => answered(d) >= N;

  /** 今天的題組（第一次打開時建立；只有作答時才存檔） */
  function today() {
    const date = QG.dayKey();
    const data = store();
    let d = data[date];
    if (!d || !Array.isArray(d.ids) || d.ids.length !== N || !d.ids.every((id) => QG.QMAP.has(id))) {
      d = data[date] = { ids: pickIds(date), r: [], p: [] };
    }
    if (!Array.isArray(d.r)) d.r = [];
    if (!Array.isArray(d.p)) d.p = [];
    return { date, d };
  }

  function nextDayKey(k) {
    const d = new Date(k + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return QG.dayKey(d);
  }

  function stats() {
    const data = store();
    const days = Object.keys(data).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && data[k]).sort();
    const played = days.filter((k) => answered(data[k]) > 0);
    const done = days.filter((k) => isDone(data[k]));
    const dist = [0, 0, 0, 0, 0, 0];
    done.forEach((k) => { dist[correct(data[k])]++; });
    const perfect = dist[N];
    let max = 0, run = 0, prev = null;
    for (const k of done) {
      run = prev && nextDayKey(prev) === k ? run + 1 : 1;
      max = Math.max(max, run);
      prev = k;
    }
    let cur = 0;
    const d = new Date();
    if (!isDone(data[QG.dayKey(d)])) d.setDate(d.getDate() - 1);
    while (isDone(data[QG.dayKey(d)])) { cur++; d.setDate(d.getDate() - 1); }
    return { played: played.length, done: done.length, perfect, rate: done.length ? Math.round((perfect / done.length) * 100) : 0, cur, max, dist };
  }

  /** 方格上顯示「正確答案」的前幾個字（超過 5 字以 … 收尾） */
  function tileChars(q) {
    const text = q.all ? '全部給分' : q.o[q.a[0]] || '';
    const chars = Array.from(text.replace(/\s+/g, ' ').trim());
    const out = chars.length > N ? chars.slice(0, N - 1).concat('…') : chars;
    while (out.length < N) out.push('');
    return out;
  }
  const answerText = (q) => (q.all ? '官方釋疑：所有選項均給分' : q.a.map((L) => `${L}. ${q.o[L]}`).join('；') + (q.a.length > 1 ? '（均給分）' : ''));

  function shareText(date, d) {
    const grid = d.ids.map((_, i) => (d.r[i] === 1 ? '🟩' : '⬜')).join('');
    return `QuizGrinder 每日 5 題 ${date} ${correct(d)}/${N}\n${grid}`;
  }

  function share(date, d) {
    const text = shareText(date, d);
    try {
      navigator.clipboard.writeText(text).then(() => QG.toast('已複製成績，可以貼到任何地方'), () => QG.toast('這個瀏覽器不允許複製'));
    } catch (e) {
      QG.toast('這個瀏覽器不允許複製');
    }
  }

  /* ---------------------------------------------------------------- 對話框 */

  function statsBlock(compact) {
    const s = stats();
    const { date, d } = today();
    const todayN = isDone(d) ? correct(d) : -1;
    const top = Math.max(1, ...s.dist);
    const stat = (v, label) => h('div', { class: 'wd-stat' }, h('b', { text: String(v) }), h('span', { text: label }));
    return h('div', { class: 'wd-statsblock' + (compact ? ' compact' : '') },
      h('h2', { class: 'wd-mh', text: '統計' }),
      h('div', { class: 'wd-stats' }, stat(s.played, '已玩天數'), stat(s.rate, '全對率 %'), stat(s.cur, '目前連續'), stat(s.max, '最長連續')),
      h('h3', { class: 'wd-mh small', text: '答對題數分布' }),
      s.done
        ? h('div', { class: 'wd-dist', role: 'list' }, s.dist.map((n, k) => h('div', { class: 'wd-dist-row', role: 'listitem', 'aria-label': `答對 ${k} 題：${n} 天` },
          h('span', { class: 'wd-dist-k', text: String(k) }),
          h('span', { class: 'wd-dist-bar' + (k === todayN ? ' today' : ''), style: `width:${Math.max(8, Math.round((n / top) * 100))}%` }, h('span', { text: String(n) })))))
        : h('p', { class: 'wd-empty', text: '還沒有完成過任何一天。完成今天的 5 題後，這裡會出現分布圖。' }),
      compact ? null : footer(date, d));
  }

  function footer(date, d) {
    if (!isDone(d)) return h('p', { class: 'wd-empty', text: `今天已答 ${answered(d)} / ${N} 題，全部完成後就能分享成績。` });
    const clock = h('b', { class: 'wd-clock' });
    const tick = () => {
      const now = new Date();
      const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const sec = Math.max(0, Math.floor((mid - now) / 1000));
      const z = (n) => String(n).padStart(2, '0');
      clock.textContent = `${z(Math.floor(sec / 3600))}:${z(Math.floor((sec % 3600) / 60))}:${z(sec % 60)}`;
      if (!clock.isConnected && timer) { clearInterval(timer); timer = null; }
    };
    let timer = null;
    tick();
    timer = setInterval(tick, 1000);
    return h('div', { class: 'wd-foot' },
      h('div', { class: 'wd-next' }, h('span', { text: '下一組題目' }), clock),
      h('span', { class: 'wd-sep', 'aria-hidden': 'true' }),
      h('button', { class: 'wd-share', type: 'button', onclick: () => share(date, d) }, '分享', icon('wd-share')));
  }

  /** Wordle 式對話框：關閉鈕在白色卡片右上角 */
  function wdModal(cls, ...kids) {
    let m = null;
    const box = h('div', { class: 'wd-modal ' + (cls || '') },
      h('button', { class: 'wd-x', type: 'button', 'aria-label': '關閉', onclick: () => m.close() }, icon('close')), kids);
    m = SK.modal(box, 'wd-modal-back');
    if (SK.setOpenModal) SK.setOpenModal(m);
    return m;
  }

  function openStats() {
    wdModal('', statsBlock(false));
  }

  function demoRow(chars, states, label) {
    return h('div', { class: 'wd-demo' },
      h('div', { class: 'wd-row small', 'aria-hidden': 'true' }, chars.map((c, i) => h('span', { class: 'wd-tile ' + (states[i] || 'filled'), text: c }))),
      h('p', null, label));
  }

  function openHelp() {
    wdModal('help',
      h('h2', { class: 'wd-mh left', text: '怎麼玩' }),
      h('p', { class: 'wd-lead', text: '每天 5 題 IPAS 電路板歷屆考題，同一天每個人拿到的題目都一樣。' }),
      h('ul', { class: 'wd-rules' },
        h('li', { text: '棋盤的每一列是一題，由上而下依序作答。' }),
        h('li', { text: '每題只能作答一次，選定就不能更改。' }),
        h('li', { text: '作答後整列翻牌，格子上會出現正確答案的前幾個字。' }),
        h('li', { text: '作答同時記入學習紀錄，答錯的題目會進錯題本。' })),
      h('h3', { class: 'wd-mh small left', text: '範例' }),
      demoRow(['電', '鍍', '通', '孔', '…'], ['ok', 'ok', 'ok', 'ok', 'ok'], [h('b', { text: '綠色' }), '：這題答對了。']),
      demoRow(['防', '焊', '綠', '漆', ''], ['ng', 'ng', 'ng', 'ng', 'ng'], [h('b', { text: '灰色' }), '：這題答錯了，格子上是正確答案。']),
      demoRow(['', '', '', '', ''], ['active', 'active', 'active', 'active', 'active'], [h('b', { text: '深色外框' }), '：目前要作答的題目。']),
      h('p', { class: 'wd-note', text: '每天午夜（依你的裝置時間）換一組新題目。完成後可以查看統計並複製成績分享。' }));
  }

  /* ---------------------------------------------------------------- 頂部列 */

  function wdTop() {
    const menu = h('nav', { class: 'wd-menu', hidden: true, 'aria-label': '所有功能' },
      h('p', { class: 'wd-menu-h', text: 'QuizGrinder' }),
      SK.NAV.map((n) => h('a', { href: '#' + n.v, class: 'wd-menu-item', onclick: () => { menu.hidden = true; } }, icon(n.icon), h('span', { text: n.v === 'home' ? '每日 5 題' : n.label }))));
    const btn = h('button', { class: 'sk-iconbtn wd-menubtn', type: 'button', 'aria-label': '選單', 'aria-expanded': 'false', onclick: (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      btn.setAttribute('aria-expanded', String(!menu.hidden));
    } }, icon('menu'));
    const close = (e) => {
      if (!menu.isConnected) { document.removeEventListener('click', close); document.removeEventListener('keydown', esc); return; }
      if (!menu.hidden && !menu.contains(e.target)) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    };
    const esc = (e) => { if (e.key === 'Escape' && !menu.hidden) { menu.hidden = true; btn.focus(); } };
    document.addEventListener('click', close);
    document.addEventListener('keydown', esc);
    return h('div', { class: 'sk-top wd-top' },
      h('div', { class: 'wd-top-l' }, btn, menu),
      h('a', { class: 'wd-title', href: '#home' }, icon('pad', 'wd-pad'), h('span', { text: '每日 5 題' })),
      h('div', { class: 'wd-top-r' },
        h('button', { class: 'sk-iconbtn', type: 'button', 'aria-label': '說明', title: '說明', onclick: openHelp }, icon('wd-help')),
        h('button', { class: 'sk-iconbtn', type: 'button', 'aria-label': '統計', title: '統計', onclick: openStats }, icon('stats'))));
  }

  /* ---------------------------------------------------------------- 主畫面 */

  function rowEl(q, i, d, cur, flip) {
    const res = d.r[i];
    const has = res === 0 || res === 1;
    const chars = has ? tileChars(q) : ['', '', '', '', ''];
    const state = has ? (res === 1 ? 'ok' : 'ng') : i === cur ? 'active' : '';
    const label = has ? `第 ${i + 1} 題：${res === 1 ? '答對' : '答錯'}，正確答案 ${answerText(q)}` : i === cur ? `第 ${i + 1} 題：作答中` : `第 ${i + 1} 題：尚未作答`;
    const row = h(has ? 'button' : 'div', { class: 'wd-row' + (has ? ' done' : ''), type: has ? 'button' : null, 'aria-label': label, title: has ? '查看這題' : null,
      onclick: has ? () => openReview(q, i, d) : null },
      chars.map((c, k) => h('span', { class: 'wd-tile ' + state + (flip && has ? ' flip' : ''), style: `--i:${k}`, 'aria-hidden': 'true', text: c })));
    return row;
  }

  function openReview(q, i, d) {
    const mine = d.p[i];
    wdModal('review',
      h('p', { class: 'wd-qhead', text: `第 ${i + 1} 題・${QG.SUBJ_CODE[q.s]}・${QG.srcLabel(q.src[0])}` }),
      h('p', { class: 'wd-q', text: q.q }),
      q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖' })) : null,
      h('ol', { class: 'wd-olist' }, QG.LETTERS.map((L) => {
        const ok = q.all || q.a.includes(L);
        return h('li', { class: ok ? 'ok' : L === mine ? 'ng' : '' }, h('b', { text: L }), h('span', { text: q.o[L] }), ok ? h('span', { class: 'wd-m', text: '正解' }) : L === mine ? h('span', { class: 'wd-m', text: '你的答案' }) : null);
      })),
      q.x ? h('p', { class: 'wd-note', text: q.x }) : null);
  }

  function wdHome() {
    const { date, d } = today();
    const qs = d.ids.map((id) => QG.QMAP.get(id));
    const board = h('div', { class: 'wd-board', role: 'group', 'aria-label': `${date} 的 5 題` });
    const card = h('section', { class: 'wd-card', 'aria-live': 'polite' });
    const wrap = h('div', { class: 'wd-home' },
      h('p', { class: 'wd-date', text: `${date.replace(/-/g, ' / ')}　・　${answered(d)} / ${N}` }),
      board, card);
    let flipRow = -1;
    let justAnswered = -1;

    const curIdx = () => { for (let i = 0; i < N; i++) if (!(d.r[i] === 0 || d.r[i] === 1)) return i; return N; };

    const drawBoard = () => {
      const cur = curIdx();
      fill(board, qs.map((q, i) => rowEl(q, i, d, cur, i === flipRow)));
      wrap.querySelector('.wd-date').textContent = `${date.replace(/-/g, ' / ')}　・　${answered(d)} / ${N}`;
    };

    const drawCard = () => {
      const cur = curIdx();
      QG.setKeys(null);
      if (justAnswered >= 0) {
        const q = qs[justAnswered];
        const ok = d.r[justAnswered] === 1;
        const last = cur >= N;
        const nextBtn = h('button', { class: 'wd-key wide primary', type: 'button', text: last ? '看今天的成績' : '下一題', onclick: () => { justAnswered = -1; flipRow = -1; drawCard(); if (last) openStats(); } });
        fill(card,
          h('p', { class: 'wd-verdict ' + (ok ? 'ok' : 'ng'), text: ok ? '答對了！' : '答錯了' }),
          h('p', { class: 'wd-answer' }, h('span', { text: '正確答案　' }), h('b', { text: answerText(q) })),
          q.x ? h('p', { class: 'wd-note', text: q.x }) : null,
          !ok ? h('p', { class: 'wd-note', text: '這題已加入錯題本。' }) : null,
          nextBtn);
        QG.setKeys((e) => { if (e.key === 'Enter') { nextBtn.click(); return true; } return false; });
        setTimeout(() => { if (nextBtn.isConnected) nextBtn.focus({ preventScroll: true }); }, reduced() ? 0 : 1400);
        return;
      }
      if (cur >= N) {
        const c = correct(d);
        fill(card,
          h('p', { class: 'wd-verdict done', text: c === N ? '全對！太厲害了' : c >= 3 ? '做得不錯！' : '明天再接再厲' }),
          h('p', { class: 'wd-big', text: `${c} / ${N}` }),
          h('p', { class: 'wd-note', text: '點棋盤上的任一列可以回顧那一題。明天會有新的 5 題。' }),
          h('div', { class: 'wd-btns' },
            h('button', { class: 'wd-key wide primary', type: 'button', onclick: () => share(date, d) }, '分享成績 ', icon('wd-share')),
            h('button', { class: 'wd-key wide', type: 'button', text: '統計', onclick: openStats }),
            h('button', { class: 'wd-key wide', type: 'button', text: '再練 10 題', onclick: () => {
              const ids = QG.shuffle(QG.QS.filter((q) => q.official && !d.ids.includes(q.id)).map((q) => q.id)).slice(0, 10);
              QG.startCustomPractice(ids, '每日 5 題・加練');
            } })));
        return;
      }
      const q = qs[cur];
      const opts = SK.answerOptions(q, { cls: 'wd-opts', onDone: (ok, L) => {
        d.r[cur] = ok ? 1 : 0;
        d.p[cur] = L;
        QG.Store.save();
        flipRow = cur;
        justAnswered = cur;
        drawBoard();
        setTimeout(drawCard, reduced() ? 0 : 450);
        if (curIdx() >= N) setTimeout(() => {
          if (!card.isConnected || QG.currentView !== 'home' || SK.skin() !== 'wordle') return;
          justAnswered = -1; flipRow = -1; drawCard(); openStats();
        }, reduced() ? 300 : 1900);
      } });
      fill(card,
        h('p', { class: 'wd-qhead', text: `第 ${cur + 1} / ${N} 題・${QG.SUBJ_CODE[q.s]} ${QG.SUBJ_SHORT[q.s]}・${QG.srcLabel(q.src[0])}` }),
        h('p', { class: 'wd-q', text: q.q }),
        q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖' })) : null,
        opts,
        h('p', { class: 'wd-hint', text: '按 1–4 或 A–D 作答・只有一次機會' }));
      QG.setKeys((e) => {
        if (document.body.classList.contains('mx-open')) return false;
        const k = e.key.toUpperCase();
        if ('1234'.includes(k) && k.length === 1) { opts.pick(+k - 1); return true; }
        if ('ABCD'.includes(k) && k.length === 1) { opts.pick('ABCD'.indexOf(k)); return true; }
        return false;
      });
    };

    drawBoard();
    drawCard();
    // 第一次來：先看規則
    const data = store();
    if (!data._seenHelp) {
      data._seenHelp = 1;
      QG.Store.save();
      setTimeout(() => { if (QG.currentView === 'home' && SK.skin() === 'wordle' && !document.body.classList.contains('mx-open')) openHelp(); }, 400);
    }
    return wrap;
  }

  function wdStats(base) {
    const el = base.stats();
    const { d } = today();
    const box = h('section', { class: 'panel wd-statpanel' }, statsBlock(true),
      h('div', { class: 'wd-btns' },
        h('a', { class: 'wd-key wide primary', href: '#home', text: isDone(d) ? '回顧今天的 5 題' : `繼續今天的題目（${answered(d)}/${N}）` }),
        h('button', { class: 'wd-key wide', type: 'button', text: '說明', onclick: openHelp })));
    const hero = el.querySelector('.hero');
    if (hero) hero.after(box); else el.prepend(box);
    return el;
  }

  SK.register({
    id: 'wordle',
    label: 'Wordle 風',
    group: '學習測驗',
    top: wdTop,
    nav: [
      { v: 'home', label: '每日', icon: 'pad' },
      { v: 'practice', label: '練習', icon: 'practice' },
      { v: 'review', label: '錯題', icon: 'review', badge: true },
      { v: 'exam', label: '模擬考', icon: 'exam' },
      { v: 'stats', label: '統計', icon: 'stats' },
    ],
    views: { home: wdHome, stats: wdStats },
  });
})();
