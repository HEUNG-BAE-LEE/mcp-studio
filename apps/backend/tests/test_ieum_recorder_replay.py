# apps/backend/tests/test_ieum_recorder_replay.py
"""Replay: 판정·인코딩은 순수 시험, 실행은 시연용 레거시 사이트에 실제 HTTP 로 보낸다."""
import asyncio
import json
import types

import httpx

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


PAGE = ("<html><head><script>function f(){{ alert('오류가 발생했습니다. 다시 시도해 주십시오.'); }}</script>"
        "<style>.e:after{{content:'처리 중 오류'}}</style></head><body><!-- 권한이 없습니다 -->{body}</body></html>")


def test_스크립트_속_오류_문구는_오류_응답이_아니다():
    """정상 화면의 스크립트·스타일·주석에 든 오류 문구로 실패 판정하지 않는다(data.go.kr 검색 결과에서 실측)."""
    ok_page = PAGE.format(body="<h1>데이터 목록</h1><p>현재 902건</p>")
    for kind in ("other", "html", "json"):
        step = {"kind": kind, "recordedRes": ok_page, "recordedData": None}
        assert replay.judge(200, None, "text/html", ok_page, step, {})[1] != "error_response"


def test_화면에_보이는_오류_문구는_오류_응답이다():
    rec_page = PAGE.format(body="<h1>데이터 목록</h1>")
    err_page = PAGE.format(body="<p>오류가 발생했습니다.</p>")
    step = {"kind": "other", "recordedRes": rec_page, "recordedData": None}
    assert replay.judge(200, None, "text/html", err_page, step, {})[1] == "error_response"


def test_기록_때도_보이던_문구는_오류_표시로_보지_않는다():
    """바닥글의 "오류가 발생하면 고객센터로" 같은 상시 안내는 오류가 아니다."""
    page = PAGE.format(body="<h1>목록</h1><footer>처리 중 오류가 발생하면 고객센터로 연락하세요</footer>")
    step = {"kind": "other", "recordedRes": page, "recordedData": None}
    assert replay.judge(200, None, "text/html", page, step, {})[1] != "error_response"


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
        replay.run_once(_bf(ieum_server), {"fromDt": "20260901", "toDt": "20260930"}, {}, replay.HttpTransport(_login(ieum_server), host="127.0.0.1"), None, _no, 0))
    assert run["ok"] and [s["ok"] for s in run["steps"]] == [True, True]


def test_원값_지도로_마스킹된_입력을_되돌린다(ieum_server):
    bf = _bf(ieum_server)
    run = asyncio.new_event_loop().run_until_complete(
        replay.run_once(bf, {"fromDt": "2026****", "toDt": "20260930"}, {"2026****": "20260901"}, replay.HttpTransport(_login(ieum_server), host="127.0.0.1"), None, _no, 0))
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


class _CountTransport:
    mode = "session"

    def __init__(self):
        self.sent = 0

    async def send(self, step, url, headers, params, form, json_body):
        self.sent += 1
        return 200, None, "application/json", json.dumps({"RSLT": "0000", "totalCnt": 1, "resultList": [{"PO_NO": "x"}]})


def _run(bf, inputs, raw):
    t = _CountTransport()
    run = asyncio.new_event_loop().run_until_complete(replay.run_once(bf, inputs, raw, t, None, _no, 0))
    return run, t


def _masked_bf():
    bf = _bf("http://h")
    bf["steps"] = bf["steps"][:1]
    bf["inputs"][0].update(ex="2026****", needsValue=True)
    bf["steps"][0]["params"][0]["ex"] = "2026****"
    return bf


def test_가린_값은_원값이_없으면_보내지_않고_needs_value():
    run, t = _run(_masked_bf(), {"fromDt": "2026****", "toDt": "20260930"}, {})
    assert not run["ok"] and run["reason"] == "needs_value" and t.sent == 0


def test_원값이_모호하면_None_이라_needs_value():
    run, t = _run(_masked_bf(), {"fromDt": "2026****", "toDt": "20260930"}, {"2026****": None})
    assert run["reason"] == "needs_value" and t.sent == 0


