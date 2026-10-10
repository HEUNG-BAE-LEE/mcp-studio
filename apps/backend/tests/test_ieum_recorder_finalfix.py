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


def test_Replay_가_승인받은_요청은_브라우저에서_다시_묻지_않고_한_번만_통과한다():
    g, sent = make()

    async def go():
        t = asyncio.ensure_future(g.ask("POST", "http://h:8080/po/poSave.do", "Replay", once=True))
        await asyncio.sleep(0.05)
        g.decide(next(iter(g.pending)), True)
        assert await t
        r1 = Route()
        await g.route(r1, Req("http://h:8080/po/poSave.do?x=1", "POST", post="a=1"))     # 쿼리는 비교하지 않는다
        r2 = Route()
        t2 = asyncio.ensure_future(g.route(r2, Req("http://h:8080/po/poSave.do", "POST", post="a=1")))
        await asyncio.sleep(0.05)
        second_held = g.holding
        g.deny_all()
        await t2
        return r1.done, r2.done, second_held
    first, second, held = run(go())
    assert first == "continue" and held and second == "abort"
    assert [m["t"] for m in sent].count("hold") == 2          # 첫 승인 + 허용을 다 쓴 뒤의 새 요청


def test_한_번_허용은_다른_메서드나_주소에는_쓰이지_않고_시간이_지나면_사라진다():
    g, _ = make()
    g.allow_once("POST", "http://h:8080/po/poSave.do", ttl=30)
    assert not g._consume_allowance("PUT", "http://h:8080/po/poSave.do")
    assert not g._consume_allowance("POST", "http://h:8080/po/poDelete.do")
    g.allow_once("POST", "http://h:8080/po/a.do", ttl=-1)
    assert not g._consume_allowance("POST", "http://h:8080/po/a.do")
    assert g._consume_allowance("POST", "http://h:8080/po/poSave.do")
    assert not g._consume_allowance("POST", "http://h:8080/po/poSave.do")


def test_거절된_Replay_승인은_한_번_허용을_남기지_않는다():
    g, _ = make()

    async def go():
        t = asyncio.ensure_future(g.ask("POST", "http://h:8080/po/poSave.do", "Replay", once=True))
        await asyncio.sleep(0.05)
        g.decide(next(iter(g.pending)), False)
        return await t
    assert run(go()) is False and not g._allow


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
