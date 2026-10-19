"""온톨로지 7: 공개한 온톨로지가 진짜 MCP 서버 프로세스로 떠서 AI 도구로 쓰이는지. 프로세스를 띄워 몇 초 걸린다."""
import json
import time

import httpx
import pytest

from app.ieum.onto import mcp, publish, query, store
from app.ieum.repositories import deploy as repo
from app.ieum.runtime import manifest


@pytest.fixture
def served(onto, monkeypatch):
    """구매관리 온톨로지의 MCP 서버를 띄운다. (주소, 호출 함수, 키 만드는 함수)"""
    monkeypatch.setenv("IEUM_ONTO_AUTOSERVE", "1")
    rt = mcp.reflect("po")
    assert rt["state"] == "running", rt
    state = {"url": rt["url"]}

    def rpc(secret, method, params=None, i=1):
        r = httpx.post(state["url"], headers={"Authorization": "Bearer " + secret}, json={"jsonrpc": "2.0", "id": i, "method": method, "params": params or {}}, timeout=30, trust_env=False)
        return r.status_code, r.json() if r.content else None

    def key(emp="", name="시험"):
        return repo.create_key(name, [mcp.ts_id("po")], emp)[1]
    return state, rpc, key


def call(rpc, secret, tool, args=None):
    st, j = rpc(secret, "tools/call", {"name": tool, "arguments": args or {}})
    assert st == 200
    res = j["result"]
    return res["isError"], (res["structuredContent"] if not res["isError"] else res["content"][0]["text"])


def test_published_ontology_becomes_a_running_server_with_tools_from_the_objects(served):
    state, rpc, key = served
    secret = key(emp="20150301")
    st, j = rpc(secret, "initialize", {"protocolVersion": "2025-06-18"})
    assert st == 200 and j["result"]["serverInfo"]["name"] == "ieum-onto-po" and j["result"]["serverInfo"]["version"] == "1"
    names = [t["name"] for t in rpc(secret, "tools/list")[1]["result"]["tools"]]
    assert len(names) == 25 and {"search_purchase_orders", "aggregate_vendors", "purchase_order__vendor", "vendor__purchase_orders", "approve_purchase_order", "create_purchase_order"} <= set(names)
    assert "purchase_order__purchase_request" not in names and not any("." in n for n in names)               # 검토 중인 객체의 링크는 없고, 이름에 점이 없다
    h = httpx.get(state["url"].replace("/mcp", "/health"), trust_env=False).json()
    assert h["toolset"] == "ts-onto-po" and h["version"] == "v1" and h["tools"] == 25


def test_tool_calls_apply_the_keys_run_as_user(served):
    state, rpc, key = served
    kim, hong, nobody = key("20150301"), key("20190412"), key("")
    where = {"status": "승인대기", "orderDateFrom": "2026-09-01", "orderDateTo": "2026-09-30", "metrics": [{"fn": "count"}, {"fn": "sum", "prop": "amount"}]}
    err, r = call(rpc, kim, "aggregate_purchase_orders", where)
    assert not err and r["rows"][0]["count"] > 3 and r["hidden"] == [] and r["rows"][0]["sum_amount"] > 0
    err, r = call(rpc, hong, "aggregate_purchase_orders", where)
    assert r["hidden"][0]["name"] == "발주 금액" and "sum_amount" not in r["rows"][0] and r["rows"][0]["count"] < 20            # 인사팀: 요청분만, 금액은 가림
    err, r = call(rpc, nobody, "search_purchase_orders", {"limit": 5})
    assert not err and r["total"] == 0                                                                           # 실행 사용자가 없으면 권한 규칙이 있는 객체는 비어 있다
    err, r = call(rpc, nobody, "search_vendors", {"name": "한빛상사"})
    assert r["rows"][0]["businessNumber"] == "123-45-*****" and r["rows"][0]["contactPhone"] == "010-****-8830"      # 마스킹은 누구에게나
    err, r = call(rpc, kim, "vendor__purchase_orders", {"vendorCode": "V0012", "limit": 3})
    assert r["total"] == 42 and len(r["rows"]) == 3
    err, r = call(rpc, kim, "purchase_order__owner", {"poNumber": "PO-2609-0142"})
    assert r["rows"][0]["name"] == "김현우" and r["rows"][0]["email"] == "h******.kim@hanbit.local"                # 인사 DB 객체로 이어진다
    err, r = call(rpc, kim, "get_purchase_order", {"poNumber": "PO-2609-0142"})
    assert r["row"]["status"] == "승인대기" and r["row"]["amount"] == 4850000


def test_bad_calls_come_back_as_readable_tool_errors(served):
    state, rpc, key = served
    secret = key("20190412")
    err, text = call(rpc, secret, "search_purchase_orders", {"status": "없는상태"})
    assert err and "중 하나여야" in text
    err, text = call(rpc, secret, "search_purchase_orders", {"amountMin": 1})
    assert err and "볼 수 있어서" in text                                                                      # 값을 가리는 속성은 조건으로도 못 쓴다
    assert not call(rpc, key("20150301"), "search_purchase_orders", {"amountMin": 1})[0]                        # 구매팀 팀장은 쓸 수 있다
    err, text = call(rpc, secret, "search_purchase_orders", {"nope": 1})
    assert err and "알 수 없는 조건" in text
    st, j = rpc(secret, "tools/call", {"name": "no_such_tool", "arguments": {}})
    assert j["error"]["code"] == -32602
    assert rpc("ieum_sk_nope", "tools/list")[0] == 401
    other = repo.create_key("다른 묶음 전용", ["ts-other"], "")[1]
    assert rpc(other, "tools/list")[0] == 403


