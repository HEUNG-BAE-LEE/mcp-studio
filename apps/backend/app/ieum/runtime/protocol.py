"""MCP(Streamable HTTP, JSON-RPC 2.0) 요청 처리. 배포한 서버 프로세스가 쓴다.

도구 묶음 하나가 서버 하나다. 인증은 배포 화면에서 발급한 액세스 키(Bearer)이고 키는 호출할 때마다 키 저장소에서
읽는다. 그래서 키를 폐기하면 서버를 다시 띄우지 않아도 바로 막힌다. 도구 정의는 스냅샷(manifest)에서 읽는다.

세션을 두지 않는다(요청 하나로 끝나는 서버). 서버가 먼저 보내는 스트림(GET)도 쓰지 않는다.
"""
import json
from typing import Dict, Optional, Tuple

from app.ieum.gateway import runner
from app.ieum.repositories import deploy as repo

# 새것부터. 클라이언트가 이 중 하나를 달라고 하면 그대로 답하고, 모르는 버전이면 우리 최신으로 답한다.
SUPPORTED = ("2025-06-18", "2025-03-26", "2024-11-05")
CLIENTS = (("claude", "claude"), ("anthropic", "claude"), ("gemini", "gemini"), ("google", "gemini"), ("openai", "gpt"), ("gpt", "gpt"), ("chatgpt", "gpt"))

Reply = Tuple[int, Optional[dict], Dict[str, str]]       # (HTTP 상태, 본문(없으면 None), 추가 헤더)


class Deployment:
    """스냅샷 하나를 메모리에 올려 둔 것. 서버가 파일이 바뀔 때만 새로 만든다."""

    def __init__(self, data: dict) -> None:
        self.data = data
        self.toolset = data["toolset"]
        self.tools = {t["id"]: t for t in data["tools"]}
        self.sources = data["sources"]

    @property
    def version(self) -> str:
        return self.toolset["version"]

    def resolve(self, tool_id):
        """runner.run_tool 에 넘기는 조회 함수. 저장소의 현재 정의가 아니라 배포한 정의를 쓴다."""
        tool = self.tools.get(tool_id)
        return (self.sources.get(tool["src"]), tool) if tool else (None, None)


def client_of(headers) -> str:
    ua = (headers.get("x-ieum-client") or headers.get("user-agent") or "").lower()
    return next((c for needle, c in CLIENTS if needle in ua), "mcp")


def negotiate(requested) -> str:
    return requested if requested in SUPPORTED else SUPPORTED[0]


def _error(rid, code: int, msg: str, status: int = 200, headers: Optional[dict] = None) -> Reply:
    return status, {"jsonrpc": "2.0", "id": rid, "error": {"code": code, "message": msg}}, headers or {}


def _result(rid, result) -> Reply:
    return 200, {"jsonrpc": "2.0", "id": rid, "result": result}, {}


def handle(dep: Deployment, headers, raw: bytes) -> Reply:
    """요청 하나를 처리한다. 저장소 읽기와 원본 시스템 호출이 막히는 일이라 스레드에서 부른다."""
    h = {k.lower(): v for k, v in headers.items()}
    auth = h.get("authorization", "")
    key = repo.find_key(auth[7:].strip()) if auth[:7].lower() == "bearer " else None
    if key is None:
        return _error(None, -32001, "액세스 키가 없거나 폐기되었습니다.", 401, {"WWW-Authenticate": 'Bearer realm="ieum"'})
    if key.get("toolsets") and dep.toolset["id"] not in key["toolsets"]:
        return _error(None, -32003, "이 키로는 사용할 수 없는 도구 묶음입니다.", 403)
    version = h.get("mcp-protocol-version")
    if version and version not in SUPPORTED:
        return _error(None, -32600, "지원하지 않는 프로토콜 버전입니다: %s (지원: %s)" % (version, ", ".join(SUPPORTED)), 400)

    try:
        msg = json.loads(raw.decode("utf-8"))
    except ValueError:
        return _error(None, -32700, "JSON 형식이 올바르지 않습니다.", 400)
    if not isinstance(msg, dict):
        return _error(None, -32600, "배치 요청은 지원하지 않습니다.", 400)

    method, rid, params = msg.get("method"), msg.get("id"), msg.get("params")
    if method is None:
        # 클라이언트가 보내는 응답(우리가 먼저 요청하는 일이 없으니 올 일이 없다)은 받고 넘어간다.
        if rid is not None and ("result" in msg or "error" in msg):
            return 202, None, {}
        return _error(rid, -32600, "method 가 없는 요청입니다.", 400)
    if rid is None:                      # notification
        return 202, None, {}
    if params is not None and not isinstance(params, dict):
        return _error(rid, -32602, "params 는 객체여야 합니다.")
    params = params or {}
    repo.touch_key(key["id"])

    if method == "initialize":
        return _result(rid, {"protocolVersion": negotiate(params.get("protocolVersion")), "capabilities": {"tools": {"listChanged": False}},
                             "serverInfo": {"name": "ieum-" + dep.toolset["slug"], "version": dep.version.lstrip("v")}})
    if method == "ping":
        return _result(rid, {})
    if method == "tools/list":
        return _result(rid, {"tools": [runner.mcp_definition(t) for t in dep.tools.values()]})
    if method == "tools/call":
        name = params.get("name")
        if name not in dep.tools:
            return _error(rid, -32602, "알 수 없는 도구입니다: %s" % name)
        out = runner.run_tool(name, params.get("arguments") or {}, client=client_of(h), user=key["name"], bucket=key["id"], resolve=dep.resolve)
        if out["ok"]:
            return _result(rid, {"content": [{"type": "text", "text": json.dumps(out["result"], ensure_ascii=False)}],
                                 "structuredContent": out["result"], "isError": False})
        return _result(rid, {"content": [{"type": "text", "text": out["error"]}], "isError": True})
    return _error(rid, -32601, "지원하지 않는 메서드입니다: %s" % method)
