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
cd apps/backend && .venv/bin/pytest tests/test_ieum_gateway.py tests/test_ieum_units.py -v   # 이음
cd apps/backend && .venv/bin/pytest tests/test_ieum_hitl.py -v   # 사람과 함께 탐색하기의 규칙(브라우저 없음, 1초)
cd apps/backend && IEUM_SKIP_BROWSER_TESTS=1 .venv/bin/pytest tests/ -q   # 실제 브라우저 시험(탐색 e2e 합쳐 10분 가까이)을 건너뛴다

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
apps/web/ieum/   이음 관리 콘솔 (바닐라 JS, 빌드 없음) — 백엔드가 /ieum/ 에서 서빙
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

**이음 게이트웨이는 별개 기능이다** (`apps/backend/app/ieum/`, 콘솔은 `apps/web/ieum`).
레거시 시스템의 명세(OpenAPI·WSDL·호출 샘플)를 AI 도구로 바꿔 MCP 서버로 배포한다.
수집·액션·LLM 콘솔과 코드를 공유하지 않고 SQLite 도 쓰지 않는다 — 모든 데이터는 JSON
파일(`store.JsonStore`)이다. 메뉴별 시드(`app/ieum/data/`)를 읽고 변경분은
`apps/backend/data/ieum/` 에 쓴다. 같은 `app.main` 에 붙으므로 `./start.sh` 가 함께 띄운다.
`app.main` 에서 `include_router(ieum_router)` 와 `mount_console(app)` 은 맨 아래 관리자 화면의
`/` 마운트보다 **먼저** 불러야 한다. 앞선 `/` 마운트가 `/ieum/` 요청을 삼킨다.
응답은 `{resultCode, resultMsg, resultData}` 봉투이고 HTTP 상태도 resultCode 와 같다(`responses.py`).
원본 시스템 인증 정보는 Fernet 으로 암호화해 `source_secrets.enc` 에 두는데, 키는
`IEUM_SECRET_KEY` 또는 같은 폴더의 `.secret_key` 다. 둘은 짝이라 하나만 지우면 못 읽는다.

**API 자동 탐색은 이음의 2차 범위다** (`app/ieum/discovery/`, 화면 `apps/web/ieum/js/menu/discovery.js`).
명세가 없는 레거시 시스템에서 API 를 찾는다. 헤드리스 브라우저(`crawler.py`)가 서비스 계정으로 로그인해 메뉴를
돌며 요청을 캡처하고, Git 소스 분석(`scan/`)이 컨트롤러·매퍼를 읽고, `merge.py` 가 둘을 경로로 맞추고,
`verify.py` 가 읽기 API 를 다시 불러 확인하고, `jobs.py` 가 작업 수명(이벤트 스트림, 취소, 예약, 등록)을 맡는다.
화면은 `GET /api/ieum/discovery/jobs/{id}/?after=<seq>` 를 폴링해서 이벤트를 그대로 그린다. 헤드리스 브라우저가
보는 화면은 `.../shot` 이 돌려주는 실제 JPEG 이다. 작업은 JSON(`discovery.jobs`)에 남고, 서버가 재시작되면 돌던 작업은
`interrupted` 가 된다. 시연 대상은 `demo_legacy/`(가짜 구매관리 사이트와 Java 소스 샘플)이며 실제 시스템이 아니다.
**쓰기를 막는 곳은 클릭 선택이 아니라 네트워크다.** 누르지 않을 단어는 사람이 읽을 이유를 남기려는 1차 장치이고,
안전을 지키는 것은 `crawler._route_inner` 가 POST/PUT/PATCH/DELETE 를 전부 가로채 운영에 보내지 않는 것이다(예외: 로그인, 사용자가 지정한 조회용 POST,
**사람이 허락한 "이름이 조회처럼 보이는 POST"**(`reads.looks_read`, POST 만) — 아래 "자바스크립트로 그리는 사이트" 참고). 로드 시 XHR 로 부르는 GET 중 이름이 쓰기처럼 보이는 것(`policy.risky_call`)도 가로챈다.
금지어를 비워도 쓰기가 닿지 않는다는 것을 `test_ieum_discovery_e2e.py` 가 서버 데이터로 확인한다. 이 규칙을 느슨하게 하지 않는다.
**소스 분석은 별도 프로세스에서 돈다**(`scan_proc.py`, 시간 제한 120초). 사용자가 준 저장소의 병적인 파일(열린 괄호 수만 개 등)은
정규식을 역추적에 빠뜨리는데, 파이썬 정규식은 GIL 을 놓지 않아서 스레드로 돌리면 **서버 전체가 멈춘다**. 프로세스로 돌리면
제한을 넘는 순간 강제로 끝내고 취소도 즉시 먹는다. 스캐너를 직접 부르는 시험(`test_ieum_scan.py`)과 달리 작업 경로는 항상 `scan_proc.run` 을 거친다.
심볼릭 링크는 따라가지 않고 1MB 넘는 파일은 건너뛴다.
읽기 검증 호출(`verify.py`)은 읽기로 증명된 것(화면이 이미 GET 으로 성공했거나 소스가 SELECT 로 확인)만 운영에 보내고,
쓰기는 사용자가 스테이징 주소를 줬을 때만 스테이징에 보낸다.
등록한 도구는 `session` 인증으로 실행된다: 탐색이 로그인 요청에서 알아낸 레시피(필드 이름)로 `gateway/session_auth.py` 가
서비스 계정에 로그인하고, 세션이 끊기면 한 번 다시 로그인해 재시도한다. 계정 비밀번호와 Git 토큰은 작업 설정에 남기지 않고
금고(`disc:<작업 id>` 키)에만 둔다. 브라우저는 번들 Chromium → 시스템 Chrome → Edge 순이라 `playwright install` 없이도 돈다.