def test_write_tool_requires_conditions_and_explicit_confirmation(served):
    state, rpc, key = served
    from app.ieum.repositories import sources as src_repo
    hong, kim = key("20190412"), key("20150301")
    err, text = call(rpc, hong, "approve_purchase_order", {"poNumber": "PO-2609-0142"})
    assert err and "제출 조건을 만족하지 않아" in text and "구매팀 팀장 이상" in text
    err, r = call(rpc, kim, "approve_purchase_order", {"poNumber": "PO-2609-0142"})                                # 확인 없이 부르면 확인할 내용만 돌려준다
    assert not err and r["needsConfirmation"] and r["confirm"]["title"] == "PO-2609-0142를 승인할까요?"
    assert call(rpc, kim, "get_purchase_order", {"poNumber": "PO-2609-0142"})[1]["row"]["status"] == "승인대기"
    err, text = call(rpc, kim, "approve_purchase_order", {"poNumber": "PO-2609-0142", "confirm": True})            # 원본 API 가 이 서버로 안 닿으니(포트 1) 실패하되 아무것도 바뀌지 않는다
    assert err and ("연결하지 못했습니다" in text or "원본 시스템" in text)
    assert call(rpc, kim, "get_purchase_order", {"poNumber": "PO-2609-0142"})[1]["row"]["status"] == "승인대기"


def test_republishing_swaps_the_snapshot_without_restarting_the_process(served):
    state, rpc, key = served
    secret = key("20150301")
    pid = httpx.get(state["url"].replace("/mcp", "/health"), trust_env=False).json()["pid"]
    store.update_object("po.Vendor", lambda o: o.update(name="공급사"))                                        # 공개 전에는 서버에 닿지 않는다
    assert rpc(secret, "tools/list")[0] == 200
    assert call(rpc, secret, "search_vendors", {"name": "한빛상사"})[1]["rows"][0]["name"] == "한빛상사"
    store.update_object("po.Vendor", lambda o: o.update(aiOff=True))
    r = publish.publish("po", by="시험")
    assert r["mcp"]["state"] == "running" and r["mcp"]["ver"] == 2 and r["tools"] == 20
    names = [t["name"] for t in rpc(secret, "tools/list")[1]["result"]["tools"]]
    assert len(names) == 20 and "search_vendors" not in names                                                       # AI 공개를 끈 객체의 도구가 빠졌다
    h = httpx.get(state["url"].replace("/mcp", "/health"), trust_env=False).json()
    assert h["pid"] == pid and h["version"] == "v2"                                                                 # 같은 프로세스다


def test_server_can_be_stopped_started_and_restored_on_the_same_port(served):
    state, rpc, key = served
    port = mcp.view("po")["port"]
    assert mcp.stop("po")["state"] == "stopped" and mcp.view("po")["status"] == "stopped"
    with pytest.raises(httpx.HTTPError):
        httpx.get(state["url"].replace("/mcp", "/health"), timeout=2, trust_env=False)
    store.update_object("po.Vendor", lambda o: o.update(aiOff=True))
    publish.publish("po", serve=True)                                                                               # 내려 둔 서버는 새 버전을 올려도 다시 뜨지 않는다. 스냅샷만 바뀐다
    assert mcp.view("po")["state"] == "stopped" and mcp.view("po")["ver"] == 2
    assert mcp.start("po")["state"] == "running" and mcp.view("po")["port"] == port
    secret = key("")
    assert len(rpc(secret, "tools/list")[1]["result"]["tools"]) == 20                                              # 마지막으로 공개한 버전 그대로
    mcp.remove("po")
    assert mcp.view("po")["state"] == "none"


def test_cross_ontology_links_come_from_the_other_published_ontology(onto):
    snap = mcp.assemble("po", store.versions.load()["po"][-1]["snapshot"])
    assert {k: v["ext"] for k, v in snap["objects"].items() if k.startswith("hr.")} == {"hr.Department": True, "hr.Employee": True}
    hr = mcp.assemble("hr", store.versions.load()["hr"][-1]["snapshot"])
    assert "po.PurchaseOrder" in hr["objects"] and hr["objects"]["po.PurchaseOrder"]["ext"]                       # 인사 쪽에서도 구매관리가 정의한 링크가 보인다
    names = [d["name"] for d in mcp.definitions_for(hr)]
    assert "employee__owned_purchase_orders" in names and "search_employees" in names and not any(n.startswith("search_purchase") for n in names)
    store.versions.save({k: v for k, v in store.versions.load().items() if k != "hr"})                              # 건너편 온톨로지가 공개 전이면 그 링크는 없다
    alone = mcp.assemble("po", store.versions.load()["po"][-1]["snapshot"])
    assert not any(k.startswith("hr.") for k in alone["objects"]) and len(alone["links"]) < len(snap["links"])


def test_manifest_validation_rejects_broken_ontology_snapshots():
    good = manifest.build_onto("ts-onto-x", "x", "X", "v1", {"objects": {"x.A": {}}, "links": []}, [{"name": "t", "object": "x.A"}])
    assert manifest.validate(good)["kind"] == "onto"
    for bad in (dict(good, snapshot={"objects": [], "links": []}), dict(good, tools=[{"name": "t", "object": "x.Nope"}]), dict(good, tools=[{"object": "x.A"}])):
        with pytest.raises(manifest.ManifestError):
            manifest.validate(bad)
