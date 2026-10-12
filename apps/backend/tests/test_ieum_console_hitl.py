"""콘솔 화면 시험: 실제 헤드리스 Chrome 으로 콘솔을 열어 사람과 함께 탐색하는 화면을 눌러 본다.

백엔드 시험(`test_ieum_discovery_hitl.py`)이 서버가 올바르게 동작하는지 본다면, 여기는 화면이 그 상태를 제대로 그리고 사람의 조작을
서버에 제대로 보내는지 본다: 마법사의 검증, 질문 카드, 마우스를 올리면 시간이 멈추는 알림, 직접 조작에서 화면 캡처를 누른 좌표와 입력한 글자,
결과의 질문별 커버리지, 용도 기입, 등록. 콘솔은 빌드 없는 바닐라 JS 라 이 시험이 유일한 자동 점검이다.
"""
import json
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

pytestmark = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"], reason="탐색에 쓸 브라우저가 없다")


@pytest.fixture
def ui(ieum_state):
    """이음 라우터와 콘솔을 진짜 포트에 띄운다(시연용 사이트도 라우터에 들어 있다)."""
    app = FastAPI()
    app.include_router(router)
    mount_console(app)
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=0, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.time() + 10
    while not server.started:
        assert time.time() < deadline, "시험 서버가 10초 안에 뜨지 않았습니다."
        time.sleep(0.02)
    try:
        yield f"http://localhost:{server.servers[0].sockets[0].getsockname()[1]}"
    finally:
        server.should_exit = True
        thread.join(timeout=5)


@pytest.fixture
def page(ui):
    from playwright.sync_api import sync_playwright
    reqs = []
    with sync_playwright() as pw:
        browser, _ = browser_mod.launch(pw)
        try:
            pg = browser.new_context(viewport={"width": 1440, "height": 900}, locale="ko-KR").new_page()
            pg.on("request", lambda r: reqs.append((r.method, r.url, r.post_data)))
            pg.on("pageerror", lambda e: reqs.append(("ERROR", str(e), None)))             # 화면 스크립트 오류도 시험이 알아챈다
            pg.goto(ui + "/ieum/")
            pg.wait_for_function("() => !document.body.hasAttribute('aria-busy')")
            yield pg, reqs
        finally:
            browser.close()


def posted(reqs, what, **match):
    """콘솔이 서버에 보낸 POST 중 /<what>/ 로 간 것의 본문들."""
    out = [json.loads(b) for m, u, b in reqs if m == "POST" and u.rstrip("/").endswith("/" + what) and b]
    return [o for o in out if all(o.get(k) == v for k, v in match.items())]


def wait_post(pg, reqs, what, timeout=10, **match):
    deadline = time.time() + timeout
    while time.time() < deadline:
        found = posted(reqs, what, **match)
        if found:
            return found[-1]
        pg.wait_for_timeout(150)
    raise AssertionError(f"{what} 요청이 가지 않았습니다: {match} / {posted(reqs, what)}")


def toast_text(pg):
    pg.wait_for_function("() => document.querySelector('#toast').classList.contains('show')")
    return pg.inner_text("#toast")


# ---------------------------------------------------------------- 마법사
def open_wizard(pg):
    pg.click('#nav button[data-v="src"]')
    pg.click('[data-act="wzOpen"]')
    pg.click('[data-act="wzMode"][data-v="discover"]')
    pg.click('[data-act="wzNext"]')                                                        # 2단계: 탐색 대상


