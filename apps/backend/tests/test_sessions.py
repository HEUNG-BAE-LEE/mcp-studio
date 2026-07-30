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


def test_프로젝트_get_or_create는_같은_이름을_두번_호출해도_같은_id를_반환한다(client):
    first = client.post("/api/projects", json={"name": "새 프로젝트"})
    assert first.status_code == 200
    first_body = first.json()
    assert first_body["name"] == "새 프로젝트"

    second = client.post("/api/projects", json={"name": "새 프로젝트"})
    assert second.status_code == 200
    second_body = second.json()

    assert first_body["id"] == second_body["id"]


def test_프로젝트_이름이_공백뿐이면_422를_반환한다(client):
    response = client.post("/api/projects", json={"name": "   "})
    assert response.status_code == 422
    assert "detail" in response.json()


def test_프로젝트_이름의_앞뒤_공백은_제거된다(client):
    response = client.post("/api/projects", json={"name": "  공백 프로젝트  "})
    assert response.status_code == 200
    assert response.json()["name"] == "공백 프로젝트"


def test_프로젝트_목록은_id순으로_정렬된다(client, project_id):
    client.post("/api/projects", json={"name": "목록용 프로젝트"})
    response = client.get("/api/projects")
    assert response.status_code == 200
    body = response.json()
    ids = [p["id"] for p in body]
    assert ids == sorted(ids)
    assert any(p["name"] == "목록용 프로젝트" for p in body)


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


def test_세션_단건_조회는_프로젝트_이름을_함께_돌려준다(client, project_id):
    session_id = client.post(f"/api/projects/{project_id}/recording-sessions").json()["id"]

    body = client.get(f"/api/recording-sessions/{session_id}").json()

    assert body["id"] == session_id
    assert body["projectId"] == project_id
    assert isinstance(body["projectName"], str) and body["projectName"] != ""
    assert body["status"] == "RECORDING"


def test_없는_세션_단건_조회는_한국어_404다(client):
    res = client.get("/api/recording-sessions/9999")
    assert res.status_code == 404
    assert res.json()["detail"] == "해당 기록 세션을 찾을 수 없습니다"


def test_세션_목록은_요청수와_최고점수를_함께_돌려준다(client, project_id):
    session_id = client.post(f"/api/projects/{project_id}/recording-sessions").json()["id"]
    client.post(f"/api/recording-sessions/{session_id}/bulk", json={
        "interactions": [{
            "interactionId": "i1", "eventType": "click",
            "pageUrl": "https://example.com/a", "selector": "#go",
            "elementText": "이동", "occurredAt": "2026-07-26T01:00:00.000Z",
        }],
        "networks": [{
            "url": "https://example.com/api/list", "method": "POST",
            "requestHeaders": {}, "requestBody": "a=1", "status": 200,
            "responseText": '{"list":[{"a":1}]}', "durationMs": 12,
            "occurredAt": "2026-07-26T01:00:01.000Z", "interactionId": "i1",
        }],
    })

    rows = client.get(f"/api/projects/{project_id}/recording-sessions").json()
    row = next(r for r in rows if r["id"] == session_id)

    assert row["requestCount"] == 1
    # 아직 /candidates를 부르지 않았으므로 채점 전이다
    assert row["topScore"] is None

    client.get(f"/api/recording-sessions/{session_id}/candidates")
    row = next(r for r in client.get(f"/api/projects/{project_id}/recording-sessions").json()
               if r["id"] == session_id)
    assert isinstance(row["topScore"], int)


def test_세션이_없는_프로젝트의_목록은_빈_배열이다(client, project_id):
    assert client.get(f"/api/projects/{project_id}/recording-sessions").json() == []


