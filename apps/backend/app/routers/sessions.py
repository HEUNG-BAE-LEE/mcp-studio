from datetime import datetime
from fastapi import APIRouter, Depends
from sqlmodel import Session
from app.db import get_session
from app.models import RecordingSession, InteractionEvent, NetworkRequest
from app.services.body import summarize_response
from app.services.masking import mask_patterns

router = APIRouter()

@router.post("/api/projects/{project_id}/recording-sessions")
def create_session(project_id: int, db: Session = Depends(get_session)) -> dict:
    row = RecordingSession(project_id=project_id, started_at=datetime.utcnow())
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id}

@router.post("/api/recording-sessions/{session_id}/bulk")
def bulk_upload(session_id: int, payload: dict, db: Session = Depends(get_session)) -> dict:
    for item in payload.get("interactions", []):
        db.add(InteractionEvent(
            session_id=session_id,
            interaction_id=item["interactionId"],
            event_type=item["eventType"],
            page_url=item["pageUrl"],
            element_selector=item["selector"],
            element_text=item["elementText"],
            occurred_at=datetime.fromisoformat(item["occurredAt"].replace("Z", "+00:00")),
        ))

    for item in payload.get("networks", []):
        summary = summarize_response(item.get("responseText"))
        db.add(NetworkRequest(
            session_id=session_id,
            interaction_id=item.get("interactionId"),
            request_url=item["url"],
            request_method=item["method"],
            request_headers={k: mask_patterns(v) for k, v in (item.get("requestHeaders") or {}).items()},
            request_body=mask_patterns(item.get("requestBody")),
            response_status=item["status"],
            response_preview=summary,
            is_json=summary["isJson"],
            duration_ms=item.get("durationMs", 0),
            occurred_at=datetime.fromisoformat(item["occurredAt"].replace("Z", "+00:00")),
        ))

    row = db.get(RecordingSession, session_id)
    if row:
        row.ended_at = datetime.utcnow()
        row.status = "COMPLETED"
        db.add(row)
    db.commit()
    return {
        "interactions": len(payload.get("interactions", [])),
        "networks": len(payload.get("networks", [])),
    }
