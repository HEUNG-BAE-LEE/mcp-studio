"""업무 기능 수정·등록(등록이 곧 확정)."""
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
    rec = store.new_recording("거래처 검색", "홍길동", "http://h/po", "", "op", "auto")
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


def test_정책은_받지_않고_미완을_다시_구하지_않는다(saved):
    out = service.update_function(saved["id"], {"policy": {"scope": "부서 데이터", "sensitivity": "일반"}})
    assert out["policy"].get("scope") is None


def test_등록하면_스크린샷을_지우고_행동_묶음은_남긴다(saved):
    out = service.register_flow(saved["id"])["function"]
    assert out["status"] == "registered" and out["confirmedAt"]
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
    assert c.post(base + "register/").json()["resultData"]["function"]["status"] == "registered"
    assert c.post(base + "confirm/").status_code in (404, 405)
    assert c.get("/api/ieum/recorder/functions/bf_deadbeef/").status_code == 404
    assert c.get("/api/ieum/recorder/functions/bf_nope/").status_code == 400


# ---- 수정 1차: 잠금·중복·검증 ----
def _two_step(saved_extra=None):
    other = dict(STEP, id="s2", path="/b.do", params=[dict(STEP["params"][0], a="x", **{"from": "s1.VEND_CD", "source": "PREVIOUS_STEP_OUTPUT"})])
    return other


def test_검증하는_사이_등록해도_등록이_유지된다(saved, monkeypatch):
    async def slow_verify(bf, rec, spans, session=None, values=None):
        await asyncio.to_thread(service.register_flow, saved["id"])       # 검증 도중 사람이 등록
        return {"verification": {"status": "verified", "at": 9, "runs": []}, "executionMode": "session"}
    monkeypatch.setattr(service.replay, "verify", slow_verify)
    asyncio.run(service.reverify(saved["id"], None))
    out = store.get_function(saved["id"])
    assert out["status"] == "registered" and out["verification"]["at"] == 9


def test_분석_검증_중이면_다시_검증을_거부한다(saved):
    store.update_recording("rec_00000001", lambda r: r.update(status="verifying"))
    with pytest.raises(service.Busy):
        asyncio.run(service.reverify(saved["id"], None))


