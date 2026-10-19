"""액션: 객체에 대한 쓰기. 이음은 DB 에 직접 쓰지 않고, 원본 시스템의 API(변환 스튜디오에 등록한 도구)를 불러 쓴다.

액션 정의(객체의 actions 항목):
  name, api       이름, 영문 이름(도구 이름이 된다)
  tool            실행할 변환 스튜디오 도구 id(원본 시스템 API 하나)
  via, viaSrc     화면에 보이는 "POST /poApprove.do", 원본 시스템 이름
  inputs          [{name, label, type(string|integer|date|object:<API 이름>), required}] — 객체 하나를 가리키는 키는 따로 받는다
  bind            도구 인자: {원본 파라미터: 식}. 식: $key(기본키) $obj.<속성> $in.<입력> $in.<입력>.<속성> $user.<emp|dept|name>, 그 밖은 문자열 그대로
  rules           제출 조건 [{text, check}]. 하나라도 어긋나면 실행하지 않는다. check 의 on:
                    obj     대상 객체의 지금 값(prop, eq 또는 in)         input  입력 객체의 값(input, prop, eq 또는 in)
                    who     실행 사용자(dept, minRank, emp)                budget 실행자 부서의 올해 예산 잔액이 수량 × 단가 이상(qty, item, priceProp)
  effect          화면에 보이는 한 줄 설명
  create          True 면 객체를 새로 만드는 액션(대상 객체가 아직 없다). resultKey 는 응답에서 새 기본키를 읽는 키
  confirm         사용자 확인 카드: {title("{title}" 은 대상 제목), fields: [{label, prop|via(+prop|count)|input(+prop), unit, suffix}]}
쓰기 도구는 사용자 확인(exec=confirm)이 기본이다. 확인 없이 실행하는 길은 여기에 없다 — execute 는 confirmed=True 를 받을 때만 쓴다.
조건 판정은 객체의 지금 값을 다시 읽어서(관리자 읽기) 하므로, 사용자가 볼 수 없는 속성(발주 금액 등) 때문에 엉뚱하게 막히지 않는다.
"""
import re
from typing import Any, Dict, Optional, Tuple

from app.ieum.gateway import runner
from app.ieum.onto import dictionary as dic
from app.ieum.onto import perm, query, store
from app.ieum.repositories import sources as src_repo
from app.ieum.repositories import studio as tool_repo


class ActionError(ValueError):
    """사용자에게 그대로 보일 오류"""


def find(ctx: query.Ctx, oid: str, api: str) -> Tuple[dict, dict]:
    obj = ctx.obj(oid)
    a = next((x for x in obj.get("actions", []) if x["api"] == api), None)
    if a is None:
        raise ActionError("%s 에는 %s 액션이 없어요. 있는 액션: %s" % (obj["name"], api, ", ".join(x["api"] for x in obj.get("actions", [])) or "없음"))
    return obj, a


def source_of(action: dict) -> Optional[dict]:
    sid, tool = tool_repo.find_tool(action.get("tool", ""))
    return src_repo.get_source(sid) if tool else None


def describe(obj: dict, action: dict) -> dict:
    """화면용: 파라미터 요약(첫 줄은 이 객체), 제출 조건, 원본 시스템 연결 여부"""
    params = [[obj["name"], "%s 객체" % obj["api"], "필수"]]
    for i in action.get("inputs", []):
        t = i["type"]
        label = "%s 객체" % t.split(":", 1)[1] if t.startswith("object:") else {"string": "문자열", "integer": "정수", "date": "날짜"}.get(t, t)
        params.append([i["label"], label, "필수" if i.get("required") else "선택"])
    src = source_of(action)
    return {"name": action["name"], "api": action["api"], "via": action["via"], "viaSrc": src["name"] if src else action.get("viaSrc", ""), "params": params,
            "rules": [r["text"] for r in action.get("rules", [])], "effect": action.get("effect", ""), "connected": src is not None, "mode": "write"}


# ── 입력, 조건 판정 ────────────────────────────────────────────────────────

def _inputs(ctx_admin: query.Ctx, action: dict, raw: Optional[dict]) -> Tuple[Dict[str, Any], Dict[str, dict]]:
    """입력 값을 검사하고 바꾼다. (값, 입력 객체의 읽은 행)"""
    raw = raw or {}
    vals: Dict[str, Any] = {}
    rows: Dict[str, dict] = {}
    for i in action.get("inputs", []):
        v = raw.get(i["name"])
        if v in (None, ""):
            if i.get("required"):
                raise ActionError("%s 값이 필요해요." % i["label"])
            continue
        t = i["type"]
        if t == "integer":
            try:
                n = int(float(str(v).replace(",", "")))
            except ValueError:
                raise ActionError("%s 는 숫자여야 해요." % i["label"])
            if n < 1:
                raise ActionError("%s 는 1 이상이어야 해요." % i["label"])
            vals[i["name"]] = n
        elif t == "date":
            m = re.match(r"^(\d{4})-?(\d{2})-?(\d{2})$", str(v))
            if not m:
                raise ActionError("%s 는 2026-10-10 같은 날짜여야 해요." % i["label"])
            vals[i["name"]] = "".join(m.groups())
        elif t.startswith("object:"):
            target = t.split(":", 1)[1]
            o = ctx_admin.find_object(target)
            g = query.get(ctx_admin, o["id"], str(v))
            if g["row"] is None:
                raise ActionError("%s 를 찾을 수 없어요: %s" % (o["name"], v))
            vals[i["name"]] = str(v)
            rows[i["name"]] = g["row"]
        else:
            vals[i["name"]] = str(v)
    return vals, rows