def test_HIDDEN_입력은_빈_값이라도_needs_value():
    bf = _masked_bf()
    bf["inputs"][0].update(ex="", needsValue=True)
    bf["steps"][0]["params"][0]["ex"] = ""
    run, t = _run(bf, {"fromDt": "", "toDt": "20260930"}, {})
    assert run["reason"] == "needs_value" and t.sent == 0


def test_사람이_이름으로_넣은_값은_쓰고_보낸다():
    run, t = _run(_masked_bf(), {"fromDt": "20260901", "toDt": "20260930"}, {})
    assert run["ok"] and t.sent == 1


def test_verify_values_는_입력_이름으로_매핑한다(monkeypatch):
    seen = {}

    async def fake(bf, inputs, raw, http, browser, ask, gap, kind="same-values", **kw):
        seen[kind] = inputs
        return {"kind": kind, "ok": True, "steps": [], "reason": ""}

    monkeypatch.setattr(replay, "run_once", fake)
    monkeypatch.setattr(replay.credentials, "get", lambda k: {"username": "a", "password": "b"})
    monkeypatch.setattr(replay.session_auth, "login", lambda base, c: {})
    bf = _masked_bf()
    bf["inputs"][0].update(ex="")
    rec = {"id": "rec_x", "login": {"mode": "auto", "recipe": {"userField": "u", "passField": "p"}}}
    out = asyncio.new_event_loop().run_until_complete(replay.verify(bf, rec, [], None, {"fromDt": "20260915"}))
    assert seen["same-values"]["fromDt"] == "20260915" and out["verification"]["status"] == "verified"


# ── 수정 1차 ──────────────────────────────────────────────────────────────
def _one(path="/poList.do", **kw):
    bf = _bf("http://h")
    bf["steps"] = [dict(bf["steps"][0], path=path, params=[], outputs={}, **kw)]
    return bf


def test_경로에_가린_값이_남으면_보내지_않는다():
    run, t = _run(_one("/member/010****5678"), {}, {})
    assert run["reason"] == "needs_value" and t.sent == 0


def test_헤더에_가린_값이_남으면_보내지_않는다():
    run, t = _run(_one(headers={"x-user": "ab****cd"}), {}, {})
    assert run["reason"] == "needs_value" and t.sent == 0


def test_채우지_못한_경로_자리는_unresolved_path():
    run, t = _run(_one("/member/{id}"), {}, {})
    assert run["reason"] == "unresolved_path" and t.sent == 0


def test_숨은_토큰인데_화면_주소가_없으면_needs_value():
    bf = _one()
    bf["steps"][0]["params"] = [{"a": "tk", "loc": "form", "from": "session.hidden.tk", "ex": "abc"}]
    run, t = _run(bf, {}, {})
    assert run["reason"] == "needs_value" and t.sent == 0


def test_쿠키는_자기_도메인으로만_간다():
    seen = []

    def handler(request):
        seen.append((request.url.host, request.headers.get("cookie")))
        return httpx.Response(200, json={})

    cookies = [{"name": "A", "value": "1", "domain": "a.example", "path": "/"},
               {"name": "B", "value": "2", "domain": "b.example", "path": "/"}]
    tr = replay.HttpTransport(cookies, transport=httpx.MockTransport(handler))
    step = {"method": "GET", "charset": None}
    loop = asyncio.new_event_loop()
    loop.run_until_complete(tr.send(step, "http://a.example/x", {}, {}, {}, None))
    loop.run_until_complete(tr.send(step, "http://b.example/x", {}, {}, {}, None))
    assert seen == [("a.example", "A=1"), ("b.example", "B=2")]


class _FakeSession:
    closed = False

    def __init__(self, cookies):
        self.ctx = types.SimpleNamespace(cookies=self._c(cookies))
        self.page = object()
        self.trace = types.SimpleNamespace(raw={})
        self.guard = types.SimpleNamespace(ask=self._ask)

    @staticmethod
    def _c(cookies):
        async def f():
            if isinstance(cookies, Exception):
                raise cookies
            return cookies
        return f

    async def _ask(self, *a):
        return True


