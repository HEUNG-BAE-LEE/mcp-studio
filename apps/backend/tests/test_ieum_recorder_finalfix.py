# apps/backend/tests/test_ieum_recorder_finalfix.py
"""전체 검토 지적 수정: 멈춘 뒤 Replay 승인, 한 번 허용, 서비스 워커, 환경 표기, 숨은 토큰 위치, 승인 기록 마스킹,
일시정지, 스테이징 쓰기 GET, CDATA, 경로 마스킹. 브라우저 없이 돈다."""
import asyncio
import json
import time

import pytest

from app.ieum.discovery.policy import Policy
from app.ieum.recorder import analyze, config, replay
from app.ieum.recorder.guard import Guard
from app.ieum.recorder.trace import Trace
from app.ieum.discovery.masking import HIDDEN

from tests.test_ieum_recorder_analyze import BASE, REC, net, span
from tests.test_ieum_recorder_guard import P, Req, Route, make
from tests.test_ieum_recorder_replay import _CountTransport, _one


def run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


# ── C1: Replay 승인과 한 번 허용 ───────────────────────────────────────────
def test_Replay_가_물은_승인_창은_replay_승인으로_표시된다():
    g, sent = make()

    async def go():
        t = asyncio.ensure_future(g.ask("POST", "http://h:8080/po/poSave.do", "Replay 검증: /poSave.do"))
        await asyncio.sleep(0.05)
        hid = next(iter(g.pending))
        assert g.is_replay_hold(hid)
        g.decide(hid, True)
        return await t
    assert run(go()) is True


def test_기록_중_붙잡은_요청은_replay_승인이_아니다():
    g, sent = make()

    async def go():
        r = Route()
        t = asyncio.ensure_future(g.route(r, Req("http://h:8080/po/poSave.do", "POST", post="a=1")))
        await asyncio.sleep(0.05)
        hid = next(iter(g.pending))
        replay_hold = g.is_replay_hold(hid)
        g.decide(hid, False)
        await t
        return replay_hold
    assert run(go()) is False


class _GuardPage:
    """BrowserTransport 가 보내는 요청을 가드에 그대로 통과시켜 보는 가짜 페이지."""

    def __init__(self, guard, tokens=None, fail=False):
        self.guard, self.tokens, self.fail, self.routes = guard, tokens or {}, fail, []

    async def evaluate(self, script, arg):
        if script == replay._FETCH_HIDDEN:
            if self.fail:
                raise RuntimeError("화면을 못 받음")
            return dict(self.tokens)
        m, u, h, body = arg
        r = Route()
        await self.guard.route(r, Req(u, m, post=body))
        self.routes.append(r.done)
        return [200, None, "application/json", "{}"]


def _write_step(**kw):
    st = {"method": "POST", "charset": None, "write": True, "params": []}
    st.update(kw)
    return st


def test_Replay_가_승인받은_그_요청만_정확히_한_번_통과한다():
    g, sent = make()
    page = _GuardPage(g)
    tr = replay.BrowserTransport(page, g)
    run(tr.send(_write_step(), "http://h:8080/po/poSave.do", {}, {"q": "1"}, {"a": "1"}, None))
    assert page.routes == ["continue"] and not g.holding and not g._exact
    assert [m["t"] for m in sent].count("hold") == 0                  # 승인은 ask 가 이미 받았다(여기서는 다시 묻지 않는다)


def test_본문이나_쿼리가_다른_같은_경로_쓰기는_허용을_쓰지_못하고_붙잡힌다():
    g, sent = make(timeout=0.2)

    async def go():
        token = g.allow_exact("POST", "http://h:8080/po/poSave.do?q=1", "a=1")
        out = []
        for u, body in (("http://h:8080/po/poSave.do?q=1", "a=2"), ("http://h:8080/po/poSave.do?q=2", "a=1"), ("http://h:8080/po/poSave.do", "a=1")):
            r = Route()
            await g.route(r, Req(u, "POST", post=body))
            out.append(r.done)
        g.revoke(token)
        return out
    assert run(go()) == ["abort", "abort", "abort"]
    assert [m["t"] for m in sent].count("hold") == 3


