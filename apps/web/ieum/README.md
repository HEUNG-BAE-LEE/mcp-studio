# 이음 관리 콘솔 (web/ieum)

AI 프로토콜 변압기 "이음"의 관리 콘솔입니다. 바닐라 JS, 빌드 단계 없음.
백엔드(FastAPI, `apps/backend/app/ieum`)가 `/ieum/` 에서 정적 서빙하고, 모든 데이터는 `/api/ieum/<메뉴>/` JSON API로 주고받습니다.
화면이 API를 상대 경로로 부르므로 **백엔드와 같은 주소에서 열어야** 합니다. 파일을 따로 서빙하면 동작하지 않습니다.

| 메뉴 | 화면 JS | 백엔드 라우터 (`app/ieum/routers/`) | 하는 일 |
|---|---|---|---|
| 대시보드 | `js/menu/dashboard.js` | `dashboard.py` | 호출 로그에서 KPI, 시간대별 호출, 많이 쓰인 도구 계산 |
| 원본 시스템 | `js/menu/sources.js` | `sources.py` | OpenAPI/WSDL/호출 샘플/공공데이터 명세를 읽어 시스템 등록, 도구 후보 생성, 명세 재읽기(변경 감지), 삭제 |
| 변환 스튜디오 | `js/menu/studio.js` | `studio.py` | 도구 설명, 파라미터·응답 매핑, 변환 규칙, 실행 정책 편집. 설명 다시 쓰기는 `ANTHROPIC_API_KEY` 필요 |
| 테스트 실행 | `js/menu/playground.js` | `playground.py` | 도구를 실제로 호출해 원본 요청, 응답, 변환 결과를 단계별로 확인. 자연어 질문은 `ANTHROPIC_API_KEY` 필요 |
| AI 연결 배포 | `js/menu/deploy.js` | `deploy.py`, `mcp.py` | 도구 묶음 구성과 배포, 액세스 키 발급, **MCP 서버**(`/mcp/<워크스페이스>/<묶음>`) |
| 호출 로그 | `js/menu/logs.js` | `logs.py` | MCP·테스트 실행의 모든 호출 기록과 변환 과정 |

공통 코드는 `js/common/`(상태, 유틸, 변환 과정 표시, API 호출), 진입점은 `js/main.js`.
백엔드 구조는 `apps/backend/app/ieum/__init__.py` 의 설명을 보세요. 게이트웨이 핵심(명세 파싱, 변환 엔진, 인증 보관, 실행)은 `gateway/`, 시연용 원본 시스템은 `routers/demo_origin.py`.

## 실행

저장소 루트에서 한 번에 띄웁니다. 이음은 백엔드 프로세스에 함께 올라가므로 따로 띄울 것이 없습니다.

```bash
./start.sh
# http://localhost:8000/ieum/
```

의존성(PyYAML, cryptography)은 `apps/backend/requirements.txt` 에 있습니다. `start.sh` 가 불러오지 못하면 알려 줍니다.

## 바로 써 보기

시연용 레거시 인사 시스템(REST + SOAP)이 백엔드 안에 들어 있습니다.
원본 시스템 연결 → REST → 명세 URL `http://localhost:8000/demo-origin/openapi.json`, 인증 API Key(헤더 `X-API-KEY`, 값 `demo-key`).
SOAP은 `http://localhost:8000/demo-origin/hr.wsdl`, 인증 없음.

연결 후: 변환 스튜디오에서 검토 후 공개 → AI 연결 배포에서 묶음 만들기, 배포, 키 발급 → 발급된 키로 MCP 연결.

```bash
curl http://localhost:8000/mcp/ieum/<묶음 주소 이름> -H "Authorization: Bearer <키>" \
  -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## 환경변수

`apps/backend/.env` 에 적으면 됩니다. 모두 선택입니다.

| 이름 | 용도 |
|---|---|
| `ANTHROPIC_API_KEY` | 테스트 실행의 자연어 질문, 도구 설명 AI 다시 쓰기 (없으면 해당 기능만 꺼짐) |
| `IEUM_CHAT_MODEL` | 위 기능에 쓸 모델 (기본 `claude-sonnet-5-5`) |
| `IEUM_SECRET_KEY` | 원본 시스템 인증 정보를 암호화하는 키. 없으면 처음 쓸 때 무작위로 만들어 `.secret_key` 에 둡니다 |
| `IEUM_STATE_DIR` | 변경분을 저장할 폴더 (기본 `apps/backend/data/ieum`) |
| `IEUM_WEB_ROOT` | 콘솔 정적 파일 위치 (기본 `apps/web/ieum`) |

## 데이터

각 메뉴의 시드는 `apps/backend/app/ieum/data/<메뉴>/*.json` 이고 대부분 빈 초기값입니다. 실제 데이터는
`apps/backend/data/ieum/<메뉴>.<이름>.json` 에 저장됩니다(`apps/backend/data/` 는 git 제외).
원본 시스템 인증 정보는 `source_secrets.enc` 에 Fernet으로 암호화해 저장하고, 액세스 키는 해시만 저장합니다.
저장소 구현은 `app/ieum/store.py`.

초기화하려면 `apps/backend/data/ieum` 을 지웁니다. `.secret_key` 와 `source_secrets.enc` 는 짝이라
**하나만 지우면 저장된 인증 정보를 읽지 못합니다.** 지우려면 폴더째 지우세요.

## 테스트

```bash
cd apps/backend && .venv/bin/pytest tests/test_ieum_gateway.py tests/test_ieum_units.py -v
```

테스트는 상태 파일을 임시 폴더로 돌려 쓰므로 `data/ieum` 을 건드리지 않습니다.

## 아직 시연 수준인 부분

- **API 자동 탐색**(Git 소스 분석, 운영 화면 탐색)은 탐색 서버가 필요해 연결 방식에서 비활성화했습니다. 화면 코드(`sources.js`)와 시연 데이터(`app/ieum/data/sources/discovery.json`)만 남아 있습니다.
  자동 탐색 결과를 등록하는 `POST /api/ieum/sources/` 는 서버에 아직 없습니다. 기능이 꺼져 있어 지금은 닿지 않는 경로입니다.
- 응답 캐시 설정은 저장만 하고 아직 적용하지 않습니다.
- 워크스페이스, 사용자, 인증(관리 콘솔 로그인)은 없습니다. `app/ieum/data/sources/workspace.json` 의 값을 씁니다.
  콘솔 API(`/api/ieum`)와 시연용 원본(`/demo-origin`)은 인증 없이 열려 있고, 원본 시스템 연결은 서버가 입력한 주소로 직접 요청을 보냅니다.
  로컬 시연용이라는 전제이므로 외부에 공개된 서버에 올리기 전에 인증을 먼저 붙여야 합니다.
