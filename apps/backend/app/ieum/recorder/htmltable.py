"""서버가 그려 주는 화면(HTML)을 데이터로 바꾼다.

JSP 같은 레거시는 조회 버튼이 폼을 제출하면 서버가 결과 표까지 그린 페이지 전체를 돌려준다. JSON 이 아니라서 값
꺼내기·구조 비교·AI 에게 줄 결과가 모두 막힌다. 그래서 표를 행 데이터로 바꾼 사본을 만들어 JSON 응답처럼 다룬다.

- tables: <th> 머리글이 있는 표. 행은 {열 이름: 값}. 칸 안의 링크 주소와 onclick 안의 문자열을 _links 에 모은다
  (레거시에서 다음 화면으로 넘어가는 값이 주로 여기 있다).
- fields: <th>이름</th><td>값</td> 짝으로 된 상세 화면.
- hidden: 폼의 숨은 입력. 매번 바뀌는 토큰을 찾는 데 쓴다.
- links: 주소 후보(설계 4판). 화면 모양과 무관하게 href, form action, onclick 안 문자열 인자, data-* 값을 문서 순서로
  모은다. 항목은 {v: 값, row: 행 글자}. 행은 그 요소에서 위로 올라가며 같은 태그·클래스의 형제(후보를 가진 것)가 2개 이상
  반복되는 첫 조상의 글자다 — 화면 전체를 훑어 "목록"을 추측하지 않는다(필터·메뉴를 결과로 오인한다).
머리글 없는 표는 화면 배치용으로 보고 버린다. 표가 아닌 화면(카드·li 나열)은 links 로만 다룬다(열 이름은 꺼내지 않는다).
"""
import re
from html.parser import HTMLParser
from typing import Dict, List, Optional, Tuple

from app.ieum.discovery.masking import is_secret_key

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


MAX_SCAN = 1_000_000     # 주소 후보를 찾으려고 읽는 응답 글자 수 상한. 결과 목록이 큰 화면의 수백 KB 뒤에 오는 사이트가 흔하다
MAX_LINKS = 2000         # 주소 후보 전체 안전 상한
MAX_LINKS_PER_GROUP = 300  # 묶음(행 묶음 이름)별 후보 상한. 묶음 없는 후보도 한 묶음으로 센다
_RAW_LINKS = 20_000      # 파싱 중 모으는 원시 후보 상한(메모리 보호). 묶음별 상한은 파싱 뒤에 적용한다
MAX_LINK_LEN = 300       # 이보다 긴 값은 주소 후보로 보지 않는다(자르면 주소가 깨진다)
ROW_LEN = 120            # 행 글자 상한
_VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
_INLINE = {"a", "span", "b", "strong", "em", "i", "u", "font", "label", "img", "small", "button", "abbr", "mark", "sup", "sub",
           "td", "th"}                                        # 행이 될 수 없는 요소(글자 꾸밈과 표의 칸). 칸이 아니라 행(tr)을 찾는다
# 닫는 태그 없이 같은 종류가 또 열리면 앞의 것을 닫는다: 태그 → (닫을 태그, 여기서 멈출 경계)
_SELF_CLOSE = {"li": ({"li"}, {"ul", "ol"}), "option": ({"option"}, {"select", "optgroup", "datalist"}),
               "dt": ({"dt", "dd"}, {"dl"}), "dd": ({"dt", "dd"}, {"dl"}),
               "p": ({"p"}, {"div", "table", "ul", "ol", "li", "td", "th", "section", "article", "form"}),
               "tr": ({"tr"}, {"table", "thead", "tbody", "tfoot"}), "td": ({"td", "th"}, {"tr", "table"}),
               "th": ({"td", "th"}, {"tr", "table"})}
_SKIP_TEXT = {"script", "style", "noscript", "template"}


_UNSET = object()


class _Node:
    __slots__ = ("tag", "cls", "parent", "kids", "text", "has", "_txt", "_cnt", "_row")

    def __init__(self, tag: str, cls: str, parent: Optional["_Node"]) -> None:
        self.tag, self.cls, self.parent = tag, cls, parent
        self.kids: List["_Node"] = []
        self.text: List[object] = []          # 글자 조각과 자식 노드를 문서 순서로
        self.has = False                      # 자기나 자손에 주소 후보가 있는가
        self._txt: Optional[str] = None
        self._cnt: Optional[Dict[Tuple[str, str], int]] = None   # 자식 (태그, 클래스) → 후보를 가진 자식 수. 한 번만 센다
        self._row: object = _UNSET                                # _row_of 결과 기억

    def all_text(self) -> str:
        if self._txt is None:
            parts: List[str] = []
            stack = [self]
            while stack:                       # 재귀 대신 스택: 깊은 레거시 HTML 에서 재귀 한도를 넘지 않게
                n = stack.pop()
                if isinstance(n, str):
                    parts.append(n)
                elif n.tag not in _SKIP_TEXT:
                    stack.extend(reversed(n.text))
            self._txt = " ".join(" ".join(parts).split())
        return self._txt


