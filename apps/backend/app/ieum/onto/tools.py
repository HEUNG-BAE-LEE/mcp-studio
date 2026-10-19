"""온톨로지 객체에서 만들어지는 AI(MCP) 도구: 정의(이름, 설명, 입력 스키마)와 실행.

객체 하나(`PurchaseOrder`)마다
  search_purchase_orders      조건 검색(제목·검색 속성은 부분 일치, 코드값은 이름, 날짜는 From/To, 숫자는 Min/Max)
  get_purchase_order          기본키로 한 건 조회
  aggregate_purchase_orders   건수·합계·평균·최솟값·최댓값(+ 묶기)
  purchase_order__vendor      링크 따라가기: 이 객체의 기본키를 주면 이어진 객체를 돌려준다(링크마다 하나, 반대 방향 포함)
  approve_purchase_order      액션(쓰기). 제출 조건을 판정하고, 확인(confirm=true)을 받아야 실행한다
도구 이름에 점(.)을 쓰지 않고 `__` 로 잇는다: 점이 든 이름은 MCP 클라이언트(OpenAI 함수 이름 규칙 등)가 거절한다.
실행은 query.py 와 actions.py 를 그대로 쓰고, 실행 사용자(runAs 사번)의 행 권한·속성 권한을 적용한다.
"""
import re
from typing import Any, Dict, List, Optional

from app.ieum.onto import actions, perm, query
from app.ieum.onto import dictionary as dic

MAX_NUMERIC_FILTERS = 3
TOOL_PREFIX_RE = re.compile(r"^[a-z][a-z0-9_]{0,60}$")


def _tool_name(*parts: str) -> str:
    return "__".join(parts) if len(parts) > 1 else parts[0]


def _filters(obj: dict) -> Dict[str, dict]:
    """검색·집계 도구가 같이 쓰는 조건 입력"""
    props: Dict[str, dict] = {}
    nums = 0
    for p in query.exposed(obj):
        a = p["api"]
        if p["type"] == "enum" and p["codes"]:
            props[a] = {"type": "string", "description": p["name"], "enum": list(dict.fromkeys(p["codes"].values()))}
        elif p["type"] == "string" and ("search" in p["flags"] or "title" in p["flags"]) and not p.get("mask"):
            props[a] = {"type": "string", "description": "%s (부분 일치)" % p["name"]}
        elif p["type"] == "date":
            props[a + "From"] = {"type": "string", "format": "date", "description": "%s 시작" % p["name"]}
            props[a + "To"] = {"type": "string", "format": "date", "description": "%s 끝" % p["name"]}
        elif p["type"] in ("decimal", "integer") and "pk" not in p["flags"] and nums < MAX_NUMERIC_FILTERS:
            nums += 1
            props[a + "Min"] = {"type": "number", "description": "%s 이상" % p["name"]}
            props[a + "Max"] = {"type": "number", "description": "%s 이하" % p["name"]}
    return props


def where_from_args(obj: dict, args: Dict[str, Any]) -> Dict[str, Any]:
    """도구 인자를 query.Q.where 의 조건으로 바꾼다."""
    where: Dict[str, Any] = {}
    api = {p["api"]: p for p in query.exposed(obj)}
    for k, v in args.items():
        if v in (None, ""):
            continue
        if k in ("limit", "offset", "metrics", "groupBy", "key", "confirm", "inputs") or k not in _filters(obj):
            if k in ("limit", "offset", "metrics", "groupBy", "key", "confirm", "inputs"):
                continue
            raise query.OntoQueryError("알 수 없는 조건이에요: %s" % k)
        base = re.sub(r"(From|To|Min|Max)$", "", k)
        if base in api and (k.endswith("From") or k.endswith("To") or k.endswith("Min") or k.endswith("Max")) and k != base:
            op = {"From": "from", "To": "to", "Min": "gte", "Max": "lte"}[re.search(r"(From|To|Min|Max)$", k).group(1)]
            where.setdefault(base, {})[op] = v
        else:
            p = api[k]
            where[k] = {"contains": v} if p["type"] == "string" else v
    return where


def _pk_schema(obj: dict) -> Dict[str, dict]:
    props = {}
    for p in obj["props"]:
        if p["col"] in (obj.get("pk") or []) and p["api"]:
            props[p["api"]] = {"type": "string", "description": "%s (기본키)" % p["name"]}
    return props