def test_쓰기가_이미_나갔으면_브라우저로_다시_실행하지_않는다(monkeypatch):
    calls = []

    async def fake(bf, inputs, raw, http, browser, ask, gap, kind="same-values", **kw):
        calls.append(kind)
        return {"kind": kind, "ok": False, "steps": [], "reason": "http_error", "wrote": True}

    monkeypatch.setattr(replay, "run_once", fake)
    bf = _bf("http://h")
    bf["steps"][0]["write"] = True
    out = asyncio.new_event_loop().run_until_complete(replay.verify(bf, {"id": "r"}, [], _FakeSession([])))
    assert len(calls) == 1 and out["verification"]["runs"][0]["note"] == "쓰기가 이미 나가 다시 실행하지 않음"


def test_사람_값이_같은_값과_같아지면_다른_값_실행은_건너뛴다(monkeypatch):
    calls = []

    async def fake(bf, inputs, raw, http, browser, ask, gap, kind="same-values", **kw):
        calls.append(kind)
        return {"kind": kind, "ok": True, "steps": [], "reason": ""}

    monkeypatch.setattr(replay, "run_once", fake)
    bf = _bf("http://h")
    bf["inputs"] = [{"name": "who", "type": "string", "source": "USER_INPUT", "ex": "", "needsValue": True}]
    monkeypatch.setattr(replay, "varied_inputs", lambda b, s: {"who": ""})
    out = asyncio.new_event_loop().run_until_complete(replay.verify(bf, {"id": "r"}, [], _FakeSession([]), {"who": "kim"}))
    assert calls == ["same-values"]
    assert out["verification"]["runs"][1]["reason"] == "skipped" and out["verification"]["status"] == "verified"


def test_금고_계정이_없으면_needs_login_이고_예외가_없다(monkeypatch):
    def boom(base, cred):
        raise session_auth.LoginError("x")
    monkeypatch.setattr(replay.session_auth, "login", boom)
    monkeypatch.setattr(replay.credentials, "get", lambda k: None)
    rec = {"id": "r", "login": {"mode": "auto", "recipe": {"userField": "u", "passField": "p"}}}
    out = asyncio.new_event_loop().run_until_complete(replay.verify(_bf("http://h"), rec, [], None))
    assert out["verification"]["status"] == "needs-login"


def test_쿠키를_못_읽으면_failed_이고_예외가_없다():
    out = asyncio.new_event_loop().run_until_complete(replay.verify(_bf("http://h"), {"id": "r"}, [], _FakeSession(RuntimeError("x"))))
    assert out["verification"]["status"] == "failed"


def test_브라우저_본문은_기록한_인코딩으로_미리_만든다():
    class Page:
        def __init__(self):
            self.args = []

        async def evaluate(self, script, arg):
            self.args.append(arg)
            return [200, None, "application/json", "{}"]

    page = Page()
    step = {"method": "POST", "charset": "EUC-KR", "params": []}
    asyncio.new_event_loop().run_until_complete(replay.BrowserTransport(page).send(step, "http://h/x", {}, {}, {"vendNm": "한빛"}, None))
    m, u, h, body = page.args[0]
    assert body == "vendNm=%C7%D1%BA%FB" and "charset=EUC-KR" in h["content-type"]


def test_status_0_은_세션_만료_후보():
    assert replay.judge(0, None, "", "", JSTEP, {})[1] == "auth_expired"


def test_세션_만료면_한_번_다시_로그인해_이어_간다():
    class T:
        mode = "session"
        cookies = {}

        def __init__(self, n=0):
            self.n = n

        async def send(self, step, url, headers, params, form, json_body):
            self.n += 1
            if self.n == 1:
                return 302, "/po/login.do", "", ""
            if self.n < 0:
                return 302, "/po/login.do", "", ""
            return 200, None, "application/json", json.dumps({"RSLT": "0000", "totalCnt": 1, "resultList": [{"PO_NO": "x"}]})

    async def relogin():
        return {"sid": "new"}

    bf = _one()
    t = T()
    run = asyncio.new_event_loop().run_until_complete(replay.run_once(bf, {}, {}, t, None, _no, 0, relogin=relogin))
    assert run["ok"] and t.n == 2

    t2 = T(-10)                                             # 계속 만료: 두 번째 만료는 실패, 로그인은 한 번뿐
    run = asyncio.new_event_loop().run_until_complete(replay.run_once(bf, {}, {}, t2, None, _no, 0, relogin=relogin))
    assert not run["ok"] and run["reason"] == "auth_expired" and t2.n == -8


