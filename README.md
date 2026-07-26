# mcp-studio

브라우저에서 사용자의 클릭과 그 클릭이 유발한 API 호출을 기록하고, 그중 하나를
골라 **LLM이 호출할 수 있는 액션**으로 바꾸는 도구입니다.

기록은 Chrome 확장이, 분석·변환·실행은 FastAPI 백엔드가, 화면은 React 관리자 앱이
담당합니다. LLM은 Azure OpenAI를 씁니다.

> **프로토타입입니다.** 로그인, 프로젝트 CRUD, 액션 버전 관리, MCP 엔드포인트는
> 아직 없습니다. 아래 "알려진 제약"을 참고하세요.

---

## 1. 준비

### 요구사항

| 항목 | 버전 | 비고 |
|---|---|---|
| Python | 3.10.11 | 3.11+ 문법 미사용 |
| Node.js | v25.8.0 | npm workspaces 사용 |
| Chrome | 최신 | 확장 프로그램 테스트용 |
| Azure OpenAI | — | function calling 지원 배포 필요 |

Docker와 pnpm/uv는 쓰지 않습니다.

### 설치

```bash
# 저장소 루트에서
npm install

# 백엔드
cd apps/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### Azure 설정

`apps/backend/.env` 파일을 만들고 네 값을 채웁니다. `.env.example`을 복사해 쓰세요.

```bash
cd apps/backend
cp .env.example .env
# 편집기로 열어 실제 값 입력
```

```
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://<리소스명>.openai.azure.com/
AZURE_OPENAI_API_VERSION=2025-04-01-preview
AZURE_OPENAI_DEPLOYMENT=<배포 이름>
```

`AZURE_OPENAI_DEPLOYMENT`에는 **모델 이름이 아니라 배포(deployment) 이름**을
넣습니다. 네 값 모두 기본값이 없습니다 — 하나라도 비면 백엔드가 즉시 `KeyError`로
멈춥니다. 조용히 잘못된 값으로 도는 것보다 낫기 때문입니다.

`.env`는 `.gitignore` 대상입니다. **절대 커밋하지 마세요.**

값이 제대로 로드되는지는 이렇게 확인합니다. 키 값 자체는 출력하지 않습니다:

```bash
cd apps/backend && .venv/bin/python -c \
  "from dotenv import load_dotenv; import os; load_dotenv(); \
   print({k: bool(os.environ.get(k)) for k in \
   ['AZURE_OPENAI_API_KEY','AZURE_OPENAI_ENDPOINT','AZURE_OPENAI_API_VERSION','AZURE_OPENAI_DEPLOYMENT']})"
```

네 개 모두 `True`여야 합니다.

---

## 2. 실행

터미널 두 개가 필요합니다.

```bash
# 터미널 1 — 백엔드 (:8000)
cd apps/backend && .venv/bin/uvicorn app.main:app --port 8000
```

기동 시 테이블 생성과 시드 데이터 삽입이 자동으로 끝납니다. 별도 마이그레이션이나
시드 명령은 없습니다.

```bash
# 터미널 2 — 관리자 화면 (:5173)
cd apps/admin && npm run dev
```

### Chrome 확장 로드

```bash
cd apps/extension && npm run build
```

1. Chrome에서 `chrome://extensions` 열기
2. 우측 상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드** 클릭
4. `apps/extension/.output/chrome-mv3` 디렉터리 선택

확장 아이콘을 클릭하면 사이드 패널이 열립니다.

---

## 3. 가장 빠른 테스트 — LLM 콘솔만

확장 없이 30초 안에 핵심 동작을 확인할 수 있습니다. 시드에 액션이 하나 들어 있기
때문입니다.

브라우저에서 <http://localhost:5173/console> 을 열고 입력창에 이렇게 칩니다:

```
광화문 근처 아파트 단지 알려줘
```

**질의** → **이 내용으로 실행** 순서로 누릅니다. 이렇게 나오면 정상입니다:

```
선택된 액션: 아파트 단지 마커 조회   search_apartment_markers
{
  "minX": 126.965,  "minY": 37.568,
  "maxX": 126.982,  "maxY": 37.579,
  "srhYear": 2026,  "poiType": "A"
}

HTTP 200 · 126ms
광화문 근처 아파트 단지로는 세종, 세종로대우, 신문로맨션, 광화문스페이스본,
경희궁자이, 경희궁의아침 ... 등이 확인됩니다.
```

좌표값은 매번 조금씩 다릅니다 — LLM이 그때그때 추론하기 때문입니다. 소요 시간도
편차가 큽니다(측정값 126ms ~ 5.4초). **단지 이름이 실제로 나오는지**만 보면 됩니다.

이게 되면 Azure 연결, 도구 변환, 실행 게이트웨이, 응답 요약이 전부 정상입니다.

화면 예시: `docs/screenshots/scene8-llm-console.png`

---

## 4. 전 구간 테스트 — 기록부터 실행까지

실제 사이트에서 클릭을 기록해 액션을 새로 만드는 경로입니다.

### 4-1. 기록

1. Chrome에서 <https://rt.molit.go.kr/pt/gis/gis.do> (국토교통부 실거래가 지도) 접속
2. 확장 아이콘을 눌러 사이드 패널을 엽니다
3. **기록 시작**
4. 지도에서 **확대(+) 버튼을 한 번** 누릅니다
5. 사이드 패널에 요청이 3건 안팎 잡히는 것을 확인합니다
6. **기록 종료 및 전송**

### 4-2. 후보 확인

