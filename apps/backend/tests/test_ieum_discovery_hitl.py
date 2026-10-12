"""사람과 함께 탐색하기 전 구간 시험: 실제 헤드리스 Chrome 으로 시연 사이트를 탐색하며 계획, 질문, 지시, 직접 조작, 시간 초과를 겪는다.

시연 사이트에는 이 일을 위한 장치가 있다. 마감 처리 버튼(상태를 바꾸지만 누르지 않을 단어는 아니다), 거래처명이 비어 있으면 알림창을
띄우는 찾기 버튼, 승인 권한이 없는 계정에게 403 을 주는 발주 승인 화면. 탐색 한 번이 30초 안팎이라 시험마다 한 번씩만 돌린다.

시험이 지키는 것: 사람이 눌러도 된다고 한 버튼도, 사람이 직접 조작한 승인도 **운영에는 닿지 않는다.** 서버 쪽 데이터로 확인한다.
실제 모델은 부르지 않는다(계획과 용도는 규칙으로 정한다).
"""
import os
import time

import httpx
import pytest

from app.ieum.demo_legacy.site import DEMO_APPROVER_ID, DEMO_PASSWORD, DEMO_USER_ID
from app.ieum.discovery import browser as browser_mod
from app.ieum.discovery import jobs
from app.ieum.discovery.browser import capabilities
from app.ieum.discovery.crawler import VIEWPORT
from app.ieum.gateway import llm, session_auth
from tests.test_ieum_discovery_e2e import DONE, all_events, api, demo_repo, live, payload, po_total, wait_for  # noqa: F401  (live 는 픽스처다)

pytestmark = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"], reason="탐색에 쓸 브라우저가 없다")

PURPOSE = "구매팀 업무를 AI 비서로 조회하고 처리"
QUES = ["우리 팀 구매요청 승인됐어?", "이번 달 한빛상사 발주 금액 얼마야?", "구매팀 올해 예산 얼마 남았어?", "A4 용지 한빛상사 단가 얼마야?"]


@pytest.fixture(scope="module", autouse=True)
def offline_ai():
    mp = pytest.MonkeyPatch()
    mp.setattr(llm, "provider", lambda: None)               # 실제 모델을 부르지 않는다
    yield
    mp.undo()


# ---------------------------------------------------------------- 도우미
def start(live, **kw):
    st, job = api(live, "POST", "/discovery/jobs/", payload(live, purpose=PURPOSE, ques=QUES, exclude="/logout.do, /admin/*", **kw))
    assert st == 201, job
    return job["id"]


def view(live, jid):
    return api(live, "GET", f"/discovery/jobs/{jid}/?after=999999")[1]


def tell(live, jid, what, body=None):
    return api(live, "POST", f"/discovery/jobs/{jid}/{what}/", body or {})


def drive(live, jid, answers, *, timeout=240, on_take=None, each=None):
    """질문이 카드로 뜰 때마다 answers[종류] 로 답한다(함수면 질문을 넘겨 답을 받는다). 탐색이 끝날 때까지 돈다."""
    given, deadline, v = set(), time.time() + timeout, None
    while time.time() < deadline:
        v = view(live, jid)
        h = v["hitl"]
        q = next((a for a in h["asks"] if a["id"] == h["active"] and a["st"] == "wait"), None)
        if q and q["id"] not in given and q["kind"] in answers:
            given.add(q["id"])
            a = answers[q["kind"]]
            a = a(q) if callable(a) else a
            st, out = tell(live, jid, "answer", {"qid": q["id"], "value": a, "by": "시험"})
            assert st == 200, out
            if q["kind"] == "perm" and a == "take" and on_take:
                on_take()
        if each:
            each(v)
        if v["status"] in DONE:
            return v
        time.sleep(0.4)
    raise AssertionError(f"탐색이 제때 끝나지 않았습니다: {v and (v['status'], v['act'], v['hitl']['active'])}")