**사람과 함께 탐색하기(HITL)** (`discovery/hitl.py` 상태·규칙, `planner.py` 계획·용도, 크롤러·작업·라우터가 읽고 쓴다). 탐색 목적과 질문 예시를
받아 (1) 메뉴를 열 순서를 정하고 (2) 판단하기 어려운 곳에서 질문을 남기고 (3) 일시정지·말로 하는 지시·직접 조작을 받고 (4) 찾은 API 에 용도와
이어지는 질문을 붙인다. 알아 둘 것:
- **`Hitl` 은 브라우저를 모른다.** Playwright 는 크롤러 스레드만 부른다. `Crawler(hitl=None)` 이면 예전 그대로 사람 없이 도는 탐색이라 계획·질문이 전혀 없다(크롤러 단위 시험이 이쪽이다). `jobs` 는 항상 `Hitl` 을 넘기고, 옵션 `hitl` 을 생략하면 `never`(묻지 않고 안전한 쪽으로).
- **크롤러는 질문을 남기고 기다리지 않는다.** 질문마다 `task`(눌러 보기·값 넣고 누르기·화면 다시 열기)를 달아 두고, 답이 나오면 큐 경계에서 `_apply_answers` 가 `Entry(again=True)` 로 **그 화면을 다시 열어** 처리한다. 질문은 한 번에 하나만 카드가 되고 시간은 그 질문에만 흐른다(`Hitl.tick`, 시험은 시계를 주입한다).
  큐는 둘이다: 계획 안은 `_pick_menu` 가 계획 순서로 뽑고(`rel` 높은 것부터, 낮은 것은 `_low_gate` 가 묻는다), 메뉴 안에서 찾은 화면은 `_front`, 그 밖은 `_queue`. 화면마다 이미 본 버튼은 `_tried` 에 둬서 다시 열어도 처음부터 또 누르지 않는다.
- **사람이 눌러도 된다고 한 버튼도 요청은 운영에 닿지 않는다.** `_route_inner` 는 `_pressing` 중에 화면 이동(document)도 막고(`nav_block`), 막은 화면 이동은 abort 가 아니라 **204 로 채워** 브라우저가 그 화면에 머물게 한다(abort 하면 오류 화면 `chrome-error://` 로 넘어가 `_return_to` 가 돌아오느라 느리고 "열 수 없는 주소" 기록이 남는다).
  직접 조작(`_take_over`)에서 풀어 주는 것은 로그인 경로 POST(`_LOGIN_PATH`)뿐이고, 쓰기처럼 보이는 GET 화면 이동(`risky_call`)은 직접 조작 중에도 막는다. 이 규칙을 느슨하게 하지 않는다.
- **직접 조작은 세션을 갈아 끼운다.** 시작할 때 쿠키를 저장하고(`fresh` 면 비우고 시작 화면=로그인에서 출발), 끝나면 지우고 되돌린 뒤 로그인 직후 화면으로 간다. 하던 화면은 `_abandon` 으로 접고 `again` 으로 다시 올린다 — 화면에 붙인 `data-ieum-i` 번호가 새로고침으로 달라져 옛 후보를 누르면 엉뚱한 요소(금지어 버튼)를 누를 수 있어서다.
  사람이 입력한 글자는 어디에도 남기지 않는다(이벤트에도 `take` 횟수만). 쉬는 시간(일시정지·직접 조작·질문 대기)은 `_idle_begin/_end` 로 세어 시간 상한에서 뺀다(겹칠 수 있어 깊이를 센다).
