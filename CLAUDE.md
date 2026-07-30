# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트

브라우저에서 API를 수집해 LLM이 호출할 수 있는 액션으로 바꾸는 도구다.
수집 방식은 traffic(화면이 부른 호출 관측) / portal(포털이 공개한 명세 파싱) /
document(문서 변환, 미구현) 셋이며, RecordingSession.kind 로 갈린다.
후보를 만드는 방식만 다르고 Action 이후(실행·LLM 콘솔)는 전부 공유한다. 대회 제출 영상용 프로토타입이며,
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
cd apps/admin && npx tsc -b               # --noEmit 은 파일 0개를 검사한다

# 확장 프로그램
cd apps/extension && npm run build      # .output/chrome-mv3 를 압축해제 확장으로 로드
cd apps/extension && npm test           # vitest
cd apps/extension && npm run compile    # tsc --noEmit
```

`apps/admin` 의 타입체크는 `tsc -b` 다. `tsc --noEmit` 은 `tsconfig.json` 이
`"files": []` + `references` 인 Vite 기본 구조라 **파일 0개를 검사하고 통과한다**
(`npx tsc --noEmit --listFiles` 가 빈 출력이다). 이 차이로 `Cannot find name` 오류가
타입체크를 통과해 런타임까지 갔다. `apps/extension` 의 `npm run compile` 은
`.wxt/tsconfig.json` 을 extends 해 소스를 실제로 검사하므로 그대로 쓴다.

백엔드를 재시작할 때는 `lsof -ti tcp:8000 -sTCP:LISTEN | xargs kill` 을 쓴다. `/tmp/backend.pid` 는
낡아 있을 수 있고, 그러면 이전 커밋의 코드를 문 uvicorn 이 포트를 계속 쥔 채
조용히 낡은 라우트를 서빙한다.

## 구조

```
apps/extension/  Chrome 확장 (WXT + React) — 트래픽 기록 + 포털 명세 감지·전송
apps/backend/    FastAPI + SQLModel + SQLite — 점수화·스키마 추론·실행·LLM
apps/admin/      React + Vite — 프로젝트 → 세션 → 액션 계층 화면
```

DB 는 `apps/backend/data/dev.db` 파일 하나다. 마이그레이션은 없고 기동 시 생성된다.

`init_db()` 는 없는 **테이블**만 만들고 **컬럼** 추가는 못 한다. 모델에 필드를
더한 커밋을 받으면 낡은 `dev.db` 로는 서버가 뜨는 순간 깨진다
(`sqlite3.OperationalError: no such column`). 기동 시 `seed()` 가 그 테이블을
읽으므로 테스트까지 전부 실패한다 — 실제로 48건이 났다. 데이터가 아깝지 않으면
`rm -f apps/backend/data/dev.db` 가 가장 빠르고, 아까우면 `ALTER TABLE ... ADD
COLUMN ... DEFAULT ...` 로 컬럼만 더한다 (SQLite 는 기존 행에 기본값을 채워준다).

가장 최근에 늘어난 컬럼은 `Project.description` 이다(프로젝트 카드의 설명 두 줄).
그 이전 `dev.db` 를 들고 있으면 `no such column: project.description` 으로 서버가
뜨지 않는다. 데이터를 지우지 않고 넘기려면:

```bash
cd apps/backend && cp data/dev.db data/dev.db.bak && .venv/bin/python -c \
  "import sqlite3; sqlite3.connect('data/dev.db').execute(\
   \"ALTER TABLE project ADD COLUMN description TEXT NOT NULL DEFAULT ''\")"
