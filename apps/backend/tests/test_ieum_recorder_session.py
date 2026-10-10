# apps/backend/tests/test_ieum_recorder_session.py
"""기록 세션: 자동 로그인, 화면 스트리밍, 입력 처리, 상한(서버·사람당), 격리, 브라우저 끊김."""
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
    """이음 라우터를 실은 진짜 서버. 기록 세션은 이 서버의 이벤트 루프에서 산다."""
    from app.ieum.routers import router

    app = FastAPI()
    app.include_router(router)
    app.add_event_handler("startup", lambda: LOOP.update(loop=asyncio.get_running_loop()))
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=0, log_level="warning"))
    t = threading.Thread(target=server.run, daemon=True)
    t.start()
    deadline = time.time() + 15
    while not server.started:
        if time.time() > deadline:
            server.should_exit = True
            raise RuntimeError("테스트 서버가 15초 안에 뜨지 않았습니다.")
        time.sleep(0.02)
    try:
        yield f"http://127.0.0.1:{server.servers[0].sockets[0].getsockname()[1]}"
    finally:
        server.should_exit = True          # 라우터의 shutdown 훅이 서버 루프에서 MANAGER.shutdown() 으로 브라우저를 닫는다
        t.join(timeout=30)


def call(coro, timeout=60):
    return asyncio.run_coroutine_threadsafe(coro, LOOP["loop"]).result(timeout)


def start(base, **kw):
    from app.ieum.recorder.manager import MANAGER
    payload = dict(name="9월 발주 조회", owner="홍길동", base=base + "/demo-legacy/po", start="/login.do", env="op",
                   account=DEMO_USER_ID, password=DEMO_PASSWORD)
    payload.update(kw)
    return call(MANAGER.start(payload))


class WS:
    def __init__(self):
        self.msgs = []

    async def send_json(self, msg):
        self.msgs.append(msg)


def test_서비스_계정으로_자동_로그인하고_화면을_보낸다(live):
    from app.ieum.recorder.manager import MANAGER
    out = start(live)
    s = MANAGER.get(out["id"])
    ws = WS()
    s.subscribe(ws)
    end = time.time() + 15
    while time.time() < end and not any(m["t"] == "frame" for m in ws.msgs):
        time.sleep(0.2)
    assert any(m["t"] == "frame" for m in ws.msgs) and s.page.url.endswith("/main.do")
    assert len(out["token"]) >= 16


def test_클릭하면_행동_묶음과_요청이_기록된다(live):
    from app.ieum.recorder import relay, store
    from app.ieum.recorder.manager import MANAGER
    out = start(live)
    s = MANAGER.get(out["id"])
    call(s.page.goto(s.policy.base + "/poListView.do"))
    box = call(s.page.locator("#btnSearch").bounding_box())
    call(s.handle({"t": "click", "x": box["x"] + 5, "y": box["y"] + 5, "w": relay.VIEW_W, "h": relay.VIEW_H}))
    time.sleep(1.0)
    call(s.stop())
    spans = store.read_spans(out["id"])
    assert spans[-1]["action"]["target"]["id"] == "btnSearch"
    assert any(n["path"] == "/poList.do" for n in spans[-1]["network"])


def test_사람당_상한과_서버_전체_상한(live, monkeypatch):
    from app.ieum.recorder import manager
    monkeypatch.setenv("IEUM_RECORDER_MAX_PER_OWNER", "1")
    monkeypatch.setenv("IEUM_RECORDER_MAX_SESSIONS", "2")
    start(live, owner="홍길동")
    with pytest.raises(manager.RecorderError) as e:
        start(live, owner="홍길동")
    assert e.value.code == 409 and "홍길동" in str(e.value)
    start(live, owner="김철수")
    with pytest.raises(manager.RecorderError) as e:
        start(live, owner="이영희")
    assert e.value.code == 409 and "2" in str(e.value)
    assert manager.MANAGER.usage()["byOwner"] == {"홍길동": 1, "김철수": 1}


def test_기록하는_사람은_필수다(live):
    from app.ieum.recorder import manager
    with pytest.raises(manager.RecorderError):
        start(live, owner=" ")


def test_두_세션의_쿠키가_섞이지_않는다(live):
    from app.ieum.recorder.manager import MANAGER
    a = MANAGER.get(start(live, owner="a")["id"])
    b = MANAGER.get(start(live, owner="b", account="", password="")["id"])
    assert any(c["name"] == "JSESSIONID" for c in call(a.ctx.cookies()))
    assert not any(c["name"] == "JSESSIONID" for c in call(b.ctx.cookies()))
    assert b.page.url.endswith("/login.do")


