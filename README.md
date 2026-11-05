# QuizGrinder — IPAS 初級電路板製程工程師刷題

把歷屆 IPAS「初級電路板製程工程師」能力鑑定試題整理成可以反覆練習的網頁：
**L11 電路板產業概論**與 **L12 電路板製造概論**兩科，共 **1,150 題**（官方試題 1,104 題＋明志科大模擬題），
每一題的答案都已對照官方答案與疑義釋覆逐題核對過。

- 純靜態網站（HTML + CSS + 原生 JS），不需要後端，可部署在 GitHub Pages，也能打包成 claude.ai Artifact
- 可離線使用（PWA），手機可「加入主畫面」

## 功能

| 功能 | 說明 |
|---|---|
| 練習 | 依科目、年度、主題、關鍵字、高頻題（考過 2 次以上）篩選；同一輪內每題只出現一次；可選「隨機」或「弱點優先」；可打亂選項順序（遇到「以上皆是」這類互相參照的選項會自動保持原順序） |
| 錯題本 | Leitner 五盒間隔複習：答錯進第 1 盒，複習答對升一盒（間隔當天、1、3、7、14 天），第 5 盒再答對即「熟練」；任何時候答錯都回第 1 盒 |
| 模擬考 | 單科隨機 50 題、75 分鐘計時（時間到自動交卷）、可標記與跳題；交卷後顯示分數、各主題表現、逐題對答，錯題自動進錯題本 |
| 題庫 | 全文搜尋、依主題／收藏／答錯過／有附圖篩選，可直接把搜尋結果拿來練習 |
| 統計 | 總正確率、各科與各主題正確率、近 14 天作答量、模擬考紀錄；進度可匯出／匯入 |
| 附圖 | 需要看圖的 31 題，圖片直接從原始 PDF 裁切（自動去掉左側答案欄與疑義釋覆說明，避免洩漏答案） |
| 承上題 | 「承上題」可展開查看上一題，打亂順序練習時也不會失去上下文 |
| 鍵盤／手勢 | `1`–`4` 或 `A`–`D` 作答、`Enter` 下一題、`S` 收藏；模擬考 `←` `→` 換題、`F` 標記；手機在題卡上左滑換下一題 |

### 版面風格實驗

在網址後面加上 `?skins`（例如 `http://localhost:8000/?skins`）會出現版面切換列，可以在四種版面之間切換：

| 版面 | 借用的版面與互動模式 |
|---|---|
| 原版 | 電路板配色、單欄題卡 |
| 影音牆 | 可收合的左側選單、分類膠囊列、卡片牆（縮圖、題數標籤、練習進度條）、錯題橫向捲動列；作答頁右側有「接下來」清單，點一下就能先做那題 |
| 極簡搜尋 | 置中的大搜尋框、即時建議、功能選單；搜尋結果頁包含分類分頁、精選摘要、相關題目展開、分頁 |
| 文件站 | 頂部分頁列、左側分組目錄（依科目、主題、考卷）、右側「本頁內容」與捲動追蹤、⌘K／Ctrl K 指令面板、上一頁／下一頁 |

風格只借用版面與互動慣例，標誌一律使用 QuizGrinder 自己的圖示。程式在 `skins.js`、`skins.css`，題庫與學習邏輯完全共用。刪掉這兩個檔案就回到原版。

學習進度存在瀏覽器的 localStorage。以 claude.ai Artifact 開啟時，會改存在使用者帳號的私人資料區，換裝置也會同步。

## 快速開始

```bash
python3 -m http.server 8000
```

然後開啟 <http://localhost:8000/>。不能直接用 `file://` 打開 `index.html`，因為瀏覽器不允許讀取 `data/bank.json`。

## 專案結構

```
index.html  style.css  app.js        前端（單頁應用，#home #practice #review #exam #result #browse #stats）
skins.js  skins.css                  版面風格實驗（網址加 ?skins 啟用）
sw.js  manifest.webmanifest  icon.svg  PWA 離線支援
pdfs/                                原始考卷 PDF
data/
  exams.json                         考卷登錄表（id、年度、梯次、科目、是否收錄）
  raw/                               Gemini 從 PDF 抽取的原始 JSON（不要手改）
  overrides/                         人工修正檔，每份考卷一個（格式見 overrides/FORMAT.md）
  bank.json                          建置產物：前端讀取的題庫
  figures/                           建置產物：從 PDF 裁切的題目附圖（WebP）
  explanations.json                  （選用）AI 產生的題目解析
tools/
  pdf_to_json.py                     PDF → data/raw（Gemini）
  build_bank.py                      raw + overrides → bank.json、figures、docs/QA_REPORT.md
  validate.py                        檢查題庫
  build_artifact.py                  打包成 claude.ai Artifact → dist/artifact/
  generate_explanations.py           （選用）用 Gemini 產生解析
  tags.py                            主題標籤的關鍵字規則
tests/e2e.cjs  tests/skins.cjs      Playwright 端對端測試（原版、四種版面）
docs/
  DATA.md                            資料格式與建置流程
  AUDIT.md                           這次 PDF→JSON 品質稽核的結果
  QA_REPORT.md                       建置時自動產生的品質報告
  ROADMAP.md                         後續構想
  audit/                             逐題稽核紀錄（每題的錯誤與修正依據）
```

