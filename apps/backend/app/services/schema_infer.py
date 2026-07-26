from typing import Any, Optional
from urllib.parse import urlparse, parse_qsl

# 실행 시 재현해야 하는 헤더 (PRD §7.7). WAF가 검사한다.
#
# 기록된 헤더 이름의 대소문자는 페이지가 보낸 그대로다 — 실제 캡처에
# Referer, X-Requested-With, content-type 이 뒤섞여 들어온다.
# 스펙에 쓸 때는 정규 표기로 통일한다. 통일하지 않으면 Task 13의
# headers.setdefault("User-Agent", ...) 가 기록된 "user-agent"를 못 보고
# 같은 헤더를 두 번 실어 보낸다.
PRESERVED_HEADERS = {
    "user-agent": "User-Agent",
    "referer": "Referer",
    "x-requested-with": "X-Requested-With",
    "accept": "Accept",
    "content-type": "Content-Type",
}

def _infer_type(raw: str) -> str:
    try:
        int(raw)
        return "integer"
    except ValueError:
        pass
    try:
        float(raw)
        return "number"
    except ValueError:
        pass
    if raw.lower() in ("true", "false"):
        return "boolean"
    return "string"

def _pairs_to_schema(pairs) -> dict:
    schema = {}
    for key, value in pairs:
        schema[key] = {
            "type": _infer_type(value),
            "description": "",
            "required": True,
            "example": value,
            "llmEditable": True,
        }
    return schema

def infer_request_schema(method: str, url: str, body: Optional[str]) -> dict:
    query_pairs = parse_qsl(urlparse(url).query, keep_blank_values=True)
    body_pairs = []
    if body and "=" in body and not body.strip().startswith("{"):
        body_pairs = parse_qsl(body, keep_blank_values=True)
    return {
        "querySchema": _pairs_to_schema(query_pairs) or None,
        "bodySchema": _pairs_to_schema(body_pairs) or None,
    }

def infer_response_schema(sample: Any) -> dict:
    return _walk(sample)

def _walk(value: Any) -> dict:
    if isinstance(value, list):
        return {"type": "array", "items": _walk(value[0]) if value else {"type": "object"}}
    if isinstance(value, dict):
        return {"type": "object", "properties": {k: _walk(v) for k, v in value.items()}}
    if isinstance(value, bool):
        return {"type": "boolean"}
    if isinstance(value, int):
        return {"type": "integer"}
    if isinstance(value, float):
        return {"type": "number"}
    return {"type": "string"}

def build_action_spec(req, name: str, tool_name: str, description: str) -> dict:
    request_schema = infer_request_schema(req.request_method, req.request_url, req.request_body)
    sample = (req.response_preview or {}).get("sample")
    # 마스킹된 값("***")은 싣지 않는다. 깨진 인증 헤더를 재현하는 것은
    # 아예 빼는 것보다 나쁘다.
    headers = {
        PRESERVED_HEADERS[k.lower()]: v
        for k, v in (req.request_headers or {}).items()
        if k.lower() in PRESERVED_HEADERS and v != "***"
    }
    return {
        "name": name,
        "toolName": tool_name,
        "description": description,
        "trigger": {"pageUrlPattern": urlparse(req.request_url).path},
        "request": {
            "method": req.request_method,
            "urlTemplate": req.request_url.split("?")[0],
            "headers": headers,
            **request_schema,
        },
        "response": {
            "successStatus": [200],
            "schema": infer_response_schema(sample) if sample else {"type": "object"},
        },
        "execution": {"authMode": "NONE", "credentialId": None, "requiresConfirmation": False},
    }
