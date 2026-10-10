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


def test_알림이_실패하면_운영_쓰기는_보내지_않는다():
    async def go():
        async def notify(msg):
            if msg["t"] == "hold":
                raise RuntimeError("socket closed")
        g = Guard(P, "op", notify, timeout=5.0)
        r = Route()
        await g.route(r, Req("http://h:8080/po/poSave.do", "POST", post="qty=1"))
        return r.done, g.decisions[-1]["decision"], g.holding
    assert run(go()) == ("abort", "error", False)


def test_알림이_실패해도_읽기는_그대로_보낸다():
    async def go():
        async def notify(msg):
            raise RuntimeError("socket closed")
        g = Guard(P, "op", notify, timeout=5.0)
        r = Route()
        await g.route(r, Req("http://h:8080/po/poList.do?a=1"))
        return r.done
    assert run(go()) == "continue"


def test_알림이_실패해도_차단_주소는_보내지_않는다():
    async def go():
        async def notify(msg):
            raise RuntimeError("socket closed")
        g = Guard(P, "op", notify, timeout=5.0)
        r = Route()
        await g.route(r, Req("http://169.254.169.254/latest", rtype="xhr"))
        return r.done
    assert run(go()) == "abort"


def test_루프백_표기_변형도_막는다():
    # 대상은 http://h:8080. 같은 호스트 표기가 달라도 서버 자신·메타데이터로 본다
    for url in ("http://[::ffff:7f00:1]:8000/api/ieum/x", "http://[::ffff:a9fe:a9fe]/latest",
                "http://0.0.0.0:8000/x", "http://[::]:8000/x", "http://localhost.:8000/x",
                "http://a.localhost:8000/x", "http://[::ffff:127.0.0.1]:8080/po/x"):
        assert scope.blocked(url, "http://h:8080") is not None, url


def test_루프백_표기_정규화는_허용_규칙을_흔들지_않는다():
    # 대상이 localhost 면 그 출처의 업무 화면은 열고, 같은 출처의 콘솔 경로만 막는다(표기 변형 포함)
    assert scope.blocked("http://localhost.:8000/demo-legacy/po/main.do", "http://localhost:8000") is None
    assert scope.blocked("http://[::ffff:127.0.0.1]:8000/api/ieum/x", "http://127.0.0.1:8000") is not None
    assert scope.blocked("http://127.0.0.1:8000/demo-legacy/po/main.do", "http://127.0.0.1:8000") is None


def test_자원_모양_주소의_POST_도_쓰기로_승인을_받는다():
    async def go():
        g, sent = make(timeout=0.05)
        r = Route()
        await g.route(r, Req("http://h:8080/po/imgSave.do?name=logo.png", "POST", post="x=1"))
        return r.done, sent[0]["t"], g.decisions[-1]["decision"]
    assert run(go()) == ("abort", "hold", "timeout")


def test_다른_출처의_조회용_POST_는_승인을_받고_대상_출처는_통과한다():
    async def go():
        g, sent = make(timeout=0.05)
        r1, r2 = Route(), Route()
        await g.route(r1, Req("http://other.corp/po/searchPost.do", "POST", post="q=1"))
        await g.route(r2, Req("http://h:8080/po/searchPost.do", "POST", post="q=1"))
        return r1.done, r2.done, g.decisions[-1]["decision"]
    assert run(go()) == ("abort", "continue", "timeout")


def test_넓은_로그인_판정으로_저장을_통과시키지_않는다():
    async def go():
        g, sent = make(timeout=0.05)
        r1, r2 = Route(), Route()
        await g.route(r1, Req("http://h:8080/po/inspSave.do", "POST", post="passYn=Y&qty=1"))
        await g.route(r2, Req("http://h:8080/po/pwChange.do", "POST", post="newPw=a&confirmPw=b"))
        return r1.done, r2.done, g.login_req
    assert run(go()) == ("abort", "abort", None)


def test_텍스트_본문의_비밀번호는_로그인이_아니다():
    async def go():
        g, sent = make(timeout=0.05)
        r = Route()
        await g.route(r, Req("http://h:8080/po/loginProc.do", "POST", post="userId=a&userPw=x", ctype="text/plain"))
        return r.done, g.login_req
    assert run(go()) == ("abort", None)


def test_JSON_로그인은_대상_출처에서_승인_없이_보낸다():
    async def go():
        g, sent = make()
        r = Route()
        await g.route(r, Req("http://h:8080/po/loginProc.do", "POST", post='{"userId":"a","userPw":"b"}',
                             ctype="application/json"))
        return r.done, sent, g.login_req["ctype"]
    assert run(go()) == ("continue", [], "application/json")


def test_다른_출처의_로그인_모양_요청은_승인을_받는다():
    async def go():
        g, sent = make(timeout=0.05)
        r = Route()
        await g.route(r, Req("http://other.corp/po/loginProc.do", "POST", post="userId=a&userPw=b"))
        return r.done, g.login_req
    assert run(go()) == ("abort", None)


