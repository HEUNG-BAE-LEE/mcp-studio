# COMPONENTS — 이음 웹 콘솔

부품 계약 — 쓰는 곳 · 쓰지 않는 곳 · prop · 크기 · 상태 · 접근성. 규칙(언제 무엇을 쓰는지)은 `DESIGN.md`, 값의 원본은 `src/styles/tokens.css`. 모양 · 동작은 이음 원본 콘솔이 기준이다.
구현은 **React + CSS Modules**(`src/ui`, 새 의존성 없음). 토큰은 CSS 변수 이름(`--primary`)으로만 부른다. 안쪽 여백 · 글자 크기 같은 내부 치수의 원본은 각 `*.module.css`다.

## 공통 계약

- **절 형식** — 부품 절은 아래 bullet을 이 순서로 쓴다. 해당 없는 bullet은 두지 않는다
  - `쓰는 곳` → `쓰지 않는 곳` → `prop · 크기` → `상태` → `접근성` → `폭` → `카탈로그`
  - 쓰는 곳 · 쓰지 않는 곳 · 상태 · 접근성은 문장이라 마침표로 끝내고, prop 줄 · 하위 bullet · 폭 · 카탈로그는 마침표 없이 끝낸다
  - 쓰지 않는 곳은 "자리 → 대신 쓸 부품" 꼴로 적는다
- **prop 표** — `prop · 크기` 아래에 표 하나를 둔다. 열은 `prop` · `타입` · `기본값` · `뜻`. 타입이 유니온이면 값을 ` · `로 늘어놓는다. 기본값 `필수`는 반드시 주는 prop, `없음`은 생략 가능 · 기본값 없음이다. 표 아래 하위 bullet에 함께 내보내는 상수 · 함수와 CSS 이음새를 적는다
- **이름** — prop 이름은 이 문서와 같다. 같은 생각은 같은 이름이다 — `variant` = 모양 · `tone` = 색의 뜻(DESIGN Colors 다섯 뜻의 하나) · `size` = 단계 이름 · `kind` = 종류 · `container` = 그릇. 이벤트는 `on<동작>`(`onSelect` · `onClose`), 제어 값은 `value` + `onValueChange`, 층은 `open` + `onOpenChange`
- **크기** — 단계 이름으로만 받는다(숫자를 받지 않는다 — typecheck가 막는다). 컨트롤 높이는 DESIGN Layout `컨트롤 높이 단계`(`xs` · `sm` · `sm-plus` · `md` · `lg` · `xl`, 토큰 `--h-*`), 아이콘은 DESIGN Iconography. 부품 고유 치수(원 · 점 · 로고 등)는 단계가 아니라 그 절에 적는다(예외 — `Logo` `size`는 고유 치수 숫자)
- **상태** — 루트 요소의 HTML · ARIA 속성(`disabled` · `aria-pressed` · `aria-selected` · `aria-busy`)이나 `data-*`(`data-state` · `data-variant`)로 낸다. CSS는 그 속성으로 고른다(`.root[data-state='on']`). 클래스 이름으로 상태를 내지 않는다
- **CSS Modules** — 클래스는 kebab-case로 쓰고 TSX에서는 camelCase로 읽는다(`.md-minus` → `styles.mdMinus`). vite `css.modules.localsConvention`이 `camelCaseOnly`라 `styles['md-minus']`는 없다
- **가져오기** — 화면 · 앱 층은 `@/ui`(`src/ui/index.ts`)에서만 가져온다. `ui/` 안쪽 파일 경로로 가져오지 않는다. 적힌 prop만 받는 부품은 그 절에 적는다
- **폭** — 브레이크포인트에서 모양이 바뀌는 부품은 `폭` bullet에 `1680:` · `1500:` · `1360:` · `1100:` · `760:` 줄로 적는다(DESIGN Layout `브레이크포인트`)
- **카탈로그 행** — 절 마지막 bullet에 `/_guide` 절 이름을 backtick으로 적는다(이 행은 그 값만 backtick으로 쓴다). `src/screens/_guide/sections.tsx`의 부품 절은 group 키 바로 다음에 name 키를 쓰고, `check-docs`가 그 name들과 이 문서의 카탈로그 행을 양방향으로 대조한다(한쪽에만 있으면 실패). group은 이 문서의 `##` 묶음 이름이다. 부품이 아닌 절(토큰)은 group을 두지 않는다
- **접근성** — 공통 계약(포커스 링 · 키보드 · 층 포커스 · ARIA 보강)은 DESIGN `## 접근성`. 절마다 `접근성`에는 그 부품에만 있는 계약을 적는다

### 상태
모든 인터랙티브 부품은 아래 상태를 낸다. 표에 없는 상태 · 모양은 그 부품 절에 적는다. 그릇(머리 · 상자 · 레이아웃)은 스스로 상태가 없고 안의 컨트롤이 낸다.

