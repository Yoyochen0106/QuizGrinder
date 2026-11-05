/* QuizGrinder 版面風格：Vercel 風（部署儀表板）
 *
 *   頂部：焊墊標誌／我的學習／專案切換器（麵包屑）＋分頁列
 *   概覽：用量卡（近 14 天作答長條）、最近的練習紀錄、專案卡片（科目與主題：近況折線、正確率、進度）
 *   練習紀錄：每個有作答的日子＝一筆 Preview 部署、每場模擬考＝一筆 Production 部署；
 *            依正確率標示 Ready（≥80%）／Warning（60–80%）／Error（<60%），可依全部／練習／模擬考篩選
 *   部署詳情：屬性、建置紀錄風格的等寬時間軸（只列真實彙總）、Redeploy＝再開一輪練習或模擬考
 * 只借用版面、互動與配色；標誌用 QuizGrinder 焊墊圖示。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon, hue } = SK;
  const S = () => QG.S();
  const DAY = 864e5;

  Object.assign(SK.ICONS, {
    'vc-slash': '<path d="M16 3L8 21"/>',
    'vc-updown': '<path d="M8 9l4-4 4 4M8 15l4 4 4-4"/>',
    'vc-redeploy': '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
    'vc-branch': '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10M18 10c0 4-6 3-12 7"/>',
    'vc-chev': '<path d="M9 6l6 6-6 6"/>',
    'vc-back': '<path d="M15 6l-6 6 6 6"/>',
    'vc-check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'vc-term': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/>',
    'vc-plus': '<path d="M12 5v14M5 12h14"/>',
  });

  /* ---------------------------------------------------------------- 狀態 */
  const st = { sub: 'overview', filter: 'all', key: null, proj: null, kw: '', back: 'deploys' };
  const go = (patch) => { Object.assign(st, patch); closePop(); if (QG.currentView === 'home') { QG.render(); window.scrollTo(0, 0); } else SK.go('home'); };

  /* ---------------------------------------------------------------- 資料 */
  const pctN = (c, n) => (n ? Math.round((c / n) * 1000) / 10 : 0);
  const level = (p) => (p >= 80 ? 'ready' : p >= 60 ? 'warn' : 'error');
  const LEVEL = { ready: 'Ready', warn: 'Warning', error: 'Error' };
  const dateOf = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const md = (d) => `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}`;
  const hms = (d) => d.toLocaleTimeString('zh-TW', { hour12: false });
  const fmtDur = (s) => `${Math.floor(s / 60)} 分 ${String(s % 60).padStart(2, '0')} 秒`;
  const dayAgo = (k) => {
    const diff = Math.round((dateOf(QG.dayKey()) - dateOf(k)) / DAY);
    return diff <= 0 ? '今天' : diff === 1 ? '昨天' : `${diff} 天前`;
  };

  /** 由真實紀錄重建的部署清單 */
  function deployments() {
    const out = [];
    const st0 = S();
    for (const [k, v] of Object.entries(st0.days || {})) {
      if (!v || !v.n) continue;
      const end = Math.min(Date.now(), dateOf(k).getTime() + DAY - 1);
      const p = pctN(v.c, v.n);
      out.push({ id: 'd-' + k, type: 'practice', key: k, ts: end, n: v.n, c: v.c, p, lv: level(p), name: `練習 ${md(dateOf(k))}`, sha: k.replace(/-/g, '') });
    }
    (st0.exams || []).forEach((e) => {
      out.push({ id: 'e-' + e.ts, type: 'exam', ts: e.ts, n: e.total, c: e.correct, p: e.score, lv: level(e.score), e,
        name: `模擬考 ${QG.SUBJ_CODE[e.subject]}`, sha: e.ts.toString(16).slice(-7) });
    });
    return out.sort((a, b) => b.ts - a.ts);
  }

  function projects() {
    const list = [
      { key: 'L11', name: `L11 ${QG.SUBJ_SHORT.industry}`, slug: 'l11-industry', test: (q) => q.s === 'industry', subj: true },
      { key: 'L12', name: `L12 ${QG.SUBJ_SHORT.process}`, slug: 'l12-process', test: (q) => q.s === 'process', subj: true },
    ];
    QG.TAGS.filter(([t]) => t !== '其他').forEach(([t], i) => list.push({ key: t, name: t, slug: `topic-${String(i + 1).padStart(2, '0')}`, test: (q) => q.t.includes(t) }));
    return list;
  }
  function projStats(p) {
    const qs = QG.QS.filter(p.test);
    const ids = qs.map((q) => q.id);
    const pr = SK.progressOf(ids);
    const sq = S().q;
    let last = 0, wrong = 0, mastered = 0;
    const boxes = [0, 0, 0, 0, 0, 0];
    const spark = new Array(14).fill(0);
    const today0 = dateOf(QG.dayKey()).getTime();
    for (const id of ids) {
      const r = sq[id];
      if (!r) continue;
      if (r.t) {
        last = Math.max(last, r.t);
        const ago = Math.floor((today0 + DAY - 1 - r.t) / DAY);
        if (ago >= 0 && ago < 14) spark[13 - ago]++;
      }
      if (r.b > 0) { wrong++; boxes[r.b]++; }
      if (r.m) mastered++;
    }
    return { ids, total: ids.length, seen: pr.seen, c: pr.c, n: pr.n, p: pctN(pr.c, pr.n), last, wrong, mastered, boxes, spark };
  }

  function last14() {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    const out = [];
    for (let i = 0; i < 14; i++) { const k = QG.dayKey(d); out.push({ k, d: new Date(d), ...(S().days[k] || { n: 0, c: 0 }) }); d.setDate(d.getDate() + 1); }
    return out;
  }

  /* ---------------------------------------------------------------- 小元件 */
  const dot = (lv) => h('span', { class: 'vercel-dot ' + lv, 'aria-hidden': 'true' });
  const status = (lv) => h('span', { class: 'vercel-status' }, dot(lv), h('span', { text: LEVEL[lv] }));
  const env = (d) => h('span', { class: 'vercel-env ' + (d.type === 'exam' ? 'vercel-env-prod' : 'vercel-env-prev'), text: d.type === 'exam' ? 'Production' : 'Preview' });
  const projAv = (name) => h('span', { class: 'vercel-pav', style: `--h:${hue(name)}`, 'aria-hidden': 'true', text: name.replace(/^L1[12]\s*/, '').slice(0, 1) });

  function sparkSvg(vals, cls, label) {
    const w = 120, hh = 28, max = Math.max(1, ...vals);
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${(hh - 3 - (v / max) * (hh - 6)).toFixed(1)}`).join(' ');
    const span = document.createElement('span');
    span.className = 'vercel-spark ' + (cls || '');
    span.setAttribute('role', 'img');
    span.setAttribute('aria-label', label);
    span.title = label;
    span.innerHTML = `<svg viewBox="0 0 ${w} ${hh}" preserveAspectRatio="none"><polyline points="0,${hh} ${pts} ${w},${hh}" class="area"/><polyline points="${pts}" class="line"/></svg>`;
    return span;
  }

  function barsSvg(days) {
    const max = Math.max(1, ...days.map((d) => d.n));
    const span = document.createElement('span');
    span.className = 'vercel-bars';
    span.setAttribute('role', 'img');
    span.setAttribute('aria-label', '近 14 天每日作答題數：' + days.map((d) => `${md(d.d)} ${d.n} 題`).join('、'));
    span.innerHTML = '<svg viewBox="0 0 140 48" preserveAspectRatio="none">' + days.map((d, i) => {
      const hh = d.n ? Math.max(2, (d.n / max) * 44) : 1;
      const cls = d.n ? level(pctN(d.c, d.n)) : 'none';
      return `<rect x="${i * 10 + 1}" y="${48 - hh}" width="8" height="${hh}" rx="1.5" class="${cls}"><title>${md(d.d)}：${d.n} 題${d.n ? `，正確率 ${Math.round(pctN(d.c, d.n))}%` : ''}</title></rect>`;
    }).join('') + '</svg>';
    return span;
  }

  /* ---------------------------------------------------------------- 頂部與專案切換器 */
  let pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; document.removeEventListener('click', outside, true); document.removeEventListener('keydown', popKey, true); } }
  const outside = (e) => { if (pop && !pop.contains(e.target) && !e.target.closest('.vercel-switch')) closePop(); };
  const popKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); const b = document.querySelector('.vercel-switch'); closePop(); if (b) b.focus(); } };

  function openSwitcher(btn) {
    if (pop) { closePop(); return; }
    const input = h('input', { type: 'text', class: 'vercel-pop-in', placeholder: '搜尋專案…', 'aria-label': '搜尋專案', autocomplete: 'off' });
    const list = h('div', { class: 'vercel-pop-list', role: 'listbox' });
    const all = projects();
    const draw = () => {
      const v = input.value.trim().toLowerCase();
      fill(list,
        !v ? h('button', { type: 'button', class: 'vercel-pop-item', role: 'option', 'aria-selected': st.sub !== 'project' ? 'true' : 'false', onclick: () => go({ sub: 'overview', proj: null }) },
          h('span', { class: 'vercel-pav all', 'aria-hidden': 'true' }, icon('pad')), h('span', { text: '所有專案' }), st.sub !== 'project' ? icon('vc-check') : null) : null,
        h('p', { class: 'vercel-pop-h', text: '專案' }),
        all.filter((p) => !v || p.name.toLowerCase().includes(v)).map((p) => h('button', { type: 'button', class: 'vercel-pop-item', role: 'option',
          'aria-selected': st.sub === 'project' && st.proj === p.key ? 'true' : 'false', onclick: () => go({ sub: 'project', proj: p.key }) },
          projAv(p.name), h('span', { text: p.name }), st.sub === 'project' && st.proj === p.key ? icon('vc-check') : null)));
    };
    input.addEventListener('input', draw);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); const f = list.querySelector('.vercel-pop-item'); if (f) f.focus(); }
      if (e.key === 'Enter') { e.preventDefault(); const f = list.querySelector('.vercel-pop-item'); if (f) f.click(); }
    });
    list.addEventListener('keydown', (e) => {
      const items = [...list.querySelectorAll('.vercel-pop-item')];
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[i]).focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (i <= 0) input.focus(); else items[i - 1].focus(); }
    });
    pop = h('div', { class: 'vercel-pop', role: 'dialog', 'aria-label': '切換專案' }, h('div', { class: 'vercel-pop-search' }, icon('search'), input), list);
    draw();
    const r = btn.getBoundingClientRect();
    pop.style.top = `${r.bottom + 6}px`;
    pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 296))}px`;
    document.body.append(pop);
    input.focus();
    document.addEventListener('click', outside, true);
    document.addEventListener('keydown', popKey, true);
  }

  function top(view) {
    const proj = st.sub === 'project' && view === 'home' ? projects().find((p) => p.key === st.proj) : null;
    const tab = (lbl, v, sub) => {
      const cur = v === 'home' ? view === 'home' && (sub === 'deploys' ? ['deploys', 'detail'].includes(st.sub) : !['deploys', 'detail'].includes(st.sub)) : SK.isCurrent(view, v);
      return h('a', { class: 'vercel-tab', href: '#' + v, 'aria-current': cur ? 'page' : null,
        onclick: sub ? (e) => { e.preventDefault(); go({ sub, proj: sub === 'overview' ? null : st.proj }); } : null }, lbl, v === 'review' ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null);
    };
    return h('div', { class: 'sk-top vercel-top' },
      h('div', { class: 'vercel-bar' },
        h('a', { class: 'vercel-logo', href: '#home', 'aria-label': 'QuizGrinder 首頁', onclick: (e) => { e.preventDefault(); go({ sub: 'overview', proj: null }); } }, icon('pad')),
        h('span', { class: 'vercel-slash', 'aria-hidden': 'true' }, icon('vc-slash')),
        h('span', { class: 'vercel-team' }, h('span', { class: 'vercel-team-av', 'aria-hidden': 'true' }), h('span', { class: 'vercel-team-n', text: '我的學習' }), h('span', { class: 'vercel-plan', text: '個人' })),
        h('span', { class: 'vercel-slash', 'aria-hidden': 'true' }, icon('vc-slash')),
        h('button', { type: 'button', class: 'vercel-switch', 'aria-haspopup': 'dialog', 'aria-label': `切換專案（目前：${proj ? proj.name : '所有專案'}）`, onclick: (e) => openSwitcher(e.currentTarget) },
          proj ? projAv(proj.name) : null, h('span', { class: 'vercel-switch-n', text: proj ? proj.name : '所有專案' }), icon('vc-updown')),
        h('div', { class: 'sk-right' },
          h('a', { class: 'vercel-toplink', href: '#browse', text: '題庫' }),
          h('a', { class: 'vercel-avatar', href: '#stats', 'aria-label': '我的統計' }))),
      h('nav', { class: 'vercel-tabs', 'aria-label': '主要功能' },
        tab('概覽', 'home', 'overview'), tab('練習紀錄', 'home', 'deploys'), tab('練習', 'practice'), tab('錯題本', 'review'), tab('模擬考', 'exam'), tab('題庫', 'browse'), tab('統計', 'stats')));
  }

  /* ---------------------------------------------------------------- 概覽 */
  function deployRow(d) {
    const sub = d.type === 'exam' ? `${QG.SUBJ[d.e.subject]}・${d.n} 題` : `${d.n} 題・答對 ${d.c}`;
    return h('a', { class: 'vercel-row', href: '#home', onclick: (e) => { e.preventDefault(); go({ sub: 'detail', key: d.id, back: st.sub === 'overview' ? 'overview' : 'deploys' }); } },
      h('span', { class: 'vercel-row-id' }, h('b', { class: 'mono', text: d.sha }), env(d)),
      h('span', { class: 'vercel-row-st' }, status(d.lv), h('small', { class: 'muted', text: d.type === 'exam' ? fmtDur(d.e.dur || 0) : `${d.n} 題` })),
      h('span', { class: 'vercel-row-main' }, h('span', { class: 'vercel-row-name' }, icon(d.type === 'exam' ? 'exam' : 'vc-branch'), h('b', { text: d.name })), h('small', { class: 'muted', text: sub })),
      h('span', { class: 'vercel-row-score' }, h('b', { class: 'mono', text: d.type === 'exam' ? `${d.p} 分` : `${Math.round(d.p)}%` }), h('small', { class: 'muted', text: d.type === 'exam' ? '得分' : '正確率' })),
      h('span', { class: 'vercel-row-time' }, h('span', { text: d.type === 'exam' ? SK.relTime(d.ts) : dayAgo(d.key) }), h('small', { class: 'muted', text: '由你' })),
      h('span', { class: 'vercel-row-go', 'aria-hidden': 'true' }, icon('vc-chev')));
  }

  function emptyDeploys(msg) {
    return h('div', { class: 'vercel-empty' }, h('span', { class: 'vercel-empty-ico' }, icon('vc-term')),
      h('b', { text: msg || '還沒有任何部署' }), h('p', { class: 'muted', text: '每天的練習會成為一筆 Preview 部署，每場模擬考會成為一筆 Production 部署。' }),
      h('div', { class: 'vercel-btns' },
        h('button', { type: 'button', class: 'vercel-btn primary', onclick: () => { QG.ensurePractice(); SK.go('practice'); } }, '開始練習'),
        h('a', { class: 'vercel-btn', href: '#exam', text: '模擬考' })));
  }

  function projectCard(p) {
    const s = projStats(p);
    const lv = s.n ? level(s.p) : 'none';
    return h('a', { class: 'vercel-proj', href: '#home', onclick: (e) => { e.preventDefault(); go({ sub: 'project', proj: p.key }); } },
      h('div', { class: 'vercel-proj-head' }, projAv(p.name),
        h('span', { class: 'vercel-proj-t' }, h('b', { text: p.name }), h('small', { class: 'mono', text: `${p.slug}・${s.total} 題` })),
        h('span', { class: 'vercel-proj-dot', title: s.n ? `${LEVEL[lv]}：正確率 ${s.p}%` : '尚未作答' }, dot(lv))),
      sparkSvg(s.spark, s.n ? lv : 'none', `${p.name} 近 14 天作答題數（依每題最後作答日）`),
      h('div', { class: 'vercel-proj-foot' },
        h('span', null, h('b', { class: 'mono', text: s.n ? `${Math.round(s.p)}%` : '—' }), ' 正確率'),
        h('span', { class: 'vercel-prog', title: `已練 ${s.seen} / ${s.total}` }, h('i', { style: `width:${Math.round((s.seen / Math.max(1, s.total)) * 100)}%` })),
        h('span', { class: 'muted', text: s.last ? SK.relTime(s.last) : '尚未作答' })));
  }

  function overview() {
    const deps = deployments();
    const days = last14();
    const sum = days.reduce((a, d) => ({ n: a.n + d.n, c: a.c + d.c }), { n: 0, c: 0 });
    const t = QG.totals();
    const input = h('input', { type: 'search', class: 'vercel-search-in', placeholder: '搜尋專案…', value: st.kw, 'aria-label': '搜尋專案' });
    const grid = h('div', { class: 'vercel-projs' });
    const drawGrid = () => {
      const v = input.value.trim().toLowerCase();
      const list = projects().filter((p) => !v || p.name.toLowerCase().includes(v));
      fill(grid, list.length ? list.map(projectCard) : h('p', { class: 'muted vercel-none', text: '沒有符合的專案' }));
    };
    input.addEventListener('input', () => { st.kw = input.value; drawGrid(); });
    drawGrid();
    return h('div', { class: 'vercel-wrap' },
      h('div', { class: 'vercel-toolbar' },
        h('label', { class: 'vercel-search' }, icon('search'), input),
        h('button', { type: 'button', class: 'vercel-btn primary', onclick: () => { QG.ensurePractice(); SK.go('practice'); } }, icon('vc-plus'), h('span', { text: '新增練習…' }))),
      h('div', { class: 'vercel-cols' },
        h('aside', { class: 'vercel-aside' },
          h('section', { class: 'vercel-card' },
            h('div', { class: 'vercel-card-h' }, h('b', { text: '用量' }), h('span', { class: 'muted', text: '近 14 天' })),
            barsSvg(days),
            h('dl', { class: 'vercel-usage' },
              h('div', null, h('dt', { text: '作答' }), h('dd', { class: 'mono', text: `${QG.fmtNum(sum.n)} 題` })),
              h('div', null, h('dt', { text: '正確率' }), h('dd', { class: 'mono', text: sum.n ? `${Math.round(pctN(sum.c, sum.n))}%` : '—' })),
              h('div', null, h('dt', { text: '連續天數' }), h('dd', { class: 'mono', text: `${QG.streak()} 天` })),
              h('div', null, h('dt', { text: '累積已練' }), h('dd', { class: 'mono', text: `${QG.fmtNum(t.seen)} / ${QG.fmtNum(QG.QS.length)}` })))),
          h('section', { class: 'vercel-card' },
            h('div', { class: 'vercel-card-h' }, h('b', { text: '最近的練習紀錄' })),
            deps.length ? h('div', { class: 'vercel-mini' }, deps.slice(0, 4).map((d) => h('a', { class: 'vercel-mini-row', href: '#home',
              onclick: (e) => { e.preventDefault(); go({ sub: 'detail', key: d.id, back: 'overview' }); } },
              dot(d.lv), h('span', { class: 'vercel-mini-t' }, h('b', { text: d.name }), h('small', { class: 'muted', text: `${d.type === 'exam' ? `${d.p} 分` : `${Math.round(d.p)}%`}・${d.type === 'exam' ? SK.relTime(d.ts) : dayAgo(d.key)}` })), env(d))))
              : h('p', { class: 'muted vercel-none', text: '還沒有紀錄。' }),
            h('button', { type: 'button', class: 'vercel-link', onclick: () => go({ sub: 'deploys' }) }, '查看全部練習紀錄', icon('vc-chev')))),
        h('section', { class: 'vercel-main', 'aria-label': '專案' }, grid)));
  }

  /* ---------------------------------------------------------------- 練習紀錄 */
  function deploysPage() {
    const all = deployments();
    const list = all.filter((d) => st.filter === 'all' || (st.filter === 'exam' ? d.type === 'exam' : d.type === 'practice'));
    const n = { all: all.length, practice: all.filter((d) => d.type === 'practice').length, exam: all.filter((d) => d.type === 'exam').length };
    return h('div', { class: 'vercel-wrap' },
      h('header', { class: 'vercel-head' }, h('div', null, h('h1', { text: '練習紀錄' }), h('p', { class: 'muted', text: '每天的練習與每場模擬考，從你的學習紀錄重建。' }))),
      h('div', { class: 'vercel-filters' },
        h('div', { class: 'vercel-seg', role: 'tablist', 'aria-label': '類型' }, [['all', '全部'], ['practice', '練習'], ['exam', '模擬考']].map(([k, l]) =>
          h('button', { type: 'button', role: 'tab', 'aria-selected': st.filter === k ? 'true' : 'false', onclick: () => go({ filter: k }) }, l, h('span', { class: 'mono', text: String(n[k]) })))),
        h('span', { class: 'vercel-legend' }, dot('ready'), ' ≥80%', dot('warn'), ' 60–80%', dot('error'), ' <60%')),
      list.length ? h('div', { class: 'vercel-list' }, list.map(deployRow)) : emptyDeploys(all.length ? '這個分類沒有紀錄' : null));
  }

  /* ---------------------------------------------------------------- 部署詳情 */
  function detailPage() {
    const all = deployments();
    const d = all.find((x) => x.id === st.key);
    if (!d) return h('div', { class: 'vercel-wrap' }, h('button', { type: 'button', class: 'vercel-link', onclick: () => go({ sub: 'deploys' }) }, icon('vc-back'), '練習紀錄'), emptyDeploys('找不到這筆紀錄'));
    const lines = [];
    const L = (text, cls, time) => lines.push({ text, cls, time });
    if (d.type === 'practice') {
      const day = dateOf(d.key);
      const examsThatDay = S().exams.filter((e) => QG.dayKey(new Date(e.ts)) === d.key);
      const prev = all.filter((x) => x.type === 'practice' && x.key < d.key)[0];
      let run = 0;
      const x = new Date(day);
      while (S().days[QG.dayKey(x)] && S().days[QG.dayKey(x)].n) { run++; x.setDate(x.getDate() - 1); }
      L(`Running "彙整 ${d.key} 練習紀錄"`, 'dim');
      L(`作答 ${d.n} 題：答對 ${d.c} 題、答錯 ${d.n - d.c} 題`);
      L(`正確率 ${d.p}%（Ready ≥ 80%・Warning ≥ 60%）`);
      if (examsThatDay.length) L(`當天有 ${examsThatDay.length} 場模擬考，作答已計入上述題數`, 'dim');
      L(`連續練習：截至這天連續 ${run} 天`);
      if (prev) { const diff = Math.round((d.p - prev.p) * 10) / 10; L(`與前一個練習日（${md(dateOf(prev.key))}）相比：正確率 ${diff >= 0 ? '+' : ''}${diff} 個百分點`, diff >= 0 ? 'ok' : 'warn'); }
      L('紀錄只保存每日彙總，不含逐題時間', 'dim');
      L(`Build Completed. Status: ${LEVEL[d.lv]}`, d.lv);
    } else {
      const e = d.e;
      const end = new Date(e.ts);
      const start = new Date(e.ts - (e.dur || 0) * 1000);
      const prev = S().exams.filter((x) => x.subject === e.subject && x.ts < e.ts).sort((a, b) => b.ts - a.ts)[0];
      L(`Running "模擬考 ${QG.SUBJ_CODE[e.subject]} ${QG.SUBJ[e.subject]}"`, 'dim', hms(start));
      L(`抽題 ${e.total} 題，每題 ${Math.round(100 / e.total * 10) / 10} 分`, '', hms(start));
      L(`作答時間 ${fmtDur(e.dur || 0)}（限時 ${QG.EXAM_MIN} 分鐘）`, (e.dur || 0) > QG.EXAM_MIN * 60 ? 'warn' : '', hms(end));
      L(`交卷：答對 ${e.correct} / ${e.total}，得分 ${e.score}`, '', hms(end));
      if (prev) { const diff = e.score - prev.score; L(`與上一場 ${QG.SUBJ_CODE[e.subject]} 模擬考（${md(new Date(prev.ts))}）相比：${diff >= 0 ? '+' : ''}${diff} 分`, diff >= 0 ? 'ok' : 'warn', hms(end)); }
      L('答錯與未作答的題目已加入錯題本', 'dim', hms(end));
      L(`Deployment Completed. Status: ${LEVEL[d.lv]}`, d.lv, hms(end));
    }
    const redeploy = () => {
      if (d.type === 'exam') { S().settings.examSubject = d.e.subject; QG.Store.save(); SK.go('exam'); }
      else { QG.ensurePractice(true); SK.go('practice'); }
    };
    const when = d.type === 'exam' ? new Date(d.ts) : dateOf(d.key);
    const ring = (p) => {
      const span = document.createElement('span');
      span.className = 'vercel-ring ' + d.lv;
      const C = 2 * Math.PI * 42;
      span.innerHTML = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" class="bg"/><circle cx="50" cy="50" r="42" class="fg" stroke-dasharray="${(C * Math.min(100, p) / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 50 50)"/></svg>`;
      span.append(h('b', { class: 'mono', text: d.type === 'exam' ? String(d.p) : `${Math.round(d.p)}%` }), h('small', { text: d.type === 'exam' ? '分' : '正確率' }));
      return span;
    };
    return h('div', { class: 'vercel-wrap' },
      h('button', { type: 'button', class: 'vercel-link back', onclick: () => go({ sub: st.back === 'overview' ? 'overview' : 'deploys' }) }, icon('vc-back'), st.back === 'overview' ? '概覽' : '練習紀錄'),
      h('header', { class: 'vercel-head' },
        h('div', null, h('h1', { text: '部署詳情' }), h('p', { class: 'muted mono', text: `dpl_${d.sha}` })),
        h('div', { class: 'vercel-btns' },
          h('button', { type: 'button', class: 'vercel-btn', onclick: () => go({ sub: 'deploys' }) }, '全部紀錄'),
          h('button', { type: 'button', class: 'vercel-btn primary', onclick: redeploy }, icon('vc-redeploy'), 'Redeploy'))),
      h('section', { class: 'vercel-card vercel-dcard' },
        h('div', { class: 'vercel-preview' }, ring(d.p), h('span', { class: 'vercel-preview-cap', text: d.type === 'exam' ? '模擬考成績' : '當日正確率' })),
        h('dl', { class: 'vercel-props' },
          h('div', null, h('dt', { text: '部署' }), h('dd', null, h('b', { text: d.name }))),
          h('div', null, h('dt', { text: '狀態' }), h('dd', null, status(d.lv))),
          h('div', null, h('dt', { text: '環境' }), h('dd', null, env(d))),
          h('div', null, h('dt', { text: '建立時間' }), h('dd', { text: d.type === 'exam' ? `${when.toLocaleString('zh-TW', { hour12: false })}（${SK.relTime(d.ts)}）` : `${when.toLocaleDateString('zh-TW')}（${dayAgo(d.key)}）` })),
          h('div', null, h('dt', { text: '題數' }), h('dd', { class: 'mono', text: `${d.c} / ${d.n} 答對` })),
          h('div', null, h('dt', { text: d.type === 'exam' ? '作答時間' : '來源' }), h('dd', { text: d.type === 'exam' ? fmtDur(d.e.dur || 0) : '練習、錯題複習與模擬考的當日作答' })))),
      h('section', { class: 'vercel-card vercel-logs' },
        h('div', { class: 'vercel-card-h' }, h('b', { text: '建置紀錄' }), h('span', { class: 'muted', text: `${lines.length} 行` })),
        h('ol', { class: 'vercel-log', 'aria-label': '建置紀錄' }, lines.map((l, i) => h('li', { class: l.cls || '' },
          h('span', { class: 'vercel-log-n', text: l.time || String(i + 1).padStart(2, '0') }), h('span', { class: 'vercel-log-t', text: l.text }))))));
  }

  /* ---------------------------------------------------------------- 專案頁 */
  function projectPage() {
    const p = projects().find((x) => x.key === st.proj);
    if (!p) { st.sub = 'overview'; return overview(); }
    const s = projStats(p);
    const lv = s.n ? level(s.p) : 'none';
    const wrongIds = s.ids.filter((id) => S().q[id] && S().q[id].b > 0);
    const maxBox = Math.max(1, ...s.boxes.slice(1));
    return h('div', { class: 'vercel-wrap' },
      h('header', { class: 'vercel-head' },
        h('div', { class: 'vercel-ptitle' }, projAv(p.name), h('div', null, h('h1', { text: p.name }), h('p', { class: 'muted mono', text: `${p.slug}・${s.total} 題` }))),
        h('div', { class: 'vercel-btns' },
          wrongIds.length ? h('button', { type: 'button', class: 'vercel-btn', onclick: () => QG.startCustomPractice(wrongIds, `${p.name}：錯題`) }, `只練錯題（${wrongIds.length}）`) : null,
          h('button', { type: 'button', class: 'vercel-btn primary', onclick: () => QG.startCustomPractice(QG.buildQueue(s.ids, 'weak').slice(0, 20), `${p.name}：20 題`) }, icon('vc-redeploy'), '練習 20 題'))),
      h('section', { class: 'vercel-card vercel-dcard' },
        h('div', { class: 'vercel-preview' }, sparkSvg(s.spark, lv, `${p.name} 近 14 天作答題數（依每題最後作答日）`), h('span', { class: 'vercel-preview-cap', text: '近 14 天作答（依每題最後作答日）' })),
        h('dl', { class: 'vercel-props' },
          h('div', null, h('dt', { text: '狀態' }), h('dd', null, s.n ? status(lv) : h('span', { class: 'muted', text: '尚未作答' }))),
          h('div', null, h('dt', { text: '正確率' }), h('dd', { class: 'mono', text: s.n ? `${s.p}%（${s.c} / ${s.n} 次）` : '—' })),
          h('div', null, h('dt', { text: '已練' }), h('dd', { class: 'mono', text: `${s.seen} / ${s.total} 題` })),
          h('div', null, h('dt', { text: '錯題本' }), h('dd', { class: 'mono', text: `${s.wrong} 題` })),
          h('div', null, h('dt', { text: '已熟練' }), h('dd', { class: 'mono', text: `${s.mastered} 題` })),
          h('div', null, h('dt', { text: '最後作答' }), h('dd', { text: s.last ? SK.relTime(s.last) : '—' })))),
      h('section', { class: 'vercel-card' },
        h('div', { class: 'vercel-card-h' }, h('b', { text: '錯題盒分布' }), h('span', { class: 'muted', text: '盒號越大，離熟練越近' })),
        h('div', { class: 'vercel-boxes' }, [1, 2, 3, 4, 5].map((b) => h('div', { class: 'vercel-box' },
          h('span', { class: 'mono', text: `盒 ${b}` }), h('span', { class: 'vercel-box-bar' }, h('i', { style: `width:${Math.round((s.boxes[b] / maxBox) * 100)}%` })), h('b', { class: 'mono', text: String(s.boxes[b]) }))))));
  }

  function home() {
    if (st.sub === 'deploys') return deploysPage();
    if (st.sub === 'detail') return detailPage();
    if (st.sub === 'project') return projectPage();
    return overview();
  }

  /* ---------------------------------------------------------------- 註冊 */
  SK.register({
    id: 'vercel', label: 'Vercel 風', group: '科技業',
    top,
    bottomNav: false,
    views: { home },
    after: () => {
      const cur = document.querySelector('.vercel-tab[aria-current="page"]');
      if (cur && cur.scrollIntoView && matchMedia('(max-width: 720px)').matches) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
    },
  });

  const prevBefore = QG.hooks.beforeRender;
  QG.hooks.beforeRender = (view) => { closePop(); prevBefore(view); };
})();