def test_요청_간격은_실행_사이에도_지킨다():
    import time
    t = _CountTransport()
    pace = [0.0]
    bf = _one()
    loop = asyncio.new_event_loop()
    t0 = time.monotonic()
    loop.run_until_complete(replay.run_once(bf, {}, {}, t, None, _no, 0.3, pace=pace))
    loop.run_until_complete(replay.run_once(bf, {}, {}, t, None, _no, 0.3, pace=pace))
    assert time.monotonic() - t0 >= 0.29


# ── 수정 2차 ──────────────────────────────────────────────────────────────
def test_재로그인_뒤_새_쿠키는_다른_출처로_가지_않는다():
    seen = []

    def handler(request):
        seen.append((request.url.host, request.headers.get("cookie")))
        return httpx.Response(200, json={"RSLT": "0000", "totalCnt": 1, "resultList": [{"PO_NO": "x"}]})

    tr = replay.HttpTransport({"sid": "old"}, host="a.example", transport=httpx.MockTransport(handler))
    tr.cookies = {"sid": "new"}                              # 재로그인이 하는 일
    step = {"method": "GET", "charset": None}
    loop = asyncio.new_event_loop()
    loop.run_until_complete(tr.send(step, "http://a.example/x", {}, {}, {}, None))
    loop.run_until_complete(tr.send(step, "http://other.example/x", {}, {}, {}, None))
    assert seen == [("a.example", "sid=new"), ("other.example", None)]
    assert replay.HttpTransport({"sid": "v"})._cookie_header("http://a.example/") == ""    # 호스트를 모르면 보내지 않는다


def test_쿠키_일치_규칙():
    c = [{"name": "H", "value": "1", "domain": "a.example", "path": "/po"},
         {"name": "D", "value": "2", "domain": ".a.example", "path": "/"},
         {"name": "S", "value": "3", "domain": "a.example", "path": "/", "secure": True}]
    tr = replay.HttpTransport(c)
    assert tr._cookie_header("http://a.example/po/x") == "H=1; D=2"
    assert tr._cookie_header("http://a.example/poison") == "D=2"
    assert tr._cookie_header("http://sub.a.example/po") == "D=2"
    assert tr._cookie_header("https://a.example/po") == "H=1; D=2; S=3"


def test_숨은_토큰을_못_찾아_가린_값이_남으면_보내지_않는다():
    class Page:
        def __init__(self):
            self.calls = 0

        async def evaluate(self, script, arg):
            self.calls += 1
            return {}                                       # 화면에 토큰 입력이 없다

    bf = _one()
    bf["steps"][0].update(exec="browser", method="POST", formPage="http://h/po/form.do",
                          params=[{"a": "tk", "loc": "form", "from": "session.hidden.tk", "ex": "ab****cd"}])
    page = Page()

    async def yes(step):                                       # 설계 3판: GET 이 아닌 단계는 조회로 분류돼도 승인받는다
        return "approve"
    run = asyncio.new_event_loop().run_until_complete(replay.run_once(bf, {}, {}, None, replay.BrowserTransport(page), yes, 0))
    assert run["reason"] == "needs_value" and page.calls == 1     # 토큰 조회 한 번뿐, 전송 없음


def test_보내지_않을_요청에는_쓰기_승인을_묻지_않는다():
    asked = []

    async def ask(st):
        asked.append(st["id"])
        return True

    bf = _one("/member/{id}", write=True, method="POST")
    t = _CountTransport()
    run = asyncio.new_event_loop().run_until_complete(replay.run_once(bf, {}, {}, t, None, ask, 0))
    assert run["reason"] == "unresolved_path" and asked == [] and t.sent == 0


def test_차단된_로그인_주소면_다시_로그인하지_않고_이유를_남긴다(monkeypatch):
    monkeypatch.setattr(replay.credentials, "get", lambda k: {})
    calls = []

    async def fake_run(bf, inputs, raw, http, browser, ask, gap, kind="same-values", relogin=None, pace=None):
        got = await relogin()
        calls.append((got, getattr(relogin, "note", None)))
        return {"kind": kind, "ok": True, "steps": [], "reason": ""}

    # 첫 로그인은 막지 않고 통과시키려고 scope 를 첫 로그인 뒤에 막는다
    state = {"n": 0}
    orig = lambda url, origin, extra=None: "차단" if state["n"] and "login" in url.lower() else None
    monkeypatch.setattr(replay.scope, "blocked", orig)

    def login2(base, cred):
        state["n"] += 1
        return {"sid": "x"}

    monkeypatch.setattr(replay.session_auth, "login", login2)
    monkeypatch.setattr(replay, "run_once", fake_run)
    rec = {"id": "r", "login": {"mode": "auto", "recipe": {"userField": "u", "passField": "p"}}}
    asyncio.new_event_loop().run_until_complete(replay.verify(_bf("http://h"), rec, [], None))
    assert calls[0][0] is None and "차단" in calls[0][1] and state["n"] == 1


