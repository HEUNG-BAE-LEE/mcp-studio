---
name: ui-review
description: 이음 웹 콘솔(apps/ieum-web) 화면 · 부품 작업을 마치기 전, 또는 이음 UI 검수를 요청받았을 때 쓴다 — MCP-Studio design-guide판 ui-review가 아니다. 이음 핵심 규칙 12개 + 다크 모드를 항목별로 점검하고(브라우저 다섯 폭 1920 · 1440 · 1280 · 1024 · 390 × 라이트 · 다크) 결과표를 낸다.
---

# UI 검수 (이음)

변경된 파일과 그 화면 · 부품을 본다. 항목마다 통과 · 위반(파일:줄) · 해당 없음. 기준은 `docs/DESIGN.md` · `docs/COMPONENTS.md`다. `docs/DESIGN.md` `## 핵심 규칙`을 먼저 읽는다 — 아래는 어느 절을 대 보는지만 적는다.

**위반으로 잡지 않는 것** — 이음 그대로 두기로 한 것(`docs/DESIGN.md` `## 이식 기간` 유지): 반복 · 등장 모션(연결선 흐름 · 깜빡임 · 등장 · 회전 · 맥박 — 모션 줄이기는 `base.css`가 따른다)과 파란 띠(LNB · 모달 머리) 위 · 스위치의 흰 포커스 링. 이식 기간에 서버 사실과 다른 옛 문구 · 출력을 그대로 옮긴 것(`docs/DESIGN.md` `## 이식 기간` 보존 목록)도 위반이 아니다 — 그것을 고쳤으면 위반이다.

## 코드 — 규칙
1~12번은 DESIGN `## 핵심 규칙` 번호와 같다.
1. **토큰만** — `npm run lint:tokens`(`color-literal` · `literal-px` · `unknown-custom-property` · `disable-comment`) · `npm run lint:source`(`inline-style-literal` · `inline-style-dynamic`). 끄는 주석이 DESIGN Layout `리터럴 px 예외 주석` 범위 안이고 사유가 맞다
2. **색 다섯 뜻** — 쓴 색 토큰이 DESIGN Colors의 그 뜻 쓰는 곳 안. 주 버튼은 `--primary` 필, 완료는 파랑, 초록(`--ok*`)은 자원 상태(정상 · 공개 중)에만. 표지 · 고정 색을 다른 뜻에 쓰거나 무채색 자리에 색을 쓰면 위반
3. **상태 색** — `--ok*` · `--warn*` · `--danger*`가 DESIGN Colors ③ 쓰는 곳 목록 안. 상태 칩은 점 + 글자. 색만으로 상태를 말하면 위반(색 점에는 시각 숨김 글자)
4. **그림자** — `npm run lint:tokens`(`property-value`). 카드 · 표 · 패널에 그림자가 없다
5. **웨이트 · 자간 · 글자 축** — `npm run lint:tokens`(`property-value` · `screen-property`). 600(`--fw-mono-strong`)은 고정폭 글꼴 자리에만 — 린트가 못 잡으니 눈으로
6. **값 없음** — 값 없는 자리가 `copy/`의 `NONE` · `orNone` · `NONE_REASON`(DESIGN Copy `값 없음`). `—` 리터럴은 `lint:source`가 잡는다. 빈 문자열 · `undefined` · `null`이 그대로 그려지거나 `—ms`처럼 단위가 붙으면 위반
7. **빈 상태** — `EmptyState` `kind`(넷) × `container`가 DESIGN Copy `빈 상태` 표대로. 설명 문단 · 코드 상자 안 문장을 `EmptyState`로 그리면 위반
8. **실패 · 첫 로딩** — 자리가 DESIGN Copy `실패` 표대로(화면 → 본문 자리 실패 상자 · 재시도 버튼 없음, 영역 → 그 상자 안 원문 상자 · warn, 층 → 그 층 안, 쓰기 → 경고 토스트, 새로 받기 · 폴링 → 표시 없음). 서버 원문(`resultMsg`)을 요약 · 바꾸지 않는다. 첫 로딩은 비우고 `aria-busy`만 — 문구 · 스피너가 있으면 위반. 훅의 `retry` · 재시도 버튼이 있으면 위반
9. **문구** — `npm run lint:source`(`copy/` 밖 한글 · 화면의 `toLocale*` · `Intl`). 옮긴 화면은 옛 문구와 같다(다듬으면 위반). 새 숫자 · 문구를 실제 데이터 없이 하드코딩(건수 · 시각 · "방금")하면 위반. `window.confirm` · `alert` · `prompt`는 oxlint `no-alert`
10. **상태 값** — 라벨 · 색이 `copy/status`의 목록에서 온다. 화면에 상태 맵이 따로 있으면 위반. 모르는 값은 값 그대로 + mute 칩 + 개발 콘솔 경고 한 번. 서버가 내지 않는 값을 목록에 더하면 위반
11. **폭** — `npm run lint:tokens`(`screen-media` · `media-query`) · `npm run lint:docs`(`BREAKPOINTS` ↔ `ALLOWED_MEDIA`). 화면 CSS에 `@media`가 없다. JS 폭 판정은 `useMediaQuery(maxWidth(…))`만. 다섯 폭 1920 · 1440 · 1280 · 1024 · 390에서 잘림 · 겹침이 없다(표는 자기 상자 안 가로 스크롤) — 브라우저에서 본다
12. **키보드 · 포커스** — oxlint `jsx-a11y` · `npm run lint:tokens`(outline 지우기). 포커스 링을 지우는 규칙이 0이다(예외 없음). 모든 컨트롤이 Tab으로 닿고 링이 보인다 — 자리는 DESIGN `## 접근성`(입력 · 표 행 · 스크롤 상자 · 파일 드롭 · 파란 띠 위). 스크롤되는 기록 상자는 `tabindex="0"` + 이름. 층은 포커스를 가두지 않는다(Tab이 층 밖으로 나간다 — 가두면 위반). Esc는 맨 위 층만 닫고, 모달을 닫으면 연 컨트롤로(사라졌으면 대체 자리로) 포커스가 돌아온다. 확인 모달의 첫 포커스는 확인 버튼

