# 이음 업무 도구 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 검증한 조회 업무를 "도구 후보로 등록"하면 업무 하나가 변환 스튜디오의 도구 하나(`kind: "flow"`)가 되고, 그 도구를 부르면 기록한 단계를 이어 실행한다(인자 없음 → 목록, `index`/`match` → 상세).

**Architecture:** 레코더 재실행의 단계 실행 루프와 판정을 `app/ieum/flow/core.py` 로 옮겨 레코더 검증과 게이트웨이가 함께 쓴다. `flow/runner.py` 가 업무 도구 하나를 실행하고(고르기·인증·실행 기록), `gateway/engine.invoke` 가 `kind == "flow"` 이면 그리로 넘긴다. 등록은 `recorder/service.register_flow` 가 단계 사본을 얼려 스튜디오 저장소에 넣고, 화면(업무 기록·스튜디오·테스트 실행)은 그 결과를 보여 준다.

**Tech Stack:** Python 3.10 (FastAPI, httpx, asyncio), 바닐라 JS 콘솔(classic script), pytest + Playwright(브라우저 시험).

**Spec:** `docs/superpowers/specs/2026-10-12-ieum-workflow-tool-design.md` (2판). 업무 기록 규칙은 `docs/superpowers/specs/2026-10-10-ieum-web-recorder-design.md`, 프로젝트 규칙은 `CLAUDE.md`.

## Global Constraints

- Python 3.10.11 — 3.11+ 문법 금지(`match` 문, `ExceptionGroup`, `typing.Self` 등).
- 주석·UI 문구·커밋 메시지는 한국어. 변수·함수명은 영어.
- 새 의존성 금지(백엔드·프런트엔드 모두). 등록 도메인 판정 등은 이미 있는 코드만 쓴다.
- `window.confirm`·`alert`·`prompt` 금지.
- 콘솔 JS 는 classic script — 새 전역 이름을 만들기 전에 `apps/web/ieum/js` 전체를 grep 한다. 업무 기록 화면 전역은 `RECR`.
- 이음 상태 파일을 읽고-고쳐-쓰는 구간은 `with store.LOCK:`(레코더) / 저장소 함수의 `LOCK` 안에서. LOCK 을 쥔 채 네트워크·프로세스를 기다리지 않는다.
- 가린 값(`is_masked`)은 경로·헤더·쿼리·폼·JSON 본문 어디로도 보내지 않는다. 경로 자리 값이 `.`·`..` 이거나 `/`·`\` 를 품으면 보내지 않는다. 정규화한 최종 주소로 `scope.blocked` 를 다시 본다.
- 운영 주소로 가는 업무 도구 단계 사이 간격 0.6초. 한 호출 상한 60초, 단계 상한 10.
- 응답 원문은 도구 정의(단계 사본)에 넣지 않는다. 판정용 모양(`shape`)·`errSeen` 만 넣는다.
- 업무 도구는 **조회 단계만**(GET/HEAD, 또는 사람이 조회로 확정한 POST). `exec: "browser"` 단계가 있으면 만들지 않는다.
- 배포한 MCP 서버 프로세스(`app.ieum.runtime.server`)가 `app.ieum.flow` 를 불러오므로 `flow` 는 Playwright·레코더 세션(`recorder.session`, `recorder.manager`)을 import 하지 않는다.
- 외부 사이트에 접속하는 시험 금지 — 로컬 http.server·문자열 HTML·`ieum_server` 픽스처만.
- 시험: `cd apps/backend && caffeinate -dimsu .venv/bin/pytest …` (Rosetta 셸이면 `arch -x86_64` 를 앞에). 전체는 `tests/ -q -p no:warnings`.
- `apps/backend/.env`·`.mcp.json` 은 커밋하지 않는다. `.superpowers/` 는 스테이징하지 않는다. `git add -A`/`.` 금지 — 파일을 이름으로 더한다.

## Review Focus

1. 목록을 본 뒤 `index` 로 다시 부를 때 그 사이 목록 순서가 바뀐 경우 — 매 호출이 목록을 새로 받으므로 `index` 는 **새 목록**의 순번이다. 결과의 `picked.text` 로 무엇을 골랐는지 알 수 있어야 한다(Task 2 시험).
2. `match` 에 띄어쓰기·대소문자가 다른 글자("고려 아연", "KOREA") — 공백을 모두 빼고 소문자로 비교한다(Task 2 시험).
3. 업무 입력 이름이 `index`/`match` 와 겹치는 업무(예: 원래 쿼리가 `index`) — 고르기 인자는 `index_`·`match_` 로 피하고 실행기는 도구의 `flow.pick.args` 에 적힌 이름을 읽는다(Task 4 시험).
4. 세션 인증 원본에서 둘째 단계가 로그인 화면으로 튕김 — 한 번 다시 로그인해 **처음 단계부터** 다시 실행, 두 번째도 튕기면 `auth_expired`(Task 2 시험).
5. 마지막 단계가 JSON 인 업무(목록 HTML → 상세 JSON API) — 결과는 `convert_response` 로 바뀐 JSON 이고 `picked` 가 붙는다(Task 2 시험).

---

## 파일 구조

| 파일 | 할 일 |
|---|---|
| `apps/backend/app/ieum/flow/__init__.py` (새) | 패키지 표시만 |
| `apps/backend/app/ieum/flow/core.py` (새) | 단계 실행 핵심: `encode`, `judge`, `_looks_error`, `HttpTransport`, `NeedsValue`, `normalize_path`, `value_of`, `run_steps` |
| `apps/backend/app/ieum/flow/runner.py` (새) | 업무 도구 실행: 인자 확인, 고르기(목록·index·match), 단계별 인증, 실행 기록, `invoke(source, tool, args, ctx)` |
| `apps/backend/app/ieum/recorder/replay.py` | `core` 로 옮긴 것을 불러 쓰고 `run_once` 는 `core.run_steps` 를 부르는 얇은 함수로 |
| `apps/backend/app/ieum/gateway/engine.py` | `invoke` 가 `kind == "flow"` 면 `flow.runner.invoke` |
| `apps/backend/app/ieum/recorder/service.py` | `register_flow`, 등록=확정, 상태 `registered`, 정책 무시 |
| `apps/backend/app/ieum/routers/recorder.py` | `register/` 의 `mode: flow|steps|single`, `confirm/` 제거 |
| `apps/web/ieum/js/menu/recorder.js` | 정책 카드·확정 버튼 제거, "도구 후보로 등록" 카드, 목록 "등록 완료"·등록 개수 |
| `apps/web/ieum/js/menu/studio.js`, `apps/web/ieum/js/common/state.js`, `apps/web/ieum/js/common/convert.js` | 업무 도구 단계 흐름·안내 띠, 미리보기·실행 기록 단계별 |
| 시험 (새) `tests/test_ieum_flow_core.py`, `tests/test_ieum_flow_runner.py`, `tests/test_ieum_flow_register.py`, `tests/test_ieum_flow_console.py` | |
| `CLAUDE.md`, 업무 기록 설계 문서 | 업무 도구 문단 |

---

### Task 1: 단계 실행 핵심을 `flow/core.py` 로 옮긴다

**Files:**
- Create: `apps/backend/app/ieum/flow/__init__.py`, `apps/backend/app/ieum/flow/core.py`
- Modify: `apps/backend/app/ieum/recorder/replay.py:15-418`
- Test: `apps/backend/tests/test_ieum_flow_core.py`

**Interfaces:**
- Produces:
  - `core.encode(pairs: Dict[str, str], charset: Optional[str]) -> str`
  - `core.judge(status, location, ctype, text, step, headers_sent) -> Tuple[bool, str, Any]` (지금 `replay.judge` 그대로. `step` 의 `recordedData` 대신 `recordedShape`(list) 도 읽는다 — 아래)
  - `core.HttpTransport(cookies, host=None, transport=None)` / `.send(step, url, headers, params, form, json_body)` (지금 그대로)
  - `core.NeedsValue`, `core.normalize_path(url) -> str`, `core.value_of(p, inputs, raw, outs, needs) -> Optional[str]`
  - `async core.run_steps(steps: List[dict], base: str, inputs: Dict[str,str], raw, http, browser, ask_write, gap: float, *, needs: Dict[str,bool], kind="same-values", relogin=None, pace=None, stop_after: Optional[str]=None) -> dict`
    결과: `{"kind", "ok", "steps": [...], "reason", "wrote", "data": {step_id: 판정에서 얻은 data}}` — `stop_after` 단계를 마치면 거기서 `ok=True` 로 끝낸다.

`recordedShape`: 업무 도구 단계 사본은 `recordedData`(사본 전체)를 들고 다니지 않고 판정에 쓰는 모양만 든다. `judge` 의 HTML 분기에서
`before = set(step["recordedShape"]) if "recordedShape" in step else htmltable.shape(step.get("recordedData") or {})`,
JSON 분기에서 `kb = set(step["recordedShape"]) if "recordedShape" in step else _keys(before)` 로 읽는다(JSON 의 `recordedShape` 는 `_keys` 결과 목록).

- [ ] **Step 1: 실패하는 시험을 쓴다** (`tests/test_ieum_flow_core.py`)

```python
"""flow.core: 레코더 재실행에서 옮긴 단계 실행 핵심. replay 와 같은 결과를 내야 하고, Playwright 를 불러오지 않아야 한다."""
import asyncio
import subprocess
import sys

