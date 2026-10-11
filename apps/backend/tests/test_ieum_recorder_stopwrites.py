# apps/backend/tests/test_ieum_recorder_stopwrites.py
"""설계 3판 8절: 기록 중 쓰기는 보내고, 기록 종료는 마지막 쓰기가 끝난 뒤 닫는다.

종료 순서: 새 입력을 막는다 → 이미 나간 쓰기가 끝나고 1.5초 조용할 때까지 기다린다(상한) → 마지막 묶음을 닫는다
→ 그때부터 쓰기를 막는다(closing) → 열린 확인 창을 닫는다. 대상 사이트는 시험 안의 작은 로컬 HTTP 서버다(외부 접속 없음)."""
import asyncio
import http.server
import threading
import time

import pytest

from app.ieum.recorder import config
from tests.test_ieum_recorder_guard import Req, Route
from tests.test_ieum_recorder_session import WS, _noop, call, live, pytestmark as _browser_mark  # noqa: F401


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _bare_session():
    from app.ieum.recorder.session import RecorderSession
    rec = {"id": "rec_0000abcd", "sourceBase": "http://h:8080/po", "env": "op", "owner": "홍길동", "readPost": "/po/searchPost.do"}
    return RecorderSession(rec, None)


def _capture(s):
    sent = []

    async def bc(msg):
        sent.append(msg)
    s.broadcast = bc
    s.guard.notify = bc
    return sent


# ── 브라우저 없는 단위 시험 ───────────────────────────────────────────────
def test_세션은_예전_기록의_readPost_를_가드에_넘기지_않는다():
    s = _bare_session()
    assert not s.policy.is_read_post("http://h:8080/po/searchPost.do")


def test_종료_시작은_입력만_막고_쓰기는_아직_막지_않는다():
    async def go():
        s = _bare_session()
        _capture(s)
        await s.begin_stopping()
        r = Route()
        await s.guard.route(r, Req("http://h:8080/po/poSave.do", "POST", post="a=1"))
        return s.stopping, s.guard.closing, r.done, s.guard.decisions[-1]["decision"]
    assert _run(go()) == (True, False, "continue", "sent")


def test_마무리는_진행_중인_쓰기가_끝나고_조용해진_뒤_묶음을_닫고_그다음_쓰기를_막는다(monkeypatch):
    monkeypatch.setattr(config, "STOP_QUIET_SEC", 0.3)
    monkeypatch.setattr(config, "STOP_WRITE_WAIT_SEC", 5.0)

    async def go():
        s = _bare_session()
        sent = _capture(s)
        order = []

        async def finish(page):
            order.append(("finish", s.guard.closing, s.guard.writes_in_flight, time.monotonic()))
        s.trace.finish = finish
        w = Req("http://h:8080/po/poSave.do", "POST", post="a=1")
        await s.guard.route(Route(), w)
        await s.begin_stopping()
        t0 = time.monotonic()
        asyncio.get_running_loop().call_later(0.5, s.guard.on_request_done, w)
        pending = await s.wind_down()
        return order, t0, pending, s.guard.closing, sent
    order, t0, pending, closing, sent = _run(go())
    (name, closing_at_finish, inflight, at), = order
    assert not closing_at_finish and inflight == 0 and closing and pending == 0
    assert at - t0 >= 0.5 + 0.3 - 0.05                               # 쓰기가 끝난 뒤 조용한 시간까지 기다렸다
    assert [m["msg"] for m in sent if m.get("t") == "notice"] == ["저장 요청 1건이 끝나기를 기다리는 중입니다."]


def test_쓰기가_없어도_조용한_시간만큼은_기다린다(monkeypatch):
    monkeypatch.setattr(config, "STOP_QUIET_SEC", 0.4)

    async def go():
        s = _bare_session()
        sent = _capture(s)
        await s.begin_stopping()
        t0 = time.monotonic()
        pending = await s.wind_down()
        return time.monotonic() - t0, pending, sent
    took, pending, sent = _run(go())
    assert took >= 0.35 and pending == 0 and not [m for m in sent if m.get("t") == "notice"]


