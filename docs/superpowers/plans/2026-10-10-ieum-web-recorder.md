# 이음 웹 레코더 MVP 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사람이 이음 콘솔 안에서 서버 브라우저를 조작해 업무 하나를 기록하면, 그 기록을 검증된 업무 기능(여러 API의 순서·값 연결·입력값 출처·정책)으로 만든다.

**Architecture:** 이음 백엔드에 `app/ieum/recorder/` 패키지를 더한다. 기록 세션마다 비동기 Playwright로 화면 없는 Chromium을 띄우고, CDP 화면 스트리밍과 입력 역중계를 WebSocket으로 콘솔에 잇는다. 가드가 쓰기 요청을 붙잡아 승인받고, 행동마다 ActionSpan(행동 + 직전/직후 ARIA 스냅샷 + 네트워크)을 JSON 스토어에 쌓는다. 기록이 끝나면 규칙 기반 분석기가 업무 기능을 만들고, Replay가 같은 값·다른 값으로 다시 실행해 검증한다.

**Tech Stack:** Python 3.10.11, FastAPI 0.115.6(WebSocket 포함), Playwright 1.49.1 비동기 API, httpx, 이음 `JsonStore`/금고, 이음 콘솔(바닐라 JS classic script, 빌드 없음), pytest, `websockets` 16(시험용 동기 클라이언트).

**Spec:** `docs/superpowers/specs/2026-10-10-ieum-web-recorder-design.md`

## Global Constraints

- Python 3.10.11. 3.11+ 문법 금지(`X | Y` 타입 표기, `except*`, `tomllib` 등). 타입은 `typing.Optional`, `List`, `Dict`.
- Docker·pnpm·uv를 쓰지 않는다. 새 프런트엔드 의존성을 들이지 않는다.
- 주석·UI 문구·커밋 메시지는 한국어. 변수·함수 이름은 영어.
- `window.confirm`·`alert`·`prompt`를 쓰지 않는다. 확인 창은 화면 안 요소로 만든다.
- 콘솔 JS는 classic script다. 새 전역 이름은 만들기 전에 `grep -rn "<이름>" apps/web/ieum/js`로 충돌을 확인한다. 이 계획의 전역 이름은 모두 `rec`/`REC` 접두사를 쓴다.
- 이음 상태 파일의 읽고-고쳐-쓰기 구간은 `with store.LOCK:`으로 감싼다. `LOCK`을 쥔 채 브라우저를 띄우거나 기다리지 않는다.
- 응답 본문 원문은 저장하지 않는다. 마스킹(`discovery.masking.Masker`)한 표본만 저장한다. 마스킹이 실패하면 저장하지 않는다.
- 운영(`env == "op"`)에서 쓰기 요청은 승인 없이 대상 시스템에 보내지 않는다. 승인 대기 2분이 지나면 보내지 않는다. 가짜 응답을 만들지 않는다.
- 자동 탐색(`discovery/crawler.py`)의 쓰기 차단 규칙(가짜 `{}`로 막기)은 바꾸지 않는다.
- 기본값: 동시 기록 세션 4, 입력 없을 때 회수 600초, 기록 최대 1800초, 쓰기 승인 대기 120초, 운영 주소 Replay 요청 간격 0.6초.
- 시험 명령: `cd apps/backend && .venv/bin/pytest <경로> -v`. 브라우저 시험은 `IEUM_SKIP_BROWSER_TESTS=1`이거나 브라우저가 없으면 건너뛴다.
- 전체 시험은 각 작업의 마지막에 `cd apps/backend && .venv/bin/pytest tests/ -q -p no:cacheprovider`로 확인한다. 시작 기준은 527개 통과다.

## 스펙과 다르게 정한 점 (계획에서 구체화)

1. **공용 캡처는 "판정 함수"만 떼어 낸다.** 스펙은 크롤러의 네트워크 구역을 `capture.py`로 옮긴다고 했다. 그러나 크롤러는 동기 Playwright, 레코더는 비동기 Playwright라 `route.continue_()`·`response.text()` 같은 호출 방식이 다르다. 그래서 Playwright를 직접 부르지 않는 판정 로직(쓰기 여부, 기록할 응답 여부, 보존 헤더, 표본 상한, 로그인 레시피)만 `capture.py`로 옮기고, 각자 자기 방식으로 Playwright를 부른다.
2. **Playwright 비동기 루프는 uvicorn 이벤트 루프를 그대로 쓴다.** 스펙은 "콘솔 프로세스 안 전용 스레드"라고 했다. WebSocket과 CDP가 모두 같은 루프에 있으면 스레드 사이 중계가 없어져 더 단순하다. 콘솔 프로세스 안이라는 점, 기록 세션마다 Chromium을 따로 띄운다는 점은 같다. 분석처럼 CPU를 쓰는 일은 `asyncio.to_thread`로 넘긴다.
3. **동시 기록 상한을 넘으면 대기열 대신 거절한다.** 스펙은 "대기, 자리가 나면 알림"이었다. 대기열은 사용자가 탭을 열어 둔 채 기다려야 의미가 있어 MVP에서는 409와 "진행 중인 기록이 끝나면 다시 시작해 주세요" 안내로 대신한다.

## Review Focus

1. **쓰기 승인 창을 띄운 채 사용자가 탭을 닫거나 네트워크가 끊김** → 120초 뒤 그 요청은 보내지 않고, 브라우저 세션은 계속 쓸 수 있어야 한다. (작업 3 `test_승인_응답이_없으면_시간_초과로_보내지_않는다`)
2. **기록 중 콘솔 서버가 재시작됨** → 진행 중이던 기록은 `interrupted`가 되고, 그때까지 저장한 행동 묶음은 남아 분석할 수 있어야 한다. (작업 2 `test_재시작하면_진행_중이던_기록은_중단됨이_된다`)
3. **같은 값이 앞 단계 응답 여러 곳에 있어 값 연결이 모호함** → 하나를 골라 조용히 확정하지 않고 확신도 `low`로 검토 화면에 묻는다. (작업 8 `test_같은_값이_두_곳에_있으면_확신도를_낮춘다`)
4. **응답이 JSON이 아님 (HTML 조각, XML, 빈 본문)** → 분석과 Replay가 예외 없이 진행하고, 구조 비교는 건너뛴다. (작업 8 `test_JSON_이_아닌_응답도_분석이_멈추지_않는다`, 작업 9 `test_JSON_이_아닌_응답은_구조_비교를_건너뛴다`)
5. **쓰기 요청 본문에 `csrfToken` 같은 토큰 필드가 들어 있음** → 로그인 요청으로 오인해 승인 없이 보내면 안 된다. 비밀번호 계열 필드가 있을 때만 로그인으로 본다. (작업 3 `test_토큰_필드가_든_저장은_로그인으로_오인하지_않는다`)

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `apps/backend/app/ieum/discovery/capture.py` (새) | 크롤러·레코더 공용 판정: 쓰기 여부, 기록할 응답, 보존 헤더, 표본 상한, 이벤트 중복 억제, 로그인 레시피 |
| `apps/backend/app/ieum/discovery/crawler.py` (수정) | 판정을 `capture`에서 가져다 쓴다. 동작은 바꾸지 않는다 |
| `apps/backend/app/ieum/discovery/browser.py` (수정) | 비동기 브라우저 실행 `launch_async` 추가 |
| `apps/backend/app/ieum/recorder/__init__.py` (새) | 패키지 표시 |
| `apps/backend/app/ieum/recorder/store.py` (새) | 기록·업무 기능 JSON 저장, 스크린샷 폴더, 재시작 시 중단 처리 |
| `apps/backend/app/ieum/recorder/guard.py` (새) | 쓰기 요청 붙잡기·승인·거절·시간 초과, 로그인 요청 통과, 승인 이력 |
| `apps/backend/app/ieum/recorder/relay.py` (새) | 좌표 환산, CDP 마우스·휠·키·한글 입력, 화면 스트리밍 시작 |
| `apps/backend/app/ieum/recorder/trace.py` (새) | ActionSpan 열기·닫기, ARIA 스냅샷·스크린샷, 네트워크 첨부, 저장 |
| `apps/backend/app/ieum/recorder/login.py` (새) | 서비스 계정 자동 로그인, 로그인 레시피 만들기 |
| `apps/backend/app/ieum/recorder/session.py` (새) | 기록 세션 하나: 브라우저·가드·트레이스·중계·탭·대화상자·WebSocket 구독자 |
| `apps/backend/app/ieum/recorder/manager.py` (새) | 세션 생성·조회·상한·유휴 회수·Playwright 수명 |
| `apps/backend/app/ieum/recorder/analyze.py` (새) | 기록 → 업무 기능 (순수 함수) |
| `apps/backend/app/ieum/recorder/replay.py` (새) | 업무 기능 재실행·판정·실행 방식 판별 |
| `apps/backend/app/ieum/recorder/service.py` (새) | 종료 후 분석→검증 흐름, 업무 기능 수정·확정·단건 도구 등록 |
| `apps/backend/app/ieum/routers/recorder.py` (새) | REST + WebSocket |
| `apps/backend/app/ieum/routers/__init__.py` (수정) | `recorder` 라우터 등록 |
| `apps/backend/app/ieum/data/recorder/recordings.json`, `functions.json` (새) | 시드 `{}` |
| `apps/web/ieum/js/menu/recorder.js` (새) | 업무 기록 메뉴 4화면 |
| `apps/web/ieum/js/common/state.js`, `js/main.js`, `index.html`, `css/console.css` (수정) | 메뉴 등록·스크립트·스타일 |
| `apps/backend/tests/test_ieum_capture.py` 외 (새) | 작업별 시험 |
| `CLAUDE.md` (수정) | 레코더 구조와 밟으면 아픈 것 |

---

### Task 1: 공용 캡처 판정 분리

크롤러의 네트워크 판정을 Playwright 호출 없는 함수로 떼어 낸다. 크롤러 동작은 그대로여야 하므로 **기존 시험이 하나도 바뀌지 않고 통과**하는 것이 이 작업의 합격선이다.

**Files:**
- Create: `apps/backend/app/ieum/discovery/capture.py`
- Modify: `apps/backend/app/ieum/discovery/crawler.py` (상수 정의 26~34행, `_build_recipe` 503~515행, 네트워크 구역 517~640행)
- Test: `apps/backend/tests/test_ieum_capture.py`

**Interfaces:**
- Produces:
  - `capture.STATIC_TYPES: set`, `capture.FILE_TYPES: tuple`, `capture.MAX_BODY = 40_000`, `capture.MAX_SAMPLES = 10`, `capture.DUP_EVENTS = 3`
  - `capture.is_write(url: str, method: str, rtype: str, policy: Policy) -> bool`
  - `capture.response_kind(rtype: str, url: str, status: int, headers: dict) -> Optional[Tuple[bool, str]]` — 기록할 응답이면 `(파일 여부, content-type)`, 아니면 `None`
  - `capture.keep_headers(headers: Optional[dict]) -> Dict[str, str]`
  - `capture.SampleCounter().room(key: str) -> bool`
  - `capture.EventDedup().allow(key: str) -> bool`
  - `capture.parse_form(body: Optional[str], ctype: str) -> Dict[str, str]`
  - `capture.build_recipe(login_req: Optional[dict], login_page: str, user: str, pw: str) -> Tuple[str, Optional[dict]]` — `(로그인 경로, 레시피)`. 레시피 형식은 크롤러와 같다: `{loginUrl, action, method, json, userField, passField, extra}`
  - `capture.recipe_rel(policy: Policy, recipe: dict) -> dict` — `session_auth`가 읽는 `{userField, passField, extra, json, loginRel, actionRel}`로 바꾼다
- `crawler.STATIC_TYPES`, `crawler.FILE_TYPES`, `crawler.MAX_SAMPLES`, `crawler.DUP_EVENTS`, `crawler.MAX_BODY`는 `capture`에서 다시 내보내 기존 import(`tests/test_ieum_discovery_crawler.py`의 `MAX_SAMPLES`)가 그대로 동작한다.

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


def test_기록할_응답만_고른다():
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
    assert [d.allow("cap GET /a") for _ in range(capture.DUP_EVENTS + 1)] == [True] * capture.DUP_EVENTS + [False]


def test_로그인_요청에서_필드_이름을_알아낸다():
    req = {"url": "http://10.0.0.1:8080/po/loginProc.do", "method": "POST", "post": "returnUrl=main.do&userId=svc&userPw=pw1", "ctype": "application/x-www-form-urlencoded"}
    path, recipe = capture.build_recipe(req, "http://10.0.0.1:8080/po/login.do", "svc", "pw1")
    assert path == "/po/loginProc.do"
    assert recipe["userField"] == "userId" and recipe["passField"] == "userPw" and recipe["extra"] == {"returnUrl": "main.do"}
    rel = capture.recipe_rel(P, recipe)
    assert rel["loginRel"] == "/login.do" and rel["actionRel"] == "/loginProc.do"
```

- [ ] **Step 2: 시험이 실패하는지 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_capture.py -v`
Expected: FAIL — `ImportError: cannot import name 'capture'`

- [ ] **Step 3: `capture.py` 작성**

`crawler.py` 26~34행의 상수, `_parse_form`(120~131행), `_build_recipe`(503~515행), `_keep_headers`(576~585행), `_on_response`의 판정 부분(592~600행)을 옮긴다. `jobs._recipe`의 경로 변환(`jobs.py:418-419`)과 같은 일을 `recipe_rel`로 만든다.

```python
# apps/backend/app/ieum/discovery/capture.py
"""자동 탐색(크롤러)과 업무 기록(레코더)이 함께 쓰는 네트워크 판정.

Playwright 객체를 직접 부르지 않는다. 크롤러는 동기, 레코더는 비동기 Playwright 를 써서 route.continue_() 나
response.text() 를 부르는 방식이 다르기 때문이다. 판정은 여기서 하고, 호출은 각자 한다.
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


def response_kind(rtype: str, url: str, status: int, headers: Optional[dict]) -> Optional[Tuple[bool, str]]:
    """기록할 응답이면 (파일 여부, content-type), 아니면 None. 리다이렉트와 화면 이동(파일이 아닌 document)은 뺀다."""
    if rtype in STATIC_TYPES or is_asset(url) or 300 <= status < 400:
        return None
    headers = headers or {}
    ctype = headers.get("content-type", "")
    is_file = "attachment" in headers.get("content-disposition", "").lower() or any(t in ctype.lower() for t in FILE_TYPES)
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
1. 26~34행의 `STATIC_TYPES`, `FILE_TYPES`, `MAX_BODY`, `DUP_EVENTS`, `MAX_SAMPLES` 정의를 지우고 아래로 바꾼다(다른 상수 `VIEWPORT`, `MAX_ACTIONS`, `MAX_SKIP_EVENTS`, `OBSERVE_MS`는 그대로 둔다).

```python
from app.ieum.discovery import capture
from app.ieum.discovery.capture import DUP_EVENTS, FILE_TYPES, MAX_BODY, MAX_SAMPLES, STATIC_TYPES  # noqa: F401 (다시 내보냄)
```

2. `_parse_form` 함수(120~131행)를 지우고, 쓰는 곳이 없으면 그대로 둔다(`capture.parse_form`으로 옮겨짐).
3. `__init__`의 `self._dups: Dict[str, int] = {}`를 `self._dups = capture.EventDedup()`로, `self._samples: Dict[str, int] = {}`를 `self._samples = capture.SampleCounter()`로 바꾼다.
4. `_build_recipe`(503~515행) 본문을 아래로 바꾼다.

```python
    def _build_recipe(self, login_page: str, user: str, pw: str) -> None:
        """로그인 요청에서 필드 이름을 알아낸다. 도구를 실행할 때 같은 방식으로 로그인하려는 것이다."""
        path, recipe = capture.build_recipe(self._login_req, login_page, user, pw)
        if path:
            self.res.login_path = path
        if recipe:
            self.res.recipe = recipe
```

5. `_route_inner`(532~569행)의 첫 두 판정(534~542행)을 아래 세 줄로 바꾼다. 나머지(로그인, 조회용 POST, 차단)는 그대로 둔다.

```python
        url, method, rtype = request.url, request.method.upper(), request.resource_type
        if not capture.is_write(url, method, rtype, self.policy):
            route.continue_()
            return
```

6. `_room`(571~574행) 본문을 `return self._samples.room(key)`로, `_keep_headers`(576~585행) 본문을 `return capture.keep_headers(headers)`로 바꾼다.
7. `_on_response`(587~602행)의 592~600행을 아래로 바꾼다.

```python
            kind = capture.response_kind(req.resource_type, response.url, response.status, response.headers)
            if kind is None:
                return
            is_file, ctype = kind
            self._pending.append((response, req, is_file, ctype))
```

8. `_record_event`(635~640행)의 중복 판정을 아래로 바꾼다.

```python
    def _record_event(self, tag: str, method: str, url: str, code: Optional[int], ms: Optional[int] = None) -> None:
        if not self._dups.allow(f"{tag} {method} {urlsplit(url).path}"):
            return
        self._emit("web", "req", m=method, p=self.policy.display(url), code=code, tag=tag, ms=ms)
```

9. 파일 맨 위 import에서 더 이상 쓰지 않는 `is_secret_key`, `is_asset`, `risky_call`이 있으면 지운다(`policy` import의 `SESSION_KILL`, `Policy`는 남긴다). `python -m pyflakes`가 없으면 `grep -n "is_secret_key\|is_asset\|risky_call" app/ieum/discovery/crawler.py`로 남은 사용처를 확인한다.

- [ ] **Step 5: 새 시험과 기존 시험이 모두 통과하는지 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_capture.py -v && .venv/bin/pytest tests/ -q -p no:cacheprovider`
Expected: `test_ieum_capture.py` 7개 PASS, 전체 534개(527 + 7) 통과. 기존 시험 파일은 하나도 고치지 않는다.

- [ ] **Step 6: 커밋**

```bash
git add apps/backend/app/ieum/discovery/capture.py apps/backend/app/ieum/discovery/crawler.py apps/backend/tests/test_ieum_capture.py
git commit -m "refactor: 크롤러의 네트워크 판정을 공용 capture 모듈로 뗀다"
```

---

### Task 2: 레코더 저장소

**Files:**
- Create: `apps/backend/app/ieum/recorder/__init__.py`, `apps/backend/app/ieum/recorder/store.py`
- Create: `apps/backend/app/ieum/data/recorder/recordings.json`, `apps/backend/app/ieum/data/recorder/functions.json` (내용 `{}`)
- Test: `apps/backend/tests/test_ieum_recorder_store.py`

**Interfaces:**
- Produces:
  - `store.new_recording(name: str, owner: str, base: str, start: str, env: str, login_mode: str, read_post: str) -> dict` — 스펙 2절의 Recording 모양, `status="recording"`, `spans=[]`, `approvals=[]`, `functionId=None`, `error=None`, `id="rec_<8자>"`
  - `store.save_recording(rec: dict) -> None`, `store.get_recording(rid: str) -> dict` (없으면 `KeyError`), `store.list_recordings() -> List[dict]` (요약: `spans` 대신 `spanCount`, 최신순)
  - `store.update_recording(rid: str, fn: Callable[[dict], None]) -> dict` — LOCK 안에서 읽고 `fn(rec)`로 고치고 저장한 뒤 돌려준다
  - `store.save_function(bf: dict) -> None`, `store.get_function(fid: str) -> dict`, `store.list_functions() -> List[dict]`
  - `store.delete_recording(rid: str) -> None` — 기록, 연결된 업무 기능, 스크린샷 폴더를 지운다
  - `store.shots_dir(rid: str) -> Path` — `state_dir()/recorder/<rid>`
  - `store.mark_interrupted() -> int` — `recording`/`analyzing`/`verifying` 상태를 `interrupted`로 바꾸고 바꾼 수를 돌려준다
  - `store.ACTIVE = ("recording", "analyzing", "verifying")`

- [ ] **Step 1: 시드 파일과 실패하는 시험 작성**

```bash
mkdir -p apps/backend/app/ieum/data/recorder
printf '{}\n' > apps/backend/app/ieum/data/recorder/recordings.json
printf '{}\n' > apps/backend/app/ieum/data/recorder/functions.json
git check-ignore -v apps/backend/app/ieum/data/recorder/recordings.json   # "!apps/backend/app/ieum/data/**/*.json" 규칙이 보여야 한다(무시 아님)
```