def _cmp(value: Any, chk: dict) -> bool:
    if "eq" in chk:
        return str(value) == str(chk["eq"])
    if "in" in chk:
        return str(value) in [str(x) for x in chk["in"]]
    return bool(value)


def _who_text(user: Optional[dict]) -> str:
    return "%s, %s %s" % (user["name"], user.get("deptName") or user.get("dept"), user.get("rank")) if user else "확인되지 않은 사용자"


def _run_check(chk: dict, ctx_admin: query.Ctx, row: dict, in_rows: Dict[str, dict], in_vals: Dict[str, Any], user: Optional[dict]) -> Tuple[bool, str]:
    on = chk.get("on")
    if on == "who":
        conds = chk.get("any") or [{k: v for k, v in chk.items() if k != "on"}]
        ok = False
        for c in conds:
            c = dict(c)
            prop = c.pop("empIsProp", None)
            base = perm._cond_ok(c, user) if user is not None else False
            if prop:                                              # 실행자 본인이 대상 객체의 이 속성(사번)과 같은가
                mine = user is not None and str(row.get(prop)) == str(user.get("emp"))
                ok = ok or (mine and base)
            else:
                ok = ok or base
        return ok, _who_text(user)
    if on == "obj":
        v = row.get(chk["prop"])
        return _cmp(v, chk), "지금 값 %s" % (v if v is not None else "없음")
    if on == "input":
        r = in_rows.get(chk["input"])
        if r is None:
            return False, "입력이 없어요"
        v = r.get(chk["prop"])
        return _cmp(v, chk), "지금 값 %s" % (v if v is not None else "없음")
    if on == "budget":
        return _budget(chk, ctx_admin, in_rows, in_vals, user)
    return False, "알 수 없는 조건이에요"


def _budget(chk: dict, ctx_admin: query.Ctx, in_rows: Dict[str, dict], in_vals: Dict[str, Any], user: Optional[dict]) -> Tuple[bool, str]:
    if user is None or not user.get("dept"):
        return False, "실행자의 부서를 알 수 없어요"
    price = (in_rows.get(chk["item"]) or {}).get(chk["priceProp"])
    qty = in_vals.get(chk["qty"])
    if price is None or qty is None:
        return False, "수량이나 단가를 알 수 없어요"
    try:
        bobj = ctx_admin.find_object("Budget")
    except query.OntoQueryError:
        return False, "예산 객체가 공개되어 있지 않아요"
    year = store.as_of()[:4]
    r = query.search(ctx_admin, bobj["id"], {"departmentCode": user["dept"], "fiscalYear": year}, 1)
    if not r["rows"]:
        return False, "%s년 %s 예산이 없어요" % (year, user.get("deptName") or user["dept"])
    remain = (r["rows"][0].get("budget") or 0) - (r["rows"][0].get("used") or 0)
    amount = int(price) * int(qty)
    return remain >= amount, "예산 잔액 %s원, 발주 금액 %s원" % (dic.fmt_num(remain), dic.fmt_num(amount))


def _value(expr: Any, key: str, row: dict, in_vals: Dict[str, Any], in_rows: Dict[str, dict], user: Optional[dict]) -> Any:
    if not isinstance(expr, str) or not expr.startswith("$"):
        return expr
    if expr == "$key":
        return key
    parts = expr[1:].split(".")
    if parts[0] == "obj":
        return row.get(parts[1])
    if parts[0] == "in":
        if len(parts) == 2:
            return in_vals.get(parts[1])
        return (in_rows.get(parts[1]) or {}).get(parts[2])
    if parts[0] == "user":
        return (user or {}).get(parts[1])
    return None


def evaluate(ctx_user: query.Ctx, ctx_admin: query.Ctx, oid: str, api: str, key: str, inputs: Optional[dict], user: Optional[dict]) -> dict:
    """실행하지 않고 판정한다: 제출 조건 통과 여부와 사용자 확인 카드. {ok, rules, row, title, confirm, args, connected, action, object}"""
    obj, action = find(ctx_admin, oid, api)
    src = source_of(action)
    create = bool(action.get("create"))
    if create:
        row, key = {}, ""
    else:
        g = query.get(ctx_admin, oid, key)
        if g["row"] is None:
            raise ActionError("%s 에서 %s 을(를) 찾을 수 없어요." % (obj["name"], key))
        row = g["row"]
    in_vals, in_rows = _inputs(ctx_admin, action, inputs)
    rules = []
    for r in action.get("rules", []):
        ok, note = _run_check(r["check"], ctx_admin, row, in_rows, in_vals, user)
        rules.append({"text": r["text"], "ok": ok, "note": note})
    title_p = next((p for p in query.exposed(obj) if "title" in p["flags"]), None)
    title = ("새 %s" % obj["name"]) if create else str(row.get(title_p["api"]) if title_p and row.get(title_p["api"]) else key)
    args = {}
    for k, expr in (action.get("bind") or {}).items():
        v = _value(expr, key, row, in_vals, in_rows, user)
        if v is not None:
            args[k] = v
    passed = all(r["ok"] for r in rules)
    return {"ok": passed and src is not None, "rules": rules, "connected": src is not None, "row": row, "title": title, "args": args,
            "confirm": _confirm(ctx_user, obj, action, key, title, in_vals, in_rows, create) if passed else None, "action": describe(obj, action), "object": obj["name"]}


