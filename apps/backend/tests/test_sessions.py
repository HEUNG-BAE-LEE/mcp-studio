import pytest
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.db import get_session
from app.models import Project, RecordingSession, InteractionEvent, NetworkRequest


@pytest.fixture(name="engine")
def engine_fixture():
    # 테스트마다 독립된 메모리 SQLite를 사용한다 (dev.db 오염 방지)
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
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


@pytest.fixture(name="project_id")
def project_id_fixture(engine):
    with Session(engine) as session:
        project = Project(name="테스트 프로젝트", allowed_origins=[])
        session.add(project)
        session.commit()
        session.refresh(project)
        return project.id


def test_세션_생성은_id를_반환한다(client, project_id):
    response = client.post(f"/api/projects/{project_id}/recording-sessions")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["id"], int)


def test_bulk_업로드는_저장_건수를_반환한다(client, project_id, engine):
    session_id = client.post(f"/api/projects/{project_id}/recording-sessions").json()["id"]

    payload = {
        "interactions": [
            {
                "interactionId": "int-1",
                "eventType": "click",
                "pageUrl": "https://rt.molit.go.kr/",
                "selector": "#btn",
                "elementText": "조회",
                "occurredAt": "2026-07-26T01:02:03.000Z",
            }
        ],
        "networks": [
            {
                "url": "https://rt.molit.go.kr/pt/gis/getMarker.do",
                "method": "GET",
                "requestHeaders": {"Authorization": "Bearer abc"},
                "requestBody": None,
                "status": 200,
                # getMarker.do는 JSON을 text/html로 내려보낸다. Content-Type을 신뢰하지 않고
                # 본문 파싱으로 JSON 여부를 판정해야 한다.
                "responseText": '{"list":[{"aprpnHsmpNm":"롯데미도파광화문빌딩"},{"aprpnHsmpNm":"디팰리스"}]}',
                "durationMs": 120,
                "occurredAt": "2026-07-26T01:02:04.000Z",
                "interactionId": "int-1",
            }
        ],
    }

    response = client.post(f"/api/recording-sessions/{session_id}/bulk", json=payload)
    assert response.status_code == 200
    assert response.json() == {"interactions": 1, "networks": 1}

    with Session(engine) as db:
        interactions = db.exec(
            __import__("sqlmodel").select(InteractionEvent).where(InteractionEvent.session_id == session_id)
        ).all()
        networks = db.exec(
            __import__("sqlmodel").select(NetworkRequest).where(NetworkRequest.session_id == session_id)
        ).all()
        session_row = db.get(RecordingSession, session_id)

    assert len(interactions) == 1
    assert interactions[0].interaction_id == "int-1"

    assert len(networks) == 1
    net = networks[0]
    assert net.is_json is True
    assert net.response_preview["sample"]["list"] == [{"aprpnHsmpNm": "롯데미도파광화문빌딩"}]
    assert net.response_preview["counts"]["list"] == 2

    assert session_row.status == "COMPLETED"
    assert session_row.ended_at is not None


def test_상관없는_네트워크_요청은_interaction_id가_null이다(client, project_id):
    session_id = client.post(f"/api/projects/{project_id}/recording-sessions").json()["id"]

    payload = {
        "interactions": [],
        "networks": [
            {
                "url": "https://rt.molit.go.kr/api/ping",
                "method": "GET",
                "requestHeaders": {},
                "requestBody": None,
                "status": 200,
                "responseText": "<!DOCTYPE html><html></html>",
                "durationMs": 30,
                "occurredAt": "2026-07-26T01:02:05.000Z",
                "interactionId": None,
            }
        ],
    }

    response = client.post(f"/api/recording-sessions/{session_id}/bulk", json=payload)
    assert response.status_code == 200
    assert response.json() == {"interactions": 0, "networks": 1}


def test_요청_헤더와_바디는_2차_마스킹을_거친다(client, project_id, engine):
    session_id = client.post(f"/api/projects/{project_id}/recording-sessions").json()["id"]

    jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
    payload = {
        "interactions": [],
        "networks": [
            {
                "url": "https://example.com/api",
                "method": "POST",
                "requestHeaders": {"Authorization": f"Bearer {jwt}"},
                "requestBody": "card=1234-5678-1234-5678",
                "status": 200,
                "responseText": "",
                "durationMs": 10,
                "occurredAt": "2026-07-26T01:02:06.000Z",
                "interactionId": None,
            }
        ],
    }

    client.post(f"/api/recording-sessions/{session_id}/bulk", json=payload)

    with Session(engine) as db:
        net = db.exec(
            __import__("sqlmodel").select(NetworkRequest).where(NetworkRequest.session_id == session_id)
        ).one()

    assert jwt not in net.request_headers["Authorization"]
    assert "***" in net.request_headers["Authorization"]
    assert net.request_body == "card=***"