- **락 순서: `hitl.lock` → `job.lock` 만 허용한다.** `Hitl` 의 기록·질문 알림 콜백이 `job.emit`(작업 락)을 부르기 때문이다. 작업 락을 쥔 채 `Hitl` 을 부르면 서로 기다린다. `Job.view` 는 `hitl.view()` 를 작업 락 **밖에서** 읽고, `Job.save` 는 스냅샷을 먼저 뜨고 나서 락을 잡는다.
- **질문 시점 화면은 메모리에만** 둔다(`Hitl.shots`, `.../qshot/{qid}`). 직접 조작 중 화면 캡처 번호는 이벤트 없이 바뀌므로 화면은 작업 응답의 `shotSeq` 로 새로 받는다(이벤트의 `shot` 만 믿으면 갱신을 놓친다).
- **용도 열쇠(`planner.api_key`)** 는 메서드 + 확장자·쿼리·경로변수 이름을 뗀 경로다. 탐색 중 요청 줄(`api`)과 합쳐진 API(`key`)가 같은 열쇠여야 사람이 기입한 용도(`Hitl.purp`)가 둘 다에 적용된다. 규칙으로 정한 용도·질문 연결은 **추정**이다: 쓰기 API 는 이름이 겹친다고 잇지 않고, 여러 메뉴에서 불린 API 는 메뉴의 질문을 물려받지 않는다.
- 시험에서는 `llm.provider` 를 None 으로 막는다(`test_ieum_discovery_hitl.py`). 안 막으면 `.env` 의 Azure 설정으로 **진짜 GPT 를 부른다**(스크래치 서버도 마찬가지).
- 스크래치 스크립트로 서버를 띄울 때는 `if __name__ == "__main__":` 가드를 둔다. 소스 분석은 `multiprocessing` `spawn` 이라 자식이 `__main__` 을 다시 읽어, 가드가 없으면 서버가 또 떠서 "소스 분석 프로세스가 비정상으로 끝났습니다" 가 난다.

**자바스크립트로 그리는 사이트(SPA)와 조회도 POST 인 사이트** (나라장터 WebSquare 가 기준. `crawler.py`, `reads.py`). 일반 사이트 기준으로 만든 탐색이 거기서는 "2개 호출하고 끝" 이거나 "화면은 뜨는데 요청이 전부 차단" 이 된다. 실측으로 확인한 원인과 그 대응:
- **눌러볼 것이 DOMContentLoaded 5~6초 뒤에야 생긴다.** 그 전에 훑으면 아무것도 못 찾고 끝난다. `_goto` 는 `_ready` 로 기다린다: 눌러볼 것 3개 이상 + `readyState == complete`(또는 한두 개뿐이어도 1.4초 변화 없음), 그리고 DOM 잠잠함(`_quiet`).
  눌러볼 것의 **수만** 보면 스크립트를 내려받는 동안 건너뛰기 링크 몇 개에 속는다. 처음 여는 화면(`boot=True`)만 14초, 그 밖은 3초.
- **시작하자마자 모달 팝업 4개가 메뉴를 가린다**(`role=dialog`, z-index 6010). 가려진 단추를 누르면 Playwright 가 30초 기다리다 실패한다. `_dismiss_overlays` 가 가장 위 팝업의 닫기·창닫기·X → 취소 → (단추가 하나뿐인 안내 창의) 확인 순으로 닫는다.
  눌러서 뜬 "안내 메시지" 창도 같은 방식으로 닫고, 누르기가 가로채여 실패하면 닫은 뒤 한 번 더 누른다. 직접 조작 중(`_taking`)에는 닫지 않는다.
- **메뉴가 `href="javascript:void(null)"` + 숨은 하위 메뉴.** 링크로 못 간다. `_MENU_LIB_JS` 가 NAV 영역의 `li` 나무를 읽어(숨어 있어도 DOM 에는 있다) 끝 노드를 **메뉴 길**(`Entry.path`, 계획 항목의 `path`·`leaf`)로 만들고, `_run_path` 가 위에서부터 올려 보고(hover) 안 열리면 누른다.
  주소가 안 바뀌므로 `_open_path` 는 이미 앱이 열려 있으면 다시 불러오지 않는다(화면마다 앱을 띄우면 팝업과 처음 조회가 되풀이된다). 길로 연 화면의 이름은 **끝 메뉴 이름**이다 — 제목에 `" > "` 가 들어가면 `infer.screen_title` 이 헤딩과 동작을 잘못 나눈다.
  **이미 본 버튼(`_tried`)은 화면 단위다**(주소 + 메뉴 길). 주소로만 세면 두 번째 화면의 "조회" 가 이미 눌렀다며 건너뛰어진다. 계획에 눌러서 여는 메뉴가 있으면 메뉴 영역(`nav` 표지)의 단추는 계획이 맡으므로 일반 훑기에서 뺀다.
  질문의 `task` 에는 `path` 를 싣는다(눌러서 여는 화면은 주소로 다시 갈 수 없다). 메뉴 이름에 누르지 않을 단어가 있으면 계획에서 `excl` 로 건너뛴다.
