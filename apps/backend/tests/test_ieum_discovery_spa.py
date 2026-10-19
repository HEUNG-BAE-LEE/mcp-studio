"""조회도 POST 로 하는 SPA(나라장터 같은 WebSquare)를 실제 헤드리스 Chrome 으로 탐색한다. 시험용 사이트는 tests/spa_site.py.

그 사이트가 실제로 부딪힌 것들을 그대로 재현한다: 화면이 DOMContentLoaded 한참 뒤에 그려지고, 시작하자마자 공지 팝업 3개가 메뉴를 가리고,
메뉴는 href="javascript:void" 이며 하위 메뉴가 숨어 있고, 조회가 전부 POST 이고(쿠키와 `menu-info` 헤더가 없으면 403), 이름이 조회처럼 보이지만 쓰는 요청이 섞여 있다.

탐색 한 번이 1분 안팎이라 같은 탐색 결과를 여러 시험이 나눠 쓴다. 브라우저가 없거나 IEUM_SKIP_BROWSER_TESTS=1 이면 건너뛴다.
"""
import os
import threading
import time

import httpx
import pytest
import uvicorn
from fastapi import FastAPI

from app.ieum.discovery import jobs
from app.ieum.discovery.browser import capabilities
from tests import spa_site

pytestmark = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"], reason="탐색에 쓸 브라우저가 없다")

BAN = ["삭제", "저장", "승인", "결재", "결제", "확정", "전송"]
WRITES = ("/api/bid/insertBid.do", "/api/budget/budgetSave.do", "/api/misc/selectAndUpdateRow.do", "/fs/fsc/fsca/fileUpload.do")
SELECT = "/api/m201010/selectBidPblancList.do"
DONE = ("review", "failed", "cancelled")


@pytest.fixture(scope="module")
def site():
    with spa_site.serve() as (base, hits):
        yield base, hits


@pytest.fixture(scope="module")
def live(tmp_path_factory):
    """이음 라우터만 실은 앱 + 모듈 단위 상태 폴더."""
    from app.ieum.gateway import runner, session_auth
    from app.ieum.routers import router

    mp = pytest.MonkeyPatch()
    mp.setenv("IEUM_STATE_DIR", str(tmp_path_factory.mktemp("ieum-spa") / "state"))
    mp.delenv("IEUM_SECRET_KEY", raising=False)
    for name in ("AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_API_VERSION", "AZURE_OPENAI_DEPLOYMENT"):
        mp.delenv(name, raising=False)            # 진짜 모델을 부르지 않게
    mp.setattr(runner, "_RATE", {})
    mp.setattr(session_auth, "_CACHE", {})
    app = FastAPI()
    app.include_router(router)
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=0, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    while not server.started:
        time.sleep(0.02)
    yield f"http://localhost:{server.servers[0].sockets[0].getsockname()[1]}"
    jobs.stop(timeout=30)
    server.should_exit = True
    thread.join(timeout=5)
    mp.undo()


def api(base, method, path, body=None):
    r = httpx.request(method, base + "/api/ieum" + path, json=body, timeout=30)
    j = r.json()
    return j["resultCode"], (j["resultData"] if j["resultCode"] < 400 else j["resultMsg"])


def payload(site_base, **kw):
    # 로그인 화면이 없는 공개 사이트라 계정을 넣지 않는다
    return {"crawl": True, "git": False, "approved": True, "owner": "시험", "base": site_base, "start": "/", "ban": BAN, "maxPages": 12, "delayMs": 100, "maxSeconds": 240, **kw}


def view(base, job_id):
    return api(base, "GET", f"/discovery/jobs/{job_id}/?after=999999")[1]


def wait_for(base, job_id, until, timeout=240):
    deadline, v = time.time() + timeout, None
    while time.time() < deadline:
        v = view(base, job_id)
        if until(v):
            return v
        time.sleep(0.4)
    raise AssertionError(f"작업이 제때 끝나지 않았습니다: {v and (v['status'], v['act'])}")


def all_events(base, job_id):
    events, after = [], 0
    while True:
        v = api(base, "GET", f"/discovery/jobs/{job_id}/?after={after}")[1]
        events += v["events"]
        after = v["seq"]
        if not v["more"]:
            return events


def posts(hits, path=None):
    return [h for h in hits if h["method"] == "POST" and (path is None or h["path"] == path)]


