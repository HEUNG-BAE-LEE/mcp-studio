# apps/backend/tests/test_ieum_recorder_wslane.py
"""WebSocket 제어·입력 분리와 종료 요청 취소 보호.

제어 메시지(승인·확인 창·일시 정지·탭)는 입력 처리가 막혀 있어도 바로 처리되고, 입력(클릭·휠·글자·키)은 세션마다
한 줄로 도착 순서대로 처리된다. 멈춤 요청이 취소돼도 세션은 끝까지 멈추고, 오래 멈추는 중인 세션은 리퍼가 회수한다."""
import asyncio
import json
import os
import time

import pytest
from websockets.sync.client import connect

from app.ieum.discovery.browser import capabilities
from tests.test_ieum_recorder_session import call, live, start  # noqa: F401

needs_browser = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"],
                                   reason="브라우저가 없다")


def _wait(cond, sec=15):
    end = time.time() + sec
    while time.time() < end:
        if cond():
            return True
        time.sleep(0.05)
    return False


def _ws_url(base, out):
    return base.replace("http", "ws") + "/api/ieum/recorder/ws/" + out["id"] + "?token=" + out["token"]


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _bare_session():
    from app.ieum.recorder.session import RecorderSession
    rec = {"id": "rec_0000abcd", "sourceBase": "http://h:8080/po", "env": "op", "owner": "홍길동"}
    return RecorderSession(rec, None)


# ── 브라우저 없는 단위 시험 ───────────────────────────────────────────────
def test_입력_줄이_넘치면_오래된_휠부터_버리고_다른_입력은_남긴다():
    from app.ieum.recorder import session as session_mod

    async def go():
        s = _bare_session()
        gate = asyncio.Event()
        done = []

        async def blocked(msg):
            await gate.wait()
            done.append(msg)
        s._handle_input = blocked
        s._enqueue_input({"t": "click", "n": 0})              # 소비 작업이 이걸 잡고 막힌다
        await asyncio.sleep(0.05)
        for i in range(session_mod.INPUT_MAX + 20):
            s._enqueue_input({"t": "wheel", "n": i})
        s._enqueue_input({"t": "text", "data": "a"})
        s._enqueue_input({"t": "key", "key": "Enter"})
        assert len(s._inputs) <= session_mod.INPUT_MAX
        kinds = [m["t"] for m in s._inputs]
        assert kinds[-2:] == ["text", "key"]
        wheels = [m["n"] for m in s._inputs if m["t"] == "wheel"]
        assert wheels == sorted(wheels) and wheels[-1] == session_mod.INPUT_MAX + 19    # 버린 것은 오래된 휠이다
        gate.set()
        for _ in range(100):
            if not s._inputs:
                break
            await asyncio.sleep(0.01)
        await s.close()
        return done, s._input_task
    done, task = _run(go())
    assert [m["t"] for m in done][0] == "click" and [m["t"] for m in done][-2:] == ["text", "key"]
    assert task is None or task.done()


def test_입력_처리_예외는_로그만_남기고_소비_작업은_계속_돈다():
    async def go():
        s = _bare_session()
        done = []

        async def flaky(msg):
            if msg["n"] == 1:
                raise RuntimeError("처리 실패")
            done.append(msg["n"])
        s._handle_input = flaky
        for n in range(3):
            s._enqueue_input({"t": "click", "n": n})
        for _ in range(100):
            if len(done) == 2:
                break
            await asyncio.sleep(0.01)
        task = s._input_task
        alive = not task.done()
        await s.close()
        return done, alive, task.done()
    done, alive, finished = _run(go())
    assert done == [0, 2] and alive and finished


def test_종료_시작에서_닫는_사이_새로_뜬_확인_창은_지우지_않는다():
    async def go():
        s = _bare_session()
        newer = object()

        class D:
            async def dismiss(self):
                s._dialog = newer                          # 닫는 사이 새 확인 창이 떴다
        s._dialog = D()
        await s.begin_stopping()
        return s._dialog is newer
    assert _run(go())


def test_비휠_입력을_버리면_한_번만_알린다():
    from app.ieum.recorder import session as session_mod

    async def go():
        s = _bare_session()
        sent = []

        async def bc(msg):
            sent.append(msg)
        s.broadcast = bc
        gate = asyncio.Event()

        async def blocked(msg):
            await gate.wait()
        s._handle_input = blocked
        s._enqueue_input({"t": "click"})
        await asyncio.sleep(0.05)
        for _ in range(session_mod.INPUT_MAX + 5):
            s._enqueue_input({"t": "key", "key": "Tab"})
        await asyncio.sleep(0.05)
        await s.close()
        return [m for m in sent if m.get("t") == "notice"]
    notices = _run(go())
    assert len(notices) == 1 and "입력이 밀려" in notices[0]["msg"]


