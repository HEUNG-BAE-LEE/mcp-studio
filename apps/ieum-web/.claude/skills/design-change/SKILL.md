---
name: design-change
description: 이음 웹 콘솔(apps/ieum-web)의 토큰 · 린트 값 · 부품 · 변형 · prop · 셸 · 핵심 규칙을 새로 더하거나 바꿀 때 쓴다 — MCP-Studio design-guide판 design-change가 아니다. 문서(DESIGN · COMPONENTS)를 먼저 고치고 tokens.css · values.js → ui → /_guide 카탈로그 → 쓰는 곳 → 스킬 순서로 옮기며, 가이드 쪽 · 화면 쪽 파일 주인을 지키게 한다.
---

# 디자인 변경 · 새 부품 (이음)

원본은 `docs/DESIGN.md` · `docs/COMPONENTS.md`다. `docs/DESIGN.md` `## 핵심 규칙`을 먼저 읽고, 코드보다 문서를 먼저 고친다. 규칙 하나는 한 곳에만 쓴다 — DESIGN은 핵심 규칙 · 토큰 뜻 · 색 · 글자 · 레이아웃 · 폭 · 그림자 · 모양 · 아이콘 · 모션 · 문구 · 접근성, COMPONENTS는 부품별 쓰는 곳 · 쓰지 않는 곳 · prop · 크기 · 상태 · 접근성 · 폭, 토큰 값은 `tokens.css`, 린트 값은 `lint/values.js`, 스킬은 절차. 다른 곳에는 절을 가리키는 한 줄만 둔다. 값 · 모양의 근거는 이음 원본 콘솔이다 — `design-guide`의 값 · 부품을 기본값으로 들이지 않는다.

## 1. 정말 새로 필요한가
- 기존 부품의 variant · prop으로 되는지 COMPONENTS에서 먼저 본다. 되면 변형을 늘린다
- 이음 원본에 그 모양 · 동작이 있는지 본다(`apps/web/ieum`의 `css/console.css` · `js/` 파일:줄) — 원본에 없는 모양을 지어내지 않는다
- 화면 하나에만 맞는 값이면 규칙을 바꾸지 말고 있는 단계를 쓴다. 판단이 서지 않으면 DESIGN `## 미정`에 행을 더하고 사용자에게 묻는다
- 한 화면만 쓰는 모양은 화면 폴더 `<Region>.module.css`(토큰만)에 두고, 두 번째 화면이 쓰게 되면 여기로 와 `ui`로 옮긴다(화면 폴더끼리 import 금지)

| 종류 | 원본 | 같이 움직이는 것 |
|---|---|---|
| 토큰 | DESIGN 해당 절(이름 · 뜻 · 쓰는 곳) | `src/styles/tokens.css` 라이트 `:root` + 다크 두 블록 → 쓰는 CSS |
| 린트 값 | DESIGN 핵심 규칙 "막는 수단" · 해당 절 | `lint/values.js` 값 표 — 검사 코드 `lint/check-*.js`는 화면 쪽 몫 |
| 브레이크포인트 | DESIGN Layout `브레이크포인트` | `lint/values.js` `ALLOWED_MEDIA` + `src/app/breakpoints.ts`(화면 쪽) — `lint:docs`가 대조 |
| 부품 · 변형 · prop | COMPONENTS 해당 절 | `src/ui/<Name>/` · `src/ui/index.ts` · `/_guide` 카탈로그 절 |
| 셸 | DESIGN Layout · `## 접근성` | `src/app/shell/**` · `src/copy/shell.ts` |
| 아이콘 | DESIGN Iconography | `src/ui/icons/svg/<Name>.tsx` + `names.ts` |
| 문구 규칙 · 상태 값 | DESIGN Copy | `src/copy/status.ts` · 그 메뉴 `copy/<menu>.ts`(화면 쪽) |

## 2. 문서 먼저
- 문장은 지금 규칙만 쓴다 — 경위 · 날짜를 쓰지 않는다. 이음 원본과 다르게 정한 자리는 그 이유를 문장으로 적는다
- 이름은 쓰는 곳의 뜻(색) · 단계(간격 · 높이 · 아이콘 · 반지름) · 그 부품(셸 · 층 이름 토큰)으로 짓는다. 값이 같아도 뜻이 다르면 별칭으로 합치지 않는다(핵심 규칙 2). 크기는 DESIGN의 단계 이름
- 부품 명세는 COMPONENTS `공통 계약`의 절 형식(쓰는 곳 → 쓰지 않는 곳 → prop · 크기 → 상태 → 접근성 → 폭 → 카탈로그)과 prop 표(prop · 타입 · 기본값 · 뜻)를 따른다. 안쪽 여백 · 반지름 · 글자는 명세에 쓰지 않는다 — 부품 CSS에만 둔다
- 핵심 규칙 행을 더하거나 바꾸면 "막는 수단" 열을 실제 검사 이름(oxlint 규칙 · `check-*` 규칙)과 맞춘다. 검사가 아직 없으면 그 칸에 "(F/E 요청 중)"을 달고 화면 쪽에 요청한다
- 규칙(색 다섯 뜻 · 웨이트 넷 · 높이 단계 · 빈 상태 넷)을 벗어나는 변형은 만들지 않는다. 필요하면 규칙을 바꾸는 제안으로 사용자에게 묻는다

