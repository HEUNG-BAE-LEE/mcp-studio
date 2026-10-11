"""업무 도구 실행: 로컬 HTTP 서버의 목록·상세로 인자 없음/index/match, 행 바뀜, 세션 만료, JSON 마지막 단계를 본다."""
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from app.ieum.flow import runner
from app.ieum.gateway import engine
from app.ieum.recorder import htmltable

# 금고·원본 시스템 목록을 임시 상태 폴더에서 읽게 한다(개발자 PC 의 상태를 건드리지 않는다)
pytestmark = pytest.mark.usefixtures("ieum_state")

ROWS = [("101", "첫째 기사 고려아연 투자"), ("202", "둘째 기사 반도체"), ("303", "셋째 기사 KOREA 경제")]


def _list_html(rows):
    lis = "".join(f'<li class="it"><a href="/art/{i}">{t}</a></li>' for i, t in rows)
    return f'<html><body><ul class="news">{lis}</ul></body></html>'


@pytest.fixture
def site():
    state = {"rows": list(ROWS), "expire_next": 0, "hits": []}

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):
            state["hits"].append(self.path)
            if state["expire_next"] and self.path.startswith("/art/"):
                state["expire_next"] -= 1
                self.send_response(302); self.send_header("Location", "/login.do"); self.end_headers(); return
            if self.path.startswith("/list"):
                body, ct = _list_html(state["rows"]), "text/html; charset=utf-8"
            elif self.path.startswith("/art/"):
                aid = self.path.rsplit("/", 1)[1]
                body, ct = f"<html><body><table><tr><th>번호</th><th>제목</th></tr><tr><td>{aid}</td><td>본문 {aid}</td></tr></table></body></html>", "text/html; charset=utf-8"
            elif self.path.startswith("/api/art/"):
                aid = self.path.rsplit("/", 1)[1]
                body, ct = json.dumps({"id": aid, "title": "본문 " + aid}), "application/json"
            else:
                self.send_response(404); self.end_headers(); return
            data = body.encode()
            self.send_response(200); self.send_header("Content-Type", ct); self.send_header("Content-Length", str(len(data))); self.end_headers()
            self.wfile.write(data)

    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_address[1]}", state
    srv.shutdown()


def _tool(base, last="/art/{id}", last_kind="html"):
    src = "s1.links[/art/{id}@ul.news>li.it][1.0/1].id"
    list_shape = sorted(htmltable.shape(htmltable.to_data(_list_html(ROWS))))
    return {"id": "news_t", "kind": "flow", "mode": "read", "status": "done", "res": [], "mask": False,
            "params": [{"o": "index", "a": "index", "at": "integer", "loc": "pick", "rule": "keep", "req": False},
                       {"o": "match", "a": "match", "at": "string", "loc": "pick", "rule": "keep", "req": False}],
            "flow": {"version": 1, "verifiedAt": 0,
                     "pick": {"list": "s1", "step": "s2", "tpl": "/art/{id}", "group": "ul.news>li.it", "args": {"index": "index", "match": "match"}},
                     "steps": [{"id": "s1", "base": base, "method": "GET", "path": "/list", "params": [], "headers": {}, "kind": "html",
                                "outputs": {src[3:]: src[3:]}, "recordedShape": list_shape, "recordedErrSeen": [], "write": False},
                               {"id": "s2", "base": base, "method": "GET", "path": last, "headers": {}, "kind": last_kind, "outputs": {},
                                "params": [{"a": "id", "loc": "path", "from": src, "ex": "202"}], "recordedErrSeen": [], "write": False}]}}


SRC = {"id": "t-src", "base": "", "proto": "disc"}


def test_인자가_없으면_목록을_돌려준다(site):
    base, st = site
    out, trace = runner.invoke(dict(SRC, base=base), _tool(base), {}, {})
    assert out["total"] == 3 and [x["index"] for x in out["items"]] == [1, 2, 3]
    assert "둘째 기사" in out["items"][1]["text"] and "index" in out["hint"]
    assert st["hits"] == ["/list"] and [s["id"] for s in trace["steps"]] == ["s1"]


def test_index_는_그_행의_상세를_가져오고_고른_항목을_알려준다(site):
    base, st = site
    out, trace = runner.invoke(dict(SRC, base=base), _tool(base), {"index": 2}, {})
    assert out["picked"]["index"] == 2 and "둘째" in out["picked"]["text"]
    assert st["hits"] == ["/list", "/art/202"]
    assert [s["id"] for s in trace["steps"]] == ["s1", "s2"]


def test_목록_순서가_바뀌면_index_는_새_순서를_따른다(site):
    base, st = site
    st["rows"] = [ROWS[2], ROWS[0], ROWS[1]]
    out, _ = runner.invoke(dict(SRC, base=base), _tool(base), {"index": 2}, {})
    assert st["hits"][-1] == "/art/101" and "첫째" in out["picked"]["text"]