def test_닫기를_시작하면_입력을_더_받지_않고_소비_작업이_남지_않는다():
    async def go():
        s = _bare_session()
        s._stop_inputs()
        await s.dispatch({"t": "click", "x": 1, "y": 1, "w": 1, "h": 1})
        await s.dispatch({"t": "pause", "on": True})
        return s._input_task, len(s._inputs)
    assert _run(go()) == (None, 0)


def test_확인_창_응답이_실패하면_확인_창을_되돌린다(monkeypatch):
    from app.ieum.recorder import session as session_mod
    monkeypatch.setattr(session_mod, "DIALOG_REPLY_SEC", 0.05)

    async def go():
        s = _bare_session()

        class D:
            async def accept(self, text=""):
                await asyncio.sleep(1)
        d = D()
        s._dialog = d
        await s.handle({"t": "dialog", "ok": True})
        return s._dialog is d
    assert _run(go())


# ── 진짜 브라우저 ─────────────────────────────────────────────────────────
@needs_browser
def test_입력_처리가_막혀도_같은_연결의_확인_창_응답은_바로_처리된다(live, monkeypatch):
    from app.ieum.recorder import manager, relay
    out = start(live)
    s = manager.MANAGER.get(out["id"])
    entered = []

    async def slow_begin(page, kind):
        entered.append(kind)
        await asyncio.sleep(20)                           # 확인 창이 열린 페이지에 스냅샷이 막힌 상황을 흉내 낸다
    monkeypatch.setattr(s.trace, "begin", slow_begin)
    call(s.page.evaluate("setTimeout(() => alert('열림'), 0)"))
    assert _wait(lambda: s._dialog is not None)
    try:
        with connect(_ws_url(live, out), max_size=None) as ws:
            ws.send(json.dumps({"t": "click", "x": 10, "y": 10, "w": relay.VIEW_W, "h": relay.VIEW_H}))
            assert _wait(lambda: entered == ["click"], 5)
            ws.send(json.dumps({"t": "dialog", "ok": True}))
            assert _wait(lambda: s._dialog is None, 3)       # 클릭 처리가 막혀 있어도 확인 창 응답은 바로 처리된다
    finally:
        call(manager.MANAGER.close(out["id"]))


@needs_browser
def test_클릭_글자_키는_도착_순서대로_처리된다(live, monkeypatch):
    from app.ieum.recorder import manager, relay
    out = start(live)
    s = manager.MANAGER.get(out["id"])
    seen = []

    async def begin(page, kind):
        await asyncio.sleep(0.05)
        seen.append(("begin", kind))

    async def click(cdp, x, y):
        seen.append(("click",))

    async def wheel(cdp, x, y, dy):
        seen.append(("wheel",))

    async def text(cdp, data):
        await asyncio.sleep(0.02)
        seen.append(("text", data))

    async def key(cdp, k):
        seen.append(("key", k))
    monkeypatch.setattr(s.trace, "begin", begin)
    monkeypatch.setattr(relay, "click", click)
    monkeypatch.setattr(relay, "wheel", wheel)
    monkeypatch.setattr(relay, "insert_text", text)
    monkeypatch.setattr(relay, "key", key)
    pt = {"x": 10, "y": 10, "w": relay.VIEW_W, "h": relay.VIEW_H}
    msgs = [dict(t="click", **pt), {"t": "text", "data": "가"}, {"t": "key", "key": "Tab"}, {"t": "text", "data": "나"},
            dict(t="wheel", dy=100, **pt), dict(t="click", **pt), {"t": "key", "key": "Enter"}]
    expected = [("begin", "click"), ("click",), ("text", "가"), ("key", "Tab"), ("text", "나"), ("wheel",),
                ("begin", "click"), ("click",), ("begin", "key"), ("key", "Enter")]
    try:
        with connect(_ws_url(live, out), max_size=None) as ws:
            for m in msgs:
                ws.send(json.dumps(m))
            assert _wait(lambda: len(seen) >= len(expected), 10)
        assert seen == expected
    finally:
        call(manager.MANAGER.close(out["id"]))


@needs_browser
def test_세션을_닫으면_입력_소비_작업이_남지_않는다(live):
    from app.ieum.recorder import manager, relay
    out = start(live)
    s = manager.MANAGER.get(out["id"])
    with connect(_ws_url(live, out), max_size=None) as ws:
        ws.send(json.dumps({"t": "wheel", "x": 10, "y": 10, "w": relay.VIEW_W, "h": relay.VIEW_H, "dy": 50}))
        assert _wait(lambda: s._input_task is not None, 5)
    call(manager.MANAGER.close(out["id"]))

    async def left():
        await asyncio.sleep(0.1)
        return [t for t in asyncio.all_tasks() if "_consume_inputs" in repr(t.get_coro())]
    assert call(left()) == []
    assert s._input_task is None or s._input_task.done()


