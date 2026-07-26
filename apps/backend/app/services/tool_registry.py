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
        properties[key] = {
            "type": definition.get("type", "string"),
            "description": definition.get("description") or key,
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