```python
# apps/backend/tests/test_ieum_recorder_store.py
"""레코더 저장소: 기록과 업무 기능을 JSON 스토어에 쌓는다."""
import pytest

from app.ieum.recorder import store


@pytest.fixture
def rec(ieum_state):
    r = store.new_recording("9월 발주 상세 조회", "홍길동", "http://h/po", "/login.do", "op", "auto", "")
    store.save_recording(r)
    return r


def test_기록을_만들고_읽는다(rec):
    got = store.get_recording(rec["id"])
    assert got["name"] == "9월 발주 상세 조회" and got["status"] == "recording" and got["spans"] == []
    assert rec["id"].startswith("rec_") and got["env"] == "op" and got["login"]["mode"] == "auto"


def test_행동_묶음을_덧붙이면_목록에는_개수만_보인다(rec):
    store.update_recording(rec["id"], lambda r: r["spans"].append({"seq": 1}))
    summary = next(x for x in store.list_recordings() if x["id"] == rec["id"])
    assert summary["spanCount"] == 1 and "spans" not in summary


def test_없는_기록은_KeyError(ieum_state):
    with pytest.raises(KeyError):
        store.get_recording("rec_none")


def test_재시작하면_진행_중이던_기록은_중단됨이_된다(rec):
    store.update_recording(rec["id"], lambda r: r["spans"].append({"seq": 1}))
    assert store.mark_interrupted() == 1
    got = store.get_recording(rec["id"])
    assert got["status"] == "interrupted" and len(got["spans"]) == 1   # 저장된 행동 묶음은 남는다


def test_기록을_지우면_업무_기능과_스크린샷도_지운다(rec):
    store.save_function({"id": "bf_x", "source": {"recordingId": rec["id"]}, "name": "x"})
    store.update_recording(rec["id"], lambda r: r.update(functionId="bf_x"))
    d = store.shots_dir(rec["id"]); d.mkdir(parents=True); (d / "1-pre.jpg").write_bytes(b"x")
    store.delete_recording(rec["id"])
    with pytest.raises(KeyError):
        store.get_function("bf_x")
    assert not d.exists()
```

- [ ] **Step 2: 시험이 실패하는지 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_store.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.ieum.recorder'`

- [ ] **Step 3: 구현**

```python
# apps/backend/app/ieum/recorder/__init__.py
"""업무 기록: 사람이 서버 브라우저를 조작해 업무 하나를 기록하고, 검증된 업무 기능으로 만든다."""
```

```python
# apps/backend/app/ieum/recorder/store.py
"""기록과 업무 기능 저장. 모든 데이터는 이음 JSON 스토어에 둔다(SQLite 를 쓰지 않는다).

기록 하나가 행동 묶음을 계속 덧붙이므로, 읽고-고쳐-쓰기는 반드시 update_recording 을 거친다. 배포한 MCP 서버처럼
다른 프로세스가 같은 파일을 쓰지는 않지만, 기록 세션 여럿이 동시에 쓴다.
"""
import shutil
import time
import uuid
from pathlib import Path
from typing import Callable, List

from app.ieum.config import state_dir
from app.ieum.store import LOCK, JsonStore

RECORDINGS = JsonStore("recorder", "recordings")
FUNCTIONS = JsonStore("recorder", "functions")
ACTIVE = ("recording", "analyzing", "verifying")


def new_recording(name: str, owner: str, base: str, start: str, env: str, login_mode: str, read_post: str) -> dict:
    return {"id": "rec_" + uuid.uuid4().hex[:8], "name": name, "owner": owner, "sourceBase": base.rstrip("/"), "start": start or "",
            "env": env, "readPost": read_post or "", "login": {"mode": login_mode, "recipe": None, "path": ""},
            "status": "recording", "startedAt": time.time(), "endedAt": None, "spans": [], "approvals": [],
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


def _summary(rec: dict) -> dict:
    out = {k: v for k, v in rec.items() if k != "spans"}
    out["spanCount"] = len(rec.get("spans") or [])
    return out


def list_recordings() -> List[dict]:
    return sorted((_summary(r) for r in RECORDINGS.load().values()), key=lambda r: r["startedAt"], reverse=True)


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
    shutil.rmtree(shots_dir(rid), ignore_errors=True)


def shots_dir(rid: str) -> Path:
    return state_dir() / "recorder" / rid


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

- [ ] **Step 4: 시험 통과 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_store.py -v`
Expected: 5개 PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/app/ieum/recorder apps/backend/app/ieum/data/recorder apps/backend/tests/test_ieum_recorder_store.py
git commit -m "feat: 업무 기록 저장소를 더한다"
```

---

### Task 3: 쓰기 가드

운영에서 쓰기 요청을 붙잡아 승인받는다. 판단 기준은 나가는 요청이다(버튼 글자가 아니다). 로그인 요청은 통과시키고 레시피를 만들 수 있게 붙잡아 둔다.

**Files:**
- Create: `apps/backend/app/ieum/recorder/guard.py`
- Test: `apps/backend/tests/test_ieum_recorder_guard.py`

**Interfaces:**
- Consumes: `capture.is_write`, `capture.parse_form`, `masking.is_secret_key`, `Policy.same_origin`, `Policy.is_read_post`, `Policy.display`
- Produces:
  - `Guard(policy: Policy, env: str, notify: Callable[[dict], Awaitable[None]], timeout: float = 120.0)`
  - `await guard.route(route, request)` — Playwright `BrowserContext.route` 처리기
  - `guard.decide(hold_id: str, ok: bool) -> bool` — 대기 중인 요청에 답한다. 없으면 `False`
  - `await guard.ask(method: str, url: str, label: str) -> bool` — Replay가 쓰기 단계 전에 같은 승인 창을 띄울 때 쓴다(운영이 아니면 바로 `True`)
  - `guard.holding -> bool` — 대기 중인 요청이 하나라도 있으면 `True`(이때 화면 입력을 막는다)
  - `guard.label: str` — 승인 창에 보여줄 마지막 행동 설명(트레이스가 넣는다)
  - `guard.login_req: Optional[dict]` — 마지막 로그인 요청 `{url, method, post, ctype, page}`
  - `guard.decisions: List[dict]` — `{id, method, url, label, decision: "approve"|"deny"|"timeout"|"staging", at}`
  - `guard.decided_requests: Dict[int, str]` — `id(request)` → 결정. 트레이스가 응답을 받을 때 `held` 표시에 쓴다
  - 알림 메시지: `{"t": "hold", "id", "method", "path", "label"}`, `{"t": "hold-end", "id", "decision"}`

- [ ] **Step 1: 실패하는 시험 작성**

```python
# apps/backend/tests/test_ieum_recorder_guard.py
"""쓰기 가드: 운영 쓰기는 붙잡아 승인받는다. Playwright 없이 가짜 route/request 로 시험한다."""
import asyncio

from app.ieum.discovery.policy import Policy
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
    return asyncio.get_event_loop_policy().new_event_loop().run_until_complete(coro)


def make(env="op", timeout=5.0):
    sent = []

    async def notify(msg):
        sent.append(msg)
    return Guard(P, env, notify, timeout=timeout), sent


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


def test_조회용_POST_와_이름이_쓰기_같은_GET():
    async def go():
        g, sent = make(timeout=0.05)
        r1, r2 = Route(), Route()
        await g.route(r1, Req("http://h:8080/po/searchPost.do", "POST"))
        await g.route(r2, Req("http://h:8080/po/poDelete.do?id=1", "GET"))
        return r1.done, r2.done
    assert run(go()) == ("continue", "abort")   # 위험한 이름의 GET 도 운영에서는 승인 대상이다(여기서는 응답 없음 → 시간 초과)


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
Expected: FAIL — `ModuleNotFoundError: No module named 'app.ieum.recorder.guard'`

- [ ] **Step 3: 구현**

```python
# apps/backend/app/ieum/recorder/guard.py
"""쓰기 가드: 운영에서 쓰기 요청은 붙잡아 사람에게 묻는다.

판단은 버튼 글자가 아니라 나가는 요청으로 한다. 2026-10-09 실험에서 글자로 판단하자 "승인대기" 행 클릭이 금지어
"승인"에 걸렸다. 글자(label)는 승인 창에 "무엇을 하려는지" 보여주는 설명으로만 쓴다.

자동 탐색과 달리 가짜 응답을 만들지 않는다. 가짜 {} 를 받은 화면과 에이전트는 다음 단계에 필요한 값(생성 번호)이
없어 헤맨다(실험에서 토큰 4배). 거절한 요청은 버린다.
"""
import asyncio
import re
import time
import uuid
from typing import Awaitable, Callable, Dict, List, Optional
from urllib.parse import urlsplit

from app.ieum.discovery import capture
from app.ieum.discovery.policy import Policy

# 로그인 요청 판정에 쓰는 낱말. masking.is_secret_key 는 token·cookie 도 비밀로 보므로 쓰지 않는다 —
# csrfToken 필드가 든 저장 요청을 로그인으로 오인해 승인 없이 보내면 안 된다.
_PW_WORDS = frozenset("pw pwd pass passwd password".split())
_WORD = re.compile(r"[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+")


def _is_password_field(name: str) -> bool:
    return any(w.lower() in _PW_WORDS for w in _WORD.findall(str(name)))


class Guard:
    def __init__(self, policy: Policy, env: str, notify: Callable[[dict], Awaitable[None]], timeout: float = 120.0):
        self.policy, self.env, self.notify, self.timeout = policy, env, notify, timeout
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
        """같은 출처로 가는, 비밀번호 필드가 든 요청. 자동 로그인이든 사람이 직접 하든 같다."""
        if not self.policy.same_origin(request.url):
            return False
        try:
            fields = capture.parse_form(request.post_data, (request.headers or {}).get("content-type", ""))
        except Exception:
            return False
        return any(_is_password_field(k) for k in fields)

    async def _route(self, route, request) -> None:
        url, method, rtype = request.url, request.method.upper(), request.resource_type
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
            self._decide_log(method, url, "staging")
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
            self._decide_log(method, url, "staging")
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
        self._decide_log(method, url, decision, hid, label)
        await self.notify({"t": "hold-end", "id": hid, "decision": decision})
        return decision

    def decide(self, hold_id: str, ok: bool) -> bool:
        fut = self._holds.get(hold_id)
        if fut is None or fut.done():
            return False
        fut.set_result(bool(ok))
        return True

    def _decide_log(self, method: str, url: str, decision: str, hid: str = "", label: str = "") -> None:
        self.decisions.append({"id": hid, "method": method, "url": self.policy.display(url), "path": urlsplit(url).path,
                               "label": label or self.label, "decision": decision, "at": time.time()})
```

- [ ] **Step 4: 시험 통과 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_guard.py -v`
Expected: 9개 PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/app/ieum/recorder/guard.py apps/backend/tests/test_ieum_recorder_guard.py
git commit -m "feat: 업무 기록의 쓰기 가드 — 운영 쓰기는 붙잡아 승인받는다"
```

---

### Task 4: 비동기 브라우저 실행과 화면 중계 입력

**Files:**
- Modify: `apps/backend/app/ieum/discovery/browser.py` (`launch` 아래에 `launch_async` 추가)
- Create: `apps/backend/app/ieum/recorder/relay.py`
- Test: `apps/backend/tests/test_ieum_recorder_relay.py`

**Interfaces:**
- Produces:
  - `await browser.launch_async(pw) -> Tuple[Browser, str]` — 번들 Chromium → Chrome → Edge. 실패하면 `BrowserUnavailable`
  - `relay.VIEW_W = 1280`, `relay.VIEW_H = 800`
  - `relay.to_page(x: float, y: float, w: float, h: float) -> Tuple[float, float]` — 화면에 줄여 보인 좌표를 브라우저 좌표로
  - `await relay.click(cdp, x, y)`, `await relay.wheel(cdp, x, y, dy)`, `await relay.insert_text(cdp, text)`, `await relay.key(cdp, name)`
  - `relay.KEYS: Dict[str, Tuple[int, str]]` — `Enter`, `Backspace`, `Tab`, `Escape`, `ArrowUp/Down/Left/Right`, `Delete`, `Home`, `End`
  - `await relay.start_screencast(cdp, on_frame: Callable[[str], Awaitable[None]])` — `on_frame(base64 jpeg)`, 프레임마다 ACK
  - `await relay.stop_screencast(cdp)`

- [ ] **Step 1: 실패하는 시험 작성**

좌표 환산과 키 표는 순수 시험, 입력은 실제 브라우저로 시험한다(실험에서 쓴 방식).

```python
# apps/backend/tests/test_ieum_recorder_relay.py
"""화면 중계 입력: 좌표 환산은 순수 시험, 클릭·한글 입력은 실제 화면 없는 브라우저로 시험한다."""
import asyncio
import os

import pytest

from app.ieum.discovery.browser import capabilities
from app.ieum.recorder import relay

browser_needed = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"], reason="브라우저가 없다")


def test_줄여_보인_좌표를_브라우저_좌표로_바꾼다():
    assert relay.to_page(480, 300, 960, 600) == (640.0, 400.0)
    assert relay.to_page(0, 0, 960, 600) == (0.0, 0.0)


def test_화면_밖_좌표는_가장자리로_자른다():
    assert relay.to_page(2000, -5, 960, 600) == (relay.VIEW_W - 1, 0.0)


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

            async def on_frame(data):
                frames.append(len(data))
            await relay.start_screencast(cdp, on_frame)
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

- [ ] **Step 3: `launch_async` 추가**

`browser.py`의 `launch` 함수 바로 아래에 넣는다.

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
"""
from typing import Awaitable, Callable, Dict, Tuple

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


async def start_screencast(cdp, on_frame: Callable[[str], Awaitable[None]]) -> None:
    async def handle(p):
        try:
            await cdp.send("Page.screencastFrameAck", {"sessionId": p["sessionId"]})
        except Exception:
            return
        await on_frame(p["data"])
    cdp.on("Page.screencastFrame", handle)
    await cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 60, "maxWidth": VIEW_W, "maxHeight": VIEW_H})


async def stop_screencast(cdp) -> None:
    try:
        await cdp.send("Page.stopScreencast")
    except Exception:
        pass
```