def test_마법사는_목적과_질문_예시가_없으면_넘어가지_않고_개입_수준을_고른다(page):
    pg, reqs = page
    open_wizard(pg)
    pg.click('[data-act="wzNext"]')
    assert "탐색 목적을 입력해 주세요" in toast_text(pg)                                    # 비어 있으면 다음 단계로 가지 않는다
    pg.fill('[data-k="purpose"]', "구매팀 업무를 AI 비서로 조회")
    pg.click('[data-act="wzNext"]')
    assert "질문 예시를 하나 이상" in toast_text(pg)
    pg.fill('[data-inp="wzQ"][data-i="0"]', "이번 달 발주 금액 얼마야?")
    assert pg.locator('[data-inp="wzQ"]').count() == 3 and pg.inner_text(".qe .qchip") == "Q1"

    pg.click('[data-act="wzQAdd"]')                                                        # 질문 추가, 삭제
    assert pg.locator('[data-inp="wzQ"]').count() == 4 and pg.evaluate("() => document.activeElement.dataset.i") == "3"
    for i in (3, 2, 1):
        pg.click(f'[data-act="wzQDel"][data-i="{i}"]')
    assert pg.locator('[data-inp="wzQ"]').count() == 1
    pg.click('[data-act="wzQDel"][data-i="0"]')
    assert "질문 예시는 하나 이상" in toast_text(pg) and pg.locator('[data-inp="wzQ"]').count() == 1      # 마지막 하나는 지울 수 없다

    pg.click('[data-act="wzDemo"]')                                                        # 시연용 값: 목적과 질문 4개
    assert pg.input_value('[data-k="purpose"]') == "구매팀 업무를 AI 비서로 조회하고 처리" and pg.locator('[data-inp="wzQ"]').count() == 4
    pg.click('[data-act="wzNext"]')                                                        # 3단계: 안전 설정
    assert pg.locator('[data-act="wzHitl"]').count() == 3 and "on" in pg.get_attribute('[data-act="wzHitl"][data-v="ambig"]', "class").split()
    assert "권장" in pg.inner_text('[data-act="wzHitl"][data-v="ambig"]')
    pg.click('[data-act="wzHitl"][data-v="never"]')
    assert pg.is_disabled('select[data-k="wait"]')                                         # 묻지 않으면 기다릴 시간도 없다
    pg.click('[data-act="wzHitl"][data-v="every"]')
    assert not pg.is_disabled('select[data-k="wait"]') and pg.locator("select[data-k=wait] option").count() == 3
    assert pg.is_disabled('[data-act="wzDisc"]')                                           # 담당자 승인을 확인해야 시작할 수 있다
    pg.check('input[data-chg="wzOk"]')
    assert not pg.is_disabled('[data-act="wzDisc"]')
    assert [r for r in reqs if r[0] == "ERROR"] == []


# ---------------------------------------------------------------- 탐색하며 질문에 답한다
def image_click(pg, x, y):
    """화면 캡처 이미지 위의 (x, y)(헤드리스 브라우저 화면 기준)를 누른다."""
    pg.locator("#bwImg").scroll_into_view_if_needed()
    box = pg.locator("#bwImg").bounding_box()
    w, h = pg.evaluate("() => [document.querySelector('#bwImg').naturalWidth, document.querySelector('#bwImg').naturalHeight]")
    pg.mouse.click(box["x"] + x / w * box["width"], box["y"] + y / h * box["height"])


def take_over(pg, reqs):
    """직접 조작 화면: 캡처를 누르면 그 좌표가, 입력한 글자와 키가 서버로 간다."""
    pg.wait_for_selector(".bw.take", timeout=60000)
    assert pg.is_visible("#takeBar") and pg.is_visible("#takeIn") and "조작 끝내기" in pg.inner_text("#dCtl") and "로그인 화면에서 시작" in pg.inner_text("#takeBar")
    assert "직접 조작 중입니다" in pg.inner_text("#dAct") and "dact take" in pg.get_attribute("#dAct", "class")
    pg.wait_for_timeout(2500)                                                              # 크롤러가 로그인 화면을 띄울 시간
    image_click(pg, 595, 156)
    click = wait_post(pg, reqs, "take", op="click")
    assert abs(click["x"] - 595) <= 3 and abs(click["y"] - 156) <= 3 and click["by"] == "관리자"                  # 화면 크기가 달라도 헤드리스 브라우저 화면의 좌표로 바꿔 보낸다
    pg.fill("#takeText", "abc")
    pg.click('[data-act="takeType"]')
    assert wait_post(pg, reqs, "take", op="type")["text"] == "abc" and pg.input_value("#takeText") == ""
    pg.check("#takePw")
    assert pg.get_attribute("#takeText", "type") == "password"                              # 비밀번호는 보내기 전에 화면에서 가린다
    pg.uncheck("#takePw")
    assert pg.get_attribute("#takeText", "type") == "text"
    pg.click('[data-act="takeKey"][data-v="Tab"]')
    assert wait_post(pg, reqs, "take", op="key")["key"] == "Tab"
    pg.click('[data-act="takeEnd"]')
    wait_post(pg, reqs, "take", op="end")
    pg.wait_for_selector(".bw.take", state="detached", timeout=30000)