from app.ieum.flow import core
from app.ieum.recorder import replay


def test_replay_는_core_의_같은_함수를_쓴다():
    assert replay.judge is core.judge
    assert replay.encode is core.encode
    assert replay.HttpTransport is core.HttpTransport


def test_core_는_playwright_와_레코더_세션을_불러오지_않는다():
    code = ("import sys, app.ieum.flow.core, app.ieum.flow.runner; "
            "bad=[m for m in sys.modules if m.startswith(('playwright','app.ieum.recorder.session','app.ieum.recorder.manager'))]; "
            "print(bad); sys.exit(1 if bad else 0)")
    r = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, cwd=".")
    assert r.returncode == 0, r.stdout + r.stderr


def test_recordedShape_로도_모양을_판정한다():
    page = "<table><tr><th>이름</th><th>주소</th></tr><tr><td>가</td><td>나</td></tr></table>"
    from app.ieum.recorder import htmltable
    shape = sorted(htmltable.shape(htmltable.to_data(page)))
    ok, why, _ = core.judge(200, None, "text/html", page, {"kind": "html", "recordedShape": shape}, {})
    assert ok and why == ""
    ok, why, _ = core.judge(200, None, "text/html", "<p>전혀 다른 화면</p>", {"kind": "html", "recordedShape": shape}, {})
    assert (ok, why) == (False, "shape_mismatch")


class _T:
    mode = "session"

    def __init__(self, pages):
        self.pages, self.sent = pages, []

    async def send(self, step, url, headers, params, form, body):
        self.sent.append(url)
        return 200, None, "text/html", self.pages[step["id"]]


def test_stop_after_는_그_단계까지만_보내고_data_를_돌려준다():
    steps = [{"id": "s1", "method": "GET", "path": "/a", "params": [], "kind": "html", "outputs": {}},
             {"id": "s2", "method": "GET", "path": "/b", "params": [], "kind": "html", "outputs": {}}]
    t = _T({"s1": "<ul><li><a href='/x/1'>가</a></li><li><a href='/x/2'>나</a></li></ul>", "s2": "<p>상세</p>"})
    out = asyncio.new_event_loop().run_until_complete(core.run_steps(
        steps, "http://127.0.0.1:9", {}, {}, t, None, None, 0, needs={}, stop_after="s1"))
    assert out["ok"] and [s["id"] for s in out["steps"]] == ["s1"]
    assert t.sent == ["http://127.0.0.1:9/a"]
    assert "s1" in out["data"]
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd apps/backend && caffeinate -dimsu .venv/bin/pytest tests/test_ieum_flow_core.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.ieum.flow'`

- [ ] **Step 3: 옮긴다**

`app/ieum/flow/__init__.py`:
```python
"""업무 도구: 기록한 여러 단계를 도구 하나로 실행한다(레코더 검증과 같은 실행 핵심을 쓴다)."""
```

`app/ieum/flow/core.py` 에 `replay.py` 의 다음을 **그대로 옮긴다**(동작 변경 없음, 위 `recordedShape` 두 줄만 더함):
`TIMEOUT`, `UA`, `_ERR_KEY`, `_ERR_TEXT`, `encode`, `_keys`, `_TITLE`, `ERR_PAGE_TEXT`, `_looks_error`, `judge`, `HttpTransport`,
`NeedsValue`, `_PLACEHOLDER`, `_normalize_path`(이름 `normalize_path` 로, `_normalize_path = normalize_path` 별칭도 둔다), `_recovered`,
`_value`(이름 `value_of`, 별칭 `_value`), 그리고 `run_once` 의 본문을 `run_steps` 로.
`core.py` 의 import 는 `asyncio, re, time, typing, urllib.parse, httpx`, `app.ieum.discovery.infer`, `app.ieum.gateway.session_auth`,
`app.ieum.recorder.{config, htmltable, scope}`, `app.ieum.discovery.masking.{HIDDEN, is_masked}`, `app.ieum.recorder.analyze.{get_path, leaves}` 만 쓴다
(Step 1 의 import 시험이 지킨다 — `analyze` 가 Playwright 를 불러오면 그 import 를 함수 안으로 옮긴다).

`run_steps` 는 지금 `run_once` 본문에서 다음만 다르다:
```python
async def run_steps(steps, base, inputs, raw, http, browser, ask_write, gap, *, needs, kind="same-values",
                    relogin=None, pace=None, stop_after=None) -> dict:
    """단계를 차례로 보낸다. base: 단계에 base 가 없을 때 쓰는 주소(업무 기능의 source.base).
    stop_after: 이 단계를 마치면 거기서 성공으로 끝낸다(업무 도구의 목록 보기). 결과의 data 는 단계별 판정 data(메모리에만)."""
    outs, results, datas = {}, [], {}
    ...                                   # run_once 본문 그대로: bf["steps"] → steps, bf["source"]["base"] → base,
                                          # needs 는 인자로 받는다
    # 단계 하나가 ok 로 끝난 직후:
        datas[st["id"]] = data
        if stop_after and st["id"] == stop_after:
            return done(True, "")
    ...
    def done(ok, reason):
        return {"kind": kind, "ok": ok, "steps": results, "reason": reason, "wrote": state["wrote"], "data": datas}
```

`replay.py`: 옮긴 이름은 `from app.ieum.flow.core import (TIMEOUT, UA, encode, judge, HttpTransport, NeedsValue, _looks_error, _keys, _ERR_TEXT, _ERR_KEY, ERR_PAGE_TEXT, _TITLE, _PLACEHOLDER, normalize_path as _normalize_path, _recovered, value_of as _value)` 로 다시 들여와 **모듈 이름을 유지**한다(시험이 `replay.HttpTransport`·`replay.run_once` 를 바꿔치기한다).
`run_once` 는:
```python
async def run_once(bf, inputs, raw, http, browser, ask_write, gap, kind="same-values", relogin=None, pace=None) -> dict:
    """업무 기능 하나를 다시 실행한다(실행 핵심은 flow.core.run_steps). 결과에서 data 는 저장하지 않으므로 뺀다."""
    needs = {i["name"]: bool(i.get("needsValue")) for i in bf.get("inputs", [])}
    out = await core.run_steps(bf["steps"], bf["source"]["base"], inputs, raw, http, browser, ask_write, gap,
                               needs=needs, kind=kind, relogin=relogin, pace=pace)
    out.pop("data", None)
    return out
```

- [ ] **Step 4: 통과와 회귀를 확인한다**

Run: `cd apps/backend && caffeinate -dimsu .venv/bin/pytest tests/test_ieum_flow_core.py tests/test_ieum_recorder_replay.py tests/test_ieum_recorder_listlinks.py tests/test_ieum_recorder_startpage.py tests/test_ieum_recorder_finalfix.py tests/test_ieum_recorder_e2e.py -q -p no:warnings`
Expected: 모두 PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/app/ieum/flow/__init__.py apps/backend/app/ieum/flow/core.py apps/backend/app/ieum/recorder/replay.py apps/backend/tests/test_ieum_flow_core.py
git commit -m "refactor: 재실행의 단계 실행 핵심을 flow.core 로 옮겨 업무 도구와 함께 쓴다"
```

---

### Task 2: 업무 도구 실행기 `flow/runner.py`

**Files:**
- Create: `apps/backend/app/ieum/flow/runner.py`
- Test: `apps/backend/tests/test_ieum_flow_runner.py`

**Interfaces:**
- Consumes: `core.run_steps`, `core.HttpTransport`, `analyze._row_ids`, `htmltable.links_of`, `engine.ToolError`, `engine.convert_response`, `engine._redact`, `engine._redact_url`, `engine._clip`, `credentials.get`, `session_auth.cookie_header/invalidate`, `sources repo list_sources`.
- Produces: `runner.invoke(source: dict, tool: dict, args: dict, ctx: Optional[dict]) -> Tuple[Any, dict]` (동기, 실패는 `engine.ToolError(message, trace)`; 메시지 앞에 `[이유코드]`), `runner.LIST_MAX = 20`, `runner.ROW_TEXT = 120`, `runner.GAP = 0.6`, `runner.CALL_TIMEOUT = 60`, `runner.MAX_STEPS = 10`.

업무 도구의 `flow` (Task 4 가 만든다 — 이 Task 의 시험은 손으로 만든 도구를 쓴다):
```python
{"version": 1, "steps": [...단계 사본...],
 "pick": {"list": "s1", "step": "s2", "tpl": "/x/{id}", "group": "ul>li", "args": {"index": "index", "match": "match"}} | None,
 "verifiedAt": float}
