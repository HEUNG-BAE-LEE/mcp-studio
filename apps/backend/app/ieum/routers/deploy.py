"""AI 연결 배포 메뉴: 도구 묶음 구성, MCP 서버 배포(지금은 이 컴퓨터의 프로세스), 액세스 키 관리."""
import re
import secrets
import time
from typing import Optional

from fastapi import APIRouter, Body

from app.ieum.repositories import deploy as repo
from app.ieum.repositories import studio as tool_repo
from app.ieum.responses import fail, ok
from app.ieum.runtime import deployer
from app.ieum.runtime.supervisor import DeployError
from app.ieum.store import LOCK

router = APIRouter(prefix="/api/ieum/deploy", tags=["ieum-deploy"])


def _call(fn, *args):
    try:
        return ok(fn(*args))
    except DeployError as e:
        return fail(e.status, str(e))


def _validate(body, rows, own_id=None):
    name = (body.get("name") or "").strip()
    slug = (body.get("slug") or "").strip().lower()
    if not name:
        return None, "이름을 입력해 주세요."
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,39}", slug):
        return None, "주소 이름은 영문 소문자, 숫자, 하이픈만 쓸 수 있습니다."
    if any(t["slug"] == slug and t["id"] != own_id for t in rows):
        return None, "이미 쓰는 주소 이름입니다."
    known = {t["id"] for t in tool_repo.flat_tools()}
    tools = [i for i in (body.get("tools") or []) if i in known]
    if not tools:
        return None, "도구를 하나 이상 골라 주세요."
    return {"name": name, "slug": slug, "audience": (body.get("audience") or "전 직원").strip(), "tools": tools}, None


@router.get("/toolsets/")
def toolset_list():
    return ok([deployer.view(t) for t in repo.toolsets.load()])


@router.post("/toolsets/")
def toolset_create(payload: Optional[dict] = Body(None)):
    with LOCK:
        rows = repo.toolsets.load()
        data, err = _validate(payload or {}, rows)
        if err:
            return fail(400, err)
        ts = dict(data, id="ts-" + data["slug"], ver="v0.1", status="draft", updated="방금", deployed=[])
        rows.append(ts)
        repo.toolsets.save(rows)
    return ok(deployer.view(ts), 201)


@router.post("/toolsets/{toolset_id}/deploy/")
def toolset_deploy(toolset_id: str):
    """공개 중인 도구만 담아 새 버전으로 배포한다. 서버(로컬 프로세스)가 응답할 때까지 기다린다."""
    return _call(deployer.deploy, toolset_id)


@router.post("/toolsets/{toolset_id}/start/")
def toolset_start(toolset_id: str):
    """내려 둔(또는 죽은) 서버를 마지막으로 배포한 버전 그대로 다시 띄운다."""
    return _call(deployer.start, toolset_id)


@router.post("/toolsets/{toolset_id}/stop/")
def toolset_stop(toolset_id: str):
    return _call(deployer.stop, toolset_id)


@router.get("/toolsets/{toolset_id}/logs/")
def toolset_logs(toolset_id: str, lines: int = 200):
    """서버 프로세스가 남긴 로그의 마지막 줄들."""
    try:
        return ok({"lines": deployer.logs(toolset_id, lines)})
    except DeployError as e:
        return fail(e.status, str(e))


@router.put("/toolsets/{toolset_id}/")
def toolset_update(toolset_id: str, payload: Optional[dict] = Body(None)):
    with LOCK:
        rows = repo.toolsets.load()
        ts = next((x for x in rows if x["id"] == toolset_id), None)
        if ts is None:
            return fail(404)
        data, err = _validate(payload or {}, rows, toolset_id)
        if err:
            return fail(400, err)
        if ts["status"] != "draft" and data["slug"] != ts["slug"]:
            return fail(400, "배포한 묶음의 주소 이름은 바꿀 수 없습니다.")
        ts.update(data, updated="방금")
        repo.toolsets.save(rows)
    return ok(deployer.view(ts))


@router.delete("/toolsets/{toolset_id}/")
def toolset_delete(toolset_id: str):
    try:
        if not deployer.remove(toolset_id):
            return fail(404)
    except DeployError as e:
        return fail(e.status, str(e))
    return ok({"deleted": toolset_id})


def _public(k):
    return {x: v for x, v in k.items() if x != "hash"}


@router.get("/keys/")
def key_list():
    return ok([_public(k) for k in repo.keys.load()])


@router.post("/keys/")
def key_create(payload: Optional[dict] = Body(None)):
    body = payload or {}
    name = (body.get("name") or "").strip() or "새 액세스 키"
    secret = "ieum_sk_" + secrets.token_hex(24)
    row = {"id": "k" + str(int(time.time() * 1000)), "name": name, "key": "ieum_sk_••••••••" + secret[-4:], "hash": repo.hash_key(secret),
           "created": time.strftime("%Y-%m-%d"), "last": "사용 전", "on": True, "toolsets": list(body.get("toolsets") or [])}
    with LOCK:      # 배포한 서버가 키 사용 시각을 같은 파일에 쓴다. 겹치지 않게 한 덩어리로 읽고 쓴다
        rows = repo.keys.load()
        rows.insert(0, row)
        repo.keys.save(rows)
    # 전체 키는 발급 응답에서 한 번만 내려 주고, 서버에는 해시만 남긴다.
    return ok(dict(_public(row), secret=secret), 201)


@router.post("/keys/{key_id}/revoke/")
def key_revoke(key_id: str):
    with LOCK:
        rows = repo.keys.load()
        row = next((k for k in rows if k["id"] == key_id), None)
        if row is None:
            return fail(404)
        row["on"] = False
        repo.keys.save(rows)
    return ok(_public(row))
