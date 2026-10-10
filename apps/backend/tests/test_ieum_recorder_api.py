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


def _start(base, **kw):
    body = {"name": "조회", "owner": "홍길동", "base": base + "/demo-legacy/po", "start": "/login.do", "env": "op",
            "account": DEMO_USER_ID, "password": DEMO_PASSWORD}
    body.update(kw)
    return api(base, "POST", "/recordings/", body)[1]


def test_WebSocket_토큰이_틀리면_4403으로_닫고_나쁜_메시지에도_연결이_산다(ieum_server):
    out = _start(ieum_server)
    ws_url = ieum_server.replace("http", "ws") + "/api/ieum/recorder/ws/" + out["id"]
    with connect(ws_url + "?token=wrong") as ws:
        with pytest.raises(Exception) as ei:
            ws.recv(timeout=5)
        assert ei.value.rcvd.code == 4403
    with connect(ws_url + "?token=" + out["token"], max_size=None) as ws:
        for bad in ("not json", "[1,2]", '{"t":"click"}', '{"t":"tab","index":"x"}'):
            ws.send(bad)
        ws.send(json.dumps({"t": "pause", "on": False}))
        ws.send(json.dumps({"t": "tab", "index": 0}))
        seen = set()
        for _ in range(40):
            seen.add(json.loads(ws.recv(timeout=15))["t"])
            if "frame" in seen:
                break
        assert "frame" in seen
    api(ieum_server, "DELETE", f"/recordings/{out['id']}/")


def test_잘못된_기록_번호는_400(ieum_server):
    for method, path in (("GET", "/recordings/abc/"), ("POST", "/recordings/abc/stop/"), ("DELETE", "/recordings/abc/"),
                         ("GET", "/recordings/abc/spans/1/")):
        assert api(ieum_server, method, path)[0] == 400


def test_삭제는_폴더와_금고_키를_지우고_기록이_없어도_키는_지운다(ieum_server):
    from app.ieum.gateway import credentials
    from app.ieum.recorder import store
    from app.ieum.recorder.manager import vault_key
    out = _start(ieum_server)
    rid = out["id"]
    assert credentials.get(vault_key(rid))
    api(ieum_server, "POST", f"/recordings/{rid}/stop/")
    assert api(ieum_server, "DELETE", f"/recordings/{rid}/")[0] == 200
    assert not store.rec_dir(rid).exists() and not credentials.get(vault_key(rid))
    credentials.put(vault_key("rec_deadbeef"), {"password": "x"})
    assert api(ieum_server, "DELETE", "/recordings/rec_deadbeef/")[0] == 404
    assert not credentials.get(vault_key("rec_deadbeef"))


def test_행동_근거는_hidden과_shot을_빼고_준다(ieum_server):
    from app.ieum.recorder import store
    out = _start(ieum_server)
    rid = out["id"]
    api(ieum_server, "POST", f"/recordings/{rid}/stop/")
    seq = store.append_span(rid, {"seq": 1, "action": {"type": "click"}, "pre": {"url": "u", "title": "t", "aria": "a", "hidden": {"k": "v"}, "shot": "1-pre.jpg"},
                            "post": {"url": "u2", "title": "t2", "aria": "a2", "hidden": {}, "shot": "1-post.jpg"}})
    code, d = api(ieum_server, "GET", f"/recordings/{rid}/spans/{seq}/")
    assert code == 200 and set(d["pre"]) == {"url", "title", "aria"} and "hidden" not in str(d)
    api(ieum_server, "DELETE", f"/recordings/{rid}/")


def test_멈추는_중인_세션의_종료는_409(ieum_server, monkeypatch):
    from app.ieum.recorder import manager

    async def busy(rid):
        raise manager.RecorderError("이미 멈추는 중입니다.", 409)
    monkeypatch.setattr(manager.MANAGER, "stop", busy)
    assert api(ieum_server, "POST", "/recordings/rec_00000000/stop/")[0] == 409


def test_기동_훅은_정리가_실패해도_끝난다(monkeypatch):
    from app.ieum.recorder import retention, store
    from app.ieum.routers import recorder

    def boom(*a, **k):
        raise RuntimeError("깨진 JSON")
    monkeypatch.setattr(store, "mark_interrupted", boom)
    monkeypatch.setattr(retention, "sweep", boom)
    recorder._startup()