```
단계 사본: `{id, base, method, path, params[{a, loc, from, ex, type}], headers, outputs, kind, charset, recordedShape, recordedErrSeen, write: False}`.
고르는 단계의 출처는 `"<list>.links[<tpl>@<group>][<k>.<j>/<n>(@행틀)].<자리>"` 꼴이다.

동작:
1. `check`: `tool.params` 의 `loc: "input"` 중 `req` 인데 없는 것 → `ToolError("[missing_input] 필수 값이 없습니다: …")`. `index` 는 1 이상 정수(문자열 숫자 허용), 아니면 `[bad_index]`.
2. 고르기 인자(`flow.pick.args` 의 이름)가 없거나 pick 이 None:
   - pick 이 있으면 `run_steps(..., stop_after=pick["list"])` 후 목록을 돌려준다:
     `{"items": [{"index": i+1, "text": 행 글자[:ROW_TEXT]} …LIST_MAX], "total": 행 수, "hint": "index 나 match 로 다시 부르면 그 항목의 상세를 가져옵니다."}`
     행 = `analyze._row_ids(tpl, data, group)`, 행 글자 = `htmltable.links_of(data)` 에서 `ri` 가 같은 첫 항목의 `row`.
   - pick 이 None 이면 모든 단계를 실행해 마지막 결과를 돌려준다.
3. `index`(우선) 또는 `match`: 목록 단계까지 실행 → 행을 고른다(`match` 는 `re.sub(r"\s+", "", text).lower()` 끼리 포함 비교) →
   없으면 `ToolError("[no_match] …", trace)` + `trace["list"]` 에 목록, 범위를 넘으면 `[index_out_of_range]` → 고르는 단계의 `params[].from` 에서
   `][<k>.` 의 k 를 고른 행 순번(0부터)으로 바꾼 단계 사본으로 나머지를 실행한다. 단계 사본 리스트는 `copy.deepcopy` 로 바꾸고 원 도구는 건드리지 않는다.
   k 바꾸기: `re.sub(r"(\.links\[.*\]\[)\d+(\.)", lambda m: m.group(1) + str(k) + m.group(2), frm, count=1)` — 고르는 단계의 출처 중 `pick["list"] + ".links["` 로 시작하는 것만.
4. 인증: 단계 `base` 마다 `proto`·`base` 가 맞는 원본 시스템(`list_sources()` 에서 `base.rstrip('/')` 같은 것; 없으면 도구의 원본 `source`)을 찾고,
   `credentials.get(sid)` 가 `type == "session"` 이면 `session_auth.cookie_header(sid, base, cred)` 의 `이름=값` 들을 그 호스트에 묶은 쿠키로 `HttpTransport` 에 넣는다.
   `key`/`bearer`/`basic` 이면 `engine.auth_headers(source, cred)` 결과를 그 단계 `headers` 에 더한다.
5. 세션 만료(`reason == "auth_expired"`): 관련 원본 `session_auth.invalidate(sid)` 후 **처음 단계부터** 한 번 다시 실행. 또 만료면 `[auth_expired]`.
6. 간격: 단계 base 가 `localhost`/`127.0.0.1`/`::1` 이면 0, 아니면 `GAP`. 전체를 `asyncio.wait_for(…, CALL_TIMEOUT)` 로 감싸 넘으면 `[timeout]`. 단계가 `MAX_STEPS` 를 넘으면 `[too_many_steps]`.
7. `ask_write` 는 언제나 `False` 를 돌려주는 함수(조회만 있으므로 불리면 막는다 — 막히면 `[write_denied]`), `browser=None`, `raw={}`.
8. 결과: 마지막 단계 data 에서 HTML 사본이면 `htmltable.without_links(data)`, JSON 이면 그대로 → `engine.convert_response(tool, x, mask=tool.get("mask", True))`(빈 결과면 x 자체) → index/match 였으면 `{"picked": {"index", "text"}, ...}` 를 더한다(결과가 dict 가 아니면 `{"result": 결과, "picked": …}`).
9. 실행 기록: `{"args", "steps": [{id, originRequest, originResponse, sourceMs, ok, reason}], "originRequest", "originResponse"(마지막 단계), "convertMs", "sourceMs"(합), "aiResult", "rulesReq": [], "rulesRes": []}`.
   단계별 요청·응답을 남기려면 `HttpTransport` 를 감싼 `_Recording` 전송기로 `send` 를 가로채 `{"method","url": engine._redact_url(url),"headers": engine._redact(headers),"body": engine._clip(...)}` 와 응답 `{"status", "body": engine._clip(text)}` 를 쌓는다.
10. 오류는 모두 `ToolError("[<코드>] <한국어 문구> (단계 <id>)", trace)`. 코드: `missing_input, bad_index, no_match, index_out_of_range, chain_broken, needs_value(→ masked_value 로 이름 바꿔 보고), unresolved_path, http_error, waf_blocked, error_response, shape_mismatch, auth_expired, timeout, too_many_steps, write_denied`.

`invoke` 는 동기 함수: `return asyncio.run(_invoke(source, tool, args, ctx or {}))` — MCP 서버·테스트 실행은 스레드 풀에서 부르므로 이벤트 루프가 없다.

- [ ] **Step 1: 실패하는 시험을 쓴다** (`tests/test_ieum_flow_runner.py`)

```python
"""업무 도구 실행: 로컬 HTTP 서버의 목록·상세로 인자 없음/index/match, 행 바뀜, 세션 만료, JSON 마지막 단계를 본다."""
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from app.ieum.flow import runner
from app.ieum.gateway import engine
from app.ieum.recorder import htmltable

ROWS = [("101", "첫째 기사 고려아연 투자"), ("202", "둘째 기사 반도체"), ("303", "셋째 기사 KOREA 경제")]


def _list_html(rows):
    lis = "".join(f'<li class="it"><a href="/art/{i}">{t}</a></li>' for i, t in rows)
    return f'<html><body><ul class="news">{lis}</ul></body></html>'


@pytest.fixture
def site():
    state = {"rows": list(ROWS), "expire_next": 0, "hits": []}

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):
            state["hits"].append(self.path)
            if state["expire_next"] and self.path.startswith("/art/"):
                state["expire_next"] -= 1
                self.send_response(302); self.send_header("Location", "/login.do"); self.end_headers(); return
            if self.path.startswith("/list"):
                body, ct = _list_html(state["rows"]), "text/html; charset=utf-8"
            elif self.path.startswith("/art/"):
                aid = self.path.rsplit("/", 1)[1]
                body, ct = f"<html><body><table><tr><th>번호</th><th>제목</th></tr><tr><td>{aid}</td><td>본문 {aid}</td></tr></table></body></html>", "text/html; charset=utf-8"
            elif self.path.startswith("/api/art/"):
                aid = self.path.rsplit("/", 1)[1]
                body, ct = json.dumps({"id": aid, "title": "본문 " + aid}), "application/json"
            else:
                self.send_response(404); self.end_headers(); return
            data = body.encode()
            self.send_response(200); self.send_header("Content-Type", ct); self.send_header("Content-Length", str(len(data))); self.end_headers()
            self.wfile.write(data)

    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_address[1]}", state
    srv.shutdown()


