"""업무 도구 등록: 조건, 단계 사본, 고르기 인자, 등록=확정, 다시 등록, 정책 무시."""
import copy

import pytest

from app.ieum.recorder import service, store
from app.ieum.repositories import studio as tool_repo

SRC = "s1.links[/art/{id}@ul.news>li.it][1.0/1].id"


def _bf(**over):
    bf = {"id": "bf_reg_t", "name": "뉴스 기사 읽기", "desc": "", "status": "draft",
          "source": {"base": "http://127.0.0.1:9", "recordingId": "rec_reg_t", "made": "manual-record", "env": "op"},
          "inputs": [{"name": "sec", "type": "number", "source": "USER_INPUT", "ex": "101", "screenLabel": "", "confidence": "low", "required": True, "needsValue": False}],
          "steps": [
              {"id": "s1", "role": "prereq", "base": "http://127.0.0.1:9", "method": "GET", "path": "/section/{sec}", "kind": "html", "exec": "http",
               "write": False, "writeWhy": "GET", "headers": {}, "outputs": {SRC[3:]: SRC[3:]},
               "params": [{"a": "sec", "loc": "path", "from": "input.sec", "ex": "101", "type": "number", "source": "USER_INPUT"}],
               "recordedRes": "<html>원문</html>", "recordedData": {"tables": [], "fields": {}}, "recordedErrSeen": []},
              {"id": "s2", "role": "core", "base": "http://127.0.0.1:9", "method": "GET", "path": "/art/{id}", "kind": "html", "exec": "http",
               "write": False, "writeWhy": "GET", "headers": {"Authorization": "Bearer ****"}, "outputs": {},
               "params": [{"a": "id", "loc": "path", "from": SRC, "ex": "202", "source": "PREVIOUS_STEP_OUTPUT"}],
               "recordedRes": "<html>원문2</html>", "recordedData": None, "recordedErrSeen": []}],
          "output": {"from": "s2", "fields": []}, "excluded": [], "references": [], "evidence": {}, "notes": [],
          "auth": {"mode": "none", "recipe": None}, "policy": {"operation": "READ"},
          "verification": {"status": "verified", "at": 1.0, "runs": [{"kind": "same-values", "ok": True}]}}
    bf.update(over)
    return bf


@pytest.fixture
def fn(ieum_state):
    store.save_function(_bf())
    store.save_recording({"id": "rec_reg_t", "name": "뉴스", "sourceBase": "http://127.0.0.1:9", "env": "op", "status": "done", "approvals": []})
    return "bf_reg_t"


def test_등록하면_업무_도구_하나와_등록_완료(fn):
    out = service.register_flow(fn)
    t = out["tools"][0]
    assert t["kind"] == "flow" and t["status"] == "review" and t["mode"] == "read"
    assert t["flow"]["pick"] == {"list": "s1", "step": "s2", "tpl": "/art/{id}", "group": "ul.news>li.it", "args": {"index": "index", "match": "match"}}
    assert {p["a"]: p["loc"] for p in t["params"]} == {"sec": "input", "index": "pick", "match": "pick"}
    bf = store.get_function(fn)
    assert bf["status"] == "registered" and bf["registered"]["tools"] == [t["id"]] and bf["registered"]["mode"] == "flow"


def test_단계_사본에는_원문과_가린_값이_없다(fn):
    t = service.register_flow(fn)["tools"][0]
    for st in t["flow"]["steps"]:
        assert "recordedRes" not in st and "recordedData" not in st and "recordedShape" in st
        assert "****" not in str(st["headers"])


def test_검증_전_쓰기_브라우저_단계는_거부하고_아무것도_바꾸지_않는다(fn):
    for over in ({"verification": {"status": "pending", "runs": []}},
                 {"steps": [dict(_bf()["steps"][0]), dict(_bf()["steps"][1], method="POST", writeWhy="POST — 기본 쓰기", write=True)]},
                 {"steps": [dict(_bf()["steps"][0], exec="browser"), _bf()["steps"][1]]}):
        store.save_function(_bf(**over))
        assert service.flow_blockers(store.get_function(fn))
        with pytest.raises(ValueError):
            service.register_flow(fn)
        assert store.get_function(fn)["status"] == "draft" and not tool_repo.flat_tools()


