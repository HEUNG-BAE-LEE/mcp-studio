from datetime import datetime
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select
from app.db import get_session
from app.models import Project, RecordingSession, InteractionEvent, NetworkRequest, Action, SpecOperation
from app.services.body import summarize_response
from app.services.masking import mask_patterns, mask_deep, mask_query, mask_body

router = APIRouter()

# 확장 프로그램이 이제 프로젝트 이름을 자유 입력으로 받는다. 기록 시작마다
# 이 엔드포인트를 호출하므로 반복 호출에 안전해야 한다(get-or-create).
class ProjectIn(BaseModel):
    name: str

@router.post("/api/projects")
def get_or_create_project(payload: ProjectIn, db: Session = Depends(get_session)) -> dict:
    name = payload.name.strip()
    if not name:
        raise HTTPException(422, "프로젝트 이름을 입력해 주세요")

    existing = db.exec(select(Project).where(Project.name == name)).first()
    if existing is not None:
        return {"id": existing.id, "name": existing.name}

    project = Project(name=name, allowed_origins=[])
    db.add(project)
    db.commit()
    db.refresh(project)
    return {"id": project.id, "name": project.name}

@router.get("/api/projects")
def list_projects(db: Session = Depends(get_session)) -> list:
    rows = db.exec(select(Project).order_by(Project.id)).all()
    return [{"id": p.id, "name": p.name} for p in rows]

@router.get("/api/recording-sessions/{session_id}")
def get_recording_session(session_id: int, db: Session = Depends(get_session)) -> dict:
    """브레드크럼이 프로젝트 이름을 필요로 한다.

    /candidates는 요청 목록만 돌려주고 프로젝트 정보가 없다. 이미 리뷰를
    통과한 그 응답 형태를 바꾸는 대신 단건 조회를 따로 둔다.
    """
    row = db.get(RecordingSession, session_id)
    if row is None:
        raise HTTPException(404, "해당 기록 세션을 찾을 수 없습니다")

    project = db.get(Project, row.project_id)
    return {
        "id": row.id,
        "projectId": row.project_id,
        "projectName": project.name if project is not None else "",
        "startedAt": row.started_at,
        "endedAt": row.ended_at,
        "status": row.status,
        "kind": row.kind,
        "sourceLabel": row.source_label,
    }

def _session_view(row: RecordingSession, db: Session) -> dict:
    """세션 한 건을 화면용으로 바꾼다. 프로젝트별 목록과 엔진별 목록이 같이 쓴다."""
    # 수집 방식마다 후보의 정체가 다르다. 트래픽은 네트워크 요청, 포털은 오퍼레이션.
    # 화면이 세는 단위를 한 필드(candidateCount)로 통일해 표를 하나로 유지한다.
    if row.kind == "portal":
        operations = db.exec(
            select(SpecOperation).where(SpecOperation.session_id == row.id)
        ).all()
        candidate_count = len(operations)
        top_score = None
        label = row.source_label or (operations[0].service_name if operations else "")
    else:
        requests = db.exec(
            select(NetworkRequest).where(NetworkRequest.session_id == row.id)
        ).all()
        scores = [r.score for r in requests if r.score is not None]
        candidate_count = len(requests)
        # 채점 전과 0점을 구분해야 한다. 점수는 /candidates를 부를 때 채워진다.
        top_score = max(scores) if scores else None
        label = row.source_label

    return {
        "id": row.id,
        "kind": row.kind,
        "sourceLabel": label,
        "startedAt": row.started_at,
        "endedAt": row.ended_at,
        "status": row.status,
        "candidateCount": candidate_count,
        # 기존 화면이 쓰던 이름을 남겨둔다 (트래픽 경로 호환)
        "requestCount": candidate_count,
        "topScore": top_score,
    }

@router.get("/api/projects/{project_id}/recording-sessions")
def list_recording_sessions(project_id: int, db: Session = Depends(get_session)) -> list:
    """최근 세션이 위로 오게 내림차순으로 준다."""
    rows = db.exec(
        select(RecordingSession)
        .where(RecordingSession.project_id == project_id)
        .order_by(RecordingSession.id.desc())
    ).all()
    return [_session_view(row, db) for row in rows]