def _tool(base, last="/art/{id}", last_kind="html"):
    src = "s1.links[/art/{id}@ul.news>li.it][1.0/1].id"
    list_shape = sorted(htmltable.shape(htmltable.to_data(_list_html(ROWS))))
    return {"id": "news_t", "kind": "flow", "mode": "read", "status": "done", "res": [], "mask": False,
            "params": [{"o": "index", "a": "index", "at": "integer", "loc": "pick", "rule": "keep", "req": False},
                       {"o": "match", "a": "match", "at": "string", "loc": "pick", "rule": "keep", "req": False}],
            "flow": {"version": 1, "verifiedAt": 0,
                     "pick": {"list": "s1", "step": "s2", "tpl": "/art/{id}", "group": "ul.news>li.it", "args": {"index": "index", "match": "match"}},
                     "steps": [{"id": "s1", "base": base, "method": "GET", "path": "/list", "params": [], "headers": {}, "kind": "html",
                                "outputs": {src[3:]: src[3:]}, "recordedShape": list_shape, "recordedErrSeen": [], "write": False},
                               {"id": "s2", "base": base, "method": "GET", "path": last, "headers": {}, "kind": last_kind, "outputs": {},
                                "params": [{"a": "id", "loc": "path", "from": src, "ex": "202"}], "recordedErrSeen": [], "write": False}]}}


SRC = {"id": "t-src", "base": "", "proto": "disc"}


def test_인자가_없으면_목록을_돌려준다(site):
    base, st = site
    out, trace = runner.invoke(dict(SRC, base=base), _tool(base), {}, {})
    assert out["total"] == 3 and [x["index"] for x in out["items"]] == [1, 2, 3]
    assert "둘째 기사" in out["items"][1]["text"] and "index" in out["hint"]
    assert st["hits"] == ["/list"] and [s["id"] for s in trace["steps"]] == ["s1"]


def test_index_는_그_행의_상세를_가져오고_고른_항목을_알려준다(site):
    base, st = site
    out, trace = runner.invoke(dict(SRC, base=base), _tool(base), {"index": 2}, {})
    assert out["picked"]["index"] == 2 and "둘째" in out["picked"]["text"]
    assert st["hits"] == ["/list", "/art/202"]
    assert [s["id"] for s in trace["steps"]] == ["s1", "s2"]


def test_목록_순서가_바뀌면_index_는_새_순서를_따른다(site):
    base, st = site
    st["rows"] = [ROWS[2], ROWS[0], ROWS[1]]
    out, _ = runner.invoke(dict(SRC, base=base), _tool(base), {"index": 2}, {})
    assert st["hits"][-1] == "/art/101" and "첫째" in out["picked"]["text"]


def test_match_는_공백과_대소문자를_무시한다(site):
    base, st = site
    out, _ = runner.invoke(dict(SRC, base=base), _tool(base), {"match": "고려 아연"}, {})
    assert st["hits"][-1] == "/art/101"
    out, _ = runner.invoke(dict(SRC, base=base), _tool(base), {"match": "korea"}, {})
    assert st["hits"][-1] == "/art/303"


def test_match_가_없으면_no_match_와_목록(site):
    base, _ = site
    with pytest.raises(engine.ToolError) as e:
        runner.invoke(dict(SRC, base=base), _tool(base), {"match": "없는말"}, {})
    assert str(e.value).startswith("[no_match]") and len(e.value.trace["list"]["items"]) == 3


def test_index_범위를_넘으면_오류(site):
    base, _ = site
    with pytest.raises(engine.ToolError) as e:
        runner.invoke(dict(SRC, base=base), _tool(base), {"index": 9}, {})
    assert str(e.value).startswith("[index_out_of_range]")


def test_마지막_단계가_JSON_이면_변환한_JSON_에_picked(site):
    base, _ = site
    out, _ = runner.invoke(dict(SRC, base=base), _tool(base, "/api/art/{id}", "json"), {"index": 3}, {})
    assert out["id"] == "303" and out["picked"]["index"] == 3


def test_세션이_끊기면_처음부터_한_번_다시_실행한다(site, monkeypatch):
    base, st = site
    from app.ieum.gateway import credentials, session_auth
    monkeypatch.setattr(credentials, "get", lambda sid: {"type": "session", "username": "a", "password": "b", "recipe": {}})
    monkeypatch.setattr(session_auth, "cookie_header", lambda sid, b, c: "JSESSIONID=x")
    monkeypatch.setattr(session_auth, "invalidate", lambda sid: None)
    st["expire_next"] = 1
    out, _ = runner.invoke(dict(SRC, base=base), _tool(base), {"index": 1}, {})
    assert st["hits"] == ["/list", "/art/101", "/list", "/art/101"] and out["picked"]["index"] == 1
    st["expire_next"] = 2
    with pytest.raises(engine.ToolError) as e:
        runner.invoke(dict(SRC, base=base), _tool(base), {"index": 1}, {})
    assert str(e.value).startswith("[auth_expired]")


def test_가린_값은_보내지_않는다(site):
    base, st = site
    t = _tool(base)
    t["flow"]["steps"][0]["params"] = [{"a": "q", "loc": "query", "from": "const:010****5678", "ex": ""}]
    with pytest.raises(engine.ToolError) as e:
        runner.invoke(dict(SRC, base=base), t, {}, {})
    assert str(e.value).startswith("[masked_value]") and st["hits"] == []
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd apps/backend && caffeinate -dimsu .venv/bin/pytest tests/test_ieum_flow_runner.py -q`
Expected: FAIL — `ImportError: cannot import name 'runner'`

- [ ] **Step 3: `flow/runner.py` 를 쓴다** — 위 "동작" 1~10 을 그대로 구현한다. 뼈대:

```python
"""업무 도구 하나를 실행한다: 고르기(목록·index·match) → 단계 실행(flow.core) → 마지막 결과 변환.
게이트웨이(engine.invoke)가 kind == "flow" 인 도구를 여기로 넘긴다. 조회 단계만 있는 업무 도구만 만들어지므로 쓰기를 묻지 않는다."""
import asyncio
import copy
import re
import time
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlsplit

from app.ieum.flow import core
from app.ieum.gateway import credentials, engine, session_auth
from app.ieum.recorder import analyze, htmltable
from app.ieum.repositories import sources as src_repo

LIST_MAX, ROW_TEXT, GAP, CALL_TIMEOUT, MAX_STEPS = 20, 120, 0.6, 60, 10
HINT = "index 나 match 로 다시 부르면 그 항목의 상세를 가져옵니다."
_K = re.compile(r"(\.links\[.*\]\[)\d+(\.)")
_LOCAL = ("localhost", "127.0.0.1", "::1")


def _norm(s: str) -> str:
    return re.sub(r"\s+", "", s or "").lower()


def _rows(data, pick) -> list:
    """목록 단계 data 의 고르는 묶음 행들: [(행 번호 ri, 행 글자)]."""
    ids = analyze._row_ids(pick["tpl"], data, pick["group"])
    text = {}
    for c in htmltable.links_of(data):
        if c.get("ri") is not None and c["ri"] not in text:
            text[c["ri"]] = c["row"]
    return [(ri, text.get(ri, "")) for ri in ids]


def _listing(rows) -> dict:
    return {"items": [{"index": i + 1, "text": t[:ROW_TEXT]} for i, (_, t) in enumerate(rows[:LIST_MAX])], "total": len(rows), "hint": HINT}


def _with_k(steps, pick, k: int) -> list:
    out = copy.deepcopy(steps)
    for st in out:
        if st["id"] != pick["step"]:
            continue
        for p in st["params"]:
            if (p.get("from") or "").startswith(pick["list"] + ".links["):
                p["from"] = _K.sub(lambda m: m.group(1) + str(k) + m.group(2), p["from"], count=1)
    return out


def invoke(source: dict, tool: dict, args: dict, ctx: Optional[dict] = None) -> Tuple[Any, dict]:
    return asyncio.run(_invoke(source, tool, args or {}, ctx or {}))
```
나머지(`_invoke`, `_Recording` 전송기, 인증 쿠키·헤더, 재시도, 결과·기록 만들기)는 "동작" 4~10 대로 쓴다. `core.run_steps` 의 `needs` 는 `{}`, 입력은 `{p["a"]: str(args[p["a"]]) for p in tool["params"] if p.get("loc") == "input" and p["a"] in args}`.

- [ ] **Step 4: 통과를 확인한다**

Run: `cd apps/backend && caffeinate -dimsu .venv/bin/pytest tests/test_ieum_flow_runner.py tests/test_ieum_flow_core.py -q -p no:warnings`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/app/ieum/flow/runner.py apps/backend/tests/test_ieum_flow_runner.py
git commit -m "feat: 업무 도구 실행기 — 인자 없으면 목록, index·match 면 고른 항목의 상세를 단계를 이어 가져온다"
```