## 資料流程

```
pdfs/*.pdf ──tools/pdf_to_json.py (Gemini)──► data/raw/*.json
                                                  │
data/overrides/*.json（人工修正）─────────────────┤
data/exams.json（考卷登錄）────────────────────────┤
                                                  ▼
                                  tools/build_bank.py
                                    1. 自動修正：四個選項黏在 A、殘留 (A) 標籤、PDF 斷行
                                    2. 套用修正檔（patch／整份取代）
                                    3. 用 PDF 文字層的答案欄交叉核對答案
                                    4. 從 PDF 裁切附圖
                                    5. 合併跨考卷重複題（記錄出處＝出題頻率）
                                    6. 加主題標籤、合併解析
                                                  ▼
                              data/bank.json + data/figures/ + docs/QA_REPORT.md
                                                  │
                              tools/validate.py ──┘（CI 檢查）
```

建置只需要 Python 3.10+、Pillow 和 poppler-utils（`pdftotext`、`pdftoppm`）：

```bash
python3 tools/build_bank.py      # 重建題庫與附圖
python3 tools/validate.py        # 檢查（有錯誤時結束碼為 1）
```

## 修正一題

1. 在 `data/overrides/<exam_id>.json` 的 `patches` 加一筆，例如：
   ```json
   {"number": 12, "answer": "D", "reason": "官方答案 D"}
   ```
   題目、選項、多重給分（`["B","C"]`）、一律給分（`"ALL"`）、附圖頁碼（`{"page": 4}`）的寫法見 [`data/overrides/FORMAT.md`](data/overrides/FORMAT.md)。
2. 執行 `python3 tools/build_bank.py && python3 tools/validate.py`。
3. 看一下 `docs/QA_REPORT.md` 的「待處理事項」，再提交 `data/overrides/`、`data/bank.json`、`data/figures/`。

題目 id 是由題目和選項文字算出的雜湊，所以修改題目文字後，那一題的個人作答紀錄會重新計算。

## 新增一份考卷

1. 把 PDF 放進 `pdfs/`。
2. `pip install -r requirements.txt`，設定 `GEMINI_API_KEY`，執行 `python3 tools/pdf_to_json.py pdfs/新考卷.pdf`。
3. 在 `data/exams.json` 登錄：`id`（`<民國年>-<梯次 1|2|S>-<L11|L12>`）、`year`、`session`、`subject`、`title`、`pdf`。
4. `python3 tools/build_bank.py`，看 `docs/QA_REPORT.md` 的答案交叉核對結果，逐題修正後寫進 overrides。

## 部署

**GitHub Pages**：`.github/workflows/pages.yml` 在每次 push 到 `main` 時會依序：
1. 確認 `bank.json` 與修正檔同步
2. 跑 `validate.py` 和端對端測試
3. 發佈網站

第一次使用前，請在 repo 的 Settings → Pages → Source 選「GitHub Actions」。

**claude.ai Artifact**：
1. 執行 `python3 tools/build_artifact.py`；版面實驗版請加上 `--experiment`，輸出到 `dist/artifact-skins/`。
2. 把 `dist/artifact/index.html` 連同 `data/bank.json`、`data/figures/*` 當作 files 一起發佈。

## 測試

```bash
python3 -m http.server 8000 &
npm install --no-save playwright && npx playwright install chromium
node tests/e2e.cjs http://localhost:8000/
node tests/skins.cjs http://localhost:8000/
```

測試內容：
- 首頁篩選
- 練習作答，並確認重新整理後進度還在
- 模擬考交卷
- 錯題本複習
- 題庫搜尋
- 統計頁
- 手機寬度與暗色模式下沒有水平捲動、沒有 JS 錯誤

## 資料來源與聲明

試題來自 IPAS 經濟部產業人才能力鑑定公告的歷屆試題與樣題，以及明志科技大學的模擬試題（標示為「非官方模擬題」）。本專案僅供個人準備考試使用；合格標準與考試規定請以當年度簡章為準。
