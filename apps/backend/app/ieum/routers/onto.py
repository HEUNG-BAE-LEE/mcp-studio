"""온톨로지 메뉴(2차): DB 연결, 객체 구축(스캔·마트·객체 생성), 그래프, 객체 탐색, 공개, AI 질의 테스트.

모든 응답은 콘솔 공통 봉투({resultCode, resultMsg, resultData})다. 이 모듈은 얇게 둔다 — 일은 `app.ieum.onto` 아래 모듈이 한다.
"""
from functools import wraps
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Request

from app.ieum.onto import actions, ask, build, demo, demo_setup, legacy_sync, marts, mcp, perm, publish, query, replica, scan, store, tools
from app.ieum.onto import conn as dbconn
from app.ieum.onto import profile, reader
from app.ieum.repositories import deploy as deploy_repo
from app.ieum.responses import fail, ok
from app.ieum.runtime.supervisor import DeployError

router = APIRouter(prefix="/api/ieum/onto", tags=["ieum-onto"])
legacy_sync.install()                      # 시연 레거시 사이트가 상태를 바꿀 때 po.db 에도 쓰는 후크(시연 DB 가 있을 때만 일한다)

USER_ERRORS = (DeployError, dbconn.ConnError, build.BuildError, marts.MartError, scan.ScanError, perm.PermError, publish.PublishError, ask.AskError, actions.ActionError,
               query.OntoQueryError)


def guard(fn):
    """사용자에게 보일 오류는 400 으로, 그 밖은 그대로 올려 500 이 되게 한다."""
    @wraps(fn)
    def run(*a, **kw):
        try:
            return fn(*a, **kw)
        except USER_ERRORS as e:
            return fail(400, str(e))
        except KeyError as e:
            return fail(404, "찾을 수 없습니다: %s" % e)
    return run


# ── 보기 모양 ──────────────────────────────────────────────────────────────

def conn_view(c: dict) -> dict:
    objs = store.conn_objects(c["id"])
    d = dbconn.DBMS.get(c["dbms"], {})
    vers = store.versions.load().get(c["id"]) or []
    out = {k: c.get(k) for k in ("id", "name", "dbms", "host", "port", "db", "user", "schema", "alias", "mode", "status", "clr", "ver", "scanned", "tables", "views", "demo", "created", "lastTest",
                                  "synced", "syncTables", "syncRows", "connector")}
    out.update(dbmsLabel=d.get("label", c["dbms"]), objects=len(objs), pub=sum(1 for o in objs if o["status"] == "pub"), marts=sum(1 for m in store.all_marts().values() if m.get("home") == c["id"]),
               published=vers[-1]["ver"] if vers else 0, publishedAt=vers[-1]["at"] if vers else None, replica=dbconn.use_replica(c))
    return out


def overview() -> dict:
    cs = [conn_view(c) for c in store.conns.load()]
    taken = {c["db"] for c in store.conns.load() if c["dbms"] == "sqlite"}
    return {"conns": cs, "settings": store.settings(), "demo": bool(store.settings().get("demo")), "llm": ask.llm.provider() is not None,
            "demoDbs": [{"id": "demo:%s" % n, "name": demo.INFO[n]["name"], "label": demo.INFO[n]["label"], "schema": demo.INFO[n]["schema"], "used": "demo:%s" % n in taken} for n in demo.NAMES],
            "dbms": dbconn.driver_status(), "asOf": store.as_of()}


def obj_view(o: dict, ctx: Optional[query.Ctx] = None) -> dict:
    """객체 한 개의 화면용 모양. 속성 권한 규칙이 있는 속성에는 perm 특성을 달아 준다."""
    v = dict(o)
    pcols = {r["col"] for r in (o.get("perm") or {}).get("props", [])}
    v["props"] = [dict(p, flags=sorted(set(p["flags"]) | ({"perm"} if p["col"] in pcols else set()), key=lambda f: ["pk", "title", "link", "search", "mask", "pii", "code", "perm", "hidden", "filter"].index(f)
                                                       if f in ["pk", "title", "link", "search", "mask", "pii", "code", "perm", "hidden", "filter"] else 20)) for p in o["props"]]
    v["filterText"] = profile.filter_text(o.get("filter"))
    v.pop("view", None)
    v["isView"] = o["kind"] == "view"
    v["actions"] = [actions.describe(o, a) for a in o.get("actions", [])]
    return v


