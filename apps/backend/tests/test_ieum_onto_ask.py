"""온톨로지 5: 액션(원본 시스템 API 로 쓰기)과 AI 질의 테스트. 목업의 질문 셋이 진짜 쿼리로 같은 답이 나오는지, 쓰기가 사용자 확인 뒤에만 도는지 본다."""
import sqlite3

import pytest

from app.ieum.gateway import llm
from app.ieum.onto import actions, ask, demo, perm, publish, query, store
from app.ieum.repositories import sources as src_repo

KIM, HONG, CHOI = "20150301", "20190412", "20210305"


@pytest.fixture
def live(onto, ieum_server):
    """시연 레거시 사이트를 진짜 포트에서 부를 수 있게 원본 시스템의 주소를 이 서버로 돌린다."""
    src_repo.upsert_source({"id": "legacy-po", "base": ieum_server + "/demo-legacy/po"})
    return ieum_server


def steps_of(out):
    return [(s["k"], s["title"]) for s in out["steps"]]


def res_of(out, title):
    s = next(x for x in out["steps"] if x["title"] == title)
    return next(b["v"] for b in s["blocks"] if b["t"] == "res")


def po_status(po_no="PO-2609-0142"):
    db = sqlite3.connect(demo.path_of("po"))
    try:
        return db.execute("SELECT PO_STTS_CD FROM TB_PO_MST WHERE PO_NO = ?", (po_no,)).fetchone()
    finally:
        db.close()


# ── 읽기 질문 ──────────────────────────────────────────────────────────────

def test_q1_gives_the_mockup_numbers_for_the_purchasing_lead(onto):
    out = ask.run({"id": "q1"}, KIM)
    assert out["answer"] == "9월에 한빛상사로 나간 발주 중 승인 대기는 3건, 모두 7,310,000원이에요. 가장 큰 건은 PO-2609-0142(4,850,000원)입니다."
    assert steps_of(out) == [("obj", "객체 검색"), ("link", "링크 따라가기"), ("filter", "필터"), ("perm", "권한 적용"), ("agg", "집계 쿼리 실행"), ("obj", "해당 발주 보기")]
    assert res_of(out, "객체 검색") == "V0012 한빛상사, 1건" and res_of(out, "링크 따라가기") == "발주 42건" and res_of(out, "필터") == "3건" and res_of(out, "권한 적용") == "3건 그대로"
    assert res_of(out, "집계 쿼리 실행").startswith("3건, 7,310,000원")
    sql = next(b["v"] for s in out["steps"] if s["title"] == "집계 쿼리 실행" for b in s["blocks"] if b["t"] == "sql")
    assert "SUM(po.PO_AMT) AS total" in sql and "po.VEND_CD = :vendor" in sql and "-- 승인대기 (코드 20)" in sql and "JOIN" not in sql


def test_q1_for_hr_is_narrowed_by_row_permission_and_hides_the_amount(onto):
    out = ask.run({"id": "q1"}, HONG)
    assert out["answer"] == "인사팀 요청분 중 한빛상사 승인 대기 발주는 1건(PO-2609-0142)이에요. 발주 금액은 구매팀 또는 팀장 이상만 볼 수 있어서 알려 드릴 수 없어요."
    assert res_of(out, "권한 적용") == "1건으로 줄어듦" and res_of(out, "필터") == "3건"                  # 앞 단계 건수는 권한 적용 전 값
    perm_step = next(s for s in out["steps"] if s["title"] == "권한 적용")
    rules = next(b["v"] for b in perm_step["blocks"] if b["t"] == "rules")
    assert any(r["deny"] and "발주 금액: 가림" in r["text"] for r in rules)
    sql = next(b["v"] for s in out["steps"] if s["title"] == "집계 쿼리 실행" for b in s["blocks"] if b["t"] == "sql")
    assert "JOIN PO.TB_PR_MST pr" in sql and "pr.DEPT_CD = :user_dept" in sql and "-- 발주 금액은 조회하지 않음" in sql and "SUM" not in sql


