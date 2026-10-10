"""업무 기록 전 구간: 시연용 레거시 사이트에서 사람 대신 WebSocket 으로 클릭·입력을 보낸다.

- XHR 읽기 업무(조회 → 상세)가 2단계 업무 기능과 poNo 연결이 되고 검증된다
- 서버 렌더링 업무(폼 검색 → 상세)가 HTML 표 단계 2개, 표에서 꺼낸 값 연결, 숨은 토큰 → 브라우저 실행으로 정리되고 검증된다
- 운영 쓰기는 승인 없이는 시연 사이트에 닿지 않는다
- 한글 IME 입력이 깨지지 않는다
"""
import asyncio
import json
import os
import threading
import time

import httpx
import pytest
from websockets.sync.client import connect

from app.ieum.discovery.browser import capabilities
from app.ieum.demo_legacy.site import DEMO_PASSWORD, DEMO_USER_ID

pytestmark = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"], reason="브라우저가 없다")


class Driver:
    """사람 역할. 화면 요소 위치를 세션 페이지에서 읽어 그 좌표를 WebSocket 으로 클릭한다."""

    def __init__(self, base, owner="시험", read_post=""):
        self.base = base
        r = httpx.post(base + "/api/ieum/recorder/recordings/", json={
            "name": "업무", "owner": owner, "base": base + "/demo-legacy/po", "start": "/login.do", "env": "op",
            "account": DEMO_USER_ID, "password": DEMO_PASSWORD, "readPost": read_post}, timeout=90).json()["resultData"]
        self.rid = r["id"]
        self.ws = connect(base.replace("http", "ws") + f"/api/ieum/recorder/ws/{self.rid}?token={r['token']}", max_size=None)
        self.msgs = []
        threading.Thread(target=self._pump, daemon=True).start()
        self.wait(lambda m: m["t"] == "frame")

    def _pump(self):
        try:
            while True:
                self.msgs.append(json.loads(self.ws.recv()))
        except Exception:
            pass

    def wait(self, pred, timeout=30):
        end = time.time() + timeout
        while time.time() < end:
            for m in list(self.msgs):
                if pred(m):
                    return m
            time.sleep(0.1)
        raise AssertionError("기다린 메시지가 오지 않았다")

    @property
    def session(self):
        from app.ieum.recorder.manager import MANAGER
        return MANAGER.get(self.rid)

    def run(self, coro):
        from app.ieum.recorder.manager import MANAGER
        return asyncio.run_coroutine_threadsafe(coro, MANAGER.loop).result(30)

    def click(self, sel):
        from app.ieum.recorder import relay
        b = self.run(self.session.page.locator(sel).first.bounding_box())
        self.ws.send(json.dumps({"t": "click", "x": b["x"] + b["width"] / 2, "y": b["y"] + b["height"] / 2, "w": relay.VIEW_W, "h": relay.VIEW_H}))
        time.sleep(1.2)

    def text(self, s):
        self.ws.send(json.dumps({"t": "text", "data": s}))
        time.sleep(0.3)

    def key(self, k):
        self.ws.send(json.dumps({"t": "key", "key": k}))
        time.sleep(0.2)

    def cookies(self):
        async def get():
            return {c["name"]: c["value"] for c in await self.session.ctx.cookies()}
        return self.run(get())

    def stop_and_wait(self):
        # 마지막 행동의 묶음은 기록을 끝낼 때 닫힌다 — 클릭 직후에 기다리지 않는다
        httpx.post(self.base + f"/api/ieum/recorder/recordings/{self.rid}/stop/", timeout=60)
        end = time.time() + 120
        while time.time() < end:
            rec = httpx.get(self.base + f"/api/ieum/recorder/recordings/{self.rid}/").json()["resultData"]
            if rec["status"] in ("review", "failed"):
                return rec
            time.sleep(0.5)
        raise AssertionError("분석·검증이 끝나지 않았다")

    def close(self):
        """시험이 끝나면 기록을 멈추고 연결을 닫는다(브라우저 세션을 남기지 않는다)."""
        try:
            httpx.post(self.base + f"/api/ieum/recorder/recordings/{self.rid}/stop/", timeout=60)
        except Exception:
            pass
        try:
            self.ws.close()
        except Exception:
            pass

    def function(self, rec):
        return httpx.get(self.base + f"/api/ieum/recorder/functions/{rec['functionId']}/").json()["resultData"]