---

### Task 3: 게이트웨이·테스트 실행·배포에 업무 도구를 잇는다

**Files:**
- Modify: `apps/backend/app/ieum/gateway/engine.py:365-371` (`invoke`)
- Test: `apps/backend/tests/test_ieum_flow_runner.py` (덧붙임)

**Interfaces:**
- Consumes: `flow.runner.invoke`
- Produces: `engine.invoke(source, tool, args, ctx)` 가 `tool.get("kind") == "flow"` 면 `flow.runner.invoke` 결과를 돌려준다. `runner.run_tool`·`mcp_definition`·`manifest.build` 는 바꾸지 않는다(필드 `flow` 가 그대로 얼어 들어가는지 시험만).

- [ ] **Step 1: 실패하는 시험을 덧붙인다**

```python
def test_run_tool_과_MCP_정의가_업무_도구를_다룬다(site, ieum_state):
    from app.ieum.gateway import runner as gw
    from app.ieum.repositories import sources as src_repo, studio as tool_repo
    base, _ = site
    src_repo.upsert_source({"id": "t-src", "name": "시험", "proto": "disc", "base": base, "authType": "none", "spec": "업무 기록으로 추론"})
    tool_repo.replace_source_tools("t-src", [tool_repo.with_defaults(_tool(base), {"proto": "disc"})])
    out = gw.run_tool("news_t", {"index": 1}, client="test", require_published=True)
    assert out["ok"] and out["result"]["picked"]["index"] == 1
    d = gw.mcp_definition(tool_repo.find_tool("news_t")[1])
    assert set(d["inputSchema"]["properties"]) == {"index", "match"} and d["annotations"]["readOnlyHint"] is True


def test_배포_스냅샷에_flow_가_들어간다(site, ieum_state):
    from app.ieum.runtime import manifest
    from app.ieum.repositories import studio as tool_repo
    base, _ = site
    t = dict(tool_repo.with_defaults(_tool(base), {"proto": "disc"}), src="t-src")
    m = manifest.build({"id": "ts", "slug": "s", "name": "s", "tools": ["news_t"]}, [t],
                       [{"id": "t-src", "name": "시험", "proto": "disc", "base": base, "authType": "none"}], "v1")
    assert m["tools"][0]["flow"]["pick"]["step"] == "s2"
```
(`manifest.build` 의 실제 인자 순서는 `runtime/manifest.py:23` 을 보고 맞춘다 — 시그니처가 다르면 시험 쪽을 고친다.)

- [ ] **Step 2: 실패 확인** — `pytest tests/test_ieum_flow_runner.py -k "run_tool or 스냅샷" -q` → run_tool 쪽 FAIL(engine 이 `/list` 한 번만 부르고 path 로 보냄)

- [ ] **Step 3: 구현**

```python
def invoke(source, tool, args, ctx=None):
    """도구를 실제로 실행한다. (result, trace) 를 돌려주고, 실패하면 trace 를 담은 ToolError 를 일으킨다.
    업무 도구(kind == "flow")는 여러 단계를 이어 실행하는 flow.runner 로 넘긴다."""
    if tool.get("kind") == "flow":
        from app.ieum.flow import runner as flow_runner          # 순환 import 를 피해 여기서 부른다
        return flow_runner.invoke(source, tool, args, ctx)
    try:
        return _invoke_once(source, tool, args, ctx, retry=True)
    except _SessionExpired:
        session_auth.invalidate(source["id"])
        return _invoke_once(source, tool, args, ctx, retry=False)
```

- [ ] **Step 4: 통과 확인** — `pytest tests/test_ieum_flow_runner.py tests/test_ieum_gateway.py tests/test_ieum_units.py -q -p no:warnings` → PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/app/ieum/gateway/engine.py apps/backend/tests/test_ieum_flow_runner.py
git commit -m "feat: 게이트웨이가 업무 도구를 flow 실행기로 넘긴다"
```

---

### Task 4: 업무 도구 등록 — 도구 후보로 등록 = 확정, 정책 칸 없애기 (서버)

**Files:**
- Modify: `apps/backend/app/ieum/recorder/service.py:300-470` (`update_function` 의 policy, `confirm`, `_register`, 새 `register_flow`)
- Modify: `apps/backend/app/ieum/routers/recorder.py:213-240`
- Test: `apps/backend/tests/test_ieum_flow_register.py`

**Interfaces:**
- Consumes: 업무 기능(`bf`) 구조, `analyze.LINK_EXPR`, `analyze._split_tpl`, `htmltable.shape`, `analyze.leaves`, `infer.build_res`, `_scrub`, `_input_of`, `spec._param`, `tool_repo`, `src_repo`.
- Produces:
  - `service.register_flow(fid) -> {"sources": [...], "tools": [tool], "loginKnown": {...}, "function": bf}`
  - `service.register_steps(fid)` 결과에도 `"function": bf` (등록=확정을 똑같이 한다)
  - `service.flow_blockers(bf) -> List[str]` (등록 못 하는 이유들, 한국어. 빈 목록이면 가능) — 화면이 버튼 아래 이유로 쓴다. 업무 기능 응답에 `flowBlockers` 로 싣는다(`get_function` 라우트와 `PUT` 응답).
  - 업무 기능 상태 `registered`, 필드 `registered: {"at": float, "mode": "flow"|"steps", "tools": [id…]}`
  - 라우트 `POST /recorder/functions/{fid}/register/` body `{"mode": "flow"|"steps"|"single"}` (기본 `flow`). `confirm/` 라우트 삭제.

규칙:
- `flow_blockers`: 검증이 `verified` 가 아니고 같은 값 실행(`runs[kind=same-values].ok`)도 아니면 "검증을 통과해야 등록할 수 있습니다."; 남은 단계 중 `write` 이거나 (GET/HEAD 아님 and `writeWhy != "사람이 지정"`) → "쓰기 단계 {id} 가 남아 있습니다. 건너뛰거나 단계별로 등록하세요."; `exec == "browser"` → "브라우저에서만 돌아가는 단계 {id} 가 있습니다. 단계별로 등록하세요."; 남은 단계 0 또는 10 초과.
- 단계 사본: 남은 단계마다 `{id, base: st.get("base") or bf.source.base, method, path, params: [{a, loc, from, ex, type} …], headers(가린 값 뺌), outputs, kind, charset, recordedShape, recordedErrSeen, write: False}`.
  `recordedShape` = HTML 이면 `sorted(htmltable.shape(st["recordedData"] or {}))`, JSON 이면 `sorted(replay._keys(infer.parse_json(st["recordedRes"])))`(없으면 `[]`). 그 뒤 `_scrub` 를 단계 사본 전체에 적용.
- 고르는 지점: 남은 단계를 앞에서부터 보며, `params[].from` 이 `"<sid>.links["` 로 시작하고 `LINK_EXPR` 의 묶음(`_split_tpl` 의 group)이 있는 첫 단계. `pick = {"list": sid, "step": st.id, "tpl": tpl, "group": group, "args": {"index": 이름, "match": 이름}}`.
  이름은 업무 입력 이름과 겹치면 `index_`·`match_`. 없으면 `pick = None`(고르기 인자 없음).
- 도구 `params`: 업무 입력(`bf.inputs` 중 남은 단계가 `input.<이름>` 으로 쓰는 것) → `spec._param(이름, "input", {"type": …, "example": ex(가리지 않았을 때)}, required, 화면 라벨)` 에 `loc="input"`, 그리고 pick 이 있으면 `{"o": n, "a": n, "at": "integer", "loc": "pick", "rule": "keep", "req": False, "d": "목록에서 몇 번째 항목인지(1부터). 없으면 목록을 돌려줍니다."}`, match 도 같은 꼴("목록 행 글자에 이 말이 든 첫 항목").
- 도구: `{"id": infer.tool_name(마지막 단계 path, "", "read", taken), "kind": "flow", "title": bf.name, "desc": bf.desc or bf.name, "status": "review", "mode": "read", "params", "res": infer.build_res(마지막 단계 recordedRes, Masker(pii=True))[0], "guess": 0, "flow": {"version": 1, "steps", "pick", "verifiedAt": bf.verification.at}, "rec": {"function": bf.id, "recording": rid}}` → `_scrub` → `tool_repo.with_defaults(tool, src)`.
  원본 시스템은 지금 `_register` 와 같은 규칙으로 단계 base 마다 만들거나 찾는다(인증을 찾으려면 필요). 업무 도구는 **기록 시작 주소의 원본**에 넣는다.
  다시 등록: 같은 원본에서 `kind == "flow"` 이고 `rec.function == bf.id` 인 도구가 있으면 그 자리에서 바꾸되 `id`, `calls`, 그리고 스튜디오에서 고친 `desc`·`title`·`params[].d`·`res` 는 **옛 값을 유지**하고 `flow`·`params` 의 나머지만 새로 쓴다.
- 등록=확정: 등록에 성공하면 `store.update_function(fid, apply)` 로 `status="registered"`, `confirmedAt=time.time()`, `registered={...}` 를 쓰고 `store.delete_shots(rid)`. 실패(조건·예외)면 아무것도 바꾸지 않는다.
- 정책: `update_function` 이 `patch["policy"]` 를 받으면 무시한다(키를 버린다). `confirm` 과 `policyIncomplete` 계산·`_incomplete` 를 없애고, `policy` 를 다시 구하던 곳은 `policy.operation` 만 남겨 `_describe` 에 쓴다.
- 라우트: `mode` 가 `flow` 면 `register_flow`, `steps` 면 `register_steps`, `single` 이면 `register_single`(지금 그대로, 예전 호출 호환). 400 문구는 `ValueError` 메시지 그대로.
- 스튜디오 저장(`routers/studio.py:tool_save`): `patch` 에서 `flow`·`kind`·`rec` 를 버린다(`patch.pop("flow", None)` 등). 단계는 업무 기록에서만 바뀐다(설계 2절).
  **Files 에 `apps/backend/app/ieum/routers/studio.py:72-81` 을 더한다.**

- [ ] **Step 1: 실패하는 시험을 쓴다** (`tests/test_ieum_flow_register.py`)

```python
"""업무 도구 등록: 조건, 단계 사본, 고르기 인자, 등록=확정, 다시 등록, 정책 무시."""
import copy