def test_같은_원본에_동시_등록해도_도구가_모두_남는다(ieum_state):
    import threading
    for n in (1, 2):
        step = dict(STEP, path=f"/list{n}.do")
        bf = _bf([step])
        bf["id"] = f"bf_0000000{n}"
        bf["source"] = dict(bf["source"], recordingId=f"rec_0000000{n}")
        store.save_function(bf)
    errs = []

    def run(n):
        try:
            service.register_single(f"bf_0000000{n}")
        except Exception as e:      # pragma: no cover
            errs.append(e)
    ts = [threading.Thread(target=run, args=(n,)) for n in (1, 2)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    paths = sorted(t["path"] for t in tool_repo.flat_tools() if t["path"].startswith("/list"))
    assert not errs and paths == ["/list1.do", "/list2.do"]


def test_다시_등록하면_도구가_늘지_않는다(saved):
    first = service.register_single(saved["id"])
    second = service.register_single(saved["id"])
    mine = [t for t in tool_repo.flat_tools() if (t.get("rec") or {}).get("function") == saved["id"]]
    assert len(mine) == 1 and first["tools"][0]["id"] == second["tools"][0]["id"]
    assert second["sources"][0]["desc"] == f"도구 {len([t for t in tool_repo.flat_tools() if t['src'] == second['sources'][0]['id']])}개"


def test_기존_원본의_인증정보는_덮어쓰지_않는다(saved):
    from app.ieum.gateway import credentials
    first = service.register_single(saved["id"])
    sid = first["sources"][0]["id"]
    credentials.put(sid, {"type": "session", "username": "other", "password": "x", "recipe": {}})
    service.register_single(saved["id"])
    assert credentials.get(sid)["username"] == "other"


@pytest.mark.parametrize("patch", [
    {"inputs": "x"}, {"inputs": [{"name": "vendNm", "source": "BOGUS"}]}, {"inputs": [{"name": "vendNm", "type": "blob"}]},
    {"inputs": [{"name": "vendNm", "required": "yes"}]}, {"inputs": [{"name": "nope"}]},
    {"steps": [{"id": "s1", "write": "yes"}]}, {"steps": [{"id": "s1", "write": 1}]},
    {"steps": [{"id": "s9"}]}, {"steps": [{"id": "s1"}, {"id": "s1"}]}, {"steps": []},
    {"promote": {"method": "GET"}}, {"promote": "x"}, {"promote": {"method": "GET", "path": "/nowhere.do"}},
])
def test_잘못된_수정은_거부하고_저장하지_않는다(saved, patch):
    with pytest.raises(ValueError):
        service.update_function(saved["id"], patch)
    assert store.get_function(saved["id"])["inputs"][0]["source"] == "USER_INPUT"


def test_건너뛴_단계는_보관하고_올린_단계_id는_겹치지_않는다(ieum_state):
    bf = _bf([STEP, dict(STEP, id="s2", path="/b.do", params=[])])
    store.save_function(bf)
    out = service.update_function("bf_00000001", {"steps": [{"id": "s1"}, {"id": "s2", "skip": True}]})
    assert [(s["id"], s["skip"]) for s in out["steps"]] == [("s1", False), ("s2", True)]
    out = service.update_function("bf_00000001", {"promote": {"method": "GET", "path": "/common/codeList.do"}})
    assert [s["id"] for s in out["steps"]] == ["s1", "s2", "s3"]


def test_건너뛴_단계의_결과를_쓰는_단계가_있으면_거부한다(ieum_state):
    store.save_function(_bf([STEP, _two_step()]))
    with pytest.raises(ValueError, match="건너뛸 수 없"):
        service.update_function("bf_00000001", {"steps": [{"id": "s1", "skip": True}, {"id": "s2"}]})


def test_올린_단계는_제외된_요청의_출처를_쓴다(ieum_state):
    bf = _bf([STEP])
    bf["excluded"] = [{"method": "GET", "path": "/appr/x.do", "base": "http://appr.corp:9090", "origin": "http://appr.corp:9090", "role": "noise", "why": ""}]
    store.save_function(bf)
    out = service.update_function("bf_00000001", {"promote": {"method": "GET", "path": "/appr/x.do"}})
    assert out["steps"][1]["base"] == "http://appr.corp:9090"


def test_건너뛴_단계는_등록하지_않는다(ieum_state):
    store.save_function(_bf([STEP, dict(STEP, id="s2", path="/b.do", params=[])]))
    service.update_function("bf_00000001", {"steps": [{"id": "s1"}, {"id": "s2", "skip": True}]})
    out = service.register_single("bf_00000001")
    assert [t["path"] for t in out["tools"]] == ["/vendList.do"]


def test_사람이_쓴_글의_별표는_지우지_않는다(ieum_state):
    bf = _bf([STEP])
    bf["desc"] = "별표(**) 표기 설명"
    store.save_function(bf)
    assert service.register_single("bf_00000001")["tools"][0]["desc"] == "별표(**) 표기 설명"


def test_라우트_검증_오류는_400_모드는_400_출력은_고정문구(saved, monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.ieum.routers.recorder import router
    app = FastAPI()
    app.include_router(router)
    c = TestClient(app)
    base = "/api/ieum/recorder/functions/bf_00000001/"
    assert c.put(base, json={"policy": {"risk": "SUPER"}}).status_code == 200          # 정책은 받지 않는다(무시)
    assert c.post(base + "register/", json={"mode": "all"}).status_code == 400

    async def boom(*a, **k):
        raise RuntimeError("비밀 내부 정보")
    monkeypatch.setattr(service, "reverify", boom)
    r = c.post(base + "verify/", json={})
    assert r.status_code == 400 and "비밀" not in r.text


def test_검토에서_write_를_바꾸면_낡음이_되고_작업_유형만_다시_구한다(saved):
    out = service.update_function(saved["id"], {"steps": [{"id": "s1", "write": True}]})
    st = out["steps"][0]
    assert st["write"] is True and st["writeWhy"] == "사람이 지정" and out["verification"]["status"] == "stale"
    assert out["policy"]["operation"] == "CREATE" and out["policy"]["approval"] == "NONE"     # 승인 등 나머지 정책은 다시 구하지 않는다
    back = service.update_function(saved["id"], {"steps": [{"id": "s1", "write": False}]})
    assert back["steps"][0]["write"] is False and back["policy"]["operation"] == "READ"


def test_write_를_안_적으면_근거와_검증을_건드리지_않고_같은_값이라도_적으면_사람이_지정한_것이다(saved):
    store.save_function(_bf([dict(STEP, writeWhy="GET")]))
    out = service.update_function(saved["id"], {"steps": [{"id": "s1"}]})
    assert out["steps"][0]["writeWhy"] == "GET"
    out = service.update_function(saved["id"], {"steps": [{"id": "s1", "write": False}]})
    assert out["steps"][0]["writeWhy"] == "사람이 지정" and out["policy"]["operation"] == "READ"


def test_이름만으로_조회라고_본_POST_는_쓰기_도구로_등록하고_사람이_확인하면_읽기_도구가_된다(ieum_state):
    store.save_function(_bf([dict(STEP, method="POST", write=False, writeWhy="POST — 조회 낱말(select)")]))
    tool = service.register_single("bf_00000001")["tools"][0]
    assert tool["mode"] == "write" and tool["confirmQ"]
    service.update_function("bf_00000001", {"steps": [{"id": "s1", "write": False}]})
    assert service.register_single("bf_00000001")["tools"][0]["mode"] == "read"


def test_등록한_뒤_고치면_다시_등록할_수_있게_등록_전으로_돌아간다(saved):
    service.register_flow(saved["id"])
    out = service.update_function(saved["id"], {"name": "새 이름"})
    assert out["status"] == "draft" and out["registered"]["mode"] == "flow"
    service.register_flow(saved["id"])
    assert service.update_function(saved["id"], {"policy": {"risk": "HIGH"}})["status"] == "registered"     # 무시한 키만 오면 그대로


def test_올린_단계도_이름으로_판정한다(saved):
    bf = store.get_function(saved["id"])
    bf["excluded"].append({"method": "POST", "path": "/vendDelete.do", "role": "noise", "why": ""})
    store.save_function(bf)
    out = service.update_function(saved["id"], {"promote": {"method": "POST", "path": "/vendDelete.do"}})
    st = out["steps"][1]
    assert st["write"] is True and st["writeWhy"] == "POST — 변경 낱말(delete)" and out["policy"]["operation"] == "DELETE"


def test_도구_모드는_단계의_write_를_따른다(ieum_state):
    store.save_function(_bf([dict(STEP, method="GET", write=False, writeWhy="GET")]))
    assert service.register_single("bf_00000001")["tools"][0]["mode"] == "read"
    out = service.update_function("bf_00000001", {"steps": [{"id": "s1", "write": True}]})
    tool = service.register_single("bf_00000001")["tools"][0]
    assert out["steps"][0]["write"] is True and tool["mode"] == "write" and tool["confirmQ"]


# ── T14: 결과 단계를 건너뛰면 남은 마지막 핵심 단계로 결과를 옮긴다 ─────────
def _three(ieum_state):
    rec = store.new_recording("데이터 상세", "홍길동", "http://h/po", "", "op", "auto")
    rec["id"] = "rec_00000001"
    store.save_recording(rec)
    for seq, aria in ((1, "- text: 한빛상사 V0012"), (2, "- heading: 상세 한빛상사\n- text: 서울 강남구"), (3, "- text: 기록 완료")):
        store.append_span(rec["id"], {"seq": seq, "action": {"type": "click"}, "network": [], "post": {"aria": aria}})
    detail = dict(STEP, id="s2", path="/vendDetail.do", params=[],
                  recordedRes=json.dumps({"RSLT": "0000", "vend": {"VEND_NM": "한빛상사", "ADDR": "서울 강남구"}}, ensure_ascii=False))
    hist = dict(STEP, id="s3", method="POST", path="/selectHistAndCsvData.do", params=[],
                recordedRes=json.dumps({"RSLT": "0000", "msg": "기록 완료"}, ensure_ascii=False))
    bf = _bf([STEP, detail, hist])
    bf["output"] = {"from": "s3", "fields": ["$.msg"]}
    bf["evidence"] = {"s1": [1], "s2": [2], "s3": [3]}
    store.save_function(bf)
    return bf


def test_결과_단계를_건너뛰면_앞_핵심_단계로_결과가_옮겨지고_되돌리면_돌아온다(ieum_state):
    _three(ieum_state)
    out = service.update_function("bf_00000001", {"steps": [{"id": "s1"}, {"id": "s2"}, {"id": "s3", "skip": True}]})
    assert out["output"]["from"] == "s2" and set(out["output"]["fields"]) == {"$.vend.VEND_NM", "$.vend.ADDR"}
    out = service.update_function("bf_00000001", {"steps": [{"id": "s1"}, {"id": "s2"}, {"id": "s3"}]})
    assert out["output"] == {"from": "s3", "fields": ["$.msg"]}


def test_모든_단계를_건너뛰면_거부한다(ieum_state):
    _three(ieum_state)
    with pytest.raises(ValueError, match="모든 단계"):
        service.update_function("bf_00000001", {"steps": [{"id": "s1", "skip": True}, {"id": "s2", "skip": True}, {"id": "s3", "skip": True}]})


# ── 최종 검토 반영 ─────────────────────────────────────────────────────────
def test_이름이_겹친_경로_자리_입력은_자기_단계_파라미터만_바꾼다(ieum_state):
    a = dict(STEP, id="s1", path="/a/{id}", params=[{"a": "id", "loc": "path", "from": "input.id", "ex": "101", "source": "USER_INPUT",
                                                     "confidence": "low", "type": "number", "required": True}])
    b = dict(STEP, id="s2", path="/b/{id}", params=[{"a": "id", "loc": "path", "from": "input.id_", "ex": "202", "source": "USER_INPUT",
                                                     "confidence": "low", "type": "number", "required": True}])
    bf = _bf([a, b])
    bf["inputs"] = [{"name": "id", "type": "number", "source": "USER_INPUT", "ex": "101", "screenLabel": "", "confidence": "low", "required": True, "needsValue": False},
                    {"name": "id_", "type": "number", "source": "USER_INPUT", "ex": "202", "screenLabel": "", "confidence": "low", "required": True, "needsValue": False}]
    store.save_function(bf)
    out = service.update_function("bf_00000001", {"inputs": [dict(bf["inputs"][0], source="CONSTANT")]})
    pa, pb = out["steps"][0]["params"][0], out["steps"][1]["params"][0]
    assert pa["from"] == "const:101" and pb["from"] == "input.id_" and pb["source"] == "USER_INPUT"
    out = service.update_function("bf_00000001", {"inputs": [dict(bf["inputs"][1], source="CONSTANT")]})
    assert out["steps"][1]["params"][0]["from"] == "const:202"
    out = service.update_function("bf_00000001", {"inputs": [dict(bf["inputs"][0], source="USER_INPUT")]})
    assert out["steps"][0]["params"][0]["from"] == "input.id" and out["steps"][1]["params"][0]["from"] == "const:202"


def test_앞_단계에서_잇는_경로_자리도_도구의_필수_입력이고_게이트웨이가_채운다(ieum_state):
    from app.ieum.gateway import engine
    from app.ieum.recorder import analyze
    from tests.test_ieum_recorder_listlinks import NAVER, REC, _record
    bf = analyze.analyze(REC, _record(NAVER, "https://n.news.naver.com/mnews/article/052/0002416855", base="https://search.naver.com"))
    store.save_function(bf)
    out = service.register_steps(bf["id"])
    tool = next(t for t in out["tools"] if t["path"] == "/mnews/article/{id}/{id2}")
    ps = {p["o"]: p for p in tool["params"] if p["loc"] == "path"}
    assert set(ps) == {"id", "id2"} and all(p.get("req") == 1 for p in ps.values()) and ps["id2"]["ex"] == "0002416855"
    src = next(s for s in out["sources"] if s["base"] == "https://n.news.naver.com")
    req = engine.build_request(src, tool, {ps["id"]["a"]: "021", ps["id2"]["a"]: "0000101010"}, {})
    assert req["url"] == "https://n.news.naver.com/mnews/article/021/0000101010"


def test_분석_결과가_없던_업무는_단계를_바꿔도_결과를_지어내지_않는다(ieum_state):
    bf = _three(ieum_state)
    bf["output"] = {"from": None, "fields": []}
    bf["steps"][2]["recordedRes"] = ""                       # 남는 마지막 핵심 단계에 응답이 없다
    store.save_function(bf)
    out = service.update_function("bf_00000001", {"steps": [{"id": "s1"}, {"id": "s2", "skip": True}, {"id": "s3"}]})
    assert out["output"] == {"from": None, "fields": []}
    out = service.update_function("bf_00000001", {"steps": [{"id": "s1"}, {"id": "s2"}, {"id": "s3", "skip": True}]})
    assert out["output"]["from"] == "s2" and out["output"]["fields"]               # 남은 단계가 화면에 보인 결과를 내면 그 단계