- **화면을 가리는 것은 팝업만이 아니다**(나라장터에서 실측). (1) 마우스를 올리면 펼쳐지는 mega menu 는 말단을 눌러도 마우스가 그 위에 있으면 펼쳐진 채로 화면을 덮는다(`menu-dpt2-show`) → `_park_mouse` 로 마우스를 구석에 치운다(메뉴를 누른 뒤, 화면을 훑기 전, 가려서 실패했을 때).
  (2) 파일 미리보기 같은 층의 마스크(`#upload_background`)는 Esc 로도 안 닫힐 수 있다 → 그 화면은 그만 누르고(`_masked`) 다음 메뉴는 앱을 다시 열어서 간다(`_dirty`). (3) 같은 팝업이 같은 높이로 4개 겹치면 어느 것이 위인지 모르고, 가려진 팝업의 닫기는 눌러도 닫히지 않는다 → `_OVERLAY_JS` 는 후보를 모두 돌려주고
  `_dismiss_overlays` 가 차례로 시도하며, 눌러서 안 되면 자바스크립트 `el.click()` 으로 닫는다. **읽기를 허락하기 전에는 이 공지 팝업이 내용 없이 뜨지 않아서**(`{}` 응답) 문제가 안 보이다가, 허락하면 실제 공지로 뜨며 메뉴를 가린다.
- **눌리지 않는 후보가 시간을 다 쓴다**(실측: 눌러 보기 4초 × 수십 개 → 300초 상한). 후보 JS(`visible`)는 문서 좌표로 화면 왼쪽·위쪽 밖(`left:-9999px` 접근성용 숨김, 넘겨 놓은 슬라이드)과 고정 위치 조상 안의 화면 밖 요소(오른쪽 퀵 메뉴, TOP)를 뺀다(스크롤 상자 안은 Playwright 가 스크롤해서 닿으니 둔다).
  **못 누른 시도는 `acted`(성공 수)에 안 세어져 `MAX_ACTIONS` 에 안 걸린다** → `MAX_TRIES`(시도 30), `MAX_FAILS`(연속 실패 5)로 따로 막고, 단추별로 못 누른 횟수(`_bad`)가 2번이면 다음 화면에서는 건너뛴다. 누르기 제한 시간은 3초, 가림을 치우고 다시 누를 때는 1.5초다. 못 누른 이유는 Playwright 오류에서 가린 요소까지 뽑아 화면 기록에 남긴다(`_why_click_failed`).
- **메뉴가 있는 앱의 시작 화면은 안내 화면이다.** 화면은 메뉴 계획이 도니, 시작 화면은 조회·검색 단추만 `MAX_LANDING`(4)번까지 누른다(나라장터에서 통합검색 `srchBidPbanc.do` 가 여기서 잡힌다). 화면 안에서는 주 단추(`검색`, `조회` 글자 그대로)를 먼저, "온라인 매뉴얼 조회" 같은 곁가지는 그 뒤에 누른다.
  메뉴 이름이 `srch`(검색), `sel` 처럼 약어여도 조회 동사로 본다(`reads.READ_VERBS`). PUT·PATCH·DELETE 는 이름이 어떻든 조회로 허락하지 않는다 — 허락의 대상은 POST 뿐이다.
