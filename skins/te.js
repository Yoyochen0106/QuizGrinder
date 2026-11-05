/* QuizGrinder 版面風格：Teenage Engineering 風（te）
 *
 * 工業硬體面板的設計語言：暖灰鋁板、黑色絲印小字（IBM Plex Mono）、唯一的橘色重點、
 * 對齊格線的小標籤（01 L11／02 L12）。首頁是一台「機器」：
 *   - 綠灰色 LCD 七段顯示器：今日作答、正確率、到期錯題
 *   - 旋鈕選科目（滑鼠點擊或方向鍵）
 *   - 4×4 方形按鍵＝16 個主題，LED：正確率 ≥80% 亮綠燈、有到期錯題閃橘燈
 *   - 橘色 PLAY 大鍵 → 練習
 * 練習／模擬考：選項變成有字母鍵帽的硬體按鍵，計時器變成七段顯示器。
 * 只借用設計語言；標誌用 QuizGrinder 的焊墊圖示。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const S = () => QG.S();

  /* ---------------------------------------------------------------- 七段顯示 */
  const SEG = {
    0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
    '-': 'g', ' ': '', E: 'adefg', r: 'eg', P: 'abefg', L: 'def', A: 'abcefg', C: 'adef', d: 'bcdeg', U: 'bcdef', o: 'cdeg', n: 'ceg',
  };
  /** 回傳一串七段數字（未亮的段以暗色顯示）；':' 與 '.' 為點，'%' 為小字 */
  function seg(str, cls) {
    const wrap = h('span', { class: 'te-seg ' + (cls || ''), 'aria-hidden': 'true' });
    for (const ch of String(str)) {
      if (ch === ':') { wrap.append(h('span', { class: 'te-colon' }, h('i'), h('i'))); continue; }
      if (ch === '.') { wrap.append(h('span', { class: 'te-dot' })); continue; }
      if (ch === '%') { wrap.append(h('span', { class: 'te-unit', text: '%' })); continue; }
      const on = SEG[ch] !== undefined ? SEG[ch] : '';
      wrap.append(h('span', { class: 'te-digit' }, 'abcdefg'.split('').map((s) => h('i', { class: 's' + s + (on.includes(s) ? ' on' : '') }))));
    }
    return wrap;
  }
  const pad3 = (n) => (n > 999 ? '999' : String(n).padStart(3, ' '));

  /* ---------------------------------------------------------------- 外框 */
  const TE_NAV = [
    { v: 'home', label: 'HOME', icon: 'home', n: '01' },
    { v: 'practice', label: 'PLAY', icon: 'practice', n: '02' },
    { v: 'review', label: 'REV', icon: 'review', n: '03', badge: true },
    { v: 'exam', label: 'EXAM', icon: 'exam', n: '04' },
    { v: 'browse', label: 'LIB', icon: 'browse', n: '05' },
    { v: 'stats', label: 'STAT', icon: 'stats', n: '06' },
  ];

  function teTop(view) {
    return h('div', { class: 'sk-top te-top' },
      h('a', { class: 'te-logo', href: '#home', 'aria-label': 'QuizGrinder 首頁' }, SK.icon('pad'),
        h('span', { class: 'te-logo-name', text: 'quizgrinder' }), h('span', { class: 'te-model', text: 'QG-1150' })),
      h('nav', { class: 'te-tabs', 'aria-label': '主要功能' }, TE_NAV.map((n) => h('a', { class: 'te-tab', href: '#' + n.v,
        'aria-current': SK.isCurrent(view, n.v) ? 'page' : null },
        h('span', { class: 'te-tab-n', text: n.n }), h('span', { class: 'te-tab-l', text: n.label }),
        n.badge ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null))));
  }

  /* ---------------------------------------------------------------- 首頁：機器 */
  const KNOB = [['all', 'ALL', '兩科'], ['industry', 'L11', '產業概論'], ['process', 'L12', '製造概論']];
  const KNOB_ANGLE = [-50, 0, 50];

  function topicData(subject) {
    const st = S().q;
    const now = Date.now();
    return QG.TAGS.filter(([t]) => t !== '其他').slice(0, 16).map(([t]) => {
      const qs = QG.QS.filter((q) => q.official && q.t.includes(t) && (subject === 'all' || q.s === subject));
      const ids = qs.map((q) => q.id);
      const p = SK.progressOf(ids);
      const due = ids.filter((id) => { const r = st[id]; return r && r.b > 0 && (r.d || 0) <= now; }).length;
      return { t, ids, p, due, acc: p.n ? p.c / p.n : null };
    });
  }

  function knob(onChange) {
    const f = S().settings.filters;
    let i = Math.max(0, KNOB.findIndex(([v]) => v === f.subject));
    const cap = h('span', { class: 'te-knob-cap' }, h('span', { class: 'te-knob-mark' }));
    const dial = h('div', { class: 'te-knob', role: 'slider', tabindex: '0', 'aria-label': '科目旋鈕',
      'aria-valuemin': '0', 'aria-valuemax': '2' },
      Array.from({ length: 11 }, (_, k) => h('span', { class: 'te-tick' + (k % 5 === 0 ? ' major' : ''), style: `--a:${-75 + k * 15}deg` })),
      cap);
    const labels = h('div', { class: 'te-knob-labels' }, KNOB.map(([, code, name], k) =>
      h('button', { type: 'button', class: 'te-knob-l', style: `--a:${KNOB_ANGLE[k]}deg`, tabindex: '-1', 'aria-label': `${code} ${name}`,
        onclick: () => set(k) }, h('b', { text: code }), h('small', { text: name }))));
    const sync = () => {
      dial.style.setProperty('--rot', KNOB_ANGLE[i] + 'deg');
      dial.setAttribute('aria-valuenow', String(i));
      dial.setAttribute('aria-valuetext', `${KNOB[i][1]} ${KNOB[i][2]}`);
      labels.querySelectorAll('.te-knob-l').forEach((b, k) => b.classList.toggle('on', k === i));
    };
    function set(k) {
      k = Math.max(0, Math.min(2, k));
      if (k === i) return;
      i = k;
      sync();
      const ff = S().settings.filters;
      ff.subject = KNOB[i][0];
      if (ff.exam === 'mock-mingchi') ff.exam = '';
      ff.preset = 'custom';
      QG.Store.save();
      onChange();
    }
    dial.addEventListener('click', () => set(i === 2 ? 0 : i + 1));
    dial.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') set(i + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') set(i - 1);
      else if (e.key === 'Home') set(0);
      else if (e.key === 'End') set(2);
      else return;
      e.preventDefault();
      e.stopPropagation();
    });
    sync();
    return h('div', { class: 'te-knob-wrap' }, h('span', { class: 'te-silk te-knob-title', text: 'SUBJ · 科目' }), h('div', { class: 'te-knob-box' }, labels, dial),
      h('span', { class: 'te-silk te-knob-hint', text: '← → TURN' }));
  }

  function lcd() {
    const st = S();
    const today = st.days[QG.dayKey()] || { n: 0, c: 0 };
    const t = QG.totals();
    const acc = t.n ? Math.round((t.c / t.n) * 100) : null;
    const due = QG.dueReviewIds().length;
    const f = st.settings.filters;
    const cell = (label, value, unit) => h('div', { class: 'te-lcd-cell' },
      h('span', { class: 'te-lcd-label', text: label }), seg(value, 'big'), unit ? h('span', { class: 'te-lcd-unit', text: unit }) : null);
    return h('section', { class: 'te-lcd', 'aria-label': `今日作答 ${today.n} 題，總正確率 ${acc === null ? '—' : acc + '%'}，到期錯題 ${due} 題` },
      h('div', { class: 'te-lcd-row top' }, h('span', { text: `SUBJ ${KNOB.find(([v]) => v === f.subject) ? KNOB.find(([v]) => v === f.subject)[1] : 'ALL'}` }),
        h('span', { text: `STREAK ${QG.streak()}D` }), h('span', { text: `SEEN ${t.seen}/${QG.QS.length}` })),
      h('div', { class: 'te-lcd-main' },
        cell('TODAY', pad3(today.n), 'Q'),
        cell('ACC', acc === null ? ' --' : pad3(acc), '%'),
        cell('DUE', pad3(due), 'Q')),
      h('div', { class: 'te-lcd-row bot' }, h('span', { text: '今日作答' }), h('span', { text: '總正確率' }), h('span', { text: '到期錯題' })),
      activity(st));
  }

  /** LCD 下方：近 14 天作答量長條（每格＝一天，亮段＝答對） */
  function activity(st) {
    const days = [];
    const d = new Date();
    for (let k = 13; k >= 0; k--) { const x = new Date(d); x.setDate(d.getDate() - k); days.push(st.days[QG.dayKey(x)] || { n: 0, c: 0 }); }
    const max = Math.max(10, ...days.map((x) => x.n));
    return h('div', { class: 'te-lcd-act', role: 'img', 'aria-label': `近 14 天作答：${days.map((x) => x.n).join('、')}` },
      h('span', { class: 'te-lcd-act-l', text: '14D' }),
      h('span', { class: 'te-lcd-bars' }, days.map((x) => h('span', { class: 'te-lcd-bar' },
        h('i', { class: 'n', style: `height:${Math.round((x.n / max) * 100)}%` }), h('i', { class: 'c', style: `height:${Math.round((x.c / max) * 100)}%` })))),
      h('span', { class: 'te-lcd-act-l', text: 'NOW' }));
  }

  function keyGrid(data, subject) {
    return h('section', { class: 'te-keys', 'aria-label': '主題按鍵' }, data.map((d, k) => {
      const mastered = d.acc !== null && d.acc >= 0.8;
      const label = `${d.t}：已練 ${d.p.seen}/${d.ids.length}${d.acc !== null ? `，正確率 ${Math.round(d.acc * 100)}%` : ''}${d.due ? `，${d.due} 題到期` : ''}`;
      return h('button', { class: 'te-key' + (k % 4 === 3 ? ' dark' : ''), type: 'button', 'aria-label': label, title: label, disabled: d.ids.length ? null : true,
        onclick: () => QG.startCustomPractice(QG.buildQueue(d.ids, 'weak'), `主題：${d.t}${subject === 'all' ? '' : '（' + QG.SUBJ_CODE[subject] + '）'}`) },
        h('span', { class: 'te-key-n', text: String(k + 1).padStart(2, '0') }),
        h('span', { class: 'te-led' + (d.due ? ' due' : mastered ? ' lit' : d.p.seen ? ' dim' : '') }),
        h('span', { class: 'te-key-t', text: d.t }),
        h('span', { class: 'te-key-m', text: d.acc === null ? `${d.ids.length}Q` : `${Math.round(d.acc * 100)}%` }),
        h('span', { class: 'te-key-bar' }, h('i', { style: `width:${d.ids.length ? Math.round((d.p.seen / d.ids.length) * 100) : 0}%` })));
    }));
  }

  function teHome() {
    const wrap = h('div', { class: 'te-home' });
    const draw = () => {
      const st = S();
      const subject = st.settings.filters.subject || 'all';
      const data = topicData(subject);
      const p = st.practice;
      const due = QG.dueReviewIds().length;
      const inProgress = p && p.key !== 'custom' && p.idx > 0 && p.idx < p.queue.length && p.label === QG.filterLabel(st.settings.filters);
      const play = () => {
        const cur = st.practice;
        // 有進行中的同範圍練習就接著練；否則依目前旋鈕與範圍開新一輪
        if (!(cur && cur.key !== 'custom' && cur.idx < cur.queue.length)) QG.ensurePractice(true);
        else QG.ensurePractice();
        location.hash = '#practice';
      };
      fill(wrap,
        h('div', { class: 'te-device' },
          h('span', { class: 'te-screw tl' }), h('span', { class: 'te-screw tr' }), h('span', { class: 'te-screw bl' }), h('span', { class: 'te-screw br' }),
          h('header', { class: 'te-dev-head' },
            h('span', { class: 'te-silk strong', text: 'QG-1150 · PCB FIELD TRAINER' }),
            h('span', { class: 'te-silk', text: '01 L11 / 02 L12' }),
            h('span', { class: 'te-silk right', text: `REV ${QG.YEARS[0]}–${QG.YEARS[QG.YEARS.length - 1]}` })),
          lcd(), knob(draw),
          h('div', { class: 'te-silkline' }, h('span', { text: 'TOPIC MATRIX 4×4' }), h('span', { class: 'te-legend' },
            h('span', { class: 'te-led lit' }), ' ≥80%  ', h('span', { class: 'te-led due' }), ' DUE  ', h('span', { class: 'te-led dim' }), ' SEEN')),
          keyGrid(data, subject),
          h('div', { class: 'te-dev-side' },
              h('div', { class: 'te-grille', 'aria-hidden': 'true' }),
              h('button', { class: 'te-play', type: 'button', onclick: play },
                h('span', { class: 'te-play-ico', 'aria-hidden': 'true', text: '▶' }),
                h('span', { class: 'te-play-l', text: 'PLAY' }),
                h('span', { class: 'te-play-s', text: inProgress ? `繼續 ${p.idx + 1}/${p.queue.length}` : `${QG.fmtNum(QG.filterQuestions(st.settings.filters).length)} 題・${QG.filterLabel(st.settings.filters)}` })),
              h('div', { class: 'te-fn' },
                h('a', { class: 'te-fn-key' + (due ? ' hot' : ''), href: '#review' }, h('b', { text: 'REV' }), h('small', { text: `錯題 ${due}` })),
                h('a', { class: 'te-fn-key', href: '#exam' }, h('b', { text: 'EXAM' }), h('small', { text: `${QG.EXAM_LEN}Q/${QG.EXAM_MIN}M` })),
                h('a', { class: 'te-fn-key', href: '#browse' }, h('b', { text: 'LIB' }), h('small', { text: '題庫' })),
                h('a', { class: 'te-fn-key', href: '#stats' }, h('b', { text: 'STAT' }), h('small', { text: '統計' })))),
          h('footer', { class: 'te-dev-foot' },
            h('span', { class: 'te-silk', text: 'DESIGNED FOR IPAS PCB ENGINEERS' }),
            h('span', { class: 'te-silk', text: `S/N ${String(QG.totals().n).padStart(6, '0')}` }))),
        h('details', { class: 'te-setup' }, h('summary', null, h('span', { class: 'te-silk strong', text: 'SETUP · 練習範圍' }), h('span', { class: 'te-silk', text: QG.filterLabel(st.settings.filters) })),
          QG.rangePanel()));
    };
    draw();
    return wrap;
  }

  /* ---------------------------------------------------------------- 計時器 → 七段顯示 */
  let mo = null;
  function teAfter(view) {
    if (mo) { mo.disconnect(); mo = null; }
    if (view !== 'exam') return;
    const app = document.getElementById('app');
    let shown = '';
    let disp = null;
    const sync = () => {
      const timer = app.querySelector('.timer');
      if (!timer) return;
      if (!disp) disp = h('span', { class: 'te-timer' });
      if (timer.nextSibling !== disp) timer.after(disp);
      const txt = timer.textContent.trim();
      const low = timer.classList.contains('low');
      disp.classList.toggle('low', low);
      if (txt !== shown) { shown = txt; fill(disp, h('span', { class: 'te-timer-l', text: low ? 'LOW' : 'TIME' }), seg(txt.length < 5 ? txt.padStart(5, ' ') : txt)); }
    };
    sync();
    mo = new MutationObserver(sync);
    mo.observe(app, { subtree: true, childList: true, characterData: true });
  }

  SK.register({ id: 'te', label: 'Teenage Engineering 風', group: '設計界', top: teTop, nav: TE_NAV,
    views: { home: teHome }, after: teAfter });
})();
