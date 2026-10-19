"""온톨로지 3: 질의 엔진(검색, 한 건, 집계, 링크 따라가기), 권한(행·속성), 실행 사용자 확인. 목업의 숫자가 진짜 쿼리로 나오는지 본다."""
import pytest

from app.ieum.onto import perm, query, store


def ctx(emp=None, admin=False):
    return query.Ctx.live(user=perm.identify(emp) if emp else None, admin=admin)


KIM, HONG = "20150301", "20190412"


def test_users_are_identified_through_the_employee_object(onto):
    kim = perm.identify(KIM)
    assert (kim["name"], kim["dept"], kim["deptName"], kim["rank"], kim["rankNo"]) == ("김현우", "D4010", "구매팀", "팀장", 4)
    assert perm.identify(HONG)["rankNo"] == 2 and perm.identify("99999999") is None and perm.identify("") is None
    store.save_settings({"identity": {}})
    assert perm.identify(KIM) is None                                              # 연결 설정이 없으면 확인하지 못한다


def test_search_translates_codes_dates_numbers_and_masks_values(onto):
    c = ctx(admin=True)
    r = query.search(c, "po.PurchaseOrder", {"status": "승인대기", "orderDate": {"between": ["2026-09-01", "2026-09-30"]}, "vendorCode": "V0012"}, 10)
    assert r["total"] == 3 and [x["poNumber"] for x in r["rows"]] == ["PO-2609-0118", "PO-2609-0131", "PO-2609-0142"]
    row = r["rows"][2]
    assert row["status"] == "승인대기" and row["orderDate"] == "2026-09-26" and row["amount"] == 4850000 and row["deliveryDate"] == "2026-10-10" and row["createdAt"].startswith("2026-09-26")
    assert "REG_ID" not in str(row) and "APPR_LINE" not in str(row)                  # 비공개 속성은 나가지 않는다
    v = query.search(c, "po.Vendor", {"name": {"contains": "한빛상사"}})["rows"][0]
    assert v["businessNumber"] == "123-45-*****" and v["contactPhone"] == "010-****-8830" and v["status"] == "거래 중"
    assert "WHERE po.DEL_YN = 'N'" in r["sql"] and ":status" in r["sql"] and "-- 승인대기 (코드 20)" in r["sql"]      # 객체 필터가 늘 붙고 SQL 을 보여 줄 수 있다


def test_conditions_accept_ranges_lists_prefixes_and_reject_bad_values(onto):
    c = ctx(admin=True)
    assert query.search(c, "po.Vendor", {"name": {"startsWith": "한빛"}})["total"] == 2
    assert query.search(c, "po.Vendor", {"vendorCode": ["V0012", "V0007"]})["total"] == 2
    assert query.search(c, "po.PurchaseOrder", {"amount": {"gte": 40000000}})["total"] >= 1
    assert query.search(c, "po.PurchaseOrder", {"remark": {"isNull": True}})["total"] >= 0
    for where, text in (({"status": "없는상태"}, "중 하나여야"), ({"orderDate": "어제"}, "날짜"), ({"nope": 1}, "속성이 없어요"), ({"amount": {"gt": "많이"}}, "숫자"), ({"status": {"weird": 1}}, "알 수 없어요"),
                        ({"name": {"contains": " "}}, "검색어")):
        with pytest.raises(query.OntoQueryError) as e:
            query.search(c, "po.Vendor" if "name" in where else "po.PurchaseOrder", where)
        assert text in str(e.value), where
    assert query.search(c, "po.Vendor", {"name": {"contains": "%"}})["total"] == 0          # LIKE 와일드카드는 이스케이프된다
    with pytest.raises(query.OntoQueryError):
        query.search(c, "po.Nope")


def test_get_by_primary_key_including_composite_keys(onto):
    c = ctx(admin=True)
    assert query.get(c, "po.PurchaseOrder", "PO-2609-0142")["row"]["amount"] == 4850000
    assert query.get(c, "po.PurchaseOrder", "NOPE")["row"] is None
    line = query.get(c, "po.PurchaseOrderLine", "PO-2609-0142|2")["row"]
    assert line["lineNo"] == 2 and line["itemCode"] == "P-20410" and line["quantity"] == 10
    assert query.get(c, "po.Budget", {"departmentCode": "D4010", "fiscalYear": 2026})["row"]["used"] == 21450000
    with pytest.raises(query.OntoQueryError):
        query.get(c, "po.PurchaseOrderLine", "only-one")


