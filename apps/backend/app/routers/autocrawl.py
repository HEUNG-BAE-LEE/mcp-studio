"""자동 트래픽 수집 — 로그인은 사람이, 탐색은 기계가.

흐름은 셋으로 나뉜다. 화면이 이 순서대로 묻는다.

    1) POST /login-open     브라우저 창을 띄운다 (사람이 로그인)
    2) POST /login-confirm  세션만 저장하고 창을 닫는다
    3) POST /start          헤드리스로 탐색 시작 → GET /jobs/{id} 로 지켜본다

Playwright 는 **동기 API** 를 쓴다. 비동기 API 는 이미 도는 이벤트 루프
안에서 못 쓰는데(FastAPI 가 루프를 갖고 있다), 동기 API 를 별도 스레드에서
돌리면 그 제약이 사라진다. 그래서 로그인 창도 탐색도 전용 스레드에서 돈다.
"""
import threading
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import engine
from app.models import Action, Project, RecordingSession
from app.services import browser_session
from app.services.auto_crawler import Progress, run
from app.services.crawl_policy import Limits

router = APIRouter(prefix="/api/autocrawl", tags=["autocrawl"])

# 진행 중인 탐색. 프로세스 안에만 있다 — 서버가 재시작하면 사라진다.
# 몇 분짜리 작업이라 DB 에 넣을 값이 아니다(끝나면 결과만 세션으로 남긴다).
_JOBS: dict[str, dict] = {}
_LOCK = threading.Lock()


class OpenIn(BaseModel):
    url: str
    projectId: int


class StartIn(BaseModel):
    projectId: int
    url: str
    intent: str = ""
    maxPages: int = 40
    maxDepth: int = 3
    maxSeconds: int = 600
    readOnly: bool = True


def _key(project_id: int) -> str:
    """세션 파일 이름. 프로젝트마다 따로 둔다 — 다른 사이트의 로그인이
    섞이면 엉뚱한 곳에 들어간다."""
    return f"p{project_id}"


@router.get("/status/{project_id}")
def status(project_id: int) -> dict:
    """이 프로젝트에 쓸 수 있는 로그인 세션이 있는가."""
    key = _key(project_id)
    return {
        "hasSession": browser_session.has_session(key),
        "loginOpen": browser_session.is_open(key),
        "playwright": _playwright_ready(),
    }


