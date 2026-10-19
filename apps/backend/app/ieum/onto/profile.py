"""테이블을 표본으로 읽어 객체 정의 초안을 만든다: 속성 이름, 타입, 특성(기본키·제목·링크 키·검색·마스킹·코드값·비공개·객체 필터), 예시 값.

판단 근거는 컬럼 이름 사전(dictionary.py), 선언된 컬럼 타입, 키와 제약, 공통코드 표, 값 표본(테이블당 앞 1,000행)이다.
이 모듈은 DB 를 읽기만 한다. 결과(객체 정의)를 저장하는 일은 scan.py 와 build.py 가 한다.

테이블의 역할(classify)은 스캔이 무엇을 제안할지 정한다:
  entity   객체로 제안한다
  history  이력, 로그, 감사 테이블이라 제안하지 않는다
  code     공통코드 표나 아주 작은 코드표라 코드값으로 흡수한다
  fact     날짜가 키에 들어간 큰 기록 테이블이라 마트로 집계하길 권한다
  detail   다른 테이블의 하위(상세) 테이블이라 부모 객체가 생긴 뒤에 제안한다
  nokey    기본키를 알 수 없는 뷰
"""
import re
from typing import Dict, List, Optional, Tuple

from app.ieum.onto import conn as dbconn
from app.ieum.onto import dictionary as dic
from app.ieum.onto import reader

SAMPLE_ROWS = 1000
CODE_MAX_ROWS = 10               # 이 행 수 이하의 작은 표(컬럼 3개 이하)는 코드표로 본다
FACT_MIN_ROWS = 1000             # 날짜가 키에 들어가고 이 행 수 이상이면 기록(fact) 테이블로 본다

_HIST = re.compile(r"(^|_)(HIST|HST|LOG|AUDIT|BAK|BKUP|TMP|TEMP|ARCH)(_|$)")
_LOB = {"CLOB", "NCLOB", "BLOB", "LONG", "LONG RAW", "RAW", "TEXT", "LONGTEXT", "MEDIUMTEXT", "NTEXT", "IMAGE", "BYTEA", "XML", "JSON", "JSONB", "VARBINARY", "BINARY", "LONGBLOB"}
_TIME = {"DATE", "TIMESTAMP", "DATETIME", "DATETIME2", "SMALLDATETIME", "TIMESTAMPTZ", "TIMESTAMP WITH TIME ZONE", "TIMESTAMP WITHOUT TIME ZONE", "TIMESTAMP WITH LOCAL TIME ZONE"}
_INT = {"INTEGER", "INT", "BIGINT", "SMALLINT", "TINYINT", "SERIAL", "BIGSERIAL", "MEDIUMINT"}
_DEC = {"NUMBER", "NUMERIC", "DECIMAL", "FLOAT", "DOUBLE", "REAL", "DOUBLE PRECISION", "MONEY", "SMALLMONEY", "BINARY_DOUBLE", "BINARY_FLOAT"}
_SOFT = {"DEL": "삭제된 행 제외", "DELETE": "삭제된 행 제외", "DELETED": "삭제된 행 제외", "RSGNTN": "퇴직자 제외", "RETIRE": "퇴직자 제외", "RESIGN": "퇴직자 제외"}
_YN_TEXT = {"USE": ("사용", "사용 안 함")}
_TEXTY = re.compile(r"(^|_)(TITLE|RMK|REMARK|SUMRY|DESC|MEMO|CONTENT|NOTE|CMNT)(_|$)")
_SECRET = re.compile(r"(PASSWORD|PASSWD|PWD|SECRET|TOKEN)")
_AUDIT_ID = re.compile(r"(^|_)(REG|UPD|CRE|CRT|MOD|CHG|INS)_ID$")

TABLE_DESC = {            # 이름을 아는 테이블의 설명(사전). 모르면 "…에서 만든 객체입니다."
    "PO": "거래처에 품목을 주문한 발주 건입니다.", "PO_DTL": "발주 한 건에 들어 있는 품목별 수량과 단가입니다.", "VEND": "물품을 공급하는 거래처입니다.",
    "ITEM": "구매할 수 있는 품목과 기준 단가입니다.", "PR": "부서가 올린 구매요청입니다. 승인되면 발주로 이어집니다.", "BDGT": "부서별 연간 구매 예산과 사용액입니다.",
    "EMP": "인사 DB의 재직 직원입니다. 권한/인증 layer가 로그인 사용자를 이 객체와 사번으로 연결합니다.", "DEPT": "회사 조직의 부서입니다.",
    "RCV": "발주한 품목이 창고에 들어온 입고 건입니다.", "WH": "입고된 품목을 보관하는 창고입니다.",
    "SLIP": "회계 전표입니다. 발주와 연결하면 대금 지급 여부까지 답할 수 있습니다.", "ACCT_CD": "회계 계정과목 코드입니다.",
}


