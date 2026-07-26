# 관리자 화면 재구성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 외부 목업의 디자인 언어와 레이아웃 골격을 관리자 화면에 이식하고, 없던 목록 화면과 내비게이션을 만들어 URL을 직접 치지 않아도 되게 한다.

**Architecture:** 백엔드에 조회·삭제 엔드포인트 5개를 더한다. 프론트엔드는 셸 컴포넌트(사이드바·상단바·스테퍼·토스트) 위에 화면을 얹는 구조로 바꾸고, 라우트를 프로젝트 → 세션 → 액션 계층으로 재배치한다. 화면에 뜨는 모든 값은 실제 테이블과 실제 상수에서 온다.

**Tech Stack:** FastAPI + SQLModel + SQLite / React 18 + Vite + react-router-dom + TanStack Query / WXT Chrome Extension

설계 문서: `docs/superpowers/specs/2026-07-26-admin-shell-redesign-design.md`

## 설계 대비 변경 1건

설계는 `/projects/:id` 한 화면에 세션 목록과 액션 목록을 같이 두기로 했다. 이 계획에서는 **액션 목록을 `/projects/:id/actions`로 분리한다.** 사이드바 항목 4개가 각각 갈 곳을 가져야 하는데, 두 목록이 한 화면에 있으면 "기록 세션"과 "액션" 항목이 같은 주소를 가리켜 현재 위치 표시가 무의미해진다. 화면 내용과 기능은 설계 그대로다.

## 선행 조건

이 계획을 시작하기 전에 **커밋 `d2598a3`(프로젝트 이름 자유 입력)이 브라우저에서 실제로 도는지** 확인되어 있어야 한다. 컨트롤러가 Task 1 dispatch 전에 직접 확인한다. 확장에서 임의 이름으로 기록을 시작해 세션이 그 이름의 프로젝트 밑에 생기는 것까지 눈으로 본다.

## Global Constraints

- Python 3.10.11 (3.11+ 문법 금지); Node v25.8.0, npm workspaces; Docker/pnpm/uv 사용 안 함
- DB는 `apps/backend/data/dev.db` 단일 SQLite 파일
- 주석·UI 문구·커밋 메시지는 한국어
- Tailwind·CSS 프레임워크를 새로 도입하지 않는다. CSS는 파일 하나(`apps/admin/src/styles/app.css`)
- 화면에 뜨는 숫자와 문구는 실제 데이터로 뒷받침되어야 한다. 더미 값·가짜 패널 금지
- `window.confirm` / `alert` / `prompt` 금지. 브라우저 모달은 자동화를 막고 촬영 화면에서 튄다
- `.env`는 절대 커밋하지 않는다
- 기존 백엔드 테스트 70개, 확장 테스트 13개는 계속 통과해야 한다
- `apps/extension/entrypoints/background.ts`의 상태 기계(`chrome.storage.session`, `enqueue`, `byteSize`)는 건드리지 않는다
- 브라우저 의존 태스크(3·4·5·6)는 자동 테스트 없이 수동 검증으로 완료를 본다
- 대상 API·Azure 호출은 최소로 한다. 둘 다 실제 과금·실제 공공 서버다

## 파일 구조

| 파일 | 책임 | 상태 |
|---|---|---|
| `apps/backend/app/routers/sessions.py` | 프로젝트·세션 CRUD | 수정 |
| `apps/backend/app/routers/actions.py` | 액션 CRUD | 수정 |
| `apps/admin/src/styles/app.css` | 디자인 언어 전체 | 신설 |
| `apps/admin/src/components/Shell.tsx` | 사이드바 + 상단바 + 본문 배치 | 신설 |
| `apps/admin/src/components/Stepper.tsx` | 5단계 진행 표시 | 신설 |
| `apps/admin/src/components/Toast.tsx` | 조작 성공 알림 | 신설 |
| `apps/admin/src/pages/ProjectList.tsx` | `/` | 신설 |
| `apps/admin/src/pages/SessionList.tsx` | `/projects/:id` | 신설 |
| `apps/admin/src/pages/ActionList.tsx` | `/projects/:id/actions` | 신설 |
| `apps/admin/src/pages/SessionDetail.tsx` | `/sessions/:id` | 재스타일 |
| `apps/admin/src/pages/ActionEdit.tsx` | `/actions/:id`, `/actions/new` | 재스타일 + 단건 로드 |
| `apps/admin/src/pages/LlmConsole.tsx` | `/projects/:id/console` | 재스타일 + 경로 이동 |
| `apps/admin/src/App.tsx` | 라우트 | 수정 |
| `apps/admin/src/api/client.ts` | HTTP 래퍼 | 수정 (DELETE 추가) |
| `apps/extension/entrypoints/sidepanel/App.tsx` | 사이드 패널 | 수정 |

## 라우트 최종형

| 라우트 | 화면 | 브레드크럼 |
|---|---|---|
| `/` | 프로젝트 목록 | `Projects` |
| `/projects/:id` | 기록 세션 목록 | `Projects / 국토교통부 실거래가` |
| `/projects/:id/actions` | 액션 목록 | `Projects / 국토교통부 실거래가 / 액션` |
| `/projects/:id/console` | 테스트 콘솔 | `Projects / 국토교통부 실거래가 / 테스트 콘솔` |
| `/sessions/:id` | 후보 분석 | `Projects / 국토교통부 실거래가 / 세션 #3` |
| `/actions/:id` | 액션 편집 | `Projects / 국토교통부 실거래가 / 아파트 단지 마커 조회` |
| `/actions/new?requestId=N` | 생성 후 `/actions/:id`로 replace | — |

---

## Task 1: 백엔드 조회 엔드포인트 3개

**Files:**
- Modify: `apps/backend/app/routers/sessions.py`
- Modify: `apps/backend/app/routers/actions.py`
- Test: `apps/backend/tests/test_sessions.py`, `apps/backend/tests/test_actions.py`

**Interfaces:**
- Consumes: 기존 모델 `Project`, `RecordingSession`, `NetworkRequest`, `Action` (`apps/backend/app/models.py`)
- Produces:
  - `GET /api/recording-sessions/{id}` → `{id, projectId, projectName, startedAt, endedAt, status}`
  - `GET /api/projects/{id}/recording-sessions` → `[{id, startedAt, endedAt, status, requestCount, topScore}]`
  - `GET /api/actions/{id}` → `{id, projectId, name, toolName, description, actionSpec, status}`