- [ ] **Step 5: 시험 통과 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_relay.py -v`
Expected: 3개 PASS (브라우저가 없으면 1개 SKIP)

- [ ] **Step 6: 커밋**

```bash
git add apps/backend/app/ieum/discovery/browser.py apps/backend/app/ieum/recorder/relay.py apps/backend/tests/test_ieum_recorder_relay.py
git commit -m "feat: 업무 기록의 화면 중계 입력과 비동기 브라우저 실행"
```

---

### Task 5: 행동 묶음 기록 (ActionSpan)

중계가 입력을 넣기 **직전에** `begin()`을 불러 직전 스냅샷을 뜬다. 다음 `begin()` 또는 `finish()`가 이전 묶음을 닫으며 직후 스냅샷을 뜨고 저장한다. 브라우저 안 기록 스크립트가 "실제로 눌린 요소"를 채운다.

**Files:**
- Create: `apps/backend/app/ieum/recorder/trace.py`
- Test: `apps/backend/tests/test_ieum_recorder_trace.py`

**Interfaces:**
- Consumes: `capture.response_kind`, `capture.keep_headers`, `capture.MAX_BODY`, `masking.Masker`, `Policy.display`, `Policy.in_scope`, `store.update_recording`, `store.shots_dir`, `Guard.decided_requests`, `Guard.label`
- Produces:
  - `trace.INIT_JS: str` — `add_init_script`로 모든 프레임에 심는 기록 스크립트. `window.__ieumRec({type, isTrusted, el:{tag,id,name,role,text}, value, page})`를 부른다
  - `Trace(rid: str, policy: Policy, guard: Guard, notify: Callable[[dict], Awaitable[None]], on_closed: Optional[Callable[[object, dict], Awaitable[None]]] = None)` — `on_closed(page, span)`은 묶음을 저장한 뒤 불린다(세션이 "로그인 화면으로 튕겼나"를 볼 때 쓴다)
  - `await trace.begin(page, kind: str) -> Optional[int]` — 이전 묶음을 닫고 새 묶음을 연다. `kind`: `click`|`key`|`navigate`. 일시정지 중이면 `None`
  - `trace.on_dom_event(source, ev: dict) -> None` — `expose_binding` 처리기
  - `async trace.on_response(response) -> None` — `BrowserContext.on("response")` 처리기
  - `trace.on_request(request)`, `trace.on_request_done(request)` — 진행 중 요청 수
  - `await trace.finish(page) -> None` — 마지막 묶음을 닫는다
  - `trace.paused: bool`, `trace.seq: int`
  - `trace.MAX_SPANS = 300`, `trace.ARIA_MAX = 20_000`, `trace.RES_MAX = 4_000`
  - 알림: `{"t": "span", "seq", "action": {...}, "network": [{method, path, status, held, decision}]}`(묶음을 닫을 때), `{"t": "limit"}`
  - 저장되는 네트워크 항목: `{method, url, path, status, ctype, rtype, headers, post, res, file, held, decision, t}` — `url`·`post`·`res`는 마스킹한 값

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

PAGE = """<h1>발주 현황</h1><button id="btnSearch" style="position:absolute;left:10px;top:60px;width:80px;height:30px">조회</button>
<table id="t"></table>
<script>
document.getElementById('btnSearch').onclick = async () => {
  const r = await fetch('/po/poList.do?fromDt=20260901', {headers: {'X-Requested-With': 'XMLHttpRequest'}});
  const d = await r.json();
  document.getElementById('t').innerHTML = d.resultList.map(x => '<tr><td>' + x.PO_NO + '</td></tr>').join('');
};
</script>"""


def test_클릭과_그_요청과_화면_변화를_한_묶음으로_저장한다(ieum_state):
    from playwright.async_api import async_playwright

    from app.ieum.discovery.browser import launch_async

    rec = store.new_recording("t", "홍길동", "http://rec.test/po", "", "op", "manual", "")
    store.save_recording(rec)
    sent = []

    async def notify(msg):
        sent.append(msg)

    async def go():
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
                if route.request.url.endswith("/po/list.html"):
                    await route.fulfill(status=200, content_type="text/html; charset=utf-8", body=PAGE)
                else:
                    await route.fulfill(status=200, content_type="application/json",
                                        body='{"resultList":[{"PO_NO":"PO-2609-0142"},{"PO_NO":"PO-2609-0138"}]}')
            await ctx.route("http://rec.test/**", fake)
            page = await ctx.new_page()
            await page.goto("http://rec.test/po/list.html")
            cdp = await ctx.new_cdp_session(page)
            await tr.begin(page, "click")
            await relay.click(cdp, 50, 75)
            await page.wait_for_timeout(500)
            await tr.finish(page)
            await browser.close()
    asyncio.new_event_loop().run_until_complete(go())

    span = store.get_recording(rec["id"])["spans"][0]
    assert span["action"]["target"]["id"] == "btnSearch" and span["action"]["isTrusted"] is True
    assert span["pre"]["url"].endswith("list.html")
    assert "조회" in span["pre"]["aria"] and "PO-2609-0142" in span["post"]["aria"]
    net = span["network"][0]
    assert net["method"] == "GET" and net["path"] == "/poList.do" and net["status"] == 200 and "PO-2609-0142" in net["res"]
    assert net["headers"].get("x-requested-with") == "XMLHttpRequest"
    assert (store.shots_dir(rec["id"]) / "1-pre.jpg").exists() and (store.shots_dir(rec["id"]) / "1-post.jpg").exists()
    assert any(m["t"] == "span" and m["seq"] == 1 for m in sent)


def test_일시정지_중에는_묶음을_만들지_않는다(ieum_state):
    rec = store.new_recording("t", "", "http://rec.test/po", "", "op", "manual", "")
    store.save_recording(rec)

    async def notify(msg):
        pass
    tr = Trace(rec["id"], Policy(base="http://rec.test/po"), Guard(Policy(base="http://rec.test/po"), "op", notify), notify)
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
모두 이 묶음에 붙는다. 다음 begin() 이나 finish() 가 이 묶음을 닫는데, 네트워크가 잠잠해질 때까지 기다린 뒤 화면(직후
스냅샷)을 뜬다. 분석은 "응답 값이 직후 화면에 나타났는가"로 핵심 요청을 고른다(analyze.py).

무엇을 눌렀는지는 페이지 안 기록 스크립트가 알려 준다(INIT_JS). 영상 좌표로 추측하지 않는다.
응답 원문은 저장하지 않는다. 마스킹한 표본만, 길이를 잘라 저장한다.
"""
import asyncio
import json
import time
from typing import Awaitable, Callable, Optional
from urllib.parse import parse_qsl, urlsplit

from app.ieum.discovery import capture
from app.ieum.discovery.masking import Masker
from app.ieum.discovery.policy import Policy
from app.ieum.recorder import store
from app.ieum.recorder.guard import Guard

MAX_SPANS = 300
ARIA_MAX = 20_000
RES_MAX = 4_000
SETTLE_MAX_MS = 3000
SETTLE_QUIET_MS = 400

INIT_JS = """
(() => {
  if (window.__ieumRecInstalled) return; window.__ieumRecInstalled = true;
  const desc = (el) => el ? ({ tag: el.tagName || '', id: el.id || '', name: (el.getAttribute && (el.getAttribute('name') || '')) || '',
      role: (el.getAttribute && el.getAttribute('role')) || '', text: ((el.innerText || el.value || el.getAttribute && el.getAttribute('aria-label') || '') + '').trim().slice(0, 60) }) : null;
  const pick = (el) => (el && el.closest) ? (el.closest('button,a,input,select,textarea,tr,[onclick],[role]') || el) : el;
  const label = (el) => { try { if (el.labels && el.labels[0]) return el.labels[0].innerText.trim().slice(0, 40); } catch (e) {} return ''; };
  const send = (o) => { try { window.__ieumRec(o); } catch (e) {} };
  document.addEventListener('click', (e) => send({ type: 'click', isTrusted: e.isTrusted, el: desc(pick(e.target)), page: location.pathname }), true);
  document.addEventListener('change', (e) => { const t = e.target; if (!t || t.type === 'password') return;
      send({ type: 'change', isTrusted: e.isTrusted, el: Object.assign(desc(t), { label: label(t) }), value: (t.value + '').slice(0, 200), page: location.pathname }); }, true);
})();
"""


def _post_text(post: Optional[str], ctype: str, masker: Masker) -> Optional[str]:
    if not post:
        return None
    if "json" in (ctype or "").lower():
        try:
            return json.dumps(masker.value(json.loads(post)), ensure_ascii=False)[:RES_MAX]
        except ValueError:
            return masker.text(post)[:RES_MAX]
    return "&".join(f"{k}={v}" for k, v in masker.pairs(parse_qsl(post, keep_blank_values=True)))[:RES_MAX]


def _url_text(url: str, masker: Masker) -> str:
    parts = urlsplit(url)
    q = "&".join(f"{k}={v}" for k, v in masker.pairs(parse_qsl(parts.query, keep_blank_values=True)))
    return parts._replace(query=q).geturl()


class Trace:
    def __init__(self, rid: str, policy: Policy, guard: Guard, notify: Callable[[dict], Awaitable[None]],
                 on_closed: Optional[Callable[[object, dict], Awaitable[None]]] = None):
        self.rid, self.policy, self.guard, self.notify, self.on_closed = rid, policy, guard, notify, on_closed
        self.masker = Masker(pii=True)
        self.paused = False
        self.seq = 0
        self.current: Optional[dict] = None
        self._inflight = 0
        self._limit_sent = False

    # ── 진행 중 요청 ───────────────────────────────────────────────────────
    def on_request(self, request) -> None:
        if request.resource_type in ("xhr", "fetch", "document"):
            self._inflight += 1

    def on_request_done(self, request) -> None:
        if request.resource_type in ("xhr", "fetch", "document"):
            self._inflight = max(0, self._inflight - 1)

    async def _settle(self, page) -> None:
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
    async def _snapshot(self, page, seq: int, when: str) -> dict:
        out = {"url": "", "title": "", "aria": "", "shot": None}
        if page is None:
            return out
        try:
            out["url"] = self.policy.display(page.url)
            out["title"] = await page.title()
        except Exception:
            pass
        try:
            out["aria"] = (await page.locator("body").aria_snapshot(timeout=2000))[:ARIA_MAX]
        except Exception:
            pass
        try:
            d = store.shots_dir(self.rid)
            d.mkdir(parents=True, exist_ok=True)
            name = f"{seq}-{when}.jpg"
            (d / name).write_bytes(await page.screenshot(type="jpeg", quality=50))
            out["shot"] = name
        except Exception:
            pass
        return out

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
        self.current = {"seq": self.seq, "action": {"type": kind, "target": None, "value": None, "isTrusted": None, "t": time.time()},
                        "pre": pre, "network": [], "fills": [], "post": None}
        return self.seq

    async def finish(self, page) -> None:
        await self._close(page)

    async def _close(self, page) -> None:
        span, self.current = self.current, None
        if span is None:
            return
        await self._settle(page)
        span["post"] = await self._snapshot(page, span["seq"], "post")
        store.update_recording(self.rid, lambda r: r["spans"].append(span))
        if self.on_closed is not None:
            try:
                await self.on_closed(page, span)
            except Exception:
                pass
        await self.notify({"t": "span", "seq": span["seq"], "action": span["action"],
                           "network": [{"method": n["method"], "path": n["path"], "status": n["status"], "held": n["held"], "decision": n["decision"]}
                                       for n in span["network"]]})

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
            span["fills"].append({"target": el, "value": self.masker.text(str(ev.get("value") or "")), "isTrusted": ev.get("isTrusted")})

    # ── 응답 ───────────────────────────────────────────────────────────────
    async def on_response(self, response) -> None:
        span = self.current
        if span is None:
            return
        try:
            req = response.request
            kind = capture.response_kind(req.resource_type, response.url, response.status, response.headers)
            if kind is None:
                return
            is_file, ctype = kind
            body = ""
            if not is_file:
                try:
                    body = (await response.text())[:capture.MAX_BODY]
                except Exception:
                    body = ""
            masked = self._mask_body(body)
            if masked is None:                       # 마스킹하지 못하면 저장하지 않는다
                return
            decision = self.guard.decided_requests.get(id(req), "")
            span["network"].append({
                "method": req.method.upper(), "url": _url_text(response.url, self.masker), "path": urlsplit(response.url).path,
                "status": response.status, "ctype": ctype, "rtype": req.resource_type, "headers": capture.keep_headers(req.headers),
                "post": _post_text(req.post_data, (req.headers or {}).get("content-type", ""), self.masker),
                "res": masked, "file": is_file, "held": bool(decision and decision != "staging"), "decision": decision,
                "inScope": self.policy.in_scope(response.url), "t": time.time()})
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
Expected: 2개 PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/app/ieum/recorder/trace.py apps/backend/tests/test_ieum_recorder_trace.py
git commit -m "feat: 업무 기록의 행동 묶음(ActionSpan) 기록"
```

---

### Task 6: 기록 세션과 관리자

**Files:**
- Create: `apps/backend/app/ieum/recorder/login.py`, `apps/backend/app/ieum/recorder/session.py`, `apps/backend/app/ieum/recorder/manager.py`
- Test: `apps/backend/tests/test_ieum_recorder_session.py`

**Interfaces:**
- Consumes: Task 2~5 전부, `credentials.put/get/delete`, `session_auth.discover_recipe`, `capture.build_recipe`, `capture.recipe_rel`
- Produces:
  - `login.auto_login(page, creds: dict) -> bool` (async) — 로그인 화면이면 채우고 제출, 성공 여부
  - `login.recipe_for(guard_login_req: Optional[dict], policy: Policy, creds: Optional[dict]) -> Optional[dict]` (async) — 계정이 있으면 `capture.build_recipe`로, 없으면(직접 로그인) `session_auth.discover_recipe`를 `asyncio.to_thread`로 불러 `session_auth` 형식 레시피를 만든다
  - `RecorderSession(rec: dict, creds: Optional[dict])`
    - 속성: `rid`, `token`, `page`, `ctx`, `guard`, `trace`, `policy`, `last_input`, `started`, `closed`
    - `await start(pw)` — 브라우저·컨텍스트·가드·트레이스·화면 스트리밍·시작 주소 열기·자동 로그인
    - `subscribe(ws)`, `unsubscribe(ws)`, `await broadcast(msg: dict)`
    - `await handle(msg: dict)` — WebSocket 입력: `click{x,y,w,h}`, `text{data}`, `key{key}`, `wheel{x,y,w,h,dy}`, `approve{id,ok}`, `dialog{ok,text}`, `tab{index}`, `pause{on}`
    - `await stop() -> None` — 마지막 묶음을 닫고 `endedAt`·승인 이력·로그인 레시피를 저장. 브라우저는 닫지 않는다(Replay에 쓴다)
    - `await close() -> None` — 브라우저를 닫는다
  - 보내는 메시지: `frame{data}`, `hold`, `hold-end`, `span`, `limit`, `tabs{tabs:[{index,url,title}], active}`, `dialog{type,message}`, `login{state:"needed"|"done"|"failed", msg}`, `notice{msg}`(파일 업로드 미지원 안내), `status{status}`
  - 기록 도중 로그인 화면으로 튕기면 묶음을 닫은 뒤 `login{state:"needed"}`를 보낸다(`Trace(on_closed=...)`)
  - `manager.MANAGER: Manager`
    - `await MANAGER.start(payload: dict) -> dict` — `{id, token}`. 상한 초과면 `RecorderError("...", 409)`
    - `MANAGER.get(rid) -> Optional[RecorderSession]`
    - `await MANAGER.stop(rid) -> None` — 세션 stop 후 `service.finish`를 백그라운드로 돌린다(Task 10에서 연결; 이 작업에서는 `on_stopped` 콜백 자리만 둔다)
    - `await MANAGER.close(rid)`, `await MANAGER.shutdown()`
    - `MANAGER.loop` — 세션이 사는 이벤트 루프(시험이 `run_coroutine_threadsafe`에 쓴다)
    - 상수: `MAX_SESSIONS = 4`, `IDLE_SEC = 600`, `MAX_SEC = 1800`
  - `manager.RecorderError(message: str, code: int = 400)`

- [ ] **Step 1: 실패하는 시험 작성**

시연 사이트(`demo_legacy`)를 진짜 포트로 띄운 서버 안에서 세션을 돌린다. 시험은 같은 프로세스라 `MANAGER.loop`에 코루틴을 넣어 세션을 직접 조작한다.

```python
# apps/backend/tests/test_ieum_recorder_session.py
"""기록 세션: 서비스 계정 자동 로그인, 화면 스트리밍, 입력 처리, 상한, 격리. 시연용 레거시 사이트를 쓴다."""
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
    """이음 라우터를 실은 진짜 서버. 기록 세션은 이 서버의 이벤트 루프에서 산다(Playwright 비동기 객체가 그 루프에 묶인다)."""
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
    """서버의 이벤트 루프에서 코루틴을 돌리고 결과를 기다린다."""
    return asyncio.run_coroutine_threadsafe(coro, LOOP["loop"]).result(timeout)


def start(base, **kw):
    from app.ieum.recorder.manager import MANAGER
    payload = dict(name="9월 발주 조회", owner="홍길동", base=base + "/demo-legacy/po", start="/login.do", env="op",
                   account=DEMO_USER_ID, password=DEMO_PASSWORD)
    payload.update(kw)
    return call(MANAGER.start(payload))


def test_서비스_계정으로_자동_로그인하고_화면을_보낸다(live):
    from app.ieum.recorder.manager import MANAGER
    out = start(live)
    s = MANAGER.get(out["id"])
    frames = []

    class WS:
        async def send_json(self, msg):
            frames.append(msg)
    s.subscribe(WS())
    deadline = time.time() + 15
    while time.time() < deadline and not any(m["t"] == "frame" for m in frames):
        time.sleep(0.2)
    assert any(m["t"] == "frame" for m in frames)
    assert s.page.url.endswith("/main.do")                     # 로그인 화면을 지나 메인으로 왔다
    assert out["token"] and len(out["token"]) >= 16


def test_클릭하면_행동_묶음과_요청이_기록된다(live):
    from app.ieum.recorder import store
    from app.ieum.recorder.manager import MANAGER
    out = start(live)
    s = MANAGER.get(out["id"])
    call(s.page.goto(s.policy.base + "/poListView.do"))
    box = call(s.page.locator("#btnSearch").bounding_box())
    from app.ieum.recorder import relay
    call(s.handle({"t": "click", "x": box["x"] + 5, "y": box["y"] + 5, "w": relay.VIEW_W, "h": relay.VIEW_H}))
    time.sleep(1.0)
    call(s.stop())
    spans = store.get_recording(out["id"])["spans"]
    assert spans[-1]["action"]["target"]["id"] == "btnSearch"
    assert any(n["path"].endswith("/poList.do") for n in spans[-1]["network"])


def test_동시_기록_상한을_넘으면_거절한다(live, monkeypatch):
    from app.ieum.recorder import manager
    monkeypatch.setattr(manager, "MAX_SESSIONS", 1)
    start(live)
    with pytest.raises(manager.RecorderError) as e:
        start(live)
    assert e.value.code == 409


def test_두_세션의_쿠키가_섞이지_않는다(live):
    from app.ieum.recorder.manager import MANAGER
    a = MANAGER.get(start(live)["id"])
    b = MANAGER.get(start(live, account="", password="")["id"])   # 계정 없음 = 직접 로그인 대기
    ca = call(a.ctx.cookies())
    cb = call(b.ctx.cookies())
    assert any(c["name"] == "JSESSIONID" for c in ca) and not any(c["name"] == "JSESSIONID" for c in cb)
    assert b.page.url.endswith("/login.do")
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_session.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.ieum.recorder.manager'`

- [ ] **Step 3: `login.py` 작성**

자동 로그인은 크롤러의 `_login`(crawler.py:461-501)과 같은 순서를 비동기로 한다.

```python
# apps/backend/app/ieum/recorder/login.py
"""기록 세션의 로그인. 서비스 계정이 있으면 자동으로 하고, 안 되면 사람이 중계 화면에서 직접 한다.

레시피(필드 이름)는 둘 다 남긴다. 계정 값을 알면 로그인 요청에서 값으로 필드를 찾고(capture.build_recipe), 사람이 직접
로그인해 값을 모르면 로그인 화면 HTML 에서 필드를 읽는다(session_auth.discover_recipe). 비밀번호 값은 레시피에 넣지 않는다.
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

세션마다 Chromium 을 따로 띄워 쿠키와 기록이 섞이지 않게 한다. 화면은 CDP 스트리밍으로 구독자(WebSocket)에게 보내고,
입력은 relay 로 넣는다. 입력을 넣기 직전에 trace.begin() 을 불러 직전 화면을 뜬다.

쓰기 승인 창이 떠 있는 동안에는 다른 입력을 받지 않는다(승인 창 아래 클릭이 엉뚱한 곳에 들어가지 않게).
대상 사이트의 alert/confirm 은 사용자에게 그대로 묻는다. 자동 탐색처럼 항상 취소하지 않는다.
"""
import asyncio
import secrets
import time
from typing import Optional, Set

from app.ieum.discovery import browser as browser_mod
from app.ieum.discovery.policy import Policy
from app.ieum.recorder import login, relay, store
from app.ieum.recorder.guard import Guard
from app.ieum.recorder.trace import INIT_JS, Trace


class RecorderSession:
    def __init__(self, rec: dict, creds: Optional[dict]):
        self.rid, self.rec, self.creds = rec["id"], rec, creds
        self.token = secrets.token_urlsafe(18)
        self.policy = Policy(base=rec["sourceBase"], read_post=rec.get("readPost", ""))
        self.guard = Guard(self.policy, rec["env"], self.broadcast)
        self.trace = Trace(self.rid, self.policy, self.guard, self.broadcast, on_closed=self._after_span)
        self.subs: Set = set()
        self.started = time.time()
        self.last_input = time.time()
        self.closed = False
        self.browser = self.ctx = self.page = self.cdp = None
        self.pages: list = []
        self._dialog = None

    # ── 구독 ───────────────────────────────────────────────────────────────
    def subscribe(self, ws) -> None:
        self.subs.add(ws)

    def unsubscribe(self, ws) -> None:
        self.subs.discard(ws)

    async def broadcast(self, msg: dict) -> None:
        for ws in list(self.subs):
            try:
                await ws.send_json(msg)
            except Exception:
                self.subs.discard(ws)

    # ── 시작 ───────────────────────────────────────────────────────────────
    async def start(self, pw) -> None:
        self.browser, _ = await browser_mod.launch_async(pw)
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
        # 첫 페이지를 만든 뒤에 건다. 먼저 걸면 첫 페이지도 "새 창"으로 한 번 더 잡힌다
        self.ctx.on("page", lambda p: asyncio.ensure_future(self._on_page(p)))
        start_url = self.policy.base + (self.rec.get("start") or "")
        await page.goto(start_url, wait_until="domcontentloaded", timeout=30_000)
        if await login.on_login_page(page):
            if self.creds and await login.auto_login(page, self.creds):
                await self.broadcast({"t": "login", "state": "done", "msg": "서비스 계정으로 로그인했습니다."})
            else:
                msg = "자동 로그인에 실패했습니다. 화면에서 직접 로그인해 주세요." if self.creds else "화면에서 직접 로그인해 주세요."
                await self.broadcast({"t": "login", "state": "needed", "msg": msg})

    async def _on_page(self, page) -> None:
        if page in self.pages:
            return
        await self._activate(page)

    async def _activate(self, page) -> None:
        if page not in self.pages:
            self.pages.append(page)
            page.on("dialog", lambda d: asyncio.ensure_future(self._on_dialog(d)))
            page.on("filechooser", lambda fc: asyncio.ensure_future(self._on_filechooser(fc)))
            page.on("close", lambda _: asyncio.ensure_future(self._on_close(page)))
        if self.cdp is not None:
            await relay.stop_screencast(self.cdp)
        self.page = page
        self.cdp = await self.ctx.new_cdp_session(page)
        await relay.start_screencast(self.cdp, lambda data: self.broadcast({"t": "frame", "data": data}))
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
        """기록 도중 로그인 화면으로 튕겼으면 알린다. 기록은 이어지고, 사람이 다시 로그인하면 된다(가드가 로그인 요청을 통과시킨다)."""
        if page is not None and span["seq"] > 1 and await login.on_login_page(page):
            await self.broadcast({"t": "login", "state": "needed", "msg": "세션이 끊겼습니다. 화면에서 다시 로그인해 주세요. 기록은 이어집니다."})

    async def _on_filechooser(self, _chooser) -> None:
        await self.broadcast({"t": "notice", "msg": "파일 업로드는 아직 지원하지 않습니다. 업로드가 필요한 업무는 업로드 단계를 빼고 기록해 주세요."})

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
        if self.guard.holding or self.cdp is None:
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
        await self.trace.finish(self.page)
        recipe = await login.recipe_for(self.guard.login_req, self.policy, self.creds)
        login_path = ""
        if self.guard.login_req:
            from urllib.parse import urlsplit
            login_path = urlsplit(self.guard.login_req["url"]).path

        def fin(r):
            r["endedAt"] = time.time()
            r["approvals"] = list(self.guard.decisions)
            r["login"]["recipe"] = recipe
            r["login"]["path"] = login_path
        store.update_recording(self.rid, fin)

    async def close(self) -> None:
        if self.closed:
            return
        self.closed = True
        try:
            if self.cdp is not None:
                await relay.stop_screencast(self.cdp)
            if self.browser is not None:
                await self.browser.close()
        except Exception:
            pass
        await self.broadcast({"t": "status", "status": "closed"})
```

- [ ] **Step 5: `manager.py` 작성**