def test_aggregate_and_group_by(onto):
    c = ctx(admin=True)
    r = query.aggregate(c, "po.PurchaseOrder", {"vendorCode": "V0012"}, [{"fn": "count", "as": "n"}, {"fn": "sum", "prop": "amount", "as": "total"}, {"fn": "max", "prop": "amount", "as": "top"}])
    assert r["result"]["n"] == 42 and r["result"]["total"] > r["result"]["top"] > 0 and r["sql"].startswith("SELECT COUNT(*) AS n, SUM(po.PO_AMT) AS total, MAX(po.PO_AMT) AS top")
    g = query.aggregate(c, "po.PurchaseOrder", None, [{"fn": "count"}], ["status"])
    assert {x["status"] for x in g["rows"]} == {"작성", "승인대기", "승인", "취소"} and sum(x["count"] for x in g["rows"]) == 240
    with pytest.raises(query.OntoQueryError):
        query.aggregate(c, "po.Vendor", None, [{"fn": "sum", "prop": "name"}])        # 숫자가 아닌 속성의 합계
    with pytest.raises(query.OntoQueryError):
        query.aggregate(c, "po.Vendor", None, [{"fn": "median"}])


def test_follow_links_inside_and_across_databases(onto):
    c = ctx(admin=True)
    v = query.Q(c, c.obj("po.Vendor")).where({"name": {"contains": "한빛상사"}})
    pos = v.follow("purchaseOrders")
    assert pos.count() == 42 and pos.obj["id"] == "po.PurchaseOrder"
    assert pos.where({"status": "승인대기", "orderDate": {"between": ["2026-09-01", "2026-09-30"]}}).count() == 3
    # 다른 DB: 직원(인사 DB) -> 부서(인사 DB) -> 예산(구매관리 DB)
    me = query.Q(c, c.obj("hr.Employee")).where_key(KIM)
    budget = me.follow("department").follow("budgets")
    assert [(x["fiscalYear"], x["used"]) for x in query.search(c, "po.Budget", None, 10, 0, None, None, budget)["rows"]][-1] == (2026, 21450000)
    back = query.Q(c, c.obj("po.Vendor")).where_key("V0012").follow("purchaseOrders").follow("owner")           # 발주 -> 담당자(인사 DB)
    assert back.count() >= 1 and back.obj["id"] == "hr.Employee"
    with pytest.raises(query.OntoQueryError) as e:
        query.Q(c, c.obj("po.Vendor")).follow("nope")
    assert "있는 링크" in str(e.value)
    many = query.Q(c, c.obj("po.PurchaseOrder"))                                  # 키가 너무 많으면 좁히라고 알린다
    old = query.MAX_KEYS
    try:
        query.MAX_KEYS = 5
        with pytest.raises(query.OntoQueryError) as e:
            many.follow("lines")
        assert "좁혀" in str(e.value)
    finally:
        query.MAX_KEYS = old


def test_row_permissions_narrow_what_a_user_can_see(onto):
    kim, hong = ctx(KIM), ctx(HONG)
    assert query.Q(kim, kim.obj("po.PurchaseOrder")).count() == 240                 # 구매팀: 모든 발주
    n = query.Q(hong, hong.obj("po.PurchaseOrder")).count()
    assert 0 < n < 240                                                              # 인사팀: 인사팀이 요청한 발주만
    sql = query.aggregate(hong, "po.PurchaseOrder")["sql"]
    assert "JOIN PO.TB_PR_MST pr ON pr.PR_NO = po.PR_NO" in sql and "pr.DEPT_CD = :user_dept" in sql and "D1030" in sql
    nobody = ctx()                                                                  # 사용자를 확인하지 못하면 권한 규칙이 있는 객체는 비어 있다
    assert query.Q(nobody, nobody.obj("po.PurchaseOrder")).count() == 0
    assert query.Q(nobody, nobody.obj("po.Vendor")).count() == 40                   # 규칙이 없는 객체는 그대로


