"""테스트 실행 메뉴: 도구를 실제로 호출해 변환 과정을 확인한다. ANTHROPIC_API_KEY 가 있으면 자연어로도 시험할 수 있다."""
import json
from typing import Optional

import httpx
from fastapi import APIRouter, Body

from app.ieum import config
from app.ieum.gateway import runner
from app.ieum.repositories import playground as repo
from app.ieum.repositories import studio as tool_repo
from app.ieum.responses import fail, ok

router = APIRouter(prefix="/api/ieum/playground", tags=["ieum-playground"])

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MAX_TURNS = 5


@router.get("/")
def playground_config():
    return ok({"models": repo.models.load(), "chatEnabled": bool(config.anthropic_key())})


@router.post("/call/")
def playground_call(payload: Optional[dict] = Body(None)):
    """도구를 직접 호출한다. {tool, args, model?, user?}. 공개 전(검토 중) 도구도 시험할 수 있다."""
    body = payload or {}
    model = body.get("model") if body.get("model") in repo.models.load() else "mcp"
    tool_id = body.get("tool")
    _, tool = tool_repo.find_tool(tool_id)
    if tool is None:
        return fail(404, "도구를 찾을 수 없습니다.")
    if tool.get("status") == "off":
        return fail(400, "AI에 공개하지 않은 도구입니다. 변환 스튜디오에서 다시 포함해 주세요.")
    if tool.get("mode") == "write" and tool.get("exec") == "confirm" and not body.get("approved"):
        return ok({"hold": True, "tool": tool_id})
    out = runner.run_tool(tool_id, body.get("args") or {}, client=model, user=body.get("user") or "테스트 실행",
                          require_published=False, bucket="playground")
    return ok(out)


@router.post("/chat/")
def playground_chat(payload: Optional[dict] = Body(None)):
    """자연어 질문 -> Claude 가 도구를 고르고 -> 이음이 실제로 실행한다."""
    api_key = config.anthropic_key()
    if not api_key:
        return fail(400, "서버에 ANTHROPIC_API_KEY 환경변수가 없어 자연어 테스트를 쓸 수 없습니다. 도구 직접 호출을 이용해 주세요.")
    body = payload or {}
    question = (body.get("message") or "").strip()
    if not question:
        return fail(400, "질문을 입력해 주세요.")
    tools = [t for t in tool_repo.flat_tools() if t.get("status") == "done"]
    if not tools:
        return fail(400, "공개 중인 도구가 없습니다. 변환 스튜디오에서 도구를 공개해 주세요.")
    defs = [{"name": d["name"], "description": d["description"], "input_schema": d["inputSchema"]} for d in map(runner.mcp_definition, tools)]
    messages, calls, user = [{"role": "user", "content": question}], [], body.get("user") or "테스트 실행"
    for _ in range(MAX_TURNS):
        try:
            r = httpx.post(ANTHROPIC_URL, timeout=60, headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
                           json={"model": config.chat_model(), "max_tokens": 1024, "tools": defs, "messages": messages})
            r.raise_for_status()
        except httpx.HTTPError as e:
            return fail(502, "Claude API 호출에 실패했습니다. (%s)" % type(e).__name__)
        msg = r.json()
        messages.append({"role": "assistant", "content": msg["content"]})
        uses = [b for b in msg["content"] if b["type"] == "tool_use"]
        if msg.get("stop_reason") != "tool_use" or not uses:
            text = "".join(b.get("text", "") for b in msg["content"] if b["type"] == "text")
            return ok({"answer": text, "calls": calls})
        results = []
        for u in uses:
            _, tool = tool_repo.find_tool(u["name"])
            if tool and tool.get("mode") == "write" and tool.get("exec") == "confirm":
                out = {"ok": False, "error": "쓰기 작업이라 사용자 확인이 필요합니다. 사용자가 확인하기 전에는 실행하지 않았습니다.", "trace": {}}
            else:
                out = runner.run_tool(u["name"], u["input"], client="claude", user=user, bucket="playground")
            calls.append({"tool": u["name"], "ok": out["ok"], "log": out.get("log"), "trace": out.get("trace")})
            results.append({"type": "tool_result", "tool_use_id": u["id"], "is_error": not out["ok"],
                            "content": json.dumps(out["result"], ensure_ascii=False) if out["ok"] else out["error"]})
        messages.append({"role": "user", "content": results})
    return ok({"answer": "도구 호출이 너무 많아 중단했습니다.", "calls": calls})