@router.get("/api/collection-engines")
def collection_engines(db: Session = Depends(get_session)) -> list:
    """수집 방식별 산출물 요약.

    엔진은 프로젝트가 아니라 **수집 사건**의 속성이다(RecordingSession.kind).
    그래서 프로젝트를 엔진별로 쪼개지 않고, 엔진별로 "무엇을 모았는지"만 보여준다 —
    한 프로젝트에 트래픽 세션과 포털 세션이 함께 있는 것이 정상이기 때문이다.
    """
    kinds = ["traffic", "portal", "document"]
    out = []
    for kind in kinds:
        rows = db.exec(select(RecordingSession).where(RecordingSession.kind == kind)).all()
        candidates = 0
        project_ids = set()
        for row in rows:
            candidates += _session_view(row, db)["candidateCount"]
            project_ids.add(row.project_id)
        out.append({
            "kind": kind,
            "sessions": len(rows),
            "candidates": candidates,
            "projects": len(project_ids),
        })
    return out

@router.get("/api/collection-engines/{kind}/sessions")
def sessions_by_kind(kind: str, db: Session = Depends(get_session)) -> list:
    """한 수집 방식으로 모은 세션 전부. 프로젝트 경계를 넘어 훑는다."""
    if kind not in ("traffic", "portal", "document"):
        raise HTTPException(422, f"알 수 없는 수집 방식입니다: {kind!r}")

    rows = db.exec(
        select(RecordingSession)
        .where(RecordingSession.kind == kind)
        .order_by(RecordingSession.id.desc())
    ).all()

    projects = {p.id: p.name for p in db.exec(select(Project)).all()}
    out = []
    for row in rows:
        view = _session_view(row, db)
        # 엔진별 목록에서는 어느 프로젝트 것인지가 핵심 정보다.
        view["projectId"] = row.project_id
        view["projectName"] = projects.get(row.project_id, f"#{row.project_id}")
        out.append(view)
    return out

@router.delete("/api/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_session)) -> dict:
    """프로젝트와 그 안의 모든 것을 지운다.

    세션 삭제와 달리 **액션도 함께 지운다.** 액션은 project_id 로 프로젝트에
    매여 있어서, 프로젝트만 없애면 어디에도 속하지 않은 액션이 남는다. 그러면
    목록 조회로는 보이지 않는데 콘솔의 도구 목록에는 계속 뜬다.

    SQLite 에 ON DELETE CASCADE 를 걸지 않았으므로 자식부터 순서대로 지운다.
    되돌릴 수 없으므로 무엇이 지워졌는지 건수를 돌려준다 — 화면이 그대로
    사용자에게 알려줄 수 있어야 한다.
    """
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(404, "해당 프로젝트를 찾을 수 없습니다")

    sessions = db.exec(
        select(RecordingSession).where(RecordingSession.project_id == project_id)
    ).all()
    session_ids = [s.id for s in sessions]

    request_count = 0
    if session_ids:
        for child in db.exec(
            select(NetworkRequest).where(NetworkRequest.session_id.in_(session_ids))
        ).all():
            db.delete(child)
            request_count += 1
        for child in db.exec(
            select(InteractionEvent).where(InteractionEvent.session_id.in_(session_ids))
        ).all():
            db.delete(child)

    actions = db.exec(select(Action).where(Action.project_id == project_id)).all()
    for action in actions:
        db.delete(action)

    for row in sessions:
        db.delete(row)

    db.delete(project)
    db.commit()
    return {
        "ok": True,
        "deletedSessions": len(sessions),
        "deletedActions": len(actions),
        "deletedRequests": request_count,
    }

# 페이로드를 dict로 받으면 키 누락이 KeyError, 잘못된 시각이 ValueError가 되어
# 그대로 500이 된다. Pydantic으로 받으면 FastAPI가 422와 함께 어느 필드가
# 왜 틀렸는지 돌려준다. 검증이 DB 쓰기 전에 끝나는 것도 중요하다.
class InteractionIn(BaseModel):
    interactionId: str
    eventType: str
    pageUrl: str
    selector: str
    elementText: str = ""
    occurredAt: datetime          # JS toISOString()의 Z 접미사를 그대로 파싱한다

class NetworkIn(BaseModel):
    url: str
    method: str
    requestHeaders: Dict[str, str] = Field(default_factory=dict)
    requestBody: Optional[str] = None
    status: int
    responseText: str = ""
    durationMs: int = 0
    occurredAt: datetime
    interactionId: Optional[str] = None

class BulkIn(BaseModel):
    interactions: List[InteractionIn] = Field(default_factory=list)
    networks: List[NetworkIn] = Field(default_factory=list)

@router.post("/api/projects/{project_id}/recording-sessions")
def create_session(project_id: int, db: Session = Depends(get_session)) -> dict:
    row = RecordingSession(project_id=project_id, started_at=datetime.utcnow())
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id}