def test_match_는_공백과_대소문자를_무시한다(site):
    base, st = site
    out, _ = runner.invoke(dict(SRC, base=base), _tool(base), {"match": "고려 아연"}, {})
    assert st["hits"][-1] == "/art/101"
    out, _ = runner.invoke(dict(SRC, base=base), _tool(base), {"match": "korea"}, {})
    assert st["hits"][-1] == "/art/303"


def test_match_가_없으면_no_match_와_목록(site):
    base, _ = site
    with pytest.raises(engine.ToolError) as e:
        runner.invoke(dict(SRC, base=base), _tool(base), {"match": "없는말"}, {})
    assert str(e.value).startswith("[no_match]") and len(e.value.trace["list"]["items"]) == 3


def test_index_범위를_넘으면_오류(site):
    base, _ = site
    with pytest.raises(engine.ToolError) as e:
        runner.invoke(dict(SRC, base=base), _tool(base), {"index": 9}, {})
    assert str(e.value).startswith("[index_out_of_range]")


def test_마지막_단계가_JSON_이면_변환한_JSON_에_picked(site):
    base, _ = site
    out, _ = runner.invoke(dict(SRC, base=base), _tool(base, "/api/art/{id}", "json"), {"index": 3}, {})
    assert out["id"] == "303" and out["picked"]["index"] == 3


def test_세션이_끊기면_처음부터_한_번_다시_실행한다(site, monkeypatch):
    base, st = site
    from app.ieum.gateway import credentials, session_auth
    monkeypatch.setattr(credentials, "get", lambda sid: {"type": "session", "username": "a", "password": "b", "recipe": {}})
    monkeypatch.setattr(session_auth, "cookie_header", lambda sid, b, c: "JSESSIONID=x")
    monkeypatch.setattr(session_auth, "invalidate", lambda sid: None)
    st["expire_next"] = 1
    out, _ = runner.invoke(dict(SRC, base=base), _tool(base), {"index": 1}, {})
    assert st["hits"] == ["/list", "/art/101", "/list", "/art/101"] and out["picked"]["index"] == 1
    st["expire_next"] = 2
    with pytest.raises(engine.ToolError) as e:
        runner.invoke(dict(SRC, base=base), _tool(base), {"index": 1}, {})
    assert str(e.value).startswith("[auth_expired]")


def test_가린_값은_보내지_않는다(site):
    base, st = site
    t = _tool(base)
    t["flow"]["steps"][0]["params"] = [{"a": "q", "loc": "query", "from": "const:010****5678", "ex": ""}]
    with pytest.raises(engine.ToolError) as e:
        runner.invoke(dict(SRC, base=base), t, {}, {})
    assert str(e.value).startswith("[masked_value]") and st["hits"] == []


def test_원_도구의_단계는_바꾸지_않는다(site):
    base, _ = site
    t = _tool(base)
    before = json.dumps(t, sort_keys=True)
    runner.invoke(dict(SRC, base=base), t, {"index": 3}, {})
    assert json.dumps(t, sort_keys=True) == before


def test_index_가_1_이상_정수가_아니면_bad_index(site):
    base, st = site
    for bad in (0, "x", -1, 1.5, True):
        with pytest.raises(engine.ToolError) as e:
            runner.invoke(dict(SRC, base=base), _tool(base), {"index": bad}, {})
        assert str(e.value).startswith("[bad_index]")
    out, _ = runner.invoke(dict(SRC, base=base), _tool(base), {"index": "2"}, {})
    assert out["picked"]["index"] == 2 and st["hits"][-1] == "/art/202"


def test_필수_입력이_없으면_missing_input(site):
    base, st = site
    t = _tool(base)
    t["params"].append({"o": "q", "a": "q", "at": "string", "loc": "input", "rule": "keep", "req": True})
    with pytest.raises(engine.ToolError) as e:
        runner.invoke(dict(SRC, base=base), t, {}, {})
    assert str(e.value).startswith("[missing_input]") and st["hits"] == []


def test_단계가_상한을_넘으면_too_many_steps(site):
    base, st = site
    t = _tool(base)
    t["flow"]["steps"] = t["flow"]["steps"] * 6
    with pytest.raises(engine.ToolError) as e:
        runner.invoke(dict(SRC, base=base), t, {}, {})
    assert str(e.value).startswith("[too_many_steps]") and st["hits"] == []


