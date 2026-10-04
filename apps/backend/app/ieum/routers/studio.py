"""변환 스튜디오 메뉴: 원본 작업을 AI 도구로 바꾸는 정의(설명, 파라미터 매핑, 정책)를 관리한다."""
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Body

from app.ieum import config
from app.ieum.repositories import logs as log_repo
from app.ieum.repositories import studio as repo
from app.ieum.responses import fail, ok

router = APIRouter(prefix="/api/ieum/studio", tags=["ieum-studio"])

STATUSES = ("done", "review", "drift", "off")


@router.get("/")
def tool_list(source: Optional[str] = None):
    """원본 시스템별 도구 목록. ?source=<id> 로 하나만 조회."""
    data = repo.all_tools()
    calls = log_repo.calls_by_tool()
    for arr in data.values():
        for t in arr:
            t["calls"] = calls.get(t["id"], 0)
    if source:
        return ok({source: data.get(source, [])})
    return ok(data)


# `/{tool_id}/` 보다 먼저 선언한다. 경로 모양이 달라 겹치지는 않지만 읽는 사람이 헷갈리지 않는다.
@router.put("/source/{source_id}/")
def source_tools(source_id: str, payload: Any = Body(None)):
    """연결 마법사, API 자동 탐색에서 만든 도구 후보를 시스템 단위로 등록한다."""
    if not isinstance(payload, list) or not all(isinstance(t, dict) and t.get("id") for t in payload):
        return fail(400, "도구 목록(id 포함)이 필요합니다.")
    return ok(repo.replace_source_tools(source_id, payload))


@router.post("/{tool_id}/rewrite/")
def tool_rewrite(tool_id: str, payload: Optional[dict] = Body(None)):
    """AI가 도구 설명을 다시 쓴다. ANTHROPIC_API_KEY 가 필요하다."""
    key = config.anthropic_key()
    if not key:
        return fail(400, "서버에 ANTHROPIC_API_KEY 환경변수가 없어 AI로 다시 쓸 수 없습니다. 설명을 직접 고쳐 주세요.")
    sid, tool = repo.find_tool(tool_id)
    if tool is None:
        return fail(404)
    body = payload or {}
    params = "\n".join("- %s (%s): %s" % (p["a"], p.get("at"), p.get("d", "")) for p in tool["params"] if p.get("a"))
    prompt = ("다음 API를 AI 에이전트가 도구로 쓸 때 보게 될 설명을 한국어 2~3문장으로 써 주세요. 언제 이 도구를 써야 하는지, 쓰지 말아야 할 때는 언제인지를 포함하고, "
              "설명 문장만 출력하세요.\n\n도구 이름: %s\n제목: %s\n방식: %s\n현재 설명: %s\n파라미터:\n%s\n\n%s"
              % (tool["id"], tool.get("title"), "쓰기(데이터 변경)" if tool.get("mode") == "write" else "읽기", body.get("desc") or tool.get("desc"), params,
                 "이전과 다른 표현으로 써 주세요." if body.get("again") else ""))
    try:
        r = httpx.post("https://api.anthropic.com/v1/messages", timeout=60, headers={"x-api-key": key, "anthropic-version": "2023-06-01"},
                       json={"model": config.chat_model(), "max_tokens": 400, "messages": [{"role": "user", "content": prompt}]})
        r.raise_for_status()
        text = "".join(b.get("text", "") for b in r.json()["content"] if b["type"] == "text").strip()
    except httpx.HTTPError as e:
        return fail(502, "Claude API 호출에 실패했습니다. (%s)" % type(e).__name__)
    return ok({"desc": text})


@router.get("/{tool_id}/")
def tool_get(tool_id: str):
    sid, tool = repo.find_tool(tool_id)
    if tool is None:
        return fail(404)
    return ok(dict(tool, src=sid))


@router.put("/{tool_id}/")
def tool_save(tool_id: str, payload: Optional[dict] = Body(None)):
    sid, tool = repo.find_tool(tool_id)
    if tool is None:
        return fail(404)
    patch = payload or {}
    if "status" in patch and patch["status"] not in STATUSES:
        return fail(400, "알 수 없는 도구 상태입니다.")
    patch.pop("src", None)
    return ok(dict(repo.save_tool(tool_id, patch), src=sid))
