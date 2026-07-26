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

# 본문에 인자를 싣는 메서드. 나머지는 쿼리스트링으로 보낸다.
BODY_METHODS = {"POST", "PUT", "PATCH"}

def build_request(action: Action, arguments: dict) -> dict:
    """ActionSpec과 LLM이 만든 인자로 실제 HTTP 요청을 조립한다.

    보존된 헤더를 재현하지 않으면 WAF가 400 Request Blocked를 반환한다.

    인자를 어디에 실을지는 method로 정한다. 어느 스키마 키가 채워져 있는지로
    추론하면, method와 스키마가 어긋난 스펙에서 인자가 조용히 사라진다.
    """
    request = action.action_spec["request"]
    headers = dict(request.get("headers") or {})
    headers.setdefault("User-Agent", DEFAULT_UA)
    headers.setdefault("Accept", "application/json, text/javascript, */*; q=0.01")

    method = request["method"].upper()
    url = request["urlTemplate"]
    content = None

    if method in BODY_METHODS:
        schema = request.get("bodySchema")
        if arguments and not schema:
            raise ValueError(f"{method} 스펙에 bodySchema가 없어 인자를 실을 곳이 없다: {sorted(arguments)}")
        if schema:
            headers.setdefault("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
            content = urlencode(arguments)
    else:
        schema = request.get("querySchema")
        if arguments and not schema:
            raise ValueError(f"{method} 스펙에 querySchema가 없어 인자를 실을 곳이 없다: {sorted(arguments)}")
        if arguments:
            url = f"{url}?{urlencode(arguments)}"

    return {"method": method, "url": url, "headers": headers, "content": content}

def execute_action(action: Action, arguments: dict) -> dict:
    """조립한 요청을 실제로 호출하고 응답을 요약한다.

    _last_call_at은 프로세스 전역이다 — 이 데모는 uvicorn 워커 1개로 동작하며,
    공공 서버 전체에 대한 호출 간격을 배려하려는 의도이므로 액션별 제한으로
    바꾸지 않는다.
    """
    global _last_call_at
    # 조립을 먼저 한다 — 스펙이 잘못돼 호출이 나가지도 못할 때 1초를 헛되이 자지 않는다.
    prepared = build_request(action, arguments)

    elapsed_since_last = time.monotonic() - _last_call_at
    if elapsed_since_last < MIN_INTERVAL_SEC:
        time.sleep(MIN_INTERVAL_SEC - elapsed_since_last)

    started = time.monotonic()
    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.request(
                prepared["method"], prepared["url"],
                headers=prepared["headers"], content=prepared["content"],
            )
    finally:
        # 성공/실패와 무관하게 갱신한다. 실패 시 건너뛰면 다음 호출이 낡은
        # 타임스탬프와 비교해 간격 없이 즉시 나가고, 재시도가 폭주한다.
        _last_call_at = time.monotonic()

    return {
        "status": response.status_code,
        "elapsedMs": int((time.monotonic() - started) * 1000),
        "requestPreview": {k: v for k, v in prepared.items() if k != "headers"},
        "body": summarize_response(response.text),
        "rawPreview": response.text[:2000],
    }
