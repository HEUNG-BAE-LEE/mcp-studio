"""포털 공개 기반 수집 엔드포인트.

확장이 "사용자가 이미 연 페이지"의 HTML을 통째로 보내면 여기서 파싱한다.
서버가 포털을 직접 순회하지 않는 이유는 spec_parser 모듈 주석에 적어두었다.
"""

import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import get_session
from app.models import Action, Project, RecordingSession, SpecOperation
from app.services.schema_infer import build_action_spec_from_spec
from app.services.spec_parser import PORTAL_LABELS, detect_portal, parse

router = APIRouter()


class SpecCollectIn(BaseModel):
    url: str
    html: str


def _tool_name(op_name: str) -> str:
    """오퍼레이션 이름을 OpenAI 도구 이름 규칙(영숫자·밑줄)으로 다듬는다."""
    ascii_only = re.sub(r"[^A-Za-z0-9_-]", "", op_name)
    if not ascii_only:
        return "new_action"
    snake = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", ascii_only).lower()
    return re.sub(r"[-]+", "_", snake).strip("_") or "new_action"


@router.post("/api/projects/{project_id}/spec-sessions")
def collect_spec(project_id: int, payload: SpecCollectIn, db: Session = Depends(get_session)) -> dict:
    """명세 페이지 HTML을 받아 수집 세션과 오퍼레이션 후보를 만든다.

    같은 서비스를 다시 수집하면 **직전 세션에 누적**한다. 포털 상세페이지는
    상세기능을 select 로 전환하는 구조라, 사용자가 목록을 바꿔가며 여러 번
    수집하는 것이 정상 사용 흐름이기 때문이다. 매번 새 세션을 만들면
    한 서비스가 5개 세션으로 흩어진다.
    """
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(404, "해당 프로젝트를 찾을 수 없습니다")

    if detect_portal(payload.url) is None:
        raise HTTPException(422, "아직 지원하지 않는 포털입니다. 현재는 공공데이터포털만 수집할 수 있습니다")

    page = parse(payload.html, payload.url)
    if not page.operations:
        raise HTTPException(
            422,
            "이 페이지에서 API 명세를 찾지 못했습니다. 오픈API 상세페이지인지 확인해 주세요",
        )

    label = PORTAL_LABELS.get(detect_portal(payload.url), page.portal)
    session_row = db.exec(
        select(RecordingSession)
        .where(RecordingSession.project_id == project_id)
        .where(RecordingSession.kind == "portal")
        .where(RecordingSession.source_label == page.service_name)
        .order_by(RecordingSession.id.desc())
    ).first()

    if session_row is None:
        session_row = RecordingSession(
            project_id=project_id,
            started_at=datetime.utcnow(),
            ended_at=datetime.utcnow(),
            status="COMPLETED",
            kind="portal",
            source_label=page.service_name,
        )
        db.add(session_row)
        db.commit()
        db.refresh(session_row)

    existing = {
        row.op_name
        for row in db.exec(
            select(SpecOperation).where(SpecOperation.session_id == session_row.id)
        ).all()
    }

    added = 0
    for op in page.operations:
        if op.op_name in existing:
            continue
        db.add(SpecOperation(
            session_id=session_row.id,
            portal=page.portal,
            service_name=page.service_name,
            provider=page.provider,
            op_name=op.op_name,
            summary=op.summary,
            method=op.method,
            base_url=op.base_url,
            path=op.path,
            params=[p.__dict__ for p in op.params],
            response_fields=op.response_fields,
            warnings=op.warnings,
            source_url=payload.url,
            parsed_at=datetime.utcnow(),
        ))
        added += 1
    db.commit()

    collected = len(existing) + added
    return {
        "sessionId": session_row.id,
        "portal": page.portal,
        "portalLabel": label,
        "serviceName": page.service_name,
        "provider": page.provider,
        "added": added,
        "collected": collected,
        # 이 서비스에 상세기능이 몇 개인지. 화면은 "5개 중 2개 수집됨"을 보여주고
        # 나머지는 목록에서 선택해 다시 수집하라고 안내한다.
        "availableTotal": len(page.available),
        "available": [item["label"] for item in page.available],
    }


@router.get("/api/recording-sessions/{session_id}/spec-operations")
def list_spec_operations(session_id: int, db: Session = Depends(get_session)) -> list:
    rows = db.exec(
        select(SpecOperation).where(SpecOperation.session_id == session_id).order_by(SpecOperation.id)
    ).all()
    return [{
        "id": row.id,
        "opName": row.op_name,
        "summary": row.summary,
        "method": row.method,
        "url": f"{row.base_url}{row.path}",
        "serviceName": row.service_name,
        "provider": row.provider,
        "portal": row.portal,
        "paramCount": len(row.params),
        "requiredCount": sum(1 for p in row.params if p.get("required")),
        "responseFieldCount": len(row.response_fields),
        "params": row.params,
        "warnings": row.warnings,
        "sourceUrl": row.source_url,
    } for row in rows]


@router.post("/api/spec-operations/{operation_id}/actions")
def create_action_from_spec(operation_id: int, payload: dict, db: Session = Depends(get_session)) -> dict:
    """오퍼레이션 후보를 액션으로 승격한다.

    트래픽 경로(actions.create_action)와 **같은 형태의 action_spec** 을 만든다.
    그래서 이후 실행·LLM 콘솔은 어느 수집 방식에서 왔는지 알 필요가 없다.
    """
    op = db.get(SpecOperation, operation_id)
    if op is None:
        raise HTTPException(404, "해당 오퍼레이션을 찾을 수 없습니다")

    session_row = db.get(RecordingSession, op.session_id)
    if session_row is None:
        raise HTTPException(404, "해당 수집 세션을 찾을 수 없습니다")

    name = (payload.get("name") or "").strip() or op.summary or op.op_name
    tool_name = (payload.get("toolName") or "").strip() or _tool_name(op.op_name)
    description = (payload.get("description") or "").strip() or (
        f"[{op.provider}] {op.service_name} — {op.op_name}".strip(" —[]")
    )

    spec = build_action_spec_from_spec(op, name=name, tool_name=tool_name, description=description)
    action = Action(
        project_id=session_row.project_id,
        name=name,
        tool_name=tool_name,
        description=description,
        action_spec=spec,
        status=payload.get("status", "DRAFT"),
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return {"id": action.id, "name": action.name, "toolName": action.tool_name, "status": action.status}


class CredentialIn(BaseModel):
    portal: str
    value: str


@router.put("/api/projects/{project_id}/credentials")
def set_credential(project_id: int, payload: CredentialIn, db: Session = Depends(get_session)) -> dict:
    """포털 인증키를 등록한다. 실행 시점에 숨김 파라미터로 주입된다."""
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(404, "해당 프로젝트를 찾을 수 없습니다")
    # SQLModel 의 JSON 컬럼은 제자리 수정을 감지하지 못한다. 새 dict 를 대입해야 저장된다.
    project.credentials = {**(project.credentials or {}), payload.portal: payload.value}
    db.add(project)
    db.commit()
    return {"portal": payload.portal, "registered": True}


@router.get("/api/projects/{project_id}/credentials")
def list_credentials(project_id: int, db: Session = Depends(get_session)) -> list:
    """등록 여부만 돌려준다. 키 값 자체는 화면에 내려보내지 않는다."""
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(404, "해당 프로젝트를 찾을 수 없습니다")
    return [
        {"portal": portal, "masked": (value[:4] + "****") if len(value) > 4 else "****"}
        for portal, value in (project.credentials or {}).items()
    ]