def test_상한을_넘기면_남은_쓰기를_끊지_않고_개수를_돌려준다(monkeypatch):
    monkeypatch.setattr(config, "STOP_QUIET_SEC", 0.1)
    monkeypatch.setattr(config, "STOP_WRITE_WAIT_SEC", 0.6)

    async def go():
        s = _bare_session()
        sent = _capture(s)
        r = Route()
        await s.guard.route(r, Req("http://h:8080/po/poSave.do", "POST", post="a=1"))
        await s.begin_stopping()
        t0 = time.monotonic()
        pending = await s.wind_down()
        return time.monotonic() - t0, pending, r.done, sent, s.guard.closing
    took, pending, done, sent, closing = _run(go())
    assert 0.55 <= took < 3 and pending == 1 and done == "continue" and closing
    assert "응답을 받지 못한 쓰기 1건이 있습니다." in [m["msg"] for m in sent if m.get("t") == "notice"]


def test_마무리에서_닫는_사이_새로_뜬_확인_창은_지우지_않는다(monkeypatch):
    monkeypatch.setattr(config, "STOP_QUIET_SEC", 0.05)

    async def go():
        s = _bare_session()
        _capture(s)
        newer = object()

        class D:
            async def dismiss(self):
                s._dialog = newer                          # 닫는 사이 새 확인 창이 떴다
        s._dialog = D()
        await s.begin_stopping()
        assert isinstance(s._dialog, D)                    # 종료 시작만으로는 닫지 않는다
        await s.wind_down()
        return s._dialog is newer
    assert _run(go())


def test_종료_시작만으로는_열린_확인_창을_닫지_않고_마무리에서_닫는다(monkeypatch):
    monkeypatch.setattr(config, "STOP_QUIET_SEC", 0.05)

    async def go():
        s = _bare_session()
        _capture(s)
        seen = []

        class D:
            async def dismiss(self):
                seen.append(s.guard.closing)
        d = s._dialog = D()
        await s.begin_stopping()
        after_begin = s._dialog is d and seen == []
        await s.wind_down()
        return after_begin, seen, s._dialog
    assert _run(go()) == (True, [True], None)                       # 닫는 것은 쓰기를 막은 뒤다


def test_응답을_받은_뒤_확인_창이_열린_페이지의_쓰기는_기다리지_않는다(monkeypatch):
    # 창이 열려 있으면 그 페이지의 요청 완료 알림이 창을 닫을 때까지 오지 않는다(실측). 응답은 이미 왔고 창은 마무리에서 닫는다
    monkeypatch.setattr(config, "STOP_QUIET_SEC", 0.1)
    monkeypatch.setattr(config, "STOP_WRITE_WAIT_SEC", 5.0)

    async def go():
        s = _bare_session()
        _capture(s)
        page = object()
        w = Req("http://h:8080/po/poSave.do", "POST", post="a=1")
        w.frame = type("F", (), {"url": "", "page": page})()
        await s.guard.route(Route(), w)
        s.guard.on_response(type("R", (), {"request": w})())

        class D:
            pass
        D.page = page

        async def dismiss():
            pass
        d = D()
        d.dismiss = dismiss
        s._dialog = d
        await s.begin_stopping()
        t0 = time.monotonic()
        pending = await s.wind_down()
        return time.monotonic() - t0, pending, s._dialog
    took, pending, dialog = _run(go())
    assert took < 2 and pending == 0 and dialog is None


# ── 진짜 브라우저 + 로컬 사이트 ───────────────────────────────────────────
PAGE = """<html><head><title>save</title></head><body>
<button id="save" style="position:absolute;left:20px;top:20px;width:200px;height:60px"
  onclick="setTimeout(() => fetch('/save', {method:'POST', body:'a=1'}).catch(() => 0), 800)">저장</button>
<button id="hang" style="position:absolute;left:20px;top:120px;width:200px;height:60px"
  onclick="fetch('/hang', {method:'POST', body:'a=1'}).catch(() => 0)">멈춤</button>
</body></html>"""


