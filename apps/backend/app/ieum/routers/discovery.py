"""API 자동 탐색 메뉴: 탐색 작업 시작, 진행 보기, 결과를 도구 후보로 등록.

탐색은 몇 분이 걸려서 작업(job)으로 돌고, 화면은 `GET /jobs/{id}/?after=<seq>` 를 폴링해 새 이벤트만 받는다.
"""
from typing import Optional

from fastapi import APIRouter, Body, Request, Response

from app.ieum.discovery import jobs
from app.ieum.discovery.repo import DEMO_ROOT
from app.ieum.responses import fail, ok

router = APIRouter(prefix="/api/ieum/discovery", tags=["ieum-discovery"], on_startup=[jobs.resume], on_shutdown=[jobs.stop])


def _demo(origin: str) -> Optional[dict]:
    """연결 마법사의 "시연용 값 채우기". 번들된 시연용 레거시 사이트와 Java 소스를 가리킨다."""
    try:
        from app.ieum.demo_legacy.site import DEMO_PASSWORD, DEMO_USER_ID
    except ImportError:
        return None
    return {"name": "구매관리 (시연용 레거시)", "base": origin + "/demo-legacy/po", "start": "/login.do", "account": DEMO_USER_ID, "password": DEMO_PASSWORD,
            "repo": str(DEMO_ROOT / "po-web"), "branch": "", "stgUrl": origin + "/demo-legacy/po-stg", "owner": "시연 담당자 (구매팀)"}


@router.get("/")
def overview(request: Request):
    """콘솔이 처음 뜰 때 한 번: 이 서버가 할 수 있는 것, 기본값, 지난 작업 목록."""
    return ok(dict(jobs.environment(), jobs=jobs.list_jobs(), demo=_demo(str(request.base_url).rstrip("/"))))


@router.post("/jobs/")
def job_start(payload: Optional[dict] = Body(None)):
    try:
        job = jobs.start(payload or {})
    except jobs.JobError as exc:
        return fail(400, str(exc))
    return ok(job.summary(), 201)


@router.get("/jobs/{job_id}/")
def job_get(job_id: str, after: int = 0):
    try:
        return ok(jobs.get(job_id).view(after))
    except KeyError:
        return fail(404, "탐색 작업을 찾을 수 없습니다.")


@router.get("/jobs/{job_id}/shot")
def job_shot(job_id: str):
    """헤드리스 브라우저가 지금 보는 화면. 이벤트의 shot 번호가 바뀔 때만 다시 받으면 된다."""
    try:
        data = jobs.get(job_id).shot
    except KeyError:
        return fail(404, "탐색 작업을 찾을 수 없습니다.")
    if not data:
        return fail(404, "아직 캡처한 화면이 없습니다.")
    return Response(content=data, media_type="image/jpeg", headers={"Cache-Control": "no-store"})


@router.post("/jobs/{job_id}/cancel/")
def job_cancel(job_id: str):
    try:
        return ok(jobs.cancel(job_id).summary())
    except KeyError:
        return fail(404, "탐색 작업을 찾을 수 없습니다.")


@router.post("/jobs/{job_id}/rerun/")
def job_rerun(job_id: str):
    try:
        return ok(jobs.rerun(job_id).summary(), 201)
    except KeyError:
        return fail(404, "탐색 작업을 찾을 수 없습니다.")
    except jobs.JobError as exc:
        return fail(400, str(exc))


@router.post("/jobs/{job_id}/register/")
def job_register(job_id: str, payload: Optional[dict] = Body(None)):
    try:
        return ok(jobs.register(job_id, (payload or {}).get("ids") or []), 201)
    except KeyError:
        return fail(404, "탐색 작업을 찾을 수 없습니다.")
    except jobs.JobError as exc:
        return fail(400, str(exc))


@router.delete("/jobs/{job_id}/")
def job_delete(job_id: str):
    try:
        jobs.delete(job_id)
    except KeyError:
        return fail(404, "탐색 작업을 찾을 수 없습니다.")
    return ok({"deleted": job_id})
