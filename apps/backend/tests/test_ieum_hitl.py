"""탐색 중 사람 개입(HITL)의 규칙: 질문과 시간, 계획, 지시, 직접 조작의 상태, 용도 추정. 브라우저는 쓰지 않는다."""
import pytest

from app.ieum.discovery import hitl, options, planner
from app.ieum.gateway import llm

QUES = ["우리 팀 구매요청 승인됐어?", "이번 달 한빛상사 발주 금액 얼마야?", "구매팀 올해 예산 얼마 남았어?", "A4 용지 한빛상사 단가 얼마야?"]
MENUS = [{"name": n} for n in ("메인", "발주 현황", "발주 등록", "발주 승인", "구매요청", "거래처 관리", "통계")]


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now

    def advance(self, sec):
        self.now += sec


@pytest.fixture
def clock():
    return Clock()


@pytest.fixture
def made(clock):
    logs = []
    h = hitl.Hitl(level="ambig", wait=100, purpose="구매팀 업무를 AI 비서로 조회", ques=QUES, clock=clock, log=lambda k, t: logs.append((k, t)))
    return h, logs


def spec(key, **kw):
    return dict({"key": key, "kind": "risky", "title": "눌러도 될까요?", "opts": [["press", "눌러 보기 (요청은 차단)", "pri"], ["skip", "건너뛰기", ""]], "def": "skip",
                 "defLabel": "건너뜁니다", "labels": {"press": "버튼을 눌러 보기", "skip": "버튼 건너뛰기"}}, **kw)


# ------------------------------------------------------------------ 질문과 시간
def test_질문은_한_번에_하나만_카드가_되고_시간은_그_질문에만_흐른다(made, clock):
    h, _ = made
    a, b = h.ask(spec("a")), h.ask(spec("b"))
    assert h.active()["id"] == a["id"] and [q["id"] for q in h.pending()] == [a["id"], b["id"]]
    clock.advance(40)
    h.tick()
    assert (a["left"], b["left"]) == (60, 100)                       # 뒤의 질문은 기다리는 동안 시간이 가지 않는다
    clock.advance(60)
    h.tick()
    assert (a["st"], a["val"], a["who"]) == ("done", "skip", "auto") and h.active()["id"] == b["id"] and b["left"] == 100


def test_답이_없으면_안전한_쪽으로_처리하고_기록한다(made, clock):
    h, logs = made
    h.ask(spec("a"))
    clock.advance(101)
    h.tick()
    assert h.counts() == {"human": 0, "auto": 1, "take": 0, "pending": 0}
    assert logs == [("auto", "답이 없어 안전한 쪽으로 처리: 버튼 건너뛰기")]


def test_일시정지_직접조작_카드_위_마우스에서는_시간이_멈춘다(made, clock):
    h, _ = made
    q = h.ask(spec("a"))
    h.set_paused(True)
    clock.advance(500)
    h.tick()
    assert q["left"] == 100 and q["st"] == "wait"
    h.set_paused(False)
    h.hold()
    clock.advance(hitl.HOLD_SECONDS - 1)
    h.tick()
    assert q["left"] == 100                                           # 마우스가 카드 위에 있는 동안
    clock.advance(10)
    h.tick()
    assert 90 <= q["left"] < 100                                      # 알림이 끊기면 다시 흐른다
    h.start_take()
    clock.advance(500)
    h.tick()
    assert q["st"] == "wait"


def test_묻지_않기로_했으면_바로_기본값으로_처리하되_질문_기록은_남긴다(clock):
    logs = []
    h = hitl.Hitl(level="never", clock=clock, log=lambda k, t: logs.append((k, t)))
    q = h.ask(spec("a"))
    assert (q["st"], q["val"], q["who"]) == ("done", "skip", "never") and h.pending() == []
    assert logs == [("auto", "묻지 않고 처리: 버튼 건너뛰기")] and h.counts()["auto"] == 1


def test_같은_질문은_다시_묻지_않는다(made):
    h, _ = made
    first = h.ask(spec("a"))
    assert h.ask(spec("a")) is first                                   # 묻는 중이면 그 질문
    h.answer(first["id"], "press")
    assert h.ask(spec("a")) is None and h.decided("a") == "press"       # 결정이 나면 다시 묻지 않는다


