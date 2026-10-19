"""스키마 읽기: 테이블, 뷰, 컬럼, 키와 제약, 행 수, 값 샘플. 읽기 전용 쿼리뿐이다.

뷰에는 선언된 기본키가 없어서 뷰 정의(SQL)에서 알아낸다: 첫 테이블의 기본키 컬럼이 SELECT 에 다 있으면 그 컬럼이 뷰의 키다.
뷰 정의의 조인 조건(`ON d.DEPT_CD = e.DEPT_CD`)은 링크 후보의 근거가 된다.
"""
import re
from typing import Dict, List, Optional, Tuple

from sqlalchemy import inspect, text

from app.ieum.onto import conn as dbconn


def q(c: dict, name: str) -> str:
    """식별자를 그 DB 방식으로 감싼다."""
    return dbconn.engine(c).dialect.identifier_preparer.quote(name)


_PLAIN = re.compile(r"^[A-Za-z_][A-Za-z0-9_$#]*$")


def ident(name: str) -> str:
    """보이는 SQL 용 식별자: 평범한 이름은 그대로, 아니면 큰따옴표로 감싼다."""
    return name if _PLAIN.match(name) else '"%s"' % name.replace('"', '""')


def qualified(c: dict, table: str) -> str:
    """SQL 에 쓰는 테이블 이름. SQLite 는 스키마가 없다."""
    if c["dbms"] == "sqlite":
        return q(c, table)
    return "%s.%s" % (q(c, c["schema"]), q(c, table)) if c.get("schema") else q(c, table)


def _schema(c: dict) -> Optional[str]:
    return None if c["dbms"] == "sqlite" else (c.get("schema") or None)


def _raw_types_sqlite(cx, table: str) -> Dict[str, str]:
    return {r[1]: (r[2] or "").strip() for r in cx.execute(text('PRAGMA table_info("%s")' % table.replace('"', '""')))}


def read(c: dict, counts: bool = True) -> dict:
    """연결의 스키마 전체. {tables: [{name, kind, rows, cols, pk, fks, view}]}"""
    eng = dbconn.engine(c)
    out: List[dict] = []
    with eng.connect() as cx:
        ins = inspect(cx)
        schema = _schema(c)
        names = [(n, "table") for n in ins.get_table_names(schema=schema)] + [(n, "view") for n in ins.get_view_names(schema=schema)]
        for name, kind in sorted(names):
            raw = _raw_types_sqlite(cx, name) if c["dbms"] == "sqlite" else {}
            pk_cols = (ins.get_pk_constraint(name, schema=schema) or {}).get("constrained_columns") or []
            cols = []
            for col in ins.get_columns(name, schema=schema):
                ctype = raw.get(col["name"]) or str(col["type"])
                cols.append({"name": col["name"], "type": ctype, "nullable": bool(col.get("nullable", True)), "pk": col["name"] in pk_cols})
            fks = [{"cols": f["constrained_columns"], "ref": f["referred_table"], "refcols": f["referred_columns"]} for f in ins.get_foreign_keys(name, schema=schema) if f.get("referred_table")]
            t = {"name": name, "kind": kind, "rows": None, "cols": cols, "pk": list(pk_cols), "fks": fks, "view": None}
            if kind == "view":
                sql = ins.get_view_definition(name, schema=schema) or ""
                t["view"] = parse_view(sql)
                t["viewSql"] = sql
            out.append(t)
    by = {t["name"]: t for t in out}
    for t in out:                                              # 뷰의 키는 원본 테이블의 키에서 얻는다
        if t["kind"] == "view" and t["view"]:
            _view_keys(t, by)
    if counts:
        for t in out:
            t["rows"] = row_count(c, t["name"])
    return {"tables": out, "tableCount": sum(1 for t in out if t["kind"] == "table"), "viewCount": sum(1 for t in out if t["kind"] == "view")}


_CACHE: Dict[str, Tuple[float, dict]] = {}
_CACHE_TTL = 60.0


def read_cached(c: dict, ttl: float = _CACHE_TTL, fresh: bool = False) -> dict:
    """스키마 읽기 결과를 잠깐 기억한다. 객체 구축 화면이 열릴 때마다 모든 테이블의 행 수를 세지 않으려는 것이다."""
    import time as _t
    from app.ieum.config import state_dir
    key = "%s|%s" % (state_dir(), c["id"])               # 상태 폴더가 다르면(시험) 같은 연결 id 라도 다른 것이다
    hit = _CACHE.get(key)
    if hit and not fresh and _t.monotonic() - hit[0] < ttl:
        return hit[1]
    res = read(c)
    _CACHE[key] = (_t.monotonic(), res)
    return res


def forget_cache(conn_id: str = "") -> None:
    from app.ieum.config import state_dir
    if conn_id:
        _CACHE.pop("%s|%s" % (state_dir(), conn_id), None)
    else:
        _CACHE.clear()


def row_count(c: dict, table: str, where: str = "") -> Optional[int]:
    try:
        r = dbconn.run(c, "SELECT COUNT(*) FROM %s%s" % (qualified(c, table), (" WHERE " + where) if where else ""), limit=1)
        return int(r.rows[0][0])
    except dbconn.ConnError:
        return None


