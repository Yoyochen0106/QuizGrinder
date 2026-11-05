/* QuizGrinder 版面風格：ChatGPT 風（對話式家教）
 *
 *   左側欄：新對話、工具（練習／錯題本／模擬考／題庫／統計）、對話紀錄（存在 settings.skinData.chatgpt，最多 30 則）
 *   主畫面：置中歡迎語＋建議膠囊；家教不靠 AI 也能運作——依科目、主題、關鍵字或到期錯題出題，
 *           以 A–D 快速回覆作答（寫入學習紀錄），回覆對錯、正解、出處與題庫解析
 *   AI（只在 Artifact 內）：window.claude.use('sample') 可用時，批改後出現「請 Claude 解釋」，輸入框可切換「問 Claude」
 * 只借用版面、互動與配色；標誌用 QuizGrinder 焊墊圖示。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon } = SK;
  const S = () => QG.S();
  const root = document.documentElement;

  Object.assign(SK.ICONS, {
    'gpt-new': '<path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M17.5 3.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    'gpt-up': '<path d="M12 19V5M5 12l7-7 7 7"/>',
    'gpt-copy': '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    'gpt-spark': '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    'gpt-trash': '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    'gpt-side': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    'gpt-chat': '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/>',
  });

  /* ---------------------------------------------------------------- 儲存 */
  const MAX_CONVOS = 30, MAX_MSGS = 60, MAX_TEXT = 1200;
  const clip = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s || '');

  function data() {
    const s = S().settings;
    s.skinData = s.skinData || {};
    let d = s.skinData.chatgpt;
    if (!d || typeof d !== 'object') d = s.skinData.chatgpt = { convos: [], cur: null };
    if (!Array.isArray(d.convos)) d.convos = [];
    return d;
  }
  const curConvo = () => { const d = data(); return d.convos.find((c) => c.id === d.cur) || null; };
  function save() {
    const d = data();
    d.convos.sort((a, b) => b.ts - a.ts);
    if (d.convos.length > MAX_CONVOS) d.convos = d.convos.slice(0, MAX_CONVOS);
    d.convos.forEach((c) => { if (c.msgs.length > MAX_MSGS) c.msgs = c.msgs.slice(-MAX_MSGS); });
    QG.Store.save();
  }
  function ensureConvo(firstText) {
    let c = curConvo();
    if (!c) {
      const d = data();
      c = { id: 'c' + Date.now().toString(36), title: clip(firstText.replace(/\s+/g, ' ').trim(), 24) || '新對話', ts: Date.now(), msgs: [], scope: null };
      d.convos.unshift(c);
      d.cur = c.id;
    }
    return c;
  }
  function push(c, msg) {
    if (msg.t) msg.t = clip(msg.t, MAX_TEXT);
    c.msgs.push(msg);
    c.ts = Date.now();
  }

  /* ---------------------------------------------------------------- AI（sample 能力） */
  let sample = null;
  let aiAsked = false;
  let ask = false; // 「問 Claude」模式
  async function initAI() {
    if (aiAsked) return;
    aiAsked = true;
    try { sample = window.claude && window.claude.use ? await window.claude.use('sample') : null; } catch (e) { sample = null; }
    if (sample && SK.skin() === 'chatgpt' && QG.currentView === 'home') QG.render();
  }

  const optLines = (q) => QG.LETTERS.map((L) => `(${L}) ${q.o[L]}`).join('\n');
  const officialAns = (q) => (q.all ? '官方釋疑：所有選項均給分' : q.a.map((L) => `(${L}) ${q.o[L]}`).join('、'));
  function explainPrompt(q, mine, ok) {
    return '你是 IPAS 初級電路板製程工程師考試（L11 電路板產業概論、L12 電路板製造概論）的家教。'
      + '請用繁體中文、2–4 句話解釋下面這題為什麼官方答案正確，必要時點出其他選項的問題。不要使用標題或條列，不要重複題目。\n\n'
      + `題目：${q.q}\n${optLines(q)}\n官方答案：${officialAns(q)}\n`
      + (mine ? `學生選了 (${mine})，${ok ? '答對' : '答錯'}。\n` : '')
      + `出處：${q.src.map(QG.srcLabel).join('、')}`;
  }
  function askPrompt(text, c) {
    const lastQ = c && [...c.msgs].reverse().find((m) => m.k === 'q');
    const q = lastQ && QG.QMAP.get(lastQ.q);
    return '你是 IPAS 初級電路板製程工程師考試（L11 電路板產業概論、L12 電路板製造概論）的家教。'
      + '請用繁體中文、2–4 句話回答學生的問題；不確定時請直說，不要編造數據。\n\n'
      + (q ? `（對話中最近的一題，供參考）\n題目：${q.q}\n${optLines(q)}\n官方答案：${officialAns(q)}\n\n` : '')
      + `學生的問題：${text}`;
  }

  /** 請 Claude 回答：串流顯示，完成後存進對話 */
  async function runAI(c, prompt, q) {
    const msg = { r: 'a', k: 'ai', t: '', q: q ? q.id : undefined };
    push(c, msg);
    save();
    drawThread();
    const el = threadEl && threadEl.querySelector('.chatgpt-msg:last-child .chatgpt-ai-text');
    const note = threadEl && threadEl.querySelector('.chatgpt-msg:last-child .chatgpt-ai-note');
    if (el) { el.textContent = '思考中…'; el.classList.add('pending'); }
    busy = true;
    syncSend();
    try {
      const { text } = await sample(prompt, { onText: ({ text: t }) => { if (el) { el.classList.remove('pending'); el.textContent = t; scrollEnd(); } } });
      msg.t = clip(text || '', MAX_TEXT);
    } catch (e) {
      msg.t = clip((e && e.text) || '', MAX_TEXT);
      msg.err = e && e.code === 'not_granted' ? '未允許使用 Claude' : '暫時無法回答，請稍後再試';
      if (note) note.textContent = msg.err;
    }
    busy = false;
    save();
    if (SK.skin() === 'chatgpt' && QG.currentView === 'home') drawThread();
  }

  /* ---------------------------------------------------------------- 家教（不靠 AI） */
  const CMD = /(請|幫我|給我|來|再|出|考考?我|測驗|我想練|想練|練習|一題|題目|的|關於|有關|一下|吧|嗎|？|\?|！|!|。|，|,|\s)+/g;
  const topicOf = (t) => {
    const s = t.toLowerCase();
    let best = null;
    for (const [tag] of QG.TAGS) {
      if (tag === '其他') continue;
      const parts = [tag, ...tag.split(/與|\s/).filter((x) => x.length >= 2)];
      if (parts.some((p) => s.includes(p.toLowerCase()))) { if (!best || tag.length > best.length) best = tag; }
    }
    return best;
  };
  const subjectOf = (s) => (/l11|產業概論|第一科/i.test(s) ? 'industry' : /l12|製造概論|第二科/i.test(s) ? 'process' : null);

  function poolFor(scope) {
    if (!scope) return QG.QS.filter((q) => q.official).map((q) => q.id);
    if (scope.type === 'due') return QG.dueReviewIds().length ? QG.dueReviewIds() : Object.keys(S().q).filter((id) => S().q[id].w && QG.QMAP.has(id));
    return QG.QS.filter((q) => (!scope.subj || q.s === scope.subj) && (!scope.tag || q.t.includes(scope.tag))
      && (!scope.kw || q.text.includes(scope.kw)) && (scope.kw || q.official)).map((q) => q.id);
  }
  const scopeLabel = (sc) => !sc ? '全部官方試題' : sc.type === 'due' ? '你的錯題'
    : [sc.subj ? `${QG.SUBJ_CODE[sc.subj]} ${QG.SUBJ_SHORT[sc.subj]}` : '', sc.tag ? `「${sc.tag}」` : '', sc.kw ? `含「${sc.kw}」` : ''].filter(Boolean).join('・');

  function askQuestion(c, scope, lead) {
    const asked = new Set(c.msgs.filter((m) => m.k === 'q').map((m) => m.q));
    const pool = poolFor(scope);
    if (!pool.length) {
      push(c, { r: 'a', k: 'text', t: scope && scope.type === 'due' ? '你目前沒有錯題，太好了！要不要我從全部題目出一題？' : `${scopeLabel(scope)}找不到題目。換個主題或關鍵字試試看。`, chips: ['出一題 L11 的題目', '出一題 L12 的題目'] });
      return;
    }
    const fresh = pool.filter((id) => !asked.has(id));
    const id = QG.buildQueue(fresh.length ? fresh : pool, 'weak')[0];
    c.scope = scope || null;
    push(c, { r: 'a', k: 'q', q: id, t: lead || `這題來自${scopeLabel(scope)}（共 ${pool.length} 題）：` });
  }

  function pendingQ(c) {
    for (let i = c.msgs.length - 1; i >= 0; i--) { const m = c.msgs[i]; if (m.k === 'q') return m.ans ? null : m; }
    return null;
  }

  function answer(c, m, L, echo = true) {
    const q = QG.QMAP.get(m.q);
    if (!q || m.ans) return;
    const ok = !!(q.all || q.a.includes(L));
    m.ans = L;
    QG.record(q.id, ok);
    QG.Store.save();
    QG.updateBadges();
    if (echo) push(c, { r: 'u', k: 'text', t: `${L}. ${q.o[L]}` });
    push(c, { r: 'a', k: 'grade', q: q.id, ans: L, ok });
  }

  function explain(c) {
    const lastQ = [...c.msgs].reverse().find((m) => m.k === 'q');
    let q = lastQ && QG.QMAP.get(lastQ.q);
    let lead = '';
    if (!q) {
      // 這段對話還沒出題：改用學習紀錄裡最後作答的題目
      const last = Object.entries(S().q).filter(([id, r]) => r.t && QG.QMAP.has(id)).sort((a, b) => b[1].t - a[1].t)[0];
      if (!last) { push(c, { r: 'a', k: 'text', t: '你還沒有作答過任何題目。先讓我出一題吧！', chips: ['出一題 L11 的題目', '考我蝕刻'] }); return; }
      q = QG.QMAP.get(last[0]);
      lead = `你最近一次作答（${SK.relTime(last[1].t)}）的是這題。`;
    }
    push(c, { r: 'a', k: 'explain', q: q.id, t: lead });
  }

  function respond(c, raw) {
    const text = raw.trim();
    const low = text.toLowerCase();
    const pend = pendingQ(c);
    const letter = text.match(/^[(（]?([a-dA-D1-4])[)）.．、]?$/) || text.match(/(?:答案|選)\s*(?:是|為)?\s*[(（]?([a-dA-D])\b/);
    if (pend && letter) {
      const v = letter[1].toUpperCase();
      answer(c, pend, /\d/.test(v) ? QG.LETTERS[+v - 1] : v, false);
      return;
    }
    if (/解釋|為什麼|為何|why|explain/i.test(text) && (/上一題|這題|剛剛|剛才|那題/.test(text) || text.length <= 6)) { explain(c); return; }
    if (/複習|錯題|錯的/.test(text)) {
      const due = QG.dueReviewIds().length;
      askQuestion(c, { type: 'due' }, due ? `你有 ${due} 題到期的錯題。先複習這題：` : '目前沒有到期的錯題，從你答錯過的題目挑一題：');
      return;
    }
    if (/^(再一題|下一題|再來|繼續|next|more|換一題)/i.test(text)) { askQuestion(c, c.scope); return; }
    const subj = subjectOf(text);
    const stripped = text.replace(/l1[12]|產業概論|製造概論|第[一二]科/ig, '');
    const tag = topicOf(stripped);
    const rest = stripped.replace(CMD, ' ').trim().toLowerCase();
    const wantQuiz = /出|考|測驗|來一題|一題|quiz|練/.test(text);
    if (subj || tag) {
      askQuestion(c, { type: 'f', subj, tag }, null);
      return;
    }
    if (rest.length >= 2 || /^[a-z0-9]{2,}$/i.test(rest)) {
      const kw = rest.split(/\s+/).sort((a, b) => b.length - a.length)[0];
      const hits = QG.QS.filter((q) => q.text.includes(kw));
      if (hits.length && wantQuiz) { askQuestion(c, { type: 'f', kw }, null); return; }
      if (hits.length) {
        c.scope = { type: 'f', kw };
        push(c, { r: 'a', k: 'list', kw, n: hits.length, ids: QG.buildQueue(hits.map((q) => q.id), 'weak').slice(0, 5) });
        return;
      }
    }
    if (wantQuiz) { askQuestion(c, null, null); return; }
    push(c, { r: 'a', k: 'text', t: `我在題庫裡找不到「${clip(text, 20)}」。我可以：\n・依科目出題，例如「出一題 L12 的題目」\n・依主題出題，例如「考我蝕刻」「考我軟板」\n・用關鍵字搜尋題庫，例如「ENIG」「乾膜」\n・帶你複習到期的錯題，或解釋上一題`, chips: ['出一題 L12 的題目', '考我蝕刻', '複習我的錯題'] });
  }

  /* ---------------------------------------------------------------- 畫面 */
  let threadEl = null, inputEl = null, sendBtn = null, busy = false;
  const scrollEnd = () => { if (threadEl) threadEl.scrollTop = threadEl.scrollHeight; };
  const syncSend = () => { if (sendBtn) sendBtn.disabled = busy || !(inputEl && inputEl.value.trim()); };

  function send(text, opts = {}) {
    const t = (text || '').trim();
    if (!t || busy) return;
    const fresh = !curConvo();
    const c = ensureConvo(t);
    push(c, { r: 'u', k: 'text', t });
    if (ask && sample && !opts.tutor) {
      if (fresh) QG.render(); else refreshSide();
      runAI(c, askPrompt(t, c), null);
      return;
    }
    respond(c, t);
    save();
    if (fresh) QG.render();
    else { drawThread(); refreshSide(); }
  }

  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); QG.toast('已複製'); } catch (e) { QG.toast('這個瀏覽器不允許複製'); }
  }
  const qText = (q) => `${q.q}\n${optLines(q)}`;
  const answerLine = (q) => (q.all ? '官方釋疑：所有選項均給分。' : `正確答案是 ${q.a.map((L) => `${L}. ${q.o[L]}`).join('；')}`);
  const srcLine = (q) => `出處：${q.src.map(QG.srcLabel).join('、')}${q.src.length > 1 ? `（考過 ${q.src.length} 次）` : ''}`;
  const topicsOf = (q) => q.t.filter((t) => t !== '其他');

  function actions(copy, extra) {
    return h('div', { class: 'chatgpt-acts' },
      h('button', { type: 'button', class: 'chatgpt-act', 'aria-label': '複製', title: '複製', onclick: () => copyText(copy) }, icon('gpt-copy')), extra || null);
  }
  const chipsEl = (list) => (list && list.length ? h('div', { class: 'chatgpt-followups' }, list.map((t) => h('button', { type: 'button', class: 'chatgpt-chip', text: t, onclick: () => send(t, { tutor: true }) }))) : null);
  const paras = (t) => t.split('\n').map((line) => h('p', { text: line }));

  function aiExplainBtn(c, q, mine, ok) {
    if (!sample) return null;
    return h('button', { type: 'button', class: 'chatgpt-ai-btn', onclick: () => { if (!busy) runAI(c, explainPrompt(q, mine, ok), q); } }, icon('gpt-spark'), '請 Claude 解釋');
  }

  function renderMsg(c, m, i) {
    if (m.r === 'u') {
      return h('div', { class: 'chatgpt-msg u' }, h('div', { class: 'chatgpt-bubble' }, paras(m.t)), actions(m.t));
    }
    const q = m.q ? QG.QMAP.get(m.q) : null;
    let body;
    let copy = m.t || '';
    if (m.k === 'q' && q) {
      copy = qText(q);
      const answered = !!m.ans;
      body = [
        m.t ? h('p', { text: m.t }) : null,
        h('div', { class: 'chatgpt-q' },
          h('p', { class: 'chatgpt-q-meta' }, `${QG.SUBJ_CODE[q.s]}・${QG.srcLabel(q.src[0])}`, topicsOf(q).length ? `・${topicsOf(q).join('、')}` : ''),
          h('p', { class: 'chatgpt-q-text', text: q.q }),
          q.fig ? h('figure', { class: 'qfig chatgpt-fig' }, h('img', { src: q.fig, alt: '題目附圖', loading: 'lazy' })) : null,
          h('ol', { class: 'chatgpt-q-opts' }, QG.LETTERS.map((L) => {
            const correct = q.all || q.a.includes(L);
            const cls = answered ? (correct ? 'ok' : L === m.ans ? 'ng' : '') : '';
            return h('li', { class: cls }, h('b', { text: L + '.' }), ' ', q.o[L]);
          }))),
        h('div', { class: 'chatgpt-qr', role: 'group', 'aria-label': '快速回覆' }, QG.LETTERS.map((L) => {
          const correct = q.all || q.a.includes(L);
          return h('button', { type: 'button', class: 'chatgpt-qr-btn' + (answered ? (correct ? ' ok' : L === m.ans ? ' ng' : ' dim') : ''), disabled: answered || null,
            'aria-label': `回答 ${L}`, onclick: () => { const cc = curConvo(); if (!cc) return; answer(cc, m, L); save(); drawThread(); refreshSide(); } }, L);
        })),
      ];
    } else if ((m.k === 'grade' || m.k === 'explain') && q) {
      const grade = m.k === 'grade';
      copy = [grade ? (m.ok ? '✓ 答對了！' : '✗ 答錯了。') : m.t, answerLine(q), srcLine(q), q.x || ''].filter(Boolean).join('\n');
      body = [
        grade ? h('p', { class: 'chatgpt-verdict ' + (m.ok ? 'ok' : 'ng') }, m.ok ? '✓ 答對了！' : '✗ 答錯了。', m.ok ? '' : ' 這題已加入錯題本。') : null,
        !grade && m.t ? h('p', { text: m.t }) : null,
        !grade ? h('blockquote', { class: 'chatgpt-quote', text: q.q }) : null,
        h('p', null, q.all ? '官方釋疑：所有選項均給分。' : ['正確答案是 ', h('strong', { text: q.a.map((L) => `${L}. ${q.o[L]}`).join('；') })]),
        h('p', { class: 'chatgpt-src', text: srcLine(q) }),
        q.x ? h('div', { class: 'chatgpt-x' }, h('p', { class: 'chatgpt-x-h', text: '題庫解析' }), paras(q.x)) : (!grade && !sample ? h('p', { class: 'chatgpt-src', text: '題庫沒有附這題的文字解析。' }) : null),
        topicsOf(q).length ? h('p', { class: 'chatgpt-src' }, '相關主題：', topicsOf(q).map((t) => h('button', { type: 'button', class: 'chatgpt-link', text: t, onclick: () => send(`考我${t}`, { tutor: true }) }))) : null,
        aiExplainBtn(c, q, grade ? m.ans : null, m.ok),
        i === c.msgs.length - 1 ? chipsEl(['再一題', grade ? '解釋上一題' : null, '複習我的錯題'].filter(Boolean)) : null,
      ];
    } else if (m.k === 'list') {
      const qs = (m.ids || []).map((id) => QG.QMAP.get(id)).filter(Boolean);
      copy = qs.map((q) => q.q).join('\n');
      body = [
        h('p', null, `題庫裡有 `, h('strong', { text: `${m.n} 題` }), `提到「${m.kw}」。挑一題開始，或全部拿去練習：`),
        h('ol', { class: 'chatgpt-list' }, qs.map((q) => h('li', null,
          h('button', { type: 'button', class: 'chatgpt-list-q', onclick: () => { const cc = curConvo(); if (!cc) return; push(cc, { r: 'u', k: 'text', t: `考我這題：${clip(q.q, 30)}` }); push(cc, { r: 'a', k: 'q', q: q.id, t: '好，這題：' }); save(); drawThread(); } },
            h('span', null, SK.highlight(clip(q.q, 80), m.kw)), h('small', { text: `${QG.SUBJ_CODE[q.s]}・${QG.srcLabel(q.src[0])}` }))))),
        h('div', { class: 'chatgpt-followups' },
          h('button', { type: 'button', class: 'chatgpt-chip', text: `考我「${m.kw}」`, onclick: () => send(`考我 ${m.kw}`, { tutor: true }) }),
          h('button', { type: 'button', class: 'chatgpt-chip', text: `練習全部 ${m.n} 題`, onclick: () => QG.startCustomPractice(QG.QS.filter((q) => q.text.includes(m.kw)).map((q) => q.id), `關鍵字：${m.kw}`) })),
      ];
    } else if (m.k === 'ai') {
      body = [
        h('p', { class: 'chatgpt-ai-tag' }, icon('gpt-spark'), q ? 'Claude 的解釋' : 'Claude 的回答'),
        h('div', { class: 'chatgpt-ai-text', text: m.t || '' }),
        h('p', { class: 'chatgpt-ai-note', text: m.err || '' }),
      ];
    } else {
      body = [paras(m.t || ''), i === c.msgs.length - 1 ? chipsEl(m.chips) : null];
    }
    return h('div', { class: 'chatgpt-msg a' + (m.k === 'q' ? ' is-q' : '') },
      h('span', { class: 'chatgpt-av', 'aria-hidden': 'true' }, icon('pad')),
      h('div', { class: 'chatgpt-a-body' }, body, actions(copy)));
  }

  function drawThread() {
    if (!threadEl) return;
    const c = curConvo();
    if (!c) return;
    fill(threadEl, h('div', { class: 'chatgpt-col' }, c.msgs.map((m, i) => renderMsg(c, m, i))));
    requestAnimationFrame(scrollEnd);
  }

  function composer(empty) {
    inputEl = h('textarea', { id: 'chatgpt-input', class: 'chatgpt-ta', rows: '1', 'aria-label': '訊息',
      placeholder: ask && sample ? '問 Claude 任何電路板問題…' : empty ? '輸入主題、關鍵字，或「出一題 L12 的題目」' : '輸入 A–D 作答，或換個主題、關鍵字…' });
    const grow = () => { inputEl.style.height = 'auto'; inputEl.style.height = Math.min(200, inputEl.scrollHeight) + 'px'; syncSend(); };
    inputEl.addEventListener('input', grow);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); const v = inputEl.value; inputEl.value = ''; grow(); send(v); }
    });
    sendBtn = h('button', { type: 'submit', class: 'chatgpt-send', 'aria-label': '送出', disabled: true }, icon('gpt-up'));
    return h('form', { class: 'chatgpt-composer', onsubmit: (e) => { e.preventDefault(); const v = inputEl.value; inputEl.value = ''; grow(); send(v); } },
      inputEl,
      h('div', { class: 'chatgpt-comp-row' },
        sample ? h('button', { type: 'button', class: 'chatgpt-mode', 'aria-pressed': ask ? 'true' : 'false', title: '切換：由 Claude 回答自由提問',
          onclick: () => { ask = !ask; QG.render(); setTimeout(() => { const t = document.getElementById('chatgpt-input'); if (t) t.focus(); }, 0); } }, icon('gpt-spark'), '問 Claude') : null,
        h('span', { class: 'chatgpt-comp-hint', text: ask && sample ? 'Claude 模式：回答會即時產生' : 'Enter 送出・Shift+Enter 換行' }),
        h('span', { class: 'spacer' }),
        sendBtn));
  }

  function home() {
    initAI();
    const c = curConvo();
    const empty = !c || !c.msgs.length;
    threadEl = null;
    const t = QG.totals();
    const due = QG.dueReviewIds().length;
    if (empty) {
      const view = h('div', { class: 'chatgpt-chat chatgpt-empty' },
        h('div', { class: 'chatgpt-welcome' },
          h('h1', { text: due ? `有 ${due} 題錯題等你複習` : '今天想練什麼？' }),
          h('p', { class: 'chatgpt-sub', text: `我會從 ${QG.fmtNum(QG.QS.length)} 題 IPAS 題庫出題、批改，並告訴你出處${t.n ? `。你已作答 ${QG.fmtNum(t.n)} 次，正確率 ${QG.pct(t.c, t.n)}` : ''}。` }),
          composer(true),
          h('div', { class: 'chatgpt-sugs' }, ['出一題 L12 的題目', '考我蝕刻', '複習我的錯題', '解釋上一題'].map((s) => h('button', { type: 'button', class: 'chatgpt-chip', text: s, onclick: () => send(s, { tutor: true }) })))),
        h('p', { class: 'chatgpt-disc', text: '家教依 QuizGrinder 題庫出題與批改，答案以官方公告為準。' }));
      return view;
    }
    threadEl = h('div', { class: 'chatgpt-thread', 'aria-live': 'polite' });
    const view = h('div', { class: 'chatgpt-chat' }, threadEl,
      h('div', { class: 'chatgpt-bottom' }, composer(false), h('p', { class: 'chatgpt-disc', text: '家教依 QuizGrinder 題庫出題與批改，答案以官方公告為準。' })));
    drawThread();
    return view;
  }

  /* ---------------------------------------------------------------- 側欄、頂部 */
  function newChat() {
    data().cur = null;
    QG.Store.save();
    closeDrawer();
    if (QG.currentView === 'home') QG.render(); else SK.go('home');
    setTimeout(() => { const t = document.getElementById('chatgpt-input'); if (t) t.focus(); }, 30);
  }
  function openConvo(id) {
    data().cur = id;
    QG.Store.save();
    closeDrawer();
    if (QG.currentView === 'home') QG.render(); else SK.go('home');
  }
  function delConvo(id) {
    const d = data();
    d.convos = d.convos.filter((c) => c.id !== id);
    if (d.cur === id) d.cur = null;
    QG.Store.save();
    QG.toast('已刪除對話');
    if (QG.currentView === 'home') QG.render(); else refreshSide();
  }

  function side(view) {
    const d = data();
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const groups = [['今天', (ts) => ts >= start], ['昨天', (ts) => ts >= start - 864e5], ['過去 7 天', (ts) => ts >= start - 6 * 864e5], ['過去 30 天', (ts) => ts >= start - 29 * 864e5], ['更早', () => true]];
    const left = [...d.convos].sort((a, b) => b.ts - a.ts);
    const out = [];
    for (const [name, test] of groups) {
      const g = [];
      while (left.length && test(left[0].ts)) g.push(left.shift());
      if (!g.length) continue;
      out.push(h('p', { class: 'chatgpt-sec', text: name }));
      g.forEach((c) => out.push(h('div', { class: 'chatgpt-hist' + (view === 'home' && d.cur === c.id ? ' cur' : '') },
        h('button', { type: 'button', class: 'chatgpt-hist-t', title: c.title, 'aria-current': view === 'home' && d.cur === c.id ? 'page' : null, onclick: () => openConvo(c.id) }, c.title),
        h('button', { type: 'button', class: 'chatgpt-hist-x', 'aria-label': `刪除對話「${c.title}」`, title: '刪除', onclick: () => delConvo(c.id) }, icon('gpt-trash')))));
    }
    const t = QG.totals();
    const tool = (v, lbl, ico, badge) => h('a', { class: 'chatgpt-tool', href: '#' + v, 'aria-current': SK.isCurrent(view, v) ? 'page' : null },
      h('span', { class: 'chatgpt-tool-ico' }, icon(ico)), h('span', { text: lbl }), badge ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null);
    return h('nav', { class: 'chatgpt-side', 'aria-label': '對話與工具' },
      h('div', { class: 'chatgpt-side-top' },
        h('a', { class: 'chatgpt-logo', href: '#home', 'aria-label': 'QuizGrinder 家教', onclick: () => closeDrawer() }, icon('pad')),
        h('span', { class: 'spacer' }),
        h('button', { type: 'button', class: 'chatgpt-icon', 'aria-label': '新對話', title: '新對話', onclick: newChat }, icon('gpt-new'))),
      h('button', { type: 'button', class: 'chatgpt-newchat', onclick: newChat }, icon('gpt-new'), h('span', { text: '新對話' })),
      h('div', { class: 'chatgpt-tools' },
        tool('practice', '練習', 'practice'), tool('review', '錯題本', 'review', true), tool('exam', '模擬考', 'exam'), tool('browse', '題庫', 'browse'), tool('stats', '統計', 'stats')),
      h('div', { class: 'chatgpt-hists' }, out.length ? out : h('p', { class: 'chatgpt-none', text: '對話紀錄會出現在這裡。' })),
      h('a', { class: 'chatgpt-me', href: '#stats', onclick: () => closeDrawer() }, h('span', { class: 'chatgpt-me-av', text: 'Q' }),
        h('span', { class: 'chatgpt-me-t' }, h('b', { text: '我的學習' }), h('small', { text: t.n ? `已練 ${QG.fmtNum(t.seen)} 題・正確率 ${QG.pct(t.c, t.n)}` : '還沒有作答紀錄' }))));
  }
  function refreshSide() {
    const s = document.getElementById('sidebar');
    if (s && SK.skin() === 'chatgpt') { fill(s, side(QG.currentView)); QG.updateBadges(); }
  }

  let scrim = null;
  function openDrawer() {
    root.classList.add('chatgpt-drawer');
    if (!scrim) { scrim = h('button', { type: 'button', class: 'chatgpt-scrim', 'aria-label': '關閉側邊欄', onclick: closeDrawer }); document.body.append(scrim); }
    const s = document.querySelector('#sidebar .chatgpt-newchat');
    if (s) s.focus();
  }
  function closeDrawer() {
    root.classList.remove('chatgpt-drawer');
    if (scrim) { scrim.remove(); scrim = null; }
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('chatgpt-drawer')) closeDrawer(); });

  function top(view) {
    const c = view === 'home' ? curConvo() : null;
    const TITLE = { practice: '練習', review: '錯題本', exam: '模擬考', result: '考試結果', browse: '題庫', stats: '統計' };
    return h('div', { class: 'sk-top chatgpt-top' },
      h('button', { type: 'button', class: 'chatgpt-icon chatgpt-menu', 'aria-label': '開啟側邊欄', onclick: openDrawer }, icon('gpt-side')),
      h('a', { class: 'chatgpt-title', href: '#home' }, h('span', { text: 'QuizGrinder 家教' }), h('small', { text: view === 'home' ? (sample ? (ask ? 'Claude 模式' : '題庫模式') : '題庫模式') : TITLE[view] || '' })),
      c ? h('span', { class: 'chatgpt-convo-t', text: c.title }) : null,
      h('div', { class: 'sk-right' },
        h('button', { type: 'button', class: 'chatgpt-icon chatgpt-new-m', 'aria-label': '新對話', onclick: newChat }, icon('gpt-new')),
        h('a', { class: 'chatgpt-me-av small', href: '#stats', 'aria-label': '我的統計', text: 'Q' })));
  }

  /* ---------------------------------------------------------------- 註冊 */
  SK.register({
    id: 'chatgpt', label: 'ChatGPT 風', group: '科技業',
    top, side,
    nav: [
      { v: 'home', label: '家教', icon: 'gpt-chat' },
      { v: 'practice', label: '練習', icon: 'practice' },
      { v: 'review', label: '錯題', icon: 'review', badge: true },
      { v: 'exam', label: '模擬考', icon: 'exam' },
      { v: 'stats', label: '統計', icon: 'stats' },
    ],
    views: { home },
    after: (view, changed) => {
      if (view !== 'home') { threadEl = null; inputEl = null; sendBtn = null; return; }
      if (changed && matchMedia('(min-width: 721px)').matches) setTimeout(() => { if (inputEl && inputEl.isConnected) inputEl.focus({ preventScroll: true }); }, 0);
    },
  });

  const prevBefore = QG.hooks.beforeRender;
  QG.hooks.beforeRender = (view) => { closeDrawer(); prevBefore(view); };
})();
