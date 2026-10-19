"""온톨로지 2: 이름 사전, 속성 추론, DB 스캔(객체·링크·병합 제안), 반영, 객체 생성. 브라우저와 서버 없이 돈다."""
import pytest

from app.ieum.onto import build, demo, dictionary as dic
from app.ieum.onto import conn as dbconn
from app.ieum.onto import profile, reader, scan, store


def connect(*names):
    for n in names:
        dbconn.create({"id": n, "dbms": "sqlite", "name": demo.INFO[n]["name"], "db": "demo:%s" % n})


def run_scan(cid, picked=lambda p: p["rec"] != "no", **kw):
    j = scan.start(cid, sync=True, **kw)
    v = scan.get(j["id"])
    assert v["state"] == "done", v["error"]
    res = scan.apply(j["id"], [p["id"] for p in v["proposals"] if picked(p)])
    return v, res


# ── 이름 사전 ──────────────────────────────────────────────────────────────

def test_dictionary_names_columns_and_tables():
    assert dic.col_names("TB_PO_MST", "PO_AMT") == ("발주 금액", "amount")
    assert dic.col_names("TB_PO_MST", "CHRG_EMP_NO") == ("담당자 사번", "ownerEmployeeId")
    assert dic.col_names("TB_PR_MST", "DEPT_CD") == ("요청 부서 코드", "departmentCode")      # 같은 컬럼 이름이라도 테이블에 따라 뜻이 다르다
    assert dic.col_names("TB_X", "FOO_AMT") == ("FOO 금액", "fooAmount")                      # 모르는 약어는 지어내지 않고 그대로 둔다
    assert dic.table_names("TB_PO_MST") == ("발주", "PurchaseOrder") and dic.table_names("V_EMP_INFO") == ("직원", "Employee")
    assert dic.mart_col_names("VEND_NM") == ("거래처명", "vendorName")                         # 마트에서는 이름 컬럼이 엔터티 접두를 유지한다
    assert dic.plural("PurchaseOrder") == "purchaseOrders" and dic.plural("Category") == "categories"
    assert dic.jo("거래처", "을", "를") == "거래처를" and dic.jo("발주", "을", "를") == "발주를" and dic.jo("부서", "은", "는") == "부서는" and dic.ro("승인") == "승인으로" and dic.ro("서울") == "서울로"


def test_masking_formats():
    assert dic.mask_value("phone", "010-4830-8830") == "010-****-8830"
    assert dic.mask_value("email", "hyunwoo.kim@hanbit.local") == "h******.kim@hanbit.local"
    assert dic.mask_value("biz", "123-45-67890") == "123-45-*****" and dic.mask_value("biz", "1234567890") == "123-45-*****"
    assert dic.mask_value("rrn", "900101-1234567") == "900101-*******"
    assert dic.mask_value("generic", "ab") == "a*" and dic.mask_value("phone", None) is None and dic.mask_value("phone", "") == ""


# ── 속성 추론 ──────────────────────────────────────────────────────────────

def test_profile_infers_types_flags_codes_and_hides_what_ai_should_not_see(ieum_state):
    connect("po")
    c = dbconn.get("po")
    sch = reader.read(c)
    book = profile.code_book(c, sch)
    by = {t["name"]: t for t in sch["tables"]}
    o = profile.profile_object(c, by["TB_PO_MST"], book)
    p = {x["col"]: x for x in o["props"]}
    assert o["id"] == "po.PurchaseOrder" and o["rows"] == 240 and profile.filter_text(o["filter"]) == "DEL_YN = 'N' (삭제된 행 제외)"
    assert p["PO_NO"]["flags"] == ["pk", "title", "search"] and p["PO_YMD"]["type"] == "date" and p["PO_YMD"]["ex"][0] == "2026-01-01"
    assert p["PO_AMT"]["type"] == "decimal" and p["PO_AMT"]["unit"] == "원" and p["PO_STTS_CD"]["type"] == "enum" and p["PO_STTS_CD"]["codes"]["20"] == "승인대기"
    assert p["PO_STTS_CD"]["note"] == "공통코드 PO_STTS" and p["REG_DT"]["type"] == "timestamp" and p["RMK"]["flags"] == ["search"]
    assert "hidden" in p["REG_ID"]["flags"] and "hidden" in p["APPR_LINE_XML"]["flags"] and "filter" in p["DEL_YN"]["flags"] and p["REG_ID"]["api"] == ""
    v = {x["col"]: x for x in profile.profile_object(c, by["TB_VEND_MST"], book)["props"]}
    assert v["BIZ_NO"]["mask"] == "biz" and "pii" not in v["BIZ_NO"]["flags"] and v["CHRG_TELNO"]["flags"] == ["mask", "pii"]
    assert v["BIZ_NO"]["ex"][0].endswith("*****") and v["TRD_STTS_CD"]["codes"] == {"Y": "거래 중", "N": "거래 중지"}
    b = {x["col"]: x for x in profile.profile_object(c, by["TB_BDGT"], book)["props"]}
    assert b["YYYY"]["type"] == "integer" and b["DEPT_CD"]["note"] == "복합 기본키" and not any("title" in x["flags"] for x in b.values())


