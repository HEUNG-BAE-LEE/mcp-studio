from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from app.db import get_session
from app.models import InteractionEvent, NetworkRequest
from app.services.scoring import score_request

router = APIRouter()

@router.get("/api/recording-sessions/{session_id}/candidates")
def candidates(session_id: int, db: Session = Depends(get_session)) -> list:
    interactions = db.exec(
        select(InteractionEvent)
        .where(InteractionEvent.session_id == session_id)
        .order_by(InteractionEvent.occurred_at)
    ).all()

    result = []
    for interaction in interactions:
        requests = db.exec(
            select(NetworkRequest)
            .where(NetworkRequest.session_id == session_id)
            .where(NetworkRequest.interaction_id == interaction.interaction_id)
            .order_by(NetworkRequest.occurred_at)
        ).all()

        # 채점 대상 요청 자신도 형제 URL 목록에 포함해야 한다.
        # score_request의 폴링 판정은 count >= 2 기준이므로 자기 자신을 빼면
        # 실제로는 반복 호출된 URL이 1회로 잡혀 폴링 감점이 누락된다.
        sibling_urls = [r.request_url for r in requests]
        scored = []
        for req in requests:
            score, reasons = score_request(req, interaction.occurred_at, sibling_urls)
            req.score = score
            req.score_reasons = reasons
            db.add(req)
            scored.append({
                "id": req.id,
                "url": req.request_url,
                "method": req.request_method,
                "status": req.response_status,
                "isJson": req.is_json,
                "durationMs": req.duration_ms,
                "score": score,
                "reasons": reasons,
                "sample": req.response_preview.get("sample"),
                "requestBody": req.request_body,
            })

        scored.sort(key=lambda c: c["score"], reverse=True)
        result.append({
            "interaction": {
                "id": interaction.interaction_id,
                "selector": interaction.element_selector,
                "text": interaction.element_text,
                "pageUrl": interaction.page_url,
                "occurredAt": interaction.occurred_at.isoformat(),
            },
            "totalRequests": len(scored),
            "candidates": scored,
        })

    db.commit()
    return result