# ---------------------------------------------------------------- 묻지 않고(조회로 보이는 POST 를 막은 채) 탐색
@pytest.fixture(scope="module")
def blocked(live, site):
    base, _ = site
    st, job = api(live, "POST", "/discovery/jobs/", payload(base))
    assert st == 201, job
    v = wait_for(live, job["id"], lambda x: x["status"] in DONE)
    assert v["status"] == "review", v["error"]
    return v


def test_화면이_그려지기를_기다리고_팝업을_닫고_눌러서_여는_메뉴를_끝까지_돈다(live, blocked):
    h, s = blocked["hitl"], blocked["stats"]
    items = {p["name"]: p for p in h["plan"]["items"]}
    assert set(items) == {"발주 > 발주목록", "입찰 > 입찰공고 > 입찰공고목록", "입찰 > 입찰공고 > 연기공고목록", "입찰 > 입찰진행 > 입찰진행참가", "관리 > 삭제내역"}
    assert [p["st"] for n, p in items.items() if n != "관리 > 삭제내역"] == ["done"] * 4                       # 하위 메뉴는 숨어 있었는데도 길을 눌러 모두 열었다
    assert (items["관리 > 삭제내역"]["rel"], items["관리 > 삭제내역"]["st"]) == ("excl", "skip") and "삭제" in items["관리 > 삭제내역"]["why"]      # 누르지 않을 단어
    assert items["입찰 > 입찰공고 > 입찰공고목록"]["leaf"] == "입찰공고목록" and h["plan"]["by"] == "none"
    assert s["pages"] == 5                                                                                      # 시작 화면 + 말단 화면 4개. 주소는 모두 같다
    ev = all_events(live, blocked["id"])
    assert any(e["k"] == "note" and "팝업" in e.get("msg", "") for e in ev)                                    # 메뉴를 가린 팝업을 닫았다고 밝혔다
    assert any(e["k"] == "plan" and e["msg"].startswith("눌러서 여는 메뉴 4개") for e in ev)
    pages = [e for e in ev if e["k"] == "page"]
    assert {"입찰공고목록", "연기공고목록", "발주목록", "입찰진행참가"} <= {e.get("title") for e in pages}          # 화면 이름은 메뉴 이름이다(주소가 같으니)
    assert len({e["url"] for e in pages}) == 1


def test_조회도_POST_라_막혔고_이름이_조회처럼_보이는_것을_결과가_알려_준다(blocked):
    r = blocked["reads"]
    assert r["state"] == "keep" and r["n"] >= 6
    assert {"/co/coz/coza/util/getSession.do", "/fm/fma/fmaa/Pst/selectNtcPstList.do", SELECT, "/api/m1010/selectOderReqList.do"} <= set(r["paths"])
    assert not any(p.rsplit("/", 1)[-1].startswith(("budget", "insert", "selectAndUpdate", "file")) for p in r["paths"])      # 쓰기 이름은 조회로 세지 않는다
    by = {a["path"]: a for a in blocked["apis"]}
    a = by[SELECT]
    assert (a["m"], a["mode"], a["verify"]["k"], a["tr"]["blocked"], a["rec"]) == ("POST", "write", "block", True, "check") and "조회로 보이는 POST" in a["recNote"]


def test_쓰기로_보이는_요청은_조회_이름이어도_어떤_경우에도_막는다(blocked):
    by = {a["path"]: a for a in blocked["apis"]}
    for p in WRITES:
        a = by[p]
        assert (a["mode"], a["verify"]["k"], a["tr"]["blocked"]) == ("write", "block", True), p
    assert "조회로 보이는 POST" not in by["/api/misc/selectAndUpdateRow.do"]["recNote"]                     # select 로 시작해도 수정 낱말이 있어 조회로 세지 않는다


# ---------------------------------------------------------------- 허락하고 다시 탐색 → 도구 등록 → 실행
@pytest.fixture(scope="module")
def allowed(live, site, blocked):
    st, job = api(live, "POST", f"/discovery/jobs/{blocked['id']}/rerun/", {"allowReads": True})
    assert st == 201, job
    assert job["opts"]["readAuto"] is True and job["opts"]["base"] == blocked["opts"]["base"]
    v = wait_for(live, job["id"], lambda x: x["status"] in DONE)
    assert v["status"] == "review", v["error"]
    return v


