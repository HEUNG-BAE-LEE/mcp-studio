"""콘솔 화면 시험(온톨로지 메뉴): 실제 헤드리스 Chrome 으로 콘솔을 열어 그래프, 객체 상세, 마법사, 마트, 객체 탐색, AI 질의를 눌러 본다.

콘솔은 빌드 없는 바닐라 JS 라 이 시험이 화면을 점검하는 유일한 자동 시험이다. 서버 쪽 동작은 test_ieum_onto_*.py 가 본다.
"""
import os
import threading
import time

import pytest
import uvicorn
from fastapi import FastAPI

from app.ieum.console import mount_console
from app.ieum.discovery import browser as browser_mod
from app.ieum.discovery.browser import capabilities
from app.ieum.routers import router

pytestmark = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"], reason="시험에 쓸 브라우저가 없다")


@pytest.fixture
def ui(ieum_state, monkeypatch):
    monkeypatch.setenv("IEUM_ONTO_AUTOSERVE", "0")
    app = FastAPI()
    app.include_router(router)
    mount_console(app)
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=0, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.time() + 10
    while not server.started:
        assert time.time() < deadline
        time.sleep(0.02)
    try:
        yield "http://localhost:%d" % server.servers[0].sockets[0].getsockname()[1]
    finally:
        server.should_exit = True
        thread.join(timeout=5)
        from app.ieum.onto import conn as dbconn, marts
        dbconn.dispose_all()
        marts.stop_scheduler()


@pytest.fixture
def page(ui):
    from playwright.sync_api import sync_playwright
    errors = []
    with sync_playwright() as pw:
        browser, _ = browser_mod.launch(pw)
        try:
            pg = browser.new_context(viewport={"width": 1440, "height": 900}, locale="ko-KR").new_page()
            pg.on("pageerror", lambda e: errors.append(str(e)))
            pg.on("dialog", lambda d: (errors.append("대화상자: " + d.message), d.dismiss()))      # window.alert/confirm 을 쓰지 않는다
            pg.goto(ui + "/ieum/")
            pg.wait_for_function("() => !document.body.hasAttribute('aria-busy')")
            pg.click('#nav button[data-v="onto"]')
            yield pg, errors
        finally:
            browser.close()


def load_demo(pg):
    pg.click('[data-act="onDemoLoad"]')
    pg.wait_for_selector(".on-n", timeout=60000)


def toast_text(pg, contains=""):
    """알림 문구. 앞선 동작의 알림이 아직 떠 있을 수 있어서, 찾는 문구가 뜰 때까지 기다린다."""
    pg.wait_for_function("t => { const e = document.querySelector('#toast'); return e.classList.contains('show') && e.innerText.includes(t); }", arg=contains)
    return pg.inner_text("#toast")


def test_empty_state_then_demo_environment_draws_the_graph_and_object_detail(page):
    pg, errors = page
    assert "아직 연결된 DB가 없어요" in pg.inner_text(".on-body") and pg.inner_text('#nav button.on').startswith("온톨로지")
    load_demo(pg)
    assert pg.locator(".on-nav .nv.conn").count() == 2 and "구매관리 DB 온톨로지" in pg.inner_text(".cw-h")
    assert pg.locator(".on-n").count() == 6 and pg.locator(".on-n.st-review").count() == 1 and pg.locator(".og .oe").count() == 4
    assert "발주" in pg.inner_text(".ot-detail .ot-h h3") and pg.inner_text(".ot-detail .ot-h code") == "PurchaseOrder"            # 링크가 가장 많은 객체가 처음 선택된다
    assert pg.locator(".xref li").count() == 4 and "인사 DB 온톨로지" in pg.inner_text(".xref")
    pg.click('.on-n[data-id="po.Vendor"]')
    assert pg.inner_text(".ot-detail .ot-h h3") == "거래처"
    assert pg.locator(".ot-body .map tbody tr").count() == 7 and "마스킹" in pg.inner_text(".ot-body")
    assert not errors


