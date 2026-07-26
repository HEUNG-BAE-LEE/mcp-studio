import json
from typing import Any, Optional

def parse_json_body(text: Optional[str]) -> Optional[Any]:
    """Content-Type을 신뢰하지 않고 본문 파싱을 시도한다.

    국내 공공기관 사이트는 JSON을 text/html로 내려보내는 경우가 흔하다.
    """
    if not text:
        return None
    stripped = text.strip()
    if not stripped or stripped[0] not in "{[":
        return None
    try:
        return json.loads(stripped)
    except (json.JSONDecodeError, ValueError):
        return None

def summarize_response(text: Optional[str]) -> dict:
    """응답을 구조 + 샘플 1건으로 축약한다 (PRD §7.4)."""
    parsed = parse_json_body(text)
    if parsed is None:
        return {"isJson": False, "sample": None, "counts": {}}
    counts: dict = {}
    sample = _shrink(parsed, counts, path="")
    return {"isJson": True, "sample": sample, "counts": counts}

def _shrink(value: Any, counts: dict, path: str) -> Any:
    if isinstance(value, list):
        counts[path or "root"] = len(value)
        return [_shrink(value[0], counts, f"{path}[]")] if value else []
    if isinstance(value, dict):
        return {k: _shrink(v, counts, k if not path else f"{path}.{k}") for k, v in value.items()}
    return value
