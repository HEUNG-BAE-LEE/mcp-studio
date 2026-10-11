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


def test_확인_창이_열린_페이지의_쓰기는_기다리지_않는다(monkeypatch):
    # 창이 열려 있으면 그 페이지의 요청 완료 알림이 창을 닫을 때까지 오지 않는다(실측). 창은 마무리에서 닫는다
    monkeypatch.setattr(config, "STOP_QUIET_SEC", 0.1)
    monkeypatch.setattr(config, "STOP_WRITE_WAIT_SEC", 5.0)

    async def go():
        s = _bare_session()
        _capture(s)
        page = object()
        w = Req("http://h:8080/po/poSave.do", "POST", post="a=1")
        w.frame = type("F", (), {"url": "", "page": page})()
        await s.guard.route(Route(), w)

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
