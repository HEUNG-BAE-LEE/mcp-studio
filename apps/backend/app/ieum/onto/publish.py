"""온톨로지 공개: 지금의 공개 객체와 링크를 버전(vN)으로 얼려 둔다.

AI 와 MCP 서버는 스튜디오의 실시간 모양이 아니라 이 스냅샷을 본다. 그래서 스튜디오에서 고쳐도 새 버전을 공개하기 전에는 AI 에 닿지 않는다.
스냅샷은 연결(온톨로지)마다 따로다. 다른 온톨로지는 바뀌지 않는다. 연결을 넘나드는 링크는 그 링크를 정의한 쪽(from 객체가 있는 온톨로지)의 스냅샷에 들어가고,
상대 온톨로지도 공개되어 있을 때만 AI 가 따라갈 수 있다(질의 쪽에서 양쪽 객체가 모두 있는 링크만 남긴다).
공개 대상: 상태가 공개(pub)이고 AI 공개를 끄지 않은 객체, 그리고 공개(pub) 상태의 링크.
"""
import copy
import time
from typing import List

from app.ieum.onto import conn as dbconn
from app.ieum.onto import mcp, store


class PublishError(ValueError):
    """사용자에게 그대로 보일 오류"""


def _clean(o: dict) -> dict:
    return {k: copy.deepcopy(v) for k, v in o.items() if not k.startswith("_")}


def preview(conn_id: str) -> dict:
    """공개 모달: 다음 버전 번호, 공개될 객체, 이번 공개에서 빠질 객체, 만들어질 도구 수"""
    dbconn.need(conn_id)
    objs = store.conn_objects(conn_id)
    pub = [o for o in objs if o["status"] == "pub" and not o.get("aiOff")]
    rest = [o for o in objs if o["status"] != "pub"]
    off = [o for o in objs if o["status"] == "pub" and o.get("aiOff")]
    vers = store.versions.load().get(conn_id) or []
    snap = _snapshot(conn_id, pub)
    return {"ver": len(vers) + 1, "pub": [{"id": o["id"], "name": o["name"]} for o in pub], "rest": [{"id": o["id"], "name": o["name"], "status": o["status"]} for o in rest],
            "off": [{"id": o["id"], "name": o["name"]} for o in off], "links": len(snap["links"]), "actions": sum(len(o.get("actions", [])) for o in pub), "tools": len(mcp.definitions_for(mcp.assemble(conn_id, snap))),
            "current": vers[-1]["ver"] if vers else 0}


def _snapshot(conn_id: str, pub: List[dict]) -> dict:
    ids = {o["id"] for o in pub}
    return {"objects": {o["id"]: _clean(o) for o in pub}, "links": [copy.deepcopy(l) for l in store.all_links() if l["from"] in ids and l["status"] == "pub"]}


def publish(conn_id: str, by: str = "", note: str = "", serve: bool = True) -> dict:
    c = dbconn.need(conn_id)
    objs = store.conn_objects(conn_id)
    pub = [o for o in objs if o["status"] == "pub" and not o.get("aiOff")]
    if not pub:
        raise PublishError("공개할 객체가 없어요. 객체를 검토해 공개 상태로 바꾼 뒤 공개해 주세요.")
    snap = _snapshot(conn_id, pub)
    with store.LOCK:
        allv = store.versions.load()
        vers = allv.get(conn_id) or []
        ver = len(vers) + 1
        n_tools = len(mcp.definitions_for(mcp.assemble(conn_id, snap)))
        vers.append({"ver": ver, "at": time.time(), "by": by, "note": note, "snapshot": snap, "objects": len(pub), "links": len(snap["links"]), "tools": n_tools})
        allv[conn_id] = vers[-30:]
        store.versions.save(allv)
        dbconn.update(conn_id, {"ver": ver})
    out = {"ver": ver, "objects": len(pub), "links": len(snap["links"]), "tools": n_tools, "name": c["name"]}
    if serve:                                                              # MCP 서버에 반영: 서버가 없으면 띄우고, 있으면 새 버전으로 바꾼다
        out["mcp"] = mcp.reflect(conn_id)
    return out


def versions(conn_id: str) -> List[dict]:
    """공개 이력(스냅샷 본문은 빼고)"""
    return [{k: v for k, v in x.items() if k != "snapshot"} for x in (store.versions.load().get(conn_id) or [])][::-1]