# ── 코드표 ─────────────────────────────────────────────────────────────────

def _cols_of(t: dict) -> List[str]:
    return [x["name"] for x in t["cols"]]


def _pick(cols: List[str], names) -> Optional[str]:
    up = {x.upper(): x for x in cols}
    return next((up[n] for n in names if n in up), None)


def common_code_cols(t: dict) -> Optional[Tuple[str, str, str]]:
    """공통코드 표(그룹 컬럼, 코드 컬럼, 이름 컬럼). 아니면 None"""
    cols = _cols_of(t)
    g, cd = _pick(cols, ("GRP_CD", "GROUP_CD", "CD_GRP", "CODE_GRP", "CMN_GRP_CD")), _pick(cols, ("CD", "CODE", "DTL_CD", "CMN_CD", "CD_ID"))
    nm = _pick(cols, ("CD_NM", "CODE_NM", "NM", "NAME", "DTL_CD_NM", "CD_NAME"))
    return (g, cd, nm) if g and cd and nm else None


def small_code_cols(t: dict, rows: Optional[int]) -> Optional[Tuple[str, str]]:
    """작은 코드표(코드 컬럼, 이름 컬럼). 키가 한 컬럼이고 컬럼 3개 이하, 행 10개 이하에 이름 컬럼이 있고, 나머지 컬럼은 정렬 번호 같은 숫자일 때.
    부서처럼 상위 코드 컬럼이 따로 있는 표는 코드표가 아니라 객체다."""
    if t["kind"] != "table" or len(t["pk"]) != 1 or len(t["cols"]) > 3 or rows is None or rows > CODE_MAX_ROWS or t["fks"]:
        return None
    nm = next((x["name"] for x in t["cols"] if x["name"].upper().endswith(("_NM", "_NAME")) or x["name"].upper() in ("NM", "NAME")), None)
    if not nm:
        return None
    rest = [x for x in t["cols"] if x["name"] not in (t["pk"][0], nm)]
    if any(dic.parse_ctype(x["type"])[0] not in (_INT | _DEC) for x in rest):
        return None
    return t["pk"][0], nm


def code_book(c: dict, schema: dict) -> dict:
    """연결의 코드값: {'groups': {그룹: {코드: 이름}}, 'tables': {테이블: {코드: 이름}}, 'absorbed': [코드표 이름]}"""
    groups: Dict[str, Dict[str, str]] = {}
    tables: Dict[str, Dict[str, str]] = {}
    absorbed: List[str] = []
    for t in schema["tables"]:
        cc = common_code_cols(t) if t["kind"] == "table" else None
        if cc:
            res = dbconn.run(c, "SELECT %s, %s, %s FROM %s" % (reader.q(c, cc[0]), reader.q(c, cc[1]), reader.q(c, cc[2]), reader.qualified(c, t["name"])))
            for g, cd, nm in res.rows:
                groups.setdefault(str(g), {})[str(cd)] = "" if nm is None else str(nm)
            absorbed.append(t["name"])
            continue
        sc = small_code_cols(t, t.get("rows"))
        if sc:
            res = dbconn.run(c, "SELECT %s, %s FROM %s" % (reader.q(c, sc[0]), reader.q(c, sc[1]), reader.qualified(c, t["name"])))
            tables[t["name"]] = {str(cd): ("" if nm is None else str(nm)) for cd, nm in res.rows}
            absorbed.append(t["name"])
    return {"groups": groups, "tables": tables, "absorbed": absorbed}


# ── 테이블 역할 ────────────────────────────────────────────────────────────

def _is_time_col(col: dict) -> bool:
    n, _, _ = dic.parse_ctype(col["type"])
    return n in _TIME or bool(re.search(r"(YMD|_DT|_DATE|_DD)$", col["name"].upper()))