| 상태 | 내는 법 | 모양 |
|---|---|---|
| default | — | 부품 절 |
| hover | `:hover` | 부품 절. 행 · 목록 항목은 `--surface-hover` |
| focus-visible | `base.css` 전역 링 | DESIGN 접근성(자리 · 색만 바꾸고 지우지 않는다) |
| 선택 · 현재 | `aria-pressed` · `aria-selected` · `aria-current` 또는 `data-state` | DESIGN Colors ① 선택 표시 — 자리마다 지금 모양(막대 · 안쪽 테 · 필 · 밑줄 · 행 바탕) |
| disabled | `disabled` 속성 · `[data-disabled]` | `--opacity-disabled` 하나. 탐색 단계 "안 함"은 비활성이 아니라 `--opacity-skipped` |
| 요청 중 | 부품 절 | 이음 자리마다 지금 그대로 — 새 문구 · 스피너를 더하지 않는다 |

## 기본

### Button
- **쓰는 곳** 한 줄 액션 — 화면 머리 · 툴바 · 모달 발 · 드로어 발 · 대시보드 빈 상태 큰 상자의 주 버튼(이음 `.btn` `css/console.css:175-179,640-642`).
- **쓰지 않는 곳** 글자 없는 도구 → `IconButton` · 문장 안 다른 메뉴로 가는 링크 → `<a href>` 링크 부품(대시보드 · 호출 로그를 옮길 때 만든다) · 도크(어두운 바탕) 안 버튼 → 도크 부품(자동 탐색을 옮길 때 만든다).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `variant` | `ButtonVariant` — `default` · `primary` | `default` | `default` = 테두리 버튼(1px `--line-control` · `--surface`), `primary` = 주 액션 필(`--primary` · `--on-fill`) — 한 자리에 하나 |
  | `size` | `ButtonSize` — `sm` · `md` | `md` | 높이 단계(`--h-sm` · `--h-md`). `sm`은 표 행 · 알림 줄 · 작은 판(`css/console.css:179`) |
  | `icon` | `IconName` | 없음 | 글자 앞 아이콘. 크기는 `size`를 따른다(`md` → Icon `md` · `sm` → Icon `sm`) |
  | `type` | `button` · `submit` · `reset` | `button` | HTML 속성 그대로. 기본이 `button`이라 폼 안에서 뜻밖에 제출하지 않는다 |
  | 그 밖 | `<button>` 속성 · `ref` | 없음 | `disabled` · `onClick` · `aria-*` 등을 그대로 넘긴다 |
  - 이음 모달의 `.btn.danger`(`js/menu/deploy.js:207`)는 모양이 없어 `default`로 옮긴다. 도크 안 위험 버튼(`css/console.css:235-236`)은 도크 부품이 맡는다
  - 모달 발 버튼의 최소 폭은 `Modal`이 준다 — 버튼에 폭을 주지 않는다
  - 함께 내보내는 것(`@/ui`) — 타입 `ButtonProps` · `ButtonVariant` · `ButtonSize`
- **상태** hover는 테두리 · 글자가 `--primary`이고 `primary`는 바탕이 `--primary-hover`다(`css/console.css:176-178`). disabled는 공통(`--opacity-disabled` · 커서 `not-allowed`)이고 hover 모양이 바뀌지 않는다(`css/console.css:640-642`). 요청 중에는 쓰는 곳이 `disabled`를 켜고 글자를 진행형으로 바꾼다("배포하는 중…" — `js/menu/deploy.js:107`) — 부품은 스피너를 더하지 않는다.
- **접근성** 아이콘은 장식이라 이름은 글자가 가진다. 누름은 `<button>` 기본 동작(Enter · Space)이다.
- **카탈로그** `Button`

### IconButton
- **쓰는 곳** 아이콘만 있는 도구 — 층 머리 닫기 ✕(`js/common/overlay.js:20`) · 주소 복사(`js/menu/deploy.js:73`).
- **쓰지 않는 곳** 글자가 있는 액션 → `Button` · 레일 · GNB 아이콘 → `셸`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `label` | string | 필수 | 이름(`aria-label`) — 아이콘만 있어 반드시 준다 |
  | `icon` | `IconName` | 필수 | 모양 |
  | `iconSize` | `IconButtonIconSize` — `lg` · `xl` | `lg` | 아이콘 크기 단계 — `xl`은 층 머리 닫기, `lg`는 그 밖(DESIGN Iconography) |
  | `variant` | `IconButtonVariant` — `default` · `on-band` | `default` | `on-band` = 파란 띠(모달 머리) 위 — `--on-fill` 아이콘 · `--on-band-hover` 바탕 · 흰 포커스 링 |
  | 그 밖 | `<button>` 속성 · `ref` | 없음 | `onClick` · `disabled` 등. `children`은 받지 않는다 |
  - 크기는 `--h-sm-plus` 정사각 하나(이음 34 — `css/console.css:182`)
  - 함께 내보내는 것(`@/ui`) — 타입 `IconButtonProps` · `IconButtonVariant` · `IconButtonIconSize`
