"""조회에도 POST 를 쓰는 사이트(나라장터 같은 WebSquare)를 위한 규칙: 이름이 조회처럼 보이는 POST 의 판정, 질문, 결과 요약, 재탐색 허락.
브라우저는 쓰지 않는다. 브라우저로 도는 쪽은 test_ieum_discovery_spa.py."""
import pytest

from app.ieum.discovery import hitl, infer, jobs, masking, options, planner, reads
from app.ieum.discovery.crawler import Observed
from app.ieum.discovery.policy import Policy


@pytest.mark.parametrize("path", [
    "/fm/fma/fmaa/Pst/selectNtcPstList.do", "/co/coz/coza/util/getSession.do", "/o/orderList.do", "/a/search", "/bid/inquiryBidList.do", "/x/listOrders",
    "/api/v1/orders/list", "/x/countUnread.do", "/x/getAddressList.do", "/x/selectBidPblancList"])
def test_이름이_조회처럼_보이는_POST(path):
    assert reads.looks_read(path)


@pytest.mark.parametrize("path,why", [
    ("/x/selectAndUpdateRow.do", "select 로 시작해도 이름 안에 수정 낱말이 있다"),
    ("/fs/fsc/fsca/fileUpload.do", "조회 동사가 없다"),
    ("/api/orders", "REST 식 이름은 동사가 없어 조회인지 알 수 없다"),
    ("/api/budget/budgetSave.do", "저장"),
    ("/approve/selectList.do", "경로 구간 하나에 승인 낱말이 있다"),
    ("/x/getlistAndDelete", "삭제"),
    ("/x/readNotice.do", "read 는 읽음 처리(상태를 바꾸는 것)로도 쓰여 조회 동사로 보지 않는다"),
    ("/x/loadAndApply.do", "적용"),
    ("/login/selectUser.do", "로그인 계열도 걸러진다"),
    ("/", "이름이 없다")])
def test_이름이_조회처럼_보이지_않거나_쓰기_낱말이_있으면_조회로_보지_않는다(path, why):
    assert not reads.looks_read(path), why


def test_막은_조회형_요청은_경로별로_세고_질문과_결과가_읽는다():
    s = reads.Seen()
    assert not s and s.info("keep") is None
    assert s.add("/a/selectBidPblancList.do") is True and s.add("/a/selectBidPblancList.do") is False
    s.add("/a/selectBidPblancList.do")
    s.add("/co/getSession.do")
    s.add("/o/orderList.do?x=1")                        # 쿼리는 경로에 넣지 않는다
    assert s.total() == 5 and len(s.paths) == 3 and "/o/orderList.do" in s.paths
    assert s.names(2) == ["selectBidPblancList.do", "getSession.do"]          # 많이 막힌 순, 마지막 구간만
    assert s.groups() == ["get…", "select…", "…List"]
    info = s.info("keep")
    assert info["state"] == "keep" and info["n"] == 5 and info["paths"][0] == "/a/selectBidPblancList.do" and info["groups"] == ["get…", "select…", "…List"]


def test_기록하는_경로_수에는_상한이_있다():
    s = reads.Seen()
    for i in range(reads.MAX_PATHS + 20):
        s.add(f"/x/selectList{i}.do")
    assert len(s.paths) == reads.MAX_PATHS and s.add("/x/selectAnotherList.do") is False


def test_사람이_있는_자리의_질문은_묻지_않고_설정이어도_묻는다():
    spec = {"key": "k", "kind": "readpost", "title": "t", "opts": [["allow", "허락", "pri"], ["keep", "막기", ""]], "def": "keep", "defLabel": "막습니다", "labels": {"allow": "허락", "keep": "막기"}}
    never = hitl.Hitl(level="never")
    q = never.ask(dict(spec))
    assert (q["st"], q["val"], q["who"]) == ("done", "keep", "never")                          # 사람이 없는 탐색: 안전한 쪽
    never2 = hitl.Hitl(level="never")
    q2 = never2.ask(dict(spec, present=True, predLabel="막은 요청", pred="selectXxxList.do"))
    assert q2["st"] == "wait" and q2["predLabel"] == "막은 요청" and never2.pending() == [q2]        # 직접 조작 중에는 사람이 지금 보고 있다
    ok, _ = never2.answer(q2["id"], "allow")
    assert ok and never2.decided("k") == "allow"
    assert hitl.KIND_LABEL["readpost"] == "조회용 POST"


