/* QuizGrinder — IPAS 初級電路板製程工程師刷題
 *
 * 單檔原生 JS（無框架、無建置步驟）。結構：
 *   1. 工具函式       h() 建 DOM、shuffle、日期
 *   2. Store          學習進度（localStorage；在 claude.ai Artifact 內另同步到帳號的私人 db）
 *   3. Bank           讀取 data/bank.json、篩選題目
 *   4. 練習引擎       練習／錯題複習共用的出題、作答、回饋
 *   5. 各畫面         home / practice / review / exam / result / browse / stats（以 #hash 切換）
 *   6. 啟動           路由、鍵盤、滑動手勢、Service Worker
 * 資料格式見 docs/DATA.md。
 */
(function () {
  'use strict';

  const ENV = window.QG_ENV || 'site'; // 'site'（GitHub Pages / 本機）或 'artifact'
  const STORE_KEY = 'quizgrinder:v1';
  const DAY = 864e5;
  const BOX_DAYS = [0, 0, 1, 3, 7, 14]; // Leitner：答對升到第 n 盒後，隔幾天再出現
  const EXAM_LEN = 50;
  const EXAM_MIN = 75; // 實際考試 10:45–12:00
  const SUBJ = { industry: '電路板產業概論', process: '電路板製造概論' };
  const SUBJ_SHORT = { industry: '產業概論', process: '製造概論' };
  const SUBJ_CODE = { industry: 'L11', process: 'L12' };
  const LETTERS = ['A', 'B', 'C', 'D'];
  // 選項互相參照（以上皆是、A與B…）時不能打亂順序
  const NO_SHUFFLE_RX = /以上|皆是|皆非|皆正確|皆錯誤|皆對|均是|均非|都對|都不|[(（]?[A-D][)）]?\s*[、和及與或,，&]\s*[(（]?[A-D]\b|選項/;

  /* ================================================================ 1. 工具 */

  const $ = (sel, root = document) => root.querySelector(sel);

  /** h('div', {class:'x', onclick:fn, text:'..'}, child, ...) */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  /** replaceChildren / append 的安全版：略過 null、false、undefined（原生 API 會把 null 印成文字） */
  const clean = (kids) => kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false);
  const fill = (el, ...kids) => el.replaceChildren(...clean(kids));
  const put = (el, ...kids) => el.append(...clean(kids));

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function dayKey(d = new Date()) {
    const z = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  }
  const pct = (c, n) => (n ? Math.round((c / n) * 100) + '%' : '—');
  const fmtNum = (n) => n.toLocaleString('zh-TW');
  const clone = (o) => JSON.parse(JSON.stringify(o));

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2200);
  }

  function fmtDate(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function fmtDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /* ================================================================ 2. Store */

  const DEFAULT_FILTERS = {
    preset: 'all', subject: 'all', yFrom: 0, yTo: 0, tags: [], hot: false, mock: false, noFig: false, exam: '', kw: '',
  };

  function defaults() {
    return {
      v: 1,
      updated: 0,
      q: {},        // 題目 id → {c 答對次數, w 答錯次數, t 最後作答, b 錯題盒 1–5（0 = 不在錯題本）, d 下次複習時間, m 已熟練, s 收藏}
      days: {},     // 'YYYY-MM-DD' → {n 作答數, c 答對數}
      exams: [],    // 模擬考紀錄 {ts, subject, total, correct, score, dur}
      settings: { shuffleOpts: true, order: 'random', filters: clone(DEFAULT_FILTERS), examSubject: 'process', examNoFig: false, examTimed: true },
      practice: null,   // {key, label, queue:[id], idx, n, c}
      examRun: null,    // 進行中的模擬考
      lastResult: null, // 最近一次模擬考的逐題結果
    };
  }

  const Store = {
    state: defaults(),
    mode: 'local', // 'local' | 'account'
    ref: null,
    writing: false,
    dirty: false,
    timer: null,
    onRemoteLoad: null,

    load() {
      let raw = null;
      try { raw = localStorage.getItem(STORE_KEY); } catch (e) { /* 私密視窗等 */ }
      if (raw) {
        try { this.state = this.normalize(JSON.parse(raw)); } catch (e) { this.state = defaults(); }
      }
      // 舊版（cookie）統計
      if (!this.state.legacy) {
        try {
          const c = document.cookie.split('; ').find((r) => r.startsWith('quiz_stats='));
          if (c) {
            const o = JSON.parse(decodeURIComponent(c.split('=')[1]));
            if (o && o.total) this.state.legacy = { c: o.correct || 0, n: o.total || 0 };
          }
        } catch (e) { /* ignore */ }
      }
    },

    normalize(o) {
      const d = defaults();
      if (!o || typeof o !== 'object' || o.v !== 1) return d;
      const s = Object.assign(d, o);
      s.settings = Object.assign(defaults().settings, o.settings || {});
      s.settings.filters = Object.assign(clone(DEFAULT_FILTERS), (o.settings && o.settings.filters) || {});
      s.q = s.q || {};
      s.days = s.days || {};
      s.exams = Array.isArray(s.exams) ? s.exams : [];
      return s;
    },

    save() {
      this.state.updated = Date.now();
      try { localStorage.setItem(STORE_KEY, JSON.stringify(this.state)); } catch (e) { /* ignore */ }
      if (this.ref) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.push(), 1500);
      }
    },

    async push() {
      if (!this.ref) return;
      if (this.writing) { this.dirty = true; return; }
      this.writing = true;
      try {
        await this.ref.set(clone(this.state));
      } catch (e) {
        if (e && (e.code === 'not_granted' || e.code === 'revoked' || e.code === 'invalid_argument')) {
          this.ref = null;
          this.mode = 'local';
        }
      } finally {
        this.writing = false;
        if (this.dirty) { this.dirty = false; this.push(); }
      }
    },

    /** claude.ai Artifact：把進度存到這位使用者的私人 db 文件，跨裝置同步。 */
    async connectAccount() {
      if (!window.claude || typeof window.claude.use !== 'function') return;
      try {
        const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
        if (!db || !user) return;
        const id = await user.id();
        if (!id) return;
        const ref = db.doc('data/users/' + id + '/progress');
        const snap = await ref.get();
        this.ref = ref;
        this.mode = 'account';
        if (snap.exists) {
          const remote = this.normalize(clone(snap.data()));
          if ((remote.updated || 0) > (this.state.updated || 0)) {
            this.state = remote;
            try { localStorage.setItem(STORE_KEY, JSON.stringify(this.state)); } catch (e) { /* ignore */ }
            if (this.onRemoteLoad) this.onRemoteLoad();
            return;
          }
        }
        if (this.state.updated) this.push();
      } catch (e) {
        this.ref = null;
        this.mode = 'local';
      }
    },

    flush() {
      if (this.ref) { clearTimeout(this.timer); this.push(); }
    },
  };

  const S = () => Store.state;

  /** 記錄一次作答。review=true 時答對才會讓錯題盒往上升。 */
  function record(id, correct, { review = false } = {}) {
    const st = S();
    const now = Date.now();
    const r = st.q[id] || (st.q[id] = { c: 0, w: 0 });
    if (correct) r.c++; else r.w++;
    r.t = now;
    if (!correct) {
      r.b = 1;
      r.d = now;
      delete r.m;
    } else if (review && r.b) {
      r.b++;
      if (r.b > 5) { r.b = 0; r.m = 1; delete r.d; }
      else r.d = now + BOX_DAYS[r.b] * DAY;
    }
    const k = dayKey();
    const d = st.days[k] || (st.days[k] = { n: 0, c: 0 });
    d.n++;
    if (correct) d.c++;
  }

  function dueReviewIds() {
    const now = Date.now();
    return Object.entries(S().q)
      .filter(([id, r]) => r.b > 0 && (r.d || 0) <= now && QMAP.has(id))
      .sort((a, b) => a[1].b - b[1].b || (a[1].d || 0) - (b[1].d || 0))
      .map(([id]) => id);
  }

  function streak() {
    const days = S().days;
    let n = 0;
    const d = new Date();
    if (!(days[dayKey(d)] && days[dayKey(d)].n)) d.setDate(d.getDate() - 1);
    while (days[dayKey(d)] && days[dayKey(d)].n) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function totals() {
    let c = 0, n = 0, seen = 0;
    for (const [id, r] of Object.entries(S().q)) {
      if (!QMAP.has(id)) continue;
      c += r.c; n += r.c + r.w; seen++;
    }
    return { c, n, seen };
  }

  /* ================================================================ 3. Bank */

  let BANK = null;
  let QS = [];
  const QMAP = new Map();
  const EXAM_MAP = new Map();
  let YEARS = [];
  let TAGS = [];

  async function loadBank() {
    const res = await fetch('data/bank.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    BANK = await res.json();
    for (const e of BANK.exams) EXAM_MAP.set(e.id, e);
    QS = BANK.questions;
    const tagCount = new Map();
    const years = new Set();
    for (const q of QS) {
      QMAP.set(q.id, q);
      q.years = q.src.map((s) => (EXAM_MAP.get(s.exam) || {}).year).filter(Boolean);
      q.year = q.years.length ? Math.max(...q.years) : 0;
      q.official = !q.mock;
      q.text = (q.q + ' ' + Object.values(q.o).join(' ')).toLowerCase();
      q.noShuffle = Object.values(q.o).some((t) => NO_SHUFFLE_RX.test(t));
      q.years.forEach((y) => years.add(y));
      for (const t of q.t) tagCount.set(t, (tagCount.get(t) || 0) + 1);
    }
    YEARS = [...years].sort((a, b) => a - b);
    TAGS = [...tagCount.entries()].sort((a, b) => b[1] - a[1]);
  }

  function srcLabel(s) {
    const e = EXAM_MAP.get(s.exam);
    if (!e) return s.exam;
    const head = e.official ? `${e.year}${e.session === 'S' ? ' 樣題' : '-' + e.session}` : '明志模擬';
    return `${head} ${s.label ? s.label.replace(/^第(.)科\s*/, '$1科 #') : '#' + s.n}`;
  }

  function filterQuestions(f) {
    const kw = (f.kw || '').trim().toLowerCase();
    const yFrom = f.yFrom || 0;
    const yTo = f.yTo || 9999;
    return QS.filter((q) => {
      if (f.subject !== 'all' && q.s !== f.subject) return false;
      if (f.exam && !q.src.some((s) => s.exam === f.exam)) return false;
      if (!f.mock && !q.official) return false;
      if ((f.yFrom || f.yTo) && q.official && !q.years.some((y) => y >= yFrom && y <= yTo)) return false;
      if (f.hot && q.src.length < 2) return false;
      if (f.noFig && q.fig) return false;
      if (f.tags.length && !f.tags.some((t) => q.t.includes(t))) return false;
      if (kw && !q.text.includes(kw)) return false;
      return true;
    });
  }

  const PRESETS = {
    all: { label: '全部官方題', f: {} },
    recent: { label: '近三年', f: () => ({ yFrom: YEARS[YEARS.length - 1] - 2, yTo: YEARS[YEARS.length - 1] }) },
    hot: { label: '高頻重複題', f: { hot: true } },
    mingchi: { label: '明志模擬・製程 25 題', f: { exam: 'mock-mingchi', subject: 'process', mock: true } },
  };

  function presetFilters(name) {
    const p = PRESETS[name];
    const extra = typeof p.f === 'function' ? p.f() : p.f;
    return Object.assign(clone(DEFAULT_FILTERS), extra, { preset: name });
  }

  function filterKey(f, order) {
    return JSON.stringify([f.subject, f.yFrom, f.yTo, f.tags.slice().sort(), f.hot, f.mock, f.noFig, f.exam, f.kw, order]);
  }

  function filterLabel(f) {
    if (f.preset !== 'custom' && PRESETS[f.preset]) return PRESETS[f.preset].label;
    const parts = [];
    if (f.subject !== 'all') parts.push(SUBJ_SHORT[f.subject]);
    if (f.yFrom || f.yTo) parts.push(`${f.yFrom || YEARS[0]}–${f.yTo || YEARS[YEARS.length - 1]} 年`);
    if (f.tags.length) parts.push(f.tags.join('、'));
    if (f.hot) parts.push('高頻');
    if (f.kw) parts.push(`「${f.kw}」`);
    return parts.join('・') || '自訂範圍';
  }

  /* ================================================================ 4. 練習引擎 */

  function buildQueue(ids, order) {
    if (order !== 'weak') return shuffle(ids);
    const st = S().q;
    const score = (id) => {
      const r = st[id];
      if (!r) return 0.5;
      if (r.m) return 0.05;
      return (r.w + 1) / (r.c + r.w + 2);
    };
    return shuffle(ids).sort((a, b) => score(b) - score(a));
  }

  function ensurePractice(forceNew = false) {
    const st = S();
    const f = st.settings.filters;
    const key = filterKey(f, st.settings.order);
    const p = st.practice;
    if (!forceNew && p && (p.key === key || p.key === 'custom') && p.queue.every((id) => QMAP.has(id))) return p;
    const ids = filterQuestions(f).map((q) => q.id);
    st.practice = { key, label: filterLabel(f), queue: buildQueue(ids, st.settings.order), idx: 0, n: 0, c: 0 };
    Store.save();
    return st.practice;
  }

  function startCustomPractice(ids, label) {
    S().practice = { key: 'custom', label, queue: shuffle(ids), idx: 0, n: 0, c: 0 };
    Store.save();
    location.hash = '#practice';
  }

  function permFor(q) {
    return S().settings.shuffleOpts && !q.noShuffle ? shuffle(LETTERS) : LETTERS.slice();
  }

  /**
   * 題卡元件。opts: {q, perm, chosen, reveal, onPick(origLetter), exam}
   * reveal=true 時標示正解／錯誤。
   */
  function questionCard({ q, perm, chosen, reveal, onPick, header }) {
    const correctSet = new Set(q.all ? LETTERS : q.a);
    const meta = h('div', { class: 'qmeta' },
      h('span', { class: 'tag subj', text: `${SUBJ_CODE[q.s]} ${SUBJ_SHORT[q.s]}` }),
      q.src.length > 1 ? h('span', { class: 'tag hot', text: `考過 ${q.src.length} 次` }) : null,
      q.mock ? h('span', { class: 'tag mock', text: '非官方模擬題' }) : null,
      q.t.filter((t) => t !== '其他').slice(0, 3).map((t) => h('span', { class: 'tag', text: t })),
      h('span', { class: 'src', text: q.src.map(srcLabel).join('・') }),
    );
    const opts = h('div', { class: 'opts', role: 'group', 'aria-label': '選項' });
    perm.forEach((orig, i) => {
      const disp = LETTERS[i];
      let cls = 'opt';
      let mark = '';
      if (reveal) {
        if (correctSet.has(orig)) { cls += ' correct'; mark = '正解'; }
        if (chosen === orig && !correctSet.has(orig)) { cls += ' wrong'; mark = '你的答案'; }
      } else if (chosen === orig) cls += ' selected';
      put(opts, h('button', {
        class: cls, type: 'button', disabled: reveal ? true : null, dataset: { i: String(i) },
        'aria-pressed': chosen === orig ? 'true' : 'false',
        onclick: onPick ? () => onPick(orig) : null,
      }, h('span', { class: 'key', text: disp }), h('span', { text: q.o[orig] }), h('span', { class: 'mark', text: mark })));
    });
    return h('article', { class: 'card', id: 'qcard' },
      header || null,
      meta,
      q.prev && QMAP.get(q.prev) ? prevContext(QMAP.get(q.prev)) : null,
      h('div', { class: 'qtext', text: q.q }),
      q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖（自原始試卷裁切）', loading: 'lazy' })) : null,
      opts,
    );
  }

  /** 「承上題」：可展開看上一題（不顯示上一題答案） */
  function prevContext(p) {
    return h('details', { class: 'prev' },
      h('summary', { text: '本題承接上一題，點此查看上一題' }),
      h('div', { class: 'qtext', text: p.q }),
      p.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: p.fig, alt: '上一題附圖', loading: 'lazy' })) : null,
      h('ol', null, LETTERS.map((L) => h('li', null, h('b', { text: L }), h('span', { text: p.o[L] })))));
  }

  function feedbackBox(q, chosen, perm) {
    const ok = q.all || q.a.includes(chosen);
    const disp = (orig) => LETTERS[perm.indexOf(orig)];
    const ansText = q.all ? '本題官方釋疑：所有選項均給分' : q.a.length > 1
      ? `官方釋疑：${q.a.map(disp).sort().join('、')} 均給分`
      : `正解是 ${disp(q.a[0])}`;
    return h('div', { class: 'feedback ' + (ok ? 'ok' : 'bad'), role: 'status' },
      h('strong', { text: ok ? '答對了' : '答錯了，已加入錯題本' }),
      h('span', { text: ansText + (perm.join('') !== 'ABCD' ? '（選項順序已打亂，原卷為 ' + q.a.join('、') + '）' : '') }),
      q.x ? h('div', { class: 'x', text: q.x }) : null,
    );
  }

  /** 練習與錯題複習共用的作答畫面 */
  function drillView({ mode, title, getRun, onAnswered, onNext, emptyView }) {
    const run = getRun();
    if (!run || run.idx >= run.queue.length) return emptyView(run);
    const q = QMAP.get(run.queue[run.idx]);
    const cur = { perm: permFor(q), chosen: null };
    const wrap = h('div', { class: 'view' });

    const draw = () => {
      const reveal = cur.chosen !== null;
      const progress = h('div', { class: 'progress', 'aria-hidden': 'true' }, h('i', { style: `width:${(run.idx / run.queue.length) * 100}%` }));
      const head = h('div', { class: 'qhead' },
        h('span', { class: 'eyebrow', text: title }),
        h('span', { class: 'mono', text: `${run.idx + 1} / ${run.queue.length}` }),
        h('span', { class: 'spacer' }),
        h('span', { class: 'mono', text: `本輪 ${run.c}/${run.n}・${pct(run.c, run.n)}` }),
      );
      const card = questionCard({ q, perm: cur.perm, chosen: cur.chosen, reveal, onPick: reveal ? null : pick });
      const r = S().q[q.id];
      const starBtn = h('button', {
        class: 'btn small ghost', type: 'button', 'aria-pressed': r && r.s ? 'true' : 'false',
        onclick: () => { toggleStar(q.id); draw(); }, text: r && r.s ? '★ 已收藏' : '☆ 收藏',
      });
      const foot = h('div', { class: 'qfoot' },
        reveal ? h('button', { class: 'btn primary', type: 'button', id: 'nextBtn', onclick: next, text: run.idx + 1 >= run.queue.length ? '完成' : '下一題 →' }) : null,
        starBtn,
        h('span', { class: 'spacer' }),
        h('span', { class: 'hint keys' }, reveal ? ['按 ', h('kbd', { text: 'Enter' }), ' 下一題'] : ['按 ', h('kbd', { text: '1' }), '–', h('kbd', { text: '4' }), ' 或 ', h('kbd', { text: 'A' }), '–', h('kbd', { text: 'D' }), ' 作答']),
      );
      fill(wrap, head, progress, card, reveal ? feedbackBox(q, cur.chosen, cur.perm) : null, foot);
      if (reveal) { const b = $('#nextBtn'); if (b) b.focus({ preventScroll: true }); }
      attachSwipe(card, () => { if (cur.chosen !== null) next(); });
    };

    function pick(orig) {
      if (cur.chosen !== null) return;
      cur.chosen = orig;
      const ok = q.all || q.a.includes(orig);
      run.n++;
      if (ok) run.c++;
      record(q.id, ok, { review: mode === 'review' });
      if (onAnswered) onAnswered(q, ok);
      Store.save();
      updateBadges();
      draw();
    }

    function next() {
      run.idx++;
      if (onNext) onNext();
      Store.save();
      render();
    }

    setKeys((e) => {
      const k = e.key.toUpperCase();
      if (cur.chosen === null) {
        const i = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : LETTERS.indexOf(k);
        if (i >= 0) { pick(cur.perm[i]); return true; }
      } else if (k === 'ENTER' || k === ' ' || k === 'ARROWRIGHT') { next(); return true; }
      if (k === 'S') { toggleStar(q.id); draw(); return true; }
      return false;
    });
    draw();
    return wrap;
  }

  function toggleStar(id) {
    const r = S().q[id] || (S().q[id] = { c: 0, w: 0 });
    if (r.s) delete r.s; else r.s = 1;
    Store.save();
    toast(r.s ? '已收藏' : '已取消收藏');
  }

  /* ================================================================ 5. 畫面 */

  const views = {};

  /* ---------- 首頁 ---------- */
  views.home = function () {
    const st = S();
    const t = totals();
    const due = dueReviewIds().length;
    const today = st.days[dayKey()] || { n: 0, c: 0 };
    const p = st.practice;
    const view = h('div', { class: 'view' });
    const official = QS.filter((q) => q.official).length;

    const hero = h('section', { class: 'hero' },
      h('span', { class: 'eyebrow', text: 'IPAS 初級電路板製程工程師' }),
      h('h1', { text: '歷屆試題，一題一題磨熟' }),
      h('p', { text: `收錄 ${YEARS[0]}–${YEARS[YEARS.length - 1]} 年 L11 電路板產業概論與 L12 電路板製造概論共 ${fmtNum(official)} 題官方試題（另有明志科大模擬題），答案已逐題對照官方答案與疑義釋覆修正。` }),
    );

    const kpis = h('section', { class: 'kpis', 'aria-label': '學習概況' },
      kpi(fmtNum(today.n), '今日作答'),
      kpi(pct(t.c, t.n), '總正確率'),
      kpi(`${fmtNum(t.seen)}`, `已練題目 / ${fmtNum(QS.length)}`),
      kpi(String(due), '錯題待複習'),
      kpi(String(streak()), '連續天數'),
    );

    const resumeLabel = p && p.idx < p.queue.length ? `${p.label}・第 ${p.idx + 1}/${p.queue.length} 題` : `從「${filterLabel(st.settings.filters)}」開始`;
    const actions = h('section', { class: 'actions' },
      h('a', { class: 'action lead', href: '#practice' }, h('strong', { text: p && p.idx > 0 && p.idx < p.queue.length ? '繼續練習' : '開始練習' }), h('span', { text: resumeLabel })),
      h('a', { class: 'action', href: '#review' }, h('strong', { text: `錯題複習（${due}）` }), h('span', { text: due ? '依遺忘曲線排程，答對升盒、答錯回第 1 盒' : '目前沒有到期的錯題' })),
      h('a', { class: 'action', href: '#exam' }, h('strong', { text: st.examRun ? '繼續模擬考' : '模擬考' }), h('span', { text: `隨機 ${EXAM_LEN} 題・${EXAM_MIN} 分鐘・考後對答` })),
    );

    put(view, hero, kpis, actions, rangePanel());
    return view;
  };

  function kpi(v, label) {
    return h('div', { class: 'kpi' }, h('b', { text: v }), h('span', { text: label }));
  }

  /** 首頁「練習範圍」設定 */
  function rangePanel() {
    const st = S();
    const f = st.settings.filters;
    const panel = h('section', { class: 'panel stack', 'aria-labelledby': 'rangeTitle' });

    const draw = () => {
      const n = filterQuestions(f).length;
      const change = (patch) => { Object.assign(f, patch); if (!('preset' in patch)) f.preset = 'custom'; Store.save(); draw(); };
      const presetChips = h('div', { class: 'chips' }, Object.entries(PRESETS).map(([k, p]) =>
        h('button', { class: 'chip', type: 'button', 'aria-pressed': f.preset === k ? 'true' : 'false', text: p.label,
          onclick: () => { Object.assign(f, presetFilters(k)); Store.save(); draw(); } })));
      const subjSeg = h('div', { class: 'seg', role: 'group', 'aria-label': '科目' },
        [['all', '兩科'], ['industry', 'L11 產業概論'], ['process', 'L12 製造概論']].map(([v, l]) =>
          h('button', { type: 'button', 'aria-pressed': f.subject === v ? 'true' : 'false', text: l, onclick: () => change({ subject: v, exam: f.exam === 'mock-mingchi' ? '' : f.exam }) })));
      const yearSel = (key, label) => h('label', { class: 'field' }, h('span', { text: label }),
        h('select', { id: 'f-' + key, onchange: (e) => change({ [key]: +e.target.value }) },
          h('option', { value: '0', text: '不限', selected: !f[key] }),
          YEARS.map((y) => h('option', { value: String(y), text: `${y} 年`, selected: f[key] === y }))));
      const tagChips = h('div', { class: 'chips' }, TAGS.map(([tag, cnt]) =>
        h('button', { class: 'chip', type: 'button', 'aria-pressed': f.tags.includes(tag) ? 'true' : 'false',
          onclick: () => change({ tags: f.tags.includes(tag) ? f.tags.filter((x) => x !== tag) : f.tags.concat(tag) }) },
          tag, h('span', { class: 'n', text: cnt }))));
      const toggles = h('div', { class: 'row' },
        toggleEl('f-hot', '只出考過 2 次以上的題目', f.hot, (v) => change({ hot: v })),
        toggleEl('f-mock', '包含非官方模擬題', f.mock, (v) => change({ mock: v })),
        toggleEl('f-nofig', '排除需看圖的題目', f.noFig, (v) => change({ noFig: v })),
      );
      const kw = h('input', { type: 'search', id: 'f-kw', placeholder: '關鍵字，例如：棕化、ENIG、Dk', value: f.kw });
      kw.addEventListener('change', (e) => change({ kw: e.target.value }));
      const orderSeg = h('div', { class: 'seg', role: 'group', 'aria-label': '出題順序' },
        [['random', '隨機不重複'], ['weak', '弱點優先']].map(([v, l]) =>
          h('button', { type: 'button', 'aria-pressed': st.settings.order === v ? 'true' : 'false', text: l, onclick: () => { st.settings.order = v; Store.save(); draw(); } })));

      fill(panel, 
        h('div', { class: 'row' }, h('h2', { id: 'rangeTitle', text: '練習範圍' }), h('span', { class: 'spacer' }),
          h('span', { class: 'count-line' }, '符合 ', h('b', { text: fmtNum(n) }), ' 題')),
        presetChips,
        h('div', { class: 'row' }, subjSeg),
        h('div', { class: 'grid-2' }, yearSel('yFrom', '起始年度'), yearSel('yTo', '結束年度')),
        h('div', { class: 'field' }, h('span', { text: '主題（可複選）' }), tagChips),
        h('label', { class: 'field' }, h('span', { text: '關鍵字' }), kw),
        toggles,
        h('div', { class: 'row' }, h('span', { class: 'muted', style: 'font-size:var(--fs-sm)', text: '出題順序' }), orderSeg,
          toggleEl('f-shuffle', '打亂選項順序', st.settings.shuffleOpts, (v) => { st.settings.shuffleOpts = v; Store.save(); })),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', type: 'button', disabled: n === 0 ? true : null, text: `用這 ${fmtNum(n)} 題開始新一輪`,
            onclick: () => { ensurePractice(true); location.hash = '#practice'; } }),
          h('span', { class: 'note', text: '同一輪內每題只出現一次；換範圍會開新一輪。' })),
      );
    };
    draw();
    return panel;
  }

  function toggleEl(id, label, checked, onChange) {
    return h('label', { class: 'toggle', for: id },
      h('input', { type: 'checkbox', id, checked: checked ? true : null, onchange: (e) => onChange(e.target.checked) }), label);
  }

  /* ---------- 練習 ---------- */
  views.practice = function () {
    const p = ensurePractice();
    return drillView({
      mode: 'practice',
      title: p.key === 'custom' ? p.label : `練習・${p.label}`,
      getRun: () => S().practice,
      emptyView: (run) => {
        const done = run && run.queue.length;
        return h('div', { class: 'view' }, h('div', { class: 'panel empty' },
          h('h2', { text: done ? '這一輪完成了' : '這個範圍沒有題目' }),
          done ? h('p', { class: 'mono', text: `本輪答對 ${run.c} / ${run.n}（${pct(run.c, run.n)}）` }) : h('p', { text: '回首頁調整練習範圍。' }),
          h('div', { class: 'row' },
            done ? h('button', { class: 'btn primary', type: 'button', text: '同範圍再來一輪', onclick: () => {
              const r = S().practice;
              S().practice = Object.assign(r, { queue: buildQueue(r.queue, S().settings.order), idx: 0, n: 0, c: 0 });
              Store.save(); render();
            } }) : null,
            dueReviewIds().length ? h('a', { class: 'btn mask', href: '#review', text: `複習錯題（${dueReviewIds().length}）` }) : null,
            h('a', { class: 'btn', href: '#home', text: '調整範圍' }))));
      },
    });
  };

  /* ---------- 錯題本 ---------- */
  let reviewRun = null;
  views.review = function () {
    if (!reviewRun || reviewRun.idx >= reviewRun.queue.length) {
      const due = dueReviewIds();
      if (reviewRun && reviewRun.idx >= reviewRun.queue.length && reviewRun.n) {
        const finished = reviewRun;
        reviewRun = null;
        return reviewHome(due, finished);
      }
      reviewRun = null;
      return reviewHome(due);
    }
    return drillView({
      mode: 'review',
      title: '錯題複習',
      getRun: () => reviewRun,
      onAnswered: (q, ok) => {
        if (!ok && !reviewRun.retried.has(q.id)) { reviewRun.retried.add(q.id); reviewRun.queue.push(q.id); }
      },
      emptyView: () => reviewHome(dueReviewIds()),
    });
  };

  function reviewHome(due, finished) {
    const st = S();
    const boxes = [0, 0, 0, 0, 0, 0];
    let nextDue = Infinity;
    const starred = [];
    for (const [id, r] of Object.entries(st.q)) {
      if (!QMAP.has(id)) continue;
      if (r.b > 0) { boxes[r.b]++; if (r.d > Date.now()) nextDue = Math.min(nextDue, r.d); }
      if (r.s) starred.push(id);
    }
    const inBook = boxes.reduce((a, b) => a + b, 0);
    const mastered = Object.values(st.q).filter((r) => r.m).length;
    const view = h('div', { class: 'view' },
      h('div', { class: 'hero' }, h('span', { class: 'eyebrow', text: '錯題本・Leitner 五盒複習' }),
        h('h1', { text: due.length ? `${due.length} 題到期待複習` : '目前沒有到期的錯題' }),
        h('p', { class: 'muted', text: '答錯的題目進第 1 盒；複習答對就升一盒，間隔依序為當天、1、3、7、14 天，第 5 盒再答對就算熟練畢業；任何時候答錯都回到第 1 盒。' })),
      finished ? h('div', { class: 'feedback ok' }, h('strong', { text: '這批複習完成' }), h('span', { class: 'mono', text: `答對 ${finished.c} / ${finished.n}（${pct(finished.c, finished.n)}）` })) : null,
      h('section', { class: 'kpis' },
        [1, 2, 3, 4, 5].map((b) => kpi(String(boxes[b]), `第 ${b} 盒・${b === 1 ? '當天' : BOX_DAYS[b] + ' 天'}`)),
        kpi(String(mastered), '已熟練')),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', type: 'button', disabled: due.length ? null : true, text: due.length ? `開始複習 ${due.length} 題` : '沒有到期的題目',
          onclick: () => { reviewRun = { queue: due, idx: 0, n: 0, c: 0, retried: new Set() }; render(); } }),
        inBook && !due.length && nextDue < Infinity ? h('span', { class: 'note', text: `下一批 ${fmtDate(nextDue)} 到期` }) : null,
        inBook ? h('button', { class: 'btn', type: 'button', text: `提前複習錯題本全部 ${inBook} 題`,
          onclick: () => startCustomPractice(Object.keys(st.q).filter((id) => st.q[id].b > 0 && QMAP.has(id)), '錯題本全部') }) : null,
        starred.length ? h('button', { class: 'btn', type: 'button', text: `練習收藏的 ${starred.length} 題`, onclick: () => startCustomPractice(starred, '收藏題目') }) : null,
      ),
    );
    return view;
  }

  /* ---------- 模擬考 ---------- */
  let examTick = null;
  views.exam = function () {
    const st = S();
    if (st.examRun) return examRunView();
    const s = st.settings;
    const view = h('div', { class: 'view' });
    const draw = () => {
      const pool = examPool(s.examSubject, s.examNoFig);
      fill(view, 
        h('div', { class: 'hero' }, h('span', { class: 'eyebrow', text: '模擬考' }),
          h('h1', { text: `第${s.examSubject === 'industry' ? '一' : '二'}科：${SUBJ[s.examSubject]}` }),
          h('p', { class: 'muted', text: `從 ${fmtNum(pool.length)} 題官方試題隨機抽 ${Math.min(EXAM_LEN, pool.length)} 題，每題 2 分。作答中不顯示對錯，交卷後一次對答，答錯的題目會進錯題本。` })),
        h('section', { class: 'panel stack' },
          h('div', { class: 'seg', role: 'group', 'aria-label': '考科' },
            ['industry', 'process'].map((v) => h('button', { type: 'button', 'aria-pressed': s.examSubject === v ? 'true' : 'false',
              text: `${SUBJ_CODE[v]} ${SUBJ_SHORT[v]}`, onclick: () => { s.examSubject = v; Store.save(); draw(); } }))),
          h('div', { class: 'row' },
            toggleEl('e-timed', `計時 ${EXAM_MIN} 分鐘（時間到自動交卷）`, s.examTimed, (v) => { s.examTimed = v; Store.save(); }),
            toggleEl('e-nofig', '排除需看圖的題目', s.examNoFig, (v) => { s.examNoFig = v; Store.save(); draw(); })),
          h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', text: '開始考試', onclick: () => startExam() })),
        ),
        examHistory(),
      );
    };
    draw();
    return view;
  };

  function examPool(subject, noFig) {
    return QS.filter((q) => q.official && q.s === subject && !(noFig && q.fig));
  }

  function startExam() {
    const s = S().settings;
    const ids = shuffle(examPool(s.examSubject, s.examNoFig).map((q) => q.id)).slice(0, EXAM_LEN);
    const perms = {};
    for (const id of ids) perms[id] = permFor(QMAP.get(id));
    S().examRun = { subject: s.examSubject, ids, perms, ans: {}, flags: {}, idx: 0, start: Date.now(), limit: s.examTimed ? EXAM_MIN * 60 : 0 };
    Store.save();
    render();
  }

  function examRunView() {
    const run = S().examRun;
    const view = h('div', { class: 'view' });
    let confirming = false;

    const remaining = () => run.limit ? Math.max(0, run.limit - (Date.now() - run.start) / 1000) : null;
    const timerEl = h('span', { class: 'timer', 'aria-live': 'off' });
    const updTimer = () => {
      const r = remaining();
      if (r === null) { timerEl.textContent = fmtDuration((Date.now() - run.start) / 1000); return; }
      timerEl.textContent = fmtDuration(r);
      timerEl.classList.toggle('low', r < 300);
      if (r <= 0) submitExam(true);
    };
    clearInterval(examTick);
    examTick = setInterval(updTimer, 1000);
    updTimer();

    const go = (i) => { run.idx = Math.max(0, Math.min(run.ids.length - 1, i)); Store.save(); draw(); };
    const pick = (orig) => { run.ans[run.ids[run.idx]] = orig; Store.save(); draw(); };

    function draw() {
      const id = run.ids[run.idx];
      const q = QMAP.get(id);
      const answered = Object.keys(run.ans).length;
      const header = h('div', { class: 'qhead' }, h('span', { class: 'eyebrow', text: `第 ${run.idx + 1} 題` }), h('span', { class: 'spacer' }),
        h('button', { class: 'btn small ghost', type: 'button', 'aria-pressed': run.flags[id] ? 'true' : 'false', text: run.flags[id] ? '⚑ 已標記' : '⚐ 標記稍後檢查',
          onclick: () => { if (run.flags[id]) delete run.flags[id]; else run.flags[id] = 1; Store.save(); draw(); } }));
      const card = questionCard({ q, perm: run.perms[id], chosen: run.ans[id] || null, reveal: false, onPick: pick, header });
      card.querySelector('.qmeta').remove(); // 考試中不顯示出處與主題，避免提示
      const grid = h('div', { class: 'navgrid', role: 'group', 'aria-label': '題目導覽' }, run.ids.map((qid, i) =>
        h('button', { type: 'button', class: [run.ans[qid] ? 'done' : '', run.flags[qid] ? 'flag' : '', i === run.idx ? 'cur' : ''].join(' '),
          'aria-label': `第 ${i + 1} 題${run.ans[qid] ? '，已作答' : ''}${run.flags[qid] ? '，已標記' : ''}`, text: String(i + 1), onclick: () => go(i) })));
      const unanswered = run.ids.length - answered;
      fill(view, 
        h('div', { class: 'exam-bar' }, h('span', { class: 'eyebrow', text: `${SUBJ_CODE[run.subject]} ${SUBJ[run.subject]}` }), h('span', { class: 'spacer' }),
          h('span', { class: 'mono muted', text: `已答 ${answered}/${run.ids.length}` }), timerEl),
        card,
        h('div', { class: 'qfoot' },
          h('button', { class: 'btn', type: 'button', disabled: run.idx === 0 ? true : null, text: '← 上一題', onclick: () => go(run.idx - 1) }),
          h('button', { class: 'btn', type: 'button', disabled: run.idx === run.ids.length - 1 ? true : null, text: '下一題 →', onclick: () => go(run.idx + 1) }),
          h('span', { class: 'spacer' }),
          h('button', { class: 'btn mask', type: 'button', text: '交卷', onclick: () => { confirming = true; draw(); } })),
        confirming ? h('div', { class: 'confirm', role: 'alertdialog', 'aria-label': '確認交卷' },
          h('strong', { text: unanswered ? `還有 ${unanswered} 題沒作答，確定交卷？` : '確定交卷？' }),
          h('div', { class: 'row' },
            h('button', { class: 'btn primary', type: 'button', text: '確定交卷', onclick: () => submitExam(false) }),
            h('button', { class: 'btn', type: 'button', text: '繼續作答', onclick: () => { confirming = false; draw(); } }),
            h('button', { class: 'btn ghost danger', type: 'button', text: '放棄這次考試', onclick: () => { S().examRun = null; clearInterval(examTick); Store.save(); render(); } }))) : null,
        h('section', { class: 'panel' }, grid),
        h('p', { class: 'hint keys' }, h('kbd', { text: '1' }), '–', h('kbd', { text: '4' }), ' 作答・', h('kbd', { text: '←' }), h('kbd', { text: '→' }), ' 換題・', h('kbd', { text: 'F' }), ' 標記'),
      );
    }

    setKeys((e) => {
      const k = e.key.toUpperCase();
      const i = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : LETTERS.indexOf(k);
      if (i >= 0) { pick(run.perms[run.ids[run.idx]][i]); return true; }
      if (k === 'ARROWRIGHT') { go(run.idx + 1); return true; }
      if (k === 'ARROWLEFT') { go(run.idx - 1); return true; }
      if (k === 'F') { const id = run.ids[run.idx]; if (run.flags[id]) delete run.flags[id]; else run.flags[id] = 1; Store.save(); draw(); return true; }
      return false;
    });
    draw();
    return view;
  }

  function submitExam(timeout) {
    const st = S();
    const run = st.examRun;
    if (!run) return;
    clearInterval(examTick);
    let correct = 0;
    const items = run.ids.map((id) => {
      const q = QMAP.get(id);
      const mine = run.ans[id] || null;
      const ok = !!mine && (q.all || q.a.includes(mine));
      if (ok) correct++;
      if (mine) record(id, ok);
      else { const r = st.q[id] || (st.q[id] = { c: 0, w: 0 }); r.b = 1; r.d = Date.now(); }
      return { id, mine, ok };
    });
    const total = run.ids.length;
    const result = {
      ts: Date.now(), subject: run.subject, total, correct, score: Math.round((correct / total) * 100),
      dur: Math.round((Date.now() - run.start) / 1000), timeout: !!timeout, items, perms: run.perms,
    };
    st.exams.push({ ts: result.ts, subject: result.subject, total, correct, score: result.score, dur: result.dur });
    if (st.exams.length > 50) st.exams = st.exams.slice(-50);
    st.lastResult = result;
    st.examRun = null;
    Store.save();
    updateBadges();
    if (timeout) toast('時間到，已自動交卷');
    location.hash = '#result';
    render();
  }

  function examHistory() {
    const ex = S().exams.slice().reverse().slice(0, 10);
    if (!ex.length) return null;
    return h('section', { class: 'panel' }, h('h3', { text: '最近的模擬考' }),
      h('div', { class: 'tablewrap' }, h('table', null,
        h('thead', null, h('tr', null, h('th', { text: '時間' }), h('th', { text: '考科' }), h('th', { class: 'num', text: '答對' }), h('th', { class: 'num', text: '分數' }), h('th', { class: 'num', text: '用時' }))),
        h('tbody', null, ex.map((e) => h('tr', null,
          h('td', { class: 'mono', text: fmtDate(e.ts) }), h('td', { text: `${SUBJ_CODE[e.subject]} ${SUBJ_SHORT[e.subject]}` }),
          h('td', { class: 'num', text: `${e.correct}/${e.total}` }), h('td', { class: 'num', text: String(e.score) }), h('td', { class: 'num', text: fmtDuration(e.dur) })))))));
  }

  /* ---------- 考試結果 ---------- */
  views.result = function () {
    const r = S().lastResult;
    if (!r) return h('div', { class: 'view' }, h('div', { class: 'panel empty' }, h('h2', { text: '還沒有考試結果' }), h('a', { class: 'btn primary', href: '#exam', text: '去考一次' })));
    const pill = r.score >= 70 ? h('span', { class: 'pill ok', text: '70 分以上' }) : r.score >= 60 ? h('span', { class: 'pill warn', text: '60–69 分' }) : h('span', { class: 'pill bad', text: '未達 60 分' });
    const byTag = new Map();
    for (const it of r.items) {
      const q = QMAP.get(it.id);
      if (!q) continue;
      for (const t of q.t) { const v = byTag.get(t) || { c: 0, n: 0 }; v.n++; if (it.ok) v.c++; byTag.set(t, v); }
    }
    let showAll = false;
    const listWrap = h('div', { class: 'qlist' });
    const drawList = () => {
      const items = r.items.filter((it) => showAll || !it.ok);
      fill(listWrap, ...items.map((it) => resultItem(it, r)));
      if (!items.length) put(listWrap, h('p', { class: 'muted', text: '全部答對！' }));
    };
    drawList();
    const wrongN = r.items.filter((it) => !it.ok).length;
    return h('div', { class: 'view' },
      h('div', { class: 'hero' }, h('span', { class: 'eyebrow', text: `模擬考結果・${SUBJ_CODE[r.subject]} ${SUBJ[r.subject]}` }),
        h('div', { class: 'score' }, h('b', { text: String(r.score) }), h('span', { class: 'muted', text: `/ 100 分・答對 ${r.correct}/${r.total}・用時 ${fmtDuration(r.dur)}` }), pill),
        h('p', { class: 'note', text: 'IPAS 初級能力鑑定的合格標準以當年度簡章為準（常見規定為兩科總分 140 分以上且單科不低於 60 分）。' })),
      h('section', { class: 'panel' }, h('h3', { text: '各主題表現' }), h('div', { class: 'bars' },
        [...byTag.entries()].sort((a, b) => a[1].c / a[1].n - b[1].c / b[1].n).map(([t, v]) => barRow(t, v.c, v.n)))),
      h('div', { class: 'row' }, h('h2', { text: showAll ? '全部題目' : `答錯 ${wrongN} 題` }), h('span', { class: 'spacer' }),
        toggleEl('r-all', '顯示全部題目', false, (v) => { showAll = v; drawList(); }),
        h('a', { class: 'btn', href: '#review', text: '去錯題本' }),
        h('button', { class: 'btn primary', type: 'button', text: '再考一次', onclick: () => { S().settings.examSubject = r.subject; startExam(); location.hash = '#exam'; } })),
      listWrap,
    );
  };

  function resultItem(it, r) {
    const q = QMAP.get(it.id);
    if (!q) return h('div');
    const perm = (r.perms && r.perms[it.id]) || LETTERS;
    const n = r.items.indexOf(it) + 1;
    return h('div', { class: 'qitem' },
      h('div', { class: 'row' }, h('span', { class: 'mono', text: `#${n}` }), h('span', { class: it.ok ? 'pill ok' : 'pill bad', text: it.ok ? '答對' : it.mine ? '答錯' : '未作答' }), h('span', { class: 'src', text: q.src.map(srcLabel).join('・') })),
      h('div', { class: 'qtext', text: q.q }),
      q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖', loading: 'lazy' })) : null,
      h('ol', null, perm.map((orig, i) => h('li', { class: (q.all || q.a.includes(orig)) ? 'ans' : orig === it.mine ? 'mine' : '' },
        h('b', { text: LETTERS[i] }), h('span', { text: q.o[orig] + ((q.all || q.a.includes(orig)) ? '　✓' : orig === it.mine ? '　✗ 你的答案' : '') })))),
      q.x ? h('p', { class: 'note', text: q.x }) : null,
    );
  }

  /* ---------- 題庫瀏覽 ---------- */
  const browse = { kw: '', subject: 'all', tag: '', only: 'all', show: false, limit: 30, mock: true };
  views.browse = function () {
    const view = h('div', { class: 'view' });
    const listWrap = h('div', { class: 'qlist' });
    const countEl = h('span', { class: 'count-line' });
    const filtered = () => {
      const st = S().q;
      const kw = browse.kw.trim().toLowerCase();
      return QS.filter((q) => (browse.subject === 'all' || q.s === browse.subject)
        && (!browse.tag || q.t.includes(browse.tag))
        && (browse.mock || q.official)
        && (!kw || q.text.includes(kw))
        && (browse.only === 'all' || (browse.only === 'star' && st[q.id] && st[q.id].s) || (browse.only === 'wrong' && st[q.id] && st[q.id].w > 0) || (browse.only === 'hot' && q.src.length > 1) || (browse.only === 'fig' && q.fig)));
    };
    const drawList = () => {
      const list = filtered();
      fill(countEl, '共 ', h('b', { text: fmtNum(list.length) }), ' 題');
      fill(listWrap, ...list.slice(0, browse.limit).map((q) => browseItem(q)));
      if (list.length > browse.limit) {
        put(listWrap, h('button', { class: 'btn', type: 'button', text: `再顯示 30 題（還有 ${list.length - browse.limit} 題）`, onclick: () => { browse.limit += 30; drawList(); } }));
      }
      practiceBtn.disabled = !list.length;
      practiceBtn.textContent = `練習這 ${fmtNum(list.length)} 題`;
    };
    const kw = h('input', { type: 'search', id: 'b-kw', placeholder: '搜尋題目或選項文字', value: browse.kw });
    kw.addEventListener('input', () => { browse.kw = kw.value; browse.limit = 30; drawList(); });
    const sel = (id, label, key, options) => h('label', { class: 'field' }, h('span', { text: label }),
      h('select', { id, onchange: (e) => { browse[key] = e.target.value; browse.limit = 30; drawList(); } },
        options.map(([v, l]) => h('option', { value: v, text: l, selected: browse[key] === v }))));
    const practiceBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => startCustomPractice(filtered().map((q) => q.id), `題庫篩選（${browse.kw || browse.tag || '自訂'}）`) });
    put(view, 
      h('div', { class: 'hero' }, h('span', { class: 'eyebrow', text: '題庫' }), h('h1', { text: '查詢與瀏覽' })),
      h('section', { class: 'panel stack' },
        h('label', { class: 'field' }, h('span', { text: '關鍵字' }), kw),
        h('div', { class: 'grid-2' },
          sel('b-subj', '科目', 'subject', [['all', '兩科'], ['industry', 'L11 產業概論'], ['process', 'L12 製造概論']]),
          sel('b-tag', '主題', 'tag', [['', '全部主題']].concat(TAGS.map(([t, n]) => [t, `${t}（${n}）`]))),
          sel('b-only', '只看', 'only', [['all', '全部'], ['wrong', '答錯過的'], ['star', '收藏的'], ['hot', '考過 2 次以上'], ['fig', '有附圖的']]),
        ),
        h('div', { class: 'row' },
          toggleEl('b-show', '直接顯示答案', browse.show, (v) => { browse.show = v; drawList(); }),
          toggleEl('b-mock', '包含模擬題', browse.mock, (v) => { browse.mock = v; drawList(); }),
          h('span', { class: 'spacer' }), countEl, practiceBtn)),
      listWrap,
    );
    drawList();
    return view;
  };

  function browseItem(q) {
    const r = S().q[q.id];
    let shown = browse.show;
    const item = h('div', { class: 'qitem' });
    const draw = () => {
      fill(item, 
        h('div', { class: 'qmeta' },
          h('span', { class: 'tag subj', text: SUBJ_CODE[q.s] }),
          q.src.length > 1 ? h('span', { class: 'tag hot', text: `考過 ${q.src.length} 次` }) : null,
          q.mock ? h('span', { class: 'tag mock', text: '模擬題' }) : null,
          q.t.filter((t) => t !== '其他').map((t) => h('span', { class: 'tag', text: t })),
          r && (r.c + r.w) ? h('span', { class: 'src', text: `你：${r.c}/${r.c + r.w}` }) : null,
          h('span', { class: 'src', text: q.src.map(srcLabel).join('・') })),
        h('div', { class: 'qtext', text: q.q }),
        q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖', loading: 'lazy' })) : null,
        h('ol', null, LETTERS.map((L) => h('li', { class: shown && (q.all || q.a.includes(L)) ? 'ans' : '' }, h('b', { text: L }), h('span', { text: q.o[L] })))),
        h('div', { class: 'row' },
          h('button', { class: 'btn small', type: 'button', text: shown ? '隱藏答案' : '看答案', onclick: () => { shown = !shown; draw(); } }),
          h('button', { class: 'btn small ghost', type: 'button', text: S().q[q.id] && S().q[q.id].s ? '★ 已收藏' : '☆ 收藏', onclick: () => { toggleStar(q.id); draw(); } }),
          shown && q.all ? h('span', { class: 'note', text: '官方釋疑：一律給分' }) : shown && q.a.length > 1 ? h('span', { class: 'note', text: `官方釋疑：${q.a.join('、')} 均給分` }) : null),
        shown && q.x ? h('p', { class: 'note', text: q.x }) : null,
      );
    };
    draw();
    return item;
  }

  /* ---------- 統計 ---------- */
  views.stats = function () {
    const st = S();
    const t = totals();
    const view = h('div', { class: 'view' });

    // 各科、各主題、各年度
    const agg = (keyFn) => {
      const m = new Map();
      for (const [id, r] of Object.entries(st.q)) {
        const q = QMAP.get(id);
        if (!q || !(r.c + r.w)) continue;
        for (const k of [].concat(keyFn(q))) { const v = m.get(k) || { c: 0, n: 0 }; v.c += r.c; v.n += r.c + r.w; m.set(k, v); }
      }
      return m;
    };
    const bySubj = agg((q) => q.s);
    const byTag = agg((q) => q.t);
    const coverage = (filterFn) => { const qs = QS.filter(filterFn); return [qs.filter((q) => st.q[q.id] && (st.q[q.id].c + st.q[q.id].w)).length, qs.length]; };

    put(view, 
      h('div', { class: 'hero' }, h('span', { class: 'eyebrow', text: '學習統計' }), h('h1', { text: '你的進度' }),
        h('p', { class: 'note', text: Store.mode === 'account' ? '進度存在你的 claude.ai 帳號，換裝置打開這個頁面也會同步。' : '進度存在這個瀏覽器（localStorage）。換裝置可用下方「匯出／匯入」搬移。' })),
      h('section', { class: 'kpis' },
        kpi(fmtNum(t.n), '總作答次數'), kpi(pct(t.c, t.n), '總正確率'),
        kpi(`${fmtNum(t.seen)}/${fmtNum(QS.length)}`, '已練題目'),
        kpi(String(dueReviewIds().length), '錯題待複習'), kpi(String(streak()), '連續天數')),
      h('section', { class: 'panel chart' }, h('h3', { text: '最近 14 天' }), activityChart()),
      h('section', { class: 'panel' }, h('h3', { text: '各科' }), h('div', { class: 'bars' },
        ['industry', 'process'].map((s) => {
          const v = bySubj.get(s) || { c: 0, n: 0 };
          const [seen, all] = coverage((q) => q.s === s && q.official);
          return barRow(`${SUBJ_CODE[s]} ${SUBJ_SHORT[s]}`, v.c, v.n, `已練 ${seen}/${all}`);
        }))),
      h('section', { class: 'panel' }, h('h3', { text: '各主題（正確率由低到高）' }),
        byTag.size ? h('div', { class: 'bars' }, [...byTag.entries()].sort((a, b) => a[1].c / a[1].n - b[1].c / b[1].n).map(([k, v]) => barRow(k, v.c, v.n)))
          : h('p', { class: 'muted', text: '作答後這裡會顯示各主題的正確率。' })),
      examHistory(),
      st.legacy ? h('p', { class: 'note', text: `舊版網頁累計：答對 ${st.legacy.c} / ${st.legacy.n}（${pct(st.legacy.c, st.legacy.n)}），未計入上方統計。` }) : null,
      dataPanel(),
      h('p', { class: 'note', text: `題庫版本 ${BANK.build || ''}・${fmtNum(QS.length)} 題・${BANK.exams.length} 份試卷` }),
    );
    return view;
  };

  function barRow(label, c, n, extra) {
    const p = n ? c / n : 0;
    return h('div', { class: 'bar' },
      h('span', { text: label }),
      h('span', { class: 'track', role: 'img', 'aria-label': `${label} 正確率 ${pct(c, n)}` }, h('i', { class: p < 0.6 ? 'low' : p < 0.8 ? 'mid' : '', style: `width:${Math.round(p * 100)}%` })),
      h('span', { class: 'v', text: n ? `${pct(c, n)}・${c}/${n}${extra ? '・' + extra : ''}` : extra || '—' }));
  }

  function activityChart() {
    const days = [];
    const d = new Date();
    d.setDate(d.getDate() - 13);
    for (let i = 0; i < 14; i++) { days.push({ k: dayKey(d), label: `${d.getMonth() + 1}/${d.getDate()}`, ...(S().days[dayKey(d)] || { n: 0, c: 0 }) }); d.setDate(d.getDate() + 1); }
    const max = Math.max(10, ...days.map((x) => x.n));
    const niceMax = Math.ceil(max / 10) * 10;
    const W = 560, H = 160, L = 30, B = 22, T = 8;
    const bw = (W - L) / 14;
    const y = (v) => T + (H - T - B) * (1 - v / niceMax);
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '最近 14 天每日作答數（銅色為答對數）');
    const add = (tag, attrs, text) => { const el = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); if (text !== undefined) el.textContent = text; svg.append(el); return el; };
    [0, niceMax / 2, niceMax].forEach((v) => { add('line', { class: 'grid', x1: L, x2: W, y1: y(v), y2: y(v) }); add('text', { x: L - 4, y: y(v) + 3, 'text-anchor': 'end' }, String(v)); });
    days.forEach((x, i) => {
      const cx = L + i * bw;
      if (x.n) {
        add('rect', { class: 'b', x: cx + 3, width: bw - 6, y: y(x.n), height: y(0) - y(x.n), rx: 2 }).append(Object.assign(document.createElementNS(ns, 'title'), { textContent: `${x.label}：作答 ${x.n}，答對 ${x.c}` }));
        add('rect', { class: 'b2', x: cx + 3, width: bw - 6, y: y(x.c), height: y(0) - y(x.c), rx: 2 });
      }
      if (i % 2 === 1 || i === 13) add('text', { x: cx + bw / 2, y: H - 6, 'text-anchor': 'middle' }, x.label);
    });
    return h('div', null, svg, h('p', { class: 'note', text: '綠色＝作答數，銅色＝其中答對的題數。' }));
  }

  function dataPanel() {
    const panel = h('section', { class: 'panel stack' });
    let mode = null; // 'export' | 'import' | 'reset'
    const draw = () => {
      const body = [];
      if (mode === 'export') {
        const ta = h('textarea', { id: 'exportText', readonly: true, 'aria-label': '進度資料（JSON）' });
        ta.value = JSON.stringify(S());
        body.push(ta, h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', text: '複製', onclick: async () => {
          try { await navigator.clipboard.writeText(ta.value); toast('已複製進度資料'); } catch (e) { ta.focus(); ta.select(); toast('請按 Ctrl/⌘+C 複製'); }
        } }), h('span', { class: 'note', text: '貼到另一台裝置的「匯入」即可搬移進度。' })));
      } else if (mode === 'import') {
        const ta = h('textarea', { id: 'importText', placeholder: '貼上匯出的進度資料（JSON）', 'aria-label': '要匯入的進度資料' });
        const file = h('input', { type: 'file', id: 'importFile', accept: 'application/json,.json,.txt' });
        file.addEventListener('change', () => { const f = file.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { ta.value = String(rd.result); }; rd.readAsText(f); });
        const msg = h('p', { class: 'note' });
        body.push(ta, file, h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', text: '匯入並取代目前進度', onclick: () => {
          try {
            const o = JSON.parse(ta.value);
            if (!o || o.v !== 1 || typeof o.q !== 'object') throw new Error('格式不符');
            Store.state = Store.normalize(o);
            Store.save();
            toast('已匯入進度');
            mode = null;
            render();
          } catch (e) { msg.textContent = '無法匯入：內容不是 QuizGrinder 匯出的進度資料。'; }
        } }), msg));
      } else if (mode === 'reset') {
        body.push(h('div', { class: 'confirm' }, h('strong', { text: '確定清除所有作答紀錄、錯題本、收藏與考試紀錄？此動作無法復原。' }),
          h('div', { class: 'row' },
            h('button', { class: 'btn danger', type: 'button', text: '確定清除', onclick: () => { const keep = S().settings; Store.state = defaults(); Store.state.settings = keep; Store.save(); toast('已清除進度'); mode = null; render(); } }),
            h('button', { class: 'btn', type: 'button', text: '取消', onclick: () => { mode = null; draw(); } }))));
      }
      fill(panel, 
        h('h3', { text: '進度資料' }),
        h('div', { class: 'row' },
          h('button', { class: 'btn', type: 'button', 'aria-pressed': mode === 'export' ? 'true' : 'false', text: '匯出', onclick: () => { mode = mode === 'export' ? null : 'export'; draw(); } }),
          h('button', { class: 'btn', type: 'button', 'aria-pressed': mode === 'import' ? 'true' : 'false', text: '匯入', onclick: () => { mode = mode === 'import' ? null : 'import'; draw(); } }),
          h('button', { class: 'btn ghost danger', type: 'button', text: '清除進度', onclick: () => { mode = 'reset'; draw(); } })),
        ...body,
      );
    };
    draw();
    return panel;
  }

  /* ================================================================ 6. 啟動 */

  let keyHandler = null;
  function setKeys(fn) { keyHandler = fn; }

  document.addEventListener('keydown', (e) => {
    if (!keyHandler || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if (tag === 'BUTTON' && (e.key === 'Enter' || e.key === ' ') && e.target.id !== 'nextBtn') return;
    if (keyHandler(e)) e.preventDefault();
  });

  function attachSwipe(el, onLeft) {
    let x0 = null, y0 = null;
    el.addEventListener('touchstart', (e) => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      if (dx < -70 && Math.abs(dy) < 50) onLeft();
    }, { passive: true });
  }

  function updateBadges() {
    const b = document.querySelector('[data-badge="review"]');
    if (!b || !BANK) return;
    const n = dueReviewIds().length;
    b.hidden = !n;
    b.textContent = n > 99 ? '99+' : String(n);
  }

  let currentView = null;
  function render() {
    const app = $('#app');
    const name = (location.hash || '#home').slice(1);
    const v = views[name] ? name : 'home';
    if (v !== 'exam') clearInterval(examTick);
    keyHandler = null;
    const changed = v !== currentView;
    currentView = v;
    document.querySelectorAll('[data-nav]').forEach((a) => {
      if (a.dataset.nav === v || (v === 'result' && a.dataset.nav === 'exam')) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    fill(app, views[v]());
    updateBadges();
    if (changed) { window.scrollTo(0, 0); app.focus({ preventScroll: true }); }
  }

  async function boot() {
    Store.load();
    try {
      await loadBank();
    } catch (e) {
      $('#app').replaceChildren(h('div', { class: 'view' }, h('div', { class: 'panel empty' },
        h('h2', { text: '題庫載入失敗' }),
        h('p', { text: '請用 HTTP 伺服器開啟（例如在專案資料夾執行 python3 -m http.server 8000），直接開啟檔案無法讀取 data/bank.json。' }),
        h('p', { class: 'mono', text: String(e.message || e) }))));
      return;
    }
    window.addEventListener('hashchange', render);
    Store.onRemoteLoad = () => render(); // 帳號裡的進度較新時，換成帳號進度重畫
    render();
    Store.connectAccount();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') Store.flush(); });
    if (ENV === 'site' && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol) && window.self === window.top) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* 離線功能非必要 */ });
    }
  }

  boot();
})();