def test_q2_walks_employee_to_department_to_budget_across_databases(onto):
    k = ask.run({"id": "q2"}, KIM)
    assert k["answer"] == "구매팀의 2026년 구매 예산 30,000,000원 중 21,450,000원을 써서 8,550,000원 남았어요."
    assert [s["title"] for s in k["steps"]][:3] == ["실행 사용자 확인", "링크 따라가기", "DB 간 링크 따라가기"] and res_of(k, "링크 따라가기") == "부서 1건: 구매팀 (D4010)" and res_of(k, "계산") == "8,550,000원"
    h = ask.run({"id": "q2"}, HONG)
    assert h["answer"] == "인사팀의 2026년 구매 예산 12,000,000원 중 7,380,000원을 써서 4,620,000원 남았어요."
    assert "예산: 같은 부서 구성원이라 그 행만 볼 수 있음" in str(next(s for s in h["steps"] if s["title"] == "권한 적용")["blocks"])


def test_ask_errors_are_plain_sentences(onto):
    for call, text in ((lambda: ask.run({"id": "q1"}, "99999999"), "찾을 수 없어요"), (lambda: ask.run({"id": "nope"}, KIM), "알 수 없는 질문"), (lambda: ask.run({"text": "안녕"}, KIM), "GPT 설정"),
                       (lambda: ask.run({"text": " "}, KIM), "질문을 입력")):
        with pytest.raises(ask.AskError) as e:
            call()
        assert text in str(e.value)
    for cid in ("po", "hr"):
        store.versions.save({})
    with pytest.raises(ask.AskError) as e:
        ask.run({"id": "q1"}, KIM)
    assert "공개한 온톨로지가 없어요" in str(e.value)


def test_ask_uses_the_published_snapshot_not_the_live_studio(onto):
    store.update_object("po.Vendor", lambda o: o.update(name="바뀐 거래처"))                        # 스튜디오에서 고쳐도 공개 전에는 AI 에 닿지 않는다
    assert query.Ctx.published().objects["po.Vendor"]["name"] == "거래처"
    publish.publish("po", serve=False)
    assert query.Ctx.published().objects["po.Vendor"]["name"] == "바뀐 거래처"
    st = ask.status()
    assert {p["id"]: p["ver"] for p in st["published"]} == {"po": 2, "hr": 1} and [u["name"] for u in st["users"]] == ["김현우", "홍길동"] and st["free"] is False


def test_unpublished_objects_and_links_are_invisible_to_ai(onto):
    ctx = query.Ctx.published()
    assert "po.PurchaseRequest" not in ctx.objects                                  # 검토 필요 객체는 공개 전이다
    assert not any(l["to"] == "po.PurchaseRequest" for l in ctx.links)
    with pytest.raises(query.OntoQueryError):
        ctx.find_link("po.PurchaseOrder", "purchaseRequest")


# ── 쓰기 액션 ──────────────────────────────────────────────────────────────

def test_q3_stops_for_confirmation_and_changes_nothing_until_approved(live):
    out = ask.run({"id": "q3"}, KIM)
    assert out["answer"] is None and out["pending"]["key"] == "PO-2609-0142"
    hold = next(s for s in out["steps"] if s["k"] == "hold")
    card = next(b["v"] for b in hold["blocks"] if b["t"] == "approval")
    assert card["title"] == "PO-2609-0142를 승인할까요?" and card["fields"] == [["거래처", "한빛상사"], ["발주 금액", "4,850,000원"], ["품목", "4줄"]]
    assert po_status() == ("20",) and steps_of(out)[:3] == [("obj", "객체 조회"), ("act", "액션 선택"), ("perm", "제출 조건 확인")]


def test_q3_executes_through_the_legacy_api_after_approval_and_rereads_the_object(live):
    out = ask.run({"id": "q3"}, KIM, approved=True)
    assert out["answer"] == "PO-2609-0142 발주 승인을 마쳤어요. 진행 상태가 승인으로 바뀌었습니다." and out["executed"]
    api = next(s for s in out["steps"] if s["title"] == "API 실행")
    http = next(b["v"] for b in api["blocks"] if b["t"] == "http")
    assert http.startswith("POST /demo-legacy/po/poApprove.do HTTP/1.1") and "poNo=PO-2609-0142" in http and "••••" in http and "Cookie" in http.replace("cookie", "Cookie")
    assert res_of(out, "객체 다시 읽기") == "진행 상태 승인대기 → 승인" and po_status() == ("30",)
    db = sqlite3.connect(demo.path_of("po"))
    assert db.execute("SELECT BEF_STTS_CD, AFT_STTS_CD FROM TB_PO_HIST WHERE PO_NO='PO-2609-0142' ORDER BY HIST_SEQ DESC").fetchone() == ("20", "30")
    db.close()
    again = ask.run({"id": "q3"}, KIM, approved=True)                               # 이미 승인한 발주는 제출 조건에서 막힌다
    assert not again["executed"] and "진행 상태가 승인대기일 때만" in again["answer"] and po_status() == ("30",)