def test_XHR_읽기_업무가_두_단계_업무_기능이_되고_검증된다(ieum_server):
    d = Driver(ieum_server)
    d.click("text=발주 현황")
    d.click("#btnSearch")
    d.click("tr[onclick] >> nth=0")
    rec = d.stop_and_wait()
    assert rec["status"] == "review", rec.get("error")
    bf = d.function(rec)
    assert [s["path"] for s in bf["steps"]] == ["/poList.do", "/poDetail.do"]
    assert any(e["path"] == "/poListView.do" and e["role"] == "page" for e in bf["excluded"])   # 메뉴 화면 이동은 단계가 아니다
    po = next(p for p in bf["steps"][1]["params"] if p["a"] == "poNo")
    assert po["from"].startswith("s1.") and po["source"] == "PREVIOUS_STEP_OUTPUT"
    assert bf["verification"]["runs"][0]["ok"] is True and bf["desc"]


def test_서버_렌더링_업무가_HTML_표_단계와_브라우저_실행으로_검증된다(ieum_server):
    from app.ieum.recorder import store
    d = Driver(ieum_server, read_post="/vendSearch.do")             # 검색 POST 는 조회라고 알려 준다
    d.run(d.session.page.goto(ieum_server + "/demo-legacy/po/vendSearchView.do"))
    d.click("#vendNm")
    d.text("한빛")
    d.click("#btnSsrSearch")
    d.click("#vendResult a >> nth=0")
    rec = d.stop_and_wait()
    assert rec["status"] == "review", rec.get("error")
    bf = d.function(rec)
    s1, s2 = bf["steps"]
    assert (s1["method"], s1["path"], s1["kind"], s1["exec"]) == ("POST", "/vendSearch.do", "html", "browser")
    assert (s2["path"], s2["kind"]) == ("/vendDetail.do", "html")
    v = next(p for p in s2["params"] if p["a"] == "vendCd")
    assert v["source"] == "PREVIOUS_STEP_OUTPUT" and v["from"].startswith("s1.")
    assert bf["verification"]["runs"][0]["ok"] is True and bf["executionMode"] == "browser"
    spans = store.read_spans(rec["id"])
    saved = " ".join(s["post"]["aria"] + json.dumps(s["network"], ensure_ascii=False) for s in spans)
    assert "010-4821-5678" not in saved                              # 상세 화면의 휴대전화는 ARIA·응답 사본 어디에도 원값으로 남지 않는다


def test_운영_쓰기는_거절하면_닿지_않고_승인하면_닿는다(ieum_server):
    d = Driver(ieum_server)
    try:
        d.click("text=발주 등록")
        d.click("#btnVend")
        d.click("a.vendPick >> nth=0")
        d.click("button.pick >> nth=0")
        d.click("#btnSave")
        hold = d.wait(lambda m: m["t"] == "hold")
        assert hold["path"].endswith("/poSave.do")
        d.ws.send(json.dumps({"t": "approve", "id": hold["id"], "ok": False}))
        d.wait(lambda m: m["t"] == "hold-end" and m["decision"] == "deny")
        q = dict(params={"fromDt": "20261001", "toDt": "20261031"}, headers={"X-Requested-With": "XMLHttpRequest"}, timeout=10)
        assert httpx.get(ieum_server + "/demo-legacy/po/poList.do", cookies=d.cookies(), **q).json()["totalCnt"] == 0
        d.msgs.clear()
        d.click("#btnSave")
        hold = d.wait(lambda m: m["t"] == "hold")
        d.ws.send(json.dumps({"t": "approve", "id": hold["id"], "ok": True}))
        d.wait(lambda m: m["t"] == "hold-end" and m["decision"] == "approve")
        end = time.time() + 15
        while time.time() < end:
            if httpx.get(ieum_server + "/demo-legacy/po/poList.do", cookies=d.cookies(), **q).json()["totalCnt"] == 1:
                break
            time.sleep(0.3)
        assert httpx.get(ieum_server + "/demo-legacy/po/poList.do", cookies=d.cookies(), **q).json()["totalCnt"] == 1
    finally:
        d.close()


def test_한글_입력이_깨지지_않는다(ieum_server):
    d = Driver(ieum_server)
    try:
        d.click("text=발주 등록")
        d.click("#vendNm")
        for _ in range(4):
            d.key("Backspace")
        d.text("한빛")
        assert d.run(d.session.page.input_value("#vendNm")) == "한빛"
    finally:
        d.close()