```python
# apps/backend/app/ieum/recorder/manager.py
"""기록 세션 관리: 만들기, 찾기, 동시 상한, 유휴 회수, Playwright 수명.

Playwright 비동기 객체는 만든 이벤트 루프에 묶인다. 시험처럼 서버(루프)가 바뀌면 이전 것은 쓸 수 없으므로 새로 만든다.
"""
import asyncio
import time
from typing import Awaitable, Callable, Dict, Optional

from app.ieum.gateway import credentials
from app.ieum.recorder import store
from app.ieum.recorder.session import RecorderSession

MAX_SESSIONS = 4
IDLE_SEC = 600
MAX_SEC = 1800


class RecorderError(Exception):
    def __init__(self, message: str, code: int = 400):
        super().__init__(message)
        self.code = code


def vault_key(rid: str) -> str:
    return f"rec:{rid}"


class Manager:
    def __init__(self) -> None:
        self.sessions: Dict[str, RecorderSession] = {}
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self._pw = None
        self._reaper: Optional[asyncio.Task] = None
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

    async def start(self, payload: dict) -> dict:
        name = (payload.get("name") or "").strip()
        base = (payload.get("base") or "").strip().rstrip("/")
        env = payload.get("env") or "op"
        if not name:
            raise RecorderError("업무 이름을 입력해 주세요.")
        if not base.startswith(("http://", "https://")):
            raise RecorderError("대상 시스템 주소는 http:// 또는 https:// 로 시작해야 합니다.")
        if env not in ("op", "stg"):
            raise RecorderError("환경은 운영(op) 또는 스테이징(stg) 이어야 합니다.")
        pw = await self._ensure()
        if len(self.sessions) >= MAX_SESSIONS:
            raise RecorderError(f"동시 기록이 가득 찼습니다({MAX_SESSIONS}개). 진행 중인 기록이 끝나면 다시 시작해 주세요.", 409)
        account, password = payload.get("account") or "", payload.get("password") or ""
        creds = {"username": account, "password": password} if account and password else None
        rec = store.new_recording(name, payload.get("owner") or "", base, payload.get("start") or "", env,
                                  "auto" if creds else "manual", payload.get("readPost") or "")
        store.save_recording(rec)
        if creds:
            credentials.put(vault_key(rec["id"]), {"type": "session", "username": account, "password": password})
        session = RecorderSession(rec, creds)
        self.sessions[rec["id"]] = session
        try:
            await session.start(pw)
        except Exception as exc:
            self.sessions.pop(rec["id"], None)
            await session.close()
            msg = str(exc).splitlines()[0][:300] if str(exc) else type(exc).__name__
            store.update_recording(rec["id"], lambda r: r.update(status="failed", error=msg, endedAt=time.time()))
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
        store.update_recording(rid, lambda r: r.update(status="analyzing"))
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
            for rid, s in list(self.sessions.items()):
                try:
                    if store.get_recording(rid)["status"] != "recording":
                        continue                     # 분석·검증 중인 세션은 service.finish 가 닫는다
                except KeyError:
                    await self.close(rid)
                    continue
                if now - s.last_input > IDLE_SEC:
                    await s.trace.finish(s.page)
                    store.update_recording(rid, lambda r: r.update(status="interrupted", endedAt=now,
                                                                   error="10분 동안 입력이 없어 기록을 멈췄습니다."))
                    await self.close(rid)
                elif now - s.started > MAX_SEC:
                    await self.stop(rid)


MANAGER = Manager()
```

- [ ] **Step 6: 시험 통과 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_session.py -v`
Expected: 4개 PASS

- [ ] **Step 7: 커밋**

```bash
git add apps/backend/app/ieum/recorder/login.py apps/backend/app/ieum/recorder/session.py apps/backend/app/ieum/recorder/manager.py apps/backend/tests/test_ieum_recorder_session.py
git commit -m "feat: 업무 기록 세션과 관리자 — 자동 로그인, 화면 스트리밍, 동시 상한"
```

---

### Task 7: 레코더 라우터와 WebSocket

**Files:**
- Create: `apps/backend/app/ieum/routers/recorder.py`
- Modify: `apps/backend/app/ieum/routers/__init__.py` (import 튜플과 반복에 `recorder` 추가)
- Test: `apps/backend/tests/test_ieum_recorder_api.py`

**Interfaces:**
- Consumes: `MANAGER.start/get/stop/close`, `RecorderError`, `store.*`, `responses.ok/fail`
- Produces (모두 `/api/ieum/recorder` 아래, 응답은 `{resultCode, resultMsg, resultData}`):
  - `GET /` → `{recordings: list_recordings(), functions: list_functions(), limits: {maxSessions, idleSec, maxSec}, demo: {...}|null}`
  - `POST /recordings/` (본문: `name, owner, base, start, env, account, password, readPost`) → 201 `{id, token}`
  - `GET /recordings/{rid}/` → 기록 전체(행동 묶음 포함)
  - `POST /recordings/{rid}/stop/` → `{status}`
  - `DELETE /recordings/{rid}/` → 세션을 닫고 기록·업무 기능·스크린샷·금고 키 삭제
  - `GET /recordings/{rid}/shots/{name}` → JPEG (`name`은 `^\d+-(pre|post)\.jpg$`만)
  - `WS /ws/{rid}?token=...` → 토큰이 다르면 4403으로 닫는다. 받은 JSON은 `session.handle`로, 세션 메시지는 그대로 보낸다
- 라우터 `on_startup=[store.mark_interrupted]`, `on_shutdown=[_shutdown]`(MANAGER.shutdown)

- [ ] **Step 1: 실패하는 시험 작성**

```python
# apps/backend/tests/test_ieum_recorder_api.py
"""레코더 API: 기록 시작·조회·종료·삭제와 WebSocket 접속 토큰."""
import json
import os
import time

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
    code, _ = api(ieum_server, "POST", f"/recordings/{rid}/stop/")
    assert code == 200
    code, _ = api(ieum_server, "DELETE", f"/recordings/{rid}/")
    assert code == 200
    code, msg = api(ieum_server, "GET", f"/recordings/{rid}/")
    assert code == 404


def test_입력값이_틀리면_400(ieum_server):
    code, msg = api(ieum_server, "POST", "/recordings/", {"name": "", "base": "x"})
    assert code == 400 and "업무 이름" in msg


def test_스크린샷_이름은_정해진_형식만(ieum_server):
    code, msg = api(ieum_server, "GET", "/recordings/rec_0000abcd/shots/evil.jpg")
    assert code == 400 and "화면 캡처 이름" in msg
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_api.py -v`
Expected: FAIL — 404 (라우터 없음)로 단언 실패

- [ ] **Step 3: 라우터 작성**

```python
# apps/backend/app/ieum/routers/recorder.py
"""업무 기록 메뉴: 기록 시작·화면 중계(WebSocket)·종료, 업무 기능 검토·확정·등록.

WebSocket 은 기록 세션마다 시작 응답으로 받은 토큰이 있어야 열린다. 콘솔에 사용자 로그인이 아직 없어서, 남의 기록
화면을 열 수 없게 하는 장치가 이 토큰뿐이다.
"""
import re
import secrets
from typing import Optional

from fastapi import APIRouter, Body, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import Response

from app.ieum.gateway import credentials
from app.ieum.recorder import store
from app.ieum.recorder.manager import IDLE_SEC, MANAGER, MAX_SEC, MAX_SESSIONS, RecorderError, vault_key
from app.ieum.responses import fail, ok

SHOT_NAME = re.compile(r"^\d+-(pre|post)\.jpg$")


async def _shutdown() -> None:
    await MANAGER.shutdown()


router = APIRouter(prefix="/api/ieum/recorder", tags=["ieum-recorder"], on_startup=[store.mark_interrupted], on_shutdown=[_shutdown])


def _demo(origin: str) -> Optional[dict]:
    try:
        from app.ieum.demo_legacy.site import DEMO_PASSWORD, DEMO_USER_ID
    except ImportError:
        return None
    return {"name": "9월 발주 상세 조회", "base": origin + "/demo-legacy/po", "start": "/login.do", "account": DEMO_USER_ID,
            "password": DEMO_PASSWORD, "stgBase": origin + "/demo-legacy/po-stg", "owner": "시연 담당자"}


@router.get("/")
def overview(request: Request):
    return ok({"recordings": store.list_recordings(), "functions": store.list_functions(),
               "limits": {"maxSessions": MAX_SESSIONS, "idleSec": IDLE_SEC, "maxSec": MAX_SEC},
               "demo": _demo(str(request.base_url).rstrip("/"))})


@router.post("/recordings/")
async def recording_start(payload: Optional[dict] = Body(None)):
    try:
        return ok(await MANAGER.start(payload or {}), 201)
    except RecorderError as exc:
        return fail(exc.code, str(exc))


@router.get("/recordings/{rid}/")
def recording_get(rid: str):
    try:
        return ok(store.get_recording(rid))
    except KeyError:
        return fail(404, "기록을 찾을 수 없습니다.")


@router.post("/recordings/{rid}/stop/")
async def recording_stop(rid: str):
    try:
        await MANAGER.stop(rid)
    except RecorderError as exc:
        return fail(exc.code, str(exc))
    return ok({"status": store.get_recording(rid)["status"]})


@router.delete("/recordings/{rid}/")
async def recording_delete(rid: str):
    await MANAGER.close(rid)
    try:
        store.delete_recording(rid)
    except KeyError:
        return fail(404, "기록을 찾을 수 없습니다.")
    credentials.delete(vault_key(rid))
    return ok({"deleted": rid})


@router.get("/recordings/{rid}/shots/{name}")
def recording_shot(rid: str, name: str):
    if not SHOT_NAME.match(name) or not re.match(r"^rec_[0-9a-f]{8}$", rid):
        return fail(400, "잘못된 화면 캡처 이름입니다.")
    path = store.shots_dir(rid) / name
    if not path.exists():
        return fail(404, "화면 캡처가 없습니다.")
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

- [ ] **Step 4: 시험 통과 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_api.py -v`
Expected: 3개 PASS

- [ ] **Step 5: 전체 시험 확인 후 커밋**

Run: `cd apps/backend && .venv/bin/pytest tests/ -q -p no:cacheprovider`
Expected: 모두 통과. `app.main`을 띄우는 시험에서 라우터 startup 훅(`mark_interrupted`)이 실패하면 시드 파일 경로(Task 2)를 확인한다.

```bash
git add apps/backend/app/ieum/routers/recorder.py apps/backend/app/ieum/routers/__init__.py apps/backend/tests/test_ieum_recorder_api.py
git commit -m "feat: 업무 기록 API 와 화면 중계 WebSocket"
```

---

### Task 8: 분석 (기록 → 업무 기능)

순수 함수다. 브라우저 없이 미리 만든 기록 딕셔너리로 시험한다.

**Files:**
- Create: `apps/backend/app/ieum/recorder/analyze.py`
- Test: `apps/backend/tests/test_ieum_recorder_analyze.py`

**Interfaces:**
- Consumes: `infer.templatize`, `infer.parse_json`, `infer.detect_code_tables`, `Policy.rel`, `Policy.in_scope`, `policy.risky_call`
- Produces:
  - `analyze.analyze(rec: dict) -> dict` — 스펙 2절 BusinessFunction. 추가 필드: `status: "draft"`, `excluded: [{method, path, role, why}]`, `notes: [str]`
  - `analyze.leaves(data, limit: int = 400) -> List[Tuple[str, Any]]` — JSON 잎 `(경로, 값)`, 경로 형식 `$.a.b[0].c`
  - `analyze.get_path(data, path: str)` — `leaves`의 경로로 값을 꺼낸다(Replay가 쓴다)
  - 입력값 출처 상수: `USER_INPUT`, `PREVIOUS_STEP_OUTPUT`, `SESSION_CONTEXT`, `SYSTEM_CONFIG`, `DERIVED`, `CONSTANT`
  - 단계 파라미터: `{a, loc, from, ex, source, confidence, type, required}` — `loc`은 `query|form|body|header`, `from`은 `input.<이름>`|`<단계>.<출력>`|`session.<이름>`|`config.<이름>`|`const:<값>`
  - 입력: `{name, type, source, ex, screenLabel, confidence, required}`
  - 단계: `{id, role, method, path, params, headers, outputs, write, recordedRes, recordedStatus}` — `recordedRes`는 마스킹된 응답 표본(Replay 구조 비교용)

- [ ] **Step 1: 실패하는 시험 작성**

```python
# apps/backend/tests/test_ieum_recorder_analyze.py
"""분석: 기록 딕셔너리 → 업무 기능. 브라우저 없이 돈다."""
import json

from app.ieum.recorder import analyze

BASE = "http://h:8080/po"


def net(method, path, query="", res=None, post=None, rtype="xhr", status=200, held=False, decision=""):
    return {"method": method, "url": f"{BASE}{path}" + (f"?{query}" if query else ""), "path": "/po" + path, "status": status,
            "ctype": "application/json", "rtype": rtype, "headers": {"x-requested-with": "XMLHttpRequest"}, "post": post,
            "res": json.dumps(res, ensure_ascii=False) if isinstance(res, (dict, list)) else (res or ""), "file": False,
            "held": held, "decision": decision, "inScope": True, "t": 0}


def span(seq, target, network, post_aria="", fills=None, kind="click"):
    return {"seq": seq, "action": {"type": kind, "target": target, "value": None, "isTrusted": True, "t": seq},
            "pre": {"url": "/x", "title": "", "aria": "", "shot": None}, "network": network, "fills": fills or [],
            "post": {"url": "/x", "title": "", "aria": post_aria, "shot": None}}


LIST = {"RSLT": "0000", "totalCnt": 2, "resultList": [{"PO_NO": "PO-2609-0142", "VEND_NM": "한빛상사"}, {"PO_NO": "PO-2609-0138", "VEND_NM": "대한문구"}]}
DETAIL = {"RSLT": "0000", "po": {"PO_NO": "PO-2609-0142", "VEND_NM": "한빛상사", "PO_AMT": "4,850,000"}}
CODES = {"RSLT": "0000", "resultList": [{"CD": "10", "CD_NM": "작성"}, {"CD": "20", "CD_NM": "승인대기"}]}


def rec(spans, env="op", approvals=None):
    return {"id": "rec_00000001", "name": "발주 상세 조회", "owner": "홍길동", "sourceBase": BASE, "env": env, "readPost": "",
            "login": {"mode": "auto", "recipe": {"userField": "userId", "passField": "userPw", "loginRel": "/login.do", "actionRel": "/loginProc.do",
                                                  "extra": {}, "json": False}, "path": "/po/loginProc.do"},
            "spans": spans, "approvals": approvals or []}


READ = rec([
    span(1, {"tag": "A", "text": "발주 현황"}, [net("GET", "/common/codeList.do", "grpCd=PO_STTS", CODES)]),
    span(2, {"tag": "BUTTON", "id": "btnSearch", "text": "조회"},
         [net("GET", "/poList.do", "fromDt=20260901&toDt=20260930&sttsCd=", LIST)],
         post_aria="- table:\n  - row: PO-2609-0142 한빛상사\n  - row: PO-2609-0138 대한문구",
         fills=[{"target": {"id": "fromDt", "label": "발주일"}, "value": "20260901"}, {"target": {"id": "toDt", "label": ""}, "value": "20260930"}]),
    span(3, {"tag": "TR", "text": "PO-2609-0142 한빛상사"}, [net("GET", "/poDetail.do", "poNo=PO-2609-0142", DETAIL)],
         post_aria="- heading: 발주 상세 PO-2609-0142\n- text: 한빛상사 4,850,000"),
])


def test_핵심_단계와_값_연결을_찾는다():
    bf = analyze.analyze(READ)
    assert [(s["method"], s["path"]) for s in bf["steps"]] == [("GET", "/poList.do"), ("GET", "/poDetail.do")]
    s1, s2 = bf["steps"]
    assert s1["outputs"] == {"PO_NO": "$.resultList[0].PO_NO"}
    po = next(p for p in s2["params"] if p["a"] == "poNo")
    assert po["from"] == "s1.PO_NO" and po["source"] == "PREVIOUS_STEP_OUTPUT"
    assert bf["evidence"] == {"s1": [2], "s2": [3]}


def test_사용자가_입력한_값은_USER_INPUT_이고_라벨이_붙는다():
    bf = analyze.analyze(READ)
    inputs = {i["name"]: i for i in bf["inputs"]}
    assert inputs["fromDt"]["source"] == "USER_INPUT" and inputs["fromDt"]["screenLabel"] == "발주일" and inputs["fromDt"]["type"] == "date"
    assert inputs["toDt"]["source"] == "USER_INPUT"
    assert inputs["sttsCd"]["confidence"] == "low"                 # 빈 값으로 보낸 선택 조건 — 사람에게 묻는다


def test_코드성_요청은_단계가_아니라_참조다():
    bf = analyze.analyze(READ)
    assert {"method": "GET", "path": "/common/codeList.do", "role": "code"} in [
        {k: r[k] for k in ("method", "path", "role")} for r in bf["references"]]


def test_출력은_마지막_화면에_보인_필드다():
    bf = analyze.analyze(READ)
    assert bf["output"]["from"] == "s2" and "$.po.VEND_NM" in bf["output"]["fields"] and "$.po.PO_AMT" in bf["output"]["fields"]


def test_읽기만_있으면_READ_LOW_NONE():
    p = analyze.analyze(READ)["policy"]
    assert (p["operation"], p["risk"], p["approval"], p["scope"], p["sensitivity"]) == ("READ", "LOW", "NONE", None, None)


def test_승인한_쓰기가_있으면_CREATE_이고_쓰기_단계가_핵심이다():
    r = rec([span(1, {"tag": "BUTTON", "id": "btnSave", "text": "저장"},
                  [net("POST", "/poSave.do", "", {"RSLT": "0000", "PO_NO": "PO-2610-0001"}, post="vendCd=V0012&itemCd=P-10023&qty=10",
                       held=True, decision="approve")],
                  post_aria="- text: 발주를 등록했습니다. 발주번호 PO-2610-0001",
                  fills=[{"target": {"id": "qty", "label": "수량"}, "value": "10"}])],
            approvals=[{"path": "/po/poSave.do", "decision": "approve", "label": "저장"}])
    bf = analyze.analyze(r)
    assert bf["steps"][0]["write"] is True and bf["steps"][0]["role"] == "core"
    assert (bf["policy"]["operation"], bf["policy"]["risk"], bf["policy"]["approval"]) == ("CREATE", "MEDIUM", "CONFIRM")


def test_행동_없는_요청은_잡음이다():
    r = rec(READ["spans"] + [span(4, None, [net("GET", "/chart/monthly.do", "yyyy=2026", {"resultList": [1, 2]})], kind="click")])
    bf = analyze.analyze(r)
    assert "/chart/monthly.do" not in [s["path"] for s in bf["steps"]]
    assert any(x["path"] == "/chart/monthly.do" and x["role"] == "noise" for x in bf["excluded"])


def test_같은_값이_두_곳에_있으면_확신도를_낮춘다():
    dup = {"resultList": [{"PO_NO": "PO-2609-0142", "REF_NO": "PO-2609-0142"}]}
    r = rec([span(1, {"tag": "BUTTON", "text": "조회"}, [net("GET", "/poList.do", "fromDt=20260901", dup)], post_aria="PO-2609-0142"),
             span(2, {"tag": "TR", "text": "PO-2609-0142"}, [net("GET", "/poDetail.do", "poNo=PO-2609-0142", DETAIL)], post_aria="한빛상사")])
    po = next(p for p in analyze.analyze(r)["steps"][1]["params"] if p["a"] == "poNo")
    assert po["source"] == "PREVIOUS_STEP_OUTPUT" and po["confidence"] == "low"


def test_JSON_이_아닌_응답도_분석이_멈추지_않는다():
    r = rec([span(1, {"tag": "BUTTON", "text": "조회"}, [net("GET", "/legacyList.do", "q=1", "<tr><td>PO-1</td></tr>")], post_aria="PO-1")])
    bf = analyze.analyze(r)
    assert bf["steps"][0]["path"] == "/legacyList.do"            # 화면에 응답 글자가 보였으면 핵심으로 본다


def test_핵심_요청을_못_찾으면_빈_단계와_안내():
    bf = analyze.analyze(rec([span(1, {"tag": "A", "text": "메인"}, [])]))
    assert bf["steps"] == [] and any("핵심 요청을 찾지 못했습니다" in n for n in bf["notes"])