def distinct_values(c: dict, table: str, col: str, n: int = 1000) -> List:
    """null 이 아닌 서로 다른 값 최대 n 개. LIMIT 은 DB 마다 문법이 달라 쓰지 않고, 가져오는 행 수를 n 으로 끊는다."""
    sql = "SELECT DISTINCT %s FROM %s WHERE %s IS NOT NULL" % (q(c, col), qualified(c, table), q(c, col))
    return [r[0] for r in dbconn.run(c, sql, limit=n).rows]


def sample_rows(c: dict, table: str, cols: Optional[List[str]] = None, n: int = 1000) -> dbconn.Result:
    """표본 행. cols 가 없으면 전부(SELECT *). 앞쪽 n 행만 가져온다."""
    sel = ", ".join(q(c, x) for x in cols) if cols else "*"
    return dbconn.run(c, "SELECT %s FROM %s" % (sel, qualified(c, table)), limit=n)


def matched_values(c: dict, table: str, col: str, values: List, chunk: int = 400) -> set:
    """values 중 table.col 에 실제로 있는 값의 집합. IN 목록을 chunk 개씩 나눠 읽는다(DB 마다 IN 목록 길이에 한도가 있다)."""
    out: set = set()
    vals = list(values)
    for i in range(0, len(vals), chunk):
        part = vals[i:i + chunk]
        binds = {"v%d" % j: v for j, v in enumerate(part)}
        sql = "SELECT DISTINCT %s FROM %s WHERE %s IN (%s)" % (q(c, col), qualified(c, table), q(c, col), ", ".join(":v%d" % j for j in range(len(part))))
        try:
            out.update(r[0] for r in dbconn.run(c, sql, binds, limit=chunk + 1).rows)
        except dbconn.ConnError:
            return set()
    return out


def is_unique(c: dict, table: str, col: str) -> bool:
    """null 이 아닌 값이 모두 서로 다른가(키로 쓸 수 있는가)"""
    try:
        r = dbconn.run(c, "SELECT COUNT(*), COUNT(DISTINCT %s) FROM %s WHERE %s IS NOT NULL" % (q(c, col), qualified(c, table), q(c, col)), limit=1).rows[0]
    except dbconn.ConnError:
        return False
    return bool(r[0]) and r[0] == r[1]


# ── 뷰 정의 읽기 ───────────────────────────────────────────────────────────

_SEL = re.compile(r"\bselect\b(.*?)\bfrom\b(.*)", re.I | re.S)
_FROM_ITEM = re.compile(r"\b(from|(?:left\s+|right\s+|inner\s+|full\s+)?(?:outer\s+)?join)\s+([\w.\"]+)(?:\s+(?:as\s+)?(\w+))?(?:\s+on\s+(.+?))?\s*(?=\bleft\b|\bright\b|\binner\b|\bfull\b|\bjoin\b|\bwhere\b|\bgroup\b|\border\b|$)", re.I | re.S)
_EQ = re.compile(r"(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)")


def _split_top(s: str) -> List[str]:
    out, depth, cur = [], 0, ""
    for ch in s:
        depth += (ch == "(") - (ch == ")")
        if ch == "," and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur)
    return [x.strip() for x in out]


def parse_view(sql: str) -> Optional[dict]:
    """CREATE VIEW … AS SELECT 를 읽는다. 단순한 SELECT-JOIN 뷰만 안다(서브쿼리, UNION 은 None)."""
    body = re.sub(r"--.*$", "", sql or "", flags=re.M)
    body = re.sub(r"^.*?\bas\b\s*(?=select)", "", body, count=1, flags=re.I | re.S)
    m = _SEL.search(body)
    if not m or re.search(r"\bunion\b|\(\s*select\b", body, re.I):
        return None
    items, rest = _split_top(m.group(1)), m.group(2)
    tables, alias_of, joins = [], {}, []
    for kind, tbl, alias, on in _FROM_ITEM.findall("from " + rest):
        name = tbl.strip('"').split(".")[-1]
        alias = alias if alias and alias.lower() not in ("on", "where", "left", "right", "inner", "full", "join", "group", "order") else name
        tables.append(name)
        alias_of[alias.lower()] = name
        alias_of[name.lower()] = name
        for a1, c1, a2, c2 in _EQ.findall(on or ""):
            if a1.lower() in alias_of and a2.lower() in alias_of:
                joins.append({"a": alias_of[a1.lower()], "ac": c1, "b": alias_of[a2.lower()], "bc": c2, "left": "left" in kind.lower()})
    select = []
    for it in items:
        mm = re.match(r"^(?:(\w+)\.)?(\w+)(?:\s+(?:as\s+)?(\w+))?$", it.strip(), re.I)
        if mm:
            alias, col, out = mm.group(1), mm.group(2), mm.group(3) or mm.group(2)
            select.append({"table": alias_of.get((alias or "").lower()) or (tables[0] if tables else ""), "col": col, "out": out})
    return {"base": tables[0] if tables else None, "tables": tables, "joins": joins, "select": select}


def _view_keys(t: dict, by: Dict[str, dict]) -> None:
    v = t["view"]
    base = by.get(v["base"] or "")
    if not base or not base["pk"]:
        return
    out = {s["col"].upper(): s["out"] for s in v["select"] if s["table"] == base["name"]}
    if all(k.upper() in out for k in base["pk"]):
        t["pk"] = [out[k.upper()] for k in base["pk"]]
        for col in t["cols"]:
            col["pk"] = col["name"] in t["pk"]