`topScore`는 그 세션 요청 중 최고 점수이고, 채점 전이거나 요청이 없으면 `null`이다. 0으로 내리면 "점수 0점"과 구분되지 않는다. 점수는 `/candidates`를 호출해야 채워지므로, 분석 전 세션의 `topScore`가 `null`인 것은 정상이다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`apps/backend/tests/test_sessions.py` 끝에 추가:

```python
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
```

`apps/backend/tests/test_actions.py` 끝에 추가:

```python
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
    assert res.json()["detail"] == "해당 액션을 찾을 수 없습니다"
```

`network_request_id` 픽스처가 `apps/backend/tests/conftest.py`에 없으면 아래를 추가한다:

```python
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
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `cd apps/backend && .venv/bin/pytest tests/test_sessions.py tests/test_actions.py -v`
Expected: 새 테스트 6개가 404 또는 KeyError로 FAIL

- [ ] **Step 3: 세션 엔드포인트 두 개를 구현한다**

`apps/backend/app/routers/sessions.py`의 `list_projects` 아래에 추가:

```python
@router.get("/api/recording-sessions/{session_id}")
def get_recording_session(session_id: int, db: Session = Depends(get_session)) -> dict:
    """브레드크럼이 프로젝트 이름을 필요로 한다.

    /candidates는 요청 목록만 돌려주고 프로젝트 정보가 없다. 이미 리뷰를
    통과한 그 응답 형태를 바꾸는 대신 단건 조회를 따로 둔다.
    """
    row = db.get(RecordingSession, session_id)
    if row is None:
        raise HTTPException(404, "해당 기록 세션을 찾을 수 없습니다")

    project = db.get(Project, row.project_id)
    return {
        "id": row.id,
        "projectId": row.project_id,
        "projectName": project.name if project is not None else "",
        "startedAt": row.started_at,
        "endedAt": row.ended_at,
        "status": row.status,
    }

@router.get("/api/projects/{project_id}/recording-sessions")
def list_recording_sessions(project_id: int, db: Session = Depends(get_session)) -> list:
    """최근 세션이 위로 오게 내림차순으로 준다."""
    rows = db.exec(
        select(RecordingSession)
        .where(RecordingSession.project_id == project_id)
        .order_by(RecordingSession.id.desc())
    ).all()

    result = []
    for row in rows:
        requests = db.exec(
            select(NetworkRequest).where(NetworkRequest.session_id == row.id)
        ).all()
        scores = [r.score for r in requests if r.score is not None]
        result.append({
            "id": row.id,
            "startedAt": row.started_at,
            "endedAt": row.ended_at,
            "status": row.status,
            "requestCount": len(requests),
            # 채점 전과 0점을 구분해야 한다. 점수는 /candidates를 부를 때 채워진다.
            "topScore": max(scores) if scores else None,
        })
    return result
```

- [ ] **Step 4: 액션 단건 조회를 구현한다**

`apps/backend/app/routers/actions.py`의 `list_actions` 위에 추가:

```python
@router.get("/api/actions/{action_id}")
def get_action(action_id: int, db: Session = Depends(get_session)) -> dict:
    action = db.get(Action, action_id)
    if action is None:
        raise HTTPException(404, "해당 액션을 찾을 수 없습니다")
    return {
        "id": action.id,
        "projectId": action.project_id,
        "name": action.name,
        "toolName": action.tool_name,
        "description": action.description,
        "actionSpec": action.action_spec,
        "status": action.status,
    }
```

- [ ] **Step 5: 전체 테스트를 돌린다**

Run: `cd apps/backend && .venv/bin/pytest tests/ -v`
Expected: 76 passed (기존 70 + 신규 6)

- [ ] **Step 6: 커밋**

```bash
git add apps/backend/app/routers/sessions.py apps/backend/app/routers/actions.py \
        apps/backend/tests/test_sessions.py apps/backend/tests/test_actions.py \
        apps/backend/tests/conftest.py
git commit -m "세션 단건·세션 목록·액션 단건 조회 엔드포인트 추가"
```

---

## Task 2: 백엔드 삭제 엔드포인트 2개

**Files:**
- Modify: `apps/backend/app/routers/sessions.py`
- Modify: `apps/backend/app/routers/actions.py`
- Test: `apps/backend/tests/test_sessions.py`, `apps/backend/tests/test_actions.py`

**Interfaces:**
- Consumes: Task 1의 `GET /api/recording-sessions/{id}`, `GET /api/actions/{id}`
- Produces: `DELETE /api/recording-sessions/{id}` → `{"ok": true}`, `DELETE /api/actions/{id}` → `{"ok": true}`

세션을 지우면 자식 행(`InteractionEvent`, `NetworkRequest`)도 함께 지운다. SQLite에 ON DELETE CASCADE를 걸지 않았으므로 라우터에서 명시적으로 지운다. **액션은 함께 지우지 않는다** — `Action`은 네트워크 요청을 참조하지 않고 `action_spec`에 값을 복사해 두므로, 세션을 지워도 액션은 그대로 실행된다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`apps/backend/tests/test_sessions.py` 끝에 추가:

```python
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
```

`apps/backend/tests/test_actions.py` 끝에 추가:

```python
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
    assert res.json()["detail"] == "해당 액션을 찾을 수 없습니다"
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `cd apps/backend && .venv/bin/pytest tests/test_sessions.py tests/test_actions.py -v`
Expected: 새 테스트 5개가 405 Method Not Allowed로 FAIL

- [ ] **Step 3: 세션 삭제를 구현한다**

`apps/backend/app/routers/sessions.py` 끝에 추가:

```python
@router.delete("/api/recording-sessions/{session_id}")
def delete_recording_session(session_id: int, db: Session = Depends(get_session)) -> dict:
    """세션과 그 자식 행을 지운다.

    SQLite에 ON DELETE CASCADE를 걸지 않았으므로 여기서 명시적으로 지운다.
    액션은 지우지 않는다 - Action은 네트워크 요청을 참조하지 않고
    action_spec에 값을 복사해 두므로 세션이 사라져도 그대로 실행된다.
    """
    row = db.get(RecordingSession, session_id)
    if row is None:
        raise HTTPException(404, "해당 기록 세션을 찾을 수 없습니다")

    for child in db.exec(
        select(NetworkRequest).where(NetworkRequest.session_id == session_id)
    ).all():
        db.delete(child)
    for child in db.exec(
        select(InteractionEvent).where(InteractionEvent.session_id == session_id)
    ).all():
        db.delete(child)

    db.delete(row)
    db.commit()
    return {"ok": True}
```

- [ ] **Step 4: 액션 삭제를 구현한다**

