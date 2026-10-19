"""온톨로지 6: 콘솔 API(/api/ieum/onto). 화면이 부르는 것들이 봉투 형식과 상태 코드를 지키고, 오류는 읽을 수 있는 문장으로 오는지 본다."""
import pytest

from app.ieum.onto import store


@pytest.fixture
def api(console, onto):
    def call(method, path, body=None):
        return console.api(method, "/onto" + path, body)
    call.console = console
    return call


def test_overview_lists_connections_with_counts_and_the_unconnected_demo_database(api):
    st, d = api("GET", "/")
    assert st == 200 and [c["id"] for c in d["conns"]] == ["po", "hr"] and d["demo"] and d["asOf"] == "2026-09-30"
    po = d["conns"][0]
    assert (po["objects"], po["pub"], po["marts"], po["published"], po["dbmsLabel"]) == (6, 5, 3, 1, "SQLite (시연용, 파일)") and "password" not in po
    assert {x["id"]: x["used"] for x in d["demoDbs"]} == {"demo:po": True, "demo:hr": True, "demo:acc": False}
    assert any(x["id"] == "tibero" and not x["available"] and x["hint"] for x in d["dbms"]) and d["llm"] is False


def test_graph_returns_objects_links_and_the_other_ends_of_cross_links(api):
    st, g = api("GET", "/connections/po/graph")
    assert st == 200 and len(g["objects"]) == 6 and len(g["links"]) == 8
    assert set(g["others"]) == {"hr.Department", "hr.Employee"} and g["others"]["hr.Employee"]["connName"] == "인사 DB"
    po = next(o for o in g["objects"] if o["id"] == "po.PurchaseOrder")
    assert po["status"] == "pub" and po["filterText"].startswith("DEL_YN = 'N'") and any("perm" in p["flags"] for p in po["props"] if p["col"] == "PO_AMT") and po["perm"]["rows"][0]["label"] == "구매팀"
    assert [a["api"] for a in po["actions"]] == ["approvePurchaseOrder", "createPurchaseOrder"] and po["actions"][0]["via"] == "POST /poApprove.do" and po["actions"][0]["connected"]
    st, one = api("GET", "/objects/po.PurchaseOrder")
    assert st == 200 and len(one["links"]) == 4 and api("GET", "/objects/po.Nope")[0] == 404


def test_preview_simulation_and_tools_for_an_object(api):
    st, pv = api("GET", "/objects/po.Vendor/preview")
    assert st == 200 and len(pv["rows"]) == 3 and pv["rows"][0]["vendorCode"] == "V0007" and "SELECT" in pv["sql"] and pv["sample"]
    st, sim = api("GET", "/objects/po.PurchaseOrder/simulate?emp=20190412")
    assert st == 200 and sim["total"] == 240 and 0 < sim["rows"] < 240 and sim["props"] == {"PO_AMT": False, "RMK": True} and sim["policy"]["label"] == "그 외 직원"
    assert api("GET", "/objects/po.PurchaseOrder/simulate?emp=000")[0] == 400
    st, tl = api("GET", "/objects/po.PurchaseOrder/tools")
    names = [t["name"] for t in tl["tools"]]
    assert st == 200 and tl["published"] and names[:3] == ["search_purchase_orders", "get_purchase_order", "aggregate_purchase_orders"] and "approve_purchase_order" in names and "purchase_order__vendor" in names
    search = tl["tools"][0]
    assert search["inputSchema"]["properties"]["status"]["enum"] == ["작성", "승인대기", "승인", "취소"] and "orderDateFrom" in search["inputSchema"]["properties"] and search["annotations"] == {"readOnlyHint": True}
    approve = next(t for t in tl["tools"] if t["name"] == "approve_purchase_order")
    assert approve["mode"] == "w" and "confirm" in approve["inputSchema"]["properties"] and approve["inputSchema"]["required"] == ["poNumber"]


def test_explore_list_and_instance(api):
    st, lst = api("GET", "/connections/po/instances?type=po.Vendor&q=한빛")
    assert st == 200 and [x["title"] for x in lst["items"]] == ["한빛상사", "한빛정보통신"] and lst["items"][0]["oid"] == "po.Vendor"
    st, all_ = api("GET", "/connections/po/instances")
    assert st == 200 and {x["type"] for x in all_["items"]} == {"발주", "발주 품목", "품목", "거래처", "예산", "구매요청"} and all_["items"][0]["type"] == "발주"          # 링크가 많은 객체부터
    st, inst = api("GET", "/objects/po.PurchaseOrder/instances/PO-2609-0142")
    assert st == 200 and inst["object"]["connName"] == "구매관리 DB" and next(l for l in inst["links"] if l["api"] == "owner")["toConnName"] == "인사 DB"
    assert api("GET", "/objects/po.PurchaseOrder/instances/NOPE")[0] == 400


