"""업무 기록 검토 화면: 앞 저장이 끝나기 전에 누른 단계 편집이 앞 변경을 덮어쓰지 않는다(실제 브라우저).

단계 편집 버튼은 단계 목록 전체를 PUT 으로 보낸다. 앞 PUT 의 응답이 오기 전에 다음 버튼을 누르면
낡은 목록이 나가 앞 변경이 사라졌다. 저장 응답을 붙잡아 두고 빠르게 두 번 눌러 확인한다.
"""
import copy
import json
import os
import threading
import time

import pytest
import uvicorn
from fastapi import FastAPI

from app.ieum.discovery.browser import capabilities, launch

pytestmark = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"], reason="브라우저가 없다")

FID = "bf_console_t"


def _step(i):
    return {"id": f"s{i}", "role": "core", "base": "https://example.test", "origin": "https://example.test", "method": "GET",
            "path": f"/p{i}.do", "discriminator": "", "kind": "json", "exec": "http", "write": False, "writeWhy": "GET",
            "params": [], "outputs": {}, "skip": False}


FN = {"id": FID, "name": "시험 업무", "desc": "", "status": "draft", "source": {"base": "https://example.test", "recordingId": "rec_console_t"},
      "inputs": [], "steps": [_step(1), _step(2), _step(3)], "references": [], "excluded": [], "output": {"from": "s3", "fields": []},
      "auth": {"mode": "none"}, "executionMode": None, "evidence": {}, "notes": [],
      "policy": {"operation": "READ", "risk": "LOW", "approval": "NONE", "scope": None, "sensitivity": None},
      "verification": {"status": "pending", "runs": []}}


@pytest.fixture
def console_url(ieum_state):
    """이음 라우터와 콘솔 정적 파일만 실은 앱을 진짜 포트에 띄운다."""
    from app.ieum.console import mount_console
    from app.ieum.routers import router

    live = FastAPI()
    live.include_router(router)
    mount_console(live)
    server = uvicorn.Server(uvicorn.Config(live, host="127.0.0.1", port=0, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.time() + 10
    while not server.started:
        if time.time() > deadline:
            raise RuntimeError("테스트 서버가 10초 안에 뜨지 않았습니다.")
        time.sleep(0.02)
    yield f"http://127.0.0.1:{server.servers[0].sockets[0].getsockname()[1]}"
    server.should_exit = True
    thread.join(timeout=5)


def _apply(fn, body):
    """서버 흉내: PUT 몸통의 단계 순서·건너뛰기를 그대로 반영한 업무 기능을 돌려준다."""
    out = copy.deepcopy(fn)
    by = {s["id"]: s for s in out["steps"]}
    out["steps"] = [dict(by[x["id"]], skip=bool(x.get("skip"))) for x in body["steps"]]
    return out


def _run(console_url, clicks):
    """저장 응답을 붙잡은 채 clicks(선택자)를 차례로 누른 뒤 붙잡은 저장을 하나씩 풀고, (화면 단계, 마지막으로 나간 몸통)을 돌려준다."""
    from playwright.sync_api import sync_playwright

    held, bodies, state = [], [], {"fn": copy.deepcopy(FN)}

    def on_put(route):
        if route.request.method != "PUT":
            return route.continue_()
        bodies.append(json.loads(route.request.post_data))
        held.append(route)                      # 응답을 붙잡아 둔다 — 느린 서버 흉내

    def release(route):
        state["fn"] = _apply(state["fn"], json.loads(route.request.post_data))
        route.fulfill(status=200, content_type="application/json",
                      body=json.dumps({"resultCode": 200, "resultMsg": "", "resultData": state["fn"]}, ensure_ascii=False))

    with sync_playwright() as pw:
        browser, _ = launch(pw)
        try:
            page = browser.new_page()
            page.route(f"**/api/ieum/recorder/functions/{FID}/", on_put)
            page.goto(console_url + "/ieum/")
            page.wait_for_function("typeof RECR === 'object' && typeof recRender === 'function'")
            page.evaluate("fn => { S.view = 'rec'; RECR.page = 'review'; RECR.fn = fn; RECR.rec = {approvals: []}; recRender(); }", FN)
            for sel in clicks:                                      # 앞 저장 응답이 오기 전에 잇달아 누른다
                page.click(sel)
                page.wait_for_timeout(300)
            while held:                                             # 붙잡은 저장을 차례로 풀어 준다(풀면 다음 저장이 나갈 수 있다)
                release(held.pop(0))
                page.wait_for_timeout(300)
            page.wait_for_timeout(300)
            steps = page.evaluate("RECR.fn.steps.map(s => ({id: s.id, skip: !!s.skip}))")
        finally:
            browser.close()
    return steps, bodies[-1]["steps"]


def test_앞_저장이_끝나기_전에_누른_건너뛰기도_사라지지_않는다(console_url):
    steps, last = _run(console_url, ['[data-act=recStepSkip][data-i="0"]', '[data-act=recStepSkip][data-i="2"]'])
    assert [s["id"] for s in steps if s["skip"]] == ["s1", "s3"]
    assert [x["id"] for x in last if x["skip"]] == ["s1", "s3"]   # 마지막으로 나간 목록에 두 변경이 다 있다


def test_잇달아_누른_순서_바꾸기는_단계_id_기준으로_쌓인다(console_url):
    # 화면이 다시 그려지기 전이라 두 번 다 첫 줄(s1)의 ↓ 를 누른 것 — s1 을 두 칸 내린다
    steps, _ = _run(console_url, ['[data-act=recStepMove][data-i="0"][data-d="1"]', '[data-act=recStepMove][data-i="0"][data-d="1"]'])
    assert [s["id"] for s in steps] == ["s2", "s3", "s1"]
