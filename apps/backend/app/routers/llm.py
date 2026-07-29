import json
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from openai import AzureOpenAI
from sqlmodel import Session, select
from app.db import get_session
from app.models import Action, Project
from app.services.tool_registry import action_to_tool, dedupe_by_tool_name
from app.services.executor import execute_action

# apps/backend/.env 를 실행 위치와 무관하게 로드한다
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

router = APIRouter()

# 기본값을 두지 않는다. 누락되면 즉시 KeyError로 드러나야 한다.
client = AzureOpenAI(
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    api_key=os.environ["AZURE_OPENAI_API_KEY"],
    api_version=os.environ["AZURE_OPENAI_API_VERSION"],
)
DEPLOYMENT = os.environ["AZURE_OPENAI_DEPLOYMENT"]   # 모델명이 아니라 배포 이름

# 실측 결과: tools만 넘기면 finish_reason="stop"으로 도구를 호출하지 않고
# 한국어로 되묻는다(예: "지도 범위를 알려주세요"). 시스템 메시지와
# tool_choice="required"를 함께 줘야 finish_reason="tool_calls"가 나온다.
# 두 조치 중 하나만 있으면 촬영 중 콘솔이 응답만 하고 멈춘다.
SYSTEM = (
    "너는 사용자의 자연어 요청을 등록된 도구 호출로 변환하는 어시스턴트다. "
    "되묻지 말고 반드시 주어진 도구 중 하나를 호출하라. "
    "각 파라미터의 설명에 담긴 예시값을 참고해 값을 추론하라. "
    "위경도가 필요하면 한국의 실제 좌표를 사용하라."
)


@router.post("/api/projects/{project_id}/llm-test")
def select_tool(project_id: int, payload: dict, db: Session = Depends(get_session)) -> dict:
    actions = db.exec(
        select(Action).where(Action.project_id == project_id).where(Action.status == "ACTIVE")
    ).all()
    if not actions:
        raise HTTPException(400, "활성화된 액션이 없습니다")

    # 두 ACTIVE 액션이 같은 tool_name을 쓸 수 있다 (시드 데이터와 촬영 중
    # 새로 만든 액션이 충돌하는 경우). Azure는 중복 이름의 tools를 그대로
    # 받아주므로, 여기서 미리 이름별로 하나만 남기지 않으면 by_name 딕셔너리
    # 구성 시 행 순서에 따라 어느 쪽이 실행될지가 결정돼 버린다.
    actions = dedupe_by_tool_name(actions)

    tools = [action_to_tool(a) for a in actions]
    by_name = {t["function"]["name"]: a for t, a in zip(tools, actions)}

    response = client.chat.completions.create(
        model=DEPLOYMENT,
        max_completion_tokens=4096,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": payload["query"]},
        ],
        tools=tools,
        # "auto"로는 모델이 도구를 호출하지 않고 되물을 수 있음이 실측으로
        # 확인됐다. 반드시 도구를 고르게 강제한다.
        tool_choice="required",
    )

    message = response.choices[0].message
    if not message.tool_calls:
        return {"selectedTool": None, "reason": message.content or "적합한 도구를 찾지 못했습니다."}

    call = message.tool_calls[0]
    action = by_name[call.function.name]

    # arguments는 JSON 문자열로 온다. 모델이 깨진 JSON을 내보내면 500으로
    # 새지 않도록 여기서 명확한 오류로 바꾼다.
    try:
        arguments = json.loads(call.function.arguments)
    except json.JSONDecodeError as exc:
        raise HTTPException(502, f"모델이 잘못된 형식의 인자를 반환했습니다: {exc}") from exc

    return {
        "selectedTool": call.function.name,
        "actionId": action.id,
        "actionName": action.name,
        "arguments": arguments,
        "reason": message.content or "",
    }


@router.post("/api/actions/{action_id}/execute")
def execute(action_id: int, payload: dict, db: Session = Depends(get_session)) -> dict:
    action = db.get(Action, action_id)
    if action is None:
        raise HTTPException(404, "해당 액션을 찾을 수 없습니다")

    # 포털 공개 기반 수집으로 만든 액션은 serviceKey 를 LLM에게 숨겨두었다.
    # 실행 직전에 프로젝트에 등록된 인증키를 넘겨 executor 가 채우게 한다.
    project = db.get(Project, action.project_id)
    credentials = (project.credentials if project else None) or {}
    result = execute_action(action, payload["arguments"], credentials)

    summary_response = client.chat.completions.create(
        model=DEPLOYMENT,
        max_completion_tokens=1024,
        messages=[{
            "role": "user",
            "content": (
                f"사용자 질문: {payload.get('query', '')}\n\n"
                f"API 응답(일부): {result['rawPreview']}\n\n"
                "이 결과를 한국어 두세 문장으로 요약해라."
            ),
        }],
    )

    # rawPreview는 화면 표시 전용이다. 이 엔드포인트는 결과를 DB에 저장하지
    # 않지만, 앞으로 저장 로직이 추가되더라도 원문 응답을 영속화하지 않도록
    # 응답 딕셔너리 자체에서 rawPreview를 남겨두는 이유를 여기 남긴다
    # (전역 제약: 응답 본문 원문 저장 금지).
    return {**result, "summary": summary_response.choices[0].message.content or ""}