def test_사람의_답을_받는다(made):
    h, logs = made
    q = h.ask(spec("a", input={"ph": "거래처", "sugg": ["한빛"]}))
    assert h.answer(q["id"], "press", by="홍길동") == (True, "버튼을 눌러 보기")
    assert logs[-1] == ("human", "홍길동님 결정: 버튼을 눌러 보기") and h.counts()["human"] == 1
    assert h.answer(q["id"], "skip") == (False, "이미 처리된 질문입니다.")
    assert h.answer("q99", "skip") == (False, "질문을 찾을 수 없습니다.")


def test_입력칸이_있는_질문은_적은_값을_받고_없는_질문은_선택지만_받는다(made):
    h, _ = made
    q = h.ask(spec("in", kind="input", input={"ph": "거래처", "sugg": []}, labels={"skip": "건너뛰기", "*": '거래처를 "{v}"(으)로 검색'}))
    assert h.answer(q["id"], "  한빛  ") == (True, '거래처를 "한빛"(으)로 검색') and q["val"] == "한빛"
    plain = h.ask(spec("plain"))
    assert h.answer(plain["id"], "아무 말")[0] is False and plain["st"] == "wait"
    ctrl = h.ask(spec("ctrl", kind="input", input={"ph": "x", "sugg": []}))
    assert h.answer(ctrl["id"], "a\x07b")[0] is False and h.answer(ctrl["id"], "가" * 200)[0] is True and len(ctrl["val"]) == hitl.MAX_VALUE


def test_권한_질문에서_직접_보여준다고_하면_바로_직접_조작으로_넘어간다(made):
    h, _ = made
    h.set_plan([{"id": "m1", "name": "발주 승인", "rel": "mid", "qa": [], "why": "", "st": "wait", "hum": False}], "rule")
    q = h.ask(spec("perm|m1", kind="perm", menu="m1", opts=[["take", "직접 보여 줄게요", "pri"], ["skip", "건너뛰기", ""]], labels={"take": "직접 보여 주기", "skip": "건너뛰기"}))
    assert h.item("m1")["asking"] is True
    h.answer(q["id"], "take", by="홍길동")
    assert h.take and h.take["menu"] == "m1" and "asking" not in h.item("m1") and h.counts()["take"] == 1


def test_답이_나온_질문은_크롤러가_한_번만_가져간다(made):
    h, _ = made
    a, b = h.ask(spec("a")), h.ask(spec("b"))
    h.answer(a["id"], "press")
    assert [q["id"] for q in h.pop_answered()] == [a["id"]] and h.pop_answered() == []
    h.answer(b["id"], "skip")
    assert [q["id"] for q in h.pop_answered()] == [b["id"]]


def test_화면에는_task_와_열쇠를_내보내지_않고_시간은_카드에만_붙인다(made):
    h, _ = made
    h.ask(spec("a", task={"type": "press", "url": "http://x"}))
    h.ask(spec("b"))
    v = h.view()
    assert all("task" not in a and "key" not in a for a in v["asks"])
    assert "left" in v["asks"][0] and "left" not in v["asks"][1] and v["active"] == "q1" and v["counts"]["pending"] == 2


# ------------------------------------------------------------------ 계획과 지시
def plan_of(h):
    items, by = planner.build_plan(MENUS, h.purpose, QUES, use_ai=False)
    h.set_plan(items, by)
    return {p["name"]: p for p in items}


def test_메뉴를_질문에_맞춰_관련도와_순서를_정한다(made):
    h, _ = made
    by_name = plan_of(h)
    assert by_name["구매요청"]["rel"] == "high" and by_name["구매요청"]["qa"] == [0]
    assert by_name["발주 현황"]["rel"] == "high" and by_name["발주 현황"]["qa"] == [1]
    assert by_name["거래처 관리"]["rel"] == "low" and by_name["거래처 관리"]["why"] == "질문과 직접 관련 없음"
    assert [p["rel"] for p in h.plan] == sorted((p["rel"] for p in h.plan), key=["high", "mid", "low"].index)         # 관련 높은 것부터
    assert [p["id"] for p in h.plan] == [f"m{i + 1}" for i in range(7)] and h.plan_by == "rule"