def test_필드가_누락되거나_시각이_잘못되면_422를_반환한다(client, project_id):
    session_id = client.post(f"/api/projects/{project_id}/recording-sessions").json()["id"]

    # status 필드 누락
    payload_missing_status = {
        "interactions": [],
        "networks": [
            {
                "url": "https://example.com/api",
                "method": "GET",
                "requestHeaders": {},
                "requestBody": None,
                "responseText": "",
                "durationMs": 10,
                "occurredAt": "2026-07-26T01:02:06.000Z",
                "interactionId": None,
            }
        ],
    }
    response = client.post(f"/api/recording-sessions/{session_id}/bulk", json=payload_missing_status)
    assert response.status_code == 422

    # occurredAt이 날짜 형식이 아님
    payload_bad_date = {
        "interactions": [],
        "networks": [
            {
                "url": "https://example.com/api",
                "method": "GET",
                "requestHeaders": {},
                "requestBody": None,
                "status": 200,
                "responseText": "",
                "durationMs": 10,
                "occurredAt": "not-a-date",
                "interactionId": None,
            }
        ],
    }
    response = client.post(f"/api/recording-sessions/{session_id}/bulk", json=payload_bad_date)
    assert response.status_code == 422


def test_응답_본문의_주민등록번호는_response_preview에서_마스킹된다(client, project_id, engine):
    session_id = client.post(f"/api/projects/{project_id}/recording-sessions").json()["id"]

    payload = {
        "interactions": [],
        "networks": [
            {
                "url": "https://example.com/api/user",
                "method": "GET",
                "requestHeaders": {},
                "requestBody": None,
                "status": 200,
                "responseText": '{"user":{"ssn":"901231-1234567","name":"홍길동"}}',
                "durationMs": 10,
                "occurredAt": "2026-07-26T01:02:07.000Z",
                "interactionId": None,
            }
        ],
    }

    response = client.post(f"/api/recording-sessions/{session_id}/bulk", json=payload)
    assert response.status_code == 200

    with Session(engine) as db:
        net = db.exec(
            __import__("sqlmodel").select(NetworkRequest).where(NetworkRequest.session_id == session_id)
        ).one()

    assert net.response_preview["sample"]["user"]["ssn"] == "***"
    assert "901231-1234567" not in str(net.response_preview)


def test_응답_샘플의_apiKey는_패턴이_아니어도_키_이름으로_마스킹된다(client, project_id, engine):
    session_id = client.post(f"/api/projects/{project_id}/recording-sessions").json()["id"]

    payload = {
        "interactions": [],
        "networks": [
            {
                "url": "https://example.com/api/token",
                "method": "GET",
                "requestHeaders": {},
                "requestBody": None,
                "status": 200,
                "responseText": '{"apiKey":"abcd1234","name":"x"}',
                "durationMs": 10,
                "occurredAt": "2026-07-26T01:02:08.000Z",
                "interactionId": None,
            }
        ],
    }

    client.post(f"/api/recording-sessions/{session_id}/bulk", json=payload)

    with Session(engine) as db:
        net = db.exec(
            __import__("sqlmodel").select(NetworkRequest).where(NetworkRequest.session_id == session_id)
        ).one()

    assert net.response_preview["sample"]["apiKey"] == "***"
    assert net.response_preview["sample"]["name"] == "x"


def test_쿼리스트링의_민감_파라미터는_저장_전에_마스킹된다(client, project_id, engine):
    session_id = client.post(f"/api/projects/{project_id}/recording-sessions").json()["id"]

    payload = {
        "interactions": [],
        "networks": [
            {
                "url": "https://rt.molit.go.kr/pt/gis/getMarker.do?minX=126.96&sessionId=abc123&jumin=901231-1234567",
                "method": "GET",
                "requestHeaders": {},
                "requestBody": None,
                "status": 200,
                "responseText": "",
                "durationMs": 10,
                "occurredAt": "2026-07-26T01:02:09.000Z",
                "interactionId": None,
            }
        ],
    }

    client.post(f"/api/recording-sessions/{session_id}/bulk", json=payload)

    with Session(engine) as db:
        net = db.exec(
            __import__("sqlmodel").select(NetworkRequest).where(NetworkRequest.session_id == session_id)
        ).one()

    assert "abc123" not in net.request_url
    assert "901231-1234567" not in net.request_url
    assert "minX=126.96" in net.request_url
    assert net.request_url.startswith("https://rt.molit.go.kr/pt/gis/getMarker.do?")
