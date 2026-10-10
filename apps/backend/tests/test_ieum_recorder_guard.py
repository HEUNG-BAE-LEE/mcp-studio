# apps/backend/tests/test_ieum_recorder_guard.py
"""항상 차단 판정과 쓰기 가드. Playwright 없이 가짜 route/request 로 시험한다."""
import asyncio

from app.ieum.discovery.policy import Policy
from app.ieum.recorder import scope
from app.ieum.recorder.guard import Guard

P = Policy(base="http://h:8080/po", read_post="/po/searchPost.do")


class Req:
    def __init__(self, url, method="GET", rtype="xhr", post=None, ctype="application/x-www-form-urlencoded"):
        self.url, self.method, self.resource_type, self.post_data = url, method, rtype, post
        self.headers = {"content-type": ctype}
        self.frame = type("F", (), {"url": "http://h:8080/po/login.do"})()


class Route:
    def __init__(self):
        self.done = None

    async def continue_(self):
        self.done = "continue"

    async def abort(self, reason="failed"):
        self.done = "abort"


def run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def make(env="op", timeout=5.0, policy=P):
    sent = []

    async def notify(msg):
        sent.append(msg)
    return Guard(policy, env, notify, timeout=timeout), sent


def test_서버_보호_주소는_막고_대상_출처는_연다():
    assert scope.blocked("http://169.254.169.254/latest/meta-data", "http://h:8080") is not None
    assert scope.blocked("file:///etc/passwd", "http://h:8080") is not None
    assert scope.blocked("http://127.0.0.1:8000/api/ieum/studio/", "http://h:8080") is not None
    assert scope.blocked("http://localhost:9000/", "http://h:8080") is not None
    # 시연처럼 대상 자체가 localhost 면 그 출처의 업무 화면은 열되, 같은 출처의 이음 콘솔 경로는 막는다
    assert scope.blocked("http://127.0.0.1:8000/demo-legacy/po/main.do", "http://127.0.0.1:8000") is None
    assert scope.blocked("http://127.0.0.1:8000/api/ieum/studio/", "http://127.0.0.1:8000") is not None
    assert scope.blocked("http://appr.corp:9090/approve.do", "http://h:8080") is None          # 다른 사내 시스템은 막지 않는다
    assert scope.blocked("http://10.9.1.2/x", "http://h:8080", ["10.9.0.0/16"]) is not None
    assert scope.blocked("about:blank", "http://h:8080") is None


def test_차단_주소_요청은_정적_자원도_막고_알린다():
    async def go():
        g, sent = make()
        r = Route()
        await g.route(r, Req("http://169.254.169.254/latest", rtype="image"))
        return r.done, sent[-1]["t"], g.decisions[-1]["decision"]
    assert run(go()) == ("abort", "blocked", "denied-host")


def test_읽기는_그대로_보낸다():
    async def go():
        g, sent = make()
        r = Route()
        await g.route(r, Req("http://h:8080/po/poList.do?a=1"))
        return r.done, sent
    assert run(go()) == ("continue", [])


def test_운영_쓰기는_승인하면_보낸다():
    async def go():
        g, sent = make()
        g.label = "저장"
        r = Route()
        task = asyncio.ensure_future(g.route(r, Req("http://h:8080/po/poSave.do", "POST", post="qty=1")))
        await asyncio.sleep(0.05)
        assert g.holding and sent[0]["t"] == "hold" and sent[0]["path"] == "/poSave.do" and sent[0]["label"] == "저장"
        assert g.decide(sent[0]["id"], True)
        await task
        return r.done, g.decisions[-1]["decision"], g.holding
    assert run(go()) == ("continue", "approve", False)


def test_다른_시스템으로_가는_운영_쓰기도_승인을_받는다():
    async def go():
        g, sent = make(timeout=0.05)
        r = Route()
        await g.route(r, Req("http://appr.corp:9090/approve.do", "POST", post="docNo=1"))
        return r.done, g.decisions[-1]["decision"]
    assert run(go()) == ("abort", "timeout")


def test_운영_쓰기는_거절하면_버린다():
    async def go():
        g, sent = make()
        r = Route()
        task = asyncio.ensure_future(g.route(r, Req("http://h:8080/po/poSave.do", "POST")))
        await asyncio.sleep(0.05)
        g.decide(sent[0]["id"], False)
        await task
        return r.done, g.decisions[-1]["decision"]
    assert run(go()) == ("abort", "deny")


def test_승인_응답이_없으면_시간_초과로_보내지_않는다():
    async def go():
        g, sent = make(timeout=0.1)
        r = Route()
        await g.route(r, Req("http://h:8080/po/poSave.do", "POST"))
        return r.done, g.decisions[-1]["decision"], sent[-1]
    done, decision, last = run(go())
    assert done == "abort" and decision == "timeout" and last == {"t": "hold-end", "id": last["id"], "decision": "timeout"}


def test_스테이징은_쓰기도_보내고_기록한다():
    async def go():
        g, sent = make(env="stg")
        r = Route()
        await g.route(r, Req("http://h:8080/po/poSave.do", "POST"))
        return r.done, g.decisions[-1]["decision"], sent
    assert run(go()) == ("continue", "staging", [])


def test_로그인_요청은_승인_없이_보내고_붙잡아_둔다():
    async def go():
        g, sent = make()
        r = Route()
        await g.route(r, Req("http://h:8080/po/loginProc.do", "POST", post="userId=a&userPw=b"))
        return r.done, sent, g.login_req["post"]
    assert run(go()) == ("continue", [], "userId=a&userPw=b")


def test_토큰_필드가_든_저장은_로그인으로_오인하지_않는다():
    async def go():
        g, sent = make(timeout=0.05)
        r = Route()
        await g.route(r, Req("http://h:8080/po/poSave.do", "POST", post="csrfToken=abc&qty=1"))
        return r.done, g.login_req, g.decisions[-1]["decision"]
    assert run(go()) == ("abort", None, "timeout")


def test_조회용_POST_는_통과하고_이름이_쓰기_같은_GET_은_승인_대상():
    async def go():
        g, sent = make(timeout=0.05)
        r1, r2 = Route(), Route()
        await g.route(r1, Req("http://h:8080/po/searchPost.do", "POST"))
        await g.route(r2, Req("http://h:8080/po/poDelete.do?id=1", "GET"))
        return r1.done, r2.done
    assert run(go()) == ("continue", "abort")


def test_Replay_쓰기_승인도_같은_창을_쓴다():
    async def go():
        g, sent = make()
        task = asyncio.ensure_future(g.ask("POST", "http://h:8080/po/poSave.do", "Replay: 발주 저장"))
        await asyncio.sleep(0.05)
        g.decide(sent[0]["id"], True)
        return await task
    assert run(go()) is True
