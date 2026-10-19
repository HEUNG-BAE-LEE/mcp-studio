"""시연 환경: 구매관리 DB, 인사 DB 두 온톨로지와 마트, 권한 규칙, 액션을 만든다. 회계 ERP DB 는 연결하지 않고 둔다(마법사로 직접 연결하는 장면용).

사람이 쓰는 것과 같은 길로 만든다: DB 연결 -> DB 스캔 -> 제안 반영 -> 검토. 다만 목업의 시작 모습(구매관리 6개, 인사 2개 객체)이 되도록
스캔 결과 중 입고·창고는 일부러 반영하지 않고 둔다(시연자가 DB 스캔을 눌러 제안받는 장면). 그 위에 사람이 하는 손질(링크 이름, 공개 상태, 권한 규칙)을 얹는다.
시연 DB 파일과 이 연결들의 온톨로지를 처음 상태로 되돌린다(액션으로 바뀐 값, 마트, 공개 버전 모두).
"""
import shutil
from typing import Dict, Optional

from app.ieum.config import state_dir
from app.ieum.onto import build, conn as dbconn, demo, marts, perm, scan, store

ASK_USERS = ["20150301", "20190412"]                 # 김현우(구매팀 팀장), 홍길동(인사팀 선임)
RANKS = ["사원", "선임", "책임", "팀장", "본부장"]
FIRST_SCAN_APIS = {"PurchaseOrder", "Vendor", "Item", "PurchaseRequest", "Budget"}      # 처음 반영할 구매관리 객체. 입고·창고는 남겨 둔다

# 링크 이름(정방향 api/name, 역방향 rapi/rev)을 목업처럼 다듬는다. (from.api, to.api, 키 컬럼) -> 바꿀 값
LINK_NAMES: Dict[tuple, dict] = {
    ("PurchaseOrderLine", "PurchaseOrder", "PO_NO"): {"rapi": "lines", "rev": "품목 줄"},
    ("PurchaseOrderLine", "Item", "ITEM_CD"): {"rapi": "orderLines", "rev": "발주 품목"},
    ("Employee", "Department", "DEPT_CD"): {"rapi": "members", "rev": "구성원"},
}
POSITIONS = {            # 그래프 위치(노드 중심)
    "po.PurchaseOrder": [430, 190], "po.PurchaseOrderLine": [720, 70], "po.Vendor": [130, 70], "po.Item": [940, 70], "po.PurchaseRequest": [200, 330], "po.Budget": [850, 190],
    "po.GoodsReceipt": [130, 190], "po.Warehouse": [-140, 190], "po.GoodsReceiptLine": [940, 330],
    "hr.Employee": [560, 330], "hr.Department": [850, 330],
}

PO_PERM = {
    "rows": [
        {"label": "구매팀", "text": "모든 발주", "when": [{"dept": ["D4010"]}], "scope": None},
        {"label": "팀장 이상", "text": "자기 부서가 요청한 발주", "when": [{"minRank": 4}], "scope": {"via": {"table": "TB_PR_MST", "from": "PR_NO", "to": "PR_NO", "col": "DEPT_CD"}, "user": "dept"}},
        {"label": "그 외 직원", "text": "자기 부서가 요청한 발주 (구매요청의 요청 부서 기준)", "when": [], "scope": {"via": {"table": "TB_PR_MST", "from": "PR_NO", "to": "PR_NO", "col": "DEPT_CD"}, "user": "dept"}},
    ],
    "props": [
        {"col": "PO_AMT", "label": "발주 금액", "text": "구매팀 또는 팀장 이상만", "allow": [{"dept": ["D4010"]}, {"minRank": 4}]},
        {"col": "RMK", "label": "비고", "text": "모든 직원", "allow": [{}]},
    ],
}
BDGT_PERM = {
    "rows": [
        {"label": "구매팀", "text": "모든 부서의 예산", "when": [{"dept": ["D4010"]}], "scope": None},
        {"label": "그 외 직원", "text": "자기 부서의 예산", "when": [], "scope": {"col": "DEPT_CD", "user": "dept"}},
    ],
    "props": [
        {"col": "BDGT_AMT", "label": "예산", "text": "같은 부서 구성원과 구매팀만", "allow": [{"dept": ["D4010"]}, {"sameRow": {"col": "DEPT_CD", "user": "dept"}}]},
        {"col": "USE_AMT", "label": "사용액", "text": "같은 부서 구성원과 구매팀만", "allow": [{"dept": ["D4010"]}, {"sameRow": {"col": "DEPT_CD", "user": "dept"}}]},
    ],
}