def test_pii_detection_can_be_turned_off(ieum_state):
    connect("po")
    c = dbconn.get("po")
    sch = reader.read(c)
    by = {t["name"]: t for t in sch["tables"]}
    o = profile.profile_object(c, by["TB_VEND_MST"], profile.code_book(c, sch), pii=False)
    assert not any(p["mask"] for p in o["props"])


def test_table_roles(ieum_state):
    connect("po", "hr")
    for cid, expect in (("po", {"TB_PO_HIST": "history", "TB_CODE_DTL": "code", "TB_PO_DTL": "detail", "TB_RCV_DTL": "detail", "TB_PO_MST": "entity", "TB_WH_MST": "entity"}),
                        ("hr", {"TB_ATND_DAY": "fact", "TB_EMP_HIST": "history", "TB_JBGD_CD": "code", "TB_DEPT": "entity", "V_EMP_INFO": "entity"})):
        c = dbconn.get(cid)
        sch = reader.read(c)
        roles = scan._roles(sch, profile.code_book(c, sch))
        for t, role in expect.items():
            assert roles[t][0] == role, (cid, t, roles[t])
    assert roles["TB_EMP_MST"][0] == "covered"                              # 뷰가 기본 테이블의 키를 보여 주면 뷰가 객체다
    assert "V_EMP_INFO" in roles["TB_EMP_MST"][1]


# ── DB 스캔 ────────────────────────────────────────────────────────────────

def test_hr_scan_proposes_employee_view_and_department_with_the_view_join(ieum_state):
    connect("hr")
    v, res = run_scan("hr")
    titles = {p["title"] for p in v["proposals"]}
    assert titles == {"직원 (Employee)", "부서 (Department)", "직원 → 부서"}
    assert [s["state"] for s in v["steps"]] == ["ok"] * 7 and v["steps"][1]["result"] == "PK 5개, FK 2개"
    assert "TB_ATND_DAY" in v["skip"] and "마트로 집계" in v["skip"]
    emp = store.get_object("hr.Employee")
    assert emp["kind"] == "view" and emp["pk"] == ["EMP_NO"] and emp["status"] == "review" and emp["pos"]
    link = store.all_links()[0]
    assert (link["from"], link["to"], link["kind"], link["basis"], link["keyText"]) == ("hr.Employee", "hr.Department", "view", "뷰 정의의 조인 조건", "V_EMP_INFO.DEPT_CD = TB_DEPT.DEPT_CD")
    dept = next(p for p in emp["props"] if p["col"] == "DEPT_CD")
    assert "link" in dept["flags"] and dept["note"] == "부서 링크 키"            # 링크의 키 컬럼에 링크 키 특성이 달린다