@pytest.fixture
def cookie_site():
    """목록이 SID 쿠키를 주고 상세는 그 쿠키가 있어야 열리는 사이트. /other 는 받은 Cookie 헤더를 남긴다."""
    state = {"cookies": {}}

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):
            got = self.headers.get("Cookie") or ""
            state["cookies"][self.path] = got
            extra = []
            if self.path.startswith("/list"):
                body, ct = _list_html(ROWS), "text/html; charset=utf-8"
                extra = [("Set-Cookie", "SID=abc; Path=/"), ("Set-Cookie", "WIDE=x; Domain=com; Path=/")]
            elif self.path.startswith("/art/"):
                if "SID=abc" not in got:
                    self.send_response(403); self.end_headers(); return
                aid = self.path.rsplit("/", 1)[1]
                body, ct = json.dumps({"id": aid}), "application/json"
            elif self.path.startswith("/other"):
                body, ct = json.dumps({"ok": "1"}), "application/json"
            else:
                self.send_response(404); self.end_headers(); return
            data = body.encode()
            self.send_response(200)
            for k, v in extra:
                self.send_header(k, v)
            self.send_header("Content-Type", ct); self.send_header("Content-Length", str(len(data))); self.end_headers()
            self.wfile.write(data)

    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield srv.server_address[1], state
    srv.shutdown()


def test_한_호출_안의_쿠키는_뒤_단계로_이어진다(cookie_site):
    port, st = cookie_site
    base = f"http://127.0.0.1:{port}"
    t = _tool(base, "/art/{id}", "json")
    out, trace = runner.invoke(dict(SRC, base=base), t, {"index": 2}, {})
    assert out["picked"]["index"] == 2 and [s["id"] for s in trace["steps"]] == ["s1", "s2"]
    assert st["cookies"]["/list"] == "" and "SID=abc" in st["cookies"]["/art/202"]
    assert "WIDE" not in st["cookies"]["/art/202"]          # 최상위 이름(com) 도메인 쿠키는 받지 않는다
    # 쿠키는 그 호출 안에서만 산다: 다음 호출의 첫 단계에는 없다
    runner.invoke(dict(SRC, base=base), t, {}, {})
    assert st["cookies"]["/list"] == ""


def test_받은_쿠키는_허용된_호스트로만_보낸다():
    # 시험 서버가 둘째 루프백 호스트를 허용하지 않아(scope: 서버 자신) 전송기만 가짜 전송으로 본다
    import asyncio
    import httpx
    seen = {}

    def handler(req):
        seen[str(req.url)] = req.headers.get("cookie", "")
        if req.url.path == "/list":
            return httpx.Response(200, headers=[("set-cookie", "SID=abc; Path=/"), ("set-cookie", "DOM=d; Domain=example.com; Path=/"),
                                                ("set-cookie", "EVIL=e; Domain=other.org; Path=/"), ("set-cookie", "SEC=s; Path=/; Secure"),
                                                ("set-cookie", "SUB=p; Path=/app")], text="ok")
        return httpx.Response(200, text="ok")

    tr = runner._FlowTransport({}, transport=httpx.MockTransport(handler))
    step = {"method": "GET"}

    async def go():
        for u in ("http://a.example.com/list", "http://a.example.com/app/x", "http://a.example.com/x",
                  "http://b.example.com/x", "http://other.org/x", "https://a.example.com/y"):
            await tr.send(step, u, {}, {}, {}, None)
    asyncio.run(go())
    assert seen["http://a.example.com/list"] == ""
    assert seen["http://a.example.com/app/x"] == "SID=abc; DOM=d; SUB=p"
    assert seen["http://a.example.com/x"] == "SID=abc; DOM=d"
    assert seen["http://b.example.com/x"] == "DOM=d"          # Domain 지정 쿠키만 형제 호스트로
    assert seen["http://other.org/x"] == ""                    # 응답 호스트가 속하지 않는 Domain 은 받지 않는다
    assert "SEC=s" in seen["https://a.example.com/y"] and "SEC" not in seen["http://a.example.com/x"]


def test_행_글자는_가림_설정에_따라_가리고_match_는_원래_글자로_비교한다(site):
    base, st = site
    st["rows"] = [("101", "담당 010-1234-5678 공지"), ("202", "둘째 기사")]
    t = _tool(base)
    t["flow"]["steps"][0]["recordedShape"] = []
    t["mask"] = True
    out, _ = runner.invoke(dict(SRC, base=base), t, {}, {})
    assert "010-1234-5678" not in out["items"][0]["text"] and "5678" in out["items"][0]["text"]
    out, _ = runner.invoke(dict(SRC, base=base), t, {"match": "010-1234"}, {})
    assert st["hits"][-1] == "/art/101" and "010-1234-5678" not in out["picked"]["text"]
    t["mask"] = False
    out, _ = runner.invoke(dict(SRC, base=base), t, {}, {})
    assert "010-1234-5678" in out["items"][0]["text"]
