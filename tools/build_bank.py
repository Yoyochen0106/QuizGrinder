#!/usr/bin/env python3
"""建置題庫：data/raw（Gemini 原始輸出）+ data/overrides（人工修正）→ data/bank.json

流程
 1. 依 data/exams.json 逐份讀取原始 JSON（include=false 的考卷略過）
 2. 自動修正常見抽取錯誤（四個選項塞在 A、選項重複 (A) 標籤、多餘換行）
 3. 套用 data/overrides/<exam_id>.json（patch 或整份 replace，格式見 FORMAT.md）
 4. 以 PDF 文字層解析出的答案欄交叉核對答案（只回報，不自動覆寫）
 5. 需看圖的題目從 PDF 裁切題目區域成圖片 → data/figures/
 6. 跨考卷合併完全相同的題目（記錄所有出處 = 出題頻率）
 7. 依關鍵字加主題標籤，合併 data/explanations.json（若有）
 8. 輸出 data/bank.json 與 docs/QA_REPORT.md

用法：python3 tools/build_bank.py [--no-figures]
需要：poppler-utils（pdftotext / pdftoppm）、Pillow（裁切圖片時）
"""

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tags import tag_question  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW_DIR = DATA / "raw"
OVR_DIR = DATA / "overrides"
FIG_DIR = DATA / "figures"
PDF_DIR = ROOT / "pdfs"
LETTERS = ("A", "B", "C", "D")
SUBJECT_NAMES = {"industry": "電路板產業概論 (L11)", "process": "電路板製造概論 (L12)"}

# ---------------------------------------------------------------- text utils

_CJK = r"　-〿㐀-鿿＀-￯"


def clean_text(s: str) -> str:
    """去除 PDF 斷行造成的多餘換行與空白；中文字之間的換行直接接起來。"""
    s = (s or "").replace("\r", "")
    s = re.sub(rf"(?<=[{_CJK}])\s*\n\s*(?=[{_CJK}])", "", s)
    s = re.sub(r"\s*\n\s*", " ", s)
    s = re.sub(r"[ \t ]+", " ", s)
    return s.strip()


def norm_key(s: str) -> str:
    """比對用正規化：全形轉半形、去空白與標點、小寫。"""
    s = unicodedata.normalize("NFKC", s or "").lower()
    return re.sub(r"[\s\W_]+", "", s)


_LABEL_RX = re.compile(r"^\s*[\(（]?\s*[A-Da-d]\s*[\)）\.．、:：]\s*")
_SPLIT_RX = re.compile(r"[;；,，]?\s*[\(（]\s*([B-D])\s*[\)）]\s*")


def autofix_options(opts: dict, fixes: list) -> dict:
    opts = {k: clean_text(opts.get(k, "")) for k in LETTERS}
    # 1) 四個選項全部塞在 A：「xxx; (B)yyy ; (C)zzz ; (D)www」
    a = opts["A"]
    if all(re.search(rf"[\(（]\s*{L}\s*[\)）]", a) for L in "BCD"):
        parts = _SPLIT_RX.split(a)
        # parts = [A, 'B', b, 'C', c, 'D', d]
        if len(parts) == 7 and parts[1:7:2] == ["B", "C", "D"]:
            new = {"A": parts[0], "B": parts[2], "C": parts[4], "D": parts[6]}
            new = {k: v.strip(" ;；,，。") if k != "D" else v.strip(" ;；,，") for k, v in new.items()}
            opts = new
            fixes.append("split-merged-options")
    # 2) 選項開頭重複的 (A) / A. 標籤
    for k in LETTERS:
        stripped = _LABEL_RX.sub("", opts[k], count=1)
        if stripped != opts[k] and stripped:
            opts[k] = stripped
            if "strip-option-label" not in fixes:
                fixes.append("strip-option-label")
    return opts


def norm_answer(ans):
    """回傳 (letters:list, all_credit:bool)。"""
    if ans is None:
        return [], False
    if isinstance(ans, str):
        a = ans.strip().upper()
        if a in ("ALL", "*"):
            return list(LETTERS), True
        letters = re.findall(r"[A-D]", a)
    else:
        letters = [str(x).strip().upper() for x in ans]
    letters = sorted(set(l for l in letters if l in LETTERS))
    return letters, len(letters) == 4


