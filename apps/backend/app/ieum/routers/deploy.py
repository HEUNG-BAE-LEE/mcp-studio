"""AI 연결 배포 메뉴: 도구 묶음(MCP 서버) 구성과 배포, 액세스 키 관리."""
import re
import secrets
import time
from typing import Optional

from fastapi import APIRouter, Body

from app.ieum.repositories import deploy as repo
from app.ieum.repositories import studio as tool_repo
from app.ieum.responses import fail, ok

router = APIRouter(prefix="/api/ieum/deploy", tags=["ieum-deploy"])


def _next_version(ts):
    if ts["status"] != "live":
        return "v1.0"
    return "v{:.1f}".format(float(ts["ver"][1:]) + .1)


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
    return ok(repo.toolsets.load())


@router.post("/toolsets/")
def toolset_create(payload: Optional[dict] = Body(None)):
    rows = repo.toolsets.load()
    data, err = _validate(payload or {}, rows)
    if err:
        return fail(400, err)
    ts = dict(data, id="ts-" + data["slug"], ver="v0.1", status="draft", updated="방금", deployed=[])
    rows.append(ts)
    repo.toolsets.save(rows)
    return ok(ts, 201)


@router.post("/toolsets/{toolset_id}/deploy/")
def toolset_deploy(toolset_id: str):
    """공개 중인 도구만 담아 새 버전으로 배포한다. 검토가 안 끝난 도구는 이번 배포에서 빠진다."""
    rows = repo.toolsets.load()
    ts = next((x for x in rows if x["id"] == toolset_id), None)
    if ts is None:
        return fail(404)

    by_id = {t["id"]: t for t in tool_repo.flat_tools()}
    deployed = [i for i in ts["tools"] if by_id.get(i, {}).get("status") == "done"]
    skipped = [i for i in ts["tools"] if i not in deployed]
    if not deployed:
        return fail(400, "공개 중인 도구가 없어 배포할 수 없습니다.")

    ts.update(ver=_next_version(ts), status="live", updated="방금", deployed=deployed)
    repo.toolsets.save(rows)
    return ok({"toolset": ts, "deployed": deployed, "skipped": skipped})


@router.put("/toolsets/{toolset_id}/")
def toolset_update(toolset_id: str, payload: Optional[dict] = Body(None)):
    rows = repo.toolsets.load()
    ts = next((x for x in rows if x["id"] == toolset_id), None)
    if ts is None:
        return fail(404)
    data, err = _validate(payload or {}, rows, toolset_id)
    if err:
        return fail(400, err)
    ts.update(data, updated="방금")
    repo.toolsets.save(rows)
    return ok(ts)


@router.delete("/toolsets/{toolset_id}/")
def toolset_delete(toolset_id: str):
    rows = repo.toolsets.load()
    if not any(x["id"] == toolset_id for x in rows):
        return fail(404)
    repo.toolsets.save([x for x in rows if x["id"] != toolset_id])
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
    rows = repo.keys.load()
    rows.insert(0, row)
    repo.keys.save(rows)
    # 전체 키는 발급 응답에서 한 번만 내려 주고, 서버에는 해시만 남긴다.
    return ok(dict(_public(row), secret=secret), 201)


@router.post("/keys/{key_id}/revoke/")
def key_revoke(key_id: str):
    rows = repo.keys.load()
    row = next((k for k in rows if k["id"] == key_id), None)
    if row is None:
        return fail(404)
    row["on"] = False
    repo.keys.save(rows)
    return ok(_public(row))