- **조회도 전부 POST.** 쓰기를 막는 규칙(`_route_inner`)은 그대로라 화면이 부른 조회가 모조리 `{}` 로 막히고, 화면은 "안내 메시지"/`alert('{}')` 를 띄운다. **막은 POST 의 이름이 조회처럼 보이면**(`reads.looks_read`) 사람에게 보내도 되는지 묻는다.
  `looks_read` 가 실제 문이다: 마지막 구간이 조회 동사로 시작하거나 목록·검색 낱말로 끝나야 하고, 경로의 **어느 구간이든** 쓰기 낱말(`policy.risky_call`)이나 로그인·비밀번호 낱말이 있으면 아니다(`selectAndUpdateRow.do` 는 걸러진다). 허락은 "조회로 보이는 이름" 뿐이다. 이 규칙을 느슨하게 하지 않는다.
  - 질문(`readpost`)은 다른 질문과 달리 **답을 기다린다**(`_wait_answer`; 막힌 채로 더 보면 빈 화면만 모인다). 기다린 시간은 시간 상한에 넣지 않는다. 허락하면 이 화면을 `fresh` 로 접고(`_abandon_fresh`) 본 버튼을 비운 뒤 처음부터 다시 연다. "묻지 않고"(`never`)는 묻지 않고 막은 채로 간다.
  - 직접 조작 중에는 별도 열쇠(`readpost-take|…`)로 `present=True` 질문을 만든다. `never` 설정으로 이미 막기로 정해졌어도 사람이 화면을 보고 있어 비어 보이는 까닭을 알려야 하기 때문이다(`Hitl.ask` 가 `present` 를 보면 자동 처리하지 않는다).
  - 설정으로 미리 허락하려면 `readAuto`(Policy.read_auto). 허락해서 보낸 요청은 `Observed.read` 로 표시하고 `merge._mode` 가 읽기로 본다(로그인처럼 허용돼 나간 POST 를 읽기로 오해하지 않도록 패턴·표시가 있는 것만).
  - 막은 채로 끝난 탐색은 `job.d["reads"] = {state: keep, n, paths, groups}` 를 남기고, 결과 화면의 "허락하고 다시 탐색"(`rerun(allow_reads=True)`)은 **그 기록이 있는 탐색에서만** 받는다 — 화면이 아무 탐색에나 허락을 끼워 넣지 못하게.
- **그렇게 찾은 API 가 도구로 안 돌아가던 이유.** (1) 중첩 JSON 본문(`{"dlSrch": {…}}`)을 버렸다 → `infer._flat` 이 점으로 이어 펴고(`dlSrch.bizNm`, 깊이 4·필드 120개 상한) 파라미터 이름은 `_short_names` 가 줄인다. (2) `menu-info` 처럼 `x-` 로 시작하지 않는 필수 헤더를 버렸다 → `_keep_headers` 는 브라우저 표준 헤더·`sec-*`·비밀·요청마다 바뀌는 값만 빼고
  다 남기고, 늘 보내는 헤더는 도구에 `inject` 로 넣는다(값이 조금씩 다르면 가장 많이 본 값). (3) 공개 사이트라 로그인 레시피가 없었다 → 로그인 화면이 없으면 `{"visit": True}` 레시피로 **방문만으로 받은 세션 쿠키**를 쓴다(`session_auth.visit`; 나라장터는 `GET /` 만으로 세션을 주고, 쿠키 없이 부르면 403).
  SSO 를 거치며 다른 서버의 같은 이름 쿠키(JSESSIONID)가 덮어쓰지 않도록 `_host_cookies` 가 이 서버 도메인의 것만 고른다. **점 없는 호스트(localhost)의 쿠키 도메인은 `http.cookiejar` 가 `localhost.local` 로 저장한다** — 이걸 몰라 로컬 시험의 로그인이 통째로 깨졌었다.
- 시험은 `tests/spa_site.py`(나라장터를 닮은 로컬 사이트: SSO 리다이렉트, 1.8초 뒤 그려지는 화면, 팝업 3개, 숨은 메뉴, 쿠키+`menu-info` 가 필요한 POST 조회, 쓰기 4종)와 `test_ieum_discovery_spa.py`(브라우저), `test_ieum_discovery_reads.py`(브라우저 없음)다.
  이 사이트의 쓰기 요청이 서버에 한 번이라도 닿으면 시험이 실패한다. 시험 사이트 헤더에 한글을 넣으면 `fetch` 가 스스로 실패해 "안내 메시지" 만 뜬다(시험 사이트 버그를 크롤러 탓으로 오해하지 않는다).

**온톨로지(2차)는 이음의 별개 기능이다** (`app/ieum/onto/`, 라우터 `routers/onto.py`, 화면 `apps/web/ieum/js/menu/onto*.js`). DB 연결마다 온톨로지 하나 — 객체(테이블·뷰·마트에서), 링크, 액션,
행·속성 권한. 모듈 구성은 `onto/__init__.py`, 사용법과 시연 환경은 `apps/web/ieum/README.md` 의 "온톨로지". 코드를 읽기 전에 알아 둘 것:
- **연결은 접속만 한다.** 스키마는 `reader`/`scan`/`build` 가 읽는다. 모든 접속은 읽기 전용이다(SQLite 는 `mode=ro` + `query_only`, 쿼리 시간은 progress handler, 행은 `fetchmany`, 동시 4개는 세마포어).
  연결 엔진이 둘이다: `conn.engine(c)` 는 늘 **원본**(스캔·스키마·마트 빌드), `conn.engine(c, replica=True)` 는 주기 동기화 연결이면 **복제본**(객체 질의). 질의 엔진(`query.py`)만 replica 를 쓴다.
