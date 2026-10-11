"""업무 기록 검토 화면: 도구 후보로 등록 카드(정책 칸·확정 버튼 없음)와 등록 뒤 스튜디오 이동(실제 브라우저)."""
import json
import os

import pytest

from app.ieum.discovery.browser import capabilities, launch
from tests.test_ieum_recorder_console import FID, FN as BASE_FN, console_url  # noqa: F401  (console_url 픽스처 재사용)

pytestmark = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"], reason="브라우저가 없다")

FN = dict(BASE_FN, flowBlockers=[])


def _env(data, code=200):
    return json.dumps({"resultCode": code, "resultMsg": "", "resultData": data}, ensure_ascii=False)


def _open(page, console_url, fn):
    page.goto(console_url + "/ieum/")
    page.wait_for_function("typeof RECR === 'object' && typeof recRender === 'function' && !document.body.hasAttribute('aria-busy')")
    page.evaluate("fn => { S.view = 'rec'; RECR.page = 'review'; RECR.fn = fn; RECR.rec = {approvals: []}; recRender(); }", fn)


def test_등록_전에는_막힌_이유를_보이고_정책_칸이_없다(console_url):
    from playwright.sync_api import sync_playwright
    fn = dict(FN, flowBlockers=["쓰기 단계 s4 가 남아 있습니다. 건너뛰거나 단계별로 등록하세요."])
    with sync_playwright() as pw:
        browser, _ = launch(pw)
        try:
            page = browser.new_page()
            _open(page, console_url, fn)
            text = page.inner_text("main") if page.query_selector("main") else page.inner_text("body")
            disabled = page.is_disabled("[data-act=recRegister][data-m=flow]")
            steps_enabled = not page.is_disabled("[data-act=recRegister][data-m=steps]")
            has_confirm = page.query_selector("[data-act=recConfirm]") is not None
        finally:
            browser.close()
    assert "정책 (자동 추정" not in text and "위험 " not in text
    assert "도구 후보로 등록" in text and disabled and "쓰기 단계 s4" in text
    assert steps_enabled and not has_confirm


def test_등록하면_등록_완료와_스튜디오_열기(console_url):
    from playwright.sync_api import sync_playwright
    calls, state = [], {"done": False}
    registered = dict(FN, status="registered", registered={"at": 1, "mode": "flow", "tools": ["news_t"]}, flowBlockers=[])

    def on_register(route):
        calls.append(json.loads(route.request.post_data))
        state["done"] = True
        route.fulfill(status=201, content_type="application/json", body=_env({
            "sources": [{"id": "news-src"}], "tools": [{"id": "news_t", "src": "news-src"}],
            "loginKnown": {"news-src": True}, "function": registered}, 201))

    def on_sources(route):                              # 등록 뒤에는 새 원본이 목록에 있다
        if not state["done"]:
            return route.continue_()
        data = json.loads(route.fetch().text())["resultData"]
        data["sources"].append({"id": "news-src", "name": "뉴스 시스템", "proto": "disc", "base": "https://example.test", "authType": "none"})
        route.fulfill(status=200, content_type="application/json", body=_env(data))

    def on_studio(route):
        if not state["done"]:
            return route.continue_()
        data = json.loads(route.fetch().text())["resultData"]
        data["news-src"] = [{"id": "news_t", "name": "뉴스 조회", "desc": "뉴스를 조회한다", "mode": "read", "status": "review",
                             "method": "GET", "path": "/news.do", "params": [], "res": {}}]
        route.fulfill(status=200, content_type="application/json", body=_env(data))

    with sync_playwright() as pw:
        browser, _ = launch(pw)
        try:
            page = browser.new_page()
            page.route("**/api/ieum/recorder/functions/%s/register/" % FID, on_register)
            page.route("**/api/ieum/sources/", on_sources)
            page.route("**/api/ieum/studio/", on_studio)
            _open(page, console_url, FN)
            page.click("[data-act=recRegister][data-m=flow]")
            page.wait_for_selector("[data-act=goSrc]")
            text = page.inner_text("body")
            page.click("[data-act=goSrc][data-id=news-src]")
            page.wait_for_function("S.view === 'studio' && S.src === 'news-src' && S.tool === 'news_t'")
        finally:
            browser.close()
    assert calls == [{"mode": "flow"}]
    assert "등록 완료" in text and "변환 스튜디오 열기" in text and "다시 등록" in text


def test_이미_등록된_다른_기능을_열면_그_기능의_원본으로_스튜디오가_열린다(console_url):
    """A 를 등록한 뒤 목록을 거쳐 등록된 B 를 열었을 때 낡은 A 원본으로 가지 않는다."""
    from playwright.sync_api import sync_playwright
    state = {"done": False}
    reg_a = dict(FN, status="registered", registered={"at": 1, "mode": "flow", "tools": ["a_t"]})
    fn_b = dict(FN, id="bf_b", name="B 업무", status="registered", registered={"at": 2, "mode": "flow", "tools": ["b_t"]})

    def ok(route, data, code=200):
        route.fulfill(status=code, content_type="application/json", body=_env(data, code))

    def on_register(route):
        state["done"] = True
        ok(route, {"sources": [{"id": "a-src"}], "tools": [{"id": "a_t", "src": "a-src"}], "loginKnown": {"a-src": True}, "function": reg_a}, 201)

    def on_sources(route):
        data = json.loads(route.fetch().text())["resultData"]
        for sid in ("b-src", "a-src") if state["done"] else ("b-src",):
            data["sources"].append({"id": sid, "name": sid, "proto": "disc", "base": "https://example.test", "authType": "none"})
        ok(route, data)

    def on_studio(route):
        data = json.loads(route.fetch().text())["resultData"]
        mk = lambda i: [{"id": i, "name": i, "desc": "d", "mode": "read", "status": "review", "method": "GET", "path": "/x", "params": [], "res": {}}]
        data["b-src"] = mk("b_t")
        if state["done"]:
            data["a-src"] = mk("a_t")
        ok(route, data)

    with sync_playwright() as pw:
        browser, _ = launch(pw)
        try:
            page = browser.new_page()
            page.route("**/api/ieum/recorder/functions/%s/register/" % FID, on_register)
            page.route("**/api/ieum/recorder/recordings/rec_b/", lambda r: ok(r, {"id": "rec_b", "functionId": "bf_b", "approvals": []}))
            page.route("**/api/ieum/recorder/functions/bf_b/", lambda r: ok(r, fn_b))
            page.route("**/api/ieum/sources/", on_sources)
            page.route("**/api/ieum/studio/", on_studio)
            _open(page, console_url, FN)
            page.click("[data-act=recRegister][data-m=flow]")
            page.wait_for_selector("[data-act=goSrc]")
            page.evaluate("RECR.page = 'list'; recRender()")
            page.evaluate("recOpenFn('rec_b')")
            page.wait_for_function("RECR.fn && RECR.fn.id === 'bf_b'")
            page.wait_for_selector("[data-act=goSrc]")
            sid = page.get_attribute("[data-act=goSrc]", "data-id")
            page.click("[data-act=goSrc]")
            page.wait_for_function("S.view === 'studio'")
            src = page.evaluate("S.src")
        finally:
            browser.close()
    assert sid == "b-src" and src == "b-src"
