from datetime import datetime
import pytest
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.db import get_session
from app.models import Project, RecordingSession, NetworkRequest


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


@pytest.fixture(name="network_request_ids")
def network_request_ids_fixture(engine):
    # project_id=1인 프로젝트와 project_id=2인 프로젝트를 함께 만들어서,
    # 액션이 페이로드가 아니라 세션이 속한 프로젝트를 따라가는지 확인한다.
    with Session(engine) as db:
        wrong_project = Project(name="엉뚱한 프로젝트", allowed_origins=[])
        real_project = Project(name="진짜 프로젝트", allowed_origins=[])
        db.add(wrong_project)
        db.add(real_project)
        db.commit()
        db.refresh(wrong_project)
        db.refresh(real_project)

        session_row = RecordingSession(project_id=real_project.id, started_at=datetime.utcnow())
        db.add(session_row)
        db.commit()
        db.refresh(session_row)

        net = NetworkRequest(
            session_id=session_row.id,
            interaction_id=None,
            request_url="https://example.com/api",
            request_method="GET",
            request_headers={},
            request_body=None,
            response_status=200,
            response_preview={},
            is_json=False,
            duration_ms=10,
            occurred_at=datetime.utcnow(),
        )
        db.add(net)
        db.commit()
        db.refresh(net)

        return {
            "networkRequestId": net.id,
            "realProjectId": real_project.id,
            "wrongProjectId": wrong_project.id,
        }


def test_액션_생성은_페이로드의_projectId를_무시하고_세션의_프로젝트를_따른다(client, network_request_ids, engine):
    ids = network_request_ids
    payload = {
        "networkRequestId": ids["networkRequestId"],
        "name": "테스트 액션",
        "toolName": "test_tool",
        "description": "",
        # 일부러 틀린 프로젝트 id를 넣는다 - 무시되어야 한다
        "projectId": ids["wrongProjectId"],
    }

    response = client.post("/api/actions", json=payload)
    assert response.status_code == 200
    action_id = response.json()["id"]

    from app.models import Action

    with Session(engine) as db:
        action = db.get(Action, action_id)

    assert action.project_id == ids["realProjectId"]
    assert action.project_id != ids["wrongProjectId"]


def test_존재하지_않는_네트워크_요청은_404를_반환한다(client):
    payload = {
        "networkRequestId": 999999,
        "name": "테스트 액션",
        "toolName": "test_tool",
    }
    response = client.post("/api/actions", json=payload)
    assert response.status_code == 404


@pytest.fixture
def network_request_id(client, project_id):
    """액션 생성의 입력이 되는 네트워크 요청 하나를 만들어 그 id를 준다."""
    session_id = client.post(f"/api/projects/{project_id}/recording-sessions").json()["id"]
    client.post(f"/api/recording-sessions/{session_id}/bulk", json={
        "interactions": [{
            "interactionId": "i1", "eventType": "click",
            "pageUrl": "https://example.com/a", "selector": "#go",
            "elementText": "이동", "occurredAt": "2026-07-26T01:00:00.000Z",
        }],
        "networks": [{
            "url": "https://example.com/api/list?srhYear=2026", "method": "POST",
            "requestHeaders": {"User-Agent": "UA", "Referer": "https://example.com/a"},
            "requestBody": "minX=1&minY=2", "status": 200,
            "responseText": '{"list":[{"a":1}]}', "durationMs": 12,
            "occurredAt": "2026-07-26T01:00:01.000Z", "interactionId": "i1",
        }],
    })
    rows = client.get(f"/api/recording-sessions/{session_id}/candidates").json()
    return rows[0]["candidates"][0]["id"]


def test_액션_단건_조회는_스펙과_상태를_돌려준다(client, project_id, network_request_id):
    created = client.post("/api/actions", json={
        "networkRequestId": network_request_id,
        "name": "단지 조회", "toolName": "search_markers", "description": "설명",
    }).json()

    body = client.get(f"/api/actions/{created['id']}").json()

    assert body["id"] == created["id"]
    assert body["projectId"] == project_id
    assert body["name"] == "단지 조회"
    assert body["toolName"] == "search_markers"
    assert body["status"] == "DRAFT"
    assert body["actionSpec"]["request"]["method"] == "POST"


def test_없는_액션_단건_조회는_한국어_404다(client):
    res = client.get("/api/actions/9999")
    assert res.status_code == 404
    assert res.json()["detail"] == "해당 MCP 도구를 찾을 수 없습니다"