- **상태** hover는 `--surface-sub` 바탕 + `--text` 아이콘(`css/console.css:183`)이고, `on-band`는 `--on-band-hover` 바탕이다(`css/console.css:406-407`). disabled는 공통이다.
- **접근성** `label`이 `aria-label`이 된다(이음 "닫기" · "주소 복사"). `on-band`의 포커스 링은 흰색(`--on-fill`)이다.
- **카탈로그** `IconButton`

## 상태 표현

### EmptyState
- **쓰는 곳** 비어 있는 자리 — 종류(`kind`) × 그릇(`container`)으로 고른다(DESIGN Copy 빈 상태 · 핵심 규칙 7). 이음 표 행 `td.empty`(`css/console.css:212`) · 점선 상자 `.md-empty`(`css/console.css:366-368`) · 테두리 없는 한 줄 `.empty-s`(`css/console.css:135`) · 아이콘 안내 `.trace-empty`(`css/console.css:769-770`) · 대시보드 큰 상자(`js/menu/dashboard.js:61`).
- **쓰지 않는 곳** 설명 문단("이 도구는 입력이 필요 없습니다.") → 그 자리의 글 · 코드 상자 안 문장("아직 남은 로그가 없습니다.") → 코드 상자 내용 · 탐색 작업 0개 → 절을 그리지 않는다 · 실패 → `FailureBlock`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `kind` | `EmptyKind` — `first` · `filtered` · `section` · `idle` | 필수 | 종류(`data-kind`). 모양은 그릇이 정하고 종류는 문구 · 행동을 정한다 |
  | `container` | `EmptyContainer` — `table` · `panel` · `inline` · `area` | 필수 | 그릇(`data-container`) — 아래 표 |
  | `children` | ReactNode | 필수 | 안내 문장(`copy/`). 다른 메뉴로 가는 링크 버튼은 문장 안에 둔다(`js/menu/studio.js:120`) |
  | `colSpan` | number | `table`에서 필수 | 표 열 수 — `<tr><td colSpan>`를 그린다 |
  | `size` | `EmptyPanelSize` — `md` · `sm` · `hero` | `md` | `panel`만. `hero`는 대시보드 큰 상자 — `kind="first"`에서만 |
  | `title` · `action` | ReactNode | `hero`에서 필수 | 큰 상자 제목(h3) · 주 버튼(`Button variant="primary"`) |
  | `icon` | `IconName` | `area`에서 필수 | 안내 아이콘(`--line-control` 색) |
  | `iconSize` | `EmptyIconSize` — `hero` · `empty` | `empty` | `area`만. `empty`(선 `light`)는 변환 과정 칸, `hero`는 브라우저 캡처 자리 |
  | `className` | string | 없음 | 배치(바깥 여백)만 — 화면 머리 아래 점선 상자의 위아래 여백(`js/menu/studio.js:120` `margin:20px 0`)은 쓰는 곳이 준다 |

  | `container` | 모양 | 이음 근거 |
  |---|---|---|
  | `table` | 표 안 한 행 — 가운데 · 흐린 글자(위아래 `--empty-pad-y`) | `css/console.css:201,212` |
  | `panel` | 점선 상자(`--empty-pad-panel`), `sm`은 작은 판. `hero`는 실선 상자(`--empty-pad-hero`) + 제목 + 보조 문장 + 주 버튼 | `css/console.css:366-368,502` · `js/menu/dashboard.js:61` |
  | `inline` | 테두리 없는 가운데 한 줄 | `css/console.css:135` |
  | `area` | 테두리 없는 큰 자리 + 위 아이콘(위아래 `--empty-pad-y`) | `css/console.css:769-770` |
  - 글자는 흐린 글(`--text-faint`)이고 문장 안 굵은 글(`<b>`)만 한 단계 진하다(`css/console.css:368`)
  - 함께 내보내는 것(`@/ui`) — 타입 `EmptyStateProps` · `EmptyKind` · `EmptyContainer` · `EmptyPanelSize` · `EmptyIconSize`
- **상태** 없다(그릇). 문장 안 링크 · 버튼이 상태를 낸다.
- **접근성** 아이콘은 장식(`aria-hidden`)이다. 빈 상태는 알림이 아니라 `role`을 두지 않는다(이음 그대로).
- **카탈로그** `EmptyState`

