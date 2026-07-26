import time
from urllib.parse import urlencode
import httpx
from app.models import Action
from app.services.body import summarize_response

MIN_INTERVAL_SEC = 1.0   # 공공 서버 부하 배려 (PRD 대상 사이트 설계 §4)
DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
)
_last_call_at = 0.0

def build_request(action: Action, arguments: dict) -> dict:
    """ActionSpec과 LLM이 만든 인자로 실제 HTTP 요청을 조립한다.

    보존된 헤더를 재현하지 않으면 WAF가 400 Request Blocked를 반환한다.
    """
    request = action.action_spec["request"]
    headers = dict(request.get("headers") or {})
    headers.setdefault("User-Agent", DEFAULT_UA)
    headers.setdefault("Accept", "application/json, text/javascript, */*; q=0.01")

    method = request["method"].upper()
    url = request["urlTemplate"]
    content = None

    if request.get("bodySchema"):
        headers.setdefault("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
        content = urlencode(arguments)
    elif request.get("querySchema") and arguments:
        url = f"{url}?{urlencode(arguments)}"

    return {"method": method, "url": url, "headers": headers, "content": content}

def execute_action(action: Action, arguments: dict) -> dict:
    """조립한 요청을 실제로 호출하고 응답을 요약한다.

    _last_call_at은 프로세스 전역이다 — 이 데모는 uvicorn 워커 1개로 동작하며,
    공공 서버 전체에 대한 호출 간격을 배려하려는 의도이므로 액션별 제한으로
    바꾸지 않는다.
    """
    global _last_call_at
    elapsed_since_last = time.monotonic() - _last_call_at
    if elapsed_since_last < MIN_INTERVAL_SEC:
        time.sleep(MIN_INTERVAL_SEC - elapsed_since_last)

    prepared = build_request(action, arguments)
    started = time.monotonic()
    with httpx.Client(timeout=20.0) as client:
        response = client.request(
            prepared["method"], prepared["url"],
            headers=prepared["headers"], content=prepared["content"],
        )
    _last_call_at = time.monotonic()

    return {
        "status": response.status_code,
        "elapsedMs": int((time.monotonic() - started) * 1000),
        "requestPreview": {k: v for k, v in prepared.items() if k != "headers"},
        "body": summarize_response(response.text),
        "rawPreview": response.text[:2000],
    }