def test_승인받았지만_보내지_못하면_허용이_남지_않아_뒤따른_쓰기는_붙잡힌다():
    g, sent = make(timeout=0.2)
    page = _GuardPage(g, tokens={})                                    # 숨은 토큰을 못 찾는다
    bf = _one()
    bf["steps"][0].update(exec="browser", method="POST", write=True, formPage="http://h:8080/po/form.do",
                          params=[{"a": "_csrf", "loc": "form", "from": "session.hidden._csrf", "ex": "ab****cd"}])
    out = run(replay.run_once(bf, {}, {}, None, replay.BrowserTransport(page, g), lambda st: _say("approve"), 0))
    assert out["reason"] == "needs_value" and out["steps"][0]["note"].startswith("승인했지만 보내지 않음: ")
    assert not g._exact and page.routes == []
    r = Route()
    run(g.route(r, Req("http://h:8080/po/poList.do", "POST", post="a=1")))
    assert r.done == "abort"


# ── I1: 서비스 워커 차단 ───────────────────────────────────────────────────
def test_기록_브라우저_문맥은_서비스_워커를_막는다(monkeypatch, ieum_state):
    from app.ieum.recorder import session as session_mod, store
    seen = {}

    class FakeBrowser:
        def on(self, *a):
            pass

        async def new_context(self, **kw):
            seen.update(kw)
            raise RuntimeError("여기까지만")

    async def launch(pw):
        return FakeBrowser(), None
    monkeypatch.setattr(session_mod.browser_mod, "launch_async", launch)
    rec = store.new_recording("t", "홍길동", "http://h:8080/po", "", "op", "manual", "")
    s = session_mod.RecorderSession(rec, None)
    with pytest.raises(RuntimeError):
        run(s.start(None))
    assert seen.get("service_workers") == "block"


# ── I2: 스테이징 표기 ──────────────────────────────────────────────────────
def test_스테이징_판정은_stg_와_staging_을_모두_받는다():
    assert config.is_staging("stg") and config.is_staging("staging")
    assert not config.is_staging("op") and not config.is_staging("")


def test_기록_화면_밖_재검증에서_stg_기록의_쓰기는_보낸다(monkeypatch):
    sent = []

    class T(_CountTransport):
        async def send(self, *a):
            sent.append(a)
            return await super().send(*a)

    monkeypatch.setattr(replay, "HttpTransport", lambda *a, **k: T())
    monkeypatch.setattr(replay.credentials, "get", lambda k: {"username": "a", "password": "b"})
    monkeypatch.setattr(replay.session_auth, "login", lambda base, c: {})
    bf = _one(write=True, method="POST")
    bf["source"]["env"] = "stg"
    rec = {"id": "rec_x", "login": {"mode": "auto", "recipe": {"userField": "u", "passField": "p"}}}
    out = run(replay.verify(bf, rec, [], None))
    assert len(sent) == 1 and out["verification"]["runs"][0]["reason"] != "write_denied"


# ── I3: 숨은 토큰 위치·빈 값·가린 값 ───────────────────────────────────────
class _Page:
    def __init__(self, tokens=None):
        self.calls, self.sends, self.tokens = 0, 0, tokens or {}

    async def evaluate(self, script, arg):
        self.calls += 1
        if script == replay._FETCH_SEND:
            self.sends += 1
            return [200, None, "application/json", json.dumps({"RSLT": "0000", "totalCnt": 1, "resultList": [{"PO_NO": "x"}]})]
        return dict(self.tokens)


def _hidden_step(loc, ex="ab****cd", tokens=None):
    bf = _one()
    bf["steps"][0].update(exec="browser", method="POST", formPage="http://h/po/form.do",
                          params=[{"a": "tk", "loc": loc, "from": "session.hidden.tk", "ex": ex}])
    page = _Page(tokens)
    out = run(replay.run_once(bf, {}, {}, None, replay.BrowserTransport(page), lambda st: _true(), 0))
    return out, page


async def _true():
    return True


def test_쿼리에_든_숨은_토큰은_새로_받지_못하므로_needs_value_이고_보내지_않는다():
    out, page = _hidden_step("query", tokens={"tk": "fresh"})
    assert out["reason"] == "needs_value" and page.sends == 0 and page.calls == 0


def test_JSON_본문에_든_숨은_토큰도_needs_value_이고_보내지_않는다():
    out, page = _hidden_step("body", tokens={"tk": "fresh"})
    assert out["reason"] == "needs_value" and page.sends == 0 and page.calls == 0