### FailureBlock · ErrorBlock
- **쓰는 곳** 요청 실패를 그 자리에 보일 때 — 이음 알림 상자(`.notice` `css/console.css:270-272` + `warn` · `danger` `css/console.css:643-649`)에 경고 아이콘 + 굵은 머리 한 줄(있는 자리만) + 서버 문장 원문(DESIGN Copy 실패 · 핵심 규칙 8). `FailureBlock`은 화면 첫 조회 실패(`ScreenState`가 그린다) · 층 안 요청 실패(`js/menu/deploy.js:116,120` · `js/menu/sources.js:74` · `js/menu/discovery.js:267-268` · `js/menu/logs.js:45`)에, `ErrorBlock`은 화면 안 영역 첫 조회 실패(그 상자 안)에 쓴다.
- **쓰지 않는 곳** 버튼 한 번의 쓰기 실패 → 경고 토스트 · 새로 받기 · 폴링 실패 → 표시 없음(이전 값) · 결과의 일부인 실패(`ok: false`) → 결과 렌더 · 실패가 아닌 안내 · 정보 상자 → Notice(원본 시스템을 옮길 때 만든다).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `message` | string | 필수 | 원문 — `ApiError.message`(서버 `resultMsg` 그대로 또는 `copy/errors`의 고정 문구). 줄바꿈을 지킨다(`white-space: pre-wrap` — `js/menu/deploy.js:116`) |
  | `tone` | `FailureTone` — `warn` · `danger` | 필수 | 색의 뜻 — 자리마다 이음 그대로(연결 · 탐색 · 변환 과정 `warn`, 배포 · 로그 상세 `danger`) |
  | `title` | ReactNode | 없음 | 굵은 머리 한 줄(`copy/` — 예 "연결하지 못했습니다."). 없으면 원문만 |
  | `className` | string | 없음 | 배치(바깥 여백)만 |
  - `ErrorBlock` — `message` · `className`만 받는다. `FailureBlock tone="warn"` + 머리 없음과 같은 모양(같은 CSS)이고, 영역 실패 자리가 tone · 머리를 고를 수 없게 이름을 따로 둔다
  - 색 — 바탕 `--warn-bg` · `--danger-bg`, 아이콘 `alert` `lg`(`--warn` · `--danger`). 머리는 굵은 `--text`, 원문은 `--text-muted`
  - 복사 · 재시도 버튼은 없다(이음에 없음). 버튼이 함께 있는 자리(배포 확인 모달 "다시 시도" — `js/menu/deploy.js:115`)는 버튼을 상자 밖에 둔다
  - 함께 내보내는 것(`@/ui`) — 타입 `FailureBlockProps` · `FailureTone` · `ErrorBlockProps`
- **상태** 없다.
- **접근성** 실패는 아이콘 + 문장 + 원문으로 전한다(색만이 아니다). `role`은 두지 않는다(이음 그대로).
- **카탈로그** `FailureBlock` · `ErrorBlock`

### ScreenState
- **쓰는 곳** 조회를 기다리거나 받지 못한 자리 — 셸 본문(셸 조회), 화면 본문(화면 조회), 화면 안 영역(region 조회). 판정은 `app/screenGate`(`screenGate` · `regionGate`)가 하고 이 부품은 그 결과를 그리기만 한다.
- **쓰지 않는 곳** 판정(쿼리 묶기 · 404 · 이전 값 유지) → `app/screenGate` · 버튼 한 번의 쓰기 → 그 버튼의 요청 중 모양 · 폴링 중 표시 → 그리지 않는다.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `gate` | `ScreenGate<D>` — `pending` · `not-found` · `error` · `empty` · `ready` | 필수 | `screenGate` · `regionGate`의 결과 그대로 |
  | `children` | `(data: D) => ReactNode` | 필수 | `ready`에 그린다(`empty`인데 `empty` prop이 없을 때도) |
  | `empty` | `(data: D) => ReactNode` | 없음 | `empty`에 그린다 — 대개 `EmptyState`(화면 머리가 함께 있는 화면은 머리까지) |
  | `notFound` | ReactNode | 없음 | `not-found`에 그린다(없는 탐색 작업 주소). 없으면 `error`처럼 실패 상자를 그린다 |
  | `scope` | `ScreenStateScope` — `screen` · `region` | `screen` | 실패 모양 — `screen` = `FailureBlock tone="warn"` + 머리 `SCREEN_FAILED_TITLE`("서버에서 데이터를 불러오지 못했습니다." — `js/main.js:67`), `region` = `ErrorBlock` |

  | `gate.kind` | 그리는 것 |
  |---|---|
  | `pending` | 빈 `<div aria-busy="true">` — 문구 · 스피너 없음(옛 부트 `js/main.js:65`와 같은 모양) |
  | `error` | `scope`의 실패 상자. 원문은 오류의 `message`(Error가 아니면 문자열로 바꾼 값). 재시도 버튼 없음 |
  | `not-found` | `notFound` |
  | `empty` · `ready` | `empty(data)` · `children(data)` |
  - 여백은 감싸는 자리(본문 · 상자)가 준다. 셸 본문 · 화면 본문 · 영역이 겹쳐도 각자 자기 자리만 비운다
  - 함께 내보내는 것(`@/ui`) — 타입 `ScreenStateProps` · `ScreenGate` · `ScreenStateScope`