def test_po_scan_finds_fk_inferred_and_cross_db_links_with_match_rates(ieum_state):
    connect("po", "hr")
    run_scan("hr")
    v, res = run_scan("po")
    objs = {p["title"] for p in v["proposals"] if p["kind"] == "객체"}
    assert objs == {"예산 (Budget)", "품목 (Item)", "발주 (PurchaseOrder)", "구매요청 (PurchaseRequest)", "입고 (GoodsReceipt)", "거래처 (Vendor)", "창고 (Warehouse)"}
    assert "하위 테이블 2개" in v["skip"]                                         # 상세 테이블은 부모 객체가 생긴 뒤에 제안한다
    links = {l["id"]: l for l in store.all_links()}
    by = {(l["from"], l["to"]): l for l in links.values()}
    assert by[("po.PurchaseOrder", "po.Vendor")]["basis"] == "FK 제약"
    pr = by[("po.PurchaseOrder", "po.PurchaseRequest")]
    assert pr["kind"] == "infer" and pr["basis"].startswith("추론: 값 일치율 98.") and pr["keyText"] == "TB_PO_MST.PR_NO = TB_PR_MST.PR_NO"
    owner = by[("po.PurchaseOrder", "hr.Employee")]
    assert owner["cross"] and owner["kind"] == "cross" and owner["api"] == "owner" and owner["rapi"] == "ownedPurchaseOrders" and owner["name"] == "담당자" and owner["rev"] == "담당 발주"
    assert by[("po.PurchaseRequest", "hr.Department")]["name"] == "요청 부서" and by[("po.GoodsReceipt", "hr.Employee")]["name"] == "검수자"
    assert ("po.GoodsReceipt", "po.Vendor") not in by                           # 발주를 거쳐 갈 수 있는 중복 관계는 권장하지 않아 반영에서 뺐다
    redundant = [p for p in v["proposals"] if p["rec"] == "no"]
    assert len(redundant) == 1 and "중복 관계" in redundant[0]["sub"]
    assert all(o["pos"] for o in store.conn_objects("po")) and len({tuple(o["pos"]) for o in store.conn_objects("po")}) == len(store.conn_objects("po"))


def test_second_scan_proposes_the_detail_tables_once_their_parents_exist(ieum_state):
    connect("po", "hr")
    run_scan("hr")
    run_scan("po")
    v, _ = run_scan("po")
    assert {p["title"] for p in v["proposals"] if p["kind"] == "객체"} == {"발주 품목 (PurchaseOrderLine)", "입고 상세 (GoodsReceiptLine)"}
    assert not v["skip"].count("하위 테이블")
    again = scan.start("po", sync=True)
    assert scan.get(again["id"])["proposals"] == [] and "새로 제안할 객체가 없어요" in scan.get(again["id"])["empty"]


def test_accounting_scan_matches_the_mockup_story_with_real_data(ieum_state):
    connect("po", "hr", "acc")
    run_scan("hr")
    run_scan("po")
    v, res = run_scan("acc")
    kinds = {p["kind"]: [x for x in v["proposals"] if x["kind"] == p["kind"]] for p in v["proposals"]}
    assert {p["title"] for p in kinds["객체"]} == {"계정과목 (Account)", "전표 (Voucher)"}
    merge = kinds["병합"][0]
    assert "기존 거래처" in merge["title"] and "ACC.TB_CUST" in merge["sub"] and "일치 37/40건" in merge["sub"]
    assert [p["rec"] for p in kinds["링크"]] == ["yes", "yes", "check"]           # 92% 는 확인 필요
    assert [s["result"] for s in v["steps"]][-1] == "병합 후보 1개"
    vendor = store.get_object("po.Vendor")
    assert vendor["mergeNote"] == "회계 ERP DB의 ACC.TB_CUST도 원본으로 사용" and vendor["alt"][0]["table"] == "ACC.TB_CUST"
    by = {(l["from"], l["to"]): l for l in store.all_links()}
    assert by[("acc.Voucher", "po.PurchaseOrder")]["basis"].startswith("DB 간 링크: 값 일치율 92.") and "비어 있는 값" in by[("acc.Voucher", "po.PurchaseOrder")]["basis"]
    assert "DB 간 링크라 확인이 필요합니다" in store.get_object("acc.Voucher")["reviewNote"]


def test_links_wait_for_their_objects_and_unselected_items_are_not_applied(ieum_state):
    connect("po", "hr")
    run_scan("hr")
    j = scan.start("po", sync=True)
    v = scan.get(j["id"])
    only_link = [p["id"] for p in v["proposals"] if p["kind"] == "링크" and p["title"].startswith("입고 → 창고")]
    res = scan.apply(j["id"], only_link)                                          # 객체 없이 링크만 고르면 건너뛰고 이유를 알린다
    assert res["links"] == [] and "객체도 함께" in res["skipped"][0]["why"] and not store.conn_objects("po")
    wh = [p["id"] for p in v["proposals"] if p["kind"] == "객체" and "Warehouse" in p["title"] or "GoodsReceipt" in p["title"]]
    res = scan.apply(j["id"], wh + only_link)
    assert len(res["objects"]) == 2 and len(res["links"]) == 1
    assert scan.apply(j["id"], wh + only_link)["objects"] == []                   # 두 번 반영해도 겹치지 않는다
    assert len([o for o in store.conn_objects("po")]) == 2