- **객체 id 는 `<연결 id>.<API 이름>`** 이다(`po.PurchaseOrder`). 화면이 `id.split('.')[0]` 으로 연결을 알아내므로 연결 id 에 점이 들어가면 안 된다(`conn._slug` 는 `[0-9a-z-]` 30자).
- **질의는 전부 `query.Q` 를 지난다.** 객체 필터(삭제된 행 제외)와 행 권한(`_pol_wheres`/`_pol_joins`)은 사용자가 쌓은 조건(`wheres`/`joins`)과 **따로** 둔다 — `clone()` 이 사용자 조건만 가져가야 한다.
  `_ensure_policy()` 가 `where_prop` 보다 먼저 불려 조건이 정책 앞뒤로 섞이던 버그가 있었다. 가려지는 속성은 조건·정렬·집계에 못 쓴다(`Denied`). 값은 전부 바인드, 식별자는 객체 정의에서만 온다.
- **AI 는 공개 스냅샷(`store.versions`)을 본다, 스튜디오(`store.objects`)가 아니다.** `query.Ctx.published()` 와 MCP 서버 스냅샷(`manifest.kind == "onto"`)이 같은 것이다. 스튜디오·미리보기·객체 탐색은 `Ctx.live(admin=True)`(권한 없이 마스킹만).
  공개한 상태는 `pub` 이고 `aiOff` 가 꺼져 있는 객체, 상태가 `pub` 인 링크만 스냅샷에 들어간다. 링크는 `from` 객체가 있는 온톨로지의 스냅샷에 들어가고, 서버가 다른 온톨로지의 최신 스냅샷을 끌어와 건너편(ext) 객체를 붙인다(`mcp.assemble`).
- **스캔은 규칙이다(LLM 아님).** 이름은 `dictionary.py` 의 사전, 링크는 FK·뷰 조인·값 일치율. 시연 DB 의 약어에 맞춘 사전이라 다른 DB 에서는 모르는 약어를 그대로 둔다. 뷰가 기본 테이블 키를 보여 주면 뷰가 객체, 기본 테이블은 `covered`.
- **액션은 DB 에 쓰지 않는다.** 변환 스튜디오 도구(`gateway/runner.run_tool`)를 불러 쓰고, 시연 레거시 사이트의 변경은 `demo_legacy/hooks.py` → `onto/legacy_sync.py` 가 시연 DB(`onto/demo/po.db`)에도 쓴다(그 파일이 있을 때만).
  쓰기는 `confirmed=True` 없이는 `actions.execute` 가 거절한다. 판정은 객체의 지금 값을 관리자 읽기로 다시 읽어서 한다.
- **마트 빌드는 새 테이블(`<id>__new`)을 만든 뒤 한 트랜잭션에서 바꿔 끼운다.** 여러 DB 를 섞는 SQL 은 읽는 테이블을 임시 폴더(`ieum-mart-*`)의 SQLite 로 복사해 거기서 돈다(끝나면 지운다). 마트 저장소 연결(`conn.MART_CONN`)은 연결 목록에 없는 내부 연결이다.
- **온톨로지 MCP 서버는 도구 묶음 서버와 같은 `runtime/` 을 쓴다.** `ts-onto-<연결 id>` 로 `supervisor` 에 올라가고, `protocol.load_deployment` 가 스냅샷 종류를 보고 `OntoDeployment`(`onto/runtime.py`)를 고른다. 키의 `runAs`(직원 사번)가 실행 사용자다.
  도구 이름에 점을 쓰지 않는다(`purchase_order__vendor`). 포트는 `deployer._other_ports` 가 온톨로지 서버 것까지 뺀다.
- **테스트의 시연 환경은 세션에서 한 번 만들어 복사한다**(`tests/conftest.py` 의 `onto_template` → `onto` 픽스처). `IEUM_ONTO_AUTOSERVE=0` 이 기본이고, 서버를 띄우는 시험(`test_ieum_onto_mcp.py`)만 켠다.
  스키마 캐시(`reader.read_cached`)는 상태 폴더까지 키에 넣어야 한다(시험마다 같은 연결 id 가 다른 폴더에 있다).