def test_입력_이름이_index_와_겹치면_index_로_피한다(fn):
    bf = _bf()
    bf["inputs"][0]["name"] = "index"
    bf["steps"][0]["params"][0].update(a="index", **{"from": "input.index"})
    bf["steps"][0]["path"] = "/section/{index}"
    store.save_function(bf)
    t = service.register_flow(fn)["tools"][0]
    assert t["flow"]["pick"]["args"] == {"index": "index_", "match": "match"}


def test_다시_등록하면_같은_도구를_고친_설명과_함께_유지한다(fn):
    t = service.register_flow(fn)["tools"][0]
    tool_repo.save_tool(t["id"], {"desc": "사람이 고친 설명"})
    t2 = service.register_flow(fn)["tools"][0]
    assert t2["id"] == t["id"] and t2["desc"] == "사람이 고친 설명" and len(tool_repo.flat_tools()) == 1


def test_스튜디오_저장은_flow_kind_rec_를_바꾸지_않는다(fn):
    from fastapi.testclient import TestClient
    from fastapi import FastAPI
    from app.ieum.routers import router
    t = service.register_flow(fn)["tools"][0]
    app = FastAPI(); app.include_router(router)
    r = TestClient(app).put(f"/api/ieum/studio/{t['id']}/", json={"desc": "새 설명", "flow": {"steps": []}, "kind": "plain", "rec": {}})
    assert r.status_code == 200
    got = tool_repo.find_tool(t["id"])[1]
    assert got["desc"] == "새 설명" and got["kind"] == "flow" and got["flow"]["steps"] and got["rec"]["function"] == fn


def test_PUT_의_policy_는_무시한다(fn):
    service.update_function(fn, {"policy": {"risk": "HIGH"}})
    assert store.get_function(fn).get("policy", {}).get("risk") is None


# ---- 덧붙인 시험 ----
def test_행_틀이_있으면_고르는_틀은_행_틀이다(fn):
    """runner 가 행을 세는 틀은 analyze.get_path 의 k 와 같아야 한다: [k.j/n@행틀] 이면 행 틀로 센다."""
    src = "s1.links[{p:d}@ul.news>li.it][1.0/1@/art/{id}].p"
    bf = _bf()
    bf["steps"][0]["outputs"] = {src[3:]: src[3:]}
    bf["steps"][1]["params"][0]["from"] = src
    store.save_function(bf)
    pick = service.register_flow(fn)["tools"][0]["flow"]["pick"]
    assert pick["tpl"] == "/art/{id}" and pick["group"] == "ul.news>li.it"


def test_묶음이_없는_출처면_고르기_인자가_없다(fn):
    bf = _bf()
    bf["steps"][1]["params"][0]["from"] = "s1.links[/art/{id}][1].id"
    store.save_function(bf)
    t = service.register_flow(fn)["tools"][0]
    assert t["flow"]["pick"] is None and [p["loc"] for p in t["params"]] == ["input"]


def test_사람이_조회로_확정한_POST_만_받고_단계_사본에는_write_False_가_늘_있다(fn):
    s2 = dict(_bf()["steps"][1], method="POST", write=False, writeWhy="POST — 조회 낱말(select)")
    store.save_function(_bf(steps=[_bf()["steps"][0], s2]))
    assert any("s2" in x for x in service.flow_blockers(store.get_function(fn)))
    s2["writeWhy"] = "사람이 지정"
    s1 = dict(_bf()["steps"][0])
    s1.pop("write")                                            # 예전 기록처럼 write 가 없어도 사본에는 명시한다
    store.save_function(_bf(steps=[s1, s2]))
    assert service.flow_blockers(store.get_function(fn)) == []
    t = service.register_flow(fn)["tools"][0]
    assert all(st["write"] is False for st in t["flow"]["steps"])


def test_낡은_검증은_같은_값_실행이_있어도_거부한다(fn):
    store.save_function(_bf(verification={"status": "stale", "at": 1.0, "runs": [{"kind": "same-values", "ok": True}]}))
    assert "검증을 통과해야 등록할 수 있습니다." in service.flow_blockers(store.get_function(fn))
    store.save_function(_bf(verification={"status": "partial", "at": 1.0, "runs": [{"kind": "same-values", "ok": True}]}))
    assert service.flow_blockers(store.get_function(fn)) == []