- **상태** `pending`만 `aria-busy="true"`를 낸다 — 다른 상태가 되면 그 요소가 사라져 `aria-busy`가 풀린다(옛 부트 실패는 남았다 — DESIGN `## 이식 기간` 고침).
- **접근성** 첫 로딩은 `aria-busy`(문구 없음)뿐이다. 실패 원문은 화면에 보이는 글이다.
- **카탈로그** `ScreenState`

## 층

층 공통 — `ui/layers`(안쪽 전용 — `@/ui`로 내보내는 것은 `closeAllLayers` · `useOpenLayers` 둘). 쓰는 곳은 DESIGN 쌓임 · 접근성 `층`.
- **여는 법** — 기본 `<dialog>`를 `show()`로 연다(top layer를 쓰지 않는다). 포커스를 가두지 않는다 — Tab이 층 밖으로 나간다(이음 그대로 — 닫은 뒤 포커스 복귀만 더했다)
- **가림막 · z** — 층마다 `Overlay`를 함께 그리고 z는 DESIGN 쌓임 짝(`--z-modal-scrim` · `--z-modal`, 드로어는 `--z-drawer-scrim` · `--z-drawer`)이다. 층과 가림막은 `document.body`로 포털한다(셸의 쌓임 맥락 밖)
- **Esc** — 문서의 keydown 하나가 열린 층 목록의 맨 위 층만 닫는다(이음 `js/main.js:55` — 모달이 있으면 모달만). 한글 조합 중 Esc는 무시한다. 맨 위 층이 `dismissible=false`면 아무것도 하지 않는다
- **포커스 복귀** — 열 때 포커스가 있던 요소를 기억했다가 닫을 때 돌려준다. 그 요소가 사라졌으면 `returnFocusFallback()`이 준 곳으로. 닫는 순간 포커스가 층 안에 있거나 사라졌을 때만 옮긴다 — 층 밖으로 Tab해 간 포커스는 빼앗지 않는다
- **메뉴 이동** — `closeAllLayers()`가 열린 층을 위에서부터 모두 닫는다(`dismissible`과 상관없이). 셸이 메뉴(`menuOf`)가 바뀔 때 부른다. 화면이 쥔 층은 화면이 사라지며 함께 닫힌다
- **열린 층** — `useOpenLayers()`가 `{ modal: boolean; drawer: boolean }`을 돌려준다 — 지금 열린 층 중 모달 · 드로어가 있는지(층이 열리고 닫힐 때 다시 그려지고, 요약이 그대로면 그리지 않는다). 화면이 층 때문에 멈추거나 숨길 때 읽는다 — 모달이 열린 동안 폴링을 멈추고(이음 `js/menu/deploy.js:133`), 드로어가 열리면 도크를 숨긴다(`css/console.css:225`). 층을 열고 닫는 값이 아니라 읽기 전용이다. 카탈로그 Modal 절의 "useOpenLayers" 줄이 이 값을 보인다
- **공통 prop** — `open` · `onOpenChange`(✕ · 취소 · Esc · 가림막 모두 `onOpenChange(false)`) · `dismissible`(기본 true) · `returnFocusFallback`

### Overlay
- **쓰는 곳** 층 뒤 가림막 — `Modal`(그리고 대시보드 · 호출 로그를 옮길 때 만드는 Drawer)이 안에서 그린다(이음 `.overlay` · `.overlay.m` `css/console.css:239-241`, `index.html:42,44`).
- **쓰지 않는 곳** 화면 · 앱 층이 가림막만 쓰기 → 층 부품(`Modal`) — `@/ui`로 내보내지 않는다.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `layer` | `LayerKind` — `modal` · `drawer` | 필수 | z 짝 — `--z-modal-scrim` · `--z-drawer-scrim` |
  | `open` | boolean | 필수 | 보임(`data-open`) — 투명도 전환 `--m-fade` |
  | `onDismiss` | `() => void` | 없음 | 누르면 부른다. 층이 `dismissible=false`면 주지 않는다 |
  - 화면 전체(`position: fixed` · `inset: 0`) · `--scrim`
- **상태** `data-open` — 닫혀 있으면 투명 · 누름 통과, 열리면 보이고 누름을 받는다(`css/console.css:239-240`).
- **접근성** 장식(`aria-hidden`)이다 — 키보드는 Esc로 닫는다.
- **카탈로그** `Modal`