```

## 여러 파일을 읽어야 보이는 것

**기록 경로.** `entrypoints/injected.ts` 가 Main World 에서 `fetch`/`XHR` 을 후킹해
`postMessage` 로 던지고, `entrypoints/content.ts` 가 받아 검증한 뒤
`entrypoints/background.ts` 로 보낸다. 배경 스크립트의 상태는 전부
`chrome.storage.session` 에 있고 모든 변경은 `enqueue()` 로 직렬화된다 —
동시 read-modify-write 가 이벤트를 덮어쓰기 때문이다. 바이트 계산은
`TextEncoder` 를 쓴다. 한글은 UTF-8 로 3바이트라 문자 수 기준 상한은 10MB 할당량을
넘긴다.

**포털 공개 수집 경로.** 확장 `lib/spec-detect.ts` 가 페이지를 판정하고,
`content.ts` 의 `capture-spec` 핸들러가 현재 DOM 을 통째로 넘긴다.
`background.ts:collectSpec` → `POST /api/projects/{id}/spec-sessions` →
`services/spec_parser.py:parse` → `SpecOperation`. **이 경로에서는 서버가 포털에
접속하지 않는다** — 사용자가 이미 연 페이지의 DOM 만 확장이 넘긴다.
포털을 늘리려면 `spec_parser.PARSERS` 에 함수 하나만 등록하면 된다.

**포털 일괄 수집 경로는 서버가 직접 접속한다** (`services/portal_crawler.py`,
`crawl_runner.py`). 목록 URL 하나로 상세페이지들을 열고, 상세기능 전환이
`POST /tcs/dss/selectApiDetailFunction.do` 로 조각 HTML 을 주는 점을 이용해 서비스당
오퍼레이션 전부를 모은다. 수십 초가 걸려 `CrawlJob` 에 진행 상태를 남기고 화면이 폴링한다.

앞서 이 문서는 "서버는 포털에 직접 접속하지 않는다"고 적고 근거로 robots.txt 를 들었다.
**그 근거는 실제보다 셌다.** `data.go.kr/robots.txt` 는 목록 페이지를
`User-agent: Googlebot` 에 대해서만 Disallow 하며 `User-agent: *` 그룹이 없다 —
Googlebot 이 아닌 수집은 그 규칙의 대상이 아니다. 원본을 확인하지 않고 이 문서만 읽으면
일괄 수집을 "설계 위반"으로 오판한다.

로봇 규칙과 별개로 상대는 공공 서버다. `portal_crawler.py` 가 지키는 것을 낮추지 않는다 —
요청 간 `MIN_INTERVAL_SEC = 1.0` (실행기와 같은 기준), `MAX_LIMIT = 60`, 스케줄러 없음,
사용자가 URL 을 등록했을 때만 동작.

상세페이지는 상세기능을 select 로 전환하므로 **초기 HTML 에는 하나의 명세만 있다.**
그래서 같은 서비스를 다시 수집하면 새 세션을 만들지 않고 직전 세션에 누적한다
(`routers/spec.py`).

"전체 5개 중 2개 수집됨"을 밝히는 곳은 **확장 사이드 패널**이다. 수집 응답의
`availableTotal`·`collected` 을 그 자리에서 쓴다 — 개수가 가장 필요한 순간이
수집 직후이기 때문이다. 전체 개수는 그 순간 HTML 의 select 에서만 알 수 있고
**저장하지 않으므로**, 관리자 세션 상세에는 숫자가 없다. 대신 "상세기능을 목록에서
하나씩 보여줍니다"라는 문구로 이유를 밝힌다. 관리자에도 숫자를 띄우려면
`RecordingSession` 에 컬럼을 더해야 하고, 마이그레이션이 없으므로 기존 `dev.db` 가
깨진다.

**세션 상세는 수집 방식별로 경로가 다르다** — 트래픽은 `/sessions/:id`,
포털은 `/spec-sessions/:id`. 포털 세션을 `/sessions/:id` 로 열면 트래픽 화면이
뜨고 클릭·요청을 찾으므로 "클릭과 연결된 요청이 없습니다"만 보인다. 오퍼레이션이
멀쩡히 수집돼 있는데도 실패로 읽힌다 (확장의 "관리자에서 열기" 가 실제로 이 버그를
냈다).

**인증키.** 포털 공개 수집 액션은 `serviceKey` 를 `llmEditable=False` 로 두어
LLM 에게 감춘다(`schema_infer.CREDENTIAL_PARAMS`). 실행 직전
`executor._inject_credentials` 가 `Project.credentials` 에서 채우고, 없으면
호출 전에 막는다 — 인증 없이 나간 400 을 스펙 문제로 오해하는 편이 더 비싸다.

**액션 생성 경로.** `NetworkRequest` → `services/schema_infer.py:build_action_spec`
→ `Action.action_spec`. 액션은 요청을 **참조하지 않고 값을 복사해 둔다.** 그래서
기록 세션을 지워도 액션은 그대로 실행된다 (`routers/sessions.py` 의 삭제 라우터가
액션을 건드리지 않는 이유).

**실행 경로.** `services/tool_registry.py:action_to_tool` 이 OpenAI 도구 정의를 만들고
(파라미터의 `example` 을 description 에 실어 보낸다 — 없으면 모델이 값을 지어낸다),
`routers/llm.py` 가 Azure 를 호출하고, `services/executor.py` 가 실제 HTTP 를 보낸다.

**엔진은 장소가 아니라 수집 사건의 속성이다** (`RecordingSession.kind`). 화면도 그렇게
맞춰져 있다 — 프로젝트가 작업의 중심이고, 수집 시작은 프로젝트 안
`+ 수집 시작` 팝업(`components/CollectStartModal.tsx`)에서 엔진을 골라 그 엔진의
시작 지점으로 간다. **팝업은 세션을 만들지 않는다** — 세션은 실제 수집(확장의 업로드
또는 `CrawlJob`)이 만든다. 빈 세션을 먼저 만드는 흐름을 넣으면 "만들었는데 아무것도
없는 것"이 생기고 `RecordingSession` 에 상태 컬럼이 필요해져 마이그레이션 없는
`dev.db` 가 깨진다.

한때 `수집 엔진`(`/sources`)이 사이드바 맨 위이고 일괄 수집 폼도 거기 있었다.
프로젝트 목록이 **이름·ID·삭제**만 보여줘 수집 과정이 안 보였기 때문인데, 처방을
잘못된 층에 붙인 것이었다. 프로젝트가 필요한 폼이 프로젝트 없는 페이지에 놓여
드롭다운으로 우회했고, 그 폼 때문에 카드 높이가 어긋나 공백이 생겼다. 프로젝트
목록에 엔진 배지를 달아 원래 문제를 풀고 `/sources` 는 설명 전용으로 돌렸다.
**`/sources` 에 산출물 숫자를 다시 넣지 않는다** — 프로젝트 목록 배지와 범위가 달라
(전체 합산 vs 프로젝트 하나) 두 숫자가 어긋나면 버그로 읽힌다.

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
