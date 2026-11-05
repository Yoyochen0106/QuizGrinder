# 版面風格（skins）開發指南

版面風格實驗讓同一套題庫與學習紀錄，套上不同網站的**版面與互動模式**。網址加 `?skins`（或 Artifact 實驗版）會出現切換列。

```
app.js            題庫、學習紀錄、所有基本畫面（window.QG）
skins.js/.css     風格系統本體＋YouTube／Google／Claude Docs 風（window.QGSkins）
skins-more.js/.css  Instagram／Threads／Clash of Clans 風＋共用元件
skins/<id>.js/.css  其他風格，一個風格一組檔案
```

新增一個風格：建立 `skins/<id>.js` 與 `skins/<id>.css`，並在 `index.html` 的 `SKINS-CSS`／`SKINS-JS` 區塊各加一行引用（順序＝切換列順序；`tools/build_artifact.py` 會照這個順序打包）。

## 原則

1. **只借用版面、互動與配色**，不使用任何品牌的標誌、吉祥物、角色、專屬字型或圖片。標誌一律用 QuizGrinder 的焊墊圖示（`SK.icon('pad')` 或 `SK.brand()`）。切換列名稱寫成「<網站名> 風」。
2. **資料都要是真的**：只顯示由學習紀錄算得出的數字。不可捏造其他使用者、按讚數、追蹤者、排行榜上的假玩家。需要「別人」的地方改成和自己過去的成績比。
3. **不改動共用檔案**：只寫自己的 `skins/<id>.*`。需要共用 API 沒有的功能，就在自己的檔案裡實作。
4. **CSS 一律限定範圍**：每條規則都以 `:root[data-skin="<id>"]` 開頭，或使用 `<id>-` 開頭的 class，避免影響其他風格。
5. **兩種主題**：在 `:root[data-skin="<id>"]` 定義淺色 token，在 `@media (prefers-color-scheme: dark) { :root[data-skin="<id>"]:not([data-theme="light"]) {…} }` 與 `:root[data-skin="<id>"][data-theme="dark"] {…}` 重新定義深色 token（同一組值）。刻意只做一種外觀（例如遊戲風）也可以，但要在淺色 token 加 `color-scheme: light|dark`，而且兩個深色區塊也要寫出同一組值，才能蓋過 style.css 的深色 token。
6. **手機可用**：390px 寬時不能水平捲動；手機底部有 `#bottomnav`（可用 `nav` 自訂項目）與右下角切換列，主要內容要留空間。
7. **字型**：只能用已載入的 Google Fonts——Noto Sans TC（400/500/700/900）、Noto Serif TC 700、Inter、Roboto、IBM Plex Mono、Lilita One、Montserrat（600/800）、Nunito（600/800/900），或系統字型。不要用 `@import`（打包後會失效）。
8. **不用 `alert/confirm/prompt`、不開新視窗、不用 Service Worker**（Artifact 沙盒不支援）。確認步驟做在頁面裡。
9. 鍵盤可操作、焦點可見、尊重 `prefers-reduced-motion`。

## 註冊

```js
(function () {
  'use strict';
  const QG = window.QG, SK = window.QGSkins;
  if (!QG || !SK || !SK.modal) return;   // 沒開實驗模式時不做事
  const { h, fill } = QG;

  SK.register({
    id: 'duolingo',                      // 也是 data-skin 的值
    label: 'Duolingo 風',                // 切換列顯示的名稱
    group: '學習測驗',                   // 切換列分組
    top: (view) => Node,                 // 頂部列內容（放進 #topbar）；不給就是空的
    side: (view) => Node,                // 左側欄（#sidebar）；不給就不顯示
    nav: [{ v: 'home', label: '學習', icon: 'home', badge: false, big: false }, …], // 手機底部導覽；不給用預設
    bottomNav: true,                     // false 時不顯示底部導覽
    views: {                             // 覆寫畫面；參數 base 是原版畫面函式表
      home: (base) => Element,
      browse: (base) => Element,
      stats: (base) => { const el = base.stats(); el.prepend(…); return el; },
    },
    after: (view, changed) => {},        // 每次畫面畫完後呼叫（可改 DOM、加觀察器）
  });
})();
```

畫面名稱：`home` `practice` `review` `exam` `result` `browse` `stats`（對應網址 `#home` 等）。`practice`、`review`、`exam` 的作答流程在 app.js 內部，建議不要整個覆寫，改用 CSS 換外觀，或在 `after` 裡加東西（參考 `skins.js` 的 `feedUpNext`）。

## window.QG（app.js）