def test_건너뛴_단계는_사본에_없고_단계_수_상한을_본다(fn):
    many = [dict(_bf()["steps"][0], id=f"s{i}", outputs={}) for i in range(1, 12)]
    store.save_function(_bf(steps=many))
    assert any("10" in x for x in service.flow_blockers(store.get_function(fn)))
    for st in many[2:]:
        st["skip"] = True
    store.save_function(_bf(steps=many))
    t = service.register_flow(fn)["tools"][0]
    assert [st["id"] for st in t["flow"]["steps"]] == ["s1", "s2"]


def test_등록하면_확정_시각을_남기고_스크린샷을_지운다(fn):
    (store.rec_dir("rec_reg_t")).mkdir(parents=True, exist_ok=True)
    (store.rec_dir("rec_reg_t") / "1-pre.jpg").write_bytes(b"x")
    out = service.register_flow(fn)
    assert out["function"]["status"] == "registered" and out["function"]["confirmedAt"]
    assert not list(store.rec_dir("rec_reg_t").glob("*.jpg"))


def test_다시_등록하면_호출_수와_파라미터_설명을_유지한다(fn):
    t = service.register_flow(fn)["tools"][0]
    params = copy.deepcopy(t["params"])
    params[0]["d"] = "사람이 고친 섹션 설명"
    tool_repo.save_tool(t["id"], {"params": params, "calls": 7, "title": "고친 제목"})
    t2 = service.register_flow(fn)["tools"][0]
    assert t2["calls"] == 7 and t2["title"] == "고친 제목" and t2["params"][0]["d"] == "사람이 고친 섹션 설명"


def test_단계별_등록도_등록_완료로_남긴다(fn):
    out = service.register_steps(fn)
    assert out["function"]["status"] == "registered" and out["function"]["registered"]["mode"] == "steps"
    assert sorted(out["function"]["registered"]["tools"]) == sorted(t["id"] for t in out["tools"])


def test_라우트는_기본이_업무_도구이고_막는_이유를_싣고_확정_라우트는_없다(fn):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.ieum.routers.recorder import router
    app = FastAPI()
    app.include_router(router)
    c = TestClient(app)
    store.FUNCTIONS.save({"bf_0000beef": dict(_bf(verification={"status": "pending", "runs": []}), id="bf_0000beef")})
    base = "/api/ieum/recorder/functions/bf_0000beef/"
    assert c.get(base).json()["resultData"]["flowBlockers"] == ["검증을 통과해야 등록할 수 있습니다."]
    r = c.post(base + "register/", json={})
    assert r.status_code == 400 and r.json()["resultMsg"] == "검증을 통과해야 등록할 수 있습니다."
    assert c.post(base + "confirm/").status_code in (404, 405)
    store.FUNCTIONS.save({"bf_0000beef": dict(_bf(), id="bf_0000beef")})
    assert c.put(base, json={"name": "새 이름"}).json()["resultData"]["flowBlockers"] == []
    r = c.post(base + "register/")
    assert r.status_code == 201 and r.json()["resultData"]["tools"][0]["kind"] == "flow"
    assert c.post(base + "register/", json={"mode": "all"}).status_code == 400


def test_영문_이름의_업무가_두_주소를_쓰면_원본이_따로_남고_업무_도구는_시작_주소_원본에_있다(fn):
    from app.ieum.repositories import sources as src_repo
    bf = _bf(name="news read")
    bf["steps"][1]["base"] = "http://127.0.0.2:9"
    store.save_function(bf)
    out = service.register_flow(fn)
    ids = [x["id"] for x in out["sources"]]
    assert len(set(ids)) == 2
    saved = {x["base"]: x["id"] for x in src_repo.list_sources() if x["id"] in ids}
    assert set(saved) == {"http://127.0.0.1:9", "http://127.0.0.2:9"}
    assert out["tools"][0]["id"] in {t["id"] for t in tool_repo.all_tools()[saved["http://127.0.0.1:9"]]}
