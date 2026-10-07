import time
import uuid

from app.ieum.store import LOCK, JsonStore

logs = JsonStore("logs", "logs")

MAX_ROWS = 300


def list_logs():
    """최신순 {id, ts, client, tool, status, convertMs, sourceMs, user, note?, trace?}"""
    return logs.load()


def append(client, tool, status, convert_ms, source_ms, user, note=None, trace=None):
    row = {"id": uuid.uuid4().hex[:12], "ts": time.time(), "client": client, "tool": tool, "status": status,
           "convertMs": convert_ms, "sourceMs": source_ms, "user": user, "note": note, "trace": trace}
    with LOCK:      # 콘솔과 배포한 MCP 서버 프로세스가 함께 쓴다
        rows = list_logs()
        rows.insert(0, row)
        logs.save(rows[:MAX_ROWS])
    return row


def get(log_id):
    return next((r for r in list_logs() if r["id"] == log_id), None)


def summary_row(r):
    return {k: v for k, v in r.items() if k != "trace"}


def calls_by_tool(since_seconds=24 * 3600):
    cutoff = time.time() - since_seconds
    out = {}
    for r in list_logs():
        if r["ts"] >= cutoff and r["status"] != "wait":
            out[r["tool"]] = out.get(r["tool"], 0) + 1
    return out
