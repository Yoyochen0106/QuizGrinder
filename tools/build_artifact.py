#!/usr/bin/env python3
"""把網站打包成 claude.ai Artifact 可發佈的形式 → dist/artifact/

Artifact 的頁面不能自帶 <html>/<head>/<body>，而且 CSS/JS 需要內嵌，
所以這裡從 index.html 取出 HEAD:START…END 與 APP:START…END 兩段，
把 style.css、app.js 內嵌進去，並複製題庫與題目圖片：

  dist/artifact/index.html          ← 發佈的頁面
  dist/artifact/data/bank.json      ← 以 files 一併發佈，頁面用相對路徑 fetch
  dist/artifact/data/figures/*.webp

用法：
  python3 tools/build_artifact.py               # 正式版 → dist/artifact/
  python3 tools/build_artifact.py --experiment  # 版面風格實驗版（含四種版面切換）→ dist/artifact-skins/
"""

import argparse

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def section(html: str, name: str) -> str:
    m = re.search(rf"<!-- {name}:START -->(.*?)<!-- {name}:END -->", html, re.S)
    if not m:
        raise SystemExit(f"index.html 缺少 <!-- {name}:START/END --> 標記")
    return m.group(1).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--experiment", action="store_true", help="打包版面風格實驗版")
    args = ap.parse_args()
    out = ROOT / "dist" / ("artifact-skins" if args.experiment else "artifact")
    html = (ROOT / "index.html").read_text("utf-8")
    css = "\n".join((ROOT / f).read_text("utf-8") for f in ("style.css", "skins.css", "skins-more.css"))
    js = "\n".join((ROOT / f).read_text("utf-8") for f in ("app.js", "skins.js", "skins-more.js"))
    head = section(html, "HEAD")
    env = "window.QG_ENV = 'artifact';"
    if args.experiment:
        head = re.sub(r"<title>.*?</title>", "<title>QuizGrinder 版面實驗</title>", head)
        env += " window.QG_SKINS = true;"
    page = "\n".join([
        head,
        "<style>\n" + css + "\n</style>",
        section(html, "APP"),
        f"<script>{env}</script>",
        "<script>\n" + js.replace("</script", "<\\/script") + "\n</script>",
        "",
    ])
    if out.exists():
        shutil.rmtree(out)
    (out / "data").mkdir(parents=True)
    (out / "index.html").write_text(page, "utf-8")
    shutil.copy2(ROOT / "data" / "bank.json", out / "data" / "bank.json")
    shutil.copytree(ROOT / "data" / "figures", out / "data" / "figures")
    figs = sorted(p.name for p in (out / "data" / "figures").iterdir())
    print(f"{out.relative_to(ROOT)}/index.html ({len(page) // 1024} KB) + bank.json + {len(figs)} 張圖")


if __name__ == "__main__":
    main()