def test_흔한_로그인_필드_이름도_로그인으로_본다():
    async def go():
        out = []
        for post in ("username=a&password=b", "j_username=a&j_password=b", "loginId=a&passWord=b"):
            g, sent = make()
            r = Route()
            await g.route(r, Req("http://h:8080/po/loginProc.do", "POST", post=post))
            out.append((r.done, sent, g.login_req is not None))
        return out
    assert run(go()) == [("continue", [], True)] * 3


def test_콘솔_경로의_표기_변형도_막는다():
    for url in ("http://127.0.0.1:8000/api/ieum%2fx", "http://127.0.0.1:8000//api/ieum/x",
                "http://127.0.0.1:8000/%69eum/x"):
        assert scope.blocked(url, "http://127.0.0.1:8000") is not None, url
    assert scope.blocked("http://127.0.0.1:8000/demo-legacy/po/main.do", "http://127.0.0.1:8000") is None


def test_비밀번호_변경은_로그인으로_오인하지_않는다():
    async def go():
        g, sent = make(timeout=0.05)
        r1, r2 = Route(), Route()
        await g.route(r1, Req("http://h:8080/po/pwChange.do", "POST", post="memberId=a&newPw=b&confirmPw=b"))
        await g.route(r2, Req("http://h:8080/po/updateMyInfo.do", "POST", post="userId=a&userPw=b"))
        return r1.done, r2.done, g.login_req
    assert run(go()) == ("abort", "abort", None)


def test_변경이_아닌_로그인_경로는_그대로_로그인이다():
    async def go():
        g, sent = make()
        r1, r2 = Route(), Route()
        await g.route(r1, Req("http://h:8080/po/loginProc.do", "POST", post="userId=a&userPw=b"))
        # 승인 없는 로그인은 기록당 한 번이므로 두 번째 경로는 새 기록(새 가드)으로 본다
        g2, sent2 = make()
        await g2.route(r2, Req("http://h:8080/po/j_security_check", "POST", post="j_username=a&j_password=b"))
        return r1.done, r2.done, sent + sent2, g.login_req is not None and g2.login_req is not None
    assert run(go()) == ("continue", "continue", [], True)


def test_승인_없는_로그인은_기록당_한_번이고_기록에_남는다():
    async def go():
        g, sent = make(timeout=0.05)
        r1, r2 = Route(), Route()
        await g.route(r1, Req("http://h:8080/po/loginProc.do", "POST", post="userId=a&userPw=b"))
        first = (r1.done, g.decisions[-1]["decision"], g.login_req is not None)
        await g.route(r2, Req("http://h:8080/po/loginProc.do", "POST", post="userId=a&userPw=b"))
        return first, r2.done, g.decisions[-1]["decision"]
    assert run(go()) == (("continue", "login", True), "abort", "timeout")


def test_가입_결제_생성_경로는_첫_요청이어도_로그인이_아니다():
    async def go():
        out = []
        for path, post in (("/member/joinProc.do", "userId=a&userPw=b"),
                           ("/sys/user/insertUser.do", "userNm=a&userPw=b"),
                           ("/order/pay.do", "orderId=1&payPw=2"),
                           ("/member/signup.do", "userId=a&userPw=b"),
                           ("/member/registerUser.do", "userId=a&userPw=b")):
            g, sent = make(timeout=0.05)
            r = Route()
            await g.route(r, Req("http://h:8080" + path, "POST", post=post))
            out.append((path, r.done, g.login_req))
        return out
    assert all(d == "abort" and lr is None for _, d, lr in run(go())), run(go())


def test_POST_가_아닌_로그인_모양_요청은_승인을_받는다():
    async def go():
        g, sent = make(timeout=0.05)
        r = Route()
        await g.route(r, Req("http://h:8080/po/loginProc.do", "PUT", post="userId=a&userPw=b"))
        return r.done, g.login_req, g.decisions[-1]["decision"]
    assert run(go()) == ("abort", None, "timeout")


def test_승인받은_재로그인도_login_req_에_남는다():
    async def go():
        g, sent = make()
        r1, r2 = Route(), Route()
        await g.route(r1, Req("http://h:8080/po/loginProc.do", "POST", post="userId=a&userPw=b"))
        task = asyncio.ensure_future(g.route(r2, Req("http://h:8080/po/loginProc.do", "POST", post="userId=c&userPw=d")))
        await asyncio.sleep(0.05)
        hold = [m for m in sent if m["t"] == "hold"][-1]
        assert g.decide(hold["id"], True)
        await task
        return r2.done, g.login_req["post"], g.decisions[-1]["decision"]
    assert run(go()) == ("continue", "userId=c&userPw=d", "approve")