@needs_browser
def test_멈춤_요청이_취소돼도_세션은_끝까지_멈추고_다시_시작할_수_있다(live, monkeypatch):
    from app.ieum.recorder import login, manager, store
    seen = []

    async def done(rid, s):
        seen.append(rid)
        await manager.MANAGER.close(rid)
    monkeypatch.setattr(manager.MANAGER, "on_stopped", done)
    orig = login.recipe_for

    async def slow(*a, **k):
        await asyncio.sleep(1.0)
        return await orig(*a, **k)
    monkeypatch.setattr(login, "recipe_for", slow)
    rid = start(live)["id"]

    async def run():
        t = asyncio.ensure_future(manager.MANAGER.stop(rid))
        await asyncio.sleep(0.3)
        t.cancel()
        try:
            await t
        except asyncio.CancelledError:
            pass
    call(run())
    assert _wait(lambda: seen == [rid], 20)
    time.sleep(0.5)
    assert seen == [rid]                                  # on_stopped 는 한 번만
    assert store.get_recording(rid)["status"] == "analyzing"
    assert rid not in manager.MANAGER.sessions
    assert start(live)["id"]                              # 사람당 1개 상한에 갇히지 않는다


@needs_browser
def test_오래_멈추는_중인_세션은_리퍼가_실패로_회수한다(live, monkeypatch):
    from app.ieum.recorder import login, manager, store
    seen = []

    async def done(rid, s):
        seen.append(rid)
    monkeypatch.setattr(manager.MANAGER, "on_stopped", done)
    monkeypatch.setattr(manager, "_STOP_STUCK_SEC", 0.5)
    monkeypatch.setattr(manager.MANAGER, "_swept_at", time.time())
    orig = login.recipe_for

    async def hang(*a, **k):
        await asyncio.sleep(60)
    monkeypatch.setattr(login, "recipe_for", hang)
    rid = start(live)["id"]

    async def run():
        t = asyncio.ensure_future(manager.MANAGER.stop(rid))
        await asyncio.sleep(1.5)
        await manager.MANAGER._reap_once()
        try:
            await asyncio.wait_for(t, 10)
        except manager.RecorderError as exc:
            return exc.code
        return None
    assert call(run()) == 500
    rec = store.get_recording(rid)
    assert rec["status"] == "failed" and "오래" in rec["error"]
    assert rid not in manager.MANAGER.sessions and seen == []
    monkeypatch.setattr(login, "recipe_for", orig)
    assert start(live)["id"]


@needs_browser
def test_탭_전환_뒤의_클릭은_새_탭으로_간다(live, monkeypatch):
    from app.ieum.recorder import manager, relay
    out = start(live)
    s = manager.MANAGER.get(out["id"])
    first = s.page
    call(s.ctx.new_page())
    assert _wait(lambda: len(s.pages) == 2 and s.page is not first)
    clicked = []
    orig_stop = relay.stop_screencast

    async def slow_stop(cdp):
        await asyncio.sleep(0.5)                          # 탭 전환이 오래 걸리는 상황
        await orig_stop(cdp)

    async def begin(page, kind):
        clicked.append(("begin", page))

    async def click(cdp, x, y):
        clicked.append(("click", cdp))
    monkeypatch.setattr(relay, "stop_screencast", slow_stop)
    monkeypatch.setattr(s.trace, "begin", begin)
    monkeypatch.setattr(relay, "click", click)
    try:
        with connect(_ws_url(live, out), max_size=None) as ws:
            ws.send(json.dumps({"t": "tab", "index": 0}))
            ws.send(json.dumps({"t": "click", "x": 10, "y": 10, "w": relay.VIEW_W, "h": relay.VIEW_H}))
            assert _wait(lambda: len(clicked) == 2, 10)
        assert s.page is first
        assert clicked == [("begin", first), ("click", s.cdp)]
    finally:
        call(manager.MANAGER.close(out["id"]))


@needs_browser
def test_일시정지_해제_뒤의_클릭은_기록된다(live, monkeypatch):
    from app.ieum.recorder import manager, relay
    out = start(live)
    s = manager.MANAGER.get(out["id"])
    call(s.handle({"t": "pause", "on": True}))
    orig_pause, orig_begin = s.trace.set_paused, s.trace.begin
    got = []

    async def slow_pause(on, page):
        await asyncio.sleep(0.5)
        await orig_pause(on, page)

    async def begin(page, kind):
        got.append(await orig_begin(page, kind))
    monkeypatch.setattr(s.trace, "set_paused", slow_pause)
    monkeypatch.setattr(s.trace, "begin", begin)
    try:
        with connect(_ws_url(live, out), max_size=None) as ws:
            ws.send(json.dumps({"t": "pause", "on": False}))
            ws.send(json.dumps({"t": "click", "x": 10, "y": 10, "w": relay.VIEW_W, "h": relay.VIEW_H}))
            assert _wait(lambda: len(got) == 1, 15)
        assert got[0] is not None                         # 일시정지 중으로 보고 버리지 않았다
    finally:
        call(manager.MANAGER.close(out["id"]))