def test_세션을_지워도_액션은_남는다(client, project_id, network_request_id):
    """액션은 네트워크 요청을 참조하지 않고 스펙에 값을 복사해 둔다."""
    action_id = client.post("/api/actions", json={
        "networkRequestId": network_request_id,
        "name": "단지 조회", "toolName": "search_markers", "description": "",
    }).json()["id"]

    sessions = client.get(f"/api/projects/{project_id}/recording-sessions").json()
    for row in sessions:
        client.delete(f"/api/recording-sessions/{row['id']}")

    body = client.get(f"/api/actions/{action_id}").json()
    assert body["id"] == action_id
    assert body["actionSpec"]["request"]["method"] == "POST"


def test_액션_삭제(client, network_request_id):
    action_id = client.post("/api/actions", json={
        "networkRequestId": network_request_id,
        "name": "단지 조회", "toolName": "search_markers", "description": "",
    }).json()["id"]

    assert client.delete(f"/api/actions/{action_id}").json() == {"ok": True}
    assert client.get(f"/api/actions/{action_id}").status_code == 404


def test_없는_액션_삭제는_한국어_404다(client):
    res = client.delete("/api/actions/9999")
    assert res.status_code == 404
    assert res.json()["detail"] == "해당 MCP 도구를 찾을 수 없습니다"


def test_이름을_바꾸면_단건_조회와_목록에_모두_반영된다(client, project_id, network_request_id):
    action_id = client.post("/api/actions", json={
        "networkRequestId": network_request_id,
        "name": "단지 조회", "toolName": "search_markers", "description": "",
    }).json()["id"]

    res = client.put(f"/api/actions/{action_id}", json={"name": "다른 사이트 조회", "toolName": "search_other_site"})
    assert res.status_code == 200

    body = client.get(f"/api/actions/{action_id}").json()
    assert body["name"] == "다른 사이트 조회"
    assert body["toolName"] == "search_other_site"
    # actionSpec 안의 name·toolName도 함께 갱신되어야 action_to_tool()이
    # 예전 이름을 돌려주지 않는다.
    assert body["actionSpec"]["name"] == "다른 사이트 조회"
    assert body["actionSpec"]["toolName"] == "search_other_site"

    listed = client.get(f"/api/projects/{project_id}/actions").json()
    row = next(r for r in listed if r["id"] == action_id)
    assert row["name"] == "다른 사이트 조회"
    assert row["toolName"] == "search_other_site"


def test_status만_보내는_PUT은_이름을_지우지_않는다(client, network_request_id):
    action_id = client.post("/api/actions", json={
        "networkRequestId": network_request_id,
        "name": "단지 조회", "toolName": "search_markers", "description": "",
    }).json()["id"]

    res = client.put(f"/api/actions/{action_id}", json={"status": "ACTIVE"})
    assert res.status_code == 200

    body = client.get(f"/api/actions/{action_id}").json()
    assert body["status"] == "ACTIVE"
    assert body["name"] == "단지 조회"
    assert body["toolName"] == "search_markers"


def test_빈_이름으로_바꾸면_422를_반환한다(client, network_request_id):
    action_id = client.post("/api/actions", json={
        "networkRequestId": network_request_id,
        "name": "단지 조회", "toolName": "search_markers", "description": "",
    }).json()["id"]

    res = client.put(f"/api/actions/{action_id}", json={"name": "   "})
    assert res.status_code == 422

    res2 = client.put(f"/api/actions/{action_id}", json={"toolName": ""})
    assert res2.status_code == 422

    body = client.get(f"/api/actions/{action_id}").json()
    assert body["name"] == "단지 조회"
    assert body["toolName"] == "search_markers"


def test_이름을_주지_않으면_URL에서_초안을_만든다(client, network_request_id):
    """하드코딩된 기본값을 쓰면 어떤 사이트를 기록해도 같은 이름을 달고 태어난다."""
    created = client.post("/api/actions", json={"networkRequestId": network_request_id}).json()

    body = client.get(f"/api/actions/{created['id']}").json()
    assert body["name"] == "list"
    assert body["toolName"] == "list"
    assert body["actionSpec"]["toolName"] == "list"


def test_이름을_주면_그대로_쓴다(client, network_request_id):
    created = client.post("/api/actions", json={
        "networkRequestId": network_request_id,
        "name": "내가 정한 이름", "toolName": "my_tool",
    }).json()

    body = client.get(f"/api/actions/{created['id']}").json()
    assert body["name"] == "내가 정한 이름"
    assert body["toolName"] == "my_tool"


def test_공백만_준_이름은_초안으로_대체된다(client, network_request_id):
    created = client.post("/api/actions", json={
        "networkRequestId": network_request_id, "name": "   ", "toolName": "",
    }).json()

    body = client.get(f"/api/actions/{created['id']}").json()
    assert body["name"] == "list"
    assert body["toolName"] == "list"
