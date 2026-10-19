"""링크: 이름 짓기, 조인 키 문자열, 링크 키 표시. 링크는 객체 사이의 관계이고 항상 키 컬럼 쌍으로 정의된다.

링크 하나는 두 방향 이름을 가진다.
  api/name    from 객체에서 to 객체로 가는 이름    예) 발주 → 거래처:  vendor / 거래처
  rapi/rev    to 객체에서 from 객체로 되돌아오는 이름  예) 거래처 → 발주:  purchaseOrders / 발주
역할이 있는 사번 컬럼(CHRG_EMP_NO, REQ_EMP_NO, INSP_EMP_NO)은 담당자·요청자·검수자처럼 역할 이름을 쓴다.
"""
import re
from typing import Dict, List, Optional

from app.ieum.onto import dictionary as dic
from app.ieum.onto import store

LINK_KINDS = {"fk": "FK 제약", "infer": "추론", "view": "뷰 정의의 조인 조건", "cross": "DB 간 링크", "mart": "마트 컬럼", "manual": "직접 만듦"}


def _lower_first(s: str) -> str:
    return s[:1].lower() + s[1:]


def _prop(obj: dict, col: str) -> Optional[dict]:
    return next((p for p in obj["props"] if p["col"].upper() == col.upper()), None)


def key_text(frm: dict, to: dict, keys: List[List[str]]) -> str:
    return " AND ".join("%s.%s = %s.%s" % (frm["tname"], a, to["tname"], b) for a, b in keys)


def labels(frm: dict, to: dict, keys: List[List[str]], taken_api: Optional[set] = None) -> Dict[str, str]:
    """링크의 api, rapi, name, rev. taken_api 는 from 객체에서 이미 쓰는 정방향 이름이다."""
    col = keys[0][0]
    prop = _prop(frm, col)
    role = dic.role_of(col)
    taken = taken_api or set()
    if role:
        name, api = role[0], role[1]
        rapi = role[2] + dic.plural(frm["api"])[:1].upper() + dic.plural(frm["api"])[1:]
        rev = role[3] + frm["name"]
    else:
        stripped = re.sub(r"\s*(코드|번호|사번|ID)$", "", prop["name"]).strip() if prop else ""
        stripped = stripped or to["name"]
        name = to["name"] if (to["name"].startswith(stripped) or stripped.startswith(to["name"])) else stripped    # "계정 코드" -> 대상 이름 "계정과목", "거래처 사업자번호" -> "거래처", "요청 부서 코드" -> "요청 부서"
        api = _lower_first(to["api"])
        rapi = dic.plural(frm["api"])
        rev = frm["name"]
    base_api, n = api, 2
    while api in taken:
        api, n = "%s%d" % (base_api, n), n + 1
    return {"api": api, "rapi": rapi, "name": name, "rev": rev}


def card_of(frm: dict, keys: List[List[str]]) -> str:
    pk = set(c.upper() for c in frm.get("pk") or [])
    return "1:1" if pk and set(a.upper() for a, _ in keys) == pk else "N:1"


def new_link(frm: dict, to: dict, keys: List[List[str]], kind: str, basis: str, *, rate: Optional[float] = None, status: str = "review", link_id: str = "",
             taken_api: Optional[set] = None) -> dict:
    cross = frm["conn"] != to["conn"]
    lab = labels(frm, to, keys, taken_api)
    return {"id": link_id, "from": frm["id"], "to": to["id"], "api": lab["api"], "rapi": lab["rapi"], "name": lab["name"], "rev": lab["rev"], "card": card_of(frm, keys),
            "keys": [list(k) for k in keys], "keyText": key_text(frm, to, keys), "basis": basis, "kind": "cross" if cross and kind in ("infer", "fk") else kind,
            "cross": cross, "status": status, "rate": rate}


def mark_keys(frm: dict, to: dict, keys: List[List[str]]) -> None:
    """링크의 from 쪽 키 컬럼에 링크 키 특성과 설명을 단다."""
    for a, _ in keys:
        p = _prop(frm, a)
        if p is None or {"hidden", "filter"} & set(p["flags"]):
            continue
        if "link" not in p["flags"] and "code" not in p["flags"]:
            p["flags"].append("link")
            order = ["pk", "title", "link", "search", "mask", "pii", "code", "hidden", "filter", "perm"]
            p["flags"] = sorted(set(p["flags"]), key=lambda f: order.index(f) if f in order else 20)
        tag = "%s 링크 키" % to["name"] + (" (%s)" % store_conn_name(to["conn"]) if frm["conn"] != to["conn"] else "")
        if tag not in p["note"]:
            p["note"] = (p["note"] + ", " if p["note"] else "") + tag


def store_conn_name(conn_id: str) -> str:
    c = next((x for x in store.conns.load() if x["id"] == conn_id), None)
    return c["name"] if c else conn_id


def basis_text(kind: str, rate: Optional[float] = None, blank: float = 0.0, detail: str = "") -> str:
    """링크 근거 문장(화면에 그대로 보인다). rate 는 0~1, blank 는 키 값이 비어 있는 행의 비율"""
    if kind == "fk":
        return "FK 제약"
    if kind == "view":
        return "뷰 정의의 조인 조건"
    pct = ("%.1f" % (rate * 100)).rstrip("0").rstrip(".") + "%" if rate is not None else ""
    tail = "값 일치율 %s" % pct + (" (비어 있는 값 %s)" % (("%.1f" % (blank * 100)).rstrip("0").rstrip(".") + "%") if blank else "")
    if kind == "cross":
        return "DB 간 링크: %s%s" % (detail + ", " if detail else "", tail)
    return "추론: %s%s" % (detail + ", " if detail else "", tail)
