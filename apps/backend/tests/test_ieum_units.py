"""이음 게이트웨이 단위 테스트: 명세 파서, 값 변환, 저장소, 인증 정보 보관, 앱 연결."""
import pytest
from cryptography.fernet import InvalidToken
from fastapi.testclient import TestClient

from app.ieum import config
from app.ieum.gateway import credentials, engine, spec
from app.ieum.repositories import sources as source_repo
from app.ieum.responses import fail, ok
from app.ieum.routers.demo_origin import NS, OPENAPI, WSDL
from app.ieum.store import JsonStore


# ---------------------------------------------------------------- 명세 파서
def test_openapi_makes_one_tool_per_operation():
    meta, tools = spec.parse_openapi(OPENAPI, "http://h/demo-origin/openapi.json")
    assert meta["base"] == "http://h/demo-origin"  # servers 의 상대 주소를 명세 주소에 이어 붙인다
    assert [(t["id"], t["method"], t["mode"]) for t in tools] == [
        ("search_employee", "GET", "read"), ("get_vacation_balance", "GET", "read"), ("request_vacation", "POST", "write")]
    assert "confirmQ" not in tools[0] and tools[2]["confirmQ"]  # 쓰기 도구만 확인 문구를 갖는다


def test_openapi_guesses_conversion_rules():
    _, tools = spec.parse_openapi(OPENAPI, "http://h/x")
    by_id = {t["id"]: t for t in tools}
    # 이름 정리, YYYYMMDD 날짜, 문자열 숫자, 개인정보
    params = {p["o"]: p for p in by_id["get_vacation_balance"]["params"]}
    assert (params["EMP_NO"]["a"], params["EMP_NO"]["loc"], params["EMP_NO"]["req"]) == ("emp_no", "path", 1)
    assert (params["BASE_YMD"]["rule"], params["BASE_YMD"]["ot"]) == ("date", "YYYYMMDD")
    res = {r["o"]: r["rule"] for r in by_id["get_vacation_balance"]["res"]}
    assert res["ANNUAL_REM_CNT"] == "num" and res["EXPIRE_YMD"] == "date"
    masked = {r["o"] for r in by_id["search_employee"]["res"] if r["rule"] == "mask"}
    assert masked == {"list[].MBL_TELNO", "list[].EML_ADDR"}


def test_openapi_needs_a_server_address():
    doc = {"openapi": "3.0.0", "paths": {"/a": {"get": {"responses": {}}}}}
    with pytest.raises(spec.SpecError, match="서버 주소"):
        spec.parse_openapi(doc)
    assert spec.parse_openapi(doc, base_override="http://x/")[0]["base"] == "http://x"


def test_parse_spec_text_rejects_non_specs():
    with pytest.raises(spec.SpecError, match="OpenAPI"):
        spec.parse_spec_text('{"hello": 1}')
    with pytest.raises(spec.SpecError):
        spec.parse_spec_text("a: [unclosed")


def test_wsdl_makes_one_tool_per_operation():
    meta, tools = spec.parse_wsdl(WSDL % {"ns": NS, "loc": "http://h/soap"})
    assert (meta["base"], meta["ns"]) == ("http://h/soap", NS)
    t = tools[0]
    assert (t["id"], t["soapAction"], t["mode"]) == ("get_emp_info", "urn:GetEmpInfo", "read")
    assert [(p["o"], p["a"]) for p in t["params"]] == [("EMP_NO", "emp_no")]
    assert [r["a"] for r in t["res"]] == ["emp_nm", "dept_nm", "jncmp_ymd"]
    with pytest.raises(spec.SpecError, match="WSDL"):
        spec.parse_wsdl("<a/>")


