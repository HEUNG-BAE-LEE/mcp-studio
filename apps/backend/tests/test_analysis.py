import pytest
from sqlmodel import SQLModel, Session, create_engine, select
from sqlmodel.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.db import get_session
from app.models import Project, NetworkRequest


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


def _seed_session(client, project_id):
    """실제 데모 시나리오와 동일하게 클릭 1건과 요청 3건을 적재한다.

    - getMarker.do: 클릭 직후 성공 JSON 응답 → 1순위 후보여야 한다.
    - getCenterLedCdPnu.do: 마찬가지로 클릭에 연결된 정상 조회 요청.
    - accesLog.do: 로그성 API로 LOG_URL 패턴에 걸려 감점되어 최하위여야 한다.
    """
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
                "requestHeaders": {},
                "requestBody": None,
                "status": 200,
                "responseText": '{"list":[{"aprpnHsmpNm":"롯데미도파광화문빌딩"}]}',
                "durationMs": 120,
                "occurredAt": "2026-07-26T01:02:03.500Z",
                "interactionId": "int-1",
            },
            {
                "url": "https://rt.molit.go.kr/cmm/gis/getCenterLedCdPnu.do",
                "method": "GET",
                "requestHeaders": {},
                "requestBody": None,
                "status": 200,
                "responseText": '{"pnu":"1111010100"}',
                "durationMs": 80,
                "occurredAt": "2026-07-26T01:02:03.600Z",
                "interactionId": "int-1",
            },
            {
                "url": "https://rt.molit.go.kr/pt/main/accesLog.do",
                "method": "GET",
                "requestHeaders": {},
                "requestBody": None,
                "status": 200,
                "responseText": "",
                "durationMs": 30,
                "occurredAt": "2026-07-26T01:02:03.700Z",
                "interactionId": "int-1",
            },
        ],
    }

    response = client.post(f"/api/recording-sessions/{session_id}/bulk", json=payload)
    assert response.status_code == 200
    return session_id


def test_후보_정렬은_getMarker가_1순위이고_accesLog가_최하위다(client, project_id):
    session_id = _seed_session(client, project_id)

    response = client.get(f"/api/recording-sessions/{session_id}/candidates")
    assert response.status_code == 200
    body = response.json()

    assert len(body) == 1
    candidates = body[0]["candidates"]
    urls = [c["url"] for c in candidates]

    assert urls[0].endswith("getMarker.do")
    assert urls[-1].endswith("accesLog.do")


def test_두_번_호출해도_점수와_요청_건수가_그대로다(client, project_id, engine):
    session_id = _seed_session(client, project_id)

    first = client.get(f"/api/recording-sessions/{session_id}/candidates").json()
    second = client.get(f"/api/recording-sessions/{session_id}/candidates").json()

    assert first == second

    with Session(engine) as db:
        rows = db.exec(
            select(NetworkRequest).where(NetworkRequest.session_id == session_id)
        ).all()

    # 재호출로 새 행이 추가되지 않아야 한다.
    assert len(rows) == 3


def test_점수가_같으면_발생_시각_순서로_반환된다(client, project_id):
    """order_by가 없으면 stable sort 특성상 DB가 돌려주는 행 순서에 기댈 뿐이라,
    점수가 같은 두 요청의 화면 순서가 실행마다 달라질 수 있었다.
    분석 대상 요청 자체(getMarker류)는 채점 로직상 동점이 나오기 어려우므로,
    로그성 API 두 건을 같은 interaction에 묶어 강제로 동점(둘 다 최하위 감점)을
    만들고 발생 시각 순서를 검증한다.
    """
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
                "url": "https://rt.molit.go.kr/pt/main/accesLog.do?id=1",
                "method": "GET",
                "requestHeaders": {},
                "requestBody": None,
                "status": 200,
                "responseText": "",
                "durationMs": 10,
                "occurredAt": "2026-07-26T01:02:03.100Z",
                "interactionId": "int-1",
            },
            {
                "url": "https://rt.molit.go.kr/pt/main/accesLog.do?id=2",
                "method": "GET",
                "requestHeaders": {},
                "requestBody": None,
                "status": 200,
                "responseText": "",
                "durationMs": 10,
                "occurredAt": "2026-07-26T01:02:03.200Z",
                "interactionId": "int-1",
            },
        ],
    }

    response = client.post(f"/api/recording-sessions/{session_id}/bulk", json=payload)
    assert response.status_code == 200

    body = client.get(f"/api/recording-sessions/{session_id}/candidates").json()
    candidates = body[0]["candidates"]

    assert candidates[0]["score"] == candidates[1]["score"]
    assert candidates[0]["url"].endswith("id=1")
    assert candidates[1]["url"].endswith("id=2")