def test_폼의_숨은_토큰을_화면에서_빈_값으로만_찾으면_보내지_않는다():
    out, page = _hidden_step("form", ex="", tokens={})
    assert out["reason"] == "needs_value" and page.sends == 0


def test_폼의_숨은_토큰을_새로_받으면_보낸다():
    out, page = _hidden_step("form", ex="ab****cd", tokens={"tk": "fresh"})
    assert out["ok"] and page.sends == 1


def test_브라우저_전송은_쿼리나_JSON_에_가린_값이_남으면_보내지_않는다():
    page = _Page()
    tr = replay.BrowserTransport(page)
    step = {"method": "POST", "charset": None, "params": []}
    with pytest.raises(replay.NeedsValue):
        run(tr.send(step, "http://h/x", {}, {"tel": "010****5678"}, {}, None))
    with pytest.raises(replay.NeedsValue):
        run(tr.send(step, "http://h/x", {}, {}, {}, {"a": {"b": "••••••••"}}))
    assert page.sends == 0


# ── I4: 승인 기록의 주소 마스킹 ────────────────────────────────────────────
def test_승인_기록과_승인_창에_쿼리의_개인정보와_토큰이_남지_않는다():
    g, sent = make()

    async def go():
        r = Route()
        t = asyncio.ensure_future(g.route(r, Req("http://h:8080/po/save.do?tel=010-1234-5678&_csrf=abc", "POST", post="a=1")))
        await asyncio.sleep(0.05)
        g.deny_all()
        await t
        await g.route(Route(), Req("http://127.0.0.1:9/x?tel=010-1234-5678&_csrf=abc"))      # 차단 주소
    run(go())
    blob = json.dumps(g.decisions, ensure_ascii=False) + json.dumps(sent, ensure_ascii=False)
    assert "010-1234-5678" not in blob and "_csrf=abc" not in blob
    assert any(d["decision"] == "denied-host" for d in g.decisions)


# ── I5: 일시정지 ───────────────────────────────────────────────────────────
class _Resp:
    def __init__(self, url="http://rec.test/po/poList.do"):
        self.url, self.status, self.headers = url, 200, {"content-type": "application/json"}
        self.request = type("Q", (), {"resource_type": "xhr", "method": "GET", "headers": {}, "post_data": None})()

    async def text(self):
        return '{"a":1}'


def test_일시정지를_켜면_열린_묶음을_닫고_그동안의_행동_입력_응답은_담지_않는다(monkeypatch):
    import app.ieum.recorder.trace as mod
    stored = []
    monkeypatch.setattr(mod.store, "append_span", lambda rid, sp: stored.append(sp))
    p = Policy(base="http://rec.test/po")

    async def notify(msg):
        pass
    tr = Trace("x", p, Guard(p, "op", notify), notify)

    async def snap(page, seq, when):
        return {"url": "", "href": "", "title": "", "aria": "", "hidden": {}, "shot": None}

    async def settle():
        return None
    tr._snapshot, tr._settle = snap, settle

    async def go():
        await tr.begin(None, "click")
        await tr.set_paused(True, None)
        assert tr.current is None and len(stored) == 1
        assert await tr.begin(None, "click") is None
        tr.on_dom_event(None, {"type": "change", "el": {"name": "q"}, "value": "비밀 아닌 값"})
        tr.on_dom_event(None, {"type": "click", "el": {"text": "버튼"}})
        await tr.on_response(_Resp())
        await tr.set_paused(False, None)
        await tr.finish(None)
    run(go())
    assert len(stored) == 1 and stored[0]["fills"] == [] and stored[0]["network"] == [] and stored[0]["action"]["target"] is None


# ── I6: 스테이징의 이름이 쓰기 같은 GET ────────────────────────────────────
def test_스테이징_기록의_삭제_GET_은_읽기_도구가_되지_않는다():
    rec = dict(REC, env="stg")
    spans = [span(1, {"tag": "BUTTON", "text": "삭제"}, [net("GET", "/deleteItem.do", "id=PO-2609-0142", {"RSLT": "0000"}, decision="staging")])]
    bf = analyze.analyze(rec, spans)
    assert bf["steps"] and bf["steps"][0]["write"] is True and bf["policy"]["operation"] != "READ"