def test_review_and_edit_endpoints(api):
    link = next(l for l in api("GET", "/connections/po/graph")[1]["links"] if l["status"] != "pub")                 # 구매요청이 검토 중이라 공개가 아닌 링크
    st, o = api("POST", "/objects/po.PurchaseRequest/review")
    assert st == 200 and o["status"] == "pub"
    st, o = api("POST", "/objects/po.PurchaseRequest/ai", {"on": False})
    assert o["aiOff"] is True
    assert api("PATCH", "/objects/po.Vendor", {"name": "공급사"})[1]["name"] == "공급사"
    assert api("PATCH", "/objects/po.Vendor/props/CEO_NM", {"name": "대표자 이름"})[0] == 200 and api("PATCH", "/objects/po.Vendor/props/CEO_NM", {"api": "name"})[0] == 400
    assert api("POST", "/links/%s/review" % link["id"])[1]["status"] == "pub" and api("PATCH", "/links/%s" % link["id"], {"name": ""})[0] == 400
    st, o = api("PUT", "/objects/po.Vendor/perm", {"rows": [{"label": "모두", "text": "모든 행", "when": [], "scope": None}], "props": []})
    assert st == 200 and o["perm"]["rows"][0]["label"] == "모두" and api("PUT", "/objects/po.Vendor/perm", {"rows": [{"label": "", "text": ""}]})[0] == 400


def test_settings_validation(api):
    assert api("PUT", "/settings", {"asOf": "2026-10-15", "ranks": ["사원", "대리"], "askUsers": ["20150301"]})[1]["asOf"] == "2026-10-15"
    for body in ({"asOf": "어제"}, {"ranks": []}, {"identity": {"object": "po.Nope", "id": "X"}}, {"identity": {"object": "hr.Employee", "id": "NOPE"}}):
        assert api("PUT", "/settings", body)[0] == 400, body
    assert api("PUT", "/settings", {"identity": {}})[0] == 200


def test_connection_endpoints(api):
    st, t = api("POST", "/connections/test", {"dbms": "sqlite", "name": "x", "db": "demo:acc"})
    assert st == 200 and t["ok"] and t["tables"] == 6
    assert api("POST", "/connections/test", {"dbms": "tibero", "name": "x", "host": "h", "db": "d", "user": "u"})[1]["ok"] is False
    st, c = api("POST", "/connections", {"dbms": "sqlite", "name": "회계 ERP DB", "db": "demo:acc", "mode": "sync"})
    assert st == 201 and c["id"] == "acc" and c["mode"] == "sync" and c["objects"] == 0
    assert api("POST", "/connections", {"dbms": "sqlite", "name": "또", "db": "demo:acc"})[0] == 400                   # 같은 별칭
    st, tb = api("GET", "/connections/acc/tables")
    assert st == 200 and tb["total"] == 6 and tb["used"] == 0 and api("GET", "/connections/nope/tables")[0] == 400
    assert api("PUT", "/connections/acc", {"name": "회계", "mode": "live"})[1]["name"] == "회계"
    assert api("POST", "/connections/acc/check-key", {"table": "TB_ACCT_CD", "cols": ["ACCT_CD"]})[1]["unique"]
    assert api("DELETE", "/connections/acc")[0] == 200 and api("GET", "/connections/acc")[0] == 400


def test_scan_job_over_the_api_then_object_wizard_endpoints(api):
    st, c = api("POST", "/connections", {"dbms": "sqlite", "name": "회계 ERP DB", "db": "demo:acc"})
    st, job = api("POST", "/connections/acc/scans", {"mode": "all", "sample": True, "pii": True})
    assert st == 201 and job["state"] in ("running", "done")
    import time
    for _ in range(200):
        st, job = api("GET", "/scans/%s" % job["id"])
        if job["state"] != "running":
            break
        time.sleep(0.05)
    assert job["state"] == "done" and {p["kind"] for p in job["proposals"]} == {"객체", "링크", "병합"} and "names" in job and "po.Vendor" in job["existing"]
    st, res = api("POST", "/scans/%s/apply" % job["id"], {"picked": [p["id"] for p in job["proposals"] if p["rec"] == "yes"]})
    assert st == 200 and sorted(res["objects"]) == ["acc.Account", "acc.Voucher"] and len(res["links"]) == 2 and res["merges"] == ["po.Vendor"]
    assert api("GET", "/scans/nope")[0] == 400 and api("POST", "/scans/nope/apply", {"picked": []})[0] == 400
    st, d = api("GET", "/connections/po/draft?src=table&pick=TB_RCV_MST")
    assert st == 200 and d["api"] == "GoodsReceipt" and api("GET", "/connections/po/draft?src=table&pick=TB_PO_MST")[0] == 400
    st, o = api("POST", "/connections/po/objects", {"src": "table", "pick": "TB_WH_MST", "name": "창고", "api": "Warehouse", "pk": ["WH_CD"], "links": []})
    assert st == 201 and o["status"] == "review" and api("POST", "/connections/po/objects", {"src": "table", "pick": "TB_WH_MST", "name": "창고", "api": "Warehouse2", "pk": ["WH_CD"]})[0] == 400