def definitions(ctx: query.Ctx, obj: dict) -> List[dict]:
    """객체 하나의 도구 정의 목록. 각 항목: name, title, mode(r|w), kind, desc, inputSchema, annotations 와 실행에 필요한 link/action"""
    sn = dic.snake_of(obj["api"])
    plural = dic.snake_of(dic.plural(obj["api"]))
    pk = _pk_schema(obj)
    filters = _filters(obj)
    perm_note = " 실행 사용자의 행 권한과 속성 권한이 자동으로 적용됩니다." if obj.get("perm") else ""
    out: List[dict] = []
    search_props = dict(filters)
    search_props["limit"] = {"type": "integer", "default": query.DEFAULT_LIMIT, "maximum": query.MAX_LIMIT}
    search_props["offset"] = {"type": "integer", "default": 0}
    out.append({"name": "search_" + plural, "title": "%s 검색" % obj["name"], "mode": "r", "kind": "search", "desc": "%s 조건으로 %s을(를) 찾습니다.%s" % (obj["desc"] and obj["desc"].rstrip("."), obj["name"], perm_note),
                "inputSchema": {"type": "object", "properties": search_props}, "annotations": {"readOnlyHint": True}})
    out.append({"name": "get_" + sn, "title": "%s 한 건 조회" % obj["name"], "mode": "r", "kind": "get", "desc": "기본키로 %s 한 건을 읽습니다.%s" % (obj["name"], perm_note),
                "inputSchema": {"type": "object", "properties": pk, "required": list(pk)}, "annotations": {"readOnlyHint": True}})
    nums = [p["api"] for p in query.exposed(obj) if p["type"] in ("decimal", "integer") and "pk" not in p["flags"]]
    groups = [p["api"] for p in query.exposed(obj) if p["type"] in ("enum", "date", "string") and not p.get("mask") and "title" not in p["flags"] and "search" not in p["flags"]] or []
    agg_props = dict(filters)
    agg_props["metrics"] = {"type": "array", "description": "집계할 값. fn 은 count, sum, avg, min, max. count 는 prop 이 필요 없습니다.",
                            "items": {"type": "object", "properties": {"fn": {"type": "string", "enum": ["count", "sum", "avg", "min", "max"]}, "prop": {"type": "string", "enum": nums or ["(없음)"]}},
                                      "required": ["fn"]}}
    if groups:
        agg_props["groupBy"] = {"type": "array", "description": "이 속성 값별로 나눠 집계", "items": {"type": "string", "enum": groups}}
    out.append({"name": "aggregate_" + plural, "title": "%s 집계" % obj["name"], "mode": "r", "kind": "aggregate", "desc": "%s의 건수, 합계, 평균 같은 집계를 냅니다.%s" % (obj["name"], perm_note),
                "inputSchema": {"type": "object", "properties": agg_props}, "annotations": {"readOnlyHint": True}})
    for hit in ctx.links_of(obj["id"]):
        to = ctx.obj(hit["to"])
        out.append({"name": _tool_name(sn, dic.snake_of(hit["api"])), "title": "링크 따라가기: %s" % hit["name"], "mode": "r", "kind": "link", "link": hit["api"],
                    "desc": "%s에서 %s(%s)로 이어진 %s을(를) 찾습니다.%s" % (obj["name"], hit["name"], hit["link"]["keyText"], to["name"], perm_note),
                    "inputSchema": {"type": "object", "properties": dict(pk, limit={"type": "integer", "default": query.DEFAULT_LIMIT, "maximum": query.MAX_LIMIT}), "required": list(pk)},
                    "annotations": {"readOnlyHint": True}})
    for a in obj.get("actions", []):
        props = {} if a.get("create") else dict(pk)
        for i in a.get("inputs", []):
            t = i["type"]
            props[i["name"]] = {"type": "integer" if t == "integer" else "string", "description": i["label"] + ((" (%s 의 기본키)" % t.split(":", 1)[1]) if t.startswith("object:") else "") + ("" if i.get("required") else " (선택)")}
            if t == "date":
                props[i["name"]]["format"] = "date"
        props["confirm"] = {"type": "boolean", "description": "사용자가 이 실행을 확인했으면 true. 처음에는 생략해 제출 조건과 확인할 내용을 받으세요."}
        req = ([] if a.get("create") else list(pk)) + [i["name"] for i in a.get("inputs", []) if i.get("required")]
        rules = "; ".join(r["text"] for r in a.get("rules", []))
        out.append({"name": dic.snake_of(a["api"]), "title": "액션: %s" % a["name"], "mode": "w", "kind": "action", "action": a["api"],
                    "desc": "%s %s 제출 조건: %s. 원본 시스템 API(%s)로 실행하며 사용자 확인이 필요합니다." % (a["name"], a.get("effect", ""), rules or "없음", a["via"]),
                    "inputSchema": {"type": "object", "properties": props, "required": req}, "annotations": {"readOnlyHint": False, "destructiveHint": False}})
    return out