def test_결정이_없어도_이름이_쓰기_같은_xhr_GET_은_쓰기다():
    spans = [span(1, {"tag": "BUTTON", "text": "삭제"}, [net("GET", "/deleteItem.do", "id=PO-2609-0142", {"RSLT": "0000"})])]
    bf = analyze.analyze(dict(REC, env="stg"), spans)
    assert bf["steps"] and bf["policy"]["operation"] != "READ"


# ── CDATA·경로 마스킹 ──────────────────────────────────────────────────────
def _bare():
    p = Policy(base="http://rec.test/po")

    async def notify(msg):
        pass
    return Trace("x", p, Guard(p, "op", notify), notify)


def test_CDATA_는_첫_닫힘에서_끝나_뒤_태그의_비밀을_놓치지_않는다():
    out = _bare()._post("<r><note><![CDATA[hello]]>\n</note><password><![CDATA[s3cr3t]]></password><note><![CDATA[x]]></note></r>", "text/xml")
    assert "s3cr3t" not in out and "hello" in out


def test_CDATA_와_글자가_섞인_비밀_태그도_가린다():
    out = _bare()._post("<r><password><![CDATA[s3]]>x</password><userId>kim</userId></r>", "text/xml")
    assert "[s3]" not in out and "]]>x" not in out and "kim" in out


def test_묶음_주소의_경로_조각에_든_개인정보도_가린다():
    tr = _bare()
    u = tr._url("http://rec.test/po/member/01012345678/detail.do?tel=010-1234-5678")
    assert "01012345678" not in u and "010-1234-5678" not in u
    assert u.startswith("http://rec.test/po/member/") and "/detail.do?tel=" in u and u.count("/") == 6     # 경로 모양은 그대로


# ── 수정 2: 숨은 필드 규칙을 토큰으로 좁힌다 ─────────────────────────────
def _hidden_span(method, path, query="", post=None, hidden=None):
    return [span(1, {"tag": "BUTTON", "text": "조회"}, [net(method, path, query, {"RSLT": "0000", "resultList": [{"PO_NO": "PO-2609-0142"}]}, post=post)],
                 post_aria="- row: PO-2609-0142", hidden=hidden)]


class _Capture(_CountTransport):
    def __init__(self):
        super().__init__()
        self.args = []

    async def send(self, step, url, headers, params, form, json_body):
        self.args.append((step["method"], dict(params), dict(form)))
        return await super().send(step, url, headers, params, form, json_body)


def test_eGov_모양의_숨은_페이지_번호는_기록값으로_보낸다():
    spans = _hidden_span("GET", "/poList.do", "pageIndex=1&cmd=", hidden={"pageIndex": "1", "cmd": ""})
    bf = analyze.analyze(REC, spans)
    st = bf["steps"][0]
    assert st["exec"] == "http" and not any((p.get("from") or "").startswith("session.hidden.") for p in st["params"])
    t = _Capture()
    out = run(replay.run_once(bf, {i["name"]: i.get("ex") or "" for i in bf["inputs"]}, {}, t, None, lambda st: _true(), 0))
    assert out["ok"], out
    assert t.sent == 1 and t.args[0][1]["pageIndex"] == "1"


def test_숨은_빈_mode_가_든_폼_쓰기는_승인되면_한_번_보낸다():
    spans = _hidden_span("POST", "/poSave.do", post="mode=&vendCd=V001", hidden={"mode": "", "vendCd": "V001"})
    bf = analyze.analyze(dict(REC, env="op"), spans)
    st = bf["steps"][0]
    assert st["write"] and st["exec"] == "http"
    asked = []

    async def ask(step):
        asked.append(step["id"])
        return True
    t = _Capture()
    out = run(replay.run_once(bf, {i["name"]: i.get("ex") or "" for i in bf["inputs"]}, {}, t, None, ask, 0))
    assert asked == ["s1"] and t.sent == 1 and t.args[0][2].get("mode") == "", out


def test_토큰_이름이거나_가린_숨은_값만_세션_숨은_값이_된다():
    spans = _hidden_span("POST", "/poSave.do", post="_csrf=tok-1&mode=A&vendCd=V001", hidden={"_csrf": "tok-1", "mode": "A", "vendCd": "V001"})
    st = analyze.analyze(REC, spans)["steps"][0]
    froms = {p["a"]: p["from"] for p in st["params"]}
    assert froms["_csrf"] == "session.hidden._csrf" and st["exec"] == "browser"
    assert froms["mode"] == "const:A" and froms["vendCd"] == "const:V001"


