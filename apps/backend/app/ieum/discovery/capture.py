"""자동 탐색(크롤러)과 업무 기록(레코더)이 함께 쓰는 네트워크 판정.

Playwright 객체를 부르지 않는다. 크롤러는 동기, 레코더는 비동기 Playwright 를 써서 route.continue_() 나
response.text() 를 부르는 방식이 다르기 때문이다. 판정은 여기서 하고, 호출은 각자 한다.

response_kind 는 크롤러 전용이다. 크롤러는 화면 이동(document) 응답을 버리지만, 레코더는 서버가 결과 표를
그려 주는 레거시 화면 때문에 document 응답도 기록해야 한다(recorder/trace.py).
"""
import json
from typing import Dict, Optional, Tuple
from urllib.parse import parse_qsl, urlsplit

from app.ieum.discovery.masking import is_secret_key
from app.ieum.discovery.policy import Policy, is_asset, risky_call

# 화면을 그리는 자원이라 API 후보가 아니다.
STATIC_TYPES = {"image", "stylesheet", "font", "media", "script", "manifest", "texttrack", "websocket", "eventsource"}
FILE_TYPES = ("spreadsheetml", "ms-excel", "octet-stream", "pdf", "zip", "msword", "hwp", "x-download")
MAX_BODY = 40_000          # 응답 본문은 스키마 추론에만 쓴다. 통째로 들고 있지 않는다
MAX_SAMPLES = 10           # 같은 (메서드, 경로)의 요청은 이만큼만 본문까지 들고 있는다
DUP_EVENTS = 3             # 같은 요청은 기록에 이 횟수까지만 올린다


def is_write(url: str, method: str, rtype: str, policy: Policy) -> bool:
    """쓰기로 다뤄야 하는 요청인가.

    정적 자원과 http 가 아닌 요청은 아니다. GET/HEAD 는 원칙적으로 읽기지만, 화면 스크립트가 부르는(xhr, fetch)
    같은 출처 GET 중 이름이 삭제·승인처럼 보이는 것은 쓰기로 본다. 레거시는 쓰기를 GET 으로 만들기도 한다.
    화면 이동(document)은 이름과 상관없이 읽기다.
    """
    method = method.upper()
    if not url.startswith(("http://", "https://")) or rtype in STATIC_TYPES or is_asset(url):
        return False
    if method in ("GET", "HEAD"):
        return rtype in ("xhr", "fetch") and policy.same_origin(url) and bool(risky_call(urlsplit(url).path))
    return True


def is_file_response(headers: Optional[dict]) -> Tuple[bool, str]:
    headers = headers or {}
    ctype = headers.get("content-type", "")
    return ("attachment" in headers.get("content-disposition", "").lower() or any(t in ctype.lower() for t in FILE_TYPES)), ctype


def response_kind(rtype: str, url: str, status: int, headers: Optional[dict]) -> Optional[Tuple[bool, str]]:
    """크롤러가 기록할 응답이면 (파일 여부, content-type), 아니면 None. 리다이렉트와 화면 이동은 뺀다."""
    if rtype in STATIC_TYPES or is_asset(url) or 300 <= status < 400:
        return None
    is_file, ctype = is_file_response(headers)
    if rtype == "document" and not is_file:
        return None
    return is_file, ctype


def keep_headers(headers: Optional[dict]) -> Dict[str, str]:
    """다시 보내야 하는 요청 헤더만 남긴다. 인증·세션 값과 요청마다 바뀌는 토큰은 뺀다."""
    keep = {}
    for k, v in (headers or {}).items():
        lk = k.lower()
        if is_secret_key(lk) or "csrf" in lk or "xsrf" in lk:
            continue
        if lk in ("x-requested-with", "content-type", "accept") or lk.startswith("x-"):
            keep[lk] = v
    return keep


class SampleCounter:
    """같은 요청의 표본을 더 들고 있을 자리가 있는가."""

    def __init__(self) -> None:
        self._n: Dict[str, int] = {}

    def room(self, key: str) -> bool:
        self._n[key] = self._n.get(key, 0) + 1
        return self._n[key] <= MAX_SAMPLES


class EventDedup:
    """같은 이벤트(자동 저장처럼 반복되는 요청)를 화면 기록에 몇 번까지만 올린다."""

    def __init__(self) -> None:
        self._n: Dict[str, int] = {}

    def allow(self, key: str) -> bool:
        self._n[key] = self._n.get(key, 0) + 1
        return self._n[key] <= DUP_EVENTS


def parse_form(body: Optional[str], ctype: str) -> Dict[str, str]:
    """요청 본문에서 {필드: 값}. 폼과 JSON 만 안다."""
    if not body:
        return {}
    if "json" in (ctype or "").lower():
        try:
            data = json.loads(body)
            return {str(k): str(v) for k, v in data.items()} if isinstance(data, dict) else {}
        except ValueError:
            return {}
    return dict(parse_qsl(body, keep_blank_values=True))


def build_recipe(login_req: Optional[dict], login_page: str, user: str, pw: str) -> Tuple[str, Optional[dict]]:
    """로그인 요청에서 필드 이름을 알아낸다. (로그인 경로, 레시피). 값으로 필드를 찾으므로 계정을 알아야 한다."""
    if not login_req:
        return "", None
    fields = parse_form(login_req["post"], login_req["ctype"])
    user_field = next((k for k, v in fields.items() if v == user), "")
    pass_field = next((k for k, v in fields.items() if v == pw), "")
    extra = {k: v for k, v in fields.items() if k not in (user_field, pass_field) and v != ""}
    path = urlsplit(login_req["url"]).path
    if not (user_field and pass_field):
        return path, None
    return path, {"loginUrl": login_page, "action": login_req["url"], "method": login_req["method"],
                  "json": "json" in (login_req["ctype"] or "").lower(), "userField": user_field, "passField": pass_field, "extra": extra}


def recipe_rel(policy: Policy, recipe: dict) -> dict:
    """크롤러 형식 레시피를 session_auth 가 읽는 형식(운영 주소 기준 상대 경로)으로 바꾼다."""
    def rel(url: str) -> str:
        return policy.rel(urlsplit(url).path) if policy.same_origin(url) else url
    return {"userField": recipe["userField"], "passField": recipe["passField"], "extra": recipe["extra"], "json": recipe["json"],
            "loginRel": rel(recipe["loginUrl"]), "actionRel": rel(recipe["action"])}
