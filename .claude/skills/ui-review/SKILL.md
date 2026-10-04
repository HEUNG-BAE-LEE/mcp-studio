---
name: ui-review
description: 화면 · 컴포넌트 작업을 마치기 전, 또는 사용자가 UI 검수를 요청할 때 쓴다. 디자인 규칙 · 일관성을 항목별로 점검하고 결과표를 낸다.
---

# UI 검수

변경된 파일과 그 화면 · 컴포넌트를 본다. 항목마다 통과 · 위반(파일:줄) · 해당 없음. 기준은 `docs/DESIGN.md` · `docs/COMPONENTS.md`다. `docs/DESIGN.md` `## 핵심 규칙`을 먼저 읽는다 — 아래는 어느 절을 대 보는지만 적는다.

## 코드 — 규칙
1~12번은 DESIGN `## 핵심 규칙` 번호와 같다.
1. **토큰만** — `pnpm lint:tokens`. 리터럴 px 주석은 DESIGN `리터럴 px 예외 주석` 범위 안
2. **액센트** — `--accent*`를 쓴 CSS가 DESIGN Accent 쓰는 곳 안. 버튼 필에 있으면 위반
3. **상태 색** — `--fix-*` · `--progress-*`를 쓴 CSS가 DESIGN Status 쓰는 곳 목록 안. 완료 · 평상시 자리에 있으면 위반
4. **그림자** — `pnpm lint:tokens`. 카드 · 표에 `--shadow-*`가 없다
5. **웨이트 · 자간** — `pnpm lint:tokens`, 화면 CSS에 글자 속성 없음(DESIGN Typography)
6. **값 없음** — JSX에 `'—'` · `'-'` 대체 표기가 없고 사유 문구가 있다(`pnpm lint:eslint`가 잡는다). 표는 `Table emptyReason`
7. **빈 상태** — EmptyState `kind`가 세 종 중 하나. 고르는 법은 DESIGN `빈 상태`
8. **실패** — ErrorBlock에 원문 · `onCopy`가 있다. 아는 code(`KNOWN_FAILURE`)가 ErrorBlock으로 나오지 않는다(`FailureBlock`). 자리는 DESIGN `실패 블록 자리`, ScreenState 범위는 DESIGN `화면 상태 골격`
9. **문구** — 화면에 한글 문장 리터럴 · 서버 `message` 렌더가 없다(ErrorBlock 원문만 예외. 한글 리터럴 · `toLocaleString`은 `pnpm lint:eslint`가 잡는다). 문체 · `쓰지 않는 말` · 조사 · 서식은 DESIGN Copy
10. **상태 값** — 화면의 상태 문구가 DESIGN Copy `상태 값` 목록 안(금지어는 `pnpm lint:eslint`가 잡는다). 상태로 거르는 필터 라벨 = 칩 라벨. 새 값은 목록 + `copy/status.ts`에 먼저
11. **1024** — `PageBody` · `PageColumns` · `SectionSearch` · Table에 `narrow`를 넘긴다. 1024에서 잘림 · 겹침이 없다
12. **키보드 · 권한** — Tab으로 모든 컨트롤에 닿고 `:focus-visible` 링이 보인다. 층은 Esc로 닫히고 포커스가 돌아온다. 권한 사유 자리는 DESIGN `권한` — `title`만이면 위반. 사유가 권한별 구체형(할 수 있는 역할)이 아니고 공통 문장(`PERMISSION_DENIED`)이면 위반(새 화면 · 컴포넌트)

## 코드 — 일관성
13. **화면 틀** — DESIGN `화면 틀`의 한 틀(영역 배치 · 스크롤 · 1024). 영역 배치를 빼거나 바꾸면 위반. `back`은 상위 화면이 있을 때만 — LNB · 층에서 들어오는 화면에 `back`이 있으면 위반
14. **레이아웃** — DESIGN `화면 틀` 공통 첫 줄: 열 안 영역 쌓기는 `Stack`, 머리 아래 스크롤 목록은 `Region` + `RegionList`, 화면 CSS에 `--body-*` · `--gap-section` · `--gap-column*`이나 그 리터럴 없음 · 영역 머리 → 내용 간격을 화면 CSS로 쓰지 않는다(`Region`. 카드 · 패널 안 머리는 그 상자 안쪽 간격 — DESIGN 본문 여백)
15. **영역 머리** — `SectionHead`(+ `SectionSearch` · `useSearchFilter` · `copy/list`). 화면 로컬 머리 컴포넌트 없음
16. **컨트롤** — 높이 단계의 역할대로, 한 줄 컨트롤은 같은 단계. Button 크기 × variant는 COMPONENTS Button 허용 조합 안. 화면 이동 = Button `link`(예외: EmptyState 다음 할 일 버튼). 행 액션 둘 이상 → `RowMenu`. Dialog 확인 variant는 DESIGN `층 선택`. hover가 바탕과 구분된다(COMPONENTS `상태 7종`)
17. **일회성 스타일** — 화면 폴더에 DESIGN `Do's and Don'ts` 표의 "만들지 않는 것"을 흉내 낸 CSS가 없다. 있으면 표의 컴포넌트를 쓰거나 `design-change`로 `ui`에 더한다
18. **화면 간 import · 플랫폼** — `pnpm lint:eslint` 통과
19. **요구 메모** — 화면 파일 머리 주석(진입 · 틀 · 영역 · 상태)이 코드와 맞다
20. **참고 구현** — 참고 구현(dashboard · project · shell)을 고쳤으면 그 파일 머리 주석과 variant 뜻이 문서와 맞다
21. **폼 · 모달** — DESIGN `폼` · `층 선택`(읽기 전용 폼 · 설정 모달 제목 = 대상 이름 · 저장하지 않은 변경 닫기 확인)

## 화면 (브라우저, 1280 · 1024)
`pnpm dev` 후 `?mock=` · `?role=` 시나리오로 7 · 8 · 11 · 12를 눈과 키보드로 다시 확인한다. 1024는 창 폭을 1280 미만으로 줄여(개발자 도구 기기 모드 폭 1024) 보고, 카탈로그는 `/_guide`의 `1024` 토글로 본다. Node 버전 · 명령 · 시나리오 목록은 README `## 명령`. 브라우저로 못 봤으면 그 항목을 `미확인`으로 적는다.

## 완료 확인
`pnpm typecheck` · `pnpm lint` · `pnpm build` 통과 + 1280 · 1024 화면 확인 + 결과표. 이번 작업에서 DESIGN · COMPONENTS를 고쳤으면 DESIGN `## 미정`에 사용자 확인 행이 있다(작업 중 사용자에게 확인받았으면 없어도 된다).

## 결과
표 `| # | 항목 | 결과 | 근거 |`로 낸다. 위반은 고치고 다시 돌린다. 규칙 자체가 맞지 않아 보이면 고치지 말고 사용자에게 묻는다(바꾸기로 하면 `design-change`).