| 名稱 | 說明 |
|---|---|
| `h(tag, attrs, ...kids)` | 建 DOM。`attrs` 支援 `class`、`text`、`onclick` 等事件、`dataset`、布林屬性；kids 可為字串、節點、陣列、null |
| `fill(el, ...kids)` / `put(el, ...kids)` | 取代／附加子節點（會略過 null） |
| `S()` | 學習紀錄：`q[id] = {c 答對, w 答錯, t 最後作答, b 錯題盒 1–5, d 下次複習, m 熟練, s 收藏}`、`days['YYYY-MM-DD'] = {n, c}`、`exams[] = {ts, subject, total, correct, score, dur}`、`settings`（可在 `settings.skinData[<id>]` 放自己的小狀態）、`practice`、`lastResult` |
| `Store.save()` | 修改 `S()` 後呼叫，會存到 localStorage／帳號 |
| `render()` | 重畫目前畫面 |
| `QS` / `QMAP` / `EXAM_MAP` / `TAGS` / `YEARS` / `BANK` | 題目陣列、id→題目、考卷、`[主題, 題數]`（題數多到少）、年度、整份題庫 |
| 題目物件 | `{id, q 題目, o {A..D}, a ['B'], all 一律給分, s 'industry'/'process', t 主題[], src [{exam, n, label}], fig 圖片路徑, prev 承上題, mock, x 解析, year, official, text 小寫全文}` |
| `record(id, ok)` | 記錄一次作答（答錯會進錯題本），之後要 `Store.save()`、`updateBadges()` |
| `startCustomPractice(ids, label)` | 用指定題目開一輪練習並跳到 `#practice` |
| `startReview(ids?)` | 開始錯題複習（預設：所有到期題） |
| `ensurePractice()` | 取得目前練習回合 `{label, queue, idx, n, c}` |
| `filterQuestions(filters)` / `filterLabel(filters)` | 依首頁的練習範圍篩題（`S().settings.filters`） |
| `buildQueue(ids, 'random'|'weak')` | 洗牌，或依弱點排序 |
| `dueReviewIds()` / `totals()` / `streak()` | 到期錯題 id、`{c, n, seen}`、連續天數 |
| `toggleStar(id)` / `srcLabel(src)` / `pct(c, n)` / `fmtNum(n)` / `shuffle(a)` / `dayKey(date)` / `toast(msg)` / `updateBadges()` | 小工具 |
| `browse` | 題庫畫面的篩選狀態 `{kw, subject, tag, exam, only, show, limit}` |
| `rangePanel()` / `kpi(v, label)` / `barRow(label, c, n)` / `questionCard({q, perm, chosen, reveal, onPick})` | 原版元件 |
| `SUBJ` / `SUBJ_SHORT` / `SUBJ_CODE` / `LETTERS` / `EXAM_LEN` / `EXAM_MIN` | 常數 |

## window.QGSkins（skins.js、skins-more.js）

| 名稱 | 說明 |
|---|---|
| `register(def)` | 註冊風格 |
| `icon(name, cls)` | 線條圖示 `<span class="ico">`。可用：home practice review exam browse stats star menu search close apps tag doc arrow info bulb pad heart comment send bookmark plus repost grid user compass stack swords hammer factory scroll coin flame；可往 `SK.ICONS` 加自己的（24×24 SVG 路徑字串） |
| `brand(text)` | QuizGrinder 標誌連結 |
| `hue(str)` | 字串 → 穩定色相（0–359），配 `hsl(var(--h) …)` 做縮圖色 |
| `go(view)` | 切換畫面 |
| `NAV` / `isCurrent(view, v)` | 預設導覽項目、是否為目前畫面 |
| `progressOf(ids)` | `{seen, c, n}` |
| `highlight(text, kw)` | 回傳把關鍵字包 `<b>` 的節點陣列 |
| `modal(content, cls, onClose)` | 全螢幕對話框，回傳 `{close}`；Esc 關閉 |
| `answerOptions(q, {cls, onDone(ok, letter)})` | 可直接作答的四個選項（會寫入紀錄），回傳元素，`el.pick(i)` 可用鍵盤作答 |
| `starBtn(q, cls, icon)` / `copyQuestion(q)` / `addToReview(q)` / `relTime(ts)` | 收藏鈕、複製題目、加入錯題本、「3 天前」 |
| `feedPool(key, order)` | 依練習範圍產生穩定的題目順序（`order`：'random'、'weak'、'latest'） |
| `infiniteList(ids, renderItem, cls)` | 無限捲動清單 |
| `tileGrid(qs, cls)` | 方形格狀牆（點開為貼文對話框） |
| `skin()` / `base` | 目前風格 id、原版畫面函式表 |

## AI（只在 claude.ai Artifact 內可用）

Artifact 實驗版會宣告 `sample` 能力，讓頁面請 Claude 即時回答（例如產生解析、對話式家教）。用法：

```js
const sample = window.claude && window.claude.use ? await window.claude.use('sample') : null; // null：隱藏 AI 功能
btn.onclick = async () => {
  out.textContent = '思考中…';
  try {
    const { text } = await sample(prompt, { onText: ({ text }) => { out.textContent = text; } });
  } catch (e) { out.textContent = e.text || ''; note.textContent = e.code === 'not_granted' ? '未允許使用 Claude' : '暫時無法回答'; }
};
// 多輪對話：sample([{ role: 'user', content: 規則 }, ...turns], { cache: false, onText })，turns 以 user 結尾
```

規則：只在使用者按下按鈕時呼叫（不可在載入時、迴圈或計時器中呼叫）；第一次呼叫會詢問使用者同意；每次呼叫都是獨立的，題目、選項、正解等需要的內容都要放進 prompt；網站版（非 Artifact）`window.claude` 不存在，必須有不靠 AI 的備案（例如顯示答案與題庫內的解析）。

## 測試

```bash
python3 -m http.server 8000 &
SKIN_ONLY=duolingo node tests/skins.cjs http://localhost:8000/ /tmp/shots   # 只測一個風格並截圖
node tests/skins.cjs http://localhost:8000/                                  # 全部風格
```

測試會切到每個風格，依序開 `#home #practice #review #exam #browse #stats`，桌機 1440px（淺色）與手機 390px（深色）各一次，確認沒有 JS 錯誤、沒有水平溢出。截圖請親自看過再交付。