def test_detail_tabs_show_links_actions_permissions_preview_and_ai_tools(page):
    pg, errors = page
    load_demo(pg)
    pg.click('.on-n[data-id="po.PurchaseOrder"]')
    pg.click('[data-act="otTab"][data-v="links"]')
    assert pg.locator(".ot-body .map tbody tr").count() == 4 and "TB_PO_MST.VEND_CD = TB_VEND_MST.VEND_CD" in pg.inner_text(".ot-body")
    pg.click('[data-act="otTab"][data-v="actions"]')
    assert pg.locator(".act-c").count() == 2 and "POST /poApprove.do" in pg.inner_text(".ot-body") and "실행자가 구매팀 팀장 이상일 때만" in pg.inner_text(".ot-body")
    pg.click('[data-act="otTab"][data-v="perm"]')
    assert "구매팀 또는 팀장 이상만" in pg.inner_text(".ot-body")
    pg.wait_for_function("() => document.querySelector('.sim-r') && /볼 수 있는 발주/.test(document.querySelector('.sim-r').innerText)")
    kim = pg.inner_text(".sim-r")
    pg.click('[data-act="permUser"] >> nth=1')
    pg.wait_for_function("(old) => { const e = document.querySelector('.sim-r'); return e && e.innerText.includes('볼 수 있는') && e.innerText !== old; }", arg=kim)
    assert "발주 금액 가림" in pg.inner_text(".sim-r").replace("\n", " ")
    pg.click('[data-act="otTab"][data-v="preview"]')
    pg.wait_for_selector(".ot-body table tbody tr")
    assert pg.locator(".ot-body table tbody tr").count() == 3 and "SELECT" in pg.text_content(".ot-body")
    pg.click('[data-act="otTab"][data-v="tools"]')
    pg.wait_for_selector(".tool-ul li")
    assert "search_purchase_orders" in pg.inner_text(".tool-ul") and "approve_purchase_order" in pg.inner_text(".tool-ul")
    pg.click('.tool-ul li >> nth=1')
    assert "get_purchase_order" in pg.inner_text("#onToolH") and '"inputSchema"' in pg.inner_text("#onToolDef")
    assert not errors


def test_review_publish_flow_and_the_property_edit_modal(page):
    pg, errors = page
    load_demo(pg)
    pg.click('.on-n[data-id="po.PurchaseRequest"]')
    assert "스캔이 제안한 객체입니다" in pg.inner_text(".ot-detail")
    pg.click('[data-act="propEdit"] >> nth=0')
    pg.fill("#pnIn", "구매요청 번호 (고침)")
    pg.click('[data-act="mOk"]')
    pg.wait_for_function("() => document.querySelector('.ot-body').innerText.includes('구매요청 번호 (고침)')")
    pg.click('[data-act="otDone"]')
    pg.wait_for_function("() => !document.querySelector('.ot-detail').innerText.includes('스캔이 제안한 객체입니다')")
    assert pg.locator(".on-n.st-pub").count() == 6 and not pg.locator(".on-n.st-review").count()
    pg.click('[data-act="onPublish"]')
    pg.wait_for_function("() => document.querySelector('#modal').classList.contains('show') && /v2 공개/.test(document.querySelector('#modal').innerText)")
    assert "6개" in pg.inner_text("#modal")
    pg.click('[data-act="mOk"]')
    pg.wait_for_function("() => /v2/.test(document.querySelector('.cw-h .t1')?.innerText || '')")
    assert not errors