def test_메뉴를_건너뛰면_걸린_질문도_정리하고_이미_연_메뉴는_못_건너뛴다(made):
    h, logs = made
    by_name = plan_of(h)
    vend = by_name["거래처 관리"]
    q = h.ask(spec(f"low|{vend['id']}", kind="low", menu=vend["id"], opts=[["incl", "탐색하기", ""], ["skip", "건너뛰기", "pri"]], labels={"incl": "탐색하기", "skip": "건너뛰기"}))
    assert h.skip_menu(vend["id"], "홍길동", "cmd") == (True, "'거래처 관리' 메뉴를 탐색 계획에서 뺐습니다.")
    assert (q["st"], q["val"], q["who"]) == ("done", "skip", "pre") and h.item(vend["id"])["st"] == "skip" and h.item(vend["id"])["hum"] is True
    assert logs[-1] == ("human", "홍길동님 지시: '거래처 관리' 메뉴 건너뛰기") and h.counts()["human"] == 1
    h.set_state(by_name["구매요청"]["id"], "run")
    ok, msg = h.skip_menu(by_name["구매요청"]["id"])
    assert ok is False and "이미 탐색했거나 탐색 중" in msg


def test_관련_낮아_빠진_메뉴를_사람이_넣을_수_있다(made):
    h, logs = made
    vend = plan_of(h)["거래처 관리"]
    assert h.include_menu(vend["id"], "홍길동", "plan")[0] is True
    assert h.decided(f"low|{vend['id']}") == "incl" and h.item(vend["id"])["hum"] is True
    assert h.include_menu(vend["id"])[0] is False                                      # 이미 넣었다
    assert h.include_menu(plan_of(h)["구매요청"]["id"])[1].endswith("이미 탐색 계획에 있습니다.")


def test_지시_한_줄을_계획에_반영하고_못_알아들은_말은_메모로만_남긴다(made):
    h, logs = made
    plan_of(h)
    assert h.command("거래처 관리는 보지 마")["op"] == "skip" and h.item("m7") is not None
    r = h.command("통계는 건너뛰어")
    assert (r["op"], r["ok"]) == ("skip", True)
    r = h.command("그냥 천천히 하세요")
    assert (r["op"], r["ok"]) == ("memo", True) and "메모로만 남깁니다" in r["msg"] and logs[-1] == ("human", '사람님 지시: "그냥 천천히 하세요" (메모로 남김)')
    r = h.command("발주 승인은 내가 보여줄게")
    assert r["op"] == "take" and h.take and h.take["menu"] == next(p["id"] for p in h.plan if p["name"] == "발주 승인")
    assert h.command("   ")["ok"] is False


@pytest.mark.parametrize("text, op, menu", [
    ("거래처 관리는 보지 마", "skip", "거래처 관리"), ("통계는 건너뛰어", "skip", "통계"), ("구매요청은 빼줘", "skip", "구매요청"), ("발주 현황 제외해", "skip", "발주 현황"),
    ("발주 승인은 내가 보여줄게", "take", "발주 승인"), ("직접 보여줄게", "take", None), ("거래처 관리도 봐줘", "incl", "거래처 관리"), ("그냥 계속해", "memo", None)])
def test_지시_해석(text, op, menu):
    items, _ = planner.build_plan(MENUS, "", QUES, use_ai=False)
    r = planner.parse_command(text, items)
    assert r["op"] == op and (r["menu"]["name"] if r["menu"] else None) == menu


