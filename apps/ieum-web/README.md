# 이음 웹 콘솔 (apps/ieum-web)

이음 관리 콘솔의 React 판이다(React 19 · React Router 7 · TanStack Query · Vite · TypeScript, CSS Modules). 옛 콘솔 `apps/web/ieum`을 메뉴별로 옮기는 중이다. 규칙은 `CLAUDE.md` · `docs/DESIGN.md` · `docs/COMPONENTS.md`.

## 명령

이 폴더에서 돌린다. 루트 npm workspaces에 들어 있지 않으므로 설치도 이 폴더에서 한다.

| 명령 | 하는 일 |
|---|---|
| `npm ci` | 설치(`package-lock.json` 그대로) |
| `npm run dev` | 개발 서버 `http://localhost:5174/ieum/` — `/api/ieum` 요청을 `IEUM_BACKEND`로 넘긴다 |
| `npm run typecheck` | `tsc --noEmit -p tsconfig.json` |
| `npm run lint` | 아래 검사 넷을 차례로 |
| `npm run build` | typecheck 뒤 `vite build` → `dist/` |
| `npm run preview` | `dist/` 미리 보기 |

- **Node** — Volta가 24.15.0으로 맞춘다(`package.json` `volta` · `.nvmrc`). Volta가 없으면 같은 버전을 직접 쓴다
- **백엔드** — 개발 서버는 백엔드를 띄우지 않는다. 먼저 `apps/backend`에서 uvicorn으로 띄운다(루트 `CLAUDE.md` `## 명령`). 백엔드 주소가 기본값(`vite.config.ts` `BACKEND`)과 다르면 `IEUM_BACKEND=http://localhost:<포트> npm run dev`
- **옛 콘솔** — 같은 백엔드가 `/ieum/`에서 서빙한다(백엔드 주소 + `/ieum/`). 이식 기간에 새 콘솔과 나란히 비교할 때 쓴다
- **카탈로그** — `http://localhost:5174/ieum/_guide`(셸 밖). 폭 1920 · 1440 · 1280 · 1024 · 390과 경계 폭, 라이트 · 다크를 바꿔 본다. 운영 빌드에서도 열린다

| 검사 | 파일 | 보는 것 |
|---|---|---|
| `lint:oxlint` | `.oxlintrc.json` | TypeScript · React · `jsx-a11y` · `no-alert` · 화면 · ui의 전역 `fetch` 등. 끄는 주석에는 규칙 이름과 사유 |
| `lint:source` | `lint/check-source.js` | `copy/` 밖 한글 문장 · 값 없음 표기 · 금지어 · 화면 폴더끼리 import · 전역 우회 · 화면의 서식 직접 호출 · 테스트 파일 · 인라인 `style` |
| `lint:tokens` | `lint/check-css.js` | `.module.css`의 색 리터럴 · 임의 px · 모르는 토큰 · 허용 값(그림자 · 웨이트 · 자간 · z · 투명도 · 시간 · 포커스 링) · 화면 CSS 글자 축 · `@media` |
| `lint:docs` | `lint/check-docs.js` | 문서의 토큰 ↔ `tokens.css` · `docs/`에 두 문서만 · COMPONENTS 카탈로그 행 ↔ `/_guide` 절 · 다크 두 블록 · `BREAKPOINTS` ↔ `ALLOWED_MEDIA` |

값 표는 `lint/values.js` 한 곳이다.

## 구조

```
apps/ieum-web/
  CLAUDE.md · README.md     우선 규칙 · 문서 지도 / 명령 · 구조 · 시나리오
  .claude/skills/           new-screen · design-change · ui-review (이 폴더 범위 스킬)
  docs/                     DESIGN.md · COMPONENTS.md 둘만
  lint/                     check-source · check-css · check-docs(node 기본 모듈 + typescript) · values.js(값 표)
  src/
    main.tsx                진입점 — 개발 빌드에서만 ?mock을 읽는다
    styles/                 tokens.css(토큰 원본 — 라이트 · 다크 두 블록) · base.css(전역 바탕 · 포커스 링 · 모션 줄이기)
    ui/                     공통 부품(CSS Modules · data-*) · icons/ · index.ts(공개 목록 — 화면은 @/ui에서만)
    app/                    라우터(routes · nav) · RootLayout · shell/(레일 · GNB · LNB) · queryClient · store
                            · screenGate · screenQueries · lastPath · breakpoints · useMediaQuery · clipboard
                            · <도메인>/(두 화면 이상이 쓰는 순수 로직 · 폼 조각)
    api/                    client(봉투 풀기 · ApiError) · scenario(?mock) · types · time · hooks/(훅 · 쿼리 키)
    copy/                   화면 문장 · 서식 — shell · errors · status · <menu>
    screens/                <menu>/<Name>Screen.tsx · pending/(아직 옮기지 않은 메뉴) · _guide/(카탈로그)
```

