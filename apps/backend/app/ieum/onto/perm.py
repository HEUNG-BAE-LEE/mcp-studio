"""권한: 실행 사용자(직원)의 부서와 직급으로 객체의 행과 속성을 어디까지 보여 줄지 정한다.

사용자 확인: 권한/인증 layer(Amaranth, wehago 인증)가 로그인한 사용자를 사번으로 알려 주면, 이음이 인사 DB 의 직원 객체에서 그 사번의 부서와 직급을 읽는다.
어느 객체가 직원이고 어느 속성이 사번·부서·직급인지는 설정(settings.identity)에 있다. 인증 연동 자체는 이음 바깥의 일이라 여기서는 사번을 받는다.

규칙 모양(객체의 perm):
  rows   위에서부터 처음 맞는 규칙 하나가 적용된다. 규칙: {label, text, when, scope}
           when   조건 목록(OR). 조건: {dept: [부서 코드], minRank: 직급 순번, emp: [사번]} — 조건 안의 키는 AND. 비어 있으면 누구나
           scope  None 이면 모든 행, {col, user} 이면 `col = 사용자 속성`, {via: {table, from, to, col}, user} 이면 via 테이블을 조인해 `via.col = 사용자 속성`
  props  [{col, label, text, allow}] allow 는 조건 목록(OR). 조건에 sameRow({col, user})가 있으면 그 행의 col 이 사용자 속성과 같을 때만 보인다
  어떤 규칙에도 안 맞으면 볼 수 있는 행이 없다. perm 이 없는 객체는 행과 속성을 제한하지 않는다(마스킹 특성은 별개로 늘 적용한다).
user 속성: emp(사번), name, dept(부서 코드), deptName, rank(직급 이름), rankNo(직급 순번, 클수록 높다)
"""
from typing import Dict, List, Optional

from app.ieum.onto import conn as dbconn
from app.ieum.onto import reader, store

USER_ATTRS = ("dept", "emp", "rankNo")


class PermError(ValueError):
    """규칙이 잘못됐다."""


# ── 사용자 확인 ────────────────────────────────────────────────────────────

def rank_no(rank: str) -> int:
    ranks = store.settings().get("ranks") or []
    return ranks.index(rank) + 1 if rank in ranks else 0


def identity_config() -> Optional[dict]:
    """설정된 직원 객체 연결: {object, id, dept, rank, name}(각 값은 컬럼 이름). 없으면 None"""
    cfg = store.settings().get("identity") or {}
    return cfg if cfg.get("object") and cfg.get("id") else None


def identify(emp_no: str) -> Optional[dict]:
    """사번으로 직원을 찾는다. {emp, name, dept, deptName, rank, rankNo}. 없거나 설정이 없으면 None"""
    cfg = identity_config()
    if not cfg or not emp_no:
        return None
    obj = store.get_object(cfg["object"])
    if obj is None:
        return None
    c = dbconn.get(obj["conn"])
    if c is None:
        return None
    cols = [x for x in (cfg["id"], cfg.get("name"), cfg.get("dept"), cfg.get("rank")) if x]
    flt = ""
    if obj.get("filter"):
        from app.ieum.onto import profile
        flt = " AND " + profile.filter_sql(c, obj["filter"])
    sql = "SELECT %s FROM %s WHERE %s = :emp%s" % (", ".join(reader.q(c, x) for x in cols), reader.qualified(c, obj["tname"]), reader.q(c, cfg["id"]), flt)
    try:
        rows = dbconn.run(c, sql, {"emp": str(emp_no)}, limit=1, replica=True).dicts()
    except dbconn.ConnError:
        return None
    if not rows:
        return None
    r = rows[0]
    rank = str(r.get(cfg.get("rank"), "") or "")
    dept = str(r.get(cfg.get("dept"), "") or "")
    return {"emp": str(r[cfg["id"]]), "name": str(r.get(cfg.get("name"), "") or ""), "dept": dept, "deptName": _dept_name(obj, dept), "rank": rank, "rankNo": rank_no(rank)}


def _dept_name(emp_obj: dict, dept: str) -> str:
    """직원 객체에서 부서로 가는 링크가 있으면 그 부서 객체의 제목 컬럼으로 부서 이름을 읽는다."""
    cfg = identity_config() or {}
    for l in store.all_links():
        if l["from"] != emp_obj["id"] or not l["keys"] or l["keys"][0][0] != cfg.get("dept"):
            continue
        to = store.get_object(l["to"])
        c = dbconn.get(to["conn"]) if to else None
        title = next((p["col"] for p in (to or {}).get("props", []) if "title" in p["flags"]), None)
        if not (to and c and title):
            continue
        try:
            rows = dbconn.run(c, "SELECT %s FROM %s WHERE %s = :d" % (reader.q(c, title), reader.qualified(c, to["tname"]), reader.q(c, l["keys"][0][1])), {"d": dept}, limit=1, replica=True).rows
        except dbconn.ConnError:
            return ""
        return str(rows[0][0]) if rows else ""
    return ""