**이음의 배포는 별도 프로세스다** (`app/ieum/runtime/`). 묶음을 배포하면 그 묶음의 MCP 서버가 이 컴퓨터의 프로세스
(`python -m app.ieum.runtime.server`, `127.0.0.1:81xx/mcp`)로 뜬다. 콘솔(제어면)이 `deployer`→`supervisor` 로 띄우고
내리고 살피며, 서버(데이터면)는 스냅샷 파일 하나(`data/ieum/deployments/<id>/manifest.json`)와 상태 폴더만 보고 돈다.
**배포는 스냅샷이다** — 배포하는 순간의 도구 정의가 얼어 들어가므로 스튜디오에서 고쳐도 새 버전을 배포하기 전에는 서버에 닿지 않는다
("다음 배포 때 반영됩니다"라는 화면 문구가 사실이어야 한다). 새 버전 배포는 프로세스를 다시 띄우지 않고 서버가 요청마다 파일 시그니처를 보고
바꿔 읽는다. 인증 정보는 스냅샷에 넣지 않는다(서버가 금고에서 읽는다). 서버는 콘솔과 함께 죽고(`--parent` 감시, `kill -9` 에도 1초 안에
스스로 끝난다) 콘솔이 뜰 때 `main.py` 의 startup 이 `deployer.restore_all()` 로 같은 포트·같은 스냅샷으로 되살린다.
다른 곳(컨테이너)에 배포하려면 `supervisor` 자리만 바꾼다. 예전에 있던 콘솔 안의 `/mcp/<ws>/<slug>` 라우트는 없앴다 —
같은 묶음을 두 방식으로 서빙하면 한쪽은 스냅샷이고 한쪽은 실시간이라 어긋난다.

## 밟으면 아픈 것들

- **콘솔 JS 는 classic script 라 파일 간 전역 선언이 충돌한다.** `const hostOf` 를 두 파일에 선언하면 한쪽이 통째로
  실행되지 않아 화면이 빈 채로 뜬다. `node --check` 는 파일 단위라 이걸 못 잡는다. 전역 이름을 새로 만들 때는 먼저 grep 한다.
- **콘솔 정적 파일은 `Cache-Control: no-cache` 로 서빙한다**(`console.py`). 빌드 해시가 없어서, 헤더가 없으면 브라우저가
  방금 고친 JS 대신 캐시를 쓴다.
- **`display` 를 지정한 요소에는 `hidden` 속성이 안 먹는다.** 전역 `[hidden]{display:none!important}` 가 console.css 에 있다.
- **브라우저 e2e 시험은 시간이 걸린다**(`test_ieum_discovery_*`: 크롤 한 번 20~40초). 브라우저가 없거나
  `IEUM_SKIP_BROWSER_TESTS=1` 이면 건너뛴다. 시연 사이트는 모듈 단위 상태를 들고 있어 시험 사이에 `demo_legacy.reset()` 이 필요하다(`ieum_state` 픽스처가 한다).
- **전역 gitignore 에 `*.json` 을 둔 개발자는 새 JSON 이 조용히 빠진다.** 이음 시드
  (`app/ieum/data/**`)는 `.gitignore` 에 예외를 뒀다. 다른 곳에 JSON 을 새로 추가하면
  `git status` 에 안 보이니 `git check-ignore -v <파일>` 로 확인한다.
- **이음 상태 파일은 프로세스 여럿이 쓴다.** 배포한 MCP 서버가 호출 로그·키 사용 시각을 콘솔과 같은 JSON 에 쓴다. 파일 전체를
  읽고-고쳐-쓰는 구간은 `with store.LOCK:`(스레드 락 + 파일 락)으로 감싼다. 안 감싸면 겹친 요청이 서로의 변경을 지운다 — 실제로
  도구 셋을 한꺼번에 저장하는 요청 셋 중 하나만 남았다(`studio.save_tool`). 폐기한 키가 마지막 사용 시각을 쓰는 서버 때문에 되살아나는 것도 같은 문제다.
  `LOCK` 을 쥔 채 프로세스를 띄우거나 기다리지 않는다(서버도 같은 락이 필요해서 서로 막힌다).
- **스튜디오의 "공개"는 저장해야 서버가 안다.** 스위치를 켜기만 하면 브라우저에만 있고 서버는 `review` 그대로다. 배포가 "공개 중인 도구가 없다"며
  400 을 낸 원인이 이것이었다. 배포 창은 저장하지 않은 도구를 먼저 저장한 뒤 배포한다.