def test_JSON_잎_경로로_값을_꺼낸다():
    assert analyze.get_path(LIST, "$.resultList[1].PO_NO") == "PO-2609-0138"
    assert ("$.po.PO_AMT", "4,850,000") in analyze.leaves(DETAIL)
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_analyze.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.ieum.recorder.analyze'`

- [ ] **Step 3: 구현**

```python
# apps/backend/app/ieum/recorder/analyze.py
"""기록 → 업무 기능. 규칙만으로 동작한다(LLM 에 의존하지 않는다 — LLM 이 죽어도 분석은 된다).

핵심 판단은 두 가지다.
1) 이 요청이 업무의 본체인가: 행동 직후 나갔고, 응답 값이 직후 화면(ARIA 스냅샷)에 나타났는가.
2) 이 파라미터 값은 어디서 왔나: 사용자가 입력했나, 앞 단계 응답에 있었나, 세션·설정·상수인가.

같은 값이 여러 곳에 있으면 하나를 골라 조용히 확정하지 않는다. 확신도를 낮춰 검토 화면에서 사람에게 묻는다.
"""
import re
import time
from types import SimpleNamespace
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import parse_qsl, urlsplit

from app.ieum.discovery import infer
from app.ieum.discovery.policy import Policy

USER_INPUT, PREVIOUS_STEP_OUTPUT, SESSION_CONTEXT = "USER_INPUT", "PREVIOUS_STEP_OUTPUT", "SESSION_CONTEXT"
SYSTEM_CONFIG, DERIVED, CONSTANT = "SYSTEM_CONFIG", "DERIVED", "CONSTANT"
_DATE = re.compile(r"^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$")
_OPS = (("APPROVE", re.compile(r"approv|confirm|결재|승인|결제|이체|pay|transfer", re.I)),
        ("DELETE", re.compile(r"delet|remove|del\b|삭제|제거", re.I)),
        ("UPDATE", re.compile(r"upd|modify|edit|change|수정|변경", re.I)))
_RISK = {"READ": ("LOW", "NONE"), "CREATE": ("MEDIUM", "CONFIRM"), "UPDATE": ("MEDIUM", "CONFIRM"),
         "DELETE": ("HIGH", "HITL"), "APPROVE": ("CRITICAL", "HITL")}
_ORDER = ["READ", "CREATE", "UPDATE", "DELETE", "APPROVE"]
MIN_VALUE_LEN = 3                                       # "1", "Y" 같은 짧은 값은 우연히 겹치므로 연결 근거로 쓰지 않는다


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
    node = data
    for name, idx in re.findall(r"\.([^.\[]+)|\[(\d+)\]", path[1:]):
        try:
            node = node[name] if name else node[int(idx)]
        except (KeyError, IndexError, TypeError):
            return None
    return node


# ── 요청 해석 ──────────────────────────────────────────────────────────────
def _pairs(n: dict) -> List[Tuple[str, str, str]]:
    obs = SimpleNamespace(url=n["url"], post=n.get("post"), headers={"content-type": "application/json" if (n.get("post") or "").startswith("{") else ""})
    return infer.request_pairs(obs)


def _type(v: str) -> str:
    if _DATE.match(v or ""):
        return "date"
    if re.fullmatch(r"-?\d+", v or ""):
        return "number"
    return "string"


def _op_of(n: dict, label: str) -> str:
    if n["method"] in ("GET", "HEAD") and not n.get("held"):
        return "READ"
    text = f"{n['path']} {label}"
    for op, pat in _OPS:
        if pat.search(text):
            return op
    return "CREATE"


def analyze(rec: dict) -> dict:
    policy = Policy(base=rec["sourceBase"], read_post=rec.get("readPost", ""))
    login_path = (rec.get("login") or {}).get("path") or ""
    items = []                                           # (span, net, rel_path, parsed_json)
    excluded = []
    for sp in rec.get("spans", []):
        for n in sp["network"]:
            rel = infer.templatize(policy.rel(urlsplit(n["url"]).path))
            row = {"method": n["method"], "path": rel}
            if n["path"] == login_path:
                excluded.append(dict(row, role="auth", why="로그인 요청 (인증 방법으로 따로 보관)"))
            elif not n.get("inScope", True):
                excluded.append(dict(row, role="noise", why="대상 시스템 밖 요청"))
            elif sp["action"]["target"] is None:
                excluded.append(dict(row, role="noise", why="행동 없이 화면이 스스로 부른 요청"))
            elif n.get("decision") in ("deny", "timeout"):
                excluded.append(dict(row, role="denied", why="승인하지 않아 보내지 않은 쓰기"))
            else:
                items.append((sp, n, rel, infer.parse_json(n.get("res") or "")))

    tables = infer.detect_code_tables([SimpleNamespace(url=n["url"], body=n.get("res") or "", status=n["status"], blocked=False, file=n.get("file"),
                                                       out_of_scope=False, method=n["method"], post=n.get("post"), headers={})
                                       for _, n, _, _ in items])
    code_paths = set()
    for _, n, rel, _ in items:
        if tables and re.search(r"code|cmmn", rel, re.I) and n["method"] == "GET":
            code_paths.add(rel)

    # 1) 핵심 후보: 응답 값이 직후 화면에 보였거나, 사람이 승인·스테이징으로 보낸 쓰기
    steps: List[dict] = []
    seen = {}
    for sp, n, rel, data in items:
        key = (n["method"], rel)
        if rel in code_paths:
            if key not in seen:
                seen[key] = None
                excluded.append({"method": n["method"], "path": rel, "role": "code", "why": "코드표 응답 (상태코드 풀이용 참조)"})
            continue
        write = n["method"] not in ("GET", "HEAD") or bool(n.get("held"))
        aria = (sp["post"] or {}).get("aria") or ""
        shown = _shown(data, n.get("res") or "", aria)
        if not (shown or write):
            if key not in seen:
                seen[key] = None
                excluded.append({"method": n["method"], "path": rel, "role": "page" if n["rtype"] == "document" else "noise",
                                 "why": "응답 값이 화면에 나타나지 않음"})
            continue
        if key in seen and seen[key] is not None:
            seen[key]["_samples"].append((sp, n, data))
            seen[key]["_spans"].append(sp["seq"])
            continue
        st = {"id": f"s{len(steps) + 1}", "role": "core", "method": n["method"], "path": rel, "write": write,
              "headers": {k: v for k, v in (n.get("headers") or {}).items() if k.startswith("x-")},
              "outputs": {}, "params": [], "recordedRes": n.get("res") or "", "recordedStatus": n["status"],
              "_samples": [(sp, n, data)], "_spans": [sp["seq"]], "_label": (sp["action"]["target"] or {}).get("text", "")}
        seen[key] = st
        steps.append(st)

    # 2) 파라미터와 값 연결
    user_vals = _user_values(rec)
    inputs: Dict[str, dict] = {}
    for i, st in enumerate(steps):
        sp, n, _ = st["_samples"][0]
        common = _common_values(steps)
        for name, value, loc in _pairs(n):
            p = {"a": name, "loc": loc, "ex": value, "type": _type(value), "required": value != ""}
            link = _find_link(value, steps[:i]) if len(value) >= MIN_VALUE_LEN else []
            if link:
                prev, path, many = link[0][0], link[0][1], len(link) > 1
                out_name = path.rsplit(".", 1)[-1].split("[")[0] or name
                prev["outputs"][out_name] = path
                p.update({"from": f"{prev['id']}.{out_name}", "source": PREVIOUS_STEP_OUTPUT, "confidence": "low" if many else "high"})
                if prev["role"] != "core":
                    prev["role"] = "prereq"
            elif value in user_vals:
                p.update({"from": f"input.{name}", "source": USER_INPUT, "confidence": "high"})
                inputs.setdefault(name, {"name": name, "type": p["type"], "source": USER_INPUT, "ex": value,
                                         "screenLabel": user_vals[value], "confidence": "high", "required": True})
            elif value == "":
                p.update({"from": f"input.{name}", "source": USER_INPUT, "confidence": "low", "required": False})
                inputs.setdefault(name, {"name": name, "type": "string", "source": USER_INPUT, "ex": "", "screenLabel": "",
                                         "confidence": "low", "required": False})
            elif name in common and common[name] == value:
                p.update({"from": f"config.{name}", "source": SYSTEM_CONFIG, "confidence": "mid"})
            elif p["type"] == "date" and value == time.strftime("%Y%m%d", time.localtime(sp["action"]["t"] or time.time())):
                p.update({"from": f"input.{name}", "source": DERIVED, "confidence": "low"})
                inputs.setdefault(name, {"name": name, "type": "date", "source": DERIVED, "ex": value, "screenLabel": "",
                                         "confidence": "low", "required": True})
            else:
                p.update({"from": f"const:{value}", "source": CONSTANT, "confidence": "mid"})
            st["params"].append(p)

    # 3) 출력: 마지막 핵심 단계 응답 중 마지막 화면에 보인 필드
    output = {"from": None, "fields": []}
    cores = [s for s in steps if s["role"] == "core"]
    if cores:
        last = cores[-1]
        sp, n, data = last["_samples"][-1]
        aria = (sp["post"] or {}).get("aria") or ""
        output = {"from": last["id"], "fields": [p for p, v in leaves(data)[:200] if len(str(v)) >= 2 and str(v) in aria][:20] if data is not None else []}

    # 4) 정책
    ops = [_op_of(s["_samples"][0][1], s["_label"]) for s in steps] or ["READ"]
    op = max(ops, key=_ORDER.index)
    risk, approval = _RISK[op]
    policy_meta = {"operation": op, "risk": risk, "approval": approval, "envPolicy": "op-auto" if op == "READ" else "op-confirm",
                   "sensitivity": None, "scope": None}

    notes = []
    if not steps:
        notes.append("핵심 요청을 찾지 못했습니다. 아래 전체 요청 목록에서 업무에 해당하는 것을 골라 주세요.")
    evidence = {s["id"]: s["_spans"] for s in steps}
    for s in steps:
        for k in ("_samples", "_spans", "_label"):
            s.pop(k, None)
    login = rec.get("login") or {}
    return {"id": "bf_" + rec["id"][4:], "name": rec["name"], "desc": "", "status": "draft",
            "source": {"base": rec["sourceBase"], "recordingId": rec["id"], "made": "manual-record", "env": rec["env"]},
            "inputs": list(inputs.values()), "steps": steps, "references": [x for x in excluded if x["role"] == "code"],
            "excluded": excluded, "output": output,
            "auth": {"mode": "session" if login.get("recipe") else "none", "recipe": login.get("recipe")},
            "executionMode": None, "policy": policy_meta, "verification": {"status": "pending", "at": None, "runs": []},
            "evidence": evidence, "notes": notes}


def _shown(data, raw: str, aria: str) -> bool:
    """응답 값이 화면에 나타났는가. JSON 이면 잎 값으로, 아니면 응답 글자 조각으로 본다."""
    if not aria:
        return False
    if data is not None:
        return any(len(str(v)) >= MIN_VALUE_LEN and str(v) in aria for _, v in leaves(data)[:200])
    texts = re.findall(r">([^<>]{3,})<", raw or "")
    return any(t.strip() and t.strip() in aria for t in texts[:50])


def _user_values(rec: dict) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for sp in rec.get("spans", []):
        for f in sp.get("fills", []):
            v = str(f.get("value") or "")
            if v:
                t = f.get("target") or {}
                out.setdefault(v, t.get("label") or t.get("text") or t.get("name") or t.get("id") or "")
    return out


def _common_values(steps: List[dict]) -> Dict[str, str]:
    """두 단계 이상에 같은 값으로 붙는 파라미터 — 회사 코드 같은 설정값으로 본다."""
    seen: Dict[str, set] = {}
    vals: Dict[str, str] = {}
    for st in steps:
        _, n, _ = st["_samples"][0]
        for name, value, _ in _pairs(n):
            if value:
                seen.setdefault(name, set()).add(st["id"])
                vals.setdefault(name, value)
                if vals[name] != value:
                    seen[name] = set()
    return {k: vals[k] for k, ids in seen.items() if len(ids) >= 2}


def _find_link(value: str, prev_steps: List[dict]) -> List[Tuple[dict, str]]:
    hits = []
    for st in reversed(prev_steps):
        for _, _, data in st["_samples"][:1]:
            if data is None:
                continue
            for path, v in leaves(data):
                if str(v) == value:
                    hits.append((st, path))
    return hits
```

- [ ] **Step 4: 시험 통과 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_analyze.py -v`
Expected: 11개 PASS. `test_같은_값이_두_곳에_있으면_확신도를_낮춘다`에서 `outputs` 이름이 `PO_NO`/`REF_NO` 중 무엇이든 단언하지 않으므로 그대로 둔다.

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/app/ieum/recorder/analyze.py apps/backend/tests/test_ieum_recorder_analyze.py
git commit -m "feat: 업무 기록 분석 — 핵심 단계, 값 연결, 입력값 출처, 정책 추정"
```

---

### Task 9: Replay 검증

**Files:**
- Create: `apps/backend/app/ieum/recorder/replay.py`
- Test: `apps/backend/tests/test_ieum_recorder_replay.py`

**Interfaces:**
- Consumes: `analyze.get_path`, `analyze.leaves`, `infer.parse_json`, `session_auth.expired`, `session_auth.login`, `credentials.get`, `Guard.ask`
- Produces:
  - `replay.judge(status: int, location: Optional[str], ctype: str, text: str, recorded: str, headers_sent: dict) -> Tuple[bool, str, Any]` — `(성공, 이유 코드, 해석한 데이터)`. 이유 코드: `""`, `auth_expired`, `waf_blocked`, `http_error`, `shape_mismatch`, `error_response`
  - `replay.shape_score(a, b) -> float` — 키 이름 겹침 비율(0~1)
  - `replay.varied_inputs(bf: dict, rec: dict) -> Optional[Dict[str, str]]` — 다른 값 재실행용 입력. 바꿀 것이 없으면 `None`
  - `Transport` 프로토콜 — `async send(method, url, headers, params, data, json_body) -> (status, location, ctype, text)`, `mode: str`
  - `HttpTransport(cookies: Dict[str, str])`, `BrowserTransport(page)`
  - `await replay.run_once(bf: dict, inputs: Dict[str, str], transport, ask_write: Callable[[dict], Awaitable[bool]], gap: float) -> dict` — `{kind, ok, steps: [{id, status, ok, reason}], reason}`
  - `await replay.verify(bf: dict, rec: dict, session=None) -> dict` — `{"verification": {status, at, runs}, "executionMode": "direct"|"session"|"browser"|None}`
    - `session`이 살아 있으면 그 쿠키(`ctx.cookies()`)와 페이지, 가드를 쓴다
    - 없으면 `rec.login.mode == "auto"`일 때 금고 `rec:<rid>`로 `session_auth.login`해 쿠키를 얻는다. 직접 로그인 기록이면 `{"status": "needs-login"}`

- [ ] **Step 1: 실패하는 시험 작성**

판정은 순수 시험, 실행은 시연 사이트에 진짜 HTTP로 보낸다(브라우저 불필요).

```python
# apps/backend/tests/test_ieum_recorder_replay.py
"""Replay: 판정은 순수 시험, 실행은 시연용 레거시 사이트에 실제 HTTP 로 보낸다."""
import asyncio
import json

from app.ieum.demo_legacy.site import DEMO_PASSWORD, DEMO_USER_ID
from app.ieum.gateway import session_auth
from app.ieum.recorder import replay

REC_LIST = json.dumps({"RSLT": "0000", "resultList": [{"PO_NO": "PO-2609-0142"}]})


def test_200_이고_구조가_같으면_성공():
    ok, why, data = replay.judge(200, None, "application/json", REC_LIST, REC_LIST, {"x-requested-with": "XMLHttpRequest"})
    assert ok and why == "" and data["resultList"][0]["PO_NO"] == "PO-2609-0142"


def test_로그인_화면으로_보내지면_세션_만료():
    assert replay.judge(302, "/po/login.do", "", "", REC_LIST, {})[1] == "auth_expired"


def test_400_인데_보존_헤더가_없으면_WAF_로_본다():
    assert replay.judge(400, None, "application/json", '{"RSLT":"E400"}', REC_LIST, {})[1] == "waf_blocked"
    assert replay.judge(400, None, "application/json", '{"RSLT":"E400"}', REC_LIST, {"x-requested-with": "XMLHttpRequest"})[1] == "http_error"


def test_구조가_다르면_실패():
    assert replay.judge(200, None, "application/json", '{"other":1}', REC_LIST, {})[1] == "shape_mismatch"


def test_200_이어도_오류_표시가_있으면_실패():
    body = json.dumps({"RSLT": "E403", "MSG": "권한이 없습니다", "resultList": []})
    assert replay.judge(200, None, "application/json", body, REC_LIST, {})[1] == "error_response"


def test_JSON_이_아닌_응답은_구조_비교를_건너뛴다():
    assert replay.judge(200, None, "text/html", "<tr><td>PO-1</td></tr>", "<tr><td>PO-2</td></tr>", {})[0] is True


def _bf(base):
    return {"id": "bf_x", "source": {"base": base + "/demo-legacy/po", "env": "op", "recordingId": "rec_x"},
            "inputs": [{"name": "fromDt", "type": "date", "source": "USER_INPUT", "ex": "20260901"},
                       {"name": "toDt", "type": "date", "source": "USER_INPUT", "ex": "20260930"}],
            "steps": [
                {"id": "s1", "role": "core", "method": "GET", "path": "/poList.do", "write": False, "headers": {"x-requested-with": "XMLHttpRequest"},
                 "outputs": {"PO_NO": "$.resultList[0].PO_NO"}, "recordedStatus": 200,
                 "recordedRes": json.dumps({"RSLT": "0000", "totalCnt": 1, "resultList": [{"PO_NO": "x"}]}),
                 "params": [{"a": "fromDt", "loc": "query", "from": "input.fromDt", "ex": "20260901"},
                            {"a": "toDt", "loc": "query", "from": "input.toDt", "ex": "20260930"}]},
                {"id": "s2", "role": "core", "method": "GET", "path": "/poDetail.do", "write": False, "headers": {"x-requested-with": "XMLHttpRequest"},
                 "outputs": {}, "recordedStatus": 200, "recordedRes": json.dumps({"RSLT": "0000", "po": {"PO_NO": "x"}}),
                 "params": [{"a": "poNo", "loc": "query", "from": "s1.PO_NO", "ex": "PO-2609-0142"}]}],
            "auth": {"mode": "session"}}


def test_세션_HTTP_로_두_단계를_이어_실행한다(ieum_server):
    cookies = session_auth.login(ieum_server + "/demo-legacy/po", {"username": DEMO_USER_ID, "password": DEMO_PASSWORD,
                                                                   "recipe": {"userField": "userId", "passField": "userPw", "loginRel": "/login.do", "actionRel": "/loginProc.do"}})
    bf = _bf(ieum_server)

    async def no_write(step):
        return False
    run = asyncio.new_event_loop().run_until_complete(
        replay.run_once(bf, {"fromDt": "20260901", "toDt": "20260930"}, replay.HttpTransport(cookies), no_write, 0))
    assert run["ok"] and [s["ok"] for s in run["steps"]] == [True, True]


def test_다른_값은_날짜를_한_달_앞으로_옮긴다():
    v = replay.varied_inputs(_bf("http://h"), {"spans": []})
    assert v == {"fromDt": "20260801", "toDt": "20260831"}


def test_쿠키가_없으면_세션_만료로_실패한다(ieum_server):
    async def no_write(step):
        return False
    run = asyncio.new_event_loop().run_until_complete(
        replay.run_once(_bf(ieum_server), {"fromDt": "20260901", "toDt": "20260930"}, replay.HttpTransport({}), no_write, 0))
    assert not run["ok"] and run["steps"][0]["reason"] == "auth_expired"


def test_쓰기_단계를_거절하면_write_denied(ieum_server):
    bf = _bf(ieum_server)
    bf["steps"] = [dict(bf["steps"][0], id="s1", method="POST", path="/poSave.do", write=True, params=[], outputs={})]

    async def deny(step):
        return False
    run = asyncio.new_event_loop().run_until_complete(replay.run_once(bf, {}, replay.HttpTransport({}), deny, 0))
    assert not run["ok"] and run["steps"][0]["reason"] == "write_denied"
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_replay.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.ieum.recorder.replay'`