def centers(base):
    """화면 좌표: 크롤러와 같은 크기의 브라우저로 같은 화면을 열어 요소의 중심을 구한다(직접 조작은 좌표로만 한다)."""
    from playwright.sync_api import sync_playwright
    po, out = base + "/demo-legacy/po", {}
    with sync_playwright() as pw:
        browser, _ = browser_mod.launch(pw)
        try:
            page = browser.new_context(viewport=VIEWPORT, locale="ko-KR").new_page()

            def mid(sel):
                b = page.locator(sel).first.bounding_box()
                return [round(b["x"] + b["width"] / 2), round(b["y"] + b["height"] / 2)]

            page.goto(po + "/login.do")
            out["id"], out["pw"], out["login"] = mid("#userId"), mid("#userPw"), mid("#btnLogin")
            page.fill("#userId", DEMO_APPROVER_ID)
            page.fill("#userPw", DEMO_PASSWORD)
            page.click("#btnLogin")
            page.wait_for_load_state("domcontentloaded")
            out["menu"] = mid('#menu a[href="poAprvView.do"]')
            page.click('#menu a[href="poAprvView.do"]')
            page.wait_for_selector("#aprvTable button")
            out["approve"] = mid("#aprvTable button")
        finally:
            browser.close()
    return out


def human_approves(live, jid, pos):
    """권한 있는 사람이 화면을 직접 조작한다: 자기 계정으로 로그인하고, 발주 승인 메뉴에서 승인 버튼을 누른다."""
    wait_for(live, jid, lambda x: x["hitl"]["take"] is not None, timeout=60)
    time.sleep(2.0)                                                               # 로그인 화면이 뜰 시간
    steps = [("click", pos["id"]), ("type", DEMO_APPROVER_ID), ("click", pos["pw"]), ("type", DEMO_PASSWORD), ("click", pos["login"]), ("click", pos["menu"]), ("click", pos["approve"])]
    for op, arg in steps:
        body = {"op": "type", "text": arg} if op == "type" else {"op": "click", "x": arg[0], "y": arg[1]}
        st, out = tell(live, jid, "take", dict(body, by="구매팀장"))
        assert st == 200, out
        wait_for(live, jid, lambda x: x["hitl"]["take"] is None or x["hitl"]["take"]["queue"] == 0, timeout=30)       # 크롤러가 이 입력을 받아 갈 때까지
        time.sleep(2.6 if op == "click" else 1.0)                                  # 화면이 바뀌는 시간
    st, out = tell(live, jid, "take", {"op": "end", "by": "구매팀장"})
    assert st == 200 and out["steps"] == len(steps), out


def closed_prs(live):
    """운영 시연 사이트에서 마감된 구매요청. 마감 요청이 운영에 닿았다면 여기에 나온다."""
    site = live + "/demo-legacy/po"
    recipe = session_auth.discover_recipe(site + "/login.do", lambda u: u.replace(site, ""))
    cookies = session_auth.login(site, {"recipe": recipe, "username": DEMO_USER_ID, "password": DEMO_PASSWORD})
    rows = httpx.get(site + "/prList.do", headers={"X-Requested-With": "XMLHttpRequest", "Cookie": "JSESSIONID=" + cookies["JSESSIONID"]}).json()["resultList"]
    return [r["PR_NO"] for r in rows if r["PR_STTS_CD"] == "40"]


def pending_pos(live):
    site = live + "/demo-legacy/po"
    recipe = session_auth.discover_recipe(site + "/login.do", lambda u: u.replace(site, ""))
    cookies = session_auth.login(site, {"recipe": recipe, "username": DEMO_USER_ID, "password": DEMO_PASSWORD})
    r = httpx.get(site + "/poList.do", params={"fromDt": "20200101", "toDt": "20991231", "sttsCd": "20"}, headers={"X-Requested-With": "XMLHttpRequest", "Cookie": "JSESSIONID=" + cookies["JSESSIONID"]})
    return r.json()["totalCnt"]


def by_path(v):
    return {a["path"]: a for a in v["apis"]}


# ---------------------------------------------------------------- 묻지 않고 건너뛰기
@pytest.fixture(scope="module")
def never(live):
    before = (po_total(live, "po"), pending_pos(live))
    v = drive(live, start(live, hitl="never"), {})
    assert v["status"] == "review", v["error"]
    return v, before


