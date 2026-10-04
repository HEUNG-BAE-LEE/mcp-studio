"""대시보드 메뉴: 호출 로그와 도구 상태를 모아 KPI, 시간대별 호출, 많이 쓰인 도구를 계산한다."""
import time

from fastapi import APIRouter

from app.ieum.repositories import logs as log_repo
from app.ieum.repositories import sources as src_repo
from app.ieum.repositories import studio as tool_repo
from app.ieum.responses import ok

router = APIRouter(prefix="/api/ieum/dashboard", tags=["ieum-dashboard"])


def _source_ok(src, tools):
    return not src.get("err") and not src.get("busy") and not any(t["status"] in ("review", "drift") for t in tools)


@router.get("/summary/")
def summary():
    tools = tool_repo.flat_tools()
    by_src = tool_repo.all_tools()
    sources = src_repo.list_sources()

    now = time.time()
    rows = [r for r in log_repo.list_logs() if r["ts"] >= now - 24 * 3600 and r["status"] != "wait"]
    prev = [r for r in log_repo.list_logs() if now - 48 * 3600 <= r["ts"] < now - 24 * 3600 and r["status"] != "wait"]
    calls = len(rows)
    failed = sum(1 for r in rows if r["status"] == "err")
    conv = [r["convertMs"] for r in rows if r.get("convertMs") is not None]
    srcms = [r["sourceMs"] for r in rows if r.get("sourceMs") is not None]

    hours = [(time.localtime(now - i * 3600).tm_hour, int((now - i * 3600) // 3600)) for i in range(23, -1, -1)]
    buckets = {b: [0, 0] for _, b in hours}
    for r in rows:
        b = int(r["ts"] // 3600)
        if b in buckets:
            buckets[b][0] += 1
            buckets[b][1] += 1 if r["status"] == "err" else 0

    by_tool, by_client = {}, {}
    for r in rows:
        by_tool[r["tool"]] = by_tool.get(r["tool"], 0) + 1
        by_client[r["client"]] = by_client.get(r["client"], 0) + 1
    src_of = {t["id"]: t["src"] for t in tools}
    top = sorted(by_tool.items(), key=lambda kv: kv[1], reverse=True)[:6]

    delta = round((calls - len(prev)) / len(prev) * 100, 1) if prev else None
    return ok({
        "kpi": {
            "sources": len(sources), "sourcesOk": sum(1 for s in sources if _source_ok(s, by_src.get(s["id"], []))),
            "publishedTools": sum(1 for t in tools if t["status"] == "done"),
            "pendingTools": sum(1 for t in tools if t["status"] in ("review", "drift")),
            "calls24h": calls, "callsDeltaPct": delta,
            "successRate": round((calls - failed) / calls * 100, 1) if calls else None, "failedCalls": failed,
            "convertMs": round(sum(conv) / len(conv)) if conv else None, "sourceMs": round(sum(srcms) / len(srcms)) if srcms else None,
        },
        "hourly": [{"hour": h, "calls": buckets[b][0], "errors": buckets[b][1]} for h, b in hours],
        "clientShare": {c: n / calls for c, n in by_client.items()} if calls else {},
        "clientCalls": by_client,
        "topTools": [{"id": i, "src": src_of.get(i), "calls": n} for i, n in top if src_of.get(i)],
    })
