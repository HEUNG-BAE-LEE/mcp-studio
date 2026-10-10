# 이음 웹 레코더 MVP 구현 계획 (2판)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사람이 이음 콘솔 안에서 서버 브라우저를 조작해 업무 하나를 기록하면, 그 기록을 검증된 업무 기능(여러 API의 순서·값 연결·입력값 출처·정책)으로 만든다. XHR(JSON) 화면과 서버 렌더링(HTML 표) 화면을 모두 다룬다.

**Architecture:** 이음 백엔드에 `app/ieum/recorder/` 패키지를 더한다. 기록 세션마다 비동기 Playwright로 화면 없는 Chromium을 띄우고(uvicorn 이벤트 루프), CDP 화면 스트리밍(최신 프레임만)과 입력 역중계를 WebSocket으로 콘솔에 잇는다. 가드가 운영 쓰기를 붙잡아 승인받고 서버 보호 주소를 막는다. 행동마다 ActionSpan(행동 + 마스킹한 직전/직후 ARIA 스냅샷 + 네트워크)을 기록별 파일에 한 줄씩 덧붙인다. HTML 응답은 표를 JSON으로 바꾼 사본을 만든다. 기록이 끝나면 규칙 기반 분석기가 업무 기능을 만들고, Replay가 같은 값(메모리의 원값)·다른 값으로 다시 실행해 검증한다.

**Tech Stack:** Python 3.10.11, FastAPI 0.115.6(WebSocket), Playwright 1.49.1 비동기 API, httpx, 표준 라이브러리 `html.parser`, 이음 `JsonStore`/금고, 이음 콘솔(바닐라 JS classic script, 빌드 없음), pytest, `websockets` 16(시험용 동기 클라이언트).

**Spec:** `docs/superpowers/specs/2026-10-10-ieum-web-recorder-design.md` (2판)

## Global Constraints

- Python 3.10.11. 3.11+ 문법 금지(`X | Y` 타입 표기, `except*`, `tomllib` 등). 타입은 `typing.Optional`, `List`, `Dict`, `Tuple`.
- Docker·pnpm·uv를 쓰지 않는다. 새 프런트엔드·백엔드 의존성을 들이지 않는다(HTML 해석은 표준 `html.parser`).
- 주석·UI 문구·커밋 메시지는 한국어. 변수·함수 이름은 영어.
- `window.confirm`·`alert`·`prompt`를 쓰지 않는다. 확인 창은 화면 안 요소로 만든다.
- 콘솔 JS는 classic script다. 새 전역 이름은 만들기 전에 grep으로 충돌을 확인한다. 이 계획의 전역 이름은 모두 `rec`/`REC` 접두사다.
- 이음 스토어의 읽고-고쳐-쓰기 구간은 `with store.LOCK:`으로 감싼다. `LOCK`을 쥔 채 브라우저를 띄우거나 기다리지 않는다.
- **uvicorn 이벤트 루프를 막지 않는다.** 이벤트 루프 안에서 파일 쓰기·스토어 읽고쓰기·분석·HTML 변환·동기 HTTP를 부를 때는 `asyncio.to_thread`로 넘긴다.
- 응답 본문 원문, ARIA 스냅샷 원문, 입력 원값을 저장하지 않는다. `discovery.masking.Masker`로 가린 값만 저장한다. 마스킹이 실패하면 저장하지 않는다. 입력 원값은 기록 세션 메모리에만 둔다.
- 운영(`env == "op"`)에서 쓰기 요청은 어느 출처로 가든 승인 없이 보내지 않는다. 승인 대기 120초가 지나면 보내지 않는다. 가짜 응답을 만들지 않는다.
- 로그인 요청 판정은 비밀번호 계열 필드(`pw`, `pwd`, `pass`, `passwd`, `password`)로만 한다.
- 자동 탐색(`discovery/crawler.py`)의 동작과 쓰기 차단 규칙은 바꾸지 않는다.
- 시연 사이트(`demo_legacy`)의 메뉴(`pages.MENU`)와 기존 화면은 바꾸지 않는다. 기존 시험이 메뉴 HTML을 그대로 비교한다.
- 기본값(환경변수로 바꿈): 서버 전체 동시 기록 4(`IEUM_RECORDER_MAX_SESSIONS`), 사람당 1(`IEUM_RECORDER_MAX_PER_OWNER`), 유휴 회수 600초(`IEUM_RECORDER_IDLE_SEC`), 기록 최대 1800초(`IEUM_RECORDER_MAX_SEC`), 미확정 스크린샷 보관 7일(`IEUM_RECORDER_SHOT_DAYS`), 추가 차단 목록(`IEUM_RECORDER_DENY`). 쓰기 승인 대기 120초, 운영 주소 Replay 요청 간격 0.6초.
- 시험 명령: `cd apps/backend && .venv/bin/pytest <경로> -v`. 브라우저 시험은 `IEUM_SKIP_BROWSER_TESTS=1`이거나 브라우저가 없으면 건너뛴다.
- 전체 시험: `cd apps/backend && .venv/bin/pytest tests/ -q -p no:cacheprovider`. 시작 기준은 527개 통과.

## Review Focus

1. **쓰기 요청 본문에 `csrfToken` 같은 토큰 필드가 있음** → 로그인으로 오인해 승인 없이 보내면 안 된다. (작업 3 `test_토큰_필드가_든_저장은_로그인으로_오인하지_않는다`)
2. **쓰기 승인 창을 띄운 채 사용자가 탭을 닫거나 네트워크가 끊김** → 120초 뒤 보내지 않고, 브라우저 세션은 계속 쓸 수 있어야 한다. (작업 3 `test_승인_응답이_없으면_시간_초과로_보내지_않는다`)
3. **대상 화면이 서버 자신(콘솔 API)이나 클라우드 메타데이터 주소를 부름** → 막아야 한다. 단 시연처럼 대상 자체가 `localhost`면 그 출처의 업무 화면은 열려야 한다. (작업 3 `test_서버_보호_주소는_막고_대상_출처는_연다`)
4. **사용자 입력이 개인정보라 저장 값이 마스킹됨** → 기록 직후 Replay는 메모리 원값으로 성공하고, 세션이 끝난 뒤에는 "값 다시 입력 필요"로 멈춘다. (작업 10 `test_원값_지도로_마스킹된_입력을_되돌린다`, `test_원값이_없으면_needs_value`)
5. **같은 값이 앞 단계 응답 여러 곳에 있어 값 연결이 모호함** → 확신도 `low`로 검토 화면에 묻는다. (작업 9 `test_같은_값이_두_곳에_있으면_확신도를_낮춘다`)

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `apps/backend/app/ieum/discovery/capture.py` (새) | 크롤러·레코더 공용 판정: 쓰기 여부, 보존 헤더, 표본 상한, 이벤트 중복 억제, 로그인 레시피. 크롤러 전용 `response_kind`도 둔다 |
| `apps/backend/app/ieum/discovery/crawler.py` (수정) | 판정을 `capture`에서 가져다 쓴다. 동작은 그대로 |
| `apps/backend/app/ieum/discovery/browser.py` (수정) | `launch_async` 추가 |
| `apps/backend/app/ieum/recorder/__init__.py` (새) | 패키지 |
| `apps/backend/app/ieum/recorder/config.py` (새) | 환경변수 기본값 |
| `apps/backend/app/ieum/recorder/store.py` (새) | 기록 요약 스토어, 행동 묶음 파일(jsonl), 업무 기능 스토어, 재시작 중단 처리 |
| `apps/backend/app/ieum/recorder/retention.py` (새) | 스크린샷 보관 정리 |
| `apps/backend/app/ieum/recorder/scope.py` (새) | 항상 차단 주소 판정 |
| `apps/backend/app/ieum/recorder/guard.py` (새) | 쓰기 붙잡기·승인, 항상 차단, 로그인 통과 |
| `apps/backend/app/ieum/recorder/relay.py` (새) | 좌표 환산, CDP 입력, 화면 스트리밍, 최신 프레임만 보내기 |
| `apps/backend/app/ieum/recorder/htmltable.py` (새) | HTML → `{tables, fields, hidden}` |
| `apps/backend/app/ieum/recorder/trace.py` (새) | ActionSpan 기록, 모든 프레임 ARIA, 마스킹, 원값 지도 |
| `apps/backend/app/ieum/recorder/login.py` (새) | 자동 로그인, 레시피 만들기 |
| `apps/backend/app/ieum/recorder/session.py` (새) | 기록 세션 하나 |
| `apps/backend/app/ieum/recorder/manager.py` (새) | 세션 관리, 상한(서버·사람당), 유휴 회수, 보관 정리 주기 |
| `apps/backend/app/ieum/recorder/analyze.py` (새) | 기록 → 업무 기능 |
| `apps/backend/app/ieum/recorder/replay.py` (새) | 재실행·판정 |
| `apps/backend/app/ieum/recorder/service.py` (새) | 종료 후 흐름, 수정·확정·등록 |
| `apps/backend/app/ieum/routers/recorder.py` (새), `routers/__init__.py` (수정) | REST + WebSocket |
| `apps/backend/app/ieum/data/recorder/recordings.json`, `functions.json` (새) | 시드 `{}` |
| `apps/backend/app/ieum/demo_legacy/site.py`, `pages.py` (수정) | 서버 렌더링 시연 화면(메뉴 밖) |
| `apps/web/ieum/js/menu/recorder.js` (새), `js/common/state.js`, `js/main.js`, `index.html`, `css/console.css` (수정) | 업무 기록 메뉴 |
| `CLAUDE.md` (수정) | 레코더 문단과 주의 사항 |

---

### Task 1: 공용 판정 함수 분리

크롤러의 네트워크 판정을 Playwright를 부르지 않는 함수로 뗀다. **기존 시험이 하나도 바뀌지 않고 통과**하는 것이 합격선이다.

**Files:**
- Create: `apps/backend/app/ieum/discovery/capture.py`
- Modify: `apps/backend/app/ieum/discovery/crawler.py` (상수 26~34행, `_parse_form` 120~131행, `__init__` 150·156행, `_build_recipe` 503~515행, 네트워크 구역 517~640행)
- Test: `apps/backend/tests/test_ieum_capture.py`

**Interfaces:**
- Produces:
  - `capture.STATIC_TYPES: set`, `capture.FILE_TYPES: tuple`, `capture.MAX_BODY = 40_000`, `capture.MAX_SAMPLES = 10`, `capture.DUP_EVENTS = 3`
  - `capture.is_write(url: str, method: str, rtype: str, policy: Policy) -> bool`
  - `capture.response_kind(rtype: str, url: str, status: int, headers: Optional[dict]) -> Optional[Tuple[bool, str]]` — **크롤러 전용**(document 응답을 버린다). 레코더는 쓰지 않는다
  - `capture.is_file_response(headers: Optional[dict]) -> Tuple[bool, str]` — `(파일 여부, content-type)`
  - `capture.keep_headers(headers: Optional[dict]) -> Dict[str, str]`
  - `capture.SampleCounter().room(key) -> bool`, `capture.EventDedup().allow(key) -> bool`
  - `capture.parse_form(body: Optional[str], ctype: str) -> Dict[str, str]`
  - `capture.build_recipe(login_req: Optional[dict], login_page: str, user: str, pw: str) -> Tuple[str, Optional[dict]]` — 크롤러 형식 `{loginUrl, action, method, json, userField, passField, extra}`
  - `capture.recipe_rel(policy: Policy, recipe: dict) -> dict` — `session_auth` 형식 `{userField, passField, extra, json, loginRel, actionRel}`
- `crawler`는 `STATIC_TYPES`, `FILE_TYPES`, `MAX_SAMPLES`, `DUP_EVENTS`, `MAX_BODY`를 다시 내보낸다(`tests/test_ieum_discovery_crawler.py`가 `MAX_SAMPLES`를 import한다).

- [ ] **Step 1: 실패하는 시험 작성**

```python
# apps/backend/tests/test_ieum_capture.py
"""크롤러·레코더 공용 판정. Playwright 없이 돈다."""
from app.ieum.discovery import capture
from app.ieum.discovery.policy import Policy

P = Policy(base="http://10.0.0.1:8080/po", read_post="/po/searchPost.do")


def test_화면_이동과_조회_GET_은_쓰기가_아니다():
    assert not capture.is_write("http://10.0.0.1:8080/po/poListView.do", "GET", "document", P)
    assert not capture.is_write("http://10.0.0.1:8080/po/poList.do?a=1", "GET", "xhr", P)


def test_POST_와_이름이_쓰기_같은_GET_은_쓰기다():
    assert capture.is_write("http://10.0.0.1:8080/po/poSave.do", "POST", "xhr", P)
    assert capture.is_write("http://10.0.0.1:8080/po/poDelete.do?id=1", "GET", "xhr", P)


def test_정적_자원과_http_가_아닌_요청은_쓰기가_아니다():
    assert not capture.is_write("http://10.0.0.1:8080/po/app.js", "POST", "script", P)
    assert not capture.is_write("data:text/plain,hi", "POST", "xhr", P)


def test_크롤러는_화면_이동_응답을_버린다():
    assert capture.response_kind("xhr", "http://h/po/poList.do", 200, {"content-type": "application/json"}) == (False, "application/json")
    assert capture.response_kind("document", "http://h/po/main.do", 200, {"content-type": "text/html"}) is None
    assert capture.response_kind("xhr", "http://h/po/x.do", 302, {}) is None
    assert capture.response_kind("document", "http://h/po/down.do", 200, {"content-disposition": "attachment; filename=a.xlsx"}) == (True, "")


def test_보존_헤더는_세션_값과_토큰을_뺀다():
    kept = capture.keep_headers({"X-Requested-With": "XMLHttpRequest", "Cookie": "a=1", "X-CSRF-TOKEN": "t", "Accept": "*/*", "User-Agent": "u"})
    assert kept == {"x-requested-with": "XMLHttpRequest", "accept": "*/*"}


def test_표본_상한과_이벤트_중복_억제():
    c = capture.SampleCounter()
    assert all(c.room("GET /a") for _ in range(capture.MAX_SAMPLES))
    assert not c.room("GET /a")
    d = capture.EventDedup()
    assert [d.allow("k") for _ in range(capture.DUP_EVENTS + 1)] == [True] * capture.DUP_EVENTS + [False]


def test_로그인_요청에서_필드_이름을_알아낸다():
    req = {"url": "http://10.0.0.1:8080/po/loginProc.do", "method": "POST", "post": "returnUrl=main.do&userId=svc&userPw=pw1",
           "ctype": "application/x-www-form-urlencoded"}
    path, recipe = capture.build_recipe(req, "http://10.0.0.1:8080/po/login.do", "svc", "pw1")
    assert path == "/po/loginProc.do"
    assert recipe["userField"] == "userId" and recipe["passField"] == "userPw" and recipe["extra"] == {"returnUrl": "main.do"}
    rel = capture.recipe_rel(P, recipe)
    assert rel["loginRel"] == "/login.do" and rel["actionRel"] == "/loginProc.do"
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_capture.py -v`
Expected: FAIL — `ImportError: cannot import name 'capture'`

- [ ] **Step 3: `capture.py` 작성**

```python
# apps/backend/app/ieum/discovery/capture.py
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
```

- [ ] **Step 4: 크롤러가 `capture`를 쓰게 고친다**

`crawler.py`에서:

1. 26~34행의 `STATIC_TYPES`, `FILE_TYPES`, `MAX_BODY`, `DUP_EVENTS`, `MAX_SAMPLES` 정의를 지우고 그 자리에 넣는다(`VIEWPORT`, `MAX_ACTIONS`, `MAX_SKIP_EVENTS`, `OBSERVE_MS`는 그대로).

```python
from app.ieum.discovery import capture
from app.ieum.discovery.capture import DUP_EVENTS, FILE_TYPES, MAX_BODY, MAX_SAMPLES, STATIC_TYPES  # noqa: F401 (다시 내보냄)
```

2. `_parse_form` 함수(120~131행)를 지운다.
3. `__init__`의 `self._dups: Dict[str, int] = {}` → `self._dups = capture.EventDedup()`, `self._samples: Dict[str, int] = {}` → `self._samples = capture.SampleCounter()`.
4. `_build_recipe`(503~515행) 본문:

```python
    def _build_recipe(self, login_page: str, user: str, pw: str) -> None:
        """로그인 요청에서 필드 이름을 알아낸다. 도구를 실행할 때 같은 방식으로 로그인하려는 것이다."""
        path, recipe = capture.build_recipe(self._login_req, login_page, user, pw)
        if path:
            self.res.login_path = path
        if recipe:
            self.res.recipe = recipe
```

5. `_route_inner`의 첫 판정(534~542행)을 세 줄로 바꾼다. 나머지는 그대로.

```python
        url, method, rtype = request.url, request.method.upper(), request.resource_type
        if not capture.is_write(url, method, rtype, self.policy):
            route.continue_()
            return
```

6. `_room` 본문 → `return self._samples.room(key)`, `_keep_headers` 본문 → `return capture.keep_headers(headers)`.
7. `_on_response`의 592~600행:

```python
            kind = capture.response_kind(req.resource_type, response.url, response.status, response.headers)
            if kind is None:
                return
            is_file, ctype = kind
            self._pending.append((response, req, is_file, ctype))
```

8. `_record_event`:

```python
    def _record_event(self, tag: str, method: str, url: str, code: Optional[int], ms: Optional[int] = None) -> None:
        if not self._dups.allow(f"{tag} {method} {urlsplit(url).path}"):
            return
        self._emit("web", "req", m=method, p=self.policy.display(url), code=code, tag=tag, ms=ms)
```

9. 남은 사용처가 없는 import를 지운다: `grep -n "is_secret_key\|is_asset\|risky_call\|parse_qsl" app/ieum/discovery/crawler.py`로 확인한다.

- [ ] **Step 5: 시험 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_capture.py -v && .venv/bin/pytest tests/ -q -p no:cacheprovider`
Expected: 새 시험 7개 PASS, 전체 534개 통과. 기존 시험 파일은 고치지 않는다.

- [ ] **Step 6: 커밋**

```bash
git add apps/backend/app/ieum/discovery/capture.py apps/backend/app/ieum/discovery/crawler.py apps/backend/tests/test_ieum_capture.py
git commit -m "refactor: 크롤러의 네트워크 판정을 공용 capture 모듈로 뗀다"
```

---

### Task 2: 설정, 저장소, 보관 정리

기록 요약은 스토어 하나에, 행동 묶음은 기록마다 파일 하나에 **한 줄씩 덧붙인다**. 파일 하나를 통째로 다시 쓰면 기록이 쌓일수록 느려지고 이벤트 루프를 막는다.

**Files:**
- Create: `apps/backend/app/ieum/recorder/__init__.py`, `config.py`, `store.py`, `retention.py`
- Create: `apps/backend/app/ieum/data/recorder/recordings.json`, `functions.json` (`{}`)
- Test: `apps/backend/tests/test_ieum_recorder_store.py`

**Interfaces:**
- Produces:
  - `config.max_sessions() -> int`, `config.max_per_owner() -> int`, `config.idle_sec() -> int`, `config.max_sec() -> int`, `config.shot_days() -> int`, `config.deny_entries() -> List[str]` — 부를 때마다 환경변수를 읽는다(시험이 바꿔 끼운다)
  - `store.new_recording(name, owner, base, start, env, login_mode, read_post) -> dict` — `id="rec_<8자>"`, `status="recording"`, `spanCount=0`, `approvals=[]`, `functionId=None`, `error=None`, `login={"mode", "recipe": None, "path": ""}`
  - `store.save_recording(rec)`, `store.get_recording(rid) -> dict` (`KeyError`), `store.update_recording(rid, fn) -> dict`, `store.list_recordings() -> List[dict]`(최신순)
  - `store.append_span(rid, span) -> int` — 파일에 한 줄 덧붙이고 요약의 `spanCount`를 올린다. 새 개수를 돌려준다
  - `store.read_spans(rid) -> List[dict]`
  - `store.save_function(bf)`, `store.get_function(fid)`, `store.list_functions()`
  - `store.delete_recording(rid)` — 요약, 연결된 업무 기능, 기록 폴더 전체
  - `store.rec_dir(rid) -> Path` — `state_dir()/recorder/<rid>`
  - `store.delete_shots(rid) -> int` — 폴더의 `*.jpg`만 지운다
  - `store.mark_interrupted() -> int`, `store.ACTIVE`
  - `retention.sweep(now: Optional[float] = None) -> int` — 확정한 업무 기능의 기록, 그리고 끝난 지 `shot_days`일이 지난 미확정 기록의 스크린샷을 지운다. 지운 파일 수를 돌려준다

- [ ] **Step 1: 시드와 실패하는 시험 작성**

```bash
mkdir -p apps/backend/app/ieum/data/recorder
printf '{}\n' > apps/backend/app/ieum/data/recorder/recordings.json
printf '{}\n' > apps/backend/app/ieum/data/recorder/functions.json
git check-ignore -v apps/backend/app/ieum/data/recorder/recordings.json   # "!apps/backend/app/ieum/data/**/*.json" 규칙이 보이면 무시 아님
```

```python
# apps/backend/tests/test_ieum_recorder_store.py
"""레코더 저장소: 기록 요약은 스토어에, 행동 묶음은 기록별 파일에 덧붙인다."""
import time

import pytest

from app.ieum.recorder import config, retention, store


@pytest.fixture
def rec(ieum_state):
    r = store.new_recording("9월 발주 상세 조회", "홍길동", "http://h/po", "/login.do", "op", "auto", "")
    store.save_recording(r)
    return r


def test_기록을_만들고_읽는다(rec):
    got = store.get_recording(rec["id"])
    assert got["name"] == "9월 발주 상세 조회" and got["status"] == "recording" and got["spanCount"] == 0
    assert rec["id"].startswith("rec_") and got["env"] == "op" and got["login"]["mode"] == "auto"


def test_행동_묶음은_파일에_덧붙이고_요약에는_개수만(rec):
    assert store.append_span(rec["id"], {"seq": 1, "action": {"type": "click"}}) == 1
    assert store.append_span(rec["id"], {"seq": 2, "action": {"type": "click"}}) == 2
    assert [s["seq"] for s in store.read_spans(rec["id"])] == [1, 2]
    assert store.get_recording(rec["id"])["spanCount"] == 2
    assert "spans" not in store.get_recording(rec["id"])


def test_없는_기록은_KeyError(ieum_state):
    with pytest.raises(KeyError):
        store.get_recording("rec_none")


def test_재시작하면_진행_중이던_기록은_중단됨이_된다(rec):
    store.append_span(rec["id"], {"seq": 1})
    assert store.mark_interrupted() == 1
    got = store.get_recording(rec["id"])
    assert got["status"] == "interrupted" and len(store.read_spans(rec["id"])) == 1


def test_기록을_지우면_업무_기능과_폴더도_지운다(rec):
    store.save_function({"id": "bf_x", "source": {"recordingId": rec["id"]}, "name": "x", "status": "draft"})
    store.update_recording(rec["id"], lambda r: r.update(functionId="bf_x"))
    store.append_span(rec["id"], {"seq": 1})
    (store.rec_dir(rec["id"]) / "1-pre.jpg").write_bytes(b"x")
    store.delete_recording(rec["id"])
    with pytest.raises(KeyError):
        store.get_function("bf_x")
    assert not store.rec_dir(rec["id"]).exists()


def test_보관_정리는_확정한_것과_오래된_미확정_스크린샷만_지운다(ieum_state, monkeypatch):
    monkeypatch.setenv("IEUM_RECORDER_SHOT_DAYS", "7")
    now = time.time()
    done, old, fresh = (store.new_recording(n, "", "http://h/po", "", "op", "auto", "") for n in ("a", "b", "c"))
    for r, ended in ((done, now), (old, now - 8 * 86400), (fresh, now - 1 * 86400)):
        r.update(status="review", endedAt=ended)
        store.save_recording(r)
        store.append_span(r["id"], {"seq": 1})
        (store.rec_dir(r["id"]) / "1-pre.jpg").write_bytes(b"x")
    store.save_function({"id": "bf_a", "status": "confirmed", "source": {"recordingId": done["id"]}})
    store.update_recording(done["id"], lambda r: r.update(functionId="bf_a"))
    assert retention.sweep(now) == 2
    assert not (store.rec_dir(done["id"]) / "1-pre.jpg").exists() and not (store.rec_dir(old["id"]) / "1-pre.jpg").exists()
    assert (store.rec_dir(fresh["id"]) / "1-pre.jpg").exists() and store.read_spans(old["id"])   # 행동 묶음은 남는다


def test_설정은_환경변수를_읽는다(monkeypatch):
    monkeypatch.setenv("IEUM_RECORDER_MAX_SESSIONS", "9")
    monkeypatch.setenv("IEUM_RECORDER_MAX_PER_OWNER", "x")
    monkeypatch.setenv("IEUM_RECORDER_DENY", "10.9.0.0/16, admin.corp")
    assert config.max_sessions() == 9 and config.max_per_owner() == 1 and config.deny_entries() == ["10.9.0.0/16", "admin.corp"]
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_store.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.ieum.recorder'`

- [ ] **Step 3: 구현**

```python
# apps/backend/app/ieum/recorder/__init__.py
"""업무 기록: 사람이 서버 브라우저를 조작해 업무 하나를 기록하고, 검증된 업무 기능으로 만든다."""
```

```python
# apps/backend/app/ieum/recorder/config.py
"""업무 기록의 운영 기본값. 부를 때마다 환경변수를 읽는다(시험이 값을 바꿔 끼운다)."""
import os
from typing import List


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


def max_sessions() -> int:
    """서버 전체 동시 기록. 기록 하나가 Chromium 하나를 띄운다(수백 MB)."""
    return _int("IEUM_RECORDER_MAX_SESSIONS", 4)


def max_per_owner() -> int:
    return _int("IEUM_RECORDER_MAX_PER_OWNER", 1)


def idle_sec() -> int:
    return _int("IEUM_RECORDER_IDLE_SEC", 600)


def max_sec() -> int:
    return _int("IEUM_RECORDER_MAX_SEC", 1800)


def shot_days() -> int:
    return _int("IEUM_RECORDER_SHOT_DAYS", 7)


def deny_entries() -> List[str]:
    """항상 차단에 더할 호스트·CIDR. 회사마다 막아야 할 관리 대역이 다르다."""
    return [x.strip() for x in os.environ.get("IEUM_RECORDER_DENY", "").split(",") if x.strip()]
```

```python
# apps/backend/app/ieum/recorder/store.py
"""기록과 업무 기능 저장.

기록 요약은 JSON 스토어 하나에, 행동 묶음은 기록마다 파일 하나(spans.jsonl)에 한 줄씩 덧붙인다. 모든 기록의 행동
묶음을 파일 하나에 넣고 묶음마다 통째로 다시 쓰면, 기록이 쌓일수록 느려지고 그 쓰기가 이벤트 루프를 막아 다른
사용자의 화면 중계까지 끊는다. 이 모듈의 함수는 동기다. 이벤트 루프에서는 asyncio.to_thread 로 부른다.
"""
import json
import shutil
import threading
import time
import uuid
from pathlib import Path
from typing import Callable, Dict, List

from app.ieum.config import state_dir
from app.ieum.store import LOCK, JsonStore

RECORDINGS = JsonStore("recorder", "recordings")
FUNCTIONS = JsonStore("recorder", "functions")
ACTIVE = ("recording", "analyzing", "verifying")
_FILE_LOCKS: Dict[str, threading.Lock] = {}
_FILE_LOCKS_GUARD = threading.Lock()


def _file_lock(rid: str) -> threading.Lock:
    with _FILE_LOCKS_GUARD:
        return _FILE_LOCKS.setdefault(rid, threading.Lock())


def rec_dir(rid: str) -> Path:
    return state_dir() / "recorder" / rid


def new_recording(name: str, owner: str, base: str, start: str, env: str, login_mode: str, read_post: str) -> dict:
    return {"id": "rec_" + uuid.uuid4().hex[:8], "name": name, "owner": owner, "sourceBase": base.rstrip("/"), "start": start or "",
            "env": env, "readPost": read_post or "", "login": {"mode": login_mode, "recipe": None, "path": ""},
            "status": "recording", "startedAt": time.time(), "endedAt": None, "spanCount": 0, "approvals": [],
            "functionId": None, "error": None}


def save_recording(rec: dict) -> None:
    with LOCK:
        data = RECORDINGS.load()
        data[rec["id"]] = rec
        RECORDINGS.save(data)


def get_recording(rid: str) -> dict:
    return RECORDINGS.load()[rid]


def update_recording(rid: str, fn: Callable[[dict], None]) -> dict:
    with LOCK:
        data = RECORDINGS.load()
        rec = data[rid]
        fn(rec)
        RECORDINGS.save(data)
        return rec


def list_recordings() -> List[dict]:
    return sorted(RECORDINGS.load().values(), key=lambda r: r["startedAt"], reverse=True)


def append_span(rid: str, span: dict) -> int:
    d = rec_dir(rid)
    d.mkdir(parents=True, exist_ok=True)
    line = json.dumps(span, ensure_ascii=False)
    with _file_lock(rid):
        with open(d / "spans.jsonl", "a", encoding="utf-8") as f:
            f.write(line + "\n")
    return update_recording(rid, lambda r: r.update(spanCount=r.get("spanCount", 0) + 1))["spanCount"]


def read_spans(rid: str) -> List[dict]:
    path = rec_dir(rid) / "spans.jsonl"
    if not path.exists():
        return []
    with _file_lock(rid):
        with open(path, encoding="utf-8") as f:
            return [json.loads(x) for x in f if x.strip()]


def save_function(bf: dict) -> None:
    with LOCK:
        data = FUNCTIONS.load()
        data[bf["id"]] = bf
        FUNCTIONS.save(data)


def get_function(fid: str) -> dict:
    return FUNCTIONS.load()[fid]


def list_functions() -> List[dict]:
    return sorted(FUNCTIONS.load().values(), key=lambda f: (f.get("verification") or {}).get("at") or 0, reverse=True)


def delete_recording(rid: str) -> None:
    with LOCK:
        recs = RECORDINGS.load()
        rec = recs.pop(rid)
        RECORDINGS.save(recs)
        if rec.get("functionId"):
            fns = FUNCTIONS.load()
            fns.pop(rec["functionId"], None)
            FUNCTIONS.save(fns)
    shutil.rmtree(rec_dir(rid), ignore_errors=True)


def delete_shots(rid: str) -> int:
    d = rec_dir(rid)
    n = 0
    for p in d.glob("*.jpg") if d.exists() else []:
        p.unlink(missing_ok=True)
        n += 1
    return n


def mark_interrupted() -> int:
    """서버가 다시 뜰 때: 돌던 기록은 브라우저와 함께 사라졌다. 저장된 행동 묶음은 남긴다."""
    with LOCK:
        data = RECORDINGS.load()
        n = 0
        for rec in data.values():
            if rec["status"] in ACTIVE:
                rec["status"], rec["error"] = "interrupted", "서버가 다시 시작되어 기록이 중단되었습니다."
                rec["endedAt"] = rec.get("endedAt") or time.time()
                n += 1
        if n:
            RECORDINGS.save(data)
        return n
```