`apps/backend/app/routers/actions.py` 끝에 추가:

```python
@router.delete("/api/actions/{action_id}")
def delete_action(action_id: int, db: Session = Depends(get_session)) -> dict:
    action = db.get(Action, action_id)
    if action is None:
        raise HTTPException(404, "해당 액션을 찾을 수 없습니다")
    db.delete(action)
    db.commit()
    return {"ok": True}
```

- [ ] **Step 5: 전체 테스트를 돌린다**

Run: `cd apps/backend && .venv/bin/pytest tests/ -v`
Expected: 81 passed

- [ ] **Step 6: 커밋**

```bash
git add apps/backend/app/routers/sessions.py apps/backend/app/routers/actions.py \
        apps/backend/tests/test_sessions.py apps/backend/tests/test_actions.py
git commit -m "세션·액션 삭제 엔드포인트 추가

세션 삭제는 자식 행을 함께 지우되 액션은 남긴다. 액션은 요청을
참조하지 않고 스펙에 값을 복사해 두므로 세션이 사라져도 실행된다."
```

---

## Task 3: 디자인 언어 이식과 셸

**Files:**
- Create: `apps/admin/src/styles/app.css`
- Create: `apps/admin/src/components/Shell.tsx`
- Create: `apps/admin/src/components/Stepper.tsx`
- Create: `apps/admin/src/components/Toast.tsx`
- Modify: `apps/admin/src/main.tsx` (CSS import)
- Modify: `apps/admin/src/api/client.ts` (DELETE 추가)

**Interfaces:**
- Produces:
  - `<Shell breadcrumb={["Projects", "국토교통부 실거래가"]} projectId={1}>{children}</Shell>`
  - `<Stepper current={2} />` — 0부터 시작하는 인덱스
  - `useToast()` → `{ toast, showToast }`; `<Toast message={toast} />`
  - `api.delete(path)`

이 태스크는 화면을 바꾸지 않는다. 컴포넌트만 만들고 다음 태스크에서 쓴다. 검증은 `npx tsc --noEmit`과 dev 서버가 뜨는 것으로 본다.

- [ ] **Step 1: CSS를 이식한다**

`/Users/HeungbaeLee/Downloads/mcp-flow-studio-source/app/globals.css`를 `apps/admin/src/styles/app.css`로 복사한 뒤 **두 곳만** 고친다.

1. 첫 줄 `@import "tailwindcss";`를 **지운다.** 목업은 유틸리티 클래스를 쓰지 않고 94개 클래스를 전부 손으로 썼으므로 이 import는 장식이며 의존성만 늘린다.
2. `body`의 `font-family`를 아래로 교체한다. 목업이 부르는 Inter·Pretendard·Noto Sans KR은 저장소에 없어 macOS에서 시스템 폴백으로 떨어진다. 웹폰트 파일을 추가하는 대신 macOS 한글 스택을 앞에 둔다.

```css
body {
  margin: 0;
  background: #f7f8fa;
  color: var(--ink);
  /* macOS 한글 스택을 앞에 둔다. Inter·Pretendard·Noto Sans KR은 저장소에
     없어 그대로 두면 시스템 폴백으로 떨어져 촬영 화면에서 한글이 흐려진다. */
  font-family: -apple-system, "Apple SD Gothic Neo", Pretendard, "Noto Sans KR",
               system-ui, sans-serif;
}
```

파일 끝에 빈 상태용 클래스를 덧붙인다. 목업은 데이터가 항상 있다고 가정해 빈 상태 디자인이 없다.

```css
/* 빈 상태 - 촬영이 DB 삭제로 시작하므로 카메라의 첫 장면이 여기다 */
.empty-state { padding: 56px 24px; text-align: center; color: var(--muted); background: #fff; border: 1px dashed var(--line); border-radius: 10px; }
.empty-state strong { display: block; margin-bottom: 6px; color: var(--ink); font-size: 14px; }
.empty-state p { margin: 0; font-size: 12px; line-height: 1.6; }

/* 인라인 삭제 확인 - window.confirm은 자동화를 막고 촬영 화면에서 튄다 */
.confirm-inline { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #b91c1c; }
.confirm-inline button { border: 1px solid var(--line); border-radius: 5px; background: #fff; padding: 3px 9px; font-size: 12px; }
.confirm-inline button.danger { border-color: #f0c2c2; background: #fef2f2; color: #b91c1c; }

/* 오류 배너 */
.error-banner { margin: 16px 0; padding: 12px 14px; border: 1px solid #dc2626; background: #fef2f2; border-radius: 8px; }
.error-banner strong { display: block; color: #b91c1c; font-size: 13px; }
.error-banner p { margin: 4px 0 0; font-size: 12px; color: #7f1d1d; }
```

`apps/admin/src/main.tsx`에서 CSS를 불러온다. 기존 `index.css` import 바로 아래에 넣는다.

```tsx
import "./styles/app.css";
```

- [ ] **Step 2: client.ts에 DELETE를 더한다**

`apps/admin/src/api/client.ts` 맨 아래 `api` 객체를 아래로 교체한다.

```ts
export const api = {
  get: (path: string) => request("GET", path),
  post: (path: string, body?: unknown) => request("POST", path, body),
  put: (path: string, body?: unknown) => request("PUT", path, body),
  delete: (path: string) => request("DELETE", path),
};
```

- [ ] **Step 3: Shell 컴포넌트를 만든다**

`apps/admin/src/components/Shell.tsx`:

```tsx
import { Link, useLocation } from "react-router-dom";

type Props = {
  breadcrumb: string[];
  projectId?: number | null;
  children: React.ReactNode;
};

/**
 * 사이드바는 순수 내비게이션이고 스테퍼는 세션 컨텍스트 안의 진행 표시다.
 * 목업은 둘을 사이드바 하나로 합쳤는데, 세션이 여러 개 쌓이면 "현재 단계"가
 * 무엇을 가리키는지 모호해지므로 분리한다.
 *
 * projectId가 없으면 2~4번 항목은 갈 곳이 없으므로 비활성으로 둔다.
 */
export default function Shell({ breadcrumb, projectId, children }: Props) {
  const { pathname } = useLocation();

  const items: { label: string; number: string; to: string | null }[] = [
    { label: "프로젝트", number: "01", to: "/" },
    { label: "기록 세션", number: "02", to: projectId ? `/projects/${projectId}` : null },
    { label: "액션", number: "03", to: projectId ? `/projects/${projectId}/actions` : null },
    { label: "테스트 콘솔", number: "04", to: projectId ? `/projects/${projectId}/console` : null },
  ];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <span>MCP Studio</span>
        </div>
        <nav>
          {items.map((item) =>
            item.to === null ? (
              <span className="nav-item" key={item.label} style={{ opacity: 0.4 }}>
                <span className="nav-number">{item.number}</span>
                {item.label}
              </span>
            ) : (
              <Link
                to={item.to}
                key={item.label}
                className={pathname === item.to ? "nav-item active" : "nav-item"}
              >
                <span className="nav-number">{item.number}</span>
                {item.label}
              </Link>
            ),
          )}
        </nav>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            {breadcrumb.map((crumb, i) => (
              <span key={i}>
                {i > 0 && <span>/</span>}
                {crumb}
              </span>
            ))}
          </div>
        </header>
        <div className="content">{children}</div>
      </section>
    </main>
  );
}
```