def test_mart_endpoints(api):
    st, tree = api("GET", "/marts/schema")
    assert st == 200 and [g["alias"] for g in tree] == ["PO", "HR", "MART"] and "mart_vendor_monthly" in [t["name"] for t in tree[2]["tables"]]
    sql = "SELECT d.DEPT_CD AS DEPT_CD, d.DEPT_NM AS DEPT_NM FROM HR.TB_DEPT d"
    st, v = api("POST", "/marts/validate", {"conn": "hr", "sql": sql})
    assert st == 200 and v["stat"]["rows"] == 10 and api("POST", "/marts/validate", {"conn": "hr", "sql": "DROP TABLE x"})[1]["err"].startswith("읽기 전용")
    st, m = api("POST", "/connections/hr/marts", {"id": "mart_depts", "name": "부서 목록", "sql": sql, "refresh": "manual", "owner": "김현우"})
    assert st == 201 and m["home"] == "hr" and m["status"] in ("building", "ok", "idle")
    import time
    for _ in range(100):
        st, m = api("GET", "/marts/mart_depts")
        if m["status"] != "building":
            break
        time.sleep(0.05)
    assert m["status"] == "ok" and m["rows"] == 10 and m["refreshLabel"] == "수동" and m["dbs"] == ["HR"]
    assert api("POST", "/marts/mart_depts/build", {})[1]["status"] in ("building", "ok")
    assert api("POST", "/connections/hr/marts", {"id": "mart_depts", "name": "또", "sql": sql, "refresh": "manual"})[0] == 400
    time.sleep(0.3)
    assert api("DELETE", "/marts/mart_depts")[0] == 200 and api("GET", "/marts/mart_depts")[0] == 404
    st, lst = api("GET", "/connections/po/marts")
    assert st == 200 and {x["id"] for x in lst} == {"mart_vendor_monthly", "mart_dept_budget", "mart_item_price_trend"} and lst[0]["objName"] is None


def test_publish_versions_and_ask_endpoints(api):
    st, p = api("GET", "/connections/po/publish")
    assert st == 200 and p["ver"] == 2 and len(p["pub"]) == 5 and [r["name"] for r in p["rest"]] == ["구매요청"] and p["tools"] == 25
    st, r = api("POST", "/connections/po/publish", {"by": "김현우"})
    assert st == 201 and r["ver"] == 2 and r["mcp"] == {"state": "off"}                      # 서버를 띄우지 않게 한 환경
    st, vs = api("GET", "/connections/po/versions")
    assert [v["ver"] for v in vs] == [2, 1] and vs[0]["by"] == "김현우" and "snapshot" not in vs[0]
    st, a = api("GET", "/ask")
    assert st == 200 and len(a["questions"]) == 3 and [u["emp"] for u in a["users"]] == ["20150301", "20190412"]
    st, out = api("POST", "/ask/run", {"id": "q2", "emp": "20150301"})
    assert st == 200 and out["answer"].startswith("구매팀의 2026년")
    assert api("POST", "/ask/run", {"id": "q2", "emp": "000"})[0] == 400 and api("POST", "/ask/run", {"text": "x", "emp": "20150301"})[0] == 400
    store.versions.save({})
    assert api("POST", "/connections/hr/publish", {})[0] == 201                              # 공개 객체가 있으니 된다
    store.update_object("hr.Employee", lambda o: o.update(status="review"))
    store.update_object("hr.Department", lambda o: o.update(status="review"))
    assert api("POST", "/connections/hr/publish", {})[0] == 400


def test_demo_load_and_reset_data(api, monkeypatch):
    st, msg = api("POST", "/demo/load")
    assert st == 400 and "force=true" in msg and store.conn_objects("po")                 # 이미 있으면 지우지 않는다
    st, d = api("POST", "/demo/load?force=true")
    assert st == 200 and [c["id"] for c in d["conns"]] == ["po", "hr"]
    st, d = api("POST", "/demo/reset-data")
    assert st == 200 and d["conns"][0]["marts"] == 3


def test_deleting_a_connection_removes_its_ontology_and_marts(api):
    assert api("DELETE", "/connections/po")[0] == 200
    assert not store.conn_objects("po") and store.all_marts() == {} and "po" not in store.versions.load()
    assert all(l["from"] != "po.PurchaseOrder" and l["to"] != "po.PurchaseOrder" for l in store.all_links())
