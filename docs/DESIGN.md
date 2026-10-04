---
version: 1.0-draft
name: MCP-Studio-디자인-시스템
description: "MCP-Studio 디자인 시스템. 무채색 회색 위에 액센트 1색과 상태 2계열만 쓰고, 색은 지금 선택한 것과 손봐야 할 것에만 나타난다. 완료는 무채색이다. Pretendard 단일 패밀리, 웨이트 3단, 자간 0. 데스크톱 기준 1280, 1024까지 축소 대응."
source_of_truth: "규칙 = 이 문서 · 컴포넌트 계약 = COMPONENTS.md · 값 = apps/web/src/styles/tokens.css"
platform: web            # Electron은 platform 구현만 교체
mode: operate
color_strategy: restrained
---

# Design System: MCP-Studio

> **적용 범위.** 토큰 · 규칙은 모든 화면에 하나로 적용한다. 지금 화면(LNB 셸 · 대시보드 · 프로젝트 상세 · 준비 중 자리)은 이 규칙을 보여 주는 [샘플 IA](#용어집)다 — 언제든 바뀌고, 규칙의 예외도 원본도 아니다.
> 이 문서는 규칙(언제 무엇을 쓰는지)을 둔다 — 컴포넌트 계약 · 값의 자리는 front matter `source_of_truth`. 토큰은 CSS 변수 이름으로만 부르고 값을 다시 적지 않는다. 표제는 영문, 본문은 한국어. 낯선 말은 [용어집](#용어집). 절차 · 점검표는 스킬(`.claude/skills/`) — 새 화면 `new-screen` · 토큰 · 컴포넌트(새로 만들기 포함) · 변형 · 화면 틀 · 규칙 바꾸기 `design-change` · 마치기 전 검수 `ui-review`.

## Overview

MCP-Studio는 사내 데이터 소스를 연결하고, 가공하고, 커넥터로 발행하는 운영 도구다. 화면의 내용은 사용자의 데이터이므로 크롬은 무채색으로 물러난다. 색은 지금 선택한 것과 손봐야 할 것에만 나타난다([핵심 규칙 2](#핵심-규칙)).

## 핵심 규칙

새 화면 · 컴포넌트에서 반드시 지킨다. 세부는 각 절에 있다.

| # | 규칙 | 왜 | 막는 수단 |
|---|---|---|---|
| 1 | 스타일 값은 `tokens.css`의 CSS 변수만. `.module.css`에 hex · rgb · 임의 px 금지 — 예외는 [리터럴 px 예외 주석](#리터럴-px-예외-주석) | 값이 한 곳에 있어야 바꿀 때 한 번에 바뀐다 | stylelint(색 · px · 변수 · 예외 주석) · `lint:docs`(문서의 토큰 이름) · ui-review #1 |
| 2 | 색은 두 뜻에만 — 현재 선택(`--accent*`)과 손봐야 할 것(`--fix-*` 할 일이 있다 · `--progress-*` 시간이 지나면 바뀐다). 완료 · 평상시는 무채색이다. 주 액션은 `--ink` 필이고 액센트를 버튼 필에 쓰지 않는다 | 색이 드물어야 색이 붙은 것이 눈에 띈다 | ui-review #2 · #3 |
| 3 | 상태 색(`--fix-*` · `--progress-*`)은 [Status](#status)의 쓰는 곳 목록에만. 칩 안에 점을 넣지 않는다 | 상태 색이 다른 뜻에 섞이면 색만 보고 상태를 읽을 수 없다 | ui-review #3 |
| 4 | 그림자는 `--shadow-modal` · `--shadow-panel` · `--shadow-popover` 셋뿐. 카드 · 표에는 쓰지 않는다 | 그림자는 떠 있는 층의 표시다. 카드에 쓰면 층과 구분되지 않는다 | stylelint `declaration-property-value-disallowed-list`(box-shadow) · ui-review #4 |
| 5 | 웨이트는 400 · 500 · 600만. 600은 14px 이상. 자간 0 — 예외는 `--tracking-label-mono`(모노 그룹 라벨) 하나 | 작은 글자의 굵은 웨이트는 뭉개지고, 단계가 적어야 위계가 읽힌다 | stylelint `declaration-property-value-disallowed-list`(font-weight) · 화면 CSS 글자 속성 금지 · ui-review #5 |
| 6 | 값이 없는 자리에 `—`를 쓰지 않고 사유를 적는다 | 기호는 왜 비었는지 · 무엇을 하면 되는지 말하지 않는다 | eslint `no-restricted-syntax`(값 없음 표기) · ui-review #6 |
| 7 | 빈 상태는 `EmptyState` `kind` 세 종 중 하나([빈 상태](#빈-상태)) | 같은 상황이 화면마다 같은 모양이어야 사용자가 바로 읽는다 | `pnpm typecheck`(`kind` 타입) · ui-review #7 |
| 8 | 실패는 `ErrorBlock` — 원문 그대로 · 복사. 자리는 [실패 블록 자리](#실패) | 요약한 문장으로는 원인을 찾을 수 없고, 원문을 복사해야 문의할 수 있다 | ui-review #8 |
| 9 | 화면 문장은 `copy/`의 code별 틀에서 만든다. 서버 문장을 그대로 렌더하지 않는다(실패 원문만 예외) | 같은 상황이 화면마다 같은 말이 되고, 문구를 한 곳에서 고친다 | eslint `no-restricted-syntax`(화면 한글 리터럴 · 서식 직접 호출) · ui-review #9 |
| 10 | 상태 값은 [Copy](#copy) 상태 값 목록만 쓰고, Copy `쓰지 않는 말`을 쓰지 않는다 | 같은 상태가 자원마다 다른 말이면 사용자는 다른 상태로 읽는다 | eslint `no-restricted-syntax`(금지어) · ui-review #10 |
| 11 | 1280과 1024 폭에서 잘림 · 겹침이 없다 | 두 폭이 지원하는 창 크기의 양 끝이다 | ui-review #11 · 브라우저 1280 · 1024 확인 |
| 12 | 모든 컨트롤은 키보드로 닿고 `:focus-visible` 링이 보인다. 링은 `base.css`의 전역 규칙 하나다 — 예외는 [접근성](#접근성) 포커스 | 링이 하나여야 포커스 위치가 바로 보이고, 컴포넌트가 outline을 덮으면 링이 사라진다 | eslint `jsx-a11y` · stylelint `declaration-property-value-disallowed-list`(outline 지우기) · ui-review #12 |

## Colors

회색 · 액센트 · 상태는 아래 역할 토큰만 쓴다. 새 색은 만들지 않는다 — 필요하면 `## 미정`에 제안한다.

### Gray scale
| 토큰 | 뜻 | 쓰는 곳 |
|---|---|---|
| `--canvas-outer` | 프레임 밖 바탕 | 앱 프레임 밖 |
| `--canvas` | 기본 바탕 | 본문 · 카드 · 층 |
| `--surface-faint` | 가장 옅은 면 | 빈 상태 상자 · 첨부 영역 · 카드 호버 |
| `--surface-subtle` | 옅은 면 | 요약 행 · 읽기 전용 입력 · 행 호버 |
| `--surface-soft` | 보조 면 | LNB · 보조 버튼 |
| `--surface-track` | 트랙 면 | SegmentedControl 바탕 · 보조 버튼 눌림 — 데이터 막대의 빈 구간은 `--data-empty` |
| `--field` | 기계값 면 | 로그 · 실패 원문 |
| `--hairline-soft` | 옅은 선 | 행 구분선 · 카드 안 구분선 · `--surface-soft` 면 위 hover(IconButton `filled` · LNB) |
| `--hairline` | 기본 선 | 컨테이너 · 입력 테두리 · 완료 알림 카드 왼쪽 선 |
| `--data-empty` | 데이터 없음 | 막대 · 게이지의 빈 구간과 호출 없음 — SegmentBar · MetricCard · ProgressBar([Data](#data-차트--세그먼트-막대)) |
| `--scrollbar` | 스크롤바 | 스크롤바 |

### Neutral — 글자 · 아이콘
| 토큰 | 뜻 | 쓰는 곳 |
|---|---|---|
| `--ink` | 가장 진한 글자 | 제목 · 주 액션 필 · 포커스 링 |
| `--ink-soft` | 본문 글자 | 본문 · 표 셀 |
| `--muted` | 보조 글자 | 보조 · 라벨 · 표 헤더 |
| `--faint` | 흐린 글자 — 흰 바탕 대비가 낮아 **정보를 나르지 않는다** | 준비 중 항목 · 비활성 버튼 글자(Button `primary` · `secondary` · `outline`) · 데이터 막대 구간(범례 글자 · 수가 뜻을 나를 때만) |
| `--placeholder` | 자리표시자 글자 — 정보를 나르지 않는다(대비는 [접근성](#접근성)) | 모든 input · textarea의 `::placeholder`(`base.css` 전역) · Select 고른 값 없음 글자 — 컴포넌트 · 화면이 다른 색을 주지 않는다 |
| `--disabled` | 비활성 | 비활성 글자 · 테두리 · 비활성 + 선택된 체크 상자 · 스위치 필 |
| `--disabled-fill` | 비활성 필 | 비활성 주 버튼 필 · 비활성 체크 상자 · 스위치 바탕 |
| `--icon` | 아이콘 기본 | 아이콘 |
| `--illust` | 삽화 선 | 삽화 |
| `--on-ink` | 먹색 · 액센트 · 상태 필 위 글자 | 주 액션 글자 · 알림 수 점 글자 · 선택 표시 체크(TypeCard) |

### Accent
**현재 선택에만** — LNB 현재 화면 · 선택된 타입 카드 · 활성 탭 · 화면 안 이동 링크. 버튼 필은 [핵심 규칙 2](#핵심-규칙).

| 토큰 | 뜻 | 쓰는 곳 |
|---|---|---|
| `--accent` | 현재 선택 | 선택 표시 · 활성 탭 · 링크 |
| `--accent-soft` | 선택 면 | 선택된 행 · 카드 · 목록 항목 배경 |
| `--accent-line` | 선택 테두리 | 선택된 카드 테두리 |
| `--accent-ink` | 진한 액센트 글자 | 링크 호버 |

### Status
상태 색은 손봐야 할 것에만 쓰고 계열은 둘이다 — `--fix-*`(할 일이 있다) · `--progress-*`(시간이 지나면 바뀐다), 쓰는 곳은 아래 목록뿐. 끝났거나 할 일이 없는 상태는 중립 `--idle-*`이고 StatusChip(완료 · 중립 칩)에만 쓴다 — 다른 자리의 회색은 회색 역할 토큰. 계층을 고르는 기준과 라벨은 [Copy](#copy) 상태 값.

| 접미사 | 뜻 | 쓰는 곳 |
|---|---|---|
| `-fg` | 진한 색 | 칩 글자 · 문구 · 위험 액션 글자 · 막대 채움 · 알림 수 점 · 알림 카드 왼쪽 선 |
| `-bg` | 칩 바탕 | 칩 기본 바탕 · 위험 버튼 호버 |
| `-soft` | 옅은 바탕 | 표 안 칩 · 알림 카드 · 확인 줄 |
| `-border` | 테두리 | 칩 · 위험 버튼 · 확인 줄. `--fix-border-strong`은 위험 버튼 호버, `--idle-soft-border`는 표 안 중립 칩 |
| `-body` | 카드 본문 글자 | 알림 카드 본문(`--progress-body` · `--fix-body`) |

- 상태 색(`--fix-*` · `--progress-*`)을 쓰는 곳은 아래뿐이다
  - 칩(StatusChip) · 알림 카드(Notice `risk` · `warn`, `going`은 왼쪽 선만) · 알림 수 점(CountDot)
  - 검증 — 문구(InlineMessage `--fix-fg` — 검증 · 실행 거부) · 입력 테두리(Input · Textarea · Select) · 확인 줄(InlineConfirm)
  - 위험 액션 — Button `danger` · RowMenu 항목 `tone: 'danger'`의 적색 글자 · 윤곽. 채우지 않는다(`나가기` · `연결 해제`)
  - 수치 · 데이터 — 요약 수치의 손봐야 할 값(MetricCard `valueTone` · SummaryCard `fix`) · 데이터 막대([Data](#data-차트--세그먼트-막대))
- 알림 카드 tone — 막혔으면 `risk`(`--fix-*`) · 할 일이 있지만 막히지 않았거나 곧 손봐야 하면 `warn`(`--progress-*`) · 진행 중이면 `going`(왼쪽 선만) · 끝났으면 `done`(중립) · 그 밖 안내는 `info`(중립). 칩 tier와 알림 tone은 일대일이 아니다
- **완료는 평상시 상태라 무채색이다** — 칩은 `--idle-*`(StatusChip `tier="done"`), 알림 카드는 왼쪽 선 `--hairline`(Notice `done`), 막대 구간은 `--ink-soft`(SegmentBar · MetricCard `tone="ink-soft"` — 쌓은 막대 예외는 [Data](#data-차트--세그먼트-막대))
- 비율 지표의 `fix` 톤(SummaryCard `fix`)은 제품이 문턱을 정한 경우만 쓴다 — 문턱이 없으면 색 없음. 증감(`delta`)에는 색을 쓰지 않는다
- Tag는 중립색이다 — 자원 종류를 색으로 나누지 않는다. 상태를 보이는 표식은 `StatusChip`

### Data (차트 · 세그먼트 막대)
손봐야 할 것 2계열(`--fix-fg` · `--progress-fg`) + 중립 단계(`--ink` · `--ink-soft` · `--muted` · `--faint`) + `--data-empty` 조합. 정상 몫(호출됨 · 사용 중 · 도달 가능 등)은 `--ink-soft`(쌓은 막대에서 손봐야 할 몫이 묻히면 `--faint` — 아래), 종류 구분 · 미발행은 `--muted` · `--faint`다. `--ink` 구간은 MetricCard에만 있다(관문 통과 카드의 통과 몫). MetricCard 목표 표시는 `--fix-fg`. 히트맵은 `--ink`를 밀도 %만큼 투명과 섞는다(`color-mix`). 전용 데이터 팔레트는 두지 않는다.
- 축 · 범례 · 수 — 눈금 글자 `--t-caption` `--muted`, 눈금 · 격자 선 `--hairline-soft`. 축 제목은 따로 그리지 않고 영역 머리 `note`에 적는다. 범례는 계열이 둘 이상일 때만 두고 점 + 글자로, 글자만 읽어도 뜻이 통한다. 수는 `tabular-nums`, 서식은 [Copy](#copy) `숫자 · 단위 서식` · `시각 서식`
- 그리기 — 차트는 라이브러리 없이 CSS · SVG로 그린다. 몸체는 `role="img"` + 요약 `aria-label`(copy). 두 화면이 쓰면 `ui/`로 올린다(design-change)
- 쌓은 막대 — 정상 몫을 아래, 손봐야 할 몫을 위에 쌓는다. 0이 아닌 몫은 최소 3px. 손봐야 할 몫이 짙은 정상 몫에 묻히면(작은 실패율 · 막대가 많은 추이) 정상 몫을 `--faint`로 그린다
- 데이터 없음 — 영역 전체가 0이면 막대 · 축 대신 EmptyState([빈 상태](#빈-상태)), 일부 구간만 비면 그 구간을 `--data-empty`로 그린다

## Typography

글꼴은 `--font-sans`(Pretendard, `apps/web/src/styles/fonts`에 자체 호스팅)와 `--font-mono` 둘이다. 웨이트 · 자간은 [핵심 규칙 5](#핵심-규칙) — 아래 표는 큰 글자부터이고 `--t-prose`까지가 14px 이상이라 600은 이 행들에서만. all-caps를 쓰지 않는다. line-height는 글자 토큰에 든 값만 쓴다 — 높이가 고정된 버튼(Button · 컴포넌트 안 버튼)만 상자 높이와 같게 준다.
- 기계값(경로 · 식별자 · 키 · URL · 로그 · 로그 시각 · SQL)은 `--font-mono`(입력은 Input `mono`). 화면 수치(순위 · 개수 · 호출 수)는 `tabular-nums`로 자리를 맞추고 mono로 바꾸지 않는다(표 열은 Table `numeric`). 컴포넌트 안 수(SectionHead `count` · CountDot · StepList 번호 등)는 그 컴포넌트 절이 정한다
- 한글은 어절 단위로 줄을 바꾼다 — `base.css` 전역 `word-break: keep-all` + `overflow-wrap: break-word`(줄보다 긴 낱말만 넘칠 때 접힌다). `anywhere`는 최소 폭을 한 글자로 낮춰 줄어드는 flex 항목 · auto 열에서 한글을 글자마다 끊으므로 기계값 표면(KeyValue `mono` · LogView · ErrorBlock 원문)만 쓴다. 그 밖의 컴포넌트 · 화면은 `word-break` · `overflow-wrap`을 덮지 않는다

| 토큰 | 뜻 | 쓰는 곳 |
|---|---|---|
| `--t-h1` | 화면 제목 — 가장 큰 글자 | PageHeader 제목 |
| `--t-h2` | 층 제목 | 확인 다이얼로그 · 열람 모달(`info`) 제목 · 흐름 단계 제목(FlowStepHead) |
| `--t-section` | 영역 제목 — 화면 안 영역 제목은 이것 하나 | 열 머리 · 영역 머리(SectionHead) · 모달 · 흐름 머리 제목 |
| `--t-figure` | 수치 강조 — `tabular-nums`와 함께 쓴다 | 요약 카드 · 지표 카드 값 |
| `--t-item` | 목록 항목 | 목록 항목 |
| `--t-body` | 본문 | 본문 · 표 두 줄 셀 |
| `--t-body-strong` | 본문 강조 | 알림 패널 · LNB 패널 머리 · RowCard 제목 |
| `--t-prose` | 산문 — 넓은 행간 | 안내 · 빈 상태 · 실패 설명 |
| `--t-ui` | UI 기본 — 가장 많이 쓰는 크기 | 표 셀 · 입력 · 메뉴 항목 · 체크 상자 라벨 |
| `--t-ui-strong` | UI 강조 | 버튼 · 탭 · 칸 라벨 · 표 헤더 · 설정 행 제목 |
| `--t-label` | 라벨 | 보조 · 라벨 · 검증 문구 |
| `--t-caption` | 보조 줄 | 표 두 줄 셀 `sub` · RowCard 2행 · 메타 · 사유 줄 |
| `--t-mono` | 기계값 | 로그 · 원문 · 식별자 |
| `--t-chip` | 칩 | 상태 칩 · 표식 |

## Layout

- 기준 폭 1280(`--viewport-base`). **1024(`--viewport-min`)까지 축소 대응**한다 — 1280 · 1024는 기준 폭의 이름이고 토큰 값의 재기재가 아니다. 그 아래는 가로 스크롤. 두 폭의 잘림 · 겹침 기준은 [핵심 규칙 11](#핵심-규칙). 1024에서 LNB는 자동으로 접히고, 펼치면 본문 위에 떠 있는 패널이 된다. 화면 틀별 1024 동작은 [화면 틀](#화면-틀) 표의 `1024`, 컴포넌트별은 COMPONENTS 그 절(`1024:` · `층`)
- 앱 셸 = LNB + 본문이고 프레임 내부만 스크롤한다. LNB 폭은 토큰이 아니다(`LNB_WIDTH` — COMPONENTS `LNB`)
- 프레임 바깥 여백은 앱 루트가 `--page-top` · `--page-x` · `--page-bottom`으로 주고, 1024에서는 `--page-top-narrow` · `--page-x-narrow` · `--page-bottom-narrow`(gap 스케일 밖)
- 간격(gap) 스케일은 `--s-*` — 작은 것부터 `--s-0-5` · `--s-1` · `--s-1-5` · `--s-2` · `--s-2-5` · `--s-3` · `--s-3-5` · `--s-4` · `--s-5` · `--s-6` · `--s-8`. 새 컴포넌트 · 변형의 여백은 이 스케일에서 고르고(새 카드 · 패널 안쪽은 `--s-4`, 촘촘하면 `--s-3`), 이미 있는 컴포넌트 안쪽 여백의 원본은 그 `*.module.css`다 — 화면이 덮지 않는다

### 본문 여백 · 세로 리듬
화면 `<main>` 안쪽. AppShell은 여백을 주지 않는다. 아래 토큰은 레이아웃 컴포넌트가 주고 화면 CSS는 쓰지 않는다([화면 틀](#화면-틀) 공통) — `--w-field`만 화면 안 폼이 쓴다([폼](#폼)). 영역 안 간격은 gap 스케일에서 고르고, 영역 머리(`SectionHead`) → 내용은 화면 · 층 어디서나 `--s-2-5`다 — 머리와 내용을 `Region`으로 감싸면 Region이 준다(층 안 영역도 `Region` · `RegionList`는 스스로 준다 · 폼 섹션은 [폼](#폼)). 테두리 · 안쪽 여백이 있는 카드 · 패널 안의 머리는 그 상자 안쪽 간격을 따른다. 화면 CSS는 이 간격을 쓰지 않는다.

| 토큰 | 뜻 | 쓰는 곳 |
|---|---|---|
| `--body-top` · `--body-x` · `--body-bottom` | 본문 여백. 1024 좌우는 `--body-x-narrow` | `PageBody` |
| `--gap-section` | 세로로 쌓인 영역 사이 | `PageBody` · `Stack` |
| `--gap-column` | 나란한 두 열 사이. 1024는 `--gap-column-narrow` | `PageColumns` |
| `--w-aside` | 보조 열 폭(1024에서도 그대로) | `PageColumns variant="aside"` |
| `--w-field` | 폼 칸(Field) 최대 폭 — 모달 · 화면이 같은 값, 칸마다 | `ModalPanel` · 화면 안 폼 CSS([폼](#폼)) |

### 컨트롤 높이 단계
Button · IconButton · Input · Select는 같은 단계를 쓴다 — **같은 이름이면 같은 높이**다. 크기는 쓰는 자리 이름이 아니라 이 단계 이름으로 고르고, 한 줄에 나란한 컨트롤은 같은 단계를 쓴다. 단계는 표 위에서 아래로 높아지고, 쓰는 곳(새 화면 기본 역할)은 이 표가 원본이다. 단계에 없는 높이가 필요하면 만들지 말고 `## 미정`에 제안한다. 컴포넌트별로 가진 단계 · 기본값은 COMPONENTS 각 절 `size`(Button · IconButton · Input · Select · SegmentedControl).

| 토큰 | 뜻 | 쓰는 곳 |
|---|---|---|
| `--h-sm` | 단계 `sm` | 표 행 · 툴바 · 카드 안 액션. 표 안 선택(Select `sm`) |
| `--h-sm-plus` | 단계 `sm-plus` | 영역 머리 도구(SectionHead — 필터 SegmentedControl · 검색 · 추가) |
| `--h-md` | 단계 `md` | 폼 · 모달 · 다이얼로그 발 · 빈 상태 액션 — Button 기본 |
| `--h-lg` | 단계 `lg` | 단계 흐름 발 · `Field` 밖 한 줄 선택(다이얼로그 안 Select 등) · 그 자리 편집(입력 + 저장 · 취소) — Select 기본 |
| `--h-xl` | 단계 `xl` | 폼 칸(`Field`) 안 Input · TagInput · Select — 모달 안이든 화면이든 모두 `xl`. Input 기본 |
| `--h-2xl` | 단계 `2xl` | 흐름 안 입력(주소 · 식별자) |
| `--h-row` · `--h-row-single` | 표 행 높이(두 줄 · 한 줄) — 컨트롤 단계가 아니다 | Table · KeyValue |
| `--h-nav-item` | LNB 항목 높이 — 컨트롤 단계가 아니다 | LNBPanel |

### 리터럴 px 예외 주석
`.module.css`에 그대로 쓰는 px는 0 · 1px 테두리 · 레이아웃 고정폭뿐이다. 그 밖의 px는 `stylelint-disable-next-line mcp/no-literal-px`에 사유를 달고, 사유는 `파생 치수:`로 시작한다. 같은 값이 필요한데 규칙에 없으면 토큰 · 변형을 먼저 제안한다(`## 미정`).
- 규칙 · 명세에서 따라 나오는 값 — 테두리 계산(`높이 − 테두리 2`) · 행간 = 상자 높이 · 막대 · 점 두께와 반지름([Shapes](#shapes)) · 아이콘 viewBox 원본 · 시각 숨김 유틸 · 포커스 링 · COMPONENTS `층` 표의 층 고정 치수. 화면 CSS(`screens/`)는 이것만 쓴다
- `ui/` 컴포넌트 CSS는 여기에 더해 `파생 치수: 컴포넌트 고유 치수 — <무엇>`(`머리 56 · 좌우 22`)을 쓸 수 있다 — 그 값의 원본은 그 컴포넌트 CSS다

## Elevation & Depth

| 토큰 | 뜻 | 쓰는 곳 |
|---|---|---|
| `--shadow-modal` | 떠 있는 층 — 화면 가운데 | 가운데 뜨는 층 |
| `--shadow-panel` | 떠 있는 층 — 패널 · 목록 | 가장자리 패널 · 선택 목록 |
| `--shadow-popover` | 떠 있는 층 — 트리거 · 가장자리에 붙은 층 | 트리거에 붙은 작은 층(툴팁 · 팝오버 · 행 메뉴) · 떠 있는 LNB |
| `--scrim` · `--scrim-light` | 층 뒤를 가리는 막 · 옅은 막 | 가운데 뜨는 층 · 검색 층 |
| `--z-inline` | 쌓임 — 인라인 층 | 트리거에 붙은 층(선택 목록 포함) |
| `--z-modal` | 쌓임 — 덮는 층 | 가운데 뜨는 층 · 전체 덮는 흐름 · 떠 있는 LNB |
| `--z-alert-scrim` · `--z-alert-panel` | 쌓임 — 알림 패널의 막 · 패널 | 알림 패널 |
| `--z-search` | 쌓임 — 가장 위 | 검색 층 |

깊이는 바닥 `--canvas` · 필 면 `--surface-soft` · `--surface-subtle`(LNB · 요약 행 · 보조 버튼) · 선 `--hairline`(카드 · 패널 · 표)으로 나누고, 그림자는 떠 있는 층에만 쓴다([핵심 규칙 4](#핵심-규칙)). `--z-*`는 같은 쌓임 맥락 안에서 표의 아래 행일수록 위에 그린다. 컴포넌트별 그림자 · 막 · z와 층 안에서 연 트리거 층의 포털은 COMPONENTS `층`이 원본이다. 선택된 카드는 그림자 링 대신 테두리 색(`--accent` · `--accent-line`)으로 보인다.

## Shapes

| 토큰 | 뜻 | 쓰는 곳 |
|---|---|---|
| `--r-sm` | 작은 반지름 | 버튼 · 입력 · 로그 표면 · 요약 행 |
| `--r-md` | 기본 반지름 | 카드 · 모달 · 빈 상태 상자 |
| `--r-lg` | 큰 반지름 | 검색 오버레이 · 타입 카드 |
| `--r-pill` | 알약 | 칩 · 표식 · 알림 수 점 · 진행 막대 |

막대 · 점처럼 치수에서 파생되는 반지름(1–5px)은 예외로 두고 `파생 치수:` 주석을 단다. LNB 로고 표식도 여기에 속한다.

## Components

상태(기본 · 호버 · 눌림 · 포커스 · 비활성 등)는 COMPONENTS `상태 7종`이 기준이다 — 화면마다 다르게 만들지 않는다.

## Patterns

### 화면 틀
새 화면은 아래 틀 하나를 고른다. 맞는 틀이 없으면 `design-change`로 틀을 먼저 더하고, 틀 이름 · 예는 화면 하나의 이름이 아니라 일반 이름 · 일반 예로 쓴다. 참고 구현 중 화면 틀의 예는 대시보드 · 프로젝트 상세다 — 값은 화면 코드가 아니라 이 절 · 토큰 · COMPONENTS에서 가져온다.

**공통**
- 본문 `PageBody`(`narrow` = 앱 스토어 `narrow`) · 나란한 두 열 `PageColumns`(`equal` · `aside`) · 열 안 영역 쌓기 `Stack` · 머리 아래를 채우고 스크롤하는 목록 `Region` + `RegionList`. **화면 CSS는 `--body-*` · `--gap-section` · `--gap-column*`과 그 값의 리터럴을 쓰지 않는다**
- 스크롤은 둘 중 하나 — `PageBody scroll="page"`(기본, 본문 전체) · `scroll="regions"`(본문 고정, 마지막 `PageColumns`가 남은 높이를 채우고 열 안 `RegionList` · `LogView`가 각자 스크롤 — 열은 `Stack fill` 또는 `Region`). 스크롤 상자를 겹치지 않는다
- 화면 머리 `PageHeader`(`actions`에 둘 것은 COMPONENTS `PageHeader`) · 영역 머리 `SectionHead`(하위 영역은 `as="h3"`)
- 밴드([용어집](#용어집))는 `PageHeader` 바로 아래 한 줄이다 — 다른 틀도 집계를 본문 앞에 보이면 같은 자리다
- 화면이냐 설정 모달이냐 — 자기 라우트(LNB · 링크로 들어오는 경로)가 필요하고 영역이 여럿이면 화면(하위 화면형), 한 대상을 잠깐 고치고 돌아가면 설정 모달(딥링크는 부모 화면 주소의 검색 문자열 — `?source=&tab=` 꼴)
- 틀은 본문 배치로 고른다. 상위 화면이 있는지는 `back`과 입구만 정한다 — `back`(뒤로 링크)은 상위 화면이 있을 때만 두고, LNB · 층(알림 패널 등)에서 들어오는 화면은 `back`이 없다
- 입구: LNB에 없는 하위 화면은 상위 화면 `PageHeader actions`의 링크, 층에서 들어오는 화면은 그 층의 `footer` 링크(AlertPanel `footer`)

| 틀 | 언제 | 영역 배치(위 → 아래) | 스크롤 | 1024 |
|---|---|---|---|---|
| **대시보드형** | 여러 자원의 집계를 한눈에 본다 | `PageHeader`(`meta` 기준 줄 · 화면 필터 `SegmentedControl sm-plus`) · `SummaryBand` · 두 열 격자(열 = `Stack`, 표 열 5개 이상인 표는 격자 아래 전폭) | `page` | `SummaryBand` 2열 · 표 low 열 제거 |
| **상세형** | 한 자원과 그 하위 목록들 | `PageHeader divider` · MetricCard 밴드(선택) · 두 열(열 = `Region`: `SectionHead divider` + `RegionList`) | `regions` — 열 안 목록 | 두 열 유지 · 검색 좁은 폭 · MetricCard 밴드 4열 유지 |
| **하위 화면형** | 상위 자원의 한 항목 상세(옆에서 고를 목록이 없다) | `PageHeader back` · 한 열 또는 두 열 | 한 열 `page` · 두 열 `regions` | 두 열 유지 |
| **목록** (+ 다이얼로그) | 한 자원의 목록. 만들기 · 확인은 있을 때만 — 읽기 전용 목록도 이 틀 | `PageHeader` · 영역 하나(`SectionHead divider` 수 · 필터 · 검색 · 추가 + `Table` 또는 `RowCard`). 날짜로 묶으면 [목록과 표](#목록과-표) | `page` | 표 low 열 제거 · 검색 좁은 폭 |
| **목록 + 상세** | 목록에서 하나를 골라 옆에서 본다 | `PageColumns`(`equal`, 열이 많은 표 · 격자는 `aside`): 왼쪽 `Region`(`SectionHead` + `Table selectedKey`) · 오른쪽 상세(`SectionHead marker` · `KeyValue` · `ErrorBlock` · `LogView`) | `regions` — 목록 · 로그 각자 | 두 열 유지 · 표 low 열 제거 · 검색 좁은 폭 |
| **작업 + 보조 열** | 넓은 작업(입력 · 실행 · 결과)과 그 기록 · 보조 목록 | `PageHeader` · `PageColumns variant="aside"`: 작업 열 `Stack`(영역 쌓기) · 보조 열(`--w-aside`) `Region` | `regions` — 작업 열 마지막 영역 · 보조 목록 각자 | 그대로(보조 열 폭 유지, 작업 열이 줄어든다) |
| **설정 모달** | 한 대상의 여러 설정 | `Modal kind="settings"`(머리 = 대상 이름 · 상태 · 종류) · `Tabs variant="rail"` + 내용 열 · 발 | 내용 열 | 크기 그대로 |
| **단계 흐름** | 여러 단계를 거쳐 만든다 | `FlowOverlay`: 머리 · 내용 열(`FlowStepHead` + 폼) + `HelperPanel`(`StepList`) · 발 | 내용 열 · 안내 패널 각자 | 내용 열만 줄어든다(`HelperPanel` 폭 그대로) · 2열 칸 grid는 1열 — 앱 스토어 `narrow`를 `data-narrow`로 넘긴다(화면 CSS에 미디어 쿼리를 두지 않는다) |

**예 — 하위 화면형 두 열: 상위 자원의 한 항목 상세**
- `screenGate({ item, log }, { loading, notFound: { query: item, … } })` → 준비 전이면 `PageBody` 안에 그 `state`(없음 · 실패 · 로딩 하나), 다 받았으면 `data.item` · `data.log`로 그린다
- `PageBody scroll="regions"` > `PageHeader back` · `marker`(`StatusChip lg`) · `titleAction` · `description`
- `PageColumns`: 왼쪽 `SectionHead` + `KeyValue`(긴 값 `truncate`) · 오른쪽 `SectionHead`(수 · 복사) + 실패면 `ErrorBlock` + `LogView`(열 남은 높이)

**예 — 목록 + 상세**
- 왼쪽 `SectionHead`(수 · 필터 · 검색) + `Table selectedKey`(행 선택 = 상세 열기). 오른쪽 `SectionHead`(`marker` `StatusChip md` · 도구) + `KeyValue` + 실패면 `ErrorBlock` + `LogView`
- 상세 열의 고정 영역(`KeyValue` · `ErrorBlock`)은 줄지 않고 `LogView` 하나가 남은 높이를 채워 혼자 스크롤한다 — 상세 열 전체를 스크롤 상자로 감싸지 않는다. `LogView`가 없는 상세 열은 `Region`(`SectionHead` + 고정 영역) + 마지막 목록 `RegionList`로 — 열 전체를 `RegionList`로 감싸지 않는다
- 처음에는 첫 행을 고른다. 필터 · 검색이 고른 행을 숨기면 남은 첫 행으로 옮기고, 남은 행이 없으면 상세는 빈 상세([빈 상태](#빈-상태)의 `목록에서 고른 항목이 없다`)다

**예 — 목록 (+ 다이얼로그)**
- `PageBody` > `PageHeader`(상위 화면이 있으면 `back`) · `SectionHead divider`(수 `countLabel` · 도구: `SectionSearch` + 추가 Button `sm-plus` primary) + `Table`
- 만들기 · 삭제 확인은 [층 선택](#층-선택), 권한 없는 추가 · 행 액션은 [권한](#권한), 검색 0건은 `EmptyState filtered`

### 화면 상태 골격
- `ScreenState`를 쓰는 곳은 셋이다 — (1) 화면 본문 자리 하나 (2) 층 내용 열(데이터 전) (3) 영역 안 — 로딩 `loading inline` · 조회 실패 `failed`. kind별 생김새는 COMPONENTS `ScreenState`
- 화면 단위는 경로 id의 주 자원 쿼리와 첫 그림에 꼭 필요한 쿼리만 묶어 `screenGate({ 이름: 쿼리, … }, { loading, inline?, notFound? })`(`app/screenGate`) 하나로 그린다 — 없음 · 실패 · 로딩 세 갈래를 화면 · 층이 따로 만들지 않는다(판정은 `api/screenQueries` `screenFailure`)
  - 실패는 받은 값이 없는 쿼리만 본다 — 받은 뒤 다시 받기가 실패해도 그린 화면 · 탭을 그대로 둔다(주 자원 404는 그래도 `not-found`). 받은 값 `null`은 없음으로 본다(`null`을 돌려주는 쿼리는 묶지 않는다). `failed`의 `다시 시도`는 실패한 쿼리만 다시 부른다(`retry`). `not-found`는 돌아갈 곳(상위 화면 · 목록, Button `link`)을 준다
- 영역 하나의 실패는 화면을 막지 않는다 — 자리는 [실패 블록 자리](#실패)의 `영역 조회` · `즉시 실행 결과`
- 화면 필터 · 기간을 바꿔 다시 받는 동안은 이전 값을 그대로 보인다(TanStack Query `placeholderData: keepPreviousData`) — 로딩으로 바꾸지 않는다. 화면 필터가 있는 화면은 준비 전 · 실패 때도 `PageHeader` · 필터를 남기고 본문만 상태로 바꾼다
- 스켈레톤 · 스피너를 두지 않는다. 문구: 로딩 `{대상}을 불러오는 중…`(화면 copy) · 재시도 `RETRY` · 없음 `NOT_FOUND`(`copy/errors`)

### 그 자리 편집
- 진입은 대상 옆 `titleAction`(Button `sm` secondary `이름 수정`). 제목 글을 누르는 진입은 두지 않는다(키보드 · 보조기기에 안 보인다)
- 편집 · 저장 · Esc 동작은 COMPONENTS `InlineEdit`, 제목 자리 마크업은 COMPONENTS `PageHeader`(`editor`). 제목은 `textStyle="heading"`, 그 밖 값은 기본 크기
- 성공 → 보기 상태, 포커스는 진입 버튼. 실패 → 편집 유지, 아는 code는 `message` · 모르는 code는 `error`(ErrorBlock)

### 표 행 확인 줄
- 되돌릴 수 있는 삭제성 변경(항목 빼기 · 태그 지우기)은 `InlineConfirm`. 위치는 `RowCard` 목록이면 그 카드 바로 다음, `Table`이면 표 바로 아래(행 사이에 줄을 넣지 않는다), 설정 줄이면 그 `SettingRow` 바로 아래([폼](#폼))
- 문장은 안내 `…습니다`이고 대상 이름은 조사 없이 `{동작}: {이름}`(`멤버에서 뺍니다: 이도윤`)
- 한 번에 하나만 연다 — 다른 행에서 열면 앞의 것은 닫힌다. 성공하면 줄이 사라지고 포커스는 영역 머리의 주 도구(없으면 영역 제목). 실패하면 줄을 유지한다(자리는 [실패](#실패))

### 빈 상태
kind별 생김새는 COMPONENTS `EmptyState`.

| 상황 | kind | 예 |
|---|---|---|
| 화면 전체가 비었다(기간 안 데이터 0 등) | `nothing-yet` 하나 — `PageHeader` · 화면 필터는 남긴다 | 요약 밴드 · 격자 자리 |
| 이 화면에서 만들 수 있는 것이 아직 없다 | `not-created` + 다음 할 일 버튼 | 연결된 소스 없음 |
| 기록 · 집계가 아직 없다(만드는 버튼이 없다) | `nothing-yet` | 실행 로그 0줄 · 호출 0 · 알림 0 |
| 목록에서 고른 항목이 없다(상세 열) | `nothing-yet` 한 줄 | `왼쪽에서 고른다` 꼴 |
| 검색 · 필터가 모두 걸러냈다 | `filtered` | 검색 0건 |
| 행이 하나라도 있다 | 빈 상태 아님 — 행을 그린다 | 항목이 하나뿐 |
| 볼 권한이 없다 · 불러오지 못했다 · 값 하나가 없다 | 빈 상태 아님 — `접근 권한 없음` 한 줄 · `ScreenState failed` · 사유 문구 | |

- 목록이 0건이면 영역 머리에 만들기 버튼 · 검색을 다시 그리지 않는다 — `not-created`의 버튼 하나가 그 영역의 주 액션이다. `action`이 없는 `not-created`(잠김 안내)면 머리 버튼은 비활성으로 남기고 빈 상태 루트 `id`를 버튼 `aria-describedby`로 잇는다

### 목록과 표
- 표는 한 자원의 같은 단위 값을 나란히 대는 자리에만 — 상세 열(목록 + 상세의 오른쪽 · 하위 화면형 열) 안의 같은 단위 목록도 `Table`. 타입마다 단위가 다르면 `RowCard`, 작업 + 보조 열의 보조 열(`--w-aside`) 기록 · 보조 목록은 단위가 같아도 `RowCard`
- 읽지 않은 행은 첫 줄(`main`) 500 · `--ink` + 시각 숨김 `읽지 않음`이다. 색 · 점은 쓰지 않는다 — 처음 쓰는 화면이 `TableCellLines`에 prop을 더한다(design-change)
- 행 선택이 곧 상세 열기. 행 액션이 둘 이상이면 `RowMenu` 하나(표의 액션 열 · 표 열 폭 · `priority` · `emptyReason` · 두 줄 셀 · 행 높이 `density`는 COMPONENTS `Table`)
- 사용자 정렬 UI는 두지 않는다 — 순서는 고정하고 기준을 `SectionHead note`에 적는다(`호출 많은 순`). 잘림 같은 수치 안내도 `note`
- 필터는 `SectionHead tools`의 `SegmentedControl sm-plus`(검색 왼쪽). 검색은 `SectionSearch` + `useSearchFilter`, 수는 `copy/list` `countLabel`, 0건 문장은 `noMatchLabel`
- 날짜로 묶은 목록은 묶음마다 `SectionHead as="h3"`(`오늘` · `어제` · 날짜) + `Table`, 행 시각은 `shortDateTimeLabel`

### 폼
- 칸은 `Field`, 묶음 컨트롤(SegmentedControl · Checkbox 묶음 — 항목은 Checkbox `label`)은 `Field group` — 라벨 · 설명 · 검증 문구 · 칸 안 간격은 COMPONENTS `Field`
- 칸 하나에 붙는 한 줄 설명(무엇을 넣는지 · 고른 결과)은 Field `description`(컨트롤 아래). 여러 칸 · 동작에 걸친 안내 문단은 `Notice`. 정보를 자리표시자에만 두지 않는다
- 칸 사이 `--s-4`(폼 섹션 머리 → 첫 칸 포함. 두 칸을 나란히 둘 때 — grid 2열 — 가로도 `--s-4`) · 폼 섹션(`SectionHead as="h3"` + 칸 묶음) 사이 `--s-6`
- 같은 종류 값 여럿(이메일 · 태그)은 `TagInput`. 중복 거르기 · 형식 검증은 화면이 하고 실패는 칸 아래 검증 문구. 쉼표 · 붙여넣기 나누기는 두지 않는다
- 글자 수 한도는 Label `hint`에 `n / max`, 넘으면 Field `message`. `maxLength`로 막지 않는다. 한도 값이 생기면 `api/limits.ts` 한 곳에 둔다
- 편집 권한이 없으면 같은 폼을 읽기 전용으로 그린다(컨트롤별 `readOnly` · `disabled`는 COMPONENTS `Input · Textarea`). 읽기 전용 보기(`KeyValue` 등)를 따로 만들지 않는다. 사유는 [권한](#권한)
- 설정 모달의 켜고 끄기 · 위험 작업 입구는 `SettingRow`. 위험 작업은 되돌릴 수 없는 것(삭제 · 연결 해제)만이다 — 탭 마지막 `SettingRow` + Button `md` `danger` → 확인 `Dialog`. 되돌릴 수 있는 삭제성 변경의 확인은 그 `SettingRow` 바로 아래 `InlineConfirm`이고, 성공하면 줄이 사라지고 포커스는 그 `SettingRow`의 컨트롤
- 모달 안 폼은 Modal 몸통 그대로(`settings` 내용 열은 `ModalPanel`이 칸마다 최대 폭 `--w-field`), 화면 안 폼은 `PageBody` 안 칸 묶음 — 칸마다 `max-width: var(--w-field)`(모달과 같은 방식 — 두 칸을 나란히 두는 grid도 칸 하나가 `--w-field`까지)

### 실패
- 아는 code(409 등 — `copy/errors.ts` `KNOWN_FAILURE` · `knownFailure(error)`, 새 code는 거기에 더한다)는 그 동작이 난 자리의 검증 문구 한 줄이다(자리는 아래 표, 표에 없는 자리는 `InlineMessage`). 툴팁 표식 · 새 다이얼로그를 쓰지 않는다
- 모르는 code는 원문을 요약 · 파싱하지 않고 `ErrorBlock`에 그대로 담는다(표면 · 복사는 COMPONENTS `ErrorBlock`). 블록에는 항상 `onCopy`를 준다
- 아는 code · 모르는 code가 같은 자리에 오면 `FailureBlock`(`app/FailureBlock`) 하나로 그린다 — 화면이 `knownFailure` 갈래를 따로 만들지 않는다

**실패 블록 자리** — 위치는 이 표 한 곳에서 정한다.

| 실패가 난 곳 | 자리 |
|---|---|
| 폼 · 모달 | 아는 code는 칸 `Field message`. 칸에 묶이지 않는 아는 code는 몸통 끝(= 발 바로 위) `InlineMessage`, 모르는 code는 `ErrorBlock` |
| 단계 흐름(`FlowOverlay`) | 내용 열 끝(= 발 바로 위). 아는 code는 `InlineMessage`, 모르는 code는 `ErrorBlock` |
| 표 셀 즉시 변경 | 표 바로 아래 한 줄. 아는 code는 `InlineMessage`(문장에 행 이름), 모르는 code는 `ErrorBlock` |
| 확인 줄(`InlineConfirm`) | 아는 code는 줄 안 `rejection`, 모르는 code는 줄 바로 아래 `ErrorBlock` |
| 확인 `Dialog` | 설명 아래(`children`) — 아는 code는 `InlineMessage`, 모르는 code는 `ErrorBlock`, 열어 둔 채 |
| `InlineEdit` | 줄 아래 — 아는 code는 `message`, 모르는 code는 `error` |
| 영역 · 층 조회 | 영역 머리 바로 아래 · 층 내용 열 — `ScreenState failed` |
| 즉시 실행 결과(테스트 · 다시 보내기처럼 결과를 보이는 실행) | 실행 버튼이 있는 영역 머리 바로 아래 — 성공은 중립 `Notice`(`done`, 알림은 [즉시 실행 완료](#즉시-실행-완료)의 `role=status`), 실패는 `ErrorBlock`(`다시 시도` 없음 — 실행 버튼이 곧 재시도). 결과 없이 행 값만 바뀌면 [즉시 실행 완료](#즉시-실행-완료) |
| 화면 조회 | 본문 `ScreenState failed`([화면 상태 골격](#화면-상태-골격)) |

### 복사 결과
복사 버튼(ErrorBlock · CopyField · 화면이 만드는 로그 머리 줄)은 `useCopyState` 하나로 같은 세 상태를 낸다 — `복사` → 성공 `복사됨` · 실패 `복사 안 됨`. 실패를 성공처럼 보이지도, 아무 일 없던 것처럼 두지도 않는다.
- 결과는 시각 숨김 `role=status`(`VisuallyHidden`)로 함께 알리고, 결과 라벨은 2초 뒤 `복사`로 돌아온다. `복사됨`만 호출자가 유지 시간을 바꿀 수 있다(연결 정보처럼 열려 있는 동안 보여 줄 값)
- 복사는 `platform`의 `copyText`가 하고 결과(`true` · `false`)를 그대로 `onCopy`의 반환값으로 준다. 토스트를 띄우지 않는다

### 즉시 실행 완료
확인 없이 바로 실행하는 액션(다시 보내기 등)은 완료를 토스트로 알리지 않는다. 행 값이 바뀌고 `VisuallyHidden role=status` 한 줄로 함께 알린다.

### 층 선택
| 형태 | 쓰는 곳 |
|---|---|
| 전체 덮는 오버레이 | 여러 단계를 거치는 흐름 |
| 모달 | 되돌릴 수 없는 확인(`Dialog`) · 입력 · 만들기(Modal `form`) · 한 대상의 여러 작업 묶음(`settings`) · 읽기 전용 정보 열람(`info`) |
| 그 자리 확인 줄 | 되돌릴 수 있는 삭제성 변경(`InlineConfirm` — 자리는 [표 행 확인 줄](#표-행-확인-줄)) |

- `Dialog` 확인 버튼 — 데이터를 지우거나 잃으면 `danger`(`삭제` · `연결 해제`), 그 밖은 `primary`. 취소는 `취소`. 같은 동작은 화면이 달라도 확인 여부 · 이름이 같다. 확인이 요청이면 비동기 확인(COMPONENTS `Dialog`)
- 되돌릴 수 없고 하위 자원까지 지우는 삭제만 이름 입력 확인을 둔다 — `Dialog` 안 `Field` + `Input`(xl), 저장된 이름과 완전히 같을 때까지 확인 비활성, 열 때마다 비운다
- 저장하지 않은 변경: form · settings 모달은 바뀐 값이 있으면 ✕ · Esc · 바깥 클릭 · 닫기에 확인 `Dialog` — `useUnsavedClose`(COMPONENTS `공용 훅`)가 확인 Dialog · 발 `note`를 낸다. 바뀐 것이 없으면 `저장` 비활성. 화면 안 폼은 바뀐 값이 있는 채 다른 화면으로 가려 하면 `useLeaveGuard`(`app/useLeaveGuard`)가 같은 꼴의 확인 `Dialog`를 연다(같은 경로 안 이동은 막지 않는다)
- 한 번만 보이는 값(생성된 비밀 값)은 만들기 `Modal kind="form"` 안에서 결과 단계로 바꿔 보인다 — 안내 `Notice tone="info"` + `CopyField` + 발 `닫기`만, `dismissible={false}`

### 권한
- 권한이 없는 액션은 **숨기지 않고** 비활성 + 사유 문구. 사유는 권한마다 구체형이다 — 그 동작을 할 수 있는 역할을 말한다(`소유자만 연결을 해제할 수 있다` · `편집자 이상만 소스를 고칠 수 있다`). 문장은 그 화면 `copy/<화면>.ts`, 문체는 [Copy](#copy). `usePermission`의 `reason`은 공통 문장(`PERMISSION_DENIED` — [미정](#미정))이라 새 화면은 `allowed`만 쓰고 사유는 자기 copy 문장을 넣는다
- 사유를 `title`(툴팁)만으로 주지 않는다 — 비활성 컨트롤은 포커스가 가지 않는다. (1) 기본은 **보이는 문장**: 영역은 `SectionHead reason`, 폼 · 모달은 Modal `footer.note`, 단계 흐름은 FlowOverlay `note`(여러 액션이 같은 사유면 한 번), 영역 머리 · 발 밖의 액션(폼 안 묶음 버튼)은 그 바로 아래 `ReasonLine`. 발 한 줄의 우선순위는 권한 사유 > 저장하지 않은 변경 > 저장 안내 (2) 보이는 자리가 없으면 `VisuallyHidden id`에 사유를 두고 컨트롤 `aria-describedby`로 잇는다. `title`은 호버 보조로만
- 화면은 권한 문자열(`permissions.ts`)만 묻는다(`usePermission`). 역할 → 권한 도출은 서버 몫이다 — 소유자 전용 = 프로젝트 삭제 · 공유(멤버 관리) · 소스 연결 해제, 편집자 = 그 밖의 편집 전부, 멤버 = 조회 · 쿼리 실행, 보기 전용 = 조회. 더미 확인은 `?role=owner|editor|member|viewer`(new-screen 스킬). 프로젝트 멤버의 역할도 이 넷(`Role` — `api/types.ts`)뿐이다. 권한을 더하면(`permissions.ts`) 이 문장의 역할별 목록도 함께 고친다
- 목록 · 상세 열람 권한이 없으면 LNB에서 항목을 빼지 않고 해당 화면에 `접근 권한 없음` 한 줄

## 접근성

- **포커스** — 모든 컨트롤은 키보드로 닿고 `base.css`의 `:focus-visible` 링 하나로 보인다([핵심 규칙 12](#핵심-규칙)). CSS로 `outline`을 지우거나 덮지 않는다 — 예외는 둘: 시각 숨김 입력을 감싼 상자가 같은 링을 대신 그리는 것(FileDrop) · 프레임 · 모달 가장자리에 닿는 스크롤 상자(`PageBody` · Tabs `rail` 내용 열 · `ModalPanel`)가 `outline-offset: -3px`로 같은 링을 안쪽에 그리는 것(값은 그대로, 위치만). 링을 자르는 `overflow: hidden` 상자를 만들지 않는다 — 스크롤 상자는 안쪽에 3px 링 자리(2 + offset 1)를 남긴다. Tab으로 가장자리 항목을 눌러 확인한다
- **순서** — 포커스 순서는 보이는 순서(DOM 순서)다. 양수 `tabIndex`를 쓰지 않는다. 포인터로 하는 일(클릭되는 행 · 카드 · 드래그 핸들 · 툴팁 트리거)은 키보드로도 같은 일을 한다 — 행 · 카드는 Enter · Space, 핸들은 ←/→. 누르는 카드 안에 다른 컨트롤이 있으면 카드를 버튼으로 만들지 않고 제목을 누름 버튼으로, 안의 컨트롤을 그 형제로 둔다(꼴은 COMPONENTS `RowCard`)
- **이름** — 보이는 글자가 없는 컨트롤 · 표식(아이콘 버튼 · 글리프 버튼 · 안내 점 · 진행 막대 · 헤더 없는 표)은 접근 가능한 이름(`label` · `title` · `aria-label` — prop은 COMPONENTS 그 절)이 필수다. 표 · 영역 · 층은 보이는 제목(없으면 시각 숨김 제목)에서 이름을 얻는다 — 영역 상자는 SectionHead `titleId`를 `aria-labelledby`로 잇는다
- **색만으로 뜻을 전하지 않는다** — 상태는 칩 글자, 실패는 문장 + 원문([실패](#실패)), 데이터 색은 범례 글자 · 수가 나른다
- **대비** — 큰 글자 밖 모든 글자(라벨 · 캡션 · 칩 포함) 4.5:1, 큰 글자(24px 이상 · 600이면 19px 이상 = `--t-h1` · `--t-h2`뿐) · 아이콘 · 컨트롤 테두리 3:1(`tokens.css` 값으로 계산). `--faint` · `--disabled`와 선 토큰(`--hairline*` · `--data-empty`)은 3:1도 안 된다 — 비활성 · 장식 · 나눔선 · 빈 구간 · 범례가 뜻을 나르는 데이터 구간에만 쓴다
  - 컨트롤 테두리 예외 — 입력 · 선택 · 체크 상자 · Textarea · ToggleChip 테두리(`--hairline` · 체크 상자 `--disabled`)와 FileDrop 점선(`--disabled`)은 3:1에 못 미치지만 그대로 둔다. 컨트롤은 라벨 · 값 글자 · 포커스 링으로 알아보고 검증은 `--fix-fg` 테두리 + 문구가 나른다
  - 글자 토큰이 되는 바탕 — 어느 바탕이든: `--ink` · `--ink-soft` · `--icon` · `--accent-ink` · 상태 `-fg` · `-body` / `--muted`: `--canvas-outer` · `--data-empty` 위만 빼고 모든 면(최저 `--fix-bg` 4.51:1) / `--on-ink`: `--ink` · `--accent` · 상태 `-fg` 필 위에서만 / `--accent`: `--field` · `--fix-bg`만 빼고 / 정보를 나르는 글자로 쓰지 않는다: `--faint` · `--placeholder`(정보가 없어 `--faint` 단계 2.56:1로 둔다) · `--illust` · `--disabled`
- **검증 · 설명 · 비활성 사유 · IME** — `invalid`인 컨트롤은 `aria-invalid`를 단다. 검증 · 거절 · 설명 문구는 `id`(`useId()`)를 두고 그 입력 · 버튼 `aria-describedby`로 잇는다 — 폼 칸은 `Field`가 한다. 비활성 사유는 [권한](#권한). Enter로 확정 · 제출하는 입력은 IME 조합 중(`isComposing` · keyCode 229)의 Enter를 무시한다
- **시각 숨김** — 화면에 없어도 읽혀야 하는 글 · 제목 · 입력은 `VisuallyHidden`(층 안은 `layers` `.srOnly`)으로 숨긴다. `display:none` · `visibility:hidden`은 보조기기 · Tab에 닿지 않는다
- **바뀌어 나타나는 한 줄** — 결과 · 진행 · 빈 상태는 `role="status"`(로딩은 `aria-busy`와 함께), 검증 · 거절은 `role="alert"`. 완료는 시각 숨김 `role="status"`로 함께 알린다([복사 결과](#복사-결과) · [즉시 실행 완료](#즉시-실행-완료)). 알림 카드 목록의 live 영역은 COMPONENTS `AlertPanel`
- **요청 중 · 완료 뒤** — 요청 중인 컨트롤은 `disabled`가 아니라 Button `loading`이다(포커스가 그 자리에 남는다). 핸들러도 진행 중이면 다시 보내지 않는다. 완료 뒤 사라지거나 잠기는 컨트롤에 있던 포커스는 다음 할 일이 있는 자리로 옮긴다 — 자리는 각 절([표 행 확인 줄](#표-행-확인-줄) · [그 자리 편집](#그-자리-편집) · [폼](#폼)의 `SettingRow`)이 정하고, 정한 곳이 없으면 그 영역 제목
- **층 · 그 자리 편집 · 확인 줄** — 층은 열리면 첫 컨트롤로 포커스를 옮겨 그 안에 가두며(Popover는 가두지 않는다), Esc로 닫고, 닫으면 연 컨트롤로 돌아간다(그 컨트롤이 사라졌으면 `returnFocusFallback`). Dialog는 Radix 기본대로 `취소`에 포커스. 그 자리 편집 · 확인 줄은 열리면 그 줄로 포커스를 옮기고(어느 컨트롤인지는 COMPONENTS 그 절), Esc는 취소이며 전파를 멈춰 바깥 층이 함께 닫히지 않는다
- **모션** — `prefers-reduced-motion`이면 `--m-*`가 0ms가 된다(`tokens.css`). 모션에 뜻을 싣지 않는다

## Iconography

**자체 세트** — `apps/web/src/ui/icons/svg/*.tsx`(UI 아이콘 · 삽화). 방향 · 닫기 · 완료 · 더보기는 아이콘이 아니라 텍스트 글리프(`→` `←` `✕` `✓` `⋯`)다. 아이콘별 뜻 목록과 `Icon` · `Illust` prop은 COMPONENTS `아이콘`.
- 그리는 규격 — viewBox `0 0 18 18` · `fill="none"` · 선 `strokeWidth={1.5}` · 열린 선 끝 · 꺾임 `round` · `stroke="currentColor"`. 표시 색은 부모 글자색 — 기본 `--icon`. 삽화는 viewBox `0 0 150 74` · 선 1.4 · 색 `--illust`
- 규격 밖(그대로 두고 새 아이콘이 따르지 않는다) — `bell` 15×16(선 1.2) · `settings` 24×24(선 1.7) · `chevron-down` 12×8(Select · LNBPanel이 CSS로 12×8을 준다). 정사각이 아닌 viewBox는 `names.ts` `ICON_ASPECT`에 세로/가로 비율을 적는다 — `Icon`이 세로 = round(`size` × 비율)로 그린다(`bell` 20 → 20×21), 없으면 정사각
- 크기(`Icon size` = 가로) — `18` 기본(IconButton `sm` · LNB 항목 · 그룹 · 검색 입력) · `17` IconButton `sm-plus` · `16` 검색 결과 항목 · `20` 알림 종(LNBPanel). 목록 밖 크기는 `## 미정`
- 이름 · 등록 — 놓인 자리가 아니라 뜻으로 짓는다(`sidebar-collapse` ○ · `lnb-top-left` ×). 이름은 kebab-case, 파일은 그 PascalCase(`SidebarCollapse.tsx`). `names.ts` `ICONS`에 더하면 `/_guide` IconButton 절(아이콘 전체)에 저절로 나오고, COMPONENTS `아이콘` 뜻 목록에도 한 줄을 더한다. 삽화는 파일에 `Illust` 접두(`IllustGit.tsx`)를 붙이고 `ILLUSTS`에 접두 없이(`git`) 등록한다(`/_guide` `Illust` 절)
- 파일 틀 — `svg/Search.tsx`를 복사해 도형만 바꾼다. `title` · `titleId` · `aria-labelledby` · `{...props}`는 그대로 두고, `<svg>`에 width · height를 두지 않는다(`Icon`이 준다). 꺾인 선은 `strokeLinejoin="round"`

## Motion

| 토큰 | 뜻 | 쓰는 곳 |
|---|---|---|
| `--m-fast` | 짧은 상태 전환 | LNB 접힘 · 셰브론 회전 · 버튼 · 스위치 전환 |
| `--m-fade` | 나타남 · 사라짐 | 툴팁 · 팝오버 불투명도 |

장식 모션 · 페이지 로드 연출 · 펄스를 만들지 않는다. 모션 줄이기 설정은 [접근성](#접근성).

## Copy

- 문장 출처는 [핵심 규칙 9](#핵심-규칙). 서버가 주는 값은 `code` · `severity` · `count` · `subjects` · `actionTarget` · `since`다
- 문체 — 두 층으로 쓴다
  - **안내 문장**(설명 · 흐름 안내 · 진행 · 완료 알림 · 확인 다이얼로그 본문 · PageHeader `description`)은 `…습니다`: `연결하는 중입니다` · `일부만 연결했습니다`
  - **한 줄 상태 · 사유**(빈 상태 제목 · 본문 · 잠금 · 권한 사유 · 검증 문구 · 알림 요약)는 평서 `…다`, 다음 할 일은 ` · `로 잇는다: `연결된 소스가 없다` · `소유자만 연결을 해제할 수 있다 · 소유자에게 요청`
  - 마침표 — EmptyState 본문(`not-created` · `nothing-yet` `body` — 잠김 안내 포함) · 알림 카드 본문(`body`)은 한 문장이어도 마침표로 끝낸다. 제목 · 힌트 · 칸 설명(Field `description`) · `filtered` 한 줄 · 한 줄 사유(발 `note` · 비활성 사유 한 줄) · 검증 문구는 마침표 없이 끝낸다
  - 버튼 · 칩 · 탭 · 라벨은 명사형(`다시 시도` · `수집 완료`). 확인 다이얼로그 제목은 질문 `…할까요?`도 쓴다. 요청형 `…하세요` · `…두세요`는 쓰지 않는다
- **조사** — 이름 · 값 뒤에 조사를 붙이지 않고 문장 구조로 피한다(`X 연결을 해제할까요?` · `멤버에서 뺍니다: 이도윤`)
- **상태 값** — 한국어로 통일하고 아래 목록만 쓴다. 같은 상태는 자원이 달라도 같은 말이다. 진행형 값은 띄어 쓴다(`수집 중`). 상태로 거르는 필터의 라벨은 칩 라벨과 같다

  | 값 | 계층 | tier | 쓰는 자원 |
  |---|---|---|---|
  | `연결 준비` · `수집 중` · `가공 중` | 시간이 지나면 바뀐다 | `progress` | 소스 |
  | `수집 완료` | 끝났거나 할 일이 없다 | `done` | 소스 |
  | `수집 실패` · `인증 실패` | 할 일이 있다 | `fix` | 소스 |
  | `사용 중` | 끝났거나 할 일이 없다 | `done` | 커넥터 |
  | `갱신 중` | 시간이 지나면 바뀐다 | `progress` | 커넥터 |
  | `실패` | 할 일이 있다 | `fix` | 커넥터 |
  | `미발행` | 끝났거나 할 일이 없다 | `idle` | 커넥터 |

  계층 기준 — 앞의 두 계층(할 일이 있다 · 시간이 지나면 바뀐다)이 손봐야 할 것이다. 셋째 계층은 성공해 끝났거나 정상으로 쓰이면 `done`, 할 일이 없거나 쓰지 않거나 사용자가 멈췄으면 `idle`이고 둘은 같은 중립색이다. 모호하면 혼자 정하지 않고 `## 미정`에 올린다
- 새 상태 값은 (1) 위 목록에 먼저 넣고 계층을 정한 뒤 (2) `apps/web/src/copy/status.ts`에 code → 라벨 · 계층 틀을 둔다. 목록에 없는 값을 화면에서 만들지 않는다
- 상태 값이 아닌 것 — 흐름 단계 진행 표기(`대기` · `읽는 중` · `완료`)와 알림 종류(`copy/notifications.ts` `notificationKindLabel`)는 중립 글자로 쓰고 StatusChip으로 그리지 않는다. 켬 · 끔 · 방식 같은 속성 값(`수동`)과 Switch로 켜고 끄는 설정은 중립 글자 또는 Switch로만 — 칩 · 상태 값으로 만들지 않는다
- 잠긴 것은 무엇을 먼저 해야 하는지 말한다. 저장 결과가 칸 이름만으로 분명하지 않으면(칸 밖의 값이 함께 바뀌거나 되돌리기 어렵다) 무엇이 바뀌는지 화면 안에 적는다 — 표시 이름만 바꾸는 저장은 적지 않는다
- **UI 공용 어휘** — `apps/web/src/ui` 컴포넌트 · 공용 훅(`app/useLeaveGuard` 포함)의 기본 라벨은 앱 전체가 같이 쓰는 어휘다. props(`labels` 등)로 덮어쓸 수 있지만 화면이 어휘를 새로 만들지 않고 아래 표를 먼저 쓴다

  | 컴포넌트 | 기본 라벨 |
  |---|---|
  | 복사 버튼(ErrorBlock · CopyField) | `복사` · `복사됨` · `복사 안 됨` |
  | InlineEdit | `저장` · `취소` · `저장 중…` |
  | LNBPanel 토글 | `사이드바 접기` |
  | AlertPanel 제목 | `알림` |
  | Tag 삭제 | `{태그} 삭제` |
  | Dialog · InlineConfirm 취소 버튼 | `취소`(`CANCEL_LABEL` — `@/ui`가 원본, `copy/common`이 다시 내보낸다) — `돌아가기` 등 다른 말을 쓰지 않는다. 확인 라벨에 `취소`가 들어가면 취소 쪽을 `닫기`로 쓴다 |
  | 저장하지 않은 변경(`useUnsavedClose`) | 발 `note` `저장하지 않은 변경이 있다` · 닫기 확인 Dialog `저장하지 않고 닫을까요?` · `닫기`(`danger`) · `취소` |
  | 나가기 확인(`useLeaveGuard` — `app/`, 문구 원본 `LEAVE_LABELS` — `copy/common`) | 나가기 확인 Dialog `저장하지 않고 나갈까요?` · `나가기`(`danger`) · `취소` |

- **진행형 라벨** — 진행 중인 동작은 말줄임표(`…`)를 붙인다(칩 상태 값 `수집 중` · `가공 중` · `갱신 중`은 붙이지 않는다). 동작 버튼은 동작 이름 + `중…`(`저장 중…` · `확인 중…`), 불러오기는 `…를 불러오는 중…`(`소스를 불러오는 중…`), 안내 문장은 `연결하는 중입니다`
- **시각 서식** — 화면 copy가 날짜 + 시각을 따로 만들지 않고 `apps/web/src/copy/time.ts`의 함수를 쓴다(로컬 시각). 맞는 함수가 없으면 `time.ts`에 더하고 이 표에 행을 더한다

  | 함수 | 모양 | 쓰는 곳 |
  |---|---|---|
  | `dateTimeLabel` | `YYYY-MM-DD HH:MM` | 상세 · 설정 |
  | `dateLabel` | `YYYY-MM-DD` | 날짜만 보이는 메타(PageHeader `meta` 생성일 · 업데이트) |
  | `shortDateTimeLabel` | `MM-DD HH:MM` | 목록 · 표 행(날짜로 묶은 목록의 행 포함) |
  | `clockLabel` | `HH:MM:SS` (mono) | 로그 · 실시간만 |
  | `durationLabel(ms)` | `n초` · `n분 n초` · `n시간 n분` | 실행 · 작업 시간(초 이상) |
  | `relativeDayTime` | `오늘 HH:MM` · `어제 HH:MM` · `MM-DD HH:MM` | 알림 패널 카드만 |
  | `dayRangeLabel` | `YYYY-MM-DD – YYYY-MM-DD` | 기간 — 날짜만 온 값 두 개(집계 기간) |
  | `mmdd` · `hhmm` | `MM-DD` · `HH:MM` | 차트 시간 축 눈금 |

- **숫자 · 단위 서식** — 화면 copy가 수를 직접 포맷하지 않고 `apps/web/src/copy/format.ts`의 함수를 쓴다. 화면에서 `toLocaleString` · `Intl`을 직접 부르지 않는다(eslint). 맞는 함수가 없으면 `format.ts`에 더하고 이 표에 행을 더한다

  | 함수 | 예 | 쓰는 곳 |
  |---|---|---|
  | `formatCount` | `12,340` | 건수 · 호출 수(천 단위 쉼표) |
  | `formatPercent` | `3.2%` | 비율(0–1 값) |
  | `formatPercentInt` | `42%` | 진행률처럼 이미 퍼센트인 값(0–100)을 정수로(반올림) |
  | `formatPercentPoint` | `+0.4%p` · `−0.4%p` | 비율의 차 |
  | `formatLatency` | `412ms` · `1.2s` | 응답 · 지연 시간 |
  | `formatLatencyParts` | `{ value: '1.2', unit: 's' }` | 값과 단위를 따로 그리는 지연(MetricCard `value` · `unit`) — 경계 · 자릿수는 `formatLatency`와 같다 |
  | `deltaLabel` | `이전 7일 대비 +8.2%` · 비교할 값이 없으면 `이전 기간 없음` | 요약 카드 증감 줄(SummaryCard `delta`) |
  | `rangeLabel` | `최근 7일` | 집계 기간 이름 |
  | `countUnitLabel` | `12,340건` · `3개` · `5회` | 수 + 단위(건 · 개 · 회) |
  | `aboutMinutesLabel` | `약 5분` | 어림 소요 시간 |

- **쓰지 않는 말** — `MCP 커넥터` · `커넥터 고도화` · `배지` · 맨 `실패`(커넥터 외)
  - 짧은 실패 라벨은 맨 `실패` 대신 무엇이 안 됐는지 쓴다(`복사 안 됨`). 실행을 멈추는 동작은 `멈추기`, 결과는 `멈춤` — `취소` · `취소됨` · `실행 취소`로 쓰지 않는다(`취소`는 다이얼로그 · 확인 줄 버튼에만)

## Do's and Don'ts

규칙 문장은 위 절이 원본이다. 여기는 **화면 CSS로 만들지 않는 것**과 대신 쓸 컴포넌트 한 표다 — 화면 폴더에 컴포넌트를 흉내 낸 CSS를 두지 않는다.

| 만들지 않는 것 | 쓸 것 |
|---|---|
| 본문 여백 · 영역 간격 · 열 간격 · 영역 머리 → 내용 간격 · 스크롤 목록 상자 | `PageBody` · `PageColumns` · `Stack` · `Region` + `RegionList` |
| 영역 제목 줄 · 수 · 메모 · 사유 줄 | `SectionHead`(`count` · `note` · `reason`) |
| 영역 검색 입력 · 0건 줄 | `SectionSearch` + `useSearchFilter` · `EmptyState filtered` |
| 라벨 · 설명 · 검증 문구 · 묶음 legend · 체크 상자 라벨 줄 | `Field`(`description` · `group`) · Checkbox `label` |
| 잠긴 액션 아래 사유 줄(영역 머리 밖) | `ReasonLine` |
| 폼 밖 검증 · 거절 한 줄 | `InlineMessage` |
| 안내 문단 · 알림 카드 | `Notice` |
| 로딩 줄 · 조회 실패 · 찾을 수 없음 | `ScreenState`(영역 안 로딩은 `inline`) — 쿼리로 고르는 갈래는 `screenGate` |
| 실패 원문 상자 · 복사 · 아는 code 한 줄 | `ErrorBlock` · `useCopyState` · 아는 code와 갈리는 자리는 `FailureBlock` |
| 표 두 줄 셀 · 행 메뉴 | `TableCellLines` · `RowMenu` |
| 설정 한 줄 · 증감 줄 | `SettingRow` · `SummaryCard delta` |
| 흐름 단계 머리 · 단계 목록 | `FlowStepHead` · `StepList` |
| 버튼 · 링크 · 칩 · 태그 모양 | `Button`(variant) · `StatusChip` · `Tag` |
| 시각 숨김 글 | `VisuallyHidden` |

## 용어집

- **층** — 본문 위에 떠서 열고 닫는 것(모달 · 다이얼로그 · 흐름 · 검색 · 알림 패널 · 팝오버 · 행 메뉴). 고르기는 [층 선택](#층-선택), 계약은 COMPONENTS `층`
- **틀** — 화면 틀은 새 화면이 고르는 영역 배치 · 스크롤 · 1024 동작의 묶음([화면 틀](#화면-틀)). 문장 틀은 `copy/`의 code별 문장 함수
- **영역** — 화면 · 열 안에서 영역 머리(`SectionHead`) 하나 아래 묶인 내용 단위
- **머리 · 몸통 · 발** — 머리는 화면 · 영역 · 층 · 패널 맨 위 줄(제목 · 도구), 몸통은 층에서 머리와 발 사이의 내용, 발은 층 맨 아래 액션 줄(`note` 포함)
- **열** — `PageColumns` 열 · 층 내용 열 · 값 열(KeyValue · CopyField). 표의 열은 `표 열`
- **칸** — 폼 칸 하나(`Field` = 라벨 + 컨트롤 + 검증 문구). 다른 뜻으로 쓰지 않는다 — 밴드 안 하나는 카드, KeyValue · CopyField의 값 쪽은 값 열
- **자리** — 무엇을 놓을 정해진 위치(실패 블록 자리 · 사유 자리 · 컴포넌트 슬롯)
- **입구** — 하위 화면 · 층 · 위험 작업으로 들어가는 링크 · 버튼
- **표식** — 상태 · 종류 · 안내를 보이는 작은 글자 · 점(StatusChip · CountDot · Tag · InfoDot — COMPONENTS `표식`)
- **밴드** — 화면 머리 아래 요약 카드 줄. 대시보드형 `SummaryBand` · 상세형 MetricCard 밴드
- **참고 구현** — 규칙을 보여 주는 지금 화면 코드(LNB 셸 · 대시보드 · 프로젝트 상세). 샘플 IA의 일부라 언제든 바뀐다. 값의 원본이 아니다 — 문서와 다르면 화면을 고친다
- **샘플 IA** — 지금 LNB 항목 · 라우트 · 화면 구성(`app/nav.ts`). 참고 구현과 준비 중 자리로 이뤄지고, 규칙을 보여 주려 둔 예라 언제든 바뀐다. 준비 중 자리는 빈 자리의 모양을 보이는 예이고 채울 목록이 아니다
- **요구 메모** — 화면 파일 머리 주석(목적 · 진입 · 틀 · 영역 · 상태). 형식은 `.claude/skills/new-screen`
- **높이 단계** — 컨트롤 높이 이름(`sm` … `2xl`, 토큰 `--h-*`). 같은 이름이면 같은 높이다([컨트롤 높이 단계](#컨트롤-높이-단계))

## 미정

값을 아직 정하지 않은 것과, 없는 토큰 · 변형의 제안. 제안은 여기에 행을 추가하고 사용자에게 묻는다.

| 항목 | 지금 | 제안 |
|---|---|---|
| 참고 구현의 권한 사유 | `usePermission`이 모든 권한에 공통 문장 `PERMISSION_DENIED`(`copy/errors`)를 `reason`으로 주고 샘플 화면이 그대로 쓴다 | 권한별 구체형([권한](#권한))으로 옮길지(`usePermission`이 사유를 받거나 화면 copy로) — 새 화면은 `allowed`만 쓰고 구체형을 쓴다 |
