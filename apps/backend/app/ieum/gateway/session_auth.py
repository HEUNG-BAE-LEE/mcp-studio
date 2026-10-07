"""세션(쿠키) 로그인. 폼 로그인으로 세션을 주는 레거시 시스템을 위한 인증 방식이다.

자동 탐색이 로그인 요청을 한 번 관찰해 "레시피"(어느 주소에, 어떤 필드 이름으로)를 남긴다.
도구를 실행할 때 이음이 같은 레시피로 서비스 계정에 로그인해 쿠키를 받아 원본 요청에 싣는다.
쿠키는 잠깐 기억하고(TTL), 만료되면 다시 로그인한다.
"""
import threading
import time
from html.parser import HTMLParser
from typing import Dict, Optional
from urllib.parse import urljoin, urlsplit

import httpx

TTL = 20 * 60
TIMEOUT = 10
_CACHE: Dict[str, tuple] = {}      # 원본 시스템 id -> (쿠키 dict, 만료 시각)
_LOCK = threading.Lock()


class LoginError(Exception):
    """로그인하지 못했다. 메시지는 AI 에게도, 화면에도 그대로 간다."""


class _HiddenInputs(HTMLParser):
    """로그인 화면의 숨은 입력(CSRF 토큰, returnUrl 등). 요청마다 값이 바뀔 수 있어 매번 읽는다."""

    def __init__(self) -> None:
        super().__init__()
        self.fields: Dict[str, str] = {}

    def handle_starttag(self, tag, attrs) -> None:
        a = dict(attrs)
        if tag == "input" and (a.get("type") or "").lower() == "hidden" and a.get("name"):
            self.fields[a["name"]] = a.get("value") or ""


class _Forms(HTMLParser):
    """화면 안의 <form> 들과 그 안의 입력. 로그인 폼(비밀번호 입력이 있는 폼)을 찾으려는 것이다."""

    def __init__(self) -> None:
        super().__init__()
        self.forms: list = []
        self._cur: Optional[dict] = None

    def handle_starttag(self, tag, attrs) -> None:
        a = dict(attrs)
        if tag == "form":
            self._cur = {"action": a.get("action") or "", "method": (a.get("method") or "get").lower(), "inputs": []}
            self.forms.append(self._cur)
        elif tag == "input" and self._cur is not None:
            self._cur["inputs"].append({"type": (a.get("type") or "text").lower(), "name": a.get("name") or "", "value": a.get("value") or ""})

    def handle_endtag(self, tag) -> None:
        if tag == "form":
            self._cur = None


def discover_recipe(url: str, rel) -> dict:
    """로그인 화면을 읽어 레시피를 만든다. 화면 탐색 없이 소스만 분석할 때 로그인하려고 쓴다.

    rel(url) 은 운영 주소 기준 상대 경로로 바꾸는 함수다. 폼이 하나도 로그인 폼 같지 않으면 LoginError.
    """
    try:
        with httpx.Client(follow_redirects=True, timeout=TIMEOUT) as c:
            r = c.get(url)
    except httpx.HTTPError as exc:
        raise LoginError(f"로그인 화면을 열지 못했습니다. ({type(exc).__name__})")
    parser = _Forms()
    parser.feed(r.text)
    for form in parser.forms:
        inputs = form["inputs"]
        pw_i = next((i for i, x in enumerate(inputs) if x["type"] == "password" and x["name"]), None)
        if pw_i is None or form["method"] != "post":
            continue
        user = next((x for x in reversed(inputs[:pw_i]) if x["type"] in ("text", "email", "tel") and x["name"]), None)
        if not user:
            continue
        extra = {x["name"]: x["value"] for x in inputs if x["type"] == "hidden" and x["name"] and x["value"] != ""}
        action = urljoin(str(r.url), form["action"] or str(r.url))
        return {"userField": user["name"], "passField": inputs[pw_i]["name"], "extra": extra, "json": False, "loginRel": rel(str(r.url)), "actionRel": rel(action)}
    raise LoginError("로그인 화면에서 아이디·비밀번호 입력 폼을 찾지 못했습니다.")


def _url(base: str, rel: str) -> str:
    """운영 기준 상대 경로를 이 원본 시스템의 base 에 이어 붙인다. 스테이징처럼 base 가 다른 곳에도 같은 레시피를 쓴다."""
    if rel.startswith(("http://", "https://")):          # 운영 base 밖의 주소는 그대로 쓴다
        return rel
    return urljoin(base.rstrip("/") + "/", rel.lstrip("/"))


def login(base: str, cred: dict, *, timeout: float = TIMEOUT) -> Dict[str, str]:
    """레시피대로 로그인하고 {쿠키 이름: 값} 을 돌려준다."""
    recipe = cred.get("recipe") or {}
    if not recipe.get("userField") or not recipe.get("passField"):
        raise LoginError("로그인 방법을 알 수 없습니다. 원본 시스템을 자동 탐색으로 다시 연결해 주세요.")
    login_url, action = _url(base, recipe.get("loginRel", "/login.do")), _url(base, recipe.get("actionRel", "/loginProc.do"))
    try:
        with httpx.Client(follow_redirects=True, timeout=timeout) as c:
            page = c.get(login_url)                                      # 세션을 시작하고 숨은 입력을 받는다
            parser = _HiddenInputs()
            parser.feed(page.text)
            data = dict(recipe.get("extra") or {})
            data.update({k: v for k, v in parser.fields.items() if k not in (recipe["userField"], recipe["passField"])})
            data[recipe["userField"]], data[recipe["passField"]] = cred.get("username", ""), cred.get("password", "")
            r = c.post(action, json=data) if recipe.get("json") else c.post(action, data=data)
            cookies = {k: v for k, v in c.cookies.items()}
    except httpx.HTTPError as exc:
        raise LoginError(f"원본 시스템에 로그인하지 못했습니다. ({type(exc).__name__})")
    still_login = 'type="password"' in r.text.lower() or "type='password'" in r.text.lower()
    if r.status_code >= 400 or still_login or not cookies:
        raise LoginError("서비스 계정으로 로그인하지 못했습니다. 계정과 비밀번호를 확인해 주세요.")
    return cookies


def cookie_header(source_id: str, base: str, cred: dict) -> str:
    """캐시에 살아 있는 세션이 있으면 그것을, 없으면 로그인해서 쿠키 헤더 값을 돌려준다."""
    with _LOCK:
        hit = _CACHE.get(source_id)
        if hit and hit[1] > time.time():
            return _join(hit[0])
    cookies = login(base, cred)
    with _LOCK:
        _CACHE[source_id] = (cookies, time.time() + TTL)
    return _join(cookies)


def invalidate(source_id: str) -> None:
    with _LOCK:
        _CACHE.pop(source_id, None)


def expired(status: int, location: Optional[str], content_type: str, text: str) -> bool:
    """응답이 "세션이 끊겼다"는 뜻인가: 401/403, 로그인 화면으로의 리다이렉트, 로그인 화면 본문."""
    if status in (401, 403):
        return True
    if 300 <= status < 400:
        return "login" in urlsplit(location or "").path.lower()
    return "html" in (content_type or "").lower() and ('type="password"' in text.lower() or "type='password'" in text.lower())


def _join(cookies: Dict[str, str]) -> str:
    return "; ".join(f"{k}={v}" for k, v in cookies.items())