<http://localhost:5173/sessions/1> 로 이동합니다. 이런 표가 나옵니다:

| 점수 | Method | URL | 추천 사유 |
|---|---|---|---|
| ★ 9 | POST | `/pt/gis/getMarker.do` | 변경성 메서드 POST +3, Fetch/XHR 요청 +2, 클릭 후 1초 이내 +2 … |
| 9 | POST | `/cmm/gis/getCenterLedCdPnu.do` | (동일) |
| 3 | POST | `/pt/main/accesLog.do` | … **로그 API −5** |

로그성 API는 점수가 깎이고 **액션 만들기** 버튼이 비활성화됩니다.

`getMarker.do` 행의 **액션 만들기**를 누릅니다. 세션 번호가 `1`이 아니면 URL의
숫자를 바꿔 주세요.

화면 예시: `docs/screenshots/scene5-session-detail.png`

### 4-3. 액션 등록

파라미터 6개(`minX`, `minY`, `maxX`, `maxY`, `srhYear`, `poiType`)가 타입과 예시값과
함께 자동으로 채워져 있습니다. 설명을 적고 **활성화하고 테스트하기**를 누릅니다.

### 4-4. 실행

콘솔로 넘어가 §3과 같은 질의를 던지면 됩니다.

---

## 5. 자동 테스트

```bash
# 백엔드 — 64개
cd apps/backend && .venv/bin/pytest tests/ -v

# 확장 — 13개
cd apps/extension && npm test

# 타입체크
cd apps/admin && npx tsc --noEmit
cd apps/extension && npm run compile
```

브라우저가 필요한 부분(확장의 기록 동작, 화면 렌더)은 자동 테스트가 없습니다.
§3~4의 수동 절차로 확인합니다.

---

## 6. 초기화

액션이 중복되거나 상태가 꼬이면 DB 파일을 지우면 됩니다. 기동 시 테이블과 시드가
다시 만들어집니다.

```bash
rm -f apps/backend/data/dev.db
lsof -ti :8000 | xargs kill     # 아래 "문제가 생기면" 참고
cd apps/backend && .venv/bin/uvicorn app.main:app --port 8000
```

---

## 7. 문제가 생기면

**콘솔이 404를 냅니다.**
포트 8000을 쥐고 있는 낡은 `uvicorn`이 이전 코드를 서빙하고 있을 가능성이 높습니다.
`kill $(cat /tmp/backend.pid)`는 pid 파일이 낡아 실패할 수 있으니 이렇게 잡습니다:

```bash
lsof -ti :8000 | xargs kill
```

서버가 최신 코드를 서빙하는지는 라우트 존재로 확인합니다:

```bash
curl -s http://localhost:8000/openapi.json | python3 -c \
  "import json,sys; print('/api/projects/{project_id}/llm-test' in json.load(sys.stdin)['paths'])"
```

`True`가 아니면 아직 낡은 프로세스입니다.

**화면에 "요청을 처리하지 못했습니다"가 뜹니다.**
백엔드가 안 떠 있거나 `.env`가 비어 있습니다. 배너 아래 문구가 원인을 알려줍니다.

**실행이 `400 Request Blocked`로 막힙니다.**
대상 사이트의 WAF가 `User-Agent`, `Referer`, `X-Requested-With` 헤더를 요구합니다.
이 헤더들을 골라 저장하는 쪽은 `apps/backend/app/services/schema_infer.py`의
`PRESERVED_HEADERS`입니다. 실측상 이 헤더가 있으면 200, 없으면 400입니다.

**LLM이 도구를 안 부르고 되묻습니다.**
`tools`만 넘기면 모델이 "검색 범위를 알려 주세요"라고 답합니다. 한국어 시스템
메시지와 `tool_choice="required"`를 함께 보내야 합니다 — 둘 다 필요하며
`apps/backend/app/routers/llm.py`에 이미 반영돼 있습니다.

**`npm install`이 권한 오류로 실패합니다.**

```bash
sudo chown -R $(id -u):$(id -g) ~/.npm
```

---

## 8. 알려진 제약

- `/actions/new`는 **열릴 때마다 새 Action 행을 만듭니다.** 리허설로 이 화면을 여러 번
  열면 DRAFT가 쌓입니다. §6의 초기화로 정리합니다.
- 대상 API 호출 간격은 최소 1초로 제한됩니다. 공공 서버 부하를 배려한 값이라
  낮추지 마세요.
- 응답 본문 원문은 저장하지 않습니다. 구조와 샘플 1건만 남깁니다.
- 민감 키(`password`, `token`, `apiKey`, `sessionId`, `ssn`, `jumin`, `cardNumber`,
  `cvv`)는 URL 쿼리·요청 본문·응답 샘플 세 곳 모두에서 마스킹됩니다. 이름과
  전화번호는 마스킹 대상이 아닙니다.
- 요청 본문이 JSON인 API는 `bodySchema`가 생성되지 않습니다. 현재 대상 두 곳은
  모두 form-urlencoded입니다.
- CORS가 `*`로 열려 있습니다. 데모 전용 설정입니다.

---

## 9. 구조

```
apps/
  extension/   Chrome 확장 (WXT + React) — 클릭·네트워크 기록
  backend/     FastAPI + SQLModel + SQLite — 점수화·스키마 추론·실행·LLM
  admin/       React + Vite — 후보 목록, 액션 편집, LLM 콘솔
docs/
  demo-script.md        촬영 대본
  screenshots/          화면 예시
```

DB는 `apps/backend/data/dev.db` 파일 하나입니다.
