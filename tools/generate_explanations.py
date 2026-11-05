#!/usr/bin/env python3
"""用 Gemini 為題目產生「解析」→ data/explanations.json（題目 id → 解析文字）

產生一次、存進 repo，前端作答後顯示；build_bank.py 會自動合併。
已有解析的題目會略過，所以可以分批、中斷後續跑。

需要：pip install -r requirements.txt，並設定環境變數 GEMINI_API_KEY（或 GOOGLE_API_KEY）。
用法：python3 tools/generate_explanations.py [--limit 50] [--model gemini-2.5-flash] [--subject process]

注意：解析由模型產生，可能有錯；前端會標示「AI 產生的解析，僅供參考」。
"""

import argparse
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "explanations.json"

PROMPT = """你是台灣 IPAS 初級電路板製程工程師能力鑑定的講師。以下是一題四選一考題與官方答案。
請用繁體中文寫 2–4 句解析：說明為什麼正解正確，必要時點出其他選項錯在哪裡。
不要重述題目、不要加標題或條列符號，不確定的內容不要編造。

題目：{q}
(A) {A}
(B) {B}
(C) {C}
(D) {D}
官方答案：{ans}
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=50, help="這次最多產生幾題")
    ap.add_argument("--model", default="gemini-2.5-flash")
    ap.add_argument("--subject", choices=["industry", "process"])
    ap.add_argument("--sleep", type=float, default=1.0, help="每次呼叫間隔秒數")
    args = ap.parse_args()

    try:
        from google import genai
    except ImportError:
        sys.exit("請先 pip install -r requirements.txt")
    client = genai.Client()

    bank = json.loads((ROOT / "data" / "bank.json").read_text("utf-8"))
    done = json.loads(OUT.read_text("utf-8")) if OUT.exists() else {}
    todo = [q for q in bank["questions"] if q["id"] not in done and (not args.subject or q["s"] == args.subject)]
    print(f"已有 {len(done)} 題解析，待產生 {len(todo)} 題，本次處理 {min(args.limit, len(todo))} 題")

    for i, q in enumerate(todo[: args.limit], 1):
        ans = "所有選項均給分" if q.get("all") else "、".join(q["a"])
        prompt = PROMPT.format(q=q["q"], ans=ans, **q["o"])
        try:
            res = client.models.generate_content(model=args.model, contents=prompt)
            text = (res.text or "").strip()
        except Exception as e:  # noqa: BLE001
            print(f"  {q['id']} 失敗：{e}")
            time.sleep(args.sleep * 5)
            continue
        if text:
            done[q["id"]] = "【AI 解析，僅供參考】" + text
            OUT.write_text(json.dumps(done, ensure_ascii=False, indent=1), "utf-8")
            print(f"  [{i}] {q['id']} ✓")
        time.sleep(args.sleep)
    print("完成。執行 python3 tools/build_bank.py 讓解析進入題庫。")


if __name__ == "__main__":
    main()
