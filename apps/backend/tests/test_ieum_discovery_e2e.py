"""API 자동 탐색 전 구간 시험: 실제 헤드리스 Chrome 으로 시연용 레거시 사이트를 탐색한다.

탐색 한 번이 30초 안팎이라, 같은 탐색 결과를 여러 시험이 나눠 쓴다(모듈 단위 픽스처).
브라우저가 없거나 IEUM_SKIP_BROWSER_TESTS=1 이면 건너뛴다.
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
from app.ieum.demo_legacy.site import DEMO_PASSWORD, DEMO_USER_ID

pytestmark = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"], reason="탐색에 쓸 브라우저가 없다")

BAN = ["삭제", "저장", "승인", "결재", "결제", "확정", "전송"]


@pytest.fixture(scope="module")
def live(tmp_path_factory):
    """이음 라우터만 실은 앱 + 모듈 단위 상태 폴더. 시연용 레거시 사이트도 같은 서버에 들어 있다."""
    from app.ieum.gateway import engine, runner, session_auth
    from app.ieum.routers import demo_legacy, router

    mp = pytest.MonkeyPatch()
    mp.setenv("IEUM_STATE_DIR", str(tmp_path_factory.mktemp("ieum-e2e") / "state"))
    mp.delenv("IEUM_SECRET_KEY", raising=False)
    mp.setattr(runner, "_RATE", {})
    mp.setattr(session_auth, "_CACHE", {})
    demo_legacy.reset()
    app = FastAPI()
    app.include_router(router)
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=0, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    while not server.started:
        time.sleep(0.02)
    port = server.servers[0].sockets[0].getsockname()[1]
    yield f"http://localhost:{port}"          # localhost 로 열어야 시연용 SSO 가 127.0.0.1(다른 출처)로 간다
    jobs.stop(timeout=30)
    server.should_exit = True
    thread.join(timeout=5)
    mp.undo()


def api(base, method, path, body=None):
    r = httpx.request(method, base + "/api/ieum" + path, json=body, timeout=30)
    j = r.json()
    return j["resultCode"], (j["resultData"] if j["resultCode"] < 400 else j["resultMsg"])


def payload(base, **kw):
    return {"crawl": True, "git": False, "approved": True, "owner": "시험", "base": base + "/demo-legacy/po", "start": "/login.do", "account": DEMO_USER_ID, "password": DEMO_PASSWORD,
            "ban": BAN, "maxPages": 20, "delayMs": 50, "exclude": "/logout.do", **kw}


def wait_for(base, job_id, until, timeout=240):
    deadline, v = time.time() + timeout, None
    while time.time() < deadline:
        v = api(base, "GET", f"/discovery/jobs/{job_id}/?after=999999")[1]
        if until(v):
            return v
        time.sleep(0.5)
    raise AssertionError(f"작업이 제때 끝나지 않았습니다: {v and (v['status'], v['act'])}")


def all_events(base, job_id):
    events, after = [], 0
    while True:
        v = api(base, "GET", f"/discovery/jobs/{job_id}/?after={after}")[1]
        events += v["events"]
        after = v["seq"]
        if not v["more"]:
            return events


DONE = ("review", "failed", "cancelled")


@pytest.fixture(scope="module")
def crawl(live):
    """화면 탐색만으로 한 번 탐색한 결과. 여러 시험이 나눠 쓴다."""
    st, job = api(live, "POST", "/discovery/jobs/", payload(live))
    assert st == 201, job
    v = wait_for(live, job["id"], lambda x: x["status"] in DONE)
    assert v["status"] == "review", v["error"]
    return v


@pytest.fixture(scope="module")
def by_path(crawl):
    return {a["path"]: a for a in crawl["apis"]}


# ---------------------------------------------------------------- 탐색 결과
def test_메뉴를_돌며_읽기_API_를_찾고_쓰기_요청은_차단한다(crawl, by_path):
    assert set(by_path) >= {"/poList.do", "/poDetail.do", "/vendList.do", "/itemPrice.do", "/prList.do", "/budgetRemain.do", "/common/codeList.do", "/chart/monthly.do", "/prDraftSave.do"}
    for p in ("/poList.do", "/poDetail.do", "/vendList.do", "/itemPrice.do", "/prList.do", "/budgetRemain.do", "/common/codeList.do", "/chart/monthly.do"):
        a = by_path[p]
        assert (a["m"], a["mode"], a["ev"], a["verify"]["k"], a["rec"]) == ("GET", "read", "tr", "ok", "yes"), p
        assert a["tr"]["req"].startswith(f"GET /demo-legacy/po{p}") and a["tr"]["res"].startswith("HTTP/1.1 200 OK")
    draft = by_path["/prDraftSave.do"]                                   # 화면이 자동으로 보내는 임시저장: 가로채 차단
    assert (draft["m"], draft["mode"], draft["verify"]["k"], draft["tr"]["blocked"], draft["tr"]["res"]) == ("POST", "write", "block", True, "")
    assert "/poSave.do" not in by_path and "/prSubmit.do" not in by_path   # 누르지 않을 단어(저장, 전송)라 아예 누르지 않았다
    assert not any(p in by_path for p in ("/loginProc.do", "/login.do", "/logout.do"))


def test_다른_출처_요청은_범위_밖으로_분류한다(by_path):
    sso = next(a for a in by_path.values() if a["path"].endswith("/sso/userInfo.do"))
    assert (sso["ev"], sso["verify"]["k"], sso["tool"], sso["rec"]) == ("out", "out", None, "no") and sso["tr"]["host"].startswith("http://127.0.0.1:")


def test_안전_통계는_실제로_센_값이다(crawl):
    s = crawl["stats"]
    assert s["pages"] >= 7 and s["requests"] >= 10 and s["blocked"] >= 1 and s["skipped"] >= 2 and s["masked"] > 0
    assert (s["both"], s["src"], s["tr"]) == (0, 0, 9)                    # Git 을 켜지 않았으니 트래픽 근거뿐이다. 읽기 8개와 차단한 쓰기 1개
    assert crawl["stage"] == {"src": "skip", "web": "done", "merge": "done", "verify": "done", "review": "run"} and crawl["browser"] in ("chrome", "chromium", "msedge")


def test_이벤트_스트림과_화면_캡처(live, crawl):
    ev = all_events(live, crawl["id"])
    kinds = {(e["l"], e["k"]) for e in ev}
    assert {("web", "page"), ("web", "act"), ("web", "req"), ("web", "skip"), ("web", "done"), ("vfy", "call"), ("sys", "stage")} <= kinds
    assert [e["seq"] for e in ev] == sorted(e["seq"] for e in ev)
    assert any(e["l"] == "web" and e["k"] == "req" and e["tag"] == "block" and e["p"] == "/prDraftSave.do" for e in ev)
    assert any(e["l"] == "web" and e["k"] == "req" and e["tag"] == "allow" and e["p"] == "/loginProc.do" for e in ev)        # 로그인만 예외로 보냈다
    assert any(e["k"] == "skip" and "저장" in e["msg"] and e.get("hl") for e in ev) and any("목록 첫 행 클릭" == e.get("msg") for e in ev)
    act = next(e for e in ev if e["k"] == "act" and e.get("hl"))
    assert {"x", "y", "w", "h", "vw", "vh"} <= set(act["hl"]) and act["shot"] > 0
    shot = httpx.get(f"{live}/api/ieum/discovery/jobs/{crawl['id']}/shot")
    assert shot.status_code == 200 and shot.headers["content-type"] == "image/jpeg" and shot.content[:2] == b"\xff\xd8" and len(shot.content) > 3000


def test_파라미터와_응답에_변환_규칙을_추정한다(by_path):
    ps = {p["o"]: p for p in by_path["/poList.do"]["params"]}
    assert (ps["fromDt"]["rule"], ps["fromDt"]["ot"]) == ("date", "YYYYMMDD") and ps["X-Requested-With"]["rule"] == "inject"
    res = {r["o"]: r for r in by_path["/poDetail.do"]["res"]}
    assert (res["po.PO_AMT"]["rule"], res["po.PO_YMD"]["rule"], res["po.CHARGER_TEL"]["rule"]) == ("num", "date", "mask")
    assert (res["po.PO_STTS_CD"]["rule"], res["po.PAY_TERM"]["rule"]) == ("code", "code")             # 공통코드 응답에서 코드값 변환표를 만들었다
    assert res["po.PO_STTS_CD"]["av"] == "승인대기" and ["20", "승인대기", "승인대기"] in res["po.PO_STTS_CD"]["codes"]
    assert "010-4821-5678" not in by_path["/poList.do"]["tr"]["res"] and "***-****-5678" in by_path["/poList.do"]["tr"]["res"]


# ---------------------------------------------------------------- 등록, 실행
def test_등록한_도구는_서비스_계정_세션으로_실제_실행된다(live, crawl, by_path):
    ids = [a["id"] for a in crawl["apis"] if a["tool"] and a["rec"] == "yes"]
    assert len(ids) == 8
    st, reg = api(live, "POST", f"/discovery/jobs/{crawl['id']}/register/", {"ids": ids})
    assert st == 201 and reg["loginKnown"] is True
    src = reg["source"]
    assert (src["proto"], src["authType"], src["spec"], src["base"]) == ("disc", "session", "운영 트래픽으로 추론", live + "/demo-legacy/po")
    assert all(t["status"] == "review" and t["guess"] == 1 and t["disc"]["job"] == crawl["id"] for t in reg["tools"])
    assert "password" not in str(reg) and DEMO_PASSWORD not in str(reg)                                  # 계정 정보는 응답에 없다

    st, out = api(live, "POST", "/playground/call/", {"tool": "get_po_list", "args": {"from_dt": "2026-09-01", "to_dt": "2026-09-30"}})
    assert out["ok"], out.get("error")
    first = out["result"]["result_list"][0]
    assert (first["po_no"], first["po_amt"], first["po_ymd"], first["po_stts_cd"]) == ("PO-2609-0142", 4850000, "2026-09-26", "승인대기")
    assert first["charger_tel"] == "***-****-5678"
    sent = out["trace"]["originRequest"]
    assert sent["url"].endswith("/poList.do?fromDt=20260901&toDt=20260930") and sent["headers"]["x-requested-with"] == "XMLHttpRequest" and sent["headers"]["cookie"] == "••••••••"
    detail = api(live, "POST", "/playground/call/", {"tool": "get_po_detail", "args": {"po_no": "PO-2609-0142"}})[1]
    assert detail["ok"] and detail["result"]["po"]["pay_term"] == "30일" and detail["result"]["po"]["items"][0]["item_nm"].startswith("A4")


def test_세션이_끊기면_다시_로그인해서_한_번_더_보낸다(live, crawl):
    from app.ieum.routers import demo_legacy
    api(live, "POST", f"/discovery/jobs/{crawl['id']}/register/", {"ids": [a["id"] for a in crawl["apis"] if a["tool"]]})
    assert api(live, "POST", "/playground/call/", {"tool": "get_vend_list", "args": {}})[1]["ok"]
    demo_legacy.reset()                                                   # 서버 쪽 세션이 모두 사라진다. 원본은 로그인 화면으로 302 한다
    out = api(live, "POST", "/playground/call/", {"tool": "get_vend_list", "args": {"vend_nm": "한빛"}})[1]
    assert out["ok"] and [v["vend_nm"] for v in out["result"]["result_list"]] == ["한빛상사", "한빛정보통신"]


def test_로그인_계정을_바꿔_다시_인증할_수_있다(live, crawl):
    sid = api(live, "GET", f"/discovery/jobs/{crawl['id']}/")[1]["sourceId"]
    assert api(live, "POST", f"/sources/{sid}/reauth/", {"auth": {"type": "session", "username": DEMO_USER_ID, "password": "wrong"}})[0] == 200
    out = api(live, "POST", "/playground/call/", {"tool": "get_vend_list", "args": {}})[1]
    assert out["ok"] is False and "로그인" in out["error"]
    assert api(live, "POST", f"/sources/{sid}/reauth/", {"auth": {"type": "session", "username": DEMO_USER_ID, "password": DEMO_PASSWORD}})[0] == 200
    assert api(live, "POST", "/playground/call/", {"tool": "get_vend_list", "args": {}})[1]["ok"]


# ---------------------------------------------------------------- 안전, 실패, 취소
def test_누르지_않을_단어를_모두_빼도_쓰기는_운영에_닿지_않는다(live, crawl):
    """금지어 목록을 비우면 저장·전송 버튼까지 누른다. 그래도 쓰기는 네트워크에서 가로채 운영에 가지 않아야 한다."""
    from app.ieum.gateway import session_auth
    base = live + "/demo-legacy/po"
    recipe = session_auth.discover_recipe(base + "/login.do", lambda u: u.replace(base, ""))
    login = lambda: session_auth.login(base, {"recipe": recipe, "username": DEMO_USER_ID, "password": DEMO_PASSWORD})
    po_total = lambda: httpx.get(base + "/poList.do", params={"fromDt": "20200101", "toDt": "20991231"}, headers={"X-Requested-With": "XMLHttpRequest", "Cookie": "JSESSIONID=" + login()["JSESSIONID"]}).json()["totalCnt"]
    before = po_total()
    st, job = api(live, "POST", "/discovery/jobs/", payload(live, ban=[], name="금지어 없음"))
    assert st == 201, job
    v = wait_for(live, job["id"], lambda x: x["status"] in DONE)
    by = {a["path"]: a for a in v["apis"]}
    assert v["status"] == "review" and v["stats"]["blocked"] >= 2
    assert {"/poSave.do", "/prSubmit.do"} <= set(by) and all(by[p]["verify"]["k"] == "block" and by[p]["tr"]["blocked"] for p in ("/poSave.do", "/prSubmit.do"))
    assert po_total() == before                                           # 저장 요청이 브라우저에서 나갔지만 운영에는 닿지 않았다
    st, reg = api(live, "POST", f"/discovery/jobs/{job['id']}/register/", {"ids": [by["/poSave.do"]["id"]]})
    assert st == 201 and reg["added"] == 1                                                      # 쓰기 도구도 후보로 등록은 된다
    save = next(t for t in reg["tools"] if t["id"].startswith("po_save"))
    assert (save["mode"], save["exec"]) == ("write", "confirm")                                  # 실행 전 사용자 확인이 기본이다
    assert len(reg["tools"]) > 1                                                                 # 앞서 등록한 읽기 도구는 그대로 남아 있다(같은 운영 주소의 원본에 합친다)


def test_로그인_정보가_틀리면_이유와_함께_실패한다(live, crawl):
    st, job = api(live, "POST", "/discovery/jobs/", payload(live, password="wrong"))
    v = wait_for(live, job["id"], lambda x: x["status"] in DONE)
    assert v["status"] == "failed" and "로그인하지 못했습니다" in v["error"] and v["stage"]["web"] == "fail"


def test_돌고_있는_탐색을_취소하면_브라우저를_닫고_멈춘다(live, crawl):
    st, job = api(live, "POST", "/discovery/jobs/", payload(live, delayMs=800))
    wait_for(live, job["id"], lambda x: x["stats"].get("pages", 0) >= 2 and x["status"] == "running")
    assert api(live, "POST", "/discovery/jobs/", payload(live))[0] == 400                    # 한 번에 하나만 돌린다
    assert api(live, "POST", f"/discovery/jobs/{job['id']}/cancel/")[0] == 200
    v = wait_for(live, job["id"], lambda x: x["status"] in DONE, timeout=60)
    assert v["status"] == "cancelled" and "apis" not in v
    jobs.get(job["id"]).thread.join(15)                                       # 상태가 바뀐 직후라 스레드가 마지막 정리를 마치는 시간을 준다
    assert not jobs.get(job["id"]).thread.is_alive()


def test_같은_설정으로_다시_탐색한다(live, crawl):
    st, again = api(live, "POST", f"/discovery/jobs/{crawl['id']}/rerun/")
    assert st == 201 and again["id"] != crawl["id"] and again["opts"]["base"] == crawl["opts"]["base"]
    v = wait_for(live, again["id"], lambda x: x["status"] in DONE)
    assert v["status"] == "review" and len(v["apis"]) >= 9
    assert api(live, "DELETE", f"/discovery/jobs/{again['id']}/")[0] == 200 and api(live, "GET", f"/discovery/jobs/{again['id']}/")[0] == 404


# ---------------------------------------------------------------- Git 소스 + 화면 탐색
def po_total(base, env):
    """시연 사이트(운영 po, 스테이징 po-stg)의 발주 건수. 쓰기가 어디에 닿았는지 직접 로그인해 센다."""
    from app.ieum.gateway import session_auth
    site = f"{base}/demo-legacy/{env}"
    recipe = session_auth.discover_recipe(site + "/login.do", lambda u: u.replace(site, ""))
    cookies = session_auth.login(site, {"recipe": recipe, "username": DEMO_USER_ID, "password": DEMO_PASSWORD})
    r = httpx.get(site + "/poList.do", params={"fromDt": "20200101", "toDt": "20991231"}, headers={"X-Requested-With": "XMLHttpRequest", "Cookie": "JSESSIONID=" + cookies["JSESSIONID"]})
    return r.json()["totalCnt"]


def demo_repo():
    from app.ieum.discovery import repo
    return str(repo.DEMO_ROOT / "po-web")


def test_Git_소스와_화면_탐색을_교차_확인하고_스테이징에서만_쓰기를_검증한다(live, crawl):
    op_before, stg_before = po_total(live, "po"), po_total(live, "po-stg")
    st, job = api(live, "POST", "/discovery/jobs/", payload(live, git=True, repo=demo_repo(), stg=True, stgUrl=live + "/demo-legacy/po-stg", name="전체 탐색"))
    assert st == 201, job
    v = wait_for(live, job["id"], lambda x: x["status"] in DONE, timeout=300)
    assert v["status"] == "review", v["error"]
    by = {a["path"]: a for a in v["apis"]}
    ev = {p: a["ev"] for p, a in by.items() if a["ev"] != "out"}

    for p in ("/poList.do", "/poDetail.do", "/vendList.do", "/itemPrice.do", "/prList.do", "/budgetRemain.do"):
        assert ev[p] == "both", p                                         # 화면이 부르고 소스로도 확인한 API
    assert {p: ev[p] for p in ("/poSave.do", "/poApprove.do", "/poExcelDown.do", "/oldPoList.do", "/prSubmit.do")} == dict.fromkeys(("/poSave.do", "/poApprove.do", "/poExcelDown.do", "/oldPoList.do", "/prSubmit.do"), "src")
    assert (ev["/common/codeList.do"], ev["/chart/monthly.do"]) == ("tr", "tr")                          # 공통 모듈이라 저장소에 소스가 없다
    assert not any("loginProc" in p or "login.do" in p for p in by)                                       # 로그인은 도구가 아니다
    assert v["stats"]["both"] >= 6 and v["stats"]["src"] >= 4 and v["stats"]["tr"] == 2 and v["stats"]["controllers"] == 6

    # 소스 근거
    src = by["/poList.do"]["src"]
    assert src["file"].endswith("PoController.java") and (src["mapper"], src["sql"], src["fn"]) == ("PoMapper.selectPoList", "SELECT", "poList")     # 컨트롤러 poList → 서비스 → 매퍼 selectPoList
    assert "@RequestMapping" in src["snippet"] and "poList" in src["snippet"] and by["/poList.do"]["tr"] and by["/poList.do"]["mode"] == "read"
    assert {p["o"] for p in by["/poList.do"]["params"] if p["loc"] == "query"} >= {"fromDt", "toDt", "vendCd", "sttsCd"}
    assert by["/poSave.do"]["mode"] == "write" and by["/poSave.do"]["src"]["sql"] == "INSERT" and by["/poSave.do"]["tr"] is None

    # 검증: 운영에는 읽기만, 쓰기는 스테이징에서만
    assert (by["/poExcelDown.do"]["verify"]["k"], by["/oldPoList.do"]["verify"]["k"]) == ("file", "404")
    assert (by["/poSave.do"]["verify"]["k"], by["/poApprove.do"]["verify"]["k"]) == ("stg", "stgerr")      # 저장은 되고, 없는 발주 승인은 실패
    assert by["/poSave.do"]["rec"] == "yes" and by["/poApprove.do"]["rec"] == "check" and by["/poSave.do"]["tool"] == "po_save"
    for p in ("/poExcelDown.do", "/oldPoList.do"):
        assert by[p]["tool"] is None and by[p]["rec"] == "no", p
    assert po_total(live, "po") == op_before                                                              # 운영에는 아무것도 쓰이지 않았다
    assert po_total(live, "po-stg") > stg_before                                                          # 스테이징에는 시험 발주가 생겼다
    assert v["stats"]["stgVerified"] >= 3

    # 이벤트
    ev_all = all_events(live, job["id"])
    git = [e for e in ev_all if e["l"] == "git"]
    stages = {e["msg"]: e["det"] for e in git if e["k"] == "stage"}
    assert "po-web" in stages["소스 디렉터리 읽기"] and "전자정부 표준프레임워크 3.10" in stages["프레임워크 감지"] and "SELECT" in stages["매퍼로 읽기, 쓰기 분류"]
    files = {e["f"]: e for e in git if e["k"] == "file"}
    assert set(files) == {"PoController.java", "VendController.java", "ItemController.java", "PrController.java", "BudgetController.java", "LoginController.java"}
    assert "화면 이동 매핑 3개 제외" in files["PoController.java"]["note"] and "@Deprecated 1개" in files["PoController.java"]["note"]
    assert {"m": "GET", "path": "/oldPoList.do", "dep": True} in [{"m": a["m"] or "GET", "path": a["path"], "dep": a["dep"]} for a in files["PoController.java"]["apis"]] or any(a["dep"] for a in files["PoController.java"]["apis"])
    assert v["framework"].startswith("전자정부 표준프레임워크 3.10") and v["files"] > 30 and any(e["l"] == "vfy" and e.get("env") == "stg" for e in ev_all)

    # 등록: 근거가 둘이면 스펙 라벨도 둘을 말한다
    ids = [a["id"] for a in v["apis"] if a["tool"] and a["rec"] == "yes"]
    st, reg = api(live, "POST", f"/discovery/jobs/{job['id']}/register/", {"ids": ids})
    assert st == 201 and reg["source"]["spec"] == "Git 소스와 운영 트래픽으로 추론"
    ids_out = [t["id"] for t in reg["tools"]]                                                      # 앞 시험이 같은 이름을 이미 등록했을 수 있어 접미사가 붙는다
    assert any(i.startswith("get_po_list") for i in ids_out) and next(t for t in reg["tools"] if t["id"].startswith("po_save"))["exec"] == "confirm"


def test_Git_소스만_분석해도_로그인해서_읽기를_검증한다(live, crawl):
    st, job = api(live, "POST", "/discovery/jobs/", payload(live, crawl=False, git=True, repo=demo_repo(), stg=False, name="소스만"))
    assert st == 201, job
    v = wait_for(live, job["id"], lambda x: x["status"] in DONE, timeout=120)
    assert v["status"] == "review", v["error"]
    assert v["stage"]["web"] == "skip" and v["stage"]["src"] == "done" and v["browser"] == ""
    by = {a["path"]: a for a in v["apis"]}
    assert {a["ev"] for a in v["apis"]} == {"src"} and not any(a["tr"] for a in v["apis"])
    assert (by["/poList.do"]["verify"]["k"], by["/vendList.do"]["verify"]["k"], by["/poExcelDown.do"]["verify"]["k"], by["/oldPoList.do"]["verify"]["k"]) == ("ok", "ok", "file", "404")
    assert by["/poDetail.do"]["verify"]["k"] == "none" and "필수 파라미터" in by["/poDetail.do"]["verify"]["note"]     # 필수 값을 몰라 호출하지 않는다
    assert (by["/poSave.do"]["verify"]["k"], by["/poApprove.do"]["verify"]["k"]) == ("none", "none")                  # 스테이징을 지정하지 않으면 쓰기는 호출하지 않는다
    assert by["/poList.do"]["res"] and by["/poList.do"]["tr"] is None                                                  # 응답 형식은 검증 호출의 응답에서 얻었다
    assert v["stats"]["blocked"] == 0 and v["stats"]["requests"] == 0


def test_같은_시스템을_다시_등록하면_기존_도구를_건드리지_않는다(live, crawl):
    ids = [a["id"] for a in crawl["apis"] if a["tool"] and a["rec"] == "yes"]
    st, first = api(live, "POST", f"/discovery/jobs/{crawl['id']}/register/", {"ids": ids})
    sid = first["source"]["id"]
    edited = next(t for t in first["tools"] if t["disc"]["id"] in ids)
    api(live, "PUT", f"/studio/{edited['id']}/", {"status": "done", "desc": "사람이 고친 설명"})          # 스튜디오에서 다듬고 공개
    st, again = api(live, "POST", f"/discovery/jobs/{crawl['id']}/register/", {"ids": ids})
    assert st == 201 and again["source"]["id"] == sid and again["added"] == 0                       # 이미 등록된 API 는 더하지 않는다
    kept = next(t for t in again["tools"] if t["id"] == edited["id"])
    assert (kept["status"], kept["desc"]) == ("done", "사람이 고친 설명")                               # 다시 등록해도 고친 것을 잃지 않는다
    assert len({t["id"] for t in again["tools"]}) == len(again["tools"])
    # 같은 운영 주소로 탐색한 작업은 모두 같은 원본 시스템에 합쳐진다
    assert len([s for s in api(live, "GET", "/sources/")[1]["sources"] if s["proto"] == "disc" and s["base"] == crawl["opts"]["base"]]) == 1
