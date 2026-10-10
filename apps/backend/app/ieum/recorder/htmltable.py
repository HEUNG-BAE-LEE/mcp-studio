"""서버가 그려 주는 화면(HTML)을 데이터로 바꾼다.

JSP 같은 레거시는 조회 버튼이 폼을 제출하면 서버가 결과 표까지 그린 페이지 전체를 돌려준다. JSON 이 아니라서 값
꺼내기·구조 비교·AI 에게 줄 결과가 모두 막힌다. 그래서 표를 행 데이터로 바꾼 사본을 만들어 JSON 응답처럼 다룬다.

- tables: <th> 머리글이 있는 표. 행은 {열 이름: 값}. 칸 안의 링크 주소와 onclick 안의 문자열을 _links 에 모은다
  (레거시에서 다음 화면으로 넘어가는 값이 주로 여기 있다).
- fields: <th>이름</th><td>값</td> 짝으로 된 상세 화면.
- hidden: 폼의 숨은 입력. 매번 바뀌는 토큰을 찾는 데 쓴다.
머리글 없는 표는 화면 배치용으로 보고 버린다. 표가 아닌 화면(div 나열)은 다루지 않는다.
"""
import re
from html.parser import HTMLParser
from typing import Dict, List, Optional

# onclick 안의 문자열 인자. 작은따옴표와 큰따옴표를 각자 짝지어 읽는다 (인자 사이 빈 문자열 '' 가 짝을 흩트리지 않게).
_JS_STR = re.compile(r"'([^'\\]{0,99})'|\"([^\"\\]{0,99})\"")


def _literals(s: str) -> List[str]:
    """문자열 인자를 꺼낸다. 앞뒤 공백을 떼고 빈 값은 버린다."""
    out = []
    for m in _JS_STR.finditer(s):
        v = (m.group(1) if m.group(1) is not None else m.group(2)).strip()
        if v:
            out.append(v)
    return out


def looks_html(ctype: str, body: str) -> bool:
    return "html" in (ctype or "").lower() or (body or "").lstrip()[:1] == "<"


class _Parser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: List[dict] = []          # 열린 표들. {rows, row, cell}
        self.done: List[List[dict]] = []     # 닫힌 표의 행들
        self.hidden: Dict[str, str] = {}

    def handle_starttag(self, tag, attrs):
        a = {k: (v or "") for k, v in attrs}
        t = self.stack[-1] if self.stack else None
        # 닫는 태그를 생략한 레거시 HTML: 새 칸·새 행이 시작되면 열린 것을 먼저 닫는다.
        if t is not None and tag in ("td", "th", "tr"):
            _close_cell(t)
        if t is not None and tag == "tr":
            _close_row(t)
        if tag == "table":
            self.stack.append({"rows": [], "row": None, "cell": None})
        elif tag == "tr" and t is not None:
            t["row"] = {"cells": [], "links": _literals(a.get("onclick", ""))}
        elif tag in ("td", "th") and t is not None and t["row"] is not None:
            t["cell"] = {"th": tag == "th", "text": [], "links": _literals(a.get("onclick", "")),
                         "colspan": _int(a.get("colspan")), "rowspan": _int(a.get("rowspan"))}
        elif tag == "input" and a.get("type", "").lower() == "hidden" and a.get("name"):
            self.hidden[a["name"]] = a.get("value", "")
        if tag == "a" and t is not None and t["cell"] is not None:
            href = a.get("href", "")
            if href and not href.startswith(("#", "javascript:void")):
                t["cell"]["links"].append(href)
            t["cell"]["links"] += _literals(a.get("onclick", "") + " " + (href if href.startswith("javascript:") else ""))

    def handle_endtag(self, tag):
        t = self.stack[-1] if self.stack else None
        if t is None:
            return
        if tag in ("td", "th"):
            _close_cell(t)
        elif tag == "tr":
            _close_row(t)
        elif tag == "table":
            _close_row(t)
            self.done.append(self.stack.pop()["rows"])

    def handle_data(self, data):
        if self.stack and self.stack[-1]["cell"] is not None:
            self.stack[-1]["cell"]["text"].append(data)