def link_view(l: dict) -> dict:
    return dict(l)


# ── 개요, 설정, 시연 ───────────────────────────────────────────────────────

@router.get("/")
@guard
def get_overview():
    return ok(overview())


@router.put("/settings")
@guard
def put_settings(payload: Dict[str, Any] = Body(...)):
    patch: Dict[str, Any] = {}
    if "asOf" in payload:
        v = str(payload["asOf"] or "")
        if v and not (len(v) == 10 and v[4] == "-" and v[7] == "-"):
            return fail(400, "기준일은 2026-09-30 같은 날짜로 적어 주세요.")
        patch["asOf"] = v
    if "ranks" in payload:
        r = [str(x).strip() for x in payload["ranks"] if str(x).strip()]
        if not r:
            return fail(400, "직급 순서를 하나 이상 적어 주세요.")
        patch["ranks"] = r
    if "askUsers" in payload:
        patch["askUsers"] = [str(x).strip() for x in payload["askUsers"] if str(x).strip()]
    if "identity" in payload:
        idt = payload["identity"] or {}
        if idt:
            o = store.get_object(idt.get("object", ""))
            if o is None:
                return fail(400, "직원 객체를 찾을 수 없습니다.")
            cols = {p["col"] for p in o["props"]}
            if not idt.get("id") or any(idt.get(k) and idt[k] not in cols for k in ("id", "dept", "rank", "name")):
                return fail(400, "사번, 부서, 직급, 이름은 그 객체의 컬럼이어야 합니다.")
        patch["identity"] = idt
    return ok(store.save_settings(patch))


@router.post("/demo/load")
@guard
def demo_load(request: Request, force: bool = False):
    """시연 환경을 불러온다. 이미 연결이 있으면 그 온톨로지를 모두 지우게 되므로 force=true 로 확인해야 한다(화면은 연결이 하나도 없을 때만 이 버튼을 보인다)."""
    if store.conns.load() and not force:
        return fail(400, "이미 연결한 DB 가 있어요. 시연 환경을 불러오면 지금의 온톨로지(객체, 링크, 마트, 공개 버전)를 모두 지우고 처음부터 만듭니다. 그래도 불러오려면 force=true 를 붙여 주세요.")
    base = str(request.base_url).rstrip("/") + "/demo-legacy/po"
    from app.ieum.routers import demo_legacy
    demo_legacy.reset()
    demo_setup.load(legacy_base=base)
    marts.start_scheduler()
    return ok(overview())


@router.post("/demo/reset-data")
@guard
def demo_reset_data():
    """시연 DB 의 값(액션으로 바뀐 것)과 레거시 사이트의 상태를 처음으로 되돌린다. 온톨로지와 마트 정의는 그대로 두고 마트를 다시 빌드한다."""
    from app.ieum.routers import demo_legacy
    demo_legacy.reset()
    dbconn.dispose_all()
    demo.reset()
    reader.forget_cache()
    for mid, m in store.all_marts().items():
        marts.build(mid, force_full=True, wait=True)
    return ok(overview())


# ── 연결 ───────────────────────────────────────────────────────────────────

@router.post("/connections/test")
@guard
def conn_test(payload: Dict[str, Any] = Body(...)):
    return ok(dbconn.test(payload, payload.get("existing") or None))


@router.post("/connections")
@guard
def conn_create(payload: Dict[str, Any] = Body(...)):
    c = dbconn.create(payload)
    return ok(conn_view(c), 201)


