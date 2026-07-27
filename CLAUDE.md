# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트

브라우저에서 사용자의 클릭과 그 클릭이 유발한 API 호출을 기록하고, 그중 하나를 골라
LLM이 호출할 수 있는 액션으로 바꾸는 도구다. 대회 제출 영상용 프로토타입이며,
로그인·프로젝트 CRUD·MCP 엔드포인트는 아직 없다.

사용자 안내 문서는 `README.md`, 촬영 절차는 `docs/demo-script.md`에 있다.

## 명령

```bash
# 백엔드 (:8000) — 기동 시 init_db() + seed() 가 자동 실행된다
cd apps/backend && .venv/bin/uvicorn app.main:app --port 8000
cd apps/backend && .venv/bin/pytest tests/ -v
cd apps/backend && .venv/bin/pytest tests/test_masking.py -k 마스킹 -v   # 일부만 실행

# 관리자 화면 (:5173)
cd apps/admin && npm run dev
cd apps/admin && npx tsc --noEmit

# 확장 프로그램
cd apps/extension && npm run build      # .output/chrome-mv3 를 압축해제 확장으로 로드
cd apps/extension && npm test           # vitest
cd apps/extension && npm run compile    # tsc --noEmit
```

백엔드를 재시작할 때는 `lsof -ti tcp:8000 -sTCP:LISTEN | xargs kill` 을 쓴다. `/tmp/backend.pid` 는
낡아 있을 수 있고, 그러면 이전 커밋의 코드를 문 uvicorn 이 포트를 계속 쥔 채
조용히 낡은 라우트를 서빙한다.

## 구조

```
apps/extension/  Chrome 확장 (WXT + React) — 클릭·네트워크 기록
apps/backend/    FastAPI + SQLModel + SQLite — 점수화·스키마 추론·실행·LLM
apps/admin/      React + Vite — 프로젝트 → 세션 → 액션 계층 화면
```

DB 는 `apps/backend/data/dev.db` 파일 하나다. 마이그레이션은 없고 기동 시 생성된다.

## 여러 파일을 읽어야 보이는 것

**기록 경로.** `entrypoints/injected.ts` 가 Main World 에서 `fetch`/`XHR` 을 후킹해
`postMessage` 로 던지고, `entrypoints/content.ts` 가 받아 검증한 뒤
`entrypoints/background.ts` 로 보낸다. 배경 스크립트의 상태는 전부
`chrome.storage.session` 에 있고 모든 변경은 `enqueue()` 로 직렬화된다 —
동시 read-modify-write 가 이벤트를 덮어쓰기 때문이다. 바이트 계산은
`TextEncoder` 를 쓴다. 한글은 UTF-8 로 3바이트라 문자 수 기준 상한은 10MB 할당량을
넘긴다.

**액션 생성 경로.** `NetworkRequest` → `services/schema_infer.py:build_action_spec`
→ `Action.action_spec`. 액션은 요청을 **참조하지 않고 값을 복사해 둔다.** 그래서
기록 세션을 지워도 액션은 그대로 실행된다 (`routers/sessions.py` 의 삭제 라우터가
액션을 건드리지 않는 이유).

**실행 경로.** `services/tool_registry.py:action_to_tool` 이 OpenAI 도구 정의를 만들고
(파라미터의 `example` 을 description 에 실어 보낸다 — 없으면 모델이 값을 지어낸다),
`routers/llm.py` 가 Azure 를 호출하고, `services/executor.py` 가 실제 HTTP 를 보낸다.

## 밟으면 아픈 것들

- **WAF.** 대상 사이트는 `User-Agent`·`Referer`·`X-Requested-With` 가 없으면 400 을
  낸다. 헤더를 골라 저장하는 쪽은 `services/schema_infer.py` 의 `PRESERVED_HEADERS`,
  기본값만 채우는 쪽은 `services/executor.py` 다.
- **도구 호출 강제.** `tools` 만 넘기면 모델이 도구를 부르지 않고 되묻는다. 한국어
  시스템 메시지와 `tool_choice="required"` 를 **함께** 보내야 한다.
- **`max_tokens` 금지.** 이 Azure 배포는 `max_completion_tokens` 를 요구한다.
- **JSON 판정은 Content-Type 이 아니라 파싱 시도로 한다.** 대상 사이트가
  `text/html` 로 JSON 을 보낸다.
- **호출 간격 `MIN_INTERVAL_SEC = 1.0`.** 공공 서버 배려용이므로 낮추지 않는다.
- **응답 본문 원문은 저장하지 않는다.** 구조 + 샘플 1건만 (`services/body.py`).
- **마스킹은 세 곳.** URL 쿼리·요청 본문·응답 샘플 (`services/masking.py`).

## 규칙

- Python 3.10.11 (3.11+ 문법 금지), Node v25.8.0, npm workspaces
- Docker·pnpm·uv 를 쓰지 않는다
- 주석·UI 문구·커밋 메시지는 한국어
- 새 프런트엔드 의존성을 들이지 않는다. CSS 는 `apps/admin/src/styles/app.css` 한 파일
- 화면에 뜨는 숫자와 문구는 실제 데이터로 뒷받침되어야 한다
- `window.confirm`·`alert`·`prompt` 를 쓰지 않는다 (자동화를 막고 촬영 화면에서 튄다)
- `apps/backend/.env` 와 `.mcp.json` 은 절대 커밋하지 않는다