def test_relation_scan_follows_foreign_keys_one_step_from_the_start_table(ieum_state):
    connect("po", "hr")
    run_scan("hr")
    j = scan.start("po", mode="rel", start_table="TB_RCV_MST", sync=True)
    v = scan.get(j["id"])
    assert v["state"] == "done" and v["rel"]["start"]["table"] == "TB_RCV_MST"
    nodes = {n["table"]: n for n in v["rel"]["nodes"]}
    assert set(nodes) >= {"TB_PO_MST", "TB_WH_MST", "TB_VEND_MST", "TB_RCV_DTL", "V_EMP_INFO"} and nodes["TB_RCV_DTL"]["via"] == "하위 테이블" and nodes["V_EMP_INFO"]["object"]
    assert {p["title"] for p in v["proposals"] if p["kind"] == "객체"} == {"입고 (GoodsReceipt)", "발주 (PurchaseOrder)", "창고 (Warehouse)", "거래처 (Vendor)"}
    with pytest.raises(scan.ScanError):
        scan.start("po", mode="rel", start_table="")
    bad = scan.get(scan.start("po", mode="rel", start_table="NOPE", sync=True)["id"])
    assert bad["state"] == "error" and "NOPE" in bad["error"]


def test_scan_without_sampling_uses_only_foreign_keys_and_view_joins(ieum_state):
    connect("po", "hr")
    run_scan("hr")
    j = scan.start("po", sample=False, sync=True)
    v = scan.get(j["id"])
    assert v["steps"][3]["result"].startswith("건너뜀")
    assert all(l["kind"] == "fk" for l in scan._POOL[j["id"]]["links"].values())          # 값 일치 링크는 표본이 있어야 찾는다


def test_tables_already_used_by_marts_are_skipped_by_the_scan(onto):
    from app.ieum.onto import marts
    assert "TB_PO_MST" in {t for m in store.all_marts().values() for t in marts_tables(m)}
    use = scan.table_use(dbconn.get("po"))
    assert use["TB_PO_MST"]["objs"][0][1] == "발주" and use["TB_PO_MST"]["marts"] and use["TB_PO_DTL"]["marts"]


def marts_tables(m):
    return scan.mart_tables({"alias": "PO"}, m["sql"])


# ── 객체 생성 ──────────────────────────────────────────────────────────────

def test_source_table_list_marks_usage_and_why_not(onto):
    t = build.source_tables("po")
    rows = {r["name"]: r for r in t["tables"]}
    assert t["total"] == 11 and rows["TB_PO_MST"]["objs"] and not rows["TB_PO_MST"]["ok"] and "이미 발주 객체의 원본" in rows["TB_PO_MST"]["why"]
    assert rows["TB_RCV_MST"]["ok"] and rows["TB_PO_HIST"]["tag"] == "이력" and rows["TB_CODE_DTL"]["tag"] == "코드"
    assert "이력 테이블" in rows["TB_PO_HIST"]["why"] and "부모 테이블" in rows["TB_RCV_DTL"]["why"] and rows["TB_VEND_MST"]["marts"] == [["mart_vendor_monthly", "거래처 월별 발주 실적"]]
    assert t["used"] + t["unused"] == 11