def _sig(n: "_Node") -> str:
    """묶음 이름 조각: 태그.클래스. 클래스의 숫자는 뺀다(무작위 클래스의 숫자가 마스킹기에 걸려 기록·재실행이 달라지지 않게)."""
    cls = [re.sub(r"[\d@\[\]>]", "", c) for c in n.cls.split()]
    return ".".join([n.tag] + [c for c in cls if c])


def _row_of(node: "_Node") -> Optional["_Node"]:
    """주소 후보를 가진 요소에서 위로 올라가며, 같은 태그·클래스의 형제 중 후보를 가진 것이 2개 이상인 첫 조상(행)."""
    # 부모마다 (태그, 클래스)별 개수를 한 번만 세고, 노드마다 결과를 기억한다 — 형제 수천 개인 화면에서 링크마다 형제를
    # 다시 세면 제곱으로 느려진다(카드 8000개 1MB 화면 10초). 파싱이 끝난 뒤에만 부르므로 has 는 바뀌지 않는다.
    path: List[_Node] = []
    n = node
    found: Optional[_Node] = None
    while n is not None and n.parent is not None:
        if n._row is not _UNSET:
            found = n._row                                         # type: ignore[assignment]
            break
        path.append(n)
        if n.tag not in _INLINE:
            par = n.parent
            if par._cnt is None:
                cnt: Dict[Tuple[str, str], int] = {}
                for k in par.kids:
                    if k.has:
                        cnt[(k.tag, k.cls)] = cnt.get((k.tag, k.cls), 0) + 1
                par._cnt = cnt
            if par._cnt.get((n.tag, n.cls), 0) >= 2:
                found = n
                break
        n = n.parent
    for x in path:
        x._row = found
    return found


_TOKEN_ATTR = re.compile(r"csrf|xsrf|token|nonce|viewstate|session|secret|auth|key|sig", re.I)
_PATH_PARAM = re.compile(r";[A-Za-z_][\w.-]*=[^?#/;'\"\s]*")      # ;jsessionid=… 같은 경로 파라미터(세션 값)는 후보에서 뗀다


def _secret_attr(name: str) -> bool:
    """비밀·토큰 이름의 data-* 값은 주소 후보로 남기지 않는다(마스킹기는 키 이름 v 로는 가리지 못한다)."""
    return is_secret_key(name) or bool(_TOKEN_ATTR.search(name))


def _usable(v: str) -> bool:
    v = v.strip()
    return bool(v) and len(v) <= MAX_LINK_LEN and not v.startswith(("#", "javascript:", "mailto:", "tel:"))


ERR_TEXT = ("권한이 없습니다", "오류가 발생", "처리 중 오류")     # 재실행이 오류 화면으로 볼 문구
HTML_HINT = re.compile(r"<\s*(html|body|head|div|p|table|script)\b", re.I)
_HIDDEN_BLOCK = re.compile(r"<(script|style|noscript|template)\b.*?</\1\s*>|<!--.*?-->", re.I | re.S)


def visible_text(text: str) -> str:
    """HTML 이면 스크립트·스타일·주석을 빼고 화면에 보이는 글자만 남긴다. HTML 이 아니면 그대로 둔다."""
    text = text or ""
    if not HTML_HINT.search(text):
        return text
    return re.sub(r"<[^>]+>", " ", _HIDDEN_BLOCK.sub(" ", text))


def error_phrases(html: str) -> List[str]:
    """화면에 보이는 글자에 든 오류 문구들. 기록 때 정상 화면에 이미 있던 문구를 재실행이 오류로 보지 않게 남긴다(원문은 남기지 않는다)."""
    seen = visible_text(html)
    return [t for t in ERR_TEXT if t in seen]


def looks_html(ctype: str, body: str) -> bool:
    return "html" in (ctype or "").lower() or (body or "").lstrip()[:1] == "<"