def test_목적에_맞춰_메뉴_순서를_정하고_제외_경로는_계획에_건너뜀으로_보인다(never):
    v, _ = never
    plan = v["hitl"]["plan"]
    items = {p["name"]: p for p in plan["items"]}
    assert plan["ready"] and plan["by"] == "rule"
    assert set(items) == {"발주 현황", "발주 등록", "발주 승인", "구매요청", "거래처 관리", "통계", "시스템 관리"}          # 지금 보는 '메인'은 계획에 없다
    assert [items[n]["rel"] for n in ("발주 현황", "발주 등록", "발주 승인", "구매요청")] == ["high"] * 4
    assert (items["거래처 관리"]["rel"], items["통계"]["rel"]) == ("low", "low")                                         # 질문과 이름이 겹치지 않는다
    assert (items["시스템 관리"]["rel"], items["시스템 관리"]["st"], items["시스템 관리"]["why"]) == ("excl", "skip", "제외 경로")
    order = [p["name"] for p in plan["items"] if p["rel"] != "excl"]
    assert order.index("거래처 관리") > order.index("구매요청") and order.index("통계") > order.index("발주 승인")        # 관련 높은 것부터
    assert items["발주 현황"]["qa"] == [1] and items["구매요청"]["qa"] == [0]                                            # 메뉴가 답하는 질문
    assert [items[n]["st"] for n in ("발주 현황", "발주 등록", "구매요청")] == ["done"] * 3


def test_묻지_않는_탐색은_안전한_쪽으로_처리하고_그렇게_기록한다(live, never):
    v, _ = never
    asks = {a["kind"]: a for a in v["hitl"]["asks"]}
    assert {"risky", "perm", "input", "low"} <= set(asks)
    assert all(a["st"] == "done" and a["who"] == "never" for a in v["hitl"]["asks"])
    assert (asks["risky"]["val"], asks["perm"]["val"], asks["low"]["val"]) == ("skip", "skip", "skip")
    assert asks["input"]["val"] == "한빛상사" and "한빛상사" in asks["input"]["label"]                                   # 질문 예시에 나온 이름으로 넣는다
    assert asks["risky"]["title"] == "'마감 처리' 버튼을 눌러도 될까요?" and asks["perm"]["title"] == "'발주 승인' 화면이 열리지 않아요"
    assert len([a for a in v["hitl"]["asks"] if a["kind"] == "low"]) == 2 and v["hitl"]["counts"] == {"human": 0, "auto": len(v["hitl"]["asks"]), "take": 0, "pending": 0}
    ev = all_events(live, v["id"])
    assert any(e["k"] == "auto" and "묻지 않고 처리: '마감 처리' 버튼 건너뛰기" in e["msg"] for e in ev)
    assert [e["kind"] for e in ev if e["k"] == "ask"].count("low") == 2
    assert (v["stats"]["nHuman"], v["stats"]["nAuto"], v["stats"]["nTake"]) == (0, len(v["hitl"]["asks"]), 0)


def test_눌러도_되는지_모르는_버튼과_권한이_없는_화면은_누르지도_열지도_않는다(live, never):
    v, (po_before, pending_before) = never
    by = by_path(v)
    assert "/prClose.do" not in by and "/poApprove.do" not in by                                                      # 마감 처리는 건너뛰었고, 승인 화면은 열리지 않았다
    assert closed_prs(live) == [] and po_total(live, "po") == po_before and pending_pos(live) == pending_before


def test_입력값이_필요한_화면은_질문에_나온_이름으로_다시_돌아와_처리한다(never):
    v, _ = never
    vend = by_path(v)["/vendList.do"]                                                                                # 거래처 관리 메뉴는 건너뛰었으니 이 API 는 값을 넣어서만 보인다
    assert vend["human"] is True and vend["mode"] == "read" and "vendNm=한빛상사" in vend["tr"]["req"]
    assert vend["use"] == "발주 등록 찾기 조회" and vend["qa"] == [1]                                                  # 발주 등록 메뉴에서 찾은 API 라 그 메뉴가 답하는 질문을 이어받는다