def classify(t: dict, absorbed: List[str]) -> Tuple[str, str]:
    """(역할, 이유). 이유는 객체로 제안하지 않을 때 화면에 보인다."""
    name = t["name"]
    if t["kind"] == "view" and not t["pk"]:
        return "nokey", "기본키를 알 수 없는 뷰라 객체로 만들 수 없어요. 뷰 정의에서 키를 찾지 못했습니다"
    if _HIST.search(name.upper()):
        return "history", "이력 테이블이라 객체로 만들지 않기를 권장해요"
    if name in absorbed:
        return "code", "코드성 테이블은 이미 공통코드로 흡수했어요"
    pk = [x for x in t["cols"] if x["name"] in t["pk"]]
    if t["kind"] == "table" and any(_is_time_col(x) for x in pk) and (t.get("rows") or 0) >= FACT_MIN_ROWS:
        return "fact", "일별 기록 테이블이라 마트로 집계한 뒤 객체로 지정하기를 권장해요"
    if t["kind"] == "table" and t["fks"] and any(set(f["cols"]) <= set(t["pk"]) and set(f["cols"]) != set(t["pk"]) for f in t["fks"]):
        return "detail", "하위 테이블이에요"
    return "entity", ""


def parent_of(t: dict) -> Optional[str]:
    """하위(상세) 테이블의 부모 테이블 이름"""
    for f in t["fks"]:
        if set(f["cols"]) <= set(t["pk"]) and set(f["cols"]) != set(t["pk"]):
            return f["ref"]
    return None


# ── 컬럼 → 속성 ────────────────────────────────────────────────────────────

def _soft_flag(up: str, distinct: set) -> Optional[str]:
    toks = up.split("_")
    if not (up.endswith("_YN") or up.endswith("_FLAG")):
        return None
    word = next((_SOFT[t] for t in toks if t in _SOFT), None)
    if word and distinct <= {"Y", "N"}:
        return word
    return None


def _prop_type(col: dict, up: str, vals: List) -> Tuple[str, str]:
    """(속성 타입, 날짜 형식)"""
    n, p, s = dic.parse_ctype(col["type"])
    if n in _TIME:
        return "timestamp", ""
    if n in ("CHAR", "VARCHAR", "VARCHAR2", "NVARCHAR", "NVARCHAR2", "NCHAR") and (p == 8 or (p is None and vals and len(str(vals[0])) == 8)):
        nb = [v for v in vals if v not in (None, "")]
        if up.endswith(("YMD", "_DATE", "_DD")) or (nb and len(nb) >= 3 and all(dic.is_date8(v) for v in nb)):
            return "date", "YYYYMMDD"
    toks = set(up.split("_"))
    nb = [v for v in vals if v not in (None, "")]
    if p == 4 and n in ("CHAR", "VARCHAR", "VARCHAR2", "NVARCHAR") and (up == "YYYY" or up.endswith("_YYYY") or up in ("YEAR", "FISCAL_YEAR")) and nb and all(str(v).isdigit() for v in nb):
        return "integer", ""
    if n in _INT:
        return "integer", ""
    if n in _DEC:
        if toks & {"CNT", "QTY", "SEQ"} and s in (None, 0):
            return "integer", ""
        if toks & {"AMT", "PRC", "RATE"}:
            return "decimal", ""
        if s not in (None, 0):
            return "decimal", ""
        if p is not None and p <= 9:
            return "integer", ""
        return "decimal", ""
    return "string", ""


def _yn_codes(up: str) -> Dict[str, str]:
    pos = next((_YN_TEXT[t] for t in up.split("_") if t in _YN_TEXT), ("예", "아니오"))
    return {"Y": pos[0], "N": pos[1]}


