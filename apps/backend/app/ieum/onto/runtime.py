"""온톨로지 MCP 서버(배포한 프로세스)가 쓰는 쪽. 배포 스냅샷(manifest, kind=onto)을 올려 두고 tools/list, tools/call 에 답한다.

도구는 스냅샷의 객체에서 만들어 두었고(manifest.build_onto), 실행은 질의 엔진(query.py)과 액션(actions.py)이 한다. 스튜디오에서 객체를 고쳐도 새 버전을 공개하기 전에는
이 서버에 닿지 않는다. 실행 사용자는 액세스 키의 runAs(직원 사번)이고, 그 직원의 부서와 직급으로 행·속성 권한을 적용한다. runAs 가 없는 키로 부르면
권한 규칙이 있는 객체는 볼 수 있는 행이 없다(아무도 확인하지 못했으니 아무것도 주지 않는다).
"""
import time
from typing import Dict, Optional

from app.ieum.onto import perm, query, tools
from app.ieum.repositories import logs as log_repo
from app.ieum.runtime import protocol


class OntoDeployment(protocol.Deployment):
    def __init__(self, data: dict) -> None:
        self.data = data
        self.toolset = data["toolset"]
        self.tools: Dict[str, dict] = {t["name"]: t for t in data["tools"]}
        self.sources = {}
        snap = data["snapshot"]
        self.objects, self.links = snap["objects"], snap["links"]

    def definitions(self) -> list:
        out = []
        for t in self.tools.values():
            d = {"name": t["name"], "title": t["title"], "description": t["desc"], "inputSchema": t["inputSchema"], "annotations": t.get("annotations", {})}
            out.append(d)
        return out

    def call(self, name: str, args: dict, key: dict, client: str) -> dict:
        t0 = time.time()
        user: Optional[dict] = perm.identify(key.get("runAs") or "") if key.get("runAs") else None
        cu = query.Ctx(self.objects, self.links, user)
        ca = query.Ctx(self.objects, self.links, None, admin=True)
        who = "%s%s" % (key["name"], (" (%s)" % user["name"]) if user else "")
        try:
            out = tools.invoke(cu, ca, self.tools[name], args if isinstance(args, dict) else {}, user)
        except Exception as e:                  # noqa: BLE001 — 도구 하나의 오류가 서버를 깨지 않는다. 원인은 로그에만 남긴다
            log_repo.append(client, name, "err", int((time.time() - t0) * 1000), None, who, "%s: %s" % (type(e).__name__, e), None)
            return {"ok": False, "error": "도구를 실행하는 중 오류가 났습니다. (%s)" % type(e).__name__}
        ms = int((time.time() - t0) * 1000)
        db_ms = sum(x["ms"] for x in cu.log + ca.log)
        if out["ok"]:
            log_repo.append(client, name, "ok", max(ms - db_ms, 0), db_ms, who, None, {"args": args, "sql": out.get("sql", "")})
        else:
            log_repo.append(client, name, "err", ms, db_ms or None, who, out.get("error"), {"args": args})
        return out