def test_탐색이_끝나면_API_마다_용도와_이어지는_질문이_붙는다(live, never):
    v, _ = never
    by = by_path(v)
    assert (by["/poList.do"]["use"], by["/poList.do"]["qa"], by["/poList.do"]["useBy"], by["/poList.do"]["key"]) == ("발주 현황 조회", [1], "rule", "GET /poList")
    assert by["/prList.do"]["qa"] == [0] and by["/budgetRemain.do"]["use"]
    assert by["/common/codeList.do"]["qa"] == []                                                                      # 여러 메뉴에서 불린 공통 API 는 어느 질문의 답도 아니다
    assert by["/prDraftSave.do"]["qa"] == [0] and by["/prDraftSave.do"]["mode"] == "write"                          # 쓰기는 이름이 겹친다고 잇지 않고 메뉴의 질문만 잇는다
    assert any(e["k"] == "note" and "낱말이 겹치는 정도로 추정했습니다" in e["msg"] for e in all_events(live, v["id"]))        # 규칙으로 정했다고 밝힌다


# ---------------------------------------------------------------- 사람이 답하고, 지시하고, 직접 조작한다
@pytest.fixture(scope="module")
def human(live):
    pos = centers(live)
    before = (po_total(live, "po"), pending_pos(live))
    jid = start(live, hitl="ambig", wait=120)
    v = wait_for(live, jid, lambda x: x["hitl"]["plan"]["ready"], timeout=120)
    proof = {}

    # 지시: 말로 계획을 바꾼다. 해석한 만큼만 반영하고 그렇다고 알려 준다
    st, r = tell(live, jid, "command", {"text": "통계는 보지 마", "by": "시험"})
    assert st == 200 and (r["op"], r["ok"]) == ("skip", True) and "통계" in r["msg"], r
    st, r = tell(live, jid, "command", {"text": "거래처 관리도 탐색해 줘", "by": "시험"})
    assert st == 200 and (r["op"], r["ok"]) == ("incl", True), r
    st, r = tell(live, jid, "command", {"text": "시스템 관리는 탐색해 줘", "by": "시험"})
    assert st == 200 and (r["op"], r["ok"]) == ("incl", False) and "제외 경로" in r["msg"], r                         # 제외 경로는 말로 풀 수 없다
    st, r = tell(live, jid, "command", {"text": "잘 부탁해요", "by": "시험"})
    assert st == 200 and (r["op"], r["ok"]) == ("memo", True) and "메모" in r["msg"], r                              # 못 알아들은 말은 반영한 척하지 않는다
    assert tell(live, jid, "command", {"text": "   "})[1]["ok"] is False

    # 일시정지: 크롤러가 쉬는 동안 새 화면, 요청이 늘지 않는다
    assert tell(live, jid, "pause", {"paused": True, "by": "시험"})[1] == {"paused": True}
    time.sleep(3.0)                                                               # 하던 동작을 마칠 시간
    n1 = len([e for e in all_events(live, jid) if e["l"] == "web" and e["k"] in ("page", "act", "req")])
    time.sleep(3.0)
    n2 = len([e for e in all_events(live, jid) if e["l"] == "web" and e["k"] in ("page", "act", "req")])
    proof["paused_idle"] = (n1, n2, view(live, jid)["hitl"]["paused"])
    assert tell(live, jid, "pause", {"paused": False})[1] == {"paused": False}

    v = drive(live, jid, {"input": "한빛상사", "risky": "press", "perm": "take", "low": "skip"}, on_take=lambda: human_approves(live, jid, pos))
    assert v["status"] == "review", v["error"]
    return v, before, proof


def test_말로_한_지시가_계획에_반영된다(live, human):
    v, _, _ = human
    items = {p["name"]: p for p in v["hitl"]["plan"]["items"]}
    assert (items["통계"]["st"], items["통계"]["hum"]) == ("skip", True)                                                 # 보지 말라고 해서 열지 않았다
    assert (items["거래처 관리"]["st"], items["거래처 관리"]["hum"]) == ("done", True)                                    # 관련이 낮아도 탐색하라고 해서 열었다
    assert items["시스템 관리"]["st"] == "skip" and not items["시스템 관리"]["hum"]
    assert not [a for a in v["hitl"]["asks"] if a["kind"] == "low"]                                                   # 이미 정한 메뉴는 다시 묻지 않는다
    log = [e["msg"] for e in all_events(live, v["id"]) if e["k"] == "human"]
    assert any("지시: '통계' 메뉴 건너뛰기" in m for m in log) and any("지시: \"잘 부탁해요\" (메모로 남김)" in m for m in log)