@router.get("/connections/{cid}")
@guard
def conn_get(cid: str):
    return ok(conn_view(dbconn.need(cid)))


@router.put("/connections/{cid}")
@guard
def conn_put(cid: str, payload: Dict[str, Any] = Body(...)):
    c = dbconn.need(cid)
    patch: Dict[str, Any] = {}
    if payload.get("name"):
        patch["name"] = str(payload["name"]).strip()[:60]
    if payload.get("mode") in ("live", "sync"):
        patch["mode"] = payload["mode"]
    dbconn.update(cid, patch)
    dbconn.forget(cid)
    if patch.get("mode") == "sync" and store.conn_objects(cid):
        replica.sync(cid)
    return ok(conn_view(dbconn.need(cid)))


@router.delete("/connections/{cid}")
@guard
def conn_delete(cid: str):
    dbconn.need(cid)
    for mid, m in list(store.all_marts().items()):
        if m.get("home") == cid:
            store.update_mart(mid, lambda x: x.update(obj=None))
            marts.delete(mid)
    mcp.remove(cid)
    store.purge_conn(cid)
    dbconn.delete(cid)
    reader.forget_cache(cid)
    return ok({"id": cid})


@router.post("/connections/{cid}/sync")
@guard
def conn_sync(cid: str):
    dbconn.need(cid)
    return ok(replica.sync(cid))


@router.get("/connections/{cid}/tables")
@guard
def conn_tables(cid: str, fresh: bool = False):
    return ok(build.source_tables(cid, fresh))


@router.post("/connections/{cid}/check-key")
@guard
def conn_check_key(cid: str, payload: Dict[str, Any] = Body(...)):
    return ok(build.check_key(cid, payload.get("table", ""), payload.get("cols") or []))


# ── 그래프, 객체 ───────────────────────────────────────────────────────────

@router.get("/connections/{cid}/graph")
@guard
def conn_graph(cid: str):
    """연결의 온톨로지: 이 연결의 객체, 이 연결 객체에서 나가거나 들어오는 링크(다른 온톨로지로 가는 것 포함), 링크 건너편 객체의 요약"""
    dbconn.need(cid)
    objs = {o["id"]: o for o in store.all_objects().values()}
    mine = [obj_view(o) for o in objs.values() if o["conn"] == cid]
    ids = {o["id"] for o in mine}
    ls = [link_view(l) for l in store.all_links() if l["from"] in ids or l["to"] in ids]
    others = {}
    for l in ls:
        for oid in (l["from"], l["to"]):
            if oid not in ids and oid in objs:
                o = objs[oid]
                others[oid] = {"id": oid, "name": o["name"], "api": o["api"], "conn": o["conn"], "connName": lk_conn_name(o["conn"]), "clr": (dbconn.get(o["conn"]) or {}).get("clr", "mcp"), "status": o["status"]}
    return ok({"objects": mine, "links": ls, "others": others})


def lk_conn_name(cid: str) -> str:
    c = dbconn.get(cid)
    return c["name"] if c else cid


@router.get("/objects/{oid}")
@guard
def object_get(oid: str):
    o = store.get_object(oid)
    if o is None:
        return fail(404, "객체를 찾을 수 없습니다.")
    ls = store.object_links(oid)
    return ok({"object": obj_view(o), "links": [link_view(l) for l in ls]})


@router.patch("/objects/{oid}")
@guard
def object_patch(oid: str, payload: Dict[str, Any] = Body(...)):
    return ok(obj_view(build.update_object(oid, payload)))


@router.post("/objects/{oid}/review")
@guard
def object_review(oid: str):
    return ok(obj_view(build.finish_review(oid)))


@router.post("/objects/{oid}/ai")
@guard
def object_ai(oid: str, payload: Dict[str, Any] = Body(...)):
    return ok(obj_view(build.set_ai(oid, bool(payload.get("on")))))


@router.patch("/objects/{oid}/props/{col}")
@guard
def object_prop(oid: str, col: str, payload: Dict[str, Any] = Body(...)):
    return ok(obj_view(build.update_prop(oid, col, payload)))