- **배포 시험은 진짜 프로세스를 띄운다.** `ieum_state` 픽스처가 끝날 때 `supervisor.shutdown()` 으로 남은 서버를 내린다. `tests/conftest.py` 가
  `IEUM_MCP_AUTORESTORE=0` 을 기본으로 둬서 `app.main` 을 띄우는 다른 시험이 개발자 PC 의 배포를 되살리지 않는다. 복구를 시험할 때만 켠다.
- **시험은 개발자 PC 의 상태 폴더(`apps/backend/data/ieum`)를 읽지 않는다.** `tests/conftest.py` 가 시험 프로세스의 기본 `IEUM_STATE_DIR` 를 임시 폴더로 돌린다.
  온톨로지 시연 DB(`onto/demo/po.db`)가 실제 폴더에 있으면 시연 레거시 사이트의 승인·마감이 그 DB 의 상태를 따라 판정돼(`legacy_sync` 후크), 시연을 써 본 PC 에서만 `test_ieum_demo_legacy.py` 가 409 로 깨졌다.
  깨끗한 체크아웃(CI)에서는 통과해서 늦게 드러난다. 상태 폴더를 직접 다루는 시험은 `ieum_state` 를 쓴다.
- **배포 프로세스는 부모와 같은 CPU 아키텍처로 뜬다.** Apple 실리콘에서 Rosetta 터미널이 띄운 콘솔은 x86_64 venv 를 쓰고, 자식도 그걸 이어받는다
  (`arch` 로 따로 지정하지 않는다). arm64 셸에서 x86_64 venv 를 그냥 돌리면 콘솔 자체가 `pydantic_core` 에서 죽는다 — 시험은 `arch -x86_64 .venv/bin/pytest`.
- **Rosetta 로 뜬 Chrome 은 무거운 사이트를 못 연다.** 자식 프로세스는 부모의 CPU 를 이어받아, x86_64 venv 에서 Playwright 가 띄운 Chrome 도 변환되어 뜬다
  (`lsof -p <chrome pid> | grep rosetta` 로 확인). 실측: wehago.com 의 `DOMContentLoaded` 가 네이티브 4초, 변환 30초 초과 — 요청은 다 끝났는데 메인 스레드가 JS 를 못 끝낸다.
  `discovery/browser.py` 가 변환 중인 Mac 이면 설치된 Chrome·Edge 를 `arch -arm64` 래퍼로 네이티브로 띄운다. 번들 Chromium 은 x64 라 못 하니 시스템 브라우저가 먼저다.
  "Page.goto: Timeout" 이 보이면 사이트 탓으로 단정하기 전에 이것부터 본다.
- **이음 테스트는 `app.main` 으로 서버를 띄우지 않는다.** 기동할 때 `dev.db` 를 시드하기
  때문이다. `tests/conftest.py` 의 `ieum_server` 는 이음 라우터만 실은 앱을 진짜 포트에
  띄우고(변환 엔진이 HTTP 로 `/demo-origin` 을 부른다), `ieum_state` 는 상태 폴더를
  임시로 돌린다.

- **시연 레거시 사이트(`/demo-legacy/po`)는 `X-Requested-With: XMLHttpRequest` 가 없으면 400 이다**(WAF 흉내). 온톨로지 시연이 등록하는 쓰기 도구는 이 헤더를 고정 헤더(`rule: inject`, 이름 없는 파라미터)로 붙인다.
- **WAF.** 대상 사이트는 `User-Agent`·`Referer`·`X-Requested-With` 가 없으면 400 을
  낸다. 헤더를 골라 저장하는 쪽은 `services/schema_infer.py` 의 `PRESERVED_HEADERS`,
  기본값만 채우는 쪽은 `services/executor.py` 다.
- **도구 호출 강제.** `tools` 만 넘기면 모델이 도구를 부르지 않고 되묻는다. 한국어
  시스템 메시지와 `tool_choice="required"` 를 **함께** 보내야 한다.
- **`max_tokens` 금지.** 이 Azure 배포는 `max_completion_tokens` 를 요구한다.
  배포 이름이 gpt-5 계열(`gpt-5.6-luna`)이라 **추론 모델**이다. 실측: `temperature` 는 기본값 말고는 400 이고, 생각 토큰이 `max_completion_tokens`
  에 들어가서 작게 잡으면(16 으로 시험) 본문이 비어 `finish_reason=length` 로 끝난다. 이음의 `gateway/llm.py`(도구 설명 다시 쓰기)는 `temperature` 를 넣지 않고 4096 으로 둔다.
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
