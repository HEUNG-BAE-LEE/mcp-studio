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
안전을 지키는 것은 `crawler._route_inner` 가 POST/PUT/PATCH/DELETE 를 전부 가로채 운영에 보내지 않는 것이다(로그인과
사용자가 지정한 조회용 POST 만 예외). 로드 시 XHR 로 부르는 GET 중 이름이 쓰기처럼 보이는 것(`policy.risky_call`)도 가로챈다.
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
- **배포 프로세스는 부모와 같은 CPU 아키텍처로 뜬다.** Apple 실리콘에서 Rosetta 터미널이 띄운 콘솔은 x86_64 venv 를 쓰고, 자식도 그걸 이어받는다
  (`arch` 로 따로 지정하지 않는다). arm64 셸에서 x86_64 venv 를 그냥 돌리면 콘솔 자체가 `pydantic_core` 에서 죽는다 — 시험은 `arch -x86_64 .venv/bin/pytest`.
- **이음 테스트는 `app.main` 으로 서버를 띄우지 않는다.** 기동할 때 `dev.db` 를 시드하기
  때문이다. `tests/conftest.py` 의 `ieum_server` 는 이음 라우터만 실은 앱을 진짜 포트에
  띄우고(변환 엔진이 HTTP 로 `/demo-origin` 을 부른다), `ieum_state` 는 상태 폴더를
  임시로 돌린다.

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
