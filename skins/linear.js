/* QuizGrinder 版面風格：Linear 風（鍵盤優先的議題追蹤器）
 *
 *   左側欄：工作區名稱、收件匣（到期錯題）、我的錯題、練習範圍、主題清單（附題數）
 *   主畫面：答錯過的題目＝issue，依真實複習進度分組——
 *            Backlog（錯題盒 1、待複習）／In Progress（錯題盒 2–4）／Done（盒 5 或已熟練）
 *   鍵盤：J/K 移動、Enter 開啟、Esc 關閉、1–4 作答、/ 篩選、G 再按 I/M/B/P 切換檢視、⌘K／Ctrl K 指令選單
 *   右側滑出的詳細面板：題目、可作答選項、屬性欄（狀態、答錯次數、標籤、科目、複習盒、出處）
 * 只借用版面、互動與配色；標誌用 QuizGrinder 焊墊圖示。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon, hue } = SK;
  const S = () => QG.S();
  const root = document.documentElement;
  const on = () => SK.skin() === 'linear';
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  Object.assign(SK.ICONS, {
    'ln-inbox': '<path d="M3 13l2.5-8h13L21 13v6H3z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/>',
    'ln-issues': '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/>',
    'ln-layers': '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    'ln-compose': '<path d="M12 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M18 3l3 3-9 9H9v-3z"/>',
    'ln-chev': '<path d="M7 10l5 5 5-5"/>',
    'ln-up': '<path d="M6 15l6-6 6 6"/>',
    'ln-down': '<path d="M6 9l6 6 6-6"/>',
    'ln-play': '<path d="M7 5l12 7-12 7z"/>',
    'ln-copy': '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    'ln-cmd': '<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z"/>',
  });

  /* ---------------------------------------------------------------- 資料 */
  let numMap = null;
  const num = (id) => {
    if (!numMap || numMap.size !== QG.QS.length) numMap = new Map(QG.QS.map((q, i) => [q.id, i + 1]));
    return numMap.get(id) || 0;
  };
  const ident = (q) => 'QG-' + num(q.id);
  const topics = (q) => q.t.filter((t) => t !== '其他');

  /** 由錯題盒推得的議題狀態；沒答錯過的題目為 todo（不是 issue） */
  function statusOf(r) {
    if (!r || !r.w) return 'todo';
    if (r.m || !r.b || r.b >= 5) return 'done';
    if (r.b === 1) return 'backlog';
    return 'progress';
  }
  const STATUS = {
    progress: { label: 'In Progress', zh: '複習中' },
    backlog: { label: 'Backlog', zh: '待複習' },
    done: { label: 'Done', zh: '已掌握' },
    todo: { label: 'Todo', zh: '未列入' },
  };
  const ORDER = ['progress', 'backlog', 'done'];

  function issues() {
    const st = S().q;
    const out = [];
    for (const [id, r] of Object.entries(st)) {
      if (!r || !r.w || !QG.QMAP.has(id)) continue;
      out.push({ q: QG.QMAP.get(id), r, s: statusOf(r) });
    }
    return out.sort((a, b) => (b.r.t || 0) - (a.r.t || 0));
  }

  /** 狀態圖示（SVG）：Backlog 虛線圈、In Progress 依錯題盒填色、Done 實心勾 */
  function statusIcon(s, r) {
    const span = document.createElement('span');
    span.className = 'linear-st s-' + s;
    span.setAttribute('aria-hidden', 'true');
    let inner = '';
    if (s === 'backlog') inner = '<circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="1.6 1.6"/>';
    else if (s === 'todo') inner = '<circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/>';
    else if (s === 'done') inner = '<circle cx="7" cy="7" r="6.5" fill="currentColor"/><path d="M4.4 7.2l1.8 1.8 3.5-3.6" fill="none" stroke="var(--linear-check)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
    else {
      const frac = Math.min(.9, Math.max(.15, ((r && r.b ? r.b : 2) - 1) / 4));
      const a = frac * 2 * Math.PI;
      const x = 7 + 3.5 * Math.sin(a), y = 7 - 3.5 * Math.cos(a);
      inner = '<circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/>'
        + `<path d="M7 7V3.5A3.5 3.5 0 ${frac > .5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}z" fill="currentColor"/>`;
    }
    span.innerHTML = `<svg viewBox="0 0 14 14" width="14" height="14">${inner}</svg>`;
    return span;
  }

  /** 答錯次數畫成優先度訊號格 */
  function prioIcon(w) {
    const span = document.createElement('span');
    span.className = 'linear-prio' + (w >= 5 ? ' urgent' : '');
    span.title = w ? `答錯 ${w} 次` : '沒有答錯紀錄';
    if (w >= 5) span.innerHTML = '<svg viewBox="0 0 14 14" width="14" height="14"><rect x="1" y="1" width="12" height="12" rx="3" fill="currentColor"/><path d="M7 4v3.6M7 9.6v.2" stroke="var(--linear-check)" stroke-width="1.6" stroke-linecap="round"/></svg>';
    else {
      const lv = Math.min(3, w);
      span.innerHTML = '<svg viewBox="0 0 14 14" width="14" height="14">' + [0, 1, 2].map((i) => `<rect x="${1.5 + i * 4}" y="${10 - i * 3}" width="3" height="${3 + i * 3}" rx="1" fill="currentColor" opacity="${i < lv ? 1 : .28}"/>`).join('') + '</svg>';
    }
    return span;
  }

  const label = (t) => h('span', { class: 'linear-label', style: `--h:${hue(t)}` }, h('i'), h('span', { text: t }));
  const shortTime = (ts) => {
    if (!ts) return '—';
    const d = (Date.now() - ts) / 1000;
    if (d < 60) return '剛剛';
    if (d < 3600) return `${Math.floor(d / 60)} 分`;
    if (d < 86400) return `${Math.floor(d / 3600)} 小時`;
    if (d < 86400 * 30) return `${Math.floor(d / 86400)} 天`;
    const t = new Date(ts);
    return `${t.getMonth() + 1}/${t.getDate()}`;
  };
  const kbd = (...keys) => keys.map((k) => h('kbd', { class: 'linear-kbd', text: k }));
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const MOD = isMac ? '⌘' : 'Ctrl';

  /* ---------------------------------------------------------------- 狀態 */
  const st = { mode: 'mine', status: 'all', label: '', kw: '', sel: 0, open: null };
  let rows = [];       // 目前清單中的題目（依畫面順序）
  let listEl = null;
  let detail = null;   // {el, q, opts}

  function setMode(mode, status) {
    st.mode = mode;
    st.status = status || 'all';
    if (mode === 'inbox') st.label = '';
    st.sel = 0;
    st.open = null;
    SK.go('home');
  }

  /* ---------------------------------------------------------------- 側欄 */
  function side(view) {
    const all = issues();
    const due = QG.dueReviewIds().length;
    const home = view === 'home';
    const item = (lbl, ico, opts) => h(opts.href ? 'a' : 'button', {
      class: 'linear-nav', href: opts.href, type: opts.href ? null : 'button', 'aria-current': opts.cur ? 'page' : null, title: opts.title || lbl,
      onclick: opts.onclick }, icon(ico), h('span', { class: 'linear-nav-l', text: lbl }),
      opts.count !== undefined && opts.count !== '' ? h('span', { class: 'linear-count', text: String(opts.count) }) : null);
    const f = S().settings.filters;
    return h('nav', { class: 'linear-side', 'aria-label': '工作區' },
      h('div', { class: 'linear-ws' },
        h('a', { class: 'linear-ws-name', href: '#home', 'aria-label': 'QuizGrinder 首頁' }, h('span', { class: 'linear-ws-ico' }, icon('pad')), h('b', { text: 'QuizGrinder' })),
        h('button', { class: 'linear-iconbtn', type: 'button', 'aria-label': `指令選單（${MOD} K）`, title: `指令選單 ${MOD} K`, onclick: () => openCmd() }, icon('search')),
        h('button', { class: 'linear-iconbtn boxed', type: 'button', 'aria-label': '開始練習', title: '開始練習', onclick: () => { QG.ensurePractice(); SK.go('practice'); } }, icon('ln-compose'))),
      h('div', { class: 'linear-navs' },
        item('收件匣', 'ln-inbox', { cur: home && st.mode === 'inbox', count: due || '', title: '到期待複習的錯題', onclick: () => setMode('inbox') }),
        item('我的錯題', 'ln-issues', { cur: home && st.mode === 'mine' && !st.label, count: all.length || '', onclick: () => { st.label = ''; setMode('mine'); } })),
      h('p', { class: 'linear-sec', text: '工作區' }),
      h('div', { class: 'linear-navs' },
        item('練習範圍', 'ln-layers', { href: '#practice', cur: view === 'practice', count: QG.filterQuestions(f).length, title: `練習範圍：${QG.filterLabel(f)}` }),
        item('錯題複習', 'review', { href: '#review', cur: view === 'review', count: due || '' }),
        item('模擬考', 'exam', { href: '#exam', cur: view === 'exam' || view === 'result', count: S().exams.length || '' }),
        item('題庫', 'browse', { href: '#browse', cur: view === 'browse', count: QG.QS.length }),
        item('統計', 'stats', { href: '#stats', cur: view === 'stats' })),
      h('p', { class: 'linear-sec', text: '主題' }),
      h('div', { class: 'linear-navs linear-topics' }, QG.TAGS.filter(([t]) => t !== '其他').map(([t, n]) => {
        const k = all.filter((x) => x.q.t.includes(t)).length;
        return h('button', { class: 'linear-nav', type: 'button', 'aria-current': home && st.label === t ? 'page' : null, title: `${t}：題庫 ${n} 題、錯題 ${k} 個`,
          onclick: () => { st.label = t; setMode('mine'); } },
          h('span', { class: 'linear-team', style: `--h:${hue(t)}`, text: t.slice(0, 1) }), h('span', { class: 'linear-nav-l', text: t }),
          h('span', { class: 'linear-count', text: k ? `${k} / ${n}` : String(n) }));
      })),
      h('p', { class: 'linear-help' }, kbd('G'), ' ', kbd('I'), ' 收件匣　', kbd('/'), ' 篩選　', kbd(MOD, 'K')));
  }

  /* ---------------------------------------------------------------- 頂部 */
  function top(view) {
    const NAME = { home: st.mode === 'inbox' ? '收件匣' : '我的錯題', practice: '練習範圍', review: '錯題複習', exam: '模擬考', result: '考試結果', browse: '題庫', stats: '統計' };
    const crumbs = [h('span', { class: 'linear-crumb', text: NAME[view] || '' })];
    if (view === 'home' && st.mode === 'mine' && st.label) crumbs.push(h('span', { class: 'linear-sep', text: '›' }), h('span', { class: 'linear-crumb', text: st.label }));
    if (view === 'home' && st.mode === 'mine' && st.status !== 'all') crumbs.push(h('span', { class: 'linear-sep', text: '›' }), h('span', { class: 'linear-crumb', text: STATUS[st.status].label }));
    return h('div', { class: 'sk-top linear-top' },
      h('a', { class: 'linear-mlogo', href: '#home', 'aria-label': 'QuizGrinder 首頁' }, icon('pad')),
      h('div', { class: 'linear-crumbs' }, crumbs),
      h('div', { class: 'sk-right' },
        h('button', { class: 'linear-cmdbtn', type: 'button', onclick: () => openCmd(), 'aria-label': `指令選單（${MOD} K）` }, icon('search'), h('span', { class: 'linear-cmdbtn-l', text: '搜尋或執行指令' }), h('span', { class: 'linear-cmdbtn-k' }, kbd(MOD, 'K')))));
  }

  /* ---------------------------------------------------------------- 主畫面：issue 清單 */
  function computeList(all, due) {
    const kw = st.kw.trim().toLowerCase();
    let list = st.mode === 'inbox'
      ? [...due].map((id) => ({ q: QG.QMAP.get(id), r: S().q[id], s: statusOf(S().q[id]) })).filter((x) => x.q && x.r)
      : all;
    if (st.mode === 'mine' && st.label) list = list.filter((x) => x.q.t.includes(st.label));
    if (st.mode === 'mine' && st.status !== 'all') list = list.filter((x) => x.s === st.status);
    if (kw) list = list.filter((x) => x.q.text.includes(kw) || ident(x.q).toLowerCase().includes(kw) || x.q.t.some((t) => t.toLowerCase().includes(kw)));
    return list;
  }

  function home() {
    const all = issues();
    const due = new Set(QG.dueReviewIds());
    const input = h('input', { type: 'text', id: 'linear-filter', class: 'linear-filter-in', placeholder: '篩選…', value: st.kw, autocomplete: 'off', 'aria-label': '篩選錯題（快捷鍵 /）' });
    let t;
    input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { st.kw = input.value; st.sel = 0; redrawList(); }, 120); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); input.blur(); listEl && listEl.focus({ preventScroll: true }); }
    });

    const counts = { all: all.filter((x) => !st.label || x.q.t.includes(st.label)).length };
    ORDER.forEach((s) => { counts[s] = all.filter((x) => x.s === s && (!st.label || x.q.t.includes(st.label))).length; });
    const tabs = st.mode === 'inbox'
      ? h('div', { class: 'linear-tabs' }, h('span', { class: 'linear-tab on' }, icon('ln-inbox'), `到期 ${due.size}`))
      : h('div', { class: 'linear-tabs', role: 'tablist', 'aria-label': '狀態' },
        [['all', '全部錯題'], ['progress', 'In Progress'], ['backlog', 'Backlog'], ['done', 'Done']].map(([k, l]) =>
          h('button', { type: 'button', role: 'tab', class: 'linear-tab' + (st.status === k ? ' on' : ''), 'aria-selected': st.status === k ? 'true' : 'false',
            onclick: () => { st.status = k; st.sel = 0; QG.render(); } }, k === 'all' ? icon('ln-issues') : statusIcon(k, { b: 3 }), h('span', { text: l }), h('span', { class: 'linear-tab-n', text: String(counts[k]) }))));

    listEl = h('div', { class: 'linear-list', role: 'listbox', tabindex: '0', 'aria-label': '錯題清單（J／K 移動、Enter 開啟）' });
    const view = h('div', { class: 'linear-view' },
      h('header', { class: 'linear-vhead' }, tabs,
        h('label', { class: 'linear-filter' }, icon('search'), input, kbd('/'))),
      st.mode === 'mine' && st.label ? h('div', { class: 'linear-chips' },
        h('span', { class: 'linear-chip' }, h('span', { class: 'muted', text: '標籤 是 ' }), label(st.label),
          h('button', { type: 'button', class: 'linear-chip-x', 'aria-label': '清除標籤篩選', onclick: () => { st.label = ''; st.sel = 0; QG.render(); } }, icon('close'))),
        h('button', { class: 'linear-btn', type: 'button', onclick: () => QG.startCustomPractice(QG.QS.filter((q) => q.official && q.t.includes(st.label)).map((q) => q.id), `主題：${st.label}`) }, icon('ln-play'), `練習「${st.label}」全部題目`)) : null,
      listEl,
      h('footer', { class: 'linear-hints', 'aria-hidden': 'true' },
        h('span', null, kbd('J'), kbd('K'), ' 移動'), h('span', null, kbd('Enter'), ' 開啟'), h('span', null, kbd('1–4'), ' 作答'),
        h('span', null, kbd('Esc'), ' 關閉'), h('span', null, kbd('/'), ' 篩選'), h('span', null, kbd('G'), kbd('I'), ' 收件匣'), h('span', null, kbd(MOD, 'K'), ' 指令')));

    const redrawList = () => drawList(computeList(all, due));
    redrawList();
    return view;
  }

  function drawList(list) {
    if (!listEl) return;
    rows = [];
    const out = [];
    if (!list.length) {
      const anyIssue = issues().length;
      fill(listEl, h('div', { class: 'linear-empty' },
        h('span', { class: 'linear-empty-ico' }, icon(st.mode === 'inbox' ? 'ln-inbox' : 'ln-issues')),
        h('h2', { text: st.kw ? '沒有符合的錯題' : st.mode === 'inbox' ? '收件匣已清空' : anyIssue ? '這個檢視沒有錯題' : '還沒有任何錯題' }),
        h('p', { class: 'muted', text: st.kw ? '換個關鍵字，或按 Esc 清除篩選。' : st.mode === 'inbox' ? '目前沒有到期的錯題。答錯的題目會依間隔複習排程回到這裡。' : '練習時答錯的題目會變成 issue，依複習進度在 Backlog、In Progress、Done 之間移動。' }),
        h('div', { class: 'linear-empty-btns' },
          h('button', { class: 'linear-btn primary', type: 'button', onclick: () => { QG.ensurePractice(); SK.go('practice'); } }, icon('ln-play'), '開始練習'),
          h('button', { class: 'linear-btn', type: 'button', onclick: () => openCmd() }, '指令選單 ', kbd(MOD, 'K')))));
      return;
    }
    const groups = st.mode === 'inbox' ? [['inbox', list]] : ORDER.map((s) => [s, list.filter((x) => x.s === s)]).filter(([, l]) => l.length);
    for (const [s, l] of groups) {
      if (s !== 'inbox') {
        out.push(h('div', { class: 'linear-group', role: 'presentation' }, statusIcon(s, { b: 3 }), h('b', { text: STATUS[s].label }), h('span', { class: 'linear-group-zh', text: STATUS[s].zh }),
          h('span', { class: 'linear-group-n', text: String(l.length) }), h('span', { class: 'spacer' }),
          h('button', { class: 'linear-iconbtn', type: 'button', title: `練習這 ${l.length} 題`, 'aria-label': `練習 ${STATUS[s].label} 的 ${l.length} 題`,
            onclick: () => (s === 'backlog' && QG.dueReviewIds().length ? QG.startReview(l.map((x) => x.q.id).filter((id) => QG.dueReviewIds().includes(id))) : QG.startCustomPractice(l.map((x) => x.q.id), `${STATUS[s].label} 錯題`)) }, icon('ln-play'))));
      }
      for (const x of l) {
        const i = rows.length;
        rows.push(x.q);
        const r = x.r;
        const due = r.b > 0 && (r.d || 0) <= Date.now();
        out.push(h('div', { class: 'linear-row', role: 'option', id: `linear-r${i}`, 'aria-selected': i === st.sel ? 'true' : 'false', dataset: { i: String(i) },
          onmousemove: () => { if (st.sel !== i) select(i, false); }, onclick: () => { select(i, false); openDetail(i); } },
          prioIcon(r.w),
          h('span', { class: 'linear-id', text: ident(x.q) }),
          h('span', { title: `${STATUS[x.s].label}・錯題盒 ${r.b || '—'}` }, statusIcon(x.s, r)),
          h('span', { class: 'linear-title', text: x.q.q }),
          h('span', { class: 'linear-row-labels' }, topics(x.q).slice(0, 2).map(label)),
          due && st.mode !== 'inbox' ? h('span', { class: 'linear-due', title: '已到期，等待複習', text: '到期' }) : h('span'),
          h('span', { class: 'linear-subj', title: QG.SUBJ[x.q.s] }, h('i', { class: 's-' + x.q.s }), QG.SUBJ_CODE[x.q.s]),
          h('time', { class: 'linear-time', title: r.t ? new Date(r.t).toLocaleString('zh-TW') : '', text: shortTime(r.t) })));
      }
    }
    st.sel = Math.min(st.sel, rows.length - 1);
    fill(listEl, out);
    listEl.setAttribute('aria-activedescendant', `linear-r${st.sel}`);
  }

  function select(i, scroll) {
    if (!rows.length) return;
    st.sel = Math.max(0, Math.min(rows.length - 1, i));
    if (!listEl) return;
    listEl.querySelectorAll('.linear-row').forEach((el) => el.setAttribute('aria-selected', el.dataset.i === String(st.sel) ? 'true' : 'false'));
    listEl.setAttribute('aria-activedescendant', `linear-r${st.sel}`);
    const el = listEl.querySelector(`#linear-r${st.sel}`);
    if (el && scroll) el.scrollIntoView({ block: 'nearest' });
  }

  /* ---------------------------------------------------------------- 詳細面板 */
  function prop(name, ...val) {
    return h('div', { class: 'linear-prop' }, h('span', { class: 'linear-prop-k', text: name }), h('span', { class: 'linear-prop-v' }, val));
  }

  function openDetail(i, q0) {
    const q = q0 || rows[i];
    if (!q) return;
    closeDetail(true);
    const r = S().q[q.id] || { c: 0, w: 0 };
    const s = statusOf(r);
    const result = h('div', { class: 'linear-result', hidden: true, 'aria-live': 'polite' });
    const activity = h('ol', { class: 'linear-acts' },
      h('li', null, h('span', { class: 'linear-act-dot' }), h('span', { text: r.c + r.w ? `你作答過 ${r.c + r.w} 次：答對 ${r.c}、答錯 ${r.w}` : '你還沒有作答過這題' })),
      r.t ? h('li', null, h('span', { class: 'linear-act-dot' }), h('span', { text: `最後作答 ${SK.relTime(r.t)}` })) : null,
      r.b > 0 && r.d ? h('li', null, h('span', { class: 'linear-act-dot' }), h('span', { text: r.d <= Date.now() ? '已到期，等待複習' : `排定 ${new Date(r.d).toLocaleDateString('zh-TW')} 複習` })) : null);
    const opts = SK.answerOptions(q, { cls: 'linear-opts', onDone: (ok, L) => {
      fill(result,
        h('p', { class: 'linear-result-h ' + (ok ? 'ok' : 'ng') }, ok ? '✓ 答對了' : '✗ 答錯了', h('span', { class: 'muted', text: `　你選 ${L}` })),
        h('p', { text: q.all ? '官方釋疑：所有選項均給分。' : `正確答案：${q.a.map((x) => `${x}. ${q.o[x]}`).join('；')}` }),
        q.x ? h('p', { class: 'linear-x', text: q.x }) : null);
      result.hidden = false;
      activity.append(h('li', { class: 'new' }, h('span', { class: 'linear-act-dot ' + (ok ? 'ok' : 'ng') }), h('span', { text: `剛剛 你回答 ${L}，${ok ? '答對' : '答錯，已列入 Backlog'}` })));
      if (detail) detail.dirty = true;
    } });
    const others = rows.length > 1 && !q0;
    const el = h('aside', { class: 'linear-detail', role: 'dialog', 'aria-modal': 'false', 'aria-label': `${ident(q)} 詳細內容`, tabindex: '-1' },
      h('header', { class: 'linear-dhead' },
        h('span', { class: 'linear-subj' }, h('i', { class: 's-' + q.s }), QG.SUBJ_CODE[q.s]),
        h('span', { class: 'linear-sep', text: '›' }), h('span', { class: 'linear-id', text: ident(q) }),
        h('span', { class: 'spacer' }),
        others ? h('span', { class: 'linear-dpos mono', text: `${i + 1} / ${rows.length}` }) : null,
        others ? h('button', { class: 'linear-iconbtn', type: 'button', 'aria-label': '上一個（K）', title: '上一個 K', onclick: () => step(-1) }, icon('ln-up')) : null,
        others ? h('button', { class: 'linear-iconbtn', type: 'button', 'aria-label': '下一個（J）', title: '下一個 J', onclick: () => step(1) }, icon('ln-down')) : null,
        h('button', { class: 'linear-iconbtn', type: 'button', 'aria-label': '關閉（Esc）', title: '關閉 Esc', onclick: () => closeDetail() }, icon('close'))),
      h('div', { class: 'linear-dbody' },
        h('div', { class: 'linear-dmain' },
          h('h2', { class: 'linear-dtitle', text: q.q }),
          q.fig ? h('figure', { class: 'qfig linear-fig' }, h('img', { src: q.fig, alt: '題目附圖', loading: 'lazy' })) : null,
          h('p', { class: 'linear-dsub' }, '選出答案　', kbd('1'), kbd('2'), kbd('3'), kbd('4')),
          opts, result,
          h('section', { class: 'linear-activity' }, h('h3', { text: '活動' }), activity)),
        h('aside', { class: 'linear-props', 'aria-label': '屬性' },
          prop('狀態', statusIcon(s, r), h('span', { text: STATUS[s].label })),
          prop('答錯次數', prioIcon(r.w || 0), h('span', { text: String(r.w || 0) })),
          prop('標籤', topics(q).length ? topics(q).map(label) : h('span', { class: 'muted', text: '無' })),
          prop('科目', h('span', { class: 'linear-subj' }, h('i', { class: 's-' + q.s }), `${QG.SUBJ_CODE[q.s]} ${QG.SUBJ_SHORT[q.s]}`)),
          prop('複習盒', h('span', { class: 'mono', text: r.m ? '已熟練' : r.b ? `${r.b} / 5` : '—' })),
          prop('下次複習', h('span', { text: r.b > 0 && r.d ? (r.d <= Date.now() ? '已到期' : new Date(r.d).toLocaleDateString('zh-TW')) : '—' })),
          prop('出處', h('span', { class: 'linear-srcs' }, q.src.map((x) => h('span', { text: QG.srcLabel(x) })))),
          prop('最後作答', h('span', { text: r.t ? SK.relTime(r.t) : '—' })),
          h('div', { class: 'linear-dactions' },
            SK.starBtn(q, 'linear-btn linear-star', 'star'),
            h('button', { class: 'linear-btn', type: 'button', onclick: () => SK.copyQuestion(q) }, icon('ln-copy'), '複製'),
            s === 'todo' ? h('button', { class: 'linear-btn', type: 'button', onclick: () => SK.addToReview(q) }, icon('review'), '加入錯題本') : null))));
    const app = document.getElementById('app');
    (app.querySelector('.linear-view') || document.body).append(el);
    const scrim = h('div', { class: 'linear-scrim', onclick: () => closeDetail() });
    el.before(scrim);
    detail = { el, scrim, q, opts, i, dirty: false };
    st.open = q.id;
    requestAnimationFrame(() => { el.classList.add('in'); el.focus({ preventScroll: true }); });
  }

  function step(d) {
    if (!detail || !rows.length) return;
    const i = Math.max(0, Math.min(rows.length - 1, detail.i + d));
    if (i === detail.i) return;
    const dirty = detail.dirty;
    select(i, true);
    openDetail(i);
    if (dirty) detail.dirty = true;
  }

  function closeDetail(silent) {
    if (!detail) return;
    const { el, scrim, dirty } = detail;
    detail = null;
    st.open = null;
    scrim.remove();
    if (reduced() || silent) el.remove();
    else { el.classList.remove('in'); el.classList.add('out'); setTimeout(() => el.remove(), 180); }
    if (!silent) {
      if (dirty) {
        // 作答會改變狀態與時間：重畫清單與側欄
        const keep = st.sel;
        QG.render();
        select(keep, true);
      }
      if (listEl) listEl.focus({ preventScroll: true });
    }
  }

  /* ---------------------------------------------------------------- ⌘K 指令選單 */
  let cmd = null;
  function openCmd(mode) {
    if (cmd) { cmd.close(); return; }
    let m = mode || 'cmd';
    let active = 0;
    let items = [];
    const input = h('input', { type: 'text', id: 'linear-cmd-q', class: 'linear-cmd-in', autocomplete: 'off', 'aria-label': '輸入指令或搜尋', 'aria-controls': 'linear-cmd-list' });
    const tag = h('span', { class: 'linear-cmd-tag', hidden: true, text: '搜尋題目' });
    const list = h('ul', { class: 'linear-cmd-list', id: 'linear-cmd-list', role: 'listbox' });
    const ACTIONS = () => [
      { g: '練習', ico: 'ln-play', text: '開始練習', sub: QG.filterLabel(S().settings.filters), keys: [], run: () => { QG.ensurePractice(); SK.go('practice'); } },
      { g: '練習', ico: 'review', text: '開始複習', sub: QG.dueReviewIds().length ? `${QG.dueReviewIds().length} 題到期` : '目前沒有到期錯題', keys: [],
        run: () => (QG.dueReviewIds().length ? QG.startReview() : QG.toast('目前沒有到期的錯題')) },
      { g: '練習', ico: 'exam', text: '模擬考', sub: `${QG.EXAM_LEN} 題・${QG.EXAM_MIN} 分鐘`, keys: [], run: () => SK.go('exam') },
      { g: '練習', ico: 'search', text: '搜尋題目…', sub: `全題庫 ${QG.QS.length} 題`, keys: [], stay: true, run: () => { setMode2('search'); } },
      { g: '前往', ico: 'ln-inbox', text: '前往收件匣', keys: ['G', 'I'], run: () => setMode('inbox') },
      { g: '前往', ico: 'ln-issues', text: '前往我的錯題', keys: ['G', 'M'], run: () => { st.label = ''; setMode('mine'); } },
      { g: '前往', ico: 'ln-layers', text: '前往 Backlog', keys: ['G', 'B'], run: () => { st.label = ''; setMode('mine', 'backlog'); } },
      { g: '前往', ico: 'ln-layers', text: '前往 In Progress', keys: ['G', 'P'], run: () => { st.label = ''; setMode('mine', 'progress'); } },
      { g: '前往', ico: 'browse', text: '前往題庫', keys: [], run: () => SK.go('browse') },
      { g: '前往', ico: 'stats', text: '前往統計', keys: [], run: () => SK.go('stats') },
    ];
    function setMode2(x) {
      m = x;
      tag.hidden = m !== 'search';
      input.placeholder = m === 'search' ? '輸入關鍵字，例如：蝕刻、ENIG、乾膜' : '輸入指令，或直接打字搜尋題目…';
      input.value = '';
      active = 0;
      draw();
      input.focus();
    }
    function draw() {
      const v = input.value.trim().toLowerCase();
      const acts = m === 'search' ? [] : ACTIONS().filter((a) => !v || a.text.toLowerCase().includes(v) || (a.sub || '').toLowerCase().includes(v));
      const qs = v ? QG.QS.filter((q) => q.text.includes(v)).slice(0, m === 'search' ? 30 : 6)
        .map((q) => ({ g: '題目', q, text: q.q, sub: ident(q), run: () => openQuestion(q) })) : [];
      items = acts.concat(qs);
      if (v && qs.length && m !== 'search') items.push({ g: '題目', ico: 'browse', text: `在題庫搜尋「${input.value.trim()}」`, run: () => { Object.assign(QG.browse, { kw: input.value.trim(), tag: '', exam: '', subject: 'all', only: 'all', page: 0 }); SK.go('browse'); } });
      active = Math.min(active, Math.max(0, items.length - 1));
      let last = '';
      const out = [];
      items.forEach((it, i) => {
        if (it.g !== last) { out.push(h('li', { class: 'linear-cmd-g', role: 'presentation', text: it.g })); last = it.g; }
        out.push(h('li', { class: 'linear-cmd-item', role: 'option', id: `linear-c${i}`, 'aria-selected': i === active ? 'true' : 'false',
          onmousemove: () => { if (active !== i) { active = i; mark(); } }, onclick: () => runIt(it) },
          it.q ? statusIcon(statusOf(S().q[it.q.id]), S().q[it.q.id]) : icon(it.ico),
          h('span', { class: 'linear-cmd-t' }, v ? SK.highlight(it.text, v) : it.text),
          it.sub ? h('span', { class: 'linear-cmd-sub', text: it.sub }) : null,
          it.keys && it.keys.length ? h('span', { class: 'linear-cmd-keys' }, kbd(...it.keys)) : null));
      });
      if (!items.length) out.push(h('li', { class: 'linear-cmd-empty', text: v ? '沒有符合的指令或題目' : '輸入關鍵字開始搜尋' }));
      fill(list, out);
      input.setAttribute('aria-activedescendant', items.length ? `linear-c${active}` : '');
    }
    const mark = () => {
      list.querySelectorAll('.linear-cmd-item').forEach((li) => li.setAttribute('aria-selected', li.id === `linear-c${active}` ? 'true' : 'false'));
      input.setAttribute('aria-activedescendant', `linear-c${active}`);
      const el = list.querySelector(`#linear-c${active}`);
      if (el) el.scrollIntoView({ block: 'nearest' });
    };
    function runIt(it) {
      if (!it) return;
      if (!it.stay) close();
      it.run();
    }
    input.addEventListener('input', () => { active = 0; draw(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) { e.preventDefault(); active = (active + 1) % Math.max(1, items.length); mark(); }
      else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) { e.preventDefault(); active = (active - 1 + items.length) % Math.max(1, items.length); mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); runIt(items[active]); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (m === 'search' && !mode) setMode2('cmd'); else close(); }
      else if (e.key === 'Backspace' && !input.value && m === 'search' && !mode) { setMode2('cmd'); }
    });
    const back = h('div', { class: 'linear-cmd-back', onclick: (e) => { if (e.target === back) close(); } },
      h('div', { class: 'linear-cmd', role: 'dialog', 'aria-modal': 'true', 'aria-label': '指令選單' },
        h('div', { class: 'linear-cmd-head' }, h('span', { class: 'linear-cmd-ctx', text: 'QuizGrinder' }), tag),
        h('div', { class: 'linear-cmd-input' }, input),
        list,
        h('div', { class: 'linear-cmd-foot' }, h('span', null, kbd('↑'), kbd('↓'), ' 選擇'), h('span', null, kbd('Enter'), ' 執行'), h('span', null, kbd('Esc'), ' 關閉'))));
    const prevFocus = document.activeElement;
    function close() {
      if (!back.isConnected) return;
      back.remove();
      cmd = null;
      if (prevFocus && prevFocus.isConnected) prevFocus.focus({ preventScroll: true });
    }
    document.body.append(back);
    cmd = { close };
    setMode2(m);
  }

  function openQuestion(q) {
    if (QG.currentView !== 'home') { st.open = q.id; SK.go('home'); return; }
    const i = rows.findIndex((x) => x.id === q.id);
    if (i >= 0) { select(i, true); openDetail(i); } else openDetail(-1, q);
  }

  /* ---------------------------------------------------------------- 鍵盤 */
  let gAt = 0;
  document.addEventListener('keydown', (e) => {
    if (!on()) return;
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopPropagation(); openCmd(); return; }
    if (cmd || document.body.classList.contains('mx-open')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable)) {
      if (e.key === 'Escape' && t.id === 'linear-filter') {
        e.preventDefault();
        if (t.value) { t.value = ''; st.kw = ''; t.dispatchEvent(new Event('input')); } else t.blur();
      }
      return;
    }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const done = () => { e.preventDefault(); e.stopPropagation(); };
    if (gAt && Date.now() - gAt < 1500) {
      gAt = 0;
      const map = { i: ['inbox'], m: ['mine'], b: ['mine', 'backlog'], p: ['mine', 'progress'] };
      if (map[k]) { done(); if (k !== 'i') st.label = ''; setMode(...map[k]); return; }
    }
    if (k === 'g' && !e.shiftKey) { gAt = Date.now(); if (QG.currentView === 'home') done(); return; }
    if (QG.currentView !== 'home') return;
    if (detail) {
      if (k === 'Escape') { done(); closeDetail(); }
      else if ('1234'.includes(k)) { done(); detail.opts.pick(+k - 1); }
      else if ('abcd'.includes(k) && k.length === 1) { done(); detail.opts.pick('abcd'.indexOf(k)); }
      else if (k === 'j' || k === 'ArrowDown') { done(); step(1); }
      else if (k === 'k' || k === 'ArrowUp') { done(); step(-1); }
      return;
    }
    if (k === '/') { done(); const f = document.getElementById('linear-filter'); if (f) f.focus(); }
    else if (k === 'j' || k === 'ArrowDown') { done(); select(st.sel + 1, true); }
    else if (k === 'k' || k === 'ArrowUp') { done(); select(st.sel - 1, true); }
    else if (k === 'Enter' || k === 'o') { if (t && t.tagName === 'BUTTON') return; if (rows.length) { done(); openDetail(st.sel); } }
    else if (k === 'Escape' && (st.kw || st.label || st.status !== 'all')) { done(); st.kw = ''; st.label = ''; st.status = 'all'; QG.render(); }
  }, true);

  /* ---------------------------------------------------------------- 註冊 */
  SK.register({
    id: 'linear', label: 'Linear 風', group: '科技業',
    top, side,
    nav: [
      { v: 'home', label: '錯題', icon: 'ln-issues' },
      { v: 'practice', label: '練習', icon: 'ln-layers' },
      { v: 'review', label: '複習', icon: 'review', badge: true },
      { v: 'exam', label: '模擬考', icon: 'exam' },
      { v: 'browse', label: '題庫', icon: 'browse' },
      { v: 'stats', label: '統計', icon: 'stats' },
    ],
    views: { home },
    after: (view) => {
      if (cmd) cmd.close();
      if (view !== 'home') { detail = null; listEl = null; rows = []; return; }
      if (st.open) {
        const id = st.open;
        st.open = null;
        const q = QG.QMAP.get(id);
        if (q) openQuestion(q);
      }
    },
  });

  const prevBefore = QG.hooks.beforeRender;
  QG.hooks.beforeRender = (view) => { if (detail) { const d = detail; detail = null; d.scrim.remove(); d.el.remove(); } prevBefore(view); };
})();