def test_세션_삭제는_자식_행도_함께_지운다(client, project_id, engine):
    from sqlmodel import Session as DbSession, select as db_select
    from app.models import InteractionEvent, NetworkRequest

    session_id = client.post(f"/api/projects/{project_id}/recording-sessions").json()["id"]
    client.post(f"/api/recording-sessions/{session_id}/bulk", json={
        "interactions": [{
            "interactionId": "i1", "eventType": "click",
            "pageUrl": "https://example.com/a", "selector": "#go",
            "elementText": "이동", "occurredAt": "2026-07-26T01:00:00.000Z",
        }],
        "networks": [{
            "url": "https://example.com/api/list", "method": "POST",
            "requestHeaders": {}, "requestBody": "a=1", "status": 200,
            "responseText": '{"list":[{"a":1}]}', "durationMs": 12,
            "occurredAt": "2026-07-26T01:00:01.000Z", "interactionId": "i1",
        }],
    })

    assert client.delete(f"/api/recording-sessions/{session_id}").json() == {"ok": True}

    assert client.get(f"/api/recording-sessions/{session_id}").status_code == 404
    with DbSession(engine) as db:
        assert db.exec(db_select(NetworkRequest)
                       .where(NetworkRequest.session_id == session_id)).all() == []
        assert db.exec(db_select(InteractionEvent)
                       .where(InteractionEvent.session_id == session_id)).all() == []


def test_없는_세션_삭제는_한국어_404다(client):
    res = client.delete("/api/recording-sessions/9999")
    assert res.status_code == 404
    assert res.json()["detail"] == "해당 기록 세션을 찾을 수 없습니다"


def test_프로젝트_삭제는_세션과_액션을_모두_지운다(client, project_id, engine):
    from sqlmodel import Session as DbSession, select as db_select
    from app.models import Project, RecordingSession, InteractionEvent, NetworkRequest, Action

    session_id = client.post(f"/api/projects/{project_id}/recording-sessions").json()["id"]
    client.post(f"/api/recording-sessions/{session_id}/bulk", json={
        "interactions": [{
            "interactionId": "i1", "eventType": "click",
            "pageUrl": "https://example.com/a", "selector": "#go",
            "elementText": "이동", "occurredAt": "2026-07-27T01:00:00.000Z",
        }],
        "networks": [{
            "url": "https://example.com/api/list", "method": "POST",
            "requestHeaders": {}, "requestBody": "a=1", "status": 200,
            "responseText": '{"list":[{"a":1}]}', "durationMs": 12,
            "occurredAt": "2026-07-27T01:00:01.000Z", "interactionId": "i1",
        }],
    })
    request_id = client.get(f"/api/recording-sessions/{session_id}/candidates") \
        .json()[0]["candidates"][0]["id"]
    action_id = client.post("/api/actions", json={
        "networkRequestId": request_id, "name": "조회",
        "toolName": "search", "description": "",
    }).json()["id"]

    body = client.delete(f"/api/projects/{project_id}").json()

    assert body["ok"] is True
    assert body["deletedSessions"] == 1
    assert body["deletedActions"] == 1
    assert body["deletedRequests"] == 1

    # 액션은 세션 삭제 때는 살아남지만 프로젝트 삭제 때는 함께 사라진다.
    # 남겨두면 어디에도 속하지 않은 채 콘솔의 도구 목록에만 뜬다.
    assert client.get(f"/api/actions/{action_id}").status_code == 404
    assert client.get(f"/api/recording-sessions/{session_id}").status_code == 404
    with DbSession(engine) as db:
        assert db.get(Project, project_id) is None
        assert db.exec(db_select(NetworkRequest)
                       .where(NetworkRequest.session_id == session_id)).all() == []
        assert db.exec(db_select(InteractionEvent)
                       .where(InteractionEvent.session_id == session_id)).all() == []


def test_빈_프로젝트도_삭제된다(client, project_id):
    body = client.delete(f"/api/projects/{project_id}").json()
    assert body == {"ok": True, "deletedSessions": 0, "deletedActions": 0, "deletedRequests": 0}
    assert project_id not in [p["id"] for p in client.get("/api/projects").json()]


def test_없는_프로젝트_삭제는_한국어_404다(client):
    res = client.delete("/api/projects/9999")
    assert res.status_code == 404
    assert res.json()["detail"] == "해당 프로젝트를 찾을 수 없습니다"


def test_엔진별_요약은_수집_방식마다_한_줄이다(client, project_id):
    rows = client.get("/api/collection-engines").json()

    assert [r["kind"] for r in rows] == ["traffic", "portal", "document"]
    for r in rows:
        assert r["sessions"] == 0 and r["candidates"] == 0 and r["projects"] == 0


