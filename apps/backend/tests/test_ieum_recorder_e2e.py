"""업무 기록 전 구간: 시연용 레거시 사이트에서 사람 대신 WebSocket 으로 클릭·입력을 보낸다.

- XHR 읽기 업무(메뉴 화면 → 조회 → 상세)가 3단계 업무 기능과 poNo 연결이 되고 검증된다
- 서버 렌더링 업무(폼 검색 → 상세)가 HTML 표 단계 2개, 표에서 꺼낸 값 연결, 숨은 토큰 → 브라우저 실행으로 정리되고 검증된다
- 기록 중 운영 쓰기는 묻지 않고 시연 사이트에 닿고 보낸 쓰기(sent)로 남는다(설계 3판)
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

    def __init__(self, base, owner="시험"):
        self.base = base
        r = httpx.post(base + "/api/ieum/recorder/recordings/", json={
            "name": "업무", "owner": owner, "base": base + "/demo-legacy/po", "start": "/login.do", "env": "op",
            "account": DEMO_USER_ID, "password": DEMO_PASSWORD}, timeout=90).json()["resultData"]
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

    def stop_and_wait(self, approve=False):
        # 마지막 행동의 묶음은 기록을 끝낼 때 닫힌다 — 클릭 직후에 기다리지 않는다
        # approve: 운영 재실행 검증이 GET 이 아닌 단계마다 묻는 승인 창에 사람 대신 승인한다(설계 3판 7절)
        httpx.post(self.base + f"/api/ieum/recorder/recordings/{self.rid}/stop/", timeout=90)
        end = time.time() + 120
        answered = set()
        while time.time() < end:
            if approve:
                for m in list(self.msgs):
                    if m["t"] == "hold" and m["id"] not in answered:
                        answered.add(m["id"])
                        self.ws.send(json.dumps({"t": "approve", "id": m["id"], "ok": True}))
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


def test_XHR_읽기_업무가_메뉴_화면과_두_조회_단계로_검증된다(ieum_server):
    d = Driver(ieum_server)
    d.click("text=발주 현황")
    d.click("#btnSearch")
    d.click("tr[onclick] >> nth=0")
    rec = d.stop_and_wait()
    assert rec["status"] == "review", rec.get("error")
    bf = d.function(rec)
    # 메뉴 화면(/poListView.do)은 사람이 눌러 도착한 마지막 주 화면 문서라 핵심 단계다(T13: 같은 화면 안의 조회·상세 XHR 은 화면을 옮기지 않는다)
    assert [s["path"] for s in bf["steps"]] == ["/poListView.do", "/poList.do", "/poDetail.do"]
    assert bf["steps"][0]["method"] == "GET" and bf["steps"][0]["write"] is False
    po = next(p for p in bf["steps"][2]["params"] if p["a"] == "poNo")
    assert po["from"].startswith("s2.") and po["source"] == "PREVIOUS_STEP_OUTPUT"
    assert bf["verification"]["runs"][0]["ok"] is True and bf["desc"]


def test_서버_렌더링_업무가_HTML_표_단계와_브라우저_실행으로_검증된다(ieum_server):
    from app.ieum.recorder import store
    d = Driver(ieum_server)
    d.run(d.session.page.goto(ieum_server + "/demo-legacy/po/vendSearchView.do"))
    d.click("#vendNm")
    d.text("한빛")
    d.click("#btnSsrSearch")
    d.click("#vendResult a >> nth=0")
    rec = d.stop_and_wait(approve=True)                              # 운영: 검색 POST 는 조회여도 재실행 전에 승인받는다
    assert rec["status"] == "review", rec.get("error")
    bf = d.function(rec)
    s1, s2 = bf["steps"]
    assert (s1["method"], s1["path"], s1["kind"], s1["exec"]) == ("POST", "/vendSearch.do", "html", "browser")
    assert (s2["path"], s2["kind"]) == ("/vendDetail.do", "html")
    v = next(p for p in s2["params"] if p["a"] == "vendCd")
    assert v["source"] == "PREVIOUS_STEP_OUTPUT" and v["from"].startswith("s1.")
    assert bf["verification"]["runs"][0]["ok"] is True and bf["executionMode"] == "browser"
    asked = [m for m in d.msgs if m["t"] == "hold"]
    assert asked and all(m["method"] == "POST" and "조회로 보이는 POST" in m["label"] for m in asked)
    spans = store.read_spans(rec["id"])
    saved = " ".join(s["post"]["aria"] + json.dumps(s["network"], ensure_ascii=False) for s in spans)
    assert "010-4821-5678" not in saved                              # 상세 화면의 휴대전화는 ARIA·응답 사본 어디에도 원값으로 남지 않는다


def test_기록_중_운영_쓰기는_묻지_않고_닿고_보낸_쓰기로_남는다(ieum_server):
    # 설계 3판: 기록 중 쓰기는 사람의 실제 업무라 붙잡지 않고 보낸다. 승인은 재실행 검증 때 받는다
    d = Driver(ieum_server)
    try:
        q = dict(params={"fromDt": "20261001", "toDt": "20261031"}, headers={"X-Requested-With": "XMLHttpRequest"}, timeout=10)
        d.click("text=발주 등록")
        assert httpx.get(ieum_server + "/demo-legacy/po/poList.do", cookies=d.cookies(), **q).json()["totalCnt"] == 0
        d.click("#btnVend")
        d.click("a.vendPick >> nth=0")
        d.click("button.pick >> nth=0")
        d.click("#btnSave")
        end = time.time() + 15
        while time.time() < end:
            if httpx.get(ieum_server + "/demo-legacy/po/poList.do", cookies=d.cookies(), **q).json()["totalCnt"] == 1:
                break
            time.sleep(0.3)
        assert httpx.get(ieum_server + "/demo-legacy/po/poList.do", cookies=d.cookies(), **q).json()["totalCnt"] == 1
        assert not [m for m in d.msgs if m["t"] == "hold"]
        assert any(x["decision"] == "sent" and x["path"].endswith("/poSave.do") for x in d.session.guard.decisions)
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


def test_검색어를_넣고_Enter로_제출해도_단계와_입력값과_연결이_잡힌다(ieum_server):
    d = Driver(ieum_server)
    d.run(d.session.page.goto(ieum_server + "/demo-legacy/po/vendSearchView.do"))
    d.click("#vendNm")
    d.text("한빛")
    d.key("Enter")                                                   # 검색 버튼을 누르지 않고 Enter 로 제출한다
    time.sleep(1.2)
    d.click("#vendResult a >> nth=0")
    rec = d.stop_and_wait(approve=True)
    assert rec["status"] == "review", rec.get("error")
    bf = d.function(rec)
    s1, s2 = bf["steps"]
    assert s1["path"] == "/vendSearch.do" and s2["path"] == "/vendDetail.do"
    q = next(p for p in s1["params"] if p["a"] == "vendNm")
    assert q["source"] == "USER_INPUT"
    v = next(p for p in s2["params"] if p["a"] == "vendCd")
    assert v["source"] == "PREVIOUS_STEP_OUTPUT" and v["from"].startswith("s1.")