class _Site:
    def __init__(self):
        self.hits = []                     # (경로, 받은 시각, 응답한 시각)
        self.release = threading.Event()


def _handler(site):
    class H(http.server.BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def do_GET(self):
            body = PAGE.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            n = int(self.headers.get("Content-Length") or 0)
            self.rfile.read(n)
            got = time.time()
            if self.path.startswith("/hang"):
                site.release.wait(30)       # 응답하지 않는다(시험 끝에 풀어 준다)
            else:
                time.sleep(2.0)
            body = b'{"ok":true}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            self.wfile.flush()
            site.hits.append((self.path, got, time.time()))

        def log_message(self, *a):
            pass
    return H


@pytest.fixture
def site():
    st = _Site()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _handler(st))
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    st.base = f"http://127.0.0.1:{srv.server_address[1]}"
    try:
        yield st
    finally:
        st.release.set()
        srv.shutdown()
        srv.server_close()


def _click(s, sel):
    from app.ieum.recorder import relay

    async def go():
        b = await s.page.locator(sel).bounding_box()
        await s.handle({"t": "click", "x": b["x"] + b["width"] / 2, "y": b["y"] + b["height"] / 2, "w": relay.VIEW_W, "h": relay.VIEW_H})
    call(go())


def _start_on(site):
    from app.ieum.recorder import manager
    return call(manager.MANAGER.start(dict(name="저장 시험", owner="홍길동", base=site.base, start="/", env="op")))["id"]


@_browser_mark
def test_클릭_뒤_늦게_나간_저장이_끝난_뒤에_종료가_끝나고_그_뒤_쓰기는_막힌다(live, site, monkeypatch):
    from app.ieum.recorder import manager, store
    rid = _start_on(site)
    s = manager.MANAGER.get(rid)
    monkeypatch.setattr(manager.MANAGER, "on_stopped", _noop)
    try:
        _click(s, "#save")                                   # 0.8초 뒤 스크립트가 POST, 응답은 2초 뒤
        call(manager.MANAGER.stop(rid), timeout=60)
        stopped = time.time()
        saves = [h for h in site.hits if h[0] == "/save"]
        assert len(saves) == 1 and saves[0][2] <= stopped    # 저장이 서버에 닿고 응답까지 끝난 뒤 종료가 끝났다
        rec = store.get_recording(rid)
        assert any(a["decision"] == "sent" and a["path"] == "/save" for a in rec["approvals"])
        assert not rec.get("pendingWrites")
        assert s.guard.closing

        call(s.page.evaluate("fetch('/save', {method:'POST', body:'b=2'}).catch(() => 0)"))   # 마무리 뒤 페이지가 스스로 보낸 쓰기
        time.sleep(0.5)
        assert len([h for h in site.hits if h[0] == "/save"]) == 1
        assert any(d["decision"] == "deny" and d["label"] == "기록 종료 중" for d in s.guard.decisions)
        assert not s.guard.holding
    finally:
        call(manager.MANAGER.close(rid))


@_browser_mark
def test_응답이_오지_않는_쓰기는_상한_뒤_끊지_않고_남겨_두고_종료한다(live, site, monkeypatch):
    from app.ieum.recorder import manager, store
    monkeypatch.setattr(config, "STOP_WRITE_WAIT_SEC", 3.0)
    rid = _start_on(site)
    s = manager.MANAGER.get(rid)
    monkeypatch.setattr(manager.MANAGER, "on_stopped", _noop)
    ws = WS()
    s.subscribe(ws)
    failed = []
    s.ctx.on("requestfailed", lambda r: failed.append(r.url) if "/hang" in r.url else None)
    try:
        _click(s, "#hang")
        t0 = time.time()
        call(manager.MANAGER.stop(rid), timeout=60)
        assert time.time() - t0 < 15
        rec = store.get_recording(rid)
        assert rec["pendingWrites"] == 1
        notices = [m["msg"] for m in ws.msgs if m.get("t") == "notice"]
        assert "저장 요청 1건이 끝나기를 기다리는 중입니다." in notices and "응답을 받지 못한 쓰기 1건이 있습니다." in notices
        assert failed == []                                 # 끊지 않았다(이미 서버로 갔다)
        site.release.set()
        end = time.time() + 5
        while time.time() < end and not [h for h in site.hits if h[0] == "/hang"]:
            time.sleep(0.05)
        assert [h for h in site.hits if h[0] == "/hang"]   # 서버가 끝까지 받아 응답했다
    finally:
        site.release.set()
        call(manager.MANAGER.close(rid))


