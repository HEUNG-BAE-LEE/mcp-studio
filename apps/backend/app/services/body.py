import json
import re
from typing import Any, Optional
from xml.etree import ElementTree

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

def parse_xml_body(text: Optional[str]) -> Optional[Any]:
    """XML 응답을 dict 로 옮긴다.

    공공 API 는 아직 XML 만 주는 곳이 많다(우체국 도로명주소, 기상청 일부).
    JSON 이 아니라는 이유로 비워 두면 호출은 200 인데 모델에게는 아무것도
    전달되지 않아, 값이 멀쩡히 왔는데도 "결과가 없다" 고 답하게 된다.
    """
    if not text:
        return None
    stripped = text.strip()
    if not stripped.startswith("<"):
        return None
    # 선언부만 있고 본문이 없는 응답, HTML 오류 페이지는 제외한다.
    if stripped[:200].lower().lstrip("<?xml version=\"1.0\" encoding=\"utf-8\"?>").startswith("<html"):
        return None
    try:
        root = ElementTree.fromstring(stripped)
    except ElementTree.ParseError:
        return None
    return {_localname(root.tag): _from_xml(root)}


def _localname(tag: str) -> str:
    """{namespace}tag → tag. 네임스페이스가 붙으면 경로가 읽기 어려워진다."""
    return tag.rsplit("}", 1)[-1]


def _from_xml(node) -> Any:
    children = list(node)
    if not children:
        text = (node.text or "").strip()
        return text or None

    out: dict = {}
    for child in children:
        name = _localname(child.tag)
        value = _from_xml(child)
        if name in out:
            # 같은 이름이 반복되면 배열이다(<item>…</item> 여러 개).
            if not isinstance(out[name], list):
                out[name] = [out[name]]
            out[name].append(value)
        else:
            out[name] = value
    return out


def summarize_response(text: Optional[str]) -> dict:
    """응답을 구조 + 샘플 1건으로 축약한다 (PRD §7.4)."""
    parsed = parse_json_body(text)
    is_json = parsed is not None
    if parsed is None:
        parsed = parse_xml_body(text)
    if parsed is None:
        return {"isJson": False, "sample": None, "counts": {}}
    counts: dict = {}
    sample = _shrink(parsed, counts, path="")
    # isJson 은 "본문이 JSON 이었나" 를 그대로 뜻한다. XML 을 읽어 온 경우에도
    # sample 은 채워지므로, 화면과 모델은 형식과 무관하게 값을 볼 수 있다.
    return {"isJson": is_json, "sample": sample, "counts": counts}

def _escape_segment(key: str) -> str:
    """counts의 경로 키가 겹치지 않도록 구분자를 이스케이프한다.

    JSON 키에는 '.'이나 '[]'가 그대로 들어갈 수 있다("items[]" 같은 키가 실제로
    있다). 이스케이프하지 않으면 서로 다른 두 배열이 같은 경로 키를 만들어
    한쪽 개수가 조용히 덮인다.
    """
    return key.replace("\\", "\\\\").replace(".", "\\.").replace("[", "\\[").replace("]", "\\]")

def _shrink(value: Any, counts: dict, path: str) -> Any:
    if isinstance(value, list):
        counts[path or "root"] = len(value)
        return [_shrink(value[0], counts, f"{path}[]")] if value else []
    if isinstance(value, dict):
        return {
            k: _shrink(v, counts, _escape_segment(k) if not path else f"{path}.{_escape_segment(k)}")
            for k, v in value.items()
        }
    return value
