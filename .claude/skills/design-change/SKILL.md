---
name: design-change
description: 토큰 · 컴포넌트 · 변형 · prop · 패턴 · 화면 틀을 새로 더하거나 바꿀 때 쓴다. 규칙 문서(DESIGN · COMPONENTS)를 먼저 고치고 tokens.css · ui · _guide 카탈로그 · 쓰는 곳 · 스킬을 함께 옮기게 한다.
---

# 디자인 변경 · 새 컴포넌트

원본은 `docs/DESIGN.md` · `docs/COMPONENTS.md`다. `docs/DESIGN.md` `## 핵심 규칙`을 먼저 읽고, 코드보다 문서를 먼저 고친다. 규칙 하나는 한 곳에만 쓴다 — DESIGN은 핵심 규칙 · 토큰 뜻 · 색 · 타입 · 레이아웃 · 화면 틀 · 패턴(언제 무엇을) · Copy · 접근성, COMPONENTS는 컴포넌트별 언제 · 쓰지 않을 때 · prop · 변형 · 크기 · 접근성, 토큰 값은 `tokens.css`, 스킬은 절차. 다른 곳에는 절을 가리키는 한 줄만 둔다.

## 1. 정말 새로 필요한가
- 기존 컴포넌트의 variant · prop으로 되는지 COMPONENTS에서 먼저 본다. 되면 변형을 늘린다
- 화면 하나에만 맞는 값이면 규칙을 바꾸지 말고 일반 값을 쓴다. 판단이 서지 않으면 DESIGN `## 미정`에 행을 더하고 사용자에게 묻는다
- 한 화면만 쓰는 새 모양은 화면 폴더 `<Region>.module.css`(토큰만 · DESIGN `Do's and Don'ts` 표 흉내 금지)에 두고, 두 번째 화면이 쓰게 되면 여기로 와 `ui`로 옮긴다(화면 폴더끼리 import 금지)

| 종류 | 원본 | 같이 움직이는 것 |
|---|---|---|
| 토큰 | DESIGN 해당 절(뜻 · 쓰는 곳) | `apps/web/src/styles/tokens.css` → 쓰는 CSS |
| 컴포넌트 · 변형 · prop | COMPONENTS 해당 절 | `apps/web/src/ui/<Name>/` · `_guide` 카탈로그 |
| 패턴 | DESIGN Patterns | 그 패턴을 쓰는 화면 · `copy` |
| 화면 틀 | DESIGN `### 화면 틀` 표 + 예 | `PageBody` · `PageColumns` · `Stack` · `Region` 등 레이아웃 컴포넌트 |
| 문구 규칙 · 상태 값 | DESIGN Copy | `apps/web/src/copy`(`status.ts` 등) |

## 2. 문서 먼저
- 문장은 지금 규칙만 — 날짜 · 결정 번호 · 경위를 쓰지 않는다(경위는 git 이력)
- 이름은 역할 · 밀도 · 높이 단계. 쓰는 화면 · 자리 이름(`flow` · `form` · `mini` …)을 쓰지 않는다. 크기는 DESIGN `컨트롤 높이 단계`의 이름
- 컴포넌트 명세: COMPONENTS `공통 계약`의 절 형식(bullet — 언제 · 쓰지 않을 때 · prop · 변형 · 크기 · 접근성 · 카탈로그). prop 표는 이름 · 타입 · 기본값 · 뜻(`data-*` 포함), 상태는 `상태 7종` 중 해당 것, 1024 동작이 있으면 `1024:`. 안쪽 여백 · 반지름 · 글자는 명세에 쓰지 않는다 — 컴포넌트 CSS에만 둔다. 명세에 적는 수는 층 고정 치수(`층` 표) · 높이 단계 이름 · 공개 prop 값 · 1024 동작 · 사람이 알아야 하는 동작 시간 · 크기 prop의 뜻 · 글 폭 상한(EmptyState 본문 `ch`) · 화면이 맞춰야 하는 고유 치수(`크기`의 고유 상자 · KeyValue 키 열 · CopyField 라벨 열 · 셀 안 Select 열 폭)뿐이다
- 새 화면 틀은 표에 한 행(틀 · 언제 · 영역 배치 · 스크롤 · 1024). 이름은 화면 하나가 아니라 일반 이름, 예가 필요하면 일반 예 하나(4줄 이하 — 예는 절 전체에 셋까지)
- 규칙(타입 역할 · 웨이트 · 색 · 높이 단계 · 빈 상태)을 벗어나는 변형은 만들지 않는다. 필요하면 규칙을 바꾸는 제안으로 사용자에게 묻는다

## 3. 토큰
`styles/tokens.css`를 직접 고친다(원본). DESIGN 표에는 값을 쓰지 않는다 — 새 토큰이면 이름 · 뜻 · 쓰는 곳 행만 더한다.

## 4. 컴포넌트
```
apps/web/src/ui/<Name>/
  <Name>.tsx          forwardRef · Radix primitive 래핑 · className 병합 · data-* 노출
  <Name>.module.css   var(--*)만
  index.ts            + ui/index.ts 내보내기
```
- 리터럴 px가 꼭 필요하면 `/* stylelint-disable-next-line mcp/no-literal-px -- 파생 치수: 컴포넌트 고유 치수 — <무엇> */`(범위는 DESIGN `리터럴 px 예외 주석`)
- 아이콘은 DESIGN Iconography를 따른다. 새 아이콘은 `ui/icons/svg/`에 tsx를 더하고 `names.ts`에 등록
- 애니메이션은 DESIGN Motion
- `aria-*` · 키보드 · 비활성 사유는 DESIGN `## 접근성`
- 이름이 바뀌면 타입이 옛 이름을 받지 않게 한다
- `screens/_guide/sections*.tsx` 카탈로그에 변형 × 상태를 더한다. `pnpm lint:docs`가 카탈로그 이름을 대조한다

## 5. 쓰는 곳 옮기기
`grep -rn '<옛 이름>' apps docs .claude CLAUDE.md README.md *.config.js` — 화면 · `_guide` · 문서 예 · 스킬의 쓰임을 한 번에 옮긴다. 옛 이름 0건.
점검 기준이 바뀌었으면 `ui-review` · `new-screen` · DESIGN `## 핵심 규칙` 표의 막는 수단 열도 고친다(규칙 문장을 거기에 다시 쓰지 않는다).

## 6. 확인 · 보고
ui-review `## 완료 확인`을 따른다 — 추가로 `/_guide`의 바뀐 절과 쓰는 화면을 본다. 보고: 종류 · 바꾼 규칙 한 줄 · 옮긴 쓰임 수.