### Modal
- **쓰는 곳** 본문 위에 뜨는 확인 · 입력 · 안내 — 1차 개발 범위(셸) · 재인증 · 삭제 확인(원본 시스템) · 배포 계열(AI 연결 배포) · 탐색 기록 삭제(자동 탐색)(이음 `openModal` `js/common/overlay.js:16-25`, `css/console.css:402-411`).
- **쓰지 않는 곳** 여러 단계 · 긴 상세 → Drawer · 버튼 한 번의 결과 알림 → 토스트 · `window.confirm` · `alert` · `prompt` → 이 부품(쓰지 않는다 — oxlint `no-alert`).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `open` · `onOpenChange` | boolean · `(open: boolean) => void` | 필수 | 제어(층 공통) |
  | `title` | ReactNode | 필수 | 머리(파란 띠) 제목 — `aria-labelledby` 대상 |
  | `children` | ReactNode | 필수 | 본문(넘치면 본문만 스크롤) |
  | `size` | `ModalSize` — `md` · `wide` | `md` | 폭 `--w-modal` · `--w-modal-wide`(화면이 좁으면 화면 폭 − 양옆 `--s-4`) |
  | `confirmLabel` · `onConfirm` | ReactNode · `() => void` | 없음 | 확인 버튼(`primary`, 발 끝). 없으면 확인 버튼 없음(안내 모달). 누르면 `onConfirm`만 부른다 — 닫기는 쓰는 곳이 성공 뒤에 한다(`js/main.js:42`) |
  | `confirmDisabled` | boolean | false | 요청 중 확인 잠금(연타로 요청이 겹치지 않게) |
  | `cancelLabel` | ReactNode | `LAYER_COPY.cancel` | 취소 버튼 글자 — 안내 모달은 "닫기" |
  | `hideCancel` | boolean | false | 취소 버튼을 없앤다(이음 `opt.noCancel`) |
  | `extra` | ReactNode | 없음 | 발에서 취소 앞에 두는 것(이음 `opt.extra`) |
  | `dismissible` | boolean | true | false면 Esc · 가림막으로 닫히지 않는다 — 한 번만 보이는 값(키 발급 결과). ✕ · 취소는 그대로 닫는다(`data-dismissible`) |
  | `returnFocusFallback` | `() => HTMLElement \| null` | 없음 | 연 컨트롤이 닫힐 때 사라졌으면 포커스를 둘 곳 |
  - 머리 — 파란 띠(`--h-modal-head` · `--brand-band`) + 제목 + 닫기 ✕(`IconButton variant="on-band" iconSize="xl"` — `css/console.css:405-407`). 본문 — 안쪽 `--modal-pad`, 넘치면 본문만 스크롤. 발 — 가운데 정렬, 버튼 최소 폭 96(`css/console.css:408-411`)
  - 상자 — `--shadow-float` · 최대 높이는 화면 높이에서 위아래 여백을 뺀 값. 나타남 · 사라짐은 `--m-modal` 페이드 + 조금 아래에서 올라옴(`css/console.css:402-404`)
  - 열린 모달에 다른 내용을 보이기(이음 "내용 교체" — `js/menu/deploy.js:120,176`)는 같은 Modal의 `title` · `children`을 바꾼다
  - 함께 내보내는 것(`@/ui`) — `closeAllLayers` · `useOpenLayers` · 타입 `ModalProps` · `ModalSize` · `OpenLayers`
- **상태** `data-size` · `data-dismissible`. 첫 포커스는 열릴 때 다음 순서의 첫 대상이다. ① 본문의 첫 `input`(숨김 · 잠긴 것은 건너뛴다 — `select` · `textarea`는 앞에 있어도 입력으로 치지 않는다) ② 없으면 확인 버튼(주색, 잠겨 있으면 건너뛴다) ③ 둘 다 없으면 머리 ✕. 이음 `js/common/overlay.js:23`(`.m-body input` → 확인 버튼)과 같고, 확인 버튼이 없는 안내 모달만 옛은 포커스를 옮기지 않았는데 ✕로 옮긴다(DESIGN `## 이식 기간` 허용 차이 — 사용자가 확인한 결정이다).
- **접근성** `<dialog aria-modal="true" aria-labelledby>`다(이음 `index.html:45`). 포커스를 가두지 않고, 닫으면 연 컨트롤로 돌아간다(층 공통 — 이음은 돌아가지 않았다). 머리 ✕의 링은 흰색이다.
- **카탈로그** `Modal`

## 레이아웃

### PageHead
- **쓰는 곳** 화면 맨 위 제목 + 설명 — 메뉴 화면 여섯(이음 `pageHead(id)` `js/common/state.js:21`, `css/console.css:109-111`). 빈 상태 화면(스튜디오 · 테스트 실행 · 배포)도 같은 머리를 쓴다(`js/menu/studio.js:120`).
- **쓰지 않는 곳** 탐색 작업 화면 머리(뒤로 링크 + 상태 칩 + 오른쪽 버튼 — `js/menu/discovery.js:251-258`) → 자동 탐색을 옮길 때 이 부품에 변형을 더한다 · 상자 · 절 제목 → 상자 부품(대시보드 · 호출 로그를 옮길 때 만든다).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `title` | ReactNode | 필수 | 제목(h2). 메뉴 화면은 `SCREEN_LABEL` |
  | `description` | ReactNode | 없음 | 설명 한 줄 — 메뉴 화면은 `copy/shell` `PAGE_DESCRIPTION` |
  | `className` | string | 없음 | 배치(바깥 여백)만 |
  - 제목과 설명은 글자 바닥선에 맞춰 한 줄에 놓이고 좁으면 설명이 아래로 접힌다. 아래에 1px `--line-divider`