```python
# apps/backend/app/ieum/recorder/retention.py
"""스크린샷 보관 정리. 그림 속 개인정보는 가리기 어려워, 사람이 검토하는 동안만 둔다.

확정한 업무 기능의 기록은 바로, 확정하지 않은 기록은 끝난 지 shot_days 일이 지나면 스크린샷을 지운다.
행동 묶음(마스킹한 ARIA 텍스트 포함)은 남긴다. 확정 뒤 검토 화면의 근거는 그 텍스트로 보여 준다.
"""
import time
from typing import Optional

from app.ieum.recorder import config, store


def sweep(now: Optional[float] = None) -> int:
    now = now or time.time()
    limit = config.shot_days() * 86400
    fns = store.FUNCTIONS.load()
    n = 0
    for rec in store.list_recordings():
        if rec["status"] in store.ACTIVE:
            continue
        fn = fns.get(rec.get("functionId") or "")
        confirmed = bool(fn and fn.get("status") == "confirmed")
        old = (now - (rec.get("endedAt") or rec["startedAt"])) > limit
        if confirmed or old:
            n += store.delete_shots(rec["id"])
    return n
```

- [ ] **Step 4: 시험 통과 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_store.py -v`
Expected: 7개 PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/app/ieum/recorder apps/backend/app/ieum/data/recorder apps/backend/tests/test_ieum_recorder_store.py
git commit -m "feat: 업무 기록 저장소 — 기록 요약 스토어와 기록별 행동 묶음 파일, 스크린샷 보관 정리"
```

---

### Task 3: 항상 차단 판정과 쓰기 가드

**Files:**
- Create: `apps/backend/app/ieum/recorder/scope.py`, `apps/backend/app/ieum/recorder/guard.py`
- Test: `apps/backend/tests/test_ieum_recorder_guard.py`

**Interfaces:**
- Consumes: `capture.is_write`, `capture.parse_form`, `config.deny_entries`, `Policy`
- Produces:
  - `scope.blocked(url: str, target_origin: str, extra: Optional[List[str]] = None) -> Optional[str]` — 막아야 하면 이유, 아니면 `None`
  - `Guard(policy: Policy, env: str, notify: Callable[[dict], Awaitable[None]], timeout: float = 120.0)`
    - `await guard.route(route, request)` — `BrowserContext.route` 처리기
    - `guard.decide(hold_id: str, ok: bool) -> bool`
    - `await guard.ask(method: str, url: str, label: str) -> bool` — Replay 쓰기 승인(운영이 아니면 `True`)
    - `guard.holding: bool`, `guard.label: str`, `guard.login_req: Optional[dict]` (`{url, method, post, ctype, page}`)
    - `guard.decisions: List[dict]` — `{id, method, url, path, label, decision, at}`. `decision`: `approve`|`deny`|`timeout`|`staging`|`denied-host`
    - `guard.decided_requests: Dict[int, str]` — `id(request)` → 결정
    - `guard.target_origin: str` — 대상 시스템 출처
  - 알림: `{"t": "hold", "id", "method", "path", "label"}`, `{"t": "hold-end", "id", "decision"}`, `{"t": "blocked", "url", "why"}`

- [ ] **Step 1: 실패하는 시험 작성**

```python
# apps/backend/tests/test_ieum_recorder_guard.py
"""항상 차단 판정과 쓰기 가드. Playwright 없이 가짜 route/request 로 시험한다."""
import asyncio

from app.ieum.discovery.policy import Policy
from app.ieum.recorder import scope
from app.ieum.recorder.guard import Guard

P = Policy(base="http://h:8080/po", read_post="/po/searchPost.do")


class Req:
    def __init__(self, url, method="GET", rtype="xhr", post=None, ctype="application/x-www-form-urlencoded"):
        self.url, self.method, self.resource_type, self.post_data = url, method, rtype, post
        self.headers = {"content-type": ctype}
        self.frame = type("F", (), {"url": "http://h:8080/po/login.do"})()


class Route:
    def __init__(self):
        self.done = None

    async def continue_(self):
        self.done = "continue"

    async def abort(self, reason="failed"):
        self.done = "abort"


def run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def make(env="op", timeout=5.0, policy=P):
    sent = []

    async def notify(msg):
        sent.append(msg)
    return Guard(policy, env, notify, timeout=timeout), sent


def test_서버_보호_주소는_막고_대상_출처는_연다():
    assert scope.blocked("http://169.254.169.254/latest/meta-data", "http://h:8080") is not None
    assert scope.blocked("file:///etc/passwd", "http://h:8080") is not None
    assert scope.blocked("http://127.0.0.1:8000/api/ieum/studio/", "http://h:8080") is not None
    assert scope.blocked("http://localhost:9000/", "http://h:8080") is not None
    # 시연처럼 대상 자체가 localhost 면 그 출처의 업무 화면은 열되, 같은 출처의 이음 콘솔 경로는 막는다
    assert scope.blocked("http://127.0.0.1:8000/demo-legacy/po/main.do", "http://127.0.0.1:8000") is None
    assert scope.blocked("http://127.0.0.1:8000/api/ieum/studio/", "http://127.0.0.1:8000") is not None
    assert scope.blocked("http://appr.corp:9090/approve.do", "http://h:8080") is None          # 다른 사내 시스템은 막지 않는다
    assert scope.blocked("http://10.9.1.2/x", "http://h:8080", ["10.9.0.0/16"]) is not None
    assert scope.blocked("about:blank", "http://h:8080") is None


def test_차단_주소_요청은_정적_자원도_막고_알린다():
    async def go():
        g, sent = make()
        r = Route()
        await g.route(r, Req("http://169.254.169.254/latest", rtype="image"))
        return r.done, sent[-1]["t"], g.decisions[-1]["decision"]
    assert run(go()) == ("abort", "blocked", "denied-host")


def test_읽기는_그대로_보낸다():
    async def go():
        g, sent = make()
        r = Route()
        await g.route(r, Req("http://h:8080/po/poList.do?a=1"))
        return r.done, sent
    assert run(go()) == ("continue", [])


def test_운영_쓰기는_승인하면_보낸다():
    async def go():
        g, sent = make()
        g.label = "저장"
        r = Route()
        task = asyncio.ensure_future(g.route(r, Req("http://h:8080/po/poSave.do", "POST", post="qty=1")))
        await asyncio.sleep(0.05)
        assert g.holding and sent[0]["t"] == "hold" and sent[0]["path"] == "/poSave.do" and sent[0]["label"] == "저장"
        assert g.decide(sent[0]["id"], True)
        await task
        return r.done, g.decisions[-1]["decision"], g.holding
    assert run(go()) == ("continue", "approve", False)


def test_다른_시스템으로_가는_운영_쓰기도_승인을_받는다():
    async def go():
        g, sent = make(timeout=0.05)
        r = Route()
        await g.route(r, Req("http://appr.corp:9090/approve.do", "POST", post="docNo=1"))
        return r.done, g.decisions[-1]["decision"]
    assert run(go()) == ("abort", "timeout")


def test_운영_쓰기는_거절하면_버린다():
    async def go():
        g, sent = make()
        r = Route()
        task = asyncio.ensure_future(g.route(r, Req("http://h:8080/po/poSave.do", "POST")))
        await asyncio.sleep(0.05)
        g.decide(sent[0]["id"], False)
        await task
        return r.done, g.decisions[-1]["decision"]
    assert run(go()) == ("abort", "deny")


def test_승인_응답이_없으면_시간_초과로_보내지_않는다():
    async def go():
        g, sent = make(timeout=0.1)
        r = Route()
        await g.route(r, Req("http://h:8080/po/poSave.do", "POST"))
        return r.done, g.decisions[-1]["decision"], sent[-1]
    done, decision, last = run(go())
    assert done == "abort" and decision == "timeout" and last == {"t": "hold-end", "id": last["id"], "decision": "timeout"}


def test_스테이징은_쓰기도_보내고_기록한다():
    async def go():
        g, sent = make(env="stg")
        r = Route()
        await g.route(r, Req("http://h:8080/po/poSave.do", "POST"))
        return r.done, g.decisions[-1]["decision"], sent
    assert run(go()) == ("continue", "staging", [])


def test_로그인_요청은_승인_없이_보내고_붙잡아_둔다():
    async def go():
        g, sent = make()
        r = Route()
        await g.route(r, Req("http://h:8080/po/loginProc.do", "POST", post="userId=a&userPw=b"))
        return r.done, sent, g.login_req["post"]
    assert run(go()) == ("continue", [], "userId=a&userPw=b")


def test_토큰_필드가_든_저장은_로그인으로_오인하지_않는다():
    async def go():
        g, sent = make(timeout=0.05)
        r = Route()
        await g.route(r, Req("http://h:8080/po/poSave.do", "POST", post="csrfToken=abc&qty=1"))
        return r.done, g.login_req, g.decisions[-1]["decision"]
    assert run(go()) == ("abort", None, "timeout")


def test_조회용_POST_는_통과하고_이름이_쓰기_같은_GET_은_승인_대상():
    async def go():
        g, sent = make(timeout=0.05)
        r1, r2 = Route(), Route()
        await g.route(r1, Req("http://h:8080/po/searchPost.do", "POST"))
        await g.route(r2, Req("http://h:8080/po/poDelete.do?id=1", "GET"))
        return r1.done, r2.done
    assert run(go()) == ("continue", "abort")


def test_Replay_쓰기_승인도_같은_창을_쓴다():
    async def go():
        g, sent = make()
        task = asyncio.ensure_future(g.ask("POST", "http://h:8080/po/poSave.do", "Replay: 발주 저장"))
        await asyncio.sleep(0.05)
        g.decide(sent[0]["id"], True)
        return await task
    assert run(go()) is True
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_guard.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.ieum.recorder.scope'`

- [ ] **Step 3: `scope.py` 작성**

```python
# apps/backend/app/ieum/recorder/scope.py
"""항상 차단하는 주소. 사람이 기록하는 동안 대상 밖으로 이동하는 것은 막지 않는다(대상 주소는 울타리가 아니라
기준점이다). 막는 것은 어떤 업무에서도 정당하게 갈 일이 없는 곳뿐이다: 서버 자신, 클라우드 메타데이터, 브라우저 내부 주소.

전제: 화면 중계에 주소창이 없다. 사람은 대상 화면이 제공하는 링크로만 이동한다. 주소창을 넣으면 이 판단을 다시 한다.
시연처럼 대상 자체가 localhost 면 그 출처의 업무 화면은 열어야 하므로, 서버 자신은 "대상 출처가 아닌 루프백"과
"같은 출처의 이음 콘솔 경로"로 판단한다.
"""
import ipaddress
from typing import List, Optional
from urllib.parse import urlsplit

DENY_SCHEMES = ("file", "chrome", "chrome-extension", "devtools", "view-source", "ftp")
DENY_HOSTS = {"metadata.google.internal", "metadata"}
DENY_NETS = [ipaddress.ip_network("169.254.0.0/16"), ipaddress.ip_network("fd00:ec2::254/128")]
CONSOLE_PATHS = ("/api/ieum/", "/ieum/")


def _ip(host: str):
    try:
        return ipaddress.ip_address(host.strip("[]"))
    except ValueError:
        return None


def blocked(url: str, target_origin: str, extra: Optional[List[str]] = None) -> Optional[str]:
    parts = urlsplit(url)
    scheme = parts.scheme.lower()
    if scheme in DENY_SCHEMES:
        return "브라우저 내부 주소"
    if scheme not in ("http", "https"):
        return None                                   # about:blank, data:, blob: 은 화면 안의 것이다
    host = (parts.hostname or "").lower()
    origin = f"{scheme}://{parts.netloc.lower()}"
    ip = _ip(host)
    nets, hosts = list(DENY_NETS), set(DENY_HOSTS)
    for e in extra or []:
        try:
            nets.append(ipaddress.ip_network(e, strict=False))
        except ValueError:
            hosts.add(e.lower())
    if host in hosts:
        return "차단 목록"
    if ip is not None and any(ip in n for n in nets if n.version == ip.version):
        return "클라우드 메타데이터·차단 대역"
    loopback = host == "localhost" or (ip is not None and ip.is_loopback)
    if loopback and origin != target_origin.lower():
        return "서버 자신"
    if loopback and parts.path.startswith(CONSOLE_PATHS):
        return "이음 콘솔"
    return None
```

- [ ] **Step 4: `guard.py` 작성**

```python
# apps/backend/app/ieum/recorder/guard.py
"""쓰기 가드: 운영에서 쓰기 요청은 붙잡아 사람에게 묻고, 서버 보호 주소는 막는다.

판단은 버튼 글자가 아니라 나가는 요청으로 한다(2026-10-09 실험: 글자로 하자 "승인대기" 행이 금지어 "승인"에 걸렸다).
글자(label)는 승인 창의 설명으로만 쓴다. 어느 출처로 가는 쓰기든 같다 — 결재 시스템의 저장도 운영 데이터를 바꾼다.

자동 탐색과 달리 가짜 응답을 만들지 않는다. 가짜 {} 를 받은 화면은 다음 단계에 필요한 값(생성 번호)이 없어 헤맨다.

로그인은 비밀번호 계열 필드가 있을 때만 로그인으로 본다. masking.is_secret_key 는 token 도 비밀로 봐서, 그걸 쓰면
csrfToken 이 든 저장 요청을 로그인으로 오인해 승인 없이 보낸다.
"""
import asyncio
import re
import time
import uuid
from typing import Awaitable, Callable, Dict, List, Optional
from urllib.parse import urlsplit

from app.ieum.discovery import capture
from app.ieum.discovery.policy import Policy
from app.ieum.recorder import config, scope

_PW_WORDS = frozenset("pw pwd pass passwd password".split())
_WORD = re.compile(r"[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+")


def _is_password_field(name: str) -> bool:
    return any(w.lower() in _PW_WORDS for w in _WORD.findall(str(name)))


class Guard:
    def __init__(self, policy: Policy, env: str, notify: Callable[[dict], Awaitable[None]], timeout: float = 120.0):
        self.policy, self.env, self.notify, self.timeout = policy, env, notify, timeout
        parts = urlsplit(policy.base)
        self.target_origin = f"{parts.scheme}://{parts.netloc}"
        self.label = ""
        self.login_req: Optional[dict] = None
        self.decisions: List[dict] = []
        self.decided_requests: Dict[int, str] = {}
        self._holds: Dict[str, asyncio.Future] = {}

    @property
    def holding(self) -> bool:
        return bool(self._holds)

    async def route(self, route, request) -> None:
        try:
            await self._route(route, request)
        except Exception:
            try:
                await route.continue_()
            except Exception:
                pass

    def _is_login(self, request) -> bool:
        try:
            fields = capture.parse_form(request.post_data, (request.headers or {}).get("content-type", ""))
        except Exception:
            return False
        return any(_is_password_field(k) for k in fields)

    async def _route(self, route, request) -> None:
        url, method, rtype = request.url, request.method.upper(), request.resource_type
        why = scope.blocked(url, self.target_origin, config.deny_entries())
        if why:
            self._log(method, url, "denied-host", label=why)
            await self.notify({"t": "blocked", "url": url[:200], "why": why})
            await route.abort("blockedbyclient")
            return
        if not capture.is_write(url, method, rtype, self.policy):
            await route.continue_()
            return
        if self._is_login(request):
            frame_url = getattr(getattr(request, "frame", None), "url", "") or ""
            self.login_req = {"url": url, "method": method, "post": request.post_data,
                              "ctype": (request.headers or {}).get("content-type", ""), "page": frame_url}
            await route.continue_()
            return
        if self.policy.is_read_post(url):
            await route.continue_()
            return
        if self.env != "op":
            self._log(method, url, "staging")
            self.decided_requests[id(request)] = "staging"
            await route.continue_()
            return
        decision = await self._hold(method, url, self.label)
        self.decided_requests[id(request)] = decision
        if decision == "approve":
            await route.continue_()
        else:
            await route.abort("blockedbyclient")

    async def ask(self, method: str, url: str, label: str) -> bool:
        if self.env != "op":
            self._log(method, url, "staging", label=label)
            return True
        return await self._hold(method, url, label) == "approve"

    async def _hold(self, method: str, url: str, label: str) -> str:
        hid = uuid.uuid4().hex[:8]
        fut = asyncio.get_running_loop().create_future()
        self._holds[hid] = fut
        await self.notify({"t": "hold", "id": hid, "method": method, "path": self.policy.display(url), "label": label})
        try:
            ok = await asyncio.wait_for(asyncio.shield(fut), self.timeout)
            decision = "approve" if ok else "deny"
        except asyncio.TimeoutError:
            decision = "timeout"
        finally:
            self._holds.pop(hid, None)
        self._log(method, url, decision, hid, label)
        await self.notify({"t": "hold-end", "id": hid, "decision": decision})
        return decision

    def decide(self, hold_id: str, ok: bool) -> bool:
        fut = self._holds.get(hold_id)
        if fut is None or fut.done():
            return False
        fut.set_result(bool(ok))
        return True

    def _log(self, method: str, url: str, decision: str, hid: str = "", label: str = "") -> None:
        self.decisions.append({"id": hid, "method": method, "url": self.policy.display(url), "path": urlsplit(url).path,
                               "label": label or self.label, "decision": decision, "at": time.time()})
```

- [ ] **Step 5: 시험 통과 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_guard.py -v`
Expected: 12개 PASS

- [ ] **Step 6: 커밋**

```bash
git add apps/backend/app/ieum/recorder/scope.py apps/backend/app/ieum/recorder/guard.py apps/backend/tests/test_ieum_recorder_guard.py
git commit -m "feat: 업무 기록 쓰기 가드와 서버 보호 주소 차단"
```

---

### Task 4: 화면 중계 입력, 최신 프레임만 보내기, 비동기 브라우저 실행

**Files:**
- Modify: `apps/backend/app/ieum/discovery/browser.py` (`launch` 아래 `launch_async`)
- Create: `apps/backend/app/ieum/recorder/relay.py`
- Test: `apps/backend/tests/test_ieum_recorder_relay.py`

**Interfaces:**
- Produces:
  - `await browser.launch_async(pw) -> Tuple[Browser, str]`
  - `relay.VIEW_W = 1280`, `relay.VIEW_H = 800`, `relay.KEYS: Dict[str, Tuple[int, str]]`
  - `relay.to_page(x, y, w, h) -> Tuple[float, float]` — 화면 밖 좌표는 가장자리로 자른다
  - `await relay.click(cdp, x, y)`, `await relay.wheel(cdp, x, y, dy)`, `await relay.insert_text(cdp, text)`, `await relay.key(cdp, name)`
  - `await relay.start_screencast(cdp, on_frame: Callable[[str], None])` — `on_frame`은 **동기**(프레임을 받으면 곧바로 돌아와야 한다)
  - `await relay.stop_screencast(cdp)`
  - `relay.LatestSender(send: Callable[[str], Awaitable[None]])` — `offer(data: str) -> None`, `dropped: int`, `sent: int`

- [ ] **Step 1: 실패하는 시험 작성**

```python
# apps/backend/tests/test_ieum_recorder_relay.py
"""화면 중계: 좌표 환산·최신 프레임만 보내기는 순수 시험, 클릭·한글 입력은 실제 브라우저로 시험한다."""
import asyncio
import os

import pytest

from app.ieum.discovery.browser import capabilities
from app.ieum.recorder import relay

browser_needed = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"], reason="브라우저가 없다")


def test_줄여_보인_좌표를_브라우저_좌표로_바꾼다():
    assert relay.to_page(480, 300, 960, 600) == (640.0, 400.0)
    assert relay.to_page(2000, -5, 960, 600) == (relay.VIEW_W - 1, 0.0)


def test_느린_구독자에게는_최신_프레임만_간다():
    got = []

    async def slow_send(data):
        await asyncio.sleep(0.05)
        got.append(data)

    async def go():
        s = relay.LatestSender(slow_send)
        for i in range(20):
            s.offer(str(i))
            await asyncio.sleep(0.005)
        await asyncio.sleep(0.3)
        return s
    s = asyncio.new_event_loop().run_until_complete(go())
    assert got[-1] == "19" and len(got) < 20 and s.dropped == 20 - len(got)


@browser_needed
def test_클릭과_한글_입력이_진짜_입력으로_들어간다():
    from playwright.async_api import async_playwright

    from app.ieum.discovery.browser import launch_async

    async def go():
        async with async_playwright() as pw:
            browser, _ = await launch_async(pw)
            ctx = await browser.new_context(viewport={"width": relay.VIEW_W, "height": relay.VIEW_H})
            page = await ctx.new_page()
            await page.set_content('<input id="q" style="position:absolute;left:100px;top:100px;width:200px;height:30px">'
                                   '<script>window.got=[];document.addEventListener("click",e=>got.push(e.isTrusted))</script>')
            cdp = await ctx.new_cdp_session(page)
            frames = []
            await relay.start_screencast(cdp, lambda data: frames.append(len(data)))
            await relay.click(cdp, 200, 115)
            await relay.insert_text(cdp, "한빛")
            await relay.key(cdp, "Backspace")
            await page.wait_for_timeout(300)
            value, trusted = await page.input_value("#q"), await page.evaluate("window.got")
            await relay.stop_screencast(cdp)
            await browser.close()
            return value, trusted, len(frames)
    value, trusted, n = asyncio.new_event_loop().run_until_complete(go())
    assert value == "한" and trusted == [True] and n > 0
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_relay.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.ieum.recorder.relay'`

- [ ] **Step 3: `launch_async` 추가** (`browser.py`의 `launch` 바로 아래)

```python
async def launch_async(pw) -> Tuple[object, str]:
    """launch 와 같은 순서의 비동기판. 업무 기록은 화면 중계 때문에 비동기 Playwright 를 쓴다."""
    attempts = [("chromium", {})] + [(ch, {"channel": ch}) for ch in _system_channels()]
    errors = []
    for name, kw in attempts:
        try:
            return await pw.chromium.launch(headless=True, timeout=LAUNCH_TIMEOUT_MS, **kw), name
        except Exception as exc:  # 설치 안 됨, 실행 실패 모두
            errors.append(f"{name}: {str(exc).splitlines()[0][:120]}")
    raise BrowserUnavailable("브라우저를 띄우지 못했습니다. " + INSTALL_HINT + " (" + "; ".join(errors) + ")")
```

- [ ] **Step 4: `relay.py` 작성**

```python
# apps/backend/app/ieum/recorder/relay.py
"""화면 중계: 서버 브라우저 화면을 영상으로 보내고, 사용자의 입력을 CDP 로 되돌려 넣는다.

무엇을 눌렀는지는 영상이 아니라 브라우저 안 이벤트로 안다(trace.py). 여기서는 입력을 진짜 입력으로 넣기만 한다.
CDP Input.dispatch* 로 넣은 입력은 페이지에서 isTrusted=true 다(2026-10-09 실험).

한글은 사용자 쪽에서 조합이 끝난 글자를 Input.insertText 로 넣는다. 키를 하나씩 보내면 자모가 깨진다.

느린 사용자에게 프레임을 쌓아 두면 메모리가 늘고 화면이 점점 늦어진다. 구독자마다 최신 프레임 하나만 들고,
보내는 중에 새 프레임이 오면 앞 것을 버린다(LatestSender).
"""
import asyncio
from typing import Awaitable, Callable, Dict, Optional, Tuple

VIEW_W, VIEW_H = 1280, 800
KEYS: Dict[str, Tuple[int, str]] = {
    "Enter": (13, "\r"), "Backspace": (8, ""), "Tab": (9, ""), "Escape": (27, ""), "Delete": (46, ""),
    "ArrowUp": (38, ""), "ArrowDown": (40, ""), "ArrowLeft": (37, ""), "ArrowRight": (39, ""), "Home": (36, ""), "End": (35, ""),
}


def to_page(x: float, y: float, w: float, h: float) -> Tuple[float, float]:
    px = min(max(x * VIEW_W / w, 0.0), VIEW_W - 1)
    py = min(max(y * VIEW_H / h, 0.0), VIEW_H - 1)
    return float(px), float(py)


async def click(cdp, x: float, y: float) -> None:
    for typ in ("mouseMoved", "mousePressed", "mouseReleased"):
        await cdp.send("Input.dispatchMouseEvent", {"type": typ, "x": x, "y": y, "button": "left", "clickCount": 1})


async def wheel(cdp, x: float, y: float, dy: float) -> None:
    await cdp.send("Input.dispatchMouseEvent", {"type": "mouseWheel", "x": x, "y": y, "deltaX": 0, "deltaY": dy})


async def insert_text(cdp, text: str) -> None:
    await cdp.send("Input.insertText", {"text": text})


async def key(cdp, name: str) -> None:
    code, text = KEYS[name]
    base = {"key": name, "code": name, "windowsVirtualKeyCode": code}
    await cdp.send("Input.dispatchKeyEvent", dict(base, type="keyDown", **({"text": text} if text else {})))
    await cdp.send("Input.dispatchKeyEvent", dict(base, type="keyUp"))


async def start_screencast(cdp, on_frame: Callable[[str], None]) -> None:
    async def handle(p):
        try:
            await cdp.send("Page.screencastFrameAck", {"sessionId": p["sessionId"]})
        except Exception:
            return
        on_frame(p["data"])
    cdp.on("Page.screencastFrame", handle)
    await cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 60, "maxWidth": VIEW_W, "maxHeight": VIEW_H})


async def stop_screencast(cdp) -> None:
    try:
        await cdp.send("Page.stopScreencast")
    except Exception:
        pass


class LatestSender:
    """구독자 하나에 최신 프레임만 보낸다."""

    def __init__(self, send: Callable[[str], Awaitable[None]]):
        self._send = send
        self._latest: Optional[str] = None
        self._busy = False
        self.dropped = 0
        self.sent = 0

    def offer(self, data: str) -> None:
        if self._latest is not None:
            self.dropped += 1
        self._latest = data
        if not self._busy:
            self._busy = True
            asyncio.ensure_future(self._pump())

    async def _pump(self) -> None:
        try:
            while self._latest is not None:
                data, self._latest = self._latest, None
                await self._send(data)
                self.sent += 1
        except Exception:
            self._latest = None
        finally:
            self._busy = False
```

- [ ] **Step 5: 시험 통과 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_relay.py -v`
Expected: 3개 PASS (브라우저가 없으면 1개 SKIP)

- [ ] **Step 6: 커밋**

```bash
git add apps/backend/app/ieum/discovery/browser.py apps/backend/app/ieum/recorder/relay.py apps/backend/tests/test_ieum_recorder_relay.py
git commit -m "feat: 업무 기록 화면 중계 입력과 최신 프레임만 보내기"
```

---

### Task 5: HTML 표 변환

서버가 그려 주는 화면의 HTML에서 표·이름값·숨은 입력을 JSON으로 바꾼다. 순수 함수다.

**Files:**
- Create: `apps/backend/app/ieum/recorder/htmltable.py`
- Test: `apps/backend/tests/test_ieum_recorder_htmltable.py`

**Interfaces:**
- Produces:
  - `htmltable.to_data(html: str) -> Optional[dict]` — `{"tables": [{"columns": [...], "rows": [{열: 값, "_links": [...]}]}], "fields": {...}, "hidden": {...}}`. 셋 다 비면 `None`
  - `htmltable.looks_html(ctype: str, body: str) -> bool`
  - `htmltable.shape(data: dict) -> set` — 구조 비교용 키 집합: `t<i>:<열 이름>`과 `f:<필드 이름>`

- [ ] **Step 1: 실패하는 시험 작성**

```python
# apps/backend/tests/test_ieum_recorder_htmltable.py
"""HTML 표 변환. 레거시 JSP 가 그려 주는 화면을 데이터로 바꾼다."""
from app.ieum.recorder import htmltable

LIST = """<html><body><div id="menu"><a href="main.do">메인</a></div>
<form><input type="hidden" name="_csrf" value="t0k3n"></form>
<table class="list"><tr><th>발주번호</th><th>거래처</th><th>금액</th><th>금액</th></tr>
<tr onclick="openDetail('PO-2609-0142')"><td><a href="poDetail.do?poNo=PO-2609-0142">PO-2609-0142</a></td><td> 한빛
상사 </td><td>4,850,000</td><td>1</td></tr>
<tr><td><a href="poDetail.do?poNo=PO-2609-0138">PO-2609-0138</a></td><td colspan="2">대한문구</td><td>2</td></tr>
</table></body></html>"""

DETAIL = """<table class="form"><tr><th>거래처명</th><td>한빛상사</td><th>대표자</th><td>홍길동</td></tr>
<tr><th>연락처</th><td>010-4821-5678</td></tr></table>
<table><tr><td><img src="logo.png"></td><td>배치용</td></tr></table>"""


def test_목록_표를_행_데이터로_바꾼다():
    d = htmltable.to_data(LIST)
    t = d["tables"][0]
    assert t["columns"] == ["발주번호", "거래처", "금액", "금액_2"]
    assert t["rows"][0]["발주번호"] == "PO-2609-0142" and t["rows"][0]["거래처"] == "한빛 상사"
    assert "poDetail.do?poNo=PO-2609-0142" in t["rows"][0]["_links"] and "PO-2609-0142" in t["rows"][0]["_links"]   # href 와 onclick 값
    assert t["rows"][1]["거래처"] == "대한문구" and t["rows"][1]["금액"] == "대한문구"                          # colspan 은 같은 값으로 채운다
    assert d["hidden"] == {"_csrf": "t0k3n"}


def test_상세_화면은_이름값으로_모으고_배치용_표는_버린다():
    d = htmltable.to_data(DETAIL)
    assert d["fields"] == {"거래처명": "한빛상사", "대표자": "홍길동", "연락처": "010-4821-5678"}
    assert d["tables"] == []


def test_표도_필드도_숨은_값도_없으면_None():
    assert htmltable.to_data("<div>안녕하세요</div>") is None


def test_구조_비교용_키():
    assert htmltable.shape(htmltable.to_data(DETAIL)) == {"f:거래처명", "f:대표자", "f:연락처"}
    assert "t0:발주번호" in htmltable.shape(htmltable.to_data(LIST))


def test_HTML_판별():
    assert htmltable.looks_html("text/html;charset=EUC-KR", "")
    assert htmltable.looks_html("", "  <table>")
    assert not htmltable.looks_html("application/json", '{"a":1}')
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_htmltable.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: 구현**