def all_definitions(ctx: query.Ctx) -> List[dict]:
    out = []
    for o in ctx.objects.values():
        if o.get("aiOff"):
            continue
        for d in definitions(ctx, o):
            out.append(dict(d, object=o["id"]))
    return out


def find(ctx: query.Ctx, name: str) -> Optional[dict]:
    return next((d for d in all_definitions(ctx) if d["name"] == name), None)


# ── 실행 ───────────────────────────────────────────────────────────────────

def invoke(ctx: query.Ctx, ctx_admin: query.Ctx, tdef: dict, args: Dict[str, Any], user: Optional[dict]) -> dict:
    """도구를 실행한다. {ok, result|error, ...}. 오류는 AI 가 읽고 고칠 수 있게 문장으로 돌려준다."""
    obj = ctx.obj(tdef["object"])
    try:
        k = tdef["kind"]
        if k == "search":
            r = query.search(ctx, obj["id"], where_from_args(obj, args), args.get("limit", query.DEFAULT_LIMIT), args.get("offset", 0))
            return {"ok": True, "result": {"total": r["total"], "rows": r["rows"], "hidden": r["hidden"]}, "sql": r["sql"]}
        if k == "get":
            key = {p["api"]: args.get(p["api"]) for p in obj["props"] if p["col"] in (obj.get("pk") or []) and p["api"]}
            r = query.get(ctx, obj["id"], key)
            return {"ok": True, "result": {"row": r["row"], "hidden": r["hidden"]}, "sql": r["sql"]}
        if k == "aggregate":
            aggs = [{"fn": m["fn"], "prop": m.get("prop"), "as": ("count" if m["fn"] == "count" and not m.get("prop") else "%s_%s" % (m["fn"], m.get("prop")))} for m in (args.get("metrics") or [{"fn": "count"}])]
            r = query.aggregate(ctx, obj["id"], where_from_args(obj, args), aggs, args.get("groupBy"))
            return {"ok": True, "result": {"rows": r["rows"], "hidden": r["hidden"]}, "sql": r["sql"]}
        if k == "link":
            key = {p["api"]: args.get(p["api"]) for p in obj["props"] if p["col"] in (obj.get("pk") or []) and p["api"]}
            q = query.Q(ctx, obj)
            q.where_key(key)
            tq = q.follow(tdef["link"])
            r = query.search(ctx, tq.obj["id"], None, args.get("limit", query.DEFAULT_LIMIT), 0, None, None, tq)
            return {"ok": True, "result": {"total": r["total"], "rows": r["rows"], "hidden": r["hidden"]}, "sql": r["sql"]}
        if k == "action":
            return _action(ctx, ctx_admin, obj, tdef, args, user)
    except (query.OntoQueryError, actions.ActionError) as e:
        return {"ok": False, "error": str(e)}
    return {"ok": False, "error": "알 수 없는 도구 종류예요."}


def _action(ctx: query.Ctx, ctx_admin: query.Ctx, obj: dict, tdef: dict, args: Dict[str, Any], user: Optional[dict]) -> dict:
    _, a = actions.find(ctx_admin, obj["id"], tdef["action"])
    key = ""
    if not a.get("create"):
        key = {p["api"]: args.get(p["api"]) for p in obj["props"] if p["col"] in (obj.get("pk") or []) and p["api"]}
        key = "|".join(str(key[p["api"]]) for p in obj["props"] if p["col"] in (obj.get("pk") or []) and p["api"])
    inputs = {i["name"]: args.get(i["name"]) for i in a.get("inputs", []) if args.get(i["name"]) is not None}
    ev = actions.evaluate(ctx, ctx_admin, obj["id"], a["api"], key, inputs, user)
    if not all(r["ok"] for r in ev["rules"]):
        return {"ok": False, "error": "제출 조건을 만족하지 않아 실행하지 않았어요: %s" % "; ".join("%s (%s)" % (r["text"], r["note"]) for r in ev["rules"] if not r["ok"]), "rules": ev["rules"]}
    if not args.get("confirm"):
        return {"ok": True, "result": {"needsConfirmation": True, "message": "%s 사용자에게 아래 내용을 보여 주고 확인을 받은 뒤 confirm=true 로 다시 호출하세요." % ev["confirm"]["title"],
                                         "confirm": ev["confirm"], "rules": ev["rules"]}}
    ex = actions.execute(ctx, ctx_admin, obj["id"], a["api"], key, inputs, user, confirmed=True)
    if not ex["ok"]:
        return {"ok": False, "error": ex["error"]}
    return {"ok": True, "result": {"done": True, "changed": ex["changed"], "created": ex.get("created"), "after": ex.get("after")}}
