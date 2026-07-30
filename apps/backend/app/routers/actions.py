import re
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.db import get_session
from app.models import NetworkRequest, RecordingSession, Action
from app.services.schema_infer import build_action_spec

router = APIRouter()

def derive_names(url: str) -> tuple:
    """기록된 URL에서 액션 이름과 Tool 이름의 초안을 만든다.

    예전에는 프런트엔드가 "아파트 단지 조회" / "search_apartment_markers" 를
    하드코딩해 보냈다. 어떤 사이트를 기록해도 아파트 이름을 달고 태어났고,
    설명은 LLM이 도구를 고르는 유일한 근거라 실제와 다르면 모델이 엉뚱한
    도구를 부른다.

    실제 경로에서 끌어낸다: /cmm/emdList.do -> "emdList" / "emd_list".
    좋은 이름은 아니지만 **거짓말은 아니다.** 사람이 고쳐 쓰라는 초안이다.
    """
    path = urlparse(url or "").path
    segment = path.rstrip("/").split("/")[-1] if path else ""
    segment = re.sub(r"\.[A-Za-z0-9]{1,6}$", "", segment)     # .do, .json 등 확장자 제거
    segment = re.sub(r"[^A-Za-z0-9가-힣_-]", "", segment)

    if not segment:
        return "새 액션", "new_action"

    # OpenAI 도구 이름은 영숫자·밑줄·하이픈만 허용한다. 한글 경로면 쓸 수 없다.
    ascii_only = re.sub(r"[^A-Za-z0-9_-]", "", segment)
    if ascii_only:
        snake = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", ascii_only).lower()
        snake = re.sub(r"[-]+", "_", snake).strip("_") or "new_action"
    else:
        snake = "new_action"
    return segment, snake

@router.post("/api/actions")
def create_action(payload: dict, db: Session = Depends(get_session)) -> dict:
    req = db.get(NetworkRequest, payload["networkRequestId"])
    if req is None:
        raise HTTPException(404, "해당 네트워크 요청을 찾을 수 없습니다")

    # projectId는 더 이상 페이로드에서 신뢰하지 않는다. 네트워크 요청이 속한
    # 기록 세션의 project_id로부터 직접 유도해야, 프론트엔드가 실수로라도
    # 다른 프로젝트에 액션을 붙일 수 없다.
    session_row = db.get(RecordingSession, req.session_id)
    if session_row is None:
        raise HTTPException(404, "해당 기록 세션을 찾을 수 없습니다")

    # 이름을 주지 않으면 기록된 URL에서 초안을 만든다. 하드코딩된 기본값을
    # 쓰면 어떤 사이트를 기록해도 같은 이름을 달고 태어난다.
    default_name, default_tool = derive_names(req.request_url)
    name = (payload.get("name") or "").strip() or default_name
    tool_name = (payload.get("toolName") or "").strip() or default_tool

    spec = build_action_spec(
        req,
        name=name,
        tool_name=tool_name,
        description=payload.get("description", ""),
    )
    action = Action(
        project_id=session_row.project_id,
        name=name,
        tool_name=tool_name,
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
        raise HTTPException(404, "해당 MCP 도구를 찾을 수 없습니다")

    status = payload.get("status", action.status)
    if status not in VALID_STATUS:
        raise HTTPException(422, f"status는 {sorted(VALID_STATUS)} 중 하나여야 합니다: {status!r}")

    # name·toolName은 선택 값이다. 키 자체를 보내지 않으면(예: ActionList의
    # 상태 토글이 {status}만 보낼 때) 기존 값을 그대로 둔다. 키를 보냈는데
    # 공백뿐이면 액션명을 지워버리는 대신 막는다.
    name = action.name
    if "name" in payload:
        name = (payload.get("name") or "").strip()
        if not name:
            raise HTTPException(422, "MCP 도구 이름을 입력해 주세요")

    tool_name = action.tool_name
    if "toolName" in payload:
        tool_name = (payload.get("toolName") or "").strip()
        if not tool_name:
            raise HTTPException(422, "Tool 이름을 입력해 주세요")

    action.action_spec = payload.get("actionSpec", action.action_spec)
    action.description = payload.get("description", action.description)
    action.status = status
    action.name = name
    action.tool_name = tool_name

    # actionSpec은 name·toolName을 따로 담고 있고 action_to_tool()이 그 값을
    # 읽는다. 방금 확정된 이름으로 맞춰두지 않으면 이름을 바꿔도 LLM에게
    # 노출되는 tool 정의는 예전 이름 그대로 남는다.
    if isinstance(action.action_spec, dict):
        action.action_spec = {**action.action_spec, "name": action.name, "toolName": action.tool_name}

    db.add(action)
    db.commit()
    return {"ok": True}

@router.get("/api/actions/{action_id}")
def get_action(action_id: int, db: Session = Depends(get_session)) -> dict:
    action = db.get(Action, action_id)
    if action is None:
        raise HTTPException(404, "해당 MCP 도구를 찾을 수 없습니다")
    return {
        "id": action.id,
        "projectId": action.project_id,
        "name": action.name,
        "toolName": action.tool_name,
        "description": action.description,
        "actionSpec": action.action_spec,
        "status": action.status,
    }

@router.get("/api/projects/{project_id}/actions")
def list_actions(project_id: int, db: Session = Depends(get_session)) -> list:
    rows = db.exec(select(Action).where(Action.project_id == project_id)).all()
    return [
        {"id": a.id, "name": a.name, "toolName": a.tool_name,
         "description": a.description, "status": a.status, "actionSpec": a.action_spec,
         "sourceKind": a.source_kind or "traffic"}
        for a in rows
    ]

@router.delete("/api/actions/{action_id}")
def delete_action(action_id: int, db: Session = Depends(get_session)) -> dict:
    action = db.get(Action, action_id)
    if action is None:
        raise HTTPException(404, "해당 MCP 도구를 찾을 수 없습니다")
    db.delete(action)
    db.commit()
    return {"ok": True}