class _Parser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: List[dict] = []          # 열린 표들. {rows, row, cell}
        self.done: List[List[dict]] = []     # 닫힌 표의 행들
        self.hidden: Dict[str, str] = {}
        self.root = _Node("#root", "", None)
        self.open: List[_Node] = [self.root]          # 열린 요소들(주소 후보의 행 찾기용)
        self.links: List[Tuple[str, _Node]] = []      # (값, 그 값을 가진 요소) 문서 순서

    def _push(self, tag: str, a: Dict[str, str]) -> _Node:
        rule = _SELF_CLOSE.get(tag)
        if rule:
            closes, stops = rule
            for i in range(len(self.open) - 1, 0, -1):    # 경계(표·목록) 안쪽에서만 닫는다
                t = self.open[i].tag
                if t in closes:
                    del self.open[i:]
                    break
                if t in stops:
                    break
        parent = self.open[-1]
        node = _Node(tag, " ".join(a.get("class", "").split()), parent)
        parent.kids.append(node)
        parent.text.append(node)
        if tag not in _VOID:
            self.open.append(node)
        return node

    def _collect(self, tag: str, a: Dict[str, str], node: _Node) -> None:
        vals: List[str] = []
        href = a.get("href", "") if tag in ("a", "area") else ""
        if tag == "form":
            vals.append(a.get("action", ""))
        vals.append(href)
        js = a.get("onclick", "") + " " + (href if href.strip().lower().startswith("javascript:") else "")
        vals += _literals(js)
        # data-* 는 숫자나 / 가 든 값만(식별자·주소). role="button" 같은 글자 값은 다음 단계 값이 아니다
        vals += [v for k, v in a.items() if k.startswith("data-") and not _secret_attr(k[5:]) and re.search(r"[\d/]", v)]
        got = False
        for v in vals:
            v = _PATH_PARAM.sub("", v.strip())
            if _usable(v) and len(self.links) < _RAW_LINKS:
                self.links.append((v, node))
                got = True
        if got:
            n: Optional[_Node] = node
            while n is not None and not n.has:
                n.has = True
                n = n.parent

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in _VOID:
            self.handle_endtag(tag)

    def handle_starttag(self, tag, attrs):
        a = {k: (v or "") for k, v in attrs}
        self._collect(tag, a, self._push(tag, a))
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
        for i in range(len(self.open) - 1, 0, -1):         # 짝이 맞는 열린 요소까지 닫는다. 짝이 없으면 무시한다
            if self.open[i].tag == tag:
                del self.open[i:]
                break
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
        self.open[-1].text.append(data)
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
    # 행 글자는 한 번만 둔다(linkRows). 링크 항목은 r 로 그 번호를 가리킨다. 묶음 이름 g 는 "부모 태그.클래스>행 태그.클래스"
    # 같은 행의 같은 값(썸네일·제목이 같은 주소)은 하나로, 묶음별 MAX_LINKS_PER_GROUP·전체 MAX_LINKS 까지만 문서 순서로 둔다.
    # 기록과 재실행이 같은 함수를 지나므로 줄 세우기(k)가 양쪽에서 같다.
    links, rows, index = [], [], {}
    seen_in_row, per_group = set(), {}
    for v, node in p.links:
        if len(links) >= MAX_LINKS:
            break
        row = _row_of(node)
        url_like = "/" in v or "?" in v                 # 같은 행의 같은 값을 합치는 것은 주소(썸네일+제목)만. 값 인자는 자리 순번이 밀린다
        if row is not None and url_like and (id(row), v) in seen_in_row:
            continue
        g = (_sig(row.parent) + ">" + _sig(row)) if row is not None else ""
        if per_group.get(g, 0) >= MAX_LINKS_PER_GROUP:
            continue
        per_group[g] = per_group.get(g, 0) + 1
        item = {"v": v}
        if row is not None:
            seen_in_row.add((id(row), v))
            if id(row) not in index:
                index[id(row)] = len(rows)
                rows.append({"t": row.all_text()[:ROW_LEN], "g": g})
            item["r"] = index[id(row)]
        links.append(item)
    if not tables and not fields and not p.hidden and not links:
        return None
    out = {"tables": tables, "fields": fields, "hidden": p.hidden}
    if links:
        out.update(links=links, linkRows=rows)
    return out


def links_of(data) -> List[dict]:
    """사본의 주소 후보를 [{v, row, g, ri}] 로 펼친다(ri 는 행 번호, 행이 없으면 row·g 는 "" 이고 ri 는 None)."""
    rows = (data or {}).get("linkRows") or []
    out = []
    for x in (data or {}).get("links") or []:
        if not isinstance(x, dict) or not isinstance(x.get("v"), str):
            continue
        r = x.get("r")
        row = rows[r] if isinstance(r, int) and 0 <= r < len(rows) and isinstance(rows[r], dict) else {}
        out.append({"v": x["v"], "row": str(row.get("t") or ""), "g": str(row.get("g") or ""), "ri": r if row else None})
    return out


def without_links(data):
    """단계의 기록 사본(recordedData)용: 주소 후보를 뺀다. 재실행은 새 응답의 후보를 읽고, 기록 사본은 구조 비교에만 쓴다."""
    if not is_copy(data):
        return data
    return {k: v for k, v in data.items() if k not in ("links", "linkRows")}


def is_copy(data) -> bool:
    """HTML 을 바꾼 사본인가(JSON 응답과 구별). 주소 후보는 사본이면 links 에서, JSON 이면 문자열 값 전부에서 꺼낸다."""
    return isinstance(data, dict) and isinstance(data.get("tables"), list) and isinstance(data.get("hidden"), dict) and "fields" in data


def shape(data: dict) -> set:
    keys = {f"f:{k}" for k in (data or {}).get("fields", {})}
    for i, t in enumerate((data or {}).get("tables", [])):
        keys |= {f"t{i}:{c}" for c in t["columns"]}
    return keys