**목업 CSS는 `<button>`을 전제한다.** `.nav-item`과 `.table-row`가 그렇다. 우리는 라우팅을 위해 `<a>`(`<Link>`)로 쓰므로 `app.css`의 두 규칙에 `text-decoration: none; color: inherit;`을 더한다. 빠뜨리면 사이드바와 표에 파란 밑줄이 깔린다.

**표 열 개수도 목업과 다르다.** 목업의 `.table-head`/`.table-row`는 4열 고정 그리드다. 우리 표는 프로젝트 2열, 세션 5열, 액션 5열이다. 화면마다 열 수를 덮어쓰도록 `app.css` 끝에 추가한다.

```css
/* 표 열 수는 화면마다 다르다. 목업의 4열 고정 그리드를 덮어쓴다. */
.table-2col .table-head, .table-2col .table-row { grid-template-columns: 1fr 120px; }
.table-5col .table-head, .table-5col .table-row { grid-template-columns: 2fr 100px 120px 120px 180px; }
```

`ProjectList`의 `.project-table`에는 `table-2col`을, `SessionList`·`ActionList`에는 `table-5col`을 함께 준다.

- [ ] **Step 4: Stepper 컴포넌트를 만든다**

`apps/admin/src/components/Stepper.tsx`:

```tsx
// 5단계 중 ①기록 시작과 ②클릭 기록은 확장 프로그램에서 일어나며 관리자
// 화면이 아니다. 세션이 존재한다는 것 자체가 두 단계를 거쳤다는 뜻이므로
// 항상 완료로 표시한다.
const STEPS = ["기록 시작", "클릭 기록", "API 분석", "액션 생성", "테스트"];

export default function Stepper({ current }: { current: number }) {
  return (
    <section className="stepper" aria-label="작업 단계">
      {STEPS.map((label, index) => (
        <div
          key={label}
          className={`${index === current ? "current" : ""} ${index < current ? "done" : ""}`}
        >
          <span>{index < current ? "✓" : index + 1}</span>
          <div>
            <small>STEP {index + 1}</small>
            <strong>{label}</strong>
          </div>
        </div>
      ))}
    </section>
  );
}
```

목업의 `.stepper` 규칙은 자식이 `button`인 것을 전제한다. `app.css`의 `.stepper button` 선택자를 `.stepper > div`로 바꾼다.

- [ ] **Step 5: Toast 컴포넌트를 만든다**

`apps/admin/src/components/Toast.tsx`:

```tsx
import { useCallback, useRef, useState } from "react";

export function useToast() {
  const [toast, setToast] = useState("");
  const timer = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setToast(message);
    // 이전 타이머를 지우지 않으면 연달아 호출했을 때 먼저 잡힌 타이머가
    // 나중 메시지를 조기에 지운다.
    timer.current = window.setTimeout(() => setToast(""), 2200);
  }, []);

  return { toast, showToast };
}

export default function Toast({ message }: { message: string }) {
  if (!message) return null;
  return <div className="toast">{message}</div>;
}
```

- [ ] **Step 6: 타입체크와 dev 서버를 확인한다**

Run: `cd apps/admin && npx tsc --noEmit`
Expected: exit 0

Run: `cd apps/admin && npm run dev`
Expected: 오류 없이 뜨고 기존 화면이 그대로 동작한다 (아직 셸을 안 썼으므로 외형 변화 없음)

- [ ] **Step 7: 커밋**

```bash
git add apps/admin/src/styles/app.css apps/admin/src/components/ \
        apps/admin/src/main.tsx apps/admin/src/api/client.ts
git commit -m "디자인 언어 이식과 셸 컴포넌트 추가

외부 목업에서 CSS 변수와 클래스만 가져왔다. tailwind import는 제거했다 -
목업은 유틸리티 클래스를 쓰지 않고 94개 클래스를 전부 손으로 썼다.
폰트는 macOS 한글 스택을 앞에 둔다. 목업이 부르는 세 폰트가 저장소에 없다."
```

---

## Task 4: 프로젝트 목록과 세션 목록

**Files:**
- Create: `apps/admin/src/pages/ProjectList.tsx`
- Create: `apps/admin/src/pages/SessionList.tsx`
- Modify: `apps/admin/src/App.tsx`

**Interfaces:**
- Consumes: Task 1의 `GET /api/projects/{id}/recording-sessions`, Task 2의 `DELETE /api/recording-sessions/{id}`, Task 3의 `Shell`·`useToast`·`Toast`·`api.delete`
- Produces: 라우트 `/`, `/projects/:id`

- [ ] **Step 1: 프로젝트 목록 화면을 만든다**

`apps/admin/src/pages/ProjectList.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";

type Project = { id: number; name: string };

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/api/projects")
      .then(setProjects)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <Shell breadcrumb={["Projects"]}>
      <section className="heading-row">
        <div>
          <p className="eyebrow">WEB ACTION MCP BUILDER</p>
          <h1>프로젝트</h1>
          <p className="subtitle">확장 프로그램에서 기록한 내용이 프로젝트별로 모입니다.</p>
        </div>
      </section>

      {error && (
        <div className="error-banner">
          <strong>목록을 불러오지 못했습니다</strong>
          <p>{error}</p>
        </div>
      )}

      {projects !== null && projects.length === 0 && (
        <div className="empty-state">
          <strong>아직 프로젝트가 없습니다</strong>
          <p>
            확장 프로그램 사이드 패널에서 프로젝트 이름을 입력하고
            <br />
            기록을 시작하면 여기에 나타납니다.
          </p>
        </div>
      )}

      {projects !== null && projects.length > 0 && (
        <article className="panel recent-projects">
          <div className="project-table">
            <div className="table-head">
              <span>프로젝트</span>
              <span>ID</span>
            </div>
            {projects.map((project, i) => (
              <Link className="table-row" to={`/projects/${project.id}`} key={project.id}>
                <span>
                  <i className={`project-icon icon-${i % 3}`}>{String(i + 1).padStart(2, "0")}</i>
                  <b>{project.name}</b>
                </span>
                <span className="mono">#{project.id}</span>
              </Link>
            ))}
          </div>
        </article>
      )}
    </Shell>
  );
}
```