def test_sample_infers_a_tool_from_curl():
    meta, tools = spec.parse_sample("curl -X POST 'https://api.x.com/v1/emp/search?empNo=1' -d '{\"EmpName\": \"kim\"}'",
                                    '{"list":[{"EMP_NM":"kim","JNCMP_YMD":"20200101"}]}')
    assert meta["base"] == "https://api.x.com"
    t = tools[0]
    assert (t["id"], t["method"]) == ("emp_search", "POST")
    assert [(p["o"], p["loc"]) for p in t["params"]] == [("empNo", "query"), ("EmpName", "body")]
    assert {r["o"]: r["rule"] for r in t["res"]}["list[].JNCMP_YMD"] == "date"
    with pytest.raises(spec.SpecError, match="요청 샘플"):
        spec.parse_sample("", "")


def test_gov_preset():
    meta, tools = spec.gov_preset("holi")
    assert len(tools) == 3 and meta["base"].startswith("https://apis.data.go.kr/")
    with pytest.raises(spec.SpecError):
        spec.gov_preset("nope")


# ---------------------------------------------------------------- 값 변환
def test_values_convert_both_ways():
    assert engine._to_origin({"rule": "date", "ot": "YYYYMMDD"}, "2026-10-01") == "20261001"
    assert engine._to_origin({"rule": "pad"}, 7) == "07"
    assert engine._from_origin({"rule": "date"}, "20261009") == "2026-10-09"
    assert engine._from_origin({"rule": "num"}, "15.0") == 15 and engine._from_origin({"rule": "num"}, "9.5") == 9.5
    assert engine._from_origin({"rule": "strip"}, "<b>안녕</b> ") == "안녕"
    assert engine._from_origin({"rule": "date"}, None) is None


def test_code_values_map_and_reject_unknowns():
    codes = [["Y", True, "쉬는 날"], ["N", False, "평일"]]
    assert engine._from_origin({"rule": "code", "codes": codes}, "Y") is True
    assert engine._to_origin({"rule": "code", "codes": codes, "a": "off"}, False) == "N"
    with pytest.raises(engine.ToolError, match="가능한 값"):
        engine._to_origin({"rule": "code", "codes": codes, "a": "off"}, "maybe")


def test_masking():
    assert engine._mask("010-4821-5678") == "***-****-5678"
    assert engine._mask("gildong.hong@hanbit.local").endswith("@hanbit.local")
    assert engine._mask("홍길동") == "홍**"


def test_build_request_fills_path_query_and_injected_values():
    tool = {"method": "GET", "path": "/vacation/{EMP_NO}", "params": [
        {"o": "EMP_NO", "a": "emp_no", "loc": "path", "rule": "name"},
        {"o": "BASE_YMD", "a": "base_ymd", "loc": "query", "rule": "date", "ot": "YYYYMMDD"},
        {"o": "_type", "loc": "query", "rule": "inject", "v": "json"},
        {"o": "uid", "loc": "query", "rule": "ctx", "ctxKey": "user_id"}]}
    source = {"id": "s", "base": "http://h/api/", "proto": "rest"}
    req = engine.build_request(source, tool, {"emp_no": "a/b", "base_ymd": "2026-10-01"}, {"user_id": "u1"})
    assert req["url"] == "http://h/api/vacation/a%2Fb"  # 경로에 들어가는 값은 인코딩한다
    assert req["params"] == {"BASE_YMD": "20261001", "_type": "json", "uid": "u1"}


def test_check_args_names_the_missing_ones():
    tool = {"params": [{"a": "emp_no", "req": 1}, {"a": "memo"}, {"a": "hidden", "req": 1, "rule": "inject"}]}
    with pytest.raises(engine.ToolError, match="emp_no"):
        engine.check_args(tool, {"memo": "x"})
    engine.check_args(tool, {"emp_no": "1"})  # 감춘 파라미터는 AI에게 요구하지 않는다


def test_mcp_definition_exposes_only_visible_params():
    from app.ieum.gateway import runner
    tool = {"id": "t", "title": "T", "desc": "d", "mode": "write", "destructive": True, "params": [
        {"a": "d", "at": "string (date)", "req": 1, "d": "날짜"}, {"a": "hide", "rule": "inject"},
        {"a": "c", "at": "string", "codes": [["Y", True, ""], ["N", False, ""]]}]}
    d = runner.mcp_definition(tool)
    assert d["inputSchema"]["required"] == ["d"]
    assert set(d["inputSchema"]["properties"]) == {"d", "c"}
    assert d["inputSchema"]["properties"]["d"]["format"] == "date"
    assert d["inputSchema"]["properties"]["c"]["enum"] == [True, False]
    assert d["annotations"] == {"readOnlyHint": False, "destructiveHint": True}


