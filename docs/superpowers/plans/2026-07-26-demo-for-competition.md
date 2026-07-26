# 대회 제출 영상용 데모 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 국토교통부 실거래가 사이트에서 지도를 클릭하면 API가 실시간으로 기록되고, 그 기록에서 주요 API를 골라 액션으로 만든 뒤, 자연어로 호출해 실제 응답을 받는 전 과정을 영상으로 찍을 수 있는 데모를 만든다.

**Architecture:** Chrome Extension이 Main World에서 `fetch`/`XMLHttpRequest`를 후킹해 클릭 이벤트와 함께 수집하고, FastAPI 백엔드가 이를 저장·점수화·스키마 추론한 뒤, React 관리자 화면에서 액션으로 확정한다. 확정된 액션은 Claude API의 tool use로 노출되어 자연어 질의에 응답한다. MCP 엔드포인트는 만들지 않는다(PRD 5b, 6단계 이월).

**Tech Stack:** WXT + React + TypeScript (Extension) / FastAPI + SQLModel + SQLite (Backend) / React + Vite + TanStack Query (Admin) / Azure OpenAI (`openai` Python SDK)

## Global Constraints

- Python 3.10.11. `match`/`case`는 사용 가능하나 3.11+ 문법(`ExceptionGroup`, `Self` 타입)은 금지.
- Node v25.8.0, npm workspaces. `pnpm`·`uv`·Docker는 사용 불가.
- DB는 SQLite 파일 하나(`apps/backend/data/dev.db`). PostgreSQL은 쓰지 않는다.
- LLM은 **Azure OpenAI**를 사용한다. `openai` 파이썬 SDK의 `AzureOpenAI` 클라이언트로 접근하며, 모델명 자리에는 **배포 이름(deployment name)**을 넣는다. 엔드포인트·키·API 버전·배포명은 모두 환경변수로 읽는다(`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_DEPLOYMENT`). 값을 코드에 적지 않는다.
- 도구 정의는 OpenAI function calling 형식(`{"type": "function", "function": {...}}`)을 쓴다. 인자는 `tool_calls[i].function.arguments`에 **JSON 문자열**로 오므로 `json.loads`로 파싱해야 한다.
- `max_tokens`는 4096.
- 대상 API 호출 시 **호출 간격 최소 1초**. 공공 서버 부하 배려.
- **브라우저 의존 태스크(1, 3, 4, 9, 10, 11, 14)는 자동 테스트 없이 수동 검증만으로 완료로 본다.** `chrome.*` API와 페이지 JS 컨텍스트는 단위 테스트로 재현할 수 없다. 이들 태스크에서 "테스트 없음"은 결함이 아니다. 순수 함수로 분리 가능한 로직(Task 2, 5, 6, 8, 12, 13)은 테스트를 반드시 쓴다.
- 응답 본문은 원문 저장 금지. 구조 + 샘플 1건만(PRD §7.4).
- JSON 여부는 Content-Type이 아니라 **본문 파싱 시도**로 판정(PRD §7.4).
- 실행 시 `User-Agent`·`Referer`·`X-Requested-With`·`Accept`를 재현(PRD §7.7). 없으면 WAF가 400으로 차단한다.

---

## 영상 시나리오 — 모든 태스크는 이 장면 중 하나를 위해 존재한다

| # | 장면 | 필요한 것 |
| --- | --- | --- |
| 1 | Side Panel에서 프로젝트 선택 후 "기록 시작" | Task 4 |
| 2 | 실거래가 지도를 광화문으로 이동 | 대상 사이트 |
| 3 | **Side Panel에 클릭과 API 요청 3건이 실시간으로 쌓임** | Task 1~4 |
| 4 | "기록 종료" → 서버 전송 | Task 5 |
| 5 | 관리자 화면 기록 세션 상세 — 클릭별 API 후보가 점수순 정렬, `accesLog.do`가 최하위 | Task 6~7, 10 |
| 6 | `getMarker.do` 선택 → 액션 편집 화면 | Task 8, 11 |
| 7 | 파라미터 6개가 자동 추론되어 있음. 설명 입력 후 활성화 | Task 8, 11 |
| 8 | LLM 테스트 콘솔에 "광화문 근처 아파트 단지 알려줘" 입력 | Task 12, 14 |
| 9 | 선택된 Tool과 파라미터가 표시됨 → 확인 → 실행 | Task 13~14 |
| 10 | 실제 단지 목록 JSON이 반환되고 요약이 표시됨 | Task 13~14 |

3번과 10번이 영상의 핵심이다. 나머지는 두 장면을 잇는 최소 경로다.

## 진짜로 만드는 것과 생략하는 것

| 영역 | 판단 | 이유 |
| --- | --- | --- |
| Extension 기록 (hook, 선택자, 마스킹) | **진짜** | 장면 3. 제품의 핵심 차별점 |
| 수집 데이터 서버 저장 | **진짜** | 장면 5에 띄울 데이터가 있어야 함 |
| 점수 계산 (§7.6) | **진짜** | 장면 5. 알고리즘이 단순 |
| 파라미터·응답 스키마 추론 | **진짜** | 장면 7 |
| 실행 게이트웨이 | **진짜** | 장면 10. curl로 이미 검증됨 |
| LLM Tool 선택·실행 | **진짜** | 장면 8~10 |
| 프로젝트 CRUD | 시드 1건 고정 | 영상에 안 나옴 |
| 로그인·권한 | 없음 | 단일 사용자 |
| 액션 버전 관리 | 없음 | 영상에 안 나옴 |
| 액션 편집 9개 탭 | 3개만 (기본정보·파라미터·테스트) | 나머지는 영상에 안 나옴 |
| MCP 엔드포인트 | 없음 | PRD 5b, 6단계 이월 |
| KOSIS 시나리오 | 프로젝트 시드만 추가 | 실거래가로 전 구간 검증되면 KOSIS는 "다른 사이트도 된다" 컷 1장 |

## 일정 (10 영업일)

| 일 | 내용 | 태스크 |
| --- | --- | --- |
| 1 | 모노레포 + 백엔드 뼈대 | 0, 5 |
| 2~3 | Extension 기록 | 1~4 |
| 4~5 | 연결·점수·스키마 추론 | 6~8 |
| 6~7 | 관리자 화면 3개 | 9~12 |
| 8 | 실행 게이트웨이 + LLM | 13~14 |
| 9 | 통합·시드·리허설 | 15 |
| 10 | 영상 촬영 예비일 | — |

---

## File Structure

```text
mcp-studio/
├── package.json                     npm workspaces 루트
├── packages/schema/
│   └── src/index.ts                 ActionSpec·수집 이벤트 공유 타입
├── apps/extension/
│   ├── wxt.config.ts
│   ├── entrypoints/
│   │   ├── injected.ts              MAIN world: fetch/XHR 후킹
│   │   ├── content.ts               ISOLATED world: 클릭 기록, 중계
│   │   ├── background.ts            세션 상태, 서버 전송
│   │   └── sidepanel/{index.html,App.tsx}
│   └── lib/{selector.ts,masking.ts}
├── apps/backend/
│   ├── app/
│   │   ├── main.py                  FastAPI 앱, CORS
│   │   ├── db.py                    SQLite 엔진, 세션
│   │   ├── models.py                SQLModel 테이블
│   │   ├── seed.py                  프로젝트 2건 시드
│   │   ├── routers/{sessions,analysis,actions,llm}.py
│   │   └── services/
│   │       ├── masking.py           2차 마스킹
│   │       ├── body.py              JSON 판정 + 응답 축약
│   │       ├── correlation.py       클릭↔요청 연결
│   │       ├── scoring.py           §7.6 점수
│   │       ├── schema_infer.py      파라미터·응답 스키마
│   │       ├── tool_registry.py     ActionSpec → Tool 스키마
│   │       └── executor.py          실행 게이트웨이
│   └── tests/
└── apps/admin/
    └── src/
        ├── api/client.ts
        └── pages/{SessionDetail,ActionEdit,LlmConsole}.tsx
```

---

## Task 0: 모노레포 및 백엔드 뼈대

**Files:**
- Create: `package.json`, `apps/backend/requirements.txt`, `apps/backend/app/{main.py,db.py,models.py}`, `apps/backend/tests/test_health.py`

**Interfaces:**
- Produces: `get_session()` (FastAPI 의존성, `Session` 반환), 테이블 `Project`, `RecordingSession`, `InteractionEvent`, `NetworkRequest`, `Action`

- [ ] **Step 1: 루트 워크스페이스 생성**

`package.json`:

```json
{
  "name": "mcp-studio",
  "private": true,
  "workspaces": ["packages/*", "apps/extension", "apps/admin"]
}
```

- [ ] **Step 2: 백엔드 의존성 설치**

```bash
cd apps/backend
python3 -m venv .venv && . .venv/bin/activate
cat > requirements.txt <<'EOF'
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlmodel==0.0.22
httpx==0.28.1
openai==1.59.6
pytest==8.3.4
EOF
pip install -r requirements.txt
```

- [ ] **Step 3: 실패하는 테스트 작성**

`apps/backend/tests/test_health.py`:

```python
from fastapi.testclient import TestClient
from app.main import app

def test_health_returns_ok():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 4: 실패 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_health.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app'`

- [ ] **Step 5: 모델 정의**

`apps/backend/app/models.py`:

```python
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column, JSON

class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    allowed_origins: list = Field(default_factory=list, sa_column=Column(JSON))
    status: str = "ACTIVE"

class RecordingSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    started_at: datetime
    ended_at: Optional[datetime] = None
    status: str = "RECORDING"

class InteractionEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="recordingsession.id")
    interaction_id: str = Field(index=True)
    event_type: str
    page_url: str
    element_selector: str
    element_text: str
    occurred_at: datetime

class NetworkRequest(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="recordingsession.id")
    interaction_id: Optional[str] = Field(default=None, index=True)
    request_url: str
    request_method: str
    request_headers: dict = Field(default_factory=dict, sa_column=Column(JSON))
    request_body: Optional[str] = None
    response_status: int
    response_preview: dict = Field(default_factory=dict, sa_column=Column(JSON))
    is_json: bool = False
    duration_ms: int
    occurred_at: datetime
    score: Optional[int] = None
    score_reasons: list = Field(default_factory=list, sa_column=Column(JSON))

class Action(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    name: str
    tool_name: str
    description: str = ""
    action_spec: dict = Field(default_factory=dict, sa_column=Column(JSON))
    status: str = "DRAFT"
```

- [ ] **Step 6: DB와 앱 생성**

`apps/backend/app/db.py`:

```python
from pathlib import Path
from sqlmodel import SQLModel, Session, create_engine

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "dev.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})

def init_db() -> None:
    from app import models  # noqa: F401  테이블 등록
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
```

`apps/backend/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import init_db

app = FastAPI(title="MCP Studio")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # 데모 전용. 운영 전 반드시 좁힐 것
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def _startup() -> None:
    init_db()

@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
```

- [ ] **Step 7: 통과 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/ -v`
Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add package.json apps/backend
git commit -m "모노레포 구조와 백엔드 뼈대 추가"
```

---

## Task 1: Main World 네트워크 후킹

**Files:**
- Create: `apps/extension/entrypoints/injected.ts`
- Test: 수동 — 실거래가 사이트에서 콘솔 확인

**Interfaces:**
- Produces: `window.postMessage({source: "mcp-studio", type: "network", payload: CapturedRequest})`. `CapturedRequest`는 `{url, method, requestHeaders, requestBody, status, responseText, durationMs, occurredAt}`.

이 파일은 페이지의 JS 컨텍스트에서 실행되어야 한다. Content Script(ISOLATED world)에서는 페이지의 `window.fetch`를 바꿔도 페이지 코드에 반영되지 않는다.

- [ ] **Step 1: 후킹 코드 작성**

```typescript
// apps/extension/entrypoints/injected.ts
export default defineUnlistedScript(() => {
  const MAX_BODY = 100_000;

  function emit(payload: unknown) {
    window.postMessage({ source: "mcp-studio", type: "network", payload }, "*");
  }

  // fetch 후킹
  const originalFetch = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const started = Date.now();
    const request = new Request(...args);
    let bodyText: string | null = null;
    try {
      bodyText = await request.clone().text();
    } catch {
      bodyText = null;
    }
    const response = await originalFetch.apply(this, args);
    const clone = response.clone();
    let responseText = "";
    try {
      responseText = (await clone.text()).slice(0, MAX_BODY);
    } catch {
      responseText = "";
    }
    emit({
      url: request.url,
      method: request.method,
      requestHeaders: Object.fromEntries(request.headers.entries()),
      requestBody: bodyText ? bodyText.slice(0, MAX_BODY) : null,
      status: response.status,
      responseText,
      durationMs: Date.now() - started,
      occurredAt: new Date().toISOString(),
    });
    return response;
  };

  // XMLHttpRequest 후킹
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method: string, url: string, ...rest: any[]) {
    (this as any).__mcp = { method, url, headers: {} as Record<string, string> };
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name: string, value: string) {
    const meta = (this as any).__mcp;
    if (meta) meta.headers[name] = value;
    return originalSetHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const meta = (this as any).__mcp;
    const started = Date.now();
    this.addEventListener("loadend", () => {
      if (!meta) return;
      emit({
        url: new URL(meta.url, location.href).href,
        method: meta.method,
        requestHeaders: meta.headers,
        requestBody: typeof body === "string" ? body.slice(0, MAX_BODY) : null,
        status: this.status,
        responseText: (this.responseText || "").slice(0, MAX_BODY),
        durationMs: Date.now() - started,
        occurredAt: new Date().toISOString(),
      });
    });
    return originalSend.call(this, body as any);
  };
});
```

`responseText`를 그대로 담는 이유는 JSON 판정과 응답 축약을 **백엔드에서** 하기 때문이다(Task 6). Extension은 원문을 100KB로 자르기만 한다.

- [ ] **Step 2: 수동 검증**

`npm run dev -w apps/extension`으로 띄우고 실거래가 GIS 화면에서 지도를 이동한 뒤, 페이지 콘솔에서 확인:

```js
window.addEventListener("message", e => {
  if (e.data?.source === "mcp-studio") console.log(e.data.payload.url, e.data.payload.status);
});
```

Expected: `getMarker.do`, `getCenterLedCdPnu.do`, `accesLog.do`가 찍힌다.

- [ ] **Step 3: 커밋**

```bash
git add apps/extension/entrypoints/injected.ts
git commit -m "Main World fetch/XHR 후킹 구현"
```

---

## Task 2: 선택자 생성과 1차 마스킹

**Files:**
- Create: `apps/extension/lib/selector.ts`, `apps/extension/lib/masking.ts`
- Test: `apps/extension/lib/selector.test.ts`, `apps/extension/lib/masking.test.ts`

**Interfaces:**
- Produces: `buildSelector(el: Element): string`, `maskHeaders(h: Record<string,string>): Record<string,string>`, `maskBody(body: string | null): string | null`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// apps/extension/lib/selector.test.ts
import { describe, it, expect } from "vitest";
import { buildSelector } from "./selector";

describe("buildSelector", () => {
  it("고유 ID를 최우선으로 쓴다", () => {
    document.body.innerHTML = `<button id="search-btn" data-testid="x">조회</button>`;
    expect(buildSelector(document.querySelector("button")!)).toBe("#search-btn");
  });

  it("ID가 없으면 data-testid를 쓴다", () => {
    document.body.innerHTML = `<button data-testid="customer-search">조회</button>`;
    expect(buildSelector(document.querySelector("button")!)).toBe('[data-testid="customer-search"]');
  });

  it("둘 다 없으면 aria-label을 쓴다", () => {
    document.body.innerHTML = `<button aria-label="고객 조회">조회</button>`;
    expect(buildSelector(document.querySelector("button")!)).toBe('[aria-label="고객 조회"]');
  });
});
```

```typescript
// apps/extension/lib/masking.test.ts
import { describe, it, expect } from "vitest";
import { maskHeaders, maskBody } from "./masking";

describe("maskHeaders", () => {
  it("Authorization 값을 가리고 키는 남긴다", () => {
    expect(maskHeaders({ Authorization: "Bearer abc" })).toEqual({ Authorization: "***" });
  });

  it("이름에 token이 들어간 헤더를 가린다", () => {
    expect(maskHeaders({ "X-Csrf-Token": "zzz" })).toEqual({ "X-Csrf-Token": "***" });
  });

  it("일반 헤더는 보존한다", () => {
    expect(maskHeaders({ Referer: "https://a.b/" })).toEqual({ Referer: "https://a.b/" });
  });
});