def test_일시정지하면_크롤러가_쉰다(human):
    _, _, proof = human
    n1, n2, paused = proof["paused_idle"]
    assert paused is True and n1 == n2


def test_눌러도_된다고_하면_눌러_보되_요청은_운영에_보내지_않는다(live, human):
    v, (po_before, pending_before), _ = human
    close = by_path(v)["/prClose.do"]
    assert (close["m"], close["mode"], close["verify"]["k"], close["rec"]) == ("POST", "write", "block", "check")
    assert close["human"] is True and close["tr"]["blocked"] is True and close["tr"]["res"] == "" and "사람이 보여 주거나 허락해서" in close["recNote"]
    assert any(e["l"] == "web" and e["k"] == "act" and e.get("human") and "(사람이 허락함)" in e["msg"] for e in all_events(live, v["id"]))
    assert closed_prs(live) == []                                                                                   # 마감 요청은 브라우저에서 나갔지만 운영에는 닿지 않았다


def test_권한_있는_사람이_직접_조작하면_그_경로와_요청_형식을_기록한다(live, human):
    v, (po_before, pending_before), _ = human
    approve = by_path(v)["/poApprove.do"]
    assert (approve["m"], approve["mode"], approve["human"], approve["tr"]["blocked"]) == ("POST", "write", True, True)
    assert approve["tr"]["req"].startswith("POST /demo-legacy/po/poApprove.do") and "poNo=" in approve["tr"]["req"]
    ev = all_events(live, v["id"])
    assert any(e["l"] == "web" and e["k"] == "req" and e["tag"] == "allow" and e.get("human") and e["p"].endswith("/loginProc.do") for e in ev)          # 풀어 준 것은 로그인뿐이다
    assert any(e["k"] == "req" and e["tag"] == "block" and e["p"] == "/poApprove.do" and e.get("human") for e in ev)
    assert any(e["k"] == "page" and e.get("human") and "승인 대기 발주" in e["msg"] for e in ev)
    assert pending_pos(live) == pending_before and po_total(live, "po") == po_before                               # 승인은 운영에 닿지 않았다
    plan = {p["name"]: p for p in v["hitl"]["plan"]["items"]}["발주 승인"]
    assert (plan["st"], plan["hum"]) == ("done", True)


def test_사람이_직접_조작한_뒤에는_테스트_계정_세션으로_돌아와_이어서_탐색한다(live, human):
    v, _, _ = human
    ev = all_events(live, v["id"])
    after = ev[next(i for i, e in enumerate(ev) if e["k"] == "human" and "직접 조작을 마쳤습니다" in e["msg"]):]
    assert any(e["k"] == "page" and "구매요청" in e["msg"] for e in after) and any(e["k"] == "req" and e["tag"] == "cap" and e["p"].startswith("/budgetRemain.do") for e in after)
    assert v["stage"]["web"] == "done" and not any(e["k"] == "skip" and "세션이 끊겨" in e["msg"] for e in ev)       # 로그아웃되지 않았다
    assert (v["hitl"]["counts"]["take"], v["stats"]["nTake"]) == (1, 1) and v["hitl"]["counts"]["human"] >= 7


def test_사람이_답한_것은_사람_확인으로_표시되고_크롤러가_혼자_본_것은_아니다(human):
    v, _, _ = human
    by = by_path(v)
    assert by["/prClose.do"]["human"] and by["/poApprove.do"]["human"]
    assert not by["/poList.do"]["human"] and not by["/vendList.do"]["human"]                                          # 거래처 관리를 열어서 크롤러가 혼자서도 본 API