def test_쓰기_단계에서_세션이_만료되면_이유를_남기고_재전송하지_않는다():
    class T:
        mode = "session"
        n = 0

        async def send(self, *a):
            self.n += 1
            return 302, "/po/login.do", "", ""

    async def relogin():
        return {"sid": "n"}

    async def yes(st):
        return True

    t = T()
    bf = _one("/poSave.do", write=True, method="POST")
    run = asyncio.new_event_loop().run_until_complete(replay.run_once(bf, {}, {}, t, None, yes, 0, relogin=relogin))
    assert run["reason"] == "auth_expired" and t.n == 1 and "쓰기" in run["steps"][0]["note"]


def test_verify_는_예상_못한_예외도_던지지_않는다(monkeypatch):
    async def boom(*a, **k):
        raise KeyError("x")
    monkeypatch.setattr(replay, "run_once", boom)
    out = asyncio.new_event_loop().run_until_complete(replay.verify(_bf("http://h"), {"id": "r"}, [], _FakeSession([])))
    assert out["verification"]["status"] == "failed" and out["verification"]["runs"][0]["note"] == "KeyError"


def _varied_calls(monkeypatch, write):
    calls = []

    async def fake(bf, inputs, raw, http, browser, ask, gap, kind="same-values", **kw):
        calls.append(kind)
        return {"kind": kind, "ok": True, "steps": [], "reason": ""}

    monkeypatch.setattr(replay, "run_once", fake)
    bf = _bf("http://h")
    bf["steps"][0].update(method="POST", write=write)
    asyncio.new_event_loop().run_until_complete(replay.verify(bf, {"id": "r"}, [], _FakeSession([])))
    return calls


def test_쓰기_단계만_같은_값으로만_재실행하고_조회로_분류된_POST_는_다른_값도_실행한다(monkeypatch):
    assert _varied_calls(monkeypatch, True) == ["same-values"]
    assert _varied_calls(monkeypatch, False) == ["same-values", "varied-values"]


# 수정 3차: 긴 정상 화면 속 오류 안내 문구
ERR_TABLE = ("<table><tr><th>코드</th><th>설명</th></tr>" + "".join(f"<tr><td>E{i:03d}</td><td>항목 {i} 설명 글자 {'가' * 40}</td></tr>" for i in range(120))
             + "<tr><td>E999</td><td>GW 내부 처리 중 오류가 발생했습니다</td></tr></table>")


def _long_page(extra=""):
    return f"<html><head><title>상세 정보</title></head><body><h1>데이터 상세</h1>{extra}{ERR_TABLE}</body></html>"


def test_긴_정상_화면_속_오류_코드표는_오류_응답이_아니다():
    page = _long_page()
    step = {"kind": "other", "recordedRes": page[:4000], "recordedData": None}
    assert replay.judge(200, None, "text/html", page, step, {})[1] != "error_response"


def test_짧은_오류_화면은_오류_응답이다():
    page = "<html><head><title>안내</title></head><body><p>처리 중 오류가 발생했습니다.</p></body></html>"
    step = {"kind": "other", "recordedRes": "<html><body><h1>목록</h1></body></html>", "recordedData": None}
    assert replay.judge(200, None, "text/html", page, step, {})[1] == "error_response"


def test_기록_때_화면에_있던_문구는_errSeen_으로_무시한다():
    page = "<html><body><p>처리 중 오류가 발생하면 고객센터로 문의하세요</p></body></html>"
    step = {"kind": "other", "recordedRes": "<html><body>앞부분만</body></html>", "recordedData": None, "recordedErrSeen": ["오류가 발생", "처리 중 오류"]}
    assert replay.judge(200, None, "text/html", page, step, {})[1] != "error_response"