def test_q3_is_refused_for_someone_without_the_rank_and_rejecting_changes_nothing(live):
    out = ask.run({"id": "q3"}, HONG, approved=True)
    assert out["answer"] == "PO-2609-0142 발주 승인은 '실행자가 구매팀 팀장 이상일 때만' 조건을 만족해야 해요. 홍길동님은 이 액션을 실행할 수 없어서 아무것도 바꾸지 않았습니다." and not out["executed"]
    assert steps_of(out)[-1] == ("fail", "제출 조건 확인") and po_status() == ("20",)
    no = ask.run({"id": "q3"}, KIM, approved=False)
    assert no["answer"].startswith("PO-2609-0142 발주 승인을 실행하지 않았어요") and po_status() == ("20",)


def test_write_actions_need_confirmation_at_the_api_level(live):
    ctx, adm = query.Ctx.published(perm.identify(KIM)), query.Ctx.published(None)
    adm.admin = True
    with pytest.raises(actions.ActionError) as e:
        actions.execute(ctx, adm, "po.PurchaseOrder", "approvePurchaseOrder", "PO-2609-0142", {}, perm.identify(KIM), confirmed=False)
    assert "사용자 확인" in str(e.value) and po_status() == ("20",)


def test_action_is_blocked_when_the_original_api_is_not_connected(live):
    src_repo.delete_source("legacy-po")
    out = ask.run({"id": "q3"}, KIM, approved=True)
    assert "연결되어 있지 않아요" in out["answer"] and po_status() == ("20",)


def test_create_purchase_order_checks_vendor_status_and_budget_then_writes_through(live):
    ctx, adm = query.Ctx.published(perm.identify(KIM)), query.Ctx.published(None)
    adm.admin = True
    kim = perm.identify(KIM)
    ev = actions.evaluate(ctx, adm, "po.PurchaseOrder", "createPurchaseOrder", "", {"vendor": "V0012", "item": "P-10023", "quantity": 100}, kim)
    assert ev["ok"] and [r["ok"] for r in ev["rules"]] == [True, True] and "예산 잔액 8,550,000원, 발주 금액 1,250,000원" == ev["rules"][1]["note"]
    assert ev["confirm"]["fields"][:3] == [["거래처", "한빛상사"], ["품목", "A4 복사용지 80g"], ["수량", "100"]]
    assert ev["args"] == {"vendCd": "V0012", "itemCd": "P-10023", "qty": 100, "unitPrice": 12500}
    stopped = actions.evaluate(ctx, adm, "po.PurchaseOrder", "createPurchaseOrder", "", {"vendor": "V0033", "item": "P-10023", "quantity": 100}, kim)      # 거래 중지 거래처
    assert not stopped["ok"] and stopped["rules"][0]["ok"] is False and "거래 중지" in stopped["rules"][0]["note"]
    broke = actions.evaluate(ctx, adm, "po.PurchaseOrder", "createPurchaseOrder", "", {"vendor": "V0012", "item": "P-20042", "quantity": 100}, kim)         # 250,000 x 100 > 잔액
    assert not broke["rules"][1]["ok"] and "발주 금액 25,000,000원" in broke["rules"][1]["note"]
    done = actions.execute(ctx, adm, "po.PurchaseOrder", "createPurchaseOrder", "", {"vendor": "V0012", "item": "P-10023", "quantity": 100}, kim, confirmed=True)
    assert done["ok"] and done["created"] == "PO-2610-0001" and done["after"]["status"] == "작성" and done["after"]["amount"] == 1250000
    db = sqlite3.connect(demo.path_of("po"))
    assert db.execute("SELECT COUNT(*) FROM TB_PO_DTL WHERE PO_NO='PO-2610-0001'").fetchone()[0] == 1
    db.close()
    with pytest.raises(actions.ActionError) as e:
        actions.evaluate(ctx, adm, "po.PurchaseOrder", "createPurchaseOrder", "", {"vendor": "V0012", "item": "P-10023", "quantity": 0}, kim)
    assert "1 이상" in str(e.value)


