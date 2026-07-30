# 중간결과보고서 작성 실행 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2026 인공지능 챔피언 중간결과보고서(지정 양식 docx, 15p 이내)를 실측 근거와 함께 완성한다.

**Architecture:** 실측·캡처·구성도를 먼저 확보하고(Task 1~4), 마크다운 마스터 초안을 장별로 작성한 뒤(Task 5~7), python-docx 스크립트로 지정 양식에 자동 이식한다(Task 8). 미확정 항목은 사용자 확인 후 최종 반영한다(Task 9).

**Tech Stack:** Bash, pytest/vitest(기존), Playwright MCP(캡처), mermaid-cli(구성도), python-docx(이식)

**스펙:** `docs/superpowers/specs/2026-07-30-interim-report-design.md`

## Global Constraints

- 마감: **2026-07-31(금) 17:00** — 전산 접수는 사람이 수행
- 지정 양식: `/Users/hyunjae/Downloads/2026년도_인공지능_챔피언_중간결과보고서.docx` (표지·안내박스 제외 **15p 이내**, **맑은 고딕 10pt**)
- 구현제안서: `/Users/hyunjae/Downloads/구현제안서 양식.pdf` — 프로젝트명은 제안서와 동일 표기: *"레거시 환경"을 위한 AI 프로토콜 변압기(AI Protocol Transformer)*
- 일반 트랙 → 5장 '해당없음', 4.1 표는 Azure OpenAI(생성형 AI API·해외, 대회 지원 자원)
- 포털 일괄 수집은 **이 계획 전체에서 1회만** 실행. `MIN_INTERVAL_SEC=1.0`·`MAX_LIMIT=60`을 절대 낮추지 않는다. 재시도 없음
- Azure(LLM 콘솔) 호출은 **최대 2회**
- 화면 캡처에 `.env` 값·인증키가 보이면 안 된다
- `apps/backend/.env`·`.mcp.json`·`report.jpg`는 커밋하지 않는다
- 보고서의 모든 수치는 `docs/report/assets/metrics.md`에 출처(실행 명령·일시)가 있어야 한다
- 주석·문구·커밋 메시지는 한국어. Python 3.10.11 (3.11+ 문법 금지)
- python-docx·mermaid-cli는 스크래치패드에서만 설치·실행 (레포·백엔드 venv 오염 금지)
- 작업 브랜치: `docs/interim-report` (생성돼 있음)
- 모든 커밋 메시지는 다음 트레일러로 끝낸다:
  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01UURnyBCmwxaDafKzamrYHv
  ```

**스크래치패드 경로** (아래에서 `$SCRATCH`로 표기):
`/private/tmp/claude-501/-Users-hyunjae-Workspace-05-MCP-Studio/9b6d30a6-47ce-471f-8945-daa104e4d180/scratchpad`

---

### Task 1: 실측 환경 준비 + 테스트 스위트 실측

**Files:**
- Create: `docs/report/assets/metrics.md`

**Interfaces:**
- Produces: 백엔드(:8000)·관리자(:5173)가 **시드 상태로 기동된 채 유지**됨 (Task 2·3이 사용). `metrics.md`에 고정 섹션 헤더 5개(`## 환경`, `## 테스트 스위트`, `## 일괄 수집`, `## LLM 콘솔`, `## 기존 문서 인용 실측치`) — 이후 태스크는 이 헤더 아래에만 추가한다.

- [ ] **Step 1: DB 리셋 + 낡은 프로세스 정리** (demo-script §0 절차)

```bash
cd /Users/hyunjae/Workspace/05_MCP-Studio
rm -f apps/backend/data/dev.db
lsof -ti tcp:8000 -sTCP:LISTEN | xargs -r kill
lsof -ti tcp:5173 -sTCP:LISTEN | xargs -r kill
```

- [ ] **Step 2: 백엔드 기동 (백그라운드) 후 검증**

백그라운드 실행: `cd apps/backend && .venv/bin/uvicorn app.main:app --port 8000` (Bash `run_in_background: true`)

검증 (둘 다 통과해야 함):

```bash
# 최신 라우트 서빙 확인 → True
curl -s http://localhost:8000/openapi.json | python3 -c \
  "import json,sys; print('/api/projects/{project_id}/llm-test' in json.load(sys.stdin)['paths'])"
# .env 4개 키 로드 확인 → 모두 True (값 자체는 출력하지 않는다)
cd apps/backend && .venv/bin/python -c \
  "from dotenv import load_dotenv; import os; load_dotenv(); \
   print({k: bool(os.environ.get(k)) for k in \
   ['AZURE_OPENAI_API_KEY','AZURE_OPENAI_ENDPOINT','AZURE_OPENAI_API_VERSION','AZURE_OPENAI_DEPLOYMENT']})"
```

- [ ] **Step 3: 관리자 기동 (백그라운드) 후 검증**

백그라운드 실행: `cd apps/admin && npm run dev`

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/   # → 200
```

- [ ] **Step 4: 테스트 스위트 4종 실행, 결과 기록**

```bash
cd apps/backend && .venv/bin/pytest tests/ -q 2>&1 | tail -3     # N passed, 시간
cd apps/extension && npm test 2>&1 | tail -5                     # vitest 결과
cd apps/admin && npx tsc -b && echo "admin 타입체크 OK"
cd apps/extension && npm run compile && echo "extension 타입체크 OK"
```

- [ ] **Step 5: `docs/report/assets/metrics.md` 생성** — 아래 골격에 Step 4 결과를 채운다

```markdown
# 실측 기록 — 중간결과보고서 근거