```python
# apps/backend/app/ieum/recorder/htmltable.py
"""서버가 그려 주는 화면(HTML)을 데이터로 바꾼다.

JSP 같은 레거시는 조회 버튼이 폼을 제출하면 서버가 결과 표까지 그린 페이지 전체를 돌려준다. JSON 이 아니라서 값
꺼내기·구조 비교·AI 에게 줄 결과가 모두 막힌다. 그래서 표를 행 데이터로 바꾼 사본을 만들어 JSON 응답처럼 다룬다.

- tables: <th> 머리글이 있는 표. 행은 {열 이름: 값}. 칸 안의 링크 주소와 onclick 안의 문자열을 _links 에 모은다
  (레거시에서 다음 화면으로 넘어가는 값이 주로 여기 있다).
- fields: <th>이름</th><td>값</td> 짝으로 된 상세 화면.
- hidden: 폼의 숨은 입력. 매번 바뀌는 토큰을 찾는 데 쓴다.
머리글 없는 표는 화면 배치용으로 보고 버린다. 표가 아닌 화면(div 나열)은 다루지 않는다.
"""
import re
from html.parser import HTMLParser
from typing import Dict, List, Optional

_JS_STR = re.compile(r"""['"]([^'"\s][^'"]{0,99})['"]""")


def looks_html(ctype: str, body: str) -> bool:
    return "html" in (ctype or "").lower() or (body or "").lstrip()[:1] == "<"


class _Parser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: List[dict] = []          # 열린 표들. {rows, row, cell}
        self.done: List[List[dict]] = []     # 닫힌 표의 행들
        self.hidden: Dict[str, str] = {}

    def handle_starttag(self, tag, attrs):
        a = {k: (v or "") for k, v in attrs}
        t = self.stack[-1] if self.stack else None
        if tag == "table":
            self.stack.append({"rows": [], "row": None, "cell": None})
        elif tag == "tr" and t is not None:
            t["row"] = {"cells": [], "links": _JS_STR.findall(a.get("onclick", ""))}
        elif tag in ("td", "th") and t is not None and t["row"] is not None:
            t["cell"] = {"th": tag == "th", "text": [], "links": _JS_STR.findall(a.get("onclick", "")),
                         "colspan": _int(a.get("colspan")), "rowspan": _int(a.get("rowspan"))}
        elif tag == "input" and a.get("type", "").lower() == "hidden" and a.get("name"):
            self.hidden[a["name"]] = a.get("value", "")
        if tag == "a" and t is not None and t["cell"] is not None:
            href = a.get("href", "")
            if href and not href.startswith(("#", "javascript:void")):
                t["cell"]["links"].append(href)
            t["cell"]["links"] += _JS_STR.findall(a.get("onclick", "") + " " + (href if href.startswith("javascript:") else ""))

    def handle_endtag(self, tag):
        t = self.stack[-1] if self.stack else None
        if t is None:
            return
        if tag in ("td", "th") and t["cell"] is not None and t["row"] is not None:
            c = t["cell"]
            c["text"] = " ".join("".join(c["text"]).split())
            t["row"]["cells"].append(c)
            t["cell"] = None
        elif tag == "tr" and t["row"] is not None:
            t["rows"].append(t["row"])
            t["row"] = None
        elif tag == "table":
            self.done.append(self.stack.pop()["rows"])

    def handle_data(self, data):
        if self.stack and self.stack[-1]["cell"] is not None:
            self.stack[-1]["cell"]["text"].append(data)


def _int(v: Optional[str]) -> int:
    try:
        return max(1, min(int(v or 1), 20))
    except ValueError:
        return 1


def _grid(rows: List[dict]) -> List[List[dict]]:
    """colspan·rowspan 을 펴서 칸 격자로 만든다. 병합 칸은 각 칸에 같은 값을 채운다."""
    out, carry = [], {}                       # carry: 열 번호 → (남은 행 수, 칸)
    for r in rows:
        line, col = [], 0
        cells = list(r["cells"])
        while cells or col in carry:
            if col in carry:
                left, cell = carry[col]
                line.append(cell)
                carry[col] = (left - 1, cell)
                if left - 1 <= 0:
                    del carry[col]
                col += 1
                continue
            c = cells.pop(0)
            for _ in range(c["colspan"]):
                line.append(c)
                if c["rowspan"] > 1:
                    carry[col] = (c["rowspan"] - 1, c)
                col += 1
        out.append((line, r["links"]))
    return out


def _unique(names: List[str]) -> List[str]:
    seen: Dict[str, int] = {}
    out = []
    for n in names:
        n = n or "열"
        seen[n] = seen.get(n, 0) + 1
        out.append(n if seen[n] == 1 else f"{n}_{seen[n]}")
    return out


def to_data(html: str) -> Optional[dict]:
    p = _Parser()
    try:
        p.feed(html or "")
        p.close()
    except Exception:
        return None
    while p.stack:
        p.done.append(p.stack.pop()["rows"])
    tables, fields = [], {}
    for rows in p.done:
        grid = _grid(rows)
        head = next((i for i, (line, _) in enumerate(grid) if line and all(c["th"] for c in line) and len(line) >= 2), None)
        if head is not None:
            cols = _unique([c["text"] for c in grid[head][0]])
            body = []
            for line, row_links in grid[head + 1:]:
                if not line or all(c["th"] for c in line):
                    continue
                row = {cols[i]: c["text"] for i, c in enumerate(line[:len(cols)])}
                links = list(dict.fromkeys(row_links + [x for c in line for x in c["links"]]))
                if links:
                    row["_links"] = links
                body.append(row)
            tables.append({"columns": cols, "rows": body})
            continue
        for line, _ in grid:                     # <th>이름</th><td>값</td> 짝
            for i in range(0, len(line) - 1):
                if line[i]["th"] and not line[i + 1]["th"] and line[i]["text"]:
                    fields.setdefault(line[i]["text"], line[i + 1]["text"])
    if not tables and not fields and not p.hidden:
        return None
    return {"tables": tables, "fields": fields, "hidden": p.hidden}


def shape(data: dict) -> set:
    keys = {f"f:{k}" for k in (data or {}).get("fields", {})}
    for i, t in enumerate((data or {}).get("tables", [])):
        keys |= {f"t{i}:{c}" for c in t["columns"]}
    return keys
```

- [ ] **Step 4: 시험 통과 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_htmltable.py -v`
Expected: 5개 PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/app/ieum/recorder/htmltable.py apps/backend/tests/test_ieum_recorder_htmltable.py
git commit -m "feat: 서버 렌더링 화면의 HTML 표를 데이터로 바꾸는 변환기"
```

---

### Task 6: 행동 묶음 기록 (ActionSpan)

중계가 입력을 넣기 **직전에** `begin()`을 불러 직전 스냅샷을 뜬다. 다음 `begin()`이나 `finish()`가 이전 묶음을 닫는다. document 응답도 기록하고, HTML이면 변환 사본을 만든다. ARIA는 모든 프레임을 떠서 마스킹한다. 입력 원값은 메모리 지도에만 둔다.

**Files:**
- Create: `apps/backend/app/ieum/recorder/trace.py`
- Test: `apps/backend/tests/test_ieum_recorder_trace.py`

**Interfaces:**
- Consumes: `capture.STATIC_TYPES/MAX_BODY/keep_headers/is_file_response`, `policy.is_asset`, `Masker`, `htmltable.to_data/looks_html`, `store.append_span/rec_dir`, `Guard.decided_requests/label`
- Produces:
  - `trace.INIT_JS: str` — `window.__ieumRec({type, isTrusted, el:{tag,id,name,role,text,label}, value, page})`
  - `Trace(rid, policy, guard, notify, on_closed=None)` — `on_closed(page, span)` 비동기, 묶음 저장 뒤 불림
  - `await trace.begin(page, kind) -> Optional[int]`, `await trace.finish(page)`
  - `trace.on_dom_event(source, ev)`, `async trace.on_response(response)`, `trace.on_request(request)`, `trace.on_request_done(request)`
  - `trace.paused: bool`, `trace.seq: int`, `trace.raw: Dict[str, str]` — **마스킹한 값 → 원값**(메모리 전용)
  - `trace.MAX_SPANS = 300`, `trace.ARIA_MAX = 20_000`, `trace.RES_MAX = 4_000`
  - 저장되는 네트워크 항목: `{method, url, path, origin, base, status, ctype, charset, rtype, headers, post, res, data, file, held, decision, primary, t}`
    - `base`: 대상 출처면 `policy.base`, 아니면 그 출처(`scheme://host:port`)
    - `path`: 대상 출처면 `policy.rel(경로)`, 아니면 절대 경로
  - 직전·직후 스냅샷: `{url, href, title, aria, hidden, shot}` — `href`는 마스킹한 절대 주소, `hidden`은 본 프레임의 숨은 입력(마스킹)
  - 알림: `{"t": "span", "seq", "action", "network": [{method, path, status, held, decision, kind}]}`, `{"t": "limit"}`

- [ ] **Step 1: 실패하는 시험 작성**

```python
# apps/backend/tests/test_ieum_recorder_trace.py
"""행동 묶음 기록: 실제 화면 없는 브라우저로 작은 페이지를 열어 클릭 → 요청 → 화면 변화를 묶는다."""
import asyncio
import os

import pytest

from app.ieum.discovery.browser import capabilities
from app.ieum.discovery.policy import Policy
from app.ieum.recorder import relay, store
from app.ieum.recorder.guard import Guard
from app.ieum.recorder.trace import INIT_JS, Trace

pytestmark = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"], reason="브라우저가 없다")

PAGE = """<title>발주 현황</title><h1>발주 현황</h1><input type="hidden" name="_csrf" value="tok-1">
<input id="tel" aria-label="연락처">
<button id="btnSearch" style="position:absolute;left:10px;top:120px;width:80px;height:30px">조회</button>
<table id="t"></table>
<script>
document.getElementById('btnSearch').onclick = async () => {
  const tel = document.getElementById('tel').value;
  const r = await fetch('/po/poList.do?tel=' + tel, {headers: {'X-Requested-With': 'XMLHttpRequest'}});
  const d = await r.json();
  document.getElementById('t').innerHTML = d.resultList.map(x => '<tr><td>' + x.PO_NO + '</td><td>' + x.TEL + '</td></tr>').join('');
};
</script>"""
RES = '{"resultList":[{"PO_NO":"PO-2609-0142","TEL":"010-4821-5678"}]}'
SSR = ('<table><tr><th>거래처코드</th><th>거래처명</th></tr><tr><td><a href="vendDetail.do?vendCd=V0012">V0012</a></td>'
       '<td>한빛상사</td></tr></table>')


def _record(ieum_state, steps):
    rec = store.new_recording("t", "홍길동", "http://rec.test/po", "", "op", "manual", "")
    store.save_recording(rec)
    sent = []

    async def notify(msg):
        sent.append(msg)

    async def go():
        from playwright.async_api import async_playwright

        from app.ieum.discovery.browser import launch_async
        async with async_playwright() as pw:
            browser, _ = await launch_async(pw)
            ctx = await browser.new_context(viewport={"width": relay.VIEW_W, "height": relay.VIEW_H})
            policy = Policy(base="http://rec.test/po")
            guard = Guard(policy, "op", notify)
            tr = Trace(rec["id"], policy, guard, notify)
            await ctx.expose_binding("__ieumRec", tr.on_dom_event)
            await ctx.add_init_script(INIT_JS)
            ctx.on("request", tr.on_request)
            ctx.on("requestfinished", tr.on_request_done)
            ctx.on("requestfailed", tr.on_request_done)
            ctx.on("response", tr.on_response)

            async def fake(route):
                u = route.request.url
                if u.endswith("/po/list.html"):
                    await route.fulfill(status=200, content_type="text/html; charset=utf-8", body=PAGE)
                elif "/po/vendSearch.do" in u:
                    await route.fulfill(status=200, content_type="text/html; charset=utf-8", body=SSR)
                else:
                    await route.fulfill(status=200, content_type="application/json", body=RES)
            await ctx.route("http://rec.test/**", fake)
            page = await ctx.new_page()
            await page.goto("http://rec.test/po/list.html")
            cdp = await ctx.new_cdp_session(page)
            await steps(page, cdp, tr)
            await tr.finish(page)
            await browser.close()
            return tr
    tr = asyncio.new_event_loop().run_until_complete(go())
    return rec, sent, tr


def test_클릭과_요청과_화면_변화를_한_묶음으로_저장하고_개인정보는_가린다(ieum_state):
    async def steps(page, cdp, tr):
        await page.fill("#tel", "010-4821-5678")
        await tr.begin(page, "click")
        await relay.click(cdp, 50, 135)
        await page.wait_for_timeout(500)
    rec, sent, tr = _record(ieum_state, steps)
    span = store.read_spans(rec["id"])[0]
    assert span["action"]["target"]["id"] == "btnSearch" and span["action"]["isTrusted"] is True
    assert span["pre"]["title"] == "발주 현황" and span["pre"]["hidden"] == {"_csrf": "tok-1"}
    assert "PO-2609-0142" in span["post"]["aria"] and "010-4821-5678" not in span["post"]["aria"]   # ARIA 도 마스킹한다
    net = span["network"][0]
    assert net["path"] == "/poList.do" and net["base"] == "http://rec.test/po" and net["primary"] is True
    assert "010-4821-5678" not in net["url"] and "010-4821-5678" not in net["res"]
    assert "010-4821-5678" in tr.raw.values()                     # 원값은 메모리 지도에만 있다
    assert (store.rec_dir(rec["id"]) / "1-pre.jpg").exists() and any(m["t"] == "span" for m in sent)


def test_서버가_그린_화면_응답도_기록하고_표를_바꾼다(ieum_state):
    async def steps(page, cdp, tr):
        await tr.begin(page, "click")
        await page.goto("http://rec.test/po/vendSearch.do?vendNm=x")
        await page.wait_for_timeout(300)
    rec, sent, tr = _record(ieum_state, steps)
    net = [n for s in store.read_spans(rec["id"]) for n in s["network"] if n["path"] == "/vendSearch.do"][0]
    assert net["rtype"] == "document" and net["data"]["tables"][0]["rows"][0]["거래처코드"] == "V0012"


def test_일시정지_중에는_묶음을_만들지_않는다(ieum_state):
    rec = store.new_recording("t", "", "http://rec.test/po", "", "op", "manual", "")
    store.save_recording(rec)

    async def notify(msg):
        pass
    p = Policy(base="http://rec.test/po")
    tr = Trace(rec["id"], p, Guard(p, "op", notify), notify)
    tr.paused = True
    assert asyncio.new_event_loop().run_until_complete(tr.begin(None, "click")) is None
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_trace.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.ieum.recorder.trace'`

- [ ] **Step 3: 구현**

```python
# apps/backend/app/ieum/recorder/trace.py
"""행동 묶음(ActionSpan) 기록.

중계가 입력을 넣기 직전에 begin() 을 부른다. 그 순간의 화면(직전 스냅샷)을 뜨고 새 묶음을 연다. 그 뒤에 나간 요청은
모두 이 묶음에 붙는다. 다음 begin() 이나 finish() 가 이 묶음을 닫는데, 네트워크가 잠잠해질 때까지 기다린 뒤
직후 스냅샷을 뜨고 기록별 파일에 한 줄 덧붙인다.

- 무엇을 눌렀는지는 페이지 안 기록 스크립트(INIT_JS)가 알려 준다. 영상 좌표로 추측하지 않는다.
- 화면 이동(document) 응답도 기록한다. 서버가 결과 표를 그려 주는 레거시 화면에서는 그것이 API 다.
  HTML 이면 표를 데이터로 바꾼 사본(data)을 함께 둔다.
- ARIA 스냅샷은 모든 프레임을 떠서 잇는다(레거시는 iframe·frameset 이 많다). 저장 전에 마스킹한다.
- 응답·요청·ARIA 는 마스킹한 값만 저장한다. 입력 원값은 raw 지도(마스킹 값 → 원값)에만 두고 Replay 가 쓴다.
- 파일 쓰기와 HTML 변환은 이벤트 루프를 막지 않게 스레드로 넘긴다.
"""
import asyncio
import json
import re
import time
from typing import Awaitable, Callable, Dict, Optional
from urllib.parse import parse_qsl, urlsplit

from app.ieum.discovery import capture
from app.ieum.discovery.masking import Masker
from app.ieum.discovery.policy import Policy, is_asset
from app.ieum.recorder import htmltable, store
from app.ieum.recorder.guard import Guard

MAX_SPANS = 300
ARIA_MAX = 20_000
RES_MAX = 4_000
SETTLE_MAX_MS = 3000
SETTLE_QUIET_MS = 400
_CHARSET = re.compile(r"charset=([\w-]+)", re.I)

INIT_JS = """
(() => {
  if (window.__ieumRecInstalled) return; window.__ieumRecInstalled = true;
  const desc = (el) => el ? ({ tag: el.tagName || '', id: el.id || '', name: (el.getAttribute && (el.getAttribute('name') || '')) || '',
      role: (el.getAttribute && el.getAttribute('role')) || '', text: ((el.innerText || el.value || (el.getAttribute && el.getAttribute('aria-label')) || '') + '').trim().slice(0, 60) }) : null;
  const pick = (el) => (el && el.closest) ? (el.closest('button,a,input,select,textarea,tr,[onclick],[role]') || el) : el;
  const label = (el) => { try { if (el.labels && el.labels[0]) return el.labels[0].innerText.trim().slice(0, 40);
      const th = el.closest('td') && el.closest('td').previousElementSibling; if (th && th.tagName === 'TH') return th.innerText.trim().slice(0, 40); } catch (e) {}
      return (el.getAttribute && el.getAttribute('aria-label')) || ''; };
  const send = (o) => { try { window.__ieumRec(o); } catch (e) {} };
  document.addEventListener('click', (e) => send({ type: 'click', isTrusted: e.isTrusted, el: desc(pick(e.target)), page: location.pathname }), true);
  document.addEventListener('change', (e) => { const t = e.target; if (!t || t.type === 'password') return;
      send({ type: 'change', isTrusted: e.isTrusted, el: Object.assign(desc(t), { label: label(t) }), value: (t.value + '').slice(0, 200), page: location.pathname }); }, true);
})();
"""

_HIDDEN_JS = "() => Object.fromEntries([...document.querySelectorAll('input[type=hidden][name]')].slice(0, 50).map(i => [i.name, (i.value || '').slice(0, 300)]))"


class Trace:
    def __init__(self, rid: str, policy: Policy, guard: Guard, notify: Callable[[dict], Awaitable[None]],
                 on_closed: Optional[Callable[[object, dict], Awaitable[None]]] = None):
        self.rid, self.policy, self.guard, self.notify, self.on_closed = rid, policy, guard, notify, on_closed
        self.masker = Masker(pii=True)
        self.raw: Dict[str, str] = {}
        self.paused = False
        self.seq = 0
        self.current: Optional[dict] = None
        self._inflight = 0
        self._limit_sent = False

    # ── 마스킹 (원값은 지도에 남긴다) ───────────────────────────────────────
    def _m(self, v: str) -> str:
        m = self.masker.text(v)
        if m != v and v:
            self.raw[m] = v
        return m

    def _pairs_text(self, pairs) -> str:
        out = []
        for k, v in pairs:
            masked = self.masker.pairs([(k, v)])[0][1]
            if masked != v and v and masked != "••••••••":
                self.raw[masked] = v
            out.append(f"{k}={masked}")
        return "&".join(out)

    def _url(self, url: str) -> str:
        parts = urlsplit(url)
        return parts._replace(query=self._pairs_text(parse_qsl(parts.query, keep_blank_values=True))).geturl()

    def _post(self, post: Optional[str], ctype: str) -> Optional[str]:
        if not post:
            return None
        if "json" in (ctype or "").lower():
            try:
                return json.dumps(self.masker.value(json.loads(post)), ensure_ascii=False)[:RES_MAX]
            except ValueError:
                return self._m(post)[:RES_MAX]
        return self._pairs_text(parse_qsl(post, keep_blank_values=True))[:RES_MAX]

    # ── 진행 중 요청 ───────────────────────────────────────────────────────
    def on_request(self, request) -> None:
        if request.resource_type in ("xhr", "fetch", "document"):
            self._inflight += 1

    def on_request_done(self, request) -> None:
        if request.resource_type in ("xhr", "fetch", "document"):
            self._inflight = max(0, self._inflight - 1)

    async def _settle(self) -> None:
        end, quiet = time.time() + SETTLE_MAX_MS / 1000, None
        while time.time() < end:
            await asyncio.sleep(0.08)
            if self._inflight <= 0:
                quiet = quiet or time.time()
                if (time.time() - quiet) * 1000 >= SETTLE_QUIET_MS:
                    return
            else:
                quiet = None

    # ── 스냅샷 ─────────────────────────────────────────────────────────────
    async def _aria(self, page) -> str:
        parts = []
        for frame in page.frames:
            try:
                text = await frame.locator("body").aria_snapshot(timeout=1500)
            except Exception:
                continue
            if text:
                parts.append(text if frame == page.main_frame else f"- frame {self.policy.display(frame.url)}:\n{text}")
        return self.masker.text("\n".join(parts))[:ARIA_MAX]

    async def _snapshot(self, page, seq: int, when: str) -> dict:
        out = {"url": "", "href": "", "title": "", "aria": "", "hidden": {}, "shot": None}
        if page is None:
            return out
        try:
            out["url"], out["href"] = self.policy.display(page.url), self._url(page.url)
            out["title"] = await page.title()
        except Exception:
            pass
        out["aria"] = await self._aria(page)
        try:
            out["hidden"] = {k: self._m(str(v)) for k, v in (await page.evaluate(_HIDDEN_JS)).items()}
        except Exception:
            pass
        try:
            data = await page.screenshot(type="jpeg", quality=50)
            name = f"{seq}-{when}.jpg"
            await asyncio.to_thread(self._write_shot, name, data)
            out["shot"] = name
        except Exception:
            pass
        return out

    def _write_shot(self, name: str, data: bytes) -> None:
        d = store.rec_dir(self.rid)
        d.mkdir(parents=True, exist_ok=True)
        (d / name).write_bytes(data)

    # ── 묶음 ───────────────────────────────────────────────────────────────
    async def begin(self, page, kind: str) -> Optional[int]:
        if self.paused:
            return None
        await self._close(page)
        if self.seq >= MAX_SPANS:
            if not self._limit_sent:
                self._limit_sent = True
                await self.notify({"t": "limit"})
            return None
        self.seq += 1
        pre = await self._snapshot(page, self.seq, "pre")
        self.current = {"seq": self.seq, "action": {"type": kind, "target": None, "isTrusted": None, "t": time.time()},
                        "fills": [], "pre": pre, "network": [], "post": None}
        return self.seq

    async def finish(self, page) -> None:
        await self._close(page)

    async def _close(self, page) -> None:
        span, self.current = self.current, None
        if span is None:
            return
        await self._settle()
        span["post"] = await self._snapshot(page, span["seq"], "post")
        await asyncio.to_thread(store.append_span, self.rid, span)
        await self.notify({"t": "span", "seq": span["seq"], "action": span["action"],
                           "network": [{"method": n["method"], "path": n["path"], "status": n["status"], "held": n["held"],
                                        "decision": n["decision"], "kind": "html" if n.get("data") else "data"} for n in span["network"]]})
        if self.on_closed is not None:
            try:
                await self.on_closed(page, span)
            except Exception:
                pass

    # ── 브라우저 안 이벤트 ─────────────────────────────────────────────────
    def on_dom_event(self, source, ev: dict) -> None:
        span = self.current
        if span is None or not isinstance(ev, dict):
            return
        el = ev.get("el") or {}
        if ev.get("type") == "click" and span["action"]["target"] is None:
            span["action"]["target"] = el
            span["action"]["isTrusted"] = ev.get("isTrusted")
            self.guard.label = el.get("text") or el.get("id") or ""
        elif ev.get("type") == "change":
            span["fills"].append({"target": el, "value": self._m(str(ev.get("value") or ""))})

    # ── 응답 ───────────────────────────────────────────────────────────────
    async def on_response(self, response) -> None:
        span = self.current
        if span is None:
            return
        try:
            req = response.request
            url, rtype, status = response.url, req.resource_type, response.status
            if not url.startswith(("http://", "https://")) or rtype in capture.STATIC_TYPES or is_asset(url) or 300 <= status < 400:
                return
            is_file, ctype = capture.is_file_response(response.headers)
            body = ""
            if not is_file:
                try:
                    body = (await response.text())[:capture.MAX_BODY]
                except Exception:
                    body = ""
            data = None
            if body and htmltable.looks_html(ctype, body):
                data = await asyncio.to_thread(htmltable.to_data, body)
                data = self.masker.value(data) if data else None
            masked = self._mask_body(body)
            if masked is None:
                return                                   # 마스킹하지 못하면 저장하지 않는다
            parts = urlsplit(url)
            primary = self.policy.same_origin(url)
            req_ctype = (req.headers or {}).get("content-type", "")
            m = _CHARSET.search(req_ctype) or _CHARSET.search(ctype)
            decision = self.guard.decided_requests.get(id(req), "")
            span["network"].append({
                "method": req.method.upper(), "url": self._url(url), "origin": f"{parts.scheme}://{parts.netloc}",
                "base": self.policy.base if primary else f"{parts.scheme}://{parts.netloc}",
                "path": self.policy.rel(parts.path) if primary else parts.path,
                "status": status, "ctype": ctype, "charset": m.group(1).upper() if m else None, "rtype": rtype,
                "headers": capture.keep_headers(req.headers), "post": self._post(req.post_data, req_ctype),
                "res": masked, "data": data, "file": is_file, "held": bool(decision and decision != "staging"),
                "decision": decision, "primary": primary, "t": time.time()})
        except Exception:
            pass

    def _mask_body(self, body: str) -> Optional[str]:
        try:
            t = body.lstrip()
            if t[:1] in ("{", "["):
                try:
                    return json.dumps(self.masker.value(json.loads(t)), ensure_ascii=False)[:RES_MAX]
                except ValueError:
                    pass
            return self.masker.text(body)[:RES_MAX]
        except Exception:
            return None
```

- [ ] **Step 4: 시험 통과 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_trace.py -v`
Expected: 3개 PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/app/ieum/recorder/trace.py apps/backend/tests/test_ieum_recorder_trace.py
git commit -m "feat: 업무 기록 행동 묶음 — 화면 이동 응답·모든 프레임 ARIA·마스킹·원값 지도"
```

---

### Task 7: 기록 세션과 관리자

**Files:**
- Create: `apps/backend/app/ieum/recorder/login.py`, `session.py`, `manager.py`
- Test: `apps/backend/tests/test_ieum_recorder_session.py`

**Interfaces:**
- Consumes: 작업 2~6, `credentials.put/delete`, `session_auth.discover_recipe`, `capture.build_recipe/recipe_rel`, `retention.sweep`
- Produces:
  - `login.on_login_page(page) -> bool`, `login.auto_login(page, creds) -> bool`, `login.recipe_for(login_req, policy, creds) -> Optional[dict]` (모두 async)
  - `RecorderSession(rec, creds)`
    - 속성: `rid`, `owner`, `token`, `policy`, `guard`, `trace`, `ctx`, `page`, `last_input`, `started`, `closed`
    - `await start(pw)`, `subscribe(ws)`, `unsubscribe(ws)`, `await broadcast(msg)`, `await send_tabs()`, `await handle(msg)`, `await stop()`, `await close()`
    - 브라우저가 끊기면 기록을 `interrupted`로 바꾸고 `status{status:"interrupted"}`를 보내고 관리자에서 뺀다
  - 보내는 메시지: `frame{data}`(구독자별 최신 프레임만), `hold`, `hold-end`, `blocked`, `span`, `limit`, `tabs{tabs, active}`, `dialog{type, message}`, `login{state, msg}`, `notice{msg}`, `status{status, error?}`
  - `manager.MANAGER`: `await start(payload) -> {id, token}`, `get(rid)`, `await stop(rid)`, `await close(rid)`, `await shutdown()`, `usage() -> {"total", "max", "perOwner", "byOwner": {이름: 개수}}`, `loop`, `on_stopped`
  - `manager.RecorderError(message, code=400)`, `manager.vault_key(rid) -> "rec:<rid>"`

- [ ] **Step 1: 실패하는 시험 작성**

```python
# apps/backend/tests/test_ieum_recorder_session.py
"""기록 세션: 자동 로그인, 화면 스트리밍, 입력 처리, 상한(서버·사람당), 격리, 브라우저 끊김."""
import asyncio
import os
import threading
import time

import pytest
import uvicorn
from fastapi import FastAPI

from app.ieum.discovery.browser import capabilities
from app.ieum.demo_legacy.site import DEMO_PASSWORD, DEMO_USER_ID

pytestmark = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"], reason="브라우저가 없다")
LOOP = {}


@pytest.fixture
def live(ieum_state):
    """이음 라우터를 실은 진짜 서버. 기록 세션은 이 서버의 이벤트 루프에서 산다."""
    from app.ieum.routers import router

    app = FastAPI()
    app.include_router(router)
    app.add_event_handler("startup", lambda: LOOP.update(loop=asyncio.get_running_loop()))
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=0, log_level="warning"))
    t = threading.Thread(target=server.run, daemon=True)
    t.start()
    while not server.started:
        time.sleep(0.02)
    yield f"http://127.0.0.1:{server.servers[0].sockets[0].getsockname()[1]}"
    server.should_exit = True                 # 라우터 shutdown 훅이 MANAGER.shutdown() 으로 브라우저를 닫는다
    t.join(timeout=30)


def call(coro, timeout=60):
    return asyncio.run_coroutine_threadsafe(coro, LOOP["loop"]).result(timeout)


def start(base, **kw):
    from app.ieum.recorder.manager import MANAGER
    payload = dict(name="9월 발주 조회", owner="홍길동", base=base + "/demo-legacy/po", start="/login.do", env="op",
                   account=DEMO_USER_ID, password=DEMO_PASSWORD)
    payload.update(kw)
    return call(MANAGER.start(payload))


class WS:
    def __init__(self):
        self.msgs = []

    async def send_json(self, msg):
        self.msgs.append(msg)


def test_서비스_계정으로_자동_로그인하고_화면을_보낸다(live):
    from app.ieum.recorder.manager import MANAGER
    out = start(live)
    s = MANAGER.get(out["id"])
    ws = WS()
    s.subscribe(ws)
    end = time.time() + 15
    while time.time() < end and not any(m["t"] == "frame" for m in ws.msgs):
        time.sleep(0.2)
    assert any(m["t"] == "frame" for m in ws.msgs) and s.page.url.endswith("/main.do")
    assert len(out["token"]) >= 16


def test_클릭하면_행동_묶음과_요청이_기록된다(live):
    from app.ieum.recorder import relay, store
    from app.ieum.recorder.manager import MANAGER
    out = start(live)
    s = MANAGER.get(out["id"])
    call(s.page.goto(s.policy.base + "/poListView.do"))
    box = call(s.page.locator("#btnSearch").bounding_box())
    call(s.handle({"t": "click", "x": box["x"] + 5, "y": box["y"] + 5, "w": relay.VIEW_W, "h": relay.VIEW_H}))
    time.sleep(1.0)
    call(s.stop())
    spans = store.read_spans(out["id"])
    assert spans[-1]["action"]["target"]["id"] == "btnSearch"
    assert any(n["path"] == "/poList.do" for n in spans[-1]["network"])


def test_사람당_상한과_서버_전체_상한(live, monkeypatch):
    from app.ieum.recorder import manager
    monkeypatch.setenv("IEUM_RECORDER_MAX_PER_OWNER", "1")
    monkeypatch.setenv("IEUM_RECORDER_MAX_SESSIONS", "2")
    start(live, owner="홍길동")
    with pytest.raises(manager.RecorderError) as e:
        start(live, owner="홍길동")
    assert e.value.code == 409 and "홍길동" in str(e.value)
    start(live, owner="김철수")
    with pytest.raises(manager.RecorderError) as e:
        start(live, owner="이영희")
    assert e.value.code == 409 and "2" in str(e.value)
    assert manager.MANAGER.usage()["byOwner"] == {"홍길동": 1, "김철수": 1}


def test_기록하는_사람은_필수다(live):
    from app.ieum.recorder import manager
    with pytest.raises(manager.RecorderError):
        start(live, owner=" ")


def test_두_세션의_쿠키가_섞이지_않는다(live):
    from app.ieum.recorder.manager import MANAGER
    a = MANAGER.get(start(live, owner="a")["id"])
    b = MANAGER.get(start(live, owner="b", account="", password="")["id"])
    assert any(c["name"] == "JSESSIONID" for c in call(a.ctx.cookies()))
    assert not any(c["name"] == "JSESSIONID" for c in call(b.ctx.cookies()))
    assert b.page.url.endswith("/login.do")


def test_브라우저가_죽으면_중단됨이_된다(live):
    from app.ieum.recorder import store
    from app.ieum.recorder.manager import MANAGER
    out = start(live)
    s = MANAGER.get(out["id"])
    call(s.browser.close())                   # 브라우저가 갑자기 사라진 상황
    time.sleep(1.0)
    assert store.get_recording(out["id"])["status"] == "interrupted" and MANAGER.get(out["id"]) is None
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_session.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.ieum.recorder.manager'`