def test_용도를_기입하면_결과와_등록한_도구_설명에_그대로_쓰인다(live, human):
    v, _, _ = human
    jid = v["id"]
    assert tell(live, jid, "purpose", {"key": "GET /poList", "use": "", "qa": []})[0] == 400
    assert tell(live, jid, "purpose", {"key": "poList", "use": "x", "qa": []})[0] == 400                              # 어떤 API 인지 알 수 없다
    st, rec = tell(live, jid, "purpose", {"key": "GET /poList", "use": "발주 금액 조회", "qa": [1, 3, 99], "by": "시험", "label": "GET /poList.do"})
    assert st == 200 and (rec["use"], rec["qa"], rec["key"]) == ("발주 금액 조회", [1, 3], "GET /poList")              # 없는 질문 번호는 버린다
    v2 = view(live, jid)
    po = by_path(v2)["/poList.do"]
    assert (po["use"], po["qa"], po["useBy"]) == ("발주 금액 조회", [1, 3], "human")
    assert v2["hitl"]["counts"]["human"] == v["hitl"]["counts"]["human"] + 1
    ids = [a["id"] for a in v2["apis"] if a["tool"] and a["rec"] == "yes"] + [by_path(v2)["/poApprove.do"]["id"]]
    st, reg = api(live, "POST", f"/discovery/jobs/{jid}/register/", {"ids": ids})
    assert st == 201
    tool = next(t for t in reg["tools"] if t["id"].startswith("get_po_list"))
    assert QUES[1] in tool["desc"] and QUES[3] in tool["desc"] and tool["desc"].endswith("같은 질문에 답할 때 씁니다.")
    assert (tool["disc"]["use"], tool["disc"]["qa"]) == ("발주 금액 조회", [1, 3])
    approve = next(t for t in reg["tools"] if t["id"].startswith("po_approve"))
    assert (approve["mode"], approve["exec"], approve["disc"]["human"]) == ("write", "confirm", True)               # 사람이 보여준 쓰기 도구도 실행 전 확인이 기본이다


# ---------------------------------------------------------------- 답이 없으면
def test_답이_없으면_정해진_시간_뒤_안전한_쪽으로_처리한다(live):
    po_before = (po_total(live, "po"), pending_pos(live))
    jid = start(live, hitl="ambig", wait=5)
    seen = {}
    v = wait_for(live, jid, lambda x: x["hitl"]["active"] is not None, timeout=120)
    seen["pending"] = api(live, "GET", "/discovery/pending/")[1]                                                    # 알림: 답을 기다리는 질문이 있다
    q = next(a for a in v["hitl"]["asks"] if a["id"] == v["hitl"]["active"])
    seen["total"], seen["left"] = q["total"], q["left"]
    v = wait_for(live, jid, lambda x: x["status"] in DONE, timeout=240)
    assert v["status"] == "review", v["error"]
    assert seen["pending"]["count"] >= 1 and seen["pending"]["jobs"][0]["id"] == jid and seen["pending"]["jobs"][0]["title"]
    assert seen["total"] == 5 and 0 < seen["left"] <= 5
    asks = v["hitl"]["asks"]
    assert asks and all(a["st"] == "done" and a["who"] == "auto" for a in asks)                                      # 아무도 답하지 않았다
    assert {a["kind"] for a in asks} >= {"risky", "perm", "input"}
    assert v["hitl"]["counts"]["human"] == 0 and v["hitl"]["counts"]["auto"] == len(asks) and v["stats"]["nAuto"] == len(asks)
    assert any(e["k"] == "auto" and e["msg"].startswith("답이 없어 안전한 쪽으로 처리: ") for e in all_events(live, jid))
    assert "/prClose.do" not in by_path(v) and "/poApprove.do" not in by_path(v)
    assert api(live, "GET", "/discovery/pending/")[1] == {"count": 0, "jobs": []}
    assert closed_prs(live) == [] and (po_total(live, "po"), pending_pos(live)) == po_before


