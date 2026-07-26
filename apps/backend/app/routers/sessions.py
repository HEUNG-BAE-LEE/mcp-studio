from datetime import datetime
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select
from app.db import get_session
from app.models import Project, RecordingSession, InteractionEvent, NetworkRequest
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