- **상태** 없다(그릇).
- **접근성** 제목은 h2다 — 문서의 h1은 LNB 제목 하나다(`index.html:36`).
- **폭**
  - 760: 제목이 한 단계 작아진다(`--fs-title-sm` — `css/console.css:462`)
- **카탈로그** `PageHead`

### 셸
- **쓰는 곳** 모든 메뉴 화면의 틀 — 레일 · GNB · LNB · 본문(이음 `index.html:13-40`, `css/console.css:72-111,486-499`). `src/app/shell/`에 있고 `@/ui`가 아니다 — 앱 층의 `RootLayout`(`src/app/RootLayout.tsx`)이 `<Shell />`을 그린다. 카탈로그(`/_guide`)는 셸 밖이다.
- **쓰지 않는 곳** 화면 안 배치 → 레이아웃 부품 · 화면 제목 → `PageHead`.
- **prop · 크기** `Shell`은 prop이 없다 — 본문 자리는 `<Outlet />`. 아래는 셸 조각(`app/shell/`)의 prop이다

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `Gnb` `workspace` | `Workspace` | 없음 | 회사 · 사용자 — `useSources`의 workspace. 받기 전 · 실패면 비운다(`js/main.js:66`) |
  | `Gnb` `onScopeOpen` | `() => void` | 필수 | "1차 개발 범위" 버튼 |
  | `Lnb` `current` | `ScreenId \| null` | 필수 | 현재 메뉴 — `menuOf(pathname)`(탐색 작업 주소는 원본) |
  | `ScopeModal` `open` · `onOpenChange` | 층 공통 | 필수 | 1차 개발 범위 모달 |
  - 레일 — 어두운 세로 줄(`--w-rail` · `--rail-bg`), 버튼 `--h-rail-btn` 정사각 · 아이콘 `shell`. 현재(게이트웨이 관리)는 `--rail-active-bg` + 왼쪽 `--primary` 막대. 화면 높이로 문서에 붙어 있다(`position: sticky`)
  - GNB — 흰 줄(`--h-gnb` · 좌우 `--gnb-pad-x`). 로고 `Logo` 26 + "이음" + 표지(`--primary` 바탕), 회사 버튼(`--h-sm-plus` 알약 · `--primary` 점), "1차 개발 범위"(`--h-sm` 알약 · `--primary-bg` · `--primary-line` · `--primary-ink`), 장식 아이콘 doc · bell · help(`shell`, 포커스 없음), 아바타(32 원 · `--avatar-from` → `--avatar-to` · `--avatar-ink`) + 사용자명
  - LNB — 파란 띠(`--brand-band` · 높이 `--h-lnb` · 좌우 `--lnb-pad-x`). 제목 h1 + 메뉴 링크 여섯(`--on-fill-muted`, 현재는 `--on-fill` 굵게 + 아래 흰 막대). 자간은 `--tracking-control` — 옛 메뉴는 `<button>`이라 `body` 자간을 물려받지 않았다(폭을 옛과 같게). 링크 주소는 `useMenuHref(id)`(메뉴별 마지막 주소). 누르면 `refreshMenu(id)`(`app/menuRefresh.ts`)로 그 메뉴의 자료를 다시 받는다 — 같은 메뉴를 다시 눌러도 갱신된다(옛 nav `js/main.js:29`)
  - 본문 `<main>` — 안쪽 `--content-pad-top` · `--content-pad-x` · `--content-pad-bottom`. 스크롤은 문서가 한다
  - 셸 조회 — `useSources` 하나(GNB의 workspace)를 `ScreenState`로 감싼다: 첫 로딩은 본문을 비우고 `aria-busy`, 실패는 본문 자리 실패 상자(레일 · GNB · LNB는 남는다)
  - 1차 개발 범위 모달 — `Modal size="wide"` · 확인 없음 · 취소 자리 "닫기". 본문 두 열 — 머리(아이콘 `check` `md` `bold` · `layers` `md`) + 목록. 문구는 `copy/shell` `SCOPE`(서버 사실과 다른 옛 문구 그대로 — DESIGN `## 이식 기간` 보존)