@router.post("/api/recording-sessions/{session_id}/bulk")
def bulk_upload(session_id: int, payload: BulkIn, db: Session = Depends(get_session)) -> dict:
    session_row = db.get(RecordingSession, session_id)
    if session_row is None:
        raise HTTPException(404, "해당 기록 세션을 찾을 수 없습니다")

    for item in payload.interactions:
        db.add(InteractionEvent(
            session_id=session_id,
            interaction_id=item.interactionId,
            event_type=item.eventType,
            page_url=item.pageUrl,
            element_selector=item.selector,
            element_text=item.elementText,
            occurred_at=item.occurredAt,
        ))

    for item in payload.networks:
        summary = summarize_response(item.responseText)
        # 응답 샘플에도 2차 마스킹을 적용한다. 요청만 가리면 응답에 실린
        # 개인정보가 그대로 저장된다.
        summary["sample"] = mask_deep(summary["sample"])
        db.add(NetworkRequest(
            session_id=session_id,
            interaction_id=item.interactionId,
            # 쿼리스트링의 민감 파라미터(sessionId, jumin 등)도 저장 전에
            # 가려야 한다. 이 값이 그대로 저장되면 schema_infer가 example로
            # 끌어올리고 tool_registry가 도구 설명에 박아 넣어 Azure로도
            # 전송된다 (PRD §7.4).
            request_url=mask_query(item.url),
            request_method=item.method,
            request_headers={k: mask_patterns(v) for k, v in item.requestHeaders.items()},
            request_body=mask_body(item.requestBody),
            response_status=item.status,
            response_preview=summary,
            is_json=summary["isJson"],
            duration_ms=item.durationMs,
            occurred_at=item.occurredAt,
        ))

    session_row.ended_at = datetime.utcnow()
    session_row.status = "COMPLETED"
    db.add(session_row)
    db.commit()
    return {"interactions": len(payload.interactions), "networks": len(payload.networks)}

@router.delete("/api/recording-sessions/{session_id}")
def delete_recording_session(session_id: int, db: Session = Depends(get_session)) -> dict:
    """세션과 그 자식 행을 지운다.

    SQLite에 ON DELETE CASCADE를 걸지 않았으므로 여기서 명시적으로 지운다.
    액션은 지우지 않는다 - Action은 네트워크 요청을 참조하지 않고
    action_spec에 값을 복사해 두므로 세션이 사라져도 그대로 실행된다.
    """
    row = db.get(RecordingSession, session_id)
    if row is None:
        raise HTTPException(404, "해당 기록 세션을 찾을 수 없습니다")

    for child in db.exec(
        select(NetworkRequest).where(NetworkRequest.session_id == session_id)
    ).all():
        db.delete(child)
    for child in db.exec(
        select(InteractionEvent).where(InteractionEvent.session_id == session_id)
    ).all():
        db.delete(child)

    db.delete(row)
    db.commit()
    return {"ok": True}