def test_db_wizard_connects_the_accounting_database_and_the_scan_wizard_builds_its_ontology(page):
    pg, errors = page
    load_demo(pg)
    pg.click('[data-act="dbWz"]')
    pg.click('[data-act="dbwNext"]')                                                       # 시연 DB(SQLite) 는 처음부터 골라져 있다
    assert pg.locator('input[name="dbwDemo"]:checked').count() == 1 and pg.locator('input[name="dbwDemo"]:disabled').count() == 2
    assert pg.is_disabled("#dbwNext")                                                      # 연결 테스트를 통과해야 다음으로 간다
    pg.click('[data-act="dbwTest"]')
    pg.wait_for_selector('#dbwNext:not([disabled])')
    pg.click('[data-act="dbwNext"]')
    pg.click('[data-act="dbwMode"][data-v="sync"]')
    pg.click('[data-act="dbwApply"]')
    pg.wait_for_function("() => /회계 ERP DB 온톨로지/.test(document.querySelector('.cw-h')?.innerText || '')")
    pg.wait_for_function("() => (document.querySelector('.cw-body')?.innerText || '').includes('아직 객체가 없어요')")        # 원본 테이블은 비동기로 읽는다
    assert "1시간마다 동기화" in pg.inner_text(".cw-h")
    pg.click('.bt.hl [data-act="scanWz"]')
    pg.click('[data-act="scwRun"]')
    pg.wait_for_selector('[data-chg="scwSel"]', timeout=30000)
    texts = pg.inner_text(".gov-list")
    assert "전표 (Voucher)" in texts and "계정과목 (Account)" in texts and "기존 거래처와 같은 대상" in texts and "확인 필요" in pg.inner_text("#drawer")
    assert pg.locator('[data-chg="scwSel"]:checked').count() == 5                          # 권장 항목만 미리 골라진다(확인 필요 1개와 객체가 없는 링크는 아니다)
    pg.click('[data-act="scwApply"]')
    pg.wait_for_selector("#buildDetail")
    assert pg.locator(".utbl tbody tr[data-act='otSelB']").count() == 2 and pg.inner_text(".kpi.bk").count("개") >= 4
    assert "회계 ERP DB 온톨로지" in pg.inner_text(".cw-h") and not errors


def test_object_wizard_creates_a_warehouse_object_from_a_table(page):
    pg, errors = page
    load_demo(pg)
    pg.click('.rtab[data-v="build"]')
    pg.click('[data-act="otNew"]')
    pg.wait_for_selector('input[name="otwPick"]')
    pg.click('input[value="TB_WH_MST"]')
    pg.click('#otwNext')
    pg.wait_for_selector('[data-inp="otwDef"][data-k="name"]')
    assert pg.input_value('[data-inp="otwDef"][data-k="api"]') == "Warehouse"
    pg.fill('[data-inp="otwDef"][data-k="name"]', "창고 마스터")
    pg.wait_for_function("() => /겹치는 행 없음/.test(document.querySelector('#otwPkNote').innerText)")
    pg.click('#otwNext')
    pg.click('[data-act="otwCreate"]')
    pg.wait_for_function("() => document.querySelector('.ot-detail h3')?.innerText === '창고 마스터'")
    assert "검토 필요" in pg.inner_text(".ot-detail .ot-h") and not errors


def test_mart_editor_runs_the_sql_for_real_and_builds_the_mart(page):
    pg, errors = page
    load_demo(pg)
    pg.click('.rtab[data-v="mart"]')
    pg.wait_for_selector("tbody tr[data-act='martOpen']")
    assert pg.locator("tbody tr[data-act='martOpen']").count() == 3 and "DB 간 조인" in pg.inner_text(".cw-body")
    pg.click('[data-act="martNew"]')
    pg.wait_for_selector(".tr-g")
    pg.click('[data-act="meRun"]')
    pg.wait_for_selector(".chk li")
    assert "DB 간 조인이에요" in pg.inner_text("#meRes") and pg.locator("#meRes tbody tr").count() >= 3 and not pg.is_disabled("#meSave")
    pg.fill("#meSql", "DELETE FROM PO.TB_PO_MST")                                         # 쓰기 SQL 은 입력을 바꾸면 미리 보기가 지워지고, 다시 실행하면 거절한다
    assert pg.is_disabled("#meSave")
    pg.click('[data-act="meRun"]')
    pg.wait_for_selector(".notice.danger")
    assert "읽기 전용" in pg.inner_text("#meRes")
    pg.click('[data-act="meTpl"]')
    pg.click('[data-act="meRun"]')
    pg.wait_for_selector(".chk li")
    pg.click("#meSave")
    pg.wait_for_function("() => /성공/.test(document.querySelector('.me-head')?.innerText || '')", timeout=30000)
    assert "mart_dept_pending" in pg.inner_text(".me-head") and "빌드 이력" in pg.inner_text(".cw-body")
    pg.click('[data-act="martToObj"]')
    pg.wait_for_selector('[data-inp="otwDef"][data-k="name"]')
    assert "마트 부서별 승인 대기 발주" in pg.inner_text("#drawer")
    assert not errors