# ── 수정 1차 ─────────────────────────────────────────────────────────────
def test_운영_재실행은_조회로_분류된_POST_도_한_번_묻고_거절하면_보내지_않는다():
    # 설계 3판 7절: 운영에서는 GET/HEAD 가 아닌 요청을 보내기 직전에 모두 승인받는다(단계의 write 와 무관)
    from app.ieum.recorder import replay
    from tests.test_ieum_recorder_replay import _bf, _CountTransport
    bf = _bf("http://h")
    bf["steps"] = [dict(bf["steps"][0], method="POST", path="/poSearch.do", write=False, params=[], outputs={})]
    asked = []

    async def deny(st):
        asked.append(st["path"])
        return False

    async def approve(st):
        asked.append(st["path"])
        return "approve"
    t = _CountTransport()
    out = _run(replay.run_once(bf, {}, {}, t, None, deny, 0))
    assert asked == ["/poSearch.do"] and not out["ok"] and out["steps"][0]["reason"] == "write_denied" and t.sent == 0
    asked.clear()
    out = _run(replay.run_once(bf, {}, {}, t, None, approve, 0))
    assert asked == ["/poSearch.do"] and out["ok"] and t.sent == 1


def test_조회로_분류된_POST_의_승인_창은_조회로_보인다고_알린다(monkeypatch):
    from app.ieum.recorder import replay
    from tests.test_ieum_recorder_replay import _bf
    import types
    labels = []

    class G:
        env = "op"

        async def ask(self, method, url, label):
            labels.append(label)
            return False
    bf = _bf("http://h")
    bf["steps"] = [dict(bf["steps"][0], method="POST", path="/poSearch.do", write=False, params=[], outputs={})]

    async def cookies():
        return []
    sess = types.SimpleNamespace(closed=False, guard=G(), page=None, trace=types.SimpleNamespace(raw={}),
                                 ctx=types.SimpleNamespace(cookies=cookies))
    out = _run(replay.verify(bf, {"id": "rec_x", "login": {"mode": "manual"}}, [], sess))
    assert labels and labels[0].startswith("조회로 보이는 POST — ")
    assert out["verification"]["runs"][0]["steps"][0]["reason"] == "write_denied"


def test_종료_뒤_쓰기가_셋을_넘거나_같은_쓰기가_반복되면_바로_닫는다():
    async def go():
        s = _bare_session()
        _capture(s)
        await s.begin_stopping()
        out = []
        for path in ("/a.do", "/b.do", "/a.do", "/c.do"):
            r = Route()
            await s.guard.route(r, Req("http://h:8080/po" + path, "POST", post="x=1"))
            out.append(r.done)
        s2 = _bare_session()
        _capture(s2)
        await s2.begin_stopping()
        out2 = []
        for path in ("/a.do", "/b.do", "/c.do", "/d.do"):
            r = Route()
            await s2.guard.route(r, Req("http://h:8080/po" + path, "POST", post="x=1"))
            out2.append(r.done)
        return out, s.guard.closing, out2, s2.guard.closing, [d["label"] for d in s2.guard.decisions if d["decision"] == "deny"]
    out, closing, out2, closing2, labels = _run(go())
    assert out == ["continue", "continue", "abort", "abort"] and closing
    assert out2 == ["continue", "continue", "continue", "abort"] and closing2 and labels == ["기록 종료 중"]