# ------------------------------------------------------------------ 직접 조작
def test_직접_조작은_조작_중에만_입력을_받고_끝나면_남은_입력을_버린다(made):
    h, logs = made
    assert h.push_input({"op": "click", "x": 1, "y": 2}) == (False, "직접 조작 중이 아닙니다.")
    assert h.start_take("홍길동") and not h.start_take("홍길동")
    assert h.push_input({"op": "click", "x": 10, "y": 20})[0] and h.push_input({"op": "type", "text": "abc"})[0] and h.push_input({"op": "key", "key": "Enter"})[0]
    for bad in ({"op": "click", "x": "a", "y": 1}, {"op": "key", "key": "F12"}, {"op": "type", "text": ""}, {"op": "scroll"}, {"op": "eval"}, {"op": "type", "text": "가" * 201}):
        assert h.push_input(bad)[0] is False
    assert h.push_input({"op": "type", "text": "가" * 200})[0] is True and h.next_input() is not None            # 200자까지는 한 번에 보낸다
    assert h.next_input() == {"op": "type", "text": "abc"}
    done = h.end_take()
    assert done["n"] == 4 and h.take is None and h.next_input() is None and h.end_take() is None
    assert h.counts()["human"] == 1 and logs[-1][1].startswith("직접 조작을 마쳤습니다. 사람이 보여준")


def test_아무것도_안_하고_끝낸_직접_조작은_결정으로_세지_않는다(made):
    h, _ = made
    h.start_take()
    h.end_take()
    assert h.counts()["human"] == 0 and h.counts()["take"] == 1


# ------------------------------------------------------------------ 용도, 저장
def test_용도_기입은_질문_번호를_걸러_저장한다(made):
    h, logs = made
    h.set_purpose("GET /poList", "  발주 목록   조회 ", [1, 1, 9, -1, "x"], "홍길동", "/poList.do")
    assert h.purp["GET /poList"] == {"use": "발주 목록 조회", "qa": [1]} and logs[-1] == ("human", '홍길동님이 /poList.do 용도를 "발주 목록 조회"(으)로 기입했습니다')


def test_기록을_저장했다가_그대로_다시_연다(made, clock):
    h, _ = made
    plan_of(h)
    q = h.ask(spec("a", task={"type": "press"}))
    h.answer(q["id"], "press")
    h.set_purpose("GET /x", "엑스", [0])
    snap = h.snapshot()
    back = hitl.Hitl.restore(snap, clock=clock)
    assert back.view()["asks"][0]["val"] == "press" and back.plan_by == "rule" and len(back.plan) == 7
    assert back.purp == h.purp and back.counts()["human"] == h.counts()["human"] and back.pop_answered() == []
    import json
    json.dumps(snap)                                                                       # 저장할 수 있는 모양이다


def test_시간_상한에_닿으면_남은_질문을_기본값으로_정리한다(made):
    h, logs = made
    h.ask(spec("a"))
    h.ask(spec("b"))
    h.resolve_all(lambda q: q["def"])
    assert h.pending() == [] and h.counts()["auto"] == 2


# ------------------------------------------------------------------ 계획 만들기와 용도 추정
def test_한글_조각과_불용어(made):
    assert planner.grams("구매요청") == {"구매", "매요", "요청"}
    assert planner.grams("얼마야 우리 이번") == frozenset()                       # 끝말과 조사는 조각이 되지 않는다
    assert planner.grams("PO 발주 a4 A") == {"po", "a4", "발주"}                    # 한 글자는 버리고 영문은 소문자


def test_AI_가_정한_계획은_검증해서_쓴다(monkeypatch):
    monkeypatch.setattr(planner.llm, "provider", lambda: "azure")
    answer = [{"name": "통계", "rel": "high", "qa": [1, 99, "x"], "why": " 월별 \n 금액 "}, {"name": "없는 메뉴", "rel": "high", "qa": [], "why": ""},
              {"name": "통계", "rel": "low", "qa": [], "why": "중복"}, {"name": "발주 현황", "rel": "엉뚱한값", "qa": [1], "why": ""}]
    monkeypatch.setattr(planner.llm, "complete_json", lambda s, u: answer)
    items, by = planner.build_plan(MENUS, "구매팀", QUES)
    assert by == "ai" and [i["name"] for i in items][:2] == ["통계", "발주 현황"]
    assert items[0]["qa"] == [1] and items[0]["why"] == "월별 금액" and items[1]["rel"] == "mid"                 # 번호 범위 밖, 모르는 등급은 버린다
    assert {i["name"] for i in items} == {m["name"] for m in MENUS} and len(items) == 7                         # 빠진 메뉴는 이름 겹침으로 채운다