def test_object_wizard_draft_candidates_and_create_from_a_table(onto):
    d = build.draft("po", "table", "TB_RCV_MST")
    assert (d["name"], d["api"], d["pk"], d["title"]) == ("입고", "GoodsReceipt", ["RCV_NO"], "RCV_NO") and d["sourceLabel"] == "원본 테이블 PO.TB_RCV_MST, 102행"
    cands = {c["to"]: c for c in d["links"]}
    assert set(cands) == {"po.PurchaseOrder", "po.Vendor", "hr.Employee"} and cands["hr.Employee"]["cross"] and cands["po.PurchaseOrder"]["rec"] and not cands["po.Vendor"]["rec"]
    assert "발주" in cands["po.Vendor"]["sub"] and "중복 관계" in cands["po.Vendor"]["sub"]
    o = build.create("po", {"src": "table", "pick": "TB_RCV_MST", "name": "입고 건", "api": "GoodsReceipt", "desc": "입고", "include": [c["c"] for c in d["cols"] if not c["sys"]],
                            "pk": ["RCV_NO"], "title": "RCV_NO", "names": {"RCV_YMD": "입고한 날"}, "links": [cands["po.PurchaseOrder"]["key"], cands["hr.Employee"]["key"]]})
    assert o["id"] == "po.GoodsReceipt" and o["status"] == "review" and o["name"] == "입고 건" and next(p for p in o["props"] if p["col"] == "RCV_YMD")["name"] == "입고한 날"
    assert o["pos"] and {l["to"] for l in store.object_links(o["id"])} == {"po.PurchaseOrder", "hr.Employee"} and "DB 간 링크라" in o["reviewNote"]
    with pytest.raises(build.BuildError):
        build.create("po", {"src": "table", "pick": "TB_RCV_MST", "name": "x", "api": "GoodsReceipt2", "pk": ["RCV_NO"]})        # 이미 객체의 원본이다


def test_object_creation_validates_names_keys_and_uniqueness(onto):
    base = {"src": "table", "pick": "TB_WH_MST", "name": "창고", "api": "Warehouse", "pk": ["WH_CD"]}
    for patch, text in (({"name": " "}, "표시 이름"), ({"api": "1bad"}, "API 이름은"), ({"api": "PurchaseOrder"}, "같은 API 이름"), ({"pk": []}, "기본키를 하나")):
        with pytest.raises(build.BuildError) as e:
            build.create("po", dict(base, **patch))
        assert text in str(e.value), patch
    with pytest.raises(build.BuildError) as e:                                     # 값이 겹치는 컬럼은 기본키가 될 수 없다
        build.create("po", dict(base, pk=["USE_YN"]))
    assert "구별할 수 없어요" in str(e.value)
    assert build.check_key("po", "TB_WH_MST", ["WH_CD"])["unique"] and not build.check_key("po", "TB_PO_MST", ["VEND_CD"])["unique"]
    with pytest.raises(build.BuildError):
        build.check_key("po", "TB_WH_MST", ["NOPE"])


def test_object_review_publish_toggle_and_edits(onto):
    pr = store.get_object("po.PurchaseRequest")
    assert pr["status"] == "review"
    done = build.finish_review("po.PurchaseRequest")
    assert done["status"] == "pub" and done["reviewNote"] == ""
    links = {l["id"]: l for l in store.object_links("po.PurchaseRequest")}
    assert {l["status"] for l in links.values() if l["to"] == "po.PurchaseOrder" or l["from"] == "po.PurchaseOrder"} == {"pub"}      # 양쪽이 공개인 링크는 함께 공개된다
    assert build.set_ai("po.PurchaseRequest", False)["aiOff"] is True and build.set_ai("po.PurchaseRequest", True)["aiOff"] is False
    store.update_object("po.PurchaseOrder", lambda o: o.update(status="draft"))
    with pytest.raises(build.BuildError):                                           # 공개하지 않은 객체는 AI 공개를 켜고 끌 수 없다
        build.set_ai("po.PurchaseOrder", True)
    p = build.update_prop("po.Vendor", "CEO_NM", {"name": "대표", "api": "ceo", "note": "대표 이사"})
    assert next(x for x in p["props"] if x["col"] == "CEO_NM")["name"] == "대표"
    for patch, text in (({"name": ""}, "표시 이름"), ({"api": "bad name"}, "API 이름은"), ({"api": "name"}, "같은 API 이름")):
        with pytest.raises(build.BuildError) as e:
            build.update_prop("po.Vendor", "CEO_NM", patch)
        assert text in str(e.value)
    l = build.update_link(next(iter(links)), {"name": "새 이름", "rev": "되돌아오는 이름", "api": "renamed", "rapi": "backRef"})
    assert (l["name"], l["api"], l["rapi"]) == ("새 이름", "renamed", "backRef")
    with pytest.raises(build.BuildError):
        build.update_link("nope", {"name": "x"})