describe("maskBody", () => {
  it("password 키의 값을 가린다", () => {
    expect(maskBody("id=kim&password=1234")).toBe("id=kim&password=***");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -w apps/extension`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```typescript
// apps/extension/lib/selector.ts
export function buildSelector(el: Element): string {
  if (el.id) return `#${el.id}`;

  const testId = el.getAttribute("data-testid");
  if (testId) return `[data-testid="${testId}"]`;

  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return `[aria-label="${ariaLabel}"]`;

  const name = el.getAttribute("name");
  if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;

  const role = el.getAttribute("role");
  const text = (el.textContent || "").trim().slice(0, 30);
  if (role && text) return `[role="${role}"]:has-text("${text}")`;

  return cssPath(el);
}

function cssPath(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.tagName !== "BODY" && parts.length < 5) {
    const parent: Element | null = node.parentElement;
    if (!parent) break;
    const siblings = Array.from(parent.children).filter(c => c.tagName === node!.tagName);
    const tag = node.tagName.toLowerCase();
    parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(node) + 1})` : tag);
    node = parent;
  }
  return parts.join(" > ");
}
```

```typescript
// apps/extension/lib/masking.ts
const MASK = "***";
const HEADER_NAMES = new Set([
  "authorization", "cookie", "set-cookie", "proxy-authorization",
  "x-api-key", "x-auth-token",
]);
const HEADER_SUBSTRINGS = ["token", "secret", "key", "auth"];
const BODY_KEYS = new Set([
  "password", "passwd", "pwd", "secret", "token", "accesstoken", "refreshtoken",
  "apikey", "sessionid", "ssn", "jumin", "cardnumber", "cvv",
]);

export function maskHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    const sensitive = HEADER_NAMES.has(lower) || HEADER_SUBSTRINGS.some(s => lower.includes(s));
    out[name] = sensitive ? MASK : value;
  }
  return out;
}

export function maskBody(body: string | null): string | null {
  if (!body) return body;
  // form-urlencoded
  if (body.includes("=") && !body.trimStart().startsWith("{")) {
    return body
      .split("&")
      .map(pair => {
        const [k, ...rest] = pair.split("=");
        return BODY_KEYS.has(k.toLowerCase()) ? `${k}=${MASK}` : [k, ...rest].join("=");
      })
      .join("&");
  }
  // JSON
  try {
    const parsed = JSON.parse(body);
    return JSON.stringify(maskObject(parsed));
  } catch {
    return body;
  }
}

function maskObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskObject);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = BODY_KEYS.has(k.toLowerCase()) ? MASK : maskObject(v);
    }
    return out;
  }
  return value;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm run test -w apps/extension`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/extension/lib
git commit -m "선택자 생성과 1차 마스킹 구현"
```

---

## Task 3: Content Script — 클릭 기록과 중계

**Files:**
- Create: `apps/extension/entrypoints/content.ts`

**Interfaces:**
- Consumes: `buildSelector`, `maskHeaders`, `maskBody` (Task 2), `injected.ts`의 postMessage (Task 1)
- Produces: `chrome.runtime.sendMessage({type: "interaction" | "network", payload})`

클릭이 발생하면 `interactionId`를 발급하고, 이후 5초 동안 도착한 네트워크 이벤트에 그 ID를 붙인다(PRD §7.5 기본값).

- [ ] **Step 1: 구현**

```typescript
// apps/extension/entrypoints/content.ts
import { buildSelector } from "../lib/selector";
import { maskHeaders, maskBody } from "../lib/masking";

const CORRELATION_WINDOW_MS = 5000;

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  async main(ctx) {
    await injectScript("/injected.js", { keepInDom: true });

    let currentInteractionId: string | null = null;
    let interactionExpiresAt = 0;

    document.addEventListener(
      "click",
      (event) => {
        const target = event.target as Element | null;
        if (!target) return;
        const el = target.closest("button, a, input, select, [role=button]") ?? target;

        currentInteractionId = crypto.randomUUID();
        interactionExpiresAt = Date.now() + CORRELATION_WINDOW_MS;

        chrome.runtime.sendMessage({
          type: "interaction",
          payload: {
            interactionId: currentInteractionId,
            eventType: "click",
            pageUrl: location.href,
            selector: buildSelector(el),
            elementText: (el.textContent || "").trim().slice(0, 50),
            occurredAt: new Date().toISOString(),
          },
        });
      },
      true,
    );

    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      if (event.data?.source !== "mcp-studio" || event.data.type !== "network") return;

      const p = event.data.payload;
      const linked = Date.now() < interactionExpiresAt ? currentInteractionId : null;

      chrome.runtime.sendMessage({
        type: "network",
        payload: {
          ...p,
          interactionId: linked,
          requestHeaders: maskHeaders(p.requestHeaders ?? {}),
          requestBody: maskBody(p.requestBody ?? null),
        },
      });
    });
  },
});
```

지도 드래그처럼 클릭 없이 발생하는 요청은 `interactionId`가 `null`이 된다. 실거래가 시나리오는 지도를 **클릭해서** 이동하므로 연결된다. 영상 촬영 시 드래그 대신 클릭이나 확대 버튼을 쓴다.

- [ ] **Step 2: 수동 검증**

Extension을 다시 로드하고 실거래가 화면에서 지도 확대 버튼을 클릭한다. Service Worker 콘솔에 `interaction` 1건과 `network` 3건이 같은 `interactionId`로 도착해야 한다.

- [ ] **Step 3: 커밋**

```bash
git add apps/extension/entrypoints/content.ts
git commit -m "클릭 기록과 네트워크 이벤트 연결 구현"
```

---

## Task 4: Background + Side Panel

**Files:**
- Create: `apps/extension/entrypoints/background.ts`, `apps/extension/entrypoints/sidepanel/{index.html,App.tsx}`
- Modify: `apps/extension/wxt.config.ts`

**Interfaces:**
- Consumes: `chrome.runtime.sendMessage` (Task 3)
- Produces: `POST {API_BASE}/api/recording-sessions/{id}/bulk` 호출 (Task 5에서 구현)

- [ ] **Step 1: manifest 설정**

```typescript
// apps/extension/wxt.config.ts
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "MCP Studio Recorder",
    permissions: ["storage", "sidePanel", "tabs"],
    host_permissions: ["<all_urls>"],
    side_panel: { default_path: "sidepanel.html" },
    web_accessible_resources: [{ resources: ["injected.js"], matches: ["<all_urls>"] }],
  },
});
```

- [ ] **Step 2: Background 구현**

```typescript
// apps/extension/entrypoints/background.ts
const API_BASE = "http://localhost:8000";

type Buffered = { interactions: any[]; networks: any[] };
const buffer: Buffered = { interactions: [], networks: [] };
let recording = false;
let sessionId: number | null = null;

export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "interaction" && recording) {
      buffer.interactions.push(msg.payload);
      broadcast();
    } else if (msg.type === "network" && recording) {
      if (isCollectible(msg.payload.url)) {
        buffer.networks.push(msg.payload);
        broadcast();
      }
    } else if (msg.type === "start") {
      startSession(msg.projectId).then(sendResponse);
      return true;
    } else if (msg.type === "stop") {
      stopSession().then(sendResponse);
      return true;
    } else if (msg.type === "state") {
      sendResponse({ recording, sessionId, ...counts() });
    }
  });
});

function counts() {
  return { interactionCount: buffer.interactions.length, networkCount: buffer.networks.length };
}

function broadcast() {
  chrome.runtime.sendMessage({ type: "state-changed", ...counts(), recent: buffer.networks.slice(-10) })
    .catch(() => {});  // Side Panel이 닫혀 있으면 무시
}

// PRD §7.4 수집 제외 대상
const STATIC_EXT = /\.(png|jpe?g|gif|svg|webp|css|js|woff2?|ttf|ico|map)(\?|$)/i;
const NOISE_HOST = /(google-analytics|googletagmanager|doubleclick|sentry\.io|youtube\.com)/i;

function isCollectible(url: string): boolean {
  if (STATIC_EXT.test(url)) return false;
  if (NOISE_HOST.test(url)) return false;
  if (url.startsWith("chrome-extension://")) return false;
  return true;
}

async function startSession(projectId: number) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/recording-sessions`, {
    method: "POST",
  });
  const data = await res.json();
  sessionId = data.id;
  buffer.interactions = [];
  buffer.networks = [];
  recording = true;
  broadcast();
  return { sessionId };
}

async function stopSession() {
  recording = false;
  if (sessionId === null) return { ok: false };
  const res = await fetch(`${API_BASE}/api/recording-sessions/${sessionId}/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buffer),
  });
  const data = await res.json();
  broadcast();
  return { ok: true, sessionId, ...data };
}
```

- [ ] **Step 3: Side Panel 구현**

```tsx
// apps/extension/entrypoints/sidepanel/App.tsx
import { useEffect, useState } from "react";

const PROJECTS = [
  { id: 1, name: "국토교통부 실거래가" },
  { id: 2, name: "국가통계포털 KOSIS" },
];