def _confirm(ctx_user: query.Ctx, obj: dict, action: dict, key: str, title: str, in_vals: Dict[str, Any], in_rows: Dict[str, dict], create: bool) -> dict:
    """사용자 확인 카드(제목과 확인할 값들). 값은 실행 사용자가 볼 수 있는 것만 보인다."""
    conf = action.get("confirm") or {}
    out = []
    g = {"row": {}} if create else query.get(ctx_user, obj["id"], key)
    for f in conf.get("fields", []):
        try:
            if f.get("input"):
                if f.get("prop"):
                    v = (in_rows.get(f["input"]) or {}).get(f["prop"])
                else:
                    v = in_vals.get(f["input"])
                if v is not None:
                    out.append([f["label"], "%s%s" % (dic.fmt_num(v) if isinstance(v, (int, float)) else v, f.get("unit", ""))])
            elif f.get("via"):
                tq = query.Q(ctx_user, obj).where_key(key).follow(f["via"])
                if f.get("count"):
                    out.append([f["label"], "%s%s" % (dic.fmt_num(tq.count()), f.get("suffix", ""))])
                else:
                    p = query.prop_by(tq.obj, f["prop"])
                    r = query.search(ctx_user, tq.obj["id"], None, 1, 0, None, [f["prop"]], tq)
                    v = r["rows"][0].get(p["api"]) if r["rows"] else None
                    out.append([f["label"], "" if v is None else str(v)])
            else:
                v = (g["row"] or {}).get(f["prop"])
                if v is None:
                    continue
                out.append([f["label"], "%s%s" % (dic.fmt_num(v) if isinstance(v, (int, float)) else v, f.get("unit", ""))])
        except query.OntoQueryError:
            continue
    return {"title": (conf.get("title") or "{title} 를 실행할까요?").replace("{title}", title), "fields": out}


def execute(ctx_user: query.Ctx, ctx_admin: query.Ctx, oid: str, api: str, key: str, inputs: Optional[dict], user: Optional[dict], confirmed: bool = False) -> dict:
    """제출 조건을 다시 판정하고, 사용자가 확인했으면(confirmed) 원본 시스템 API 를 불러 쓴다.
    돌려주는 값: {ok, error?, rules, trace(요청·응답), before, after, changed: [[속성, 전, 후]]}"""
    if not confirmed:
        raise ActionError("쓰기 액션은 사용자 확인 뒤에만 실행해요.")
    ev = evaluate(ctx_user, ctx_admin, oid, api, key, inputs, user)
    if not ev["connected"]:
        return {"ok": False, "error": "이 액션이 부를 원본 시스템 API 가 연결되어 있지 않아요.", "rules": ev["rules"]}
    if not all(r["ok"] for r in ev["rules"]):
        return {"ok": False, "error": "제출 조건을 만족하지 않아 실행하지 않았어요.", "rules": ev["rules"]}
    obj, action = find(ctx_admin, oid, api)
    emp = (user or {}).get("emp", "")
    res = runner.run_tool(action["tool"], ev["args"], client="onto", user=emp, ctx={"user_id": emp, "user_name": (user or {}).get("name", emp)}, bucket="onto:" + emp)
    before = ev["row"]
    if not res["ok"]:
        return {"ok": False, "error": res["error"], "rules": ev["rules"], "trace": res.get("trace"), "before": before}
    if action.get("create"):
        new_key = _dig(res.get("result"), action.get("resultKey", ""))
        after = query.get(ctx_admin, oid, str(new_key))["row"] if new_key else None
        return {"ok": True, "rules": ev["rules"], "trace": res.get("trace"), "result": res.get("result"), "before": None, "after": after, "changed": [], "created": new_key, "log": res.get("log")}
    after = query.get(ctx_admin, oid, key)["row"]
    changed = []
    for p in query.exposed(obj):
        a, b = (before or {}).get(p["api"]), (after or {}).get(p["api"])
        if a != b:
            changed.append([p["name"], a, b])
    return {"ok": True, "rules": ev["rules"], "trace": res.get("trace"), "result": res.get("result"), "before": before, "after": after, "changed": changed, "log": res.get("log")}


def _dig(data: Any, path: str) -> Any:
    for part in [x for x in path.split(".") if x]:
        if isinstance(data, dict):
            data = data.get(part)
        else:
            return None
    return data