MARTS = [
    {"id": "mart_vendor_monthly", "name": "거래처 월별 발주 실적", "desc": "거래처별, 월별 발주 건수와 금액 합계입니다.", "refresh": "hourly", "inc": "", "owner": "김현우",
     "sql": """SELECT po.VEND_CD,
       v.VEND_NM,
       SUBSTR(po.PO_YMD, 1, 6)   AS YM,
       COUNT(*)                  AS PO_CNT,
       SUM(po.PO_AMT)            AS PO_AMT_SUM
  FROM PO.TB_PO_MST po
  JOIN PO.TB_VEND_MST v ON v.VEND_CD = po.VEND_CD
 WHERE po.DEL_YN = 'N'
 GROUP BY po.VEND_CD, v.VEND_NM, SUBSTR(po.PO_YMD, 1, 6)""", "od": {"name": "거래처 월별 실적", "api": "VendorMonthlyStat", "title": "VEND_NM"}},
    {"id": "mart_dept_budget", "name": "부서별 예산 집행 현황", "desc": "부서별 연간 예산, 사용액, 잔액, 집행률입니다. 구매관리 DB와 인사 DB를 조인합니다.", "refresh": "daily", "inc": "", "owner": "박지훈",
     "sql": """SELECT b.DEPT_CD,
       d.DEPT_NM,
       b.YYYY,
       b.BDGT_AMT,
       b.USE_AMT,
       b.BDGT_AMT - b.USE_AMT                  AS REMAIN_AMT,
       ROUND(b.USE_AMT * 100.0 / b.BDGT_AMT, 1)  AS USE_RATE
  FROM PO.TB_BDGT b
  JOIN HR.TB_DEPT d ON d.DEPT_CD = b.DEPT_CD""", "od": {"name": "부서 예산 현황", "api": "DepartmentBudgetStatus", "title": "DEPT_NM"}},
    {"id": "mart_item_price_trend", "name": "품목 월별 단가 추이", "desc": "품목별, 월별 평균, 최저, 최고 단가입니다.", "refresh": "daily", "inc": "YM", "owner": "김현우",
     "sql": """SELECT d.ITEM_CD,
       SUBSTR(m.PO_YMD, 1, 6)  AS YM,
       AVG(d.UNIT_PRC)         AS AVG_PRC,
       MIN(d.UNIT_PRC)         AS MIN_PRC,
       MAX(d.UNIT_PRC)         AS MAX_PRC
  FROM PO.TB_PO_DTL d
  JOIN PO.TB_PO_MST m ON m.PO_NO = d.PO_NO
 GROUP BY d.ITEM_CD, SUBSTR(m.PO_YMD, 1, 6)""", "od": {"name": "품목 단가 추이", "api": "ItemPriceTrend", "title": "ITEM_CD"}},
]


LEGACY_ID = "legacy-po"
LEGACY_NAME = "구매관리 (레거시)"
LEGACY_VIA = "구매관리 (레거시) 자동 탐색 API"


def _param(name: str, label: str, req: bool = False, ex: str = "") -> dict:
    return {"a": name, "o": name, "loc": "form", "at": "string", "req": 1 if req else 0, "d": label, "ex": ex}


def _xhr() -> dict:
    """이 사이트는 X-Requested-With 가 없으면 400 을 낸다(WAF 흉내). AI 에게는 보이지 않는 고정 헤더로 붙인다."""
    return {"a": "", "o": "X-Requested-With", "loc": "header", "rule": "inject", "v": "XMLHttpRequest", "at": "string", "req": 0, "d": "", "ex": "XMLHttpRequest"}