def profile_props(c: dict, t: dict, rows: List[dict], book: dict, pii: bool = True) -> Tuple[List[dict], Optional[dict]]:
    """표본 행으로 속성 목록과 객체 필터를 만든다."""
    table = t["name"]
    fk_of = {col: f["ref"] for f in t["fks"] for col in f["cols"]}
    pk = t["pk"]
    props: List[dict] = []
    obj_filter: Optional[dict] = None
    for col in t["cols"]:
        name_, up = col["name"], col["name"].upper()
        vals = [r.get(name_) for r in rows]
        nb = [v for v in vals if v not in (None, "")]
        distinct = {str(v).strip() for v in nb}
        ko, en = dic.col_names(table, name_)
        ctype = col["type"] or ""
        ctn, _, _ = dic.parse_ctype(ctype)
        p = {"col": name_, "ctype": ctype, "name": ko, "api": en, "type": "string", "flags": [], "note": "", "ex": [], "mask": "", "codeGroup": "", "codes": {}, "fmt": "", "unit": ""}
        # 비공개
        if _SECRET.search(up):
            p.update(api="", flags=["hidden"], note="인증 정보라 AI에 공개하지 않음", type="")
        elif _AUDIT_ID.search(up):
            p.update(api="", flags=["hidden"], note="AI에 공개하지 않음", type="")
        elif ctn in _LOB or re.search(r"_(XML|BLOB|CLOB|JSON)$", up):
            p.update(api="", flags=["hidden"], note="값이 크고 AI에 필요 없어 제외", type="")
        else:
            soft = _soft_flag(up, distinct)
            if soft:
                p.update(api="", flags=["filter"], note="객체 필터로만 사용", type="")
                if obj_filter is None:
                    obj_filter = {"col": name_, "op": "=", "value": "N", "text": soft}
            else:
                _fill_prop(p, c, t, col, up, vals, nb, distinct, fk_of, book, pii)
        if name_ in pk and "pk" not in p["flags"]:
            p["flags"].insert(0, "pk")
        props.append(p)
    _assign_title_search(props, pk)
    _notes(props, t, pk, fk_of)
    for p in props:
        if not ({"hidden", "filter"} & set(p["flags"])):
            p["ex"] = _examples(p, [r.get(p["col"]) for r in rows])
    return props, obj_filter


def _fill_prop(p: dict, c: dict, t: dict, col: dict, up: str, vals: List, nb: List, distinct: set, fk_of: Dict[str, str], book: dict, pii: bool = True) -> None:
    name_ = col["name"]
    p["type"], p["fmt"] = _prop_type(col, up, vals)
    toks = set(up.split("_"))
    if p["type"] in ("decimal", "integer") and toks & {"AMT", "PRC"}:
        p["unit"] = "원"
    # 코드값: 공통코드 그룹, 코드표를 참조하는 외래키, Y/N 플래그
    grp = next((g for g in (name_, re.sub(r"_(CD|CODE)$", "", name_, flags=re.I), up, re.sub(r"_(CD|CODE)$", "", up)) if g in book["groups"]), None)
    ref = fk_of.get(name_)
    if grp:
        p.update(type="enum", codeGroup=grp, codes=dict(book["groups"][grp]))
        p["flags"].append("code")
    elif ref and ref in book["tables"]:
        p.update(type="enum", codeGroup=ref, codes=dict(book["tables"][ref]))
        p["flags"].append("code")
    elif up.endswith(("_YN", "_FLAG")) and distinct and distinct <= {"Y", "N"}:
        p.update(type="enum", codes=_yn_codes(up))
        p["flags"].append("code")
    # 링크 키(외래키)
    if name_ in fk_of and "code" not in p["flags"]:
        p["flags"].append("link")
    # 마스킹, 개인정보
    mk = (dic.mask_name_kind(name_) or dic.mask_value_kind([str(v) for v in nb])) if pii else None
    if mk and p["type"] in ("string",):
        p["mask"] = mk[0]
        p["flags"].append("mask")
        if mk[1]:
            p["flags"].append("pii")


def _assign_title_search(props: List[dict], pk: List[str]) -> None:
    visible = [p for p in props if not ({"hidden", "filter"} & set(p["flags"]))]
    title = next((p for p in visible if p["col"].upper().endswith(("_NM", "_NAME")) and "link" not in p["flags"] and p["col"] not in pk), None)
    if title is None and len(pk) == 1:                        # 복합 키는 제목으로 쓰기 어색해 두지 않는다
        title = next((p for p in visible if p["col"] == pk[0]), None)
    if title is not None:
        title["flags"].append("title")
        if "search" not in title["flags"]:
            title["flags"].append("search")
    for p in visible:
        if p is not title and p["type"] == "string" and _TEXTY.search(p["col"].upper()) and "search" not in p["flags"]:
            p["flags"].append("search")
    order = {"pk": 0, "title": 1, "link": 2, "search": 3, "mask": 4, "pii": 5, "code": 6, "hidden": 7, "filter": 8, "perm": 9}
    for p in props:
        p["flags"] = sorted(set(p["flags"]), key=lambda f: order.get(f, 20))


