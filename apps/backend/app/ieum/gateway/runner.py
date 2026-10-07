"""도구 실행 진입점. 플레이그라운드와 MCP 서버가 함께 쓰며, 결과를 호출 로그에 남긴다."""
import threading
import time

from app.ieum.gateway import engine
from app.ieum.repositories import logs as log_repo
from app.ieum.repositories import sources as src_repo
from app.ieum.repositories import studio as tool_repo

_RATE = {}
_RATE_LOCK = threading.Lock()


def find(tool_id):
    sid, tool = tool_repo.find_tool(tool_id)
    if tool is None:
        return None, None
    return src_repo.get_source(sid), tool


def rate_ok(bucket, tool):
    """분당 호출 한도(tool.limit). bucket 은 키 단위로 나눈다."""
    limit = int(tool.get("limit") or 60)
    now = time.time()
    with _RATE_LOCK:
        q = [t for t in _RATE.get((bucket, tool["id"]), []) if t > now - 60]
        if len(q) >= limit:
            _RATE[(bucket, tool["id"])] = q
            return False
        q.append(now)
        _RATE[(bucket, tool["id"])] = q
        return True


def run_tool(tool_id, args, client="mcp", user="", ctx=None, require_published=True, bucket="-", resolve=None):
    """{'ok', 'result'|'error', 'trace', 'log'}

    resolve(tool_id) -> (원본 시스템, 도구). 배포한 MCP 서버는 배포 시점의 스냅샷에서 찾는다.
    없으면 저장소의 현재 정의를 쓴다(테스트 실행).
    """
    source, tool = (resolve or find)(tool_id)
    if tool is None:
        return {"ok": False, "error": "도구를 찾을 수 없습니다: %s" % tool_id, "trace": {}}
    if require_published and tool.get("status") != "done":
        return {"ok": False, "error": "공개되지 않은 도구입니다: %s" % tool_id, "trace": {}}
    if not rate_ok(bucket, tool):
        row = log_repo.append(client, tool_id, "err", 0, None, user, "호출 한도(분당 %s회)를 넘었습니다." % tool.get("limit", 60))
        return {"ok": False, "error": "호출 한도를 넘었습니다. 잠시 뒤 다시 시도하세요.", "trace": {}, "log": row["id"]}
    ctx = dict({"user_id": user, "user_name": user}, **(ctx or {}))
    try:
        result, trace = engine.invoke(source, tool, args or {}, ctx)
        row = log_repo.append(client, tool_id, "ok", trace["convertMs"], trace["sourceMs"], user, None, trace)
        return {"ok": True, "result": result, "trace": trace, "log": row["id"]}
    except engine.ToolError as e:
        tr = e.trace or {}
        row = log_repo.append(client, tool_id, "err", tr.get("convertMs", 0), tr.get("sourceMs"), user, str(e), tr)
        return {"ok": False, "error": str(e), "trace": tr, "log": row["id"]}
    except Exception as e:  # 변환 중 예기치 못한 오류도 로그로 남긴다
        row = log_repo.append(client, tool_id, "err", 0, None, user, "%s: %s" % (type(e).__name__, e), trace=None)
        return {"ok": False, "error": "변환 중 오류가 났습니다. (%s)" % type(e).__name__, "trace": {}, "log": row["id"]}


def mcp_definition(tool):
    """도구 정의를 MCP tools/list 항목으로."""
    props, req = {}, []
    for p in engine.visible_params(tool):
        t = (p.get("at") or "string").split(" ")[0]
        d = {"type": t if t in ("string", "number", "integer", "boolean", "array", "object") else "string", "description": p.get("d") or p["a"]}
        if "date" in (p.get("at") or ""):
            d["format"] = "date-time" if "date-time" in p["at"] else "date"
        if p.get("codes"):
            d["enum"] = [c[1] for c in p["codes"]]
        elif p.get("enum"):
            d["enum"] = p["enum"]
        props[p["a"]] = d
        if p.get("req"):
            req.append(p["a"])
    ann = {"readOnlyHint": tool.get("mode") == "read"}
    if tool.get("mode") == "write":
        ann["destructiveHint"] = bool(tool.get("destructive"))
    return {"name": tool["id"], "title": tool.get("title"), "description": tool.get("desc", ""),
            "inputSchema": {"type": "object", "properties": props, "required": req}, "annotations": ann}