def register_legacy(base: str) -> None:
    """시연 레거시 구매관리 사이트(/demo-legacy/po)를 원본 시스템과 쓰기 도구 셋으로 등록한다. 액션이 이 도구를 불러 쓴다."""
    from app.ieum.gateway import credentials, session_auth
    from app.ieum.repositories import sources as src_repo, studio as tool_repo
    src = {"id": LEGACY_ID, "name": LEGACY_NAME, "desc": "자동 탐색으로 찾은 쓰기 API 3개 (온톨로지 시연)", "proto": "disc", "spec": "운영 트래픽으로 추론", "base": base.rstrip("/"),
           "auth": "세션 (서비스 계정)", "authType": "session", "sync": "방금", "specUrl": None}
    tools = [
        {"id": "approve_purchase_order", "method": "POST", "path": "/poApprove.do", "title": "발주 승인", "status": "done", "mode": "write",
         "desc": "승인대기 상태의 발주를 승인합니다. 승인 권한이 있는 서비스 계정으로 실행합니다.", "params": [_param("poNo", "발주번호", True, "PO-2609-0142"), _param("aprvOpnn", "승인 의견"), _xhr()], "res": []},
        {"id": "create_purchase_order", "method": "POST", "path": "/poSave.do", "title": "발주 등록", "status": "done", "mode": "write",
         "desc": "새 발주를 작성 상태로 등록합니다.", "params": [_param("vendCd", "거래처 코드", True, "V0012"), _param("itemCd", "품목 코드", True, "P-10023"), _param("qty", "수량", True, "100"),
                                                              _param("unitPrice", "단가", True, "12500"), _xhr()], "res": []},
        {"id": "close_purchase_request", "method": "POST", "path": "/prClose.do", "title": "구매요청 마감", "status": "done", "mode": "write",
         "desc": "구매요청을 마감합니다.", "params": [_param("prNo", "구매요청 번호", True, "PR-2609-0088"), _xhr()], "res": []},
    ]
    credentials.put(LEGACY_ID, {"type": "session", "username": "po_manager", "password": "demo-pass",
                                "recipe": {"loginRel": "/login.do", "actionRel": "/loginProc.do", "userField": "userId", "passField": "userPw"}})
    session_auth.invalidate(LEGACY_ID)
    src_repo.upsert_source(src)
    tool_repo.replace_source_tools(LEGACY_ID, [tool_repo.with_defaults(t, src) for t in tools])