def test_질문_카드에_답하고_직접_조작하고_용도를_기입해_등록한다(page):
    pg, reqs = page
    open_wizard(pg)
    pg.click('[data-act="wzDemo"]')
    pg.click('[data-act="wzNext"]')
    pg.check('input[data-chg="wzOk"]')
    pg.click('[data-act="wzDisc"]')

    seen, took, geometry = set(), False, False
    deadline = time.time() + 300
    while time.time() < deadline and not pg.locator(".dsum").count():
        card = pg.locator(".qcard")
        if not card.count():
            pg.wait_for_timeout(300)
            continue
        kind = card.locator(".qk").inner_text().strip()
        if not geometry:                                                                   # 좁은 화면에서도 카드가 화면 안에 들어온다
            geometry = True
            assert pg.is_visible("#bwFrz") and "asking" in pg.get_attribute("#bw", "class").split()
            assert "대기" in pg.inner_text("#dCnt") and pg.inner_text("#dTabs .bd2").isdigit()
            pg.wait_for_function("() => document.querySelector('#bellN') && !document.querySelector('#bellN').hidden", timeout=15000)       # 머리글 알림
            assert pg.inner_text("#bellN").isdigit() and pg.title().startswith("(")
            assert "뒤 자동으로" in pg.inner_text("#qLeft") and pg.is_visible("#qBg")
            pg.hover(".qcard")                                                             # 카드 위에 마우스를 올리면 서버에 알려 질문 시간을 멈춘다
            wait_post(pg, reqs, "hold")
            pg.set_viewport_size({"width": 390, "height": 844})
            b = pg.locator(".qcard").bounding_box()
            assert b["x"] >= 0 and b["x"] + b["width"] <= 390 + 1
            pg.set_viewport_size({"width": 1440, "height": 900})
        if "입력값 필요" in kind:
            seen.add("input")
            assert [c.strip() for c in card.locator(".sugg .chip").all_inner_texts()] == ["한빛상사", "한빛"] and card.locator("#qVal").count() == 1
            assert "예상 요청" not in card.inner_text()                                    # 화면에서 알 수 없는 요청을 지어내지 않는다
            card.locator("#qVal").fill("한")
            pg.wait_for_timeout(1800)                                                      # 폴링이 몇 번 지나도 쓰던 글자가 사라지지 않는다
            assert pg.input_value("#qVal") == "한"
            card.locator('.sugg .chip[data-v="한빛상사"]').click()
            wait_post(pg, reqs, "answer", value="한빛상사")
        elif "권한 문제" in kind and not took:
            seen.add("perm")
            took = True
            card.locator("button", has_text="직접 보여 줄게요").click()
            wait_post(pg, reqs, "answer", value="take")
            take_over(pg, reqs)
        else:
            seen.add(kind)
            card.locator("button", has_text="건너뛰기").first.click()
        pg.wait_for_timeout(500)
    assert {"input", "perm"} <= seen, seen

    # 결과: 질문 예시별 커버리지, 사람과 함께 탐색한 요약, 용도 열
    pg.wait_for_selector(".dsum")
    assert pg.locator(".cover li").count() == 4 and "Q1" in pg.inner_text(".cover li:first-child")
    safe = pg.inner_text(".safe.two-col")
    assert "사람 결정" in safe and "직접 조작 1회" in safe and "쓰기 요청" in safe and "안전한 쪽으로 처리" in safe
    filters = pg.inner_text(".toolbar .tl-f")
    assert all(t in filters for t in ("전체", "등록 추천", "질문과 연결", "사람 확인", "모두 확인", "소스에만", "트래픽에만"))
    assert pg.locator("table.dtbl thead th", has_text="용도와 연결된 질문").count() == 1 and pg.locator("table.dtbl tbody tr").count() >= 8

    pg.click('[data-act="dfilter"][data-v="hum"]')                                         # 사람 확인 필터: 사람이 허락했거나 직접 조작해서 찾은 API 만
    human_rows = pg.locator("table.dtbl tbody tr").count()
    texts = pg.locator("table.dtbl tbody tr").all_inner_texts()
    assert 1 <= human_rows < 6 and all("사람 확인" in t for t in texts), texts
    pg.click('[data-act="dfilter"][data-v="all"]')

    row = pg.locator("table.dtbl tbody tr", has_text="/poList.do")                         # 연필로 용도 기입
    row.locator(".use .ibtn").click()
    pg.wait_for_selector("#purpIn")
    assert pg.input_value("#purpIn") in ("발주 목록 조회", "발주 현황 조회") and pg.locator(".purp-q input").count() == 4         # Git 소스를 켰으면 소스의 설명에서, 아니면 화면 이름에서
    assert pg.locator(".purp-q input").nth(1).is_checked() and not pg.locator(".purp-q input").nth(3).is_checked()
    pg.fill("#purpIn", "발주 금액 조회")
    pg.locator(".purp-q input").nth(3).check()
    pg.click('[data-act="mOk"]')
    pg.wait_for_function("() => !document.querySelector('#modal').classList.contains('show')")
    row = pg.locator("table.dtbl tbody tr", has_text="/poList.do")
    assert "발주 금액 조회" in row.inner_text() and "사람 기입" in row.inner_text() and "Q4" in row.inner_text()
    assert wait_post(pg, reqs, "purpose")["key"] == "GET /poList"
    assert "단가" in pg.inner_text(".cover li:nth-child(4)") and "get_po_list" in pg.inner_text(".cover li:nth-child(4)")        # 커버리지에 바로 반영된다

    row.locator("td.l").first.click()                                                      # 근거: 용도 상자
    pg.wait_for_selector("#drawer .use-box")
    assert "발주 금액 조회" in pg.inner_text(".use-box") and "사람 기입" in pg.inner_text(".use-box") and "Q4" in pg.inner_text(".use-box")
    pg.click('#drawer [data-act="dClose"]')

    pg.click('[data-act="discRegister"]')                                                  # 등록: 도구 설명에 질문 문장
    pg.wait_for_selector("#toolList")
    desc = pg.evaluate("() => TOOL['get_po_list'] && TOOL['get_po_list'].desc")
    assert desc and "A4 용지 한빛상사 단가 얼마야?" in desc and desc.endswith("같은 질문에 답할 때 씁니다.")
    assert [r for r in reqs if r[0] == "ERROR"] == []


def test_탐색_결과가_없는_옛_작업도_화면이_깨지지_않는다(page):
    """사람과 함께 탐색하기가 생기기 전에 저장된 작업(hitl, 질문 예시가 없다)을 열어도 화면이 그려진다."""
    pg, reqs = page
    pg.evaluate("""() => {
      S.disc = discBlank('old'); Object.assign(S.disc, { name:'옛 작업', phase:'review', opts:{ git:false, crawl:true, owner:'x', mask:true }, stage:{ src:'skip', web:'done', merge:'done', verify:'done', review:'run' },
        apis:[{ id:'a', m:'GET', path:'/a.do', title:'조회', tool:'get_a', ev:'tr', mode:'read', rec:'yes', recNote:'', verify:{ k:'ok', code:200, ms:5 }, params:[], res:[], src:null, tr:null }] });
      go('disc'); }""")
    assert "옛 작업 자동 탐색" in pg.inner_text("#view") and pg.locator("table.dtbl tbody tr").count() == 1
    assert "질문 예시가 없어" in pg.inner_text(".dsum") and "(용도 미정)" in pg.inner_text("table.dtbl")
    assert [r for r in reqs if r[0] == "ERROR"] == []
