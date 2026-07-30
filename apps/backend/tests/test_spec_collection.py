"""포털 공개 기반 수집 — 수집부터 액션 실행 직전까지의 통합 검증."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.db import get_session
from app.main import app
from app.models import Action, Project, RecordingSession
from app.services.executor import build_request
from app.services.tool_registry import action_to_tool

FIXTURE = Path(__file__).parent / "fixtures" / "datagokr_airkorea.html"
SOURCE_URL = "https://www.data.go.kr/data/15073861/openapi.do"


@pytest.fixture(name="engine")
def engine_fixture():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    yield engine


@pytest.fixture(name="client")
def client_fixture(engine):
    def _get_session_override():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = _get_session_override
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture(name="db_session")
def db_session_fixture(engine):
    with Session(engine) as session:
        yield session


@pytest.fixture
def page_html() -> str:
    return FIXTURE.read_text(encoding="utf-8", errors="ignore")


@pytest.fixture
def project_id(client) -> int:
    return client.post("/api/projects", json={"name": "포털수집 테스트"}).json()["id"]


def test_명세_페이지를_수집하면_세션과_오퍼레이션이_생긴다(client, project_id, page_html):
    res = client.post(
        f"/api/projects/{project_id}/spec-sessions",
        json={"url": SOURCE_URL, "html": page_html},
    )
    assert res.status_code == 200, res.text
    body = res.json()

    assert body["portalLabel"] == "공공데이터포털"
    assert body["provider"] == "한국환경공단"
    assert body["added"] == 1
    # 페이지에는 하나의 명세만 실리지만, 전체가 5개라는 사실은 알려줘야 한다
    assert body["availableTotal"] == 5

    ops = client.get(f"/api/recording-sessions/{body['sessionId']}/spec-operations").json()
    assert len(ops) == 1
    assert ops[0]["opName"] == "getMinuDustFrcstDspth"
    assert ops[0]["paramCount"] == 6
    assert ops[0]["requiredCount"] == 1      # serviceKey 만 '필'


def test_같은_서비스를_다시_수집하면_한_세션에_누적된다(client, project_id, page_html):
    """포털은 상세기능을 select 로 바꾸는 구조라 여러 번 수집하는 게 정상 흐름이다."""
    first = client.post(f"/api/projects/{project_id}/spec-sessions",
                        json={"url": SOURCE_URL, "html": page_html}).json()
    second = client.post(f"/api/projects/{project_id}/spec-sessions",
                         json={"url": SOURCE_URL, "html": page_html}).json()

    assert second["sessionId"] == first["sessionId"]
    assert second["added"] == 0        # 같은 오퍼레이션은 중복 등록되지 않는다
    assert second["collected"] == 1


def test_수집_세션은_kind가_portal이다(client, project_id, page_html, db_session: Session):
    body = client.post(f"/api/projects/{project_id}/spec-sessions",
                       json={"url": SOURCE_URL, "html": page_html}).json()
    row = db_session.get(RecordingSession, body["sessionId"])
    assert row.kind == "portal"
    assert row.source_label == "한국환경공단_에어코리아_대기오염정보"


def test_미지원_포털은_거절한다(client, project_id, page_html):
    res = client.post(f"/api/projects/{project_id}/spec-sessions",
                      json={"url": "https://kosis.kr/openapi/x.jsp", "html": page_html})
    assert res.status_code == 422
    assert "공공데이터포털" in res.json()["detail"]


def test_명세가_없는_페이지는_거절한다(client, project_id):
    res = client.post(f"/api/projects/{project_id}/spec-sessions",
                      json={"url": SOURCE_URL, "html": "<html><body>목록 화면</body></html>"})
    assert res.status_code == 422


def test_오퍼레이션을_액션으로_승격한다(client, project_id, page_html):
    body = client.post(f"/api/projects/{project_id}/spec-sessions",
                       json={"url": SOURCE_URL, "html": page_html}).json()
    op = client.get(f"/api/recording-sessions/{body['sessionId']}/spec-operations").json()[0]

    res = client.post(f"/api/spec-operations/{op['id']}/actions", json={"status": "ACTIVE"})
    assert res.status_code == 200, res.text
    action = res.json()
    assert action["toolName"] == "get_minu_dust_frcst_dspth"

    # 프로젝트 액션 목록에 실제로 잡혀야 한다
    actions = client.get(f"/api/projects/{project_id}/actions").json()
    assert any(a["id"] == action["id"] for a in actions)


def test_액션_스펙이_트래픽_경로와_같은_형태다(client, project_id, page_html, db_session: Session):
    """이게 통합의 핵심이다. 형태가 같아야 tool_registry·executor 를 손대지 않는다."""
    body = client.post(f"/api/projects/{project_id}/spec-sessions",
                       json={"url": SOURCE_URL, "html": page_html}).json()
    op = client.get(f"/api/recording-sessions/{body['sessionId']}/spec-operations").json()[0]
    action_id = client.post(f"/api/spec-operations/{op['id']}/actions", json={}).json()["id"]

    action = db_session.get(Action, action_id)
    request = action.action_spec["request"]
    assert request["method"] == "GET"
    assert request["urlTemplate"].endswith("/getMinuDustFrcstDspth")
    assert set(request["querySchema"]) == {
        "serviceKey", "returnType", "numOfRows", "pageNo", "searchDate", "InformCode"
    }


def test_인증키는_LLM에게_노출되지_않는다(client, project_id, page_html, db_session: Session):
    body = client.post(f"/api/projects/{project_id}/spec-sessions",
                       json={"url": SOURCE_URL, "html": page_html}).json()
    op = client.get(f"/api/recording-sessions/{body['sessionId']}/spec-operations").json()[0]
    action_id = client.post(f"/api/spec-operations/{op['id']}/actions", json={}).json()["id"]

    action = db_session.get(Action, action_id)
    tool = action_to_tool(action)
    properties = tool["function"]["parameters"]["properties"]
    assert "serviceKey" not in properties          # 숨김
    assert "InformCode" in properties              # 일반 파라미터는 노출
    # 샘플값이 description 에 실려 모델이 코드값을 지어내지 않는다
    assert "PM10" in properties["InformCode"]["description"]


def test_실행_시_인증키가_주입된다(client, project_id, page_html, db_session: Session):
    client.put(f"/api/projects/{project_id}/credentials",
               json={"portal": "serviceKey", "value": "TEST-KEY-1234"})

    body = client.post(f"/api/projects/{project_id}/spec-sessions",
                       json={"url": SOURCE_URL, "html": page_html}).json()
    op = client.get(f"/api/recording-sessions/{body['sessionId']}/spec-operations").json()[0]
    action_id = client.post(f"/api/spec-operations/{op['id']}/actions", json={}).json()["id"]

    action = db_session.get(Action, action_id)
    project = db_session.get(Project, project_id)
    prepared = build_request(action, {"InformCode": "PM10"}, project.credentials)

    assert "serviceKey=TEST-KEY-1234" in prepared["url"]
    assert "InformCode=PM10" in prepared["url"]


def test_인증키가_없으면_호출_전에_막는다(client, project_id, page_html, db_session: Session):
    body = client.post(f"/api/projects/{project_id}/spec-sessions",
                       json={"url": SOURCE_URL, "html": page_html}).json()
    op = client.get(f"/api/recording-sessions/{body['sessionId']}/spec-operations").json()[0]
    action_id = client.post(f"/api/spec-operations/{op['id']}/actions", json={}).json()["id"]

    action = db_session.get(Action, action_id)
    with pytest.raises(ValueError, match="인증키"):
        build_request(action, {"InformCode": "PM10"}, {})


def test_등록된_인증키는_마스킹해서_돌려준다(client, project_id):
    client.put(f"/api/projects/{project_id}/credentials",
               json={"portal": "data.go.kr", "value": "SECRET-VALUE-XYZ"})
    rows = client.get(f"/api/projects/{project_id}/credentials").json()
    # 응답에는 "무슨 키가 필요한지"(usedBy 등)가 함께 실린다. 여기서 지켜야 할
    # 것은 값이 그대로 나가지 않는다는 사실이므로 그 부분만 본다.
    assert len(rows) == 1
    assert rows[0]["portal"] == "data.go.kr"
    assert rows[0]["masked"] == "SECR****"
    assert "SECRET-VALUE-XYZ" not in str(rows)


def test_인증키가_없으면_실행이_한국어_422로_막힌다(client, project_id, page_html):
    """게이트가 낸 안내가 화면까지 닿아야 한다.

    executor 는 ValueError 를 내는데, 라우터가 잡지 않으면 FastAPI 가 맨
    "Internal Server Error" 를 내보낸다. 그러면 인증 없이 나간 400 을 스펙
    문제로 오해하지 말라고 만든 게이트의 목적 자체가 무너진다.
    """
    body = client.post(f"/api/projects/{project_id}/spec-sessions",
                       json={"url": SOURCE_URL, "html": page_html}).json()
    op = client.get(f"/api/recording-sessions/{body['sessionId']}/spec-operations").json()[0]
    action = client.post(f"/api/spec-operations/{op['id']}/actions",
                         json={"status": "ACTIVE"}).json()

    res = client.post(f"/api/actions/{action['id']}/execute", json={"arguments": {}})

    assert res.status_code == 422, res.text
    detail = res.json()["detail"]
    assert "serviceKey" in detail
    assert "인증키" in detail