def test_눌러서_열리지_않은_메뉴는_건너뜀으로_두고_이유를_남긴다():
    h = hitl.Hitl(level="never")
    h.set_plan([{"id": "m1", "name": "입찰 > 입찰공고", "rel": "high", "qa": [], "why": "", "st": "run", "hum": False, "url": ""}], "rule")
    h.fail_menu("m1", "눌러도 열리지 않음")
    assert h.item("m1")["st"] == "skip" and h.item("m1")["why"] == "눌러도 열리지 않음"
    h.fail_menu("없음", "x")                              # 없는 메뉴는 조용히 넘어간다


def test_지시는_눌러서_여는_메뉴의_끝_이름으로도_알아듣는다():
    plan = [{"id": "m1", "name": "입찰 > 입찰공고 > 입찰공고목록", "leaf": "입찰공고목록", "rel": "high", "qa": [0], "why": "", "st": "wait", "hum": False},
            {"id": "m2", "name": "입찰 > 입찰공고 > 연기공고목록", "leaf": "연기공고목록", "rel": "mid", "qa": [], "why": "", "st": "wait", "hum": False}]
    r = planner.parse_command("연기공고목록은 보지 마", plan)
    assert (r["op"], r["menu"]["id"]) == ("skip", "m2")
    assert planner.parse_command("입찰공고목록도 탐색해 줘", plan)["menu"]["id"] == "m1"


def test_계획은_메뉴가_가진_길과_끝_이름을_그대로_들고_간다():
    menus = [{"name": "입찰 > 입찰공고 > 입찰공고목록", "url": "", "path": ["입찰", "입찰공고", "입찰공고목록"], "leaf": "입찰공고목록"},
             {"name": "관리 > 환경설정", "url": "", "path": ["관리", "환경설정"], "leaf": "환경설정"}]
    items, by = planner.build_plan(menus, "입찰 조회", ["이번 주 입찰공고 알려줘"], use_ai=False)
    assert by == "rule" and items[0]["name"] == "입찰 > 입찰공고 > 입찰공고목록" and items[0]["rel"] == "high"
    assert items[0]["path"] == ["입찰", "입찰공고", "입찰공고목록"] and items[0]["leaf"] == "입찰공고목록" and items[0]["url"] == ""


def _obs(headers):
    return Observed(method="POST", url="https://x.test/api/selectList.do", status=200, headers=headers, post='{"dlSrch": {"a": "1"}}')


def test_시스템이_정한_헤더는_값이_조금씩_달라도_가장_많이_본_값으로_넣는다():
    h = {"content-type": "application/json", "menu-info": "{\"menuNo\":\"1\"}"}
    samples = [_obs(h), _obs(dict(h, **{"menu-info": "{\"menuNo\":\"2\"}"})), _obs(h)]
    params = infer.build_params([], samples, masking.Masker(pii=True))
    hdr = [p for p in params if p["loc"] == "header"]
    assert len(hdr) == 1 and hdr[0]["o"] == "Menu-Info" and hdr[0]["rule"] == "inject" and hdr[0]["v"] == "{\"menuNo\":\"1\"}"
    assert "다른" in hdr[0]["d"]                                                   # 값이 달라질 수 있다는 것을 설명에 밝힌다
    same = infer.build_params([], [_obs(h), _obs(h)], masking.Masker(pii=True))
    assert [p["d"] for p in same if p["loc"] == "header"] == ["화면이 항상 같은 값으로 보내는 헤더"]