# ---------------------------------------------------------------- 저장소, 인증 정보
def test_store_reads_seed_then_state_and_resets(ieum_state):
    store = JsonStore("sources", "workspace")
    assert store.load()["slug"] == "ieum"  # 시드
    store.save({"slug": "changed"})
    assert store.load() == {"slug": "changed"}
    assert store.seed_path.read_text(encoding="utf-8") != (ieum_state / "sources.workspace.json").read_text(encoding="utf-8")  # 시드는 건드리지 않는다
    store.reset()
    assert store.load()["slug"] == "ieum"


def test_repository_upsert_merges_fields(ieum_state):
    source_repo.upsert_source({"id": "a", "name": "A", "err": False})
    merged = source_repo.upsert_source({"id": "a", "err": True})
    assert merged == {"id": "a", "name": "A", "err": True}
    source_repo.delete_source("a")
    assert source_repo.get_source("a") is None


def test_credentials_are_encrypted_at_rest(ieum_state):
    credentials.put("s1", {"type": "key", "key": "plain-secret"})
    assert credentials.get("s1") == {"type": "key", "key": "plain-secret"}
    assert credentials.get("none") == {}
    assert b"plain-secret" not in (ieum_state / "source_secrets.enc").read_bytes()
    assert oct((ieum_state / ".secret_key").stat().st_mode & 0o777) == "0o600"
    credentials.delete("s1")
    assert credentials.get("s1") == {}


def test_credentials_key_comes_from_env_when_set(ieum_state, monkeypatch):
    monkeypatch.setenv("IEUM_SECRET_KEY", "key-one")
    credentials.put("s1", {"key": "v"})
    assert not (ieum_state / ".secret_key").exists()  # 환경변수가 있으면 파일을 만들지 않는다
    monkeypatch.setenv("IEUM_SECRET_KEY", "key-two")
    with pytest.raises(InvalidToken):  # 다른 키로는 풀리지 않는다
        credentials.get("s1")


# ---------------------------------------------------------------- 응답, 앱 연결
def test_response_envelope_mirrors_the_http_status():
    assert ok({"a": 1}, 201).status_code == 201
    r = fail(404)
    assert (r.status_code, r.body) == (404, '{"resultCode":404,"resultMsg":"찾을 수 없습니다.","resultData":null}'.encode())


def test_main_app_serves_ieum_api_and_console(ieum_state):
    from app.main import app

    client = TestClient(app)  # `with` 를 쓰지 않아 startup(dev.db 시드)은 돌지 않는다
    assert client.get("/api/ieum/sources/").json()["resultData"]["workspace"]["slug"] == "ieum"
    assert client.get("/demo-origin/openapi.json").json()["openapi"] == "3.0.3"
    assert client.get("/health").json() == {"status": "ok"}  # 기존 라우트는 그대로
    if config.web_root().is_dir():
        page = client.get("/ieum/")
        assert page.status_code == 200 and "이음 관리 콘솔" in page.text
        assert client.get("/ieum", follow_redirects=False).status_code == 307


def test_demo_origin_demands_its_api_key(ieum_state):
    from app.main import app

    client = TestClient(app)
    assert client.get("/demo-origin/employees").status_code == 401
    rows = client.get("/demo-origin/employees", params={"SRCH_NM": "이"}, headers={"X-API-KEY": "demo-key"}).json()["list"]
    assert [e["EMP_NM"] for e in rows] == ["이서연"]
    assert client.get("/demo-origin/vacation/1", headers={"X-API-KEY": "demo-key"}).status_code == 404
    assert "soap:address" in client.get("/demo-origin/hr.wsdl").text
