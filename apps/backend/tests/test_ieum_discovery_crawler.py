"""화면 탐색기(크롤러) 안전·견고성 시험. 까다로운 상황만 모은 작은 사이트를 실제 헤드리스 브라우저로 탐색한다.

시연용 레거시 사이트에 없는 상황을 다룬다: 로드 시 GET 쓰기, 대화상자 확인, javascript: 메뉴, iframe, 폴링, 삭제 핸들러.
서버가 실제로 받은 요청을 기록해, "무엇이 운영에 닿았는가"를 서버 쪽에서 단언한다.
"""
import contextlib
import os
import threading
import time

import pytest
import uvicorn
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse

from app.ieum.discovery.browser import capabilities
from app.ieum.discovery.crawler import MAX_SAMPLES, Crawler
from app.ieum.discovery.policy import Policy

pytestmark = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"], reason="탐색에 쓸 브라우저가 없다")

INDEX = """<!doctype html><meta charset="utf-8"><title>시험 사이트</title><h1>시험 사이트</h1>
<a href="/page2.html">정적 링크</a> <a href="javascript:goPage('/page3.html')">자바스크립트 메뉴</a> <a href="/logout.do">로그아웃</a>
<a href="/download/report.xlsx">엑셀</a> <a href="/admin/secret.html">관리자</a> <a href="/deleteUser.do?id=1">회원 정리</a><br>
<button onclick="fetch('/data/list.do')">조회</button>
<button onclick="fetch('/data/doSave.do', {method:'POST'})">저장하기</button>
<button onclick="fetch('/data/regist.do', {method:'POST', body:'a=1'})">신규</button>
<button onclick="if (confirm('정말 처리할까요?')) fetch('/data/viaConfirm.do')">확인형</button>
<button onclick="location.href='/data/deleteItem.do?id=1'">정리</button>
<table><tbody><tr onclick="fetch('/data/rowDetail.do?id=1')" style="cursor:pointer"><td>자료 승인대기</td></tr></tbody></table>
<iframe src="/frame.html" width="400" height="80"></iframe>
<script>
  fetch('/data/boot.do');
  fetch('/data/removeAll.do');
  let n = 0; const t = setInterval(() => { fetch('/data/poll.do'); if (++n >= 40) clearInterval(t); }, 100);
  function goPage(u) { location.href = u; }
</script>"""


@contextlib.contextmanager
def serve():
    """시험 사이트를 띄운다. 서버가 실제로 받은 요청을 hits 에 기록한다."""
    hits = []
    app = FastAPI()

    @app.middleware("http")
    async def record(request, call_next):
        hits.append((request.method, request.url.path))
        return await call_next(request)

    page = lambda html: HTMLResponse(html)
    app.get("/")(lambda: page(INDEX))
    app.get("/page2.html")(lambda: page("<meta charset=utf-8><title>둘째</title><h2>둘째</h2><button onclick=\"fetch('/data/page2.do')\">조회</button>"))
    app.get("/page3.html")(lambda: page("<meta charset=utf-8><title>셋째</title><h2>셋째</h2><script>fetch('/data/page3.do')</script>"))
    app.get("/frame.html")(lambda: page("<meta charset=utf-8><button onclick=\"fetch('/data/frameList.do')\">프레임 조회</button>"))
    for path in ("/logout.do", "/admin/secret.html", "/download/report.xlsx", "/deleteUser.do"):
        app.get(path)(lambda: page("<h2>닿으면 안 되는 곳</h2>"))
    app.api_route("/data/{name}", methods=["GET", "POST"])(lambda name: JSONResponse({"ok": 1, "name": name}))
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=0, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    while not server.started:
        time.sleep(0.02)
    try:
        yield f"http://localhost:{server.servers[0].sockets[0].getsockname()[1]}", hits
    finally:
        server.should_exit = True
        thread.join(timeout=5)


@pytest.fixture
def site():
    with serve() as s:
        yield s


@pytest.fixture(scope="module")
def crawled():
    """탐색 한 번. 아래 시험들이 같은 결과를 나눠 본다(크롤 한 번이 20초쯤 걸린다)."""
    with serve() as (base, hits):
        events = []
        policy = Policy(base=base, exclude="/admin/*", ban=["저장", "승인"], delay_ms=50, max_pages=10)
        res = Crawler(policy, base + "/", None, emit=lambda l, k, **f: events.append((l, k, f)), on_shot=lambda b: 1, cancelled=lambda: False).run()
        yield res, list(hits), events