## 3. 토큰 · 린트 값
- `src/styles/tokens.css`를 직접 고친다(원본). 색은 라이트 `:root`와 다크 두 블록(시스템 다크 · 강제 다크)에 같은 이름 · 값으로 둔다. 두 테마가 같은 색은 라이트에만 두고 주석에 적는다(`lint:docs`가 대조)
- DESIGN 표에는 값을 쓰지 않는다 — 새 토큰이면 이름 · 뜻 · 쓰는 곳 행만 더한다
- `lint/values.js` 값 표를 바꾸면 DESIGN 그 절과 핵심 규칙 "막는 수단"을 같이 고친다. 정규식은 `^ … $`로 묶고 `g` 플래그를 붙이지 않는다
- 값을 채우거나 바꾼 뒤 일부러 위반한 임시 파일로 실패를 한 번 확인하고 지운다

## 4. 부품
```
src/ui/<Name>/
  <Name>.tsx          적힌 prop만 · 상태는 data-* · ARIA · className 병합
  <Name>.module.css   var(--*)만 · 클래스는 kebab-case(TSX에서는 camelCase로 읽는다)
  index.ts            + src/ui/index.ts 내보내기
```
- 층(모달 · 드로어 · 도크 · 토스트)은 `ui/layers` 위에 만든다 — `<dialog>.show()`로 열고 포커스를 가두지 않으며, 닫으면 연 컨트롤로 포커스를 돌린다(DESIGN `## 접근성` 층)
- 리터럴 px는 바로 윗줄에 `/* check-css-disable-next-line literal-px -- <사유> */`(범위는 DESIGN Layout `리터럴 px 예외 주석`). `@media`는 `ALLOWED_MEDIA` 다섯 값만 쓰고, 폭 동작은 COMPONENTS 그 절의 `폭` 줄에 적는다
- 아이콘은 DESIGN Iconography, 애니메이션은 DESIGN Motion(시간 토큰 — 모션 줄이기를 따른다), `aria-*` · 키보드는 DESIGN `## 접근성`
- 이름이 바뀌면 타입이 옛 이름을 받지 않게 한다

## 5. 카탈로그
`src/screens/_guide/sections.tsx`에 절을 더한다 — `group`(COMPONENTS `##` 묶음 이름) 바로 다음에 `name`(COMPONENTS 그 절 `카탈로그` 행 값). 변형 × 상태 × 크기를 늘어놓고, 폭 · 테마는 카탈로그 뷰어가 바꾼다. `npm run lint:docs`가 카탈로그 행과 절 이름을 양방향으로 대조한다.

## 6. 쓰는 곳 · 스킬 옮기기
`grep -rn '<옛 이름>' src docs lint .claude CLAUDE.md README.md` — 화면 · `_guide` · 문서 예 · 스킬의 쓰임을 한 번에 옮긴다. 옛 이름 0건(상대 몫 파일은 `## 7`대로 요청). 점검 기준이 바뀌었으면 `ui-review` · `new-screen` · DESIGN 핵심 규칙 "막는 수단" 열도 고친다(규칙 문장을 거기에 다시 쓰지 않는다).

## 7. 파일 주인
가이드 쪽(디자인)과 화면 쪽(F/E) 두 작업 흐름이 나눠 맡는다. 상대 몫 파일은 고치지 않고 요청으로 넘긴다 — 화면에 새 부품 · 변형이 필요하면 화면 쪽이 요청하고, 가이드 쪽이 COMPONENTS · `ui` · 카탈로그를 고친 뒤 알린다(화면 쪽은 그동안 `ui`를 만들지 않는다). 검사 코드 · 설정 · 앱 층이 바뀌어야 하면 가이드 쪽이 화면 쪽에 요청한다.

| 주인 | 파일 |
|---|---|
| 가이드(디자인) | `docs/DESIGN.md` · `docs/COMPONENTS.md` · `src/styles/tokens.css` · `src/styles/base.css` · `src/ui/**`(아이콘 포함) · `src/screens/_guide/**` · `src/app/shell/**` · `src/copy/status.ts` · `src/copy/shell.ts` · `lint/values.js` 값 표 · `CLAUDE.md` · `.claude/skills/**` · `README.md`의 명령 · 구조 · 시나리오 절 |
| 화면(F/E) | 설정(`package.json` · `package-lock.json` · `vite.config.ts` · `tsconfig.json` · `.oxlintrc.json` · `.nvmrc` · `.npmrc` · `.gitignore` · `index.html`) · `lint/check-*.js` · `src/main.tsx` · `src/app/**`(`shell/` 제외) · `src/api/**` · `src/copy/errors.ts` · `src/copy/<menu>.ts` · `src/screens/<menu>/**`(`_guide` 제외) |

여러 작업이 함께 쓰는 파일(`docs/*` · `tokens.css` · `base.css` · `src/ui/index.ts` · `_guide/sections*.tsx` · `copy/status.ts` · `api/types.ts` · `api/hooks/keys.ts` · `app/routes.tsx` · `app/nav.ts` · `app/store.ts` · `CLAUDE.md` · `.claude/skills/**` · `README.md` · `lint/**` · 설정)은 한 번에 한 작업자만 고친다. 병렬 작업자는 더할 줄을 결과에 적어 돌려주고 한 명이 한꺼번에 넣는다.

## 8. 확인 · 보고
ui-review `## 완료 확인`을 따른다 — 추가로 `/ieum/_guide`의 바뀐 절을 다섯 폭 · 라이트 · 다크로 보고, 쓰는 화면을 본다. 보고: 종류 · 바꾼 규칙 한 줄 · 옮긴 쓰임 수.