- **상태** 현재 메뉴 링크 · 현재 레일 버튼은 `aria-current="page"`다. hover — 레일 버튼 `--on-fill-hover` 바탕 · `--on-fill` 아이콘, "1차 개발 범위" 테두리 `--primary`, 메뉴 글자 `--on-fill`.
- **접근성** 랜드마크는 `aside`(서비스 메뉴) · `header` · `nav`(이음 관리 메뉴) · `main`이다(`index.html:14,24,37,39`). 동작 없는 레일 버튼 · 회사 버튼도 버튼 그대로다. LNB 링크의 포커스 링은 흰색 · 안쪽이다. 메뉴를 옮기면 열린 층을 닫는다(`closeAllLayers`). 좁은 폭에서 메뉴 줄은 가로 스크롤하고, 메뉴가 바뀌면 현재 메뉴가 보이게 줄만 옮긴다(`js/main.js:15` — 문서는 세로로 움직이지 않는다).
- **폭**
  - 1680: 본문 위 · 좌우 `--content-pad-x-1680`
  - 1500: 메뉴 글자 한 단계 작게 · 좌우 좁게(`css/console.css:861-862`)
  - 1100: 회사 버튼 숨김
  - 760: 레일 숨김 · GNB 좁게 · "1차 개발 범위" · doc · help · 사용자명 숨김 · LNB 두 줄(제목 한 줄 + 메뉴 줄 가로 스크롤, 메뉴 높이 `--h-lnb-narrow`) · 본문 `--content-pad-narrow` · 범위 모달 한 열(`css/console.css:450-461,887-889,900`)
- **카탈로그** `셸`

## 아이콘

### Icon
- **쓰는 곳** 뜻을 보조하는 장식 그림 — 버튼 · 아이콘 버튼 안, 알림 상자 · 토스트, 칩 빼기, 레일 · GNB, 빈 상태 안내, 단계 완료 점. 닫기 · 완료 · 방향도 글리프가 아니라 Icon으로 그린다.
- **쓰지 않는 곳** 이음 로고 → `Logo` · 혼자 뜻을 전해야 하는 자리 → 감싼 버튼의 `aria-label`이나 곁의 글 · 숫자 크기 · 색 지정 → `size` 단계 · 쓰는 곳의 `color`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `name` | `IconName` — 38종(DESIGN Iconography) | 필수 | 모양의 뜻. 서버가 주는 문자열은 `iconOf(value)`로 바꿔 넘긴다 |
  | `size` | `IconSize` — `xs` · `sm` · `md-minus` · `md` · `lg` · `xl` · `shell` · `hero` · `empty` | `md` | 크기 단계(토큰 `--icon-*` — 쓰는 곳은 DESIGN Iconography) |
  | `stroke` | `IconStroke` — `light` · `bold` · `heavy` | 없음 | 선 두께 단계(`--icon-stroke-*`). 생략하면 기본 `--icon-stroke` |
  | `className` | string | 없음 | 배치(여백 · flex)만. 크기 · 선 · 색을 덮지 않는다 |
  - 적힌 prop만 받는다 — HTML 속성 · `ref`는 넘기지 않는다
  - 함께 내보내는 것(`@/ui`) — `iconOf(value)` → `IconName`(모르는 값은 `apps` + 개발 빌드에서 값마다 경고 한 번) · `ICON_NAMES`(등록 순서) · `ICON_SIZES` · `ICON_STROKES` · 타입 `IconName` · `IconSize` · `IconStroke` · `IconProps`
  - 단계 이름 ↔ 토큰은 `Icon.module.css`가 잇는다(`.md-minus` → `styles.mdMinus`). 새 아이콘은 `svg/<Name>.tsx` + `names.ts` `ICONS` 한 줄(DESIGN Iconography)
- **상태** 없다(장식).
- **접근성** 늘 `aria-hidden` · `focusable="false"`라 보조기기에 읽히지 않는다. 아이콘만 있는 버튼은 버튼에 `aria-label`이 필수다.
- **카탈로그** `Icon`

### Logo
- **쓰는 곳** 이음 로고(돼지코 모양 — 변환 어댑터) — GNB · 대시보드 구조도 허브 · 스튜디오 파이프라인 허브.
- **쓰지 않는 곳** 그 밖의 그림 → `Icon`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `size` | `LogoSize` — `26` · `24` · `20` | `26` | 고유 치수(아이콘 단계 밖) — 26 GNB · 24 구조도 허브 · 20 파이프라인 허브 |
  | `className` | string | 없음 | 배치만 |
  - 색은 `currentColor` — 쓰는 곳이 `color`로 준다(GNB는 주조, 파란 허브 위는 `--on-fill`)
  - 함께 내보내는 것(`@/ui`) — `LOGO_SIZES` · 타입 `LogoSize` · `LogoProps`
  - 크기 클래스는 `Logo.module.css`(`.size26` …). 높이 px는 파생 치수 끄는 주석으로 둔다
- **상태** 없다(장식).
- **접근성** 장식(`aria-hidden` · `focusable="false"`)이다.
- **카탈로그** `Logo`
