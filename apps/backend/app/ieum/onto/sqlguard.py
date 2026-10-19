"""마트 SQL 검사: 읽기 전용 SELECT 문인지, 컬럼이 이름 붙어 있는지, 어떤 테이블을 읽는지.

마트 SQL 은 사용자가 쓴다. 이 모듈은 문자열 수준에서 막을 것을 막고(쓰기 문장, 여러 문장, SELECT *) 읽는 테이블과 출력 컬럼을 뽑는다.
문자열 수준 검사는 안전의 전부가 아니다 — 실제 실행은 읽기 전용 연결(SQLite 는 mode=ro + query_only)에서만 하므로 우회해도 쓰지 못한다.
"""
import re
from typing import Dict, List, Optional

FORBIDDEN = ("insert", "update", "delete", "merge", "drop", "alter", "truncate", "create", "grant", "revoke", "exec", "execute", "call", "attach", "detach", "pragma",
             "vacuum", "reindex", "into", "replace into", "copy", "load")
_FORBID_RX = re.compile(r"\b(%s)\b" % "|".join(w for w in FORBIDDEN if " " not in w), re.I)


class SqlError(ValueError):
    """사용자에게 그대로 보일 오류"""


def strip_comments(sql: str) -> str:
    """-- 줄 주석과 /* */ 블록 주석을 지운다(문자열 안의 것은 건드리지 않는다)."""
    out, i, n = [], 0, len(sql)
    while i < n:
        ch = sql[i]
        if ch == "'":
            j = i + 1
            while j < n:
                if sql[j] == "'":
                    if j + 1 < n and sql[j + 1] == "'":
                        j += 2
                        continue
                    break
                j += 1
            out.append(sql[i:j + 1])
            i = j + 1
        elif sql.startswith("--", i):
            j = sql.find("\n", i)
            i = n if j < 0 else j
        elif sql.startswith("/*", i):
            j = sql.find("*/", i + 2)
            i = n if j < 0 else j + 2
            out.append(" ")
        else:
            out.append(ch)
            i += 1
    return "".join(out)


def mask_literals(sql: str) -> str:
    """문자열 리터럴과 따옴표 식별자 안을 공백으로 바꿔 키워드 검사에서 빼 준다(길이는 유지한다)."""
    out, i, n = [], 0, len(sql)
    while i < n:
        ch = sql[i]
        if ch in ("'", '"'):
            q, j = ch, i + 1
            while j < n:
                if sql[j] == q:
                    if j + 1 < n and sql[j + 1] == q:
                        j += 2
                        continue
                    break
                j += 1
            out.append(q + " " * (j - i - 1) + q if j < n else sql[i:])
            i = j + 1
        else:
            out.append(ch)
            i += 1
    return "".join(out)


def split_top(s: str) -> List[str]:
    """괄호 밖의 쉼표로 나눈다."""
    out, depth, cur = [], 0, []
    for ch in s:
        depth += (ch == "(") - (ch == ")")
        if ch == "," and depth == 0:
            out.append("".join(cur))
            cur = []
        else:
            cur.append(ch)
    if "".join(cur).strip():
        out.append("".join(cur))
    return [x.strip() for x in out]


def _find_top(masked: str, word: str, start: int = 0) -> int:
    """괄호 깊이 0 에서 처음 나오는 키워드의 위치. 없으면 -1"""
    depth = 0
    rx = re.compile(r"\b%s\b" % word, re.I)
    i = start
    while i < len(masked):
        ch = masked[i]
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        elif depth == 0 and (ch.isalpha()):
            m = rx.match(masked, i)
            if m and (i == 0 or not (masked[i - 1].isalnum() or masked[i - 1] == "_")):
                return i
            while i < len(masked) and (masked[i].isalnum() or masked[i] == "_"):
                i += 1
            continue
        i += 1
    return -1


def out_name(item: str) -> str:
    """SELECT 항목의 출력 컬럼 이름(대문자). AS 별칭이 있으면 그것, 단순 컬럼이면 그 이름, 별칭을 AS 없이 붙였으면 그것. 이름을 알 수 없으면 빈 문자열"""
    it = item.strip()
    m = re.search(r"\bas\s+\"?(\w+)\"?\s*$", it, re.I)
    if m:
        return m.group(1).upper()
    m = re.match(r'^(?:[\w$#"]+\.)?"?([\w$#]+)"?$', it)
    if m:
        return m.group(1).upper()
    m = re.match(r'^(.*\S)\s+"?(\w+)"?$', it, re.S)
    if m and not re.search(r"[+\-*/|(,<>=]\s*$|\b(and|or|not|is|in|like|between|distinct|by|when|then|else)\s*$", m.group(1), re.I):
        return m.group(2).upper()
    return ""