- [ ] **Step 3: `login.py` 작성**

```python
# apps/backend/app/ieum/recorder/login.py
"""기록 세션의 로그인. 서비스 계정이 있으면 자동으로 하고, 안 되면 사람이 중계 화면에서 직접 한다.

레시피(필드 이름)는 둘 다 남긴다. 계정 값을 알면 로그인 요청에서 값으로 필드를 찾고(capture.build_recipe), 사람이 직접
로그인해 값을 모르면 로그인 화면 HTML 에서 필드를 읽는다(session_auth.discover_recipe). 비밀번호 값은 넣지 않는다.
"""
import asyncio
from typing import Optional
from urllib.parse import urlsplit

from app.ieum.discovery import capture
from app.ieum.discovery.policy import Policy
from app.ieum.gateway import session_auth


async def _find_password(page):
    for frame in page.frames:
        try:
            loc = frame.locator("input[type=password]:visible")
            if await loc.count() > 0:
                return loc.first
        except Exception:
            continue
    return None


async def on_login_page(page) -> bool:
    return await _find_password(page) is not None


async def auto_login(page, creds: dict) -> bool:
    """크롤러 _login(crawler.py:461-501) 과 같은 순서를 비동기로 한다."""
    user, pw = creds.get("username", ""), creds.get("password", "")
    pwd = await _find_password(page)
    if not (user and pw and pwd):
        return False
    form = pwd.locator("xpath=ancestor::form[1]")
    scope = form if await form.count() > 0 else page
    uid = scope.locator("input:not([type]), input[type=text], input[type=email], input[type=tel]").locator("visible=true").first
    try:
        await uid.fill(user, timeout=5000)
        await pwd.fill(pw, timeout=5000)
        submit = scope.locator("button[type=submit], input[type=submit], input[type=image]").first
        if await submit.count():
            await submit.click(timeout=4000)
        else:
            await pwd.press("Enter")
        await page.wait_for_load_state("domcontentloaded", timeout=15_000)
        await page.wait_for_timeout(600)
    except Exception:
        return False
    return not await on_login_page(page)


async def recipe_for(login_req: Optional[dict], policy: Policy, creds: Optional[dict]) -> Optional[dict]:
    if not login_req:
        return None
    if creds and creds.get("username") and creds.get("password"):
        _, recipe = capture.build_recipe(login_req, login_req.get("page") or "", creds["username"], creds["password"])
        return capture.recipe_rel(policy, recipe) if recipe else None
    page_url = login_req.get("page") or ""
    if not page_url:
        return None

    def rel(u: str) -> str:
        return policy.rel(urlsplit(u).path) if policy.same_origin(u) else u
    try:
        return await asyncio.to_thread(session_auth.discover_recipe, page_url, rel)
    except Exception:
        return None
```

- [ ] **Step 4: `session.py` 작성**

```python
# apps/backend/app/ieum/recorder/session.py
"""기록 세션 하나 = 사용자 한 명의 서버 브라우저.

세션마다 Chromium 을 따로 띄워 쿠키와 기록이 섞이지 않게 한다. 화면은 CDP 스트리밍으로 구독자마다 최신 프레임만 보내고,
입력은 relay 로 넣는다. 입력을 넣기 직전에 trace.begin() 을 불러 직전 화면을 뜬다.

쓰기 승인 창이 떠 있는 동안에는 다른 입력을 받지 않는다(승인 창 아래 클릭이 엉뚱한 곳에 들어가지 않게).
대상 사이트의 alert/confirm 은 사용자에게 그대로 묻는다. 자동 탐색처럼 항상 취소하지 않는다.
"""
import asyncio
import secrets
import time
from typing import Callable, Dict, Optional
from urllib.parse import urlsplit

from app.ieum.discovery import browser as browser_mod
from app.ieum.discovery.policy import Policy
from app.ieum.recorder import login, relay, store
from app.ieum.recorder.guard import Guard
from app.ieum.recorder.trace import INIT_JS, Trace


class RecorderSession:
    def __init__(self, rec: dict, creds: Optional[dict], on_dead: Optional[Callable[[str], None]] = None):
        self.rid, self.rec, self.creds, self.owner = rec["id"], rec, creds, rec.get("owner") or ""
        self.token = secrets.token_urlsafe(18)
        self.policy = Policy(base=rec["sourceBase"], read_post=rec.get("readPost", ""))
        self.guard = Guard(self.policy, rec["env"], self.broadcast)
        self.trace = Trace(self.rid, self.policy, self.guard, self.broadcast, on_closed=self._after_span)
        self.subs: Dict[object, relay.LatestSender] = {}
        self.started = time.time()
        self.last_input = time.time()
        self.closed = False
        self.stopping = False
        self.browser = self.ctx = self.page = self.cdp = None
        self.pages: list = []
        self._dialog = None
        self._on_dead = on_dead

    # ── 구독 ───────────────────────────────────────────────────────────────
    def subscribe(self, ws) -> None:
        self.subs[ws] = relay.LatestSender(lambda data, ws=ws: ws.send_json({"t": "frame", "data": data}))

    def unsubscribe(self, ws) -> None:
        self.subs.pop(ws, None)

    def _frame(self, data: str) -> None:
        for sender in list(self.subs.values()):
            sender.offer(data)

    async def broadcast(self, msg: dict) -> None:
        for ws in list(self.subs):
            try:
                await ws.send_json(msg)
            except Exception:
                self.subs.pop(ws, None)

    # ── 시작 ───────────────────────────────────────────────────────────────
    async def start(self, pw) -> None:
        self.browser, _ = await browser_mod.launch_async(pw)
        self.browser.on("disconnected", lambda _: asyncio.ensure_future(self._on_disconnected()))
        self.ctx = await self.browser.new_context(viewport={"width": relay.VIEW_W, "height": relay.VIEW_H}, locale="ko-KR",
                                                  ignore_https_errors=True, accept_downloads=False)
        await self.ctx.expose_binding("__ieumRec", self.trace.on_dom_event)
        await self.ctx.add_init_script(INIT_JS)
        await self.ctx.route("**/*", self.guard.route)
        self.ctx.on("request", self.trace.on_request)
        self.ctx.on("requestfinished", self.trace.on_request_done)
        self.ctx.on("requestfailed", self.trace.on_request_done)
        self.ctx.on("response", self.trace.on_response)
        page = await self.ctx.new_page()
        await self._activate(page)
        self.ctx.on("page", lambda p: asyncio.ensure_future(self._on_page(p)))   # 첫 페이지를 만든 뒤에 건다
        await page.goto(self.policy.base + (self.rec.get("start") or ""), wait_until="domcontentloaded", timeout=30_000)
        if await login.on_login_page(page):
            if self.creds and await login.auto_login(page, self.creds):
                await self.broadcast({"t": "login", "state": "done", "msg": "서비스 계정으로 로그인했습니다."})
            else:
                msg = "자동 로그인에 실패했습니다. 화면에서 직접 로그인해 주세요." if self.creds else "화면에서 직접 로그인해 주세요."
                await self.broadcast({"t": "login", "state": "needed", "msg": msg})

    async def _on_disconnected(self) -> None:
        if self.closed:
            return
        self.closed = True

        def mark(r):
            if r["status"] in store.ACTIVE:
                r.update(status="interrupted", endedAt=time.time(), error="브라우저가 예기치 않게 종료되어 기록이 중단되었습니다.")
        try:
            await asyncio.to_thread(store.update_recording, self.rid, mark)
        except KeyError:
            pass
        await self.broadcast({"t": "status", "status": "interrupted", "error": "브라우저가 종료되었습니다."})
        if self._on_dead:
            self._on_dead(self.rid)

    async def _on_page(self, page) -> None:
        if page not in self.pages:
            await self._activate(page)

    async def _activate(self, page) -> None:
        if page not in self.pages:
            self.pages.append(page)
            page.on("dialog", lambda d: asyncio.ensure_future(self._on_dialog(d)))
            page.on("filechooser", lambda fc: asyncio.ensure_future(self.broadcast(
                {"t": "notice", "msg": "파일 업로드는 아직 지원하지 않습니다. 업로드 단계는 빼고 기록해 주세요."})))
            page.on("close", lambda _: asyncio.ensure_future(self._on_close(page)))
        if self.cdp is not None:
            await relay.stop_screencast(self.cdp)
        self.page = page
        self.cdp = await self.ctx.new_cdp_session(page)
        await relay.start_screencast(self.cdp, self._frame)
        await self.send_tabs()

    async def _on_close(self, page) -> None:
        if page in self.pages:
            self.pages.remove(page)
        if page is self.page and self.pages and not self.closed:
            await self._activate(self.pages[-1])
        else:
            await self.send_tabs()

    async def send_tabs(self) -> None:
        tabs = []
        for i, p in enumerate(self.pages):
            try:
                tabs.append({"index": i, "url": self.policy.display(p.url), "title": await p.title()})
            except Exception:
                tabs.append({"index": i, "url": "", "title": ""})
        await self.broadcast({"t": "tabs", "tabs": tabs, "active": self.pages.index(self.page) if self.page in self.pages else 0})

    async def _on_dialog(self, dialog) -> None:
        self._dialog = dialog
        await self.broadcast({"t": "dialog", "type": dialog.type, "message": dialog.message})

    async def _after_span(self, page, span: dict) -> None:
        """기록 도중 로그인 화면으로 튕겼으면 알린다. 기록은 이어진다(가드가 로그인 요청을 통과시킨다)."""
        if page is not None and span["seq"] > 1 and await login.on_login_page(page):
            await self.broadcast({"t": "login", "state": "needed", "msg": "세션이 끊겼습니다. 화면에서 다시 로그인해 주세요. 기록은 이어집니다."})

    # ── 입력 ───────────────────────────────────────────────────────────────
    async def handle(self, msg: dict) -> None:
        t = msg.get("t")
        self.last_input = time.time()
        if t == "approve":
            self.guard.decide(str(msg.get("id")), bool(msg.get("ok")))
            return
        if t == "dialog" and self._dialog is not None:
            d, self._dialog = self._dialog, None
            try:
                await (d.accept(msg.get("text") or "") if msg.get("ok") else d.dismiss())
            except Exception:
                pass
            return
        if t == "pause":
            self.trace.paused = bool(msg.get("on"))
            return
        if t == "tab":
            i = int(msg.get("index", 0))
            if 0 <= i < len(self.pages):
                await self._activate(self.pages[i])
            return
        if self.guard.holding or self.cdp is None or self.stopping:
            return                                      # 승인 창이 떠 있는 동안 다른 입력은 받지 않는다
        if t == "click":
            x, y = relay.to_page(msg["x"], msg["y"], msg["w"], msg["h"])
            await self.trace.begin(self.page, "click")
            await relay.click(self.cdp, x, y)
        elif t == "wheel":
            x, y = relay.to_page(msg["x"], msg["y"], msg["w"], msg["h"])
            await relay.wheel(self.cdp, x, y, float(msg.get("dy", 0)))
        elif t == "text":
            await relay.insert_text(self.cdp, str(msg.get("data") or "")[:500])
        elif t == "key" and msg.get("key") in relay.KEYS:
            if msg["key"] == "Enter":
                await self.trace.begin(self.page, "key")
            await relay.key(self.cdp, msg["key"])

    # ── 끝 ─────────────────────────────────────────────────────────────────
    async def stop(self) -> None:
        self.stopping = True
        await self.trace.finish(self.page)
        recipe = await login.recipe_for(self.guard.login_req, self.policy, self.creds)
        login_path = urlsplit(self.guard.login_req["url"]).path if self.guard.login_req else ""

        def fin(r):
            r["endedAt"] = time.time()
            r["approvals"] = list(self.guard.decisions)
            r["login"]["recipe"] = recipe
            r["login"]["path"] = login_path
        await asyncio.to_thread(store.update_recording, self.rid, fin)

    async def close(self) -> None:
        if self.closed and self.browser is None:
            return
        self.closed = True
        try:
            if self.cdp is not None:
                await relay.stop_screencast(self.cdp)
            if self.browser is not None:
                await self.browser.close()
        except Exception:
            pass
        self.browser = None
        await self.broadcast({"t": "status", "status": "closed"})
```

- [ ] **Step 5: `manager.py` 작성**

```python
# apps/backend/app/ieum/recorder/manager.py
"""기록 세션 관리: 만들기, 찾기, 상한(서버 전체·사람당), 유휴 회수, 보관 정리 주기, Playwright 수명.

Playwright 비동기 객체는 만든 이벤트 루프에 묶인다. 시험처럼 서버(루프)가 바뀌면 이전 것은 쓸 수 없으므로 새로 만든다.
사람당 상한은 기록하는 사람 이름으로 센다(콘솔 로그인이 생기면 계정으로 바꾼다).
"""
import asyncio
import time
from typing import Awaitable, Callable, Dict, Optional

from app.ieum.gateway import credentials
from app.ieum.recorder import config, retention, store
from app.ieum.recorder.session import RecorderSession


class RecorderError(Exception):
    def __init__(self, message: str, code: int = 400):
        super().__init__(message)
        self.code = code


def vault_key(rid: str) -> str:
    return f"rec:{rid}"


def _owner_key(name: str) -> str:
    return " ".join((name or "").split())


class Manager:
    def __init__(self) -> None:
        self.sessions: Dict[str, RecorderSession] = {}
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self._pw = None
        self._reaper: Optional[asyncio.Task] = None
        self._swept_at = 0.0
        self.on_stopped: Optional[Callable[[str, RecorderSession], Awaitable[None]]] = None

    async def _ensure(self):
        loop = asyncio.get_running_loop()
        if self.loop is not loop:                     # 루프가 바뀌었다(서버 재기동, 시험). 이전 세션은 쓸 수 없다
            self.sessions, self._pw, self._reaper = {}, None, None
            self.loop = loop
        if self._pw is None:
            from playwright.async_api import async_playwright
            self._pw = await async_playwright().start()
        if self._reaper is None:
            self._reaper = asyncio.ensure_future(self._reap())
        return self._pw

    def usage(self) -> dict:
        by: Dict[str, int] = {}
        for s in self.sessions.values():
            if not s.closed:
                by[_owner_key(s.owner)] = by.get(_owner_key(s.owner), 0) + 1
        return {"total": sum(by.values()), "max": config.max_sessions(), "perOwner": config.max_per_owner(), "byOwner": by}

    async def start(self, payload: dict) -> dict:
        name = (payload.get("name") or "").strip()
        owner = _owner_key(payload.get("owner") or "")
        base = (payload.get("base") or "").strip().rstrip("/")
        env = payload.get("env") or "op"
        if not name:
            raise RecorderError("업무 이름을 입력해 주세요.")
        if not owner:
            raise RecorderError("기록하는 사람을 입력해 주세요. 동시 기록 상한을 사람마다 셉니다.")
        if not base.startswith(("http://", "https://")):
            raise RecorderError("대상 시스템 주소는 http:// 또는 https:// 로 시작해야 합니다.")
        if env not in ("op", "stg"):
            raise RecorderError("환경은 운영(op) 또는 스테이징(stg) 이어야 합니다.")
        pw = await self._ensure()
        u = self.usage()
        if u["byOwner"].get(owner, 0) >= u["perOwner"]:
            raise RecorderError(f"{owner} 님이 이미 {u['byOwner'][owner]}개를 기록 중입니다(사람당 {u['perOwner']}개). 진행 중인 기록을 끝내고 다시 시작해 주세요.", 409)
        if u["total"] >= u["max"]:
            who = ", ".join(f"{k} {v}개" for k, v in u["byOwner"].items())
            raise RecorderError(f"동시 기록이 가득 찼습니다(서버 전체 {u['max']}개: {who}). 진행 중인 기록이 끝나면 다시 시작해 주세요.", 409)
        account, password = payload.get("account") or "", payload.get("password") or ""
        creds = {"username": account, "password": password} if account and password else None
        rec = store.new_recording(name, owner, base, payload.get("start") or "", env, "auto" if creds else "manual", payload.get("readPost") or "")
        await asyncio.to_thread(store.save_recording, rec)
        if creds:
            await asyncio.to_thread(credentials.put, vault_key(rec["id"]), {"type": "session", "username": account, "password": password})
        session = RecorderSession(rec, creds, on_dead=lambda rid: self.sessions.pop(rid, None))
        self.sessions[rec["id"]] = session
        try:
            await session.start(pw)
        except Exception as exc:
            self.sessions.pop(rec["id"], None)
            await session.close()
            msg = str(exc).splitlines()[0][:300] if str(exc) else type(exc).__name__
            await asyncio.to_thread(store.update_recording, rec["id"], lambda r: r.update(status="failed", error=msg, endedAt=time.time()))
            raise RecorderError(msg, 500)
        return {"id": rec["id"], "token": session.token}

    def get(self, rid: str) -> Optional[RecorderSession]:
        s = self.sessions.get(rid)
        return None if s is None or s.closed else s

    async def stop(self, rid: str) -> None:
        s = self.get(rid)
        if s is None:
            raise RecorderError("진행 중인 기록이 아닙니다.", 404)
        await s.stop()
        await asyncio.to_thread(store.update_recording, rid, lambda r: r.update(status="analyzing"))
        if self.on_stopped is not None:
            asyncio.ensure_future(self.on_stopped(rid, s))
        else:
            await self.close(rid)

    async def close(self, rid: str) -> None:
        s = self.sessions.pop(rid, None)
        if s is not None:
            await s.close()

    async def shutdown(self) -> None:
        for rid in list(self.sessions):
            await self.close(rid)
        if self._reaper is not None:
            self._reaper.cancel()
        if self._pw is not None:
            try:
                await self._pw.stop()
            except Exception:
                pass
        self._pw, self._reaper = None, None

    async def _reap(self) -> None:
        while True:
            await asyncio.sleep(15)
            now = time.time()
            if now - self._swept_at > 86400:
                self._swept_at = now
                await asyncio.to_thread(retention.sweep, now)
            for rid, s in list(self.sessions.items()):
                try:
                    status = (await asyncio.to_thread(store.get_recording, rid))["status"]
                except KeyError:
                    await self.close(rid)
                    continue
                if status != "recording":
                    continue                     # 분석·검증 중인 세션은 service.finish 가 닫는다
                if now - s.last_input > config.idle_sec():
                    await s.trace.finish(s.page)
                    await asyncio.to_thread(store.update_recording, rid, lambda r: r.update(
                        status="interrupted", endedAt=now, error="입력이 오래 없어 기록을 멈췄습니다."))
                    await self.close(rid)
                elif now - s.started > config.max_sec():
                    await self.stop(rid)


MANAGER = Manager()
```

- [ ] **Step 6: 시험 통과 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_session.py -v`
Expected: 6개 PASS. (라우터가 아직 없으므로 이 작업의 `live`는 `app.ieum.routers.router`에 레코더 라우터가 없어도 동작한다. 서버 종료 때 `MANAGER.shutdown()`이 아직 불리지 않으므로 픽스처 끝에 `call(MANAGER.shutdown())`을 임시로 둔다. 작업 8에서 라우터 shutdown 훅이 생기면 지운다.)

```python
# 작업 7 동안만: live 픽스처의 yield 다음 줄에
    from app.ieum.recorder.manager import MANAGER
    call(MANAGER.shutdown())
```

- [ ] **Step 7: 커밋**

```bash
git add apps/backend/app/ieum/recorder/login.py apps/backend/app/ieum/recorder/session.py apps/backend/app/ieum/recorder/manager.py apps/backend/tests/test_ieum_recorder_session.py
git commit -m "feat: 업무 기록 세션과 관리자 — 자동 로그인, 사람당·서버 상한, 브라우저 끊김"
```

---

### Task 8: 레코더 API와 WebSocket

**Files:**
- Create: `apps/backend/app/ieum/routers/recorder.py`
- Modify: `apps/backend/app/ieum/routers/__init__.py`, `apps/backend/tests/test_ieum_recorder_session.py` (작업 7의 임시 `call(MANAGER.shutdown())` 두 줄 삭제)
- Test: `apps/backend/tests/test_ieum_recorder_api.py`

**Interfaces:**
- Produces (모두 `/api/ieum/recorder` 아래, `{resultCode, resultMsg, resultData}`):
  - `GET /` → `{recordings, functions, usage: MANAGER.usage(), demo}`
  - `POST /recordings/` → 201 `{id, token}` (본문: `name, owner, base, start, env, account, password, readPost`)
  - `GET /recordings/{rid}/` → 요약
  - `GET /recordings/{rid}/spans/{seq}/` → `{seq, action, pre: {url, title, aria}, post: {url, title, aria}}` (확정 뒤 근거용)
  - `POST /recordings/{rid}/stop/` → `{status}`
  - `DELETE /recordings/{rid}/` → 세션을 닫고 기록·업무 기능·폴더·금고 키 삭제
  - `GET /recordings/{rid}/shots/{name}` → JPEG (`^\d+-(pre|post)\.jpg$`, `rid`는 `^rec_[0-9a-f]{8}$`만)
  - `WS /ws/{rid}?token=` → 토큰이 다르면 4403으로 닫는다
- 라우터 `on_startup=[_startup]`(`store.mark_interrupted` + `retention.sweep`), `on_shutdown=[_shutdown]`(`MANAGER.shutdown`)

- [ ] **Step 1: 실패하는 시험 작성**

```python
# apps/backend/tests/test_ieum_recorder_api.py
"""레코더 API: 기록 시작·조회·종료·삭제와 WebSocket 접속 토큰."""
import json
import os

import httpx
import pytest
from websockets.sync.client import connect

from app.ieum.discovery.browser import capabilities
from app.ieum.demo_legacy.site import DEMO_PASSWORD, DEMO_USER_ID

pytestmark = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"], reason="브라우저가 없다")


def api(base, method, path, body=None):
    r = httpx.request(method, base + "/api/ieum/recorder" + path, json=body, timeout=90)
    j = r.json()
    assert r.status_code == j["resultCode"]
    return j["resultCode"], j["resultData"] if j["resultCode"] < 400 else j["resultMsg"]


def test_기록_시작_WebSocket_종료_삭제(ieum_server):
    code, out = api(ieum_server, "POST", "/recordings/", {"name": "조회", "owner": "홍길동", "base": ieum_server + "/demo-legacy/po",
                                                          "start": "/login.do", "env": "op", "account": DEMO_USER_ID, "password": DEMO_PASSWORD})
    assert code == 201 and out["token"]
    rid, ws_url = out["id"], ieum_server.replace("http", "ws") + "/api/ieum/recorder/ws/" + out["id"]
    with pytest.raises(Exception):
        with connect(ws_url + "?token=wrong") as ws:
            ws.recv(timeout=5)
    with connect(ws_url + "?token=" + out["token"], max_size=None) as ws:
        msg = json.loads(ws.recv(timeout=15))
        while msg["t"] != "frame":
            msg = json.loads(ws.recv(timeout=15))
        assert msg["data"]
    code, listing = api(ieum_server, "GET", "/")
    assert any(r["id"] == rid and r["status"] == "recording" for r in listing["recordings"])
    assert listing["usage"]["byOwner"] == {"홍길동": 1}
    assert api(ieum_server, "POST", f"/recordings/{rid}/stop/")[0] == 200
    assert api(ieum_server, "DELETE", f"/recordings/{rid}/")[0] == 200
    assert api(ieum_server, "GET", f"/recordings/{rid}/")[0] == 404


def test_입력값이_틀리면_400(ieum_server):
    code, msg = api(ieum_server, "POST", "/recordings/", {"name": "", "owner": "a", "base": "x"})
    assert code == 400 and "업무 이름" in msg


def test_스크린샷_이름은_정해진_형식만(ieum_server):
    code, msg = api(ieum_server, "GET", "/recordings/rec_0000abcd/shots/evil.jpg")
    assert code == 400 and "화면 캡처 이름" in msg
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_api.py -v`
Expected: FAIL — 404로 단언 실패

- [ ] **Step 3: 라우터 작성**

```python
# apps/backend/app/ieum/routers/recorder.py
"""업무 기록 메뉴: 기록 시작·화면 중계(WebSocket)·종료, 업무 기능 검토·확정·등록.

WebSocket 은 기록 세션마다 시작 응답으로 받은 토큰이 있어야 열린다. 콘솔에 사용자 로그인이 아직 없어서, 남의 기록
화면을 열 수 없게 하는 장치가 이 토큰뿐이다. 스토어·파일을 다루는 동기 함수는 이벤트 루프를 막지 않게 스레드로 넘긴다.
"""
import asyncio
import re
import secrets
from typing import Optional

from fastapi import APIRouter, Body, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import Response

from app.ieum.gateway import credentials
from app.ieum.recorder import retention, store
from app.ieum.recorder.manager import MANAGER, RecorderError, vault_key
from app.ieum.responses import fail, ok

SHOT_NAME = re.compile(r"^\d+-(pre|post)\.jpg$")
REC_ID = re.compile(r"^rec_[0-9a-f]{8}$")


def _startup() -> None:
    store.mark_interrupted()
    retention.sweep()


async def _shutdown() -> None:
    await MANAGER.shutdown()


router = APIRouter(prefix="/api/ieum/recorder", tags=["ieum-recorder"], on_startup=[_startup], on_shutdown=[_shutdown])


def _demo(origin: str) -> Optional[dict]:
    try:
        from app.ieum.demo_legacy.site import DEMO_PASSWORD, DEMO_USER_ID
    except ImportError:
        return None
    return {"name": "9월 발주 상세 조회", "base": origin + "/demo-legacy/po", "start": "/login.do", "account": DEMO_USER_ID,
            "password": DEMO_PASSWORD, "owner": "시연 담당자", "ssrStart": "/vendSearchView.do"}


@router.get("/")
async def overview(request: Request):
    recs, fns = await asyncio.gather(asyncio.to_thread(store.list_recordings), asyncio.to_thread(store.list_functions))
    return ok({"recordings": recs, "functions": fns, "usage": MANAGER.usage(), "demo": _demo(str(request.base_url).rstrip("/"))})


@router.post("/recordings/")
async def recording_start(payload: Optional[dict] = Body(None)):
    try:
        return ok(await MANAGER.start(payload or {}), 201)
    except RecorderError as exc:
        return fail(exc.code, str(exc))


@router.get("/recordings/{rid}/")
async def recording_get(rid: str):
    try:
        return ok(await asyncio.to_thread(store.get_recording, rid))
    except KeyError:
        return fail(404, "기록을 찾을 수 없습니다.")


@router.get("/recordings/{rid}/spans/{seq}/")
async def recording_span(rid: str, seq: int):
    spans = await asyncio.to_thread(store.read_spans, rid)
    sp = next((s for s in spans if s["seq"] == seq), None)
    if sp is None:
        return fail(404, "행동 묶음을 찾을 수 없습니다.")
    pick = lambda x: {k: (x or {}).get(k) for k in ("url", "title", "aria")}
    return ok({"seq": seq, "action": sp["action"], "pre": pick(sp["pre"]), "post": pick(sp["post"])})


@router.post("/recordings/{rid}/stop/")
async def recording_stop(rid: str):
    try:
        await MANAGER.stop(rid)
    except RecorderError as exc:
        return fail(exc.code, str(exc))
    return ok({"status": (await asyncio.to_thread(store.get_recording, rid))["status"]})


@router.delete("/recordings/{rid}/")
async def recording_delete(rid: str):
    await MANAGER.close(rid)
    try:
        await asyncio.to_thread(store.delete_recording, rid)
    except KeyError:
        return fail(404, "기록을 찾을 수 없습니다.")
    await asyncio.to_thread(credentials.delete, vault_key(rid))
    return ok({"deleted": rid})


@router.get("/recordings/{rid}/shots/{name}")
def recording_shot(rid: str, name: str):
    if not SHOT_NAME.match(name) or not REC_ID.match(rid):
        return fail(400, "잘못된 화면 캡처 이름입니다.")
    path = store.rec_dir(rid) / name
    if not path.exists():
        return fail(404, "화면 캡처가 없습니다. 업무 기능을 확정했거나 보관 기간이 지나 지웠을 수 있습니다.")
    return Response(content=path.read_bytes(), media_type="image/jpeg", headers={"Cache-Control": "no-store"})


@router.websocket("/ws/{rid}")
async def recording_ws(websocket: WebSocket, rid: str, token: str = ""):
    s = MANAGER.get(rid)
    if s is None or not secrets.compare_digest(token, s.token):
        await websocket.close(code=4403)
        return
    await websocket.accept()
    s.subscribe(websocket)
    await s.send_tabs()
    try:
        while True:
            await s.handle(await websocket.receive_json())
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        s.unsubscribe(websocket)
```

`routers/__init__.py`:

```python
from app.ieum.routers import dashboard, demo_legacy, demo_origin, deploy, discovery, logs, playground, recorder, sources, studio

router = APIRouter()
for _module in (dashboard, sources, studio, discovery, recorder, playground, deploy, logs, demo_origin, demo_legacy):
    router.include_router(_module.router)
```

`tests/test_ieum_recorder_session.py`의 `live` 픽스처에서 작업 7의 임시 두 줄(`from ... import MANAGER`, `call(MANAGER.shutdown())`)을 지운다.

- [ ] **Step 4: 시험 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_api.py tests/test_ieum_recorder_session.py -v && .venv/bin/pytest tests/ -q -p no:cacheprovider`
Expected: 모두 통과

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/app/ieum/routers/recorder.py apps/backend/app/ieum/routers/__init__.py apps/backend/tests/test_ieum_recorder_api.py apps/backend/tests/test_ieum_recorder_session.py
git commit -m "feat: 업무 기록 API 와 화면 중계 WebSocket"
```

---

### Task 9: 분석 (기록 → 업무 기능)

순수 함수다. 미리 만든 기록과 행동 묶음으로 시험한다.

**Files:**
- Create: `apps/backend/app/ieum/recorder/analyze.py`
- Test: `apps/backend/tests/test_ieum_recorder_analyze.py`

**Interfaces:**
- Consumes: `infer.templatize/parse_json/request_pairs/detect_code_tables`, `htmltable.shape`
- Produces:
  - `analyze.analyze(rec: dict, spans: List[dict]) -> dict` — 설계 3절의 업무 기능. `status: "draft"`
  - `analyze.leaves(data, limit=400) -> List[Tuple[str, Any]]`, `analyze.get_path(data, path) -> Any` — 경로 `$.a.b[0].c`. 끝에 `?<이름>`이 붙으면 그 값(링크 문자열)의 쿼리에서 그 이름의 값을 꺼낸다
  - `analyze.DISCRIMINATORS` — 같은 경로를 나누는 파라미터 이름
  - 단계: `{id, role, base, origin, method, path, discriminator, kind, charset, exec, formPage, params, headers, outputs, write, recordedRes, recordedStatus}`
  - 파라미터: `{a, loc, from, source, confidence, ex, type, required}`
  - 입력: `{name, type, source, ex, screenLabel, confidence, required, needsValue}`

- [ ] **Step 1: 실패하는 시험 작성**

```python
# apps/backend/tests/test_ieum_recorder_analyze.py
"""분석: 기록 → 업무 기능. 브라우저 없이 돈다."""
import json

from app.ieum.recorder import analyze, htmltable

BASE = "http://h:8080/po"