def reached(hits):
    return {(m, p) for m, p in hits}


def test_눌러서는_안_되는_것은_서버에_닿지_않는다(crawled):
    res, hits, _ = crawled
    got = reached(hits)
    assert res.error == "" and res.stopped == ""
    for danger in (("POST", "/data/doSave.do"), ("POST", "/data/regist.do"), ("GET", "/data/removeAll.do"), ("GET", "/data/deleteItem.do"), ("GET", "/data/viaConfirm.do"),
                   ("GET", "/logout.do"), ("GET", "/admin/secret.html"), ("GET", "/download/report.xlsx"), ("GET", "/deleteUser.do")):
        assert danger not in got, f"{danger} 가 서버에 닿았다"


def test_읽기는_찾고_쓰기_요청은_가로챈다(crawled):
    res, hits, _ = crawled
    got = reached(hits)
    assert {("GET", f"/data/{n}.do") for n in ("boot", "list", "rowDetail", "page2", "page3", "frameList", "poll")} <= got
    blocked = {(o.method, o.url.rsplit("/", 1)[-1]) for o in res.observed if o.blocked}
    assert {("POST", "regist.do"), ("GET", "removeAll.do")} <= blocked                  # 클릭 없이 로드 시 부른 GET 쓰기도 이름으로 가로챈다
    assert res.blocked >= 2 and all(o.status is None for o in res.observed if o.blocked)


def test_자바스크립트_메뉴와_iframe_안의_버튼도_누른다(crawled):
    res, hits, _ = crawled
    assert {"둘째", "셋째"} <= {p["title"] for p in res.pages}                         # 일반 링크와 javascript: 메뉴로 간 화면
    assert ("GET", "/data/frameList.do") in reached(hits)                             # iframe 안의 버튼


def test_건너뛴_것은_이유와_함께_남는다(crawled):
    res, _, events = crawled
    why = {s["text"]: s["why"] for s in res.skipped}
    assert "누르지 않을 단어" in why["저장하기"] and "delete" in why["정리"] and "삭제처럼 보이는 주소" in why["회원 정리"]
    assert "로그아웃" in why["로그아웃"] and "제외 경로" in why["관리자"] and "파일" in why["엑셀"]
    assert any(k == "skip" and "저장하기" in f["msg"] for _, k, f in events)


def test_표의_데이터_글자는_버튼_금지어로_보지_않는다(crawled):
    res, hits, _ = crawled
    assert ("GET", "/data/rowDetail.do") in reached(hits)                             # 행 글자 "자료 승인대기" 에 금지어 '승인' 이 있어도 행은 데이터다
    assert not any("승인대기" in s["text"] for s in res.skipped)


def test_폴링은_표본만_들고_전체는_센다(crawled):
    res, hits, events = crawled
    polls = [o for o in res.observed if o.url.endswith("/data/poll.do")]
    assert 0 < len(polls) <= MAX_SAMPLES and res.total >= len(polls)
    assert sum(1 for m, p in hits if p == "/data/poll.do") >= 10
    assert sum(1 for l, k, f in events if k == "req" and f.get("p", "").startswith("/data/poll.do")) <= 3          # 화면 기록에도 몇 번만 올린다


def test_대화상자는_취소로_답한다(crawled):
    _, hits, _ = crawled
    assert ("GET", "/data/viaConfirm.do") not in reached(hits)


def test_취소하면_바로_멈추고_부분_결과를_돌려준다(site):
    base, _ = site
    state = {"n": 0}

    def cancelled():
        state["n"] += 1
        return state["n"] > 6                                                           # 몇 단계 지난 뒤에 취소
    res = Crawler(Policy(base=base, delay_ms=50), base + "/", None, emit=lambda *a, **k: None, on_shot=lambda b: 1, cancelled=cancelled).run()
    assert res.stopped == "cancel" and len(res.pages) >= 1


def test_화면_상한에서_멈춘다(site):
    base, hits = site
    res = Crawler(Policy(base=base, delay_ms=50, max_pages=1), base + "/", None, emit=lambda *a, **k: None, on_shot=lambda b: 1, cancelled=lambda: False).run()
    assert len(res.pages) == 1 and ("GET", "/page2.html") not in reached(hits)