async def _say(v):
    return v


def test_사람이_승인하지_않은_쓰기_실패는_승인했다고_적지_않는다():
    bf = _one()
    bf["steps"][0].update(exec="browser", method="POST", write=True, formPage="http://h:8080/po/form.do",
                          params=[{"a": "_csrf", "loc": "form", "from": "session.hidden._csrf", "ex": "ab****cd"}])
    for said in ("staging", True):                                    # 스테이징·세션 밖 재검증은 사람 승인이 없다
        out = run(replay.run_once(bf, {}, {}, None, replay.BrowserTransport(_Page()), lambda st, v=said: _say(v), 0))
        note = out["steps"][0]["note"]
        assert out["reason"] == "needs_value" and note.startswith("보내지 않음: ") and "승인" not in note


def test_세션_안_검증의_ask_는_운영이면_approve_스테이징이면_staging_을_돌려준다():
    import types
    for env, want in (("op", "approve"), ("stg", "staging")):
        g, _ = make(env=env)

        async def go(g=g):
            sess = types.SimpleNamespace(closed=False, guard=g, page=_Page(), trace=types.SimpleNamespace(raw={}),
                                         ctx=types.SimpleNamespace(cookies=lambda: _say([])))
            seen = []

            async def fake(bf, inputs, raw, http, browser, ask, gap, kind="same-values", **kw):
                t = asyncio.ensure_future(ask(bf["steps"][0]))
                await asyncio.sleep(0.05)
                for hid in list(g.pending):
                    g.decide(hid, True)
                seen.append(await t)
                return {"kind": kind, "ok": True, "steps": [], "reason": ""}
            orig, replay.run_once = replay.run_once, fake
            try:
                await replay.verify(_one(write=True, method="POST"), {"id": "rec_x", "login": {}}, [], sess)
            finally:
                replay.run_once = orig
            return seen[0]
        assert run(go()) == want


def test_앞_응답에서_받은_토큰은_앞_단계_출력으로_이어지고_HTTP_로_실행한다():
    tr = _bare()
    post = tr._post("_csrf=N7f3a9c21q&vendCd=V001", "application/x-www-form-urlencoded")
    spans = [span(1, {"tag": "BUTTON", "text": "열기"}, [net("GET", "/token.do", "", {"val": "N7f3a9c21q"})], post_aria="- text: N7f3a9c21q"),
             span(2, {"tag": "BUTTON", "text": "저장"}, [net("POST", "/poSave.do", "", {"RSLT": "0000"}, post=post)])]
    bf = analyze.analyze(REC, spans)
    st = [s for s in bf["steps"] if s["path"] == "/poSave.do"][0]
    p = [p for p in st["params"] if p["a"] == "_csrf"][0]
    assert (p["a"], p["from"], p["source"]) == ("_csrf", "s1.val", "PREVIOUS_STEP_OUTPUT") and st["exec"] == "http"


def test_묶음에는_토큰_값이_남고_승인_기록에서만_숨긴다():
    tr = _bare()
    assert "tok-1" in tr._url("http://rec.test/po/poList.do?_csrf=tok-1&q=1")
    assert "tok-1" in tr._post("_csrf=tok-1&q=1", "application/x-www-form-urlencoded")
    assert "tok-1" not in tr.guard.safe_url("http://rec.test/po/poList.do?_csrf=tok-1&q=1")


def test_한_번_허용의_주소는_스킴_호스트_대소문자와_기본_포트를_맞춘다():
    g, _ = make()
    t = g.allow_exact("POST", "http://H.TEST:80/x?a=1", "b=2")
    assert g._consume_exact("POST", "http://h.test/x?a=1", "b=2")
    t2 = g.allow_exact("POST", "HTTPS://h.test:443/x", None)
    assert g._consume_exact("POST", "https://h.test/x", "")
    assert t != t2
    t3 = g.allow_exact("POST", "http://h.test:8080/x", None)
    assert not g._consume_exact("POST", "http://h.test/x", None)
    g.revoke(t3)