import pytest

from app.ieum.recorder import service, store
from app.ieum.repositories import studio as tool_repo

SRC = "s1.links[/art/{id}@ul.news>li.it][1.0/1].id"


def _bf(**over):
    bf = {"id": "bf_reg_t", "name": "뉴스 기사 읽기", "desc": "", "status": "draft",
          "source": {"base": "http://127.0.0.1:9", "recordingId": "rec_reg_t", "made": "manual-record", "env": "op"},
          "inputs": [{"name": "sec", "type": "number", "source": "USER_INPUT", "ex": "101", "screenLabel": "", "confidence": "low", "required": True, "needsValue": False}],
          "steps": [
              {"id": "s1", "role": "prereq", "base": "http://127.0.0.1:9", "method": "GET", "path": "/section/{sec}", "kind": "html", "exec": "http",
               "write": False, "writeWhy": "GET", "headers": {}, "outputs": {SRC[3:]: SRC[3:]},
               "params": [{"a": "sec", "loc": "path", "from": "input.sec", "ex": "101", "type": "number", "source": "USER_INPUT"}],
               "recordedRes": "<html>원문</html>", "recordedData": {"tables": [], "fields": {}}, "recordedErrSeen": []},
              {"id": "s2", "role": "core", "base": "http://127.0.0.1:9", "method": "GET", "path": "/art/{id}", "kind": "html", "exec": "http",
               "write": False, "writeWhy": "GET", "headers": {"Authorization": "Bearer ****"}, "outputs": {},
               "params": [{"a": "id", "loc": "path", "from": SRC, "ex": "202", "source": "PREVIOUS_STEP_OUTPUT"}],
               "recordedRes": "<html>원문2</html>", "recordedData": None, "recordedErrSeen": []}],
          "output": {"from": "s2", "fields": []}, "excluded": [], "references": [], "evidence": {}, "notes": [],
          "auth": {"mode": "none", "recipe": None}, "policy": {"operation": "READ"},
          "verification": {"status": "verified", "at": 1.0, "runs": [{"kind": "same-values", "ok": True}]}}
    bf.update(over)
    return bf


@pytest.fixture
def fn(ieum_state):
    store.save_function(_bf())
    store.save_recording({"id": "rec_reg_t", "name": "뉴스", "sourceBase": "http://127.0.0.1:9", "env": "op", "status": "done", "approvals": []})
    return "bf_reg_t"


def test_등록하면_업무_도구_하나와_등록_완료(fn):
    out = service.register_flow(fn)
    t = out["tools"][0]
    assert t["kind"] == "flow" and t["status"] == "review" and t["mode"] == "read"
    assert t["flow"]["pick"] == {"list": "s1", "step": "s2", "tpl": "/art/{id}", "group": "ul.news>li.it", "args": {"index": "index", "match": "match"}}
    assert {p["a"]: p["loc"] for p in t["params"]} == {"sec": "input", "index": "pick", "match": "pick"}
    bf = store.get_function(fn)
    assert bf["status"] == "registered" and bf["registered"]["tools"] == [t["id"]] and bf["registered"]["mode"] == "flow"


def test_단계_사본에는_원문과_가린_값이_없다(fn):
    t = service.register_flow(fn)["tools"][0]
    for st in t["flow"]["steps"]:
        assert "recordedRes" not in st and "recordedData" not in st and "recordedShape" in st
        assert "****" not in str(st["headers"])


def test_검증_전_쓰기_브라우저_단계는_거부하고_아무것도_바꾸지_않는다(fn):
    for over in ({"verification": {"status": "pending", "runs": []}},
                 {"steps": [dict(_bf()["steps"][0]), dict(_bf()["steps"][1], method="POST", writeWhy="POST — 기본 쓰기", write=True)]},
                 {"steps": [dict(_bf()["steps"][0], exec="browser"), _bf()["steps"][1]]}):
        store.save_function(_bf(**over))
        assert service.flow_blockers(store.get_function(fn))
        with pytest.raises(ValueError):
            service.register_flow(fn)
        assert store.get_function(fn)["status"] == "draft" and not tool_repo.flat_tools()


def test_입력_이름이_index_와_겹치면_index_로_피한다(fn):
    bf = _bf()
    bf["inputs"][0]["name"] = "index"
    bf["steps"][0]["params"][0].update(a="index", **{"from": "input.index"})
    bf["steps"][0]["path"] = "/section/{index}"
    store.save_function(bf)
    t = service.register_flow(fn)["tools"][0]
    assert t["flow"]["pick"]["args"] == {"index": "index_", "match": "match"}


def test_다시_등록하면_같은_도구를_고친_설명과_함께_유지한다(fn):
    t = service.register_flow(fn)["tools"][0]
    tool_repo.save_tool(t["id"], {"desc": "사람이 고친 설명"})
    t2 = service.register_flow(fn)["tools"][0]
    assert t2["id"] == t["id"] and t2["desc"] == "사람이 고친 설명" and len(tool_repo.flat_tools()) == 1


def test_스튜디오_저장은_flow_kind_rec_를_바꾸지_않는다(fn):
    from fastapi.testclient import TestClient
    from fastapi import FastAPI
    from app.ieum.routers import router
    t = service.register_flow(fn)["tools"][0]
    app = FastAPI(); app.include_router(router)
    r = TestClient(app).put(f"/api/ieum/studio/{t['id']}/", json={"desc": "새 설명", "flow": {"steps": []}, "kind": "plain", "rec": {}})
    assert r.status_code == 200
    got = tool_repo.find_tool(t["id"])[1]
    assert got["desc"] == "새 설명" and got["kind"] == "flow" and got["flow"]["steps"] and got["rec"]["function"] == fn


def test_PUT_의_policy_는_무시한다(fn):
    service.update_function(fn, {"policy": {"risk": "HIGH"}})
    assert store.get_function(fn).get("policy", {}).get("risk") is None
```
(`store.save_function`/`save_recording`/`get_function` 의 실제 이름은 `recorder/store.py` 를 보고 맞춘다. 없으면 시험에서 쓰는 저장 도우미를 `tests/test_ieum_recorder_service.py` 처럼 만든다.)

- [ ] **Step 2: 실패 확인** — `pytest tests/test_ieum_flow_register.py -q` → `AttributeError: module 'app.ieum.recorder.service' has no attribute 'register_flow'`

- [ ] **Step 3: 구현** — 위 "규칙" 대로. 라우트:

```python
@router.post("/functions/{fid}/register/")
async def function_register(fid: str, payload: Optional[dict] = Body(None)):
    if not _fid_ok(fid):
        return fail(400, "잘못된 업무 기능 번호입니다.")
    mode = (payload or {}).get("mode") or "flow"
    fns = {"flow": service.register_flow, "steps": service.register_steps, "single": service.register_single}
    if mode not in fns:
        return fail(400, "mode 는 flow, steps, single 중 하나여야 합니다.")
    try:
        return ok(await asyncio.to_thread(fns[mode], fid), 201)
    except KeyError:
        return fail(404, "업무 기능을 찾을 수 없습니다.")
    except ValueError as exc:
        return fail(400, str(exc))
