"""마켓플레이스 — 카탈로그 · 장바구니 전송 · 맥락 검색 · 스킬.

여기서 지키려는 것은 기능이 아니라 **결정**이다.
  - 담기는 복제다 (참조가 아니다)
  - 중복은 막지 않고 건너뛴다
  - 수집 방식과 검증 이력은 카탈로그에 남는다
  - 스킬은 앞 단계만 참조할 수 있다
이 넷이 깨지면 화면의 근거가 함께 무너지므로 테스트로 못을 박는다.
"""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db import engine
from app.main import app
from app.models import Action, CatalogEntry, ProjectCatalog, Project


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def make_project(client):
    """테스트용 프로젝트를 만들고 끝나면 API 로 지운다.

    직접 지우지 않고 DELETE 를 태우는 이유가 있다 — 삭제가 스킬·카탈로그
    링크까지 치우는지를 이 픽스처가 매번 확인하게 된다. SQLite 는 지워진 id 를
    다시 쓰므로, 뭔가 남으면 다음 테스트의 새 프로젝트에 유령으로 따라붙어
    엉뚱한 곳에서 터진다.
    """
    made: list[int] = []

    def _make(name: str) -> int:
        pid = client.post("/api/projects", json={"name": name}).json()["id"]
        made.append(pid)
        return pid

    yield _make

    for pid in made:
        client.delete(f"/api/projects/{pid}")


@pytest.fixture
def project(make_project):
    """빈 프로젝트 하나. 시드 프로젝트를 쓰면 다른 테스트와 상태가 얽힌다."""
    return make_project("마켓 테스트 프로젝트")


# ── 카탈로그 ────────────────────────────────────────────────────────────────

def test_카탈로그에_수집_방식별_개수가_나온다(client):
    """마켓 좌측 패싯의 근거. 이게 없으면 방식 필터가 성립하지 않는다."""
    facets = client.get("/api/catalog").json()["facets"]
    assert set(facets["kind"]) == {"portal", "document", "traffic"}
    assert sum(facets["kind"].values()) == facets["total"]


def test_상세에_출처와_검증_이력이_들어있다(client):
    """'93초'가 데모의 핵심 근거다. 이 필드가 비면 주장할 것이 없어진다."""
    src = client.get("/api/catalog/kr.go.molit.rtms").json()["source"]
    assert src["kind"] == "portal"
    assert src["collectSeconds"] > 0
    assert src["ok"] > 0
    assert src["url"].startswith("https://")


def test_검증_신호가_세_갈래다(client):
    """200이지만 0건인 것을 실패로 칠하면 멀쩡한 도구를 버리게 된다."""
    tools = client.get("/api/catalog/kr.go.molit.rtms").json()["toolList"]
    assert {t["verify"] for t in tools} <= {"verified", "warn", "fail"}
    warn = [t for t in tools if t["verify"] == "warn"]
    assert warn and warn[0]["note"], "확인 필요면 왜 그런지 문구가 있어야 한다"


def test_수집_방식_필터가_동작한다(client):
    rows = client.get("/api/catalog?kind=document").json()["items"]
    assert rows and all(r["kind"] == "document" for r in rows)


# ── 장바구니 → 프로젝트 전송 ────────────────────────────────────────────────

def test_담기는_복제다(client, project):
    """참조로 두면 카탈로그가 갱신될 때 프로젝트가 말없이 바뀐다 —
    에이전트가 쓰는 도구가 예고 없이 변하는 건 사고다."""
    with Session(engine) as db:
        entry = db.exec(select(CatalogEntry).where(
            CatalogEntry.slug == "kr.go.mois.juso")).one()
        entry_id, tools = entry.id, 3

    client.post("/api/catalog/dispatch",
                json={"entryIds": [entry_id], "projectIds": [project]})

    with Session(engine) as db:
        actions = db.exec(select(Action).where(Action.project_id == project)).all()
    assert len(actions) == tools
    # 복제본은 카탈로그가 아니라 프로젝트가 소유한다
    assert all(a.project_id == project for a in actions)
    # 수집 방식이 따라와야 화면에서 배지를 그릴 수 있다
    assert all(a.source_kind == "document" for a in actions)


def test_여러_프로젝트에_한_번에_보낸다(client, project, make_project):
    other = make_project("마켓 테스트 프로젝트 2")

    with Session(engine) as db:
        eid = db.exec(select(CatalogEntry).where(
            CatalogEntry.slug == "kr.go.kma.forecast")).one().id

    body = client.post("/api/catalog/dispatch",
                       json={"entryIds": [eid], "projectIds": [project, other]}).json()
    assert body["projects"] == 2
    assert body["added"] == 2   # 프로젝트당 1개씩


