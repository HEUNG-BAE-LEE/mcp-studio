"""API 자동 탐색 메뉴: 탐색 작업 시작, 진행 보기, 결과를 도구 후보로 등록.

탐색은 몇 분이 걸려서 작업(job)으로 돌고, 화면은 `GET /jobs/{id}/?after=<seq>` 를 폴링해 새 이벤트만 받는다.

사람과 함께 탐색하기: 크롤러가 남긴 질문에 답하고(answer), 탐색을 멈추거나(pause) 직접 조작하고(take), 말로 지시하고(command),
탐색 계획을 고치고(plan), API 용도를 기입한다(purpose). 질문 카드는 질문을 한 순간의 화면(qshot) 위에 그려진다.
"""
import re
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
            "repo": str(DEMO_ROOT / "po-web"), "branch": "", "stgUrl": origin + "/demo-legacy/po-stg", "owner": "시연 담당자 (구매팀)",
            "exclude": "/logout.do, /admin/*", "purpose": "구매팀 업무를 AI 비서로 조회하고 처리",
            "ques": ["우리 팀 구매요청 승인됐어?", "이번 달 한빛상사 발주 금액 얼마야?", "구매팀 올해 예산 얼마 남았어?", "A4 용지 한빛상사 단가 얼마야?"]}


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
def job_rerun(job_id: str, payload: Optional[dict] = Body(None)):
    """같은 설정으로 다시 탐색. allowReads 는 이름이 조회처럼 보이는 POST 를 허락하고 다시 하는 것(막았던 기록이 있는 탐색만)."""
    try:
        return ok(jobs.rerun(job_id, allow_reads=bool((payload or {}).get("allowReads"))).summary(), 201)
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


# ── 사람과 함께 탐색하기 ────────────────────────────────────────────────────

NOT_FOUND = "탐색 작업을 찾을 수 없습니다."


def _live(job_id: str):
    """돌고 있는 탐색의 사람과 함께 상태. (hitl, None) 또는 (None, 오류 응답)."""
    try:
        job = jobs.get(job_id)
    except KeyError:
        return None, fail(404, NOT_FOUND)
    if job.d["status"] not in jobs.ACTIVE or job.hitl is None:
        return None, fail(409, "진행 중인 탐색이 아닙니다.")
    return job.hitl, None


def _by(payload: Optional[dict]) -> str:
    """화면에 '○○님 결정' 으로 보일 이름. 길이를 줄이고 공백을 정리한다."""
    return " ".join(str((payload or {}).get("by") or "").split())[:20] or "사람"


@router.get("/pending/")
def pending():
    """답을 기다리는 질문이 있는 탐색들. 헤더의 알림 표시가 폴링한다."""
    return ok(jobs.pending())


@router.post("/jobs/{job_id}/answer/")
def job_answer(job_id: str, payload: Optional[dict] = Body(None)):
    h, err = _live(job_id)
    if err:
        return err
    p = payload or {}
    done, msg = h.answer(str(p.get("qid") or ""), "" if p.get("value") is None else str(p["value"]), "human", _by(p))
    return ok({"label": msg, "hitl": h.view()}) if done else fail(400, msg)


@router.post("/jobs/{job_id}/hold/")
def job_hold(job_id: str):
    """질문 카드 위에 마우스가 있다. 잠시 질문 시간을 멈춘다(화면이 몇 초마다 알려 온다)."""
    h, err = _live(job_id)
    if err:
        return err
    h.hold()
    return ok({"held": True})


@router.post("/jobs/{job_id}/pause/")
def job_pause(job_id: str, payload: Optional[dict] = Body(None)):
    h, err = _live(job_id)
    if err:
        return err
    h.set_paused(bool((payload or {}).get("paused")), _by(payload))
    return ok({"paused": h.paused})


@router.post("/jobs/{job_id}/take/")
def job_take(job_id: str, payload: Optional[dict] = Body(None)):
    """직접 조작. start 로 시작, end 로 끝내고, 그 사이에 click/type/key/scroll 을 보낸다."""
    h, err = _live(job_id)
    if err:
        return err
    p = payload or {}
    op = p.get("op")
    if op == "start":
        return ok({"take": True}) if h.start_take(_by(p), None) else fail(409, "이미 직접 조작 중입니다.")
    if op == "end":
        return ok({"take": False, "steps": t["n"]}) if (t := h.end_take(_by(p))) is not None else fail(409, "직접 조작 중이 아닙니다.")
    done, msg = h.push_input(p)
    return ok({"queued": True}) if done else fail(400, msg)


@router.post("/jobs/{job_id}/command/")
def job_command(job_id: str, payload: Optional[dict] = Body(None)):
    """"거래처 관리는 보지 마" 같은 말 한 줄. 해석한 만큼만 탐색에 반영하고 어떻게 처리했는지 그대로 돌려준다."""
    h, err = _live(job_id)
    if err:
        return err
    return ok(h.command(str((payload or {}).get("text") or ""), _by(payload)))


@router.post("/jobs/{job_id}/plan/")
def job_plan(job_id: str, payload: Optional[dict] = Body(None)):
    h, err = _live(job_id)
    if err:
        return err
    p = payload or {}
    mid, op = str(p.get("id") or ""), p.get("op")
    if op not in ("skip", "incl"):
        return fail(400, "알 수 없는 요청입니다.")
    done, msg = (h.skip_menu if op == "skip" else h.include_menu)(mid, _by(p), "plan")
    return ok({"msg": msg, "hitl": h.view()}) if done else fail(400, msg)


_API_KEY = re.compile(r"^[A-Z]{3,7} /\S*$")


@router.post("/jobs/{job_id}/purpose/")
def job_purpose(job_id: str, payload: Optional[dict] = Body(None)):
    """API 용도 기입. 탐색 중에도, 결과를 검토하는 중에도 할 수 있다. 열쇠는 결과의 key(탐색 중에는 요청 줄의 api)."""
    try:
        job = jobs.get(job_id)
    except KeyError:
        return fail(404, NOT_FOUND)
    if job.hitl is None:
        return fail(409, "기입할 수 없는 탐색입니다.")
    p = payload or {}
    key, use = str(p.get("key") or "")[:200], " ".join(str(p.get("use") or "").split())
    qa = [i for i in (p.get("qa") or []) if isinstance(i, int) and not isinstance(i, bool)]
    if not _API_KEY.match(key):
        return fail(400, "어떤 API 인지 알 수 없습니다.")
    if not use:
        return fail(400, "용도를 입력해 주세요.")
    rec = job.hitl.set_purpose(key, use, qa, _by(p), str(p.get("label") or "")[:80])
    job.save(force=True)
    return ok(dict(rec, key=key))


@router.get("/jobs/{job_id}/qshot/{qid}")
def job_qshot(job_id: str, qid: str):
    """질문을 한 순간의 화면. 질문 카드가 이 위에 그려진다(그동안 크롤러는 다른 메뉴를 계속 탐색한다)."""
    try:
        h = jobs.get(job_id).hitl
    except KeyError:
        return fail(404, NOT_FOUND)
    data = h.qshot(qid) if h is not None else None
    if not data:
        return fail(404, "그 질문의 화면이 없습니다.")
    return Response(content=data, media_type="image/jpeg", headers={"Cache-Control": "no-store"})