# ── 규칙 판정 ──────────────────────────────────────────────────────────────

def _cond_ok(cond: dict, user: Optional[dict]) -> bool:
    """조건 하나(행에 의존하는 sameRow 는 뺀 나머지)가 사용자에게 맞는가"""
    if user is None:
        return not cond
    if "dept" in cond and user.get("dept") not in cond["dept"]:
        return False
    if "minRank" in cond and (user.get("rankNo") or 0) < cond["minRank"]:
        return False
    if "emp" in cond and user.get("emp") not in cond["emp"]:
        return False
    return True


def _match(whens: Optional[List[dict]], user: Optional[dict]) -> bool:
    if not whens:
        return True
    return any(_cond_ok(w, user) for w in whens)


def row_policy(obj: dict, user: Optional[dict]) -> dict:
    """사용자가 볼 수 있는 행의 규칙. {mode: all|none|scope, label, text, scope}"""
    perm = obj.get("perm")
    if not perm or not perm.get("rows"):
        return {"mode": "all", "label": "", "text": "별도 규칙 없이 원본 DB 읽기 계정이 볼 수 있는 행을 모두 조회합니다.", "scope": None}
    if user is None:
        return {"mode": "none", "label": "", "text": "실행 사용자를 확인하지 못해 볼 수 있는 행이 없어요.", "scope": None}
    for r in perm["rows"]:
        if _match(r.get("when"), user):
            if not r.get("scope"):
                return {"mode": "all", "label": r["label"], "text": r["text"], "scope": None}
            return {"mode": "scope", "label": r["label"], "text": r["text"], "scope": r["scope"]}
    return {"mode": "none", "label": "", "text": "맞는 행 권한 규칙이 없어 볼 수 있는 행이 없어요.", "scope": None}


def user_value(user: dict, key: str):
    return {"dept": user.get("dept"), "emp": user.get("emp"), "rankNo": user.get("rankNo")}.get(key)


def prop_access(obj: dict, user: Optional[dict]) -> Dict[str, dict]:
    """속성 권한이 있는 속성마다 {ok: True|False|'row', why, label, row}. 'row' 면 그 행의 col 이 사용자 속성과 같을 때만 보인다(row 에 {col, user}).
    규칙이 없는 속성은 목록에 없다(제한 없음)."""
    out: Dict[str, dict] = {}
    for r in (obj.get("perm") or {}).get("props", []):
        ok: object = False
        row = None
        for a in r.get("allow") or []:
            base = {k: v for k, v in a.items() if k != "sameRow"}
            if not _cond_ok(base, user):
                continue
            if "sameRow" in a:
                if user is not None and ok is not True:
                    ok, row = "row", a["sameRow"]
            else:
                ok, row = True, None
                break
        out[r["col"]] = {"ok": ok, "why": r["text"], "label": r["label"], "row": row}
    return out


def simulate(obj: dict, user: Optional[dict], count_fn) -> dict:
    """다른 사용자로 보기: 볼 수 있는 행 수와 속성별 보임 여부. count_fn(user) 은 그 사용자의 행 수를 센다."""
    pol = row_policy(obj, user)
    acc = prop_access(obj, user)
    return {"policy": pol, "rows": count_fn(user), "props": {col: ("row" if a["ok"] == "row" else bool(a["ok"])) for col, a in acc.items()}}


# ── 규칙 검증(API 로 고칠 때) ───────────────────────────────────────────────

def validate(obj: dict, perm: Optional[dict]) -> Optional[dict]:
    """perm 정의를 검사해 정리한 값을 돌려준다. None 이면 규칙 없음"""
    if not perm:
        return None
    cols = {p["col"] for p in obj["props"]}
    out = {"rows": [], "props": []}
    for r in perm.get("rows") or []:
        if not r.get("label") or not r.get("text"):
            raise PermError("행 권한 규칙에는 이름과 설명이 있어야 해요.")
        sc = r.get("scope")
        if sc:
            if sc.get("user") not in USER_ATTRS:
                raise PermError("행 권한 범위의 사용자 속성은 %s 중 하나여야 해요." % ", ".join(USER_ATTRS))
            if sc.get("via"):
                v = sc["via"]
                if not all(v.get(k) for k in ("table", "from", "to", "col")) or v["from"] not in cols:
                    raise PermError("행 권한의 조인(via)은 table, from, to, col 이 필요하고 from 은 이 객체의 컬럼이어야 해요.")
            elif sc.get("col") not in cols:
                raise PermError("행 권한 범위의 컬럼을 찾을 수 없어요: %s" % sc.get("col"))
        out["rows"].append({"label": r["label"], "text": r["text"], "when": r.get("when") or [], "scope": sc or None})
    for r in perm.get("props") or []:
        if r.get("col") not in cols:
            raise PermError("속성 권한의 컬럼을 찾을 수 없어요: %s" % r.get("col"))
        out["props"].append({"col": r["col"], "label": r.get("label") or r["col"], "text": r.get("text") or "", "allow": r.get("allow") or []})
    return out