def net(method, path, query="", res=None, post=None, rtype="xhr", status=200, held=False, decision="", data=None, base=BASE, charset=None):
    origin = base.split("/po")[0] if base == BASE else base
    return {"method": method, "url": f"{origin}{'/po' if base == BASE else ''}{path}" + (f"?{query}" if query else ""),
            "origin": origin, "base": base, "path": path, "status": status, "ctype": "", "charset": charset, "rtype": rtype,
            "headers": {"x-requested-with": "XMLHttpRequest"}, "post": post,
            "res": json.dumps(res, ensure_ascii=False) if isinstance(res, (dict, list)) else (res or ""),
            "data": data, "file": False, "held": held, "decision": decision, "primary": base == BASE, "t": 0}


def span(seq, target, network, post_aria="", fills=None, title="발주 현황", hidden=None, href=f"{BASE}/x"):
    return {"seq": seq, "action": {"type": "click", "target": target, "isTrusted": True, "t": seq}, "fills": fills or [],
            "pre": {"url": "/x", "href": href, "title": title, "aria": "", "hidden": hidden or {}, "shot": None},
            "network": network, "post": {"url": "/x", "href": href, "title": title, "aria": post_aria, "hidden": {}, "shot": None}}


LIST = {"RSLT": "0000", "resultList": [{"PO_NO": "PO-2609-0142", "VEND_NM": "한빛상사"}, {"PO_NO": "PO-2609-0138", "VEND_NM": "대한문구"}]}
DETAIL = {"RSLT": "0000", "po": {"PO_NO": "PO-2609-0142", "VEND_NM": "한빛상사", "PO_AMT": "4,850,000"}}
CODES = {"RSLT": "0000", "resultList": [{"CD": "10", "CD_NM": "작성"}, {"CD": "20", "CD_NM": "승인대기"}]}
REC = {"id": "rec_00000001", "name": "발주 상세 조회", "owner": "홍길동", "sourceBase": BASE, "env": "op", "readPost": "",
       "login": {"mode": "auto", "recipe": {"userField": "userId"}, "path": "/po/loginProc.do"}, "approvals": []}

READ = [
    span(1, {"tag": "A", "text": "발주 현황"}, [net("GET", "/common/codeList.do", "grpCd=PO_STTS", CODES)]),
    span(2, {"tag": "BUTTON", "id": "btnSearch", "text": "조회"}, [net("GET", "/poList.do", "fromDt=20260901&toDt=20260930&sttsCd=", LIST)],
         post_aria="- table:\n  - row: PO-2609-0142 한빛상사\n  - row: PO-2609-0138 대한문구",
         fills=[{"target": {"id": "fromDt", "label": "발주일"}, "value": "20260901"}, {"target": {"id": "toDt", "label": ""}, "value": "20260930"}]),
    span(3, {"tag": "TR", "text": "PO-2609-0142 한빛상사"}, [net("GET", "/poDetail.do", "poNo=PO-2609-0142", DETAIL)],
         post_aria="- heading: 발주 상세 PO-2609-0142\n- text: 한빛상사 4,850,000"),
]


def test_핵심_단계와_값_연결을_찾는다():
    bf = analyze.analyze(REC, READ)
    assert [(s["method"], s["path"]) for s in bf["steps"]] == [("GET", "/poList.do"), ("GET", "/poDetail.do")]
    s1, s2 = bf["steps"]
    assert s1["outputs"] == {"PO_NO": "$.resultList[0].PO_NO"} and s1["kind"] == "json" and s1["base"] == BASE
    po = next(p for p in s2["params"] if p["a"] == "poNo")
    assert po["from"] == "s1.PO_NO" and po["source"] == "PREVIOUS_STEP_OUTPUT" and po["confidence"] == "high"
    assert bf["evidence"] == {"s1": [2], "s2": [3]}


def test_사용자가_입력한_값은_USER_INPUT_이고_라벨이_붙는다():
    inputs = {i["name"]: i for i in analyze.analyze(REC, READ)["inputs"]}
    assert inputs["fromDt"]["source"] == "USER_INPUT" and inputs["fromDt"]["screenLabel"] == "발주일" and inputs["fromDt"]["type"] == "date"
    assert inputs["sttsCd"]["confidence"] == "low" and inputs["fromDt"]["needsValue"] is False


def test_코드성_요청은_참조이고_출력은_마지막_화면에_보인_필드():
    bf = analyze.analyze(REC, READ)
    assert any(r["path"] == "/common/codeList.do" and r["role"] == "code" for r in bf["references"])
    assert bf["output"]["from"] == "s2" and {"$.po.VEND_NM", "$.po.PO_AMT"} <= set(bf["output"]["fields"])


def test_읽기만_있으면_READ_LOW_NONE_이고_설명_초안이_있다():
    bf = analyze.analyze(REC, READ)
    p = bf["policy"]
    assert (p["operation"], p["risk"], p["approval"], p["scope"], p["sensitivity"]) == ("READ", "LOW", "NONE", None, None)
    assert "발주 현황" in bf["desc"] and "발주일" in bf["desc"]


def test_승인한_쓰기가_있으면_CREATE():
    spans = [span(1, {"tag": "BUTTON", "id": "btnSave", "text": "저장"},
                  [net("POST", "/poSave.do", "", {"RSLT": "0000", "PO_NO": "PO-2610-0001"}, post="vendCd=V0012&qty=10", held=True, decision="approve")],
                  post_aria="- text: 발주를 등록했습니다. 발주번호 PO-2610-0001", fills=[{"target": {"id": "qty", "label": "수량"}, "value": "10"}])]
    bf = analyze.analyze(REC, spans)
    assert bf["steps"][0]["write"] is True and bf["steps"][0]["role"] == "core"
    assert (bf["policy"]["operation"], bf["policy"]["risk"], bf["policy"]["approval"]) == ("CREATE", "MEDIUM", "CONFIRM")


def test_행동_없는_요청은_잡음이다():
    spans = READ + [span(4, None, [net("GET", "/chart/monthly.do", "yyyy=2026", {"resultList": [1, 2]})])]
    bf = analyze.analyze(REC, spans)
    assert "/chart/monthly.do" not in [s["path"] for s in bf["steps"]]
    assert any(x["path"] == "/chart/monthly.do" and x["role"] == "noise" for x in bf["excluded"])


def test_같은_값이_두_곳에_있으면_확신도를_낮춘다():
    dup = {"resultList": [{"PO_NO": "PO-2609-0142", "REF_NO": "PO-2609-0142"}]}
    spans = [span(1, {"tag": "BUTTON", "text": "조회"}, [net("GET", "/poList.do", "fromDt=20260901", dup)], post_aria="PO-2609-0142"),
             span(2, {"tag": "TR", "text": "PO-2609-0142"}, [net("GET", "/poDetail.do", "poNo=PO-2609-0142", DETAIL)], post_aria="한빛상사")]
    po = next(p for p in analyze.analyze(REC, spans)["steps"][1]["params"] if p["a"] == "poNo")
    assert po["source"] == "PREVIOUS_STEP_OUTPUT" and po["confidence"] == "low"


def test_서버가_그린_HTML_표에서_값을_꺼내_잇고_숨은_토큰은_브라우저_실행():
    list_html = ('<table><tr><th>거래처코드</th><th>거래처명</th></tr><tr><td><a href="vendDetail.do?vendCd=V0012">V0012</a></td>'
                 '<td>한빛상사</td></tr></table>')
    detail_html = "<table><tr><th>거래처명</th><td>한빛상사</td><th>대표자</th><td>홍길동</td></tr></table>"
    spans = [
        span(1, {"tag": "BUTTON", "text": "검색"}, [net("POST", "/vendSearch.do", "", list_html, post="_csrf=tok-9&vendNm=%ED%95%9C%EB%B9%9B",
                                                          rtype="document", data=htmltable.to_data(list_html), charset="EUC-KR")],
             post_aria="- table: V0012 한빛상사", fills=[{"target": {"id": "vendNm", "label": "거래처명"}, "value": "한빛"}],
             hidden={"_csrf": "tok-9"}, href=f"{BASE}/vendSearchView.do"),
        span(2, {"tag": "A", "text": "V0012"}, [net("GET", "/vendDetail.do", "vendCd=V0012", detail_html, rtype="document",
                                                    data=htmltable.to_data(detail_html))], post_aria="- text: 한빛상사 홍길동"),
    ]
    bf = analyze.analyze(REC, spans)
    s1, s2 = bf["steps"]
    assert s1["kind"] == "html" and s1["exec"] == "browser" and s1["formPage"] == f"{BASE}/vendSearchView.do" and s1["charset"] == "EUC-KR"
    csrf = next(p for p in s1["params"] if p["a"] == "_csrf")
    assert csrf["source"] == "SESSION_CONTEXT" and csrf["from"] == "session.hidden._csrf"
    v = next(p for p in s2["params"] if p["a"] == "vendCd")
    assert v["source"] == "PREVIOUS_STEP_OUTPUT" and analyze.get_path(s1_data := htmltable.to_data(list_html), "$.tables[0].rows[0].거래처코드") == "V0012"
    assert bf["output"]["fields"] and all(f.startswith("$.fields.") for f in bf["output"]["fields"])


def test_같은_경로라도_구분_파라미터가_다르면_나눈다():
    spans = [span(1, {"tag": "BUTTON", "text": "조회"}, [net("GET", "/po.do", "cmd=list&q=1", LIST)], post_aria="PO-2609-0142"),
             span(2, {"tag": "TR", "text": "x"}, [net("GET", "/po.do", "cmd=detail&poNo=PO-2609-0142", DETAIL)], post_aria="4,850,000")]
    bf = analyze.analyze(REC, spans)
    assert [s["discriminator"] for s in bf["steps"]] == ["cmd=list", "cmd=detail"]


def test_다른_출처_단계는_그_출처를_기준으로_둔다():
    other = "http://appr.corp:9090"
    spans = [span(1, {"tag": "BUTTON", "text": "결재 현황"}, [net("GET", "/appr/list.do", "q=1", {"rows": [{"DOC": "D-77"}]}, base=other)],
                  post_aria="D-77")]
    s = analyze.analyze(REC, spans)["steps"][0]
    assert s["base"] == other and s["path"] == "/appr/list.do"


def test_마스킹된_입력은_값_다시_입력_필요():
    spans = [span(1, {"tag": "BUTTON", "text": "조회"}, [net("GET", "/custList.do", "tel=010****5678", {"rows": [{"NM": "홍길동"}]})],
                  post_aria="홍길동", fills=[{"target": {"id": "tel", "label": "연락처"}, "value": "010****5678"}])]
    inp = analyze.analyze(REC, spans)["inputs"][0]
    assert inp["name"] == "tel" and inp["needsValue"] is True


def test_날짜_모양_고정값은_확인_필요():
    spans = [span(1, {"tag": "BUTTON", "text": "조회"}, [net("GET", "/poList.do", "baseDt=20260915", LIST)], post_aria="PO-2609-0142")]
    p = analyze.analyze(REC, spans)["steps"][0]["params"][0]
    assert p["source"] == "CONSTANT" and p["confidence"] == "low"


def test_JSON_이_아닌_응답도_분석이_멈추지_않고_핵심을_못_찾으면_안내():
    r1 = analyze.analyze(REC, [span(1, {"tag": "BUTTON", "text": "조회"}, [net("GET", "/legacyList.do", "q=1", "<p>PO-1</p>")], post_aria="PO-1")])
    assert r1["steps"][0]["kind"] == "other"
    r2 = analyze.analyze(REC, [span(1, {"tag": "A", "text": "메인"}, [])])
    assert r2["steps"] == [] and any("핵심 요청을 찾지 못했습니다" in n for n in r2["notes"])


def test_JSON_잎_경로와_링크_쿼리_꺼내기():
    assert analyze.get_path(LIST, "$.resultList[1].PO_NO") == "PO-2609-0138"
    assert analyze.get_path({"rows": [{"_links": ["poDetail.do?poNo=PO-1&x=2"]}]}, "$.rows[0]._links[0]?poNo") == "PO-1"
    assert ("$.po.PO_AMT", "4,850,000") in analyze.leaves(DETAIL)
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_analyze.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: 구현**

```python
# apps/backend/app/ieum/recorder/analyze.py
"""기록 → 업무 기능. 규칙만으로 동작한다(LLM 에 의존하지 않는다 — LLM 이 죽어도 분석은 된다).

핵심 판단 두 가지:
1) 이 요청이 업무의 본체인가: 행동 직후 나갔고, 응답(HTML 이면 표 변환 사본) 값이 직후 화면(ARIA)에 나타났는가.
2) 이 파라미터 값은 어디서 왔나: 사용자 입력, 앞 단계 응답, 직전 화면의 숨은 입력(매번 바뀌는 토큰), 설정, 상수.

같은 값이 여러 곳에 있으면 하나를 골라 조용히 확정하지 않는다. 확신도를 낮춰 검토 화면에서 사람에게 묻는다.
ARIA 와 응답은 같은 마스킹기로 가려 저장했으므로, 가린 값끼리 비교해도 판정이 맞다.
"""
import re
import time
from types import SimpleNamespace
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import parse_qsl, urlsplit

from app.ieum.discovery import infer

USER_INPUT, PREVIOUS_STEP_OUTPUT, SESSION_CONTEXT = "USER_INPUT", "PREVIOUS_STEP_OUTPUT", "SESSION_CONTEXT"
SYSTEM_CONFIG, DERIVED, CONSTANT = "SYSTEM_CONFIG", "DERIVED", "CONSTANT"
DISCRIMINATORS = ("cmd", "action", "method", "mode", "op", "service", "operationName", "actionType", "flag")
_DATE = re.compile(r"^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$")
_TOKEN_NAME = re.compile(r"csrf|xsrf|token|viewstate|eventvalidation|nonce", re.I)
_MASKED = re.compile(r"\*{2,}|•{2,}")
_OPS = (("APPROVE", re.compile(r"approv|confirm|결재|승인|결제|이체|pay|transfer", re.I)),
        ("DELETE", re.compile(r"delet|remove|del\b|삭제|제거", re.I)),
        ("UPDATE", re.compile(r"upd|modify|edit|change|수정|변경", re.I)))
_RISK = {"READ": ("LOW", "NONE"), "CREATE": ("MEDIUM", "CONFIRM"), "UPDATE": ("MEDIUM", "CONFIRM"),
         "DELETE": ("HIGH", "HITL"), "APPROVE": ("CRITICAL", "HITL")}
_ORDER = ["READ", "CREATE", "UPDATE", "DELETE", "APPROVE"]
MIN_VALUE_LEN = 3                                      # "1", "Y" 같은 짧은 값은 우연히 겹치므로 연결 근거로 쓰지 않는다


# ── JSON 잎 ────────────────────────────────────────────────────────────────
def leaves(data, limit: int = 400) -> List[Tuple[str, Any]]:
    out: List[Tuple[str, Any]] = []

    def walk(node, path):
        if len(out) >= limit:
            return
        if isinstance(node, dict):
            for k, v in node.items():
                walk(v, f"{path}.{k}")
        elif isinstance(node, list):
            for i, v in enumerate(node[:50]):
                walk(v, f"{path}[{i}]")
        elif node is not None:
            out.append((path, node))
    walk(data, "$")
    return out


def get_path(data, path: str):
    query = None
    if "?" in path:
        path, query = path.split("?", 1)
    node = data
    for name, idx in re.findall(r"\.([^.\[]+)|\[(\d+)\]", path[1:]):
        try:
            node = node[name] if name else node[int(idx)]
        except (KeyError, IndexError, TypeError):
            return None
    if query and isinstance(node, str):
        return dict(parse_qsl(urlsplit(node).query)).get(query)
    return node


# ── 요청 해석 ──────────────────────────────────────────────────────────────
def _pairs(n: dict) -> List[Tuple[str, str, str]]:
    post = n.get("post") or ""
    obs = SimpleNamespace(url=n["url"], post=post, headers={"content-type": "application/json" if post.startswith("{") else ""})
    return infer.request_pairs(obs)


def _data(n: dict):
    if n.get("data"):
        return n["data"]
    return infer.parse_json(n.get("res") or "")


def _kind(n: dict) -> str:
    if n.get("data"):
        return "html"
    return "json" if infer.parse_json(n.get("res") or "") is not None else "other"


def _type(v: str) -> str:
    if _DATE.match(v or ""):
        return "date"
    if re.fullmatch(r"-?\d+", v or ""):
        return "number"
    return "string"


def _discriminator(n: dict) -> str:
    pairs = {k: v for k, v, _ in _pairs(n)}
    for name in DISCRIMINATORS:
        if pairs.get(name):
            return f"{name}={pairs[name]}"
    return ""


def _op_of(n: dict, label: str) -> str:
    if n["method"] in ("GET", "HEAD") and not n.get("held"):
        return "READ"
    text = f"{n['path']} {label}"
    for op, pat in _OPS:
        if pat.search(text):
            return op
    return "CREATE"


def _shown(data, raw: str, aria: str) -> bool:
    """응답 값이 화면에 나타났는가. JSON·HTML 사본이면 잎 값으로, 아니면 응답 글자 조각으로 본다."""
    if not aria:
        return False
    if data is not None:
        return any(len(str(v)) >= MIN_VALUE_LEN and str(v) in aria for p, v in leaves(data)[:300] if "_links" not in p and ".hidden." not in p)
    texts = re.findall(r">([^<>]{3,})<", raw or "")
    return any(t.strip() and t.strip() in aria for t in texts[:50])


def analyze(rec: dict, spans: List[dict]) -> dict:
    login_path = (rec.get("login") or {}).get("path") or ""
    items, excluded = [], []
    for sp in spans:
        for n in sp["network"]:
            row = {"method": n["method"], "path": infer.templatize(n["path"])}
            full = urlsplit(n["url"]).path
            if full == login_path:
                excluded.append(dict(row, role="auth", why="로그인 요청 (인증 방법으로 따로 보관)"))
            elif sp["action"]["target"] is None:
                excluded.append(dict(row, role="noise", why="행동 없이 화면이 스스로 부른 요청"))
            elif n.get("decision") in ("deny", "timeout"):
                excluded.append(dict(row, role="denied", why="승인하지 않아 보내지 않은 쓰기"))
            else:
                items.append((sp, n, row["path"], _data(n)))

    tables = infer.detect_code_tables([SimpleNamespace(url=n["url"], body=n.get("res") or "", status=n["status"], blocked=False, file=n.get("file"),
                                                       out_of_scope=False, method=n["method"], post=n.get("post"), headers={})
                                       for _, n, _, _ in items])
    code_paths = {p for _, n, p, _ in items if tables and n["method"] == "GET" and re.search(r"code|cmmn", p, re.I)}

    # 1) 핵심 후보
    steps: List[dict] = []
    seen: Dict[tuple, Optional[dict]] = {}
    for sp, n, path, data in items:
        disc = _discriminator(n)
        key = (n["base"], n["method"], path, disc)
        if path in code_paths:
            if key not in seen:
                seen[key] = None
                excluded.append({"method": n["method"], "path": path, "role": "code", "why": "코드표 응답 (상태코드 풀이용 참조)"})
            continue
        write = n["method"] not in ("GET", "HEAD") or bool(n.get("held"))
        aria = (sp.get("post") or {}).get("aria") or ""
        if not (_shown(data, n.get("res") or "", aria) or write):
            if key not in seen:
                seen[key] = None
                excluded.append({"method": n["method"], "path": path, "role": "page" if n["rtype"] == "document" else "noise",
                                 "why": "응답 값이 화면에 나타나지 않음"})
            continue
        if seen.get(key) is not None:
            seen[key]["_spans"].append(sp["seq"])
            continue
        st = {"id": f"s{len(steps) + 1}", "role": "core", "base": n["base"], "origin": n["origin"], "method": n["method"], "path": path,
              "discriminator": disc, "kind": _kind(n), "charset": n.get("charset"), "exec": "http", "formPage": None, "write": write,
              "headers": {k: v for k, v in (n.get("headers") or {}).items() if k.startswith("x-")}, "outputs": {}, "params": [],
              "recordedRes": n.get("res") or "", "recordedData": n.get("data"), "recordedStatus": n["status"],
              "_sample": (sp, n, data), "_spans": [sp["seq"]], "_label": (sp["action"]["target"] or {}).get("text", ""),
              "_title": (sp.get("pre") or {}).get("title", "")}
        seen[key] = st
        steps.append(st)

    # 2) 파라미터와 값 연결
    user_vals = _user_values(spans)
    common = _common_values(steps)
    inputs: Dict[str, dict] = {}
    for i, st in enumerate(steps):
        sp, n, _ = st["_sample"]
        hidden = _hidden_before(spans, sp["seq"])
        for name, value, loc in _pairs(n):
            p = {"a": name, "loc": loc, "ex": value, "type": _type(value), "required": value != ""}
            links = _find_link(value, steps[:i]) if len(value) >= MIN_VALUE_LEN else []
            if links:
                prev, path, many = links[0][0], links[0][1], len(links) > 1
                out_name = name if "?" in path else (path.rsplit(".", 1)[-1].split("[")[0] or name)
                prev["outputs"][out_name] = path
                p.update({"from": f"{prev['id']}.{out_name}", "source": PREVIOUS_STEP_OUTPUT, "confidence": "low" if many else "high"})
                if prev["role"] != "core":
                    prev["role"] = "prereq"
            elif (name in hidden and hidden[name] == value) or (_TOKEN_NAME.search(name) and value not in user_vals):
                p.update({"from": f"session.hidden.{name}", "source": SESSION_CONTEXT, "confidence": "high" if name in hidden else "mid"})
                st["exec"] = "browser"
                st["formPage"] = (sp.get("pre") or {}).get("href") or None
            elif value in user_vals:
                p.update({"from": f"input.{name}", "source": USER_INPUT, "confidence": "high"})
                inputs.setdefault(name, _input(name, p["type"], USER_INPUT, value, user_vals[value], "high", True))
            elif value == "":
                p.update({"from": f"input.{name}", "source": USER_INPUT, "confidence": "low", "required": False})
                inputs.setdefault(name, _input(name, "string", USER_INPUT, "", "", "low", False))
            elif name in common and common[name] == value:
                p.update({"from": f"config.{name}", "source": SYSTEM_CONFIG, "confidence": "mid"})
            elif p["type"] == "date" and value == time.strftime("%Y%m%d", time.localtime(sp["action"]["t"] or time.time())):
                p.update({"from": f"input.{name}", "source": DERIVED, "confidence": "low"})
                inputs.setdefault(name, _input(name, "date", DERIVED, value, "", "low", True))
            else:
                looks_variable = p["type"] in ("date", "number") or bool(_MASKED.search(value))
                p.update({"from": f"const:{value}", "source": CONSTANT, "confidence": "low" if looks_variable else "mid"})
            st["params"].append(p)

    # 3) 출력
    output = {"from": None, "fields": []}
    cores = [s for s in steps if s["role"] == "core"]
    if cores:
        last = cores[-1]
        sp, n, data = last["_sample"]
        aria = (sp.get("post") or {}).get("aria") or ""
        if data is not None:
            output = {"from": last["id"], "fields": [p for p, v in leaves(data)[:300]
                                                     if len(str(v)) >= 2 and str(v) in aria and "_links" not in p and ".hidden." not in p][:20]}

    # 4) 정책
    ops = [_op_of(s["_sample"][1], s["_label"]) for s in steps] or ["READ"]
    op = max(ops, key=_ORDER.index)
    risk, approval = _RISK[op]
    policy_meta = {"operation": op, "risk": risk, "approval": approval, "envPolicy": "op-auto" if op == "READ" else "op-confirm",
                   "sensitivity": None, "scope": None}

    notes = []
    if not steps:
        notes.append("핵심 요청을 찾지 못했습니다. 아래 전체 요청 목록에서 업무에 해당하는 것을 골라 주세요.")
    if any(s["kind"] == "other" for s in steps):
        notes.append("JSON 도 표도 아닌 응답이 있어 그 단계에서는 값을 꺼낼 수 없습니다.")
    desc = _describe(rec, steps, list(inputs.values()), output, op)
    evidence = {s["id"]: s["_spans"] for s in steps}
    for s in steps:
        for k in ("_sample", "_spans", "_label", "_title"):
            s.pop(k, None)
    login = rec.get("login") or {}
    return {"id": "bf_" + rec["id"][4:], "name": rec["name"], "desc": desc, "status": "draft",
            "source": {"base": rec["sourceBase"], "recordingId": rec["id"], "made": "manual-record", "env": rec["env"]},
            "inputs": list(inputs.values()), "steps": steps, "references": [x for x in excluded if x["role"] == "code"],
            "excluded": excluded, "output": output,
            "auth": {"mode": "session" if login.get("recipe") else "none", "recipe": login.get("recipe")},
            "executionMode": None, "policy": policy_meta, "policyIncomplete": True,
            "verification": {"status": "pending", "at": None, "runs": []}, "evidence": evidence, "notes": notes}


def _input(name, typ, source, ex, label, confidence, required) -> dict:
    return {"name": name, "type": typ, "source": source, "ex": ex, "screenLabel": label, "confidence": confidence,
            "required": required, "needsValue": bool(_MASKED.search(ex or ""))}


def _describe(rec: dict, steps: List[dict], inputs: List[dict], output: dict, op: str) -> str:
    title = next((s["_title"] for s in steps if s.get("_title")), "") or rec["name"]
    labels = [i["screenLabel"] or i["name"] for i in inputs if i["source"] == USER_INPUT and (i["screenLabel"] or i["required"])][:4]
    outs = list(dict.fromkeys(re.sub(r"\[\d+\]", "", f).rsplit(".", 1)[-1] for f in output.get("fields", [])))[:5]
    by = f"{', '.join(labels)}(으)로 " if labels else ""
    what = f"{', '.join(outs)}을(를) " if outs else ""
    verb = "조회합니다" if op == "READ" else "처리합니다"
    return f"{title} 화면에서 {by}{what}{verb}."


def _user_values(spans: List[dict]) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for sp in spans:
        for f in sp.get("fills", []):
            v = str(f.get("value") or "")
            if v:
                t = f.get("target") or {}
                out.setdefault(v, t.get("label") or t.get("text") or t.get("name") or t.get("id") or "")
    return out


def _hidden_before(spans: List[dict], seq: int) -> Dict[str, str]:
    """이 행동 직전 화면과, 그 앞 화면 이동 응답(HTML)의 숨은 입력."""
    out: Dict[str, str] = {}
    for sp in spans:
        if sp["seq"] > seq:
            break
        if sp["seq"] == seq:
            out.update((sp.get("pre") or {}).get("hidden") or {})
        for n in sp["network"]:
            if sp["seq"] < seq and n.get("data"):
                out.update(n["data"].get("hidden") or {})
    return out


def _common_values(steps: List[dict]) -> Dict[str, str]:
    """두 단계 이상에 같은 값으로 붙는 파라미터 — 회사 코드 같은 설정값으로 본다."""
    seen: Dict[str, set] = {}
    vals: Dict[str, str] = {}
    for st in steps:
        for name, value, _ in _pairs(st["_sample"][1]):
            if not value or name in DISCRIMINATORS:
                continue
            seen.setdefault(name, set()).add(st["id"])
            vals.setdefault(name, value)
            if vals[name] != value:
                seen[name] = set()
    return {k: vals[k] for k, ids in seen.items() if len(ids) >= 2}


def _find_link(value: str, prev_steps: List[dict]) -> List[Tuple[dict, str]]:
    """앞 단계 응답 어디에 이 값이 있나. 잎 값이 같으면 그 경로, 링크 문자열의 쿼리 값이 같으면 '경로?이름'."""
    hits = []
    for st in reversed(prev_steps):
        data = st["_sample"][2]
        if data is None:
            continue
        direct = [(st, p) for p, v in leaves(data) if str(v) == value and ".hidden." not in p and "_links" not in p]
        if direct:
            hits += direct
            continue
        for p, v in leaves(data):
            if "_links" in p and isinstance(v, str) and "?" in v:
                q = dict(parse_qsl(urlsplit(v).query))
                name = next((k for k, x in q.items() if x == value), None)
                if name:
                    hits.append((st, f"{p}?{name}"))
    return hits
```

- [ ] **Step 4: 시험 통과 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_analyze.py -v`
Expected: 14개 PASS. `test_서버가_그린...`의 `vendCd` 연결은 `$.tables[0].rows[0].거래처코드`(잎 값 일치)로 잡혀야 한다.

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/app/ieum/recorder/analyze.py apps/backend/tests/test_ieum_recorder_analyze.py
git commit -m "feat: 업무 기록 분석 — 핵심 단계, 값 연결(JSON·HTML 표), 숨은 토큰, 입력값 출처, 정책, 설명 초안"
```

---

### Task 10: Replay 검증

**Files:**
- Create: `apps/backend/app/ieum/recorder/replay.py`
- Test: `apps/backend/tests/test_ieum_recorder_replay.py`

**Interfaces:**
- Consumes: `analyze.get_path/leaves`, `htmltable.to_data/shape/looks_html`, `infer.parse_json`, `session_auth.expired/login`, `credentials.get`, `scope.blocked`, `Guard.ask`
- Produces:
  - `replay.judge(status, location, ctype, text, step, headers_sent) -> Tuple[bool, str, Any]` — 이유 코드: `""`, `auth_expired`, `waf_blocked`, `http_error`, `shape_mismatch`, `error_response`
  - `replay.encode(pairs: Dict[str, str], charset: Optional[str]) -> str`
  - `replay.varied_inputs(bf, spans) -> Optional[Dict[str, str]]`
  - `HttpTransport(cookies)`, `BrowserTransport(page)` — `async send(step, url, headers, params, form, json_body) -> (status, location, ctype, text)`
  - `await replay.run_once(bf, inputs, raw, http, browser, ask_write, gap, kind="same-values") -> dict` — `raw`는 마스킹 값 → 원값. `browser`가 `None`인데 `exec == "browser"`인 단계는 `browser_needed`로 실패
  - `await replay.verify(bf, rec, spans, session=None, values=None) -> {"verification": {status, at, runs}, "executionMode"}` — `values`는 검토 화면에서 사람이 넣은 원값(저장하지 않는다)

- [ ] **Step 1: 실패하는 시험 작성**

