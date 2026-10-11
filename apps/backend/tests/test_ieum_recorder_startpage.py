# apps/backend/tests/test_ieum_recorder_startpage.py
"""기록 시작 화면도 묶음으로 남는다: 목록 화면에서 시작해 두 번째 항목을 누르는 업무가 두 단계로 이어지고 검증된다.

외부 사이트에 접속하지 않는다. 시험 안의 http.server 가 목록·상세 화면을 준다.
"""
import asyncio
import http.server
import json
import os
import threading
import time

import httpx
import pytest
from websockets.sync.client import connect

from app.ieum.discovery.browser import capabilities
from app.ieum.recorder import analyze, htmltable
from tests.test_ieum_recorder_trace import _bare_trace

LIST = """<html><head><title>뉴스 목록</title></head><body><ul class="gnb"><li><a href="/section/1">경제</a></li><li><a href="/section/2">사회</a></li></ul>
<div class="news-list">
 <div class="item"><a class="t" href="/mnews/article/052/{a}">첫 기사 제목</a></div>
 <div class="item"><a class="t" href="/mnews/article/052/{b}">둘째 기사 제목</a></div>
 <div class="item"><a class="t" href="/mnews/article/052/{c}">셋째 기사 제목</a></div>
</div></body></html>"""
DETAIL = "<html><head><title>기사</title></head><body><h2>기사 본문 {id}</h2><p>내용입니다</p></body></html>"


# ── trace: 시작 화면 묶음 ───────────────────────────────────────────────────
class _Req:
    resource_type, method, headers, post_data = "document", "GET", {}, None


def _resp(url, body):
    class R:
        status, headers, request = 200, {"content-type": "text/html; charset=utf-8"}, _Req()

        async def text(self):
            return body
    R.url = url
    return R()


def test_시작_화면을_여는_묶음이_응답을_담는다():
    tr = _bare_trace()
    loop = asyncio.new_event_loop()
    assert loop.run_until_complete(tr.begin_open(None, "http://rec.test/po/list.do?tel=010-1234-5678")) == 1
    loop.run_until_complete(tr.on_response(_resp("http://rec.test/po/list.do", LIST.format(a="0000000001", b="0000000002", c="0000000003"))))
    act = tr.current["action"]
    assert act["type"] == "open" and act["label"] == "시작 화면 열기" and act["target"] is None and "1234-5678" not in act["url"]
    assert htmltable.links_of(tr.current["network"][0]["data"])


def test_시작_화면이_로그인_화면이면_묶음을_버린다():
    tr = _bare_trace()
    loop = asyncio.new_event_loop()
    loop.run_until_complete(tr.begin_open(None, "http://rec.test/po/login.do"))
    loop.run_until_complete(tr.discard_open())
    assert tr.current is None and tr.seq == 0


# ── analyze: 시작 화면이 다음 단계 값의 출처 ────────────────────────────────
def _net(url, body, data=None):
    from urllib.parse import urlsplit
    p = urlsplit(url)
    origin = f"{p.scheme}://{p.netloc}"
    return {"method": "GET", "url": url, "origin": origin, "base": origin, "path": p.path, "status": 200, "ctype": "text/html", "charset": None,
            "rtype": "document", "headers": {}, "post": None, "res": body[:4000], "data": data, "file": False, "held": False, "decision": "",
            "primary": True, "t": 0}


def test_시작_화면_목록에서_두번째_항목을_누르면_시작_화면이_단계가_되고_값이_이어진다():
    base = "http://h:8080"
    lst = LIST.format(a="0000000001", b="0000000002", c="0000000003")
    spans = [
        {"seq": 1, "action": {"type": "open", "url": base + "/list.do", "label": "시작 화면 열기", "target": None, "isTrusted": None, "t": 1},
         "fills": [], "pre": {"url": "", "href": "", "title": "", "aria": "", "hidden": {}, "shot": None},
         "network": [_net(base + "/list.do", lst, htmltable.to_data(lst)),
                     dict(_net(base + "/log/collect.do", ""), method="POST", rtype="xhr")],          # 화면이 열리며 스스로 보낸 쓰기
         "post": {"url": "/list.do", "href": base + "/list.do", "title": "뉴스 목록", "aria": "- link: 첫 기사 제목\n- link: 둘째 기사 제목", "hidden": {}, "shot": None}},
        {"seq": 2, "action": {"type": "click", "target": {"tag": "A", "text": "둘째 기사 제목"}, "isTrusted": True, "t": 2}, "fills": [],
         "pre": {"url": "/list.do", "href": base + "/list.do", "title": "뉴스 목록", "aria": "", "hidden": {}, "shot": None},
         "network": [_net(base + "/mnews/article/052/0000000002", DETAIL.format(id="0000000002"))],
         "post": {"url": "/x", "href": base + "/x", "title": "기사", "aria": "- heading: 기사 본문 0000000002\n- text: 내용입니다", "hidden": {}, "shot": None}},
    ]
    bf = analyze.analyze({"id": "rec_00000020", "name": "기사 보기", "sourceBase": base, "env": "op", "login": {}, "approvals": []}, spans)
    assert [s["path"] for s in bf["steps"]] == ["/list.do", "/mnews/article/{id}/{id2}"]
    assert bf["steps"][0]["label"] == "시작 화면 열기"
    p = next(p for p in bf["steps"][1]["params"] if p["a"] == "id2")
    assert p["from"].startswith("s1.links[") and p["source"] == "PREVIOUS_STEP_OUTPUT"
    assert any(e["path"] == "/log/collect.do" and e["role"] == "noise" for e in bf["excluded"])