@pytest.mark.parametrize("answer", ["엉터리", [], {"a": 1}, [{"name": "없음"}]])
def test_AI_답을_못_쓰면_규칙으로_정한다(monkeypatch, answer):
    monkeypatch.setattr(planner.llm, "provider", lambda: "azure")
    monkeypatch.setattr(planner.llm, "complete_json", lambda s, u: answer)
    items, by = planner.build_plan(MENUS, "구매팀", QUES)
    assert by == "rule" and len(items) == 7


def test_AI_호출이_실패해도_계획은_세운다(monkeypatch):
    monkeypatch.setattr(planner.llm, "provider", lambda: "azure")
    monkeypatch.setattr(planner.llm, "complete_json", lambda s, u: (_ for _ in ()).throw(llm.LlmError("실패")))
    assert planner.build_plan(MENUS, "구매팀", QUES)[1] == "rule"


def test_AI_가_없으면_부르지_않는다(monkeypatch):
    monkeypatch.setattr(planner.llm, "provider", lambda: None)
    monkeypatch.setattr(planner.llm, "complete_json", lambda s, u: pytest.fail("AI 를 부르면 안 된다"))
    assert planner.build_plan(MENUS, "구매팀", QUES)[1] == "rule"


def test_메뉴가_가진_다른_정보는_계획_항목에_남는다():
    items, _ = planner.build_plan([{"name": "발주 현황", "url": "http://x/po.do"}, {"name": "통계", "url": "http://x/stat.do"}], "", QUES, use_ai=False)
    assert {i["name"]: i["url"] for i in items} == {"발주 현황": "http://x/po.do", "통계": "http://x/stat.do"}


def test_입력값_제안은_질문에_나온_고유명에서_뽑는다():
    assert planner.suggest_values(QUES) == ["한빛상사", "한빛"]
    assert planner.suggest_values(["대한오피스 단가", "미래전자 재고"]) == ["대한오피스", "대한", "미래전자"]
    assert planner.suggest_values(["그냥 질문"]) == []


def test_API_열쇠는_확장자와_쿼리를_뗀다():
    assert planner.api_key("get", "/poList.do?fromDt=1") == "GET /poList" == planner.api_key("GET", "/poList")
    assert planner.api_key("POST", "/a/b.json/") == "POST /a/b"


def api(i, title, mode="read", screen="", menu=None, **kw):
    return dict({"id": i, "m": "GET", "path": f"/{i}.do", "title": title, "mode": mode, "ev": "tr", "tool": i, "desc": "규칙 설명", "params": [], "res": [],
                 "tr": {"screen": screen, "menu": menu or "", "menus": [menu] if menu else []}}, **kw)


def test_용도는_제목과_질문_겹침으로_규칙을_세운다(monkeypatch):
    monkeypatch.setattr(planner.llm, "provider", lambda: None)
    apis = [api("poList", "발주 현황", screen="발주 현황 > 조회 버튼"), api("selectX", "selectX"), api("prClose", "구매요청 마감", "write"), api("sso", "SSO", ev="out")]
    plan = [{"id": "m1", "name": "구매요청", "qa": [0, 2]}]
    apis[2]["tr"].update(menu="m1", menus=["m1"])
    assert planner.annotate(apis, "구매팀", QUES, plan, use_ai=False) == "rule"
    assert (apis[0]["use"], apis[0]["qa"], apis[0]["useBy"]) == ("발주 현황 조회", [1], "rule")
    assert apis[1]["use"] == "" and apis[1]["qa"] == []                                 # 영문 함수 이름은 용도가 아니다
    assert (apis[2]["use"], apis[2]["qa"]) == ("구매요청 마감 처리", [0, 2])             # 쓰기는 "처리", 메뉴의 질문이 이어진다
    assert "use" not in apis[3]                                                         # 범위 밖(다른 사이트) 요청은 건드리지 않는다