def parse(sql: str, known: Optional[set] = None) -> dict:
    """마트 SQL 을 검사한다. 오류면 SqlError. 결과: {sql(주석 뺀 것), cols: [{c, expr}], tables: [ALIAS.TABLE], ctes, group_by: [식]}
    known 이 있으면 읽는 테이블이 모두 그 안(대문자 ALIAS.TABLE)에 있어야 한다."""
    body = strip_comments(sql or "").strip().rstrip(";").strip()
    if not body:
        raise SqlError("SQL을 입력하세요.")
    masked = mask_literals(body)
    if ";" in masked:
        raise SqlError("SQL 문장은 하나만 쓸 수 있어요.")
    if _FORBID_RX.search(masked):
        raise SqlError("읽기 전용 SELECT 문만 쓸 수 있어요. 데이터를 바꾸는 작업은 액션으로 만드세요.")
    if not re.match(r"^\s*(with\b|select\b|\()", masked, re.I):
        raise SqlError("SELECT로 시작하는 조회문이어야 해요.")
    ctes = {m.group(1).upper() for m in re.finditer(r"(?:\bwith\b|,)\s*(\w+)\s*(?:\([^)]*\))?\s*as\s*\(", masked, re.I)}
    # 마지막(최상위) SELECT 의 컬럼 목록: WITH 절의 괄호를 건너뛴 뒤 첫 최상위 SELECT
    start = 0
    if re.match(r"^\s*with\b", masked, re.I):
        depth, i = 0, 0
        while i < len(masked):
            if masked[i] == "(":
                depth += 1
            elif masked[i] == ")":
                depth -= 1
            elif depth == 0 and re.match(r"select\b", masked[i:], re.I) and (i == 0 or not (masked[i - 1].isalnum() or masked[i - 1] == "_")):
                start = i
                break
            i += 1
    sel = _find_top(masked, "select", start)
    frm = _find_top(masked, "from", sel + 6) if sel >= 0 else -1
    if sel < 0 or frm < 0:
        raise SqlError("FROM 절을 찾지 못했어요.")
    items = split_top(body[sel + 6:frm])
    items = [re.sub(r"^\s*(distinct|all)\s+", "", x, flags=re.I) for x in items]
    if any(x.strip() == "*" or re.search(r"\.\*$", x.strip()) for x in items):
        raise SqlError("SELECT * 대신 객체에 넣을 컬럼을 하나씩 적어 주세요.")
    cols = []
    for x in items:
        name = out_name(x)
        if not name:
            raise SqlError("`%s` 에 컬럼 이름을 붙여 주세요. AS 로 이름을 정해 주세요." % x.strip()[:40])
        cols.append({"c": name, "expr": x.strip()})
    dup = next((c["c"] for i, c in enumerate(cols) if c["c"] in [y["c"] for y in cols[:i]]), None)
    if dup:
        raise SqlError("컬럼 이름 %s가 두 번 나와요. AS로 다른 이름을 붙여 주세요." % dup)
    refs = [m.group(1) for m in re.finditer(r"\b(?:from|join)\s+([\w.$#\"]+)", masked, re.I)]
    tables = []
    for r in refs:
        r = r.replace('"', "")
        if r.upper() in ctes:
            continue
        if "." not in r:
            raise SqlError("%s를 찾지 못했어요. 스키마 이름을 붙여 PO.TB_PO_MST처럼 적어 주세요." % r)
        key = r.upper()
        if key not in tables:
            tables.append(key)
    if known is not None:
        unknown = [t for t in tables if t not in known]
        if unknown:
            raise SqlError("%s를 찾지 못했어요. 스키마 이름을 붙여 PO.TB_PO_MST처럼 적어 주세요." % ", ".join(unknown))
    gb = []
    g = re.search(r"\bgroup\s+by\b(.+?)(?:\bhaving\b|\border\s+by\b|\bunion\b|$)", masked[frm:], re.I | re.S)
    if g:
        off = frm + g.start(1)
        gb = split_top(body[off: off + len(g.group(1))])
    return {"sql": body, "cols": cols, "tables": tables, "ctes": sorted(ctes), "group_by": gb}


def rewrite_schema(sql: str, mapping: Dict[str, str]) -> str:
    """ALIAS.table 의 ALIAS 를 실제 스키마 이름으로 바꾼다(문자열 리터럴 안은 건드리지 않는다). mapping: {대문자 별칭: 치환할 식별자}"""
    if not mapping:
        return sql
    masked = mask_literals(sql)
    out, last = [], 0
    for m in re.finditer(r"(?<![\w.$#\"])(%s)\s*\." % "|".join(re.escape(k) for k in mapping), masked, re.I):
        out.append(sql[last:m.start(1)])
        out.append(mapping[m.group(1).upper()])
        last = m.end(1)
    out.append(sql[last:])
    return "".join(out)


def norm(sql: str) -> str:
    return re.sub(r"\s+", " ", strip_comments(sql or "")).strip().rstrip(";").strip()