- [ ] **Step 2: 세션 목록 화면을 만든다**

`apps/admin/src/pages/SessionList.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Toast, { useToast } from "../components/Toast";

type SessionRow = {
  id: number;
  startedAt: string;
  endedAt: string | null;
  status: string;
  requestCount: number;
  topScore: number | null;
};

function formatTime(value: string | null): string {
  if (!value) return "-";
  // 백엔드는 naive UTC로 돌려준다. 화면에는 초까지만 보여준다.
  return value.replace("T", " ").slice(0, 19);
}

export default function SessionList() {
  const { id } = useParams();
  const projectId = Number(id);
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const { toast, showToast } = useToast();

  const load = useCallback(() => {
    api.get(`/api/projects/${projectId}/recording-sessions`)
      .then(setRows)
      .catch((err) => setError(errorMessage(err)));
  }, [projectId]);

  useEffect(() => {
    api.get("/api/projects")
      .then((list: { id: number; name: string }[]) => {
        const found = list.find((p) => p.id === projectId);
        setProjectName(found ? found.name : `#${projectId}`);
      })
      .catch((err) => setError(errorMessage(err)));
    load();
  }, [projectId, load]);

  async function remove(sessionId: number) {
    setConfirming(null);
    try {
      await api.delete(`/api/recording-sessions/${sessionId}`);
      showToast(`세션 #${sessionId}을 지웠습니다`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Shell breadcrumb={["Projects", projectName]} projectId={projectId}>
      <section className="heading-row">
        <div>
          <p className="eyebrow">RECORDING SESSIONS</p>
          <h1>기록 세션</h1>
          <p className="subtitle">확장 프로그램에서 전송한 클릭과 API 호출입니다.</p>
        </div>
      </section>

      {error && (
        <div className="error-banner">
          <strong>요청을 처리하지 못했습니다</strong>
          <p>{error}</p>
        </div>
      )}

      {rows !== null && rows.length === 0 && (
        <div className="empty-state">
          <strong>기록된 세션이 없습니다</strong>
          <p>확장 프로그램 사이드 패널에서 기록을 시작해 보세요.</p>
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <article className="panel">
          <div className="project-table">
            <div className="table-head">
              <span>세션</span>
              <span>요청</span>
              <span>최고 점수</span>
              <span>상태</span>
              <span />
            </div>
            {rows.map((row) => (
              <div className="table-row" key={row.id}>
                <span>
                  <Link to={`/sessions/${row.id}`}>
                    <b>세션 #{row.id}</b>
                  </Link>
                  <small>{formatTime(row.startedAt)}</small>
                </span>
                <span className="mono">{row.requestCount}건</span>
                <span className="mono">
                  {row.topScore === null ? "분석 전" : `★ ${row.topScore}`}
                </span>
                <span>{row.status}</span>
                <span>
                  {confirming === row.id ? (
                    <span className="confirm-inline">
                      정말 지울까요?
                      <button className="danger" onClick={() => remove(row.id)}>지우기</button>
                      <button onClick={() => setConfirming(null)}>취소</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirming(row.id)}>삭제</button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </article>
      )}

      <Toast message={toast} />
    </Shell>
  );
}
```

- [ ] **Step 3: 라우트를 연결한다**

`apps/admin/src/App.tsx`의 `<Routes>` 안을 아래로 교체한다. 나머지 라우트는 Task 5에서 마저 옮긴다.

```tsx
<Route path="/" element={<ProjectList />} />
<Route path="/projects/:id" element={<SessionList />} />
<Route path="/sessions/:id" element={<SessionDetail />} />
<Route path="/actions/new" element={<ActionEdit />} />
<Route path="/console" element={<LlmConsole />} />
```

import도 함께 추가한다.

```tsx
import ProjectList from "./pages/ProjectList";
import SessionList from "./pages/SessionList";
```

- [ ] **Step 4: 타입체크**

Run: `cd apps/admin && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 5: 브라우저로 확인한다 (수동)**

백엔드(`:8000`)와 admin(`:5173`)이 떠 있어야 한다. 백엔드를 재시작할 때는 `lsof -ti :8000 | xargs kill`을 쓴다 — pid 파일이 낡아 낡은 프로세스가 옛 코드를 서빙한다.

1. `http://localhost:5173/` — 프로젝트가 사이드바와 함께 표로 뜬다
2. 프로젝트를 눌러 `/projects/:id` — 세션 목록이 뜨고 브레드크럼이 `Projects / <이름>`이다
3. **빈 상태를 확인한다.** 세션을 전부 지워 "기록된 세션이 없습니다"가 뜨는 것을 눈으로 본다. 촬영이 DB 삭제로 시작하므로 이것이 카메라의 첫 장면이다
4. 삭제 → "정말 지울까요?"가 같은 행에 펼쳐지고, 지우면 토스트가 뜬 뒤 목록이 갱신된다
5. 브라우저 모달이 뜨지 않는 것을 확인한다

- [ ] **Step 6: 커밋**

```bash
git add apps/admin/src/pages/ProjectList.tsx apps/admin/src/pages/SessionList.tsx \
        apps/admin/src/App.tsx
git commit -m "프로젝트 목록과 세션 목록 화면 추가

빈 상태 문구를 함께 넣는다. 촬영 절차가 DB 삭제로 시작하므로
카메라가 처음 보는 화면이 빈 목록이다."
```

---

## Task 5: 액션 목록과 기존 세 화면 이전

**Files:**
- Create: `apps/admin/src/pages/ActionList.tsx`
- Modify: `apps/admin/src/pages/SessionDetail.tsx`
- Modify: `apps/admin/src/pages/ActionEdit.tsx`
- Modify: `apps/admin/src/pages/LlmConsole.tsx`
- Modify: `apps/admin/src/App.tsx`

**Interfaces:**
- Consumes: Task 1의 `GET /api/recording-sessions/{id}`·`GET /api/actions/{id}`, Task 2의 `DELETE /api/actions/{id}`, Task 3의 셸
- Produces: 라우트 `/projects/:id/actions`, `/actions/:id`, `/projects/:id/console`

- [ ] **Step 1: 액션 목록 화면을 만든다**

`apps/admin/src/pages/ActionList.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Toast, { useToast } from "../components/Toast";

type ActionRow = {
  id: number;
  name: string;
  toolName: string;
  description: string;
  status: string;
  actionSpec: any;
};

function paramCount(spec: any): number {
  const request = spec?.request ?? {};
  const schema = request.bodySchema ?? request.querySchema ?? {};
  return Object.keys(schema).length;
}

export default function ActionList() {
  const { id } = useParams();
  const projectId = Number(id);
  const [rows, setRows] = useState<ActionRow[] | null>(null);
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const { toast, showToast } = useToast();

  const load = useCallback(() => {
    api.get(`/api/projects/${projectId}/actions`)
      .then(setRows)
      .catch((err) => setError(errorMessage(err)));
  }, [projectId]);

  useEffect(() => {
    api.get("/api/projects")
      .then((list: { id: number; name: string }[]) => {
        const found = list.find((p) => p.id === projectId);
        setProjectName(found ? found.name : `#${projectId}`);
      })
      .catch((err) => setError(errorMessage(err)));
    load();
  }, [projectId, load]);

  async function toggle(row: ActionRow) {
    const next = row.status === "ACTIVE" ? "DRAFT" : "ACTIVE";
    try {
      await api.put(`/api/actions/${row.id}`, { status: next });
      showToast(next === "ACTIVE" ? "액션을 활성화했습니다" : "액션을 초안으로 되돌렸습니다");
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(actionId: number) {
    setConfirming(null);
    try {
      await api.delete(`/api/actions/${actionId}`);
      showToast("액션을 지웠습니다");
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Shell breadcrumb={["Projects", projectName, "액션"]} projectId={projectId}>
      <section className="heading-row">
        <div>
          <p className="eyebrow">TOOL DEFINITIONS</p>
          <h1>액션</h1>
          <p className="subtitle">
            테스트 콘솔에는 ACTIVE 상태인 액션만 노출됩니다.
          </p>
        </div>
      </section>

      {error && (
        <div className="error-banner">
          <strong>요청을 처리하지 못했습니다</strong>
          <p>{error}</p>
        </div>
      )}

      {rows !== null && rows.length === 0 && (
        <div className="empty-state">
          <strong>만들어진 액션이 없습니다</strong>
          <p>기록 세션에서 API 후보를 골라 액션을 만들 수 있습니다.</p>
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <article className="panel">
          <div className="project-table">
            <div className="table-head">
              <span>액션</span>
              <span>Tool 이름</span>
              <span>파라미터</span>
              <span>상태</span>
              <span />
            </div>
            {rows.map((row) => (
              <div className="table-row" key={row.id}>
                <span>
                  <Link to={`/actions/${row.id}`}><b>{row.name}</b></Link>
                  <small>{row.description}</small>
                </span>
                <span className="mono">{row.toolName}</span>
                <span className="mono">{paramCount(row.actionSpec)}개</span>
                <span>
                  <button onClick={() => toggle(row)}>{row.status}</button>
                </span>
                <span>
                  {confirming === row.id ? (
                    <span className="confirm-inline">
                      정말 지울까요?
                      <button className="danger" onClick={() => remove(row.id)}>지우기</button>
                      <button onClick={() => setConfirming(null)}>취소</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirming(row.id)}>삭제</button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </article>
      )}

      <Toast message={toast} />
    </Shell>
  );
}
```

- [ ] **Step 2: SessionDetail을 셸 안으로 옮긴다**

`apps/admin/src/pages/SessionDetail.tsx`를 다음과 같이 고친다. 표와 점수 표기는 그대로 두고 감싸는 껍데기와 클래스만 바꾼다.

1. `GET /api/recording-sessions/{id}`를 함께 불러 `projectId`와 `projectName`을 얻는다.
2. 최상위를 `<Shell breadcrumb={["Projects", projectName, \`세션 #${id}\`]} projectId={projectId}>`로 감싼다.
3. `Shell` 바로 안, 제목 아래에 `<Stepper current={2} />`를 넣는다.
4. 인라인 `style` 객체를 클래스로 바꾼다: 바깥 `div` → `panel`, 표 → `project-table`, 머리행 → `table-head`, 각 행 → `table-row`.
5. 점수 표기 `★ 9`와 추천 사유 문자열은 **그대로 둔다.** 이미 카메라 앞에서 검증된 표기이고, 백분율로 환산하면 근거 없는 정밀도를 만든다.
6. `액션 만들기` 버튼에 `primary` 클래스를 준다. 비활성 조건(로그 API)은 그대로 둔다.

- [ ] **Step 3: ActionEdit을 단건 로드로 바꾼다**

`apps/admin/src/pages/ActionEdit.tsx`를 고친다.

불러오기와 생성 분기는 새 로직이므로 코드를 그대로 쓴다. 기존 `useEffect`를 아래로 교체한다.

```tsx
const { id } = useParams();
const [params] = useSearchParams();
const navigate = useNavigate();

// React 18 StrictMode는 개발 모드에서 effect를 두 번 실행한다. 이 가드가
// 없으면 POST가 두 번 나가 Action이 두 개 생긴다.
const requested = useRef(false);

useEffect(() => {
  // 1) /actions/:id — 이미 만들어진 액션을 읽기만 한다. POST하지 않는다.
  if (id) {
    api.get(`/api/actions/${id}`)
      .then((row) => {
        setActionId(row.id);
        setProjectId(row.projectId);
        setSpec(row.actionSpec);
        setName(row.name);
        setToolName(row.toolName);
        setDescription(row.description);
        setStatus(row.status);
      })
      .catch((err) => setError(errorMessage(err)));
    return;
  }

  // 2) /actions/new?requestId=N — 한 번만 만들고 곧바로 /actions/:id로 옮긴다.
  //    주소가 바뀌므로 새로고침해도 다시 만들어지지 않는다.
  const requestId = params.get("requestId");
  if (!requestId || requested.current) return;
  requested.current = true;

  api.post("/api/actions", { networkRequestId: Number(requestId), name, toolName, description })
    .then((res) => navigate(`/actions/${res.id}`, { replace: true }))
    .catch((err) => setError(errorMessage(err)));
}, [id, params, navigate, name, toolName, description]);
```

`status` 상태를 새로 둔다(`useState("DRAFT")`). 화면에 상태 배지를 띄우고, 활성화 버튼이 `PUT /api/actions/{id}`로 `{status: "ACTIVE"}`를 보낸 뒤 `setStatus("ACTIVE")` 한다.

프로젝트 이름은 `GET /api/projects`에서 `projectId`로 찾는다.
4. 최상위를 `<Shell breadcrumb={["Projects", projectName, name]} projectId={projectId}>`로 감싸고 `<Stepper current={3} />`를 넣는다.
5. 폼은 목업의 `builder-layout` / `builder-form` / `form-grid` / `schema-row` 클래스를 쓴다. 파라미터 표는 `schema-row`를 한 줄씩 반복한다.
6. 오른쪽에 `code-preview` 패널을 두고 `actionSpec`을 `JSON.stringify(spec, null, 2)`로 보여준다.
7. 아래에 **보안 패널**을 둔다. 문구는 지어내지 말고 실제 상수를 렌더한다:

```tsx
const MASKED_KEYS = ["password", "token", "apiKey", "sessionId", "ssn", "jumin", "cardNumber", "cvv"];

<div className="security-callout">
  <strong>민감정보 마스킹 {MASKED_KEYS.length} rules</strong>
  <p>{MASKED_KEYS.join(" · ")}</p>
  <p>URL 쿼리 · 요청 본문 · 응답 샘플 세 곳에 적용됩니다.</p>
</div>
```

이 목록은 `apps/backend/app/services/masking.py`의 `SENSITIVE_KEYS`와 같아야 한다. 값을 바꿀 때 두 곳을 함께 고친다.

- [ ] **Step 4: LlmConsole을 프로젝트 경로 아래로 옮긴다**

`apps/admin/src/pages/LlmConsole.tsx`를 고친다.

1. `useParams()`의 `id`를 `projectId`로 쓴다. **직전에 넣은 프로젝트 드롭다운(`projects` 상태와 `<select>`)은 제거한다** — 경로가 프로젝트를 결정한다.
2. `POST /api/projects/${projectId}/llm-test`는 그대로 둔다.
3. 프로젝트 이름은 `GET /api/projects`에서 찾아 브레드크럼에 쓴다.
4. 최상위를 `<Shell breadcrumb={["Projects", projectName, "테스트 콘솔"]} projectId={projectId}>`로 감싸고 `<Stepper current={4} />`를 넣는다.
5. **오류 배너 동작은 그대로 유지한다.** `ask()`/`run()`이 오류를 붙잡아 `errorMessage(err)`를 한국어로 띄우고, 실패한 단계의 낡은 결과를 지우는 동작이 있다. 백엔드가 꺼져 있을 때 "요청을 처리하지 못했습니다 / Failed to fetch"가 뜨는 것이 촬영 당일 가장 흔한 실수를 잡아준다.
6. 결과 패널은 목업의 `test-layout` / `metric-grid` 클래스를 쓴다. 지표는 실제 값만 넣는다 — `HTTP {status}`, `{elapsedMs}ms`, `counts`의 항목 수.
7. 인자 JSON 블록의 `textAlign: "left"`를 유지한다. 상위 레이아웃의 가운데 정렬을 물려받으면 읽기 어렵다.

- [ ] **Step 5: 라우트를 마무리한다**

`apps/admin/src/App.tsx`의 `<Routes>`를 아래로 교체한다.

```tsx
<Route path="/" element={<ProjectList />} />
<Route path="/projects/:id" element={<SessionList />} />
<Route path="/projects/:id/actions" element={<ActionList />} />
<Route path="/projects/:id/console" element={<LlmConsole />} />
<Route path="/sessions/:id" element={<SessionDetail />} />
<Route path="/actions/new" element={<ActionEdit />} />
<Route path="/actions/:id" element={<ActionEdit />} />
```

`/actions/new`가 `/actions/:id`보다 **먼저** 와야 한다. 순서가 바뀌면 `new`가 `:id`로 잡혀 `Number("new")`가 `NaN`이 된다.

- [ ] **Step 6: 타입체크**

Run: `cd apps/admin && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 7: 브라우저로 확인한다 (수동)**

1. `/projects/1/actions` — 액션 목록, 상태 버튼을 눌러 DRAFT ↔ ACTIVE 전환, 토스트 확인
2. 액션을 DRAFT로 바꾼 뒤 `/projects/1/console`에서 질의 → "활성화된 액션이 없습니다"가 배너로 뜬다. 다시 ACTIVE로 돌린다
3. `/sessions/:id` — 표와 점수가 그대로 나오고 스테퍼가 3번째 단계를 가리킨다
4. 세션에서 `액션 만들기` → 주소가 `/actions/:id`로 바뀐다. **새로고침해도 액션이 새로 생기지 않는 것**을 목록 개수로 확인한다
5. `/projects/1/console` — 질의 → 실행까지 전 구간. Azure와 대상 API를 실제로 부르므로 **한 번만** 한다
6. 백엔드를 내린 채 질의 → 오류 배너가 뜨는 것을 확인하고 다시 올린다

- [ ] **Step 8: 커밋**

```bash
git add apps/admin/src/pages/ apps/admin/src/App.tsx
git commit -m "액션 목록 추가, 기존 세 화면을 셸과 계층 경로로 이전

/actions/new 는 생성 후 /actions/:id 로 replace 한다. 생성은 한 번,
이후는 조회다 - 페이지를 열 때마다 Action 행이 생기던 문제가 사라진다.
콘솔의 프로젝트 드롭다운은 경로 파라미터로 대체해 제거했다."
```

---

## Task 6: 확장 프로그램 — 관리자로 넘어가는 길

**Files:**
- Modify: `apps/extension/entrypoints/sidepanel/App.tsx`

**Interfaces:**
- Consumes: `background.ts`의 `stopSession()` 반환값 `{ok, sessionId, interactions, networks}`과 `snapshot()`의 `sessionId`
- Produces: 없음 (화면만)

전송이 성공하면 사이드 패널에 세션 번호와 "관리자에서 열기" 버튼을 띄운다. 지금은 기록을 마친 뒤 세션 번호를 사람이 알아내 URL을 쳐야 하고, 영상에서도 장면 4→5 전환이 여기서 끊긴다.

`background.ts`는 **고치지 않는다.** `stopSession()`이 이미 `sessionId`를 돌려주고 `snapshot()`도 `sessionId`를 싣고 있다.

- [ ] **Step 1: 관리자 주소 상수를 둔다**

`apps/extension/entrypoints/sidepanel/App.tsx` 상단, `LAST_PROJECT_NAME_KEY` 옆에 추가:

```tsx
// 데모 전용. background.ts의 API_BASE와 같은 방식으로 상수에 둔다.
const ADMIN_BASE = "http://localhost:5173";
```

- [ ] **Step 2: 전송 성공 상태를 들고 있는다**

`recording` 상태 옆에 추가하고, 기록 시작 시 지운다.

```tsx
const [finishedSessionId, setFinishedSessionId] = useState<number | null>(null);
```

`기록 시작` 핸들러의 `chrome.storage.local.set(...)` 바로 앞에 `setFinishedSessionId(null);`을 넣는다. 이전 세션 링크가 새 기록 중에 남아 있으면 엉뚱한 세션을 열게 된다.

`기록 종료 및 전송` 핸들러의 콜백을 아래로 교체한다.

```tsx
chrome.runtime.sendMessage({ type: "stop" }, (r) => {
  setRecording(false);
  setError(r?.error ?? null);
  // 전송이 성공했을 때만 링크를 띄운다. 실패하면 관리자에 아무것도 없다.
  setFinishedSessionId(r?.ok ? (r.sessionId ?? null) : null);
})
```

- [ ] **Step 3: 링크를 렌더한다**

오류 배너 바로 아래에 추가한다.

```tsx
{finishedSessionId !== null && (
  <div style={{ marginTop: 10, padding: 10, background: "#eef2ff", borderRadius: 6, fontSize: 12 }}>
    <div style={{ marginBottom: 8 }}>세션 #{finishedSessionId} 전송 완료</div>
    <button
      onClick={() =>
        chrome.tabs.create({ url: `${ADMIN_BASE}/sessions/${finishedSessionId}` })
      }
      style={{ width: "100%", padding: 8, background: "#3157e8", color: "#fff", border: 0, borderRadius: 6 }}
    >
      관리자에서 열기
    </button>
  </div>
)}
```

`chrome.tabs`는 이미 `wxt.config.ts`의 `permissions`에 `tabs`가 있어 쓸 수 있다.

- [ ] **Step 4: 색을 관리자와 맞춘다**

사이드 패널의 인라인 색상을 관리자 CSS 변수와 같은 값으로 바꾼다. 기록 시작 버튼 `#2563eb` → `#3157e8`, 본문 글자색 → `#172033`, 구분선 `#eee` → `#e2e7ef`. 폰트는 `-apple-system, "Apple SD Gothic Neo", system-ui, sans-serif`.

- [ ] **Step 5: 타입체크와 테스트**

Run: `cd apps/extension && npm run compile`
Expected: exit 0

Run: `cd apps/extension && npm test`
Expected: 13 passed

- [ ] **Step 6: 브라우저로 확인한다 (수동)**

```bash
cd apps/extension && npm run build
```

`chrome://extensions`에서 확장을 새로고침한 뒤:

1. 아무 사이트에서 기록 시작 → 클릭 한 번 → 기록 종료 및 전송
2. "세션 #N 전송 완료"와 버튼이 뜬다
3. 버튼을 누르면 새 탭에서 `/sessions/N`이 열리고 그 세션의 후보가 보인다
4. 백엔드를 내린 채 전송하면 링크가 **뜨지 않고** 오류만 뜨는 것을 확인한다

- [ ] **Step 7: 커밋**

```bash
git add apps/extension/entrypoints/sidepanel/App.tsx
git commit -m "전송 후 관리자로 넘어가는 링크 추가

지금까지는 기록을 마친 뒤 세션 번호를 사람이 알아내 URL을 쳐야 했다.
영상에서도 장면 4->5 전환이 여기서 끊겼다."
```

---

## Task 7: 문서와 스크린샷 갱신

**Files:**
- Modify: `docs/demo-script.md`
- Modify: `README.md`
- Modify: `docs/screenshots/scene5-session-detail.png`, `docs/screenshots/scene8-llm-console.png`

**Interfaces:**
- Consumes: Task 4~6의 최종 화면

- [ ] **Step 1: 촬영 대본의 경로를 고친다**

`docs/demo-script.md`에서 아래를 고친다.

- 콘솔 주소 `http://localhost:5173/console` → `http://localhost:5173/projects/1/console`
- 세션 상세로 가는 방법: URL 직접 입력 → **확장의 "관리자에서 열기" 버튼**을 누른다로 바꾼다. 장면 4→5 전환이 이제 화면 안에서 이어진다
- 장면 1 앞에 프로젝트 목록(`/`)을 보여주는 대사를 넣는다. DB 초기화 직후이므로 세션이 비어 있는 상태에서 시작한다
- 액션 편집 주소 `/actions/new?requestId=N` → 생성 후 `/actions/:id`로 바뀐다는 점을 적는다

`§0 DB 초기화` 절차와 `lsof -ti :8000 | xargs kill`은 그대로 둔다.

- [ ] **Step 2: README의 경로를 고친다**

`README.md` §3의 콘솔 주소를 `http://localhost:5173/projects/1/console`로 바꾼다. §4-2의 "세션 번호가 1이 아니면 URL의 숫자를 바꿔 주세요"를 "확장의 **관리자에서 열기** 버튼을 누르면 해당 세션이 바로 열립니다"로 바꾼다.

§5 자동 테스트의 백엔드 개수를 81로 고친다.

- [ ] **Step 3: 스크린샷을 다시 찍는다**

브라우저에서 `/sessions/:id`와 `/projects/1/console`을 열어 각각 저장한다.

```
docs/screenshots/scene5-session-detail.png
docs/screenshots/scene8-llm-console.png
```

찍은 뒤 **파일을 열어 눈으로 확인한다.** 한글이 또렷한지, 사이드바와 스테퍼가 들어갔는지, JSON이 왼쪽 정렬인지 본다.

- [ ] **Step 4: 커밋**

```bash
git add docs/demo-script.md README.md docs/screenshots/
git commit -m "새 화면 구조에 맞춰 대본·README·스크린샷 갱신"
```

---

## 완료 기준

- 백엔드 테스트 81개 통과
- 확장 테스트 13개 통과
- `apps/admin` 타입체크 exit 0, `apps/extension` 타입체크 exit 0
- 브라우저에서 프로젝트 → 세션 → 후보 → 액션 → 콘솔까지 클릭만으로 이동 가능
- 빈 상태 세 곳을 데이터가 없는 상태에서 눈으로 확인
- 확장 "관리자에서 열기"로 해당 세션이 열린다
- 화면에 뜨는 숫자·문구 중 실제 데이터로 뒷받침되지 않는 것이 없다