@router.put("/objects/{oid}/perm")
@guard
def object_perm(oid: str, payload: Any = Body(None)):
    o = store.get_object(oid)
    if o is None:
        return fail(404, "객체를 찾을 수 없습니다.")
    rules = perm.validate(o, payload)
    return ok(obj_view(store.update_object(oid, lambda x: x.update(perm=rules))))


@router.patch("/links/{lid}")
@guard
def link_patch(lid: str, payload: Dict[str, Any] = Body(...)):
    return ok(link_view(build.update_link(lid, payload)))


@router.post("/links/{lid}/review")
@guard
def link_review(lid: str):
    with store.LOCK:
        ls = store.all_links()
        l = next((x for x in ls if x["id"] == lid), None)
        if l is None:
            return fail(404, "링크를 찾을 수 없습니다.")
        l["status"] = "pub"
        store.links.save(ls)
    return ok(link_view(l))


@router.get("/objects/{oid}/preview")
@guard
def object_preview(oid: str):
    """원본 DB 에서 읽기 전용으로 3행을 가져와 객체로 바꾼 모습(마스킹과 코드값 변환 적용)"""
    o = store.get_object(oid)
    if o is None:
        return fail(404, "객체를 찾을 수 없습니다.")
    ctx = query.Ctx.live(admin=True)
    props = [p["api"] for p in query.exposed(o)][:6]
    r = query.search(ctx, oid, None, 3, 0, None, props)
    head = [{"api": p["api"], "name": p["name"], "type": p["type"], "unit": p.get("unit", "")} for p in query.exposed(o) if p["api"] in props]
    sample = query.instances(ctx, oid, "", 4)
    return ok({"cols": head, "rows": r["rows"], "total": r["total"], "sql": r["sql"], "sample": [dict(s, oid=oid) for s in sample]})


@router.get("/objects/{oid}/simulate")
@guard
def object_simulate(oid: str, emp: str):
    """다른 사용자로 보기: 그 사용자가 볼 수 있는 행 수와 속성"""
    o = store.get_object(oid)
    if o is None:
        return fail(404, "객체를 찾을 수 없습니다.")
    user = perm.identify(emp)
    if user is None:
        return fail(400, "사번 %s 인 직원을 찾을 수 없습니다." % emp)
    ctx = query.Ctx.live(user=user)

    def count(u):
        try:
            return query.Q(ctx, o).count()
        except query.OntoQueryError:
            return 0
    sim = perm.simulate(o, user, count)
    total = query.Q(query.Ctx.live(admin=True), o).count()
    return ok({"user": user, "rows": sim["rows"], "total": total, "policy": sim["policy"], "props": sim["props"]})


@router.get("/objects/{oid}/tools")
@guard
def object_tools(oid: str):
    o = store.get_object(oid)
    if o is None:
        return fail(404, "객체를 찾을 수 없습니다.")
    ctx = query.Ctx.live()
    defs = tools.definitions(ctx, o)
    return ok({"tools": [{k: v for k, v in d.items() if k not in ("link", "action")} for d in defs], "published": o["status"] == "pub" and not o.get("aiOff")})


# ── 객체 탐색 ──────────────────────────────────────────────────────────────

@router.get("/connections/{cid}/instances")
@guard
def explore_list(cid: str, type: str = "all", q: str = "", limit: int = 12):
    """객체 탐색의 왼쪽 목록: 이 온톨로지의 객체 인스턴스. type 이 all 이면 객체마다 앞 limit 건씩"""
    dbconn.need(cid)
    ctx = query.Ctx.live(admin=True)
    out = []
    for o in sorted(store.conn_objects(cid), key=lambda x: -len(store.object_links(x["id"]))):
        if type != "all" and o["id"] != type:
            continue
        try:
            for it in query.instances(ctx, o["id"], q, limit if type == "all" else 40):
                out.append(dict(it, oid=o["id"], type=o["name"], clr=(dbconn.get(o["conn"]) or {}).get("clr", "mcp")))
        except (query.OntoQueryError, dbconn.ConnError):
            continue
    return ok({"items": out, "types": [{"id": o["id"], "name": o["name"]} for o in store.conn_objects(cid)]})