def test_explorer_opens_an_instance_and_follows_links_across_ontologies(page):
    pg, errors = page
    load_demo(pg)
    pg.click('.rtab[data-v="explore"]')
    pg.wait_for_selector(".ob-item")
    pg.fill('[data-inp="oq"]', "한빛상사")
    pg.wait_for_function("() => document.querySelectorAll('.ob-item').length >= 1 && document.querySelector('.ob-item').innerText.includes('한빛상사')")
    pg.click(".ob-item")
    pg.wait_for_selector(".ob-view")
    assert "한빛상사" in pg.inner_text(".ob-view h3") and "123-45-*****" in pg.inner_text(".ob-props") and "발주" in pg.inner_text(".ob-link")
    pg.click('.ob-link .chip >> nth=0')
    pg.wait_for_function("() => /^PO-/.test(document.querySelector('.ob-view h3')?.innerText || '')")
    pg.click('.ob-link .chip.ext >> nth=0')                                                # 담당자(인사 DB 직원)로: 다른 온톨로지로 넘어간다
    pg.wait_for_function("() => /인사 DB 온톨로지/.test(document.querySelector('.cw-h')?.innerText || '')")
    pg.wait_for_selector(".mg .mg-n")
    assert pg.locator(".mg .mg-n").count() >= 2 and "김현우" in pg.inner_text(".ob-view h3") + pg.inner_text(".ob-props") and not errors


def test_ai_query_test_answers_the_mockup_questions_and_asks_before_writing(page):
    pg, errors = page
    load_demo(pg)
    pg.click('.on-nav .nv[data-v="ask"]')
    pg.wait_for_selector(".ask-g")
    assert pg.locator('[data-act="askUser"]').count() == 2 and pg.locator('[data-act="askRun"]').count() == 3 and "자유 질문은 GPT 설정" in pg.inner_text(".q-list")
    pg.click('[data-act="askRun"][data-v="q1"]')
    pg.wait_for_selector(".ask-a")
    assert "3건, 모두 7,310,000원" in pg.inner_text(".ask-a") and pg.locator(".trace .step").count() == 6 and "-- 승인대기 (코드 20)" in pg.inner_text(".trace")
    pg.click('[data-act="askUser"] >> nth=1')
    pg.click('[data-act="askRun"][data-v="q1"]')
    pg.wait_for_function("() => document.querySelector('.ask-a') && /1건\\(PO-2609-0142\\)/.test(document.querySelector('.ask-a').innerText)")
    assert "알려 드릴 수 없어요" in pg.inner_text(".ask-a") and "1건으로 줄어듦" in pg.inner_text(".trace")
    pg.click('[data-act="askRun"][data-v="q3"]')
    pg.wait_for_selector(".ask-a")
    assert "아무것도 바꾸지 않았습니다" in pg.inner_text(".ask-a") and pg.locator(".step.fail").count() == 1
    pg.click('[data-act="askUser"] >> nth=0')
    pg.click('[data-act="askRun"][data-v="q3"]')
    pg.wait_for_selector(".apv")
    assert "PO-2609-0142를 승인할까요?" in pg.inner_text(".apv") and pg.locator(".ask-a").count() == 0           # 확인 전에는 답이 없다
    pg.click('[data-act="askApprove"]')
    pg.wait_for_selector(".ask-a", timeout=30000)
    assert "승인으로 바뀌었습니다" in pg.inner_text(".ask-a") and "승인대기 → 승인" in pg.inner_text(".trace")
    pg.click('[data-act="askReset"]')
    pg.wait_for_function("() => document.querySelectorAll('.ask-a').length === 0", timeout=30000)
    assert not errors