def test_엔진별_세션은_프로젝트_경계를_넘어_모인다(client, project_id, engine):
    """엔진은 프로젝트가 아니라 수집 사건의 속성이다(RecordingSession.kind).

    한 프로젝트에 트래픽·포털 세션이 함께 있는 것이 정상이므로, 엔진별 목록은
    프로젝트로 가르지 않고 kind 로 가른다.
    """
    from sqlmodel import Session as DbSession
    from app.models import RecordingSession

    other = client.post("/api/projects", json={"name": "다른 프로젝트"}).json()["id"]
    a = client.post(f"/api/projects/{project_id}/recording-sessions").json()["id"]
    b = client.post(f"/api/projects/{other}/recording-sessions").json()["id"]

    # 같은 프로젝트에 포털 세션을 하나 더 둔다 — 섞이는 것이 정상임을 전제로 한다
    with DbSession(engine) as db:
        row = db.get(RecordingSession, b)
        row.kind = "portal"
        db.add(row)
        db.commit()

    traffic = client.get("/api/collection-engines/traffic/sessions").json()
    portal = client.get("/api/collection-engines/portal/sessions").json()

    assert [r["id"] for r in traffic] == [a]
    assert [r["id"] for r in portal] == [b]
    # 엔진별 목록에서는 어느 프로젝트 것인지가 핵심 정보다
    assert traffic[0]["projectName"] and portal[0]["projectName"]

    summary = {r["kind"]: r for r in client.get("/api/collection-engines").json()}
    assert summary["traffic"]["sessions"] == 1
    assert summary["portal"]["sessions"] == 1
    assert summary["portal"]["projects"] == 1


def test_알_수_없는_수집_방식은_한국어_422다(client):
    res = client.get("/api/collection-engines/whatever/sessions")
    assert res.status_code == 422
    assert "알 수 없는 수집 방식" in res.json()["detail"]


def test_프로젝트_목록이_엔진과_개수를_함께_준다(client):
    """프로젝트 목록이 이름만 주면 내 작업에 대해 아무것도 답하지 못한다.

    테스트는 매번 새 인메모리 DB를 쓰므로(운영 dev.db의 seed() 와는 무관하다),
    앱 시작 시의 시드 대신 이 테스트 안에서 프로젝트를 만들어 존재를 보장한다.
    """
    client.post("/api/projects", json={"name": "요약테스트-목록"})
    rows = client.get("/api/projects").json()
    assert rows, "프로젝트가 있어야 한다"
    for row in rows:
        # 기존 필드는 그대로 — 이 응답을 읽는 화면이 이미 셋 있다
        assert "id" in row and "name" in row
        assert isinstance(row["kinds"], list)
        assert isinstance(row["sessions"], int)
        assert isinstance(row["actions"], int)
        assert "lastCollectedAt" in row


def test_한_프로젝트에_트래픽과_포털이_섞이면_고정_순서_배지와_실제_개수를_준다(client, project_id, engine):
    """kinds 는 set 이 아니라 고정 순서 리스트여야 한다.

    포털 세션을 먼저 만들고 트래픽 세션을 나중에 만든다 — 삽입 순서와
    기대 순서(traffic, portal)를 어긋나게 둬서, kinds = list(present) 처럼
    set 순서를 그대로 내보내는 회귀를 이 테스트가 실제로 잡게 한다.
    """
    from sqlmodel import Session as DbSession
    from app.models import RecordingSession

    portal_id = client.post(f"/api/projects/{project_id}/recording-sessions").json()["id"]
    with DbSession(engine) as db:
        row = db.get(RecordingSession, portal_id)
        row.kind = "portal"
        db.add(row)
        db.commit()

    traffic_id = client.post(f"/api/projects/{project_id}/recording-sessions").json()["id"]

    rows = client.get("/api/projects").json()
    row = next(r for r in rows if r["id"] == project_id)

    assert row["kinds"] == ["traffic", "portal"]
    assert row["sessions"] == 2
    assert row["lastCollectedAt"] is not None

    assert traffic_id != portal_id  # 두 세션이 실제로 따로 만들어졌는지 확인


def test_세션이_없는_프로젝트는_빈_배지와_None_을_준다(client):
    body = client.post("/api/projects", json={"name": "요약테스트-빈프로젝트"}).json()
    rows = client.get("/api/projects").json()
    row = next(r for r in rows if r["id"] == body["id"])
    assert row["kinds"] == []
    assert row["sessions"] == 0
    assert row["actions"] == 0
    assert row["lastCollectedAt"] is None