- [ ] **Step 3: 구현**

```python
# apps/backend/app/ieum/recorder/replay.py
"""Replay 검증: 업무 기능을 실제로 다시 실행해 본다.

두 번 돌린다. 같은 값으로 한 번(기록이 재현되는가), 사용자 입력만 바꿔 한 번(입력이 정말 바꿀 수 있는 값이고, 단계
연결이 새 값으로도 이어지는가). 다른 값은 지어내지 않는다. 날짜는 한 달 앞으로, 그 밖에는 기록 안의 다른 값을 쓴다.

성공은 HTTP 200 만으로 판단하지 않는다. 로그인 화면으로 튕기지 않았고, 응답 구조가 기록과 같고, 오류 표시가 없고,
다음 단계로 넘길 값을 실제로 꺼낼 수 있어야 한다.

운영에서는 쓰기 단계 직전에 다시 승인을 받는다(같은 저장이 한 번 더 일어나기 때문). 쓰기 단계는 같은 값으로만 돌린다.
"""
import asyncio
import datetime as dt
import re
import time
from typing import Any, Awaitable, Callable, Dict, Optional, Tuple
from urllib.parse import urlsplit

import httpx

from app.ieum.discovery import infer
from app.ieum.gateway import credentials, session_auth
from app.ieum.recorder.analyze import get_path, leaves

TIMEOUT = 15
UA = "Mozilla/5.0 (compatible; IeumRecorder/1.0)"
_ERR_KEY = re.compile(r"^(rslt|result_?code|code|status)$", re.I)
_ERR_TEXT = ("권한이 없습니다", "오류가 발생", "처리 중 오류")


def shape_score(a, b) -> float:
    def keys(d):
        return {re.sub(r"\[\d+\]", "[]", p) for p, _ in leaves(d, 200)}
    ka, kb = keys(a), keys(b)
    return 1.0 if not ka else len(ka & kb) / len(ka)


def _looks_error(data, text: str) -> bool:
    if isinstance(data, dict):
        for k, v in data.items():
            if _ERR_KEY.match(str(k)) and isinstance(v, str) and (v.upper().startswith("E") or v.upper() in ("FAIL", "ERROR")):
                return True
    return any(t in (text or "") for t in _ERR_TEXT)


def judge(status: int, location: Optional[str], ctype: str, text: str, recorded: str, headers_sent: dict) -> Tuple[bool, str, Any]:
    if session_auth.expired(status, location, ctype, text or ""):
        return False, "auth_expired", None
    if status >= 400:
        sent = {k.lower() for k in (headers_sent or {})}
        return False, ("waf_blocked" if status in (400, 403) and "x-requested-with" not in sent else "http_error"), None
    data, before = infer.parse_json(text or ""), infer.parse_json(recorded or "")
    if _looks_error(data, text):
        return False, "error_response", data
    if before is not None and (data is None or shape_score(before, data) < 0.6):
        return False, "shape_mismatch", data
    return True, "", data


class HttpTransport:
    mode = "session"

    def __init__(self, cookies: Dict[str, str]):
        self.cookies = cookies

    async def send(self, method, url, headers, params, data, json_body):
        async with httpx.AsyncClient(follow_redirects=False, timeout=TIMEOUT, cookies=self.cookies, verify=False) as c:
            r = await c.request(method, url, headers=headers, params=params or None, data=data or None, json=json_body)
            return r.status_code, r.headers.get("location"), r.headers.get("content-type", ""), r.text[:200_000]


class BrowserTransport:
    """기록 세션 페이지 안에서 fetch 로 보낸다. 토큰·서명처럼 브라우저에 묶인 값이 필요한 API 용이다."""
    mode = "browser"

    def __init__(self, page):
        self.page = page

    async def send(self, method, url, headers, params, data, json_body):
        if params:
            url = str(httpx.URL(url, params=params))
        body = None
        if json_body is not None:
            import json as _j
            body, headers = _j.dumps(json_body), dict(headers, **{"content-type": "application/json"})
        elif data:
            body, headers = str(httpx.QueryParams(data)), dict(headers, **{"content-type": "application/x-www-form-urlencoded"})
        r = await self.page.evaluate("""async ([m, u, h, b]) => { const r = await fetch(u, {method: m, headers: h, body: b, redirect: 'manual', credentials: 'include'});
            return [r.status, r.headers.get('location'), r.headers.get('content-type') || '', await r.text()]; }""", [method, url, headers, body])
        return r[0], r[1], r[2], (r[3] or "")[:200_000]


def _value(p: dict, inputs: Dict[str, str], outs: Dict[str, Dict[str, Any]]) -> Optional[str]:
    src = p.get("from") or ""
    if src.startswith("input."):
        return inputs.get(src[6:], p.get("ex", ""))
    if src.startswith("const:"):
        return src[6:]
    if src.startswith(("session.", "config.")):
        return p.get("ex", "")
    if "." in src:
        sid, name = src.split(".", 1)
        v = outs.get(sid, {}).get(name)
        return None if v is None else str(v)
    return p.get("ex", "")


async def run_once(bf: dict, inputs: Dict[str, str], transport, ask_write: Callable[[dict], Awaitable[bool]], gap: float, kind: str = "same-values") -> dict:
    base = bf["source"]["base"].rstrip("/")
    outs: Dict[str, Dict[str, Any]] = {}
    results = []
    for i, st in enumerate(bf["steps"]):
        if i and gap:
            await asyncio.sleep(gap)
        if st.get("write") and not await ask_write(st):
            results.append({"id": st["id"], "status": None, "ok": False, "reason": "write_denied"})
            return {"kind": kind, "ok": False, "steps": results, "reason": "write_denied"}
        headers = {"User-Agent": UA, "Referer": base + "/", **(st.get("headers") or {})}
        params, form, body = {}, {}, None
        for p in st["params"]:
            v = _value(p, inputs, outs)
            if v is None:
                results.append({"id": st["id"], "status": None, "ok": False, "reason": "chain_broken"})
                return {"kind": kind, "ok": False, "steps": results, "reason": "chain_broken"}
            if p["loc"] == "query":
                params[p["a"]] = v
            elif p["loc"] == "form":
                form[p["a"]] = v
            elif p["loc"] == "body":
                body = dict(body or {}, **{p["a"]: v})
            elif p["loc"] == "header":
                headers[p["a"]] = v
        try:
            status, loc, ctype, text = await transport.send(st["method"], base + st["path"], headers, params, form, body)
        except Exception as exc:
            results.append({"id": st["id"], "status": None, "ok": False, "reason": "http_error", "note": type(exc).__name__})
            return {"kind": kind, "ok": False, "steps": results, "reason": "http_error"}
        ok, why, data = judge(status, loc, ctype, text, st.get("recordedRes") or "", headers)
        if ok:
            outs[st["id"]] = {}
            for name, path in (st.get("outputs") or {}).items():
                v = get_path(data, path) if data is not None else None
                if v is None:
                    ok, why = False, "chain_broken"
                    break
                outs[st["id"]][name] = v
        results.append({"id": st["id"], "status": status, "ok": ok, "reason": why})
        if not ok:
            return {"kind": kind, "ok": False, "steps": results, "reason": why}
    return {"kind": kind, "ok": True, "steps": results, "reason": ""}


def _shift_month(v: str) -> str:
    """같은 날의 한 달 전. 그 달에 그 날이 없거나 원래 날이 그 달의 마지막 날이면 한 달 전 달의 마지막 날."""
    d = dt.date(int(v[:4]), int(v[4:6]), int(v[6:]))
    last_prev = d.replace(day=1) - dt.timedelta(days=1)            # 한 달 전 달의 마지막 날
    next_first = (d.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
    if d == next_first - dt.timedelta(days=1):                     # 원래 날이 그 달의 마지막 날
        return last_prev.strftime("%Y%m%d")
    return last_prev.replace(day=min(d.day, last_prev.day)).strftime("%Y%m%d")


def varied_inputs(bf: dict, rec: dict) -> Optional[Dict[str, str]]:
    out, changed = {}, False
    for inp in bf.get("inputs", []):
        v = str(inp.get("ex") or "")
        if inp.get("source") != "USER_INPUT" or not v:
            out[inp["name"]] = v
            continue
        if inp.get("type") == "date" and re.fullmatch(r"\d{8}", v):
            out[inp["name"]] = _shift_month(v)
            changed = True
            continue
        alt = _alternative(inp["name"], v, rec)
        out[inp["name"]] = alt or v
        changed = changed or bool(alt)
    return out if changed else None


def _alternative(name: str, value: str, rec: dict) -> Optional[str]:
    """기록한 응답 중 같은 이름(대소문자 무시) 키에 들어 있던 다른 값."""
    want = name.lower().replace("_", "")
    for sp in rec.get("spans", []):
        for n in sp.get("network", []):
            data = infer.parse_json(n.get("res") or "")
            if data is None:
                continue
            for path, v in leaves(data):
                key = path.rsplit(".", 1)[-1].split("[")[0].lower().replace("_", "")
                if key == want and str(v) and str(v) != value:
                    return str(v)
    return None


async def verify(bf: dict, rec: dict, session=None) -> dict:
    host = urlsplit(bf["source"]["base"]).hostname or ""
    gap = 0 if host in ("localhost", "127.0.0.1", "::1") else 0.6
    transport, browser = None, None
    if session is not None and not session.closed:
        cookies = {c["name"]: c["value"] for c in await session.ctx.cookies()}
        transport, browser = HttpTransport(cookies), BrowserTransport(session.page)

        async def ask(st):
            return await session.guard.ask(st["method"], bf["source"]["base"] + st["path"], f"Replay 검증: {st['path']}")
    else:
        if (rec.get("login") or {}).get("mode") != "auto":
            return {"verification": {"status": "needs-login", "at": time.time(), "runs": []}, "executionMode": None}
        cred = credentials.get(f"rec:{rec['id']}") or {}
        recipe = (rec.get("login") or {}).get("recipe")
        if not recipe:
            return {"verification": {"status": "needs-login", "at": time.time(), "runs": []}, "executionMode": None}
        cookies = await asyncio.to_thread(session_auth.login, bf["source"]["base"], dict(cred, recipe=recipe))
        transport = HttpTransport(cookies)

        async def ask(st):
            return bf["source"].get("env") != "op"         # 기록 화면 밖 재검증: 운영 쓰기는 묻을 창이 없으니 보내지 않는다

    runs, mode = [], "session" if bf.get("auth", {}).get("mode") == "session" else "direct"
    same = await run_once(bf, {i["name"]: str(i.get("ex") or "") for i in bf.get("inputs", [])}, transport, ask, gap)
    if not same["ok"] and browser is not None and same["reason"] in ("shape_mismatch", "http_error", "waf_blocked", "error_response"):
        alt = await run_once(bf, {i["name"]: str(i.get("ex") or "") for i in bf.get("inputs", [])}, browser, ask, gap)
        if alt["ok"]:
            same, transport, mode = dict(alt, note="browser_only"), browser, "browser"
    runs.append(same)
    has_write = any(s.get("write") for s in bf["steps"])
    varied = None if has_write else varied_inputs(bf, rec)
    if same["ok"] and varied:
        runs.append(await run_once(bf, varied, transport, ask, gap, kind="varied-values"))
    elif same["ok"]:
        runs.append({"kind": "varied-values", "ok": None, "steps": [], "reason": "skipped"})
    if not same["ok"]:
        status = "failed"
    elif all(r["ok"] is not False for r in runs):
        status = "verified"
    else:
        status = "partial"
    return {"verification": {"status": status, "at": time.time(), "runs": runs}, "executionMode": mode if same["ok"] else None}
```

- [ ] **Step 4: 시험 통과 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_replay.py -v`
Expected: 10개 PASS. `20260901 → 20260801`, `20260930 → 20260831`(9월 30일은 9월의 마지막 날 → 8월의 마지막 날).

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/app/ieum/recorder/replay.py apps/backend/tests/test_ieum_recorder_replay.py
git commit -m "feat: 업무 기능 Replay 검증 — 같은 값·다른 값, 실행 방식 판별"
```

---

### Task 10: 종료 후 흐름, 업무 기능 수정·확정·단건 등록

**Files:**
- Create: `apps/backend/app/ieum/recorder/service.py`
- Modify: `apps/backend/app/ieum/routers/recorder.py` (업무 기능 라우트 추가, `MANAGER.on_stopped = service.finish` 연결)
- Test: `apps/backend/tests/test_ieum_recorder_service.py`

**Interfaces:**
- Consumes: `analyze.analyze`, `replay.verify`, `store.*`, `MANAGER.close`, `src_repo.list_sources/upsert_source`, `tool_repo.all_tools/flat_tools/replace_source_tools/with_defaults`, `credentials.get/put`, `session_auth.invalidate`, `infer.tool_name`, `infer.build_res`, `spec._param`, `Masker`, `jobs._slug`
- Produces:
  - `await service.finish(rid: str, session) -> None` — `analyzing → verifying → review`(실패면 `failed`+`error`). 끝나면 `MANAGER.close(rid)`. 진행을 `session.broadcast({"t": "status", "status": ...})`로 알린다
  - `service.update_function(fid: str, patch: dict) -> dict` — 허용 필드: `name`, `desc`, `inputs`(출처·라벨·필수), `steps`(포함 여부 `skip`, 순서), `promote`(`excluded`의 `{method,path}`를 단계로), `policy.operation/risk/approval/scope/sensitivity`. 입력·단계가 바뀌면 `verification.status = "stale"`
  - `await service.reverify(fid: str) -> dict` — 세션 없이 다시 검증(`replay.verify(bf, rec, None)`)
  - `service.confirm(fid: str) -> dict` — `status = "confirmed"`, `policyIncomplete = scope 또는 sensitivity 가 None`
  - `service.register_single(fid: str) -> dict` — 단계가 정확히 1개일 때만. 아니면 `ValueError("여러 단계 업무는 다음 작업에서 도구 하나로 등록할 수 있습니다. 지금은 단계를 낱개 도구로 등록해 주세요.")`
  - `service.register_steps(fid: str) -> dict` — 단계마다 낱개 도구로 등록(검토 화면의 "단계를 낱개 도구로 등록")
  - 라우트: `GET /functions/{fid}/`, `PUT /functions/{fid}/`, `POST /functions/{fid}/verify/`, `POST /functions/{fid}/confirm/`, `POST /functions/{fid}/register/` (본문 `{"mode": "single"|"steps"}`)

- [ ] **Step 1: 실패하는 시험 작성**

```python
# apps/backend/tests/test_ieum_recorder_service.py
"""업무 기능 수정·확정·단건 등록. 분석이 만든 업무 기능을 저장해 두고 시험한다."""
import json

import pytest

from app.ieum.recorder import service, store
from app.ieum.repositories import sources as src_repo
from app.ieum.repositories import studio as tool_repo


def _bf(steps):
    return {"id": "bf_00000001", "name": "거래처 검색", "desc": "", "status": "draft",
            "source": {"base": "http://h/po", "recordingId": "rec_00000001", "made": "manual-record", "env": "op"},
            "inputs": [{"name": "vendNm", "type": "string", "source": "USER_INPUT", "ex": "한빛", "screenLabel": "거래처명", "confidence": "high", "required": True}],
            "steps": steps, "references": [], "excluded": [{"method": "GET", "path": "/common/codeList.do", "role": "code", "why": ""}],
            "output": {"from": "s1", "fields": []}, "auth": {"mode": "session", "recipe": {"userField": "userId", "passField": "userPw", "loginRel": "/login.do", "actionRel": "/loginProc.do", "extra": {}, "json": False}},
            "executionMode": "session", "policy": {"operation": "READ", "risk": "LOW", "approval": "NONE", "envPolicy": "op-auto", "scope": None, "sensitivity": None},
            "verification": {"status": "verified", "at": 1, "runs": []}, "evidence": {}, "notes": []}


STEP = {"id": "s1", "role": "core", "method": "GET", "path": "/vendList.do", "write": False, "headers": {"x-requested-with": "XMLHttpRequest"},
        "outputs": {}, "recordedStatus": 200, "recordedRes": json.dumps({"RSLT": "0000", "resultList": [{"VEND_CD": "V0012", "VEND_NM": "한빛상사"}]}),
        "params": [{"a": "vendNm", "loc": "query", "from": "input.vendNm", "ex": "한빛", "source": "USER_INPUT", "confidence": "high", "type": "string", "required": True}]}


@pytest.fixture
def saved(ieum_state):
    rec = store.new_recording("거래처 검색", "", "http://h/po", "", "op", "auto", "")
    rec["id"] = "rec_00000001"
    store.save_recording(rec)
    bf = _bf([STEP])
    store.save_function(bf)
    return bf


def test_입력_출처를_바꾸면_검증이_낡음이_된다(saved):
    out = service.update_function(saved["id"], {"inputs": [dict(saved["inputs"][0], source="CONSTANT")]})
    assert out["inputs"][0]["source"] == "CONSTANT" and out["verification"]["status"] == "stale"


def test_제외된_요청을_단계로_올린다(saved):
    out = service.update_function(saved["id"], {"promote": {"method": "GET", "path": "/common/codeList.do"}})
    assert [s["path"] for s in out["steps"]] == ["/vendList.do", "/common/codeList.do"] and out["steps"][1]["role"] == "prereq"


def test_정책_칸이_비면_확정은_되지만_미완_표시(saved):
    out = service.confirm(saved["id"])
    assert out["status"] == "confirmed" and out["policyIncomplete"] is True


def test_단계가_하나면_도구로_등록한다(saved):
    out = service.register_single(saved["id"])
    tool = out["tools"][0]
    assert tool["method"] == "GET" and tool["path"] == "/vendList.do" and tool["mode"] == "read" and tool["status"] == "review"
    assert tool["rec"] == {"function": "bf_00000001", "recording": "rec_00000001"}
    assert any(s["id"] == out["source"]["id"] and s["authType"] == "session" for s in src_repo.list_sources())
    assert tool["id"] in {t["id"] for t in tool_repo.flat_tools()}


def test_여러_단계는_도구_하나로_등록하지_않는다(ieum_state):
    bf = _bf([STEP, dict(STEP, id="s2", path="/vendDetail.do")])
    store.save_function(bf)
    with pytest.raises(ValueError, match="다음 작업"):
        service.register_single(bf["id"])
    out = service.register_steps(bf["id"])
    assert [t["path"] for t in out["tools"]] == ["/vendList.do", "/vendDetail.do"]
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.ieum.recorder.service'`

- [ ] **Step 3: 구현**