# ── 전 구간: 브라우저로 기록하고 검증 ──────────────────────────────────────
browser = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"], reason="브라우저가 없다")


@pytest.fixture
def news_site():
    st = {"ids": ["0000000001", "0000000002", "0000000003"], "hits": []}

    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            st["hits"].append(self.path)
            if self.path.startswith("/list.do"):
                a, b, c = st["ids"]
                body = LIST.format(a=a, b=b, c=c)
            elif self.path.startswith("/mnews/article/"):
                body = DETAIL.format(id=self.path.rsplit("/", 1)[-1])
            else:
                self.send_response(404)
                self.end_headers()
                return
            data = body.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *a):
            pass
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    st["base"] = f"http://127.0.0.1:{srv.server_address[1]}"
    yield st
    srv.shutdown()


@browser
def test_목록에서_시작해_두번째_기사를_누른_기록이_두_단계로_검증된다(ieum_server, news_site):
    from app.ieum.recorder import relay
    from app.ieum.recorder.manager import MANAGER
    r = httpx.post(ieum_server + "/api/ieum/recorder/recordings/", json={
        "name": "기사 보기", "owner": "시험", "base": news_site["base"], "start": "/list.do", "env": "op"}, timeout=90).json()["resultData"]
    rid = r["id"]
    ws = connect(ieum_server.replace("http", "ws") + f"/api/ieum/recorder/ws/{rid}?token={r['token']}", max_size=None)
    try:
        time.sleep(2)
        s = MANAGER.get(rid)
        b = asyncio.run_coroutine_threadsafe(s.page.locator("a.t >> nth=1").bounding_box(), MANAGER.loop).result(30)
        ws.send(json.dumps({"t": "click", "x": b["x"] + b["width"] / 2, "y": b["y"] + b["height"] / 2, "w": relay.VIEW_W, "h": relay.VIEW_H}))
        time.sleep(1.5)
        news_site["ids"] = ["0000000009", "0000000008", "0000000007"]          # 재실행 때는 목록이 바뀐다
        httpx.post(ieum_server + f"/api/ieum/recorder/recordings/{rid}/stop/", timeout=90)
        end = time.time() + 120
        while time.time() < end:
            rec = httpx.get(ieum_server + f"/api/ieum/recorder/recordings/{rid}/").json()["resultData"]
            if rec["status"] in ("review", "failed"):
                break
            time.sleep(0.5)
        assert rec["status"] == "review", rec.get("error")
        bf = httpx.get(ieum_server + f"/api/ieum/recorder/functions/{rec['functionId']}/").json()["resultData"]
        assert [st["path"] for st in bf["steps"]] == ["/list.do", "/mnews/article/{id}/{id2}"]
        assert bf["verification"]["runs"][0]["ok"] is True, bf["verification"]
        assert "/mnews/article/052/0000000008" in news_site["hits"]
    finally:
        try:
            httpx.post(ieum_server + f"/api/ieum/recorder/recordings/{rid}/stop/", timeout=60)
        except Exception:
            pass
        ws.close()


def _open_span(base, network, aria):
    return {"seq": 1, "action": {"type": "open", "url": base + "/list.do", "label": "시작 화면 열기", "target": None, "isTrusted": None, "t": 1},
            "fills": [], "pre": {"url": "", "href": "", "title": "", "aria": "", "hidden": {}, "shot": None},
            "network": network, "post": {"url": "/list.do", "href": base + "/list.do", "title": "목록", "aria": aria, "hidden": {}, "shot": None}}


def test_시작_묶음의_요청은_화면에_보여도_뒤_단계가_쓰지_않으면_단계가_아니다():
    """시작 묶음은 첫 사람 입력까지(몇 분) 열려 있어 폴링·대시보드 GET 이 쌓인다. 화면에 보인다고 핵심 단계로 두면 운영에 다시 보낸다."""
    base = "http://h:8080"
    poll = dict(_net(base + "/api/notice/poll.do", json.dumps({"notice": "오늘의 공지사항 안내"}, ensure_ascii=False)), rtype="xhr", data=None)
    lst = LIST.format(a="0000000001", b="0000000002", c="0000000003")
    spans = [_open_span(base, [_net(base + "/list.do", lst, htmltable.to_data(lst)), poll], "- text: 오늘의 공지사항 안내\n- link: 첫 기사 제목"),
             {"seq": 2, "action": {"type": "click", "target": {"tag": "A", "text": "둘째 기사 제목"}, "isTrusted": True, "t": 2}, "fills": [],
              "pre": {"url": "/list.do", "href": base + "/list.do", "title": "목록", "aria": "", "hidden": {}, "shot": None},
              "network": [_net(base + "/mnews/article/052/0000000002", DETAIL.format(id="0000000002"))],
              "post": {"url": "/x", "href": base + "/x", "title": "기사", "aria": "- heading: 기사 본문 0000000002", "hidden": {}, "shot": None}}]
    bf = analyze.analyze({"id": "rec_00000021", "name": "기사", "sourceBase": base, "env": "op", "login": {}, "approvals": []}, spans)
    assert [s["path"] for s in bf["steps"]] == ["/list.do", "/mnews/article/{id}/{id2}"]
    assert bf["steps"][0]["role"] == "prereq"
    assert any(e["path"] == "/api/notice/poll.do" for e in bf["excluded"])
