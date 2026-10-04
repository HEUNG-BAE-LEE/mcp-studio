# MCP-Studio

MCP-Studio(사내 데이터 소스를 연결 · 가공해 커넥터로 발행하는 운영 도구) 웹 프런트엔드의 **디자인 가이드 저장소**. 규칙(`docs/DESIGN.md`) · 컴포넌트 계약(`docs/COMPONENTS.md`) · 토큰(`apps/web/src/styles/tokens.css`) · 카탈로그(`/_guide`)를 두고, 새 화면 · 컴포넌트가 이를 따르며 가이드를 고쳐 나간다.
지금 화면(LNB 셸 · 대시보드 · 프로젝트 상세 · 준비 중 자리)은 규칙을 보여 주는 **샘플 IA**이고 언제든 바뀐다. 백엔드 없이 더미 데이터로 돈다.
이 저장소에서 하는 일은 가이드를 키우는 것이다 — 사용자가 준 화면 · 컴포넌트 과제에 가이드를 적용하고, 맞는 규칙이 없거나 맞지 않는 곳은 문서부터 고친다. 가이드 쪽 열린 결정은 DESIGN `## 미정`에 있다. 준비 중 자리와 샘플 화면의 빈 곳(없는 기능 · 고정한 값)은 할 일 목록이 아니다.