```python
# apps/backend/app/ieum/recorder/service.py
"""기록이 끝난 뒤의 흐름과 업무 기능 다루기.

종료 → 분석 → 검증 → 검토. 검증은 기록 세션의 브라우저가 살아 있을 때 해야 같은 세션 쿠키와 페이지(브라우저 안 호출)를
쓸 수 있어서, 검증이 끝날 때까지 브라우저를 닫지 않는다.

도구 등록은 단계가 하나일 때만 "업무 기능 = 도구 하나"다. 여러 단계를 도구 하나로 실행하는 것은 다음 작업(실행 엔진 확장)이다.
"""
import asyncio
import copy
import time
from urllib.parse import urlsplit

from app.ieum.discovery import infer
from app.ieum.discovery.jobs import _slug
from app.ieum.discovery.masking import Masker
from app.ieum.gateway import credentials, session_auth, spec
from app.ieum.recorder import analyze, replay, store
from app.ieum.repositories import sources as src_repo
from app.ieum.repositories import studio as tool_repo

EDITABLE_POLICY = ("operation", "risk", "approval", "scope", "sensitivity")


async def finish(rid: str, session) -> None:
    from app.ieum.recorder.manager import MANAGER

    async def say(status):
        store.update_recording(rid, lambda r: r.update(status=status))
        if session is not None:
            await session.broadcast({"t": "status", "status": status})
    try:
        await say("analyzing")
        rec = store.get_recording(rid)
        bf = await asyncio.to_thread(analyze.analyze, rec)
        store.save_function(bf)
        store.update_recording(rid, lambda r: r.update(functionId=bf["id"]))
        await say("verifying")
        if bf["steps"]:
            result = await replay.verify(bf, rec, session)
            bf.update(verification=result["verification"], executionMode=result["executionMode"])
            store.save_function(bf)
        await say("review")
    except Exception as exc:
        msg = str(exc).splitlines()[0][:300] if str(exc) else type(exc).__name__
        store.update_recording(rid, lambda r: r.update(status="failed", error=f"분석·검증 중 오류: {msg}"))
        if session is not None:
            await session.broadcast({"t": "status", "status": "failed", "error": msg})
    finally:
        await MANAGER.close(rid)


def update_function(fid: str, patch: dict) -> dict:
    bf = store.get_function(fid)
    stale = False
    for k in ("name", "desc"):
        if k in patch:
            bf[k] = str(patch[k])[:200]
    if "inputs" in patch:
        by = {i["name"]: i for i in patch["inputs"]}
        for inp in bf["inputs"]:
            new = by.get(inp["name"])
            if new:
                for k in ("source", "screenLabel", "required", "type"):
                    if k in new:
                        inp[k] = new[k]
                inp["confidence"] = "high"
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
            bf["references"] = [x for x in bf["references"] if x is not hit and x["path"] != hit["path"]]
            bf["steps"].append({"id": f"s{len(bf['steps']) + 1}", "role": "prereq", "method": hit["method"], "path": hit["path"],
                                "write": hit["method"] not in ("GET", "HEAD"), "headers": {}, "outputs": {}, "params": [],
                                "recordedRes": "", "recordedStatus": None})
            stale = True
    if "policy" in patch:
        for k in EDITABLE_POLICY:
            if k in patch["policy"]:
                bf["policy"][k] = patch["policy"][k]
    if stale:
        bf["verification"]["status"] = "stale"
    if bf.get("status") == "confirmed":
        bf["status"] = "draft"
    store.save_function(bf)
    return bf


async def reverify(fid: str) -> dict:
    bf = store.get_function(fid)
    rec = store.get_recording(bf["source"]["recordingId"])
    result = await replay.verify(bf, rec, None)
    bf.update(verification=result["verification"], executionMode=result["executionMode"] or bf.get("executionMode"))
    store.save_function(bf)
    return bf


def confirm(fid: str) -> dict:
    bf = store.get_function(fid)
    bf["status"] = "confirmed"
    bf["policyIncomplete"] = bf["policy"].get("scope") is None or bf["policy"].get("sensitivity") is None
    bf["confirmedAt"] = time.time()
    store.save_function(bf)
    return bf


def _tool_from_step(bf: dict, st: dict, taken: set, title: str) -> dict:
    mode = "write" if st.get("write") else "read"
    params = []
    for p in st["params"]:
        if p.get("source") in ("PREVIOUS_STEP_OUTPUT",):
            continue
        sch = {"type": {"number": "integer", "date": "string"}.get(p.get("type"), "string")}
        if p.get("ex"):
            sch["example"] = p["ex"]
        q = spec._param(p["a"], p["loc"], sch, bool(p.get("required")), next((i.get("screenLabel") for i in bf["inputs"] if i["name"] == p["a"]), None))
        if p.get("source") in ("CONSTANT", "SYSTEM_CONFIG"):
            q.update(rule="inject", v=p.get("ex", ""))
        params.append(q)
    for k, v in (st.get("headers") or {}).items():
        params.append({"o": "-".join(w.capitalize() for w in k.split("-")), "ot": "string", "a": "", "at": "string", "loc": "header",
                       "rule": "inject", "d": "화면이 항상 같은 값으로 보내는 헤더", "ex": v, "v": v})
    res, _ = infer.build_res(st.get("recordedRes") or "", Masker(pii=True))
    tool = {"id": infer.tool_name(st["path"], "", mode, taken), "method": st["method"], "path": st["path"], "title": title,
            "status": "review", "mode": mode, "desc": bf.get("desc") or f"{bf['name']} (업무 기록으로 만든 도구)",
            "confirmQ": f"{title} 작업을 실행할까요?" if mode == "write" else None, "params": params, "res": res, "guess": 0,
            "rec": {"function": bf["id"], "recording": bf["source"]["recordingId"]}}
    return tool


def _register(bf: dict, steps: list) -> dict:
    base = bf["source"]["base"]
    sources = src_repo.list_sources()
    existing = next((x for x in sources if x.get("proto") == "disc" and x.get("base") == base), None)
    sid = existing["id"] if existing else _slug(bf["name"], {x["id"] for x in sources}, urlsplit(base).netloc)
    current = tool_repo.all_tools().get(sid, [])
    taken = {t["id"] for t in tool_repo.flat_tools()}
    src = {"id": sid, "name": existing["name"] if existing else bf["name"], "desc": f"도구 {len(current) + len(steps)}개",
           "proto": "disc", "spec": "업무 기록으로 추론", "base": base, "auth": "세션 (서비스 계정)", "authType": "session",
           "sync": "방금", "specUrl": None}
    rid = bf["source"]["recordingId"]
    cred = credentials.get(f"rec:{rid}") or {}
    recipe = (bf.get("auth") or {}).get("recipe")
    if cred.get("username") and recipe:
        credentials.put(sid, {"type": "session", "username": cred["username"], "password": cred.get("password", ""), "recipe": recipe})
        session_auth.invalidate(sid)
    saved_src = src_repo.upsert_source(src)
    new = []
    for st in steps:
        title = bf["name"] if len(steps) == 1 else f"{bf['name']} — {st['path'].rsplit('/', 1)[-1]}"
        new.append(tool_repo.with_defaults(_tool_from_step(bf, st, taken, title), src))
    saved = tool_repo.replace_source_tools(sid, current + new)
    added_ids = {t["id"] for t in new}
    return {"source": saved_src, "tools": [t for t in saved if t["id"] in added_ids], "loginKnown": bool(cred.get("username") and recipe)}


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

`tool_repo.with_defaults`가 `rec` 같은 모르는 필드를 지우는지 확인한다(`studio.py:50-58`). 지운다면 `with_defaults` 호출 뒤 `t["rec"] = ...`를 다시 넣는다.

라우터(`routers/recorder.py`)에 추가:

```python
from app.ieum.recorder import service

MANAGER.on_stopped = service.finish


@router.get("/functions/{fid}/")
def function_get(fid: str):
    try:
        return ok(store.get_function(fid))
    except KeyError:
        return fail(404, "업무 기능을 찾을 수 없습니다.")


@router.put("/functions/{fid}/")
def function_put(fid: str, payload: Optional[dict] = Body(None)):
    try:
        return ok(service.update_function(fid, payload or {}))
    except KeyError:
        return fail(404, "업무 기능을 찾을 수 없습니다.")


@router.post("/functions/{fid}/verify/")
async def function_verify(fid: str):
    try:
        return ok(await service.reverify(fid))
    except KeyError:
        return fail(404, "업무 기능을 찾을 수 없습니다.")
    except Exception as exc:
        return fail(400, f"다시 검증하지 못했습니다. {str(exc)[:200]}")


@router.post("/functions/{fid}/confirm/")
def function_confirm(fid: str):
    try:
        return ok(service.confirm(fid))
    except KeyError:
        return fail(404, "업무 기능을 찾을 수 없습니다.")


@router.post("/functions/{fid}/register/")
def function_register(fid: str, payload: Optional[dict] = Body(None)):
    try:
        mode = (payload or {}).get("mode") or "single"
        return ok(service.register_steps(fid) if mode == "steps" else service.register_single(fid), 201)
    except KeyError:
        return fail(404, "업무 기능을 찾을 수 없습니다.")
    except ValueError as exc:
        return fail(400, str(exc))
```

- [ ] **Step 4: 시험 통과 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_service.py -v && .venv/bin/pytest tests/ -q -p no:cacheprovider`
Expected: 5개 PASS, 전체 통과

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/app/ieum/recorder/service.py apps/backend/app/ieum/routers/recorder.py apps/backend/tests/test_ieum_recorder_service.py
git commit -m "feat: 업무 기능 검토·확정·도구 등록과 기록 종료 후 분석·검증 흐름"
```

---

### Task 11: 콘솔 화면 "업무 기록"

스펙 6절의 네 화면: ① 목록, ② 새 기록 시작, ③ 기록 중(영상 왼쪽 + 타임라인 오른쪽), ④ 검토·검증.

**Files:**
- Create: `apps/web/ieum/js/menu/recorder.js`
- Modify: `apps/web/ieum/js/common/state.js:52-59` (`VIEWS`에 항목), `apps/web/ieum/js/main.js:3` (`VFN`), `main.js`의 `ACT.nav` (진입 시 새로고침), `apps/web/ieum/index.html` (스크립트 줄), `apps/web/ieum/css/console.css` (끝에 스타일)

**Interfaces:**
- Consumes: REST `/api/ieum/recorder/...`(Task 7, 10), WebSocket 메시지(Task 6), 전역 `api`, `esc`, `svg`, `toast`, `$`, `$$`, `go`, `render`, `S`, `ACT`, `INP`, `CHG`, `pageHead`
- Produces: 전역 `vRec`, `recRefresh`, `REC`(상태), `recWs`(WebSocket 다루기) — 모두 `rec` 접두사

- [ ] **Step 1: 전역 이름 충돌 확인**

Run: `grep -rn -E "\b(vRec|recRefresh|REC|recWs|recDraw|recState)\b" apps/web/ieum/js`
Expected: 출력 없음

- [ ] **Step 2: 메뉴 등록**

`state.js`의 `VIEWS`에 `src` 다음으로 넣는다.

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
   화면 ① 목록 → ② 새 기록 → ③ 기록 중(화면 중계) → ④ 검토. 승인 창은 화면 안 요소다(window.confirm 금지). */
const REC = { page:'list', list:[], fns:[], limits:null, demo:null, form:null, live:null, fn:null, busy:false };
const REC_STATUS = { recording:['기록 중','info'], analyzing:['분석 중','info'], verifying:['검증 중','info'], review:['검토 대기','warn'],
  confirmed:['확정','ok'], failed:['실패','danger'], interrupted:['중단됨','mute'] };
const REC_VERIFY = { verified:['검증됨','ok'], partial:['부분 검증','warn'], failed:['검증 실패','danger'], pending:['검증 전','mute'],
  stale:['다시 검증 필요','warn'], 'needs-login':['다시 로그인 필요','warn'] };
const REC_SOURCES = [['USER_INPUT','사용자 입력'],['PREVIOUS_STEP_OUTPUT','앞 단계 결과'],['SESSION_CONTEXT','세션 값'],
  ['SYSTEM_CONFIG','설정값'],['DERIVED','계산 값'],['CONSTANT','고정값']];
const recPill = (map, k) => { const v = map[k] || [k || '-', 'mute']; return `<span class="pill rec-${v[1]}">${esc(v[0])}</span>`; };

async function recRefresh() {
  try {
    const d = await api.get('/recorder/');
    REC.list = d.recordings; REC.fns = d.functions; REC.limits = d.limits; REC.demo = d.demo;
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
  const rows = REC.list.map(r => {
    const f = r.functionId ? fnBy[r.functionId] : null;
    const steps = f ? `${f.steps.length}단계` : '';
    const op = f ? f.policy.operation : '';
    const vs = f ? recPill(REC_VERIFY, f.verification.status) : '';
    const inc = f && f.policyIncomplete ? '<span class="pill rec-warn">정책 미완</span>' : '';
    return `<tr data-act="recOpen" data-id="${esc(r.id)}" tabindex="0"><td><b>${esc(r.name)}</b><small>${esc(r.owner || '')} · ${r.env === 'op' ? '운영' : '스테이징'}</small></td>
      <td>${recPill(REC_STATUS, f && f.status === 'confirmed' ? 'confirmed' : r.status)} ${vs} ${inc}</td><td>${esc(op)}</td><td>${steps}</td><td>${r.spanCount}개 행동</td></tr>`;
  }).join('');
  return `<div class="rec-bar"><button class="btn primary" data-act="recNew">${svg('plus', 16)}새 기록</button>
    <span class="rec-hint">동시 기록 최대 ${REC.limits ? REC.limits.maxSessions : 4}개 · 입력이 ${REC.limits ? Math.round(REC.limits.idleSec / 60) : 10}분 없으면 기록을 멈춥니다</span></div>
    ${REC.list.length ? `<table class="tbl rec-list"><thead><tr><th>업무</th><th>상태</th><th>작업 유형</th><th>단계</th><th>기록</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<div class="md-empty">아직 기록한 업무가 없습니다. <b>새 기록</b>을 눌러 업무 하나를 기록해 보세요.</div>'}`;
}

/* ② 새 기록 */
function recNewHTML() {
  const f = REC.form;
  const inp = (k, ph, o = {}) => `<input class="inp ${o.mono ? 'mono' : ''}" ${o.type ? `type="${o.type}"` : ''} data-inp="recF" data-k="${k}" value="${esc(f[k] || '')}" placeholder="${esc(ph)}" aria-label="${esc(ph)}">`;
  return `<div class="card rec-form">
    <div class="field"><label>업무 이름</label>${inp('name', '9월 발주 상세 조회')}</div>
    <div class="field"><label>대상 시스템 주소</label>${inp('base', 'http://10.20.4.30:8080/po', { mono:1 })}</div>
    <div class="field"><label>시작 화면 (선택)</label>${inp('start', '/login.do', { mono:1 })}</div>
    <div class="field"><label>환경</label><div class="rec-env">
      <label><input type="radio" name="recEnv" data-chg="recEnv" value="op" ${f.env === 'op' ? 'checked' : ''}> 운영 — 쓰기 요청은 승인 후에만 보냅니다</label>
      <label><input type="radio" name="recEnv" data-chg="recEnv" value="stg" ${f.env === 'stg' ? 'checked' : ''}> 스테이징 — 쓰기도 그대로 보냅니다</label></div></div>
    <div class="field"><label>서비스 계정 (선택)</label><div class="two">${inp('account', '아이디')}${inp('password', '비밀번호', { type:'password' })}</div>
      <small>비우거나 자동 로그인이 실패하면 기록 화면에서 직접 로그인합니다. 직접 로그인한 비밀번호는 저장하지 않습니다.</small></div>
    <div class="field"><label>조회용 POST 경로 (선택)</label>${inp('readPost', '/po/searchPost.do', { mono:1 })}<small>검색을 POST 로 하는 화면이면 적어 주세요. 승인 없이 보냅니다.</small></div>
    <div class="field"><label>기록하는 사람</label>${inp('owner', '홍길동')}</div>
    <div class="rec-actions"><button class="btn" data-act="recBack">취소</button>${REC.demo ? '<button class="btn" data-act="recDemo">시연용 값 채우기</button>' : ''}
      <button class="btn primary" data-act="recStart" ${REC.busy ? 'disabled' : ''}>${REC.busy ? '브라우저를 띄우는 중…' : '기록 시작'}</button></div></div>`;
}

/* ③ 기록 중 */
function recLiveHTML() {
  const L = REC.live;
  const tl = L.spans.slice(-60).map(s => `<li><b>${s.seq}</b> ${esc(((s.action.target || {}).text || s.action.type || '').slice(0, 24))}
      ${s.network.map(n => `<div class="${n.held ? 'w' : ''}">${esc(n.method)} ${esc(n.path)} ${n.status == null ? '' : n.status}${n.decision ? ` · ${esc(n.decision)}` : ''}</div>`).join('')}</li>`).join('');
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
        <p>${L.env === 'op' ? '운영 데이터가 바뀝니다. 2분 안에 답하지 않으면 보내지 않습니다.' : ''}</p>
        <button class="btn danger-fill" data-act="recApprove" data-ok="1">승인하고 보내기</button> <button class="btn" data-act="recApprove" data-ok="0">보내지 않기</button></div>` : ''}
      ${L.dialog ? `<div class="rec-hold" role="dialog" aria-modal="true"><b>대상 사이트의 확인 창</b><p>${esc(L.dialog.message)}</p>
        <button class="btn primary" data-act="recDialog" data-ok="1">확인</button> ${L.dialog.type !== 'alert' ? '<button class="btn" data-act="recDialog" data-ok="0">취소</button>' : ''}</div>` : ''}
    </div>
    <aside class="rec-side"><div class="label">타임라인</div><ol class="rec-tl">${tl || '<li class="mute">화면을 클릭하면 여기에 쌓입니다</li>'}</ol>
      <div class="rec-count">요청 ${L.spans.reduce((a, s) => a + s.network.length, 0)} · 쓰기 ${L.spans.reduce((a, s) => a + s.network.filter(n => n.held).length, 0)}</div></aside></div></div>`;
}

