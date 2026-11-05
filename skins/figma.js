/* QuizGrinder 版面風格：Figma 風（figma）
 *
 * 畫布編輯器的版面與互動：
 *   - 頂部工具列：移動／手形工具、縮放百分比、檔名「知識地圖」、頁面切換、▶ 練習（簡報鈕）
 *   - 左側圖層：頁面清單＋框架（主題）與子節點（題目）
 *   - 中間畫布：拖曳／空白鍵＋拖曳／滾輪平移，Ctrl/⌘＋滾輪、按鈕、+/− 縮放，雙指縮放；
 *     單一圖層用 CSS transform；每個框架只畫前 24 個節點＋「…還有 N 個」
 *   - 節點依你的正確率上色：未作答灰、<60% 紅、60–80% 黃、≥80% 綠
 *   - 右側設計面板：選取節點的科目、主題、出處、你的正確率，以及可直接作答的「作答」區
 * 只借用版面與互動慣例；標誌用 QuizGrinder 的焊墊圖示。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const S = () => QG.S();

  Object.assign(SK.ICONS, {
    fgMove: '<path d="M5 3l14 8-6 1.5L10 19z"/>',
    fgHand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.7-2.3L3.6 14.6a1.5 1.5 0 0 1 2.3-1.9L8 15"/>',
    fgFrame: '<path d="M8 3v18M16 3v18M3 8h18M3 16h18"/>',
    fgRect: '<rect x="4" y="6" width="16" height="12" rx="1.5"/>',
    fgLayers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    fgPanel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
    fgPlay: '<path d="M7 4.5v15l12-7.5z"/>',
    fgCaret: '<path d="M9 6l6 6-6 6"/>',
    fgFit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  });

  /* ---------------------------------------------------------------- 幾何 */
  const NW = 176, NH = 78, GAP = 12, COLS = 4, PAD = 20, MORE_H = 40;
  const FW = PAD * 2 + COLS * NW + (COLS - 1) * GAP;
  const FGAP_X = 120, FGAP_Y = 110, FCOLS = 4, ORIGIN = 80;
  const STEP = 24;
  const PAGES = [['home', '知識地圖'], ['practice', '練習'], ['review', '錯題本'], ['exam', '模擬考'], ['browse', '題庫'], ['stats', '統計']];

  const st = { x: 0, y: 0, z: 1, tool: 'move', sel: null, limits: {}, open: {}, inited: false, panel: '' };
  let cv = null; // 目前畫布的 DOM 參照

  function status(id) {
    const r = S().q[id];
    const n = r ? r.c + r.w : 0;
    if (!n) return { k: 'none', n: 0, c: 0, acc: null };
    const acc = r.c / n;
    return { k: acc < 0.6 ? 'red' : acc < 0.8 ? 'amber' : 'green', n, c: r.c, acc };
  }
  const STATUS_LABEL = { none: '未作答', red: '低於 60%', amber: '60–80%', green: '80% 以上' };
  const STATUS_HEX = { none: '#B3B3B3', red: '#F24822', amber: '#FFC21A', green: '#14AE5C' };

  /** 主題框架：排序＝弱點在前（答錯多→未作答→已熟） */
  function frames() {
    const tags = QG.TAGS.filter(([t]) => t !== '其他').concat(QG.TAGS.filter(([t]) => t === '其他'));
    const rank = (id) => { const s = status(id); return s.k === 'none' ? 1.5 : s.acc * 3; };
    const list = tags.map(([t], i) => {
      const ids = QG.QS.filter((q) => q.t.includes(t)).map((q) => q.id).sort((a, b) => rank(a) - rank(b));
      const shown = Math.min(ids.length, st.limits[t] || STEP);
      const rows = Math.ceil(shown / COLS);
      const fh = PAD * 2 + rows * NH + (rows - 1) * GAP + (shown < ids.length ? MORE_H + GAP : 0);
      return { t, i, ids, shown, fh };
    });
    // 依列排版：同一列取最高的框架高度
    let y = ORIGIN;
    for (let r = 0; r < list.length; r += FCOLS) {
      const row = list.slice(r, r + FCOLS);
      const rh = Math.max(...row.map((f) => f.fh));
      row.forEach((f, k) => { f.x = ORIGIN + k * (FW + FGAP_X); f.y = y; });
      y += rh + FGAP_Y;
    }
    return list;
  }
  const nodePos = (f, k) => ({ x: f.x + PAD + (k % COLS) * (NW + GAP), y: f.y + PAD + Math.floor(k / COLS) * (NH + GAP) });
  const worldSize = (fs) => ({ w: ORIGIN * 2 + FCOLS * FW + (FCOLS - 1) * FGAP_X, h: Math.max(...fs.map((f) => f.y + f.fh)) + ORIGIN });

  /* ---------------------------------------------------------------- 工具列 */
  function setTool(t) {
    st.tool = t;
    document.querySelectorAll('.fg-tool[data-tool]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tool === t ? 'true' : 'false'));
    if (cv) cv.vp.dataset.tool = t;
  }
  function togglePanel(p) {
    st.panel = st.panel === p ? '' : p;
    syncPanels();
  }
  function syncPanels() {
    if (cv) { cv.ed.dataset.panel = st.panel; }
    document.querySelectorAll('.fg-ptoggle').forEach((b) => b.setAttribute('aria-pressed', b.dataset.p === st.panel ? 'true' : 'false'));
  }

  function figTop(view) {
    const page = PAGES.find(([v]) => SK.isCurrent(view, v)) || PAGES[0];
    const onCanvas = view === 'home';
    const tb = (attrs, ...kids) => h('button', Object.assign({ type: 'button', class: 'fg-tool' }, attrs), ...kids);
    return h('div', { class: 'sk-top fg-top' },
      h('div', { class: 'fg-top-l' },
        h('a', { class: 'fg-menu', href: '#home', 'aria-label': 'QuizGrinder 首頁' }, SK.icon('pad')),
        onCanvas ? [
          tb({ 'data-tool': 'move', 'aria-pressed': st.tool === 'move' ? 'true' : 'false', title: '移動（V）', 'aria-label': '移動工具', onclick: () => setTool('move') }, SK.icon('fgMove')),
          tb({ 'data-tool': 'hand', 'aria-pressed': st.tool === 'hand' ? 'true' : 'false', title: '手形（H，或按住空白鍵）', 'aria-label': '手形工具', onclick: () => setTool('hand') }, SK.icon('fgHand')),
          h('span', { class: 'fg-sep' }),
          tb({ class: 'fg-tool fg-ptoggle', 'data-p': 'layers', 'aria-pressed': st.panel === 'layers' ? 'true' : 'false', title: '圖層', 'aria-label': '顯示圖層面板', onclick: () => togglePanel('layers') }, SK.icon('fgLayers')),
          tb({ class: 'fg-tool fg-ptoggle', 'data-p': 'props', 'aria-pressed': st.panel === 'props' ? 'true' : 'false', title: '設計', 'aria-label': '顯示設計面板', onclick: () => togglePanel('props') }, SK.icon('fgPanel')),
        ] : null),
      h('div', { class: 'fg-file' },
        h('span', { class: 'fg-file-proj', text: '草稿' }), h('span', { class: 'fg-file-sl', text: '/' }),
        h('strong', { text: '知識地圖' }),
        onCanvas ? null : [h('span', { class: 'fg-file-sl', text: '/' }), h('span', { class: 'fg-file-page', text: page[1] })]),
      h('div', { class: 'fg-top-r' },
        h('nav', { class: 'fg-pages', 'aria-label': '頁面' }, PAGES.map(([v, l]) => h('a', { class: 'fg-page-link', href: '#' + v, 'aria-current': SK.isCurrent(view, v) ? 'page' : null, text: l },
          v === 'review' ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null))),
        onCanvas ? h('div', { class: 'fg-zoomctl' },
          tb({ 'aria-label': '縮小', title: '縮小（−）', onclick: () => zoomBy(1 / 1.25) }, '−'),
          h('button', { type: 'button', class: 'fg-zoom', id: 'fg-zoom', title: '縮放至全部（Shift+1）', onclick: () => fitAll(), text: Math.round(st.z * 100) + '%' }),
          tb({ 'aria-label': '放大', title: '放大（+）', onclick: () => zoomBy(1.25) }, '+')) : null,
        h('button', { type: 'button', class: 'fg-present', title: '用目前範圍開始練習', onclick: present }, SK.icon('fgPlay'), h('span', { text: '練習' }))));
  }

  function present() {
    const s = st.sel;
    if (s && s.kind === 'frame') { const f = frames().find((x) => x.t === s.frame); if (f) { QG.startCustomPractice(f.ids, `框架：${f.t}`); return; } }
    if (s && s.kind === 'node') { const f = frames().find((x) => x.t === s.frame); if (f) { QG.startCustomPractice(QG.buildQueue(f.ids, 'weak'), `框架：${f.t}`); return; } }
    location.hash = '#practice';
  }

  /* ---------------------------------------------------------------- 畫布 */
  function apply() {
    if (!cv) return;
    cv.world.style.transform = `translate(${st.x}px, ${st.y}px) scale(${st.z})`;
    cv.world.style.setProperty('--iz', String(1 / st.z));
    cv.vp.style.setProperty('--gs', `${Math.max(8, 24 * st.z)}px`);
    cv.vp.style.setProperty('--gx', `${st.x}px`);
    cv.vp.style.setProperty('--gy', `${st.y}px`);
    cv.vp.classList.toggle('fg-far', st.z < 0.45);
    const z = document.getElementById('fg-zoom');
    if (z) z.textContent = Math.round(st.z * 100) + '%';
  }
  function zoomAt(f, cx, cy) {
    const nz = Math.min(4, Math.max(0.08, st.z * f));
    st.x = cx - (cx - st.x) * (nz / st.z);
    st.y = cy - (cy - st.y) * (nz / st.z);
    st.z = nz;
    apply();
  }
  function zoomBy(f) {
    if (!cv) return;
    const r = cv.vp.getBoundingClientRect();
    zoomAt(f, r.width / 2, r.height / 2);
  }
  function fitAll() {
    if (!cv) return;
    const r = cv.vp.getBoundingClientRect();
    const ws = worldSize(cv.fs);
    st.z = Math.min(r.width / ws.w, r.height / ws.h);
    st.x = (r.width - ws.w * st.z) / 2;
    st.y = (r.height - ws.h * st.z) / 2;
    apply();
  }
  function zoomTo100() {
    if (!cv) return;
    const r = cv.vp.getBoundingClientRect();
    zoomAt(1 / st.z, r.width / 2, r.height / 2);
  }
  function initialView() {
    const r = cv.vp.getBoundingClientRect();
    const span = r.width < 700 ? FW + 60 : 2 * FW + FGAP_X + 80;
    st.z = Math.max(0.25, Math.min(1, r.width / span));
    st.x = (ORIGIN - 40) * -st.z + 20;
    st.y = (ORIGIN - 50) * -st.z + 10;
    st.inited = true;
    apply();
  }
  /** 把世界座標的矩形捲進視野（必要時才移動） */
  function reveal(x, y, w, hh) {
    const r = cv.vp.getBoundingClientRect();
    const sx = x * st.z + st.x, sy = y * st.z + st.y, sw = w * st.z, sh = hh * st.z;
    const m = 40;
    if (sx < m || sy < m || sx + sw > r.width - m || sy + sh > r.height - m) {
      if (st.z < 0.6) { const nz = 0.9; st.z = nz; }
      st.x = r.width / 2 - (x + w / 2) * st.z;
      st.y = r.height / 2 - (y + hh / 2) * st.z;
      apply();
    }
  }

  function nodeEl(f, id, k) {
    const q = QG.QMAP.get(id);
    const s = status(id);
    const p = nodePos(f, k);
    return h('button', { type: 'button', class: `fg-node s-${s.k}`, style: `left:${p.x}px;top:${p.y}px;width:${NW}px;height:${NH}px`,
      dataset: { id, frame: f.t, k: String(k) }, 'aria-label': `題目節點：${q.q.slice(0, 40)}（${STATUS_LABEL[s.k]}）` },
      h('span', { class: 'fg-node-k' }, h('i', { class: 'fg-dot' }), h('span', { text: QG.srcLabel(q.src[0]) }),
        h('b', { text: s.n ? `${Math.round(s.acc * 100)}%` : '' })),
      h('span', { class: 'fg-node-t', text: q.q }));
  }

  function frameEl(f) {
    const el = h('div', { class: 'fg-frame', style: `left:${f.x}px;top:${f.y}px;width:${FW}px;height:${f.fh}px`, dataset: { frame: f.t } });
    const label = h('button', { type: 'button', class: 'fg-frame-label', style: `left:${f.x}px;top:${f.y}px`, dataset: { frame: f.t },
      'aria-label': `框架：${f.t}，${f.ids.length} 題` }, h('span', { text: f.t }), h('small', { text: `  ${f.ids.length}` }));
    const nodes = f.ids.slice(0, f.shown).map((id, k) => nodeEl(f, id, k));
    let more = null;
    if (f.shown < f.ids.length) {
      const rows = Math.ceil(f.shown / COLS);
      more = h('button', { type: 'button', class: 'fg-more', style: `left:${f.x + PAD}px;top:${f.y + PAD + rows * (NH + GAP)}px;width:${FW - PAD * 2}px;height:${MORE_H}px`,
        dataset: { more: f.t }, text: `…還有 ${f.ids.length - f.shown} 個節點（顯示更多）` });
    }
    return [el, label, ...nodes, more];
  }

  function selBox() {
    if (!cv) return;
    const old = cv.world.querySelector('.fg-selbox');
    if (old) old.remove();
    cv.world.querySelectorAll('.fg-node.sel, .fg-frame-label.sel').forEach((n) => n.classList.remove('sel'));
    const s = st.sel;
    if (!s) return;
    const f = cv.fs.find((x) => x.t === s.frame);
    if (!f) return;
    let x, y, w, hh;
    if (s.kind === 'frame') {
      ({ x, y } = f); w = FW; hh = f.fh;
      const lab = cv.world.querySelector(`.fg-frame-label[data-frame="${CSS.escape(f.t)}"]`);
      if (lab) lab.classList.add('sel');
    } else {
      const k = f.ids.indexOf(s.id);
      if (k < 0 || k >= f.shown) return;
      ({ x, y } = nodePos(f, k)); w = NW; hh = NH;
      const n = cv.world.querySelector(`.fg-node[data-frame="${CSS.escape(f.t)}"][data-k="${k}"]`);
      if (n) n.classList.add('sel');
    }
    cv.world.append(h('div', { class: 'fg-selbox', style: `left:${x}px;top:${y}px;width:${w}px;height:${hh}px`, 'aria-hidden': 'true' },
      h('i', { class: 'tl' }), h('i', { class: 'tr' }), h('i', { class: 'bl' }), h('i', { class: 'br' }),
      h('span', { class: 'fg-dim', text: `${w} × ${hh}` })));
    return { x, y, w, hh };
  }

  function select(sel, opts = {}) {
    st.sel = sel;
    const box = selBox();
    drawLayers();
    drawProps();
    if (box && opts.reveal) reveal(box.x, box.y, box.w, box.hh);
    if (sel && opts.openProps && window.matchMedia('(max-width: 720px)').matches) { st.panel = 'props'; syncPanels(); }
  }

  function redrawWorld() {
    cv.fs = frames();
    fill(cv.world, cv.fs.map(frameEl));
    selBox();
  }

  function attachGestures(vp) {
    const ptrs = new Map();
    let drag = null; // {id, x0, y0, sx, sy, moved}
    let pinch = null;
    let spaceDown = false;
    vp.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.button !== 1) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: st.z };
        drag = null;
        return;
      }
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, sx: st.x, sy: st.y, moved: false,
        force: st.tool === 'hand' || vp.classList.contains('fg-space') || e.button === 1 };
      if (drag.force) { vp.setPointerCapture(e.pointerId); vp.classList.add('fg-grabbing'); e.preventDefault(); }
    });
    vp.addEventListener('pointermove', (e) => {
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const r = vp.getBoundingClientRect();
        zoomAt((pinch.z * (d / pinch.d)) / st.z, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        return;
      }
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) > 4) {
        drag.moved = true;
        if (!drag.force) { try { vp.setPointerCapture(e.pointerId); } catch (err) { /* 已放開 */ } vp.classList.add('fg-grabbing'); }
      }
      if (drag.moved) { st.x = drag.sx + dx; st.y = drag.sy + dy; apply(); }
    });
    const end = (e) => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (drag && drag.id === e.pointerId) {
        vp.classList.remove('fg-grabbing');
        if (drag.moved || drag.force) vp.dataset.suppress = '1';
        drag = null;
        setTimeout(() => { delete vp.dataset.suppress; }, 0);
      }
    };
    vp.addEventListener('pointerup', end);
    vp.addEventListener('pointercancel', end);
    vp.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0025) * 2), e.clientX - r.left, e.clientY - r.top);
      else {
        const k = e.deltaMode ? 16 : 1;
        st.x -= (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * k;
        st.y -= (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * k;
        apply();
      }
    }, { passive: false });
    vp.addEventListener('click', (e) => {
      if (vp.dataset.suppress || st.tool === 'hand') return;
      const more = e.target.closest('.fg-more');
      if (more) { st.limits[more.dataset.more] = (st.limits[more.dataset.more] || STEP) + STEP; redrawWorld(); drawLayers(); return; }
      const node = e.target.closest('.fg-node');
      if (node) { select({ kind: 'node', id: node.dataset.id, frame: node.dataset.frame }, { openProps: true }); return; }
      const lab = e.target.closest('.fg-frame-label, .fg-frame');
      if (lab) { select({ kind: 'frame', frame: lab.dataset.frame }, { openProps: true }); return; }
      select(null);
    });
    return { setSpace: (v) => { spaceDown = v; vp.classList.toggle('fg-space', v); }, get space() { return spaceDown; } };
  }

  // 空白鍵＋拖曳＝暫時切成手形
  const typing = (t) => /INPUT|TEXTAREA|SELECT/.test((t && t.tagName) || '') || (t && t.isContentEditable);
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || !cv || !cv.vp.isConnected || SK.skin() !== 'figma' || typing(e.target) || e.ctrlKey || e.metaKey) return;
    if (document.body.classList.contains('mx-open')) return;
    e.preventDefault();
    cv.g.setSpace(true);
  }, true);
  document.addEventListener('keyup', (e) => {
    if (e.code !== 'Space' || !cv || !cv.g.space) return;
    e.preventDefault();
    cv.g.setSpace(false);
  }, true);

  /* ---------------------------------------------------------------- 左：圖層 */
  function drawLayers() {
    if (!cv) return;
    const sel = st.sel;
    const rows = [];
    for (const f of cv.fs) {
      const open = !!st.open[f.t] || (sel && sel.frame === f.t);
      const selF = sel && sel.kind === 'frame' && sel.frame === f.t;
      rows.push(h('div', { class: 'fg-layer frame' + (selF ? ' sel' : '') + (sel && sel.frame === f.t && !selF ? ' child-sel' : '') },
        h('button', { type: 'button', class: 'fg-caret' + (open ? ' open' : ''), 'aria-label': open ? `收合 ${f.t}` : `展開 ${f.t}`, 'aria-expanded': open ? 'true' : 'false',
          onclick: () => { st.open[f.t] = !open; if (open && sel && sel.frame === f.t) st.sel = sel.kind === 'frame' ? sel : { kind: 'frame', frame: f.t }; drawLayers(); } }, SK.icon('fgCaret')),
        h('button', { type: 'button', class: 'fg-layer-name', onclick: () => select({ kind: 'frame', frame: f.t }, { reveal: true }) },
          SK.icon('fgFrame'), h('span', { text: f.t }), h('small', { text: String(f.ids.length) }))));
      if (open) {
        f.ids.slice(0, f.shown).forEach((id) => {
          const s = status(id);
          const on = sel && sel.kind === 'node' && sel.id === id && sel.frame === f.t;
          rows.push(h('button', { type: 'button', class: 'fg-layer child' + (on ? ' sel' : ''),
            onclick: () => select({ kind: 'node', id, frame: f.t }, { reveal: true, openProps: true }) },
            h('i', { class: `fg-dot s-${s.k}` }), h('span', { text: QG.QMAP.get(id).q })));
        });
        if (f.shown < f.ids.length) rows.push(h('button', { type: 'button', class: 'fg-layer child more', text: `…還有 ${f.ids.length - f.shown} 個`,
          onclick: () => { st.limits[f.t] = f.shown + STEP; redrawWorld(); drawLayers(); } }));
      }
    }
    fill(cv.layers, rows);
    // 只捲動圖層面板本身（scrollIntoView 會連帶捲動被移出畫面的面板外框）
    const cur = cv.layers.querySelector('.fg-layer.child.sel');
    const pane = cv.layers.closest('.fg-panel');
    if (cur && pane) {
      const top = cur.getBoundingClientRect().top - pane.getBoundingClientRect().top;
      if (top < 0 || top > pane.clientHeight - 30) pane.scrollTop += top - pane.clientHeight / 3;
    }
  }

  function leftPanel() {
    const layers = h('div', { class: 'fg-layers', role: 'list' });
    const el = h('aside', { class: 'fg-panel fg-left', 'aria-label': '圖層' },
      h('div', { class: 'fg-panel-head' }, h('strong', { text: '知識地圖' }), h('span', { class: 'fg-muted', text: 'IPAS PCB・草稿' })),
      h('section', { class: 'fg-sec' }, h('h3', { class: 'fg-sec-h', text: '頁面' }),
        PAGES.map(([v, l]) => h('a', { class: 'fg-pagerow', href: '#' + v, 'aria-current': v === 'home' ? 'page' : null },
          h('span', { class: 'fg-check', text: v === 'home' ? '✓' : '' }), h('span', { text: l }),
          v === 'review' ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null))),
      h('section', { class: 'fg-sec grow' }, h('h3', { class: 'fg-sec-h', text: '圖層' }), layers));
    return { el, layers };
  }

  /* ---------------------------------------------------------------- 右：設計面板 */
  const row = (label, ...val) => h('div', { class: 'fg-prop' }, h('span', { class: 'fg-prop-l', text: label }), h('div', { class: 'fg-prop-v' }, ...val));
  const sec = (title, ...kids) => h('section', { class: 'fg-sec' }, h('h3', { class: 'fg-sec-h', text: title }), ...kids);
  const swatch = (k) => h('i', { class: `fg-swatch s-${k}` });

  function distBar(ids) {
    const cnt = { none: 0, red: 0, amber: 0, green: 0 };
    ids.forEach((id) => { cnt[status(id).k]++; });
    return h('div', { class: 'fg-dist' },
      h('div', { class: 'fg-dist-bar', role: 'img', 'aria-label': Object.entries(cnt).map(([k, n]) => `${STATUS_LABEL[k]} ${n}`).join('，') },
        ['green', 'amber', 'red', 'none'].map((k) => cnt[k] ? h('i', { class: `s-${k}`, style: `flex:${cnt[k]}` }) : null)),
      h('div', { class: 'fg-styles' }, ['none', 'red', 'amber', 'green'].map((k) =>
        h('div', { class: 'fg-style' }, swatch(k), h('span', { text: STATUS_LABEL[k] }), h('small', { text: String(cnt[k]) })))));
  }

  function drawProps() {
    if (!cv) return;
    const s = st.sel;
    let body;
    if (!s) {
      const t = QG.totals();
      body = [
        h('div', { class: 'fg-panel-head' }, h('strong', { text: '設計' }), h('span', { class: 'fg-muted', text: '未選取' })),
        sec('頁面',
          row('背景', swatch('canvas'), h('span', { class: 'mono', text: document.documentElement.matches('[data-theme="dark"]') || (window.matchMedia('(prefers-color-scheme: dark)').matches && !document.documentElement.matches('[data-theme="light"]')) ? '1E1E1E' : 'F5F5F5' })),
          row('節點', h('span', { class: 'mono', text: `${QG.fmtNum(QG.QS.length)} 題・${cv.fs.length} 個框架` })),
          row('已練', h('span', { class: 'mono', text: `${QG.fmtNum(t.seen)}・正確率 ${QG.pct(t.c, t.n)}` }))),
        sec('本地樣式・顏色', distBar(QG.QS.map((q) => q.id))),
        sec('操作提示', h('ul', { class: 'fg-tips' },
          h('li', null, '點選節點：右側顯示屬性並可作答'),
          h('li', null, h('kbd', { text: '拖曳' }), ' 或 ', h('kbd', { text: 'Space' }), '＋拖曳：平移'),
          h('li', null, h('kbd', { text: 'Ctrl/⌘' }), '＋滾輪、', h('kbd', { text: '+' }), h('kbd', { text: '−' }), '：縮放'),
          h('li', null, h('kbd', { text: 'Shift+1' }), ' 全部、', h('kbd', { text: 'Shift+0' }), ' 100%'),
          h('li', null, h('kbd', { text: '←' }), h('kbd', { text: '→' }), ' 上／下一個節點、', h('kbd', { text: 'Esc' }), ' 取消選取'))),
      ];
    } else if (s.kind === 'frame') {
      const f = cv.fs.find((x) => x.t === s.frame);
      const p = SK.progressOf(f.ids);
      body = [
        h('div', { class: 'fg-panel-head' }, SK.icon('fgFrame'), h('strong', { text: f.t }), h('span', { class: 'fg-muted', text: '框架' })),
        sec('框架',
          h('div', { class: 'fg-xywh' }, [['X', Math.round(f.x)], ['Y', Math.round(f.y)], ['W', FW], ['H', f.fh]].map(([k, v]) =>
            h('span', { class: 'fg-num' }, h('i', { text: k }), h('b', { text: String(v) }))))),
        sec('內容',
          row('題數', h('span', { class: 'mono', text: `${f.ids.length}（畫面上 ${f.shown}）` })),
          row('已練', h('span', { class: 'mono', text: `${p.seen} / ${f.ids.length}` })),
          row('你的正確率', h('span', { class: 'mono', text: p.n ? `${QG.pct(p.c, p.n)}（${p.c}/${p.n}）` : '尚未作答' }))),
        sec('填色分布', distBar(f.ids)),
        sec('匯出成練習',
          h('div', { class: 'fg-btns' },
            h('button', { type: 'button', class: 'fg-btn primary', text: `練習全部 ${f.ids.length} 題`, onclick: () => QG.startCustomPractice(f.ids, `框架：${f.t}`) }),
            h('button', { type: 'button', class: 'fg-btn', text: '弱點優先 20 題', onclick: () => QG.startCustomPractice(QG.buildQueue(f.ids, 'weak').slice(0, 20), `框架：${f.t}（弱點）`) }))),
      ];
    } else {
      const q = QG.QMAP.get(s.id);
      const stt = status(q.id);
      const result = h('div', { class: 'fg-result', hidden: true });
      const accRow = h('div', { class: 'fg-prop-v' });
      const drawAcc = () => {
        const x = status(q.id);
        fill(accRow, swatch(x.k), h('span', { class: 'mono', text: x.n ? `${Math.round(x.acc * 100)}%` : '未作答' }),
          x.n ? h('span', { class: 'fg-muted', text: `${x.c}/${x.n}` }) : null);
      };
      drawAcc();
      const opts = SK.answerOptions(q, {
        cls: 'fg-ans',
        onDone: (ok) => {
          drawAcc();
          refreshNode(q.id);
          fill(result, h('strong', { class: ok ? 'ok' : 'ng', text: ok ? '答對了' : '答錯了，已加入錯題本' }),
            h('span', { text: q.all ? '官方釋疑：所有選項均給分' : `正解：${q.a.join('、')}` }),
            q.x ? h('p', { text: q.x }) : null);
          result.hidden = false;
        },
      });
      cv.opts = opts;
      body = [
        h('div', { class: 'fg-panel-head' }, SK.icon('fgRect'), h('strong', { text: `Q-${q.id.slice(1, 7).toUpperCase()}` }), h('span', { class: 'fg-muted', text: s.frame })),
        sec('題目', h('p', { class: 'fg-qtext', text: q.q }),
          q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖', loading: 'lazy' })) : null),
        sec('屬性',
          row('科目', h('span', { text: `${QG.SUBJ_CODE[q.s]} ${QG.SUBJ_SHORT[q.s]}` })),
          row('主題', h('span', { class: 'fg-chips' }, q.t.map((t) => h('button', { type: 'button', class: 'fg-chip' + (t === s.frame ? ' on' : ''), text: t,
            onclick: () => select({ kind: 'frame', frame: t }, { reveal: true }) })))),
          row('出處', h('span', { text: q.src.map(QG.srcLabel).join('、') + (q.mock ? '（非官方）' : '') })),
          h('div', { class: 'fg-prop' }, h('span', { class: 'fg-prop-l', text: '你的正確率' }), accRow)),
        sec('作答', opts, result, h('p', { class: 'fg-muted fg-hint', text: '按 1–4 也可作答' })),
        sec('動作', h('div', { class: 'fg-btns' },
          SK.starBtn(q, 'fg-btn icon', 'star'),
          h('button', { type: 'button', class: 'fg-btn', text: '加入錯題本', onclick: () => SK.addToReview(q) }),
          h('button', { type: 'button', class: 'fg-btn', text: '複製', onclick: () => SK.copyQuestion(q) }))),
      ];
      void stt;
    }
    if (!s || s.kind !== 'node') cv.opts = null;
    fill(cv.props, body);
  }

  function refreshNode(id) {
    if (!cv) return;
    const s = status(id);
    cv.world.querySelectorAll(`.fg-node[data-id="${CSS.escape(id)}"]`).forEach((n) => {
      n.className = `fg-node s-${s.k}` + (n.classList.contains('sel') ? ' sel' : '');
      const b = n.querySelector('.fg-node-k b');
      if (b) b.textContent = s.n ? `${Math.round(s.acc * 100)}%` : '';
    });
    drawLayers();
  }

  function step(d) {
    const s = st.sel;
    if (!s) { const f = cv.fs[0]; select({ kind: 'node', id: f.ids[0], frame: f.t }, { reveal: true }); return; }
    const fi = cv.fs.findIndex((x) => x.t === s.frame);
    const f = cv.fs[fi];
    if (s.kind === 'frame') { const nf = cv.fs[(fi + d + cv.fs.length) % cv.fs.length]; select({ kind: 'frame', frame: nf.t }, { reveal: true }); return; }
    const k = f.ids.indexOf(s.id) + d;
    if (k >= 0 && k < f.shown) select({ kind: 'node', id: f.ids[k], frame: f.t }, { reveal: true });
  }

  function figHome() {
    const world = h('div', { class: 'fg-world' });
    const vp = h('div', { class: 'fg-viewport', tabindex: '0', 'aria-label': '畫布：拖曳平移、Ctrl／⌘＋滾輪縮放', 'data-tool': st.tool }, world,
      h('div', { class: 'fg-floating' },
        h('button', { type: 'button', class: 'fg-fbtn', title: '縮放至全部（Shift+1）', 'aria-label': '縮放至全部', onclick: () => fitAll() }, SK.icon('fgFit')),
        h('button', { type: 'button', class: 'fg-fbtn', title: '縮小', 'aria-label': '縮小', onclick: () => zoomBy(1 / 1.25), text: '−' }),
        h('button', { type: 'button', class: 'fg-fbtn', title: '放大', 'aria-label': '放大', onclick: () => zoomBy(1.25), text: '+' })),
      h('div', { class: 'fg-legend', 'aria-hidden': 'true' }, ['none', 'red', 'amber', 'green'].map((k) => h('span', null, swatch(k), STATUS_LABEL[k]))));
    const left = leftPanel();
    const props = h('div', { class: 'fg-props' });
    const ed = h('div', { class: 'fg-editor', 'data-panel': st.panel },
      left.el,
      h('section', { class: 'fg-canvas', 'aria-label': '畫布' }, vp),
      h('aside', { class: 'fg-panel fg-right', 'aria-label': '設計面板' }, props),
      h('button', { type: 'button', class: 'fg-scrim', 'aria-label': '關閉面板', onclick: () => { st.panel = ''; syncPanels(); } }));
    cv = { ed, vp, world, layers: left.layers, props, fs: [], opts: null };
    cv.g = attachGestures(vp);
    redrawWorld();
    drawLayers();
    drawProps();
    QG.setKeys((e) => {
      const k = e.key;
      if (k === 'v' || k === 'V') { setTool('move'); return true; }
      if (k === 'h' || k === 'H') { setTool('hand'); return true; }
      if (k === '+' || k === '=') { zoomBy(1.25); return true; }
      if (k === '-' || k === '_') { zoomBy(1 / 1.25); return true; }
      if (e.shiftKey && e.code === 'Digit1') { fitAll(); return true; }
      if (e.shiftKey && e.code === 'Digit0') { zoomTo100(); return true; }
      if (k === 'Escape') { if (st.panel) { st.panel = ''; syncPanels(); } else select(null); return true; }
      if (k === 'ArrowRight' || k === 'ArrowDown') { step(1); return true; }
      if (k === 'ArrowLeft' || k === 'ArrowUp') { step(-1); return true; }
      if (cv.opts && '1234'.includes(k) && k.length === 1) { cv.opts.pick(+k - 1); return true; }
      return false;
    });
    return ed;
  }

  function figAfter(view) {
    if (view !== 'home' || !cv || !cv.vp.isConnected) { if (view !== 'home') cv = null; return; }
    if (!st.inited) initialView(); else apply();
    if (st.sel) selBox();
    syncPanels();
  }

  SK.register({ id: 'figma', label: 'Figma 風', group: '設計界', top: figTop,
    nav: [
      { v: 'home', label: '畫布', icon: 'fgFrame' },
      { v: 'practice', label: '練習', icon: 'practice' },
      { v: 'review', label: '錯題', icon: 'review', badge: true },
      { v: 'exam', label: '模擬考', icon: 'exam' },
      { v: 'browse', label: '題庫', icon: 'browse' },
      { v: 'stats', label: '統計', icon: 'stats' },
    ],
    views: { home: figHome }, after: figAfter });
})();
