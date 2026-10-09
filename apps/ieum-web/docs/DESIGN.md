---
version: 1.0-draft
name: 이음-웹-콘솔-디자인-시스템
description: "이음 웹 콘솔 디자인 시스템. 값 · 모습 · 동작은 이음 원본 콘솔(apps/web/ieum)이 기준이다. 파란 주조의 주 버튼 · 브랜드 띠, 연결 흐름 세 쪽(AI · 도구 · 원본)의 색, 그 밖은 무채색. Noto Sans KR 400 · 500 · 700과 JetBrains Mono. 1920부터 휴대폰 390까지 브레이크포인트 다섯 개."
source_of_truth: "규칙 = 이 문서 · 부품 계약 = COMPONENTS.md · 토큰 값 = apps/ieum-web/src/styles/tokens.css · 린트 값 표 = apps/ieum-web/lint/values.js"
platform: web
---

# Design System: 이음 웹 콘솔

> **기준.** 모습(색 · 간격 · 글자 · 그림자 · 반지름 · 아이콘 · 모션)과 동작(흐름 · 상태 · 문구)은 **이음 원본 콘솔**이 기준이다. 이 문서는 원본을 토큰 · 단계 · 규칙으로 묶은 것이고, 원본과 다른 곳은 [이식 기간](#이식-기간) 절에 적은 것뿐이다(고침 · 보존 · 유지 · 허용 차이 · 추가).
> 이 문서는 규칙(언제 무엇을 쓰는지)을 둔다 — 부품 계약 · 값의 자리는 front matter `source_of_truth`. 토큰은 CSS 변수 이름으로만 부르고 값을 다시 적지 않는다(값은 `tokens.css`). 표제는 영문, 본문은 한국어. 낯선 말은 [용어집](#용어집). 절차 · 점검표는 앱 스킬(`apps/ieum-web/.claude/skills/`) — 새 화면 `new-screen` · 토큰 · 부품 · 변형 · 규칙 바꾸기 `design-change` · 마치기 전 검수 `ui-review`.

## Overview

이음은 사내 원본 시스템(REST · SOAP · 공공데이터 · 호출 샘플 · 자동 탐색)을 AI가 부를 수 있는 도구로 바꾸고, 도구 묶음을 MCP 서버로 배포하는 게이트웨이다. 콘솔이 보여 주는 것은 **"AI ↔ 이음 ↔ 원본" 연결 흐름**이다. 그래서 색은 흐름의 쪽(AI · 도구 · 원본)과 주조(주 액션 · 선택 · 진행)에 붙고, 면 · 선 · 글자는 무채색으로 물러난다([핵심 규칙 2](#핵심-규칙)). 셸은 어두운 레일 · 흰 GNB · 파란 LNB 띠이고, 휴대폰 폭까지 지원한다.

## 핵심 규칙

새 화면 · 부품에서 반드시 지킨다. 세부는 각 절에 있다. "막는 수단"의 `check-*`는 `lint/check-*.js`의 규칙 이름이고, 값 표는 `lint/values.js`다.

| # | 규칙 | 왜 | 막는 수단 |
|---|---|---|---|
| 1 | 스타일 값은 `tokens.css`의 CSS 변수만. `.module.css`에 색 리터럴(hex · rgb · hsl 등) · 임의 px 금지 — 예외는 0 · 테두리 1px · 폭 계열 속성과, 부품 CSS의 파생 치수 끄는 주석(`check-css-disable-next-line literal-px -- <사유>`). TSX `style={{…}}`에 리터럴 값을 쓰지 않는다 — 인라인 style은 클래스 · 토큰으로 옮기고 비율 · 좌표만 CSS 사용자 속성으로 넘긴다 | 값이 한 곳에 있어야 바꿀 때 한 번에 바뀐다 | `check-css` `color-literal` · `literal-px` · `unknown-custom-property` · `disable-comment` · `check-docs`(문서 토큰 ↔ `tokens.css` · 다크 블록 대조) · `check-source` `inline-style-literal` · `inline-style-dynamic` · ui-review #1 |
| 2 | 색은 다섯 뜻에만 — ① 주조 `--primary*`: 주 액션 필 · 현재 선택 · 링크 · 포커스 · 진행과 완료 표시 · 강조 수치 · 강조 아이콘 · 사용자 말풍선 ② 브랜드 띠 `--brand-band`: 셸 띠 · 층 머리 · 드로어 윗선 ③ 상태 `--ok*` · `--warn*` · `--danger*`(정보는 `--primary-bg` + `--primary-ink`) ④ 구성요소 `--ai*` · `--tool*` · `--source*`: 연결 흐름(AI ↔ 이음 ↔ 원본)에서 어느 쪽인지 ⑤ 표지 · 고정 색 — 토큰 목록에 이름이 있는 것만(`--evidence-*` · `--rule-inject*` · `--netlog-flag*` · `--proto-*` · `--code-*` · `--chart-bar` · `--inverse-*` · `--on-fill*` · `--on-band-hover` · `--toast-bg` · `--rail-*` · `--avatar-*` · `--capture-*` · `--danger-hover-bg`). 그 밖은 무채색(`--text*` · `--surface*` · `--line*`). 주 버튼은 `--primary` 필이다. 완료는 파랑이고 초록은 자원 상태(정상 · 공개 중)에만 | 사용자가 보는 것은 "AI ↔ 이음 ↔ 원본" 흐름이다. 쪽마다 색이 정해져 있어야 구조도 · 파이프라인 · 변환 과정에서 같은 쪽을 같은 색으로 읽는다. ⑤는 뜻이 하나뿐인 표지라 이름을 따로 두어 ①~④와 섞이지 않게 한다(값이 같아도 별칭으로 두지 않는다) | `check-css` `color-literal` · `unknown-custom-property`(토큰 이름은 `tokens.css` 목록과 대조) · ui-review #2 |
| 3 | 상태 색은 Colors ③의 쓰는 곳 목록(메서드 표식 GET = `--ok` · 그 밖 = `--warn` 포함)에만. 상태 칩은 **점 + 글자**다(`StatusChip`). 색만으로 상태를 말하지 않는다 — 글자 · 아이콘 · 시각 숨김 글자가 함께 간다(구조도 상태 점도 시각 숨김 글자 — [접근성](#접근성) ARIA 보강) | 상태 색이 목록 밖으로 퍼지면 색만 보고 상태를 읽을 수 없다. 이음은 칩에 점을 넣어 왔다 | `copy/status` lookup · ui-review #3 |
| 4 | 그림자는 `--shadow-float`(도크 · 드로어 · 모달 · 토스트), `--shadow-brand` · `--shadow-brand-sm`(연결 허브 카드 둘)과 부품 안 표시 넷(`--shadow-knob` · `--ring-selected` · `--edge-active` · `--halo-current`)뿐. 카드 · 표 · 패널에는 쓰지 않는다 | 그림자는 떠 있는 층과 연결의 중심(허브)만 표시한다. 카드에 쓰면 층과 구분되지 않는다 | `check-css` `property-value`(`box-shadow` — `ALLOWED_VALUES`) · ui-review #4 |
| 5 | 웨이트는 `--fw-*` 넷 — 400 · 500 · 700, 600은 고정폭 글꼴에서만. 700은 제목 · 수치 · 활성 항목 · 원 안 숫자 · 머리글자. 자간은 `--tracking-body`(-.01em — 옛이 자간을 적지 않아 `body` 자간을 물려받은 자리는 다시 적지 않고 물려받는다) · `--tracking-mono`(0) · `--tracking-logo` · `--tracking-control`(normal — 옛 `<button>` 기본 자간, 링크로 바뀐 컨트롤) 넷뿐. 화면 CSS의 글자 값(크기 · 웨이트 · 행간 · 자간 · 글꼴)은 그 축의 토큰(`--fs-*` · `--fw-*` · `--lh-*` · `--tracking-*` · `--font-*`) 하나만, 줄임 속성 `font`는 쓰지 않는다 | 불러오는 웨이트가 Noto Sans KR 400 · 500 · 700, JetBrains Mono 400 · 500 · 600이다(`index.html:9`). 그 밖 값은 브라우저가 흉내 낸 굵기가 된다. 화면이 글자 값을 직접 고르면 단계가 흩어진다 | `check-css` `property-value`(`font-weight` · `letter-spacing` — `ALLOWED_VALUES`, 화면 글자 다섯 축 — `SCREEN_ALLOWED_VALUES`) · `screen-property`(`font` — `SCREEN_DISALLOWED_PROPS`) · ui-review #5 — 600 = 고정폭, 부품 CSS의 글자 크기 · 행간 · 글꼴 토큰 사용은 검사가 아니라 ui-review로만 본다([Typography](#typography)) |
| 6 | 값이 없는 자리는 자리마다 정해진 이음 표기를 `copy/`의 이름 붙은 문구로 쓴다. 값이 없는 숫자 · 시간 칸은 `—` 하나이고 그 `—`에 단위를 붙이지 않는다(`—ms` 없음). 단위는 그 칸이 쓰던 것만 값에 붙인다 — 단위 없이 그리던 수에 새로 붙이지 않는다. 사유를 아는 자리(호출 전 · 미검증 · 관찰 없음 · 전일 기록 없음 등)는 사유 문구를 쓴다. 빈 문자열 · `undefined` · `null`을 그대로 그리지 않는다 | 이음은 칸의 성격에 따라 `—`와 사유 문구를 나눠 쓴다. 표기가 한 곳에 있어야 같은 값이 화면마다 다르게 보이지 않고, `—ms` 같은 깨진 표기가 생기지 않는다 | `check-source` 값 없음 표기(`EMPTY_MARKS` — 문자열 전체가 `—`인 리터럴을 `src/copy/` 밖에서 막는다) · 단위가 붙는 자리(`—ms` 류)는 검사가 잡지 않는다 — `orNone(v, unit)`이 값이 없으면 단위를 붙이지 않고, ui-review #6으로 본다 |
| 7 | 빈 상태는 네 종류 — 처음(다음 할 일과 그 메뉴로 가는 링크/버튼) · 조건(검색 · 필터 결과 없음) · 부분(화면 안 한 영역이 빔 · 한 줄) · 실행 전(동작하면 채워질 자리 · 아이콘 + 안내). 모양은 그릇이 정한다: 표 = 표 안 한 행, 패널 = 점선 상자(기본 · 작은 판), 상자 안 = 테두리 없는 한 줄, 큰 자리 = 테두리 없는 아이콘 안내. 대시보드 큰 상자는 처음 · 패널의 `hero` 크기. 설명 문단 · 코드 상자 안 문장은 빈 상태 부품이 아니라 그 자리의 글이다 | 이음 화면 27곳의 빈 상태가 이 넷으로 나뉜다. 같은 상황이 같은 모양이어야 바로 읽힌다 | `EmptyState` `kind`(`first` · `filtered` · `section` · `idle`) · `container` 타입(typecheck) · ui-review #7 |
| 8 | 실패는 이음 알림 상자(`FailureBlock` — 경고 아이콘 + 굵은 한 줄(있는 자리만) + 서버 문장 원문, 복사 버튼 없음, `tone`은 자리마다 지금 그대로)로 보인다. 원문은 `resultMsg` 그대로 줄바꿈을 지킨다. 서버 문장이 없으면 "요청에 실패했습니다 ({status})", 네트워크 실패는 "서버에 연결하지 못했습니다.". 자리: 화면 첫 조회 실패 → 본문 자리(셸은 남김 · 재시도 버튼 없음) · 화면 안 영역 첫 조회 실패 → 그 상자 안(원문만 · 머리 문장 없음 · warn) · 층 안 요청 → 그 층 안 · 버튼 한 번의 쓰기 → 경고 토스트 · 새로 받기 · 폴링 실패 → 표시 없이 이전 값. 첫 로딩 중에는 본문 · 상자를 비우고 `aria-busy`만 켠다. 조회는 재시도하지 않는다 | 이음은 서버가 원인을 한국어 문장으로 준다. 요약하면 원인을 잃는다. 자리 규칙과 재시도 없음은 지금 콘솔 그대로다 | `FailureBlock` · `ErrorBlock` · `ScreenState` · `toast.warn` · `app/queryClient` `retry: false` · ui-review #8 |
| 9 | 화면 문장은 `copy/`에서 만든다. 서버 문장(`resultMsg` · 서버가 준 라벨 · 서버가 박아 둔 "방금")은 그대로 렌더해도 된다. 새로 만드는 숫자 · 문구는 실제 데이터로 뒷받침한다 — 서버 사실과 다른 옛 문구는 이식 기간 동안 그대로 옮기고 [이식 기간](#이식-기간) 보존 목록에서만 관리한다(루트 규칙 "실제 데이터"의 알려진 예외) | 같은 상황이 화면마다 같은 말이 되고, 문구를 한 곳에서 고친다. 이음 서버는 한국어 문장을 준다 | `check-source`(`src/copy/` 밖 한글 리터럴 · 화면의 `toLocale*` · `Intl` 직접 호출) · ui-review #9 |
| 10 | 상태 값의 라벨 · 색은 `copy/status`의 자원별 목록에서만 찾는다(`statusOf` — 탐색 네트워크 기록 태그만 상태 색 밖 표식 색 `flag`가 더해져 같은 폴백의 `netTagOf`). 목록에 없는 값은 값 그대로 + 회색(mute) 칩으로 그리고 개발 콘솔에 한 번만 경고(`warnOnce`)한다 — 렌더를 멈추지도, 다른 상태로 바꿔 보이지도 않는다. 서버가 내지 않는 값(로그 `wait` · `cache`, 원본 `busy`, 탐색 `queued`)은 목록에 두지 않는다. 같은 개념의 여러 이름은 자리별 지금 이름 그대로 둔다 | 같은 "모르는 값"에 화면이 멈추거나 다른 상태로 보이던 것을 하나로 맞춘다. 값 그대로 + mute는 이음 탐색 화면이 이미 쓰는 폴백이다 | `copy/status` lookup — 자원 상태 `statusOf` 하나 + 네트워크 태그 `netTagOf`(같은 폴백 · 자원별 값 유니온 타입) · 카탈로그(자원별 전 값 + 모르는 값 칩) · `check-source` 금지어(`BANNED_WORDS` — 지금 빈 표) · ui-review #10 |
| 11 | 검수 폭 1920 · 1440 · 1280 · 1024 · 390에서 잘림 · 겹침이 없다(표는 자기 상자 안에서 가로 스크롤). 폭에 따른 배치 변화는 부품 · 레이아웃 CSS의 `@media (max-width: 1680 · 1500 · 1360 · 1100 · 760px)`만 쓰고, 화면 CSS에는 `@media`를 쓰지 않는다(접히는 격자는 `SplitLayout` · `TwoColumn` · `FieldPair` · `CardGrid`). JS가 폭을 알아야 하는 곳만 `app/useMediaQuery` + `app/breakpoints.ts` | 다섯 브레이크포인트가 만드는 폭 구간마다 대표 폭 하나다. 이음은 휴대폰 폭까지 지원한다. 폭 값의 원본이 한 목록이어야 구간이 흩어지지 않는다 | `check-css` `media-query`(`ALLOWED_MEDIA` 다섯 값) · `screen-media`(화면 CSS `@media` 금지) · `check-docs`(`app/breakpoints.ts` `BREAKPOINTS` ↔ `ALLOWED_MEDIA` 대조) · `useMediaQuery`는 `MaxWidthQuery`만(typecheck) · ui-review #11 · 브라우저 다섯 폭 · 옛 콘솔과 나란히 모양 대조 |
| 12 | 모든 컨트롤은 키보드로 닿고 `:focus-visible` 링이 보인다. 링은 `base.css`의 전역 규칙 하나이고 지우는 규칙은 예외 없이 쓰지 않는다 — 입력은 테두리 색 변화에 링을 더하고, 표 행 · 목록 항목 · 스크롤 상자 · 세그먼트는 안쪽 링, 파일 드롭 · 검색은 감싼 상자에 링, 파란 띠(LNB · 모달 머리) 위 링은 흰색. 스크롤되는 기록 상자는 `tabindex="0"` + 이름. 층은 포커스를 가두지 않고, 모달을 닫으면 연 컨트롤로(사라졌으면 대체 자리로) 돌아간다 | 키보드로 닿기 · 포커스 보이기는 이음 원본보다 앞서는 유일한 하한이다(설계 기준 원칙). 링이 하나여야 포커스 위치가 바로 보이고, 부품이 outline을 덮으면 링이 사라진다 | oxlint `jsx-a11y`(recommended와 같게 — `.oxlintrc.json`) · `check-css` `property-value`(outline 지우기 — `DISALLOWED_VALUES`) · `ui/layers` 포커스 복귀 · ui-review #12 |

## Colors

색은 [핵심 규칙 2](#핵심-규칙)의 다섯 뜻과 무채색에만 쓴다. 아래 표에 없는 색은 만들지 않는다 — 새 표지 색은 `design-change`로 ⑤ 표에 행을 더한 뒤에만 쓴다. 테마는 라이트 `:root`와 다크 두 블록(시스템 다크 `prefers-color-scheme` · 강제 다크 `[data-theme="dark"]`)이고, 두 다크 블록은 이름 · 값이 같아야 한다(`check-docs`). 두 테마에서 같은 고정 색은 라이트 `:root`에만 둔다. 새 색 토큰은 다크 값을 함께 정하거나 "두 테마 같음"을 `tokens.css` 주석에 적는다.

### 무채색 — 면 · 선 · 글자
| 토큰 | 뜻 | 쓰는 곳 |
|---|---|---|
| `--bg-page` | 문서 바탕 | `body`. 라이트는 `--surface`와 같지만 다크가 달라 따로 둔다 |
| `--surface` | 기본 면 | 카드 · 표 · 층 · 입력 · 버튼 면 |
| `--surface-sub` | 보조 면 | 머리띠 · 발 · 표 머리 · 코드 상자 · 칩 바탕 · 도우미 말풍선 |
| `--surface-hover` | 가리킨 행 | 행 · 목록 항목 hover |
| `--surface-selected` | 선택된 행 | 선택된 행 · 항목 바탕 |
| `--line-divider` | 나눔선 | 행 사이 · 구획 · 셀 세로선 |
| `--line-control` | 컨트롤 테두리 | 입력 · 버튼 · 칩 · 상자 테두리, 꺼진 스위치 |
| `--line-strong` | 강한 선 | 표 윗선 |
| `--text` | 본문 글자 | 본문 · 제목 · 표 셀 · 관찰 값 칩 글자 |
| `--text-muted` | 보조 글자 | 설명 · 라벨 · 보조 줄 |
| `--text-faint` | 옅은 글자 | 힌트 · 단위 · 빈 상태 · 메타 · 자리표시 |

### ① 주조
| 토큰 | 뜻 | 쓰는 곳 |
|---|---|---|
| `--primary` | 주조 | 주 버튼 필 · 현재 선택(레일 표시 · 필터 알약 · 세그먼트 필 · 옵션 · 라디오) · 링크 · 포커스 링 · 입력 포커스 테두리 · hover 테두리(기본 버튼 · 파일 드롭) · 사용자 말풍선 바탕(옛 `.msg.u` `css/console.css:741`) · 진행 막대 · 도는 원 · 단계 완료 · 강조 수치(표 칸 안 수치 표지 · 드로어 발 선택 수 · 목록 상자 머리 수 · 탐색 실시간 띠 후보 수 — 옛 `span.num` · `.d-foot .info b` · `.p-head .cnt`) · 강조 아이콘(연결 방식 카드 · 파일 올리기 — 옛 `.mode-card .mt svg` · `.drop svg`) |
| `--primary-hover` | 주조 hover | 주 버튼 · 차트 막대 hover |
| `--primary-bg` · `--primary-ink` | 정보 · 선택 면과 그 위 글자 | 정보 칩 · 안내 상자 · 선택 카드 · 완료 단계 원 바탕 / 그 위 진한 파랑 글자 |
| `--primary-line` | 연한 파랑 테두리 | 안내 상자 · 선택 카드 · 완료 단계 원 테두리 · 카드 hover 테두리(구조도 원본 노드 · 연결 방식 카드) |

- **완료는 파랑**이다(분석 단계 · 탐색 단계 완료). 초록(`--ok`)은 "정상 · 공개 중" 같은 자원 상태에만 쓴다.
- **표 수치** — 칸 안 수치 표지(옛 `span.num` — 원본 공개 수 · 탐색 작업 후보 수)는 `--primary` 굵게다. 칸 전체가 수치인 칸(옛 `td.num` — 로그 소요 시간)은 옛 `.utbl td` 색이 이겨 본문색 굵게다(`css/console.css:201,508`). 둘 다 `tabular-nums`. 새 수치 칸은 본문색 굵게가 기본이고 글자 크기는 표 기본을 물려받는다(옛 `.num`은 크기를 적지 않는다 — `css/console.css:508`). 주조 수치 표지는 그 자리에 이음 근거가 있을 때만 쓴다.
- 선택 표시는 자리마다 지금 모양 그대로다 — 목록 항목 왼쪽 막대(`--edge-active`) · 카드 안쪽 테(`--ring-selected`) · 세그먼트 주색 필 · 탭 · LNB 밑줄 · 행 바탕(`--surface-selected`). 하나로 맞추지 않는다.

### ② 브랜드 띠
| 토큰 | 뜻 | 쓰는 곳 |
|---|---|---|
| `--brand-band` | 파란 띠 | LNB · 모달 머리 · 드로어 윗띠(두께 `--bw-band`) |

띠 위 글자 · 선 · hover는 ⑤의 `--on-fill*` · `--on-band-hover`, 띠 위 포커스 링은 흰색이다([접근성](#접근성)). 차트 막대는 값이 같아도 `--chart-bar`를 쓴다 — 띠를 바꿔도 차트가 따라가지 않게.

### ③ 상태
| 토큰 | 뜻 |
|---|---|
| `--ok` · `--ok-bg` | 정상 · 성공 · 승인 받음 · 증가 |
| `--warn` · `--warn-bg` | 주의 · 대기 · 검토 · 변경 · 쓰기 메서드 |
| `--danger` · `--danger-bg` | 실패 · 위험 · 차단 · 필수 표시 |
| `--primary-bg` · `--primary-ink` | 정보(상태 토큰을 따로 두지 않는다) |

**쓰는 곳 목록** — 상태 색은 이 표의 자리에만 쓴다([핵심 규칙 3](#핵심-규칙)). 상태 칩은 점 + 글자이고 라벨 · 색은 `copy/status`가 정한다([Copy](#상태-값)).

| 자리 | `--ok*` | `--warn*` | `--danger*` | 정보 |
|---|---|---|---|---|
| 자원 상태 칩(점 + 글자) | ok | warn | danger | info |
| 상태 점(목록 · 구조도) | ok | warn | danger | info |
| 알림 · 안내 상자 아이콘 · 바탕 | — | 경고 상자 | 실패 상자 | 안내 상자 |
| 결과 표식(탐색 기록) | 성공 | 경고 | 실패 | 정보 |
| 탐색 단계 실패 | — | — | 실패 단계 | — |
| 승인 · 확인 필요 | 승인 받음 | 승인 대기 상자 · 대기 단계 · 승인 체크 상자 · 원본 목록 검토 수 | — | — |
| 변경 · 주의 | — | 명세 변경 행 · 변경 태그 · 새 필드 · 추정 태그 · 건너뜀 · 연결 분석 결과 쓰기 작업 수 | — | — |
| 메서드 표식 | GET | 그 밖 메서드 | — | — |
| 읽기/쓰기 표지 | — | 쓰기 | — | 읽기 |
| 필수 표시 | — | — | 필수 `*` | — |
| 위험 · 차단 규칙 | — | — | 마스킹 규칙 · 금지어 칩 · 차단 수 | — |
| 지표 | KPI 증가 | — | 차트 오류 막대 · 범례 | — |
| 그 밖 | 추천 표식 · 안전 목록 아이콘 | 경고 문구 | 녹화 중 점 · `@Deprecated` · 명세 변경 행의 값 없음 | 변환 규칙 칩 |

프로토콜 배지(REST · 공공데이터 · SOAP · 자동 탐색)와 코드 리터럴은 상태가 아니라 ⑤의 `--proto-*` · `--code-*`를 쓴다.

### ④ 구성요소 — 연결 흐름 세 쪽
| 토큰 | 뜻 | 쓰는 곳 |
|---|---|---|
| `--ai` · `--ai-bg` | AI(클라이언트 · 모델) 쪽 | 구조도 AI 노드 · 변환 과정 AI 단계 · 모델 안내 · 응답 미리보기 범례 |
| `--tool` · `--tool-bg` | 도구(MCP) 쪽 | 파이프라인 AI 도구 칸 · 도구 비율 막대 · 배포 AI 연결 탭 · 응답 변환 캡션(AI에게 전달하는 결과) |
| `--source` · `--source-bg` | 원본 시스템 쪽 | 구조도 원본 노드 · 파이프라인 원본 칸 · 원본 응답 단계 · 응답 변환 캡션(원본 응답) |

가운데 이음(허브)은 주조 필 + `--shadow-brand*`다. 이 세 색은 흐름의 쪽만 뜻한다 — 탐색 근거 · 규칙 분류 · 네트워크 표식처럼 값만 같은 자리는 ⑤의 따로 된 이름을 쓴다.

### ⑤ 표지 · 고정 색
| 묶음 | 토큰 | 쓰는 곳 |
|---|---|---|
| 탐색 근거 | `--evidence-code` · `--evidence-code-bg` · `--evidence-traffic` · `--evidence-traffic-bg` | "Git 소스" · "운영 트래픽" — 벤 원 · 근거 배지 · Git 파일 아이콘 · 캡처 범례 |
| 규칙 분류 | `--rule-inject` · `--rule-inject-bg` | "인증 정보 주입" 칩 |
| 네트워크 기록 표식 | `--netlog-flag` · `--netlog-flag-bg` | "허용 (로그인)" 태그 · "스테이징" 표식 |
| 프로토콜 배지 | `--proto-rest` · `--proto-rest-bg` · `--proto-gov` · `--proto-gov-bg` · `--proto-soap` · `--proto-soap-bg` · `--proto-disc` · `--proto-disc-bg` | REST · 공공데이터 · SOAP · 자동 탐색 배지 |
| 코드 강조 | `--code-key` · `--code-string` · `--code-number` · `--code-literal` · `--code-tag` · `--code-comment` | 코드 상자 · JSON · XML 문법 색 |
| 차트 | `--chart-bar` | 차트 막대 · 범례 |
| 어두운 고정 면 | `--inverse-surface` · `--toast-bg` | 일괄 작업 도크 면 · 토스트 바탕(둘을 합치지 않는다) |
| 어두운 면 위 | `--inverse-primary` · `--inverse-ok` · `--inverse-warn` · `--inverse-danger` · `--inverse-danger-line` · `--inverse-danger-hover` · `--inverse-fill` · `--inverse-fill-hover` | 도크 선택 수 · 도크 주 버튼 · 토스트 아이콘 — `--inverse-danger*`(도크 위험 버튼)는 쓰는 곳이 없다([미정](#미정)) |
| 채움 위 흰색 | `--on-fill` · `--on-fill-muted` · `--on-fill-soft` · `--on-fill-quiet` · `--on-fill-line` · `--on-fill-line-hover` · `--on-fill-subtle` · `--on-fill-hover` · `--on-band-hover` | 주 버튼 · 파란 띠 · 허브 · 도크 · 레일 · 사용자 말풍선 위 글자 · 선 · hover — `--on-fill-line-hover`(도크 보조 버튼 hover 테두리)는 쓰는 곳이 없다([미정](#미정)) |
| 위험 hover | `--danger-hover-bg` | 금지어 칩 빼기 hover |
| 셸 | `--rail-bg` · `--rail-icon` · `--rail-active-bg` | 레일 바탕 · 아이콘 · 현재 버튼 |
| 고정 그림 | `--avatar-from` · `--avatar-to` · `--avatar-ink` · `--capture-bg` · `--capture-text` · `--capture-icon` · `--capture-hl` · `--capture-hl-block` | GNB 아바타 · 탐색 캡처 영역(늘 밝은 화면) |

## Typography

글자 토큰은 **축별**이다 — 크기 `--fs-*` · 웨이트 `--fw-*` · 행간 `--lh-*` · 자간 `--tracking-*` · 글꼴 `--font-sans` · `--font-mono`. 합성 역할(`font` 한 줄)은 두지 않는다. 이음은 크기 · 웨이트 · 행간을 따로 고르기 때문이다.

- **글꼴** — `--font-sans`(Noto Sans KR, `body`) · `--font-mono`(JetBrains Mono — 코드 · 경로 · 키 · 식별자 · 메서드 표식). 웹 폰트는 `index.html`이 불러온다([미정](#미정) 폰트 파일)
- **화면 CSS**(`src/screens/**`, `_guide` 제외)의 `font-size` · `font-weight` · `line-height` · `letter-spacing` · `font-family`는 그 축의 토큰 하나만 쓰고, `font`는 쓰지 않는다([핵심 규칙 5](#핵심-규칙)). 부품 CSS도 토큰을 쓴다 — px 행간은 높이에서 나온 파생 치수일 때만(끄는 주석). 부품 CSS의 웨이트 · 자간은 검사(`property-value`)가 보지만, 글자 크기 · 행간 · 글꼴 토큰 사용은 검사가 아니라 ui-review #5로 본다
- **textarea** — `base.css`는 `button` · `input` · `select`에만 글꼴 · 색 상속(`font: inherit` · `color: inherit`)을 준다. `textarea`는 물려받지 않으므로 textarea를 쓰는 부품이 글꼴 · 크기 · 행간 · 색을 직접 정한다(원본 그대로 — 설명 편집 · 코드 입력이 자기 글꼴을 쓴다)
- **숫자 정렬** — 수치 열 · 개수 칩은 `font-variant-numeric: tabular-nums`(키워드 값이라 그대로 쓴다)
- 제목 요소(`h1`~`h5`) · `b` · `th`가 웨이트를 적지 않으면 브라우저 기본 700이 된다 — 불러오는 웨이트라 모습이 맞고, `base.css`에 따로 적지 않는다

### 크기
| 토큰 | 쓰는 곳 |
|---|---|
| `--fs-micro` | 추천 · 2차 표식, 차트 축 · 범례, 탐색 표식 |
| `--fs-tag` | 태그 · 규칙 칩 · 코드값 칩 · 메시지 화자 · 파이프라인 허브 요약 칩 |
| `--fs-caption` | 상태 칩 · 프로토콜 배지 · 인라인 코드 · 보조 줄 · 정책 줄 · 옵션 설명 · 파이프라인 칸 라벨 · 호출 사용자 · 승인 안내 |
| `--fs-small` | 힌트 · 코드 상자 · 매핑 표 머리 · 드로어 머리 보조 · 승인 인자 값 · 선택 목록 소제목 |
| `--fs-ui-sm` | 작은 버튼 · 칩 · 링크 · 안내 상자 · 표 보조 셀 · 요약 칸 작은 값 · 기다림 말풍선 · 승인 인자 목록 · 복사 칸 값 · 한 줄 상태 줄 끝 글 |
| `--fs-label` | 폼 라벨 · 옵션 제목 · 매핑 표 · 정책 줄 제목 · 공개 스위치 글자 · 툴바 라벨 |
| `--fs-body` | 본문(`body`) · 버튼 · 입력 · 표 · 토스트 · 말풍선 · 한 줄 상태 줄 문장 |
| `--fs-subhead` | 상세 소제목 · 묶음 이름 · 카드 제목 · 밑줄 탭 · 탐색 영역 제목 · 승인 질문 |
| `--fs-section` | 박스 · 영역 제목 · 모달 머리 · LNB 메뉴 · 도크 선택 수 |
| `--fs-drawer` | 드로어 제목 |
| `--fs-title-sm` | 로고 · 도구 상세 제목 · 760 이하 화면 제목 |
| `--fs-title` | LNB 제목 · 큰 수치 |
| `--fs-page` | 화면 제목 |
| `--fs-figure` · `--fs-figure-narrow` | KPI · 벤 수치 / 1500 이하 KPI 수치 |

### 웨이트 · 자간
| 토큰 | 쓰는 곳 |
|---|---|
| `--fw-regular` | 본문 굵기 — `small` 등을 되돌릴 때 |
| `--fw-medium` | 기본 강조 |
| `--fw-bold` | 제목 · 수치 · 활성 항목 · 원 · 표식 안 숫자 · 머리글자(14px 미만 700은 이 자리뿐) · 표 빈 행 문장 안 굵은 낱말(옛 `td.empty`에 `b` 규칙이 없어 브라우저 기본 굵기 — `css/console.css:212`, 점선 상자 등 다른 빈 상태는 `--fw-medium`) |
| `--fw-mono-strong` | 고정폭 글꼴에서만 쓰는 강조(sans에 쓰지 않는다 — ui-review) |
| `--tracking-body` | 본문(`body`) · 도구 상세 제목. 옛이 자간을 적지 않아 `body` 자간을 물려받은 자리(인라인 코드 등)는 부품에서 다시 적지 않고 물려받는다 — 다시 적으면 그 부품의 글자 크기로 다시 계산되어 옛과 어긋난다 |
| `--tracking-mono` | 옛이 자간 0을 준 고정폭 글자(`.mono` `css/console.css:488`) · 로고 옆 라벨 · 메서드 표식 |
| `--tracking-logo` | 로고 |
| `--tracking-control` | 옛 `<button>`이 링크로 바뀐 컨트롤(LNB 메뉴) — 버튼은 `body` 자간을 물려받지 않아 `normal`이었다. 링크가 `body` 자간을 물려받아 좁아지지 않게 이 값을 준다 |

### 행간
| 토큰 | 쓰는 곳 |
|---|---|
| `--lh-tight` | 수치 · 노드 이름 · 표 보조 줄 |
| `--lh-body` | 본문(`body`) · 옵션 · 정책 행 |
| `--lh-note` | 안내 · 메모 · 긴 입력 |
| `--lh-prose` | 설명 글 · 코드 상자 · 말풍선 · 모달 본문 |
| `--lh-loose` | 빈 트레이스 · 범위 목록 |

## Layout

데스크톱 우선(`max-width`)이고 **휴대폰 폭까지** 지원한다(`viewport-fit=cover` · safe-area 여백 — `base.css`). 문서(`window`)가 스크롤한다 — `html` · `body`에 높이 · `overflow`를 걸지 않는다. 셸은 레일 + GNB + LNB + 본문이다(`src/app/shell/`).

### 셸
- **틀** — 레일(서비스 레일 — "게이트웨이 관리"만 현재, 나머지는 동작 없는 버튼 — 이음 그대로) · GNB(로고 · 회사 · "1차 개발 범위" · 장식 아이콘 · 사용자) · LNB(제목 + 메뉴 링크) · 본문 `<main>`. 화면은 본문 안만 그린다 — 레일 · GNB · LNB · 본문 여백을 화면이 다시 그리지 않는다. 계약은 COMPONENTS `셸`
- **셸 조회** — GNB의 workspace는 `useSources` 하나다. 셸은 이 조회로 본문을 감싼다: 첫 로딩은 본문을 비우고 `aria-busy`, 실패는 본문 자리 실패 상자(레일 · GNB · LNB는 남는다). 화면은 자기 조회를 다시 `ScreenState`로 감싼다
- **메뉴** — LNB 링크는 메뉴별 마지막 주소다(`useMenuHref`). 현재 메뉴는 `menuOf(pathname)`이고 탐색 작업 화면에서는 "원본 시스템"이다. 링크를 누르면 그 메뉴의 `REFRESH_KEYS`(`app/menuRefresh.ts`)에 적은 조회만 다시 받는다(`refreshMenu` — 같은 메뉴를 다시 눌러도) — 대시보드 요약 · 호출 로그 목록 · 탐색 개요 · 배포 도구 묶음이고, 액세스 키 · 스튜디오 자료는 다시 받지 않는다(테스트 실행은 받지 않고 실행 버튼 · 변환 과정만 다시 맞춘다). 메뉴를 옮기면 열린 층을 닫는다(`closeAllLayers`). 맨 위 스크롤은 첫 경로 조각이 바뀔 때만이다(`RootLayout`)

### 폭 구간
| 구간 | 대표 검수 폭 | 이 구간에 들어오며 바뀌는 것 |
|---|---|---|
| 1681 이상 | 1920 | 기준 배치 |
| 1501–1680 | (보지 않음) | 본문 좌우 여백만(`--content-pad-x-1680`) |
| 1361–1500 | 1440 | LNB 메뉴 좌우 · 글자, KPI 셀 여백 · 수치(`--fs-figure-narrow`) |
| 1101–1360 | 1280 | 두 열 → 한 열(`TwoColumn` — 스튜디오 상세 + 정책 · 대시보드 · 배포 · 탐색 결과 요약) |
| 761–1100 | 1024 | 목록 + 상세(스튜디오 · 배포) · 테스트 실행 두 열 · 탐색 기록 두 열 → 한 열, KPI · 탐색 요약 3열, 구조도 세로, 깃 결과 · 2차 목록 한 열, 도구 목록 최대 높이, 대화 최소 높이 해제, GNB 회사 버튼 숨김. JS: 도구를 고르면 상세로 스크롤 |
| 760 이하 | 390 | 휴대폰 셸(레일 숨김 · GNB 축소 · LNB 두 줄 · 본문 `--content-pad-narrow`), 폼 라벨 위 · 입력 아래, 드로어 여백 축소, 도크 꽉 참, KPI · 요약 2열, 상세 머리 동작 줄 전체 폭, 파이프라인 세로, 여러 격자 한 열, 네트워크 기록 줄 열 축소, 대화 최대 높이 |

검수 폭은 1920 · 1440 · 1280 · 1024 · 390이다([핵심 규칙 11](#핵심-규칙)). "잘림"은 표 상자 밖 넘침을 말한다 — 표는 자기 상자 안에서 가로 스크롤한다(표 최소 폭은 `Table` · `CompactTable`의 `minWidth` prop, 토큰이 아니다). 경계 폭(760 · 1100 · 1360 · 1500 · 1680과 그 +1px)은 `/_guide` 폭 전환으로 본다.

### 브레이크포인트
- 값은 다섯 개 `(max-width: 1680px)` · `1500` · `1360` · `1100` · `760` — 원본 목록은 `lint/values.js` `ALLOWED_MEDIA`와 `src/app/breakpoints.ts` `BREAKPOINTS` 둘이고 `check-docs`가 같은 집합인지 대조한다. CSS 변수는 미디어 조건에 쓸 수 없어 값 자체를 목록으로 묶는다
- `@media`는 **부품 · 레이아웃 CSS**(`src/ui/**` · `src/app/shell/**`)에만 쓴다. 화면 CSS는 `@media`를 쓰지 않고 접히는 배치를 레이아웃 부품에 맡긴다
- JS가 폭을 알아야 하는 곳(지금 한 곳 — 1100 이하 도구 선택 스크롤)만 `useMediaQuery(maxWidth(1100))`. 인자는 `MaxWidthQuery`(다섯 값의 유니온)만 받는다

| 폭 | 맡는 곳 |
|---|---|
| 1680 | 앱 셸 본문 여백 |
| 1500 | LNB · KPI 묶음 |
| 1360 | 두 열 레이아웃 `TwoColumn`(`layout` `main-side` · `main-aside` · `half` · `summary` — 대시보드 · 스튜디오 상세 + 정책 · 배포 · 탐색 요약) |
| 1100 | `SplitLayout`(목록 + 상세 — 스튜디오 · 배포, 테스트 실행) · 목록 상자 `Panel`(목록 최대 높이) · `TwoColumn`(`layout` `live` — 탐색 기록) · `StatStrip` · 요약 격자 · `CardGrid`(`collapseAt` 1100 — 2차 카드) · `Topology` · `FlowLine` · `GitFileList` · 대화 상자(`Box` `chat` 최소 높이) · GNB 회사 버튼 |
| 760 | 셸(레일 · GNB · LNB) · `Dock` · `Field`(`FieldNote` 포함) · `FieldPair` · `Drawer` · `KeyValueGrid` · `StatStrip` · `Toolbar` · `SearchInput` · `CardGrid`(`collapseAt` 760 — 연결 방식 카드 · 분석 결과) · `StepIndicator`(`job`) · `DetailHead` · `CompareGrid` · `Switch`(`heading` 설명 들여쓰기) · `NetLog` · `ChatLog`(대화 목록 최대 높이) · 격자 부품 · 파이프라인(`Pipeline` · `FlowLine`) |

부품별 폭 동작은 COMPONENTS 그 절의 `1680:` … `760:` 줄에 적는다.

### 간격
단계는 4px 단위 + 반 단계 `--s-*` 열여섯 개다 — `--s-0-5` · `--s-1` · `--s-1-5` · `--s-1-75` · `--s-2` · `--s-2-5` · `--s-3` · `--s-3-5` · `--s-4` · `--s-4-5` · `--s-5` · `--s-5-5` · `--s-6` · `--s-7` · `--s-8` · `--s-10`. 가장 흔한 gap · 안쪽은 `--s-2-5`이고, `--s-1-75`는 태그 좌우 여백 · 일부 gap에만 쓴다. 단계 밖 값(1px 광학 보정 · 음수 여백 · 테두리 겹침)은 파생 치수 끄는 주석으로 둔다.

셸 · 층 · 빈 상태의 여백은 단계 대신 이름 토큰이다 — 그 부품만 쓰고 화면 CSS는 쓰지 않는다(`--subsection-top`만 제목 없는 소절의 위 여백으로 화면 CSS도 쓴다 — 왼쪽 열 소절 제목과 줄을 맞추려는 것이다).

| 토큰 | 쓰는 곳 |
|---|---|
| `--content-pad-top` · `--content-pad-x` · `--content-pad-bottom` | 본문 영역 위 · 좌우 · 아래(아래는 모든 폭) |
| `--content-pad-x-1680` | 1680 이하 본문 위 · 좌우 |
| `--content-pad-narrow` | 760 이하 본문 padding 한 줄(위 · 좌우 · 아래) |
| `--gnb-pad-x` · `--lnb-pad-x` | GNB · LNB 좌우 |
| `--drawer-head-pad` · `--drawer-body-pad` · `--drawer-foot-pad` | 드로어 머리 · 본문 · 발 padding(760 이하 값은 `Drawer` CSS) |
| `--modal-pad` | 모달 본문 위 · 좌우, 발 좌우 · 아래 |
| `--empty-pad-y` | 빈 표 행 · 빈 트레이스 위아래 |
| `--empty-pad-panel` | 점선 빈 상자 padding |
| `--empty-pad-hero` | 대시보드 빈 상태 큰 상자 padding |
| `--subsection-top` | 상자 · 상세 · 드로어 안 소절 위 — `SectionTitle`(`level="sub"`)과 제목 없는 소절(스튜디오 정책 열 위) |

### 컨트롤 높이 단계
같은 이름이면 같은 높이다. 크기는 쓰는 자리 이름이 아니라 단계 이름으로 고르고, 단계에 없는 높이는 만들지 않고 `## 미정`에 제안한다. 원 · 점 크기는 단계가 아니라 그 부품 CSS의 고유 치수다.

| 토큰 | 단계 | 쓰는 곳 |
|---|---|---|
| `--h-xs` | `xs` | 필터 알약 · 금지어 칩 · 작은 입력(매핑 표 칸) |
| `--h-sm` | `sm` | 작은 버튼 · 칩 · 작은 선택 · "1차 개발 범위" 버튼 · 설정 줄 칸 · 선택 |
| `--h-sm-plus` | `sm-plus` | 아이콘 버튼 · 꽉 찬 검색 · 회사 버튼 · 세그먼트 바깥(안쪽 버튼은 `--h-sm-plus` − 테두리 2의 파생 치수) |
| `--h-md` | `md` | 기본 버튼 · 입력 |
| `--h-lg` | `lg` | 목록 검색 · 목록 필터 선택 |
| `--h-xl` | `xl` | 대화 입력 줄(`ChatInput` — 입력칸 · 보내기 `Button` `xl`) |

### 셸 · 층 · 표 고정 치수
| 토큰 | 쓰는 곳 |
|---|---|
| `--w-rail` · `--h-rail-btn` | 레일 폭 · 레일 버튼 한 변 |
| `--h-gnb` | GNB 높이 |
| `--h-lnb` · `--h-lnb-narrow` | LNB 높이 · 메뉴 줄 / 760 이하 메뉴 줄 |
| `--h-th` · `--h-row` | 표 머리 행 · 본문 행 |
| `--h-modal-head` | 모달 머리(파란 띠) |
| `--w-drawer` | 드로어 폭(화면이 좁으면 화면 폭) |
| `--w-modal` · `--w-modal-wide` | 모달 폭 · 넓은 모달 폭 |
| `--w-field-label` | 폼 라벨 열 |
| `--w-search` | 목록 검색 폭 |
| `--w-list-aside` · `--w-policy-aside` | 스튜디오 · 배포 목록 열(`SplitLayout` `list`) · 스튜디오 정책 열 |

그 밖의 부품 폭(테스트 실행 열 · 구조도 열 · 매핑 열 등)은 그 부품 CSS의 고유 치수다.

### 리터럴 px 예외 주석
`.module.css`에 그대로 쓰는 px는 0 · 테두리 1px · 폭 계열 속성(`width` · `min-width` · `max-width` · `grid-template-*` · `flex-basis` · `outline` · `outline-width` · `outline-offset`)뿐이다(`check-css` `literal-px`). 그 밖의 px는 바로 윗줄에 `/* check-css-disable-next-line literal-px -- <사유> */`를 단다. 사유가 없거나 끈 것이 없는 주석은 `disable-comment`로 실패한다.
- 쓰는 자리 — 치수에서 따라 나오는 값(테두리 계산 · 행간 = 상자 높이 · 원 · 점 크기 · 한 변 = 다른 변), 위치 오프셋(`top` · `left` 등 — 레일 표시 · 트레이스 연결선 · 캡처 라벨 · 흐름 점선), 1px 광학 보정 · 음수 여백, 로고 고유 치수, 시각 숨김
- 같은 값이 여러 부품에 반복되면 토큰을 먼저 제안한다(`## 미정`)

### TSX `style`
인라인 `style`은 객체 리터럴의 CSS 사용자 속성(`'--…'`) 키만 쓴다. 리터럴 키(`width` · `color` …)는 `check-source` `inline-style-literal`로 실패하고 끌 수 없다. 객체 리터럴이 아닌 값(변수 · 호출 · 삼항)과 펼침은 `inline-style-dynamic`으로 실패하며, `style` 속성 바로 윗줄에 `check-source-disable-next-line inline-style-dynamic -- <사유>`를 단 것만 통과한다. 받는 쪽 CSS는 그 사용자 속성의 기본값을 같은 `.module.css`에 정의한다(`check-css` `unknown-custom-property`가 같은 파일 정의를 인정한다). `'--…'` 키는 `src/env.d.ts`의 `CSSProperties` 확장으로 타입 단언 없이 쓴다.

## Elevation & Depth

깊이는 면(`--surface` · `--surface-sub`)과 선(`--line-*`)으로 나눈다. 그림자는 떠 있는 층과 연결 허브에만 쓴다([핵심 규칙 4](#핵심-규칙)).

| 토큰 | 뜻 | 쓰는 곳 |
|---|---|---|
| `--shadow-float` | 떠 있는 층 | 도크 · 드로어 · 모달 · 토스트 |
| `--shadow-brand` | 파란 허브 카드 | 대시보드 구조도 허브 |
| `--shadow-brand-sm` | 작은 파란 허브 | 스튜디오 파이프라인 허브 칸 |
| `--shadow-knob` | 부품 안 — 손잡이 | 스위치 점 |
| `--ring-selected` | 부품 안 — 선택 테 | 선택된 카드 안쪽 테 |
| `--edge-active` | 부품 안 — 활성 막대 | 선택된 목록 항목 왼쪽 막대 |
| `--halo-current` | 부품 안 — 진행 중 둘레 | 진행 중 단계 원 둘레 |
| `--scrim` | 가림막 | 드로어 · 모달 뒤 |

### 쌓임
`--z-*`는 아래 행일수록 위에 그린다. 층은 `<dialog>.show()`로 열고(브라우저 top layer를 쓰지 않는다) 가림막 · z를 부품이 직접 준다. 토스트만 Popover(`popover="manual"`)로 최상층에 올려 열린 층보다 늘 위에 그린다(옛 순서 모달 < 토스트 그대로 — COMPONENTS `Toast`).

| 토큰 | 쓰는 곳 |
|---|---|
| `--z-raise` | 부품 안 쌓임 — 스위치 입력 · 캡처 강조 |
| `--z-sticky` | 표 머리 고정 |
| `--z-dock` | 일괄 작업 도크 |
| `--z-drawer-scrim` · `--z-drawer` | 드로어 가림막 · 드로어 |
| `--z-modal-scrim` · `--z-modal` | 모달 가림막 · 모달 |
| `--z-toast` | 토스트 |

드로어가 열리면 도크를 숨기는 동작은 z가 아니라 열린 층 상태(`useOpenLayers().drawer` — `Dock`이 직접 읽는다)로 한다.

### 투명도
`opacity`는 `0` · `1` · `--opacity-*`만 쓴다(`check-css` `property-value`).

| 토큰 | 쓰는 곳 |
|---|---|
| `--opacity-disabled` | 비활성 버튼 · 카드 · 옵션 · 공개 스위치 묶음 — 비활성은 이 값 하나 |
| `--opacity-skipped` | 탐색 단계 "안 함" — 비활성이 아니라 건너뜀 표시라 따로 둔다 |
| `--opacity-flow` | 연결선 흐름 점선(구조도 · 파이프라인 — `FlowLine`) — 주조 점선을 한 단계 물린다(옛 `.tp-link i` `opacity .7`) |
| `--opacity-blink` | 깜빡임의 옅은 끝 — 탐색 중 점(`LiveIndicator`) · 입력 중 점(옛 `@keyframes blink` `opacity .25` `css/console.css:747`) |

## Shapes

| 토큰 | 쓰는 곳 |
|---|---|
| `--r-xs` | 범례 사각 점 |
| `--r-sm` | 버튼 · 입력 · 태그 · 배지 · 막대 · 세그먼트 · 코드값 칩 · 복사 칸 |
| `--r-md` | 카드 · 모달 · 토스트 · 코드 상자 · 아이콘 버튼 · 안내 상자 · 담당자 승인 확인(탐색 마법사) |
| `--r-lg` | 레일 버튼 · 실행 전 승인 상자(테스트 실행) · 파이프라인 칸 · 캡처 틀 · 2차 목록 아이콘 칸 |
| `--r-xl` | 도크 · 구조도 허브 |
| `--r-bubble` | 대화 말풍선 |
| `--r-pill` | 알약 — 칩 · 필터 · 스위치 · 회사 버튼 · 수 칩 |

- 원은 `50%` 그대로 쓴다. 한쪽 모서리만 둥근 곳(레일 표시 · LNB 밑줄 · 모달 머리 · 말풍선 꼬리)은 위 토큰을 모서리별로 쓴다
- 선 두께 — 테두리 1px은 리터럴, 그 밖은 `--bw-*`

| 토큰 | 쓰는 곳 |
|---|---|
| `--bw-strong` | 표 윗선 · 라디오 원 · 스피너 |
| `--bw-dashed` | 파일 드롭 점선 · 분석 단계 원 |
| `--bw-tab` | 탭 밑줄 |
| `--bw-band` | 드로어 윗띠 |

## Components

부품의 언제 · prop · 크기 · 상태 · 접근성 계약은 COMPONENTS.md가 원본이다. 화면은 부품을 `@/ui`(`src/ui/index.ts`)에서만 가져오고, 화면 폴더에 부품을 흉내 낸 CSS를 두지 않는다. 부품 · 변형을 더하거나 바꾸는 절차는 `design-change`.

## Iconography

**자체 세트** — `src/ui/icons/svg/*.tsx` 38종(이음 원본 `js/common/util.js`의 아이콘 36종 + `arrow-up` · `arrow-down`). `Icon` · `Logo` prop은 COMPONENTS `Icon` · `Logo`.
- **그리는 규격** — viewBox `0 0 24 24` · `fill="none"` · `stroke="currentColor"` · 선 끝 · 꺾임 `round` · `aria-hidden`(장식). 색은 쓰는 곳의 `color`를 따른다 — 아이콘에 색 토큰을 직접 주지 않는다. 선 두께는 viewBox 단위라 크기에 비례해 그려진다(원본과 같음)
- **크기**는 단계 이름만 받는다(숫자를 넘기면 typecheck 실패). 기본은 `md`

| 단계 | 토큰 | 쓰는 곳 |
|---|---|---|
| `xs` | `--icon-xs` | 칩 빼기 · 완료 점 |
| `sm` | `--icon-sm` | 작은 버튼(`--h-sm`) 안 · 글 줄 안 보조 |
| `md-minus` | `--icon-md-minus` | 지금 이 크기로 그린 자리(버튼 줄 · 상세 머리 · 모델 안내) |
| `md` | `--icon-md` | 기본 버튼(`--h-md`) 안 · 카드 · 검색 버튼 — 기본값 |
| `lg` | `--icon-lg` | 알림 상자 · 토스트 · 2차 목록 · 아이콘 버튼 |
| `xl` | `--icon-xl` | 모달 · 드로어 닫기 |
| `shell` | `--icon-shell` | 레일 · GNB |
| `hero` | `--icon-hero` | 파일 올리기 · 빈 브라우저 |
| `empty` | `--icon-empty` | 빈 트레이스 |

- **선 두께**는 네 단계 — 기본(`stroke` 생략 = `--icon-stroke`) · `light`(`--icon-stroke-light`, 40px 빈 상태) · `bold`(`--icon-stroke-bold`, 16px 이하 표시 아이콘 — 칩 빼기 · 토스트 · 탐색 한 줄 상태 줄 완료 체크) · `heavy`(`--icon-stroke-heavy`, 작은 완료 점)
- **이름 = 모양의 뜻** — `apps` 격자 · `chart` 차트 · `users` 사람 묶음 · `plug` 연결 · `doc` 문서 · `sliders` 설정 · `search` 찾기 · `close` 닫기 · 빼기 · `check` 완료 · `info` 정보 · `alert` 경고 · 실패 · `bell` 알림 · `help` 도움말 · `plus` 추가 · `copy` 복사 · `play` 실행 · `stop` 중지 · `refresh` 다시 읽기 · `key` 액세스 키 · `server` 서버 · `db` 데이터베이스 · `globe` 웹 · `upload` 올리기 · `send` 보내기 · `user` 사용자 · `bot` AI 클라이언트 · `sparkle` 추론 · `code` 코드 · `graph` 그래프 · `history` 예약 · 기록 · `shield` 안전 · `rocket` 배포 · `layers` 범위 · 묶음 · `back` 이전 · `arrow` 다음 · 이동 · `lock` 잠김 · `arrow-up` · `arrow-down` 올림 · 내림
- **서버가 주는 이름**(`ic` 등 — `db` · `graph` · `sparkle` 포함)은 `iconOf(value)`로 바꾼다. 아는 이름이면 그대로, 모르는 값은 기본 아이콘 `apps`로 그리고 개발 빌드에서 값마다 한 번 경고한다(원본은 빈 svg)
- **글리프 대신 아이콘** — 닫기 ✕ · 완료 ✓ · 방향 ▲ ▼ ← →는 글자가 아니라 `close` · `check` · `arrow-up` · `arrow-down` · `back` · `arrow`로 그린다(옛 글리프 자리가 아이콘이 되는 것은 [이식 기간](#이식-기간) 허용 차이)
- **로고**는 아이콘이 아니라 `Logo`(돼지코 모양 — 변환 어댑터)다. 크기는 아이콘 단계 밖의 고유 치수 셋(GNB · 구조도 허브 · 파이프라인 허브)
- **새 아이콘** — 놓인 자리가 아니라 뜻으로 짓고(kebab-case, 파일은 그 PascalCase), `svg/<Name>.tsx`에 도형만 그린 뒤 `names.ts` `ICONS`에 한 줄 더한다(`IconName`은 이 표의 키에서 나온다). `/_guide` 아이콘 절에 저절로 나온다. 같은 규격(viewBox 24 · round · currentColor)을 지킨다

## Motion

| 토큰 | 쓰는 곳 |
|---|---|
| `--m-fast` | 버튼 · 카드 · 스위치 전환 |
| `--m-modal` | 모달 나타남 |
| `--m-fade` | 가림막 · 토스트 · 캡처 강조 이동 |
| `--m-dock` | 도크 올라옴 |
| `--m-drawer` | 드로어 밀려옴(도크와 합치지 않는다 — 움직이는 거리가 다르다) |
| `--m-enter` | 새 항목 나타남 |
| `--m-progress` | 진행 막대 폭 |
| `--ease-out` | 도크 · 드로어 곡선 |
| `--m-spin` · `--m-blink` · `--m-flow` · `--m-pulse` | 반복 한 번 — 회전(분석 중 원 · 스피너) · 깜빡임(입력 중 점 · 녹화 중 점) · 연결선 흐름 · 캡처 강조 맥박 |
| `--m-stagger` | 입력 중 점 셋의 시차 — `var(--m-stagger)` · `calc(var(--m-stagger) * 2)` |
| `--toast-duration` | 토스트가 떠 있는 시간(모션이 아니라 표시 시간) |

- `transition` · `animation` · `*-duration` · `transition-delay`에 시간 리터럴(`ms` · `s`)을 쓰지 않는다 — 토큰이어야 모션 줄이기를 따른다(`check-css` `property-value`). `0s`는 허용한다 — 지연 가시성(`visibility 0s var(--m-*)`)에 쓴다
- **반복 · 등장 모션은 이음 그대로 유지**한다(흐름 · 깜빡임 · 등장 · 회전 · 맥박 — [이식 기간](#이식-기간) 유지). 진행 · 흐름 · 대기를 알리는 표시라 지우지 않는다
- **모션 줄이기** — `prefers-reduced-motion: reduce`이면 `base.css`가 전환 · 애니메이션을 끄고 `--m-*`를 모두 0ms로 다시 정의한다. `--toast-duration`은 다시 정의하지 않는다(토스트가 닫히지 않게). JS 부드러운 스크롤도 모션 줄이기를 따른다(켜면 즉시 스크롤)
- **JS에서 시간 토큰 읽기** — 운영 빌드는 ms 값을 s로 줄여 쓴다(`2800ms` → `2.8s`). JS가 시간 토큰을 읽을 때(`getComputedStyle(…).getPropertyValue('--toast-duration')`)는 ms · s를 모두 해석한다
- 토스트는 CSS 애니메이션 끝 이벤트로 닫지 않는다 — 전역 `animation: none`에서 영영 닫히지 않는다. 타이머(`--toast-duration`)로 닫는다

## Copy

화면 문장은 `src/copy/`에서 만든다([핵심 규칙 9](#핵심-규칙)). **문구 기준은 이음 지금 문구**다 — 옮길 때 고치지 않는다(옛 콘솔과 문구 대조 차이 0). 문형 차이("조건에 맞는 …" / "이 조건에 맞는 …")와 같은 개념의 여러 이름("검토 필요" · "검토 대기", "명세 변경" · "명세 변경 감지" 등)도 자리별로 그대로 둔다 — 통일은 전환 뒤 별도 과제다.

- **언어** — UI 문구 · 주석은 한국어. `window.confirm` · `alert` · `prompt`를 쓰지 않는다(oxlint `no-alert`) — 확인은 앱 안 Modal
- **서버 문장** — `resultMsg` · 서버가 준 라벨 · 서버가 박아 둔 문자열("방금" · "사용 전")은 받은 그대로 렌더한다. 개발자 메시지(`console.*` · `warnOnce` · `new Error`)는 `copy/` 밖이어도 된다
- **새 문구 · 숫자** — 실제 데이터로 뒷받침한다. 서버 사실과 다른 옛 문구 · 표시는 지금 그대로 옮기고 [이식 기간](#이식-기간) 보존 목록에서만 관리한다. 새로 만드는 문구에는 이 예외를 넓히지 않는다. 옛에 없는 문구를 더하는 기준(같은 개념의 지금 낱말 · 새 낱말은 사용자 확인)은 [이식 기간](#이식-기간) 추가. 새 낱말은 그것을 낳은 이식 기간 행에 적는다 — 고침에서 생긴 낱말(대화 목록 이름 · 네트워크 실패 문구 · 묶음 삭제 확인)은 그 고침 행, 요청한 기능의 낱말은 추가 행. 상수 주석은 "새 문구: …" 꼴이다

### 값 없음
| 자리 | 표기 | `copy/` 이름 |
|---|---|---|
| 숫자 · 시간 · 짧은 칸 | `—` — 단위를 붙이지 않는다(`—ms` 없음) | `NONE` · `orNone(value, unit?)` |
| 사유를 아는 자리 | 사유 문구(이음 지금 문구) | `NONE_REASON.*`(`copy/format.ts`) — "호출 전" · "전일 기록 없음" · "아직 호출 기록이 없습니다" · "삭제된 도구". 그 밖은 그 메뉴 `copy/<menu>.ts` — "미검증" · "관찰 없음" · "화면 호출 없음" · "소스 없음" · "원본 필드 없음" · "값 없음 (null)" · "(답변 없음)" · "아직 남은 로그가 없습니다." · 원본 관찰 "없음" |
| 서버가 박은 문자열 | 받은 그대로 | — |

- `orNone(value, unit?, format?)` — `null` · `undefined`면 `NONE`만, 아니면 `format`으로 서식한 값 + 단위다. `format`을 주지 않으면 원값 그대로(천 단위 쉼표는 `fmtNum`을 넘긴다). `0`은 값이다
- 같은 사유는 이미 있는 상수를 다시 쓴다(`NONE_REASON` · 메뉴 `copy/`) — 상수 주석에 적힌 자리는 처음 쓴 곳일 뿐이다
- 평균 · 합계에서도 `0`은 값이다 — `null`만 빼고 센다. 화면이 서버와 같은 이름의 지표를 다시 셀 때는 서버 식을 따른다 — 대시보드 KPI(백엔드 `app/ieum/routers/dashboard.py` summary): 성공률 = (호출 − 실패 `err`) / 호출 × 100 소수 첫째 자리, 평균 시간 = `null`이 아닌 값의 정수 반올림, 확인 대기 `wait`은 호출에서 뺀다
- 같은 값의 두 표기는 칸 성격대로 보존한다(로그 목록 `—` / 상세 "호출 전", 근거 "없음" / `—`). 변환 과정 소요의 없음 → `0`ms도 보존한다(서버가 0을 넣는 경로와 구분할 근거가 없다)
- 사용자 없는 로그 상세 머리는 사용자 조각을 뺀다(옛 콘솔은 ", 가 …"로 깨졌다)

### 빈 상태
`EmptyState`의 `kind` × `container`로 고른다([핵심 규칙 7](#핵심-규칙)). 문구는 지금 그대로 `copy/`로 옮긴다.

| `kind` | 뜻 | 행동 |
|---|---|---|
| `first` | 처음 — 아직 아무것도 없음 | 다음 할 일과 그 메뉴로 가는 링크 · 버튼(자리마다 지금 방식 — 주 버튼 · 링크 버튼 · 위치 안내 문장) |
| `filtered` | 조건 — 검색 · 필터 결과 없음 | 없음 |
| `section` | 부분 — 화면 안 한 영역이 빔 | 없음 |
| `idle` | 실행 전 — 동작하면 채워질 자리 | 없음(아이콘 + 안내) |

| `container` | 모양 | 쓰는 곳 |
|---|---|---|
| `table` | 표 안 한 행(`colSpan`, 위아래 `--empty-pad-y`) | 목록 표(`Table`). 테두리 작은 표(`CompactTable`)의 빈 표는 `EmptyState`가 아니라 `colSpan` 한 칸 문장이다(COMPONENTS `CompactTable`) |
| `panel` | 점선 상자 `--empty-pad-panel`, 작은 판 `sm`(옛 `.md-empty.sm` 자리 — 탐색 근거 드로어의 근거 소절, 그 밖은 기본 `md`), 대시보드 큰 상자 `hero`(`--empty-pad-hero`, 제목 · 주 버튼) | 화면 · 드로어 안 패널 |
| `inline` | 테두리 없는 가운데 한 줄 | 상자 안 |
| `area` | 테두리 없는 큰 자리 + 아이콘(`hero` · `empty`) | 빈 트레이스 · 빈 브라우저 화면 |

- `kind`는 비어 있는 까닭으로 고른다 — 그 자원이 아직 하나도 없으면 화면 안 한 영역에 그려도 `first`, 다른 자료는 있고 그 영역만 비면 `section`
- 설명 문단("이 도구는 입력이 필요 없습니다.")과 코드 상자 안 문장("아직 남은 로그가 없습니다.")은 `EmptyState`가 아니라 그 자리의 글이다
- 탐색 작업이 0개면 그 절을 그리지 않는다 — 빈 상태가 아니다

### 실패
`FailureBlock` 하나의 모양 — 경고 아이콘 + 굵은 머리 한 줄(있는 자리만) + 원문(`white-space: pre-wrap`). 복사 버튼은 없다. `tone`(`danger` · `warn`)은 자리마다 지금 그대로다.

| 자리 | 보이는 곳 | 모양 |
|---|---|---|
| 화면 첫 조회 실패 | 본문 자리(셸 · LNB는 남김) | `FailureBlock` — 재시도 버튼 없음 · `aria-busy` 해제 |
| 화면 안 영역 첫 조회 실패 | 그 상자 안 | 원문만 · 머리 문장 없음 · `warn`(`ErrorBlock`) |
| 없는 주소(탐색 작업 — 서버 404) | 본문 자리(셸 · LNB는 남김) | 머리와 같은 뒤로 링크 + `FailureBlock` — `warn` · 머리 없이 서버 원문. 새 문구 없음 |
| 층(모달 · 드로어)이 결과를 그리는 요청의 실패 — 마법사의 연결 · 분석, 배포 확인처럼 그 층이 결과 자리인 것 | 그 층 안 결과 자리 | `FailureBlock` — 층을 닫은 뒤에 끝나면 경고 토스트 |
| 버튼 한 번의 쓰기 실패 — 화면의 버튼, 그리고 재인증 · 삭제처럼 성공하면 층이 닫히는 층 안 확인 버튼 | 경고 토스트(층은 열린 채 남는다) | `toast.warn(원문)` — 접두어가 있는 자리는 `copy/`의 틀 |
| 서버 시작 실패(배포 화면 알림의 "시작" · "다시 시작") | 배포 화면에 있으면 오류 모달, 떠났으면 경고 토스트 | 오류 모달 = 넓은 `Modal` + `FailureBlock danger`(머리 없음 — 모달 제목이 머리) · 닫기만. 버튼 한 번의 쓰기인데 토스트가 아닌 자리다(이음 그대로) |
| 새로 받기 · 폴링 실패 | 표시 없음 | 이전 값 유지 |
| 결과의 일부인 실패(`ok: false` 호출 결과) | 결과 자리 | 실패 블록이 아니라 결과로 그린다 |

- 원문이 없을 때의 고정 문구(`copy/errors.ts`) — HTTP 상태만 있거나 `{detail}` 비봉투면 "요청에 실패했습니다 ({status})", 네트워크 실패(`status 0`)면 "서버에 연결하지 못했습니다."
- 첫 로딩은 본문 · 상자를 비우고 `aria-busy`만 켠다 — 문구 · 스피너 없음. 조회 · 쓰기 모두 재시도하지 않는다

### 상태 값
- 라벨 · 색은 `copy/status`의 자원별 목록 하나에서 찾는다(`statusOf(resource, value)` → `{ label, tone, known }`). 화면이 상태 맵을 따로 두지 않는다
- `resource`는 자원 이름 유니온(`StatusResource`)이고 메뉴를 옮기며 자원을 더한다. `tone`은 `StatusChip`의 `StatusTone`(`ok` · `warn` · `danger` · `info` · `mute`)이다. 아는 값 목록 `STATUS_VALUES[resource]`는 카탈로그가 전 값을 늘어놓는 데 쓴다
- 목록에 없는 값은 값 그대로 + `mute` 칩 + 개발 콘솔 `warnOnce` 한 번([핵심 규칙 10](#핵심-규칙)) — `known: false`. 렌더를 멈추지 않는다

| `resource` | 값 → 라벨 · `tone` | 옛 근거 |
|---|---|---|
| `log` | `ok` "성공" · `ok` / `err` "실패" · `danger` | `js/menu/logs.js:3` |
| `source` | `ok` "정상" · `ok` / `review` "검토 필요" · `warn` / `drift` "명세 변경 감지" · `warn` / `err` "인증 만료" · `danger`([이식 기간](#이식-기간) 보존) | `js/common/state.js:26` |
| `tool` | `done` "공개 중" · `ok` / `review` "검토 필요" · `warn` / `drift` "명세 변경" · `warn` / `off` "제외" · `mute` | `js/common/state.js:27` |
| `job` | `scheduled` "예약됨" · `info` / `running` "탐색 중" · `info` / `review` "검토 대기" · `warn` / `done` "등록 완료" · `ok` / `failed` "실패" · `danger` / `cancelled` "취소됨" · `mute` / `interrupted` "중단됨" · `danger` | `js/menu/discovery.js:5` |
| `recommend` | `yes` "등록 추천" · `ok` / `check` "확인 필요" · `warn` / `no` "제외 추천" · `mute` | `js/menu/discovery.js:10` |
| `toolset` | `draft` "초안" · `mute` / `running` "배포 중" · `ok` / `starting` "시작하는 중" · `info` / `stopped` "중지됨" · `mute` / `crashed` "비정상 종료" · `danger` | `js/menu/deploy.js:5,10` |
| `key` | `on` "사용 중" · `ok` / `off` "폐기됨" · `mute` | `js/menu/deploy.js:48` |
| 네트워크 태그(`netTagOf`) | `cap` "캡처" · `info` / `allow` "허용 (로그인)" · `flag` / `out` "범위 밖" · `mute` / `block` "차단" · `danger` / `ok` "검증" · `ok` / `stg` "스테이징 검증" · `ok` / `err` "검증 실패" · `danger` / `file` "파일 응답" · `warn` / `nf` "없음" · `warn` | `js/menu/discovery.js:7` |
- 서버가 내지 않는 값(로그 `wait` · `cache`, 원본 `busy`, 탐색 `queued`)은 목록에 두지 않는다 — 오면 모르는 값 폴백이 맡는다
- 배포 묶음 칩의 값은 초안이면 `draft`, 아니면 서버 상태(`runtime.state`)다 — 값을 고르는 것은 쓰는 곳이고, 버전은 칩 표기 틀(그 메뉴 `copy/`)이 붙인다(초안은 버전 없음). 서버가 초안에 주는 `none`은 목록에 두지 않는다(초안이면 `draft`로 찾는다)
- 액세스 키 상태는 서버의 켜짐 값(`on` 참 · 거짓)을 `on` · `off`로 바꿔 찾는다
- 네트워크 기록 태그는 `tone`에 `flag`(네트워크 기록 표식 — Colors ⑤)가 더해져 `statusOf`가 아니라 같은 폴백을 쓰는 `netTagOf(value)`로 찾는다 — `flag`가 상태 칩 · 점으로 새지 않게 따로 둔다
- 탐색 검증 칩은 상태 목록이 아니다 — 종류(`ok` · `file` · `404` · `err` · `stg` · `stgerr` · `block` · `out` · `none`)마다 서버 값(응답 코드 · ms)을 넣는 틀과 정해진 `tone`이고 틀은 그 메뉴의 `copy/`다. 모르는 종류는 값 그대로가 아니라 "미검증" · `mute`(값 없음 사유 문구 — 옛 `js/menu/discovery.js:172` 그대로)
- 같은 개념의 다른 이름(원본 "명세 변경 감지" · 도구 "명세 변경", 원본 "검토 필요" · 탐색 작업 "검토 대기")은 자리별 지금 이름 그대로다
- 칩 표기에 붙는 문구(버전 등)는 `copy/`의 틀이 만든다
- 쓰지 않는 말(`BANNED_WORDS`)은 지금 비어 있다 — 같은 개념의 여러 이름을 이식 기간에는 자리별 지금 이름 그대로 옮기기 때문이다

### 서식
숫자 · 날짜 서식은 `copy/`의 함수로 만든다 — 화면에서 `toLocale*` · `Intl`을 직접 부르지 않는다(`check-source`). 서버 시각(epoch 초)은 api 경계(훅의 `select`)에서 epoch ms로 한 번 바꾸고, 소요 시간은 ms 그대로다. 모양은 옛 출력 그대로다.

| 값 | 모양(옛 출력) |
|---|---|
| 수 | `ko-KR` 천 단위 쉼표 |
| 소요 시간 | `{n}ms` |
| 호출 로그 시각 | 오늘이면 `HH:mm:ss`, 아니면 `MM-DD HH:mm:ss` |
| 탐색 경과 | `m:ss` |
| 탐색 예약 시각 | `M월 D일 HH:mm 시작` |
| 배포 시작 시각 | `ko-KR` 두 자리 시 · 분 + "에 시작" |

- 탐색 경과 `m:ss` · 탐색 예약 시각 `M월 D일 HH:mm`은 자동 탐색 화면만 쓰므로 서식 함수를 그 메뉴의 `copy/discovery.ts`에 둔다

## 접근성

키보드로 닿기 · 포커스가 보이기는 이음 원본보다 앞서는 하한이다. 그 밖은 이음 그대로이고, 보이는 모습을 바꾸지 않는 ARIA 보강만 더한다.

- **포커스 링** — `base.css`의 전역 `:focus-visible` 하나다([핵심 규칙 12](#핵심-규칙)). `outline`을 `none` · `0`으로 지우지 않는다(예외 없음). 자리 · 색만 바꾼다
  - 입력 — 테두리 색 변화(`--primary`)에 링을 더한다
  - 표 행 · 목록 + 상세의 목록 항목 · 스크롤 상자 · 세그먼트 — 안쪽 링(`outline-offset` 음수). 고른 세그먼트는 주조색 필 위라 흰 링(`--on-fill`)을 한 칸 더 안쪽에 그린다. 입력을 품은 선택 카드(`RadioCard` `slot`)는 누르는 버튼 안쪽에 그린다 — 바깥 링은 카드 윗부분을 둘러 아래 입력 위를 가로지른다
  - 파일 드롭 · 검색 — 숨긴 입력을 감싼 상자에 링(`:focus-within`)
  - 파란 띠(LNB · 모달 머리 닫기) 위 — 흰 링(`--on-fill` — 띠 위 파란 링은 보이지 않는다). 스위치는 감싼 표시에 링
  - 어두운 고정 면(도크 · 토스트) 위 — 전역 링 그대로(`--primary` · 바깥). 색을 바꾸지 않는다
- **키보드** — 모든 컨트롤은 Tab으로 닿는다. 스크롤되는 기록 상자(탐색 네트워크 기록 · 배포 서버 로그 · 테스트 실행 대화 목록 · 코드 상자)는 `tabindex="0"` + 이름 + 안쪽 링. 동작이 없는 셸 버튼(레일 · 회사 칩 · GNB 아이콘 · 사용자)도 버튼 그대로 둔다. 벤 영역 클릭 필터는 같은 필터가 칩 버튼으로 닿으므로 보존한다
- **층** — `<dialog>.show()`로 연다. 포커스를 가두지 않는다(Tab이 층 밖으로 나간다). 가림막 클릭 · Esc(맨 위 층만)로 닫고, 쌓임 z는 부품이 준다. 모달을 닫으면 연 컨트롤로, 그 컨트롤이 사라졌으면 대체 자리(쓰는 곳이 준 곳 → 화면 제목 → 본문 — COMPONENTS 층 공통)로 포커스를 돌린다. Modal `dismissible=false`(키 결과 모달)는 가림막 · Esc로 닫히지 않는다. 모달의 첫 포커스는 본문의 첫 `input` → 확인 버튼(주색) → 머리 ✕ 순서다(COMPONENTS Modal). 메뉴를 옮기면 열린 층을 닫는다
- **사라지는 컨트롤** — 층이 아닌 자리(화면 · 도크)에서도 포커스가 있던 컨트롤이 사라지거나(누름 · 다시 그리기 · 덮어쓰기 · 폴링) 비활성(`disabled`)이 되면 포커스를 대체 자리로 옮긴다 — 쓰는 곳이 준 곳 → 화면 제목 → 본문 `<main>`(층 포커스 복귀와 같은 순서). 그 순간 포커스가 그 컨트롤 · 영역 안에 있었을 때만 옮기고, 다른 곳의 포커스는 빼앗지 않는다. `body`로 빠지게 두지 않는다. 요청 중 잠금(`pending`)은 포커스가 버튼에 남으므로 해당하지 않는다
  - 대체 순서를 코드로 가진 곳은 층 공통(`ui/layers/useLayerDialog.ts` — `@/ui`로 내보내지 않는다)뿐이다. 층 밖 자리는 화면이 자기 대체 자리(상세 머리 제목 `tabIndex=-1`)로 옮기는 훅을 화면 폴더에 둔다(`screens/deploy/useVanishedFocus.ts` · `studio/ToolDetail.tsx` · `playground/TracePanel.tsx` · `discovery/JobHead.tsx` — 동작이 바뀐 머리 버튼은 화면 제목으로). `Dock` · `Toast`는 포커스를 옮기지 않는다
- **ARIA 보강(보이는 차이 0)** — 선택 상태 `aria-pressed` · `aria-selected` · `tabpanel`(필터 칩 · 정책 버튼 · 모드 카드 · 묶음 선택 · 탭), 색 점의 시각 숨김 글자(구조도 원본 상태 점), 라벨 연결(`Field` id), 비활성 사유 `aria-describedby` + 시각 숨김(공개 스위치 · 필수 `*` · 탐색 결과 선택 상자 · 잠긴 탐색 영역 스위치), 차트 값 시각 숨김 표(대시보드 시간대 차트)
- **색만으로 뜻을 전하지 않는다** — 상태는 점 + 글자, 실패는 아이콘 + 문장 + 원문
- **바뀌어 나타나는 것** — 첫 로딩은 `aria-busy`(문구 없음)
- **모션** — 모션 줄이기면 `--m-*`가 0ms([Motion](#motion))
- **폭** — 760 이하에서 "1차 개발 범위" 버튼을 숨기는 것은 보존한다(마우스도 같음)

## 이식 기간

옛 콘솔(`apps/web/ieum`)과 이 앱이 나란히 있는 동안의 규칙이다. 옛 콘솔을 지우는 전환 때 이 절을 지우고, 보존 목록에 남은 행은 `## 미정`으로 옮긴다. 근거의 `js/…` · `css/…` · `index.html`은 `apps/web/ieum/` 아래 경로이고, 서버 사실의 `routers/…` · `gateway/…` · `runtime/…` · `repositories/…`는 `apps/backend/app/ieum/` 아래 경로다.

- **기준** — 메뉴는 옛 화면을 기준으로 옮긴다. 모습 · 동작 · 문구 · 호출(경로 · 본문 · 순서)이 같아야 하고 옛 문구는 다듬지 않는다. 옛과 다르게 하는 것은 아래 다섯 종류(고침 · 보존 · 유지 · 허용 차이 · 추가)뿐이다 — 옛에 없는 것을 요청으로 더하면 추가, 그 밖의 차이가 생기면 멈추고 보고한다
- **나란히 보기** — 같은 백엔드가 옛 콘솔을 `/ieum/`에서 서빙한다. 같은 백엔드 상태 · 같은 폭 · 같은 테마로 옛 콘솔과 새 개발 서버를 함께 본다
- **판정** — 옛 콘솔과 대조할 때 고침 행은 "옛과 다름"이 통과, 보존 · 유지 행은 "옛과 같음"이 통과, 허용 차이는 그 행에 적은 차이만 인정하고, 추가 행은 "옛에 없음"이 통과다

### 고침
옛과 다르게 고친 것이다 — 접근성 하한(키보드로 닿기 · 포커스 보이기 — 이음보다 앞서는 유일한 하한), 값 · 저장 결함, 가이드 패턴(층 · 요청 수명).

| 묶음 | 옛 동작 | 고친 모습 | 옛 근거 |
|---|---|---|---|
| 접근성 | 포커스 링을 지우거나 보이지 않는 자리(검색 입력 · 입력 포커스 · 표 행 · 설명 편집 · 투명 파일 입력 · 목록 스크롤 상자에 잘리는 목록 항목 · 넘침을 자르는 세그먼트 등) | 지우지 않는다 — 전역 링 하나에 자리 · 색만 바꾼다([핵심 규칙 12](#핵심-규칙)). 입력의 테두리 색 변화는 그대로 두고 링을 더하고, 투명 파일 입력은 감싼 상자에 링, 목록 항목 · 세그먼트는 안쪽 링 | `css/console.css:140,308,606,620,668,719,825` |
| 접근성 | 모달을 닫으면 포커스가 돌아가지 않는다(드로어만 되돌림) | 연 컨트롤로, 그 컨트롤이 사라졌으면(알림이 사라짐 · 행 삭제 · 마법사 완료 뒤 이동) 대체 자리로 돌린다 — 쓰는 곳이 준 곳, 없으면 화면 제목(`PageHead` h2), 그것도 없으면 본문 `<main>`. 포커스를 가두지는 않는다(이음 그대로) | `js/common/overlay.js:3-25` |
| 접근성 | 층이 아닌 자리에서도 누른 컨트롤이 사라지거나 잠기면 포커스가 `body`로 빠진다(스튜디오 저장 성공 뒤 저장 버튼 잠김 · 알림 띠 동작 뒤 띠 사라짐 · 탐색 마법사 앞 버튼이 조건 미충족으로 잠김 · 탐색 시작 뒤 화면 이동 · 테스트 실행 확인 상자의 "실행" · "그만두기" 뒤 상자 사라짐) | 대체 자리로 — 스튜디오는 상세 제목, 마법사는 단계 본문 첫 컨트롤, 테스트 실행 확인 상자는 변환 과정 제목, 화면 이동 뒤는 새 화면의 대체 자리(층 포커스 복귀와 같은 순서) | `js/menu/studio.js` · `js/menu/discovery.js` · `js/menu/playground.js:84,90,112` |
| 접근성 | 스테이징 주소 입력칸이 선택 버튼 안에 있다 | 입력칸을 버튼 밖으로(모양 그대로) | `js/menu/discovery.js:72` |
| 접근성 | 선택 상태가 클래스뿐이다(필터 칩 · 정책 버튼 · 모드 카드 · 묶음 선택 · 탭). 배포 탭은 `aria-selected`만 있고 패널이 없다 | `aria-pressed` · `aria-selected` · `tabpanel`(보이는 차이 0) | `js/menu/studio.js:73-116` · `js/menu/deploy.js:62,79` |
| 접근성 | 비활성 공개 스위치의 사유가 `title`에만 있고 필수 `*`(변환 스튜디오 매핑 · 테스트 실행 인자)에 대체 글이 없다 | `aria-describedby` + 시각 숨김(보이는 차이 0) | `js/menu/studio.js:79` · `js/menu/playground.js:31` |
| 접근성 | 탐색 네트워크 기록 · 배포 서버 로그 · 테스트 실행 대화 목록 스크롤 상자에 `tabindex`가 없다. 코드 상자는 `tabindex="0"`만 있고 이름 · 역할이 없으며 링이 바깥 2px다 | 스크롤 상자 모두 `tabindex="0"` + 이름(`role="region"`) + 안쪽 링([핵심 규칙 12](#핵심-규칙)) — 대화 목록 이름 "대화"는 새 낱말이다(`copy/playground.ts` `chat.logLabel` — 상자 제목 "도구 호출"과 겹치지 않게) | `js/menu/discovery.js:236,269` · `js/menu/deploy.js:167` · `js/menu/playground.js:52` · `js/common/convert.js:159` · `css/console.css:69` |
| 접근성 | 대시보드 시간대 차트 값이 마우스 `<title>` 툴팁에만 있다 | 24칸 값을 시각 숨김 표로(보이는 차이 0) | `js/menu/dashboard.js:38` |
| 접근성 | 변환 흐름 띠의 이름(`aria-label`)이 역할 없는 칸에 붙어 읽히지 않는다 | 이름 붙은 묶음(`role="group"`)으로(보이는 차이 0) | `js/menu/studio.js:85` |
| 결함 | 모르는 상태 값 · 파이프라인 허브의 모르는 규칙 키에서 예외로 렌더가 멈추고, 연결 방식 배지는 "undefined", 탐색 네트워크 기록의 모르는 태그는 "기록", 배포 묶음 칩의 모르는 서버 상태는 "중지됨"이 된다 | 모르는 값 폴백 하나 — 값 그대로 + mute 칩 + 경고 한 번([핵심 규칙 10](#핵심-규칙)). 값이 비어 오면(`null` — 서버는 늘 채운다) 글자 "null" 대신 값 없음 표기([핵심 규칙 6](#핵심-규칙) — `copy/status.ts`가 정한다). 허브 규칙 요약도 값 그대로 + 개수. 탐색 검증 칩의 모르는 종류만 "미검증"(값 없음 사유 — 옛 그대로) | `js/common/state.js:35,36` · `js/menu/studio.js:88` · `js/menu/discovery.js:172,198` · `js/menu/deploy.js:11` |
| 결함 | 도구가 가리키는 원본을 원본 목록에서 찾지 못하면 예외로 렌더가 멈춘다(대시보드 많이 쓰인 도구 · 확인이 필요한 항목, 호출 로그 표) | 멈추지 않는다 — 대시보드 순위 · 알림은 원본 id, 로그 표 · 상세는 `—`로 그린다. 서버가 `topTools`를 원본 있는 도구로 거르므로 거의 닿지 않는다 | `js/menu/dashboard.js:48,52,56` · `js/menu/logs.js:13` |
| 결함 | 서버가 내지 않는 상태 값 — 로그 `wait` · `cache`, 원본 `busy`의 라벨과 분기, 탐색 `queued`(라벨 없음) | `copy/status` 목록에서 뺀다 — 오면 모르는 값 폴백. 탐색 폴링 간격 판정에만 `queued`를 남긴다 | `js/menu/logs.js:3` · `js/common/state.js:20,26` · `js/menu/discovery.js:5,9,19` |
| 결함 | 부트 실패면 메뉴가 비고 `aria-busy`가 남는다 | 셸은 그리고 본문 자리에 실패 상자(머리는 옛 문장 그대로), `aria-busy` 해제, 재시도 버튼 없음 | `js/main.js:65-67` |
| 결함 | 명세 다시 읽기 실패를 무엇이든 그 원본의 로컬 `err`로 박아 "인증 만료"가 대시보드 · 목록 · 구조도로 번진다 | 로컬로 고치지 않고 실패 뒤 원본 조회를 다시 받는다(서버 값이 기준) | `js/menu/studio.js:175` |
| 결함 | 코드표 편집이 기존 항목의 라벨을 지우고 값을 모두 문자열로 바꾼다(저장 JSON이 바뀜) | 기존 항목의 라벨 · 타입을 지킨다 — 저장 상태 대조에서 승인된 차이 | `js/menu/studio.js:197` |
| 결함 | 로그 변환 시간이 없으면 `—ms` | `—`(단위 없음) | `js/menu/logs.js:13,41` |
| 결함 | 로그 상세 머리에 사용자가 없으면 ", 가 …" | 사용자 조각을 뺀다 | `js/menu/logs.js:35` |
| 결함 | 네트워크 실패면 브라우저 영문 원문(`Failed to fetch`)이 토스트 · 실패 상자에 나온다 | "서버에 연결하지 못했습니다."(원문은 개발 콘솔에만) — 새 낱말이다(`copy/errors.ts` `NETWORK_FAILED`) | `js/common/api.js:6` |
| 결함 | Safari에서 한글 조합을 확정하는 Enter가 `isComposing` 없이(조합 처리 키 `keyCode` 229로) 와서 금지어 · 대화 질문이 반쯤 된 글자로 들어간다 | 조합 처리 키도 조합 중으로 본다(`ui/lib/ime` — 층의 Esc 닫기도 같은 판정) | `js/main.js:56-57` |
| 결함 | 도크가 가운데를 왼쪽 50% + 옮기기로 잡아 폭이 화면 절반으로 줄고, 761~840px에서 버튼이 일찍 접힌다 | 좌우 0 + 자동 바깥 여백으로 가운데 — 폭은 내용 폭(최대 화면 폭 − 양옆 `--s-3`) | `css/console.css:223-224` |
| 결함 | 탐색 마법사 금지어 입력의 글자가 오른쪽 정렬이다 — 설정 줄의 숫자 칸 규칙이 같은 줄의 금지어 입력에도 번졌다 | 입력 칸 기본대로 왼쪽 정렬(`TagInput`) | `css/console.css:716` |
| 결함 | 탐색 마법사 설정 줄 안 선택 카드("검증하지 않음" 등)의 설명 글자가 흐리다 — 설정 줄 설명 규칙이 카드 설명 규칙을 덮었다 | 선택 카드 설명 색 그대로(`--text-muted` — 스튜디오 정책 카드와 같음) | `css/console.css:709,715` |
| 결함 | 도구 묶음 목록의 긴 묶음 이름 · 탐색 근거 소절의 파일:줄 보조 글이 좁은 폭에서 칸 밖으로 넘친다 | 아무 곳에서나 접는다 | `css/console.css:785-790,1047` |
| 결함 | 탐색 캡처의 강조 상자 좌표 기준이 최소 높이 300인 캡처 영역이라, 이미지가 300보다 낮은 좁은 폭에서 상자가 대상 아래로 내려간다 | 좌표 기준을 이미지(감싼 틀)로 | `css/console.css:966,973` |
| 결함 | AI로 다시 쓰기 결과가 응답이 온 때 보이는 도구의 설명 칸에 들어가고 그 도구가 저장 대상이 된다 — 요청 중 다른 도구로 옮기면 엉뚱한 도구가 바뀌고 요청한 도구는 그대로다 | 결과는 요청한 도구의 초안에만 쓴다 | `js/menu/studio.js:153-157` · `js/main.js:23` |
| 결함 | 배포 도구 표에서 원본을 찾지 못하는 도구 행이 있으면 예외로 화면이 멈춘다 | 그 칸을 값 없음 표기로 그린다 | `js/menu/deploy.js` 도구 표 |
| 결함 | 같은 도구 id가 여러 원본에 있으면(명세 다시 읽기의 id 충돌) 묶음 만들기 창은 줄마다 따로 체크하고, 수정 창은 같은 id 두 줄이 다 체크돼 저장 본문에 중복 id가 들어가 "도구 N개"가 부푼다 | 체크는 id 단위 — 같은 id 줄이 함께 체크되고 저장 본문에는 보이는 순서로 id마다 한 번. 이미 중복이 저장된 묶음의 도구 표 · 배포 확인 목록은 옛처럼 줄마다 그린다 | `js/menu/deploy.js:196,198` |
| 결함 | 테스트 실행 대화의 호출 칩이 높이 30 고정이라 긴 도구 이름이 알약 밖으로 넘친다 | 최소 높이 30 — 줄이 접히면 알약이 함께 자라고 긴 낱말은 아무 곳에서나 접는다(옛 `.presets .chip`이 이미 같은 꼴로 접었다) | `css/console.css:314,749` |
| 결함 | 탐색 실시간 "지금 하는 일" 줄이 좁은 폭에서 끝 글(경과 시간)까지 "경과" / "02:14" 두 줄로 쪼갠다 | 끝 글은 줄어들지 않고 오른쪽에 한 줄로 남는다(문장만 접힌다) | `css/console.css:948-951` |
| 결함 | 배포 서버 로그를 열면 80ms 뒤에 맨 아래로 내려 그 사이 맨 위가 보인다 | 상자가 보이는 순간 맨 아래(`CodeBlock` `followKey`) | `js/menu/deploy.js:169` |
| 결함 | HTTP 200이면 봉투(`resultCode` · `resultMsg`)가 아닌 JSON도 성공(데이터 없음)으로 받고, 비었거나 문자열이 아닌 `resultMsg`도 그대로 쓴다 | 봉투가 아니면 실패로 보고, 빈 · 문자열 아닌 `resultMsg`는 상태 문구로 대신한다 — 지금 `/api/ieum` 응답은 모두 봉투라 닿지 않는다 | `js/common/api.js:14` |
| 결함 | 화면을 그리다 예외가 나면 화면이 멈춘 채 남는다 | 라우트 오류 화면 — "화면을 표시하지 못했습니다." · "잠시 뒤 다시 시도하거나 대시보드로 돌아가 주세요." · "대시보드로 가기"(새 낱말 — `copy/shell.ts` `ROUTE_ERROR`). 화면 예외는 셸 안 본문 자리에, 셸 · 층(드로어 · 모달) 안의 예외는 셸 바깥 경계가 받아 셸까지 이 화면으로 바뀐다(옛은 층만 열리지 않았다) — 층 예외는 서버 데이터로 닿지 않는 입력이라 층에 경계를 따로 두지 않는다 | `js/main.js` `render` |
| 결함 | 스튜디오 변환 미리보기가 어긋난 입력에서 예외로 그리기를 멈춘다 — 경로 없는 도구에 원본 이름 파라미터가 있을 때(원본 요청), 겹친 응답 경로의 앞 값이 비어 있을 때(예: `a[]`가 `null`인데 `a[].b` — 원본 응답 · AI 결과) | 멈추지 않고 그린다 — 경로 없음은 요청 줄에 "undefined" 글자 그대로(옛도 파라미터가 없으면 같은 글자), 비어 있는 앞 값은 그대로 둔다. 미리보기 안에서 끝나는 입력이라 위 행의 라우트 오류 화면으로 가지 않는다. 서버 데이터로는 닿지 않는다 — 서버가 만드는 REST · 샘플 도구는 경로가 늘 있고(`gateway/spec.py`), 겹친 경로는 사용자가 AI 이름을 고친 조합에서만 생긴다 | `js/common/convert.js:33-35,67` |
| 결함 | 액세스 키 표의 키 · 발급일 · 마지막 사용이 비어 오면(`null`) 글자 "null"이 보인다 | 값 없음 표기([핵심 규칙 6](#핵심-규칙)) — 서버는 늘 채운다(`routers/deploy.py` 키 발급) | `js/menu/deploy.js:48` |
| 결함 | 테스트 실행 고르기 칸의 옵션에 `value`가 없어 브라우저가 앞뒤 · 겹친 공백을 다듬은 글을 값으로 보낸다 | 코드표 AI 값 · enum 원문 그대로 보낸다 — 지금 데이터에는 그런 값이 없다 | `js/menu/playground.js:28,118` |
| 가이드 패턴 | 묶음 수정 모달의 "삭제"가 확인 없이 바로 삭제한다(다른 파괴 동작은 모두 확인 모달) | 앱 안 확인 모달 뒤 삭제 — 수정 모달 자리에 연다(옛 모달 한 칸, 취소하면 닫힌다). 제목 "도구 묶음 삭제" · 본문 "**{이름}** 묶음을 삭제합니다. 이 주소로 연결한 AI는 더 쓸 수 없습니다." · 확인 "삭제" — 새 문구다(제목은 다른 삭제 확인의 꼴, 본문 뒷문장은 삭제 완료 토스트 그대로) | `js/menu/deploy.js:207,209-212` |
| 가이드 패턴 | 키 발급 결과 모달("지금 한 번만 보여 드립니다")이 Esc · 가림막으로 닫혀 키를 잃고, 확인 외로 닫으면 키 표를 다시 그리지 않는다. 닫힌 모달은 다음 모달이 덮을 때까지 키를 품고 남는다 | `dismissible=false` — ✕ · 확인으로만 닫힌다. 키 목록은 발급 성공 때 갱신. 닫으면 키를 비운다 — 닫힌 층에 남기지 않는다(닫힘 전환 동안 키 줄이 먼저 사라진다) | `js/common/overlay.js:15-25` · `js/menu/deploy.js:176-177` |
| 가이드 패턴 | 요청 중 층을 닫으면 요청은 이어지지만 결과 안내가 없다(연결 분석 · 배포 · 시작 · 중지 · 발급 · 폐기) | 완료 · 실패 토스트를 요청 쪽(훅)에 둔다 — 완료 문구는 그 동작의 지금 성공 토스트 | `js/menu/sources.js:112-121` · `js/common/overlay.js:12` |
| 가이드 패턴 | 탐색 결과 등록 뒤 3초 지연으로 두 번째 경고 토스트를 띄운다(타이머가 화면을 떠나도 돈다) | 토스트 하나로 합친다 — 로그인 방법을 모르면 첫 토스트 글 전체 + 공백 + 로그인 모름 문장을 경고 토스트 하나로(둘 다 지금 문구) | `js/menu/discovery.js:380-382` |
| 가이드 패턴 | 메뉴를 옮겨도 열린 드로어 · 모달이 남는다 | 메뉴가 바뀌면 열린 층을 모두 닫는다 | `js/menu/studio.js:147` |
| 가이드 패턴 | 요청 중 쓰기 버튼을 잠그는 곳이 일부뿐이다(배포 · 다시 쓰기 · 테스트 실행 "실행"만 — "실행"은 native 비활성이라 포커스를 잃었고, 대화 보내기는 잠그지 않았다) | 모든 쓰기에서 요청 중 잠근다(`Button` `pending` · `LinkButton` `pending` · `Modal` `confirmDisabled` — native `disabled`가 아니다). 잠긴 동안 포커스는 버튼에 남는다. 진행 중인 요청의 결과를 기다리는 다음 단계 버튼도 같다(옛은 그 자리를 다시 그려 포커스를 잃었다). 글자는 지금 바꾸는 곳만 바꾼다 | `js/main.js:42` · `js/menu/deploy.js:107` · `js/menu/studio.js:152` · `js/menu/playground.js:50,53` |
| 가이드 패턴 | 원본 목록 ↔ 탐색 작업 이동에도 늘 맨 위로 스크롤한다 | 첫 경로 조각이 바뀔 때만 맨 위로 | `js/main.js:15` |
| 가이드 패턴 | 탐색 시작 · 다시 탐색 · 결과 등록이 성공하면 다른 메뉴에 있는 사용자도 탐색 화면 · 스튜디오로 늘 끌고 간다 | 출발 화면 · 층에 아직 있을 때만 이동하고, 떠났으면 성공 토스트만. 탐색 시작은 같은 시도의 드로어가 열려 있을 때만 이동하고, 떠났고 "지금 바로" 시작이면 안내 없이 작업 표에만 나타난다(새 문구 없음) | `js/menu/discovery.js:107-114,369-383` |
| 가이드 패턴 | 서버 시작 실패가 배포 화면을 떠나도 오류 모달을 띄운다. 배포 실패는 확인 모달을 닫으면 닫힌 모달 안에만 남아 보이지 않는다 | 서버 시작 실패는 배포 화면에 있으면 오류 모달(지금), 떠났으면 경고 토스트. 배포 실패는 확인 모달이 열려 있으면 그 안 실패 상자(지금), 닫았으면 경고 토스트(요청 중 층 닫기 행과 같다). 토스트는 서버 문장의 줄바꿈을 지킨다 | `js/menu/deploy.js:114-121,156-159` |
| 가이드 패턴 | 배포 창이 저장 안 된 도구를 먼저 저장하다 실패하면 어느 도구에서 멈췄는지 보이지 않는다 | 배포 실패 안내 앞에 멈춘 도구 id를 인라인 코드로 붙인다(새 문구 없음) | `js/menu/deploy.js` 배포 창 |
| 가이드 패턴 | 명세 파일을 읽는 중 연결 마법사를 닫으면 다시 연 새 마법사에 그 파일이 들어가고 "<파일> 파일을 올렸습니다." 토스트가 뜬다 | 마법사를 닫으면 그 읽기를 버린다(층과 요청의 수명 — `app/sources/SourceWizard/useWizardSession.ts`) | `js/menu/sources.js:194` · `js/common/overlay.js:12` |

- **옮기지 않는 죽은 분기** — 탐색 강조 `block` 종류와 그 CSS(`js/menu/discovery.js:224` · `css/console.css:976`), 원본 도구 수의 `s.ext.total` 분기(`js/common/state.js:30`), 호출하는 곳이 없는 `persist` · `soon` · `dpol` · `WS.host`(`js/common/api.js:22,34` · `js/main.js:44` · `js/menu/deploy.js:186`), JS에서 쓰는 곳이 없는 토스트 동작 버튼 모양 `.toast .t-undo`(`css/console.css:426` — 토스트는 동작을 갖지 않는다, [미정](#미정))

### 보존 — 서버 사실과 다른 옛 문구 · 출력
아래 행은 옛 문구 · 출력 그대로 옮긴다 — 옛 콘솔과 문구 · 출력 대조 차이 0이 통과다(MCP 정의 미리보기도 서버 출력이 아니라 옛 화면 출력이 기준). 루트 규칙 "화면에 뜨는 숫자와 문구는 실제 데이터로 뒷받침"의 알려진 예외이고, 새로 만드는 문구 · 숫자에는 넓히지 않는다. 전환 뒤 별도 과제로, 서버가 근거 데이터를 내거나(백엔드 담당자에게 전달) 사용자가 새 문구를 승인하면 행마다 고치고 이 목록에서 지운다. "갱신 방향"은 처음 권고이고 그때 다시 정한다.

| 옛 문구 · 표시 | 옛 근거 | 서버 사실 | 갱신 방향 |
|---|---|---|---|
| MCP 정의 미리보기 — 실행 방식이 `confirm`이면 `_meta: {"ieum/approval": "user_confirm"}`를 붙이고, 설명 "AI 모델은 이 정의만 봅니다." | `js/common/convert.js:26` · `js/menu/studio.js:55` | 서버 정의는 `name` · `title` · `description` · `inputSchema` · `annotations`만 만든다(`gateway/runner.py:63-82`, 배포 `tools/list`도 같음) | 미리보기를 서버 출력과 같게(`_meta` 제거 · `destructiveHint` 반영). 서버가 미리보기용 정의를 내주면 그 값을 그린다 |
| 실행 방식 안내 — "쓰기 도구는 MCP 도구 정의에 확인 필요 표시가 붙어, 연결한 AI 앱이 사용자에게 먼저 묻습니다", 읽기 도구 "AI가 호출하기 전에 사용자에게 내용을 보여 줍니다" | `js/menu/deploy.js:91` · `js/menu/studio.js:105` | 배포 서버는 `confirm`을 강제하지 않고 정의에 표시도 없다(`runtime/protocol.py:97-101`). 확인 대기는 테스트 실행의 쓰기 도구에만 걸린다(`routers/playground.py:36,74`) | **가장 먼저** — 안전 안내다. 서버가 강제하게 되면 문구 보존, 아니면 서버 사실 문구로 |
| 응답 캐시 스위치 "같은 요청은 10분 동안 원본을 다시 부르지 않음"(공공데이터 원본이면 기본 켜짐) | `js/menu/studio.js:108` · `js/common/state.js:13` | `cache`는 저장만 하고 읽는 코드 · 10분 상수가 없다(`repositories/studio.py:55`) | 서버가 캐시를 구현하면 유지 시간을 서버 값으로, 아니면 "설정만 저장됩니다" 류(스위치는 남김) |
| "호출 샘플 12건으로 형식을 추론했습니다." | `js/menu/studio.js:65` | 호출 샘플 하나로 도구 하나를 만든다(`gateway/spec.py:324-381`) | 건수를 서버 값에서, 없으면 숫자 없이 "호출 샘플로 …" |
| "오늘 새벽 명세를 다시 읽으면서 감지했습니다." | `js/menu/studio.js:60` | 명세 변경은 사용자가 누른 "명세 다시 읽기"에서만 감지하고 감지 시각 필드가 없다(`routers/sources.py:182-203`) | 서버가 감지 시각을 주면 그 값, 아니면 문장 삭제 |
| "사용자당 호출 한도" · "1분 기준, 넘으면 AI에게 잠시 후 다시 시도하라고 알림" | `js/menu/studio.js:109` | 한도 단위는 액세스 키(`runtime/protocol.py:101`), 테스트 실행은 공용 한도(`routers/playground.py:39,77`) | "호출 한도(분당)" + "액세스 키마다" — 배포 문구(`js/menu/deploy.js:94`)와 같은 말로 |
| 마스킹 "전화번호, 이메일, 주민등록번호 일부를 가려서 전달" · "전화번호, 이메일 등을 가려서 전달" | `js/menu/studio.js:107` · `js/menu/deploy.js:92` | `mask` 규칙이 붙은 응답 필드만 가리고, 규칙은 필드 이름 패턴으로 추정한다(`gateway/engine.py:92-107` · `gateway/spec.py:11,117-118`) | "마스킹 규칙이 붙은 필드를 가려서 전달" 류(대시보드 허브 문구는 보존) |
| 변환 규칙 `geo` · `unit` · `md` · `filter` · `page` · `calc`의 라벨 · 툴팁이 동작을 설명한다 | `js/common/rules.js:8-18` | 엔진에 처리가 없거나 건너뛴다(`gateway/engine.py:226`) | 엔진이 구현되면 보존, 아니면 툴팁 끝에 "아직 적용되지 않음" |
| "처음 띄울 때는 10초 가까이 걸릴 수 있습니다." | `js/menu/deploy.js:108` | 시작 대기는 최대 40초다(`runtime/supervisor.py:31`) | 서버 상수를 받아 표시하거나 "수십 초" |
| 1차 개발 범위 모달 · 원본 화면 2차 안내에 자동 탐색이 없다 | `js/main.js:30-38` · `js/menu/sources.js:38` | 자동 탐색이 구현돼 마법사에서 열린다(`routers/discovery.py`) | 사업 범위 문서라 담당자가 정한다 |
| "키마다 연결할 도구 묶음과 사용 대상을 따로 제한할 수 있습니다." | `js/menu/deploy.js:172` | 서버는 `toolsets` 제한만 지원하고 화면에 입력이 없으며 `audience`는 저장만 한다(`runtime/protocol.py:64` · `routers/deploy.py:39`) | 제한 입력이 생기면 보존, 아니면 문장 삭제 |
| 원본 `err` 라벨 "인증 만료" · 대시보드 알림 "… 다시 인증해 주세요." | `js/common/state.js:26` · `js/menu/dashboard.js:51` | `err`는 명세 다시 읽기의 실패 전반(주소 · HTTP 오류 포함)에서 켜진다(`routers/sources.py:197-198`) | 서버가 원인을 주면 원인별 라벨, 아니면 "연결 문제" 류 |
| "AI로 다시 쓰기" 버튼이 늘 보인다 | `js/menu/studio.js:96` | 서버에 API 키가 없으면 400 문장을 준다(`routers/studio.py:44`). 같은 사실이 `chatEnabled`다 | `chatEnabled`로 숨길지 검토(지금은 실패 토스트가 이유를 말한다) |
| "이 서버는 이 컴퓨터(127.0.0.1)에서만 열려 있습니다." · 주소가 없을 때 `http://127.0.0.1:<포트>/mcp` | `js/menu/deploy.js:29,32` | 바인드 · 접속 호스트는 `IEUM_MCP_HOST`로 바뀐다(`runtime/supervisor.py:86-96`) | 문장의 호스트를 `runtime.url`에서 |
| 원본 검색 자리표시 "시스템 이름으로 검색" | `js/menu/sources.js:25` | 실제 검색 대상은 이름 + 설명이다(`js/menu/sources.js:4-5`) | "시스템 이름이나 설명으로 검색" |
| 범위 밖(`ev='out'`) API에도 근거 드로어 푸터 "근거가 한 가지라 검토가 필요합니다" | `js/menu/discovery.js:354` | `out`은 근거 수가 아니라 범위 밖 판정이다(`js/menu/discovery.js:167,332`) | `out`이면 푸터 안내를 비운다 |
| 근거 조회 실패는 무엇이든 "탐색 기록이 삭제되어 근거를 볼 수 없습니다." | `js/menu/discovery.js:365` | 네트워크 · 5xx 실패도 같은 문장이 된다 | 404만 이 문장, 그 외는 원문 |
| 대시보드 허브 "AI 호출 형식 4종 변환" | `js/menu/dashboard.js:25` | 모델 수는 테스트 실행 조회의 `models` 길이다(지금 4 = 4) | 숫자를 모델 목록 길이에서 센다 |
| 탐색 안전 설명 "…로그인 요청만 예외로 보냅니다." · "그 경로의 POST 만 운영에 실제로 보냅니다." | `js/menu/discovery.js:65,68` | 크롤러의 쓰기 차단이 실패하면 열린 채로 둔다(범위 밖 백엔드 결함) | 담당자에게 전달하고, 결함이 확인되면 문구에 단서 |
| 명세 다시 읽기 요청 중 버튼 글자가 그대로다(잠금은 고침 — 요청 중 `pending`) | `js/menu/studio.js:168-170` | 서버 문제가 아니라 새 문구 승인 대기 | 요청 중 버튼 글자 "읽는 중…" |
| 연결 분석의 다섯 단계 목록 · 진행 막대가 0.5초 뒤부터 0.7초마다 한 칸씩 오른다(가짜 진행) | `js/menu/sources.js:45,76,112-116` | `POST /sources/connect/`는 한 번에 응답하고 단계 신호가 없다(`routers/sources.py:105-130`) | 서버가 단계 진행을 주면 그 값, 아니면 회전 표시 + 정해지지 않은 막대 |
| 테스트 실행 머리 설명 "AI 모델에게 질문해 도구 호출부터 원본 응답 변환까지 단계별로 확인합니다." — 서버에 대화 키가 없어도 같다 | `js/common/state.js:56` | 키가 없으면 대화가 닫히고 도구 직접 호출만 된다(`chatEnabled` — `routers/playground.py:22,48`) | `chatEnabled`가 false면 직접 호출을 말하는 설명으로(새 문구 승인) |

검토하고 옛 그대로 둔 것(갱신 대상이 아니다 — "옛과 같음"이 통과):
- 대시보드 빈 상태의 시연 원본 안내를 늘 보인다(`js/menu/dashboard.js:61`) — 표시 조건 · 문구 그대로, 주소만 백엔드 주소로 쓴다(새 개발 서버의 `location.origin`은 백엔드가 아니다)
- 확인 모달의 첫 포커스는 입력칸이 없으면 확인 버튼(주색)이다 — "삭제" · "폐기" · "중지"도 같다(`js/common/overlay.js:23`)
- 동작 없는 레일 아이콘 · 회사 칩 · 사용자 표시도 버튼 그대로 둔다 — 포커스를 받는다(`index.html:14-32`)
- 760 이하에서 "1차 개발 범위" 버튼을 숨긴다(`css/console.css:889`) — 마우스도 같아 하한 항목이 아니다
- 탐색 결과 벤 영역 클릭 필터는 키보드로 닿지 않는다 — 같은 필터가 칩 버튼으로 닿는다(`js/menu/discovery.js:292-294,313`)
- 탐색 중단 · 예약 취소는 확인 없이 바로 보낸다 — 같은 설정으로 다시 탐색할 수 있다(`js/menu/discovery.js:254,395`)
- 서버가 박아 둔 "방금"(원본 `sync` · 묶음 `updated`)은 시간이 지나도 받은 그대로 그린다(`routers/sources.py:124,202` · `routers/deploy.py:54,98`)
- 탐색 예약 시각은 브라우저 시간대로 표시한다(`js/menu/discovery.js:13`) — 서버를 다른 시간대로 옮기면 어긋난다
- 변환 과정 1단계 제목 `${label}가 도구를 골랐습니다`(`js/common/convert.js:169`) — 라벨이 받침으로 끝나게 바뀌면 그때 조사를 처리한다
- 키 이름 "새 액세스 키" · 묶음 사용 대상 "전 직원" 기본값을 화면에도 둔다(`js/menu/deploy.js:173,194`) — 서버 기본값과 같다
- 로그 표 사용자 칸은 사용자가 없으면 빈 칸이다(`js/menu/logs.js:13`) — 값 없음 규칙의 `—`로 바꾸지 않고 옛 그대로 둔다
- 입력 파라미터 매핑 보조 글 "보라색 규칙은 AI에게 보이지 않습니다"는 표에 보라색 표시가 없지만 옛 문구 그대로 둔다(`js/menu/studio.js:98`) — 서버 사실이 아니라 화면 표시의 어긋남이라 보존 목록에 두지 않는다
- 탐색 결과 필터 · 선택은 주소에 두지 않는다 — 작업을 열 때마다 "전체"이고 새로고침도 같다(`js/menu/discovery.js:120`). 같은 칩 · 벤 영역을 다시 누르면 전체로 돌아간다(`js/menu/discovery.js:398`)
- 탐색 네트워크 기록의 메서드 칸(42)에서 `DELETE`가 넘친다(`css/console.css:985`) — 옛도 같다
- 테스트 실행 확인 대기의 "실행"은 확인 상자에 보인 인자가 아니라 지금 폼 값 · 지금 고른 모델로 다시 보낸다 — 둘이 다를 수 있다. "그만두기"는 요청 없이 정보 토스트다(`js/menu/playground.js:82-86,111-112`)
- 테스트 실행 결과가 와도 변환 과정 칸으로 스크롤하지 않고 읽어 주지도 않는다(`js/menu/playground.js:90`)

### 유지 — 가이드 규칙과 다르지만 이음 그대로
옛 콘솔과는 같고 가이드의 일반 관례와만 다른 것이다. 옛과 대조하면 "같음"이고, ui-review는 위반으로 잡지 않는다.

- **반복 · 등장 모션** — 흐름 `flow` · 깜빡임 `blink` · 등장 `stepIn` · 회전 `spin` · 맥박 `hlp`와 층 · 버튼 · 스위치 전환을 그대로 둔다(반복 모션을 금지하는 관례와 다름). 진행 · 흐름 · 대기를 알리는 표시다. 모션 줄이기는 옛 전역 규칙(`css/console.css:70`)을 `base.css`로 옮기고 `--m-*`를 0ms로 다시 정의한다(`--toast-duration` 제외). JS 부드러운 스크롤(`js/menu/studio.js:149`)도 모션 줄이기를 따른다 — 켠 사용자에게만 즉시 스크롤로 바뀐다
- **흰 포커스 링** — 파란 띠 위 링은 흰색이다. LNB 메뉴는 흰 링 · 안쪽(`css/console.css:498`), 스위치는 감싼 표시에 링(`css/console.css:375`)이고, 모달 머리 닫기 버튼에도 같은 흰 링을 쓴다. 띠 위 파란 링은 대비가 1.12:1이라 보이지 않는다
- **`aria-modal`이 있는데 포커스를 가두지 않는 층** — 모달 · 드로어는 `role="dialog" aria-modal="true"`를 옛 마크업(`index.html:43` · `:45`) 그대로 두고, `<dialog>.show()`로 열어 포커스를 가두지 않는다(`aria-modal`이면 포커스를 가두는 것이 관례와 다름). 닫으면 연 컨트롤로 돌아간다([핵심 규칙 12](#핵심-규칙))

### 허용 차이 — 구현 방식에서 생기는 차이
승인 없이 받아들이는 차이다. 옛과 대조할 때 그 행에 적은 차이만 인정한다.

| 묶음 | 차이 | 옛 근거 |
|---|---|---|
| 값 정규화 | 토큰 단계로 묶으며 생긴 값 차이 — 라이트 표 머리 `#f5f6f8` → `#f6f7f9`(보조 면과 합침), 간격(CSS · 인라인) ±1px(일부 행 높이 ±2px), 금지어 칩 · 입력 26 → 28px, 테두리 있는 태그(`.p2` · `.ntag.mute` · `.evb.off` · 관찰 값 칩 `.codes span`)는 테두리를 높이 안에 넣어 2px 남짓 낮게(같은 크기 태그와 같은 높이 — `.pr.sample`은 옛도 그렇게 맞췄다. 관찰 값 칩 22.25 → 20px · 반지름 4 → 3px), 반지름 4 · 5 · 7px ±1px, 글자 10.5 · 14.5 · 18px → 이웃 단계, 행간 다섯 값 줄당 ±0.7px 이하 · 대시보드 KPI 수치 행간 1.3 → `--lh-tight` 1.35(수치 한 줄 26px 33.8 → 35.1px · 1500 이하 23px 29.9 → 31.05px), 구조도 허브 목록 글자 흰 .92 → `--on-fill-soft` .9, 스위치 전환 150 → 120ms, 아이콘 ±1~2px · 선 두께 → 2.4, 비활성 투명도 .45 · .55 → .5, 추정 · 새 필드 태그 17 → 18px · 도구 목록 안 쓰기 태그 16 → 18px(태그 `sm`, 글자 10.5 → 11px), 정책 줄 · 한 줄 상태 줄 위아래 11 → 10px, 목록 항목 안쪽 13 · 15 → 12 · 14px · 줄 사이 3 → 4px(항목 높이 1 ~ 3.5px 낮게), 파이프라인 칸 줄 사이 3 → 4px, 작은 표 칸 위아래 9 → 8px, 세그먼트 · 설명 편집 반지름 4 → 3px, 메서드 표식 좌우 5 → 4px. 이 값 차이로 좁은 폭에서 줄바꿈 자리가 한 줄 바뀌는 것도 포함한다(390 — 배포 서버 멈춤 알림: 버튼 아이콘 13 → 14px로 버튼이 1px 넓어짐 `js/menu/deploy.js:22-28`, 테스트 실행 변환 과정 단계 머리: 제목 14.5 → 15px로 옆 도구 이름이 다음 줄 `css/console.css:757-758`) | `css/console.css` |
| 부품 모양 | 같은 모양을 부품 하나로 맞추며 생긴 작은 차이 — 목록 상자 머리의 제목과 수 사이 최소 간격 `--s-2`(옛 0 — 좁아 붙을 때만 보인다), 금지어 칩의 긴 단어는 칩 안 말줄임 + `title` 툴팁(옛은 칩 밖으로 넘쳤다), 선택 상자는 모든 변형에서 손가락 커서(옛은 툴바 필터 · 작은 선택만), 파이프라인 허브 요약 칩이 0개면 칩 줄을 그리지 않아 760 이하에서 허브가 9px 남짓 낮다(옛은 빈 칩 줄이 위 여백을 차지했다) | `css/console.css:116,316,399,663,924-928` |
| 렌더 | 토스트 · 모달 본문이 HTML을 해석하던 것이 텍스트 렌더가 된다. 의도된 마크업은 `<b>` 강조뿐이라 강조가 필요한 문구는 `copy/` 틀에서 요소로 만든다 | `js/common/overlay.js:20,30` |
| 렌더 | 전체 다시 그리기로 생기던 포커스 소실 · 클릭 씹힘이 부분 갱신으로 없어진다. 금지어 칩을 빼면 포커스가 입력칸으로 간다. 테스트 실행 대화의 쓰다 만 질문이 모델 · 도구를 바꿔도 남고, 대화 목록은 다시 그리기마다가 아니라 말풍선이 바뀔 때만 맨 아래로 내려간다. 배포의 묶음 선택 · 스니펫 탭 · 서버 상태 바뀜 · 서버 로그 "새로 읽기"에서도 포커스가 누른 자리에 남는다 | `js/menu/discovery.js:160,405` · `js/menu/studio.js:149,213` · `js/menu/playground.js:67,109,117` · `js/menu/deploy.js:134,139-140,168` |
| 렌더 | 탐색 기록 줄 모션 — 네트워크 기록 · Git 파일 줄의 등장 모션은 새 줄에만 돈다(옛은 700ms마다 마지막 줄) | `js/menu/discovery.js:196,205` · `css/console.css:986,1010` |
| 렌더 | 진행 막대 폭 전환 — 원본 연결 분석 진행 막대가 `--m-progress` 폭 전환으로 칸을 따라간다. 옛도 `transition: width .4s`를 적었지만 진행마다 드로어를 통째로 다시 그려 막대가 새로 생겨 전환이 보이지 않았다(막대가 칸 경계에 바로 섰다) | `css/console.css:848` · `js/menu/sources.js:110` |
| 렌더 | 쓰기 뒤에도 스크롤 상자의 위치가 남는다 — 옛은 쓰기 뒤 전체 다시 그리기로 표 · 도구 목록 · 매핑 표 · 코드 상자 · 대화 목록 스크롤 상자가 처음(맨 위 · 맨 왼쪽)으로 돌아갔다(예: 원본 다시 인증 · 삭제, 스튜디오 검토 완료, 액세스 키 폐기 — 좁은 폭에서 행 버튼을 누르려 민 표가 그대로 남는다). 스크롤을 따로 정한 자리(서버 로그 맨 아래 등)는 그 규칙대로 | `css/console.css:599,620,676,724,739` · `js/menu/sources.js:138,147` · `js/menu/studio.js:157` · `js/menu/deploy.js:181` |
| 렌더 | 단계 ✓ · 칩 ✓/✕ · 방향 ▲ ▼ 같은 글리프 자리를 `Icon`(닫기 · 완료 · 방향)으로 그린다 | 옛 글리프 자리 전부 |
| 렌더 | 표 칸 안 읽기/쓰기 표지(`ModeTag` — 배포 포함된 도구 · 탐색 결과 표)가 바탕 높이 20px로 그려진다. 옛 `.md-tag`는 글줄 안 span이라 줄 높이 20px을 적고도 바탕이 글자 높이(16px)만 칠해졌다 — 같은 표지가 flex 안(스튜디오 상세 머리)에선 옛도 20px. 행 높이는 같다 | `css/console.css:523` · `js/menu/deploy.js:87` · `js/menu/discovery.js:285` |
| 렌더 | 다른 메뉴로 가는 컨트롤(LNB 메뉴 · 메뉴로 가는 링크 버튼 — 스튜디오 빈 상태 "원본 시스템" · 대시보드 "호출 로그 보기" 등)이 `<button>`이 아니라 링크(`<a href>`)다 — Enter로 이동하고 Space로는 이동하지 않으며 새 탭으로 열 수 있다. 링크는 `body` 자간을 물려받으므로 LNB 메뉴는 `--tracking-control`로 옛 버튼 자간(`normal`)을 지켜 폭을 같게 둔다. 누르면 그 메뉴를 다시 받는 옛 동작은 링크 `onClick`이 그대로 하고, 다른 메뉴로 가는 링크에서도 부른다. LNB는 사용자가 확인한 결정이고, 메뉴로 가는 링크 버튼은 같은 갈래로 넓힌 것이다 | `js/main.js:8,29` · `css/console.css:494` · `js/menu/studio.js:120` · `js/menu/dashboard.js:47` |
| 층 | 확인 버튼이 없는 안내 모달의 첫 포커스가 머리 ✕다(`show()`가 포커스를 옮긴다 — 옛은 옮기지 않았다). 사용자가 확인한 결정이다 | `js/common/overlay.js:23` |
| 데이터 | 부팅 일괄 조회 대신 원본 · 도구 · 테스트 실행 자료는 처음 필요한 화면이 한 번 받고 쓰기 응답으로만 고친다 — 고치면 그 자료를 그리는 화면이 바로 바뀐다(테스트 실행을 보는 중 원본 연결이 끝나면 도구 선택 목록이 곧바로 바뀌고 대화 · 인자 · 고른 도구는 그대로 — 옛은 연결 성공 때 그 화면을 다시 그리지 않아 다음 그리기까지 옛 목록). 대시보드 · 호출 로그 · 탐색 개요는 메뉴에 들어올 때마다 받고, 같은 메뉴를 다시 누르면 다시 받는다. 도구 묶음은 배포 화면에 들어올 때마다 받고 같은 메뉴를 다시 누르면 다시 받으며 4초마다 다시 받고(옛과 같음) 원본 삭제 · 배포 쓰기 뒤 한 번 더 받는다. 액세스 키는 배포 화면에 들어올 때마다 받고 발급 · 폐기 뒤 한 번 더 받는다(메뉴를 다시 눌러도 받지 않는다 — 옛 nav도 묶음만) — 옛은 부팅 때 한 번 받고 메모리만 고쳐, 화면을 열어 둔 사이와 다시 들어왔을 때 "마지막 사용"이 그대로였다. 상세(로그 한 건 · 탐색 작업 · 근거)는 열 때마다 받는다 | `js/common/api.js:24-37` · `js/main.js:29` · `js/menu/sources.js:119` · `js/menu/deploy.js:45-50,132-135,174-181` |
| 데이터 | 스튜디오의 저장 안 된 변경이 다른 메뉴(대시보드 · 배포 · 테스트 실행)의 공개 수 · 목록에 먼저 번지던 것 — 서버 값과 초안을 나누고, 어느 메뉴가 초안을 보는지는 그 메뉴의 체크리스트가 정한다 | `js/main.js:23` |
| 데이터 | 탐색 스크린샷 주소에 순번 `?v=`를 붙인다 | `js/menu/discovery.js:219` |
| 데이터 | 스튜디오 저장 중 편집 — 저장 중 고친 내용은 초안으로 남고 저장 버튼이 다시 켜진다(옛은 표시 없이 저장되지 않음) | `js/menu/studio.js:164-165` |
| 데이터 | 스튜디오 저장 본문 — 호출 수를 싣지 않는다. 화면이 들고 있던 호출 수로 서버 값을 덮지 않는다(요청 본문 차이 허용) | `js/menu/studio.js:165` |
| 데이터 | 스튜디오 즉시 갱신 — 띠 숫자 · 원본 요청 · 응답 변환 탭이 입력 중에도 바로 바뀐다(옛은 상세를 다시 그릴 때만) | `js/menu/studio.js:182,199,213` |
| 데이터 | 탐색 폴링 — 작업 폴링은 그 화면에 있을 때만 돌고(옛 타이머는 화면을 떠나도 돌았다), 탭이 숨으면 멈추고 돌아오면 이어 받는다(배포 화면과 같음) | `js/menu/discovery.js:150-164` |
| 데이터 | 탐색 작업 열기 — 주소가 먼저 바뀌고 본문을 비운 채 받는다 · 열기 실패는 화면 실패 상자 · 캡처 이미지 오류는 자리 문구 · 실시간 상자 머리(브라우저 · 저장소 · 프레임워크)가 진행 중에 나타난다 | `js/menu/discovery.js:140-149,214,235-248,388` |
| 데이터 | 스튜디오에서 연 근거 — 늘 작업 이벤트를 끝 번호 뒤로 한 번 받는다(옛은 메모리에 있으면 바로) | `js/menu/discovery.js:357-359` |
| 데이터 | 배포 폴링 — 바뀐 필드가 다음 폴링에 바로 보인다(옛은 서명(`id:status:ver:state:port:pid`)이 바뀔 때만 다시 그려 다른 탭의 이름 · 대상 변경이 다음 진입까지 안 보였다) | `js/menu/deploy.js` 폴링 |
| 첫 로딩 · 실패 | 첫 로딩(화면에 들어올 때 받기로 새로 생긴 순간 포함)은 본문 · 상자를 비우고 `aria-busy`만 둔다 — 옛 부트와 같은 모양이고 새 문구가 없다 | `js/main.js:65-66` |
| 첫 로딩 · 실패 | 첫 로딩 중에도 레일 · GNB · LNB가 보이고 누를 수 있다(옛은 부트가 끝나야 메뉴 줄을 채웠다). 화면의 조회는 원본 목록 응답 뒤에 시작한다(옛은 부트에서 8건을 한꺼번에 받았다) | `index.html:37` · `js/main.js:8,66` · `js/common/api.js:24-28` |
| 첫 로딩 · 실패 | 화면 안 영역의 첫 조회 실패는 그 상자 안 실패 상자(원문만 · 머리 없음 · warn)이고, 새로 받기 · 폴링 실패는 표시 없이 이전 값이다 — 옛은 부분 실패를 무시하거나 앱 전체 실패로 보였다 | `js/common/api.js:38` |
| 라우터 | 화면 이동 때 늘 맨 위로 스크롤하던 것이 첫 경로 조각이 바뀔 때만이 된다 | `js/main.js:15` |
| 라우터 | 마지막 메뉴를 `localStorage`(`ieum.view`)로 되살리던 것이 없어진다 — 주소가 화면을 정하고 새로고침은 같은 주소를 연다. 좁은 폭의 LNB는 처음 열 때도 현재 메뉴가 보이게 줄을 옮겨 둔다(옛은 메뉴를 옮길 때만 옮겨, 되살린 메뉴가 메뉴 줄 밖에 남을 수 있었다) | `js/main.js:11,15` · `js/common/state.js:50` |
| 라우터 | LNB가 메뉴별 마지막 주소(필터 · 선택 포함)로 간다 — 옛은 화면 상태 객체로 같은 결과였다. 새로고침하면 마지막 주소를 비운다 | `js/main.js:29` |
| 라우터 | 없는 id 주소 — 스튜디오 · 테스트 실행 · 배포는 첫 항목으로 보정(주소 `replace`), 탐색 작업은 없음 상태. 스튜디오 · 배포의 처음 선택도 같은 규칙 — 옛은 시드 id를 하드코딩했고(스튜디오 원본 `hr` · 도구 `get_vacation_balance`, 배포 묶음 id) 새는 시드 id를 코드에 두지 않는다. `/studio`는 도구가 있는 첫 원본의 첫 도구, `/deploy`는 첫 묶음 주소로 바뀐다. 드로어를 여는 검색 파라미터(호출 로그 `?log=`)는 경고 토스트 뒤 파라미터를 뺀다(`replace`) — 모양이 틀린 id는 요청 없이 `NOT_FOUND`(`copy/errors.ts` — 서버 404와 같은 글), 모양이 맞으면 상세를 받고 실패하면 서버 문장(`screens/logs/useLogDrawer.ts`) | `js/common/state.js:44` · `js/menu/studio.js:121-123` · `js/menu/playground.js:37` · `js/menu/deploy.js:8` · `js/main.js:6` · `js/menu/logs.js:31` |
| 라우터 | 도구가 0개인 원본으로 이동하면 `/studio?src=<id>` 빈 상태(옛은 예외로 멈췄다) | — |
| 라우터 | 화면 안 선택은 히스토리 `replace`, "다시 탐색"은 `push`(옛에는 브라우저 히스토리가 없다) | — |
| 접근성 | 보이지 않는 ARIA 보강 — 선택 상태 · 색 점의 시각 숨김 글자(구조도 원본 상태 점) · 라벨 연결(폼 라벨 `for` — 라벨을 누르면 입력에 포커스 · 라디오 · 체크 묶음 이름) · 현재 단계(`aria-current="step"`) · 비활성 사유. 보이는 차이 0이고 스크린리더 출력만 는다 | `js/menu/dashboard.js:19` · `js/menu/sources.js:57,60,103` · `js/menu/deploy.js:196` |

### 추가 — 옛에 없는 것을 요청으로 더한 것
옛 콘솔에 없는 화면 · 칸 · 값 · 변형 · 문구를 사용자(요청자)가 요청해 더한 것이다.

- **시작** — 요청 출처가 있어야 한다. 화면 파일 머리 요구 메모에 출처를 적고(`new-screen` `## 1`), 요청 없이 만들지 않는다. 부품 · 변형이면 그 자리는 부품 파일 머리 주석과 COMPONENTS 그 절이다 — 이 절의 "화면 파일 머리"(출처 · `// 확인 필요`)가 모두 그렇다
- **기록** — 아래 표에 행을 둔다. 행은 가이드 쪽이 더하고 화면 쪽은 요청한다. 구현은 행보다 먼저 해도 되지만 행 없이 병합하지 않는다. `요청` 칸은 요청자 · 요청한 자리이고 날짜는 쓰지 않는다
- **모양 · 동작** — 가장 가까운 이음 화면 · 부품 그대로다(정렬 · 선택 뒤 스크롤 · 새로 받기 · 폴링 · 여백). 따른 자리를 행에 적는다. 요청에 없는 결정은 아래 기본값을 쓰고 화면 파일 머리에 `// 확인 필요: 기본값 — …`로 남긴다 — 기본값을 따른 결정은 추측이 아니다. 아래에 없는 결정도 가장 가까운 이음 화면 · 부품을 따랐으면 기본값이다 — `// 확인 필요: 기본값 — <따른 자리>`로 남긴다
  - **목록 화면의 꼴** — 행끼리 숫자를 견주는 목록은 표 + 드로어(`Table` + `Drawer` — 호출 로그), 하나씩 골라 자세히 보거나 고치는 목록은 목록 + 상세(`SplitLayout` `list`)다([용어집](#용어집))
  - **목록 + 상세의 동작** — 배포 꼴이다: 고르면 주소 `replace` · 없는 id는 첫 항목 · 1100 이하에서도 상세로 스크롤하지 않고 목록 상자(`Panel`)도 스크롤하지 않는다(`screens/deploy/ToolsetList.tsx`). 스튜디오의 상세 스크롤 · 목록 스크롤은 그 화면 것이다
  - **기존 표에 칸 하나** — 자리는 같은 종류 값 칸 옆(상태 · 동작 칸 앞)이고 모든 행에 그린다(값이 없으면 값 없음 표기). 단위는 그 표 이웃 수치 칸을 따르고 없으면 붙이지 않는다. 글자 크기는 표 기본(수치 칸의 색 · 굵기는 Colors ① 표 수치). 표 `minWidth` · 받는 때 · `?mock`은 그대로 둔다. 다섯 폭 중 한 곳에서라도 넘치면 — 그 표에 가로 스크롤이 새로 생기거나 칸 글이 새로 접히면(둘 다 상자 안에서 스크롤한다. `Table`은 칸이 기본 한 줄이라 대개 스크롤로, `CompactTable`은 본문 칸이 먼저 접혀 드러난다) — `minWidth`를 그 부품의 지금 값 중 다음 값으로 올린다. 가장 큰 값으로도 넘치면 `design-change`
  - **새 표** — `minWidth` · 칸 너비는 같은 부품에서 가장 가까운 이음 표의 값이다. 같은 그릇(화면 본문 · 상세 열 · 드로어) → 같은 칸 종류 구성(읽기 전용 · 누르는 행 · 동작 칸 · 선택 칸 · 칸 안 입력) → 칸 수 순서로 고른다(값마다 쓰는 표는 COMPONENTS `Table` · `CompactTable` `minWidth`). 그 값들 밖이 필요하면 `design-change`. 단위 · 서식은 [Copy](#copy) `서식` 표다
  - **새 하위 화면의 자리** — 부모 메뉴 · 주소 · 화면 id는 `new-screen` `## 2` IA 자리 · `## 6` 등록
  - **새 하위 화면으로 가는 링크** — 부모 화면 상자 머리(`Box` `actions`)의 `LinkButton`이다(대시보드 "호출 로그 보기" 꼴 — `screens/dashboard/RankBox.tsx`). 부모에 상자가 없으면 화면 머리(`PageHead` `actions`)의 `LinkButton`이다. 주소는 앱 층 도우미로 만든다(COMPONENTS `LinkButton` `to`). 하위 화면은 새로 그려져 자기 훅대로 받으므로 `refreshMenu`를 부르지 않는다 — 메뉴로 가는 링크(뒤로 · 빈 상태 문장 안 메뉴 이름)만 부른다
  - **드로어 검색 파라미터의 없는 id** — 호출 로그 꼴(위 허용 차이 라우터 "없는 id 주소")
  - **백엔드 계약을 기다리는 동안** — `new-screen` `## 4`
- **문구** — 같은 개념의 지금 `copy/` 낱말을 다시 쓴다. 지금 낱말이 여럿이면 같은 종류의 자리(표 머리는 표 머리, 버튼은 버튼)의 낱말이다. 다시 쓰기는 그 상수를 import하는 것이고 다른 메뉴 copy여도 된다(`screens/playground/ArgForm.tsx` → `copy/studio` `params.required`) — 확인이 필요 없다. 같은 종류의 자리에 그 개념의 낱말이 없으면 다른 자리의 지금 낱말 중 가장 짧은 것을 그대로 쓰고 `// 확인 필요`로 남긴다 — 새 낱말을 만들지 않는다. 기간을 표 제목에 맡긴 낱말(대시보드 시간대 차트 표 머리 "호출")은 그 표 제목이 기간을 말할 때만 쓴다. 새 낱말만 행에 적고, 그 메뉴 copy 파일의 상수 주석에 "새 문구: …"(꼴을 가져온 자리)를 단다(`copy/deploy.ts` `deleteConfirm` 꼴). 새 낱말은 사용자 확인 대상이다
- **판정** — 나란히 보기에서 "옛에 없음 — 추가 행"이면 통과다. 그 밖의 차이는 위 네 종류로 가린다

| 무엇 | 요청 | 모양 · 동작을 따른 이음 자리 | 새 낱말 |
|---|---|---|---|
| 아직 행 없음 | | | |

## 용어집

- **이음 원본 · 옛 콘솔** — `apps/web/ieum`의 바닐라 JS 콘솔. 모습 · 동작 · 문구의 기준이다
- **연결 흐름 세 쪽** — AI(클라이언트 · 모델) ↔ 이음(변환 · 도구 = MCP) ↔ 원본 시스템. 색 ④의 뜻이다
- **원본 시스템** — 이음이 부르는 사내 시스템(REST · SOAP · 공공데이터 · 호출 샘플 · 자동 탐색으로 연결)
- **도구 · 도구 묶음** — 원본 API 하나를 AI가 부를 수 있게 바꾼 것 / 배포 단위로 묶은 도구들(MCP 서버 하나)
- **허브** — 연결 흐름 가운데의 이음 카드(대시보드 구조도 · 스튜디오 파이프라인)
- **화면** — 대시보드 `/` · 원본 시스템 `/sources` · API 자동 탐색 `/sources/discovery/:jobId` · 변환 스튜디오 `/studio` · 테스트 실행 `/playground` · AI 연결 배포 `/deploy` · 호출 로그 `/logs` · 컴포넌트 카탈로그 `/_guide`(셸 밖). 이름은 `copy/shell.ts`, 경로는 `app/nav.ts`
- **목록 + 상세 · 표 + 드로어** — 왼쪽 목록에서 하나를 골라 오른쪽에 그 상세를 늘 보이는 배치(`SplitLayout` `list` — 스튜디오 · 배포) / 표 행을 누르면 드로어로 여는 상세(`Table` + `Drawer` — 호출 로그). 이 문서와 COMPONENTS의 "목록 + 상세"는 앞의 것만 가리킨다
- **셸** — 레일(왼쪽 어두운 아이콘 줄) · GNB(위 흰 줄 — 로고 · 회사 · 알림) · LNB(파란 띠 메뉴) · 본문
- **층** — 본문 위에 떠서 열고 닫는 것(모달 · 드로어 · 도크 · 토스트)과 그 가림막
- **도크** — 여러 항목을 고르면 아래에 떠오르는 일괄 작업 줄
- **변환 과정 · 트레이스** — 도구 호출이 원본 요청 · 응답으로 바뀌는 단계 표시
- **표지** — 뜻이 하나뿐인 색 표시(근거 · 규칙 분류 · 네트워크 표식 · 프로토콜 · 코드). 색 ⑤
- **단계** — 토큰의 크기 이름(간격 `--s-*` · 높이 `xs`~`xl` · 아이콘 `xs`~`empty`). 같은 이름이면 같은 값이다
- **파생 치수** — 다른 치수에서 따라 나오는 px(테두리 계산 · 한 변 = 다른 변 등). 끄는 주석과 사유로만 쓴다
- **부품 CSS · 화면 CSS** — `src/ui/**` · `src/app/shell/**`의 `.module.css` / `src/screens/**`(`_guide` 제외)의 `.module.css`. 화면 CSS는 `@media` · `font`를 쓰지 않고 글자 값은 축 토큰만 쓴다

## 미정

값을 아직 정하지 않은 것과, 없는 토큰 · 변형의 제안. 제안은 여기에 행을 더하고 사용자에게 묻는다.

| 항목 | 지금 | 제안 |
|---|---|---|
| 폰트 파일 | `index.html`이 Google Fonts에서 Noto Sans KR 400 · 500 · 700, JetBrains Mono 400 · 500 · 600을 불러온다(옛 콘솔과 같음) | 사내망 · 오프라인 배포가 필요하면 woff2 파일을 앱에 넣을지(새 의존성 없이 `public/`) — 사용자 결정 |
| 서버 사실과 다른 옛 문구 갱신 | [이식 기간](#이식-기간) 보존 목록의 옛 문구 · 표시를 지금 그대로 옮긴다(옛 콘솔과 문구 · 출력 대조 기준) | 전환 뒤 별도 과제 — 서버가 근거 데이터를 내거나 사용자가 새 문구를 승인하면 행마다 고치고 목록에서 지운다 |
| 토스트 동작 버튼 | 두지 않는다 — 누를 것이 있는 결과 알림은 화면 안 `Notice`(`action`)다(COMPONENTS `Toast`). 옛 `.toast .t-undo`는 쓰이지 않는 모양이다(`css/console.css:426` — [이식 기간](#이식-기간) 죽은 분기) | 필요해지면 사용자 확인 뒤 `design-change`로 이 규칙부터 바꾼다. 그때 정할 것: 모양(옛 `.t-undo` · 굵기) · 표시 시간 멈춤과 다시 셀 때 · 키보드로 닿을 시간(동작 토스트만 긴 표시 시간 · 저절로 닫지 않음 · 바로 가는 키 중 — 그릇은 DOM에서 셸 · 층 호스트 뒤다, `app/RootLayout.tsx`) · 읽히는 영역(`role="status"`)과 버튼의 관계 · 닫힌 동안 버튼 숨김 · 버튼이 사라질 때(누름 · 덮어쓰기) 포커스 대체 자리의 주인(`Toast` 부품 / 쓰는 곳) · 누름 순서 · 덮어쓸 때 앞 동작 · 경고 토스트 제외를 막는 방법 · 호출 모양(`app/toast.ts`는 화면 쪽 파일 — 요청) |
| 상세 열 안 수치 요약 | 부품이 없다 — `StatStrip`(화면 머리 아래) · `KeyValueGrid`(드로어 안) 모두 상세 열은 쓰는 곳 밖이다(COMPONENTS 각 절) | 처음 요청이 오면 `design-change`로 정한다. 그 전에는 `new-screen` `## 2`대로 그 자리를 비워 두거나 지금 쓰는 곳 안의 부품 조합만 쓴다 |
| LNB 새 최상위 메뉴 | 메뉴 여섯(`TOP_NAV`). 메뉴 줄에 남는 폭은 1024에서 130px · 1280에서 386px이다 — 지금 메뉴 하나는 87~119px이고, 1024에서 일곱째 메뉴는 이름이 한글 일곱 자(메뉴 폭 129px)까지 들어가고 여덟 자부터 줄이 넘친다(넘치면 스크롤바 없이 잘린다 — COMPONENTS `셸` 접근성) | 사용자 확인 뒤 가이드 쪽이 더한다. 그 전에는 기존 메뉴의 하위 주소다(`new-screen` `## 2`) |
| 쓰이지 않는 토큰 다시 세기(메뉴 이식 뒤) | 정한 토큰을 처음에 모두 두었다 — 부품 · 화면이 아직 없어 대부분 쓰이지 않는다. 도크 보조 · 위험 버튼(`--inverse-danger` · `--inverse-danger-line` · `--inverse-danger-hover` · `--on-fill-line-hover`)은 쓰는 화면이 없어 `DockButton`에 옮기지 않았다 | 마지막 메뉴(자동 탐색)를 옮긴 뒤 `var(--*)` 사용을 세어 쓰이지 않는 토큰을 지우거나 쓰일 자리를 적는다 |