def _notes(props: List[dict], t: dict, pk: List[str], fk_of: Dict[str, str]) -> None:
    for p in props:
        f = set(p["flags"])
        if p["note"]:
            continue
        parts: List[str] = []
        if "pk" in f and len(pk) > 1:
            parts.append("복합 기본키")
        if "link" in f:
            parts.append("%s 링크 키" % dic.table_names(fk_of[p["col"]])[0] if p["col"] in fk_of else "링크 키")
        if p["fmt"] == "YYYYMMDD":
            parts.append("YYYYMMDD를 날짜로")
        if "code" in f:
            if p["codeGroup"] and p["codeGroup"] in (p["col"], re.sub(r"_(CD|CODE)$", "", p["col"], flags=re.I)):
                parts.append("공통코드 %s" % p["codeGroup"])
            elif p["codeGroup"]:
                parts.append("코드표 %s" % p["codeGroup"])
            else:
                parts.append(", ".join("%s %s" % kv for kv in p["codes"].items()))
        if p["unit"] == "원":
            parts.append("원 단위")
        if "pii" in f and p["mask"]:
            parts.append("개인정보, %s" % dic.MASK_KINDS.get(p["mask"], "일부를 가림"))
        elif "mask" in f and p["mask"]:
            parts.append(dic.MASK_KINDS.get(p["mask"], "일부를 가림"))
        if "search" in f and "title" not in f and p["type"] == "string" and _TEXTY.search(p["col"].upper()):
            parts.append("전문 검색 대상")
        p["note"] = ", ".join(parts)


def format_value(p: dict, v) -> str:
    """속성 하나의 값을 화면에 보일 문자열로: 코드는 이름으로, 날짜는 YYYY-MM-DD 로, 마스킹 대상은 가려서"""
    if v is None:
        return ""
    if p["type"] == "enum":
        return p["codes"].get(str(v).strip(), str(v))
    if p["type"] == "date":
        return dic.fmt_date8(v)
    if p["type"] == "timestamp":
        return dic.fmt_ts(v)
    if p["type"] in ("decimal", "integer"):
        return dic.fmt_num(v)
    if p.get("mask"):
        return str(dic.mask_value(p["mask"], v))
    s = str(v)
    return s if len(s) <= 40 else s[:39] + "…"


def _examples(p: dict, vals: List, n: int = 3) -> List[str]:
    out: List[str] = []
    for v in vals:
        if v in (None, ""):
            continue
        s = format_value(p, v)
        if s not in out:
            out.append(s)
        if len(out) >= n:
            break
    return out


# ── 객체 정의 ──────────────────────────────────────────────────────────────

def filter_sql(c: dict, flt: Optional[dict], alias: str = "") -> str:
    """객체 필터의 SQL 조건. 없으면 빈 문자열"""
    if not flt:
        return ""
    col = reader.ident(flt["col"])
    return "%s%s %s '%s'" % (alias + "." if alias else "", col, flt.get("op", "="), str(flt["value"]).replace("'", "''"))


def filter_text(flt: Optional[dict]) -> str:
    return "%s %s '%s' (%s)" % (flt["col"], flt.get("op", "="), flt["value"], flt["text"]) if flt else ""


def object_rows(c: dict, tname: str, flt: Optional[dict]) -> Optional[int]:
    return reader.row_count(c, tname, filter_sql(c, flt))


def profile_object(c: dict, t: dict, book: dict, taken_api: Optional[set] = None, rows: Optional[List[dict]] = None, pii: bool = True) -> dict:
    """테이블(또는 뷰) 하나를 객체 정의 초안으로 만든다. 상태는 검토 필요(review)다. rows 는 미리 읽은 표본이고, 없으면 여기서 읽는다."""
    if rows is None:
        rows = reader.sample_rows(c, t["name"], None, SAMPLE_ROWS).dicts()
    props, flt = profile_props(c, t, rows, book, pii)
    ko, en = dic.table_names(t["name"])
    taken = taken_api or set()
    api, n = en, 2
    while api in taken:
        api, n = "%s%d" % (en, n), n + 1
    core = re.sub(r"^(TB|T|V)_", "", t["name"].upper())
    desc = TABLE_DESC.get(core) or TABLE_DESC.get(re.sub(r"_(MST|INFO|VW)$", "", core)) or "%s의 %s 테이블에서 만든 객체입니다." % (c["name"], t["name"])
    return {
        "id": "%s.%s" % (c["id"], api), "conn": c["id"], "name": ko, "api": api, "desc": desc, "table": "%s.%s" % (c["alias"], t["name"]), "tname": t["name"],
        "kind": t["kind"], "mart": None, "rows": object_rows(c, t["name"], flt), "status": "review", "aiOff": False, "pos": None, "filter": flt, "props": props,
        "pk": list(t["pk"]), "perm": None, "actions": [], "reviewNote": "", "mergeNote": "", "alt": [], "view": t.get("view") if t["kind"] == "view" else None,
    }
