/* QuizGrinder 版面風格：Project SEKAI 風（節奏遊戲介面）
 *
 * 借用：霓虹漸層、斜條紋、選曲清單（曲目＝主題或考卷）、難度徽章、判定文字、Combo 與生命條、結算畫面。
 * 難度由「你在這組題目的正確率」算出：越常答錯越難（EASY → MASTER）；沒作答過標 NEW。
 * 遊玩：每輪 10 題，每題限時 20 秒；答對時依作答秒數判定 PERFECT（<5 秒）／GREAT（<10）／GOOD（<20），
 *       答錯或逾時為 MISS。作答用 SK.answerOptions（會呼叫 QG.record 寫入紀錄）；逾時沒有作答，不寫入紀錄。
 * 每組的最佳成績存在 S().settings.skinData.sekai[組別鍵]。
 * 不使用任何角色、歌曲、標誌或遊戲專有名詞；所有數字都來自學習紀錄。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon, hue } = SK;
  const S = () => QG.S();
  const LEN = 10;
  const LIMIT = 20000;
  const JUDGE = {
    PERFECT: { pts: 1000, w: 1, life: 2 },
    GREAT: { pts: 800, w: 0.8, life: 0 },
    GOOD: { pts: 500, w: 0.5, life: 0 },
    MISS: { pts: 0, w: 0, life: -20 },
  };
  const DIFFS = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'];
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  Object.assign(SK.ICONS, {
    'sekai-note': '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    'sekai-list': '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    'sekai-play': '<path d="M7 4l13 8-13 8z"/>',
  });

  /* ---------------------------------------------------------------- 資料 */

  function store() {
    const st = S().settings;
    if (!st.skinData || typeof st.skinData !== 'object') st.skinData = {};
    if (!st.skinData.sekai || typeof st.skinData.sekai !== 'object') st.skinData.sekai = {};
    return st.skinData.sekai;
  }
  const best = (key) => { const sd = S().settings.skinData; return (sd && sd.sekai && sd.sekai[key]) || null; };

  function sets(tab) {
    const out = [];
    if (tab === 'topic') {
      const off = QG.QS.filter((q) => q.official);
      for (const [t] of QG.TAGS) {
        if (t === '其他') continue;
        const ids = off.filter((q) => q.t.includes(t)).map((q) => q.id);
        if (ids.length) out.push({ key: 'tag:' + t, title: t, sub: '主題', mark: t.slice(0, 1), ids });
      }
    } else {
      const exams = [...QG.EXAM_MAP.values()].sort((a, b) => (b.year || 0) - (a.year || 0) || b.id.localeCompare(a.id));
      for (const e of exams) {
        const ids = QG.QS.filter((q) => q.src.some((s) => s.exam === e.id)).map((q) => q.id);
        if (!ids.length) continue;
        const code = e.subject === 'industry' ? 'L11' : e.subject === 'process' ? 'L12' : 'L11+L12';
        const head = e.official ? `${e.year}${e.session === 'S' ? ' 樣題' : ' 第' + e.session + '次'}` : '明志模擬題';
        out.push({ key: 'exam:' + e.id, title: `${head}・${code}`, sub: e.official ? '歷屆試題' : '非官方模擬題', mark: e.official ? String(e.year) : '模', ids });
      }
    }
    for (const s of out) {
      const p = SK.progressOf(s.ids);
      s.acc = p.n ? p.c / p.n : null;
      s.seen = p.seen;
      s.diff = s.acc === null ? null : s.acc >= 0.9 ? 0 : s.acc >= 0.75 ? 1 : s.acc >= 0.6 ? 2 : s.acc >= 0.4 ? 3 : 4;
    }
    return out;
  }

  function diffBadge(d, cls) {
    return d === null
      ? h('span', { class: 'sekai-diff sekai-dnew ' + (cls || ''), text: 'NEW' })
      : h('span', { class: `sekai-diff sekai-d${d} ${cls || ''}`, text: DIFFS[d] });
  }
  function jacket(s, big) {
    return h('span', { class: 'sekai-jacket' + (big ? ' big' : ''), style: `--h:${hue(s.key)}`, 'aria-hidden': 'true' },
      h('span', { class: 'sekai-jk-ring' }), h('span', { class: 'sekai-jk-ring r2' }),
      h('b', { class: s.mark.length > 1 ? 'sekai-jk-long' : null, text: s.mark }));
  }

  /* ---------------------------------------------------------------- 狀態 */

  const ui = { tab: 'topic', sel: null, mode: 'select', run: null, result: null };
  let host = null;

  function stopRun() {
    if (ui.run) { clearInterval(ui.run.tick); clearTimeout(ui.run.adv); }
    ui.run = null;
  }

  /* ---------------------------------------------------------------- 選曲 */

  function selectView() {
    const list = sets(ui.tab);
    let s = list.find((x) => x.key === ui.sel);
    if (!s) { s = list[0]; ui.sel = s && s.key; }
    const b = s && best(s.key);
    const tabs = h('div', { class: 'sekai-tabs', role: 'group', 'aria-label': '曲目分類' },
      [['topic', '主題'], ['exam', '考卷']].map(([k, label]) => h('button', { type: 'button', 'aria-pressed': ui.tab === k ? 'true' : 'false',
        onclick: () => { ui.tab = k; ui.sel = null; draw(); } }, label)));
    const rows = h('div', { class: 'sekai-list', role: 'list' }, list.map((x) => {
      const xb = best(x.key);
      return h('button', { type: 'button', role: 'listitem', class: 'sekai-row' + (x.key === ui.sel ? ' sel' : ''), 'aria-current': x.key === ui.sel ? 'true' : null,
        onclick: () => { ui.sel = x.key; draw(); const d = host && host.querySelector('.sekai-detail'); if (d && matchMedia('(max-width: 720px)').matches) d.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); } },
        jacket(x),
        h('span', { class: 'sekai-row-main' },
          h('b', { class: 'sekai-row-t', text: x.title }),
          h('span', { class: 'sekai-row-s', text: `${x.sub}・${x.ids.length} 題・${x.acc === null ? '未作答' : '正確率 ' + Math.round(x.acc * 100) + '%'}` })),
        h('span', { class: 'sekai-row-r' },
          diffBadge(x.diff),
          xb ? h('span', { class: 'sekai-row-best' }, h('i', { class: 'sekai-rk r-' + xb.rank, text: xb.rank }), h('span', { text: QG.fmtNum(xb.score) })) : h('span', { class: 'sekai-row-best none', text: '—' })));
    }));
    const detail = s ? h('section', { class: 'sekai-detail', style: `--h:${hue(s.key)}` },
      jacket(s, true),
      h('div', { class: 'sekai-d-head' },
        h('span', { class: 'sekai-d-sub', text: s.sub }),
        h('h2', { text: s.title })),
      h('div', { class: 'sekai-diffrow', 'aria-label': s.diff === null ? '難度：尚未作答' : `難度：${DIFFS[s.diff]}` },
        DIFFS.map((d, i) => h('span', { class: `sekai-dpill sekai-d${i}` + (s.diff === i ? ' on' : ''), text: d }))),
      h('div', { class: 'sekai-d-stats' },
        h('div', null, h('span', { text: 'HIGH SCORE' }), h('b', { text: b ? QG.fmtNum(b.score) : '—' })),
        h('div', null, h('span', { text: 'RANK' }), h('b', { class: b ? 'sekai-rk-t r-' + b.rank : '', text: b ? b.rank : '—' })),
        h('div', null, h('span', { text: 'MAX COMBO' }), h('b', { text: b ? String(b.combo) : '—' })),
        h('div', null, h('span', { text: '正確率' }), h('b', { text: s.acc === null ? '—' : Math.round(s.acc * 100) + '%' }))),
      b && (b.fc || b.ap) ? h('div', { class: 'sekai-d-flags' }, b.ap ? h('span', { class: 'ap', text: 'ALL PERFECT' }) : h('span', { class: 'fc', text: 'FULL COMBO' }), h('span', { text: `遊玩 ${b.plays} 次` })) : (b ? h('div', { class: 'sekai-d-flags' }, h('span', { text: `遊玩 ${b.plays} 次` })) : null),
      h('button', { type: 'button', class: 'sekai-start', onclick: () => startRun(s) }, icon('sekai-play'), h('span', { text: 'LIVE START' })),
      h('p', { class: 'sekai-rule', text: `每輪 ${LEN} 題（弱點優先），每題限時 20 秒。答對：5 秒內 PERFECT、10 秒內 GREAT、20 秒內 GOOD；答錯或逾時 MISS。難度依你的正確率而定。` })) : null;
    QG.setKeys((e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const i = list.findIndex((x) => x.key === ui.sel);
        const j = Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
        ui.sel = list[j].key; draw();
        const r = host.querySelector('.sekai-row.sel'); if (r) { r.focus({ preventScroll: true }); r.scrollIntoView({ block: 'nearest' }); }
        return true;
      }
      return false;
    });
    return h('div', { class: 'sekai-select' },
      h('header', { class: 'sekai-head' }, h('span', { class: 'sekai-head-en', 'aria-hidden': 'true', text: 'SELECT' }), h('h1', { text: '選曲' }),
        h('span', { class: 'sekai-head-n', text: `${list.length} 組` }), tabs),
      detail, h('section', { class: 'sekai-listwrap', 'aria-label': '曲目清單' }, rows));
  }

  /* ---------------------------------------------------------------- 遊玩 */

  function startRun(s) {
    stopRun();
    const ids = QG.buildQueue(s.ids, 'weak').slice(0, LEN);
    ui.run = { set: s, ids, i: 0, combo: 0, maxCombo: 0, score: 0, life: 100, counts: { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 }, miss: [], timeouts: 0, failed: false };
    ui.mode = 'play';
    draw();
  }

  function playView() {
    const run = ui.run;
    const q = QG.QMAP.get(run.ids[run.i]);
    run.done = false;
    const lane = h('span', { class: 'sekai-lane-cur' });
    const secs = h('b', { class: 'sekai-secs', text: '0.0' });
    const judgeHost = h('div', { class: 'sekai-judgehost', 'aria-live': 'polite' });
    const nextBox = h('div', { class: 'sekai-next' });
    const opts = SK.answerOptions(q, { cls: 'sekai-ans', onDone: (ok) => judge(ok ? null : 'MISS') });
    const t0 = performance.now();

    function judge(forced) {
      if (run.done) return;
      run.done = true;
      clearInterval(run.tick);
      const el = performance.now() - t0;
      const j = forced || (el < 5000 ? 'PERFECT' : el < 10000 ? 'GREAT' : el < LIMIT ? 'GOOD' : 'MISS');
      run.counts[j]++;
      if (j === 'MISS') { run.combo = 0; run.miss.push(q.id); } else { run.combo++; run.maxCombo = Math.max(run.maxCombo, run.combo); }
      run.score += Math.round(JUDGE[j].pts * (1 + Math.min(run.combo, 50) / 100));
      run.life = Math.max(0, Math.min(100, run.life + JUDGE[j].life));
      if (run.life === 0) run.failed = true;
      lane.style.width = Math.min(100, (el / LIMIT) * 100) + '%';
      fill(judgeHost, h('div', { class: 'sekai-judge j-' + j.toLowerCase() }, h('b', { text: j }),
        run.combo >= 2 ? h('span', { class: 'sekai-combo-pop', text: `${run.combo} COMBO` }) : null),
        h('span', { class: 'sekai-judge-sec', text: forced === 'TIMEOUT' ? '' : `${(el / 1000).toFixed(1)} 秒` }));
      updateHud();
      // 判定字停留一下後淡出，避免擋住選項與正解
      setTimeout(() => { if (judgeHost.isConnected) judgeHost.classList.add('gone'); }, 1300);
      const last = run.i + 1 >= run.ids.length || run.failed;
      const go = () => { if (!host || !host.isConnected || ui.run !== run) return; if (last) finish(); else { run.i++; draw(); } };
      if (j !== 'MISS' && !last) run.adv = setTimeout(go, reduced() ? 1400 : 1000);
      else fill(nextBox, h('button', { type: 'button', class: 'sekai-nextbtn', id: 'sekai-next', onclick: go },
        last ? (run.failed ? '生命歸零・查看結算' : '查看結算') : '下一題', h('kbd', { text: 'Enter' })));
      const nb = nextBox.querySelector('button');
      if (nb) nb.focus({ preventScroll: true });
    }
    function timeout() {
      if (run.done) return;
      // 逾時：鎖住選項並標出正解（沒有作答，不寫入紀錄）
      run.timeouts++;
      opts.querySelectorAll('.ans-opt').forEach((b, i) => {
        b.disabled = true;
        const L = QG.LETTERS[i];
        b.classList.add(q.all || q.a.includes(L) ? 'ok' : 'dim');
      });
      judge('MISS');
      const sec = judgeHost.querySelector('.sekai-judge-sec');
      if (sec) sec.textContent = '逾時';
    }

    const hud = h('div', { class: 'sekai-hud' });
    function updateHud() {
      const lifeCls = run.life <= 30 ? ' low' : '';
      fill(hud,
        h('div', { class: 'sekai-hud-l' },
          h('span', { class: 'sekai-hud-song' }, jacket(run.set), h('span', null, h('b', { text: run.set.title }), h('small', { text: `${run.i + 1} / ${run.ids.length}` }))),
          h('span', { class: 'sekai-life' + lifeCls, role: 'img', 'aria-label': `生命 ${run.life}` }, h('span', { class: 'sekai-life-k', text: 'LIFE' }),
            h('span', { class: 'sekai-life-bar' }, h('i', { style: `width:${run.life}%` })), h('b', { text: String(run.life) }))),
        h('div', { class: 'sekai-hud-r' },
          h('span', { class: 'sekai-score' }, h('small', { text: 'SCORE' }), h('b', { text: String(run.score).padStart(7, '0') })),
          h('span', { class: 'sekai-combo' + (run.combo >= 2 ? ' on' : '') }, h('b', { text: String(run.combo) }), h('small', { text: 'COMBO' }))));
    }
    updateHud();

    run.tick = setInterval(() => {
      if (!lane.isConnected) { clearInterval(run.tick); return; }
      const el = performance.now() - t0;
      lane.style.width = Math.min(100, (el / LIMIT) * 100) + '%';
      secs.textContent = (Math.max(0, LIMIT - el) / 1000).toFixed(1);
      if (el >= LIMIT) timeout();
    }, 100);

    QG.setKeys((e) => {
      const k = e.key.toUpperCase();
      if (!run.done) {
        const i = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : QG.LETTERS.indexOf(k);
        if (i >= 0 && k.length === 1) { opts.pick(i); return true; }
      } else if (k === 'ENTER' || k === ' ') {
        const b = nextBox.querySelector('button'); if (b) { b.click(); return true; }
      }
      if (k === 'ESCAPE') { quit(); return true; }
      return false;
    });

    return h('div', { class: 'sekai-play' },
      hud,
      h('div', { class: 'sekai-lane', 'aria-hidden': 'true' },
        h('span', { class: 'sekai-zone z-p', text: 'PERFECT' }), h('span', { class: 'sekai-zone z-g', text: 'GREAT' }), h('span', { class: 'sekai-zone z-o', text: 'GOOD' }),
        lane, h('span', { class: 'sekai-lane-t' }, secs, ' s')),
      h('article', { class: 'sekai-qcard' },
        h('div', { class: 'sekai-qmeta' }, h('span', { class: 'sekai-qno', text: `NOTE ${String(run.i + 1).padStart(2, '0')}` }),
          h('span', { text: q.src.map(QG.srcLabel).join('・') })),
        q.prev && QG.QMAP.get(q.prev) ? h('details', { class: 'sekai-prev' }, h('summary', { text: '本題承接上一題（點此查看）' }), h('p', { text: QG.QMAP.get(q.prev).q })) : null,
        h('p', { class: 'sekai-qtext', text: q.q }),
        q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖（自原始試卷裁切）', loading: 'lazy' })) : null,
        opts,
        judgeHost, nextBox),
      h('div', { class: 'sekai-play-foot' },
        h('button', { type: 'button', class: 'sekai-quit', onclick: quit, text: '放棄（回選曲）' }),
        h('span', { class: 'sekai-keys', text: '按 1–4 或 A–D 作答，Enter 繼續' })));
  }

  function quit() { stopRun(); ui.mode = 'select'; draw(); }

  function rankOf(run) {
    const n = run.ids.length;
    const w = Object.entries(run.counts).reduce((a, [k, c]) => a + JUDGE[k].w * c, 0) / n;
    return w >= 0.93 ? 'S' : w >= 0.78 ? 'A' : w >= 0.55 ? 'B' : 'C';
  }

  function finish() {
    const run = ui.run;
    clearInterval(run.tick);
    const played = Object.values(run.counts).reduce((a, b) => a + b, 0);
    const unplayed = run.ids.length - played; // 生命歸零時剩下的題目視為 MISS 計算評級
    run.counts.MISS += unplayed;
    const rank = rankOf(run);
    const fc = run.counts.MISS === 0;
    const ap = fc && run.counts.PERFECT === run.ids.length;
    const sd = store();
    const prev = sd[run.set.key];
    const isNew = !prev || run.score > prev.score;
    sd[run.set.key] = {
      score: Math.max(run.score, prev ? prev.score : 0),
      rank: isNew ? rank : prev.rank,
      combo: Math.max(run.maxCombo, prev ? prev.combo : 0),
      fc: !!(fc || (prev && prev.fc)), ap: !!(ap || (prev && prev.ap)),
      plays: (prev ? prev.plays : 0) + 1, ts: Date.now(),
    };
    QG.Store.save();
    ui.result = { run, rank, fc, ap, isNew, unplayed };
    ui.run = null;
    ui.mode = 'result';
    const top = document.getElementById('topbar');
    if (top) fill(top, sekaiTop());
    draw();
  }

  function resultView() {
    const { run, rank, fc, ap, isNew, unplayed } = ui.result;
    const s = run.set;
    QG.setKeys((e) => {
      if (e.key === 'Enter') { ui.mode = 'select'; draw(); return true; }
      return false;
    });
    return h('div', { class: 'sekai-result', style: `--h:${hue(s.key)}` },
      h('header', { class: 'sekai-res-head' }, h('span', { class: 'sekai-head-en', 'aria-hidden': 'true', text: 'RESULT' }), h('h1', { text: '結算' }),
        h('span', { class: 'sekai-res-song' }, jacket(s), h('b', { text: s.title }), diffBadge(s.diff))),
      h('div', { class: 'sekai-res-main' },
        h('div', { class: 'sekai-res-rank' },
          h('span', { class: 'sekai-res-k', text: 'RANK' }),
          h('b', { class: 'sekai-big-rank r-' + rank, text: rank }),
          run.failed ? h('span', { class: 'sekai-flag fail', text: 'LIFE 0' }) : ap ? h('span', { class: 'sekai-flag ap', text: 'ALL PERFECT' }) : fc ? h('span', { class: 'sekai-flag fc', text: 'FULL COMBO' }) : null),
        h('div', { class: 'sekai-res-score' },
          h('span', { class: 'sekai-res-k', text: 'SCORE' }),
          h('b', { text: QG.fmtNum(run.score) }),
          isNew ? h('span', { class: 'sekai-newrec', text: 'NEW RECORD' }) : h('span', { class: 'sekai-res-hi', text: `HIGH SCORE ${QG.fmtNum(best(s.key).score)}` }),
          h('div', { class: 'sekai-res-combo' }, h('span', { text: 'MAX COMBO' }), h('b', { text: String(run.maxCombo) }))),
        h('div', { class: 'sekai-res-counts' }, ['PERFECT', 'GREAT', 'GOOD', 'MISS'].map((k) =>
          h('div', { class: 'sekai-cnt j-' + k.toLowerCase() }, h('span', { text: k }), h('b', { text: String(run.counts[k]) }))))),
      h('p', { class: 'sekai-res-note', text: [
        `答對 ${run.counts.PERFECT + run.counts.GREAT + run.counts.GOOD} / ${run.ids.length} 題已寫入學習紀錄（答錯的題目會進錯題本）。`,
        run.timeouts ? `${run.timeouts} 題逾時沒有作答，不寫入紀錄。` : '',
        unplayed ? `生命歸零，剩下 ${unplayed} 題以 MISS 計算評級。` : '',
      ].join('') }),
      h('div', { class: 'sekai-res-btns' },
        h('button', { type: 'button', class: 'sekai-start small', onclick: () => startRun(s) }, icon('sekai-play'), h('span', { text: 'RETRY' })),
        h('button', { type: 'button', class: 'sekai-btn', onclick: () => { ui.mode = 'select'; draw(); } }, icon('sekai-list'), '回選曲'),
        run.miss.length ? h('button', { type: 'button', class: 'sekai-btn', onclick: () => QG.startCustomPractice(run.miss, `${s.title}・MISS 題`) }, `慢慢練 MISS 的 ${run.miss.length} 題`) : null));
  }

  /* ---------------------------------------------------------------- 外框 */

  function draw() {
    if (!host || !host.isConnected) return;
    fill(host, ui.mode === 'play' && ui.run ? playView() : ui.mode === 'result' && ui.result ? resultView() : selectView());
    host.dataset.mode = ui.mode;
  }

  function sekaiHome() {
    // 重新進入首頁（切換畫面、重畫）時，進行中的一輪視同放棄，回到選曲
    stopRun();
    if (ui.mode === 'play') ui.mode = 'select';
    host = h('div', { class: 'sekai-home' });
    host.dataset.mode = ui.mode;
    fill(host, ui.mode === 'result' && ui.result ? resultView() : selectView());
    return host;
  }

  function sekaiTop() {
    const t = QG.totals();
    const sd = (S().settings.skinData && S().settings.skinData.sekai) || {};
    const plays = Object.values(sd).reduce((a, b) => a + (b.plays || 0), 0);
    return h('div', { class: 'sk-top sekai-top' },
      h('a', { class: 'sekai-brand', href: '#home', 'aria-label': 'QuizGrinder 選曲' }, icon('pad', 'sekai-brand-ico'), h('b', { text: 'QUIZGRINDER' })),
      h('span', { class: 'spacer' }),
      h('span', { class: 'sekai-chip' }, h('small', { text: 'PLAYS' }), h('b', { text: String(plays) })),
      h('span', { class: 'sekai-chip' }, h('small', { text: 'ACC' }), h('b', { text: QG.pct(t.c, t.n) })),
      h('span', { class: 'sekai-chip sekai-hide-sm' }, h('small', { text: 'STREAK' }), h('b', { text: `${QG.streak()}D` })));
  }

  SK.register({
    id: 'sekai', label: 'Project SEKAI 風', group: '二次元手遊',
    top: sekaiTop,
    nav: [
      { v: 'home', label: '選曲', icon: 'sekai-note' },
      { v: 'practice', label: '練習', icon: 'practice' },
      { v: 'exam', label: '模擬考', icon: 'exam', big: true },
      { v: 'review', label: '錯題', icon: 'review', badge: true },
      { v: 'stats', label: '紀錄', icon: 'stats' },
    ],
    views: { home: sekaiHome },
  });
})();