```
`confirm/` 라우트와 `service.confirm` 을 지우고, 그것을 부르던 시험은 `register` 로 바꾼다(`grep -rn "confirm" tests/test_ieum_recorder_*.py`).

- [ ] **Step 4: 통과 확인** — `pytest tests/test_ieum_flow_register.py tests/test_ieum_recorder_service.py tests/test_ieum_recorder_api.py -q -p no:warnings` → PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/app/ieum/recorder/service.py apps/backend/app/ieum/routers/recorder.py apps/backend/app/ieum/routers/studio.py apps/backend/tests/test_ieum_flow_register.py <바꾼 기존 시험 파일들>
git commit -m "feat: 검증한 조회 업무를 업무 도구 하나로 등록하고 등록을 확정으로 삼으며 업무 기록의 정책을 받지 않는다"
```

---

### Task 5: 업무 기록 화면 — 도구 후보로 등록 카드, 정책 칸 없애기

**Files:**
- Modify: `apps/web/ieum/js/menu/recorder.js` (목록 `recListHTML`, 검토 `recReviewHTML` 의 머리줄·정책 카드·등록 카드, `ACT.recConfirm`/`recRegister`, `CHG.recPol`)
- Test: `apps/backend/tests/test_ieum_flow_console.py`

**Interfaces:**
- Consumes: 업무 기능 응답의 `status`, `registered`, `flowBlockers`; `POST /recorder/functions/{id}/register/` `{mode}` → `{sources, tools, loginKnown, function}`; 스튜디오로 가는 기존 동작 `ACT.goSrc`(data-id=원본 시스템 id, `discovery.js:304` 와 같은 버튼).
- Produces: 버튼 `data-act="recRegister" data-m="flow"`(주), `data-m="steps"`(보조), 등록 뒤 `data-act="goSrc" data-id="<sid>"`.

화면 규칙:
- 목록: `registered` 상태면 배지 "등록 완료"(ok), 등록 칸 "도구 N개". "정책 미완" 배지 삭제.
- 검토 머리줄: `${policy.operation} · 위험 … · 승인 … · 실행 …` 줄 삭제(검증 상태 배지만).
- 정책 카드(`정책 (자동 추정 · 고칠 수 있음)`)와 `recPol`, `REC_SOURCES` 외 정책 선택 상자 삭제. `recConfirm` 버튼·핸들러 삭제.
- 등록 카드 제목 "도구 후보로 등록":
  - 등록 전: 주 버튼 `[도구 후보로 등록]`(`flowBlockers.length` 면 `disabled` 이고 아래에 이유를 줄마다 `<small>`), 보조 `[단계별로 등록]`.
  - 등록 후: "등록 완료 · 도구 N개 · [변환 스튜디오 열기] · [다시 등록]"(다시 등록은 `registered.mode` 로).
- 등록 성공 알림: `도구 후보 ${n}개를 등록했습니다. 변환 스튜디오에서 설명과 매핑을 검토한 뒤 공개하세요.` + 로그인 모를 때 지금 문구.
- 등록 버튼은 `await RECR.saveQ` 뒤에(지금 그대로). 성공하면 `RECR.fn = out.function`, 원본 id 는 `out.tools[0].src`(없으면 `out.sources[0].id`)를 `RECR.regSrc` 에 둔다(`RECR` 객체 정의에 `regSrc:null` 추가).

- [ ] **Step 1: 실패하는 브라우저 시험을 쓴다** (`tests/test_ieum_flow_console.py` — `test_ieum_recorder_console.py` 의 `console_url` 픽스처·`launch`·`page.route` 방식을 그대로 복사한다)

```python
def test_등록_전에는_막힌_이유를_보이고_정책_칸이_없다(console_url):
    fn = dict(FN, flowBlockers=["쓰기 단계 s4 가 남아 있습니다. 건너뛰거나 단계별로 등록하세요."])
    page_text, disabled = _open_review(console_url, fn)          # 검토 화면을 띄우고 main 글자와 주 버튼 disabled 를 돌려주는 도우미
    assert "정책 (자동 추정" not in page_text and "위험" not in page_text.split("단계")[0]
    assert disabled and "쓰기 단계 s4" in page_text


def test_등록하면_등록_완료와_스튜디오_열기(console_url):
    calls = []
    def on_register(route):                                       # POST register 응답을 흉내 낸다
        calls.append(json.loads(route.request.post_data))
        route.fulfill(status=201, content_type="application/json", body=json.dumps({"resultCode": 201, "resultMsg": "", "resultData": {
            "sources": [{"id": "news-src"}], "tools": [{"id": "news_t", "src": "news-src"}], "loginKnown": {"news-src": True},
            "function": dict(FN, status="registered", registered={"at": 1, "mode": "flow", "tools": ["news_t"]}, flowBlockers=[])}}, ensure_ascii=False))
    text = _open_review_and_click(console_url, dict(FN, flowBlockers=[]), "[data-act=recRegister][data-m=flow]", on_register)
    assert calls == [{"mode": "flow"}]
    assert "등록 완료" in text and "변환 스튜디오 열기" in text
```
(`FN`, `_open_review`, `_open_review_and_click` 는 이 파일 안에 만든다 — `test_ieum_recorder_console.py` 의 `FN`·`_run` 과 같은 방식: `page.goto(/ieum/)` → `S.view='rec'; RECR.page='review'; RECR.fn=fn; recRender()`.)

- [ ] **Step 2: 실패 확인** — `pytest tests/test_ieum_flow_console.py -q` → FAIL(정책 카드가 보이고 등록 카드 문구가 다름)

- [ ] **Step 3: 구현** — 위 "화면 규칙" 대로 `recorder.js` 를 고친다. 새 전역을 만들지 않는다(`RECR.regSrc` 는 기존 객체 속성). 편집 뒤 `node --check apps/web/ieum/js/menu/recorder.js`.

- [ ] **Step 4: 통과 확인** — `pytest tests/test_ieum_flow_console.py tests/test_ieum_recorder_console.py -q -p no:warnings` → PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/web/ieum/js/menu/recorder.js apps/backend/tests/test_ieum_flow_console.py
git commit -m "feat: 업무 기록 검토 화면을 도구 후보로 등록 하나로 맞추고 정책 칸을 없앤다"
```

---

### Task 6: 변환 스튜디오·테스트 실행 — 업무 도구 단계 흐름과 안내 띠

**Files:**
- Modify: `apps/web/ieum/js/common/state.js:33` (`opLabel`), `apps/web/ieum/js/menu/studio.js:56-90`(안내 띠·파이프), `apps/web/ieum/js/common/convert.js:65-75,166-186`(미리보기·실행 기록)
- Test: `apps/backend/tests/test_ieum_flow_console.py` (덧붙임)

**Interfaces:**
- Consumes: 도구 `kind`, `flow.steps[{id, method, path}]`, `flow.pick`, `flow.verifiedAt`, `rec.function`, `rec.recording`; 실행 기록 `trace.steps[{id, originRequest, originResponse, ok, reason}]`.
- Produces: 업무 기록 화면으로 가는 버튼 `data-act="recOpenFn" data-id="<bf id>"` — 업무 기록 메뉴로 바꾼 뒤 `recOpenFn(id)` 를 부른다(`recorder.js` 에 이미 있는 함수. `ACT.recOpenFn = a => { S.view = 'rec'; go('rec'); recOpenFn(a.dataset.id); }` 를 `recorder.js` 의 `ACT` 에 더한다 — 이름을 먼저 grep).

화면 규칙:
- `opLabel(t)`: `t.kind === 'flow'` 면 `업무 ${t.flow.steps.length}단계` 를 돌려준다(목록·검색에 쓰임).
- 원본 작업 칸(`studio.js:85-90`): 업무 도구면 단계 칩을 화살표로 잇는다 — `s1 GET /section/{sec}` → (pick 이 있으면) `목록에서 고름 (index · match)` → `s2 GET /art/{id}`. 단계는 읽기 전용이고 아래에 "단계는 업무 기록에서 고친 뒤 다시 등록합니다." 를 적는다.
- 안내 띠(`studio.js:58-66` 순서에서 `t.disc` 다음, 일반 review 문구 앞):
  - `t.status === 'review' && t.kind === 'flow'`: "업무 기록으로 만든 도구입니다 · 검증됨(날짜) · 단계 N개 · [기록 보기] · [검토 완료]".
  - `t.status === 'review' && t.rec && t.kind !== 'flow'`: "업무 기록의 한 단계로 만든 도구입니다. 앞 단계 값이 필요한 입력: …(params 중 loc==='path' 이고 example 없는 것의 a)" + [기록 보기] + [검토 완료].
  - 이 두 경우에는 "명세를 읽어 자동으로 만든 도구 후보입니다" 띠가 뜨지 않는다.
- 미리보기 원본 요청(`convert.js:65-75`): 업무 도구면 단계별 `METHOD base+path` 줄들을 보여 준다(실제 요청은 만들지 않는다).
- 실행 기록(`convert.js:166-186`): `trace.steps` 가 있으면 단계마다 요청·응답 묶음을 차례로 그린다. 없으면 지금 그대로.

- [ ] **Step 1: 실패하는 시험을 덧붙인다**

```python
def test_스튜디오는_업무_도구의_단계_흐름과_기록_안내를_보인다(console_url):
    text = _open_studio(console_url, FLOW_TOOL)            # TOOLS·SOURCES 를 주입하고 S.view='studio' 로 그린 뒤 main 글자를 돌려주는 도우미
    assert "업무 기록으로 만든 도구입니다" in text and "기록 보기" in text
    assert "s1 GET /section/{sec}" in text and "목록에서 고름" in text and "s2 GET /art/{id}" in text
    assert "명세를 읽어 자동으로 만든 도구 후보" not in text