def test_질문_연결은_보수적으로_한다(monkeypatch):
    monkeypatch.setattr(planner.llm, "provider", lambda: None)
    plan = [{"id": "m1", "name": "발주 현황", "qa": [1]}, {"id": "m2", "name": "구매요청", "qa": [0]}]
    common = api("codeList", "공통코드", menu="m1")
    common["tr"]["menus"] = ["m1", "m2"]                                          # 여러 메뉴에서 불린 공통 API
    own = api("poList", "목록", menu="m1")
    save = api("poSave", "발주 금액 저장", "write")                              # 제목이 질문(발주 금액)과 겹치는 쓰기 API
    planner.annotate([common, own, save], "구매팀", QUES, plan, use_ai=False)
    assert common["qa"] == []                                                      # 어느 질문의 답도 아니다
    assert own["qa"] == [1]                                                        # 한 메뉴에서만 불렸으니 그 메뉴의 질문을 이어받는다
    assert save["qa"] == []                                                        # 이름이 겹친다고 쓰기 API 를 질문에 잇지 않는다


def test_AI_용도는_쓰되_설명은_확인하고_쓴다(monkeypatch):
    monkeypatch.setattr(planner.llm, "provider", lambda: "azure")
    good = "발주 번호와 거래처, 금액, 상태가 담긴 발주 목록을 돌려줍니다. 발주 현황이나 금액을 물을 때 씁니다."
    bad = "apps/hr/PoController.java 의 selectPoList 로 찾았습니다. 발주 목록을 조회하는 API 입니다 이것은 충분히 깁니다."
    monkeypatch.setattr(planner.llm, "complete_json", lambda s, u: {"apis": [
        {"id": "poList", "use": "발주 목록 조회", "qa": [1, 7], "desc": good}, {"id": "budget", "use": "예산 잔액 조회", "qa": [2], "desc": bad}, {"id": "none", "use": "x"}]})
    apis = [api("poList", "발주 현황"), api("budget", "예산"), api("untouched", "그대로")]
    assert planner.annotate(apis, "구매팀", QUES, use_ai=True) == "ai"
    assert (apis[0]["use"], apis[0]["qa"], apis[0]["useBy"], apis[0]["desc"], apis[0]["descBy"]) == ("발주 목록 조회", [1], "ai", good, "ai")
    assert apis[1]["use"] == "예산 잔액 조회" and apis[1]["desc"] == "규칙 설명" and "descBy" not in apis[1]       # 소스 경로가 든 설명은 버린다
    assert apis[2]["useBy"] == "rule"                                                                             # AI 가 말하지 않은 API 는 규칙 값 그대로


def test_AI_가_실패하면_규칙_용도를_쓴다(monkeypatch):
    monkeypatch.setattr(planner.llm, "provider", lambda: "azure")
    monkeypatch.setattr(planner.llm, "complete_json", lambda s, u: (_ for _ in ()).throw(llm.LlmError("실패")))
    apis = [api("poList", "발주 현황")]
    assert planner.annotate(apis, "구매팀", QUES) == "rule" and apis[0]["useBy"] == "rule" and apis[0]["use"] == "발주 현황 조회"


def test_AI_에는_값이_아니라_이름만_보낸다(monkeypatch):
    monkeypatch.setattr(planner.llm, "provider", lambda: "azure")
    sent = []
    monkeypatch.setattr(planner.llm, "complete_json", lambda s, u: sent.append(u) or [])
    a = api("poList", "발주 현황", params=[{"o": "fromDt", "a": "from_date", "loc": "query", "ex": "20260901", "obs": ["SECRET-VALUE"]}],
            res=[{"o": "PO_NO", "a": "order_no", "ov": "PO-2609-0142", "av": "고객-홍길동"}])
    planner.annotate([a], "구매팀", QUES)
    assert "from_date" in sent[0] and "order_no" in sent[0] and not any(x in sent[0] for x in ("SECRET-VALUE", "PO-2609-0142", "홍길동", "20260901"))


# ------------------------------------------------------------------ 설정 검증
def raw(**kw):
    return dict({"crawl": True, "approved": True, "owner": "김현우", "base": "http://10.0.0.1:8080/po"}, **kw)


def test_탐색_설정에_목적과_개입_수준이_들어간다():
    opts, _ = options.clean(raw(purpose="  구매팀 업무  ", ques=["Q1 질문", " ", None, "Q2 질문"], hitl="ambig", wait=300))
    assert (opts["purpose"], opts["ques"], opts["hitl"], opts["wait"]) == ("구매팀 업무", ["Q1 질문", "Q2 질문"], "ambig", 300)