```python
# apps/backend/tests/test_ieum_recorder_replay.py
"""Replay: 판정·인코딩은 순수 시험, 실행은 시연용 레거시 사이트에 실제 HTTP 로 보낸다."""
import asyncio
import json

from app.ieum.demo_legacy.site import DEMO_PASSWORD, DEMO_USER_ID
from app.ieum.gateway import session_auth
from app.ieum.recorder import replay

REC_LIST = json.dumps({"RSLT": "0000", "resultList": [{"PO_NO": "PO-2609-0142"}]})
JSTEP = {"kind": "json", "recordedRes": REC_LIST, "recordedData": None}


def test_200_이고_구조가_같으면_성공():
    ok, why, data = replay.judge(200, None, "application/json", REC_LIST, JSTEP, {"x-requested-with": "XMLHttpRequest"})
    assert ok and why == "" and data["resultList"][0]["PO_NO"] == "PO-2609-0142"


def test_로그인_화면으로_보내지면_세션_만료():
    assert replay.judge(302, "/po/login.do", "", "", JSTEP, {})[1] == "auth_expired"


def test_400_인데_보존_헤더가_없으면_WAF():
    assert replay.judge(400, None, "application/json", '{"RSLT":"E400"}', JSTEP, {})[1] == "waf_blocked"
    assert replay.judge(400, None, "application/json", '{"RSLT":"E400"}', JSTEP, {"x-requested-with": "x"})[1] == "http_error"


def test_구조가_다르거나_오류_표시면_실패():
    assert replay.judge(200, None, "application/json", '{"other":1}', JSTEP, {})[1] == "shape_mismatch"
    body = json.dumps({"RSLT": "E403", "MSG": "권한이 없습니다", "resultList": []})
    assert replay.judge(200, None, "application/json", body, JSTEP, {})[1] == "error_response"


def test_HTML_은_표_열_이름으로_비교한다():
    rec_html = "<table><tr><th>거래처코드</th><th>거래처명</th></tr><tr><td>V1</td><td>가</td></tr></table>"
    from app.ieum.recorder import htmltable
    step = {"kind": "html", "recordedRes": rec_html, "recordedData": htmltable.to_data(rec_html)}
    ok, _, data = replay.judge(200, None, "text/html", rec_html.replace("V1", "V2"), step, {})
    assert ok and data["tables"][0]["rows"][0]["거래처코드"] == "V2"
    assert replay.judge(200, None, "text/html", "<table><tr><th>다른</th><th>열</th></tr></table>", step, {})[1] == "shape_mismatch"


def test_JSON_이_아닌_응답은_구조_비교를_건너뛴다():
    step = {"kind": "other", "recordedRes": "<p>PO-1</p>", "recordedData": None}
    assert replay.judge(200, None, "text/plain", "<p>PO-2</p>", step, {})[0] is True


def test_폼은_기록한_인코딩으로_보낸다():
    assert replay.encode({"vendNm": "한빛"}, "EUC-KR") == "vendNm=%C7%D1%BA%FB"
    assert replay.encode({"vendNm": "한빛"}, None) == "vendNm=%ED%95%9C%EB%B9%9B"


def _bf(base):
    return {"id": "bf_x", "source": {"base": base + "/demo-legacy/po", "env": "op", "recordingId": "rec_x"},
            "inputs": [{"name": "fromDt", "type": "date", "source": "USER_INPUT", "ex": "20260901", "needsValue": False},
                       {"name": "toDt", "type": "date", "source": "USER_INPUT", "ex": "20260930", "needsValue": False}],
            "steps": [
                {"id": "s1", "base": base + "/demo-legacy/po", "method": "GET", "path": "/poList.do", "kind": "json", "exec": "http",
                 "charset": None, "write": False, "headers": {"x-requested-with": "XMLHttpRequest"}, "outputs": {"PO_NO": "$.resultList[0].PO_NO"},
                 "recordedData": None, "recordedRes": json.dumps({"RSLT": "0000", "totalCnt": 1, "resultList": [{"PO_NO": "x"}]}),
                 "params": [{"a": "fromDt", "loc": "query", "from": "input.fromDt", "ex": "20260901"},
                            {"a": "toDt", "loc": "query", "from": "input.toDt", "ex": "20260930"}]},
                {"id": "s2", "base": base + "/demo-legacy/po", "method": "GET", "path": "/poDetail.do", "kind": "json", "exec": "http",
                 "charset": None, "write": False, "headers": {"x-requested-with": "XMLHttpRequest"}, "outputs": {},
                 "recordedData": None, "recordedRes": json.dumps({"RSLT": "0000", "po": {"PO_NO": "x"}}),
                 "params": [{"a": "poNo", "loc": "query", "from": "s1.PO_NO", "ex": "PO-2609-0142"}]}],
            "auth": {"mode": "session"}}


async def _no(step):
    return False


def _login(server):
    return session_auth.login(server + "/demo-legacy/po", {"username": DEMO_USER_ID, "password": DEMO_PASSWORD,
                                                           "recipe": {"userField": "userId", "passField": "userPw", "loginRel": "/login.do", "actionRel": "/loginProc.do"}})


def test_세션_HTTP_로_두_단계를_이어_실행한다(ieum_server):
    run = asyncio.new_event_loop().run_until_complete(
        replay.run_once(_bf(ieum_server), {"fromDt": "20260901", "toDt": "20260930"}, {}, replay.HttpTransport(_login(ieum_server)), None, _no, 0))
    assert run["ok"] and [s["ok"] for s in run["steps"]] == [True, True]


def test_원값_지도로_마스킹된_입력을_되돌린다(ieum_server):
    bf = _bf(ieum_server)
    run = asyncio.new_event_loop().run_until_complete(
        replay.run_once(bf, {"fromDt": "2026****", "toDt": "20260930"}, {"2026****": "20260901"}, replay.HttpTransport(_login(ieum_server)), None, _no, 0))
    assert run["ok"]


def test_원값이_없으면_needs_value():
    bf = _bf("http://h")
    bf["inputs"][0].update(ex="2026****", needsValue=True)
    out = asyncio.new_event_loop().run_until_complete(replay.verify(bf, {"id": "rec_x", "login": {"mode": "manual"}}, [], None))
    assert out["verification"]["status"] in ("needs-login", "needs-value")


def test_다른_값은_날짜를_한_달_앞으로_옮긴다():
    assert replay.varied_inputs(_bf("http://h"), []) == {"fromDt": "20260801", "toDt": "20260831"}


def test_쿠키가_없으면_세션_만료로_실패한다(ieum_server):
    run = asyncio.new_event_loop().run_until_complete(
        replay.run_once(_bf(ieum_server), {"fromDt": "20260901", "toDt": "20260930"}, {}, replay.HttpTransport({}), None, _no, 0))
    assert not run["ok"] and run["steps"][0]["reason"] == "auth_expired"


def test_쓰기_단계를_거절하면_write_denied(ieum_server):
    bf = _bf(ieum_server)
    bf["steps"] = [dict(bf["steps"][0], method="POST", path="/poSave.do", write=True, params=[], outputs={})]
    run = asyncio.new_event_loop().run_until_complete(replay.run_once(bf, {}, {}, replay.HttpTransport({}), None, _no, 0))
    assert not run["ok"] and run["steps"][0]["reason"] == "write_denied"


def test_브라우저_실행_단계인데_브라우저가_없으면_실패():
    bf = _bf("http://h")
    bf["steps"] = [dict(bf["steps"][0], exec="browser", params=[], outputs={})]
    run = asyncio.new_event_loop().run_until_complete(replay.run_once(bf, {}, {}, replay.HttpTransport({}), None, _no, 0))
    assert run["steps"][0]["reason"] == "browser_needed"
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_replay.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: 구현**

```python
# apps/backend/app/ieum/recorder/replay.py
"""Replay 검증: 업무 기능을 실제로 다시 실행해 본다.

두 번 돌린다. 같은 값으로 한 번(기록이 재현되는가), 사용자 입력만 바꿔 한 번(입력이 정말 바꿀 수 있는 값이고, 단계
연결이 새 값으로도 이어지는가). 다른 값은 지어내지 않는다. 날짜는 한 달 앞으로, 그 밖에는 기록 안의 다른 값을 쓴다.

같은 값은 메모리의 원값으로 보낸다. 저장된 값은 마스킹되어 있어(010****5678) 그대로 보내면 실패한다. 세션이 끝나
원값이 없으면 "값 다시 입력 필요"로 멈추고, 사람이 검토 화면에서 넣은 값으로만 다시 검증한다(그 값도 저장하지 않는다).

성공은 HTTP 200 만으로 판단하지 않는다. 로그인 화면으로 튕기지 않았고, 응답 구조(JSON 키 또는 HTML 표 열)가 기록과
같고, 오류 표시가 없고, 다음 단계로 넘길 값을 실제로 꺼낼 수 있어야 한다.

단계마다 자기 출처로 보내고, 폼은 기록한 인코딩으로 보낸다(EUC-KR 레거시). 매번 바뀌는 숨은 토큰이 필요한 단계는
브라우저 안에서 직전 화면을 다시 열어 새 토큰을 받아 제출한다. 운영 쓰기 단계는 직전에 다시 승인을 받는다.
"""
import asyncio
import datetime as dt
import re
import time
from typing import Any, Awaitable, Callable, Dict, Optional, Tuple
from urllib.parse import quote, urlsplit

import httpx

from app.ieum.discovery import infer
from app.ieum.gateway import credentials, session_auth
from app.ieum.recorder import config, htmltable, scope
from app.ieum.recorder.analyze import get_path, leaves

TIMEOUT = 15
UA = "Mozilla/5.0 (compatible; IeumRecorder/1.0)"
_ERR_KEY = re.compile(r"^(rslt|result_?code|code|status)$", re.I)
_ERR_TEXT = ("권한이 없습니다", "오류가 발생", "처리 중 오류")


def encode(pairs: Dict[str, str], charset: Optional[str]) -> str:
    enc = (charset or "utf-8").lower()
    try:
        "".encode(enc)
    except LookupError:
        enc = "utf-8"
    return "&".join(f"{quote(str(k), safe='', encoding=enc)}={quote(str(v), safe='', encoding=enc, errors='replace')}" for k, v in pairs.items())


def _keys(d) -> set:
    return {re.sub(r"\[\d+\]", "[]", p) for p, _ in leaves(d, 200)}


def _looks_error(data, text: str) -> bool:
    if isinstance(data, dict):
        for k, v in data.items():
            if _ERR_KEY.match(str(k)) and isinstance(v, str) and (v.upper().startswith("E") or v.upper() in ("FAIL", "ERROR")):
                return True
    return any(t in (text or "") for t in _ERR_TEXT)


def judge(status: int, location: Optional[str], ctype: str, text: str, step: dict, headers_sent: dict) -> Tuple[bool, str, Any]:
    if session_auth.expired(status, location, ctype, text or ""):
        return False, "auth_expired", None
    if status >= 400:
        sent = {k.lower() for k in (headers_sent or {})}
        return False, ("waf_blocked" if status in (400, 403) and "x-requested-with" not in sent else "http_error"), None
    if step.get("kind") == "html":
        data = htmltable.to_data(text or "")
        before = htmltable.shape(step.get("recordedData") or {})
        if _looks_error(None, text):
            return False, "error_response", data
        if before and (data is None or len(before & htmltable.shape(data)) / len(before) < 0.6):
            return False, "shape_mismatch", data
        return True, "", data
    data, before = infer.parse_json(text or ""), infer.parse_json(step.get("recordedRes") or "")
    if _looks_error(data, text):
        return False, "error_response", data
    if before is not None:
        kb = _keys(before)
        if data is None or (kb and len(kb & _keys(data)) / len(kb) < 0.6):
            return False, "shape_mismatch", data
    return True, "", data


class HttpTransport:
    mode = "session"

    def __init__(self, cookies: Dict[str, str]):
        self.cookies = cookies

    async def send(self, step, url, headers, params, form, json_body):
        if params:
            url = url + ("&" if "?" in url else "?") + encode(params, step.get("charset"))
        content = None
        if form:
            content = encode(form, step.get("charset"))
            headers = dict(headers, **{"content-type": f"application/x-www-form-urlencoded; charset={step.get('charset') or 'UTF-8'}"})
        async with httpx.AsyncClient(follow_redirects=False, timeout=TIMEOUT, cookies=self.cookies, verify=False) as c:
            r = await c.request(step["method"], url, headers=headers, content=content, json=json_body)
            return r.status_code, r.headers.get("location"), r.headers.get("content-type", ""), r.text[:200_000]


class BrowserTransport:
    """기록 세션 페이지 안에서 보낸다. 숨은 토큰이 필요하면 직전 화면(formPage)을 다시 받아 새 값을 채운다."""
    mode = "browser"

    def __init__(self, page):
        self.page = page

    async def send(self, step, url, headers, params, form, json_body):
        r = await self.page.evaluate("""async ([m, u, h, q, f, j, formPage, hidden, cs]) => {
            if (q && Object.keys(q).length) u += (u.includes('?') ? '&' : '?') + new URLSearchParams(q).toString();
            if (formPage && hidden.length) {
              const html = await (await fetch(formPage, {credentials: 'include'})).text();
              const doc = new DOMParser().parseFromString(html, 'text/html');
              for (const name of hidden) { const el = doc.querySelector('input[type=hidden][name="' + name + '"]'); if (el) f[name] = el.value; }
            }
            let body = null;
            if (j) { body = JSON.stringify(j); h['content-type'] = 'application/json'; }
            else if (f && Object.keys(f).length) { body = new URLSearchParams(f).toString(); h['content-type'] = 'application/x-www-form-urlencoded'; }
            const r = await fetch(u, {method: m, headers: h, body, redirect: 'manual', credentials: 'include'});
            return [r.status, r.headers.get('location'), r.headers.get('content-type') || '', await r.text()];
        }""", [step["method"], url, headers, params or {}, dict(form or {}), json_body, step.get("formPage"),
               [p["a"] for p in step["params"] if (p.get("from") or "").startswith("session.hidden.")], step.get("charset")])
        return r[0], r[1], r[2], (r[3] or "")[:200_000]


def _value(p: dict, inputs: Dict[str, str], raw: Dict[str, str], outs: Dict[str, Dict[str, Any]]) -> Optional[str]:
    src = p.get("from") or ""
    if src.startswith("input."):
        v = inputs.get(src[6:], p.get("ex", ""))
    elif src.startswith("const:"):
        v = src[6:]
    elif src.startswith(("session.", "config.")):
        v = p.get("ex", "")
    elif "." in src:
        sid, name = src.split(".", 1)
        got = outs.get(sid, {}).get(name)
        return None if got is None else str(got)
    else:
        v = p.get("ex", "")
    return raw.get(v, v)


async def run_once(bf: dict, inputs: Dict[str, str], raw: Dict[str, str], http, browser,
                   ask_write: Callable[[dict], Awaitable[bool]], gap: float, kind: str = "same-values") -> dict:
    outs: Dict[str, Dict[str, Any]] = {}
    results = []

    def fail(st, reason, status=None):
        results.append({"id": st["id"], "status": status, "ok": False, "reason": reason})
        return {"kind": kind, "ok": False, "steps": results, "reason": reason}

    for i, st in enumerate(bf["steps"]):
        if i and gap:
            await asyncio.sleep(gap)
        base = (st.get("base") or bf["source"]["base"]).rstrip("/")
        url = base + st["path"]
        if scope.blocked(url, f"{urlsplit(bf['source']['base']).scheme}://{urlsplit(bf['source']['base']).netloc}", config.deny_entries()):
            return fail(st, "http_error")
        if st.get("write") and not await ask_write(st):
            return fail(st, "write_denied")
        transport = browser if st.get("exec") == "browser" else http
        if transport is None:
            return fail(st, "browser_needed")
        headers = {"User-Agent": UA, "Referer": base + "/", **(st.get("headers") or {})}
        params, form, body = {}, {}, None
        for p in st["params"]:
            v = _value(p, inputs, raw, outs)
            if v is None:
                return fail(st, "chain_broken")
            if re.search(r"\*{2,}|•{2,}", v):
                return fail(st, "needs_value")
            if p["loc"] == "query":
                params[p["a"]] = v
            elif p["loc"] == "form":
                form[p["a"]] = v
            elif p["loc"] == "body":
                body = dict(body or {}, **{p["a"]: v})
            elif p["loc"] == "header":
                headers[p["a"]] = v
        url_noq = url.split("?")[0]
        try:
            status, loc, ctype, text = await transport.send(st, url_noq, headers, params, form, body)
        except Exception as exc:
            results.append({"id": st["id"], "status": None, "ok": False, "reason": "http_error", "note": type(exc).__name__})
            return {"kind": kind, "ok": False, "steps": results, "reason": "http_error"}
        ok, why, data = await asyncio.to_thread(judge, status, loc, ctype, text, st, headers)
        if ok:
            outs[st["id"]] = {}
            for name, path in (st.get("outputs") or {}).items():
                v = get_path(data, path) if data is not None else None
                if v is None:
                    ok, why = False, "chain_broken"
                    break
                outs[st["id"]][name] = v
        results.append({"id": st["id"], "status": status, "ok": ok, "reason": why, "via": transport.mode})
        if not ok:
            return {"kind": kind, "ok": False, "steps": results, "reason": why}
    return {"kind": kind, "ok": True, "steps": results, "reason": ""}