def _close_cell(t: dict) -> None:
    """열린 칸을 행에 붙인다. 닫는 태그가 없어도 다음 칸·행이나 표 끝에서 닫힌다."""
    if t["cell"] is not None and t["row"] is not None:
        c = t["cell"]
        c["text"] = " ".join("".join(c["text"]).split())
        t["row"]["cells"].append(c)
    t["cell"] = None


def _close_row(t: dict) -> None:
    """열린 칸과 행을 닫는다."""
    _close_cell(t)
    if t["row"] is not None:
        t["rows"].append(t["row"])
        t["row"] = None


def _int(v: Optional[str]) -> int:
    try:
        return max(1, min(int(v or 1), 20))
    except ValueError:
        return 1


def _grid(rows: List[dict]) -> List[List[dict]]:
    """colspan·rowspan 을 펴서 칸 격자로 만든다. 병합 칸은 각 칸에 같은 값을 채운다."""
    out, carry = [], {}                       # carry: 열 번호 → (남은 행 수, 칸)
    for r in rows:
        line, col = [], 0
        cells = list(r["cells"])
        while cells or col in carry:
            if col in carry:
                left, cell = carry[col]
                line.append(cell)
                carry[col] = (left - 1, cell)
                if left - 1 <= 0:
                    del carry[col]
                col += 1
                continue
            c = cells.pop(0)
            for _ in range(c["colspan"]):
                line.append(c)
                if c["rowspan"] > 1:
                    carry[col] = (c["rowspan"] - 1, c)
                col += 1
        out.append((line, r["links"]))
    return out


def _unique(names: List[str]) -> List[str]:
    seen: Dict[str, int] = {}
    out = []
    for n in names:
        n = n or "열"
        seen[n] = seen.get(n, 0) + 1
        out.append(n if seen[n] == 1 else f"{n}_{seen[n]}")
    return out


def to_data(html: str) -> Optional[dict]:
    p = _Parser()
    try:
        p.feed(html or "")
        p.close()
    except Exception:
        return None
    while p.stack:                           # 입력이 끝나도 닫히지 않은 표는 여기서 마감한다
        t = p.stack.pop()
        _close_row(t)
        p.done.append(t["rows"])
    tables, fields = [], {}
    for rows in p.done:
        grid = _grid(rows)
        head = next((i for i, (line, _) in enumerate(grid) if line and all(c["th"] for c in line) and len(line) >= 2), None)
        if head is not None:
            cols = _unique([c["text"] for c in grid[head][0]])
            body = []
            for line, row_links in grid[head + 1:]:
                if not line or all(c["th"] for c in line):
                    continue
                if len(cols) >= 2 and len(line) >= len(cols) and len({id(c) for c in line}) == 1:
                    continue                     # 칸 하나가 모든 열을 덮는 행(colspan)은 "조회 결과 없음" 같은 안내라 데이터가 아니다
                row = {cols[i]: c["text"] for i, c in enumerate(line[:len(cols)])}
                links = list(dict.fromkeys(row_links + [x for c in line for x in c["links"]]))
                if links:
                    row["_links"] = links
                body.append(row)
            tables.append({"columns": cols, "rows": body})
            continue
        for line, _ in grid:                     # <th>이름</th><td>값</td> 짝
            for i in range(0, len(line) - 1):
                if line[i]["th"] and not line[i + 1]["th"] and line[i]["text"]:
                    fields.setdefault(line[i]["text"], line[i + 1]["text"])
    if not tables and not fields and not p.hidden:
        return None
    return {"tables": tables, "fields": fields, "hidden": p.hidden}


def shape(data: dict) -> set:
    keys = {f"f:{k}" for k in (data or {}).get("fields", {})}
    for i, t in enumerate((data or {}).get("tables", [])):
        keys |= {f"t{i}:{c}" for c in t["columns"]}
    return keys
