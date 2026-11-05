#!/usr/bin/env python3
"""把網站打包成 claude.ai Artifact 可發佈的形式 → dist/artifact/

Artifact 的頁面不能自帶 <html>/<head>/<body>，而且 CSS/JS 需要內嵌，
所以這裡從 index.html 取出 HEAD:START…END 與 APP:START…END 兩段，
把 style.css、app.js 內嵌進去，並複製題庫與題目圖片：

  dist/artifact/index.html          ← 發佈的頁面
  dist/artifact/data/bank.json      ← 以 files 一併發佈，頁面用相對路徑 fetch
  dist/artifact/data/figures/*.webp

用法：python3 tools/build_artifact.py
"""

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "artifact"


def section(html: str, name: str) -> str:
    m = re.search(rf"<!-- {name}:START -->(.*?)<!-- {name}:END -->", html, re.S)
    if not m:
        raise SystemExit(f"index.html 缺少 <!-- {name}:START/END --> 標記")
    return m.group(1).strip()


def main():
    html = (ROOT / "index.html").read_text("utf-8")
    css = (ROOT / "style.css").read_text("utf-8")
    js = (ROOT / "app.js").read_text("utf-8")
    page = "\n".join([
        section(html, "HEAD"),
        "<style>\n" + css + "\n</style>",
        section(html, "APP"),
        "<script>window.QG_ENV = 'artifact';</script>",
        "<script>\n" + js.replace("</script", "<\\/script") + "\n</script>",
        "",
    ])
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "data").mkdir(parents=True)
    (OUT / "index.html").write_text(page, "utf-8")
    shutil.copy2(ROOT / "data" / "bank.json", OUT / "data" / "bank.json")
    shutil.copytree(ROOT / "data" / "figures", OUT / "data" / "figures")
    figs = sorted(p.name for p in (OUT / "data" / "figures").iterdir())
    print(f"dist/artifact/index.html ({len(page) // 1024} KB) + bank.json + {len(figs)} 張圖")


if __name__ == "__main__":
    main()