def test_브라우저가_죽으면_중단됨이_된다(live):
    from app.ieum.recorder import store
    from app.ieum.recorder.manager import MANAGER
    out = start(live)
    s = MANAGER.get(out["id"])
    call(s.browser.close())                   # 브라우저가 갑자기 사라진 상황
    time.sleep(1.0)
    assert store.get_recording(out["id"])["status"] == "interrupted" and MANAGER.get(out["id"]) is None


async def _offer(s, data):
    s._frame(data)


async def _sender_offer(sender, data):
    sender.offer(data)


def test_끊긴_구독자는_목록에서_빠진다(live):
    from app.ieum.recorder.manager import MANAGER
    s = MANAGER.get(start(live)["id"])

    class Dead:
        calls = 0

        async def send_json(self, msg):
            Dead.calls += 1
            raise RuntimeError("끊김")
    dead, ok = Dead(), WS()
    s.subscribe(dead)
    s.subscribe(ok)
    sender = s.subs[dead]
    call(_sender_offer(sender, "x"))          # 보내기가 실패하면 sender.failed 가 선다(구독자는 아직 목록에 있을 수 있다)
    time.sleep(0.5)
    assert sender.failed
    calls = Dead.calls
    call(_offer(s, "y"))                      # broadcast 없이 프레임만: _prune 이 빼고 다시 보내지 않는다
    call(_offer(s, "z"))
    time.sleep(0.3)
    assert dead not in s.subs and ok in s.subs and Dead.calls == calls


def test_로그인_통과_결정이_승인_기록에_그대로_남는다(live):
    from app.ieum.recorder import store
    out = start(live)
    from app.ieum.recorder.manager import MANAGER
    s = MANAGER.get(out["id"])
    call(s.stop())
    assert any(a["decision"] == "login" for a in store.get_recording(out["id"])["approvals"])


def test_동시_시작은_상한을_넘지_않는다(live, monkeypatch):
    from app.ieum.recorder import manager
    monkeypatch.setenv("IEUM_RECORDER_MAX_PER_OWNER", "1")
    monkeypatch.setenv("IEUM_RECORDER_MAX_SESSIONS", "2")

    async def both():
        mk = lambda: manager.MANAGER.start(dict(name="n", owner="홍길동", base=live + "/demo-legacy/po", start="/login.do", env="op",
                                                account=DEMO_USER_ID, password=DEMO_PASSWORD))
        return await asyncio.gather(mk(), mk(), return_exceptions=True)
    res = call(both())
    assert sum(isinstance(r, dict) for r in res) == 1
    assert sum(isinstance(r, manager.RecorderError) and r.code == 409 for r in res) == 1
    assert manager.MANAGER.usage()["total"] == 1


def test_리퍼는_한_번_실패해도_계속_돈다(live, monkeypatch):
    from app.ieum.recorder import manager, retention, store
    monkeypatch.setenv("IEUM_RECORDER_IDLE_SEC", "0")
    out = start(live)
    s = manager.MANAGER.get(out["id"])
    s.last_input -= 5
    calls = {"n": 0}

    def boom(now):
        calls["n"] += 1
        raise RuntimeError("정리 실패")
    monkeypatch.setattr(retention, "sweep", boom)
    manager.MANAGER._swept_at = 0.0
    call(manager.MANAGER._reap_once())        # 정리가 터져도 같은 주기의 세션 회수는 돈다
    assert calls["n"] == 1
    assert store.get_recording(out["id"])["status"] == "interrupted" and manager.MANAGER.get(out["id"]) is None


def test_중복_멈춤은_409이고_on_stopped는_한_번(live):
    from app.ieum.recorder import manager
    seen = []

    async def done(rid, s):
        seen.append(rid)
    manager.MANAGER.on_stopped = done
    try:
        out = start(live)
        call(manager.MANAGER.stop(out["id"]))
        with pytest.raises(manager.RecorderError) as e:
            call(manager.MANAGER.stop(out["id"]))
        assert e.value.code == 409
        time.sleep(0.3)
        assert seen == [out["id"]]
    finally:
        manager.MANAGER.on_stopped = None


