# 修正檔格式（data/overrides/<exam_id>.json）

每份考卷一個檔，`tools/build_bank.py` 會把它套在 Gemini 原始輸出（`json/*.json`）上。

```json
{
  "exam_id": "108-2-L12",
  "source_pdf": "108年第二次…(當次試題公告108.12.02).pdf",
  "mode": "patch",
  "patches": [
    {"number": 10, "answer": "B", "reason": "官方答案 B，Gemini 誤為 C"},
    {"number": 49, "question": "完整題目…", "options": {"A": "1,3", "B": "1,3,4", "C": "2,3", "D": "1,2"}, "answer": "D", "reason": "陳述句被放進選項 A"},
    {"number": 7,  "answer": ["B", "C"], "reason": "疑義釋覆：B、C 均給分"},
    {"number": 17, "answer": "ALL", "reason": "疑義釋覆：一律給分"},
    {"number": 21, "figure": {"page": 4}, "reason": "需看圖"},
    {"number": 30, "drop": true, "reason": "重複／拆錯的題目"}
  ],
  "problems": []
}
```

規則
- `number`：PDF 上的題號（mode=replace 時為 1..N 連號，可加 `"pdf_label": "第二科 5"`）。
- `question`／`options`：給**完整修正後的值**，不是 diff。選項文字不含 `(A)` 前綴；題目不含選項；題目引用的 1.2.3. 陳述句要放在 `question` 內。
- `answer`：`"A"`～`"D"`、多選給分 `["B","C"]`、一律給分 `"ALL"`。
- `figure`：題目需要看圖時給 `{"page": <PDF 第幾頁，從 1 起算>}`，建置時會從 PDF 裁切題目圖片。
- `subject`：只有混合科目考卷（如 106 公告樣題、明志模擬題）才需逐題給 `"industry"`／`"process"`。
- `mode: "replace"`：原始 JSON 結構錯太多時改用 `problems` 提供整份完整題目（每題含 number, question, options, answer，可選 subject/figure/pdf_label）。
- 以下兩種常見問題由建置腳本**自動修正**，不需寫 patch：
  1. 四個選項全塞在 `options.A`（`…;(B)…;(C)…;(D)…`）→ 自動拆開
  2. 選項文字開頭重複 `(A)`／`A.` 標籤 → 自動移除
