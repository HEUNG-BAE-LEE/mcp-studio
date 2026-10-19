"""온톨로지 MCP 서버: 연결(온톨로지)마다 하나. 공개(publish)하면 그 버전의 스냅샷을 서버에 반영한다.

서버는 변환 스튜디오의 도구 묶음 서버와 같은 프로세스 방식(runtime/supervisor)이다. 다만 스냅샷(manifest)이 도구 정의가 아니라 공개한 객체와 링크이고(kind=onto),
도구는 객체에서 만들어지며 실행은 질의 엔진이 한다(onto/runtime.py). 처음 공개하면 서버가 뜨고, 다음 공개부터는 프로세스를 다시 띄우지 않고 서버가 요청마다 파일을
보고 새 버전으로 바꾼다. 포트는 처음 받은 것을 계속 쓴다. 콘솔이 다시 뜨면 떠 있던 서버를 같은 스냅샷으로 되살린다(main.py).
스냅샷에는 다른 온톨로지로 이어지는 링크의 건너편 객체(ext)가 함께 들어간다 — 그 온톨로지가 공개되어 있을 때만. 건너편이 나중에 다시 공개돼도 이 서버는
이 온톨로지를 다시 공개하기 전에는 옛 모양 그대로다("배포는 스냅샷").
"""
import logging
import os
import re
from typing import List

from app.ieum.onto import conn as dbconn
from app.ieum.onto import query, store, tools
from app.ieum.runtime import manifest, supervisor
from app.ieum.runtime.supervisor import DeployError
from app.ieum.store import LOCK, JsonStore

log = logging.getLogger("ieum.onto.mcp")
deploys = JsonStore("onto", "deploys")          # {연결 id: {port, status(live|stopped), ver, tools, at}}


def autoserve() -> bool:
    """공개할 때 서버를 띄우고 반영하는가. 시험이 프로세스를 띄우지 않으려고 끌 수 있다(IEUM_ONTO_AUTOSERVE=0)."""
    return (os.environ.get("IEUM_ONTO_AUTOSERVE") or "1").lower() not in ("0", "false", "no", "off")


def ts_id(conn_id: str) -> str:
    tid = "ts-onto-" + conn_id
    if not re.fullmatch(r"ts-[a-z0-9][a-z0-9-]{0,39}", tid):
        raise DeployError("연결 id 가 서버 이름으로 쓰기에 올바르지 않습니다: %s" % conn_id, 400)
    return tid


def ports() -> set:
    """온톨로지 서버가 쓰는 포트(도구 묶음 서버가 이 자리를 뺏지 않게 한다)"""
    return {d["port"] for d in deploys.load().values() if d.get("port")}


def _reserved(conn_id: str) -> set:
    from app.ieum.repositories import deploy as repo
    return {x["port"] for x in repo.toolsets.load() if x.get("port")} | {d["port"] for k, d in deploys.load().items() if k != conn_id and d.get("port")}


def assemble(conn_id: str, own: dict) -> dict:
    """공개한 스냅샷(own: {objects, links})에, 다른 온톨로지(가장 최근 공개 버전)와 이어진 링크와 그 건너편 객체(ext)를 더한 서버용 스냅샷"""
    allv = store.versions.load()
    objects = {k: dict(v, ext=False) for k, v in own["objects"].items()}
    links = list(own["links"])
    others = {k: v[-1]["snapshot"] for k, v in allv.items() if k != conn_id and v}
    have = {l["id"] for l in links}
    for snap in others.values():                           # 다른 온톨로지가 정의했지만 이 온톨로지로 들어오는 링크
        for l in snap["links"]:
            if l["id"] in have:
                continue
            a, b = l["from"] in objects, l["to"] in objects
            if a == b:                                      # 둘 다 이 온톨로지이거나 둘 다 아닌 링크는 상관없다
                continue
            far = l["to"] if a else l["from"]
            if far not in snap["objects"]:
                continue
            objects.setdefault(far, dict(snap["objects"][far], ext=True))
            links.append(l)
            have.add(l["id"])
    for l in list(links):                                   # 이 온톨로지가 정의한 링크의 건너편
        for end in (l["from"], l["to"]):
            if end not in objects:
                src = next((s["objects"][end] for s in others.values() if end in s["objects"]), None)
                if src is not None:
                    objects[end] = dict(src, ext=True)
    return {"objects": objects, "links": [l for l in links if l["from"] in objects and l["to"] in objects]}


def definitions_for(snap: dict) -> List[dict]:
    """서버용 스냅샷에서 이 온톨로지 객체가 만드는 AI 도구 정의(건너편 객체(ext)의 도구는 그 온톨로지의 서버가 낸다)"""
    ctx = query.Ctx(snap["objects"], snap["links"], None)
    return [d for d in tools.all_definitions(ctx) if not snap["objects"][d["object"]].get("ext")]


