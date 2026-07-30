import json
import os
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
import httpx
from openai import AzureOpenAI
from sqlmodel import Session, select
from app.db import get_session
from app.models import Action, Project
from app.services.tool_registry import action_to_tool, dedupe_by_tool_name
from app.services.executor import execute_action

# apps/backend/.env 를 실행 위치와 무관하게 로드한다
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

router = APIRouter()

# 기본값을 두지 않는다. 누락은 드러나야 한다. 다만 드러나는 시점을 import 에서
# 첫 호출로 옮긴다 — 모듈을 읽는 것만으로 죽으면 컨테이너 배포에서 앱 전체가
# 기동하지 못해 LLM 과 무관한 수집·액션 화면까지 함께 사라진다.
def _require(name: str) -> str:
    try:
        return os.environ[name]
    except KeyError:
        raise HTTPException(503, f"Azure OpenAI 설정이 없습니다: {name}") from None


@lru_cache(maxsize=1)
def _client() -> AzureOpenAI:
    return AzureOpenAI(
        azure_endpoint=_require("AZURE_OPENAI_ENDPOINT"),
        api_key=_require("AZURE_OPENAI_API_KEY"),
        api_version=_require("AZURE_OPENAI_API_VERSION"),
    )


def _deployment() -> str:
    return _require("AZURE_OPENAI_DEPLOYMENT")   # 모델명이 아니라 배포 이름

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

    response = _client().chat.completions.create(
        model=_deployment(),
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
    try:
        result = execute_action(action, payload["arguments"], credentials)
    except ValueError as exc:
        # executor 는 인증키가 없거나 스펙과 method 가 어긋나면 ValueError 를 낸다.
        # 잡지 않으면 FastAPI 가 맨 "Internal Server Error" 를 내보내고, 공들여
        # 쓴 한국어 안내("인증키가 등록되어 있지 않습니다...")가 화면에 닿지 않는다.
        # 인증 없이 나간 호출의 400 을 스펙 문제로 오해하는 것을 막으려고 만든
        # 게이트인데, 메시지가 사라지면 그 목적이 무너진다.
        raise HTTPException(422, str(exc)) from exc

    summary_response = _client().chat.completions.create(
        model=_deployment(),
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


# ── 대화형 질의 ──────────────────────────────────────────────
#
# 위의 llm-test/execute 는 "도구를 고른다 → 실행한다"를 화면이 두 번 나눠
# 호출하는 구조다. 한 번 묻고 끝나는 검증용으로는 충분하지만, 대화가 이어지면
# 앞선 호출 결과를 다음 질문이 쓰지 못한다.
#
# 여기서는 한 요청 안에서 에이전트 루프를 돈다:
#   도구 선택 → 호출 → 결과를 모델에 돌려줌 → (필요하면 다시) → 최종 답변
#
# 화면 오른쪽에 "왜 이 도구였는지"를 보여줘야 하므로, 모델에게 호출 전에 이유를
# 한 문장 남기도록 시킨다. 이유 없이 결과만 보이면 도구를 잘못 골랐을 때
# 사용자가 그것을 알아챌 방법이 없다.

# 한 질문에 쓸 수 있는 도구 호출 수. 이 숫자를 넘기면 더 부르지 않는다.
#
# 상한이 없으면 모델이 결과가 마음에 들 때까지 계속 부른다. 공공 API 는 호출
# 간격 1초를 지키므로 그만큼 사용자가 기다리고, 인증키 쿼터도 그만큼 나간다.
# 3 은 "한 번 부르고, 부족하면 보완하고, 마지막으로 한 번 더" 까지 허용하는 값이다.
MAX_TOOL_CALLS = 3

CHAT_SYSTEM = (
    "너는 공공데이터 API 를 도구로 쓰는 한국어 어시스턴트다. 생각하고, 도구를 부르고,"
    " 그 결과를 본 뒤 다시 판단하는 방식으로 답을 만든다.\n"
    "- 도구를 호출하기 전에, 왜 그 도구를 골랐는지 한 문장으로 먼저 말하라.\n"
    "- 결과를 받으면 질문에 답하기 충분한지 판단하라. 부족하면 다른 도구를 이어서 불러 보완하라.\n"
    f"- 도구는 한 질문에 최대 {MAX_TOOL_CALLS}번까지만 부를 수 있다. 남은 횟수를 아껴 쓰라.\n"
    "- 충분해지면 더 부르지 말고 바로 답하라.\n"
    "- 각 파라미터 설명에 담긴 예시값을 참고해 값을 추론하라. 되묻지 말고 합리적인 값을 넣어라.\n"
    "- 위경도가 필요하면 한국의 실제 좌표를 쓰라.\n"
    "- 도구 결과를 받으면 그 안의 값만 근거로 답하라. 결과에 없는 수치를 지어내지 마라.\n"
    "- 호출이 실패했으면 실패했다고 그대로 알리고, 무엇이 필요한지 설명하라."
)


def _pool(actions: list) -> list:
    """화면 오른쪽에 보여줄 도구 목록. 무엇 중에서 골랐는지를 드러낸다."""
    return [{
        "toolName": (a.action_spec.get("toolName") or a.name),
        "actionId": a.id,
        "name": a.name,
        "sourceKind": a.source_kind or "traffic",
    } for a in actions]


@router.post("/api/projects/{project_id}/chat")
def chat(project_id: int, payload: dict, db: Session = Depends(get_session)) -> dict:
    actions = db.exec(
        select(Action).where(Action.project_id == project_id).where(Action.status == "ACTIVE")
    ).all()
    if not actions:
        raise HTTPException(400, "이 프로젝트에 사용 중인 MCP 도구가 없습니다. MCP 조회하기에서 도구를 활성화해 주세요")

    actions = dedupe_by_tool_name(actions)
    tools = [action_to_tool(a) for a in actions]
    by_name = {t["function"]["name"]: a for t, a in zip(tools, actions)}

    project = db.get(Project, project_id)
    credentials = (project.credentials if project else None) or {}

    history = [m for m in (payload.get("messages") or []) if m.get("content")]
    if not history:
        raise HTTPException(422, "질문을 입력해 주세요")

    convo = [{"role": "system", "content": CHAT_SYSTEM}] + [
        {"role": m["role"], "content": m["content"]} for m in history
    ]

    steps: list = []
    answer = ""
    truncated = False

    # ReAct 루프: 생각 → 호출 → 관찰 → 다시 판단. 도구 호출이 상한에 닿으면
    # 그 다음 요청에는 tools 를 아예 넘기지 않아, 모델이 더 부를 수단을 잃는다.
    # 프롬프트로만 막으면 모델이 어길 수 있으므로 도구 자체를 거둔다.
    # +1 은 도구를 다 쓴 뒤 답변을 만드는 마지막 한 바퀴다. tools 를 거두면
    # 모델이 도구를 부를 수단이 없어 정상적으로는 여기서 끝나지만, 카운터를 두어
    # 어떤 경우에도 루프가 돌아 나가지 못하는 일이 없게 한다.
    for _ in range(MAX_TOOL_CALLS + 1):
        remaining = MAX_TOOL_CALLS - len(steps)
        try:
            response = _client().chat.completions.create(
                model=_deployment(),
                max_completion_tokens=2048,
                messages=convo,
                **({"tools": tools,
                    # 첫 턴은 반드시 도구를 쓰게 한다. "auto" 로 두면 모델이 도구를
                    # 부르지 않고 아는 대로 답해 버려, 무엇을 검증하는 화면인지 흐려진다.
                    "tool_choice": "required" if not steps else "auto"}
                   if remaining > 0 else {}),
            )
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(502, f"LLM 호출에 실패했습니다 ({exc.__class__.__name__}). "
                                     "apps/backend/.env 의 Azure OpenAI 설정을 확인해 주세요") from exc

        message = response.choices[0].message
        why = (message.content or "").strip()

        if not message.tool_calls:
            answer = why
            break

        # 한 턴에 여러 도구를 부를 수 있다. 남은 예산만큼만 실행한다.
        calls = list(message.tool_calls)
        if len(calls) > remaining:
            truncated = True
            calls = calls[:remaining]

        convo.append({
            "role": "assistant",
            "content": message.content,
            "tool_calls": [{
                "id": c.id, "type": "function",
                "function": {"name": c.function.name, "arguments": c.function.arguments},
            } for c in calls],
        })

        for call in calls:
            action = by_name.get(call.function.name)
            try:
                arguments = json.loads(call.function.arguments or "{}")
            except json.JSONDecodeError:
                arguments = {}

            step = {
                "toolName": call.function.name,
                "actionId": action.id if action else None,
                "actionName": action.name if action else call.function.name,
                "sourceKind": (action.source_kind or "traffic") if action else "traffic",
                "why": why,
                "arguments": arguments,
            }

            if action is None:
                step["error"] = "모델이 등록되지 않은 도구를 불렀습니다"
                tool_output = step["error"]
            else:
                try:
                    result = execute_action(action, arguments, credentials)
                    step.update({
                        "status": result["status"],
                        "elapsedMs": result["elapsedMs"],
                        "request": result["requestPreview"],
                        "body": result["body"],
                        "rawPreview": result["rawPreview"],
                    })
                    # 상태 코드를 함께 넘긴다. 본문만 주면 401 응답을 받고도
                    # 모델이 "측정소명이 틀렸나" 같은 엉뚱한 원인을 추측한다.
                    status = result["status"]
                    if status == 401 or status == 403:
                        tool_output = (f"HTTP {status} 인증 실패. 프로젝트에 등록된 공공데이터포털"
                                       " 인증키가 유효하지 않습니다. 파라미터 문제가 아닙니다.")
                    elif status >= 400:
                        tool_output = (f"HTTP {status} 호출 실패. 응답: "
                                       + json.dumps(result["body"], ensure_ascii=False)[:1500])
                    else:
                        tool_output = json.dumps(result["body"], ensure_ascii=False)[:4000]
                except ValueError as exc:
                    # 인증키 누락 등 호출 전에 막힌 경우. 이 메시지는 이미 사람이 읽고
                    # 조치할 수 있는 문장이므로 그대로 쓴다. 대화를 끊지 않고 모델에게
                    # 넘겨, 사용자에게 무엇이 필요한지 말하게 한다.
                    step["error"] = str(exc)
                    tool_output = f"호출 실패: {exc}"
                except httpx.TimeoutException as exc:
                    # executor 는 전송 계층이라 httpx 예외를 그대로 올린다. 화면에
                    # "ReadTimeout: timed out" 이 그대로 나가면 읽는 사람이 무엇을
                    # 해야 할지 알 수 없으므로, 여기서 사람 말로 바꾼다.
                    step["error"] = ("공공 API 가 제한 시간 안에 응답하지 않았습니다."
                                     " 서버가 붐비거나 네트워크가 느린 상태입니다."
                                     " 잠시 후 다시 시도해 주세요.")
                    tool_output = f"호출 실패(응답 지연): {exc.__class__.__name__}"
                except httpx.HTTPError as exc:
                    step["error"] = (f"공공 API 를 호출하지 못했습니다 ({exc.__class__.__name__})."
                                     " 네트워크·VPN 상태를 확인해 주세요.")
                    tool_output = step["error"]
                except Exception as exc:  # noqa: BLE001
                    step["error"] = f"{exc.__class__.__name__}: {exc}"
                    tool_output = step["error"]

            steps.append(step)
            convo.append({"role": "tool", "tool_call_id": call.id, "content": tool_output})

    if not answer:
        # 상한까지 다 쓰고도 답이 없으면 마지막으로 정리만 시킨다. 이 요청에는
        # tools 를 넘기지 않으므로 네 번째 호출은 일어나지 않는다.
        try:
            final = _client().chat.completions.create(
                model=_deployment(), max_completion_tokens=1024,
                messages=convo + [{"role": "user", "content": "지금까지의 도구 결과로 한국어로 답해라."}],
            )
            answer = (final.choices[0].message.content or "").strip()
        except Exception:  # noqa: BLE001
            answer = "도구는 호출했지만 답변을 만들지 못했습니다. 오른쪽 로그에서 결과를 확인해 주세요."

    return {
        "answer": answer,
        "steps": steps,
        "pool": _pool(actions),
        "maxToolCalls": MAX_TOOL_CALLS,
        # 상한 때문에 잘렸는지 알려준다. 답이 부실할 때 이유가 되기 때문이다.
        "truncated": truncated or len(steps) >= MAX_TOOL_CALLS,
    }