def test_생략하면_묻지_않는_쪽이_기본이다():
    opts, _ = options.clean(raw())
    assert (opts["purpose"], opts["ques"], opts["hitl"], opts["wait"]) == ("", [], "never", 120)


def test_범위를_넘는_값은_다듬거나_거절한다():
    opts, _ = options.clean(raw(purpose="가" * 500, ques=[f"질문{i}" for i in range(30)], wait=99999))
    assert len(opts["purpose"]) == 200 and len(opts["ques"]) == options.MAX_QUESTIONS and opts["wait"] == 3600
    assert options.clean(raw(wait=1))[0]["wait"] == 5
    for bad in ("always", 7, ["ambig"]):
        with pytest.raises(ValueError, match="사람에게 물어볼 때"):
            options.clean(raw(hitl=bad))


def test_제외_경로_메뉴는_탐색하기로_바꿀_수_없다():
    h = hitl.Hitl(level="ambig")
    h.set_plan([{"id": "m1", "name": "시스템 관리", "rel": "excl", "qa": [], "why": "제외 경로", "st": "skip", "hum": False},
                {"id": "m2", "name": "발주 승인", "rel": "high", "qa": [], "why": "", "st": "wait", "hum": False}], "rule")
    ok, msg = h.include_menu("m1")
    assert not ok and "제외 경로" in msg and h.item("m1")["st"] == "skip" and not h.item("m1")["hum"] and h.counts()["human"] == 0


def test_권한_문제였던_메뉴를_보여_주겠다고_지시하면_새_로그인으로_시작한다():
    h = hitl.Hitl(level="ambig")
    h.set_plan([{"id": "m1", "name": "발주 승인", "rel": "high", "qa": [], "why": "", "st": "run", "hum": False},
                {"id": "m2", "name": "통계", "rel": "mid", "qa": [], "why": "", "st": "wait", "hum": False}], "rule")
    h.ask({"key": "perm|aprv", "kind": "perm", "title": "t", "opts": [["take", "t", "pri"], ["skip", "s", ""]], "def": "skip", "menu": "m1"})
    r = h.command("발주 승인은 내가 보여줄게")
    assert r["op"] == "take" and r["ok"] and h.take["fresh"] is True and h.take["menu"] == "m1"
    h.end_take()
    r = h.command("통계는 내가 보여줄게")                                    # 권한 문제가 없던 메뉴는 테스트 계정 세션 그대로 연다
    assert r["ok"] and h.take["fresh"] is False


def test_질문_기록_문구에_중괄호가_있어도_깨지지_않는다():
    h = hitl.Hitl(level="ambig")
    rec = h.ask({"key": "input|a", "kind": "input", "title": "t", "opts": [["skip", "s", ""]], "input": {"ph": "x", "sugg": []}, "def": "skip",
                 "labels": {"skip": "건너뛰기", "*": "'{버튼}'에 \"{v}\" 넣기"}})
    ok, label = h.answer(rec["id"], "{}{0}")
    assert ok and label == "'{버튼}'에 \"{}{0}\" 넣기"


def test_눌러_볼_버튼의_요청은_소스에서_글자가_겹치는_쓰기_API_가_하나뿐일_때만_알려_준다():
    hints = [{"title": "구매요청 마감 (마감하면 더 고칠 수 없다)", "method": "POST", "path": "/prClose.do", "mode": "write"},
             {"title": "구매요청 상신", "method": "POST", "path": "/prSubmit.do", "mode": "write"},
             {"title": "발주 목록 조회", "method": "GET", "path": "/poList.do", "mode": "read"}]
    assert planner.match_write_source("마감 처리", hints)["path"] == "/prClose.do"
    assert planner.match_write_source("구매요청 처리", hints) is None             # 쓰기 API 둘과 겹친다: 지어내지 않는다
    assert planner.match_write_source("목록 조회", hints) is None                 # 읽기 API 는 근거가 아니다
    assert planner.match_write_source("마감", []) is None