보고서에 인용하는 모든 수치의 출처. 각 항목에 실행 일시·명령·원본 출력 요약을 남긴다.

## 환경
- 측정일: 2026-07-30, macOS, Python 3.10.11 / Node v25.8.0
- 코드 기준: docs/interim-report 브랜치 (4f64047 이후)

## 테스트 스위트
| 대상 | 명령 | 결과 | 소요 |
|---|---|---|---|
| 백엔드 | .venv/bin/pytest tests/ -q | (예: 133 passed) | (초) |
| 확장 | npm test | (예: 22 passed) | (초) |
| admin 타입체크 | npx tsc -b | 통과 | — |
| extension 타입체크 | npm run compile | 통과 | — |

## 일괄 수집
(Task 2에서 기록)

## LLM 콘솔
(Task 3에서 기록)

## 기존 문서 인용 실측치
- 일괄 수집 선행 실측: 미세먼지 25건 → 서비스 13개·오퍼레이션 25개, 약 2분 (README.md §4-6)
- LLM 콘솔 응답 편차: 152ms ~ 5,380ms (docs/demo-script.md 리허설 기록)
- 트래픽 기록: 클릭 1회당 요청 3건 안팎 포착 (README.md §4-1)
```

- [ ] **Step 6: 커밋**

```bash
git add docs/report/assets/metrics.md
git commit -m "보고서 근거 실측 기록 시작 — 테스트 스위트 4종"
```

---

### Task 2: 시드 화면 캡처 + 포털 일괄 수집 실측

**Files:**
- Create: `docs/report/assets/capture-sources.png`, `capture-spec-session.png`, `capture-action-edit.png`, `capture-crawl-progress.png`, `capture-crawl-result.png`
- Modify: `docs/report/assets/metrics.md` (`## 일괄 수집` 섹션)