@router.get("/objects/{oid}/instances/{key:path}")
@guard
def explore_get(oid: str, key: str):
    ctx = query.Ctx.live(admin=True)
    inst = query.instance(ctx, oid, key)
    objs = store.all_objects()
    for l in inst["links"]:
        o = objs.get(l["to"])
        l["clr"] = (dbconn.get(o["conn"]) or {}).get("clr", "mcp") if o else "mcp"
        l["toConnName"] = lk_conn_name(o["conn"]) if o else ""
    o = objs[oid]
    inst["object"] = {"id": oid, "name": o["name"], "api": o["api"], "conn": o["conn"], "connName": lk_conn_name(o["conn"]), "clr": (dbconn.get(o["conn"]) or {}).get("clr", "mcp")}
    return ok(inst)


# ── 스캔, 객체 생성 ────────────────────────────────────────────────────────

@router.post("/connections/{cid}/scans")
@guard
def scan_start(cid: str, payload: Dict[str, Any] = Body(default={})):
    return ok(scan.start(cid, payload.get("mode", "all"), payload.get("start", ""), payload.get("sample", True), payload.get("pii", True)), 201)


@router.get("/scans/{jid}")
@guard
def scan_get(jid: str):
    return ok(scan.get(jid))


@router.post("/scans/{jid}/apply")
@guard
def scan_apply(jid: str, payload: Dict[str, Any] = Body(...)):
    res = scan.apply(jid, payload.get("picked") or [])
    conn_id = scan.get(jid)["conn"]
    c = dbconn.need(conn_id)
    if c.get("mode") == "sync":
        replica.sync(conn_id)
    reader.forget_cache(conn_id)
    return ok(res)


@router.get("/connections/{cid}/draft")
@guard
def object_draft(cid: str, src: str = "table", pick: str = ""):
    return ok(build.draft(cid, src, pick))


@router.post("/connections/{cid}/objects")
@guard
def object_create(cid: str, payload: Dict[str, Any] = Body(...)):
    o = build.create(cid, payload)
    c = dbconn.need(cid)
    if c.get("mode") == "sync":
        replica.sync(cid)
    return ok(obj_view(o), 201)


# ── 마트 ───────────────────────────────────────────────────────────────────

def mart_view(m: dict) -> dict:
    v = {k: m.get(k) for k in ("id", "home", "name", "desc", "sql", "refresh", "inc", "status", "rows", "size", "sizeApprox", "last", "next", "owner", "cols", "pv", "od", "obj", "builds", "failMsg", "tip",
                                "bstep", "tables")}
    v["refreshLabel"] = marts.REFRESH.get(m["refresh"], m["refresh"])
    v["objName"] = (store.get_object(m["obj"]) or {}).get("name") if m.get("obj") else None
    v["dbs"] = marts.sources_of(m.get("tables") or [])
    return v


@router.get("/marts/schema")
@guard
def marts_schema():
    return ok(marts.schema_tree())


@router.post("/marts/validate")
@guard
def marts_validate(payload: Dict[str, Any] = Body(...)):
    return ok(marts.validate(payload.get("conn", ""), payload.get("sql", ""), payload.get("inc", ""), payload.get("edit", "")))


@router.get("/connections/{cid}/marts")
@guard
def marts_list(cid: str):
    dbconn.need(cid)
    return ok([mart_view(m) for m in store.all_marts().values() if m.get("home") == cid])


@router.post("/connections/{cid}/marts")
@guard
def marts_create(cid: str, payload: Dict[str, Any] = Body(...)):
    m = marts.save(cid, payload, owner=payload.get("owner") or "")
    marts.build(m["id"])
    return ok(mart_view(store.get_mart(m["id"])), 201)