export default function App() {
  const [recording, setRecording] = useState(false);
  const [counts, setCounts] = useState({ interactionCount: 0, networkCount: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [projectId, setProjectId] = useState(1);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "state" }, (s) => {
      if (s) { setRecording(s.recording); setCounts(s); }
    });
    const listener = (msg: any) => {
      if (msg.type !== "state-changed") return;
      setCounts({ interactionCount: msg.interactionCount, networkCount: msg.networkCount });
      setRecent(msg.recent ?? []);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: "system-ui", fontSize: 13 }}>
      <h2 style={{ fontSize: 15, margin: "0 0 12px" }}>MCP Studio</h2>

      <select
        value={projectId}
        onChange={(e) => setProjectId(Number(e.target.value))}
        disabled={recording}
        style={{ width: "100%", padding: 6, marginBottom: 12 }}
      >
        {PROJECTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      {!recording ? (
        <button
          onClick={() => chrome.runtime.sendMessage({ type: "start", projectId }, () => setRecording(true))}
          style={{ width: "100%", padding: 10, background: "#2563eb", color: "#fff", border: 0, borderRadius: 6 }}
        >
          기록 시작
        </button>
      ) : (
        <button
          onClick={() => chrome.runtime.sendMessage({ type: "stop" }, () => setRecording(false))}
          style={{ width: "100%", padding: 10, background: "#dc2626", color: "#fff", border: 0, borderRadius: 6 }}
        >
          기록 종료 및 전송
        </button>
      )}

      <div style={{ margin: "16px 0", display: "flex", gap: 16 }}>
        <div><strong style={{ fontSize: 22 }}>{counts.interactionCount}</strong><div>클릭</div></div>
        <div><strong style={{ fontSize: 22 }}>{counts.networkCount}</strong><div>API 요청</div></div>
      </div>

      <div>
        {recent.map((r, i) => (
          <div key={i} style={{ padding: "6px 0", borderTop: "1px solid #eee", fontFamily: "monospace", fontSize: 11 }}>
            <span style={{ color: "#2563eb" }}>{r.method}</span>{" "}
            <span style={{ color: r.status < 300 ? "#16a34a" : "#dc2626" }}>{r.status}</span>{" "}
            {new URL(r.url).pathname}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 수동 검증 — 영상 장면 3**

Side Panel을 열고 기록 시작 → 실거래가 지도 확대 버튼 클릭 → 클릭 1, API 요청 3이 실시간으로 올라가고 하단에 `POST 200 /pt/gis/getMarker.do`가 표시되어야 한다.

- [ ] **Step 5: 커밋**

```bash
git add apps/extension
git commit -m "Background 세션 관리와 Side Panel UI 구현"
```

---

## Task 5: 수집 API

**Files:**
- Create: `apps/backend/app/routers/sessions.py`, `apps/backend/app/services/{masking.py,body.py}`
- Modify: `apps/backend/app/main.py`
- Test: `apps/backend/tests/test_body.py`, `apps/backend/tests/test_sessions.py`

**Interfaces:**
- Produces: `POST /api/projects/{pid}/recording-sessions` → `{id}`, `POST /api/recording-sessions/{sid}/bulk` → `{interactions, networks}` 저장 건수. `parse_json_body(text) -> Optional[Any]`, `summarize_response(text) -> dict`

- [ ] **Step 1: 실패하는 테스트 작성**

```python
# apps/backend/tests/test_body.py
from app.services.body import parse_json_body, summarize_response

def test_json_판정은_content_type이_아니라_본문_기준():
    # 실거래가 getMarker.do는 JSON을 text/html로 반환한다
    text = '{"list":[{"a":1},{"a":2}]}'
    assert parse_json_body(text) is not None

def test_html_본문은_none():
    assert parse_json_body("<!DOCTYPE html><html></html>") is None

def test_배열은_첫_요소만_남기고_개수를_기록한다():
    text = '{"list":[{"nm":"세종"},{"nm":"디팰리스"},{"nm":"경희궁자이"}]}'
    result = summarize_response(text)
    assert result["sample"]["list"] == [{"nm": "세종"}]
    assert result["counts"]["list"] == 3
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/test_body.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: 구현**

```python
# apps/backend/app/services/body.py
import json
from typing import Any, Optional

def parse_json_body(text: Optional[str]) -> Optional[Any]:
    """Content-Type을 신뢰하지 않고 본문 파싱을 시도한다.

    국내 공공기관 사이트는 JSON을 text/html로 내려보내는 경우가 흔하다.
    """
    if not text:
        return None
    stripped = text.strip()
    if not stripped or stripped[0] not in "{[":
        return None
    try:
        return json.loads(stripped)
    except (json.JSONDecodeError, ValueError):
        return None

def summarize_response(text: Optional[str]) -> dict:
    """응답을 구조 + 샘플 1건으로 축약한다 (PRD §7.4)."""
    parsed = parse_json_body(text)
    if parsed is None:
        return {"isJson": False, "sample": None, "counts": {}}
    counts: dict = {}
    sample = _shrink(parsed, counts, path="")
    return {"isJson": True, "sample": sample, "counts": counts}

def _shrink(value: Any, counts: dict, path: str) -> Any:
    if isinstance(value, list):
        counts[path or "root"] = len(value)
        return [_shrink(value[0], counts, f"{path}[]")] if value else []
    if isinstance(value, dict):
        return {k: _shrink(v, counts, k if not path else f"{path}.{k}") for k, v in value.items()}
    return value
```

```python
# apps/backend/app/services/masking.py
import re

MASK = "***"
PATTERNS = [
    re.compile(r"\d{6}-\d{7}"),                                        # 주민등록번호
    re.compile(r"\d{4}-?\d{4}-?\d{4}-?\d{4}"),                         # 카드번호
    re.compile(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"),  # JWT
]

def mask_patterns(text):
    """2차 마스킹. Extension의 1차 마스킹을 통과한 값 패턴을 잡는다."""
    if not isinstance(text, str):
        return text
    for pattern in PATTERNS:
        text = pattern.sub(MASK, text)
    return text
```

```python
# apps/backend/app/routers/sessions.py
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlmodel import Session
from app.db import get_session
from app.models import RecordingSession, InteractionEvent, NetworkRequest
from app.services.body import summarize_response
from app.services.masking import mask_patterns

router = APIRouter()

@router.post("/api/projects/{project_id}/recording-sessions")
def create_session(project_id: int, db: Session = Depends(get_session)) -> dict:
    row = RecordingSession(project_id=project_id, started_at=datetime.utcnow())
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id}

@router.post("/api/recording-sessions/{session_id}/bulk")
def bulk_upload(session_id: int, payload: dict, db: Session = Depends(get_session)) -> dict:
    for item in payload.get("interactions", []):
        db.add(InteractionEvent(
            session_id=session_id,
            interaction_id=item["interactionId"],
            event_type=item["eventType"],
            page_url=item["pageUrl"],
            element_selector=item["selector"],
            element_text=item["elementText"],
            occurred_at=datetime.fromisoformat(item["occurredAt"].replace("Z", "+00:00")),
        ))

    for item in payload.get("networks", []):
        summary = summarize_response(item.get("responseText"))
        db.add(NetworkRequest(
            session_id=session_id,
            interaction_id=item.get("interactionId"),
            request_url=item["url"],
            request_method=item["method"],
            request_headers={k: mask_patterns(v) for k, v in (item.get("requestHeaders") or {}).items()},
            request_body=mask_patterns(item.get("requestBody")),
            response_status=item["status"],
            response_preview=summary,
            is_json=summary["isJson"],
            duration_ms=item.get("durationMs", 0),
            occurred_at=datetime.fromisoformat(item["occurredAt"].replace("Z", "+00:00")),
        ))

    row = db.get(RecordingSession, session_id)
    if row:
        row.ended_at = datetime.utcnow()
        row.status = "COMPLETED"
        db.add(row)
    db.commit()
    return {
        "interactions": len(payload.get("interactions", [])),
        "networks": len(payload.get("networks", [])),
    }
```

`main.py`에 라우터를 등록한다. Task 7·8·14에서 라우터가 추가될 때마다 같은 자리에 한 줄씩 늘린다.

```python
# apps/backend/app/main.py 에 추가
from app.routers import sessions

app.include_router(sessions.router)
```

- [ ] **Step 4: 통과 확인**

Run: `cd apps/backend && .venv/bin/pytest tests/ -v`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/backend
git commit -m "수집 API와 응답 축약·2차 마스킹 구현"
```

---

## Task 6: 점수 계산

**Files:**
- Create: `apps/backend/app/services/scoring.py`
- Test: `apps/backend/tests/test_scoring.py`

**Interfaces:**
- Produces: `score_request(req: NetworkRequest, click_at: datetime, sibling_urls: list) -> tuple[int, list[str]]`

- [ ] **Step 1: 실패하는 테스트 작성**

```python
# apps/backend/tests/test_scoring.py
from datetime import datetime, timedelta
from app.models import NetworkRequest
from app.services.scoring import score_request

CLICK_AT = datetime(2026, 7, 26, 5, 0, 0)

def make(url, method="POST", status=200, is_json=True, delay_ms=300):
    return NetworkRequest(
        session_id=1, request_url=url, request_method=method,
        response_status=status, is_json=is_json,
        response_preview={"isJson": is_json, "sample": {"list": [{}]}, "counts": {"list": 3}},
        duration_ms=50, occurred_at=CLICK_AT + timedelta(milliseconds=delay_ms),
    )

def test_주요_조회_api는_9점():
    score, _ = score_request(make("https://rt.molit.go.kr/pt/gis/getMarker.do"), CLICK_AT, [])
    assert score == 9

def test_로그_api는_5점_감점되어_최하위():
    marker, _ = score_request(make("https://rt.molit.go.kr/pt/gis/getMarker.do"), CLICK_AT, [])
    log, reasons = score_request(make("https://rt.molit.go.kr/pt/main/accesLog.do"), CLICK_AT, [])
    assert log < marker
    assert "로그 API" in " ".join(reasons)

def test_동일_url_중복_호출은_폴링으로_본다():
    url = "https://kosis.kr/oneid/cmmn/login/ActiveSessionFind.do"
    score, reasons = score_request(make(url), CLICK_AT, [url, url])
    assert "폴링" in " ".join(reasons)
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/pytest tests/test_scoring.py -v`
Expected: FAIL

- [ ] **Step 3: 구현**

```python
# apps/backend/app/services/scoring.py
import re
from datetime import datetime
from typing import List, Tuple
from app.models import NetworkRequest

MUTATING = {"POST", "PUT", "PATCH", "DELETE"}
LOG_URL = re.compile(r"(acceslog|accesslog|/log/|/logging|analytics|collect|tracker|stat)", re.I)

def score_request(req: NetworkRequest, click_at: datetime, sibling_urls: List[str]) -> Tuple[int, List[str]]:
    """PRD §7.6 점수 정책. 점수와 추천 사유를 함께 반환한다."""
    score = 0
    reasons: List[str] = []

    if req.request_method.upper() in MUTATING:
        score += 3
        reasons.append(f"변경성 메서드 {req.request_method} +3")

    score += 2
    reasons.append("Fetch/XHR 요청 +2")

    delta = (req.occurred_at - click_at).total_seconds()
    if 0 <= delta <= 1:
        score += 2
        reasons.append("클릭 후 1초 이내 +2")

    if 200 <= req.response_status < 300:
        score += 1
        reasons.append("응답 성공 +1")
    else:
        score -= 2
        reasons.append("응답 실패 -2")

    if req.is_json and req.response_preview.get("sample"):
        score += 1
        reasons.append("응답 데이터 있음 +1")

    if LOG_URL.search(req.request_url):
        score -= 5
        reasons.append("로그 API -5")

    if sibling_urls.count(req.request_url) >= 2:
        score -= 3
        reasons.append("동일 URL 반복 호출(폴링) -3")

    return score, reasons
```

`sibling_urls`는 같은 `interaction_id`에 묶인 모든 요청의 URL 목록이다. PRD §7.6의 "반복 Polling 요청 −3"을 **동일 URL 중복 호출**로 구체화했다. KOSIS의 `ActiveSessionFind.do` 2회 호출이 이 규칙에 걸린다.

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/pytest tests/test_scoring.py -v`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/app/services/scoring.py apps/backend/tests/test_scoring.py
git commit -m "API 후보 점수 계산 구현"
```

---

## Task 7: 후보 분석 API

**Files:**
- Create: `apps/backend/app/routers/analysis.py`
- Modify: `apps/backend/app/main.py`
- Test: `apps/backend/tests/test_analysis.py`

**Interfaces:**
- Consumes: `score_request` (Task 6)
- Produces: `GET /api/recording-sessions/{sid}/candidates` → `[{interaction: {...}, candidates: [{id, url, method, status, score, reasons, isJson, sample}]}]`

- [ ] **Step 1: 구현**

```python
# apps/backend/app/routers/analysis.py
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from app.db import get_session
from app.models import InteractionEvent, NetworkRequest
from app.services.scoring import score_request

router = APIRouter()

@router.get("/api/recording-sessions/{session_id}/candidates")
def candidates(session_id: int, db: Session = Depends(get_session)) -> list:
    interactions = db.exec(
        select(InteractionEvent)
        .where(InteractionEvent.session_id == session_id)
        .order_by(InteractionEvent.occurred_at)
    ).all()

    result = []
    for interaction in interactions:
        requests = db.exec(
            select(NetworkRequest)
            .where(NetworkRequest.session_id == session_id)
            .where(NetworkRequest.interaction_id == interaction.interaction_id)
        ).all()

        sibling_urls = [r.request_url for r in requests]
        scored = []
        for req in requests:
            score, reasons = score_request(req, interaction.occurred_at, sibling_urls)
            req.score = score
            req.score_reasons = reasons
            db.add(req)
            scored.append({
                "id": req.id,
                "url": req.request_url,
                "method": req.request_method,
                "status": req.response_status,
                "isJson": req.is_json,
                "durationMs": req.duration_ms,
                "score": score,
                "reasons": reasons,
                "sample": req.response_preview.get("sample"),
                "requestBody": req.request_body,
            })

        scored.sort(key=lambda c: c["score"], reverse=True)
        result.append({
            "interaction": {
                "id": interaction.interaction_id,
                "selector": interaction.element_selector,
                "text": interaction.element_text,
                "pageUrl": interaction.page_url,
                "occurredAt": interaction.occurred_at.isoformat(),
            },
            "totalRequests": len(scored),
            "candidates": scored,
        })

    db.commit()
    return result
```

- [ ] **Step 2: 통합 검증**

실제 기록 세션을 하나 만든 뒤:

```bash
curl -s localhost:8000/api/recording-sessions/1/candidates | python3 -m json.tool | head -40
```

Expected: `getMarker.do`가 1순위, `accesLog.do`가 최하위.

- [ ] **Step 3: 커밋**

```bash
git add apps/backend
git commit -m "클릭별 API 후보 분석 엔드포인트 추가"
```

---

## Task 8: 스키마 추론과 ActionSpec 생성

**Files:**
- Create: `apps/backend/app/services/schema_infer.py`, `apps/backend/app/routers/actions.py`
- Test: `apps/backend/tests/test_schema_infer.py`

**Interfaces:**
- Produces: `infer_request_schema(method, url, body) -> dict`, `infer_response_schema(sample) -> dict`, `build_action_spec(req, name) -> dict`, `POST /api/actions` → `{id, actionSpec}`

- [ ] **Step 1: 실패하는 테스트 작성**

```python
# apps/backend/tests/test_schema_infer.py
from app.services.schema_infer import infer_request_schema, infer_response_schema

def test_form_urlencoded_body를_스키마로_추론한다():
    body = "minX=126.9654155&minY=37.5606793&maxX=126.9911647&maxY=37.5720409&srhYear=2026&poiType=A"
    schema = infer_request_schema("POST", "https://rt.molit.go.kr/pt/gis/getMarker.do", body)
    assert set(schema["bodySchema"].keys()) == {"minX", "minY", "maxX", "maxY", "srhYear", "poiType"}
    assert schema["bodySchema"]["minX"]["type"] == "number"
    assert schema["bodySchema"]["srhYear"]["type"] == "integer"
    assert schema["bodySchema"]["poiType"]["type"] == "string"
    assert schema["bodySchema"]["minX"]["example"] == "126.9654155"

def test_쿼리스트링을_스키마로_추론한다():
    schema = infer_request_schema("GET", "https://x.kr/api?page=1&keyword=버스", None)
    assert schema["querySchema"]["page"]["type"] == "integer"
    assert schema["querySchema"]["keyword"]["type"] == "string"

def test_배열_응답의_구조를_추론한다():
    sample = {"list": [{"aprpnHsmpNm": "세종", "lo": 126.97}]}
    schema = infer_response_schema(sample)
    assert schema["properties"]["list"]["type"] == "array"
    assert schema["properties"]["list"]["items"]["properties"]["aprpnHsmpNm"]["type"] == "string"
    assert schema["properties"]["list"]["items"]["properties"]["lo"]["type"] == "number"
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/pytest tests/test_schema_infer.py -v`
Expected: FAIL

- [ ] **Step 3: 구현**

```python
# apps/backend/app/services/schema_infer.py
from typing import Any, Optional
from urllib.parse import urlparse, parse_qsl

# 실행 시 재현해야 하는 헤더 (PRD §7.7). WAF가 검사한다.
PRESERVED_HEADERS = {"user-agent", "referer", "x-requested-with", "accept", "content-type"}

def _infer_type(raw: str) -> str:
    try:
        int(raw)
        return "integer"
    except ValueError:
        pass
    try:
        float(raw)
        return "number"
    except ValueError:
        pass
    if raw.lower() in ("true", "false"):
        return "boolean"
    return "string"

def _pairs_to_schema(pairs) -> dict:
    schema = {}
    for key, value in pairs:
        schema[key] = {
            "type": _infer_type(value),
            "description": "",
            "required": True,
            "example": value,
            "llmEditable": True,
        }
    return schema

def infer_request_schema(method: str, url: str, body: Optional[str]) -> dict:
    query_pairs = parse_qsl(urlparse(url).query, keep_blank_values=True)
    body_pairs = []
    if body and "=" in body and not body.strip().startswith("{"):
        body_pairs = parse_qsl(body, keep_blank_values=True)
    return {
        "querySchema": _pairs_to_schema(query_pairs) or None,
        "bodySchema": _pairs_to_schema(body_pairs) or None,
    }

def infer_response_schema(sample: Any) -> dict:
    return _walk(sample)

def _walk(value: Any) -> dict:
    if isinstance(value, list):
        return {"type": "array", "items": _walk(value[0]) if value else {"type": "object"}}
    if isinstance(value, dict):
        return {"type": "object", "properties": {k: _walk(v) for k, v in value.items()}}
    if isinstance(value, bool):
        return {"type": "boolean"}
    if isinstance(value, int):
        return {"type": "integer"}
    if isinstance(value, float):
        return {"type": "number"}
    return {"type": "string"}

def build_action_spec(req, name: str, tool_name: str, description: str) -> dict:
    request_schema = infer_request_schema(req.request_method, req.request_url, req.request_body)
    sample = (req.response_preview or {}).get("sample")
    headers = {
        k: v for k, v in (req.request_headers or {}).items()
        if k.lower() in PRESERVED_HEADERS and v != "***"
    }
    return {
        "name": name,
        "toolName": tool_name,
        "description": description,
        "trigger": {"pageUrlPattern": urlparse(req.request_url).path},
        "request": {
            "method": req.request_method,
            "urlTemplate": req.request_url.split("?")[0],
            "headers": headers,
            **request_schema,
        },
        "response": {
            "successStatus": [200],
            "schema": infer_response_schema(sample) if sample else {"type": "object"},
        },
        "execution": {"authMode": "NONE", "credentialId": None, "requiresConfirmation": False},
    }
```

```python
# apps/backend/app/routers/actions.py
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.db import get_session
from app.models import NetworkRequest, Action
from app.services.schema_infer import build_action_spec

router = APIRouter()

@router.post("/api/actions")
def create_action(payload: dict, db: Session = Depends(get_session)) -> dict:
    req = db.get(NetworkRequest, payload["networkRequestId"])
    if req is None:
        raise HTTPException(404, "network request not found")
    spec = build_action_spec(
        req,
        name=payload["name"],
        tool_name=payload["toolName"],
        description=payload.get("description", ""),
    )
    action = Action(
        project_id=payload["projectId"],
        name=payload["name"],
        tool_name=payload["toolName"],
        description=payload.get("description", ""),
        action_spec=spec,
        status="DRAFT",
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return {"id": action.id, "actionSpec": spec}

@router.put("/api/actions/{action_id}")
def update_action(action_id: int, payload: dict, db: Session = Depends(get_session)) -> dict:
    action = db.get(Action, action_id)
    if action is None:
        raise HTTPException(404, "action not found")
    action.action_spec = payload.get("actionSpec", action.action_spec)
    action.description = payload.get("description", action.description)
    action.status = payload.get("status", action.status)
    db.add(action)
    db.commit()
    return {"ok": True}

@router.get("/api/projects/{project_id}/actions")
def list_actions(project_id: int, db: Session = Depends(get_session)) -> list:
    rows = db.exec(select(Action).where(Action.project_id == project_id)).all()
    return [
        {"id": a.id, "name": a.name, "toolName": a.tool_name,
         "description": a.description, "status": a.status, "actionSpec": a.action_spec}
        for a in rows
    ]
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/pytest tests/ -v`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/backend
git commit -m "파라미터·응답 스키마 추론과 ActionSpec 생성 구현"
```

---

## Task 9: 관리자 화면 뼈대

**Files:**
- Create: `apps/admin/` (Vite React TS), `apps/admin/src/api/client.ts`, `apps/admin/src/App.tsx`

**Interfaces:**
- Produces: `api.get(path)`, `api.post(path, body)`, `api.put(path, body)`

- [ ] **Step 1: 프로젝트 생성**

```bash
npm create vite@latest apps/admin -- --template react-ts
npm i -w apps/admin @tanstack/react-query react-router-dom
```

- [ ] **Step 2: API 클라이언트**

```typescript
// apps/admin/src/api/client.ts
const BASE = "http://localhost:8000";

async function request(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json();
}

export const api = {
  get: (path: string) => request("GET", path),
  post: (path: string, body?: unknown) => request("POST", path, body),
  put: (path: string, body?: unknown) => request("PUT", path, body),
};
```

- [ ] **Step 3: 라우팅**

```tsx
// apps/admin/src/App.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import SessionDetail from "./pages/SessionDetail";
import ActionEdit from "./pages/ActionEdit";
import LlmConsole from "./pages/LlmConsole";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/sessions/1" replace />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="/actions/new" element={<ActionEdit />} />
          <Route path="/console" element={<LlmConsole />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

Task 10~14에서 세 페이지를 만들기 전까지는 각 파일에 `export default function X() { return null; }` 스텁을 두어 빌드가 통과하게 한다.

- [ ] **Step 4: 커밋**

```bash
git add apps/admin package.json package-lock.json
git commit -m "관리자 화면 뼈대와 API 클라이언트 추가"
```

---

## Task 10: 기록 세션 상세 화면 — 영상 장면 5

**Files:**
- Create: `apps/admin/src/pages/SessionDetail.tsx`

**Interfaces:**
- Consumes: `GET /api/recording-sessions/{sid}/candidates` (Task 7)
- Produces: 후보 선택 시 `/actions/new?requestId={id}`로 이동

- [ ] **Step 1: 구현**

```tsx
// apps/admin/src/pages/SessionDetail.tsx
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["candidates", id],
    queryFn: () => api.get(`/api/recording-sessions/${id}/candidates`),
  });

  if (isLoading) return <p style={{ padding: 24 }}>불러오는 중...</p>;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20 }}>기록 세션 #{id}</h1>

      {(data ?? []).map((group: any) => (
        <section key={group.interaction.id} style={{ marginTop: 28 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>{group.interaction.text || "(텍스트 없음)"}</strong>
            <code style={{ marginLeft: 8, color: "#666", fontSize: 12 }}>
              {group.interaction.selector}
            </code>
            <span style={{ marginLeft: 8, color: "#666", fontSize: 12 }}>
              요청 {group.totalRequests}건
            </span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
                <th style={{ padding: 8, width: 60 }}>점수</th>
                <th style={{ padding: 8, width: 70 }}>Method</th>
                <th style={{ padding: 8 }}>URL</th>
                <th style={{ padding: 8, width: 60 }}>상태</th>
                <th style={{ padding: 8 }}>추천 사유</th>
                <th style={{ padding: 8, width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {group.candidates.map((c: any, i: number) => (
                <tr key={c.id} style={{ borderTop: "1px solid #eee", background: i === 0 ? "#f0f7ff" : undefined }}>
                  <td style={{ padding: 8, fontWeight: 700 }}>{c.score}</td>
                  <td style={{ padding: 8 }}>{c.method}</td>
                  <td style={{ padding: 8, fontFamily: "monospace", fontSize: 12 }}>
                    {new URL(c.url).pathname}
                  </td>
                  <td style={{ padding: 8, color: c.status < 300 ? "#16a34a" : "#dc2626" }}>{c.status}</td>
                  <td style={{ padding: 8, fontSize: 11, color: "#666" }}>{c.reasons.join(", ")}</td>
                  <td style={{ padding: 8 }}>
                    <button
                      disabled={!c.isJson}
                      onClick={() => navigate(`/actions/new?requestId=${c.id}`)}
                    >
                      액션 만들기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
```

1순위 행에 배경색을 주고 추천 사유를 그대로 보여준다. 영상에서 `accesLog.do`가 `로그 API -5` 사유와 함께 최하위에 있는 것이 한 화면에 담긴다.

- [ ] **Step 2: 수동 검증**

`npm run dev -w apps/admin` 후 `/sessions/1`. `getMarker.do`가 강조된 1순위, `accesLog.do`가 최하위여야 한다.

- [ ] **Step 3: 커밋**

```bash
git add apps/admin/src/pages/SessionDetail.tsx
git commit -m "기록 세션 상세 화면 구현"
```

---

## Task 11: 액션 편집 화면 — 영상 장면 6~7

**Files:**
- Create: `apps/admin/src/pages/ActionEdit.tsx`

**Interfaces:**
- Consumes: `POST /api/actions`, `PUT /api/actions/{id}` (Task 8)

- [ ] **Step 1: 구현**

`requestId` 쿼리로 진입하면 즉시 `POST /api/actions`를 호출해 ActionSpec 초안을 만들고, 추론된 파라미터를 편집 가능한 표로 보여준다. 필드는 이름·타입·설명·필수·예시값 5개만 노출한다(PRD §7.8의 11개 중 영상에 필요한 것만).

```tsx
// apps/admin/src/pages/ActionEdit.tsx
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";

export default function ActionEdit() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [actionId, setActionId] = useState<number | null>(null);
  const [spec, setSpec] = useState<any>(null);
  const [name, setName] = useState("아파트 단지 조회");
  const [toolName, setToolName] = useState("search_apartment_markers");
  const [description, setDescription] = useState("지도 영역 안의 아파트 단지 목록을 조회합니다.");

  useEffect(() => {
    const requestId = params.get("requestId");
    if (!requestId) return;
    api.post("/api/actions", {
      projectId: 1, networkRequestId: Number(requestId), name, toolName, description,
    }).then((res) => { setActionId(res.id); setSpec(res.actionSpec); });
  }, []);

  if (!spec) return <p style={{ padding: 24 }}>ActionSpec 생성 중...</p>;

  const paramTable = spec.request.bodySchema ?? spec.request.querySchema ?? {};

  function updateParam(key: string, field: string, value: unknown) {
    setSpec((prev: any) => {
      const target = prev.request.bodySchema ? "bodySchema" : "querySchema";
      return {
        ...prev,
        request: {
          ...prev.request,
          [target]: { ...prev.request[target], [key]: { ...prev.request[target][key], [field]: value } },
        },
      };
    });
  }

  async function activate() {
    await api.put(`/api/actions/${actionId}`, {
      actionSpec: { ...spec, name, toolName, description },
      description,
      status: "ACTIVE",
    });
    navigate("/console");
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900 }}>
      <h1 style={{ fontSize: 20 }}>액션 편집</h1>

      <fieldset style={{ border: "1px solid #ddd", padding: 16, marginBottom: 20 }}>
        <legend>기본정보</legend>
        <label>액션명 <input value={name} onChange={e => setName(e.target.value)} style={{ width: 300 }} /></label>
        <label style={{ marginLeft: 16 }}>Tool 이름 <input value={toolName} onChange={e => setToolName(e.target.value)} style={{ width: 300 }} /></label>
        <div style={{ marginTop: 10 }}>
          <label>설명 <input value={description} onChange={e => setDescription(e.target.value)} style={{ width: 700 }} /></label>
        </div>
        <div style={{ marginTop: 10, fontFamily: "monospace", fontSize: 12, color: "#555" }}>
          {spec.request.method} {spec.request.urlTemplate}
        </div>
      </fieldset>

      <fieldset style={{ border: "1px solid #ddd", padding: 16 }}>
        <legend>요청 파라미터 — 자동 추론됨</legend>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
              <th style={{ padding: 6 }}>이름</th><th style={{ padding: 6 }}>타입</th>
              <th style={{ padding: 6 }}>설명</th><th style={{ padding: 6 }}>예시값</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(paramTable).map(([key, def]: [string, any]) => (
              <tr key={key} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: 6, fontFamily: "monospace" }}>{key}</td>
                <td style={{ padding: 6 }}>
                  <select value={def.type} onChange={e => updateParam(key, "type", e.target.value)}>
                    {["string", "integer", "number", "boolean"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </td>
                <td style={{ padding: 6 }}>
                  <input value={def.description} placeholder="LLM에게 줄 설명"
                    onChange={e => updateParam(key, "description", e.target.value)} style={{ width: "100%" }} />
                </td>
                <td style={{ padding: 6, fontFamily: "monospace", fontSize: 12, color: "#666" }}>{def.example}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </fieldset>

      <button onClick={activate} style={{ marginTop: 20, padding: "10px 20px", background: "#16a34a", color: "#fff", border: 0, borderRadius: 6 }}>
        활성화하고 테스트하기
      </button>
    </div>
  );
}
```

파라미터 설명란은 비어 있는 채로 생성된다. 영상에서 `minX`에 "조회 영역 서쪽 경도"를 타이핑하는 장면이 **LLM이 파라미터를 이해하게 만드는 과정**을 보여준다.

- [ ] **Step 2: 수동 검증**

세션 상세에서 `getMarker.do`의 "액션 만들기"를 누르면 파라미터 6개가 표에 나타나야 한다.

- [ ] **Step 3: 커밋**

```bash
git add apps/admin/src/pages/ActionEdit.tsx
git commit -m "액션 편집 화면 구현"
```

---

## Task 12: Tool 스키마 생성

**Files:**
- Create: `apps/backend/app/services/tool_registry.py`
- Test: `apps/backend/tests/test_tool_registry.py`

**Interfaces:**
- Produces: `action_to_tool(action: Action) -> dict` — OpenAI function calling 정의 형식

- [ ] **Step 1: 실패하는 테스트 작성**

```python
# apps/backend/tests/test_tool_registry.py
from app.models import Action
from app.services.tool_registry import action_to_tool

SPEC = {
    "toolName": "search_apartment_markers",
    "description": "지도 영역 안의 아파트 단지 목록을 조회합니다.",
    "request": {
        "method": "POST",
        "urlTemplate": "https://rt.molit.go.kr/pt/gis/getMarker.do",
        "bodySchema": {
            "minX": {"type": "number", "description": "서쪽 경도", "required": True, "llmEditable": True},
            "poiType": {"type": "string", "description": "물건 종류", "required": True, "llmEditable": True},
        },
    },
}

def test_openai_function_형식으로_변환한다():
    tool = action_to_tool(Action(project_id=1, name="x", tool_name="search_apartment_markers", action_spec=SPEC))
    assert tool["type"] == "function"
    assert tool["function"]["name"] == "search_apartment_markers"
    params = tool["function"]["parameters"]
    assert params["properties"]["minX"]["type"] == "number"
    assert set(params["required"]) == {"minX", "poiType"}
```

- [ ] **Step 2: 구현**

```python
# apps/backend/app/services/tool_registry.py
from app.models import Action

def action_to_tool(action: Action) -> dict:
    """ActionSpec을 OpenAI function calling 정의로 변환한다."""
    spec = action.action_spec
    request = spec.get("request", {})
    schema = request.get("bodySchema") or request.get("querySchema") or {}

    properties = {}
    required = []
    for key, definition in schema.items():
        if not definition.get("llmEditable", True):
            continue
        properties[key] = {
            "type": definition.get("type", "string"),
            "description": definition.get("description") or key,
        }
        if definition.get("required"):
            required.append(key)

    return {
        "type": "function",
        "function": {
            "name": spec.get("toolName", action.tool_name),
            "description": spec.get("description", action.description),
            "parameters": {"type": "object", "properties": properties, "required": required},
        },
    }
```

- [ ] **Step 3: 통과 확인**

Run: `.venv/bin/pytest tests/test_tool_registry.py -v`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add apps/backend/app/services/tool_registry.py apps/backend/tests/test_tool_registry.py
git commit -m "ActionSpec을 Tool 스키마로 변환하는 레지스트리 추가"
```

---

## Task 13: 실행 게이트웨이 — 영상 장면 10

**Files:**
- Create: `apps/backend/app/services/executor.py`
- Test: `apps/backend/tests/test_executor.py`

**Interfaces:**
- Produces: `execute_action(action: Action, arguments: dict) -> dict` — `{status, elapsedMs, body}`

- [ ] **Step 1: 실패하는 테스트 작성**

```python
# apps/backend/tests/test_executor.py
import httpx
from app.models import Action
from app.services.executor import build_request, MIN_INTERVAL_SEC

SPEC = {
    "request": {
        "method": "POST",
        "urlTemplate": "https://rt.molit.go.kr/pt/gis/getMarker.do",
        "headers": {"Referer": "https://rt.molit.go.kr/pt/gis/gis.do", "X-Requested-With": "XMLHttpRequest"},
        "bodySchema": {"minX": {"type": "number"}, "poiType": {"type": "string"}},
    }
}

def test_보존된_헤더를_재현한다():
    action = Action(project_id=1, name="x", tool_name="t", action_spec=SPEC)
    req = build_request(action, {"minX": 126.9, "poiType": "A"})
    assert req["headers"]["Referer"] == "https://rt.molit.go.kr/pt/gis/gis.do"
    assert req["headers"]["X-Requested-With"] == "XMLHttpRequest"
    assert "User-Agent" in req["headers"]   # 없으면 기본값을 채운다

def test_body를_form_urlencoded로_직렬화한다():
    action = Action(project_id=1, name="x", tool_name="t", action_spec=SPEC)
    req = build_request(action, {"minX": 126.9, "poiType": "A"})
    assert "minX=126.9" in req["content"]
    assert "poiType=A" in req["content"]

def test_호출_간격이_1초_이상이다():
    assert MIN_INTERVAL_SEC >= 1.0
```

- [ ] **Step 2: 구현**

```python
# apps/backend/app/services/executor.py
import time
from urllib.parse import urlencode
import httpx
from app.models import Action
from app.services.body import summarize_response

MIN_INTERVAL_SEC = 1.0   # 공공 서버 부하 배려 (PRD 대상 사이트 설계 §4)
DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
)
_last_call_at = 0.0

def build_request(action: Action, arguments: dict) -> dict:
    """ActionSpec과 LLM이 만든 인자로 실제 HTTP 요청을 조립한다.

    보존된 헤더를 재현하지 않으면 WAF가 400 Request Blocked를 반환한다.
    """
    request = action.action_spec["request"]
    headers = dict(request.get("headers") or {})
    headers.setdefault("User-Agent", DEFAULT_UA)
    headers.setdefault("Accept", "application/json, text/javascript, */*; q=0.01")

    method = request["method"].upper()
    url = request["urlTemplate"]
    content = None

    if request.get("bodySchema"):
        headers.setdefault("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
        content = urlencode(arguments)
    elif request.get("querySchema") and arguments:
        url = f"{url}?{urlencode(arguments)}"

    return {"method": method, "url": url, "headers": headers, "content": content}

def execute_action(action: Action, arguments: dict) -> dict:
    global _last_call_at
    elapsed_since_last = time.monotonic() - _last_call_at
    if elapsed_since_last < MIN_INTERVAL_SEC:
        time.sleep(MIN_INTERVAL_SEC - elapsed_since_last)

    prepared = build_request(action, arguments)
    started = time.monotonic()
    with httpx.Client(timeout=20.0) as client:
        response = client.request(
            prepared["method"], prepared["url"],
            headers=prepared["headers"], content=prepared["content"],
        )
    _last_call_at = time.monotonic()

    return {
        "status": response.status_code,
        "elapsedMs": int((time.monotonic() - started) * 1000),
        "requestPreview": {k: v for k, v in prepared.items() if k != "headers"},
        "body": summarize_response(response.text),
        "rawPreview": response.text[:2000],
    }
```

`rawPreview`는 영상에서 실제 JSON을 보여주기 위한 것이다. 저장하지 않고 응답에만 싣는다.

- [ ] **Step 3: 픽스처 작성**

`apps/backend/tests/fixtures/molit_action.json`:

```json
{
  "toolName": "search_apartment_markers",
  "description": "지도 영역 안의 아파트 단지 목록을 조회합니다.",
  "request": {
    "method": "POST",
    "urlTemplate": "https://rt.molit.go.kr/pt/gis/getMarker.do",
    "headers": {
      "Referer": "https://rt.molit.go.kr/pt/gis/gis.do?srhThingSecd=A&mobileAt=",
      "X-Requested-With": "XMLHttpRequest"
    },
    "querySchema": null,
    "bodySchema": {
      "minX": {"type": "number", "required": true, "llmEditable": true, "description": "서쪽 경도"},
      "minY": {"type": "number", "required": true, "llmEditable": true, "description": "남쪽 위도"},
      "maxX": {"type": "number", "required": true, "llmEditable": true, "description": "동쪽 경도"},
      "maxY": {"type": "number", "required": true, "llmEditable": true, "description": "북쪽 위도"},
      "srhYear": {"type": "integer", "required": true, "llmEditable": true, "description": "조회 연도"},
      "poiType": {"type": "string", "required": true, "llmEditable": true, "description": "물건 종류"}
    }
  },
  "response": {"successStatus": [200], "schema": {"type": "object"}},
  "execution": {"authMode": "NONE", "credentialId": null, "requiresConfirmation": false}
}
```

- [ ] **Step 4: 통과 확인 및 실제 호출 검증**

Run: `.venv/bin/pytest tests/test_executor.py -v`
Expected: PASS

실제 호출도 한 번 확인한다. 네트워크가 필요하므로 pytest가 아닌 스크립트로 돌린다.

```bash
cd apps/backend && .venv/bin/python -c "
import json
from app.models import Action
from app.services.executor import execute_action
spec = json.load(open('tests/fixtures/molit_action.json'))
r = execute_action(Action(project_id=1, name='x', tool_name='t', action_spec=spec),
                   {'minX':126.9654155,'minY':37.5606793,'maxX':126.9911647,'maxY':37.5720409,
                    'srhYear':2026,'poiType':'A'})
print(r['status'], r['rawPreview'][:120])
"
```

Expected: `200 {"list":[{"aprpnHsmpCode":...`

- [ ] **Step 5: 커밋**

```bash
git add apps/backend
git commit -m "실행 게이트웨이 구현 — 헤더 재현과 호출 간격 제한"
```

---

## Task 14: LLM 테스트 콘솔 — 영상 장면 8~10

**Files:**
- Create: `apps/backend/app/routers/llm.py`, `apps/admin/src/pages/LlmConsole.tsx`
- Test: 수동

**Interfaces:**
- Consumes: `action_to_tool` (Task 12), `execute_action` (Task 13)
- Produces: `POST /api/projects/{pid}/llm-test` → `{selectedTool, arguments, reason}`, `POST /api/actions/{aid}/execute` → 실행 결과 + LLM 요약

2단계로 나눈다. 1차 요청은 **Tool과 파라미터만 고르고 멈춘다**(PRD §7.11 5번 사용자 확인). 사용자가 확인하면 2차 요청에서 실제 실행과 요약을 한다.

- [ ] **Step 1: 구현**

```python
# apps/backend/app/routers/llm.py
import json
import os
from fastapi import APIRouter, Depends, HTTPException
from openai import AzureOpenAI
from sqlmodel import Session, select
from app.db import get_session
from app.models import Action
from app.services.tool_registry import action_to_tool
from app.services.executor import execute_action

router = APIRouter()

client = AzureOpenAI(
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    api_key=os.environ["AZURE_OPENAI_API_KEY"],
    api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-10-21"),
)
DEPLOYMENT = os.environ["AZURE_OPENAI_DEPLOYMENT"]   # 모델명이 아니라 배포 이름

SYSTEM = (
    "너는 사용자의 자연어 요청을 등록된 도구 호출로 변환하는 어시스턴트다. "
    "요청에 맞는 도구가 있으면 반드시 도구를 호출하고, 없으면 없다고 답하라. "
    "위경도가 필요하면 한국의 실제 좌표를 사용하라."
)

@router.post("/api/projects/{project_id}/llm-test")
def select_tool(project_id: int, payload: dict, db: Session = Depends(get_session)) -> dict:
    actions = db.exec(
        select(Action).where(Action.project_id == project_id).where(Action.status == "ACTIVE")
    ).all()
    if not actions:
        raise HTTPException(400, "활성화된 액션이 없습니다")

    tools = [action_to_tool(a) for a in actions]
    by_name = {t["function"]["name"]: a for t, a in zip(tools, actions)}

    response = client.chat.completions.create(
        model=DEPLOYMENT,
        max_tokens=4096,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": payload["query"]},
        ],
        tools=tools,
        tool_choice="auto",
    )

    message = response.choices[0].message
    if not message.tool_calls:
        return {"selectedTool": None, "reason": message.content or "적합한 도구를 찾지 못했습니다."}

    call = message.tool_calls[0]
    action = by_name[call.function.name]
    return {
        "selectedTool": call.function.name,
        "actionId": action.id,
        "actionName": action.name,
        # arguments는 JSON 문자열로 온다
        "arguments": json.loads(call.function.arguments),
        "reason": message.content or "",
    }

@router.post("/api/actions/{action_id}/execute")
def execute(action_id: int, payload: dict, db: Session = Depends(get_session)) -> dict:
    action = db.get(Action, action_id)
    if action is None:
        raise HTTPException(404, "action not found")

    result = execute_action(action, payload["arguments"])

    summary_response = client.chat.completions.create(
        model=DEPLOYMENT,
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": (
                f"사용자 질문: {payload.get('query', '')}\n\n"
                f"API 응답(일부): {result['rawPreview']}\n\n"
                "이 결과를 한국어 두세 문장으로 요약해라."
            ),
        }],
    )

    return {**result, "summary": summary_response.choices[0].message.content or ""}
```

`main.py`에 라우터 3개(`analysis`, `actions`, `llm`)를 모두 등록한다.

- [ ] **Step 2: 콘솔 화면 구현**

```tsx
// apps/admin/src/pages/LlmConsole.tsx
import { useState } from "react";
import { api } from "../api/client";

export default function LlmConsole() {
  const [query, setQuery] = useState("광화문 근처 아파트 단지 알려줘");
  const [selection, setSelection] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true); setResult(null);
    try { setSelection(await api.post(`/api/projects/1/llm-test`, { query })); }
    finally { setBusy(false); }
  }

  async function run() {
    setBusy(true);
    try {
      setResult(await api.post(`/api/actions/${selection.actionId}/execute`, {
        arguments: selection.arguments, query,
      }));
    } finally { setBusy(false); }
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900 }}>
      <h1 style={{ fontSize: 20 }}>LLM 테스트 콘솔</h1>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} style={{ flex: 1, padding: 10 }} />
        <button onClick={ask} disabled={busy} style={{ padding: "10px 20px" }}>질의</button>
      </div>

      {selection && (
        <div style={{ marginTop: 20, border: "1px solid #ddd", padding: 16, borderRadius: 6 }}>
          <div>선택된 Tool: <strong>{selection.selectedTool ?? "없음"}</strong></div>
          {selection.reason && <p style={{ color: "#666", fontSize: 13 }}>{selection.reason}</p>}
          {selection.arguments && (
            <pre style={{ background: "#f8f8f8", padding: 12, fontSize: 12, overflowX: "auto" }}>
              {JSON.stringify(selection.arguments, null, 2)}
            </pre>
          )}
          {selection.actionId && (
            <button onClick={run} disabled={busy}
              style={{ padding: "10px 20px", background: "#16a34a", color: "#fff", border: 0, borderRadius: 6 }}>
              이 내용으로 실행
            </button>
          )}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 20, border: "1px solid #16a34a", padding: 16, borderRadius: 6 }}>
          <div>HTTP {result.status} · {result.elapsedMs}ms</div>
          <p style={{ fontSize: 15, marginTop: 8 }}>{result.summary}</p>
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer", fontSize: 13 }}>원본 응답 보기</summary>
            <pre style={{ background: "#f8f8f8", padding: 12, fontSize: 11, maxHeight: 300, overflow: "auto" }}>
              {result.rawPreview}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 수동 검증 — 영상 장면 8~10**

```bash
export AZURE_OPENAI_ENDPOINT="https://<리소스명>.openai.azure.com/"
export AZURE_OPENAI_API_KEY=...
export AZURE_OPENAI_DEPLOYMENT="<배포 이름>"
cd apps/backend && .venv/bin/uvicorn app.main:app --reload
```

"광화문 근처 아파트 단지 알려줘" → Tool과 좌표 6개가 표시 → 실행 → HTTP 200과 단지 목록 요약.

- [ ] **Step 4: 커밋**

```bash
git add apps/backend apps/admin
git commit -m "LLM 테스트 콘솔 구현 — 도구 선택, 사용자 확인, 실행"
```

---

## Task 15: 시드 데이터와 리허설

**Files:**
- Create: `apps/backend/app/seed.py`, `docs/demo-script.md`
- Modify: `apps/backend/app/main.py`

- [ ] **Step 1: 시드 작성**

```python
# apps/backend/app/seed.py
from sqlmodel import Session, select
from app.db import engine
from app.models import Project

SEEDS = [
    {"name": "국토교통부 실거래가", "allowed_origins": ["https://rt.molit.go.kr"]},
    {"name": "국가통계포털 KOSIS", "allowed_origins": ["https://kosis.kr"]},
]

def seed() -> None:
    with Session(engine) as db:
        for item in SEEDS:
            exists = db.exec(select(Project).where(Project.name == item["name"])).first()
            if not exists:
                db.add(Project(**item))
        db.commit()
```

`main.py`의 `_startup`에서 `init_db()` 다음에 `seed()`를 호출한다.

- [ ] **Step 2: 전체 흐름 리허설**

영상 시나리오 10장면을 처음부터 끝까지 한 번에 수행하고, 각 장면의 소요 시간과 막히는 지점을 기록한다. 특히 확인할 것:

- 지도 클릭이 `interactionId`로 연결되는가 (드래그는 연결되지 않는다)
- 세션 상세에서 `accesLog.do`가 최하위인가
- WAF에 막히지 않는가

- [ ] **Step 3: 촬영 대본 작성**

`docs/demo-script.md`에 장면별 조작·대사·예상 소요를 적는다. 영상에는 이 데모가 **프로토타입**임을 한 줄 표기한다.

- [ ] **Step 4: 커밋**

```bash
git add apps/backend/app/seed.py docs/demo-script.md
git commit -m "시드 데이터와 촬영 대본 추가"
```

---

## 리스크와 대응

| 리스크 | 징후 | 대응 |
| --- | --- | --- |
| 지도 이동이 클릭으로 잡히지 않음 | `interactionId`가 `null` | 드래그 대신 확대/축소 버튼 클릭으로 촬영. 그래도 안 되면 상관 시간 창을 클릭 없이도 열어두는 폴백 |
| 실거래가 WAF 강화 | 실행 시 400 | 브라우저 요청 헤더를 전부 복사해 재현. Task 13의 `PRESERVED_HEADERS` 확장 |
| LLM이 좌표를 엉뚱하게 생성 | 빈 `list` 반환 | 파라미터 설명에 예시 좌표를 명시. `example` 값을 description에 포함 |
| LLM이 도구를 안 부름 | `tool_calls`가 비어 있음 | `tool_choice="auto"`를 `{"type":"function","function":{"name":"..."}}`로 강제. 파라미터 description이 비어 있지 않은지 확인 |
| Azure 배포명 혼동 | 404 DeploymentNotFound | `model=`에 모델명이 아니라 **배포 이름**을 넣었는지 확인 |
| 2주 안에 못 끝냄 | 6일차에 Task 10 미완 | Task 11의 파라미터 편집을 읽기 전용으로 축소, Task 14의 요약 생성 생략 |
