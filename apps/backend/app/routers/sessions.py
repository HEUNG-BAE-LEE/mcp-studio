from datetime import datetime
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session
from app.db import get_session
from app.models import RecordingSession, InteractionEvent, NetworkRequest
from app.services.body import summarize_response
from app.services.masking import mask_patterns, mask_deep

router = APIRouter()

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
            request_url=item.url,
            request_method=item.method,
            request_headers={k: mask_patterns(v) for k, v in item.requestHeaders.items()},
            request_body=mask_patterns(item.requestBody),
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