@router.get("/marts/{mid}")
@guard
def marts_get(mid: str):
    m = store.get_mart(mid)
    if m is None:
        return fail(404, "마트를 찾을 수 없습니다.")
    return ok(mart_view(m))


@router.put("/marts/{mid}")
@guard
def marts_put(mid: str, payload: Dict[str, Any] = Body(...)):
    m = store.get_mart(mid)
    if m is None:
        return fail(404, "마트를 찾을 수 없습니다.")
    marts.save(m["home"], dict(payload, edit=mid))
    marts.build(mid)
    return ok(mart_view(store.get_mart(mid)))


@router.post("/marts/{mid}/build")
@guard
def marts_build(mid: str, payload: Dict[str, Any] = Body(default={})):
    return ok(mart_view(marts.build(mid, force_full=bool(payload.get("full")))))


@router.delete("/marts/{mid}")
@guard
def marts_delete(mid: str):
    marts.delete(mid)
    return ok({"id": mid})


# ── 공개 ───────────────────────────────────────────────────────────────────

@router.get("/connections/{cid}/publish")
@guard
def publish_preview(cid: str):
    return ok(publish.preview(cid))


@router.post("/connections/{cid}/publish")
@guard
def publish_do(cid: str, payload: Dict[str, Any] = Body(default={})):
    return ok(publish.publish(cid, by=payload.get("by") or "", note=payload.get("note") or ""), 201)


@router.get("/connections/{cid}/versions")
@guard
def publish_versions(cid: str):
    return ok(publish.versions(cid))


# ── AI 질의 테스트 ─────────────────────────────────────────────────────────

@router.get("/ask")
@guard
def ask_status():
    return ok(ask.status())


@router.post("/ask/run")
@guard
def ask_run(payload: Dict[str, Any] = Body(...)):
    approved = payload.get("approved")
    return ok(ask.run({"id": payload.get("id"), "text": payload.get("text")}, str(payload.get("emp") or ""), approved if isinstance(approved, bool) else None, payload.get("inputs")))


# ── MCP 서버 ───────────────────────────────────────────────────────────────

@router.get("/connections/{cid}/mcp")
@guard
def mcp_status(cid: str):
    dbconn.need(cid)
    tid = mcp.ts_id(cid)
    keys = [{k: v for k, v in x.items() if k != "hash"} for x in deploy_repo.keys.load() if x.get("on") and (not x.get("toolsets") or tid in x["toolsets"])]
    return ok({"server": mcp.view(cid), "keys": keys, "users": ask.users(), "name": "ieum-onto-%s" % cid})


@router.post("/connections/{cid}/mcp/start")
@guard
def mcp_start(cid: str):
    dbconn.need(cid)
    return ok(mcp.start(cid))


@router.post("/connections/{cid}/mcp/stop")
@guard
def mcp_stop(cid: str):
    dbconn.need(cid)
    return ok(mcp.stop(cid))


@router.get("/connections/{cid}/mcp/logs")
@guard
def mcp_logs(cid: str, lines: int = 100):
    dbconn.need(cid)
    return ok({"lines": mcp.logs(cid, lines)})


@router.post("/connections/{cid}/mcp/keys")
@guard
def mcp_key(cid: str, payload: Dict[str, Any] = Body(default={})):
    """이 온톨로지 서버 전용 액세스 키. 실행 사용자(직원 사번)를 정하면 그 사람의 행·속성 권한으로 도구가 돈다."""
    dbconn.need(cid)
    emp = str(payload.get("runAs") or "").strip()
    if emp and perm.identify(emp) is None:
        return fail(400, "사번 %s 인 직원을 찾을 수 없습니다." % emp)
    name = (payload.get("name") or "").strip() or "온톨로지 키"
    row, secret = deploy_repo.create_key(name, [mcp.ts_id(cid)], emp)
    return ok(dict({k: v for k, v in row.items() if k != "hash"}, secret=secret), 201)