def test_마무리는_묶음_닫기가_실패해도_쓰기를_막는다(monkeypatch):
    monkeypatch.setattr(config, "STOP_QUIET_SEC", 0.05)

    async def go():
        s = _bare_session()
        _capture(s)

        async def boom(page):
            raise RuntimeError("묶음 닫기 실패")
        s.trace.finish = boom
        await s.begin_stopping()
        try:
            await s.wind_down()
        except RuntimeError:
            pass
        return s.guard.closing
    assert _run(go())


def test_로그인_이력도_상한에_센다(monkeypatch):
    from app.ieum.recorder import guard as guard_mod
    monkeypatch.setattr(guard_mod, "SENT_LOG_MAX", 2)

    async def go():
        s = _bare_session()
        for _ in range(3):
            await s.guard.route(Route(), Req("http://h:8080/po/loginProc.do", "POST", post="userId=a&userPw=b"))
        return [d["decision"] for d in s.guard.decisions], s.guard.sent_dropped, s.guard.login_req is not None
    assert _run(go()) == (["login", "login"], 1, True)


def test_닫힌_페이지의_쓰기는_기다리지_않는다(monkeypatch):
    monkeypatch.setattr(config, "STOP_QUIET_SEC", 0.05)
    monkeypatch.setattr(config, "STOP_WRITE_WAIT_SEC", 3.0)

    async def go():
        s = _bare_session()
        _capture(s)
        page = type("P", (), {"is_closed": lambda self: True})()
        w = Req("http://h:8080/po/poSave.do", "POST", post="a=1")
        w.frame = type("F", (), {"url": "", "page": page})()
        await s.guard.route(Route(), w)
        await s.begin_stopping()
        t0 = time.monotonic()
        pending = await s.wind_down()
        return time.monotonic() - t0, pending
    took, pending = _run(go())
    assert took < 1.5 and pending == 0


def test_응답을_못_받은_쓰기의_페이지에_확인_창이_열려_있으면_대기_시작에_닫고_기다린다(monkeypatch):
    monkeypatch.setattr(config, "STOP_QUIET_SEC", 0.05)
    monkeypatch.setattr(config, "STOP_WRITE_WAIT_SEC", 1.0)

    async def go():
        s = _bare_session()
        _capture(s)
        page = type("P", (), {"is_closed": lambda self: False})()
        w = Req("http://h:8080/po/poSave.do", "POST", post="a=1")
        w.frame = type("F", (), {"url": "", "page": page})()
        await s.guard.route(Route(), w)
        dismissed = []

        class D:
            pass
        d = D()
        d.page = page

        async def dismiss():
            dismissed.append(time.monotonic())
            asyncio.get_running_loop().call_later(0.2, s.guard.on_request_done, w)    # 창을 닫으면 완료 알림이 온다
        d.dismiss = dismiss
        s._dialog = d
        at_finish = []

        async def finish(pg):
            at_finish.append(s.guard.writes_in_flight)
        s.trace.finish = finish
        await s.begin_stopping()
        pending = await s.wind_down()
        return dismissed, pending, s._dialog, at_finish
    dismissed, pending, dialog, at_finish = _run(go())
    assert len(dismissed) == 1 and pending == 0 and dialog is None
    assert at_finish == [0]                                 # 응답 전 쓰기는 빼지 않고 끝날 때까지 기다린 뒤 묶음을 닫았다


LOOP_PAGE = """<html><head><title>loop</title></head><body>
<button id="go" style="position:absolute;left:20px;top:20px;width:200px;height:60px" onclick="tryWrite()">저장</button>
<script>
function tryWrite(){ fetch('/fail', {method:'POST', body:'a=1'}).then(r => { if(!r.ok) throw 0; })
  .catch(() => { alert('에러가 발생했습니다.'); setTimeout(tryWrite, 50); }); }
</script>
<button id="ok" style="position:absolute;left:20px;top:120px;width:200px;height:60px"
  onclick="fetch('/save', {method:'POST', body:'a=1'}).then(() => alert('저장되었습니다'))">확인</button>
<button id="busy" style="position:absolute;left:20px;top:220px;width:200px;height:60px"
  onclick="fetch('/slow', {method:'POST', body:'a=1'}).catch(() => 0); alert('처리 중')">처리</button>
</body></html>"""