def test_connection_info_tab_shows_server_state_and_issues_keys(page):
    pg, errors = page
    load_demo(pg)
    pg.click('.rtab[data-v="info"]')
    assert "SQLite (시연용, 파일)" in pg.inner_text(".ci-g") and "읽기 전용" in pg.inner_text(".ci-g")
    pg.wait_for_selector(".sec-t")
    assert "AI 연결 (MCP 서버)" in pg.inner_text(".ci-g") and "이 서버는 MCP 서버를 자동으로 띄우지 않게" in pg.inner_text(".ci-g")        # 이 시험은 서버를 띄우지 않는다
    pg.fill("#mcpKeyName", "시험 키")
    pg.select_option("#mcpKeyRun", "20150301")
    pg.click('[data-act="mcpKey"]')
    pg.wait_for_selector('#modal input[readonly]')
    assert pg.input_value('#modal input[readonly]').startswith("ieum_sk_") and "claude mcp add" in pg.inner_text("#modal")
    pg.click('[data-act="mClose"] >> nth=-1')
    pg.wait_for_function("() => (document.querySelector('.ci-g')?.innerText || '').includes('시험 키')")
    assert "김현우" in pg.inner_text(".ci-g") and not errors


def test_link_rename_connection_rename_sync_mode_and_identity_settings(page):
    pg, errors = page
    load_demo(pg)
    pg.click('[data-act="otTab"][data-v="links"]')
    pg.click('[data-act="linkEdit"] >> nth=0')
    pg.fill("#lnA", "공급사")
    pg.click('[data-act="mOk"]')
    pg.wait_for_function("() => document.querySelector('#modal') && !document.querySelector('#modal').classList.contains('show')")
    assert pg.evaluate("() => fetch('/api/ieum/onto/connections/po/graph').then(r => r.json()).then(j => j.resultData.links.some(l => l.name === '공급사'))")
    pg.click('.rtab[data-v="info"]')
    pg.click('[data-act="onRename"]')
    pg.fill("#rnIn", "구매 DB")
    pg.click('[data-act="mOk"]')
    pg.wait_for_function("() => (document.querySelector('.cw-h h3')?.innerText || '').includes('구매 DB')")
    pg.click('[data-act="onMode"][data-v="sync"]')
    pg.wait_for_function("() => (document.querySelector('.ci-g')?.innerText || '').includes('복제본')")
    assert "복제본" in pg.inner_text(".ci-g")
    pg.click('[data-act="onSyncNow"]')
    assert "복제했어요" in toast_text(pg, "복제했어요")
    pg.click('.rtab[data-v="graph"]')
    pg.click('[data-act="otTab"][data-v="perm"]')
    pg.click('[data-act="onIdentity"]')
    pg.wait_for_selector("#idfBody select")
    assert "인사 DB · 직원" in pg.inner_text("#idfBody") and "직급 순서" in pg.inner_text("#idfBody")
    pg.fill("#idfRanks", "사원, 선임, 책임, 팀장, 본부장, 임원")
    pg.click('[data-act="mOk"]')
    assert "저장했어요" in toast_text(pg, "저장했어요")
    assert not errors


def test_mart_rebuild_edit_and_the_scan_wizard_relation_mode(page):
    pg, errors = page
    load_demo(pg)
    pg.click('.rtab[data-v="mart"]')
    pg.wait_for_selector("tbody tr[data-act='martOpen']")
    pg.click("tbody tr[data-act='martOpen'] >> nth=0")
    pg.wait_for_selector(".lin")
    pg.click('[data-act="martRebuild"]')
    pg.wait_for_function("() => (document.querySelector('.builds')?.querySelectorAll('li').length || 0) >= 2", timeout=30000)
    pg.click('[data-act="meEdit"]')
    pg.wait_for_selector("#meSql")
    pg.select_option('[data-chg="meInc"]', "YM")
    pg.click('[data-act="meRun"]')
    pg.wait_for_selector(".chk li")
    pg.click("#meSave")
    pg.wait_for_function("() => (document.querySelector('.me-head')?.innerText || '').includes('성공')", timeout=30000)
    pg.click('.rtab[data-v="build"]')
    pg.click('.bt.hl [data-act="scanWz"], .bt [data-act="scanWz"]')
    pg.click('[data-act="scwMode"][data-v="rel"]')
    pg.select_option('[data-chg="scwStart"]', "TB_RCV_MST")
    pg.click('[data-act="scwRun"]')
    pg.wait_for_selector('[data-chg="scwSel"]', timeout=30000)
    assert pg.locator(".rel").count() == 1 and "TB_RCV_MST" in pg.text_content(".rel") and "입고 (GoodsReceipt)" in pg.inner_text(".gov-list")
    pg.click('[data-act="dClose"] >> nth=0')
    assert not errors
