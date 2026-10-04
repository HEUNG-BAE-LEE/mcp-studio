"""배포한 도구 묶음을 MCP(Streamable HTTP, JSON-RPC 2.0) 서버로 노출한다.

주소는 `/mcp/<워크스페이스>/<묶음 주소 이름>`. 인증은 배포 화면에서 발급한 액세스 키(Bearer).
"""
import json

from fastapi import APIRouter, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse, Response

from app.ieum.gateway import runner
from app.ieum.repositories import deploy as repo
from app.ieum.repositories import studio as tool_repo

router = APIRouter(tags=["ieum-mcp"])

PROTOCOL = "2025-03-26"
CLIENTS = (("claude", "claude"), ("anthropic", "claude"), ("gemini", "gemini"), ("google", "gemini"), ("openai", "gpt"), ("gpt", "gpt"), ("chatgpt", "gpt"))


def _client_of(headers):
    ua = (headers.get("X-Ieum-Client") or headers.get("User-Agent") or "").lower()
    return next((c for needle, c in CLIENTS if needle in ua), "mcp")


def _rpc_error(rid, code, msg, status=200):
    return JSONResponse({"jsonrpc": "2.0", "id": rid, "error": {"code": code, "message": msg}}, status_code=status)


def _result(rid, result):
    return JSONResponse({"jsonrpc": "2.0", "id": rid, "result": result})


def _handle(slug, headers, raw):
    """저장소 읽기와 원본 시스템 호출이 블로킹이라 스레드풀에서 돈다."""
    auth = headers.get("Authorization", "")
    key = repo.find_key(auth[7:].strip()) if auth.startswith("Bearer ") else None
    if key is None:
        resp = _rpc_error(None, -32001, "액세스 키가 없거나 폐기되었습니다.", 401)
        resp.headers["WWW-Authenticate"] = 'Bearer realm="ieum"'
        return resp
    ts = repo.get_toolset(slug=slug)
    if ts is None or ts.get("status") != "live":
        return _rpc_error(None, -32002, "배포되지 않은 도구 묶음입니다.", 404)
    if key.get("toolsets") and ts["id"] not in key["toolsets"]:
        return _rpc_error(None, -32003, "이 키로는 사용할 수 없는 도구 묶음입니다.", 403)

    try:
        msg = json.loads(raw.decode("utf-8"))
    except ValueError:
        return _rpc_error(None, -32700, "JSON 형식이 올바르지 않습니다.", 400)
    if not isinstance(msg, dict):
        return _rpc_error(None, -32600, "배치 요청은 지원하지 않습니다.", 400)

    method, rid, params = msg.get("method"), msg.get("id"), msg.get("params") or {}
    if rid is None:  # notification
        return Response(status_code=202)
    repo.touch_key(key["id"])

    if method == "initialize":
        return _result(rid, {"protocolVersion": PROTOCOL, "capabilities": {"tools": {"listChanged": False}},
                             "serverInfo": {"name": "ieum-" + ts["slug"], "version": ts["ver"].lstrip("v")}})
    if method == "ping":
        return _result(rid, {})

    live = {t["id"]: t for t in tool_repo.flat_tools() if t["id"] in ts.get("deployed", []) and t.get("status") == "done"}
    if method == "tools/list":
        return _result(rid, {"tools": [runner.mcp_definition(t) for t in live.values()]})
    if method == "tools/call":
        name = params.get("name")
        if name not in live:
            return _rpc_error(rid, -32602, "알 수 없는 도구입니다: %s" % name)
        out = runner.run_tool(name, params.get("arguments") or {}, client=_client_of(headers), user=key["name"], bucket=key["id"])
        if out["ok"]:
            text = json.dumps(out["result"], ensure_ascii=False)
            return _result(rid, {"content": [{"type": "text", "text": text}], "structuredContent": out["result"], "isError": False})
        return _result(rid, {"content": [{"type": "text", "text": out["error"]}], "isError": True})
    return _rpc_error(rid, -32601, "지원하지 않는 메서드입니다: %s" % method)


# 끝 슬래시가 있어도 없어도 받는다. 307 리다이렉트를 따라가지 않는 POST 클라이언트가 있다.
@router.api_route("/mcp/{ws}/{slug}", methods=["GET", "POST", "OPTIONS"], include_in_schema=False)
@router.api_route("/mcp/{ws}/{slug}/", methods=["GET", "POST", "OPTIONS"], include_in_schema=False)
async def mcp_endpoint(ws: str, slug: str, request: Request):
    if request.method == "OPTIONS":
        return Response(status_code=204)
    if request.method == "GET":  # 서버 푸시 스트림은 쓰지 않는다
        return Response(status_code=405)
    return await run_in_threadpool(_handle, slug, request.headers, await request.body())
