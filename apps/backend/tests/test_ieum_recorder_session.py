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
    while not server.started:
        time.sleep(0.02)
    yield f"http://127.0.0.1:{server.servers[0].sockets[0].getsockname()[1]}"
    from app.ieum.recorder.manager import MANAGER    # 작업 7 동안만: 작업 8 에서 라우터 shutdown 훅이 생기면 지운다
    call(MANAGER.shutdown())
    server.should_exit = True                 # 라우터 shutdown 훅이 MANAGER.shutdown() 으로 브라우저를 닫는다
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


def test_끊긴_구독자는_목록에서_빠진다(live):
    from app.ieum.recorder.manager import MANAGER
    s = MANAGER.get(start(live)["id"])

    class Dead:
        async def send_json(self, msg):
            raise RuntimeError("끊김")
    dead, ok = Dead(), WS()
    s.subscribe(dead)
    s.subscribe(ok)
    call(_offer(s, "x"))                      # 프레임 보내기가 실패하면 sender.failed 가 선다
    time.sleep(0.5)
    call(s.send_tabs())                       # 다음 전송 때 빠진다
    assert dead not in s.subs and ok in s.subs


def test_로그인_통과_결정이_승인_기록에_그대로_남는다(live):
    from app.ieum.recorder import store
    out = start(live)
    from app.ieum.recorder.manager import MANAGER
    s = MANAGER.get(out["id"])
    call(s.stop())
    assert any(a["decision"] == "login" for a in store.get_recording(out["id"])["approvals"])