- 화면 폴더끼리 import하지 않는다. 두 화면이 쓰는 것은 부품 → `ui/`, 쿼리 → `api/`, 문구 → `copy/`, 순수 로직 · 폼 조각 → `app/<도메인>/`, 앱 전역 → `app/`으로 옮긴다(`lint:source`)
- 화면 경로는 `app/nav.ts` 한 곳이고 basename은 `/ieum`이다. 대시보드 `/` · 원본 시스템 `/sources` · API 자동 탐색 `/sources/discovery/:jobId` · 변환 스튜디오 `/studio/:toolId?` · 테스트 실행 `/playground` · AI 연결 배포 `/deploy/:toolsetId?` · 호출 로그 `/logs` · 카탈로그 `/_guide`

## ?mock 시나리오

개발 빌드에서만 주소에 `?mock=<이름>`을 붙인다(`src/api/scenario.ts` — 운영 빌드에는 들어가지 않는다). 시작 때 한 번 읽으므로 바꾸려면 주소를 고치고 새로고침한다. 앱 안에서 메뉴를 옮겨도 그대로다. 모르는 이름이면 개발 콘솔 경고 뒤 `default`로 돈다. 실패 시나리오의 문장은 실제 서버 실패 봉투와 같은 길로 그려지고 끝에 `[mock]`이 붙는다.

| 시나리오 | 하는 일 | 확인할 화면 · 자리 |
|---|---|---|
| `default`(붙이지 않음) | 실제 백엔드 응답 그대로 | 모든 화면 — 옛 콘솔과 나란히 |
| `slow` | 모든 요청을 1.5초 늦춘다 | 모든 화면의 첫 로딩 — 본문 · 상자가 비고 `aria-busy`만(문구 · 스피너 없음). 버튼 요청 중 잠금 |
| `failed` | 모든 요청이 서버 실패(500) | 모든 화면의 첫 조회 실패 — 셸은 남고 본문 자리에 실패 상자, 재시도 버튼 없음 |
| `write-failed` | GET이 아닌 요청만 실패 | 원본(연결 · 인증 다시 입력 · 삭제) · 스튜디오(저장 · 명세 다시 읽기 · AI로 다시 쓰기) · 테스트 실행(실행 · 대화) · 배포(묶음 만들기 · 고치기 · 삭제 · 배포 · 시작 · 중지 · 키 발급 · 폐기) · 탐색(시작 · 취소 · 다시 탐색 · 등록 · 삭제) — 경고 토스트 또는 층 안 실패 상자 |
| `region-failed` | 영역 조회(`{ region: true }`)만 실패 | 대시보드 요약 상자(KPI · 시간대 차트 · 많이 쓰인 도구) · 구조도 AI 쪽, 호출 로그 상세 드로어 · AI 클라이언트 필터, 원본 화면의 자동 탐색 작업 표 · 탐색 마법사 단계, 스튜디오 근거 드로어, 배포 액세스 키 상자 · 서버 로그 모달. 자리마다 그 상자 안 실패 상자 또는 경고 토스트(이음 그대로)이고 화면 나머지는 그대로. 테스트 실행은 해당 없음 |
| `empty` | 사용자가 만든 자원(원본 · 도구 · 묶음 · 키 · 로그 · 탐색 작업)만 빈 응답, 서버 설정 값(workspace · 마법사 · 탐색 기본값 · 모델)은 남김 | 대시보드 처음 빈 상태 · 원본 목록 · 스튜디오 · 배포 묶음 · 액세스 키 · 호출 로그 표 · 원본 화면의 탐색 작업 절(0개면 그리지 않음) |
| `drift` | `GET /studio/`에서 도구가 있는 첫 원본의 첫 도구를 명세 변경 감지(`drift`)로 바꾼다 — 고치지 않은 첫 응답 필드에 새 이름 표식 `_mock` | 원본 목록의 상태 "명세 변경 감지" · "검토 N개", 대시보드 알림, 스튜디오의 명세 변경 표시 |
| `source-without-tools` | `GET /studio/`에서 도구가 있는 첫 원본의 도구를 비운다 | 원본 행 · 구조도 노드를 누르면 그 원본의 빈 스튜디오(`/studio?src=<id>`)로 가는지 |
| `disc` | `GET /sources/` 끝에 자동 탐색 원본 하나, `GET /studio/`에 그 원본의 검토 대기 도구들(근거 종류 · 검증 값마다)을 더한다 — 서버에 없는 도구라 저장 · 다시 쓰기는 실패한다 | 원본 목록 · 대시보드 구조도의 자동 탐색 원본, 스튜디오의 탐색 도구 근거 · 검증 표시 |
| `no-browser` | `GET /discovery/`의 브라우저 · Git을 없음으로, 시연 값을 비운다 | 탐색 마법사 탐색 대상 단계 — 화면 탐색 스위치 잠김 · 브라우저 없음 안내 · Git 없음 안내 · 시연 값 안내 없음 |

- 화면은 시나리오를 따로 만들지 않는다. 새 목록 자원이 생기면 `empty`의 빈 응답 표(`EMPTY_OF`)에 행을 더한다. 시나리오별 응답 바꾸기는 `scenarioData`가 맡는다(빈 응답 · 상태 픽스처)
- 다크는 브라우저의 `prefers-color-scheme: dark` 흉내로 본다 — 화면에는 테마 전환이 없고 카탈로그에만 있다