## 구조
```
apps/web/src/
  styles/    tokens.css(토큰 원본) · base.css · fonts/
  ui/        컴포넌트 · icons · lib(공용 훅 · 유틸)
  screens/   화면 폴더 하나에 화면 하나. _guide = 컴포넌트 카탈로그(/_guide)
  api/       types.ts · errors.ts · hooks/ · dummy/ · realtime.ts · screenQueries.ts — 자세히는 백엔드 연동 구조
  copy/      화면 문장 틀(code → 문장)
  app/       라우트 · 전역 상태(Zustand) · 내비게이션 · 사용자 · <도메인>/(두 화면 이상이 쓰는 도메인 순수 로직 · 폼 조각)
  platform/  브라우저 API 경계 — storage(저장) · media(미디어 쿼리) · copyText(클립보드) · events(실시간 이벤트)
apps/web/lint/   stylelint 규칙(px · 변수 · 끄기 사유) · check-docs(lint:docs)
```
- 화면은 훅으로만 데이터를 받는다(쿼리 `api/hooks` · 실시간 `api/realtime` · 현재 사용자 · 권한 `app/user`) — 백엔드 자리는 [백엔드 연동 구조](#백엔드-연동-구조)
- 화면 폴더끼리 import하지 않는다. 둘 이상이 쓰면 UI → `ui/` · 쿼리 → `api/` · 문구 → `copy/` · 도메인 순수 로직 · 폼 조각 → `app/<도메인>/` · 앱 전역 → `app/` (eslint가 막는다). 예: 두 번째 화면이 새 프로젝트 폼을 쓰면 `screens/shell/projectDraft.ts` · `ProjectFields.tsx`를 `app/project/`로 옮긴다
- 화면 · `ui/`는 `window` · `document` · `navigator` · `fetch`를 직접 쓰지 않고 `platform`을 거친다. Electron은 `apps/desktop`에서 `platform` 구현(`web.ts` 자리)을 바꿔 붙인다
- 스택: React 19 · Vite · TypeScript(strict) · React Router · TanStack Query · Zustand · Radix(`radix-ui`) · CSS Modules. Tailwind · CSS-in-JS · 완성형 UI 킷을 쓰지 않는다

## 백엔드 연동 구조
프런트엔드 쪽 자리만 적는다.
```
apps/web/src/api/
  types.ts         데이터 타입 원본(손으로 쓴다) — 화면 · 훅 · 더미가 함께 쓰는 입력 · 응답 모양(백엔드 계약이 들어올 자리)
  errors.ts        ApiError(status · code · fields · raw · subjects) — 화면은 code로 문장을 고른다(copy/errors)
  hooks/           TanStack Query 훅 · keys.ts(쿼리 키). 화면은 훅만 부른다
  dummy/           훅이 부르는 비동기 함수 = 지금의 서버 자리
                   data/(시드 · 소스 저장소) · error.ts(respond — 지연 · 실패 시나리오 · 오류 code) · scenario.ts(?mock= · ?role=) · realtime.ts(가짜 실시간)
  realtime.ts      실시간 이벤트(platform.events())를 쿼리 캐시에 반영하는 구독 훅
  screenQueries.ts 화면 쿼리 묶음의 없음(404) · 실패 판정(app/screenGate가 쓴다)
```
- 실제 백엔드가 붙으면 바뀌는 곳은 데이터를 가져오는 함수다 — 훅이 부르는 `api/dummy/<자원>.ts`(현재 사용자 쿼리는 `app/user/useCurrentUser.ts`가 `api/dummy/user.ts`를 직접 부른다) 대신 HTTP 클라이언트(예: `api/client/<자원>.ts`)를 부르고, 실패는 `ApiError`로 바꿔 던진다. 훅 이름 · 쿼리 키 · `api/types.ts` · 화면은 그대로다
- 실시간 연결은 `platform/web.ts`의 `connect()`(와 그 import)가 `api/dummy/realtime.ts`에 붙어 있다 — 이것을 서버 이벤트 구독으로 바꾸고, 끊긴 뒤 다시 열리면 `connection.reopened`를 쏜다. 이벤트 이름 · 페이로드(`platform/events.ts`)와 `api/realtime.ts`는 그대로다
- `?mock=` · `?role=` 시나리오는 더미 계층의 것이다. `api/dummy/scenario.ts`를 읽는 바깥 두 자리(`main.tsx` — 시작 때 읽기 · `app/queryClient.ts` — 실패 시나리오 재시도 판정)도 서버가 붙으면 걷는다

## 명령
```
nvm use           # Node 22 — Volta(package.json) · nvm(.nvmrc). Volta는 셸에 `export VOLTA_FEATURE_PNPM=1` — 없으면 pnpm이 Volta 기본 Node로 돈다
pnpm i            # Node 22(`engines`) · pnpm 10(`packageManager`)
pnpm dev          # :5173
pnpm typecheck
pnpm lint         # eslint + prettier --check + lint:tokens(stylelint — 색 · px · 웨이트 · 그림자 · 포커스 링) + lint:docs(문서 ↔ 토큰 · 카탈로그 이름 대조)
pnpm format       # prettier --write
pnpm build
```
- `http://localhost:5173/_guide` — 컴포넌트 카탈로그(모든 컴포넌트 · 변형 · 화면 틀 예, 1024 토글)
- 1024 보기 — 창 폭을 1280 미만으로 줄이면 앱이 1024 배치(LNB 자동 접힘 · 좁은 여백)로 바뀐다. 브라우저 개발자 도구 기기 모드에서 폭 1024로 확인한다. 카탈로그는 `1024` 토글
- `?mock=empty` · `?mock=failed` · `?mock=slow` · `?role=viewer` 등 — 빈 상태 · 실패 · 로딩 · 권한 없음 화면 보기. 목록과 뜻은 `apps/web/src/api/dummy/scenario.ts`

## 새 화면 · 컴포넌트를 만들 때
1. `docs/DESIGN.md` `## 핵심 규칙`부터 읽는다
2. 화면 틀 하나를 고르고 `docs/COMPONENTS.md`의 컴포넌트로만 조립한다. 화면에서 만들지 않는 것은 DESIGN `Do's and Don'ts`
3. 맞는 토큰 · 컴포넌트가 없으면 코드보다 문서를 먼저 고친다
4. `pnpm typecheck && pnpm lint` — 린트는 규칙 일부만 막는다. 막는 규칙 목록은 DESIGN `## 핵심 규칙` 표의 막는 수단 열

Claude Code를 쓰면 `CLAUDE.md`와 `.claude/skills/`(new-screen · design-change · ui-review)가 같은 절차를 따르게 한다.

Claude 없이 작업할 때는 `.claude/skills/ui-review/SKILL.md`를 점검표로 쓴다.

이 저장소는 테스트를 쓰지 않는다 — 화면은 언제든 바뀌는 샘플이고, 규칙은 타입 · 린트 · 카탈로그 · ui-review로 지킨다.
