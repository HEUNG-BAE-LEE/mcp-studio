"""업무 기능 수정·확정·등록."""
import asyncio
import json

import pytest

from app.ieum.recorder import service, store
from app.ieum.repositories import sources as src_repo
from app.ieum.repositories import studio as tool_repo


def _bf(steps):
    return {"id": "bf_00000001", "name": "거래처 검색", "desc": "거래처 검색 화면에서 거래처명(으)로 조회합니다.", "status": "draft",
            "source": {"base": "http://h/po", "recordingId": "rec_00000001", "made": "manual-record", "env": "op"},
            "inputs": [{"name": "vendNm", "type": "string", "source": "USER_INPUT", "ex": "한빛", "screenLabel": "거래처명",
                        "confidence": "high", "required": True, "needsValue": False}],
            "steps": steps, "references": [], "excluded": [{"method": "GET", "path": "/common/codeList.do", "role": "code", "why": ""}],
            "output": {"from": "s1", "fields": []}, "auth": {"mode": "session", "recipe": {"userField": "userId", "passField": "userPw",
                                                                                         "loginRel": "/login.do", "actionRel": "/loginProc.do", "extra": {}, "json": False}},
            "executionMode": "session", "policy": {"operation": "READ", "risk": "LOW", "approval": "NONE", "envPolicy": "op-auto", "scope": None, "sensitivity": None},
            "policyIncomplete": True, "verification": {"status": "verified", "at": 1, "runs": []}, "evidence": {}, "notes": []}


STEP = {"id": "s1", "role": "core", "base": "http://h/po", "origin": "http://h", "method": "GET", "path": "/vendList.do", "discriminator": "",
        "kind": "json", "charset": None, "exec": "http", "formPage": None, "write": False, "headers": {"x-requested-with": "XMLHttpRequest"},
        "outputs": {}, "recordedStatus": 200, "recordedData": None,
        "recordedRes": json.dumps({"RSLT": "0000", "resultList": [{"VEND_CD": "V0012", "VEND_NM": "한빛상사"}]}),
        "params": [{"a": "vendNm", "loc": "query", "from": "input.vendNm", "ex": "한빛", "source": "USER_INPUT", "confidence": "high", "type": "string", "required": True}]}


@pytest.fixture
def saved(ieum_state):
    rec = store.new_recording("거래처 검색", "홍길동", "http://h/po", "", "op", "auto", "")
    rec["id"] = "rec_00000001"
    store.save_recording(rec)
    store.append_span(rec["id"], {"seq": 1})
    (store.rec_dir(rec["id"]) / "1-pre.jpg").write_bytes(b"x")
    bf = _bf([STEP])
    store.save_function(bf)
    return bf


def test_입력_출처를_바꾸면_검증이_낡음이_된다(saved):
    out = service.update_function(saved["id"], {"inputs": [dict(saved["inputs"][0], source="CONSTANT")]})
    assert out["inputs"][0]["source"] == "CONSTANT" and out["verification"]["status"] == "stale"


def test_제외된_요청을_단계로_올린다(saved):
    out = service.update_function(saved["id"], {"promote": {"method": "GET", "path": "/common/codeList.do"}})
    assert [s["path"] for s in out["steps"]] == ["/vendList.do", "/common/codeList.do"] and out["steps"][1]["role"] == "prereq"


def test_정책을_채우면_미완이_풀린다(saved):
    out = service.update_function(saved["id"], {"policy": {"scope": "부서 데이터", "sensitivity": "일반"}})
    assert out["policyIncomplete"] is False


def test_확정하면_스크린샷을_지우고_행동_묶음은_남긴다(saved):
    out = service.confirm(saved["id"])
    assert out["status"] == "confirmed" and out["policyIncomplete"] is True
    assert not list(store.rec_dir("rec_00000001").glob("*.jpg")) and store.read_spans("rec_00000001")


def test_단계가_하나면_도구로_등록한다(saved):
    out = service.register_single(saved["id"])
    tool = out["tools"][0]
    assert tool["method"] == "GET" and tool["path"] == "/vendList.do" and tool["mode"] == "read" and tool["status"] == "review"
    assert tool["rec"] == {"function": "bf_00000001", "recording": "rec_00000001"} and "거래처명" in tool["desc"]
    assert any(s["id"] == out["sources"][0]["id"] and s["authType"] == "session" for s in src_repo.list_sources())
    assert tool["id"] in {t["id"] for t in tool_repo.flat_tools()}


def test_여러_단계는_도구_하나로_등록하지_않고_출처별로_나눠_등록한다(ieum_state):
    other = dict(STEP, id="s2", base="http://appr.corp:9090", origin="http://appr.corp:9090", path="/appr/list.do")
    store.save_function(_bf([STEP, other]))
    with pytest.raises(ValueError, match="다음 작업"):
        service.register_single("bf_00000001")
    out = service.register_steps("bf_00000001")
    assert sorted(s["base"] for s in out["sources"]) == ["http://appr.corp:9090", "http://h/po"]
    assert sorted(t["path"] for t in out["tools"]) == ["/appr/list.do", "/vendList.do"]