def test_중복은_막지_않고_건너뛴다(client, project):
    """'이미 있어서 못 보냅니다'로 되돌리면 무엇을 빼야 하는지 사용자가 직접 찾아야 한다."""
    with Session(engine) as db:
        a = db.exec(select(CatalogEntry).where(CatalogEntry.slug == "kr.go.mois.juso")).one().id
        b = db.exec(select(CatalogEntry).where(CatalogEntry.slug == "kr.go.epost.tracking")).one().id

    client.post("/api/catalog/dispatch", json={"entryIds": [a], "projectIds": [project]})
    second = client.post("/api/catalog/dispatch",
                         json={"entryIds": [a, b], "projectIds": [project]}).json()

    assert second["skipped"] == 1, "이미 담긴 것은 건너뛴다"
    assert second["added"] == 1, "나머지는 그대로 보낸다"


def test_새_프로젝트를_만들어_보낼_수_있다(client):  # noqa: D103
    with Session(engine) as db:
        eid = db.exec(select(CatalogEntry).where(
            CatalogEntry.slug == "kr.go.epost.tracking")).one().id

    r = client.post("/api/catalog/dispatch",
                    json={"entryIds": [eid], "newProjectName": "위자드가 만든 프로젝트"}).json()
    assert r["projects"] == 1
    new_id = r["results"][0]["projectId"]

    assert client.get(f"/api/projects/{new_id}/catalog").json()[0]["id"] == eid
    client.delete(f"/api/projects/{new_id}")


def test_빼면_복제된_도구도_사라진다(client, project):
    with Session(engine) as db:
        eid = db.exec(select(CatalogEntry).where(CatalogEntry.slug == "kr.go.mois.juso")).one().id

    client.post("/api/catalog/dispatch", json={"entryIds": [eid], "projectIds": [project]})
    removed = client.delete(f"/api/projects/{project}/catalog/{eid}").json()

    assert removed["removedActions"] == 3
    with Session(engine) as db:
        assert not db.exec(select(Action).where(Action.project_id == project)).all()


# ── 맥락 검색 ───────────────────────────────────────────────────────────────

def test_조사가_붙어도_검색어를_뽑는다(client):
    """'실거래가랑' 이 '실거래가' 에 걸려야 한국어 문장 검색이 성립한다."""
    r = client.get("/api/search", params={"q": "아파트 실거래가랑 인구 같이 보고 싶어"}).json()
    assert "실거래가" in r["intent"]
    assert "인구" in r["intent"]
    assert r["entries"], "MCP 가 하나도 안 걸리면 검색이 무용지물이다"


def test_검색_결과가_점수순이다(client):
    r = client.get("/api/search", params={"q": "아파트 실거래가"}).json()
    scores = [e["score"] for e in r["entries"]]
    assert scores == sorted(scores, reverse=True)


def test_추천은_근거를_함께_준다(client):
    """근거 없는 추천은 표시하지 않는다는 원칙의 계약."""
    r = client.get("/api/recommend", params={"text": "아파트 실거래가와 인구를 보고 싶다"}).json()
    assert r["items"]
    assert all(i["why"] for i in r["items"]), "왜 골랐는지가 항상 붙어야 한다"


def test_설명이_비어도_추천이_비지_않는다(client):
    """위자드 2단계가 텅 비면 사용자가 다음으로 갈 수 없다."""
    assert client.get("/api/recommend", params={"text": ""}).json()["items"]


# ── 스킬 ────────────────────────────────────────────────────────────────────

def _skill_body(tool_id: int, name: str = "테스트 브리핑") -> dict:
    return {
        "name": name,
        "steps": [
            {"type": "mcp", "tool_id": str(tool_id), "args_template": {"a": "{{input}}"}},
            {"type": "prompt", "text": "{{steps[0].output}} 를 정리하라"},
        ],
    }


@pytest.fixture
def tool_id(client, project):
    with Session(engine) as db:
        eid = db.exec(select(CatalogEntry).where(CatalogEntry.slug == "kr.go.mois.juso")).one().id
    client.post("/api/catalog/dispatch", json={"entryIds": [eid], "projectIds": [project]})
    return client.get(f"/api/projects/{project}/skill-palette").json()[0]["id"]


def test_스킬_슬러그가_한글을_지우지_않는다(client, project, tool_id):
    """a-z 만 남기면 한국어 이름이 전부 '/skill' 로 뭉개진다."""
    r = client.post(f"/api/projects/{project}/skills",
                    json=_skill_body(tool_id, "지역 투자 브리핑")).json()
    assert r["slug"] == "지역-투자-브리핑"