def test_property_permissions_hide_values_and_block_conditions(onto):
    hong, kim = ctx(HONG), ctx(KIM)
    r = query.search(hong, "po.PurchaseOrder", {"status": "승인대기"}, 3)
    assert r["hidden"] == [{"prop": "amount", "name": "발주 금액", "why": "구매팀 또는 팀장 이상만"}] and all("amount" not in x for x in r["rows"]) and "remark" in r["rows"][0]
    assert query.search(kim, "po.PurchaseOrder", {"status": "승인대기"}, 3)["hidden"] == []
    for call in (lambda: query.search(hong, "po.PurchaseOrder", {"amount": {"gt": 1000}}), lambda: query.search(hong, "po.PurchaseOrder", None, 5, 0, [{"prop": "amount"}])):
        with pytest.raises(query.Denied) as e:
            call()
        assert "볼 수 있어서" in str(e.value)                                        # 값을 가리는 속성은 조건·정렬로 새어 나가지 못한다
    agg = query.aggregate(hong, "po.PurchaseOrder", None, [{"fn": "count", "as": "cnt"}, {"fn": "sum", "prop": "amount", "as": "total"}])
    assert "total" not in agg["rows"][0] and agg["hidden"][0]["prop"] == "amount" and agg["rows"][0]["cnt"] > 0


def test_row_dependent_property_permission_shows_values_only_for_the_users_own_rows(onto):
    hong = ctx(HONG)
    own = query.get(hong, "po.Budget", {"departmentCode": "D1030", "fiscalYear": 2026})["row"]
    assert own["budget"] == 12000000 and own["used"] == 7380000
    rows = query.search(hong, "po.Budget", None, 50)["rows"]
    assert rows and {r["departmentCode"] for r in rows} == {"D1030"}                # 행 권한: 자기 부서 예산만
    assert "CASE WHEN b.DEPT_CD = :user_dept THEN b.BDGT_AMT END" in query.search(hong, "po.Budget", None, 1)["sql"]
    kim = ctx(KIM)
    assert {r["departmentCode"] for r in query.search(kim, "po.Budget", None, 50)["rows"]} > {"D4010", "D1030"}


def test_admin_view_applies_masking_but_not_permissions(onto):
    c = ctx(admin=True)
    assert query.Q(c, c.obj("po.PurchaseOrder")).count() == 240
    assert query.get(c, "hr.Employee", KIM)["row"]["email"] == "h******.kim@hanbit.local"


def test_instance_view_lists_linked_objects_with_counts(onto):
    inst = query.instance(ctx(admin=True), "po.PurchaseOrder", "PO-2609-0142")
    assert inst["title"] == "PO-2609-0142" and inst["table"] == "PO.TB_PO_MST"
    links = {l["api"]: l for l in inst["links"]}
    assert links["vendor"]["items"][0]["title"] == "한빛상사" and links["lines"]["total"] == 4 and links["owner"]["cross"] and links["owner"]["items"][0]["title"] == "김현우"
    amt = next(p for p in inst["props"] if p["name"] == "발주 금액")
    assert amt["value"] == 4850000 and amt["unit"] == "원"
    lst = query.instances(ctx(admin=True), "po.Vendor", "한빛")
    assert [x["title"] for x in lst] == ["한빛상사", "한빛정보통신"]
    assert query.instances(ctx(admin=True), "po.Budget", "")[0]["title"] == "D1000 · 2025"          # 복합 키는 값을 이어 제목으로 쓴다


def test_perm_rules_validation(onto):
    obj = store.get_object("po.PurchaseOrder")
    assert perm.validate(obj, None) is None
    ok = perm.validate(obj, {"rows": [{"label": "모두", "text": "모든 행", "when": [], "scope": None}], "props": [{"col": "PO_AMT", "label": "금액", "text": "x", "allow": [{}]}]})
    assert ok["rows"][0]["label"] == "모두"
    for bad, text in (({"rows": [{"label": "", "text": ""}]}, "이름과 설명"), ({"rows": [{"label": "a", "text": "b", "scope": {"col": "NOPE", "user": "dept"}}]}, "컬럼"),
                      ({"rows": [{"label": "a", "text": "b", "scope": {"col": "VEND_CD", "user": "shoe"}}]}, "사용자 속성"), ({"props": [{"col": "NOPE"}]}, "컬럼")):
        with pytest.raises(perm.PermError) as e:
            perm.validate(obj, bad)
        assert text in str(e.value), bad