def test_다시_탐색은_막은_기록이_있는_탐색만_허락할_수_있다(live, site, blocked, allowed):
    st, msg = api(live, "POST", f"/discovery/jobs/{allowed['id']}/rerun/", {"allowReads": True})                # 이미 허락하고 돈 탐색이라 막은 기록이 없다
    assert st == 400 and "허락할 것이 없습니다" in msg


def test_허락하면_조회형_POST_는_나가고_응답_형식과_헤더_본문까지_도구_파라미터가_된다(allowed, site):
    by = {a["path"]: a for a in allowed["apis"]}
    assert allowed["reads"]["state"] == "allow" and allowed["reads"]["n"] >= 6 and allowed["reads"]["auto"] is True
    a = by[SELECT]
    assert (a["m"], a["mode"], a["ev"], a["verify"]["k"], a["rec"]) == ("POST", "read", "tr", "ok", "yes")
    assert a["tr"]["res"].startswith("HTTP/1.1 200 OK") and "dlRows" in a["tr"]["res"] and "Menu-Info" in a["tr"]["req"]
    by_o = {p["o"]: p for p in a["params"]}
    assert {"dlSrch.srchTy", "dlSrch.bizNm", "dlSrch.fromYmd", "dlSrch.page", "dlSrch.flag"} <= set(by_o)          # 중첩 JSON 본문의 필드가 모두 파라미터다
    assert (by_o["dlSrch.fromYmd"]["a"], by_o["dlSrch.fromYmd"]["rule"]) == ("from_ymd", "date") and by_o["dlSrch.flag"]["at"] == "boolean"
    hdr = by_o["Menu-Info"]
    assert (hdr["loc"], hdr["rule"]) == ("header", "inject") and hdr["v"]                                         # 화면이 늘 보내는 헤더는 AI 에게 보이지 않게 이음이 넣는다
    for p in WRITES:
        assert by[p]["mode"] == "write" and by[p]["verify"]["k"] == "block", p                                 # 허락해도 쓰기는 그대로 막는다


def test_허락해서_보낸_조회는_서버에_쿠키와_헤더를_달고_닿았고_쓰기는_하나도_닿지_않았다(allowed, site):
    _, hits = site
    sent = posts(hits, SELECT)
    assert sent and all(h["cookie"] and h["menu"] for h in sent)
    assert not [h for h in hits if h["path"] in WRITES]


def test_로그인_없이_받은_세션으로_도구를_등록하고_실행한다(live, allowed, site):
    _, hits = site
    ids = [a["id"] for a in allowed["apis"] if a["tool"] and a["rec"] == "yes"]
    assert ids
    st, reg = api(live, "POST", f"/discovery/jobs/{allowed['id']}/register/", {"ids": ids})
    assert st == 201 and reg["loginKnown"] is True
    assert (reg["source"]["authType"], reg["source"]["auth"]) == ("session", "세션 (방문, 로그인 없음)")
    tool = next(a["tool"] for a in allowed["apis"] if a["path"] == SELECT)
    t = next(t for t in reg["tools"] if t["id"] == tool)
    assert t["method"] == "POST" and t["mode"] == "read" and t["exec"] != "confirm"
    before = len(posts(hits, SELECT))
    st, out = api(live, "POST", "/playground/call/", {"tool": tool, "args": {"srch_ty": "0001", "from_ymd": "2026-09-12", "page": 1, "flag": True}})
    assert st == 200 and out["ok"], out
    assert "dlRows" in str(out) and "정상적으로 조회되었습니다" in str(out)                                           # 쿠키가 없으면 403 이었을 응답이다
    called = posts(hits, SELECT)[before:]
    assert len(called) == 1 and called[0]["cookie"] and called[0]["menu"]                                          # 이음이 방문으로 세션을 받고 헤더를 넣었다