## 코드 — 다크
13. **다크** — 새 색 토큰은 라이트 `:root`와 다크 두 블록에 같은 이름이 있고 두 다크 블록의 값이 같다. 두 테마가 같은 색이면 라이트에만 두고 주석이 있다(`npm run lint:docs`). 부품 · 화면이 라이트를 가정한 값(흰 바탕 · 검은 글자)을 쓰지 않고 뜻 토큰을 쓴다. 라이트 · 다크 둘 다에서 글자 · 선 · 상태 색이 바탕과 구분된다 — 브라우저에서 본다

## 코드 — 일관성
14. **부품** — 화면이 `@/ui`에서만 가져오고(안쪽 경로 금지) 크기는 단계 이름으로 준다. 화면 폴더에 부품 모양(버튼 · 칩 · 표 · 층)을 흉내 낸 CSS가 없다 — 있으면 부품을 쓰거나 `design-change`
15. **화면 간 import · 데이터** — `npm run lint:source`(다른 화면 폴더 import · 전역 우회). 화면은 `api/hooks`로만 받는다
16. **요구 메모** — 화면 파일 머리 주석(진입 · 주소 · 영역 · 조회 · 상태)이 코드와 맞다. `// 확인 필요` 목록을 보고에 올렸다

## 화면 (브라우저 — 다섯 폭 × 라이트 · 다크)
`npm run dev` 후 `http://localhost:5174/ieum/<경로>?mock=<시나리오>`로 7 · 8 · 11 · 12 · 13을 눈과 키보드로 다시 확인한다. 명령 · 백엔드 지정 · 시나리오별 확인 자리는 README.
- **폭** — 창(또는 기기 모드) 폭 1920 · 1440 · 1280 · 1024 · 390. 부품은 `/ieum/_guide`의 폭 전환으로 보고, 경계 폭(760 · 1100 · 1360 · 1500 · 1680과 그 +1px)도 본다
- **테마** — 화면은 브라우저의 `prefers-color-scheme: dark` 흉내로, 카탈로그는 `/_guide`의 테마 전환으로 라이트 · 다크를 둘 다 본다
- **시나리오** — `slow`(첫 로딩) · `failed`(화면 실패) · `region-failed`(영역 실패) · `write-failed`(쓰기 실패) · `empty`(빈 상태)
- **키보드** — Tab 순서 · 링 · 층 Esc · 모달 닫은 뒤 포커스 복귀 · 층이 열린 채 Tab이 층 밖으로 나감
- 브라우저로 못 봤으면 그 항목을 `미확인`으로 적는다

## 완료 확인
`npm run typecheck` · `npm run lint` · `npm run build` 통과 + 다섯 폭 × 라이트 · 다크 화면 확인 + 결과표. 이번 작업에서 DESIGN · COMPONENTS를 고쳤으면 DESIGN `## 미정`에 사용자 확인 행이 있다(작업 중 사용자에게 확인받았으면 없어도 된다).

## 결과
표 `| # | 항목 | 결과 | 근거 |`로 낸다. 고칠 몫이면 고치고 다시 돌린다 — 검수자로 불렸으면 고치지 않고 표만 낸다. 상대 몫 파일의 위반은 요청으로 넘긴다(파일 주인은 `design-change` `## 7`). 규칙 자체가 맞지 않아 보이면 고치지 말고 사용자에게 묻는다(바꾸기로 하면 `design-change`).