def test_테스트_실행_기록은_단계별로_그린다(console_url):
    html = _render_trace(console_url, {"steps": [{"id": "s1", "originRequest": {"method": "GET", "url": "http://x/list"}, "originResponse": {"status": 200, "body": "목록"}, "ok": True},
                                                  {"id": "s2", "originRequest": {"method": "GET", "url": "http://x/art/202"}, "originResponse": {"status": 200, "body": "본문"}, "ok": True}],
                                        "originRequest": {"method": "GET", "url": "http://x/art/202"}, "originResponse": {"status": 200, "body": "본문"}})
    assert html.index("http://x/list") < html.index("http://x/art/202")
```
(`FLOW_TOOL` 은 Task 4 시험의 도구 모양을 손으로 적은 것. `_render_trace` 는 `convert.js` 의 실행 기록 그리기 함수를 `page.evaluate` 로 직접 불러 HTML 을 받는다 — 함수 이름은 `convert.js:166` 근처를 보고 맞춘다.)

- [ ] **Step 2: 실패 확인** — `pytest tests/test_ieum_flow_console.py -k "스튜디오 or 실행_기록" -q` → FAIL

- [ ] **Step 3: 구현** — 위 "화면 규칙" 대로. 새 전역 금지(함수 추가가 필요하면 `studio.js` 안의 기존 이름 규칙 `flow…` 로 만들기 전에 `grep -rn "flowSteps\|flowChip" apps/web/ieum/js`). 편집 뒤 세 파일 `node --check`.

- [ ] **Step 4: 통과 확인** — `pytest tests/test_ieum_flow_console.py tests/test_ieum_recorder_console.py -q -p no:warnings` → PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/web/ieum/js/common/state.js apps/web/ieum/js/menu/studio.js apps/web/ieum/js/common/convert.js apps/web/ieum/js/menu/recorder.js apps/backend/tests/test_ieum_flow_console.py
git commit -m "feat: 변환 스튜디오와 테스트 실행이 업무 도구의 단계 흐름과 기록 근거를 보여 준다"
```

---

### Task 7: 배포한 MCP 서버로 끝까지 + 문서

**Files:**
- Test: `apps/backend/tests/test_ieum_flow_runner.py` (덧붙임: 배포 e2e)
- Modify: `CLAUDE.md` (업무 기록 문단 끝에 업무 도구 문단), `docs/superpowers/specs/2026-10-10-ieum-web-recorder-design.md`(등록 절에 "업무 도구는 별도 설계 2026-10-12" 한 줄과 확정 제거)

**Interfaces:**
- Consumes: `tests/conftest.py` 의 `ieum_server`·`Console`(배포·MCP 호출 도우미), Task 2 의 `site` 픽스처.

- [ ] **Step 1: 실패하는 시험(배포 e2e)을 덧붙인다**

```python
def test_배포한_MCP_서버에서_업무_도구를_부른다(site, ieum_server, ieum_state):
    from tests.conftest import Console
    from app.ieum.repositories import sources as src_repo, studio as tool_repo
    base, st = site
    src_repo.upsert_source({"id": "t-src", "name": "시험", "proto": "disc", "base": base, "authType": "none", "spec": "업무 기록으로 추론"})
    tool_repo.replace_source_tools("t-src", [dict(tool_repo.with_defaults(_tool(base), {"proto": "disc"}), status="done")])
    c = Console(ieum_server)
    mcp = c.deploy_and_connect(["news_t"])          # conftest 의 배포·키 발급·MCP 연결 도우미 이름에 맞춘다
    listed = mcp.call_tool("news_t", {})
    assert listed["structuredContent"]["total"] == 3
    got = mcp.call_tool("news_t", {"index": 2})
    assert got["structuredContent"]["picked"]["index"] == 2 and st["hits"][-1] == "/art/202"
```
(도우미 이름은 `tests/conftest.py` 의 `Console` 과 기존 배포 시험(`grep -ln "tools/call" tests/`)을 보고 그대로 쓴다.)

- [ ] **Step 2: 실패 확인 → Step 3: 고칠 곳이 있으면 고친다** (Task 1~3 이 맞으면 처음부터 통과할 수 있다 — 그러면 RED 대신 "회귀 고정 시험"이라고 보고서에 적는다)

- [ ] **Step 4: 문서를 고친다** — `CLAUDE.md` 업무 기록 문단 끝에:

```markdown
**업무 도구는 기록한 업무 하나를 도구 하나로 실행한다** (`app/ieum/flow/`, 설계 `docs/superpowers/specs/2026-10-12-ieum-workflow-tool-design.md`).
검증한 **조회 업무**만 "도구 후보로 등록"으로 `kind: "flow"` 도구가 되고(등록이 곧 확정, 업무 기록 상태 `registered`), 단계 사본이 도구 안에 얼어 들어간다(원문 응답 없이 모양만).
`engine.invoke` 가 `flow.runner` 로 넘기고, 인자가 없으면 목록(`items`·`total`), `index`·`match` 면 고른 행으로 단계를 이어 상세를 돌려준다(`picked`).
단계 실행 핵심은 `flow/core.py` 하나를 레코더 검증과 함께 쓴다 — `replay.run_once` 는 얇은 감싸개다. `flow` 는 배포 서버 프로세스가 불러오므로 Playwright·레코더 세션을 import 하지 않는다.
업무 기록 화면에는 정책 칸이 없다 — 도구 정책(실행 방식·마스킹·캐시·한도)은 다른 탭처럼 변환 스튜디오에서만 정한다.
```

- [ ] **Step 5: 전체 시험** — `cd apps/backend && caffeinate -dimsu .venv/bin/pytest tests/ -q -p no:warnings` → 모두 PASS

- [ ] **Step 6: 커밋**

```bash
git add apps/backend/tests/test_ieum_flow_runner.py CLAUDE.md docs/superpowers/specs/2026-10-10-ieum-web-recorder-design.md
git commit -m "docs: 업무 도구를 CLAUDE.md 와 업무 기록 설계에 적고 배포 서버 끝까지 시험한다"
```

---

## 실사이트 시연 (구현 뒤, 시험 아님)

띄워 둔 화면 브라우저(`scratchpad/live5/driver.py`)로: 네이버 업무 기록 열기 → [도구 후보로 등록] → [변환 스튜디오 열기] → 단계 흐름·안내 띠 → [검토 완료] → 테스트 실행(인자 없음 → 목록, `index=2` → 기사) → AI 연결 배포 → 배포 서버에 MCP `tools/call`. 영상으로 남기고, 끝나면 이음 상태를 백업으로 되돌린다.