def _actions(objs: Dict[str, dict]) -> None:
    po, pr = objs["po.PurchaseOrder"], objs["po.PurchaseRequest"]
    po["actions"] = [
        {"name": "발주 승인", "api": "approvePurchaseOrder", "tool": "approve_purchase_order", "via": "POST /poApprove.do", "viaSrc": LEGACY_VIA, "effect": "진행 상태를 승인으로 바꿉니다",
         "inputs": [{"name": "comment", "label": "승인 의견", "type": "string", "required": False}], "bind": {"poNo": "$key", "aprvOpnn": "$in.comment"},
         "rules": [{"text": "진행 상태가 승인대기일 때만", "check": {"on": "obj", "prop": "status", "eq": "승인대기"}},
                   {"text": "실행자가 구매팀 팀장 이상일 때만", "check": {"on": "who", "dept": ["D4010"], "minRank": 4}}],
         "confirm": {"title": "{title}를 승인할까요?", "fields": [{"label": "거래처", "via": "vendor", "prop": "name"}, {"label": "발주 금액", "prop": "amount", "unit": "원"},
                                                               {"label": "품목", "via": "lines", "count": True, "suffix": "줄"}]}},
        {"name": "발주 등록", "api": "createPurchaseOrder", "tool": "create_purchase_order", "via": "POST /poSave.do", "viaSrc": LEGACY_VIA, "effect": "발주 객체를 작성 상태로 새로 만듭니다",
         "create": True, "resultKey": "PO_NO",
         "inputs": [{"name": "vendor", "label": "거래처", "type": "object:Vendor", "required": True}, {"name": "item", "label": "품목", "type": "object:Item", "required": True},
                    {"name": "quantity", "label": "수량", "type": "integer", "required": True}],
         "bind": {"vendCd": "$in.vendor", "itemCd": "$in.item", "qty": "$in.quantity", "unitPrice": "$in.item.standardPrice"},
         "rules": [{"text": "거래 상태가 거래 중인 거래처만", "check": {"on": "input", "input": "vendor", "prop": "status", "eq": "거래 중"}},
                   {"text": "실행자 부서의 올해 예산 잔액이 발주 금액(수량 × 단가) 이상일 때만", "check": {"on": "budget", "qty": "quantity", "item": "item", "priceProp": "standardPrice"}}],
         "confirm": {"title": "새 발주를 등록할까요?", "fields": [{"label": "거래처", "input": "vendor", "prop": "name"}, {"label": "품목", "input": "item", "prop": "name"},
                                                           {"label": "수량", "input": "quantity"}, {"label": "기준 단가", "input": "item", "prop": "standardPrice", "unit": "원"}]}},
    ]
    pr["actions"] = [
        {"name": "구매요청 마감", "api": "closePurchaseRequest", "tool": "close_purchase_request", "via": "POST /prClose.do", "viaSrc": LEGACY_VIA, "effect": "진행 상태를 마감으로 바꿉니다",
         "inputs": [{"name": "reason", "label": "마감 사유", "type": "string", "required": False}], "bind": {"prNo": "$key"},
         "rules": [{"text": "요청자 본인이거나 구매팀일 때만", "check": {"on": "who", "any": [{"dept": ["D4010"]}, {"empIsProp": "requesterId"}]}},
                   {"text": "진행 상태가 요청 또는 승인일 때만 (발주가 끝났거나 이미 마감한 요청은 마감할 수 없어요)", "check": {"on": "obj", "prop": "status", "in": ["요청", "승인"]}}],
         "confirm": {"title": "{title} 구매요청을 마감할까요?", "fields": [{"label": "요청 부서", "via": "department", "prop": "name"}, {"label": "요청자", "via": "requester", "prop": "name"}]}},
    ]


def reset_state() -> None:
    """온톨로지 관련 상태를 모두 비우고 시연 DB 를 처음으로 되돌린다."""
    from app.ieum.onto import mcp
    for c in store.conns.load():                                  # 떠 있던 MCP 서버도 내린다
        mcp.remove(c["id"])
    marts.stop_scheduler()
    dbconn.dispose_all()
    reader_forget()
    for st in (store.conns, store.objects, store.links, store.marts, store.versions, store.settings_store, mcp_deploys()):
        st.reset()
    (state_dir() / "onto" / "marts.db").unlink(missing_ok=True)
    shutil.rmtree(dbconn.replica_file("x").parent, ignore_errors=True)
    demo.reset()


def mcp_deploys():
    from app.ieum.onto import mcp
    return mcp.deploys


def reader_forget() -> None:
    from app.ieum.onto import reader
    reader.forget_cache()


def _apply(conn_id: str, only: Optional[set] = None) -> None:
    j = scan.start(conn_id, sync=True)
    v = scan.get(j["id"])
    if v["state"] != "done":
        raise RuntimeError(v["error"])
    pick = []
    for p in v["proposals"]:
        if p["rec"] == "no":
            continue
        if only is not None and p["kind"] == "객체" and p["add"]["ot"].split(".", 1)[1] not in only:
            continue
        if only is not None and p["kind"] == "링크" and not all(x.split(".", 1)[1] in only or store.get_object(x) for x in p.get("needs", [])):
            continue
        pick.append(p["id"])
    scan.apply(j["id"], pick)