def manifest_for(conn_id: str) -> dict:
    """가장 최근 공개 버전의 스냅샷으로 서버 스냅샷을 만든다."""
    c = dbconn.need(conn_id)
    vers = store.versions.load().get(conn_id) or []
    if not vers:
        raise DeployError("공개한 버전이 없어 서버를 만들 수 없습니다. 먼저 온톨로지를 공개해 주세요.", 400)
    ver = vers[-1]
    snap = assemble(conn_id, ver["snapshot"])
    return manifest.build_onto(ts_id(conn_id), conn_id, "%s 온톨로지" % c["name"], "v%d" % ver["ver"], snap, definitions_for(snap))


def view(conn_id: str) -> dict:
    """화면용: 서버 상태와 주소. state: none(서버 없음) | stopped | starting | running | crashed"""
    rec = deploys.load().get(conn_id)
    if not rec:
        return {"state": "none", "autoserve": autoserve()}
    st = supervisor.status(ts_id(conn_id))
    if "port" not in st and rec.get("port"):
        st = dict(st, port=rec["port"], url=supervisor.url_of(rec["port"]))
    return dict(st, ver=rec.get("ver"), tools=rec.get("tools"), deployedAt=rec.get("at"), status=rec.get("status"), autoserve=autoserve(), tsId=ts_id(conn_id))


def _save(conn_id: str, **fields) -> None:
    with LOCK:
        allv = deploys.load()
        allv.setdefault(conn_id, {}).update(fields)
        deploys.save(allv)


def reflect(conn_id: str) -> dict:
    """공개한 버전을 서버에 반영한다(서버가 없으면 띄운다). 실패해도 공개는 취소하지 않고 이유를 돌려준다."""
    if not autoserve():
        return {"state": "off"}
    try:
        tid = ts_id(conn_id)
        with supervisor.op_lock(tid):
            data = manifest_for(conn_id)
            rec = deploys.load().get(conn_id) or {}
            if rec.get("status") == "stopped":                 # 사람이 내려 둔 서버는 새 버전을 올려도 다시 띄우지 않는다. 스냅샷만 바꿔 둔다
                manifest.write(supervisor.manifest_path(tid), data)
                _save(conn_id, ver=int(data["toolset"]["version"][1:]), tools=len(data["tools"]), at=data["deployedAt"])
                return view(conn_id)
            rt = supervisor.apply(tid, data, port_hint=rec.get("port"), reserved=_reserved(conn_id))
            _save(conn_id, port=rt["port"], status="live", ver=int(data["toolset"]["version"][1:]), tools=len(data["tools"]), at=data["deployedAt"])
        return view(conn_id)
    except DeployError as e:
        log.warning("온톨로지 서버에 반영하지 못했습니다: %s %s", conn_id, e)
        return {"state": "error", "message": str(e)}


def start(conn_id: str) -> dict:
    tid = ts_id(conn_id)
    with supervisor.op_lock(tid):
        rec = deploys.load().get(conn_id)
        if not rec:
            raise DeployError("아직 공개한 적이 없는 온톨로지입니다. 먼저 공개해 주세요.", 400)
        rt = supervisor.ensure_running(tid, port_hint=rec.get("port"), reserved=_reserved(conn_id))
        _save(conn_id, port=rt["port"], status="live")
    return view(conn_id)


def stop(conn_id: str) -> dict:
    tid = ts_id(conn_id)
    with supervisor.op_lock(tid):
        if not deploys.load().get(conn_id):
            raise DeployError("서버가 없습니다.", 400)
        supervisor.stop(tid)
        _save(conn_id, status="stopped")
    return view(conn_id)


def remove(conn_id: str) -> None:
    """연결을 지울 때 서버와 스냅샷도 지운다."""
    try:
        tid = ts_id(conn_id)
    except DeployError:
        return
    supervisor.remove(tid)
    with LOCK:
        allv = deploys.load()
        if allv.pop(conn_id, None) is not None:
            deploys.save(allv)


def logs(conn_id: str, lines: int = 200) -> List[str]:
    return supervisor.log_lines(ts_id(conn_id), lines)


def restore() -> None:
    """콘솔이 뜰 때 떠 있던 온톨로지 서버를 같은 스냅샷으로 되살린다(바로 돌아온다)."""
    if not supervisor.autorestore():
        return
    items = [(ts_id(k), d.get("port")) for k, d in deploys.load().items() if d.get("status") == "live"]
    ids = {ts_id(k): k for k in deploys.load()}
    supervisor.restore(items, on_port=lambda tid, port: _save(ids[tid], port=port))
