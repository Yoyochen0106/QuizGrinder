# 資料格式

## `data/exams.json`：考卷登錄表

```json
{"id": "108-2-L12", "year": 108, "session": "2", "subject": "process", "official": true,
 "title": "108 年第二次 電路板製造概論", "pdf": "108年第二次…pdf"}
```

| 欄位 | 說明 |
|---|---|
| `id` | `<民國年>-<梯次>-<科目>`。梯次 `1`／`2`，公告樣題用 `S`；科目 `L11` 產業概論、`L12` 製造概論；兩科合卷省略科目（如 `106-1`） |
| `subject` | `industry`、`process`，或 `mixed`（逐題由修正檔或 `default_subject_ranges` 指定） |
| `official` | 是否為 IPAS 官方試題。模擬考只從官方題抽題 |
| `raw` | （選用）原始 JSON 檔名，預設為 `<pdf 檔名>_structured_output.json` |
| `include` | 設成 `false` 就不收錄，並用 `duplicate_of` 註明它與哪份考卷重複 |

## `data/raw/*.json`：Gemini 原始輸出

由 `tools/pdf_to_json.py` 產生，格式為 `{"problems": [{year, exam_number, source, number, subject, question, options{A..D}, answer}]}`。
**不要手動修改**：修正一律寫在 `data/overrides/`，日後重新抽取時才不會覆蓋掉人工修正。

## `data/overrides/<exam_id>.json`：人工修正

見 [`data/overrides/FORMAT.md`](../data/overrides/FORMAT.md)。每筆 patch 都有 `reason`，說明修正依據（官方答案、疑義釋覆、PDF 原文）。

## `data/bank.json`：前端題庫（建置產物）

欄位名稱刻意縮短以減少下載量。

```json
{
  "version": 2,
  "build": "3fa9c1d2",
  "subjects": {"industry": "電路板產業概論 (L11)", "process": "電路板製造概論 (L12)"},
  "exams": [{"id", "year", "session", "subject", "title", "official", "pdf"}],
  "questions": [{
    "id": "q019e8cbd05",
    "q": "題目",
    "o": {"A": "…", "B": "…", "C": "…", "D": "…"},
    "a": ["B"],
    "all": true,
    "s": "process",
    "t": ["高頻高速"],
    "src": [{"exam": "110-2-L12", "n": 37, "label": "第二科 7"}],
    "fig": "data/figures/110-2-L12-13.webp",
    "prev": "q…",
    "mock": true,
    "x": "解析",
    "conflict": ["…"]
  }]
}
```

| 欄位 | 說明 |
|---|---|
| `id` | 題目與選項正規化後的 SHA-1 前 10 碼；跨考卷相同的題目會合併成同一個 id |
| `a` | 給分的選項。多於一個代表官方疑義釋覆判定多個答案均給分 |
| `all` | 官方判定一律給分 |
| `t` | 主題標籤，依 `tools/tags.py` 的關鍵字規則自動產生 |
| `src` | 所有出處；長度大於 1 即「高頻重複題」 |
| `fig` | 從 PDF 裁切的題目附圖 |
| `prev` | 「承上題」所接的上一題 id |
| `mock` | 只出現在非官方模擬題 |
| `x` | 解析（來自 `data/explanations.json`） |
| `conflict` | 合併重複題時發現不同考卷的答案不一致（目前為 0 題） |

`build` 是整份題庫內容的雜湊，內容不變時重建結果也完全相同。CI 靠這一點檢查 `bank.json` 是否與修正檔同步。

## 前端進度資料（localStorage `quizgrinder:v1`／Artifact 私人 db 文件）

```json
{
  "v": 1, "updated": 1730790000000,
  "q": {"q019e8cbd05": {"c": 2, "w": 1, "t": 1730790000000, "b": 2, "d": 1730876400000, "m": 1, "s": 1}},
  "days": {"2026-11-05": {"n": 40, "c": 31}},
  "exams": [{"ts": 0, "subject": "process", "total": 50, "correct": 38, "score": 76, "dur": 2400}],
  "settings": {"shuffleOpts": true, "order": "random", "filters": {}, "examSubject": "process", "examNoFig": false, "examTimed": true},
  "practice": {"key": "…", "label": "…", "queue": ["q…"], "idx": 12, "n": 12, "c": 9},
  "examRun": null,
  "lastResult": null
}
```

`q[id]` 的欄位：

| 欄位 | 說明 |
|---|---|
| `c`／`w` | 答對／答錯次數 |
| `t` | 最後作答時間 |
| `b` | 錯題盒 1–5，0 或不存在代表不在錯題本 |
| `d` | 下次複習時間 |
| `m` | 已熟練 |
| `s` | 收藏 |

在 Artifact 中，進度存在 `data/users/<viewer id>/progress`。這個文件只有本人看得到，連 Artifact 擁有者也無法讀取。前端以 `updated` 時間較新的一份為準。