def _shift_month(v: str) -> str:
    """같은 날의 한 달 전. 그 달에 그 날이 없거나 원래 날이 그 달의 마지막 날이면 한 달 전 달의 마지막 날."""
    d = dt.date(int(v[:4]), int(v[4:6]), int(v[6:]))
    last_prev = d.replace(day=1) - dt.timedelta(days=1)
    next_first = (d.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
    if d == next_first - dt.timedelta(days=1):
        return last_prev.strftime("%Y%m%d")
    return last_prev.replace(day=min(d.day, last_prev.day)).strftime("%Y%m%d")


def varied_inputs(bf: dict, spans: list) -> Optional[Dict[str, str]]:
    out, changed = {}, False
    for inp in bf.get("inputs", []):
        v = str(inp.get("ex") or "")
        if inp.get("source") != "USER_INPUT" or not v or inp.get("needsValue"):
            out[inp["name"]] = v
            continue
        if inp.get("type") == "date" and re.fullmatch(r"\d{8}", v):
            out[inp["name"]] = _shift_month(v)
            changed = True
            continue
        alt = _alternative(inp["name"], v, spans)
        out[inp["name"]] = alt or v
        changed = changed or bool(alt)
    return out if changed else None


def _alternative(name: str, value: str, spans: list) -> Optional[str]:
    want = name.lower().replace("_", "")
    for sp in spans:
        for n in sp.get("network", []):
            data = n.get("data") or infer.parse_json(n.get("res") or "")
            for path, v in leaves(data) if data is not None else []:
                key = path.rsplit(".", 1)[-1].split("[")[0].lower().replace("_", "")
                if key == want and str(v) and str(v) != value and "*" not in str(v):
                    return str(v)
    return None


async def verify(bf: dict, rec: dict, spans: list, session=None, values: Optional[Dict[str, str]] = None) -> dict:
    host = urlsplit(bf["source"]["base"]).hostname or ""
    gap = 0 if host in ("localhost", "127.0.0.1", "::1") else 0.6
    raw: Dict[str, str] = {}
    browser = None
    if session is not None and not session.closed:
        cookies = {c["name"]: c["value"] for c in await session.ctx.cookies()}
        http, browser, raw = HttpTransport(cookies), BrowserTransport(session.page), dict(session.trace.raw)

        async def ask(st):
            return await session.guard.ask(st["method"], (st.get("base") or bf["source"]["base"]) + st["path"], f"Replay 검증: {st['path']}")
    else:
        if (rec.get("login") or {}).get("mode") != "auto" or not (rec.get("login") or {}).get("recipe"):
            return {"verification": {"status": "needs-login", "at": time.time(), "runs": []}, "executionMode": None}
        cred = await asyncio.to_thread(credentials.get, f"rec:{rec['id']}") or {}
        cookies = await asyncio.to_thread(session_auth.login, bf["source"]["base"], dict(cred, recipe=rec["login"]["recipe"]))
        http = HttpTransport(cookies)

        async def ask(st):
            return bf["source"].get("env") != "op"        # 기록 화면 밖 재검증: 운영 쓰기는 물을 창이 없으니 보내지 않는다

    same_inputs = {i["name"]: str((values or {}).get(i["name"], i.get("ex") or "")) for i in bf.get("inputs", [])}
    if values:
        raw = dict(raw, **{i.get("ex"): values[i["name"]] for i in bf.get("inputs", []) if i["name"] in values and i.get("ex")})
    same = await run_once(bf, same_inputs, raw, http, browser, ask, gap)
    mode = "browser" if any(s.get("via") == "browser" for s in same["steps"]) else ("session" if bf.get("auth", {}).get("mode") == "session" else "direct")
    if not same["ok"] and browser is not None and same["reason"] in ("shape_mismatch", "http_error", "waf_blocked", "error_response"):
        forced = dict(bf, steps=[dict(s, exec="browser") for s in bf["steps"]])
        alt = await run_once(forced, same_inputs, raw, http, browser, ask, gap)
        if alt["ok"]:
            same, mode = dict(alt, note="browser_only"), "browser"
    runs = [same]
    varied = None if any(s.get("write") for s in bf["steps"]) else varied_inputs(bf, spans)
    if same["ok"] and varied:
        runs.append(await run_once(bf, varied, raw, http, browser, ask, gap, kind="varied-values"))
    elif same["ok"]:
        runs.append({"kind": "varied-values", "ok": None, "steps": [], "reason": "skipped"})
    if same["reason"] == "needs_value":
        status = "needs-value"
    elif not same["ok"]:
        status = "failed"
    elif all(r["ok"] is not False for r in runs):
        status = "verified"
    else:
        status = "partial"
    return {"verification": {"status": status, "at": time.time(), "runs": runs}, "executionMode": mode if same["ok"] else None}
```

- [ ] **Step 4: 시험 통과 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_replay.py -v`
Expected: 14개 PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/app/ieum/recorder/replay.py apps/backend/tests/test_ieum_recorder_replay.py
git commit -m "feat: 업무 기능 Replay 검증 — 원값 복원, 단계별 출처·인코딩, 브라우저 실행, HTML 구조 비교"
```

---

### Task 11: 종료 후 흐름, 업무 기능 수정·확정·등록

**Files:**
- Create: `apps/backend/app/ieum/recorder/service.py`
- Modify: `apps/backend/app/ieum/routers/recorder.py` (업무 기능 라우트, `MANAGER.on_stopped = service.finish`)
- Test: `apps/backend/tests/test_ieum_recorder_service.py`

**Interfaces:**
- Consumes: `analyze.analyze`, `replay.verify`, `store.*`, `retention`, `MANAGER.close`, `src_repo`, `tool_repo`, `credentials`, `session_auth.invalidate`, `infer.tool_name/build_res`, `spec._param`, `Masker`, `jobs._slug`
- Produces:
  - `await service.finish(rid, session)` — `analyzing → verifying → review`(실패 `failed`). 끝나면 `MANAGER.close(rid)`
  - `service.update_function(fid, patch) -> dict` — 허용: `name`, `desc`, `inputs[{name, source, screenLabel, required, type}]`, `steps[{id, skip}]`(순서), `promote{method, path}`, `policy{operation, risk, approval, scope, sensitivity}`. 입력·단계가 바뀌면 `verification.status = "stale"`. `policyIncomplete` 다시 계산
  - `await service.reverify(fid, values: Optional[Dict[str, str]]) -> dict` — `values`는 저장하지 않는다
  - `service.confirm(fid) -> dict` — `status="confirmed"`, 스크린샷 삭제(`store.delete_shots`)
  - `service.register_single(fid) -> dict` (단계 1개만), `service.register_steps(fid) -> dict` (단계마다) — 단계의 `base`별로 원본 시스템을 나눈다
  - 라우트: `GET/PUT /functions/{fid}/`, `POST /functions/{fid}/verify/` (본문 `{"values": {...}}`), `POST /functions/{fid}/confirm/`, `POST /functions/{fid}/register/` (`{"mode": "single"|"steps"}`)

- [ ] **Step 1: 실패하는 시험 작성**

```python
# apps/backend/tests/test_ieum_recorder_service.py
"""업무 기능 수정·확정·등록."""
import json

import pytest

from app.ieum.recorder import service, store
from app.ieum.repositories import sources as src_repo
from app.ieum.repositories import studio as tool_repo


def _bf(steps):
    return {"id": "bf_00000001", "name": "거래처 검색", "desc": "거래처 검색 화면에서 거래처명(으)로 조회합니다.", "status": "draft",
            "source": {"base": "http://h/po", "recordingId": "rec_00000001", "made": "manual-record", "env": "op"},
            "inputs": [{"name": "vendNm", "type": "string", "source": "USER_INPUT", "ex": "한빛", "screenLabel": "거래처명",
                        "confidence": "high", "required": True, "needsValue": False}],
            "steps": steps, "references": [], "excluded": [{"method": "GET", "path": "/common/codeList.do", "role": "code", "why": ""}],
            "output": {"from": "s1", "fields": []}, "auth": {"mode": "session", "recipe": {"userField": "userId", "passField": "userPw",
                                                                                         "loginRel": "/login.do", "actionRel": "/loginProc.do", "extra": {}, "json": False}},
            "executionMode": "session", "policy": {"operation": "READ", "risk": "LOW", "approval": "NONE", "envPolicy": "op-auto", "scope": None, "sensitivity": None},
            "policyIncomplete": True, "verification": {"status": "verified", "at": 1, "runs": []}, "evidence": {}, "notes": []}


STEP = {"id": "s1", "role": "core", "base": "http://h/po", "origin": "http://h", "method": "GET", "path": "/vendList.do", "discriminator": "",
        "kind": "json", "charset": None, "exec": "http", "formPage": None, "write": False, "headers": {"x-requested-with": "XMLHttpRequest"},
        "outputs": {}, "recordedStatus": 200, "recordedData": None,
        "recordedRes": json.dumps({"RSLT": "0000", "resultList": [{"VEND_CD": "V0012", "VEND_NM": "한빛상사"}]}),
        "params": [{"a": "vendNm", "loc": "query", "from": "input.vendNm", "ex": "한빛", "source": "USER_INPUT", "confidence": "high", "type": "string", "required": True}]}


@pytest.fixture
def saved(ieum_state):
    rec = store.new_recording("거래처 검색", "홍길동", "http://h/po", "", "op", "auto", "")
    rec["id"] = "rec_00000001"
    store.save_recording(rec)
    store.append_span(rec["id"], {"seq": 1})
    (store.rec_dir(rec["id"]) / "1-pre.jpg").write_bytes(b"x")
    bf = _bf([STEP])
    store.save_function(bf)
    return bf


def test_입력_출처를_바꾸면_검증이_낡음이_된다(saved):
    out = service.update_function(saved["id"], {"inputs": [dict(saved["inputs"][0], source="CONSTANT")]})
    assert out["inputs"][0]["source"] == "CONSTANT" and out["verification"]["status"] == "stale"


def test_제외된_요청을_단계로_올린다(saved):
    out = service.update_function(saved["id"], {"promote": {"method": "GET", "path": "/common/codeList.do"}})
    assert [s["path"] for s in out["steps"]] == ["/vendList.do", "/common/codeList.do"] and out["steps"][1]["role"] == "prereq"


def test_정책을_채우면_미완이_풀린다(saved):
    out = service.update_function(saved["id"], {"policy": {"scope": "부서 데이터", "sensitivity": "일반"}})
    assert out["policyIncomplete"] is False


def test_확정하면_스크린샷을_지우고_행동_묶음은_남긴다(saved):
    out = service.confirm(saved["id"])
    assert out["status"] == "confirmed" and out["policyIncomplete"] is True
    assert not list(store.rec_dir("rec_00000001").glob("*.jpg")) and store.read_spans("rec_00000001")


def test_단계가_하나면_도구로_등록한다(saved):
    out = service.register_single(saved["id"])
    tool = out["tools"][0]
    assert tool["method"] == "GET" and tool["path"] == "/vendList.do" and tool["mode"] == "read" and tool["status"] == "review"
    assert tool["rec"] == {"function": "bf_00000001", "recording": "rec_00000001"} and "거래처명" in tool["desc"]
    assert any(s["id"] == out["sources"][0]["id"] and s["authType"] == "session" for s in src_repo.list_sources())
    assert tool["id"] in {t["id"] for t in tool_repo.flat_tools()}


def test_여러_단계는_도구_하나로_등록하지_않고_출처별로_나눠_등록한다(ieum_state):
    other = dict(STEP, id="s2", base="http://appr.corp:9090", origin="http://appr.corp:9090", path="/appr/list.do")
    store.save_function(_bf([STEP, other]))
    with pytest.raises(ValueError, match="다음 작업"):
        service.register_single("bf_00000001")
    out = service.register_steps("bf_00000001")
    assert sorted(s["base"] for s in out["sources"]) == ["http://appr.corp:9090", "http://h/po"]
    assert sorted(t["path"] for t in out["tools"]) == ["/appr/list.do", "/vendList.do"]
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_service.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: 구현**

```python
# apps/backend/app/ieum/recorder/service.py
"""기록이 끝난 뒤의 흐름과 업무 기능 다루기.

종료 → 분석 → 검증 → 검토. 검증은 기록 세션의 브라우저가 살아 있을 때 해야 같은 세션 쿠키·페이지·원값을 쓸 수 있어서,
검증이 끝날 때까지 브라우저를 닫지 않는다. 분석은 CPU 를 쓰므로 스레드로 넘긴다.

확정하면 스크린샷을 지운다(그림 속 개인정보). 확정 뒤 근거는 마스킹된 ARIA 텍스트로 보여 준다.
도구 등록은 단계가 하나일 때만 "업무 기능 = 도구 하나"다. 여러 단계를 도구 하나로 실행하는 것은 다음 작업이다.
단계마다 출처가 다를 수 있어(결재 시스템 등) 출처별 원본 시스템 아래에 등록한다.
"""
import asyncio
import time
from typing import Dict, List, Optional
from urllib.parse import urlsplit

from app.ieum.discovery import infer
from app.ieum.discovery.jobs import _slug
from app.ieum.discovery.masking import Masker
from app.ieum.gateway import credentials, session_auth, spec
from app.ieum.recorder import analyze, replay, store
from app.ieum.repositories import sources as src_repo
from app.ieum.repositories import studio as tool_repo

EDITABLE_POLICY = ("operation", "risk", "approval", "scope", "sensitivity")


def _incomplete(bf: dict) -> bool:
    return bf["policy"].get("scope") is None or bf["policy"].get("sensitivity") is None


async def finish(rid: str, session) -> None:
    from app.ieum.recorder.manager import MANAGER

    async def say(status, **extra):
        await asyncio.to_thread(store.update_recording, rid, lambda r: r.update(status=status, **extra))
        if session is not None:
            await session.broadcast(dict({"t": "status", "status": status}, **extra))
    try:
        await say("analyzing")
        rec = await asyncio.to_thread(store.get_recording, rid)
        spans = await asyncio.to_thread(store.read_spans, rid)
        bf = await asyncio.to_thread(analyze.analyze, rec, spans)
        await asyncio.to_thread(store.save_function, bf)
        await asyncio.to_thread(store.update_recording, rid, lambda r: r.update(functionId=bf["id"]))
        await say("verifying")
        if bf["steps"]:
            result = await replay.verify(bf, rec, spans, session)
            bf.update(verification=result["verification"], executionMode=result["executionMode"])
            await asyncio.to_thread(store.save_function, bf)
        await say("review")
    except Exception as exc:
        msg = str(exc).splitlines()[0][:300] if str(exc) else type(exc).__name__
        await say("failed", error=f"분석·검증 중 오류: {msg}")
    finally:
        await MANAGER.close(rid)


def update_function(fid: str, patch: dict) -> dict:
    bf = store.get_function(fid)
    stale = False
    for k in ("name", "desc"):
        if k in patch:
            bf[k] = str(patch[k])[:300]
    if "inputs" in patch:
        by = {i["name"]: i for i in patch["inputs"]}
        for inp in bf["inputs"]:
            new = by.get(inp["name"])
            if new:
                for k in ("source", "screenLabel", "required", "type"):
                    if k in new:
                        inp[k] = new[k]
                inp["confidence"] = "high"
                for st in bf["steps"]:
                    for p in st["params"]:
                        if p["a"] == inp["name"] and (p.get("from") or "").startswith(("input.", "const:", "config.")):
                            p["source"] = inp["source"]
                            p["from"] = f"input.{p['a']}" if inp["source"] == analyze.USER_INPUT else f"const:{p.get('ex', '')}"
                stale = True
    if "steps" in patch:
        order = [s["id"] for s in patch["steps"] if not s.get("skip")]
        bf["steps"] = [s for sid in order for s in bf["steps"] if s["id"] == sid]
        stale = True
    if "promote" in patch:
        want = patch["promote"]
        hit = next((x for x in bf["excluded"] if x["method"] == want["method"] and x["path"] == want["path"]), None)
        if hit:
            bf["excluded"].remove(hit)
            bf["references"] = [x for x in bf["references"] if x["path"] != hit["path"]]
            bf["steps"].append({"id": f"s{len(bf['steps']) + 1}", "role": "prereq", "base": bf["source"]["base"], "origin": "",
                                "method": hit["method"], "path": hit["path"], "discriminator": "", "kind": "json", "charset": None,
                                "exec": "http", "formPage": None, "write": hit["method"] not in ("GET", "HEAD"), "headers": {},
                                "outputs": {}, "params": [], "recordedRes": "", "recordedData": None, "recordedStatus": None})
            stale = True
    if "policy" in patch:
        for k in EDITABLE_POLICY:
            if k in patch["policy"]:
                bf["policy"][k] = patch["policy"][k] or None
    bf["policyIncomplete"] = _incomplete(bf)
    if stale:
        bf["verification"]["status"] = "stale"
    if bf.get("status") == "confirmed":
        bf["status"] = "draft"
    store.save_function(bf)
    return bf


async def reverify(fid: str, values: Optional[Dict[str, str]] = None) -> dict:
    bf = await asyncio.to_thread(store.get_function, fid)
    rid = bf["source"]["recordingId"]
    rec = await asyncio.to_thread(store.get_recording, rid)
    spans = await asyncio.to_thread(store.read_spans, rid)
    from app.ieum.recorder.manager import MANAGER
    result = await replay.verify(bf, rec, spans, MANAGER.get(rid), values)
    bf.update(verification=result["verification"], executionMode=result["executionMode"] or bf.get("executionMode"))
    await asyncio.to_thread(store.save_function, bf)
    return bf


def confirm(fid: str) -> dict:
    bf = store.get_function(fid)
    bf["status"] = "confirmed"
    bf["policyIncomplete"] = _incomplete(bf)
    bf["confirmedAt"] = time.time()
    store.save_function(bf)
    store.delete_shots(bf["source"]["recordingId"])
    return bf


def _tool_from_step(bf: dict, st: dict, taken: set, title: str) -> dict:
    mode = "write" if st.get("write") else "read"
    params = []
    for p in st["params"]:
        if p.get("source") in (analyze.PREVIOUS_STEP_OUTPUT, analyze.SESSION_CONTEXT):
            continue
        sch = {"type": {"number": "integer"}.get(p.get("type"), "string")}
        if p.get("ex") and "*" not in p["ex"]:
            sch["example"] = p["ex"]
        label = next((i.get("screenLabel") for i in bf["inputs"] if i["name"] == p["a"]), None)
        q = spec._param(p["a"], p["loc"], sch, bool(p.get("required")), label)
        if p.get("source") in (analyze.CONSTANT, analyze.SYSTEM_CONFIG):
            q.update(rule="inject", v=p.get("ex", ""))
        params.append(q)
    for k, v in (st.get("headers") or {}).items():
        params.append({"o": "-".join(w.capitalize() for w in k.split("-")), "ot": "string", "a": "", "at": "string", "loc": "header",
                       "rule": "inject", "d": "화면이 항상 같은 값으로 보내는 헤더", "ex": v, "v": v})
    res, _ = infer.build_res(st.get("recordedRes") or "", Masker(pii=True))
    return {"id": infer.tool_name(st["path"], "", mode, taken), "method": st["method"], "path": st["path"], "title": title,
            "status": "review", "mode": mode, "desc": bf.get("desc") or bf["name"],
            "confirmQ": f"{title} 작업을 실행할까요?" if mode == "write" else None, "params": params, "res": res, "guess": 0,
            "rec": {"function": bf["id"], "recording": bf["source"]["recordingId"]}}


def _register(bf: dict, steps: List[dict]) -> dict:
    by_base: Dict[str, List[dict]] = {}
    for st in steps:
        by_base.setdefault((st.get("base") or bf["source"]["base"]).rstrip("/"), []).append(st)
    rid = bf["source"]["recordingId"]
    cred = credentials.get(f"rec:{rid}") or {}
    recipe = (bf.get("auth") or {}).get("recipe")
    out_sources, out_tools = [], []
    for base, group in by_base.items():
        sources = src_repo.list_sources()
        existing = next((x for x in sources if x.get("proto") == "disc" and x.get("base") == base), None)
        sid = existing["id"] if existing else _slug(bf["name"], {x["id"] for x in sources}, urlsplit(base).netloc)
        current = tool_repo.all_tools().get(sid, [])
        taken = {t["id"] for t in tool_repo.flat_tools()}
        primary = base == bf["source"]["base"].rstrip("/")
        src = {"id": sid, "name": existing["name"] if existing else (bf["name"] if primary else urlsplit(base).netloc),
               "desc": f"도구 {len(current) + len(group)}개", "proto": "disc", "spec": "업무 기록으로 추론", "base": base,
               "auth": "세션 (서비스 계정)", "authType": "session", "sync": "방금", "specUrl": None}
        if primary and cred.get("username") and recipe:
            credentials.put(sid, {"type": "session", "username": cred["username"], "password": cred.get("password", ""), "recipe": recipe})
            session_auth.invalidate(sid)
        out_sources.append(src_repo.upsert_source(src))
        new = []
        for st in group:
            title = bf["name"] if len(steps) == 1 else f"{bf['name']} — {st['path'].rsplit('/', 1)[-1]}"
            new.append(tool_repo.with_defaults(_tool_from_step(bf, st, taken, title), src))
        saved = tool_repo.replace_source_tools(sid, current + new)
        ids = {t["id"] for t in new}
        out_tools += [t for t in saved if t["id"] in ids]
    return {"sources": out_sources, "tools": out_tools, "loginKnown": bool(cred.get("username") and recipe)}


def register_single(fid: str) -> dict:
    bf = store.get_function(fid)
    if len(bf["steps"]) != 1:
        raise ValueError("여러 단계 업무는 다음 작업에서 도구 하나로 등록할 수 있습니다. 지금은 단계를 낱개 도구로 등록해 주세요.")
    return _register(bf, bf["steps"])


def register_steps(fid: str) -> dict:
    bf = store.get_function(fid)
    if not bf["steps"]:
        raise ValueError("등록할 단계가 없습니다.")
    return _register(bf, bf["steps"])
```

`routers/recorder.py`에 더한다:

```python
from app.ieum.recorder import service

MANAGER.on_stopped = service.finish


@router.get("/functions/{fid}/")
async def function_get(fid: str):
    try:
        return ok(await asyncio.to_thread(store.get_function, fid))
    except KeyError:
        return fail(404, "업무 기능을 찾을 수 없습니다.")


@router.put("/functions/{fid}/")
async def function_put(fid: str, payload: Optional[dict] = Body(None)):
    try:
        return ok(await asyncio.to_thread(service.update_function, fid, payload or {}))
    except KeyError:
        return fail(404, "업무 기능을 찾을 수 없습니다.")


@router.post("/functions/{fid}/verify/")
async def function_verify(fid: str, payload: Optional[dict] = Body(None)):
    try:
        return ok(await service.reverify(fid, (payload or {}).get("values") or None))
    except KeyError:
        return fail(404, "업무 기능을 찾을 수 없습니다.")
    except Exception as exc:
        return fail(400, f"다시 검증하지 못했습니다. {str(exc)[:200]}")


@router.post("/functions/{fid}/confirm/")
async def function_confirm(fid: str):
    try:
        return ok(await asyncio.to_thread(service.confirm, fid))
    except KeyError:
        return fail(404, "업무 기능을 찾을 수 없습니다.")


@router.post("/functions/{fid}/register/")
async def function_register(fid: str, payload: Optional[dict] = Body(None)):
    mode = (payload or {}).get("mode") or "single"
    try:
        fn = service.register_steps if mode == "steps" else service.register_single
        return ok(await asyncio.to_thread(fn, fid), 201)
    except KeyError:
        return fail(404, "업무 기능을 찾을 수 없습니다.")
    except ValueError as exc:
        return fail(400, str(exc))
```

- [ ] **Step 4: 시험 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_service.py -v && .venv/bin/pytest tests/ -q -p no:cacheprovider`
Expected: 6개 PASS, 전체 통과

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/app/ieum/recorder/service.py apps/backend/app/ieum/routers/recorder.py apps/backend/tests/test_ieum_recorder_service.py
git commit -m "feat: 업무 기능 검토·확정(스크린샷 삭제)·출처별 도구 등록과 종료 후 분석·검증 흐름"
```

---

### Task 12: 콘솔 화면 "업무 기록"

**Files:**
- Create: `apps/web/ieum/js/menu/recorder.js`
- Modify: `apps/web/ieum/js/common/state.js` (`VIEWS`), `apps/web/ieum/js/main.js` (`VFN`, `ACT.nav`), `apps/web/ieum/index.html`, `apps/web/ieum/css/console.css`

**Interfaces:**
- Consumes: 작업 8·11의 REST, 작업 7의 WebSocket 메시지, 전역 `api`, `esc`, `svg`, `toast`, `$`, `$$`, `render`, `S`, `WS`, `ACT`, `INP`, `CHG`, `pageHead`
- Produces: 전역 `vRec`, `recRefresh` 외 `rec`/`REC` 접두사 이름들

- [ ] **Step 1: 전역 이름 충돌 확인**

Run: `grep -rn -E "\b(vRec|recRefresh|REC|recWs|recPill|recOnMsg|recPatch|recBind|recOpenFn|recSaveFn|recAria)\b" apps/web/ieum/js`
Expected: 출력 없음

- [ ] **Step 2: 메뉴 등록**

`state.js`의 `VIEWS`에서 `src` 다음 줄:

```js
  { id:'rec', label:'업무 기록', h:'업무 기록', p:'사람이 업무를 한 번 수행하면, 그 과정의 화면 조작과 API 호출을 묶어 다시 실행할 수 있는 업무 기능으로 만듭니다.' },
```

`main.js` 3행:

```js
const VFN = { dash:vDash, src:vSrc, rec:vRec, studio:vStudio, play:vPlay, deploy:vDeploy, logs:vLogs, disc:vDisc };
```

`main.js`의 `nav:` 처리기 끝에 `if (a.dataset.v === 'rec') recRefresh();`를 더한다.

`index.html`의 `<script src="js/menu/discovery.js"></script>` 다음 줄:

```html
<script src="js/menu/recorder.js"></script>
```

- [ ] **Step 3: `recorder.js` 작성**

```js
/* 업무 기록: 사람이 서버 브라우저를 조작해 업무 하나를 기록하고, 검증된 업무 기능으로 만든다.
   화면 ① 목록 → ② 새 기록 → ③ 기록 중(화면 중계) → ④ 검토. 승인 창은 화면 안 요소다(window.confirm 금지).
   입력 원값(값 다시 입력 필요)은 서버로 보내 검증에만 쓰고 저장하지 않는다. */
const REC = { page:'list', list:[], fns:[], usage:null, demo:null, form:null, live:null, fn:null, busy:false, values:{} };
const REC_STATUS = { recording:['기록 중','info'], analyzing:['분석 중','info'], verifying:['검증 중','info'], review:['검토 대기','warn'],
  confirmed:['확정','ok'], failed:['실패','danger'], interrupted:['중단됨','mute'] };
const REC_VERIFY = { verified:['검증됨','ok'], partial:['부분 검증','warn'], failed:['검증 실패','danger'], pending:['검증 전','mute'],
  stale:['다시 검증 필요','warn'], 'needs-login':['다시 로그인 필요','warn'], 'needs-value':['값 다시 입력 필요','warn'] };
const REC_SOURCES = [['USER_INPUT','사용자 입력'],['PREVIOUS_STEP_OUTPUT','앞 단계 결과'],['SESSION_CONTEXT','세션 값'],
  ['SYSTEM_CONFIG','설정값'],['DERIVED','계산 값'],['CONSTANT','고정값']];
const recPill = (map, k) => { const v = map[k] || [k || '-', 'mute']; return `<span class="pill rec-${v[1]}">${esc(v[0])}</span>`; };

async function recRefresh() {
  try {
    const d = await api.get('/recorder/');
    REC.list = d.recordings; REC.fns = d.functions; REC.usage = d.usage; REC.demo = d.demo;
    if (S.view === 'rec') render();
  } catch (e) { toast(e.message, 'warn'); }
}

function vRec() {
  if (REC.page === 'new') return pageHead('rec') + recNewHTML();
  if (REC.page === 'live' && REC.live) return recLiveHTML();
  if (REC.page === 'review' && REC.fn) return pageHead('rec') + recReviewHTML();
  return pageHead('rec') + recListHTML();
}

/* ① 목록 */
function recListHTML() {
  const fnBy = Object.fromEntries(REC.fns.map(f => [f.id, f]));
  const u = REC.usage || { total:0, max:4, perOwner:1, byOwner:{} };
  const who = Object.entries(u.byOwner).map(([k, v]) => `${esc(k)} ${v}개`).join(', ');
  const rows = REC.list.map(r => {
    const f = r.functionId ? fnBy[r.functionId] : null;
    const kinds = f ? [...new Set(f.steps.map(s => s.kind === 'html' ? 'HTML' : 'JSON'))].join('·') : '';
    return `<tr data-act="recOpen" data-id="${esc(r.id)}" tabindex="0"><td><b>${esc(r.name)}</b><small>${esc(r.owner || '')} · ${r.env === 'op' ? '운영' : '스테이징'}</small></td>
      <td>${recPill(REC_STATUS, f && f.status === 'confirmed' ? 'confirmed' : r.status)} ${f ? recPill(REC_VERIFY, f.verification.status) : ''}
      ${f && f.policyIncomplete ? '<span class="pill rec-warn">정책 미완</span>' : ''}</td>
      <td>${f ? esc(f.policy.operation) : ''}</td><td>${f ? `${f.steps.length}단계` : ''}</td><td>${esc(kinds)}</td><td>${r.spanCount}개 행동</td></tr>`;
  }).join('');
  return `<div class="rec-bar"><button class="btn primary" data-act="recNew">${svg('plus', 16)}새 기록</button>
    <span class="rec-hint">지금 기록 중 ${u.total}/${u.max}개${who ? ` (${who})` : ''} · 사람당 ${u.perOwner}개</span></div>
    ${REC.list.length ? `<table class="tbl rec-list"><thead><tr><th>업무</th><th>상태</th><th>작업 유형</th><th>단계</th><th>응답</th><th>기록</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<div class="md-empty">아직 기록한 업무가 없습니다. <b>새 기록</b>을 눌러 업무 하나를 기록해 보세요.</div>'}`;
}

/* ② 새 기록 */
function recNewHTML() {
  const f = REC.form;
  const inp = (k, ph, o = {}) => `<input class="inp ${o.mono ? 'mono' : ''}" ${o.type ? `type="${o.type}"` : ''} data-inp="recF" data-k="${k}" value="${esc(f[k] || '')}" placeholder="${esc(ph)}" aria-label="${esc(ph)}">`;
  return `<div class="card rec-form">
    <div class="field"><label>업무 이름</label>${inp('name', '9월 발주 상세 조회')}</div>
    <div class="field"><label>대상 시스템 주소</label>${inp('base', 'http://10.20.4.30:8080/po', { mono:1 })}<small>기록을 시작할 기준점입니다. 업무 중 다른 시스템으로 넘어가도 막지 않고 함께 기록합니다.</small></div>
    <div class="field"><label>시작 화면 (선택)</label>${inp('start', '/login.do', { mono:1 })}</div>
    <div class="field"><label>환경</label><div class="rec-env">
      <label><input type="radio" name="recEnv" data-chg="recEnv" value="op" ${f.env === 'op' ? 'checked' : ''}> 운영 — 쓰기 요청은 승인 후에만 보냅니다</label>
      <label><input type="radio" name="recEnv" data-chg="recEnv" value="stg" ${f.env === 'stg' ? 'checked' : ''}> 스테이징 — 쓰기도 그대로 보냅니다</label></div></div>
    <div class="field"><label>서비스 계정 (선택)</label><div class="two">${inp('account', '아이디')}${inp('password', '비밀번호', { type:'password' })}</div>
      <small>비우거나 자동 로그인이 실패하면 기록 화면에서 직접 로그인합니다. 직접 로그인한 비밀번호는 저장하지 않습니다.</small></div>
    <div class="field"><label>조회용 POST 경로 (선택)</label>${inp('readPost', '/po/searchPost.do', { mono:1 })}<small>검색을 POST 로 하는 화면이면 적어 주세요. 승인 없이 보냅니다.</small></div>
    <div class="field"><label>기록하는 사람</label>${inp('owner', '홍길동')}<small>동시 기록 상한을 사람마다 셉니다.</small></div>
    <div class="rec-actions"><button class="btn" data-act="recBack">취소</button>${REC.demo ? '<button class="btn" data-act="recDemo">시연용 값 채우기</button>' : ''}
      <button class="btn primary" data-act="recStart" ${REC.busy ? 'disabled' : ''}>${REC.busy ? '브라우저를 띄우는 중…' : '기록 시작'}</button></div></div>`;
}

/* ③ 기록 중 */
function recLiveHTML() {
  const L = REC.live;
  const tl = L.spans.slice(-60).map(s => `<li><b>${s.seq}</b> ${esc(((s.action.target || {}).text || s.action.type || '').slice(0, 24))}
      ${s.network.map(n => `<div class="${n.held ? 'w' : ''}">${esc(n.method)} ${esc(n.path)} ${n.status == null ? '' : n.status}${n.kind === 'html' ? ' · HTML' : ''}${n.decision ? ` · ${esc(n.decision)}` : ''}</div>`).join('')}</li>`).join('');
  const blocked = L.blocked.slice(-5).map(b => `<li class="b">차단(서버 보호) ${esc(b.why)} — ${esc(b.url)}</li>`).join('');
  const tabs = L.tabs.length > 1 ? `<span class="rec-tabs">${L.tabs.map(t => `<button class="btn sm ${t.index === L.active ? 'primary' : ''}" data-act="recTab" data-i="${t.index}">${esc((t.title || t.url || '탭').slice(0, 14))}</button>`).join('')}</span>` : '';
  return `<div class="rec-live">
    <div class="rec-top ${L.env === 'op' ? 'op' : ''}"><span class="dot"></span><b>${L.status === 'recording' ? (L.paused ? '일시정지' : '기록 중') : esc((REC_STATUS[L.status] || [L.status])[0])}</b>
      <span>${esc(L.name)}</span><span class="env">${L.env === 'op' ? '운영' : '스테이징'}</span>${tabs}
      <span class="sp"></span>${L.status === 'recording' ? `<button class="btn sm" data-act="recPause">${L.paused ? '다시 기록' : '일시정지'}</button>
      <button class="btn sm primary" data-act="recStop">기록 종료</button>` : '<button class="btn sm" data-act="recBack">목록으로</button>'}</div>
    ${L.msg ? `<div class="rec-msg">${esc(L.msg)}</div>` : ''}
    <div class="rec-body"><div class="rec-screen"><canvas id="recCv" width="960" height="600"></canvas>
      <textarea id="recIme" autocomplete="off" aria-label="키보드 입력"></textarea>
      ${L.hold ? `<div class="rec-hold" role="dialog" aria-modal="true"><b>${svg('lock', 16)} 쓰기 요청 승인</b>
        <p>"${esc(L.hold.label || '알 수 없는 버튼')}" → <code>${esc(L.hold.method)} ${esc(L.hold.path)}</code></p>
        <p>운영 데이터가 바뀝니다. 2분 안에 답하지 않으면 보내지 않습니다.</p>
        <button class="btn danger-fill" data-act="recApprove" data-ok="1">승인하고 보내기</button> <button class="btn" data-act="recApprove" data-ok="0">보내지 않기</button></div>` : ''}
      ${L.dialog ? `<div class="rec-hold" role="dialog" aria-modal="true"><b>대상 사이트의 확인 창</b><p>${esc(L.dialog.message)}</p>
        <button class="btn primary" data-act="recDialog" data-ok="1">확인</button> ${L.dialog.type !== 'alert' ? '<button class="btn" data-act="recDialog" data-ok="0">취소</button>' : ''}</div>` : ''}
    </div>
    <aside class="rec-side"><div class="label">타임라인</div><ol class="rec-tl">${tl || '<li class="mute">화면을 클릭하면 여기에 쌓입니다</li>'}${blocked}</ol>
      <div class="rec-count">요청 ${L.spans.reduce((a, s) => a + s.network.length, 0)} · 쓰기 ${L.spans.reduce((a, s) => a + s.network.filter(n => n.held).length, 0)} · 차단 ${L.blocked.length}</div></aside></div></div>`;
}

/* ④ 검토 */
function recReviewHTML() {
  const f = REC.fn, v = f.verification || {}, rid = f.source.recordingId;
  const inputs = f.inputs.map(i => `<tr class="${i.confidence === 'low' || i.needsValue ? 'low' : ''}"><td class="mono">${esc(i.name)}</td><td>${esc(i.screenLabel || '-')}</td>
      <td><select class="inp sm" data-chg="recSrc" data-n="${esc(i.name)}">${REC_SOURCES.map(([k, l]) => `<option value="${k}" ${i.source === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${i.confidence === 'low' ? '<span class="pill rec-warn">확인 필요</span>' : ''}</td>
      <td class="mono">${esc(i.ex)}${i.needsValue ? `<input class="inp sm" type="password" data-inp="recVal" data-n="${esc(i.name)}" placeholder="검증할 값" aria-label="${esc(i.name)} 검증할 값"><small>값 다시 입력 필요 · 저장하지 않습니다</small>` : ''}</td></tr>`).join('');
  const ev = (seq, w) => seq ? `<img class="rec-shot" alt="행동 ${seq} ${w}" src="/api/ieum/recorder/recordings/${esc(rid)}/shots/${seq}-${w}.jpg" onerror="this.replaceWith(Object.assign(document.createElement('button'),{className:'btn sm',textContent:'화면 글자 보기',onclick:()=>recAria('${esc(rid)}',${seq})}))">` : '';
  const steps = f.steps.map((s, i) => { const seq = (f.evidence[s.id] || [])[0];
    return `${i ? '<div class="rec-arrow">→</div>' : ''}<div class="rec-step"><b>${esc(s.id)} · ${s.role === 'core' ? '핵심' : '선행'}</b>
      <span class="pill rec-mute">${s.kind === 'html' ? 'HTML 표' : s.kind === 'json' ? 'JSON' : '기타'}</span> <span class="pill rec-mute">${s.exec === 'browser' ? '브라우저 실행' : 'HTTP'}</span>
      <div class="mono">${esc(s.method)} ${esc(s.path)}${s.discriminator ? ` (${esc(s.discriminator)})` : ''}</div>
      ${s.base !== f.source.base ? `<small>다른 시스템: ${esc(s.base)}</small><br>` : ''}
      ${s.params.map(p => `<small>${esc(p.a)} ← ${esc(p.from)}${p.confidence === 'low' ? ' ⚠' : ''}</small>`).join('<br>')}
      ${Object.keys(s.outputs).length ? `<br><small>꺼내는 값: ${Object.entries(s.outputs).map(([k, p]) => `${esc(k)}=${esc(p)}`).join(', ')}</small>` : ''}
      <div class="rec-shots">${ev(seq, 'pre')}${ev(seq, 'post')}</div></div>`; }).join('');
  const excl = f.excluded.map(x => `<li><code>${esc(x.method)} ${esc(x.path)}</code> · ${esc(x.role)} — ${esc(x.why)}
      ${['auth', 'denied'].includes(x.role) ? '' : `<button class="btn sm" data-act="recPromote" data-m="${esc(x.method)}" data-p="${esc(x.path)}">단계로 올리기</button>`}</li>`).join('');
  const runs = (v.runs || []).map(r => `<li>${r.ok === true ? '✅' : r.ok === false ? '❌' : '⏭'} ${r.kind === 'same-values' ? '같은 값' : '다른 값'}
      ${r.reason ? `<small>${esc(r.reason)}</small>` : ''}${r.note ? `<small>${esc(r.note)}</small>` : ''}</li>`).join('');
  const sel = (k, opts) => `<select class="inp sm" data-chg="recPol" data-k="${k}"><option value="">선택</option>${opts.map(o => `<option ${f.policy[k] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  return `<div class="rec-rv-head"><div><h3>${esc(f.name)}</h3><small>${esc(f.policy.operation)} · 위험 ${esc(f.policy.risk)} · 승인 ${esc(f.policy.approval)} · 실행 ${esc(f.executionMode || '-')}</small></div>
    <div><button class="btn" data-act="recBack">목록</button> <button class="btn" data-act="recVerify">다시 검증</button> <button class="btn primary" data-act="recConfirm">확정</button></div></div>
    ${(f.notes || []).map(n => `<div class="rec-msg">${esc(n)}</div>`).join('')}
    <div class="rec-rv"><div>
      <div class="label">설명 (AI 가 이 업무를 고를 때 읽습니다)</div>
      <textarea class="inp rec-desc" data-chg="recDesc" rows="2">${esc(f.desc || '')}</textarea>
      <div class="label">입력값</div>
      <table class="tbl"><thead><tr><th>이름</th><th>화면 라벨</th><th>출처</th><th>기록 값</th></tr></thead><tbody>${inputs || '<tr><td colspan="4" class="mute">입력값이 없습니다</td></tr>'}</tbody></table>
      <div class="label">단계 (이 순서로 실행합니다)</div><div class="rec-steps">${steps || '<div class="md-empty">단계가 없습니다. 아래에서 업무에 해당하는 요청을 단계로 올려 주세요.</div>'}</div>
      <details ${f.steps.length ? '' : 'open'}><summary class="label">단계에 넣지 않은 요청 (${f.excluded.length})</summary><ul class="rec-excl">${excl}</ul></details>
    </div><aside>
      <div class="card"><div class="label">검증 ${recPill(REC_VERIFY, v.status)}</div><ul class="rec-runs">${runs}</ul></div>
      <div class="card"><div class="label">정책 (자동 추정 · 고칠 수 있음)</div>
        <div class="rec-pol"><span>작업 유형</span>${sel('operation', ['READ','CREATE','UPDATE','DELETE','APPROVE'])}</div>
        <div class="rec-pol"><span>위험도</span>${sel('risk', ['LOW','MEDIUM','HIGH','CRITICAL'])}</div>
        <div class="rec-pol"><span>승인 방식</span>${sel('approval', ['NONE','CONFIRM','HITL','ADMIN_APPROVAL'])}</div>
        <div class="rec-pol ${f.policy.scope ? '' : 'low'}"><span>권한 범위</span>${sel('scope', ['본인 데이터','부서 데이터','회사 전체','관리자 전용'])}</div>
        <div class="rec-pol ${f.policy.sensitivity ? '' : 'low'}"><span>데이터 민감도</span>${sel('sensitivity', ['일반','개인정보','민감정보','재무정보'])}</div></div>
      <div class="card"><div class="label">이음 도구로 등록</div>
        ${f.steps.length === 1 ? '<button class="btn primary" data-act="recRegister" data-m="single">도구로 등록</button>'
          : `<small>${f.steps.length}단계 업무라 지금은 도구 하나로 등록할 수 없습니다. 여러 단계 도구는 다음 작업에서 지원합니다.</small><br>
             <button class="btn sm" data-act="recRegister" data-m="steps" ${f.steps.length ? '' : 'disabled'}>단계를 낱개 도구로 등록</button>`}</div>
      <small class="mute">확정하면 화면 캡처를 지웁니다. 이후 근거는 가린 화면 글자로 보여 줍니다.</small>
    </aside></div>`;
}

async function recAria(rid, seq) {
  try {
    const d = await api.get(`/recorder/recordings/${rid}/spans/${seq}/`);
    openModal(`행동 ${seq} 화면 글자`, `<div class="label">직전 — ${esc(d.pre.title || d.pre.url || '')}</div><pre class="rec-aria">${esc(d.pre.aria || '')}</pre>
      <div class="label">직후 — ${esc(d.post.title || d.post.url || '')}</div><pre class="rec-aria">${esc(d.post.aria || '')}</pre>`, null, null, { wide:true, cancel:'닫기' });
  } catch (e) { toast(e.message, 'warn'); }
}

/* 화면 중계 */
const recWs = {
  sock:null,
  open(id, token) {
    this.close();
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ieum/recorder/ws/${id}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url); this.sock = ws;
    ws.onmessage = ev => recOnMsg(JSON.parse(ev.data));
    ws.onclose = () => { if (this.sock === ws && REC.live && REC.live.status === 'recording') { REC.live.msg = '연결이 끊겼습니다. 기록은 서버에서 계속됩니다. 다시 연결하는 중…'; recPatch(); setTimeout(() => REC.live && REC.live.id === id && this.open(id, token), 2000); } };
  },
  send(m) { if (this.sock && this.sock.readyState === 1) this.sock.send(JSON.stringify(m)); },
  close() { if (this.sock) { const s = this.sock; this.sock = null; try { s.close(); } catch (e) {} } },
};

function recOnMsg(m) {
  const L = REC.live; if (!L) return;
  if (m.t === 'frame') { const img = new Image(); img.onload = () => { const cv = $('#recCv'); if (cv) cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); }; img.src = 'data:image/jpeg;base64,' + m.data; return; }
  if (m.t === 'span') L.spans.push(m);
  else if (m.t === 'hold') L.hold = m;
  else if (m.t === 'hold-end') { if (L.hold && L.hold.id === m.id) L.hold = null; if (m.decision === 'timeout') toast('응답이 없어 쓰기 요청을 보내지 않았습니다.', 'warn'); }
  else if (m.t === 'blocked') L.blocked.push(m);
  else if (m.t === 'dialog') L.dialog = m;
  else if (m.t === 'tabs') { L.tabs = m.tabs; L.active = m.active; }
  else if (m.t === 'login' || m.t === 'notice') L.msg = m.msg;
  else if (m.t === 'limit') L.msg = '행동 기록 상한(300개)에 도달했습니다. 기록을 종료해 주세요.';
  else if (m.t === 'status') { L.status = m.status; if (m.status === 'review') recOpenFn(L.id);
    if (m.status === 'failed' || m.status === 'interrupted') L.msg = (m.status === 'failed' ? '분석·검증에 실패했습니다. ' : '기록이 중단되었습니다. ') + (m.error || ''); }
  recPatch();
}

function recPatch() {
  if (S.view !== 'rec' || REC.page !== 'live') return;
  const cv = $('#recCv'); const keep = cv ? cv.toDataURL('image/jpeg', 0.7) : null;
  render(); recBind();
  if (keep) { const img = new Image(); img.onload = () => { const c = $('#recCv'); if (c) c.getContext('2d').drawImage(img, 0, 0); }; img.src = keep; }
}

function recBind() {
  const cv = $('#recCv'), ime = $('#recIme'); if (!cv || !ime) return;
  const box = () => cv.getBoundingClientRect();
  cv.onmousedown = e => { if (REC.live.hold || REC.live.dialog) return; const r = box(); recWs.send({ t:'click', x:e.clientX - r.left, y:e.clientY - r.top, w:r.width, h:r.height }); setTimeout(() => ime.focus(), 0); };
  cv.onwheel = e => { e.preventDefault(); const r = box(); recWs.send({ t:'wheel', x:e.clientX - r.left, y:e.clientY - r.top, w:r.width, h:r.height, dy:e.deltaY }); };
  ime.oncompositionend = e => { if (e.data) recWs.send({ t:'text', data:e.data }); ime.value = ''; };
  ime.oninput = e => { if (!e.isComposing && e.inputType === 'insertText' && e.data) { recWs.send({ t:'text', data:e.data }); ime.value = ''; } };
  ime.onkeydown = e => { if (e.isComposing) return; if (['Enter','Backspace','Tab','Escape','Delete','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(e.key)) { e.preventDefault(); recWs.send({ t:'key', key:e.key }); } };
  ime.focus();
}

async function recOpenFn(rid) {
  try {
    const r = await api.get(`/recorder/recordings/${rid}/`);
    if (!r.functionId) { toast('아직 업무 기능이 만들어지지 않았습니다.', 'info'); return; }
    REC.fn = await api.get(`/recorder/functions/${r.functionId}/`);
    REC.values = {};
    recWs.close(); REC.live = null; REC.page = 'review'; render();
  } catch (e) { toast(e.message, 'warn'); }
}

async function recSaveFn(patch) {
  try { REC.fn = await api.put(`/recorder/functions/${REC.fn.id}/`, patch); render(); } catch (e) { toast(e.message, 'warn'); }
}

const recNewLive = (id, name, env) => ({ id, name, env, status:'recording', spans:[], blocked:[], tabs:[], active:0, hold:null, dialog:null, paused:false, msg:'' });

Object.assign(INP, {
  recF: el => { REC.form[el.dataset.k] = el.value; },
  recVal: el => { REC.values[el.dataset.n] = el.value; },
});
Object.assign(CHG, {
  recEnv: el => { REC.form.env = el.value; },
  recSrc: el => recSaveFn({ inputs:[{ name:el.dataset.n, source:el.value }] }),
  recPol: el => recSaveFn({ policy:{ [el.dataset.k]: el.value || null } }),
  recDesc: el => recSaveFn({ desc:el.value }),
});
Object.assign(ACT, {
  recNew: () => { REC.form = { name:'', base:'', start:'', env:'op', account:'', password:'', readPost:'', owner:WS.user || '' }; REC.page = 'new'; render(); },
  recBack: () => { recWs.close(); REC.page = 'list'; REC.live = null; REC.fn = null; REC.values = {}; recRefresh(); render(); },
  recDemo: () => { Object.assign(REC.form, REC.demo); render(); },
  recStart: async () => {
    REC.busy = true; render();
    try {
      const out = await api.post('/recorder/recordings/', REC.form);
      REC.live = recNewLive(out.id, REC.form.name, REC.form.env);
      REC.page = 'live'; REC.busy = false; render(); recBind(); recWs.open(out.id, out.token);
      try { sessionStorage.setItem('ieum.rec.' + out.id, out.token); } catch (e) {}
    } catch (e) { REC.busy = false; render(); toast(e.message, 'warn'); }
  },
  recOpen: a => { const r = REC.list.find(x => x.id === a.dataset.id); if (!r) return;
    if (r.status === 'recording') { let tok = null; try { tok = sessionStorage.getItem('ieum.rec.' + r.id); } catch (e) {}
      if (!tok) { toast('이 기록은 다른 탭에서 시작되어 이 탭에서는 화면을 열 수 없습니다.', 'info'); return; }
      REC.live = recNewLive(r.id, r.name, r.env); REC.page = 'live'; render(); recBind(); recWs.open(r.id, tok); return; }
    recOpenFn(r.id); },
  recPause: () => { REC.live.paused = !REC.live.paused; recWs.send({ t:'pause', on:REC.live.paused }); recPatch(); },
  recStop: async () => { try { await api.post(`/recorder/recordings/${REC.live.id}/stop/`); REC.live.status = 'analyzing'; REC.live.msg = '기록을 마쳤습니다. 분석하고 다시 실행해 검증하는 중입니다…'; recPatch(); } catch (e) { toast(e.message, 'warn'); } },
  recApprove: a => { if (!REC.live.hold) return; recWs.send({ t:'approve', id:REC.live.hold.id, ok:a.dataset.ok === '1' }); REC.live.hold = null; recPatch(); },
  recDialog: a => { recWs.send({ t:'dialog', ok:a.dataset.ok === '1' }); REC.live.dialog = null; recPatch(); },
  recTab: a => recWs.send({ t:'tab', index:+a.dataset.i }),
  recPromote: a => recSaveFn({ promote:{ method:a.dataset.m, path:a.dataset.p } }),
  recVerify: async () => { try { REC.fn = await api.post(`/recorder/functions/${REC.fn.id}/verify/`, { values:REC.values }); render(); toast('다시 검증했습니다.', 'ok'); } catch (e) { toast(e.message, 'warn'); } },
  recConfirm: async () => { try { REC.fn = await api.post(`/recorder/functions/${REC.fn.id}/confirm/`); render(); toast(REC.fn.policyIncomplete ? '확정했습니다. 권한 범위·민감도가 비어 "정책 미완"으로 표시됩니다.' : '확정했습니다.', 'ok'); } catch (e) { toast(e.message, 'warn'); } },
  recRegister: async a => { try { const out = await api.post(`/recorder/functions/${REC.fn.id}/register/`, { mode:a.dataset.m }); toast(`도구 ${out.tools.length}개를 변환 스튜디오에 등록했습니다.`, 'ok'); } catch (e) { toast(e.message, 'warn'); } },
});
```

- [ ] **Step 4: 스타일 추가** (`console.css` 맨 끝)

```css
/* ── 업무 기록 ─────────────────────────────────────────────────────────── */
.rec-bar{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.rec-hint{color:var(--text-3);font-size:13px}
.rec-list td small{display:block;color:var(--text-3);font-size:12px}
.pill.rec-ok{background:#ecfdf3;color:#067647;border:1px solid #abefc6}
.pill.rec-warn{background:#fffaeb;color:#b54708;border:1px solid #fedf89}
.pill.rec-danger{background:#fef3f2;color:#b42318;border:1px solid #fecdca}
.pill.rec-info{background:var(--primary-bg);color:var(--primary-strong);border:1px solid var(--primary-line)}
.pill.rec-mute{background:var(--sub);color:var(--text-3);border:1px solid var(--line-2)}
.rec-form{max-width:640px;display:flex;flex-direction:column;gap:12px;padding:18px}
.rec-form .two{display:flex;gap:8px}.rec-form .two .inp{flex:1}
.rec-env{display:flex;flex-direction:column;gap:4px;font-size:14px}
.rec-actions{display:flex;gap:8px;justify-content:flex-end}
.rec-live{display:flex;flex-direction:column;gap:8px}
.rec-top{display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid var(--line-2);border-radius:4px;background:var(--surface)}
.rec-top .dot{width:10px;height:10px;border-radius:50%;background:#d92d20}
.rec-top .env{border:1px solid var(--line-2);border-radius:10px;padding:0 8px;font-size:12px}
.rec-top.op .env{background:#fef3f2;color:#b42318;border-color:#fecdca}
.rec-top .sp{flex:1}
.rec-tabs{display:flex;gap:4px}
.rec-msg{padding:8px 12px;border:1px solid #fedf89;background:#fffaeb;border-radius:4px;font-size:13px;margin-bottom:6px}
.rec-body{display:flex;gap:10px;align-items:flex-start}
.rec-screen{position:relative;flex:3;min-width:0}
.rec-screen canvas{width:100%;height:auto;aspect-ratio:1280/800;border:1px solid var(--line-2);background:#fff;cursor:pointer;display:block}
#recIme{position:absolute;left:0;top:0;width:1px;height:1px;opacity:0}
.rec-hold{position:absolute;left:50%;top:30%;transform:translateX(-50%);width:min(440px,90%);background:#fff;border:2px solid #dc6803;border-radius:6px;padding:14px;box-shadow:0 8px 24px #0003}
.rec-side{flex:1.1;min-width:220px;border:1px solid var(--line-2);border-radius:4px;padding:8px;max-height:640px;overflow:auto;background:var(--surface)}
.rec-tl{list-style:none;margin:6px 0;padding:0;font-size:12.5px}
.rec-tl li{padding:4px 0;border-bottom:1px solid var(--line)}
.rec-tl li div{color:var(--text-2);font-family:var(--mono,monospace);font-size:11.5px}
.rec-tl li div.w{color:#b54708}.rec-tl li.b{color:#b42318;font-size:11.5px}
.rec-count{color:var(--text-3);font-size:12px}
.rec-rv-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.rec-rv{display:grid;grid-template-columns:2fr 1fr;gap:14px}
.rec-rv tr.low,.rec-pol.low{background:#fffaeb}
.rec-rv td small{display:block;color:var(--text-3)}
.rec-desc{width:100%;margin-bottom:10px}
.rec-steps{display:flex;align-items:stretch;gap:6px;flex-wrap:wrap;margin:6px 0 12px}
.rec-step{flex:1;min-width:220px;border:1px solid var(--primary-line);border-radius:6px;padding:8px;font-size:13px}
.rec-arrow{align-self:center;font-size:18px;color:var(--text-3)}
.rec-shots{display:flex;gap:4px;margin-top:6px}.rec-shot{width:50%;border:1px solid var(--line-2)}
.rec-excl{font-size:13px;padding-left:16px}
.rec-runs{list-style:none;padding:0;margin:6px 0;font-size:13px}.rec-runs small{color:var(--text-3);margin-left:6px}
.rec-pol{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:3px 4px;font-size:13px}
.rec-aria{max-height:260px;overflow:auto;background:var(--sub);padding:8px;font-size:12px;white-space:pre-wrap}
@media (max-width:1100px){.rec-body{flex-direction:column}.rec-side{width:100%}.rec-rv{grid-template-columns:1fr}}
```

- [ ] **Step 5: 문법·전역·금지 API 점검**

```bash
node --check apps/web/ieum/js/menu/recorder.js
grep -n -E "window\.(confirm|alert|prompt)|[^.a-zA-Z](confirm|alert|prompt)\(" apps/web/ieum/js/menu/recorder.js || echo "금지 API 없음"
grep -rhoE "^(const|let|function) [A-Za-z_]+" apps/web/ieum/js | sort | uniq -d
```
Expected: 문법 오류 없음, "금지 API 없음", 마지막 명령 출력 없음(중복 전역 없음)

- [ ] **Step 6: 실제 화면 확인**

`lsof -ti tcp:8000 -sTCP:LISTEN | xargs kill 2>/dev/null; cd apps/backend && .venv/bin/uvicorn app.main:app --port 8000` 후 `http://127.0.0.1:8000/ieum/` → **업무 기록** → **새 기록** → **시연용 값 채우기** → **기록 시작**.
- 화면 영상이 뜨고 클릭이 들어간다. 타임라인에 행동과 요청이 쌓인다.
- 발주 현황 → 조회 → 첫 행 → **기록 종료** → 검토 화면에 `s1 /poList.do → s2 /poDetail.do`, 설명 초안, 검증 두 줄.
- 발주 등록 **저장**은 승인 창이 뜨고, "보내지 않기"면 발주가 생기지 않는다.
- 확정하면 캡처 자리가 "화면 글자 보기" 버튼으로 바뀌고, 누르면 가린 ARIA 텍스트가 보인다.

- [ ] **Step 7: 커밋**

```bash
git add apps/web/ieum/js/menu/recorder.js apps/web/ieum/js/common/state.js apps/web/ieum/js/main.js apps/web/ieum/index.html apps/web/ieum/css/console.css
git commit -m "feat: 이음 콘솔에 업무 기록 메뉴를 더한다 — 목록·시작·기록 중·검토"
```

---

### Task 13: 시연 서버 렌더링 화면, 전 구간 e2e, 문서

**Files:**
- Modify: `apps/backend/app/ieum/demo_legacy/site.py` (`make_router` 안), `apps/backend/app/ieum/demo_legacy/pages.py`
- Create: `apps/backend/tests/test_ieum_recorder_e2e.py`
- Modify: `CLAUDE.md`

**Interfaces:**
- Produces (시연 사이트, **메뉴에 넣지 않는다**):
  - `GET /demo-legacy/po/vendSearchView.do` — 검색 폼. 숨은 `_csrf` 토큰을 화면을 열 때마다 새로 만든다
  - `POST /demo-legacy/po/vendSearch.do` — `_csrf`가 맞으면 거래처 표 HTML(`<th>거래처코드|거래처명|대표전화</th>`, 코드 칸에 `vendDetail.do?vendCd=` 링크). 틀리면 403 HTML
  - `GET /demo-legacy/po/vendDetail.do?vendCd=` — `<th>/<td>` 짝의 상세 HTML(거래처명, 사업자번호, 담당자, 휴대전화)

- [ ] **Step 1: 시연 화면 추가**

`pages.py` 끝에:

```python
def vend_search_page(env: str, token: str, rows=None, name: str = "") -> str:
    """서버가 결과 표까지 그려 주는 화면(JSP 방식). 업무 기록의 HTML 표 변환을 시연하려고 둔다. 메뉴에는 없다."""
    form = ('<h2>거래처 검색</h2><form method="post" action="vendSearch.do"><input type="hidden" name="_csrf" value="%s">'
            '거래처명 <input name="vendNm" id="vendNm" value="%s"> <button type="submit" id="btnSsrSearch">검색</button></form>'
            % (html.escape(token, quote=True), html.escape(name, quote=True)))
    table = ""
    if rows is not None:
        trs = "".join('<tr><td><a href="vendDetail.do?vendCd=%s">%s</a></td><td>%s</td><td>%s</td></tr>'
                      % (html.escape(r["VEND_CD"]), html.escape(r["VEND_CD"]), html.escape(r["VEND_NM"]), html.escape(r["TEL"])) for r in rows)
        table = '<table class="list" id="vendResult"><tr><th>거래처코드</th><th>거래처명</th><th>대표전화</th></tr>%s</table>' % trs
    return layout(env, "거래처 검색", form + table, "", "vendListView.do")


def vend_detail_page(env: str, vend_cd: str) -> str:
    v = data.VENDOR_BY_CD.get(vend_cd)
    if not v:
        return layout(env, "거래처 상세", '<p class="err">거래처를 찾을 수 없습니다.</p>', "", "vendListView.do")
    body = ('<h2>거래처 상세</h2><table class="form" id="vendInfo"><tr><th>거래처명</th><td>%s</td><th>사업자번호</th><td>%s</td></tr>'
            '<tr><th>담당자</th><td>%s</td><th>휴대전화</th><td>%s</td></tr></table>' % tuple(html.escape(x) for x in (v[1], v[2], v[4], v[5])))
    return layout(env, "거래처 상세", body, "", "vendListView.do")


def error_page(env: str, message: str) -> str:
    return layout(env, "오류", '<p class="err">%s</p>' % html.escape(message), "", "")
```

`site.py`의 `make_router`에서 `sessions = {}` 아래에 `csrf = {}  # type: Dict[str, str]  # JSESSIONID -> 거래처 검색 화면의 토큰`을 두고, `reset()`에 `csrf.clear()`를 더하고, `page("statView.do", ...)` 줄 아래에 넣는다:

```python
    # ------------------------------------------------------------ 서버 렌더링 화면 (메뉴 밖, 업무 기록 시연용)
    def _new_csrf(request: Request) -> str:
        tok = secrets.token_hex(8)
        csrf[request.cookies.get("JSESSIONID", "")] = tok
        return tok

    page("vendSearchView.do", lambda request: pages.vend_search_page(env, _new_csrf(request)))
    page("vendDetail.do", lambda request: pages.vend_detail_page(env, request.query_params.get("vendCd", "")))

    @router.post("/vendSearch.do", include_in_schema=False)
    async def vend_search(request: Request) -> Response:
        if not logged_in(request):
            return redirect("login.do")
        p = await _params(request)
        if not p.get("_csrf") or p.get("_csrf") != csrf.get(request.cookies.get("JSESSIONID", "")):
            return HTMLResponse(pages.error_page(env, "잘못된 요청입니다. 화면을 다시 열어 주세요."), status_code=403, media_type=HTML_TYPE)
        rows = data.search_vendors(p.get("vendNm", ""))
        return HTMLResponse(pages.vend_search_page(env, _new_csrf(request), rows, p.get("vendNm", "")), media_type=HTML_TYPE)
```

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_demo_legacy.py tests/test_ieum_discovery_e2e.py -q -p no:cacheprovider`
Expected: 모두 통과(메뉴와 기존 화면은 그대로다)

- [ ] **Step 2: e2e 시험 작성**

```python
# apps/backend/tests/test_ieum_recorder_e2e.py
"""업무 기록 전 구간: 시연용 레거시 사이트에서 사람 대신 WebSocket 으로 클릭·입력을 보낸다.

- XHR 읽기 업무(조회 → 상세)가 2단계 업무 기능과 poNo 연결이 되고 검증된다
- 서버 렌더링 업무(폼 검색 → 상세)가 HTML 표 단계 2개, 표에서 꺼낸 값 연결, 숨은 토큰 → 브라우저 실행으로 정리되고 검증된다
- 운영 쓰기는 승인 없이는 시연 사이트에 닿지 않는다
- 한글 IME 입력이 깨지지 않는다
"""
import asyncio
import json
import os
import threading
import time

import httpx
import pytest
from websockets.sync.client import connect

from app.ieum.discovery.browser import capabilities
from app.ieum.demo_legacy.site import DEMO_PASSWORD, DEMO_USER_ID

pytestmark = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"], reason="브라우저가 없다")


class Driver:
    """사람 역할. 화면 요소 위치를 세션 페이지에서 읽어 그 좌표를 WebSocket 으로 클릭한다."""

    def __init__(self, base, owner="시험"):
        self.base = base
        r = httpx.post(base + "/api/ieum/recorder/recordings/", json={
            "name": "업무", "owner": owner, "base": base + "/demo-legacy/po", "start": "/login.do", "env": "op",
            "account": DEMO_USER_ID, "password": DEMO_PASSWORD}, timeout=90).json()["resultData"]
        self.rid = r["id"]
        self.ws = connect(base.replace("http", "ws") + f"/api/ieum/recorder/ws/{self.rid}?token={r['token']}", max_size=None)
        self.msgs = []
        threading.Thread(target=self._pump, daemon=True).start()
        self.wait(lambda m: m["t"] == "frame")

    def _pump(self):
        try:
            while True:
                self.msgs.append(json.loads(self.ws.recv()))
        except Exception:
            pass

    def wait(self, pred, timeout=30):
        end = time.time() + timeout
        while time.time() < end:
            for m in list(self.msgs):
                if pred(m):
                    return m
            time.sleep(0.1)
        raise AssertionError("기다린 메시지가 오지 않았다")

    @property
    def session(self):
        from app.ieum.recorder.manager import MANAGER
        return MANAGER.get(self.rid)

    def run(self, coro):
        from app.ieum.recorder.manager import MANAGER
        return asyncio.run_coroutine_threadsafe(coro, MANAGER.loop).result(30)

    def click(self, sel):
        from app.ieum.recorder import relay
        b = self.run(self.session.page.locator(sel).first.bounding_box())
        self.ws.send(json.dumps({"t": "click", "x": b["x"] + b["width"] / 2, "y": b["y"] + b["height"] / 2, "w": relay.VIEW_W, "h": relay.VIEW_H}))
        time.sleep(1.2)

    def text(self, s):
        self.ws.send(json.dumps({"t": "text", "data": s}))
        time.sleep(0.3)

    def key(self, k):
        self.ws.send(json.dumps({"t": "key", "key": k}))
        time.sleep(0.2)

    def cookies(self):
        async def get():
            return {c["name"]: c["value"] for c in await self.session.ctx.cookies()}
        return self.run(get())

    def stop_and_wait(self):
        httpx.post(self.base + f"/api/ieum/recorder/recordings/{self.rid}/stop/", timeout=60)
        end = time.time() + 120
        while time.time() < end:
            rec = httpx.get(self.base + f"/api/ieum/recorder/recordings/{self.rid}/").json()["resultData"]
            if rec["status"] in ("review", "failed"):
                return rec
            time.sleep(0.5)
        raise AssertionError("분석·검증이 끝나지 않았다")

    def function(self, rec):
        return httpx.get(self.base + f"/api/ieum/recorder/functions/{rec['functionId']}/").json()["resultData"]


def test_XHR_읽기_업무가_두_단계_업무_기능이_되고_검증된다(ieum_server):
    d = Driver(ieum_server)
    d.click("text=발주 현황")
    d.click("#btnSearch")
    d.click("tr[onclick] >> nth=0")
    rec = d.stop_and_wait()
    assert rec["status"] == "review", rec.get("error")
    bf = d.function(rec)
    assert [s["path"] for s in bf["steps"]] == ["/poList.do", "/poDetail.do"]
    po = next(p for p in bf["steps"][1]["params"] if p["a"] == "poNo")
    assert po["from"].startswith("s1.") and po["source"] == "PREVIOUS_STEP_OUTPUT"
    assert bf["verification"]["runs"][0]["ok"] is True and bf["desc"]


def test_서버_렌더링_업무가_HTML_표_단계와_브라우저_실행으로_검증된다(ieum_server):
    from app.ieum.recorder import store
    d = Driver(ieum_server)
    d.run(d.session.page.goto(ieum_server + "/demo-legacy/po/vendSearchView.do"))
    d.click("#vendNm")
    d.text("한빛")
    d.click("#btnSsrSearch")
    d.click("#vendResult a >> nth=0")
    rec = d.stop_and_wait()
    assert rec["status"] == "review", rec.get("error")
    bf = d.function(rec)
    s1, s2 = bf["steps"]
    assert (s1["method"], s1["path"], s1["kind"], s1["exec"]) == ("POST", "/vendSearch.do", "html", "browser")
    assert (s2["path"], s2["kind"]) == ("/vendDetail.do", "html")
    v = next(p for p in s2["params"] if p["a"] == "vendCd")
    assert v["source"] == "PREVIOUS_STEP_OUTPUT"
    assert bf["verification"]["runs"][0]["ok"] is True and bf["executionMode"] == "browser"
    aria = " ".join(s["post"]["aria"] for s in store.read_spans(rec["id"]))
    assert "010-4821-5678" not in aria                               # 상세 화면의 휴대전화는 가려서 저장했다


def test_운영_쓰기는_거절하면_닿지_않고_승인하면_닿는다(ieum_server):
    d = Driver(ieum_server)
    d.click("text=발주 등록")
    d.click("#btnVend")
    d.click("a.vendPick >> nth=0")
    d.click("button.pick >> nth=0")
    d.click("#btnSave")
    hold = d.wait(lambda m: m["t"] == "hold")
    assert hold["path"].endswith("/poSave.do")
    d.ws.send(json.dumps({"t": "approve", "id": hold["id"], "ok": False}))
    d.wait(lambda m: m["t"] == "hold-end" and m["decision"] == "deny")
    q = dict(params={"fromDt": "20261001", "toDt": "20261031"}, headers={"X-Requested-With": "XMLHttpRequest"}, timeout=10)
    assert httpx.get(ieum_server + "/demo-legacy/po/poList.do", cookies=d.cookies(), **q).json()["totalCnt"] == 0
    d.msgs.clear()
    d.click("#btnSave")
    hold = d.wait(lambda m: m["t"] == "hold")
    d.ws.send(json.dumps({"t": "approve", "id": hold["id"], "ok": True}))
    d.wait(lambda m: m["t"] == "hold-end" and m["decision"] == "approve")
    time.sleep(1.0)
    assert httpx.get(ieum_server + "/demo-legacy/po/poList.do", cookies=d.cookies(), **q).json()["totalCnt"] == 1


def test_한글_입력이_깨지지_않는다(ieum_server):
    d = Driver(ieum_server)
    d.click("text=발주 등록")
    d.click("#vendNm")
    for _ in range(4):
        d.key("Backspace")
    d.text("한빛")
    assert d.run(d.session.page.input_value("#vendNm")) == "한빛"
```

- [ ] **Step 3: 실행**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_e2e.py -v`
Expected: 4개 PASS (각 20~60초)

실패하면 볼 곳:
- 단계가 기대와 다르면 `store.read_spans(rid)`의 `post.aria`에 응답 값(마스킹된 값)이 있는지 본다. ARIA와 응답이 같은 마스킹기를 거쳤는지 확인한다.
- 서버 렌더링 시험에서 `s1.exec`가 `http`면 `pre.hidden`에 `_csrf`가 있는지 본다(`trace._HIDDEN_JS`).
- 검증이 `auth_expired`면 `service.finish`의 `finally`(브라우저 닫기)가 검증 뒤에 있는지 확인한다.

- [ ] **Step 4: 전체 시험**

Run: `cd apps/backend && .venv/bin/pytest tests/ -q -p no:cacheprovider`
Expected: 모두 통과

- [ ] **Step 5: `CLAUDE.md` 갱신**

"**이음의 배포는 별도 프로세스다**" 문단 바로 뒤에 넣는다.

```markdown
**업무 기록은 이음 안의 별도 메뉴다** (`app/ieum/recorder/`, 화면 `apps/web/ieum/js/menu/recorder.js`, 설계
`docs/superpowers/specs/2026-10-10-ieum-web-recorder-design.md`). 사람이 콘솔 안에서 서버 브라우저를 조작해 업무 하나를
기록하면 행동 묶음(행동 + 직전/직후 ARIA + 네트워크)을 기록별 파일(`data/ieum/recorder/<id>/spans.jsonl`)에 덧붙이고(`trace.py`),
끝나면 규칙 기반으로 업무 기능(단계·값 연결·입력값 출처·정책)을 만들고(`analyze.py`), 다시 실행해 검증한다(`replay.py`).
화면은 CDP 스트리밍을 WebSocket(`/api/ieum/recorder/ws/{id}?token=`)으로 구독자마다 최신 프레임만 보낸다(`relay.py`).
무엇을 눌렀는지는 영상이 아니라 페이지 안 기록 스크립트(`trace.INIT_JS`)로 안다. 서버가 그려 주는 레거시 화면은 HTML 안의
표를 JSON 사본으로 바꿔(`htmltable.py`) JSON 응답처럼 다룬다 — 그래서 레코더는 크롤러와 달리 화면 이동(document) 응답도 기록한다.
**쓰기 판단은 버튼 글자가 아니라 나가는 요청으로 한다**(`guard.py`). 운영 쓰기는 어느 출처로 가든 붙잡아 승인받고, 자동 탐색과
달리 **가짜 응답을 만들지 않는다**. 로그인 판정은 비밀번호 계열 필드로만 한다(`token` 으로 판정하면 `csrfToken` 저장을 로그인으로 오인한다).
대상 밖 이동은 막지 않고, 서버 자신·클라우드 메타데이터·브라우저 내부 주소만 항상 막는다(`scope.py`, 전제: 중계에 주소창 없음).
ARIA·응답·요청 값은 마스킹해서 저장하고, 입력 원값은 세션 메모리(`trace.raw`)에만 둔다. 스크린샷은 확정하면 지운다.
Playwright 는 uvicorn 이벤트 루프에 살므로(`manager.MANAGER.loop`) **루프를 막는 동기 작업은 `asyncio.to_thread` 로 넘긴다.**
여러 단계를 도구 하나로 실행하는 것은 아직 없다 — 지금은 단계가 하나인 업무만 도구 하나가 된다.
```

"밟으면 아픈 것들"에:

```markdown
- **레코더 시험은 서버의 이벤트 루프에서 세션을 만진다.** Playwright 비동기 객체는 만든 루프에 묶여서, 시험 코드에서 `await s.page...`
  를 그냥 부르면 멈춘다. `asyncio.run_coroutine_threadsafe(coro, MANAGER.loop)` 로 넣는다(`test_ieum_recorder_e2e.py`).
- **레코더 WebSocket 은 시작 응답의 토큰이 있어야 열린다.** 콘솔에 사용자 로그인이 없어 남의 기록 화면을 막는 장치가 이것뿐이다.
  토큰은 탭의 `sessionStorage` 에만 있으므로 다른 탭에서는 기록 중 화면을 다시 열 수 없다(의도된 동작).
- **시연 사이트의 서버 렌더링 화면(`vendSearchView.do` 등)은 메뉴에 없다.** 메뉴에 넣으면 `test_ieum_demo_legacy.py` 의 메뉴 HTML 비교와
  자동 탐색 e2e 의 API 목록이 바뀐다. 업무 기록 시험은 주소로 직접 연다.
```

- [ ] **Step 6: 커밋**

```bash
git add apps/backend/app/ieum/demo_legacy/site.py apps/backend/app/ieum/demo_legacy/pages.py apps/backend/tests/test_ieum_recorder_e2e.py CLAUDE.md
git commit -m "test: 업무 기록 전 구간 시험(서버 렌더링 화면 포함)과 CLAUDE.md 갱신"
```

---

## 자체 점검 결과

**스펙(2판) 대응**

| 스펙 절 | 작업 |
|---|---|
| 확정한 결정: 동시 상한(서버·사람당, 환경변수) | 2(config), 7(manager), 12(목록 표시) |
| 확정한 결정: 스크린샷 보관 | 2(retention), 11(확정 시 삭제), 8(시작·하루 한 번 정리), 12(텍스트 보기) |
| 확정한 결정: 서버 렌더링 HTML | 5(htmltable), 6(document 응답·사본), 9(HTML 값 연결·숨은 토큰), 10(HTML 구조 비교·브라우저 실행), 13(시연 화면·e2e) |
| 확정한 결정: 이동 범위 | 3(scope·가드), 10(Replay 도 차단 주소로 보내지 않음) |
| 1절 구조·공용 판정 함수·uvicorn 루프·루프 막지 않기 | 1, 7, 8, 11 (`to_thread`) |
| 2절 항상 차단 | 3 |
| 3절 데이터 모델·저장 위치 | 2, 6, 9 |
| 4절 서버 렌더링 화면 | 5, 6, 9, 10, 13 |
| 5절 개인정보 | 6(ARIA 마스킹·원값 지도), 10(원값 복원·needs_value), 11(스크린샷 삭제), 12(검증용 값은 저장 안 함) |
| 6절 분석(구분 파라미터·설명 초안·날짜 모양 고정값 포함) | 9 |
| 7절 Replay(단계별 출처·인코딩·브라우저 실행·실패 코드) | 10 |
| 8절 쓰기 처리(어느 출처든, 로그인 판정) | 3 |
| 9절 화면 | 12 |
| 10절 오류 처리 | 3(시간 초과·차단), 4(최신 프레임), 7(상한·브라우저 끊김·유휴·자동 로그인 실패·세션 만료·대화상자·새 창·업로드 안내), 2(재시작), 6(크기 상한·마스킹 실패), 9(핵심 없음·표 없는 HTML 안내), 12(연결 끊김) |
| 11절 배포 | 13(CLAUDE.md). 리버스 프록시 설정은 배포 문서 작업으로 남김 |
| 12절 시험 계획 | 1~13 |

**스펙과 다르게 정한 것**: 없음. 1판 계획에서 정했던 두 가지(공용 판정 함수, uvicorn 루프)는 2판에서 스펙으로 올렸다.

**타입·이름 일관성 점검**: `Guard.decided_requests`(3) ↔ `Trace.on_response`(6), `Trace.raw`(6) ↔ `replay.verify`의 `session.trace.raw`(10), `store.read_spans`(2) ↔ `analyze.analyze(rec, spans)`(9)·`service.finish`(11), `MANAGER.on_stopped`(7) ↔ `service.finish(rid, session)`(11), 단계의 `base`·`exec`·`formPage`·`kind`·`recordedData`(9) ↔ `replay`(10)·`service._register`(11), `vault_key`(7) ↔ `credentials.get(f"rec:{rid}")`(10, 11)을 맞췄다.
