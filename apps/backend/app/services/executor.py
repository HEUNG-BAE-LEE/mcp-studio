import time
from typing import Optional
from urllib.parse import urlencode
import httpx
from app.models import Action
from app.services.body import summarize_response

MIN_INTERVAL_SEC = 1.0   # 공공 서버 부하 배려 (PRD 대상 사이트 설계 §4)

# 한 번의 호출을 기다리는 한도. 공공 API 는 붐빌 때 응답이 10초를 넘긴다.
REQUEST_TIMEOUT_SEC = 30.0
DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
)
_last_call_at = 0.0

# 본문에 인자를 싣는 메서드. 나머지는 쿼리스트링으로 보낸다.
BODY_METHODS = {"POST", "PUT", "PATCH"}

def _inject_credentials(schema: Optional[dict], arguments: dict, credentials: dict) -> dict:
    """LLM에게 숨긴 인증 파라미터를 실행 직전에 채운다.

    포털 공개 기반 수집으로 만든 액션은 serviceKey 를 llmEditable=False 로 두기 때문에
    LLM이 만든 arguments 에 그 값이 없다. 여기서 프로젝트에 등록된 키를 넣는다.
    키가 없으면 조용히 비우지 않고 바로 실패시킨다 — 인증 없이 나간 호출의
    401/400 을 스펙 문제로 오해하는 것이 더 비싸다.
    """
    if not schema:
        return arguments
    hidden = [k for k, d in schema.items() if not d.get("llmEditable", True)]
    if not hidden:
        return arguments

    filled = dict(arguments)
    for key in hidden:
        if key in filled:
            continue
        value = credentials.get(key) or credentials.get(key.lower())
        if not value and len(credentials) == 1:
            # 포털 하나만 등록된 흔한 경우, 파라미터 이름이 달라도 그 키를 쓴다.
            value = next(iter(credentials.values()))
        if not value:
            raise ValueError(
                f"'{key}' 인증키가 프로젝트에 등록되어 있지 않습니다. "
                "프로젝트 설정에서 포털 인증키를 등록한 뒤 다시 실행하세요."
            )
        filled[key] = value
    return filled


def build_request(action: Action, arguments: dict, credentials: Optional[dict] = None) -> dict:
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
            arguments = _inject_credentials(schema, arguments, credentials or {})
            headers.setdefault("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
            content = urlencode(arguments)
    else:
        schema = request.get("querySchema")
        if arguments and not schema:
            raise ValueError(f"{method} 스펙에 querySchema가 없어 인자를 실을 곳이 없다: {sorted(arguments)}")
        if schema:
            arguments = _inject_credentials(schema, arguments, credentials or {})
        if arguments:
            url = f"{url}?{urlencode(arguments)}"

    return {"method": method, "url": url, "headers": headers, "content": content}

def execute_action(action: Action, arguments: dict, credentials: Optional[dict] = None) -> dict:
    """조립한 요청을 실제로 호출하고 응답을 요약한다.

    _last_call_at은 프로세스 전역이다 — 이 데모는 uvicorn 워커 1개로 동작하며,
    공공 서버 전체에 대한 호출 간격을 배려하려는 의도이므로 액션별 제한으로
    바꾸지 않는다.
    """
    global _last_call_at
    # 조립을 먼저 한다 — 스펙이 잘못돼 호출이 나가지도 못할 때 1초를 헛되이 자지 않는다.
    prepared = build_request(action, arguments, credentials)

    elapsed_since_last = time.monotonic() - _last_call_at
    if elapsed_since_last < MIN_INTERVAL_SEC:
        time.sleep(MIN_INTERVAL_SEC - elapsed_since_last)

    started = time.monotonic()
    try:
        # 공공 API 는 느릴 때 응답 하나에 10초를 넘기기도 한다(사내 VPN 을 거치면
        # 더 늘어난다). 20초로는 정상 응답까지 끊겨 "서버가 죽었나" 로 보인다.
        with httpx.Client(timeout=REQUEST_TIMEOUT_SEC) as client:
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