@needs_browser
def test_일시정지보다_먼저_온_클릭은_기록된다(live, monkeypatch):
    from app.ieum.recorder import manager, relay
    out = start(live)
    s = manager.MANAGER.get(out["id"])
    orig_begin = s.trace.begin
    got = []

    async def begin(page, kind):
        got.append(await orig_begin(page, kind))
    monkeypatch.setattr(s.trace, "begin", begin)
    try:
        with connect(_ws_url(live, out), max_size=None) as ws:
            ws.send(json.dumps({"t": "click", "x": 10, "y": 10, "w": relay.VIEW_W, "h": relay.VIEW_H}))
            ws.send(json.dumps({"t": "pause", "on": True}))
            assert _wait(lambda: len(got) == 1 and s.trace.paused, 15)
        assert got[0] is not None                         # 일시정지 전에 누른 클릭은 일시정지로 버려지지 않는다
    finally:
        call(manager.MANAGER.close(out["id"]))


@needs_browser
def test_탭_전환보다_먼저_온_클릭은_이전_탭으로_가고_뒤의_클릭은_새_탭으로_간다(live, monkeypatch):
    from app.ieum.recorder import manager, relay
    out = start(live)
    s = manager.MANAGER.get(out["id"])
    first = s.page
    call(s.ctx.new_page())
    assert _wait(lambda: len(s.pages) == 2 and s.page is not first)
    old_cdp = s.cdp
    clicked = []

    async def begin(page, kind):
        await asyncio.sleep(0.3)                          # 첫 클릭 처리가 걸리는 사이 탭 전환이 도착한다

    async def click(cdp, x, y):
        clicked.append(cdp)
    monkeypatch.setattr(s.trace, "begin", begin)
    monkeypatch.setattr(relay, "click", click)
    pt = {"x": 10, "y": 10, "w": relay.VIEW_W, "h": relay.VIEW_H}
    try:
        with connect(_ws_url(live, out), max_size=None) as ws:
            ws.send(json.dumps(dict(t="click", **pt)))
            ws.send(json.dumps({"t": "tab", "index": 0}))
            ws.send(json.dumps(dict(t="click", **pt)))
            assert _wait(lambda: len(clicked) == 2, 10)
        assert s.page is first
        assert clicked[0] is old_cdp and clicked[1] is s.cdp and s.cdp is not old_cdp
    finally:
        call(manager.MANAGER.close(out["id"]))


@needs_browser
def test_입력_중_사이트가_새_탭을_열면_입력이_끝난_뒤에_전환한다(live, monkeypatch):
    from app.ieum.recorder import manager, relay
    out = start(live)
    s = manager.MANAGER.get(out["id"])
    first = s.page
    events = []
    active = {"n": 0, "max": 0}
    orig_start, orig_stop = relay.start_screencast, relay.stop_screencast

    async def begin(page, kind):
        events.append("begin")
        await asyncio.sleep(1.0)
        events.append("begin-end")

    async def click(cdp, x, y):
        events.append("click")

    async def start_sc(cdp, cb):
        active["n"] += 1
        active["max"] = max(active["max"], active["n"])
        events.append("start")
        await orig_start(cdp, cb)

    async def stop_sc(cdp):
        active["n"] -= 1
        events.append("stop")
        await orig_stop(cdp)
    monkeypatch.setattr(s.trace, "begin", begin)
    monkeypatch.setattr(relay, "click", click)
    monkeypatch.setattr(relay, "start_screencast", start_sc)
    monkeypatch.setattr(relay, "stop_screencast", stop_sc)
    try:
        with connect(_ws_url(live, out), max_size=None) as ws:
            ws.send(json.dumps({"t": "click", "x": 10, "y": 10, "w": relay.VIEW_W, "h": relay.VIEW_H}))
            assert _wait(lambda: "begin" in events, 5)
            call(first.evaluate("window.open(location.href)"))       # 클릭 처리 도중 사이트가 새 탭을 연다
            assert _wait(lambda: len(s.pages) == 2 and s.page is not first and "start" in events, 15)
        assert events.index("stop") > events.index("click")          # 새 탭 전환은 진행 중인 입력이 끝난 뒤
        assert events.count("start") == 1 and events.count("stop") == 1
        assert active["n"] == 0 and active["max"] <= 0                # 중계가 겹친 적이 없다(멈춘 뒤 시작)
    finally:
        call(manager.MANAGER.close(out["id"]))