def test_제목에_오류_문구가_있으면_긴_화면이라도_오류_응답이다():
    page = _long_page().replace("<title>상세 정보</title>", "<title>처리 중 오류</title>")
    step = {"kind": "other", "recordedRes": "<html><body>x</body></html>", "recordedData": None}
    assert replay.judge(200, None, "text/html", page, step, {})[1] == "error_response"


def test_기록_때_전체_화면의_오류_문구를_errSeen_으로_남긴다():
    from tests.test_ieum_recorder_trace import _bare_trace
    page = _long_page("<div>" + "나" * 50_000 + "</div>")

    class Req:
        resource_type, method, headers, post_data = "document", "GET", {}, None

    class Resp:
        url, status, headers, request = "http://rec.test/po/detail.do", 200, {"content-type": "text/html; charset=utf-8"}, Req()

        async def text(self):
            return page

    tr = _bare_trace()
    tr.current = {"network": []}
    asyncio.new_event_loop().run_until_complete(tr.on_response(Resp()))
    assert tr.current["network"][0]["errSeen"] == ["오류가 발생", "처리 중 오류"]   # 40KB 뒤 코드표의 문구까지


# T11: 로그인 없이 기록한 공개 사이트는 세션 밖에서도 다시 검증한다
def _public_server(hits):
    import http.server
    import threading

    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            hits.append((self.path, self.headers.get("Cookie")))
            if self.path.startswith("/private.do"):
                self.send_response(302)
                self.send_header("Location", "/login.do")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            b = json.dumps({"RSLT": "0000", "resultList": [{"PO_NO": "PO-1"}]}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)

        def log_message(self, *a):
            pass
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}"


def _public_bf(base, path="/list.do"):
    return {"id": "bf_p", "source": {"base": base, "env": "op", "recordingId": "rec_p"}, "inputs": [], "auth": {"mode": "none"},
            "steps": [{"id": "s1", "base": base, "method": "GET", "path": path, "kind": "json", "exec": "http", "charset": None, "write": False,
                       "headers": {}, "outputs": {}, "params": [], "recordedData": None,
                       "recordedRes": json.dumps({"RSLT": "0000", "resultList": [{"PO_NO": "PO-9"}]})}]}


PUBLIC_REC = {"id": "rec_p", "login": {"mode": "manual", "recipe": None, "path": ""}, "approvals": [{"decision": "beacon"}, {"decision": "sent"}]}


def test_로그인_없던_공개_기록은_세션_밖에서_익명으로_다시_검증한다():
    hits = []
    srv, base = _public_server(hits)
    try:
        out = asyncio.new_event_loop().run_until_complete(replay.verify(_public_bf(base), PUBLIC_REC, [], None))
    finally:
        srv.shutdown()
    assert out["verification"]["status"] == "verified", out
    assert hits and all(path == "/list.do" and cookie is None for path, cookie in hits)


def test_직접_로그인한_기록은_여전히_needs_login():
    for login, approvals in (({"mode": "manual", "recipe": None, "path": "/loginProc.do"}, []),
                             ({"mode": "manual", "recipe": None, "path": ""}, [{"decision": "login"}])):
        rec = {"id": "rec_m", "login": login, "approvals": approvals}
        out = asyncio.new_event_loop().run_until_complete(replay.verify(_public_bf("http://127.0.0.1:9"), rec, [], None))
        assert out["verification"]["status"] == "needs-login"


def test_익명_재검증이_로그인_화면으로_보내지면_needs_login():
    hits = []
    srv, base = _public_server(hits)
    try:
        out = asyncio.new_event_loop().run_until_complete(replay.verify(_public_bf(base, "/private.do"), PUBLIC_REC, [], None))
    finally:
        srv.shutdown()
    assert out["verification"]["status"] == "needs-login"


def test_승인_기록이_잘린_기록은_익명으로_다시_검증하지_않는다():
    rec = dict(PUBLIC_REC, approvalsDropped=3)            # 상한을 넘겨 잘린 기록에는 로그인 항목이 빠졌을 수 있다
    out = asyncio.new_event_loop().run_until_complete(replay.verify(_public_bf("http://127.0.0.1:9"), rec, [], None))
    assert out["verification"]["status"] == "needs-login"
