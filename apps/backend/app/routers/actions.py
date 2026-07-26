from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.db import get_session
from app.models import NetworkRequest, Action
from app.services.schema_infer import build_action_spec

router = APIRouter()

@router.post("/api/actions")
def create_action(payload: dict, db: Session = Depends(get_session)) -> dict:
    req = db.get(NetworkRequest, payload["networkRequestId"])
    if req is None:
        raise HTTPException(404, "해당 네트워크 요청을 찾을 수 없습니다")
    spec = build_action_spec(
        req,
        name=payload["name"],
        tool_name=payload["toolName"],
        description=payload.get("description", ""),
    )
    action = Action(
        project_id=payload["projectId"],
        name=payload["name"],
        tool_name=payload["toolName"],
        description=payload.get("description", ""),
        action_spec=spec,
        status="DRAFT",
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return {"id": action.id, "actionSpec": spec}

# Task 14가 status == "ACTIVE" 로 필터한다. 오타("Active", "ACTVE")를 그대로
# 받으면 액션이 조용히 목록에서 사라지고 아무 오류도 나지 않는다.
VALID_STATUS = {"DRAFT", "ACTIVE", "ARCHIVED"}

@router.put("/api/actions/{action_id}")
def update_action(action_id: int, payload: dict, db: Session = Depends(get_session)) -> dict:
    action = db.get(Action, action_id)
    if action is None:
        raise HTTPException(404, "해당 액션을 찾을 수 없습니다")

    status = payload.get("status", action.status)
    if status not in VALID_STATUS:
        raise HTTPException(422, f"status는 {sorted(VALID_STATUS)} 중 하나여야 합니다: {status!r}")

    action.action_spec = payload.get("actionSpec", action.action_spec)
    action.description = payload.get("description", action.description)
    action.status = status
    db.add(action)
    db.commit()
    return {"ok": True}

@router.get("/api/projects/{project_id}/actions")
def list_actions(project_id: int, db: Session = Depends(get_session)) -> list:
    rows = db.exec(select(Action).where(Action.project_id == project_id)).all()
    return [
        {"id": a.id, "name": a.name, "toolName": a.tool_name,
         "description": a.description, "status": a.status, "actionSpec": a.action_spec}
        for a in rows
    ]
