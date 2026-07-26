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


@pytest.fixture(name="network_request_id")
def network_request_id_fixture(engine):
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


def test_액션_생성은_페이로드의_projectId를_무시하고_세션의_프로젝트를_따른다(client, network_request_id, engine):
    ids = network_request_id
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
