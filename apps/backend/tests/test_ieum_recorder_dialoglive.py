# apps/backend/tests/test_ieum_recorder_dialoglive.py
"""대상 페이지의 확인 창이 열려 있어도 스냅샷·탭 목록·종료가 멈추지 않는다. 연결 실패는 알린다.
대상 사이트는 시험 안의 작은 로컬 HTTP 서버다(외부 접속 없음)."""
import http.server
import threading
import time

import pytest

from tests.test_ieum_recorder_session import WS, _noop, call, live, pytestmark, start  # noqa: F401

DETAIL = b"""<html><head><title>detail</title></head><body><h1>detail</h1>
<script>
function tryWrite(){ fetch('/write', {method:'POST', body:'a=1'}).then(r => { if(!r.ok) throw 0; }).catch(() => { alert('error'); setTimeout(tryWrite, 50); }); }
setTimeout(tryWrite, 300);
</script></body></html>"""


class _H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(DETAIL)

    def do_POST(self):
        self.send_response(500)
        self.end_headers()

    def log_message(self, *a):
        pass


@pytest.fixture
def site():
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        yield f"http://127.0.0.1:{srv.server_address[1]}"
    finally:
        srv.shutdown()
        srv.server_close()


def _wait(cond, sec=15):
    end = time.time() + sec
    while time.time() < end:
        if cond():
            return True
        time.sleep(0.05)
    return False


def _open_alert(s):
    call(s.page.evaluate("setTimeout(() => alert('열림'), 0)"))
    assert _wait(lambda: s._dialog is not None)


def test_확인_창이_열린_채로도_begin_finish_탭목록이_상한_안에_끝난다(live):
    from app.ieum.recorder import manager
    rid = start(live)["id"]
    s = manager.MANAGER.get(rid)
    try:
        _open_alert(s)
        t0 = time.time()
        assert call(s.trace.begin(s.page, "click"), timeout=20)
        assert s.trace.current["pre"].get("dialogOpen") is True
        call(s.send_tabs(), timeout=20)
        call(s.trace.finish(s.page), timeout=20)
        assert time.time() - t0 < 10
    finally:
        call(manager.MANAGER.close(rid))


def test_알림이_반복되는_사이트에서_확인_창이_열린_채_멈춰도_끝난다(live, site, monkeypatch):
    from app.ieum.recorder import manager, store
    rid = call(manager.MANAGER.start(dict(name="알림 반복", owner="홍길동", base=site, start="/detail", env="op")))["id"]   # 기록 대상이 로컬 사이트다
    s = manager.MANAGER.get(rid)
    monkeypatch.setattr(manager.MANAGER, "on_stopped", _noop)
    ws = WS()
    s.subscribe(ws)
    try:
        # 설계 3판: 쓰기는 붙잡지 않고 보낸다 -> 서버가 500 -> 페이지가 alert(열린 채 둔다)
        assert _wait(lambda: s._dialog is not None)
        assert not [m for m in ws.msgs if m.get("t") == "hold"]
        assert any(d["decision"] == "sent" for d in s.guard.decisions)
        t0 = time.time()
        call(manager.MANAGER.stop(rid), timeout=30)
        assert time.time() - t0 < 20
        assert store.get_recording(rid)["status"] == "analyzing"
        assert [m for m in ws.msgs if m.get("t") == "notice" and "확인 창을 닫았" in m.get("msg", "")]
    finally:
        pass
        call(manager.MANAGER.close(rid))


def test_문서_요청_연결_실패는_알리고_같은_오류는_한_번만(live):
    from app.ieum.recorder import manager
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    rid = call(manager.MANAGER.start(dict(name="연결 실패", owner="홍길동", base=base, start="/ok", env="op")))["id"]
    s = manager.MANAGER.get(rid)
    ws = WS()
    s.subscribe(ws)
    srv.shutdown()
    srv.server_close()                                 # 같은 출처의 서버가 사라진다 -> 연결 거부
    try:
        for _ in range(2):
            try:
                call(s.page.goto(base + "/x?secret=1"))
            except Exception:
                pass
        time.sleep(0.3)
        notices = [m for m in ws.msgs if m.get("t") == "notice" and "대상 사이트 연결 실패" in m.get("msg", "")]
        assert len(notices) == 1 and "ERR_CONNECTION" in notices[0]["msg"] and "secret" not in notices[0]["msg"]
    finally:
        call(manager.MANAGER.close(rid))


def test_확인_창이_열린_채_묶음을_닫아도_로그인_확인에서_멈추지_않는다(live):
    from app.ieum.recorder import manager
    rid = start(live)["id"]
    s = manager.MANAGER.get(rid)
    try:
        call(s.trace.begin(s.page, "click"))
        call(s.trace.begin(s.page, "click"))                    # 묶음 1 이 닫히고 seq 2 가 열린다
        call(s.trace.set_paused(False, s.page))
        _open_alert(s)
        t0 = time.time()
        call(s.trace.begin(s.page, "click"), timeout=20)        # 묶음 2 가 on_closed(_after_span) 까지 거쳐 닫힌다
        assert time.time() - t0 < 10
        assert s.trace.seq == 3
    finally:
        call(manager.MANAGER.close(rid))


def test_유휴_멈춤도_확인_창을_닫고_가드를_닫는다(live, monkeypatch):
    from app.ieum.recorder import manager, store
    rid = start(live)["id"]
    s = manager.MANAGER.get(rid)
    ws = WS()
    s.subscribe(ws)
    _open_alert(s)
    monkeypatch.setenv("IEUM_RECORDER_IDLE_SEC", "0")
    t0 = time.time()
    call(manager.MANAGER._reap_once(), timeout=40)
    assert time.time() - t0 < 20
    assert s.guard.closing and s._dialog is None
    assert store.get_recording(rid)["status"] == "interrupted"
    assert [m for m in ws.msgs if m.get("t") == "notice" and "확인 창을 닫았" in m.get("msg", "")]


def test_막히거나_취소된_문서_요청은_연결_실패로_알리지_않는다(live, site):
    from app.ieum.recorder import manager
    rid = start(live)["id"]
    s = manager.MANAGER.get(rid)
    ws = WS()
    s.subscribe(ws)
    try:
        try:
            call(s.page.goto(site + "/detail"))               # 다른 출처 이동은 가드가 막는다(ERR_BLOCKED_BY_CLIENT)
        except Exception:
            pass
        time.sleep(0.5)
        assert not [m for m in ws.msgs if m.get("t") == "notice" and "연결 실패" in m.get("msg", "")]
    finally:
        call(manager.MANAGER.close(rid))