def _loop_handler(site):
    class H(http.server.BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def do_GET(self):
            body = LOOP_PAGE.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            n = int(self.headers.get("Content-Length") or 0)
            self.rfile.read(n)
            got = time.time()
            time.sleep(0.5 if self.path.startswith("/fail") else 6.0 if self.path.startswith("/slow") else 1.0)
            code = 500 if self.path.startswith("/fail") else 200
            body = b'{"ok":false}' if code == 500 else b'{"ok":true}'
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            self.wfile.flush()
            site.hits.append((self.path, got, time.time()))

        def log_message(self, *a):
            pass
    return H


@pytest.fixture
def loop_site():
    st = _Site()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _loop_handler(st))
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    st.base = f"http://127.0.0.1:{srv.server_address[1]}"
    try:
        yield st
    finally:
        srv.shutdown()
        srv.server_close()


@_browser_mark
def test_실패하면_알리고_다시_보내는_사이트도_종료가_상한보다_훨씬_빨리_끝나고_종료_뒤_쓰기는_셋_이하(live, loop_site, monkeypatch):
    from app.ieum.recorder import manager
    rid = _start_on(loop_site)
    s = manager.MANAGER.get(rid)
    monkeypatch.setattr(manager.MANAGER, "on_stopped", _noop)
    try:
        _click(s, "#go")                                     # POST(0.5초 뒤 500) → alert → 재시도 루프
        t0 = time.time()
        call(manager.MANAGER.stop(rid), timeout=90)
        took = time.time() - t0
        time.sleep(1.0)
        after = [h for h in loop_site.hits if h[1] >= t0]
        assert took < 20, took
        assert len(after) <= 3, after
        assert s.guard.closing and any(d["decision"] == "deny" and d["label"] == "기록 종료 중" for d in s.guard.decisions)
    finally:
        call(manager.MANAGER.close(rid))


@_browser_mark
def test_저장_뒤_완료_알림을_띄우는_사이트에서_곧바로_멈춰도_저장을_기다리고_남긴다(live, loop_site, monkeypatch):
    from app.ieum.recorder import manager, store
    rid = _start_on(loop_site)
    s = manager.MANAGER.get(rid)
    monkeypatch.setattr(manager.MANAGER, "on_stopped", _noop)
    try:
        _click(s, "#ok")                                     # POST(1초) → 응답 → "저장되었습니다" alert
        call(manager.MANAGER.stop(rid), timeout=60)
        stopped = time.time()
        saves = [h for h in loop_site.hits if h[0] == "/save"]
        assert len(saves) == 1 and saves[0][2] <= stopped
        rec = store.get_recording(rid)
        assert any(a["decision"] == "sent" and a["path"] == "/save" for a in rec["approvals"]) and not rec.get("pendingWrites")
    finally:
        call(manager.MANAGER.close(rid))


@_browser_mark
def test_보내자마자_처리_중_알림이_열린_채_멈춰도_그_쓰기를_기다린다(live, loop_site, monkeypatch):
    from app.ieum.recorder import manager, store
    rid = _start_on(loop_site)
    s = manager.MANAGER.get(rid)
    monkeypatch.setattr(manager.MANAGER, "on_stopped", _noop)
    try:
        # POST(6초) 를 보내고 곧바로 "처리 중" alert. 마우스 입력은 창이 닫힐 때까지 돌아오지 않으므로 페이지 안에서 누른다
        call(s.page.evaluate("setTimeout(() => document.getElementById('busy').click(), 0)"))
        end = time.time() + 10
        while time.time() < end and s._dialog is None:
            time.sleep(0.05)
        assert s._dialog is not None
        call(manager.MANAGER.stop(rid), timeout=60)
        stopped = time.time()
        saves = [h for h in loop_site.hits if h[0] == "/slow"]
        assert len(saves) == 1 and saves[0][2] <= stopped    # 창을 닫고 응답(6초)까지 기다렸다
        rec = store.get_recording(rid)
        assert not rec.get("pendingWrites") and any(a["decision"] == "sent" for a in rec["approvals"])
    finally:
        call(manager.MANAGER.close(rid))