**Interfaces:**
- Consumes: Task 1의 기동된 서버, 시드 상태(프로젝트 3개, 포털 명세 세션은 #3에만, 액션 1개)
- Produces: 위 파일명 그대로의 캡처 5장 (Task 5~7이 md에서 `![…](assets/capture-*.png)`로 참조)

주의: Playwright MCP 도구(`browser_navigate`, `browser_take_screenshot`, `browser_resize`, `browser_snapshot`)를 쓴다. 캡처 파일은 MCP가 저장한 경로에서 `docs/report/assets/`로 복사한다. **시드 상태 캡처(Step 1~3)를 수집 실행(Step 4) 전에 끝낸다** — 수집이 DB에 데이터를 추가하기 때문.

- [ ] **Step 1: 브라우저 해상도 1440×900 설정 후 `/sources` 캡처**

`browser_navigate` → `http://localhost:5173/sources` → 3방식 카드(트래픽/포털/문서, 동작·준비중 구분)가 보이는지 스냅샷으로 확인 → 스크린샷 저장 → `capture-sources.png`로 복사

- [ ] **Step 2: 포털 명세 세션 상세 캡처**

시드 세션은 프로젝트 #3(공공데이터포털 오픈API) 소속. `http://localhost:5173/` → 프로젝트 #3 → 세션 목록에서 포털 명세 세션 클릭(경로가 `/spec-sessions/:id`인지 확인 — `/sessions/:id`로 열리면 잘못된 화면임, CLAUDE.md 참고) → 오퍼레이션 목록이 보이는 상태로 캡처 → `capture-spec-session.png`

- [ ] **Step 3: 액션 편집 화면 캡처**

시드 액션 "아파트 단지 마커 조회"(프로젝트 #1). 프로젝트 #1 → 액션 목록 → 액션 클릭 → 파라미터 6개(minX/minY/maxX/maxY/srhYear/poiType)의 타입·예시값 표가 보이는 상태로 캡처 → `capture-action-edit.png`. **인증키·secret 값이 화면에 없는지 확인 후 저장.**

- [ ] **Step 4: 포털 일괄 수집 1회 실측** (이 계획에서 유일한 실행)

시작 전 `date +%H:%M:%S` 기록. `/sources` → 포털 공개 기반 수집 카드 → 프로젝트 "공공데이터포털 오픈API" 선택 → 키워드 `미세먼지`(버튼 또는 URL `https://www.data.go.kr/tcs/dss/selectDataSetList.do?dType=API&keyword=미세먼지`) → 수집 개수 25 → 수집 시작.
진행 중 화면 1장 캡처 → `capture-crawl-progress.png`. `browser_wait_for`로 완료 대기(수십 초~수 분). 완료 후 `date +%H:%M:%S` 기록, 결과 화면 캡처 → `capture-crawl-result.png`.

- [ ] **Step 5: `metrics.md`의 `## 일괄 수집` 섹션 기록**

```markdown
## 일괄 수집
- 실행 일시: 2026-07-30 HH:MM ~ HH:MM (총 M분 S초)
- 입력: 키워드 "미세먼지", 요청 개수 25, data.go.kr 검색 결과 URL
- 결과: 서비스 N개 / 오퍼레이션 M건 수집, 실패 K건
- 준수 사항: 요청 간 1초 간격, 상한 60건, 재시도 없음 (portal_crawler.py 기본값 그대로)
```

- [ ] **Step 6: 커밋**

```bash
git add docs/report/assets/
git commit -m "시드 화면 캡처 5장 + 포털 일괄 수집 실측 기록"
```

---

### Task 3: LLM 콘솔 실측 + 캡처

**Files:**
- Create: `docs/report/assets/capture-console-tool.png`, `capture-console-result.png`
- Modify: `docs/report/assets/metrics.md` (`## LLM 콘솔` 섹션)

**Interfaces:**
- Consumes: Task 1의 서버, 시드 액션(프로젝트 #1, ACTIVE)
- Produces: 캡처 2장 + 실측 기록 (3.2 실행 기능·6장 시연 절이 인용)

- [ ] **Step 1: 콘솔 질의 (Azure 호출 1회차)**

`browser_navigate` → `http://localhost:5173/projects/1/console` → 입력창에 `광화문 근처 아파트 단지 알려줘` → **질의**. 선택된 액션(`search_apartment_markers`)과 추론된 파라미터(위경도 4개·연도·poiType)가 표시되면 캡처 → `capture-console-tool.png`

- [ ] **Step 2: 실행 (대상 API 호출 — Azure 2회차 포함될 수 있음)**

**이 내용으로 실행** 클릭 → HTTP 상태·소요·한국어 요약이 표시되면 캡처 → `capture-console-result.png`. 화면에 표시된 상태 코드·소요 시간·단지 이름 몇 개를 그대로 기록해 둔다.

- [ ] **Step 3: `metrics.md`의 `## LLM 콘솔` 섹션 기록**

```markdown
## LLM 콘솔
- 실행 일시: 2026-07-30 HH:MM
- 질의: "광화문 근처 아파트 단지 알려줘"
- 도구 선택: search_apartment_markers (파라미터 6개 전부 LLM이 채움)
- 실행 결과: HTTP 200, NNNms, 반환 단지 예: (화면에 뜬 실제 이름 3~4개)
- Azure 호출 횟수: 2회 이내 (도구 선택 1 + 요약 1)
```

- [ ] **Step 4: 커밋**

```bash
git add docs/report/assets/
git commit -m "LLM 콘솔 실측 — 도구 선택·실행 캡처와 기록"
```

---

### Task 4: 시스템 구성도 생성

**Files:**
- Create: `docs/report/assets/architecture.mmd`, `docs/report/assets/architecture.png`

**Interfaces:**
- Produces: `assets/architecture.png` (Task 6의 3.1.3 절이 삽입), 라벨 전부 한국어

- [ ] **Step 1: `architecture.mmd` 작성**

```
flowchart LR
  subgraph EXT["Chrome 확장 (WXT)"]
    REC["트래픽 기록<br/>fetch·XHR 후킹 + 클릭 상관관계"]
    DET["포털 명세 감지<br/>(공개 명세 페이지 판정)"]
  end
  subgraph BE["FastAPI 백엔드"]
    SESS["기록 세션 저장"] --> SCORE["후보 스코어링<br/>(로그 API 감점 등)"]
    SCORE --> INFER["스키마 추론<br/>타입·예시값·WAF 헤더 보존"]
    PARSE["명세 파서<br/>(요청주소·요청변수 표)"]
    CRAWL["일괄 수집기<br/>1초 간격·최대 60건"] --> PARSE
    INFER --> ACT["액션 (ActionSpec)<br/>세션과 독립된 값 복사"]
    PARSE --> ACT
    ACT --> TOOL["LLM 도구 변환<br/>tool_choice=required·예시값 주입"]
    TOOL --> LLM["Azure OpenAI<br/>function calling"]
    LLM --> EXEC["실행 게이트웨이<br/>레이트리밋·인증키 주입·마스킹"]
  end
  subgraph AD["React 관리자"]
    UI["수집 엔진 · 세션 상세 · 액션 편집 · LLM 콘솔"]
  end
  REC -->|"기록 전송"| SESS
  DET -->|"페이지 DOM 전송"| PARSE
  UI --- BE
  EXEC -->|"HTTP (간격 1초)"| API[("대상 API<br/>공공 포털·기관 서버")]
```

- [ ] **Step 2: PNG 렌더 (스크래치패드에서 실행)**

```bash
cd "$SCRATCH" && npx -y @mermaid-js/mermaid-cli \
  -i /Users/hyunjae/Workspace/05_MCP-Studio/docs/report/assets/architecture.mmd \
  -o /Users/hyunjae/Workspace/05_MCP-Studio/docs/report/assets/architecture.png \
  -w 1800 -b white
```

실패 시 대안: mermaid CDN을 불러오는 로컬 HTML을 `$SCRATCH`에 만들고 Playwright MCP로 열어 스크린샷을 뜬다.

- [ ] **Step 3: 이미지 확인 후 커밋** — Read 도구로 PNG를 열어 글자 깨짐·겹침이 없는지 눈으로 확인

```bash
git add docs/report/assets/architecture.mmd docs/report/assets/architecture.png
git commit -m "시스템 구성도 생성 (3.1.3 삽입용)"
```

---

### Task 5: 보고서 md 초안 — 표지 메타 + 1장·2장

**Files:**
- Create: `docs/report/interim-report.md`

**Interfaces:**
- Produces: md 구조 규약 — Task 8의 `build_docx.py`가 이 규약만 읽는다:
  - 표지 메타: 문서 맨 앞 `# 표지` 아래 `- 키: 값` 목록 (키: 프로젝트명/팀명/팀대표명/팀대표 소속/팀 구성 인원/제출일)
  - 절 헤딩: `## 1.1 프로젝트 명`처럼 **`## <절번호> <제목>`** — 절번호가 양식과 1:1 대응
  - 본문 블록: 일반 단락, `- ` 불릿, md 표(`| a | b |`), 이미지 줄(`![설명](assets/파일.png)`), `**굵게**` 인라인
  - 미확정 값은 `[확인 필요: 항목명]` 형식 그대로 둔다

- [ ] **Step 1: 표지 메타 + 1장 작성** — 스펙의 장별 설계를 따른다. 골격:

```markdown
# 표지
- 프로젝트명: "레거시 환경"을 위한 AI 프로토콜 변압기(AI Protocol Transformer)
- 팀명: [확인 필요: 팀명]
- 팀대표명: 김원태
- 팀대표 소속: [확인 필요: 소속]
- 팀 구성 인원: 4명
- 제출일: 2026. 07. 31

## 1.1 프로젝트 명
(제안서와 동일 표기 한 단락)

## 1.2 프로젝트 한줄 요약 설명
(기존 웹 서비스의 API를 자동 수집·분석해 LLM이 호출 가능한 표준 액션으로 변환하는 미들웨어 플랫폼 — 1~2문장)

## 1.3 기술 목적
(제안서 2.1 승계: 레거시 시스템의 AI 연동에 드는 SI 재개발 비용 문제 → 변압기 비유 → 비침투적 연결. 3~4문장 + 기존 기술의 한계 불릿 2~3개)

## 1.4 기술 동향
(MCP 표준 확산·function calling 보편화·AI 에이전트 동향. WebSearch로 근거 1~2건 확보해 "출처, 연도" 형식으로 인용)

## 1.5 유사 기술 비교 및 차별점
(표: mcp-use / Playwright·browser-use / 본 기술 — 명세 확보 방식·자동화 수준·신뢰장치 3열 비교. 아래 차별점 단락: 수집 3경로, 자동 스키마 추론, 실행 게이트웨이의 신뢰장치)

## 1.6 구현제안서 대비 변경 사항
(스펙의 5행 변경사항 표를 그대로: 수집 방식/수집 범위/MCP 바인딩/스택/배포 — 구분·제안서 내용·변경 후·변경 사유 4열)
```

- [ ] **Step 2: 2장 작성** — 골격:

```markdown
## 2.1 핵심 기술
(문제 → 아이디어 → 구성요소 순. ① 핵심 아이디어: 실행 관측+명세 파싱의 "이중 역분석" ② 구성요소 6개를 불릿으로: 수집 3경로 / 후보 스코어링 / 스키마 추론 / 액션 / 실행 게이트웨이 / LLM 도구 변환 ③ 기존 접근(수동 명세 작성·SI 재개발)과의 차이)

## 2.2 기술 구현 방안
(양식 예시 항목 순서대로 소제목 불릿:
- 활용 AI 모델: Azure OpenAI function calling — 도구 정의는 액션에서 자동 생성
- 데이터 구성·파이프라인: NetworkRequest → 스키마 추론 → ActionSpec(값 복사·세션 독립) → OpenAI 도구
- 학습·튜닝 방식: 모델 학습 대신 도구 정의 엔지니어링 — 한국어 시스템 메시지 + tool_choice=required 병용(둘 중 하나만으로는 도구 미호출, 실측), 파라미터 example을 description에 실어 값 지어내기 방지
- 추론·배포 환경: FastAPI(:8000)+React 관리자(:5173)+Chrome 확장, Azure Container Apps 배포·master 머지 시 자동 배포)
```

- [ ] **Step 3: 검증** — 수치가 들어간 문장은 전부 `metrics.md` 또는 README 실측 인용인지 훑고, `grep -n "확인 필요" docs/report/interim-report.md`로 미확정 항목이 표지 2곳뿐인지 확인

- [ ] **Step 4: 커밋**

```bash
git add docs/report/interim-report.md
git commit -m "보고서 초안 — 표지·1장(변경사항 표 포함)·2장"
```

---

### Task 6: 보고서 md 초안 — 3장 (개발 성과, 최대 배점)

**Files:**
- Modify: `docs/report/interim-report.md` (3장 추가)

**Interfaces:**
- Consumes: `metrics.md`의 실측치, `assets/capture-*.png`, `assets/architecture.png`
- Produces: 3.2의 기능별 진척도 %는 `[확인 필요: 진척도-기능명]`으로 산정 근거와 함께 제안값 표기

- [ ] **Step 1: 3.1 개발 성과 요약 작성**

```markdown
## 3.1.1 개발 목표
(2~3줄: 레거시 웹 서비스의 API를 사람 조작 관측·공개 명세로 수집하고, LLM이 안전하게 호출 가능한 표준 액션으로 자동 변환하는 전 구간 파이프라인 구축)

## 3.1.2 주요기능 명세
(번호 불릿 5개: ① 트래픽 기반 API 기록(Chrome 확장) ② 포털 공개 명세 수집(단건 감지 + 목록 URL 일괄) ③ API 스키마 자동 추론·액션 변환 ④ LLM 도구 실행 게이트웨이 ⑤ 통합 관리자 콘솔)

## 3.1.3 시스템 구성도
![시스템 구성도](assets/architecture.png)
(한 단락: 3계층 구조와 3경로가 액션 이후 공유 파이프라인으로 합류함을 설명)

## 3.1.4 사전 구현 성과
(불릿: 전 구간 파이프라인 완주(기록→후보→액션→LLM 실행), 자동 테스트 155개 통과(백엔드 133·확장 22 — metrics.md), 일괄 수집 실측(Task 2 수치), LLM 실행 실측(Task 3 수치), Azure Container Apps 배포)

## 3.1.5 향후 계획 및 한계점 보완
(불릿: MCP 엔드포인트 표준화(mcp-use 바인딩), 문서 기반 수집(PDF·HWP), HITL 인증 브릿지, API 토폴로지 그래프, 프로젝트 CRUD·인증 — 제안서 미구현 항목을 2차 기간 계획으로 명시)
```

- [ ] **Step 2: 3.2 기능별 상세 작성** — 기능 5개 각각에 3.2.1(명칭)/3.2.2(개요)/3.2.3(개발 현황 — 해당 캡처 이미지 인용 + 실측 문장)/3.2.4(진척도 %) 묶음. 진척도는 산정 근거를 병기:

```markdown
(예 — 기능 ②)
### 기능 ② 포털 공개 명세 수집
- 개요: API를 실행하지 않고 명세만 게시하는 포털 대응 — 페이지 감지 후 DOM 파싱(단건), 검색 결과 URL 하나로 상세기능 전체 순회(일괄)
- 개발 현황: 단건·일괄 모두 동작. 실측 — (Task 2 수치: N개 서비스/M건, 소요). 요청 간 1초·상한 60건 준수
![일괄 수집 결과](assets/capture-crawl-result.png)
- 진척도: [확인 필요: 진척도-포털수집] (제안 90% — 단건·일괄 완료, 타 포털 파서 확장 남음)
```

- [ ] **Step 3: 3.3 기술 우수성 작성**

```markdown
## 3.3.1 정량적 우수성
(표: 자동 테스트 155개 통과 / 일괄 수집 실측치 / LLM 실행 응답 실측 / 후보 스코어링이 로그성 API를 항상 최하위로 배치(리허설 재현) — 각 행에 metrics.md 근거 표기)

## 3.3.2 혁신성·도전성
(A2S(Agent-centric Software) 패러다임, 소스코드 무수정 비침투 연동, AI 에이전트·MCP 트렌드 정합 — 제안서 4.1 승계)

## 3.3.3 대표 성과·실적
(사실만: 공개 데모 배포(ACA), 저장소 커밋 이력. 논문·특허는 "출원 준비 검토 중" 수준으로만 — 없는 것을 만들지 않는다)

## 3.3.4 신뢰성·안전장치
(불릿 6개: 민감 키 마스킹 3곳(URL 쿼리·요청 본문·응답 샘플) / 인증키 LLM 비노출(llmEditable=false, 실행 직전 주입) / 대상 API 호출 간격 1초·응답 원문 미저장 / tool_choice=required+예시값 주입으로 환각 억제 / 실행 전 사용자 확인 단계(질의→확인→실행 2단계) / 공공 서버 배려 설계(robots.txt 확인·상한 60건))
```

- [ ] **Step 4: 검증** — 3장에 인용된 캡처 파일명이 전부 `docs/report/assets/`에 실재하는지, 수치가 metrics.md와 일치하는지 대조

```bash
grep -o "assets/[a-z-]*\.png" docs/report/interim-report.md | sort -u | while read f; do
  test -f "docs/report/$f" && echo "OK $f" || echo "MISSING $f"; done
```

- [ ] **Step 5: 커밋**

```bash
git add docs/report/interim-report.md
git commit -m "보고서 초안 — 3장 개발 성과 (기능별 상세·정량·신뢰성)"
```

---

### Task 7: 보고서 md 초안 — 4~7장

**Files:**
- Modify: `docs/report/interim-report.md` (4~7장 추가)

**Interfaces:**
- Produces: md 초안 전체 완성 (Task 8이 이식)

- [ ] **Step 1: 4장·5장 작성**

```markdown
## 4.1 연구 지원 활용 항목
(표 3열 — 구분/활용자원/활용 규모:
| 생성형 AI API (해외) | Azure OpenAI (function calling 지원 배포) | [확인 필요: Azure 토큰 사용량] |
GPU 자원 행은 미사용이므로 넣지 않는다)

## 4.2 주요 활용 성과
(2~3문장: 도구 선택·파라미터 추론·실행 결과 한국어 요약까지 전 구간을 Azure OpenAI function calling으로 구현. tool_choice=required·한국어 시스템 메시지 병용을 실측으로 확정)

## 5.1 연계 기업 및 활용 모델
해당없음 (일반 트랙)
```

(5.2~5.4도 각각 "해당없음" 한 줄)

- [ ] **Step 2: 6장 작성** — `docs/demo-script.md` 장면 0~13을 압축

```markdown
## 6.1 시연 가능 여부
[확인 필요: 시연가능체크] (제안: ■ 시연 가능 — 로컬 실행 전 구간이 대본으로 검증돼 있음)

## 6.2 시연 예정 방식
(노트북 시연(로컬 기동) + 보조 영상. ACA 배포본을 예비 경로로)

## 6.3 시연 시나리오 개요
(입력→처리→출력 단계 표 또는 번호 목록:
① [입력] 대상 사이트에서 확장으로 기록 시작, 지도 확대 클릭 → ② [처리] 클릭-요청 상관관계로 후보 포착 → ③ [출력] 관리자에서 후보가 점수순 정렬 → ④ 액션 생성: 파라미터 6개 자동 추론 → ⑤ [입력] 자연어 질의 → ⑥ [처리] LLM 도구 선택·인자 추론 → 사용자 확인 → 실제 API 호출 → ⑦ [출력] 실데이터 한국어 요약. 보조 시나리오: 포털 명세 수집(감지→수집→액션))

## 6.4 첨부 영상 설명
(영상은 demo-script.md 대본 기반 3분 구성으로 촬영 예정: 수집 3방식 소개 8초 → 트래픽 기록·액션 생성·LLM 실행 약 90초 → 포털 명세 수집 40초 → 마무리. 유튜브 일부공개 업로드 예정 — [확인 필요: 영상 링크])
```

- [ ] **Step 3: 7장 작성** — 제안서 4장 승계 + 시장 동향 보강

```markdown
## 7.1 목표 시장
(국내 공공기관·대민 서비스의 AI 연동(B2G), 레거시 시스템 보유 기업의 AI 전환(B2B) — 초기 시장은 공공데이터 활용 생태계)

## 7.2 시장 동향
(WebSearch로 AI 에이전트/MCP 생태계 시장 통계 1~2건 확보해 인용. 실패 시 정성 서술로 대체: MCP 클라이언트·서버 생태계 확산, 공공 AX 예산 확대)

## 7.3 기술적 파급효과
(제안서 4.1 승계: A2S 패러다임 제시, 비침투적 역공학 기술 확보, 자율 API 그래프 추론의 특허·논문 가능성)

## 7.4 사회·산업적 파급효과 및 응용 분야 확장
(제안서 4.2 승계: 부처별 SI 재개발 예산 절감, 사일로 없는 원스톱 지능형 행정, K-소프트웨어의 MCP 생태계 진출)

## 7.5 사업화 추진 계획
(단계 불릿: 프로토타입 고도화(2차 기간) → On-Premise 설치 패키지(공공·금융 내부망) → MCP 게이트웨이 SaaS. 초기 고객: 공공데이터 활용 기업·SI)

## 7.6 규제·제도·윤리 및 대응방안
(쟁점→대응 짝으로: 개인정보 노출 위험→민감 키 마스킹 3곳·응답 원문 미저장 / 대상 서버 부하·약관→호출 간격 1초·상한 60건·robots.txt 확인 / LLM 오호출·환각→실행 전 사용자 확인·인증키 비노출 / AI 규제(AI기본법 등)→투명성: 실행 이력·근거 표시)
```

- [ ] **Step 4: 분량 추정 + 검증**

```bash
python3 -c "
import re,pathlib
t=pathlib.Path('docs/report/interim-report.md').read_text(encoding='utf-8')
chars=len(re.sub(r'\s',' ',t))
print(f'{chars}자 ≈ {chars/1100:.1f}p (10pt 기준 대략 1,100자/p, 이미지 6장 별도 약 2p)')"
```

15p 초과 추정이면 3장 외 장부터 줄인다. `grep -c "확인 필요"` 결과가 6개(팀명/소속/토큰/진척도들/체크/링크)인지 확인.

- [ ] **Step 5: 커밋**

```bash
git add docs/report/interim-report.md
git commit -m "보고서 초안 — 4~7장 완성 (초안 전체 완료)"
```

---

### Task 8: build_docx.py — 양식 이식 스크립트 + docx 생성

**Files:**
- Create: `docs/report/build_docx.py`, `docs/report/중간결과보고서_최종.docx`

**Interfaces:**
- Consumes: Task 5~7의 md 구조 규약, `/Users/hyunjae/Downloads/2026년도_인공지능_챔피언_중간결과보고서.docx`
- Produces: 제출본 docx. 스크립트는 재실행 가능(md 수정 → 재생성)

- [ ] **Step 1: 스크래치패드에 python-docx venv 준비**

```bash
python3 -m venv "$SCRATCH/venv-docx" && "$SCRATCH/venv-docx/bin/pip" -q install python-docx
```

- [ ] **Step 2: `build_docx.py` 작성** — 동작 규칙:

1. md를 파싱해 `표지 메타`와 `절번호 → 블록 목록`을 만든다 (블록: 단락/불릿/표/이미지)
2. 양식 docx의 본문을 순회하며 절 헤딩 단락(`^\d+(\.\d+)*\.?\s`)을 찾는다
3. 각 절 헤딩 뒤 ~ 다음 절 헤딩(또는 장 헤더 표) 사이의 **안내 단락·예시 표를 전부 삭제**하고 (`//`, `※ 연계 평가항목`, `예)` 전부 — 양식에서 절 사이 내용은 모두 안내문임) md 블록을 삽입한다
4. 표지 표의 값 셀을 메타로 채우고, 지원트랙 셀은 `[ ■ ] 일반 트랙 / [   ] 국내 AI 트랙`으로, 날짜 단락 `2026. xx. xx`는 `2026. 07. 31.`로 바꾼다
5. 모든 삽입 런은 맑은 고딕 10pt (`w:eastAsia` 포함). 이미지는 폭 16cm
6. 장 헤더 표(첫 셀이 1~7)·작성 안내 박스·표지 표의 구조는 건드리지 않는다

핵심 코드 (파일 전체 골격 — 실행하며 다듬는다):

```python
#!/usr/bin/env python3
"""interim-report.md 를 대회 지정 양식 docx 에 이식한다. (Python 3.10)

사용:
  venv/bin/python build_docx.py \
    --template "/Users/hyunjae/Downloads/2026년도_인공지능_챔피언_중간결과보고서.docx" \
    --md interim-report.md --out 중간결과보고서_최종.docx
"""
import argparse, copy, re
from pathlib import Path
from docx import Document
from docx.shared import Pt, Cm
from docx.oxml.ns import qn

FONT = "맑은 고딕"

def style_run(run, bold=False):
    run.font.name = FONT
    run.font.size = Pt(10)
    run.bold = bold
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = rPr.makeelement(qn("w:rFonts"), {})
        rPr.append(rFonts)
    rFonts.set(qn("w:eastAsia"), FONT)

def fill_para(par, text):
    for i, part in enumerate(re.split(r"\*\*(.+?)\*\*", text)):
        if part:
            style_run(par.add_run(part), bold=(i % 2 == 1))

SEC_RE = re.compile(r"^##\s+(\d+(?:\.\d+)*)\.?\s+(.*)")

def parse_md(path):
    """반환: (표지 메타 dict, {절번호: [블록]}) — 블록은 ('p'|'li'|'img'|'h', str) 또는 ('tbl', rows)"""
    cover, sections = {}, {}
    cur = None
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    i, in_cover = 0, False
    while i < len(lines):
        ln = lines[i]
        if ln.startswith("# 표지"):
            in_cover = True
        elif m := SEC_RE.match(ln):
            in_cover = False
            cur = m.group(1)
            sections[cur] = []
        elif in_cover and ln.startswith("- ") and ":" in ln:
            k, v = ln[2:].split(":", 1)
            cover[k.strip()] = v.strip()
        elif cur is not None:
            if ln.startswith("|") and i + 1 < len(lines) and set(lines[i+1].replace("|","").strip()) <= set("-: "):
                rows = []
                while i < len(lines) and lines[i].startswith("|"):
                    cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                    if not set("".join(cells)) <= set("-: "):
                        rows.append(cells)
                    i += 1
                sections[cur].append(("tbl", rows)); continue
            elif m := re.match(r"^!\[.*?\]\((.+?)\)", ln):
                sections[cur].append(("img", m.group(1)))
            elif ln.startswith("### "):
                sections[cur].append(("h", ln[4:]))
            elif ln.startswith("- "):
                sections[cur].append(("li", ln[2:]))
            elif ln.strip():
                sections[cur].append(("p", ln.strip()))
        i += 1
    return cover, sections

DOC_SEC_RE = re.compile(r"^\s*(\d+(?:\.\d+)*)\.?\s+\S")

def build(template, mdpath, out):
    cover, sections = parse_md(mdpath)
    doc = Document(template)
    base = Path(mdpath).parent

    # 표지 표 채우기 (프로젝트명 표가 doc.tables 중 '프로젝트명' 라벨을 가진 표)
    for tbl in doc.tables:
        labels = [row.cells[0].text.strip() for row in tbl.rows]
        if "프로젝트명" in labels:
            for row in tbl.rows:
                lab = row.cells[0].text.strip()
                if lab in cover:
                    row.cells[-1].text = ""
                    fill_para(row.cells[-1].paragraphs[0], cover[lab])
                elif lab == "지원트랙":
                    row.cells[-1].text = ""
                    fill_para(row.cells[-1].paragraphs[0], "[ ■ ] 일반 트랙  /  [   ] 국내 AI 트랙")
            break

    body = doc.element.body
    # 본문을 한 번 훑어 절 헤딩 단락의 (절번호, xml 요소) 목록을 만든다
    heads = []
    for child in list(body):
        if child.tag == qn("w:p"):
            text = "".join(t.text or "" for t in child.iter(qn("w:t"))).strip()
            if text == "2026. xx. xx":
                for t in child.iter(qn("w:t")):
                    t.text = "2026. 07. 31." if t.text and "xx" in t.text else t.text
            m = DOC_SEC_RE.match(text)
            # 안내문(//, ※, 예)) 은 헤딩이 아님
            if m and not text.startswith(("//", "※", "예")):
                heads.append((m.group(1), child, text))

    def is_chapter_table(el):
        if el.tag != qn("w:tbl"):
            return False
        first = "".join(t.text or "" for t in el.iter(qn("w:t")))[:3].strip()
        return first[:1].isdigit() and len(first) <= 3

    for num, head_el, _ in heads:
        if num not in sections:
            continue
        # 다음 절 헤딩/장 헤더 표 전까지의 형제 요소 삭제 (안내문·예시 표)
        sib = head_el.getnext()
        head_els = {h[1] for h in heads}
        while sib is not None and sib not in head_els and not is_chapter_table(sib) and sib.tag != qn("w:sectPr"):
            nxt = sib.getnext(); body.remove(sib); sib = nxt
        # md 블록 삽입 (역순으로 addnext 하면 순서 유지)
        anchor = head_el
        for kind, data in sections[num]:
            if kind == "tbl":
                t = doc.add_table(rows=len(data), cols=len(data[0]))
                t.style = "Table Grid"
                for r, rowdata in enumerate(data):
                    for c, val in enumerate(rowdata):
                        cell = t.cell(r, c); cell.text = ""
                        fill_para(cell.paragraphs[0], val)
                        if r == 0:
                            for run in cell.paragraphs[0].runs: run.bold = True
                el = t._tbl; body.remove(el)
            elif kind == "img":
                p = doc.add_paragraph()
                p.add_run().add_picture(str(base / data), width=Cm(16))
                el = p._p; body.remove(el)
            else:
                p = doc.add_paragraph()
                prefix = {"li": "  · ", "h": ""}.get(kind, "")
                fill_para(p, prefix + data)
                if kind == "h":
                    for run in p.runs: run.bold = True
                el = p._p; body.remove(el)
            anchor.addnext(el); anchor = el

    doc.save(out)
    print(f"저장: {out}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--template", required=True)
    ap.add_argument("--md", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    build(a.template, a.md, a.out)
```

(주의: `doc.add_table/add_paragraph`는 문서 끝에 붙으므로 `body.remove` 후 `addnext`로 옮기는 패턴을 유지한다.)

- [ ] **Step 3: 생성 실행**

```bash
cd docs/report && "$SCRATCH/venv-docx/bin/python" build_docx.py \
  --template "/Users/hyunjae/Downloads/2026년도_인공지능_챔피언_중간결과보고서.docx" \
  --md interim-report.md --out 중간결과보고서_최종.docx
```

- [ ] **Step 4: 자동 검증** — 생성본을 재파싱해 확인:

```bash
"$SCRATCH/venv-docx/bin/python" - <<'EOF'
from docx import Document
d = Document("docs/report/중간결과보고서_최종.docx")
paras = [p.text.strip() for p in d.paragraphs if p.text.strip()]
bad = [t for t in paras if t.startswith("//") or t.startswith("※ 연계")]
print("안내문 잔존:", len(bad), bad[:3])
for sec in ["1.1","1.6","2.1","3.1.3","3.3.4","4.1","5.1","6.3","7.6"]:
    print(sec, any(t.startswith(sec) for t in paras))
imgs = len(d.inline_shapes)
print("이미지 수:", imgs, "(기대: 구성도1 + 캡처 5~6)")
EOF
```

기대: 안내문 잔존 0, 절 전부 True, 이미지 6~7개.

- [ ] **Step 5: 육안 검증 + 커밋** — 사용자에게 Word/한컴에서 열어 페이지 수(15p 이내)·표 깨짐·이미지 배치를 확인해 달라고 요청. 초과 시 md를 줄여 재생성.

```bash
git add docs/report/build_docx.py docs/report/중간결과보고서_최종.docx
git commit -m "양식 이식 스크립트와 제출본 docx 생성"
```

---

### Task 9: 미확정 항목 확정 + 최종본 재생성

**Files:**
- Modify: `docs/report/interim-report.md`, `docs/report/중간결과보고서_최종.docx`

**Interfaces:**
- Consumes: 사용자 답변 (AskUserQuestion)

- [ ] **Step 1: 사용자에게 미확정 항목 일괄 질문** — 팀명 / 팀대표 소속 표기 / Azure 토큰 사용량(대략치 가능) / 기능별 진척도 % 제안값 승인 / 6.1 시연 가능 체크 / (영상 링크는 미촬영이면 "업로드 예정"으로 확정)

- [ ] **Step 2: md에서 `[확인 필요: …]` 전부 치환 후 검증**

```bash
grep -n "확인 필요" docs/report/interim-report.md   # → 출력 없음이어야 함
```

- [ ] **Step 3: docx 재생성 (Task 8 Step 3 명령 재실행) + Step 4 자동 검증 재실행**

- [ ] **Step 4: 최종 커밋 + 제출 안내**

```bash
git add docs/report/
git commit -m "미확정 항목 반영 — 중간결과보고서 최종본"
```

사용자에게 안내: 제출은 ai-champion.or.kr에서 **예선 심사 자료를 제출했던 그 계정**으로 로그인 → 본선 자료 제출 → 업로드 → 최종 제출 전 **'임시저장'**. 시연영상 링크는 별도 제출물.

---

## 자체 검토 결과

- 스펙 커버리지: 산출 파이프라인(T1~T4 참고자료 → T5~T7 초안 → T8 이식 → T9 확정), 장별 설계(T5=1·2장, T6=3장, T7=4~7장), 참고자료 3종(T1 실측·T2/T3 캡처+실측·T4 구성도), 미확정 항목(T9), 안전장치(Global Constraints) — 전부 태스크에 대응됨
- 수치 일관성: 테스트 155(133+22), 수집 25건 규모, Azure 호출 2회 이내 — 스펙과 동일
- 인터페이스 일관성: md 구조 규약(표지 메타·`## 절번호` 헤딩·블록 종류)을 T5가 정의하고 T8 파서가 동일 규약을 읽음. 캡처 파일명은 T2/T3 생성명과 T6 인용명이 일치
