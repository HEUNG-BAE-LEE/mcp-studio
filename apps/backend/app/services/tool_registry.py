# apps/backend/app/services/tool_registry.py
from app.models import Action


def action_to_tool(action: Action) -> dict:
    """ActionSpec을 OpenAI function calling 정의로 변환한다.

    llmEditable이 False인 파라미터는 시스템이 실행 시점에 주입하는 값이므로
    LLM에게 노출하지 않는다 (properties/required 모두에서 제외).
    description이 비어 있으면 파라미터 이름으로 대체한다.
    """
    spec = action.action_spec
    request = spec.get("request", {})
    schema = request.get("bodySchema") or request.get("querySchema") or {}

    properties = {}
    required = []
    for key, definition in schema.items():
        if not definition.get("llmEditable", True):
            continue

        # 기록된 실제 값을 description에 녹인다.
        #
        # function calling의 parameters는 순수 JSON Schema이고, 모델이 확실히
        # 읽도록 학습된 필드는 description이다. 비표준 example 키를 넣어도
        # 무시될 수 있다.
        #
        # 이 힌트가 없으면 모델은 "광화문 근처 아파트"라는 질문만으로 경위도
        # 바운딩 박스를 지어내야 하고, poiType="A" 같은 사이트 고유 코드는
        # 아예 추측이 불가능하다.
        base = definition.get("description") or key
        example = definition.get("example")
        description = f"{base} (예: {example})" if example not in (None, "") else base

        properties[key] = {
            "type": definition.get("type", "string"),
            "description": description,
        }
        if definition.get("required"):
            required.append(key)

    return {
        "type": "function",
        "function": {
            "name": spec.get("toolName", action.tool_name),
            "description": spec.get("description", action.description),
            "parameters": {"type": "object", "properties": properties, "required": required},
        },
    }