/* ④ 검토 */
function recReviewHTML() {
  const f = REC.fn, v = f.verification || {};
  const inputs = f.inputs.map(i => `<tr class="${i.confidence === 'low' ? 'low' : ''}"><td class="mono">${esc(i.name)}</td><td>${esc(i.screenLabel || '-')}</td>
      <td><select class="inp sm" data-chg="recSrc" data-n="${esc(i.name)}">${REC_SOURCES.map(([k, l]) => `<option value="${k}" ${i.source === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${i.confidence === 'low' ? '<span class="pill rec-warn">확인 필요</span>' : ''}</td><td class="mono">${esc(i.ex)}</td></tr>`).join('');
  const shot = (seq, w) => seq ? `<img class="rec-shot" alt="행동 ${seq} ${w}" src="/api/ieum/recorder/recordings/${esc(f.source.recordingId)}/shots/${seq}-${w}.jpg">` : '';
  const steps = f.steps.map((s, i) => { const ev = (f.evidence[s.id] || [])[0];
    return `${i ? '<div class="rec-arrow">→</div>' : ''}<div class="rec-step"><b>${esc(s.id)} · ${s.role === 'core' ? '핵심' : '선행'}</b>
      <div class="mono">${esc(s.method)} ${esc(s.path)}</div>
      ${s.params.map(p => `<small>${esc(p.a)} ← ${esc(p.from)}${p.confidence === 'low' ? ' ⚠' : ''}</small>`).join('<br>')}
      ${Object.keys(s.outputs).length ? `<small>꺼내는 값: ${Object.entries(s.outputs).map(([k, p]) => `${esc(k)}=${esc(p)}`).join(', ')}</small>` : ''}
      <div class="rec-shots">${shot(ev, 'pre')}${shot(ev, 'post')}</div></div>`; }).join('');
  const excl = f.excluded.map(x => `<li><code>${esc(x.method)} ${esc(x.path)}</code> · ${esc(x.role)} — ${esc(x.why)}
      ${x.role !== 'auth' && x.role !== 'denied' ? `<button class="btn sm" data-act="recPromote" data-m="${esc(x.method)}" data-p="${esc(x.path)}">단계로 올리기</button>` : ''}</li>`).join('');
  const runs = (v.runs || []).map(r => `<li>${r.ok === true ? '✅' : r.ok === false ? '❌' : '⏭'} ${r.kind === 'same-values' ? '같은 값' : '다른 값'}
      ${r.reason ? `<small>${esc(r.reason)}</small>` : ''}${r.note ? `<small>${esc(r.note)}</small>` : ''}</li>`).join('');
  const sel = (k, opts) => `<select class="inp sm" data-chg="recPol" data-k="${k}"><option value="">선택</option>${opts.map(o => `<option ${f.policy[k] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  return `<div class="rec-rv-head"><div><h3>${esc(f.name)}</h3><small>${esc(f.policy.operation)} · 위험 ${esc(f.policy.risk)} · 승인 ${esc(f.policy.approval)} · 실행 ${esc(f.executionMode || '-')}</small></div>
    <div><button class="btn" data-act="recBack">목록</button> <button class="btn" data-act="recVerify">다시 검증</button> <button class="btn primary" data-act="recConfirm">확정</button></div></div>
    ${(f.notes || []).map(n => `<div class="rec-msg">${esc(n)}</div>`).join('')}
    <div class="rec-rv"><div>
      <div class="label">입력값 (AI 가 이 업무를 부를 때 넣는 값)</div>
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
    </aside></div>`;
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
  else if (m.t === 'dialog') L.dialog = m;
  else if (m.t === 'tabs') { L.tabs = m.tabs; L.active = m.active; }
  else if (m.t === 'login' || m.t === 'notice') L.msg = m.msg;
  else if (m.t === 'limit') L.msg = '행동 기록 상한(300개)에 도달했습니다. 기록을 종료해 주세요.';
  else if (m.t === 'status') { L.status = m.status; if (m.status === 'review') recOpenFn(L.id); if (m.status === 'failed') L.msg = '분석·검증에 실패했습니다. ' + (m.error || ''); }
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
    recWs.close(); REC.live = null; REC.page = 'review'; render();
  } catch (e) { toast(e.message, 'warn'); }
}

async function recSaveFn(patch) {
  try { REC.fn = await api.put(`/recorder/functions/${REC.fn.id}/`, patch); render(); } catch (e) { toast(e.message, 'warn'); }
}

Object.assign(INP, { recF: el => { REC.form[el.dataset.k] = el.value; } });
Object.assign(CHG, {
  recEnv: el => { REC.form.env = el.value; },
  recSrc: el => recSaveFn({ inputs:[{ name:el.dataset.n, source:el.value }] }),
  recPol: el => recSaveFn({ policy:{ [el.dataset.k]: el.value || null } }),
});
Object.assign(ACT, {
  recNew: () => { REC.form = { name:'', base:'', start:'', env:'op', account:'', password:'', readPost:'', owner:WS.user || '' }; REC.page = 'new'; render(); },
  recBack: () => { recWs.close(); REC.page = 'list'; REC.live = null; REC.fn = null; recRefresh(); render(); },
  recDemo: () => { Object.assign(REC.form, REC.demo); render(); },
  recStart: async () => {
    REC.busy = true; render();
    try {
      const out = await api.post('/recorder/recordings/', REC.form);
      REC.live = { id:out.id, name:REC.form.name, env:REC.form.env, status:'recording', spans:[], tabs:[], active:0, hold:null, dialog:null, paused:false, msg:'' };
      REC.page = 'live'; REC.busy = false; render(); recBind(); recWs.open(out.id, out.token);
      try { sessionStorage.setItem('ieum.rec.' + out.id, out.token); } catch (e) {}
    } catch (e) { REC.busy = false; render(); toast(e.message, 'warn'); }
  },
  recOpen: a => { const r = REC.list.find(x => x.id === a.dataset.id); if (!r) return;
    if (r.status === 'recording') { let tok = null; try { tok = sessionStorage.getItem('ieum.rec.' + r.id); } catch (e) {}
      if (!tok) { toast('이 기록은 다른 탭에서 시작되어 이 탭에서는 화면을 열 수 없습니다.', 'info'); return; }
      REC.live = { id:r.id, name:r.name, env:r.env, status:'recording', spans:[], tabs:[], active:0, hold:null, dialog:null, paused:false, msg:'' };
      REC.page = 'live'; render(); recBind(); recWs.open(r.id, tok); return; }
    recOpenFn(r.id); },
  recPause: () => { REC.live.paused = !REC.live.paused; recWs.send({ t:'pause', on:REC.live.paused }); recPatch(); },
  recStop: async () => { try { await api.post(`/recorder/recordings/${REC.live.id}/stop/`); REC.live.status = 'analyzing'; REC.live.msg = '기록을 마쳤습니다. 분석하고 다시 실행해 검증하는 중입니다…'; recPatch(); } catch (e) { toast(e.message, 'warn'); } },
  recApprove: a => { if (!REC.live.hold) return; recWs.send({ t:'approve', id:REC.live.hold.id, ok:a.dataset.ok === '1' }); REC.live.hold = null; recPatch(); },
  recDialog: a => { recWs.send({ t:'dialog', ok:a.dataset.ok === '1' }); REC.live.dialog = null; recPatch(); },
  recTab: a => recWs.send({ t:'tab', index:+a.dataset.i }),
  recPromote: a => recSaveFn({ promote:{ method:a.dataset.m, path:a.dataset.p } }),
  recVerify: async () => { try { REC.fn = await api.post(`/recorder/functions/${REC.fn.id}/verify/`); render(); toast('다시 검증했습니다.', 'ok'); } catch (e) { toast(e.message, 'warn'); } },
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
.rec-top.op .env{background:#fef3f2;color:#b42318;border:1px solid #fecdca;border-radius:10px;padding:0 8px;font-size:12px}
.rec-top .env{border:1px solid var(--line-2);border-radius:10px;padding:0 8px;font-size:12px}
.rec-top .sp{flex:1}
.rec-tabs{display:flex;gap:4px}
.rec-msg{padding:8px 12px;border:1px solid #fedf89;background:#fffaeb;border-radius:4px;font-size:13px}
.rec-body{display:flex;gap:10px;align-items:flex-start}
.rec-screen{position:relative;flex:3;min-width:0}
.rec-screen canvas{width:100%;height:auto;aspect-ratio:1280/800;border:1px solid var(--line-2);background:#fff;cursor:pointer;display:block}
#recIme{position:absolute;left:0;top:0;width:1px;height:1px;opacity:0}
.rec-hold{position:absolute;left:50%;top:30%;transform:translateX(-50%);width:min(440px,90%);background:#fff;border:2px solid #dc6803;border-radius:6px;padding:14px;box-shadow:0 8px 24px #0003}
.rec-side{flex:1.1;min-width:220px;border:1px solid var(--line-2);border-radius:4px;padding:8px;max-height:640px;overflow:auto;background:var(--surface)}
.rec-tl{list-style:none;margin:6px 0;padding:0;font-size:12.5px}
.rec-tl li{padding:4px 0;border-bottom:1px solid var(--line)}
.rec-tl li div{color:var(--text-2);font-family:var(--mono,monospace);font-size:11.5px}
.rec-tl li div.w{color:#b54708}
.rec-count{color:var(--text-3);font-size:12px}
.rec-rv-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.rec-rv{display:grid;grid-template-columns:2fr 1fr;gap:14px}
.rec-rv tr.low,.rec-pol.low{background:#fffaeb}
.rec-steps{display:flex;align-items:stretch;gap:6px;flex-wrap:wrap;margin:6px 0 12px}
.rec-step{flex:1;min-width:220px;border:1px solid var(--primary-line);border-radius:6px;padding:8px;font-size:13px}
.rec-arrow{align-self:center;font-size:18px;color:var(--text-3)}
.rec-shots{display:flex;gap:4px;margin-top:6px}.rec-shot{width:50%;border:1px solid var(--line-2)}
.rec-excl{font-size:13px;padding-left:16px}
.rec-runs{list-style:none;padding:0;margin:6px 0;font-size:13px}.rec-runs small{color:var(--text-3);margin-left:6px}
.rec-pol{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:3px 4px;font-size:13px}
@media (max-width:1100px){.rec-body{flex-direction:column}.rec-side{width:100%}.rec-rv{grid-template-columns:1fr}}
```

- [ ] **Step 5: 문법·전역·금지 API 점검**

Run:
```bash
node --check apps/web/ieum/js/menu/recorder.js
grep -n -E "window\.(confirm|alert|prompt)|\bconfirm\(|\balert\(" apps/web/ieum/js/menu/recorder.js || echo "금지 API 없음"
grep -rn -E "^(const|let|function) (vRec|recRefresh|REC|recWs|recPill|recOnMsg|recPatch|recBind|recOpenFn|recSaveFn|recListHTML|recNewHTML|recLiveHTML|recReviewHTML|REC_STATUS|REC_VERIFY|REC_SOURCES)\b" apps/web/ieum/js | awk -F: '{print $3}' | sort | uniq -d
```
Expected: 문법 오류 없음, "금지 API 없음", 마지막 명령 출력 없음(중복 전역 없음)

- [ ] **Step 6: 실제 화면으로 확인**

Run: `lsof -ti tcp:8000 -sTCP:LISTEN | xargs kill 2>/dev/null; cd apps/backend && .venv/bin/uvicorn app.main:app --port 8000` (다른 터미널)
그다음 브라우저로 `http://127.0.0.1:8000/ieum/` → 왼쪽 **업무 기록** → **새 기록** → **시연용 값 채우기** → **기록 시작**.
확인할 것:
- 화면 영상이 뜨고 클릭이 들어간다. 오른쪽 타임라인에 행동과 요청이 쌓인다.
- 발주 현황 → 조회 → 첫 행 클릭 → **기록 종료** → "분석·검증 중" 뒤 검토 화면이 열린다.
- 검토 화면에 `s1 GET /poList.do → s2 GET /poDetail.do`, 입력 `fromDt`/`toDt`, 검증 두 줄이 보인다.
- 발주 등록에서 **저장**을 누르면 승인 창이 뜨고, "보내지 않기"를 누르면 발주가 생기지 않는다.

- [ ] **Step 7: 커밋**

```bash
git add apps/web/ieum/js/menu/recorder.js apps/web/ieum/js/common/state.js apps/web/ieum/js/main.js apps/web/ieum/index.html apps/web/ieum/css/console.css
git commit -m "feat: 이음 콘솔에 업무 기록 메뉴를 더한다 — 목록·시작·기록 중·검토"
```

---

### Task 12: 전 구간 e2e 시험과 문서

**Files:**
- Create: `apps/backend/tests/test_ieum_recorder_e2e.py`
- Modify: `CLAUDE.md` ("여러 파일을 읽어야 보이는 것"에 레코더 문단, "밟으면 아픈 것들"에 두 줄)

**Interfaces:**
- Consumes: 모든 작업의 공개 인터페이스. 시험은 WebSocket으로 클릭·입력을 보내고, 표적 좌표는 같은 프로세스의 세션 페이지에서 `bounding_box()`로 얻는다(사람 눈 대신).

- [ ] **Step 1: e2e 시험 작성**

```python
# apps/backend/tests/test_ieum_recorder_e2e.py
"""업무 기록 전 구간: 시연용 레거시 사이트에서 사람 대신 WebSocket 으로 클릭·입력을 보낸다.

읽기 업무(조회 → 상세)가 2단계 업무 기능과 poNo 연결이 되고 두 번의 검증을 통과하는지, 운영 쓰기가 승인 없이는
시연 사이트에 닿지 않는지, 한글 IME 입력이 깨지지 않는지 본다.
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

    def __init__(self, base):
        self.base = base
        r = httpx.post(base + "/api/ieum/recorder/recordings/", json={
            "name": "업무", "owner": "시험", "base": base + "/demo-legacy/po", "start": "/login.do", "env": "op",
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

    def _session(self):
        from app.ieum.recorder.manager import MANAGER
        return MANAGER, MANAGER.get(self.rid)

    def run(self, coro):
        mgr, _ = self._session()
        return asyncio.run_coroutine_threadsafe(coro, mgr.loop).result(30)

    def click(self, sel):
        from app.ieum.recorder import relay
        _, s = self._session()
        b = self.run(s.page.locator(sel).first.bounding_box())
        self.ws.send(json.dumps({"t": "click", "x": b["x"] + b["width"] / 2, "y": b["y"] + b["height"] / 2, "w": relay.VIEW_W, "h": relay.VIEW_H}))
        time.sleep(1.2)

    def text(self, s):
        self.ws.send(json.dumps({"t": "text", "data": s}))
        time.sleep(0.3)

    def key(self, k):
        self.ws.send(json.dumps({"t": "key", "key": k}))
        time.sleep(0.2)

    def stop_and_wait(self):
        httpx.post(self.base + f"/api/ieum/recorder/recordings/{self.rid}/stop/", timeout=60)
        end = time.time() + 120
        while time.time() < end:
            rec = httpx.get(self.base + f"/api/ieum/recorder/recordings/{self.rid}/").json()["resultData"]
            if rec["status"] in ("review", "failed"):
                return rec
            time.sleep(0.5)
        raise AssertionError("분석·검증이 끝나지 않았다")


def test_읽기_업무가_두_단계_업무_기능이_되고_검증된다(ieum_server):
    d = Driver(ieum_server)
    d.click("text=발주 현황")
    d.click("#btnSearch")
    d.click("tr[onclick] >> nth=0")
    rec = d.stop_and_wait()
    assert rec["status"] == "review", rec.get("error")
    bf = httpx.get(ieum_server + f"/api/ieum/recorder/functions/{rec['functionId']}/").json()["resultData"]
    assert [s["path"] for s in bf["steps"]] == ["/poList.do", "/poDetail.do"]
    po = next(p for p in bf["steps"][1]["params"] if p["a"] == "poNo")
    assert po["from"].startswith("s1.") and po["source"] == "PREVIOUS_STEP_OUTPUT"
    assert bf["verification"]["status"] in ("verified", "partial")
    assert bf["verification"]["runs"][0]["ok"] is True and bf["executionMode"] == "session"


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
    listing = httpx.get(ieum_server + "/demo-legacy/po/poList.do", params={"fromDt": "20261001", "toDt": "20261031"},
                        headers={"X-Requested-With": "XMLHttpRequest"}, cookies=d.run(_cookies(d)), timeout=10).json()
    assert listing["totalCnt"] == 0                                 # 거절한 저장은 발주를 만들지 않았다
    d.msgs.clear()
    d.click("#btnSave")
    hold = d.wait(lambda m: m["t"] == "hold")
    d.ws.send(json.dumps({"t": "approve", "id": hold["id"], "ok": True}))
    d.wait(lambda m: m["t"] == "hold-end" and m["decision"] == "approve")
    time.sleep(1.0)
    listing = httpx.get(ieum_server + "/demo-legacy/po/poList.do", params={"fromDt": "20261001", "toDt": "20261031"},
                        headers={"X-Requested-With": "XMLHttpRequest"}, cookies=d.run(_cookies(d)), timeout=10).json()
    assert listing["totalCnt"] == 1


async def _cookies_coro(s):
    return {c["name"]: c["value"] for c in await s.ctx.cookies()}


def _cookies(d):
    _, s = d._session()
    return _cookies_coro(s)


def test_한글_입력이_깨지지_않는다(ieum_server):
    d = Driver(ieum_server)
    d.click("text=발주 등록")
    d.click("#vendNm")
    for _ in range(4):
        d.key("Backspace")
    d.text("한빛")
    _, s = d._session()
    assert d.run(s.page.input_value("#vendNm")) == "한빛"
```


- [ ] **Step 2: 실행**

Run: `cd apps/backend && .venv/bin/pytest tests/test_ieum_recorder_e2e.py -v`
Expected: 3개 PASS (각 20~60초)

실패하면 고칠 곳:
- 단계가 `["/poList.do", "/poDetail.do"]`가 아니면 `analyze._shown`이 `post.aria`에서 응답 값을 찾는지 기록 JSON(`GET /recordings/{rid}/`)의 `spans[].post.aria`를 열어 확인한다.
- 검증이 `auth_expired`면 `replay.verify`가 세션 쿠키를 읽기 전에 브라우저가 닫히지 않았는지(`service.finish`의 `finally`가 검증 뒤에 있는지) 확인한다.

- [ ] **Step 3: 전체 시험**

Run: `cd apps/backend && .venv/bin/pytest tests/ -q -p no:cacheprovider`
Expected: 모두 통과

- [ ] **Step 4: `CLAUDE.md` 갱신**

"**이음의 배포는 별도 프로세스다**" 문단 바로 뒤에 넣는다.

```markdown
**업무 기록은 이음 안의 별도 메뉴다** (`app/ieum/recorder/`, 화면 `apps/web/ieum/js/menu/recorder.js`, 설계
`docs/superpowers/specs/2026-10-10-ieum-web-recorder-design.md`). 사람이 콘솔 안에서 서버 브라우저를 조작해 업무 하나를
기록하면, 행동 묶음(ActionSpan: 행동 + 직전/직후 ARIA 스냅샷 + 네트워크)을 쌓고(`trace.py`), 끝나면 규칙 기반으로 업무
기능(단계·값 연결·입력값 출처·정책)을 만들고(`analyze.py`), 같은 값·다른 값으로 다시 실행해 검증한다(`replay.py`).
화면은 CDP 스트리밍을 WebSocket(`/api/ieum/recorder/ws/{id}?token=`)으로 중계하고 입력을 CDP 로 되돌려 넣는다(`relay.py`).
무엇을 눌렀는지는 영상이 아니라 페이지 안 기록 스크립트(`trace.INIT_JS`)로 안다. **쓰기 판단은 버튼 글자가 아니라 나가는
요청으로 한다**(`guard.py`) — 글자로 하면 "승인대기" 행이 금지어 "승인"에 걸린다. 운영 쓰기는 붙잡아 승인받고, 자동 탐색과
달리 **가짜 응답을 만들지 않는다**(가짜 응답을 받은 화면은 생성 번호가 없어 다음 단계로 못 간다). 판정 로직은 크롤러와
`discovery/capture.py` 를 함께 쓰지만, 크롤러는 동기·레코더는 비동기 Playwright 라 Playwright 호출은 각자 한다.
레코더의 Playwright 는 uvicorn 이벤트 루프에 산다(`manager.MANAGER.loop`). 여러 단계를 도구 하나로 실행하는 것은
아직 없다 — 지금은 단계가 하나인 업무만 도구 하나가 된다.
```

"밟으면 아픈 것들"에 두 줄:

```markdown
- **레코더 시험은 서버의 이벤트 루프에서 세션을 만진다.** Playwright 비동기 객체는 만든 루프에 묶여서, 시험 코드에서 `await s.page...`
  를 그냥 부르면 다른 루프라 멈춘다. `asyncio.run_coroutine_threadsafe(coro, MANAGER.loop)` 로 넣는다(`test_ieum_recorder_e2e.py`).
- **레코더 WebSocket 은 시작 응답의 토큰이 있어야 열린다.** 콘솔에 사용자 로그인이 없어 남의 기록 화면을 막는 장치가 이것뿐이다.
  토큰은 탭의 `sessionStorage` 에만 있으므로 다른 탭에서는 기록 중 화면을 다시 열 수 없다(의도된 동작).
```

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/tests/test_ieum_recorder_e2e.py CLAUDE.md
git commit -m "test: 업무 기록 전 구간 시험과 CLAUDE.md 갱신"
```

---

## 자체 점검 결과

**스펙 대응**

| 스펙 절 | 작업 |
|---|---|
| 1 전체 구조, 브라우저 실행 위치, 운영 기본값, 격리 범위 | 4, 6, 7 (실행 위치는 "스펙과 다르게 정한 점" 2) |
| 2 데이터 모델 (기록, ActionSpan, 업무 기능, 저장 위치) | 2, 5, 8 |
| 3 분석 6단계 | 8 |
| 4 Replay (두 번 실행, 실행 방식, 판정, 실패 코드, 쓰기, 세션 끊김, 안전장치) | 9, 10 |
| 5 쓰기 처리 | 3, 6 |
| 6 화면 4개, 콘솔 규칙 | 11 |
| 7 오류 처리 표 | 3(시간 초과), 6(상한·유휴·자동 로그인 실패·대화상자·새 창), 2(재시작), 5(크기 상한·마스킹 실패), 8(핵심 없음), 11(연결 끊김) |
| 8 시험 계획 | 1~12 각 작업의 시험, 12의 e2e |
| 9 구현 순서 | 작업 순서 1~12 |

**점검 중 보탠 것**
- 기록 중 세션 만료 표시: 작업 5에 `Trace(on_closed=...)` 자리를 두고, 작업 6의 세션이 묶음을 닫을 때마다 로그인 화면인지 보고 `login{state:"needed"}`를 보낸다.
- 파일 업로드 안내: 작업 6에서 `filechooser` 이벤트를 받아 `notice`를 보내고, 작업 11의 화면이 안내 띠에 띄운다.
- 가드의 로그인 판정이 `is_secret_key`를 쓰면 `csrfToken`이 든 저장 요청을 로그인으로 오인해 승인 없이 보낼 수 있었다. 비밀번호 계열 이름만 보도록 고치고 시험을 더했다(작업 3, Review Focus 5).

이 두 표시는 자동 시험 없이 작업 11의 실제 화면 확인에서 본다.

**타입·이름 일관성**: `Guard.decided_requests`(3) ↔ `Trace.on_response`(5), `MANAGER.on_stopped`(6) ↔ `service.finish(rid, session)`(10), `analyze.get_path/leaves`(8) ↔ `replay`(9), `vault_key("rec:<id>")`(6) ↔ `replay.verify`·`service._register`의 `credentials.get(f"rec:{rid}")`(9, 10)를 맞췄다.