def test_답을_기다리는_탐색을_취소하면_질문은_처리되지_않은_채_정리된다(live):
    jid = start(live, hitl="ambig", wait=600)
    v = wait_for(live, jid, lambda x: x["hitl"]["active"] is not None, timeout=120)
    qid = v["hitl"]["active"]
    assert tell(live, jid, "answer", {"qid": qid, "value": "a\u0001b"})[0] == 400                                     # 선택지에도 입력칸에도 없는 답(제어 문자는 입력칸도 거절한다)
    assert tell(live, jid, "answer", {"qid": "nope", "value": "skip"})[0] == 400
    assert tell(live, jid, "hold")[1] == {"held": True} and view(live, jid)["hitl"]["held"] is True
    assert tell(live, jid, "plan", {"id": "m999", "op": "skip"})[0] == 400 and tell(live, jid, "plan", {"id": "m1", "op": "dance"})[0] == 400
    assert tell(live, jid, "take", {"op": "click", "x": 1, "y": 1})[0] == 400                                          # 직접 조작 중이 아니다
    assert tell(live, jid, "take", {"op": "end"})[0] == 409
    assert api(live, "POST", f"/discovery/jobs/{jid}/cancel/")[0] == 200
    v = wait_for(live, jid, lambda x: x["status"] in DONE, timeout=60)
    assert v["status"] == "cancelled"
    assert all(a["st"] == "done" and a["who"] == "end" for a in v["hitl"]["asks"]) and v["hitl"]["counts"]["pending"] == 0
    assert tell(live, jid, "answer", {"qid": qid, "value": "skip"})[0] == 409                                          # 끝난 탐색에는 답할 수 없다
    assert httpx.get(f"{live}/api/ieum/discovery/jobs/{jid}/qshot/{qid}").status_code in (200, 404) and api(live, "GET", "/discovery/pending/")[1]["count"] == 0
    jobs.get(jid).thread.join(15)
    assert not jobs.get(jid).thread.is_alive()


# ---------------------------------------------------------------- 새 화면마다 묻기
def test_새_화면마다_묻기는_건너뛰라고_한_화면을_탐색하지_않는다(live):
    def screen(q):
        return "skip" if "거래처 관리" in q["title"] else "go"

    jid = start(live, hitl="every", wait=60)
    v = drive(live, jid, {"screen": screen, "low": "incl", "risky": "skip", "perm": "skip", "input": "skip"})
    assert v["status"] == "review", v["error"]
    screens = [a for a in v["hitl"]["asks"] if a["kind"] == "screen"]
    assert len(screens) >= 5 and all(a["who"] == "human" for a in screens)
    assert next(a for a in screens if "거래처 관리" in a["title"])["val"] == "skip"
    assert "/vendList.do" not in by_path(v)                                                                         # 건너뛰라고 한 화면의 API 는 찾지 않았다
    assert {"/poList.do", "/prList.do", "/budgetRemain.do"} <= set(by_path(v))                                       # 탐색하라고 한 화면은 평소처럼 탐색했다
    assert all(e["msg"] != "'거래처 관리' 화면 탐색하기" for e in all_events(live, jid) if e["k"] == "human")


def test_질문_화면은_질문한_순간의_화면이다(live):
    jid = start(live, hitl="ambig", wait=600)
    v = wait_for(live, jid, lambda x: x["hitl"]["active"] is not None, timeout=120)
    q = next(a for a in v["hitl"]["asks"] if a["id"] == v["hitl"]["active"])
    assert q["shot"] == 1 and (not q["hl"] or {"x", "y", "w", "h", "vw", "vh"} <= set(q["hl"])) and (q["hl"] or q["kind"] not in ("input", "risky"))
    r = httpx.get(f"{live}/api/ieum/discovery/jobs/{jid}/qshot/{q['id']}")
    assert r.status_code == 200 and r.headers["content-type"] == "image/jpeg" and r.content[:2] == b"\xff\xd8" and len(r.content) > 3000
    assert httpx.get(f"{live}/api/ieum/discovery/jobs/{jid}/qshot/nope").status_code == 404
    assert "task" not in q and "key" not in q                                                                      # 크롤러가 쓰는 내부 값은 화면에 주지 않는다
    api(live, "POST", f"/discovery/jobs/{jid}/cancel/")
    wait_for(live, jid, lambda x: x["status"] in DONE, timeout=60)