def test_close_purchase_request_rules_follow_requester_and_status(live):
    store.update_object("po.PurchaseRequest", lambda o: o.update(status="pub"))
    publish.publish("po", serve=False)
    adm = query.Ctx.published(None)
    adm.admin = True

    def check(emp, key):
        u = perm.identify(emp)
        return actions.evaluate(query.Ctx.published(u), adm, "po.PurchaseRequest", "closePurchaseRequest", key, {}, u)
    ev = check(HONG, "PR-2609-0088")                                                # 홍길동이 요청한 건이지만 이미 발주 완료
    assert [r["ok"] for r in ev["rules"]] == [True, False] and not ev["ok"]
    mine = query.search(adm, "po.PurchaseRequest", {"status": "요청"}, 100)["rows"]
    other = next(r for r in mine if r["requesterId"] != HONG)
    assert [r["ok"] for r in check(HONG, other["requestNumber"])["rules"]] == [False, True]          # 남이 요청한 건은 인사팀이 마감할 수 없다
    assert check(KIM, other["requestNumber"])["ok"] and check(KIM, other["requestNumber"])["confirm"]["title"].endswith("구매요청을 마감할까요?")      # 구매팀은 누구 것이든
    done = actions.execute(query.Ctx.published(perm.identify(KIM)), adm, "po.PurchaseRequest", "closePurchaseRequest", other["requestNumber"], {}, perm.identify(KIM), confirmed=True)
    assert done["ok"] and done["changed"][0][1:] == ["요청", "마감"]


# ── 자유 질문(GPT 대역) ────────────────────────────────────────────────────

class FakeLlm:
    def __init__(self, plan, answer="모델이 쓴 답이에요."):
        self.plan, self.answer, self.prompts = plan, answer, []

    def install(self, monkeypatch):
        monkeypatch.setattr(llm, "provider", lambda: "azure")
        monkeypatch.setattr(llm, "complete_json", lambda system, user: (self.prompts.append((system, user)), self.plan)[1])
        monkeypatch.setattr(llm, "complete", lambda system, user: (self.prompts.append((system, user)), self.answer)[1])
        return self


def test_free_question_runs_the_models_plan_on_the_same_engine(onto, monkeypatch):
    plan = {"steps": [{"op": "search", "as": "v", "object": "Vendor", "where": {"name": {"contains": "한빛상사"}}}, {"op": "follow", "as": "p", "from": "v", "link": "purchaseOrders"},
                      {"op": "aggregate", "from": "p", "aggs": [{"fn": "count", "as": "n"}]}]}
    fake = FakeLlm(plan).install(monkeypatch)
    out = ask.run({"text": "한빛상사 발주는 몇 건?"}, KIM)
    assert out["mode"] == "llm" and out["answer"] == "모델이 쓴 답이에요." and res_of(out, "집계 쿼리 실행").startswith("42건")
    system, user = fake.prompts[0]
    assert "Vendor (거래처, po.Vendor)" in user and "purchaseOrders→po.PurchaseOrder" in user and "approvePurchaseOrder" in user and "2026-09-30" in system      # 카탈로그와 기준일이 들어간다
    assert "PurchaseRequest" not in user                                            # 공개하지 않은 객체는 모델에게도 보이지 않는다


def test_models_mistakes_become_plain_failure_steps_and_never_reach_the_database(onto, monkeypatch):
    for plan, text in (({"steps": [{"op": "search", "object": "Nope", "where": {}}]}, "객체를 찾을 수 없어요"), ({"steps": [{"op": "drop"}]}, "알 수 없는 단계"),
                       ({"steps": [{"op": "search", "object": "Vendor", "where": {"name": {"contains": "한빛상사"}}}, {"op": "follow", "from": "v0", "link": "ghost"}]}, "있는 링크"),
                       ({"steps": [{"op": "search", "object": "PurchaseOrder", "where": {"amount": {"gt": 1}}}]}, "")):
        FakeLlm(plan).install(monkeypatch)
        out = ask.run({"text": "아무거나"}, HONG)
        assert out["steps"][-1]["k"] == "fail" and text in out["answer"], plan
    FakeLlm({"steps": [], "unanswerable": "그런 데이터는 없어요."}).install(monkeypatch)
    assert ask.run({"text": "날씨는?"}, KIM)["answer"] == "그런 데이터는 없어요."


def test_a_free_question_that_writes_still_stops_for_confirmation(live, monkeypatch):
    FakeLlm({"steps": [{"op": "action", "object": "PurchaseOrder", "action": "approvePurchaseOrder", "key": "PO-2609-0142"}]}).install(monkeypatch)
    out = ask.run({"text": "0142 승인해줘"}, KIM)
    assert out["pending"] and po_status() == ("20",)