# ---------------------------------------------------------------- PDF helpers

_KEY_RX = re.compile(r"^\s*(?:L1\d-?\s+L1\d+\s+)?[\(（]?([A-D])[\)）]?\s+(\d{1,2})\s*[\.．、]")


def pdf_text(pdf: Path, first=None, last=None, bbox=False) -> str:
    cmd = ["pdftotext"]
    if first:
        cmd += ["-f", str(first), "-l", str(last or first)]
    cmd += ["-bbox-layout"] if bbox else ["-layout"]
    cmd += [str(pdf), "-"]
    try:
        return subprocess.run(cmd, capture_output=True, text=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        return ""


def parse_answer_key(pdf: Path) -> dict:
    """解析「作答區 答案 + 題號」同列的版型。回傳 {題號: 字母}；版型不符時回傳空 dict。"""
    keys = {}
    for line in pdf_text(pdf).splitlines():
        m = _KEY_RX.match(line)
        if m:
            n = int(m.group(2))
            if 1 <= n <= 60 and n not in keys:
                keys[n] = m.group(1)
    return keys


def _page_lines(pdf: Path, page: int):
    html = pdf_text(pdf, page, page, bbox=True)
    pm = re.search(r'<page width="([\d.]+)" height="([\d.]+)"', html or "")
    if not pm:
        return None, None, []
    lines = []
    for lm in re.finditer(r'<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</line>', html, re.S):
        words = re.findall(r'<word xMin="([\d.]+)"[^>]*>(.*?)</word>', lm.group(5))
        text = "".join(w for _, w in words)
        lines.append({"x0": float(lm.group(1)), "y0": float(lm.group(2)), "y1": float(lm.group(4)),
                      "words": words, "text": text})
    lines.sort(key=lambda t: (t["y0"], t["x0"]))
    return float(pm.group(1)), float(pm.group(2)), lines


def _find_number(lines, n):
    """找出以「n.」開頭（前面可有作答欄字母）的行，回傳 (x, y0)。"""
    for ln in lines:
        for wx, w in ln["words"][:3]:
            if re.match(rf"^[\(（]?{n}(?:[\.．、]|$)", w) and not re.match(rf"^{n}[\.．]\d", w):
                return float(wx), ln["y0"]
    return None


def _horizontal_rules(img, x0, x1):
    """回傳影像中橫向表格線的 y 座標（像素）。"""
    w = x1 - x0
    if w <= 0:
        return []
    px = img.load()
    rules, prev = [], -10
    step = 2
    for y in range(img.height):
        dark = sum(1 for x in range(x0, x1, step) if px[x, y] < 140)
        if dark * step > 0.6 * w:
            if y - prev > 3:
                rules.append(y)
            prev = y
    return rules


_HEADER_RX = re.compile(r"第\s*\d+\s*頁|頁，共|答案\s*題目|^題目$|^題$|^目$|^答案$|作答區|試題公告|考試日期|公告日期|釋覆結果日期|^第.科")
_STOP_RX = re.compile(r"釋覆|委員|給分")


def _crop_region(pdf: Path, page: int, number: int, continuation: bool):
    """回傳單頁中第 number 題的裁切影像（PIL Image）或 None。

    continuation=True：題號在前一頁，本頁頂端是延續的圖 → 從頁首下緣裁到下一題題號。
    有表格框線的版型以題號所在儲存格的上下框線為界（圖片常在題號上方）；
    無框線版型從上一行文字下緣到下一題題號為止。疑義釋覆說明會洩漏答案，一律截掉。
    """
    from PIL import Image

    pw, ph, lines = _page_lines(pdf, page)
    if not lines:
        return None
    start = None if continuation else _find_number(lines, number)
    nxt = _find_number(lines, number + 1)
    if start is None:
        if not continuation and not nxt:
            return None
        continuation = True
        x_left = nxt[0] if nxt else min(ln["x0"] for ln in lines)
        y_num = 0.0
    else:
        x_left, y_num = start
    if nxt and nxt[1] <= y_num:
        nxt = None
    dpi = 150
    s = dpi / 72.0
    tmp = Path(str(FIG_DIR / f"_page_{page}"))
    try:
        subprocess.run(["pdftoppm", "-f", str(page), "-l", str(page), "-r", str(dpi), "-gray", "-png", "-singlefile",
                        str(pdf), str(tmp)], check=True, capture_output=True)
    except (OSError, subprocess.CalledProcessError):
        return None
    png = Path(str(tmp) + ".png")
    img = Image.open(png).convert("L")
    img.load()
    png.unlink(missing_ok=True)

    first_content = min((ln["y0"] for ln in lines if not _HEADER_RX.search(ln["text"])), default=0)
    limit_y = y_num if not continuation else (nxt[1] if nxt else ph)
    header_end = max([ln["y1"] for ln in lines if ln["y0"] < max(limit_y, first_content) and ln["y0"] < ph * 0.35
                      and _HEADER_RX.search(ln["text"])] + [0.0])
    stop_y = min([ln["y0"] for ln in lines if _STOP_RX.search(ln["text"]) and ln["y0"] > max(y_num, header_end)
                  and ln["x0"] >= x_left - 5] + [ph])  # 左側作答欄的「均給分」不算
    end_y = min(nxt[1] if nxt else ph - 28, stop_y)

    x0 = max(0, int((x_left - 6) * s))
    x1 = int(pw * s) - int(18 * s)
    rules = _horizontal_rules(img, x0, x1)
    yn = y_num * s
    if continuation:
        top, bottom = (header_end + 2) * s, (end_y - 3) * s
        inner = [r for r in rules if top + 4 < r < bottom - 4]
        if inner:
            bottom = inner[-1] - 2
    else:
        above = [r for r in rules if r < yn - 2]
        below = [r for r in rules if r > yn + 4]
        if above and below and (below[0] - above[-1]) < 0.9 * img.height:
            top, bottom = above[-1] + 3, below[0] - 2
            # 圖的外框可能被誤判為表格線：確保題目自己的選項列 (A) 有被包含
            opt = [ln for ln in lines if y_num <= ln["y0"] < end_y and ln["x0"] >= x_left - 5
                   and re.search(r"[\(（]A[\)）]", ln["text"])]
            if opt and opt[0]["y1"] * s > bottom:
                after = [r for r in rules if r > opt[0]["y1"] * s]
                bottom = min(after[0] - 2 if after else opt[0]["y1"] * s + 6, (end_y - 3) * s)
        else:
            prev_text = [ln["y1"] for ln in lines if ln["y1"] < y_num - 3 and ln["x0"] > x_left - 40]
            top = (max(prev_text + [header_end]) + 2) * s
            bottom = (end_y - 3) * s
    bottom = min(bottom, (stop_y - 2) * s)
    top = max(int(top), int(header_end * s))
    bottom = int(min(bottom, img.height))
    if bottom - top < 20:
        return None
    crop = img.crop((x0, top, x1, bottom))
    bbox = crop.point(lambda v: 255 if v < 235 else 0).getbbox()
    if not bbox:
        return None
    return crop.crop((0, max(0, bbox[1] - 6), crop.width, min(crop.height, bbox[3] + 6)))


def crop_question_figure(pdf: Path, pages, number: int, out: Path) -> bool:
    """裁切第 number 題（可跨多頁，pages 為頁碼清單）並存成 WebP。"""
    try:
        from PIL import Image
    except ImportError:
        return False
    out.parent.mkdir(parents=True, exist_ok=True)
    parts = []
    for i, page in enumerate(pages):
        im = _crop_region(pdf, int(page), number, continuation=i > 0)
        if im is not None:
            parts.append(im)
    if not parts:
        return False
    w = max(p.width for p in parts)
    canvas = Image.new("L", (w, sum(p.height for p in parts)), 255)
    y = 0
    for p in parts:
        canvas.paste(p, (0, y))
        y += p.height
    canvas.save(out, "WEBP", quality=72, method=6)
    return True


# ---------------------------------------------------------------- build


def load_exam(exam: dict, report: dict) -> list:
    raw_name = exam.get("raw") or (Path(exam["pdf"]).stem + "_structured_output.json")
    raw_path = RAW_DIR / raw_name
    ovr_path = OVR_DIR / f"{exam['id']}.json"
    ovr = json.loads(ovr_path.read_text("utf-8")) if ovr_path.exists() else {}
    rep = report.setdefault(exam["id"], {"patches": 0, "autofix": defaultdict(int), "warnings": []})
    rep["override"] = ovr_path.name if ovr else None

    if ovr.get("mode") == "replace":
        raw = ovr.get("problems", [])
        rep["raw_count"] = len(json.loads(raw_path.read_text("utf-8"))["problems"]) if raw_path.exists() else 0
        rep["replaced"] = True
    else:
        raw = json.loads(raw_path.read_text("utf-8"))["problems"]
        rep["raw_count"] = len(raw)

    probs = {}
    for p in raw:
        n = int(p["number"])
        fixes = []
        q = {
            "number": n,
            "pdf_label": p.get("pdf_label"),
            "question": clean_text(p.get("question", "")),
            "options": autofix_options(p.get("options", {}), fixes),
            "answer": p.get("answer"),
            "subject": p.get("subject"),
            "figure": p.get("figure"),
            "fixes": fixes,
        }
        for f in fixes:
            rep["autofix"][f] += 1
        if n in probs:
            rep["warnings"].append(f"#{n} 題號重複，保留第一筆")
            continue
        probs[n] = q

    for patch in ovr.get("patches", []) if ovr.get("mode") != "replace" else []:
        n = int(patch["number"])
        rep["patches"] += 1
        if patch.get("drop"):
            probs.pop(n, None)
            continue
        q = probs.get(n)
        if q is None:
            if "question" in patch and "options" in patch:
                q = probs[n] = {"number": n, "question": "", "options": {k: "" for k in LETTERS},
                                "answer": None, "subject": None, "figure": None, "fixes": [], "pdf_label": None}
            else:
                rep["warnings"].append(f"#{n} 修正檔指向不存在的題目")
                continue
        if "question" in patch:
            q["question"] = clean_text(patch["question"])
        if "options" in patch:
            merged = dict(q["options"])
            merged.update({k: clean_text(v) for k, v in patch["options"].items() if k in LETTERS})
            q["options"] = merged
        for k in ("answer", "subject", "figure", "pdf_label"):
            if k in patch:
                q[k] = patch[k]
        q["fixes"].append("override")

    # 科目
    for q in probs.values():
        if exam["subject"] != "mixed":
            q["subject"] = exam["subject"]
        elif not q.get("subject") or q["subject"] not in SUBJECT_NAMES:
            for lo, hi, subj in exam.get("default_subject_ranges", []):
                if lo <= q["number"] <= hi:
                    q["subject"] = subj
        if q["subject"] not in SUBJECT_NAMES:
            q["subject"] = "process"
    return [probs[n] for n in sorted(probs)]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-figures", action="store_true", help="不重新裁切題目圖片")
    args = ap.parse_args()

    registry = json.loads((DATA / "exams.json").read_text("utf-8"))["exams"]
    exams = [e for e in registry if e.get("include", True)]
    report = {}
    explanations = {}
    exp_path = DATA / "explanations.json"
    if exp_path.exists():
        explanations = json.loads(exp_path.read_text("utf-8"))

    if not args.no_figures and FIG_DIR.exists():
        shutil.rmtree(FIG_DIR)

    groups = {}  # dedup key -> merged question
    order = []
    pos_key = {}  # (exam_id, number) -> dedup key，用來把「承上題」連到上一題
    for exam in exams:
        pdf = PDF_DIR / exam["pdf"]
        rep = report.setdefault(exam["id"], {"patches": 0, "autofix": defaultdict(int), "warnings": []})
        items = load_exam(exam, report)
        rep["final_count"] = len(items)

        # 答案交叉核對（僅限能解析出答案欄的版型；replace 模式題號可能重編，略過）
        pdf_keys = parse_answer_key(pdf) if pdf.exists() and not rep.get("replaced") else {}
        rep["pdf_key_parsed"] = len(pdf_keys)
        rep["answer_crosscheck_diff"] = []
        exam_figs = {}

        for q in items:
            letters, all_credit = norm_answer(q["answer"])
            if not letters:
                rep["warnings"].append(f"#{q['number']} 沒有有效答案")
                continue
            if len(pdf_keys) >= 40 and q["number"] in pdf_keys and pdf_keys[q["number"]] not in letters:
                rep["answer_crosscheck_diff"].append(
                    f"#{q['number']} 題庫={'/'.join(letters)} PDF 答案欄={pdf_keys[q['number']]}")

            figure = None
            if q.get("figure"):
                page = q["figure"].get("page") if isinstance(q["figure"], dict) else None
                fig_name = f"{exam['id']}-{q['number']}.webp"
                reuse = q["question"].startswith("承上題") and exam_figs.get(q["number"] - 1)
                if reuse:
                    figure = reuse  # 承上題：沿用上一題的圖
                elif args.no_figures:
                    figure = fig_name if (FIG_DIR / fig_name).exists() else None
                elif page and pdf.exists():
                    num = q["number"]
                    if q.get("pdf_label"):
                        m = re.search(r"(\d+)\s*$", q["pdf_label"])
                        num = int(m.group(1)) if m else num
                    pages = q["figure"].get("pages") or [page]
                    if crop_question_figure(pdf, pages, num, FIG_DIR / fig_name):
                        figure = fig_name
                if figure:
                    exam_figs[q["number"]] = figure
                if not figure:
                    rep["warnings"].append(f"#{q['number']} 需要圖但裁切失敗（page={page}）")

            key = norm_key(q["question"]) + "|" + "|".join(sorted(norm_key(v) for v in q["options"].values()))
            ans_texts = sorted(norm_key(q["options"][l]) for l in letters)
            pos_key[(exam["id"], q["number"])] = key
            src = {"exam": exam["id"], "n": q["number"]}
            if q.get("pdf_label"):
                src["label"] = q["pdf_label"]
            entry = {
                "question": q["question"], "options": q["options"], "ans": letters, "allCredit": all_credit,
                "subject": q["subject"], "figure": figure, "year": exam.get("year"), "official": exam["official"],
                "ans_texts": ans_texts, "sources": [src], "fixes": q["fixes"],
            }
            if key in groups:
                g = groups[key]
                g["sources"].append(src)
                if ans_texts != g["ans_texts"]:
                    g.setdefault("conflicts", []).append(
                        f"{exam['id']}#{q['number']} 答案={'/'.join(letters)}")
                # 以較新的官方考卷版本為主（文字通常較正確）
                newer = (exam["official"], exam.get("year") or 0) > (g["official"], g["year"] or 0)
                if newer and not g.get("conflicts"):
                    keep_sources = g["sources"]
                    groups[key] = {**entry, "sources": keep_sources}
                if not groups[key]["figure"] and figure:
                    groups[key]["figure"] = figure
            else:
                groups[key] = entry
                order.append(key)

    key_id = {k: "q" + hashlib.sha1(k.encode("utf-8")).hexdigest()[:10] for k in order}
    questions = []
    for key in order:
        g = groups[key]
        qid = "q" + hashlib.sha1(key.encode("utf-8")).hexdigest()[:10]
        item = {
            "id": qid,
            "q": g["question"],
            "o": g["options"],
            "a": g["ans"],
            "s": g["subject"],
            "t": tag_question(g["question"], g["options"]),
            "src": sorted(g["sources"], key=lambda s: s["exam"]),
        }
        if g["allCredit"]:
            item["all"] = True
        if g["figure"]:
            item["fig"] = "data/figures/" + g["figure"]
        if not g["official"] and all(not next(e for e in exams if e["id"] == s["exam"])["official"] for s in g["sources"]):
            item["mock"] = True
        if g.get("conflicts"):
            item["conflict"] = g["conflicts"]
        if g["question"].startswith("承上題"):
            for src in g["sources"]:
                pk = pos_key.get((src["exam"], src["n"] - 1))
                if pk:
                    item["prev"] = key_id[pk]
                    break
        if qid in explanations:
            item["x"] = explanations[qid]
        questions.append(item)

    bank = {
        "version": 2,
        "build": "",
        "subjects": SUBJECT_NAMES,
        "exams": [{k: e[k] for k in ("id", "year", "session", "subject", "title", "official", "pdf")} for e in exams],
        "questions": questions,
    }
    # 版本號＝內容雜湊（不放時間戳，重建結果才會穩定、CI 才能比對是否同步）
    bank["build"] = hashlib.sha1(json.dumps(bank, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()[:8]
    (DATA / "bank.json").write_text(json.dumps(bank, ensure_ascii=False, separators=(",", ":")), "utf-8")
    write_report(registry, exams, report, questions, bank["build"])
    total_src = sum(len(q["src"]) for q in questions)
    print(f"bank.json: {len(questions)} 題（來源題次 {total_src}，{len(exams)} 份考卷）")
    print(f"報告：docs/QA_REPORT.md")


def write_report(registry, exams, report, questions, build):
    lines = ["# 題庫品質報告（自動產生）", "",
             "由 `python3 tools/build_bank.py` 自動產生，請勿手動編輯；要修正題目請改 `data/overrides/`。", ""]
    total_src = sum(len(q["src"]) for q in questions)
    multi = sum(1 for q in questions if len(q["src"]) > 1)
    lines += ["## 總覽", "", f"- 題庫版本：`{build}`",
              f"- 收錄考卷：{len(exams)} 份（另有 {len(registry) - len(exams)} 份因重複而排除）",
              f"- 題目：{len(questions)} 題不重複（原始題次 {total_src}，其中 {multi} 題在多份考卷重複出現）",
              f"- 產業概論 {sum(q['s'] == 'industry' for q in questions)} 題／製造概論 {sum(q['s'] == 'process' for q in questions)} 題",
              f"- 含圖片：{sum('fig' in q for q in questions)} 題；多重給分／一律給分：{sum(len(q['a']) > 1 for q in questions)} 題",
              f"- 跨考卷答案衝突：{sum('conflict' in q for q in questions)} 題", ""]
    lines += ["## 各考卷", "", "| 考卷 | 原始題數 | 最終題數 | 修正檔 patch | 自動修正 | PDF 答案欄解析 | 答案不一致 |",
              "|---|---|---|---|---|---|---|"]
    for e in exams:
        r = report.get(e["id"], {})
        af = ", ".join(f"{k}×{v}" for k, v in r.get("autofix", {}).items()) or "—"
        ovr = ("整份取代" if r.get("replaced") else str(r.get("patches", 0))) if r.get("override") else "（無修正檔）"
        lines.append(f"| `{e['id']}` {e['title']} | {r.get('raw_count', 0)} | {r.get('final_count', 0)} | {ovr} | {af} | "
                     f"{r.get('pdf_key_parsed', 0) or '—'} | {len(r.get('answer_crosscheck_diff', []))} |")
    excluded = [e for e in registry if not e.get("include", True)]
    if excluded:
        lines += ["", "排除的考卷：", ""] + [f"- `{e['id']}` {e['title']} → 與 `{e.get('duplicate_of')}` 重複" for e in excluded]
    lines += ["", "## 待處理事項", ""]
    any_issue = False
    for e in exams:
        r = report.get(e["id"], {})
        items = [f"答案與 PDF 答案欄不一致：{d}" for d in r.get("answer_crosscheck_diff", [])] + r.get("warnings", [])
        if items:
            any_issue = True
            lines.append(f"### `{e['id']}`")
            lines += [f"- {x}" for x in items] + [""]
    for q in questions:
        if q.get("conflict"):
            any_issue = True
            lines.append(f"- 答案衝突 `{q['id']}`（{q['q'][:24]}…）：" + "；".join(q["conflict"]))
    if not any_issue:
        lines.append("無。")
    (ROOT / "docs").mkdir(exist_ok=True)
    (ROOT / "docs" / "QA_REPORT.md").write_text("\n".join(lines) + "\n", "utf-8")


if __name__ == "__main__":
    main()
