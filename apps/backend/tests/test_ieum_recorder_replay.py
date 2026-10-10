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

    async def fake(bf, inputs, raw, http, browser, ask, gap, kind="same-values"):
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