# ---------------------------------------------------------------- 탐색 중에 묻고, 답을 기다린다
def test_조회로_보이는_POST_는_탐색을_멈추고_묻고_허락하면_이어서_보낸다(live, site):
    base, hits = site
    st, job = api(live, "POST", "/discovery/jobs/", payload(base, hitl="ambig", wait=300))
    assert st == 201, job
    jid = job["id"]
    v = wait_for(live, jid, lambda x: any(a["kind"] == "readpost" and a["st"] == "wait" for a in (x["hitl"] or {}).get("asks", [])), timeout=90)
    q = next(a for a in v["hitl"]["asks"] if a["kind"] == "readpost")
    assert [o[0] for o in q["opts"]] == ["allow", "keep"] and q["def"] == "keep" and q["kindLabel"] == "조회용 POST"
    assert q["predLabel"] == "막은 요청" and "select" in q["pred"] and "저장" in q["body"] and q["shot"] == 1
    st, pend = api(live, "GET", "/discovery/pending/")
    assert st == 200 and pend["count"] >= 1 and pend["jobs"][0]["kind"] == "조회용 POST"
    assert httpx.get(f"{live}/api/ieum/discovery/jobs/{jid}/qshot/{q['id']}", timeout=10).headers["content-type"] == "image/jpeg"
    time.sleep(2.5)
    assert not [e for e in all_events(live, jid) if e["k"] in ("act", "plan")]                                      # 답을 기다리는 동안 크롤러는 멈춰 있다(막힌 채로 더 보지 않는다)
    st, ans = api(live, "POST", f"/discovery/jobs/{jid}/answer/", {"qid": q["id"], "value": "allow", "by": "시험"})
    assert st == 200 and ans["label"] == "조회로 보이는 POST 도 보내기"
    v = wait_for(live, jid, lambda x: x["status"] in DONE)
    assert v["status"] == "review", v["error"]
    rec = next(a for a in v["hitl"]["asks"] if a["kind"] == "readpost")
    assert (rec["st"], rec["val"], rec["who"]) == ("done", "allow", "human") and v["stats"]["nHuman"] >= 1
    assert v["reads"]["state"] == "allow" and v["reads"]["auto"] is False
    by = {a["path"]: a for a in v["apis"]}
    assert (by[SELECT]["mode"], by[SELECT]["verify"]["k"]) == ("read", "ok")
    assert not [h for h in hits if h["path"] in WRITES]


# ---------------------------------------------------------------- 사람이 직접 조작하는 중에도 알린다
def test_직접_조작_중_조회가_막히면_묻지_않고_설정이어도_사람에게_알린다(site):
    from app.ieum.discovery import options
    from app.ieum.discovery.crawler import Crawler
    from app.ieum.discovery.hitl import Hitl
    from app.ieum.discovery.policy import Policy

    base, hits = site
    h = Hitl(level="never", wait=120)                                  # "묻지 않고" 설정: 탐색 중 질문은 막은 채로 곧바로 정해진다
    c = Crawler(Policy(base=base, ban=BAN, max_pages=3, max_seconds=120, delay_ms=100), base + "/", None, emit=lambda *a, **k: None, on_shot=lambda b: 1,
                cancelled=lambda: False, hitl=h)
    out = {}
    t = threading.Thread(target=lambda: out.setdefault("res", c.run()), daemon=True)
    t.start()
    try:
        deadline = time.time() + 60
        while not c._read_seen and time.time() < deadline:
            time.sleep(0.1)
        assert c._read_seen, "조회형 요청이 막히지 않았다"
        assert h.start_take("시험")
        q = None
        while q is None and time.time() < deadline:
            q = next((a for a in h.pending() if a["kind"] == "readpost"), None)
            time.sleep(0.1)
        assert q is not None and q["st"] == "wait"                      # 직접 조작 중에는 "묻지 않고" 설정이어도 사람 앞이라 묻는다
        n = len(posts(hits, "/fm/fma/fmaa/Pst/selectNtcPstList.do"))
        assert h.answer(q["id"], "allow", "human", "시험")[0]
        time.sleep(1.2)
        assert h.end_take("시험") is not None
    finally:
        h.end_take("시험")
        t.join(timeout=150)
    assert not t.is_alive() and out["res"].error == ""
    assert c.reads_summary()["state"] == "allow"
    assert len(posts(hits, "/fm/fma/fmaa/Pst/selectNtcPstList.do")) > n                                              # 허락한 뒤 돌아온 화면의 조회가 나갔다
    assert not [x for x in hits if x["path"] in WRITES]


# ---------------------------------------------------------------- 어느 탐색에서도
def test_쓰기로_보이는_요청은_어느_탐색에서도_사이트에_닿지_않았다(site):
    _, hits = site
    assert posts(hits), "시험이 사이트를 한 번도 부르지 않았다"
    assert not [h for h in hits if h["path"] in WRITES], [h["path"] for h in hits if h["path"] in WRITES]