def _walk_strings(x):
    if isinstance(x, dict):
        for k, v in x.items():
            yield from _walk_strings(k)
            yield from _walk_strings(v)
    elif isinstance(x, list):
        for v in x:
            yield from _walk_strings(v)
    elif isinstance(x, str):
        yield x


def test_등록한_도구에는_가린_문자열이_없고_가린_입력은_필수로_남는다(ieum_state):
    from app.ieum.discovery.masking import is_masked
    step = dict(STEP, headers={"x-requested-with": "XMLHttpRequest", "x-note": "ab****cd"},
                recordedRes=json.dumps({"RSLT": "0000", "resultList": [{"TEL": "010-****-5678", "VEND_NM": "한빛상사"}]}),
                params=[dict(STEP["params"][0], ex="010-****-5678", source="CONSTANT"),
                        {"a": "pw", "loc": "query", "from": "const:", "ex": "••••••••", "source": "SYSTEM_CONFIG", "confidence": "high",
                         "type": "string", "required": True}])
    store.save_function(_bf([step]))
    tool = service.register_single("bf_00000001")["tools"][0]
    assert not [s for s in _walk_strings(tool) if is_masked(s)]
    assert all(p.get("req") for p in tool["params"] if p["loc"] == "query") and not any(p.get("rule") == "inject" and p["loc"] == "query" for p in tool["params"])
    assert not any(p["loc"] == "header" and p["o"] == "X-Note" for p in tool["params"])


def test_종료_뒤_흐름은_검토까지_가고_세션을_닫는다(saved, monkeypatch):
    from app.ieum.recorder.manager import MANAGER
    closed = []

    async def fake_close(rid):
        closed.append(rid)

    async def fake_verify(bf, rec, spans, session=None, values=None):
        return {"verification": {"status": "verified", "at": 5, "runs": []}, "executionMode": "session"}
    monkeypatch.setattr(MANAGER, "close", fake_close)
    monkeypatch.setattr(service.analyze, "analyze", lambda rec, spans: _bf([STEP]))
    monkeypatch.setattr(service.replay, "verify", fake_verify)
    asyncio.run(service.finish("rec_00000001", None))
    assert store.get_recording("rec_00000001")["status"] == "review" and closed == ["rec_00000001"]
    assert store.get_function("bf_00000001")["verification"]["status"] == "verified"


def test_종료_뒤_흐름이_터져도_밖으로_던지지_않고_닫는다(saved, monkeypatch):
    from app.ieum.recorder.manager import MANAGER
    closed = []

    async def fake_close(rid):
        closed.append(rid)
    monkeypatch.setattr(MANAGER, "close", fake_close)

    def boom(rec, spans):
        raise RuntimeError("분석 폭발")
    monkeypatch.setattr(service.analyze, "analyze", boom)
    asyncio.run(service.finish("rec_00000001", None))
    rec = store.get_recording("rec_00000001")
    assert rec["status"] == "failed" and "분석 폭발" in rec["error"] and closed == ["rec_00000001"]


def test_다시_검증은_값을_저장하지_않고_감사_기록만_남긴다(saved, monkeypatch):
    from app.ieum.recorder.manager import MANAGER
    from app.ieum.repositories import logs

    async def fake_verify(bf, rec, spans, session=None, values=None):
        assert values == {"vendNm": "비밀값123"}
        return {"verification": {"status": "failed", "at": 5, "runs": [
            {"kind": "same-values", "ok": False, "reason": "needs_value", "steps": [{"id": "s1", "ok": False, "reason": "needs_value"}]}]},
            "executionMode": None}
    monkeypatch.setattr(service.replay, "verify", fake_verify)
    out = asyncio.run(service.reverify(saved["id"], {"vendNm": "비밀값123"}))
    assert out["verification"]["status"] == "failed" and out["executionMode"] == "session"
    assert "비밀값123" not in json.dumps(store.get_function(saved["id"]), ensure_ascii=False)
    rows = [r for r in logs.list_logs() if r["tool"] == saved["id"]]
    assert len(rows) == 1 and "needs_value" in rows[0]["note"] and "s1" in rows[0]["note"]
    assert "비밀값123" not in json.dumps(rows, ensure_ascii=False) and "?" not in rows[0]["note"]


def test_라우트가_업무_기능을_다룬다(saved):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.ieum.routers.recorder import router
    app = FastAPI()
    app.include_router(router)
    c = TestClient(app)
    base = "/api/ieum/recorder/functions/bf_00000001/"
    assert c.get(base).json()["resultData"]["id"] == "bf_00000001"
    assert c.put(base, json={"name": "새 이름"}).json()["resultData"]["name"] == "새 이름"
    assert c.post(base + "register/", json={"mode": "single"}).status_code == 201
    assert c.post(base + "confirm/").json()["resultData"]["status"] == "confirmed"
    assert c.get("/api/ieum/recorder/functions/bf_nope/").status_code == 404