def test_멈추면_대기_중인_승인은_거부로_닫힌다(live):
    from app.ieum.recorder import manager, store
    out = start(live)
    s = manager.MANAGER.get(out["id"])
    call(s.page.goto(s.policy.base + "/poListView.do"))
    manager.MANAGER.on_stopped = _noop                 # 멈춘 뒤에도 세션을 열어 두고 원본 상태를 본다

    async def list_body():
        r = await s.ctx.request.get(s.policy.base + "/poList.do")
        return await r.text()
    before = call(list_body())

    async def fire():
        # 승인 대기를 만든다: 유효한 발주 저장을 보낸다(승인되면 원본에 발주가 생긴다)
        asyncio.ensure_future(s.page.evaluate(
            "fetch('/demo-legacy/po/poSave.do',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},"
            "body:'vendCd=V001&itemCd=I001&qty=1&unitPrice=100&payTerm=30'}).catch(()=>0)"))
        for _ in range(100):
            if s.guard.holding:
                return True
            await asyncio.sleep(0.05)
        return False
    try:
        assert call(fire())
        call(manager.MANAGER.stop(out["id"]))
        decisions = [a["decision"] for a in store.get_recording(out["id"])["approvals"]]
        assert "deny" in decisions and "approve" not in decisions
        assert not s.guard.holding
        assert call(list_body()) == before             # 원본에 쓰기가 닿지 않았다
    finally:
        manager.MANAGER.on_stopped = None


async def _noop(rid, s):
    return None


def test_시작이_취소되면_자리와_인증_정보를_치운다(live, monkeypatch):
    from app.ieum.gateway import credentials
    from app.ieum.recorder import manager, session as session_mod

    gate = {}

    async def slow_start(self, pw):
        gate["entered"].set()
        await asyncio.sleep(60)
    monkeypatch.setattr(session_mod.RecorderSession, "start", slow_start)

    async def run():
        gate["entered"] = asyncio.Event()
        task = asyncio.ensure_future(manager.MANAGER.start(dict(
            name="n", owner="홍길동", base=live + "/demo-legacy/po", start="/login.do", env="op",
            account=DEMO_USER_ID, password=DEMO_PASSWORD)))
        await asyncio.wait_for(gate["entered"].wait(), 20)
        assert manager.MANAGER.usage()["total"] == 1
        rid = next(iter(manager.MANAGER.sessions))
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        return rid
    rid = call(run())
    assert manager.MANAGER.usage()["total"] == 0
    assert not credentials.get(manager.vault_key(rid))      # 인증 정보도 금고에서 지워졌다


def test_멈춤이_실패하면_세션이_남지_않고_다시_시작할_수_있다(live, monkeypatch):
    from app.ieum.recorder import login, manager, store
    out = start(live)

    async def boom(*a, **k):
        raise RuntimeError("레시피 실패")
    orig = login.recipe_for
    monkeypatch.setattr(login, "recipe_for", boom)
    with pytest.raises(manager.RecorderError) as e:
        call(manager.MANAGER.stop(out["id"]))
    assert e.value.code == 500
    assert manager.MANAGER.get(out["id"]) is None and out["id"] not in manager.MANAGER.sessions
    assert store.get_recording(out["id"])["status"] == "failed"
    monkeypatch.setattr(login, "recipe_for", orig)
    assert start(live)["id"]


def test_늦게_붙은_구독자도_떠_있는_승인_창을_받는다(live):
    from app.ieum.recorder import manager
    out = start(live)
    s = manager.MANAGER.get(out["id"])
    call(s.page.goto(s.policy.base + "/poListView.do"))
    manager.MANAGER.on_stopped = _noop

    async def fire():
        asyncio.ensure_future(s.page.evaluate(
            "fetch('/demo-legacy/po/poSave.do',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},"
            "body:'vendCd=V001&itemCd=I001&qty=1&unitPrice=100&payTerm=30'}).catch(()=>0)"))
        for _ in range(100):
            if s.guard.holding:
                return True
            await asyncio.sleep(0.05)
        return False
    try:
        assert call(fire())
        late = WS()
        s.subscribe(late)
        end = time.time() + 5
        while time.time() < end and not any(m["t"] == "hold" for m in late.msgs):
            time.sleep(0.1)
        holds = [m for m in late.msgs if m["t"] == "hold"]
        assert len(holds) == 1 and holds[0]["method"] == "POST"
        call(manager.MANAGER.stop(out["id"]))
    finally:
        manager.MANAGER.on_stopped = None
