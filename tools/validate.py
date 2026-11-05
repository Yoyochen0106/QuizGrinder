#!/usr/bin/env python3
"""檢查 data/bank.json 的完整性與常見抽取錯誤。

用法：python3 tools/validate.py [--strict]
  錯誤（error）：結構錯誤、答案無效、圖片檔不存在…等，結束碼 1（CI 會失敗）
  警告（warning）：疑似抽取錯誤的文字（Missing Option、選項黏在一起、題目過短…），
                   加 --strict 時警告也視為失敗
"""

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LETTERS = ("A", "B", "C", "D")

SUSPICIOUS = [
    (re.compile(r"Missing Option", re.I), "含 'Missing Option' 佔位文字"),
    (re.compile(r"[\(（]\s*[B-D]\s*[\)）].*[\(（]\s*[C-D]\s*[\)）]"), "單一選項內出現多個 (B)(C)(D) 標籤，可能選項黏在一起"),
    (re.compile(r"^\s*[\(（]?[A-D][\)）\.．]"), "選項開頭殘留 (A) 標籤"),
    (re.compile(r"�"), "含亂碼字元 U+FFFD"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true", help="警告也視為失敗")
    args = ap.parse_args()

    bank = json.loads((ROOT / "data" / "bank.json").read_text("utf-8"))
    exams = {e["id"] for e in bank["exams"]}
    errors, warnings = [], []
    seen = set()
    for q in bank["questions"]:
        qid = q.get("id", "?")
        where = f"{qid}（{'、'.join(s['exam'] + '#' + str(s['n']) for s in q.get('src', []))}）"
        if qid in seen:
            errors.append(f"{where} id 重複")
        seen.add(qid)
        if not q.get("q", "").strip():
            errors.append(f"{where} 題目是空的")
        opts = q.get("o", {})
        for L in LETTERS:
            if not str(opts.get(L, "")).strip():
                errors.append(f"{where} 選項 {L} 是空的")
        if len({str(v).strip() for v in opts.values()}) < 4:
            warnings.append(f"{where} 有重複的選項文字")
        ans = q.get("a", [])
        if not ans or any(a not in LETTERS for a in ans):
            errors.append(f"{where} 答案無效：{ans}")
        if q.get("s") not in ("industry", "process"):
            errors.append(f"{where} 科目無效：{q.get('s')}")
        for s in q.get("src", []):
            if s["exam"] not in exams:
                errors.append(f"{where} 出處考卷不存在：{s['exam']}")
        if q.get("fig") and not (ROOT / q["fig"]).exists():
            errors.append(f"{where} 圖片不存在：{q['fig']}")
        if q.get("prev") and q["prev"] not in {x["id"] for x in bank["questions"]}:
            errors.append(f"{where} 承上題連結的題目不存在")
        if len(q.get("q", "")) < 6:
            warnings.append(f"{where} 題目過短：{q.get('q')!r}")
        if re.search(r"(如|下)圖|附圖|圖中|照片", q.get("q", "")) and not q.get("fig") and not q.get("prev"):
            warnings.append(f"{where} 題目提到圖但沒有附圖")
        for L in LETTERS:
            for rx, msg in SUSPICIOUS:
                if rx.search(str(opts.get(L, ""))):
                    warnings.append(f"{where} 選項 {L}：{msg}")
        for rx, msg in SUSPICIOUS[:1]:
            if rx.search(q.get("q", "")):
                warnings.append(f"{where} 題目：{msg}")
        if q.get("conflict"):
            warnings.append(f"{where} 跨考卷答案衝突：{q['conflict']}")

    for w in warnings:
        print("warning:", w)
    for e in errors:
        print("error:", e)
    print(f"\n{len(bank['questions'])} 題，{len(errors)} 個錯誤，{len(warnings)} 個警告")
    if errors or (args.strict and warnings):
        sys.exit(1)


if __name__ == "__main__":
    main()