def test_조회형_POST_허락은_설정에_들어_있고_기본은_꺼져_있다():
    raw = {"crawl": True, "git": False, "approved": True, "owner": "시험", "base": "https://www.g2b.go.kr", "start": "/"}
    assert options.clean(raw)[0]["readAuto"] is False
    assert options.clean(dict(raw, readAuto=True))[0]["readAuto"] is True
    assert options.clean(dict(raw, readAuto="true"))[0]["readAuto"] is True
    assert Policy(base="https://www.g2b.go.kr").read_auto is False and Policy(base="https://www.g2b.go.kr", read_auto=True).read_auto is True


def test_조회용_POST_로_보낸_요청만_읽기로_본다():
    from app.ieum.discovery import merge
    pol = Policy(base="https://x.test")
    g = merge._Group("POST", "/api/selectList.do")
    g.items.append(Observed(method="POST", url="https://x.test/api/selectList.do", status=200, read=True, post="{}"))
    assert merge._mode(None, g, "POST", pol) == "read"
    blocked = merge._Group("POST", "/api/selectList.do")
    blocked.items.append(Observed(method="POST", url="https://x.test/api/selectList.do", status=None, blocked=True))
    assert merge._mode(None, blocked, "POST", pol) == "write"
    both = merge._Group("POST", "/api/selectList.do")                       # 허락하기 전에 막힌 것과 허락한 뒤 나간 것이 한 API 로 묶이면 읽기다
    both.items += blocked.items + g.items
    assert merge._mode(None, both, "POST", pol) == "read"
    plain = merge._Group("POST", "/api/save.do")
    plain.items.append(Observed(method="POST", url="https://x.test/api/save.do", status=200, post="{}"))
    assert merge._mode(None, plain, "POST", pol) == "write"                 # 로그인처럼 허용돼 나간 POST 를 읽기로 오해하지 않는다


def test_막은_조회형_요청의_추천은_허락하고_다시_탐색하라고_안내한다():
    from app.ieum.discovery import merge
    base = {"verify": {"k": "block"}, "mode": "write", "ev": "tr", "dep": False, "src": None, "human": False,
            "tr": {"blocked": True, "samples": 1, "file": False}, "path": "/api/selectBidPblancList.do"}
    rec, note = merge._recommend(base)
    assert rec == "check" and "조회로 보이는 POST" in note and "다시 탐색" in note
    rec2, note2 = merge._recommend(dict(base, path="/api/budgetSave.do"))
    assert "조회처럼 보이지만" not in note2                                      # 이름이 쓰기면 그 안내를 붙이지 않는다


def test_재탐색에서_조회형_POST_를_허락하려면_막은_기록이_있어야_한다(ieum_state, monkeypatch):
    seen = {}
    monkeypatch.setattr(jobs, "start", lambda raw: seen.setdefault("raw", raw) or object())
    opts, _ = options.clean({"crawl": True, "git": False, "approved": True, "owner": "시험", "base": "https://www.g2b.go.kr", "start": "/"})
    job = jobs._new(opts, "나라장터")
    jobs._jobs()[job.d["id"]] = job
    with pytest.raises(jobs.JobError, match="허락할 것이 없습니다"):
        jobs.rerun(job.d["id"], allow_reads=True)
    job.d["reads"] = {"state": "keep", "n": 3, "paths": ["/a/selectList.do"], "groups": ["select…"]}
    jobs.rerun(job.d["id"], allow_reads=True)                                   # 계정 없는 공개 사이트도 다시 탐색할 수 있다
    assert seen["raw"]["readAuto"] is True and seen["raw"]["when"] == "now"
    seen.clear()
    jobs.rerun(job.d["id"])
    assert not seen["raw"].get("readAuto")                                      # 허락은 요청한 때만 끼운다
