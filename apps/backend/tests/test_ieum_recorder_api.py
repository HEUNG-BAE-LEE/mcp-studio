# apps/backend/tests/test_ieum_recorder_api.py
"""레코더 API: 기록 시작·조회·종료·삭제와 WebSocket 접속 토큰."""
import json
import os

import httpx
import pytest
from websockets.sync.client import connect

from app.ieum.discovery.browser import capabilities
from app.ieum.demo_legacy.site import DEMO_PASSWORD, DEMO_USER_ID

pytestmark = pytest.mark.skipif(os.environ.get("IEUM_SKIP_BROWSER_TESTS") == "1" or not capabilities()["browser"], reason="브라우저가 없다")


def api(base, method, path, body=None):
    r = httpx.request(method, base + "/api/ieum/recorder" + path, json=body, timeout=90)
    j = r.json()
    assert r.status_code == j["resultCode"]
    return j["resultCode"], j["resultData"] if j["resultCode"] < 400 else j["resultMsg"]


def test_기록_시작_WebSocket_종료_삭제(ieum_server):
    code, out = api(ieum_server, "POST", "/recordings/", {"name": "조회", "owner": "홍길동", "base": ieum_server + "/demo-legacy/po",
                                                          "start": "/login.do", "env": "op", "account": DEMO_USER_ID, "password": DEMO_PASSWORD})
    assert code == 201 and out["token"]
    rid, ws_url = out["id"], ieum_server.replace("http", "ws") + "/api/ieum/recorder/ws/" + out["id"]
    with pytest.raises(Exception):
        with connect(ws_url + "?token=wrong") as ws:
            ws.recv(timeout=5)
    with connect(ws_url + "?token=" + out["token"], max_size=None) as ws:
        msg = json.loads(ws.recv(timeout=15))
        while msg["t"] != "frame":
            msg = json.loads(ws.recv(timeout=15))
        assert msg["data"]
    code, listing = api(ieum_server, "GET", "/")
    assert any(r["id"] == rid and r["status"] == "recording" for r in listing["recordings"])
    assert listing["usage"]["byOwner"] == {"홍길동": 1}
    assert api(ieum_server, "POST", f"/recordings/{rid}/stop/")[0] == 200
    assert api(ieum_server, "DELETE", f"/recordings/{rid}/")[0] == 200
    assert api(ieum_server, "GET", f"/recordings/{rid}/")[0] == 404


def test_입력값이_틀리면_400(ieum_server):
    code, msg = api(ieum_server, "POST", "/recordings/", {"name": "", "owner": "a", "base": "x"})
    assert code == 400 and "업무 이름" in msg


def test_스크린샷_이름은_정해진_형식만(ieum_server):
    code, msg = api(ieum_server, "GET", "/recordings/rec_0000abcd/shots/evil.jpg")
    assert code == 400 and "화면 캡처 이름" in msg
