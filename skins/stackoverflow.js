/* QuizGrinder 版面風格：Stack Overflow 風（問答網站）
 *
 * 借用：頂部橘色細條＋搜尋列、左側導覽（首頁／題目／標籤／使用者）、題目清單（左側統計欄、標題、標籤膠囊、出處卡）、
 * 排序分頁籤、單題頁（左側投票欄、內文、已採納答案框、右側相關問題與熱門問題）、標籤頁、分頁器。
 * 所有數字都來自自己的學習紀錄或題庫本身：投票欄的 ▲ 是「收藏」，數字是「你答對的次數」。
 * 題目頁的狀態放在 browse 畫面裡（soState），不另外改網址。
 */
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;
  const { h, fill } = QG;
  const { icon, hue } = SK;
  const S = () => QG.S();
  const PER = 15;

  Object.assign(SK.ICONS, {
    'so-up': '<path d="M3 17h18L12 6z"/>',
    'so-check': '<path d="M4 12.5l5 5L20 6.5"/>',
    'so-inbox': '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 2h6l1-2h5"/>',
    'so-globe': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"/>',
    'so-users': '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M17.5 14.5c2.2.3 3.6 2 4 4.5"/>',
  });

  const TAG_DESC = {
    '基材與材料': '銅箔基板、玻纖布、樹脂系統、銅箔與各種電路板材料的特性、規格與選用。',
    '檢測與品質': '電測、AOI、切片、可靠度試驗與品質規範，以及常見缺陷的判讀與成因。',
    '其他': '未歸入特定主題的綜合題，涵蓋術語、單位換算與跨製程的觀念。',
    '載板與封裝': 'IC 載板、BGA、CSP、覆晶與封裝結構，以及載板特有的細線路製程。',
    '產業與市場': '電路板產業鏈、上下游應用、市場規模與主要產品類型的發展趨勢。',
    '鑽孔與成孔': '機械鑽孔、雷射鑽孔、盲埋孔、孔壁品質與鑽孔參數。',
    '環保與安全': '廢水、廢氣與廢棄物處理、RoHS 等法規、化學品與工安管理。',
    '電鍍與金屬化': '除膠渣、化學銅、電鍍銅、填孔電鍍與鍍層均勻性的控制。',
    '內層與壓合': '內層線路、黑／棕化處理、疊構、壓合程序與層間對位。',
    '高頻高速': '介電常數與損耗、阻抗控制、訊號完整性與高頻材料。',
    '軟板': '軟性電路板與軟硬結合板的材料、覆蓋膜、補強與彎折設計。',
    '影像轉移': '乾膜、曝光、顯影、底片與 LDI 等把線路圖形轉移到板面的製程。',
    'HDI 與增層': '高密度互連、增層法、微盲孔、任意層互連與疊孔結構。',
    '蝕刻': '酸性／鹼性蝕刻、蝕刻因子、側蝕與線寬控制。',
    '表面處理': 'ENIG、OSP、噴錫、化銀、化錫等最終表面處理的特性與比較。',
    '發展歷史': '電路板技術的起源、重要里程碑與製程演進。',
    '防焊與文字': '防焊漆（綠漆）塗佈、曝光顯影、文字印刷與防焊開窗。',
  };

  const soState = { page: 'list', qid: null, sort: 'hot', tag: '', kw: '', pageNo: 0, tagSort: 'pop', tagKw: '' };

  const realTags = (q) => q.t.filter((t) => t !== '其他');
  const tagSlug = (t) => t.replace(/\s+/g, '-').toLowerCase();
  const rec = (q) => S().q[q.id] || null;
  const nAns = (q) => { const r = rec(q); return r ? r.c + r.w : 0; };
  const nOk = (q) => { const r = rec(q); return r ? r.c : 0; };
  const shortTitle = (t) => (Array.from(t).length > 60 ? Array.from(t).slice(0, 57).join('') + '…' : t);
  const yearOf = (q) => (q.year ? `${q.year} 年` : '模擬題');

  let navFlag = false;
  let lastView = null;
  function openQ(id) {
    navFlag = true;
    soState.page = 'q';
    soState.qid = id;
    SK.go('browse');
    window.scrollTo(0, 0);
  }
  function openList(patch) {
    navFlag = true;
    Object.assign(soState, { page: 'list', pageNo: 0 }, patch || {});
    SK.go('browse');
    window.scrollTo(0, 0);
  }
  function openTags() {
    navFlag = true;
    soState.page = 'tags';
    SK.go('browse');
    window.scrollTo(0, 0);
  }

  function tagChip(t, extra) {
    return h('button', { class: 'so-tag' + (extra ? ' ' + extra : ''), type: 'button', title: `顯示標籤「${t}」的題目`, text: tagSlug(t),
      onclick: (e) => { e.stopPropagation(); openList({ tag: t, kw: '' }); } });
  }
  function subjChip(q) {
    return h('button', { class: 'so-tag subj', type: 'button', title: `只看 ${QG.SUBJ_CODE[q.s]} ${QG.SUBJ_SHORT[q.s]}`, text: QG.SUBJ_CODE[q.s].toLowerCase(),
      onclick: (e) => { e.stopPropagation(); openList({ tag: '', kw: '', subj: q.s }); } });
  }

  /* ---------------------------------------------------------------- 頂部列與側欄 */

  function soTop() {
    const t = QG.totals();
    const input = h('input', { type: 'search', id: 'so-q', placeholder: '搜尋題目、選項…', value: soState.kw, 'aria-label': '搜尋題目', autocomplete: 'off' });
    return h('div', { class: 'sk-top so-top' },
      h('a', { class: 'so-brand', href: '#home', 'aria-label': 'QuizGrinder 首頁' }, icon('pad', 'so-logo'), h('span', null, 'quiz', h('b', { text: 'grinder' }))),
      h('nav', { class: 'so-toplinks', 'aria-label': '學習' },
        h('a', { href: '#practice', text: '練習' }), h('a', { href: '#exam', text: '模擬考' })),
      h('form', { class: 'so-search', role: 'search', onsubmit: (e) => { e.preventDefault(); openList({ kw: input.value.trim(), tag: '' }); } },
        icon('search'), input),
      h('div', { class: 'so-user' },
        h('a', { class: 'so-me', href: '#stats', title: `答對 ${QG.fmtNum(t.c)} 次・查看統計` },
          h('span', { class: 'so-av', text: 'Q' }), h('b', { class: 'so-rep', text: QG.fmtNum(t.c) })),
        h('a', { class: 'so-topicon', href: '#review', 'aria-label': '錯題本', title: '錯題本' }, icon('so-inbox'), h('span', { class: 'badge', 'data-badge': 'review', hidden: true })),
        h('a', { class: 'so-topicon', href: '#stats', 'aria-label': '統計', title: '統計' }, icon('stats'))));
  }

  function soSide(view) {
    const inBrowse = view === 'browse';
    const cur = (k) => (k === 'home' ? view === 'home'
      : k === 'questions' ? inBrowse && soState.page !== 'tags'
        : k === 'tags' ? inBrowse && soState.page === 'tags'
          : k === 'users' ? view === 'stats' : SK.isCurrent(view, k));
    const link = (k, label, ico, onclick, href) => h('a', { class: 'so-nav' + (ico ? '' : ' plain'), href: href || '#browse', 'aria-current': cur(k) ? 'page' : null,
      onclick: onclick ? (e) => { e.preventDefault(); onclick(); } : null }, ico ? icon(ico) : null, h('span', { text: label }),
      k === 'review' ? h('span', { class: 'badge', 'data-badge': 'review', hidden: true }) : null);
    return h('nav', { class: 'so-side', 'aria-label': '主要導覽' },
      link('home', '首頁', null, null, '#home'),
      h('p', { class: 'so-side-h', text: '題庫' }),
      link('questions', '題目', 'so-globe', () => openList()),
      link('tags', '標籤', null, openTags),
      link('users', '使用者', null, null, '#stats'),
      h('p', { class: 'so-side-h', text: '學習' }),
      link('practice', '練習', null, null, '#practice'),
      link('review', '錯題本', null, null, '#review'),
      link('exam', '模擬考', null, null, '#exam'),
      h('div', { class: 'so-side-box' },
        h('strong', { text: '收藏的題目' }),
        h('p', { text: '在題目頁按 ▲ 即可收藏，之後可以一起練習。' }),
        h('button', { class: 'so-btn small', type: 'button', text: '練習收藏', onclick: () => {
          const ids = QG.QS.filter((q) => rec(q) && rec(q).s).map((q) => q.id);
          if (ids.length) QG.startCustomPractice(ids, '收藏題目'); else QG.toast('還沒有收藏的題目');
        } })));
  }

  /* ---------------------------------------------------------------- 題目清單 */

  function filtered() {
    const kw = soState.kw.trim().toLowerCase();
    return QG.QS.filter((q) => (!kw || q.text.includes(kw)) && (!soState.tag || q.t.includes(soState.tag)) && (!soState.subj || q.s === soState.subj));
  }
  const IDX = new Map();
  function sorted(list, sort) {
    if (!IDX.size) QG.QS.forEach((q, i) => IDX.set(q.id, i));
    const a = list.slice();
    if (sort === 'hot') return a.sort((x, y) => y.src.length - x.src.length || y.year - x.year || IDX.get(y.id) - IDX.get(x.id));
    if (sort === 'new') return a.sort((x, y) => y.year - x.year || IDX.get(y.id) - IDX.get(x.id));
    const st = S().q;
    const score = (q) => { const r = st[q.id]; if (!r || !(r.c + r.w)) return -1; return (r.w + 1) / (r.c + r.w + 2) + (r.b ? 0.5 : 0); };
    return a.sort((x, y) => score(y) - score(x) || (st[y.id] ? st[y.id].w : 0) - (st[x.id] ? st[x.id].w : 0) || IDX.get(x.id) - IDX.get(y.id));
  }

  function statsCol(q) {
    const r = rec(q);
    const n = nAns(q), c = nOk(q);
    const ansCls = c ? (r && !r.b ? ' acc' : ' has') : '';
    return h('div', { class: 'so-stats' },
      h('span', { class: 'so-stat' }, h('b', { text: QG.fmtNum(n) }), ' 次作答'),
      h('span', { class: 'so-stat so-ansbox' + ansCls, title: ansCls === ' acc' ? '答對過，且不在錯題本' : null }, ansCls === ' acc' ? icon('so-check') : null, h('b', { text: QG.fmtNum(c) }), ' 答對'),
      h('span', { class: 'so-stat views' + (q.src.length > 1 ? ' hot' : '') }, `考過 ${q.src.length} 次`));
  }

  function srcCard(q, cls) {
    const s = q.src[0];
    const e = QG.EXAM_MAP.get(s.exam) || {};
    return h('div', { class: 'so-owner ' + (cls || '') },
      h('span', { class: 'so-owner-av', style: `--h:${hue(s.exam)}`, text: e.official ? String(e.year).slice(-2) : '模' }),
      h('span', { class: 'so-owner-name', text: QG.srcLabel(s) }),
      q.src.length > 1 ? h('b', { class: 'so-owner-more', text: `+${q.src.length - 1}` }) : null,
      h('span', { class: 'so-owner-time', text: yearOf(q) }));
  }

  /** 單題頁右下角的「提問者卡片」：改放第一次出題的考卷 */
  function askedCard(q) {
    const s = q.src[0];
    const e = QG.EXAM_MAP.get(s.exam) || {};
    return h('div', { class: 'so-asked' },
      h('span', { class: 'so-asked-label', text: e.official ? `出自 ${e.year} 年考卷` : '出自模擬題' }),
      h('div', { class: 'so-asked-row' },
        h('span', { class: 'so-owner-av', style: `--h:${hue(s.exam)}`, text: e.official ? String(e.year).slice(-2) : '模' }),
        h('div', { class: 'so-asked-text' },
          h('span', { class: 'so-owner-name', text: QG.srcLabel(s) }),
          h('span', { class: 'so-asked-meta', text: q.src.length > 1 ? `共考過 ${q.src.length} 次` : '只考過 1 次' }))));
  }

  function listItem(q, kw) {
    return h('div', { class: 'so-item' },
      statsCol(q),
      h('div', { class: 'so-sum' },
        h('h3', { class: 'so-title' }, h('a', { href: '#browse', onclick: (e) => { e.preventDefault(); openQ(q.id); } }, kw ? SK.highlight(q.q, kw) : q.q)),
        h('p', { class: 'so-excerpt' }, QG.LETTERS.map((L) => [h('b', { text: `(${L}) ` }), kw ? SK.highlight(q.o[L], kw) : q.o[L], '　'])),
        h('div', { class: 'so-meta' },
          h('div', { class: 'so-tags' }, subjChip(q), realTags(q).map((t) => tagChip(t)), q.fig ? h('span', { class: 'so-tag plain', text: '附圖' }) : null),
          srcCard(q))));
  }

  function pager(total, onPage) {
    const pages = Math.ceil(total / PER);
    if (pages <= 1) return null;
    const p = soState.pageNo;
    const nums = new Set([0, 1, pages - 2, pages - 1, p - 1, p, p + 1].filter((x) => x >= 0 && x < pages));
    const list = [...nums].sort((a, b) => a - b);
    const out = [];
    if (p > 0) out.push(h('button', { type: 'button', class: 'so-pg', text: '上一頁', onclick: () => onPage(p - 1) }));
    list.forEach((x, i) => {
      if (i && x - list[i - 1] > 1) out.push(h('span', { class: 'so-pg-gap', text: '…' }));
      out.push(h('button', { type: 'button', class: 'so-pg', 'aria-current': x === p ? 'page' : null, text: String(x + 1), onclick: () => onPage(x) }));
    });
    if (p < pages - 1) out.push(h('button', { type: 'button', class: 'so-pg', text: '下一頁', onclick: () => onPage(p + 1) }));
    return h('nav', { class: 'so-pager', 'aria-label': '分頁' }, out);
  }

  function sortTabs(onSort) {
    return h('div', { class: 'so-tabs', role: 'group', 'aria-label': '排序' }, [['hot', '高頻'], ['new', '最新'], ['weak', '弱點']].map(([k, l]) =>
      h('button', { type: 'button', 'aria-pressed': soState.sort === k ? 'true' : 'false', text: l, onclick: () => onSort(k) })));
  }

  function listPage(isHome) {
    const wrap = h('div', { class: 'so-page so-list' + (isHome ? ' home' : '') });
    const draw = () => {
      const kw = soState.kw.trim().toLowerCase();
      const list = sorted(isHome ? QG.QS : filtered(), soState.sort);
      const pages = Math.max(1, Math.ceil(list.length / PER));
      soState.pageNo = Math.min(soState.pageNo, pages - 1);
      const shown = isHome ? list.slice(0, 20) : list.slice(soState.pageNo * PER, soState.pageNo * PER + PER);
      const title = isHome ? '熱門題目'
        : soState.tag ? `標籤：${soState.tag}` : soState.kw ? `搜尋結果` : soState.subj ? `${QG.SUBJ_CODE[soState.subj]} ${QG.SUBJ_SHORT[soState.subj]}` : '所有題目';
      const noRecord = soState.sort === 'weak' && !Object.keys(S().q).length;
      fill(wrap,
        h('div', { class: 'so-head' },
          h('h1', { text: title }),
          h('button', { class: 'so-btn', type: 'button', text: '練習這些題目', onclick: () => QG.startCustomPractice(list.slice(0, 200).map((q) => q.id), `${title}${soState.sort === 'weak' ? '（弱點）' : ''}`) })),
        !isHome && soState.tag && TAG_DESC[soState.tag] ? h('p', { class: 'so-tagdesc', text: TAG_DESC[soState.tag] }) : null,
        !isHome && soState.kw ? h('p', { class: 'so-filterline' }, '關鍵字「', h('b', { text: soState.kw }), '」 ', h('button', { class: 'so-link', type: 'button', text: '清除', onclick: () => { soState.kw = ''; soState.pageNo = 0; QG.render(); } })) : null,
        h('div', { class: 'so-bar' },
          h('span', { class: 'so-count', text: `${QG.fmtNum(list.length)} 題` }),
          (soState.tag || soState.subj) && !isHome ? h('button', { class: 'so-link', type: 'button', text: '× 清除篩選', onclick: () => { soState.tag = ''; soState.subj = ''; soState.pageNo = 0; draw(); } }) : null,
          h('span', { class: 'spacer' }),
          sortTabs((k) => { soState.sort = k; soState.pageNo = 0; draw(); })),
        noRecord ? h('div', { class: 'so-notice' }, h('b', { text: '還沒有作答紀錄。' }), ' 「弱點」排序會把你答錯比例最高的題目排在最前面，先去練習幾題吧。') : null,
        list.length ? h('div', { class: 'so-items' }, shown.map((q) => listItem(q, kw))) : h('div', { class: 'so-notice' }, '找不到符合的題目，試試較短的關鍵字。'),
        isHome ? h('p', { class: 'so-more' }, '想看更多？瀏覽', h('a', { href: '#browse', onclick: (e) => { e.preventDefault(); openList({ tag: '', kw: '', subj: '' }); }, text: `全部 ${QG.fmtNum(QG.QS.length)} 題` }), '，或依', h('a', { href: '#browse', onclick: (e) => { e.preventDefault(); openTags(); }, text: '標籤' }), '找題目。')
          : pager(list.length, (p) => { soState.pageNo = p; draw(); window.scrollTo(0, 0); }));
    };
    draw();
    return h('div', { class: 'so-wrap' }, wrap, sidebar(null));
  }

  /* ---------------------------------------------------------------- 單題頁 */

  function voteCol(q) {
    const col = h('div', { class: 'so-vote' });
    const draw = () => {
      const on = !!(rec(q) && rec(q).s);
      fill(col,
        h('button', { class: 'so-vbtn up' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', 'aria-label': on ? '取消收藏' : '收藏這題', title: on ? '已收藏（再按一次取消）' : '收藏這題',
          onclick: () => { QG.toggleStar(q.id); draw(); } }, icon('so-up')),
        h('span', { class: 'so-vcount', title: '你答對這題的次數', text: QG.fmtNum(nOk(q)) }),
        h('span', { class: 'so-vlabel', text: '答對' }),
        h('button', { class: 'so-vbtn small', type: 'button', 'aria-label': '加入錯題本', title: '加入錯題本', onclick: () => SK.addToReview(q) }, icon('bookmark')));
    };
    draw();
    col.redraw = draw;
    return col;
  }

  function accepted(q) {
    return h('div', { class: 'so-post so-accepted' },
      h('div', { class: 'so-vote' },
        h('span', { class: 'so-checkmark', role: 'img', 'aria-label': '已採納的答案', title: '已採納的答案（官方公告答案）' }, icon('so-check'))),
      h('div', { class: 'so-postbody' },
        h('p', { class: 'so-ans-main' }, q.all ? '官方釋疑：本題所有選項均給分。'
          : q.a.map((L) => h('span', { class: 'so-ans-opt' }, h('b', { text: `(${L})` }), ' ', q.o[L]))),
        !q.all && q.a.length > 1 ? h('p', { class: 'so-note', text: `官方釋疑：${q.a.join('、')} 均給分。` }) : null,
        q.x ? h('p', { class: 'so-x', text: q.x }) : null,
        h('div', { class: 'so-ans-src' },
          h('b', { text: '出處' }),
          h('ul', null, q.src.map((s) => h('li', null, h('a', { href: '#practice', title: '練習這份考卷', onclick: (e) => {
            e.preventDefault();
            QG.startCustomPractice(QG.QS.filter((x) => x.src.some((y) => y.exam === s.exam)).map((x) => x.id), (QG.EXAM_MAP.get(s.exam) || {}).title || s.exam);
          }, text: QG.srcLabel(s) }),
            ' — ', (QG.EXAM_MAP.get(s.exam) || {}).title || s.exam)))),
        h('div', { class: 'so-post-foot' },
          h('span', { class: 'so-muted', text: '答案依官方公告答案與疑義釋覆核對' }),
          h('div', { class: 'so-owner acc' }, h('span', { class: 'so-owner-av', style: '--h:140', text: '✓' }), h('span', { class: 'so-owner-name', text: '官方答案' })))));
  }

  function questionPage(q) {
    let revealed = false;
    const ansBox = h('div', { class: 'so-answers' });
    const vote = voteCol(q);
    const drawAns = () => fill(ansBox, revealed
      ? [h('h2', { class: 'so-ans-h' }, '1 個答案', h('span', { class: 'so-muted', text: '・已採納' })), accepted(q)]
      : h('div', { class: 'so-reveal' },
        h('p', { text: '先自己作答，或直接查看已採納的答案。' }),
        h('button', { class: 'so-btn outline', type: 'button', text: '顯示答案', onclick: () => { revealed = true; drawAns(); } })));
    const info = h('div', { class: 'so-qinfo' });
    const drawInfo = () => {
      const rr = rec(q);
      fill(info,
        h('span', null, h('span', { class: 'so-muted', text: '出處 ' }), QG.srcLabel(q.src[0])),
        h('span', null, h('span', { class: 'so-muted', text: '考過 ' }), `${q.src.length} 次`),
        h('span', null, h('span', { class: 'so-muted', text: '你作答 ' }), `${nAns(q)} 次`),
        h('span', null, h('span', { class: 'so-muted', text: '最後作答 ' }), SK.relTime(rr && rr.t)));
    };
    drawInfo();
    const opts = SK.answerOptions(q, { cls: 'so-opts', onDone: () => { revealed = true; drawAns(); vote.redraw(); drawInfo(); } });
    QG.setKeys((e) => {
      if (document.body.classList.contains('mx-open')) return false;
      if ('1234'.includes(e.key) && e.key.length === 1) { opts.pick(+e.key - 1); return true; }
      return false;
    });
    drawAns();
    const tags = realTags(q);
    return h('div', { class: 'so-wrap q' },
      h('div', { class: 'so-page so-qpage' },
        h('div', { class: 'so-head' },
          h('h1', { class: 'so-qtitle', text: shortTitle(q.q) }),
          h('button', { class: 'so-btn', type: 'button', text: '練習相似題', onclick: () => {
            const pool = QG.QS.filter((x) => x.official && x.id !== q.id && tags.some((t) => x.t.includes(t))).map((x) => x.id);
            QG.startCustomPractice([q.id].concat(QG.shuffle(pool).slice(0, 19)), `相似題：${tags[0] || QG.SUBJ_SHORT[q.s]}`);
          } })),
        info,
        h('div', { class: 'so-post' },
          vote,
          h('div', { class: 'so-postbody' },
            h('p', { class: 'so-qtext', text: q.q }),
            q.fig ? h('figure', { class: 'qfig', style: 'margin:0' }, h('img', { src: q.fig, alt: '題目附圖' })) : null,
            q.prev && QG.QMAP.get(q.prev) ? h('details', { class: 'so-prev' }, h('summary', { text: '承上題' }), h('p', { text: QG.QMAP.get(q.prev).q })) : null,
            opts,
            h('div', { class: 'so-tags' }, subjChip(q), tags.map((t) => tagChip(t))),
            h('div', { class: 'so-post-foot' },
              h('div', { class: 'so-postmenu' },
                h('button', { class: 'so-link muted', type: 'button', text: '複製', onclick: () => SK.copyQuestion(q) }),
                h('button', { class: 'so-link muted', type: 'button', text: '加入錯題本', onclick: () => SK.addToReview(q) }),
                h('button', { class: 'so-link muted', type: 'button', text: '單題作答', onclick: () => QG.startCustomPractice([q.id], '單題作答') })),
              askedCard(q)))),
        ansBox,
        h('p', { class: 'so-more' }, '回到', h('a', { href: '#browse', onclick: (e) => { e.preventDefault(); openList(); }, text: '題目清單' }),
          tags[0] ? ['，或瀏覽更多', tagChip(tags[0], 'inline'), '的題目。'] : '。')),
      sidebar(q));
  }

  /* ---------------------------------------------------------------- 右側欄 */

  function miniQ(q, num, numCls) {
    return h('li', { class: 'so-mini' },
      h('span', { class: 'so-mini-n ' + (numCls || ''), title: numCls === 'hot' ? '考過的次數' : '你答對的次數', text: String(num) }),
      h('a', { href: '#browse', onclick: (e) => { e.preventDefault(); openQ(q.id); }, text: shortTitle(q.q) }));
  }

  function sidebar(q) {
    const st = S();
    const today = st.days[QG.dayKey()] || { n: 0, c: 0 };
    const t = QG.totals();
    const tag = q ? realTags(q)[0] : null;
    const related = tag ? QG.QS.filter((x) => x.id !== q.id && x.t.includes(tag)).sort((a, b) => b.src.length - a.src.length || b.year - a.year).slice(0, 8) : [];
    const hot = QG.QS.filter((x) => x.src.length > 1 && (!q || x.id !== q.id)).sort((a, b) => b.src.length - a.src.length || b.year - a.year).slice(0, 8);
    return h('aside', { class: 'so-aside', 'aria-label': '側欄' },
      h('section', { class: 'so-yellow' },
        h('h2', { text: '你的學習' }),
        h('ul', null,
          h('li', null, icon('pad'), `今天作答 ${today.n} 題，答對 ${today.c} 題`),
          h('li', null, icon('stats'), `總正確率 ${QG.pct(t.c, t.n)}（${QG.fmtNum(t.seen)} 題已練）`),
          h('li', null, icon('review'), h('a', { href: '#review', text: `錯題本 ${QG.dueReviewIds().length} 題待複習` })),
          h('li', null, icon('flame'), `連續 ${QG.streak()} 天`))),
      related.length ? h('section', { class: 'so-box' },
        h('h2', { text: '相關問題' }),
        h('ul', { class: 'so-minis' }, related.map((x) => miniQ(x, nOk(x), nOk(x) ? 'ok' : '')))) : null,
      h('section', { class: 'so-box' },
        h('h2', { text: '熱門問題' }),
        h('ul', { class: 'so-minis hot' }, hot.map((x) => h('li', { class: 'so-mini' },
          h('span', { class: 'so-site', style: `--h:${hue(x.t[0] || x.id)}`, 'aria-hidden': 'true' }),
          h('a', { href: '#browse', onclick: (e) => { e.preventDefault(); openQ(x.id); }, title: `考過 ${x.src.length} 次`, text: shortTitle(x.q) }))))));
  }

  /* ---------------------------------------------------------------- 標籤頁 */

  function tagsPage() {
    const wrap = h('div', { class: 'so-page so-tagspage' });
    const grid = h('div', { class: 'so-taggrid' });
    const input = h('input', { type: 'search', id: 'so-tagq', placeholder: '依名稱篩選標籤', value: soState.tagKw, 'aria-label': '篩選標籤' });
    const data = QG.TAGS.map(([t, n]) => {
      const qs = QG.QS.filter((q) => q.t.includes(t));
      const p = SK.progressOf(qs.map((q) => q.id));
      return { t, n, l11: qs.filter((q) => q.s === 'industry').length, l12: qs.filter((q) => q.s === 'process').length,
        hot: qs.filter((q) => q.src.length > 1).length, latest: Math.max(0, ...qs.map((q) => q.year || 0)), p, acc: p.n ? p.c / p.n : -1 };
    });
    const draw = () => {
      const kw = soState.tagKw.trim().toLowerCase();
      let list = data.filter((d) => !kw || d.t.toLowerCase().includes(kw));
      if (soState.tagSort === 'name') list = list.slice().sort((a, b) => a.t.localeCompare(b.t, 'zh-Hant'));
      else if (soState.tagSort === 'weak') list = list.slice().sort((a, b) => (a.acc < 0 ? 2 : a.acc) - (b.acc < 0 ? 2 : b.acc));
      fill(grid, list.length ? list.map((d) => h('div', { class: 'so-tagcard' },
        h('div', { class: 'so-tagcard-top' }, tagChip(d.t), d.p.seen ? h('span', { class: 'so-acc' + (d.acc < 0.6 ? ' low' : ''), text: QG.pct(d.p.c, d.p.n) }) : null),
        h('p', { class: 'so-tagcard-desc', text: TAG_DESC[d.t] || `${d.t}相關的歷屆考題。` }),
        h('div', { class: 'so-tagcard-foot' },
          h('span', { text: `${d.n} 題` }),
          h('span', { text: `L11 ${d.l11}・L12 ${d.l12}` }),
          h('span', { text: d.hot ? `${d.hot} 題考過多次` : `最新 ${d.latest || '—'} 年` }),
          h('span', { text: `已練 ${d.p.seen}` })))) : h('p', { class: 'so-notice', text: '沒有符合的標籤。' }));
    };
    input.addEventListener('input', () => { soState.tagKw = input.value; draw(); });
    fill(wrap,
      h('h1', { text: '標籤' }),
      h('p', { class: 'so-lead', text: '標籤是題目的主題分類。依主題瀏覽，可以集中補強同一類觀念；一題可能同時屬於好幾個標籤。' }),
      h('div', { class: 'so-bar' },
        h('label', { class: 'so-filter' }, icon('search'), input),
        h('span', { class: 'spacer' }),
        h('div', { class: 'so-tabs', role: 'group', 'aria-label': '排序' }, [['pop', '熱門'], ['name', '名稱'], ['weak', '弱點']].map(([k, l]) =>
          h('button', { type: 'button', 'aria-pressed': soState.tagSort === k ? 'true' : 'false', text: l, onclick: (e) => {
            soState.tagSort = k;
            e.currentTarget.parentNode.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
            draw();
          } })))),
      grid);
    draw();
    return h('div', { class: 'so-wrap' }, wrap);
  }

  /* ---------------------------------------------------------------- 使用者（統計） */

  function soStats(base) {
    const el = base.stats();
    const st = S();
    const t = QG.totals();
    const days = Object.keys(st.days).filter((k) => st.days[k].n).sort();
    const starred = Object.values(st.q).filter((r) => r.s).length;
    const head = h('section', { class: 'so-profile' },
      h('span', { class: 'so-av big', text: 'Q' }),
      h('div', { class: 'so-prof-info' },
        h('h1', { text: '我的學習紀錄' }),
        h('p', { class: 'so-muted' }, days.length ? `第一次作答：${days[0]}・共 ${days.length} 天有作答` : '還沒有作答紀錄'),
        h('div', { class: 'so-prof-stats' },
          [[QG.fmtNum(t.c), '答對次數'], [QG.fmtNum(t.n), '作答次數'], [QG.pct(t.c, t.n), '正確率'], [`${QG.fmtNum(t.seen)}/${QG.fmtNum(QG.QS.length)}`, '已練題目'], [String(QG.dueReviewIds().length), '錯題待複習'], [String(starred), '收藏'], [String(QG.streak()), '連續天數']]
            .map(([v, l]) => h('div', null, h('b', { text: v }), h('span', { text: l }))))));
    el.classList.add('so-statsview');
    const hero = el.querySelector('.hero');
    if (hero) hero.replaceWith(head); else el.prepend(head);
    return el;
  }

  function soBrowse() {
    // 從其他畫面（例如底部導覽）進來時回到題目清單；站內連結（openQ／openList／openTags）會保留狀態
    if (lastView !== 'browse' && !navFlag) soState.page = 'list';
    navFlag = false;
    const q = soState.page === 'q' && QG.QMAP.get(soState.qid);
    if (q) return questionPage(q);
    if (soState.page === 'tags') return tagsPage();
    return listPage(false);
  }

  SK.register({
    id: 'stackoverflow',
    label: 'Stack Overflow 風',
    group: '學習測驗',
    top: soTop,
    side: soSide,
    nav: [
      { v: 'home', label: '首頁', icon: 'home' },
      { v: 'browse', label: '題目', icon: 'so-globe' },
      { v: 'practice', label: '練習', icon: 'practice' },
      { v: 'review', label: '錯題本', icon: 'review', badge: true },
      { v: 'stats', label: '使用者', icon: 'user' },
    ],
    views: { home: () => listPage(true), browse: soBrowse, stats: soStats },
    after: (view) => {
      lastView = view;
      navFlag = false;
      // 底部導覽的「題目」：在題目頁（同一個 #browse）時也要能回到清單
      const bn = document.querySelector('#bottomnav a[href="#browse"]');
      if (bn) bn.addEventListener('click', (e) => { e.preventDefault(); openList(); });
    },
  });
})();