def test_스킬은_앞_단계만_참조한다(client, project, tool_id):
    """뒤를 가리키면 실행 시점에 값이 없다. 조용히 빈 응답을 내는 대신 저장을 막는다."""
    bad = {"name": "잘못된 스킬",
           "steps": [{"type": "prompt", "text": "{{steps[2].output}} 를 쓰라"}]}
    r = client.post(f"/api/projects/{project}/skills", json=bad)
    assert r.status_code == 422
    assert "아직 실행되지 않은" in r.json()["detail"]


def test_도구_없는_mcp_step은_막힌다(client, project):
    r = client.post(f"/api/projects/{project}/skills",
                    json={"name": "빈 스킬", "steps": [{"type": "mcp"}]})
    assert r.status_code == 422


def test_스킬이_파이프라인_모양과_비용을_준다(client, project, tool_id):
    """카드의 teal·purple 도트와 인스펙터의 1회 실행 비용이 이 값으로 그려진다."""
    r = client.post(f"/api/projects/{project}/skills", json=_skill_body(tool_id)).json()
    assert r["shape"] == ["mcp", "prompt"]
    assert r["costPerRun"] == 0, "공공 MCP 만 쓰면 비용이 0 이다"


def test_유료_MCP를_쓰면_실행_비용이_붙는다(client, project):
    with Session(engine) as db:
        eid = db.exec(select(CatalogEntry).where(
            CatalogEntry.slug == "kr.valuemap.district")).one().id
        price = db.get(CatalogEntry, eid).price_per_call

    client.post("/api/catalog/dispatch", json={"entryIds": [eid], "projectIds": [project]})
    paid = client.get(f"/api/projects/{project}/skill-palette").json()[0]
    assert paid["pricePerCall"] == price

    r = client.post(f"/api/projects/{project}/skills",
                    json=_skill_body(paid["id"], "유료 스킬")).json()
    assert r["costPerRun"] == price


def test_슬러그가_겹치면_막는다(client, project, tool_id):
    client.post(f"/api/projects/{project}/skills", json=_skill_body(tool_id, "같은 이름"))
    dup = client.post(f"/api/projects/{project}/skills", json=_skill_body(tool_id, "같은 이름"))
    assert dup.status_code == 409


# ── 홈 · 모니터 ─────────────────────────────────────────────────────────────

def test_홈이_프로젝트별_집계를_준다(client):
    d = client.get("/api/home").json()
    assert d["totals"]["projects"] == len(d["projects"])
    assert all("kinds" in p for p in d["projects"])


def test_라이브_모니터에_본문이_실리지_않는다(client):
    """요청·응답 본문은 애초에 저장하지 않는다. 나중에 빼는 것보다 쉽다."""
    d = client.get("/api/metrics/live").json()
    assert set(d) == {"rps", "series", "bars", "today", "successRate", "p95", "stream"}
    for row in d["stream"]:
        assert set(row) == {"tool", "kind", "status", "ms", "project"}


def test_프로젝트를_지우면_스킬도_사라진다(client, make_project, tool_id_factory):
    """SQLite 는 지워진 id 를 다시 쓴다. 스킬이 남으면 나중에 만든 다른
    프로젝트에 본 적 없는 스킬이 붙고 슬러그가 겹쳐 저장이 막힌다."""
    pid = make_project("삭제 검증 프로젝트")
    tid = tool_id_factory(pid)
    client.post(f"/api/projects/{pid}/skills", json=_skill_body(tid, "지워질 스킬"))

    r = client.delete(f"/api/projects/{pid}").json()
    assert r["deletedSkills"] == 1

    with Session(engine) as db:
        from app.models import Skill
        assert not db.exec(select(Skill).where(Skill.project_id == pid)).all()
        assert not db.exec(select(ProjectCatalog).where(
            ProjectCatalog.project_id == pid)).all()


@pytest.fixture
def tool_id_factory(client):
    """지정한 프로젝트에 MCP 를 담고 도구 하나의 id 를 돌려준다."""
    def _make(pid: int) -> int:
        with Session(engine) as db:
            eid = db.exec(select(CatalogEntry).where(
                CatalogEntry.slug == "kr.go.mois.juso")).one().id
        client.post("/api/catalog/dispatch", json={"entryIds": [eid], "projectIds": [pid]})
        return client.get(f"/api/projects/{pid}/skill-palette").json()[0]["id"]
    return _make
