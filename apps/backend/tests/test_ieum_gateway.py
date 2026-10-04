"""이음 게이트웨이 통합 테스트: 시연용 원본 시스템을 연결해 변환, MCP 호출, 로그까지 확인한다."""
import json

import httpx
import pytest


class Console:
    """콘솔 API({resultCode, resultMsg, resultData})와 MCP 엔드포인트를 부르는 도우미."""

    def __init__(self, base):
        self.base = base

    def api(self, method, path, body=None):
        r = httpx.request(method, self.base + "/api/ieum" + path, json=body)
        j = r.json()
        assert r.status_code == j["resultCode"], "HTTP 상태와 resultCode 가 같아야 한다"
        return j["resultCode"], j["resultData"] if j["resultCode"] < 400 else j["resultMsg"]

    def mcp(self, key, method, params=None, slug="hr", raw=None, content=None):
        """raw 는 JSON-RPC 본문을 통째로, content 는 JSON 이 아닌 바이트를 보낼 때 쓴다."""
        url, headers = "%s/mcp/ieum/%s" % (self.base, slug), {"Authorization": "Bearer " + key}
        if content is not None:
            r = httpx.post(url, headers=dict(headers, **{"Content-Type": "application/json"}), content=content)
        else:
            r = httpx.post(url, headers=headers, json=raw or {"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}})
        return r.status_code, (r.json() if r.content else None)

    def connect_demo(self):
        st, d = self.api("POST", "/sources/connect/", {
            "mode": "rest", "name": "demo", "specUrl": self.base + "/demo-origin/openapi.json",
            "auth": {"type": "key", "key": "demo-key", "in": "header", "name": "X-API-KEY"}})
        assert st == 201
        return d


@pytest.fixture
def console(ieum_server):
    return Console(ieum_server)


def publish_hr(console, ids):
    """도구를 공개하고 묶음을 배포해 (묶음, 키 발급 응답)을 돌려준다."""
    for tid in ids:
        assert console.api("PUT", "/studio/%s/" % tid, {"status": "done"})[0] == 200
    st, ts = console.api("POST", "/deploy/toolsets/", {"name": "HR", "slug": "hr", "tools": ids})
    assert st == 201
    assert console.api("POST", "/deploy/toolsets/%s/deploy/" % ts["id"])[0] == 200
    st, key = console.api("POST", "/deploy/keys/", {"name": "t"})
    assert st == 201
    return ts, key


def test_end_to_end(console, ieum_state):
    d = console.connect_demo()
    ids = [t["id"] for t in d["tools"]]
    assert ids == ["search_employee", "get_vacation_balance", "request_vacation"]
    assert "demo-key" not in json.dumps(d)  # 인증 정보는 응답에 없다

    # 인증 정보는 디스크에도 평문으로 남지 않는다
    assert b"demo-key" not in (ieum_state / "source_secrets.enc").read_bytes()
    assert oct((ieum_state / "source_secrets.enc").stat().st_mode & 0o777) == "0o600"

    ts, key = publish_hr(console, ids)
    secret = key["secret"]
    assert "hash" not in key

    assert console.mcp("bad", "tools/list")[0] == 401
    names = [t["name"] for t in console.mcp(secret, "tools/list")[1]["result"]["tools"]]
    assert names == ids

    # 날짜(ISO <-> YYYYMMDD), 문자열 숫자 -> 숫자, 이름 정리
    res = console.mcp(secret, "tools/call", {"name": "get_vacation_balance", "arguments": {"emp_no": "20190412", "base_ymd": "2026-10-01"}})[1]["result"]
    assert res["isError"] is False
    assert res["structuredContent"] == {"emp_nm": "홍길동", "annual_tot_cnt": 15, "annual_use_cnt": 9.5, "annual_rem_cnt": 5.5, "expire_ymd": "2026-12-31"}
    # 마스킹
    res = console.mcp(secret, "tools/call", {"name": "search_employee", "arguments": {"srch_nm": "홍"}})[1]["result"]
    assert res["structuredContent"]["list"][0]["mbl_telno"] == "***-****-5678"
    # 필수값 누락, 원본 오류는 isError 로
    assert console.mcp(secret, "tools/call", {"name": "get_vacation_balance", "arguments": {}})[1]["result"]["isError"] is True
    assert console.mcp(secret, "tools/call", {"name": "get_vacation_balance", "arguments": {"emp_no": "0"}})[1]["result"]["isError"] is True

    st, logs = console.api("GET", "/logs/")
    assert logs["counts"] == {"ok": 2, "err": 2, "wait": 0, "cache": 0}
    st, one = console.api("GET", "/logs/%s/" % logs["rows"][0]["id"])
    assert one["tool"] == "get_vacation_balance"
    st, kpi = console.api("GET", "/dashboard/summary/")
    assert kpi["kpi"]["calls24h"] == 4

    # 키를 폐기하면 바로 막힌다
    console.api("POST", "/deploy/keys/%s/revoke/" % key["id"])
    assert console.mcp(secret, "tools/list")[0] == 401


def test_mcp_protocol(console):
    ids = [t["id"] for t in console.connect_demo()["tools"]]
    key = publish_hr(console, ids)[1]
    secret = key["secret"]

    init = console.mcp(secret, "initialize")[1]["result"]
    assert init["serverInfo"] == {"name": "ieum-hr", "version": "1.0"}
    assert console.mcp(secret, "ping")[1]["result"] == {}
    assert console.mcp(secret, "tools/nope")[1]["error"]["code"] == -32601
    assert console.mcp(secret, "tools/call", {"name": "nope"})[1]["error"]["code"] == -32602

    # id 가 없으면 notification: 본문 없이 202
    st, body = console.mcp(secret, None, raw={"jsonrpc": "2.0", "method": "notifications/initialized"})
    assert (st, body) == (202, None)
    # JSON 이 아니면 JSON-RPC 오류로
    st, body = console.mcp(secret, None, content=b"{not json")
    assert st == 400 and body["error"]["code"] == -32700

    # 배포하지 않은 묶음 주소, 서버 푸시 스트림(GET)
    assert console.mcp(secret, "ping", slug="nope")[0] == 404
    assert httpx.get(console.base + "/mcp/ieum/hr").status_code == 405
    assert httpx.options(console.base + "/mcp/ieum/hr").status_code == 204
    # 끝 슬래시가 있어도 같다
    assert httpx.post(console.base + "/mcp/ieum/hr/", headers={"Authorization": "Bearer " + secret}, json={"jsonrpc": "2.0", "id": 9, "method": "ping"}).json()["result"] == {}

    # 키를 특정 묶음에만 묶으면 다른 묶음은 403
    st, scoped = console.api("POST", "/deploy/keys/", {"name": "scoped", "toolsets": ["ts-other"]})
    assert console.mcp(scoped["secret"], "ping")[0] == 403


def test_soap_and_errors(console):
    st, d = console.api("POST", "/sources/connect/", {"mode": "soap", "name": "s", "specUrl": console.base + "/demo-origin/hr.wsdl", "auth": {"type": "none"}})
    assert st == 201
    assert d["tools"][0]["id"] == "get_emp_info"
    console.api("PUT", "/studio/get_emp_info/", {"status": "done"})
    st, out = console.api("POST", "/playground/call/", {"tool": "get_emp_info", "args": {"emp_no": "20210803"}})
    assert out["ok"] is True
    assert out["result"]["emp_nm"] == "이서연"
    st, out = console.api("POST", "/playground/call/", {"tool": "get_emp_info", "args": {"emp_no": "1"}})
    assert out["ok"] is False
    # 잘못된 연결 요청
    assert console.api("POST", "/sources/connect/", {"mode": "rest", "specUrl": "ftp://x", "auth": {"type": "none"}})[0] == 400
    assert console.api("POST", "/sources/connect/", {"mode": "rest", "specUrl": "http://x", "auth": {"type": "key"}})[0] == 400


def test_write_tool_waits_for_approval(console):
    console.connect_demo()
    assert console.api("PUT", "/studio/request_vacation/", {"status": "done"})[0] == 200
    args = {"emp_no": "20190412", "strt_ymd": "2026-10-08", "end_ymd": "2026-10-08"}
    # 쓰기 도구는 사용자 확인 전에는 실행하지 않는다
    st, out = console.api("POST", "/playground/call/", {"tool": "request_vacation", "args": args})
    assert out == {"hold": True, "tool": "request_vacation"}
    st, out = console.api("POST", "/playground/call/", {"tool": "request_vacation", "args": args, "approved": True})
    assert out["ok"] is True
    # AI 쪽 이름(snake_case, ISO 날짜)이 원본 형식(대문자, YYYYMMDD)으로 바뀌어 나간다
    assert json.loads(out["trace"]["originRequest"]["body"]) == {"EMP_NO": "20190412", "STRT_YMD": "20261008", "END_YMD": "20261008"}


def test_source_lifecycle(console):
    d = console.connect_demo()
    assert d["source"]["id"] == "demo"
    ids = [t["id"] for t in d["tools"]]
    ts, key = publish_hr(console, ids)

    # 명세를 다시 읽어도 바뀐 게 없으면 표시만 그대로다
    st, again = console.api("POST", "/sources/demo/reread/")
    assert (again["added"], again["drifted"]) == ([], [])

    # 인증 정보를 바꾼다
    st, src = console.api("POST", "/sources/demo/reauth/", {"auth": {"type": "bearer", "key": "k"}})
    assert (src["authType"], src["err"]) == ("bearer", False)

    # 시스템을 지우면 도구, 묶음 속 도구도 함께 사라진다
    assert console.api("DELETE", "/sources/demo/")[0] == 200
    assert console.api("GET", "/sources/demo/")[0] == 404
    st, tools = console.api("GET", "/studio/")
    assert tools == {}
    st, sets = console.api("GET", "/deploy/toolsets/")
    assert sets[0]["tools"] == [] and sets[0]["deployed"] == []
    assert console.api("DELETE", "/deploy/toolsets/%s/" % ts["id"])[0] == 200
    assert console.api("DELETE", "/deploy/toolsets/%s/" % ts["id"])[0] == 404


def test_validation_errors(console):
    assert console.api("PUT", "/studio/nope/", {"status": "done"})[0] == 404
    console.connect_demo()
    assert console.api("PUT", "/studio/search_employee/", {"status": "wat"})[0] == 400
    assert console.api("PUT", "/studio/source/demo/", {"not": "a list"})[0] == 400
    assert console.api("POST", "/deploy/toolsets/", {"name": "x", "slug": "Bad Slug", "tools": ["search_employee"]})[0] == 400
    assert console.api("POST", "/deploy/toolsets/", {"name": "x", "slug": "ok", "tools": []})[0] == 400
    # 공개한 도구가 없으면 배포할 수 없다
    st, ts = console.api("POST", "/deploy/toolsets/", {"name": "x", "slug": "ok", "tools": ["search_employee"]})
    assert console.api("POST", "/deploy/toolsets/%s/deploy/" % ts["id"])[0] == 400
    # 같은 주소 이름은 둘 수 없다
    assert console.api("POST", "/deploy/toolsets/", {"name": "y", "slug": "ok", "tools": ["search_employee"]})[0] == 400
    # AI 키가 없으면 AI 기능만 꺼진다
    assert console.api("POST", "/playground/chat/", {"message": "hi"})[0] == 400
    assert console.api("POST", "/studio/search_employee/rewrite/", {})[0] == 400
    st, cfg = console.api("GET", "/playground/")
    assert cfg["chatEnabled"] is False