# ── 수정 2차 ─────────────────────────────────────────────────────────────
class _ExpiredHttp:
    """HTTP 전송 흉내: 처음은 로그인 화면으로 보낸다(세션 만료), 다시 로그인한 뒤에는 성공한다."""
    mode = "session"

    def __init__(self):
        self.sent, self.cookies = 0, {}

    async def send(self, step, url, headers, params, form, json_body):
        import json
        self.sent += 1
        if self.sent == 1:
            return 302, "/po/login.do", "", ""
        return 200, None, "application/json", json.dumps({"RSLT": "0000", "totalCnt": 1, "resultList": [{"PO_NO": "x"}]})


def test_재로그인_뒤_조회로_분류된_POST_는_다시_보내지_않는다():
    from app.ieum.recorder import replay
    from tests.test_ieum_recorder_replay import _bf
    bf = _bf("http://h")
    bf["steps"] = [dict(bf["steps"][0], method="POST", path="/poSearch.do", write=False, params=[], outputs={})]
    asks, relogins = [], []

    async def ask(st):
        asks.append(st["path"])
        return "approve"

    async def relogin():
        relogins.append(1)
        return {"JSESSIONID": "new"}
    t = _ExpiredHttp()
    out = _run(replay.run_once(bf, {}, {}, t, None, ask, 0, relogin=relogin))
    assert t.sent == 1 and asks == ["/poSearch.do"] and relogins == []      # 승인 한 번에 전송 한 번
    assert not out["ok"] and out["steps"][0]["reason"] == "auth_expired"
    assert out["steps"][0]["note"] == "GET 이 아닌 단계라 다시 로그인해 재전송하지 않음"
    assert out["wrote"] is True                                            # 나간 비GET 은 브라우저로 다시 보내지 않는다


def test_승인받아_나간_조회_POST_가_실패하면_브라우저로_다시_보내지_않는다(monkeypatch):
    from app.ieum.recorder import replay
    from tests.test_ieum_recorder_replay import _bf
    import types
    bf = _bf("http://h")
    bf["steps"] = [dict(bf["steps"][0], method="POST", path="/poSearch.do", write=False, params=[], outputs={})]
    calls = []

    async def fake(bf2, inputs, raw, http, browser, ask, gap, kind="same-values", **kw):
        calls.append([s.get("exec") for s in bf2["steps"]])
        st = bf2["steps"][0]
        said = await ask(st)
        return {"kind": kind, "ok": False, "steps": [{"id": st["id"], "ok": False, "reason": "http_error"}],
                "reason": "http_error", "wrote": bool(said)}
    monkeypatch.setattr(replay, "run_once", fake)

    class G:
        env = "op"

        async def ask(self, method, url, label):
            return True

    async def cookies():
        return []
    sess = types.SimpleNamespace(closed=False, guard=G(), page=None, trace=types.SimpleNamespace(raw={}),
                                 ctx=types.SimpleNamespace(cookies=cookies))
    out = _run(replay.verify(bf, {"id": "rec_x", "login": {"mode": "manual"}}, [], sess))
    assert len(calls) == 1 and out["verification"]["runs"][0].get("note") == "쓰기가 이미 나가 다시 실행하지 않음"


def test_재지정된_쓰기도_응답을_받은_것으로_본다():
    async def go():
        s = _bare_session()
        w = Req("http://h:8080/po/poSave.do", "POST", post="a=1")
        await s.guard.route(Route(), w)
        nxt = Req("http://h:8080/po/poList.do")
        nxt.redirected_from = w
        s.guard.on_response(type("R", (), {"request": nxt})())
        return s.guard.has_response(w)
    assert _run(go())
