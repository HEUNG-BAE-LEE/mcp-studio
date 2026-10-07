"""호출 로그 메뉴: AI가 호출한 도구와 변환 결과 기록."""
from fastapi import APIRouter

from app.ieum.repositories import logs as repo
from app.ieum.responses import fail, ok

router = APIRouter(prefix="/api/ieum/logs", tags=["ieum-logs"])

STATUSES = ("ok", "err", "wait", "cache")


@router.get("/")
def log_list(status: str = "all", client: str = "all", q: str = ""):
    """?status=ok|err|wait|cache  ?client=claude|gemini|gpt|mcp  ?q=도구,사용자 검색어"""
    q = q.strip().lower()
    rows = repo.list_logs()
    counts = {k: sum(1 for r in rows if r["status"] == k) for k in STATUSES}
    out = [repo.summary_row(r) for r in rows
           if (status == "all" or r["status"] == status) and (client == "all" or r["client"] == client)
           and (not q or q in (r["tool"] + (r["user"] or "")).lower())]
    return ok({"total": len(rows), "counts": counts, "rows": out})


@router.get("/{log_id}/")
def log_detail(log_id: str):
    row = repo.get(log_id)
    if row is None:
        return fail(404)
    return ok(row)