def test_값을_넣고_누르려는_바로_그_순간_직접_조작이_시작돼도_그_일을_잃지_않는다(live, monkeypatch):
    """사람이 답한 일(값 넣고 누르기)을 하려는 순간 직접 조작이 시작되면 그 화면을 접었다 다시 연다. 그때 그 일이 사라지면 안 된다."""
    from app.ieum.discovery import crawler as crawler_mod
    orig, fired = crawler_mod.Crawler._act_on_page, []

    def wrapped(self, depth, entry=None):
        if entry is not None and entry.task and entry.task.get("op") == "fill" and not fired:
            fired.append(1)
            self.hitl.start_take("시험", None)                  # 값을 넣고 누르기 바로 앞에서 사람이 직접 조작을 시작했다
        return orig(self, depth, entry)

    monkeypatch.setattr(crawler_mod.Crawler, "_act_on_page", wrapped)
    jid, ended = start(live, hitl="ambig", wait=120), []

    def end_take(v):
        if v["hitl"]["take"] and not ended:
            time.sleep(1.5)
            assert tell(live, jid, "take", {"op": "end", "by": "시험"})[0] == 200
            ended.append(1)

    v = drive(live, jid, {"input": "한빛상사", "perm": "skip", "risky": "skip", "low": "skip"}, each=end_take)
    assert v["status"] == "review", v["error"] and fired and ended
    vend = by_path(v)["/vendList.do"]
    assert vend["human"] is True and "vendNm=한빛상사" in vend["tr"]["req"]                                     # 직접 조작이 끝난 뒤 값을 넣고 눌렀다
    ev = all_events(live, jid)
    end = next(i for i, e in enumerate(ev) if e["k"] == "human" and "직접 조작을 마쳤습니다" in e["msg"])
    assert any(e["k"] == "act" and e.get("human") and "(사람이 알려 줌)" in e["msg"] for e in ev[end:])
    assert v["hitl"]["plan"]["items"][1]["name"] == "발주 등록" and v["hitl"]["plan"]["items"][1]["st"] == "done"


def test_직접_조작으로_접은_화면은_못_누른_버튼을_이어서_누른다(live, monkeypatch):
    """화면을 접었다 다시 열 때 그 화면에서 아직 누르지 않은 버튼이 '이미 본 것'으로 처리돼 영영 눌리지 않으면 안 된다."""
    from app.ieum.discovery import crawler as crawler_mod
    orig, fired = crawler_mod.Crawler._act_on_page, []

    def wrapped(self, depth, entry=None):
        if entry is not None and entry.task and entry.task.get("op") == "fill" and not fired:
            fired.append(1)
            self.hitl.start_take("시험", None)
        return orig(self, depth, entry)

    monkeypatch.setattr(crawler_mod.Crawler, "_act_on_page", wrapped)
    jid, ended = start(live, hitl="never"), []
    v = wait_for(live, jid, lambda x: x["status"] in DONE or x["hitl"]["take"] is not None, timeout=120)
    if v["hitl"]["take"] is not None:
        time.sleep(1.0)
        assert tell(live, jid, "take", {"op": "end"})[0] == 200
    v = wait_for(live, jid, lambda x: x["status"] in DONE, timeout=240)
    assert v["status"] == "review" and fired
    by = by_path(v)
    assert {"/poList.do", "/prList.do", "/budgetRemain.do", "/itemPrice.do"} <= set(by)                       # 접힌 화면 뒤의 화면들도 평소처럼 탐색했다
    assert by["/vendList.do"]["human"] is True


def test_소스에서_찾은_API_가_위험해_보이는_버튼_질문의_근거가_된다(live):
    jid = start(live, hitl="ambig", wait=600, git=True, repo=demo_repo(), stg=False)
    v = wait_for(live, jid, lambda x: any(a["kind"] == "risky" for a in x["hitl"]["asks"]), timeout=180)
    risky = next(a for a in v["hitl"]["asks"] if a["kind"] == "risky")
    assert risky["pred"] == 'POST /prClose.do (소스에서 찾은 "구매요청 마감" API)'                                 # 화면에서 알 수 없는 요청도 소스가 알려 준다
    assert next(a for a in v["hitl"]["asks"] if a["kind"] == "input")["pred"] == ""                             # 근거가 없으면 비워 둔다
    api(live, "POST", f"/discovery/jobs/{jid}/cancel/")
    wait_for(live, jid, lambda x: x["status"] in DONE, timeout=60)