def _playwright_ready() -> bool:
    """브라우저가 설치돼 있는가. 없으면 화면이 설치 명령을 알려준다."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return False
    try:
        with sync_playwright() as pw:
            return bool(pw.chromium.executable_path)
    except Exception:
        return False


@router.post("/login-open")
def login_open(body: OpenIn) -> dict:
    """로그인 창을 띄운다. 아이디·비밀번호는 받지 않는다 — 사람이 직접 넣는다."""
    if not _playwright_ready():
        raise HTTPException(
            503,
            "브라우저가 설치되지 않았습니다. 서버에서 "
            "`python -m playwright install chromium` 을 실행해 주세요.",
        )

    key = _key(body.projectId)
    result: dict = {}
    done = threading.Event()

    def work():
        try:
            browser_session.open_login(key, body.url)
            result["ok"] = True
        except Exception as exc:
            result["error"] = str(exc)[:200]
        finally:
            done.set()

    threading.Thread(target=work, daemon=True).start()
    # 창이 뜨는 데 몇 초 걸린다. 그 안에 실패하면 바로 알려준다.
    done.wait(timeout=25)

    if result.get("error"):
        raise HTTPException(502, f"브라우저를 열지 못했습니다: {result['error']}")
    if not result.get("ok"):
        raise HTTPException(504, "브라우저가 응답하지 않습니다. 다시 시도해 주세요.")
    return {"opened": True}


@router.post("/login-confirm")
def login_confirm(body: OpenIn) -> dict:
    """사람이 로그인을 마쳤다. 쿠키·스토리지만 저장하고 창을 닫는다."""
    key = _key(body.projectId)
    result: dict = {}
    done = threading.Event()

    def work():
        try:
            browser_session.confirm_login(key)
            result["ok"] = True
        except Exception as exc:
            result["error"] = str(exc)[:200]
        finally:
            done.set()

    threading.Thread(target=work, daemon=True).start()
    done.wait(timeout=25)

    if result.get("error"):
        raise HTTPException(422, result["error"])
    if not result.get("ok"):
        raise HTTPException(504, "세션을 저장하지 못했습니다.")
    return {"saved": True}


@router.post("/login-cancel")
def login_cancel(body: OpenIn) -> dict:
    threading.Thread(target=browser_session.close, args=(_key(body.projectId),),
                     daemon=True).start()
    return {"closed": True}


@router.delete("/session/{project_id}")
def forget_session(project_id: int) -> dict:
    """저장된 로그인을 지운다. 고객 계정 열쇠라 언제든 버릴 수 있어야 한다."""
    browser_session.forget(_key(project_id))
    return {"forgotten": True}


@router.post("/start")
def start(body: StartIn) -> dict:
    """탐색을 시작한다. 즉시 job id 를 돌려주고 뒤에서 돈다."""
    if not _playwright_ready():
        raise HTTPException(503, "브라우저가 설치되지 않았습니다.")

    with Session(engine) as db:
        if db.get(Project, body.projectId) is None:
            raise HTTPException(404, "해당 프로젝트를 찾을 수 없습니다")

    key = _key(body.projectId)
    state_file = str(browser_session.state_path(key)) if browser_session.has_session(key) else None

    job_id = uuid.uuid4().hex[:10]
    progress = Progress(phase="시작", current=body.url)
    limits = Limits(
        max_pages=max(1, min(200, body.maxPages)),
        max_depth=max(1, min(6, body.maxDepth)),
        max_seconds=max(30, min(1800, body.maxSeconds)),
        read_only=body.readOnly,
    )

    with _LOCK:
        _JOBS[job_id] = {
            "projectId": body.projectId, "url": body.url, "intent": body.intent,
            "progress": progress, "result": None,
            "startedAt": datetime.utcnow().isoformat(),
            "readOnly": body.readOnly,
        }

    def work():
        try:
            out = run(storage_state=state_file, start_url=body.url,
                      intent=body.intent, limits=limits, progress=progress)
            with _LOCK:
                _JOBS[job_id]["result"] = out
        except Exception as exc:
            progress.error = str(exc)[:200]
            progress.done = True
            progress.say(f"중단: {progress.error}")

    threading.Thread(target=work, daemon=True).start()

    return {"jobId": job_id, "hasSession": state_file is not None}


def _job_view(job_id: str) -> dict:
    job = _JOBS.get(job_id)
    if job is None:
        raise HTTPException(404, "없는 작업입니다. 서버가 재시작되면 사라집니다.")
    p: Progress = job["progress"]
    view = {
        "jobId": job_id,
        "projectId": job["projectId"],
        "url": job["url"],
        "intent": job["intent"],
        "readOnly": job["readOnly"],
        "phase": p.phase, "visited": p.visited, "queued": p.queued,
        "found": p.found, "current": p.current, "done": p.done,
        "error": p.error, "log": p.log[-40:],
    }
    if job["result"]:
        view["result"] = job["result"]
    return view


@router.get("/jobs/{job_id}")
def job(job_id: str) -> dict:
    return _job_view(job_id)


class AdoptIn(BaseModel):
    jobId: str
    urls: list[str]


@router.post("/adopt")
def adopt(body: AdoptIn) -> dict:
    """고른 API 를 MCP 도구로 만든다.

    수집 세션을 함께 남긴다 — 나중에 "이 도구가 어디서 왔나"를 물었을 때
    답할 수 있어야 하고, 마켓 상세의 출처 표시가 그 기록을 읽는다.
    """
    job = _JOBS.get(body.jobId)
    if job is None:
        raise HTTPException(404, "없는 작업입니다")
    result = job.get("result")
    if not result:
        raise HTTPException(409, "아직 탐색이 끝나지 않았습니다")

    picked = [a for a in result["apis"] if a["url"] in set(body.urls)]
    if not picked:
        raise HTTPException(422, "만들 API 를 골라 주세요")

    project_id = job["projectId"]
    with Session(engine) as db:
        session_row = RecordingSession(
            project_id=project_id, started_at=datetime.utcnow(),
            ended_at=datetime.utcnow(), status="COMPLETED",
            kind="traffic", source_label=job["url"][:120],
        )
        db.add(session_row)
        db.commit()
        db.refresh(session_row)

        made = []
        existing = {a.tool_name for a in db.exec(
            select(Action).where(Action.project_id == project_id)).all()}

        for api in picked:
            tool_name = _tool_name(api, existing)
            existing.add(tool_name)
            # 실측으로 갈린 필수/선택을 그대로 스펙에 옮긴다. 문서를 읽은 게
            # 아니라 여러 번 부른 기록에서 나온 값이라 더 믿을 만하다.
            query = {
                name: {"type": "string", "required": name in api["required"],
                       "llmEditable": True,
                       "description": "관측된 파라미터"}
                for name in api["required"] + api["optional"]
            }
            db.add(Action(
                project_id=project_id, source_kind="traffic",
                name=_display_name(api), tool_name=tool_name,
                description=api.get("why") or "화면 관측으로 수집한 API",
                status="ACTIVE",
                action_spec={
                    "name": tool_name, "toolName": tool_name,
                    "request": {"method": api["method"], "urlTemplate": api["url"],
                                "querySchema": query or None, "bodySchema": None},
                    "response": {"pick": []},
                },
            ))
            made.append(tool_name)
        db.commit()

    return {"created": len(made), "tools": made, "sessionId": session_row.id}


def _display_name(api: dict) -> str:
    tail = [s for s in api["path"].split("/") if s and s != "{id}"]
    return f"{tail[-1] if tail else 'api'} 조회"


def _tool_name(api: dict, taken: set[str]) -> str:
    """도구 이름. 경로에서 만들되 겹치면 번호를 붙인다."""
    import re

    parts = [s for s in api["path"].split("/") if s and s != "{id}"]
    base = "_".join(parts[-2:]) if parts else "api"
    base = re.sub(r"[^a-zA-Z0-9_]+", "_", base).strip("_").lower() or "api"
    if api["method"] != "GET":
        base = f"{api['method'].lower()}_{base}"
    name, n = base, 2
    while name in taken:
        name = f"{base}_{n}"
        n += 1
    return name