def load(owner: str = "김현우", legacy_base: str = "") -> dict:
    """시연 환경을 만든다. legacy_base 는 이 서버의 시연 레거시 사이트 주소(http://127.0.0.1:8000/demo-legacy/po). 있어야 쓰기 액션이 실제로 돈다."""
    reset_state()
    for cid, name, db in (("po", "구매관리 DB", "demo:po"), ("hr", "인사 DB", "demo:hr")):
        dbconn.create({"id": cid, "dbms": "sqlite", "name": name, "db": db, "mode": "live"}, demo_flag=True)
    store.save_settings({"asOf": "2026-09-30", "ranks": RANKS, "askUsers": ASK_USERS, "demo": True,
                         "identity": {"object": "hr.Employee", "id": "EMP_NO", "dept": "DEPT_CD", "rank": "JBGD_NM", "name": "EMP_NM"}})
    _apply("hr")
    _apply("po", FIRST_SCAN_APIS)
    _apply("po", FIRST_SCAN_APIS | {"PurchaseOrderLine"})        # 하위(상세) 테이블은 부모가 생긴 다음 스캔에서 나온다
    _curate()
    for m in MARTS:
        _mart(m, owner)
    if legacy_base:
        register_legacy(legacy_base)
    from app.ieum.onto import legacy_sync, publish
    legacy_sync.install()
    for cid in ("hr", "po"):
        publish.publish(cid, by=owner, note="시연 환경", serve=False)
    _serve_later(["hr", "po"])
    return {"conns": len(store.conns.load()), "objects": len(store.all_objects()), "links": len(store.all_links()), "marts": len(store.all_marts())}


def _serve_later(conn_ids) -> None:
    """MCP 서버 띄우기는 몇 초 걸려서 시연 환경을 불러오는 응답을 막지 않도록 뒤에서 한다."""
    import threading
    from app.ieum.onto import mcp

    def run() -> None:
        for cid in conn_ids:
            mcp.reflect(cid)
    threading.Thread(target=run, daemon=True, name="onto-demo-serve").start()


def _curate() -> None:
    """스캔이 만든 객체를 사람이 손질한 모습으로: 링크 이름, 위치, 공개 상태, 권한 규칙"""
    objs = store.all_objects()
    by_api = {(o["conn"], o["api"]): o for o in objs.values()}
    for oid, pos in POSITIONS.items():
        if oid in objs:
            objs[oid]["pos"] = pos
    ls = store.all_links()
    for l in ls:
        key = (objs[l["from"]]["api"], objs[l["to"]]["api"], l["keys"][0][0])
        l.update(LINK_NAMES.get(key, {}))
    store.links.save(ls)
    objs["po.PurchaseOrder"]["perm"] = perm.validate(objs["po.PurchaseOrder"], PO_PERM)
    objs["po.Budget"]["perm"] = perm.validate(objs["po.Budget"], BDGT_PERM)
    for oid in ("po.PurchaseOrder", "po.PurchaseOrderLine", "po.Vendor", "po.Item", "hr.Employee", "hr.Department"):
        objs[oid]["status"] = "pub"
        objs[oid]["reviewNote"] = ""
    objs["po.PurchaseRequest"]["reviewNote"] = "스캔이 테이블 이름, 컬럼 구성, 다른 테이블의 참조 관계로 제안한 객체입니다. 요청자, 요청 부서 링크가 DB 간 링크라 확인이 필요합니다."
    objs["po.Budget"]["status"] = "pub"                          # AI 질의(올해 예산 얼마 남았어)가 쓰므로 공개한다
    objs["po.Budget"]["reviewNote"] = ""
    _actions(objs)
    store.objects.save(objs)
    ls = store.all_links()
    for l in ls:
        a, b = objs[l["from"]]["status"], objs[l["to"]]["status"]
        l["status"] = "pub" if (a == "pub" and b == "pub") else "review"
    store.links.save(ls)


def _mart(m: dict, owner: str) -> None:
    rec = marts.save("po", {"id": m["id"], "name": m["name"], "desc": m["desc"], "sql": m["sql"], "refresh": m["refresh"], "inc": m["inc"]}, owner=m["owner"] or owner)
    built = marts.build(rec["id"], wait=True)
    if built["status"] != "ok":
        raise RuntimeError("시연 마트 %s 를 빌드하지 못했습니다: %s" % (rec["id"], built["failMsg"]))
    sug = marts.suggest_od(built, marts.sample(built["id"]))
    store.update_mart(built["id"], lambda x: x.update(od=dict(sug, **m["od"])))
