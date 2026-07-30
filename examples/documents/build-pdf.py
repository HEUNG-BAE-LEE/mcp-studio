#!/usr/bin/env python3
"""src/ 의 원본 문서를 시연용 PDF 로 굽는다.

실제 활용가이드는 PDF·HWP 로 배포된다. 시연에 txt 를 올리면 "텍스트라서 됐겠지"
로 읽히므로, 원본은 편집 가능한 텍스트로 두고 화면에 올릴 것은 PDF 로 만든다.

Chrome 헤드리스로 굽는 이유는 두 가지다.
  1. 새 의존성이 없다. reportlab·weasyprint 를 넣으면 한글 폰트까지 함께 챙겨야 한다.
  2. 글자 레이어가 있는 PDF 가 나온다 — pypdf 가 읽을 수 있어야 수집이 된다.

표는 <pre> 로 굽는다. 프로포셔널 폰트로 조판하면 PDF 추출 때 열 구분이
공백으로 뭉개져 규칙 기반 폴백이 파이프 표를 못 읽는다.

src/scan/ 에 둔 원본은 **글자 레이어 없이** 굽는다. 한 번 이미지로 만든 뒤
그 이미지만 PDF 에 넣는다 — 관공서가 종이를 스캔해 올린 활용가이드와 같은
상태다. 시연에서 "읽지 못한다" 를 정직하게 보여주는 데 쓴다.

    python3 build-pdf.py
"""

import base64
import html
import pathlib
import subprocess
import sys
import tempfile

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

HERE = pathlib.Path(__file__).parent
SRC = HERE / "src"

TEMPLATE = """<!doctype html><meta charset="utf-8"><title>{title}</title>
<style>
  @page {{ size: A4; margin: 18mm 16mm; }}
  body {{
    font-family: "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
    font-size: 10.5pt; line-height: 1.65; color: #111;
  }}
  pre {{
    font-family: "D2Coding", "Menlo", monospace;
    font-size: 8.6pt; line-height: 1.6;
    white-space: pre-wrap; word-break: break-all; margin: 0;
  }}
</style>
<pre>{body}</pre>
"""

# 스캔본은 종이를 찍은 것처럼 보여야 한다 — 약간 기울이고 누렇게 깐다.
SCAN_TEMPLATE = """<!doctype html><meta charset="utf-8">
<style>
  @page {{ size: A4; margin: 0; }}
  html, body {{ margin: 0; padding: 0; background: #fff; }}
  img {{ display: block; width: 100%; filter: grayscale(1) contrast(1.15); }}
</style>
<img src="data:image/png;base64,{png}">
"""


def _chrome(*args: str) -> None:
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", *args], check=True, capture_output=True)


def _tmp(suffix: str, text: str) -> str:
    with tempfile.NamedTemporaryFile("w", suffix=suffix, delete=False) as tmp:
        tmp.write(text)
        return tmp.name


def build(source: pathlib.Path) -> pathlib.Path:
    out = HERE / f"{source.stem}.pdf"
    page = TEMPLATE.format(title=html.escape(source.stem), body=html.escape(source.read_text()))
    tmp_path = _tmp(".html", page)
    _chrome("--no-pdf-header-footer", f"--print-to-pdf={out}", f"file://{tmp_path}")
    pathlib.Path(tmp_path).unlink()
    return out


def build_scan(source: pathlib.Path) -> pathlib.Path:
    """글자 레이어가 없는 PDF. 텍스트 → PNG → PDF 로 두 번 굽는다."""
    out = HERE / f"{source.stem}.pdf"
    page = TEMPLATE.format(title=html.escape(source.stem), body=html.escape(source.read_text()))
    html_path = _tmp(".html", page)
    png_path = pathlib.Path(tempfile.mkstemp(suffix=".png")[1])

    # A4 비율(210:297)로 찍어야 PDF 에 넣었을 때 여백이 뒤틀리지 않는다.
    _chrome("--window-size=1240,1754", f"--screenshot={png_path}", f"file://{html_path}")
    png = base64.b64encode(png_path.read_bytes()).decode()
    scan_path = _tmp(".html", SCAN_TEMPLATE.format(png=png))
    _chrome("--no-pdf-header-footer", f"--print-to-pdf={out}", f"file://{scan_path}")

    for path in (html_path, png_path, scan_path):
        pathlib.Path(path).unlink()
    return out


if __name__ == "__main__":
    if not pathlib.Path(CHROME).exists():
        sys.exit(f"Chrome 을 찾지 못했습니다: {CHROME}")
    for source in sorted(SRC.glob("*")):
        if source.suffix in (".md", ".txt"):
            print(f"{source.name} -> {build(source).name}")
    for source in sorted((SRC / "scan").glob("*")):
        if source.suffix in (".md", ".txt"):
            print(f"scan/{source.name} -> {build_scan(source).name} (글자 레이어 없음)")
