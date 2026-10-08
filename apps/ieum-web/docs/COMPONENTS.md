# COMPONENTS — 이음 웹 콘솔

부품 계약 — 쓰는 곳 · 쓰지 않는 곳 · prop · 크기 · 상태 · 접근성. 규칙(언제 무엇을 쓰는지)은 `DESIGN.md`, 값의 원본은 `src/styles/tokens.css`. 모양 · 동작은 이음 원본 콘솔이 기준이다.
구현은 **React + CSS Modules**(`src/ui`, 새 의존성 없음). 토큰은 CSS 변수 이름(`--primary`)으로만 부른다. 안쪽 여백 · 글자 크기 같은 내부 치수의 원본은 각 `*.module.css`다.

## 공통 계약

- **절 형식** — 부품 절은 아래 bullet을 이 순서로 쓴다. 해당 없는 bullet은 두지 않는다
  - `쓰는 곳` → `쓰지 않는 곳` → `prop · 크기` → `상태` → `접근성` → `폭` → `카탈로그`
  - 쓰는 곳 · 쓰지 않는 곳 · 상태 · 접근성은 문장이라 마침표로 끝내고, prop 줄 · 하위 bullet · 폭 · 카탈로그는 마침표 없이 끝낸다
  - 쓰지 않는 곳은 "자리 → 대신 쓸 부품" 꼴로 적는다
- **prop 표** — `prop · 크기` 아래에 표 하나를 둔다. 열은 `prop` · `타입` · `기본값` · `뜻`. 타입이 유니온이면 값을 ` · `로 늘어놓는다. 기본값 `필수`는 반드시 주는 prop, `없음`은 생략 가능 · 기본값 없음이다. 표 아래 하위 bullet에 함께 내보내는 상수 · 함수와 CSS 이음새를 적는다
- **이름** — prop 이름은 이 문서와 같다. 같은 생각은 같은 이름이다 — `variant` = 모양 · `tone` = 색의 뜻(DESIGN Colors 다섯 뜻의 하나, 또는 무채색 `mute` — `Tag`만 무채색 `neutral`을 더 받는다) · `size` = 단계 이름 · `kind` = 종류 · `container` = 그릇 · `description` = 제목 곁 보조 글 · `label` = 보이지 않는 이름(`aria-label`)이거나 칸 · 칩의 글자. 이벤트는 `on<동작>`(`onSelect` · `onClose`), 제어 값은 `value` + `onValueChange`, 층은 `open` + `onOpenChange`
- **크기** — 단계 이름으로만 받는다(숫자를 받지 않는다 — typecheck가 막는다). 컨트롤 높이는 DESIGN Layout `컨트롤 높이 단계`(`xs` · `sm` · `sm-plus` · `md` · `lg` · `xl`, 토큰 `--h-*`), 아이콘은 DESIGN Iconography. 부품 고유 치수(원 · 점 · 로고 · 태그 높이 등)는 단계가 아니라 그 절에 적는다(예외 — `Logo` `size` · `Table` · `CompactTable` `minWidth`는 고유 치수 숫자)
- **상태** — 루트 요소의 HTML · ARIA 속성(`disabled` · `aria-pressed` · `aria-selected` · `aria-busy`)이나 `data-*`(`data-state` · `data-variant`)로 낸다. CSS는 그 속성으로 고른다(`.root[data-state='on']`). 클래스 이름으로 상태를 내지 않는다
- **CSS Modules** — 클래스는 kebab-case로 쓰고 TSX에서는 camelCase로 읽는다(`.md-minus` → `styles.mdMinus`). vite `css.modules.localsConvention`이 `camelCaseOnly`라 `styles['md-minus']`는 없다
- **가져오기** — 화면 · 앱 층은 `@/ui`(`src/ui/index.ts`)에서만 가져온다. `ui/` 안쪽 파일 경로로 가져오지 않는다. 적힌 prop만 받는 부품은 그 절에 적는다. `ui`가 앱 층에서 가져오는 것은 타입뿐이다(`app/screenGate` · `app/toast` · `app/trace/types`) — 메뉴 문구(`copy/<menu>.ts`)는 가져오지 않고 글자를 prop · 데이터로 받는다
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
- **쓰는 곳** 한 줄 액션 — 화면 머리 · 툴바 · 모달 발 · 드로어 발 · 알림 줄 · 대시보드 빈 상태 큰 상자의 주 버튼(이음 `.btn` `css/console.css:175-179,640-642`).
- **쓰지 않는 곳** 글자 없는 도구 → `IconButton` · 문장 · 상자 머리 안 링크 모양 → `LinkButton` · 도크(어두운 바탕) 안 버튼 → `DockButton`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `variant` | `ButtonVariant` — `default` · `primary` | `default` | `default` = 테두리 버튼(1px `--line-control` · `--surface`), `primary` = 주 액션 필(`--primary` · `--on-fill`) — 한 자리에 하나 |
  | `size` | `ButtonSize` — `sm` · `md` | `md` | 높이 단계(`--h-sm` · `--h-md`). `sm`은 표 행 · 알림 줄 · 작은 판(`css/console.css:179`) |
  | `icon` | `IconName` | 없음 | 글자 앞 아이콘. 크기는 `size`를 따른다(`md` → Icon `md` · `sm` → Icon `sm`) |
  | `type` | `button` · `submit` · `reset` | `button` | HTML 속성 그대로. 기본이 `button`이라 폼 안에서 뜻밖에 제출하지 않는다 |
  | `pending` | boolean | false | 요청 중 잠금(쓰기 버튼 · 진행 중인 요청의 결과를 기다리는 버튼) — `aria-disabled="true"` · 누름 · Enter · Space를 무시(`onClick`을 부르지 않고 폼 제출도 막는다) · 비활성 모양. 포커스는 버튼에 남는다 |
  | 그 밖 | `<button>` 속성 · `ref` | 없음 | `disabled` · `onClick` · `aria-*` 등을 그대로 넘긴다 — `aria-disabled`는 받지 않는다(`pending`이 낸다) |
  - 잠금은 둘이다 — `disabled`는 조건이 안 맞아 못 누르는 것(마법사 첫 단계의 "이전" · 값이 없는 "다음" — native라 포커스를 받지 않고 Tab이 건너뛴다), `pending`은 요청 중 잠금이다. 요청 중 잠금은 쓰기 버튼과 진행 중인 요청의 결과를 기다리는 버튼(마법사에서 연결 · 분석이 끝나야 넘어가는 "변환 스튜디오에서 검토"처럼 포커스된 버튼이 그 자리에서 바뀌는 것)에만, 반드시 `pending`으로 한다 — 포커스된 버튼에 native `disabled`를 걸면 Chrome이 포커스를 `body`로 빼서 키보드 사용자가 자리를 잃고, 풀린 뒤 Enter가 아무것도 누르지 않는다
  - 이음 모달의 `.btn.danger`(`js/menu/deploy.js:207`)는 모양이 없어 `default`로 옮긴다. 도크 안 버튼(`css/console.css:231-236`)은 `DockButton`이 맡는다 — 쓰는 화면이 있는 주 버튼만 옮겼다
  - 모달 · 드로어 발 버튼의 최소 폭은 `Modal` · `Drawer`가 준다 — 버튼에 폭을 주지 않는다
  - 함께 내보내는 것(`@/ui`) — 타입 `ButtonProps` · `ButtonVariant` · `ButtonSize`
- **상태** hover는 테두리 · 글자가 `--primary`이고 `primary`는 바탕이 `--primary-hover`다(`css/console.css:176-178`). disabled는 공통(`--opacity-disabled` · 커서 `not-allowed`)이고 hover 모양이 바뀌지 않는다(`css/console.css:640-642`). 요청 중에는 쓰는 곳이 `pending`을 켜고 글자를 진행형으로 바꾼다("배포하는 중…" — `js/menu/deploy.js:107`) — 부품은 스피너를 더하지 않는다. `pending`의 모양은 disabled와 같다(`aria-disabled="true"`로 고른다).
- **접근성** 아이콘은 장식이라 이름은 글자가 가진다. 누름은 `<button>` 기본 동작(Enter · Space)이다. `pending`은 `aria-disabled="true"`라 Tab으로 닿고 잠긴 동안에도 포커스가 버튼에 남는다(스크린리더는 비활성으로 읽는다) — 풀리면 그 자리에서 Enter · Space가 다시 누른다.
- **카탈로그** `Button`

### IconButton
- **쓰는 곳** 아이콘만 있는 도구 — 층 머리 닫기 ✕(`js/common/overlay.js:20` · `js/menu/logs.js:35`) · 주소 복사(`js/menu/deploy.js:73`).
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

### LinkButton
- **쓰는 곳** 링크 모양 글자 — 다른 메뉴로 가기(상자 머리 "호출 로그 보기" `js/menu/dashboard.js:47`, 빈 상태 문장 안 "원본 시스템" `js/menu/studio.js:120` · `js/menu/playground.js:36`), 화면 안 동작 글자(변환 스튜디오 "AI로 다시 쓰기" `js/menu/studio.js:96` · "탐색 근거 보기" `:63`, 탐색 마법사 "시연용 값 채우기" `js/menu/discovery.js:42`), 표 안 도구 id(`js/menu/deploy.js:87`), 탐색 작업 머리 뒤로(`js/menu/discovery.js:256`)(이음 `.link` `css/console.css:184`).
- **쓰지 않는 곳** 테두리 · 필이 있는 액션 · 알림 줄 작은 버튼 → `Button`(`size="sm"`) · 도크 "추천만 선택"(어두운 바탕 `.dock .clr` — `js/menu/discovery.js:316`) → `DockLinkButton` · LNB 메뉴 → `셸`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `to` | `To`(react-router) | 없음 | 있으면 이동 링크 — 라우터 `Link`(`<a href>`). 주소는 쓰는 곳이 앱 층 도우미로 만든다 |
  | `onClick` | 마우스 이벤트 처리기 | `to`가 없으면 필수 | `to`가 없으면 `<button type="button">`의 동작. `to`와 함께면 이동 전에 부른다(메뉴 다시 받기 등) |
  | `disabled` | boolean | false | 버튼일 때만(`to`와 함께 쓰지 않는다 — 타입이 막는다). 조건이 안 맞아 못 누르는 것 — native라 포커스를 받지 않는다 |
  | `pending` | boolean | false | 버튼일 때만. 요청 중 잠금 — `Button` `pending`과 같은 계약(`aria-disabled="true"` · 누름 · Enter · Space를 무시하고 포커스는 버튼에 남는다). 요청 중 잠금은 `disabled`가 아니라 이것으로 한다("AI로 다시 쓰기" 등 쓰기 동작 글자) |
  | `variant` | `LinkButtonVariant` — `underline` · `mono` · `back` | `underline` | `underline` = 밑줄 글자(`.link`), `mono` = 밑줄 없는 고정폭 작은 글자(도구 id — `js/menu/deploy.js:87`), `back` = 밑줄 없음 + 앞 `back` 아이콘(`md-minus`) 한 단계 큰 글자(`js/menu/discovery.js:256`) |
  | `children` | ReactNode | 필수 | 글자 |
  - 색은 `--primary` 하나. 모양 · 글자 크기는 `variant`가 정한다(`size` 없음)
  - 함께 내보내는 것(`@/ui`) — 타입 `LinkButtonProps` · `LinkButtonVariant`
- **상태** hover 모양이 없다 — 옛 `.link`에 `:hover`가 없다(포커스 링만). disabled · pending도 모양이 바뀌지 않는다(옛 `.link`에 비활성 모양이 없다 — 쓰는 곳이 글자를 진행형으로 바꿔 알린다, "쓰는 중…" `js/menu/studio.js:152`). 공통 disabled(`--opacity-disabled`)를 쓰지 않는 자리다. 옛은 요청 중 native disabled라 키보드로 누르면 포커스를 잃었다 — 요청 중 잠금은 `pending`(DESIGN 이식 기간 고침 "요청 중 잠금"과 같은 갈래).
- **접근성** `to`면 링크(Enter로 이동), 아니면 버튼(Enter · Space)이다 — 옛은 모두 `<button>`이었고 이동하는 것만 링크가 된다(DESIGN 이식 기간 허용 차이 — LNB와 같은 갈래). `back` 아이콘은 장식이다.
- **카탈로그** `LinkButton`

## 입력

### Select
- **쓰는 곳** 여러 값 중 하나 고르기 — 툴바 필터(호출 로그 AI 클라이언트 `js/menu/logs.js:21` · 원본 시스템 `js/menu/sources.js:26` · 스튜디오 원본 `js/menu/studio.js:128`), 폼 칸(테스트 실행 도구 · 탐색 마법사 — `js/menu/playground.js:47`), 표 안 칸(스튜디오 매핑 — `css/console.css:1074-1077`), 설정 줄 오른쪽(탐색 시작 시각 "지금 바로" · "시각 예약" — `js/menu/discovery.js:76`).
- **쓰지 않는 곳** 두세 모드 고르기 → `SegmentedRadio` · 미리보기 탭 → `SegmentedTabs` · 설명이 붙은 선택지 → `RadioCard` · `RadioList` · 화면 안 상태 필터 → `FilterChips`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `variant` | `SelectVariant` — `toolbar` · `form` · `cell` · `setting` | 필수 | 모양과 높이 — 아래 표 |
  | `width` | `SelectWidth` — `wide` | 없음 | `toolbar`만 — 최대 폭을 280으로(스튜디오 원본 선택 — 옛 인라인 `max-width:280px` `js/menu/studio.js:128`). 없으면 변형이 폭을 정한다 |
  | `value` | string | 필수 | 고른 값 |
  | `onValueChange` | `(value: string) => void` | 필수 | 바꾸면 그 값(옛 `change` — `js/menu/logs.js:64-66`) |
  | `children` | ReactNode | 필수 | `<option>` · `<optgroup>`(테스트 실행 도구 목록) |
  | 그 밖 | `<select>` 속성 · `ref` | 없음 | `aria-label` · `id` · `disabled` 등. `onChange` · `size` · `multiple`은 받지 않는다 |

  | `variant` | 모양 | 이음 근거 |
  |---|---|---|
  | `toolbar` | `--h-lg` · 각진 모서리 · 최대 폭 220(`width="wide"`면 280) | `.sel-f` `css/console.css:399` |
  | `form` | `--h-md` · 칸 전체 폭 | `.inp` `css/console.css:307` |
  | `cell` | `--h-xs` · 칸 전체 폭(최소 90) · 작은 글자 | `.map .mini` `css/console.css:1074-1077` |
  | `setting` | `--h-sm` · 내용 폭 · 오른쪽 정렬 · 숫자 고른 폭 | `.tg .inp` `:716` + 인라인 `width:auto`(`js/menu/discovery.js:76`) |
  - 펼침 화살표는 브라우저 기본 그대로(옛도 `appearance`를 바꾸지 않았다). 선택지 밖 값도 브라우저 기본 처리 그대로다
  - 함께 내보내는 것(`@/ui`) — 타입 `SelectProps` · `SelectVariant` · `SelectWidth`
- **상태** `form` · `setting`은 포커스에 테두리가 `--primary`가 되고 전역 링을 더한다(옛 `.inp:focus`는 링을 지웠다 — DESIGN 이식 기간 고침). `toolbar` · `cell`은 전역 링만이다(옛에 포커스 모양이 따로 없다). disabled는 공통이다.
- **접근성** `toolbar` · `cell` · `setting`은 보이는 라벨이 없어 `aria-label`을 반드시 준다("AI 클라이언트" — `js/menu/logs.js:21`). `form`은 폼 칸의 라벨(`id` 연결)이 이름이다.
- **카탈로그** `Select`

### SearchInput
- **쓰는 곳** 목록 위 글자 검색 — 툴바형(호출 로그 `js/menu/logs.js:22` · 원본 시스템 `js/menu/sources.js:25`), 패널 전폭형(변환 스튜디오 도구 목록 `js/menu/studio.js:137`)(이음 `.search` `css/console.css:138-144`).
- **쓰지 않는 곳** 금지어 → `TagInput` · 대화 → 대화 입력 줄(테스트 실행을 옮길 때 만든다 — 한글 조합 중 Enter 가드는 그쪽) · 폼 칸 → `Input` + `Field`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `value` | string | 필수 | 입력 글자 |
  | `onValueChange` | `(value: string) => void` | 필수 | 입력할 때마다 바로 부른다 — 한글 조합 중에도 조합 끝을 기다리지 않는다(옛 `input` 이벤트 즉시 — `js/menu/logs.js:59-61`) |
  | `label` | string | 필수 | 입력 이름(`aria-label` — 옛 "로그 검색" `js/menu/logs.js:22`) |
  | `placeholder` | string | 없음 | 자리표시(`--text-faint`) |
  | `variant` | `SearchInputVariant` — `toolbar` · `full` | `toolbar` | `toolbar` = `--h-lg` · 폭 `--w-search` · 오른쪽 돋보기 칸(왼쪽 선), `full` = `--h-sm-plus` · 전체 폭 · 돋보기 칸 선 없음(`css/console.css:139,143`) |
  - `<input type="search">` — 옛과 같다. 돋보기는 누를 수 없는 장식 칸(아이콘 `search` `md`)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `SearchInputProps` · `SearchInputVariant`
- **상태** 상자 안에 포커스가 있으면(`:focus-within`) 상자 테두리가 `--primary`다(`css/console.css:144`).
- **접근성** 링은 검색 상자 전체(돋보기 칸 포함) 둘레 하나다 — 입력과 상자에 링이 겹쳐 둘이 되지 않게 하고, 링을 지우지 않는다(옛 입력 `outline:none` — `css/console.css:140` — DESIGN 이식 기간 고침). 돋보기 칸은 `aria-hidden`이다.
- **폭**
  - 760: `toolbar`는 툴바 줄의 남은 폭을 채운다(최소 180 — `css/console.css:473,898`)
- **카탈로그** `SearchInput`

### FilterChips
- **쓰는 곳** 화면 안 목록 필터 알약 묶음(개수 붙음) — 툴바 안(호출 로그 상태 `js/menu/logs.js:19` · 탐색 결과 `js/menu/discovery.js:313`), 패널 머리 띠(변환 스튜디오 도구 목록 `js/menu/studio.js:136`)(이음 `.tl-f` `css/console.css:615-619`).
- **쓰지 않는 곳** 서버에 보내는 선택 · 폼 값 → `Select` · 화면을 나누는 탭 → 탭(AI 연결 배포를 옮길 때 만든다).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `items` | `readonly FilterChipItem[]` — `{ value: string; label: ReactNode; count?: number }` | 필수 | 칩 — 순서대로. `count`는 서식 없이 그대로(옛 `${n}` — `js/menu/logs.js:19`) |
  | `value` | string | 필수 | 고른 칩 값 |
  | `onValueChange` | `(value: string) => void` | 필수 | 누른 칩 값 — 이미 고른 칩을 다시 눌러도 부른다(다시 누르면 전체로 돌리는 탐색 결과 동작은 쓰는 곳) |
  | `variant` | `FilterChipsVariant` — `toolbar` · `band` | `toolbar` | `toolbar` = 툴바 안(띠 여백 · 아래 선 없음 — 옛 인라인 `padding:0;border:0`), `band` = 패널 머리 띠(안쪽 여백 · 아래 1px `--line-divider`) |
  | `label` | string | 없음 | 묶음 이름(`role="group"`의 `aria-label`) — 보이지 않는 보강이라 있는 자리만 준다 |
  - 칩 — `--h-xs` 알약 · 1px `--line-control` · `--surface`. 개수는 굵은 글(`<b>`) · `tabular-nums`
  - 함께 내보내는 것(`@/ui`) — 타입 `FilterChipsProps` · `FilterChipItem` · `FilterChipsVariant`
- **상태** 고른 칩은 `aria-pressed="true"` — 테두리 `--primary` · 바탕 `--primary-bg` · 글자와 개수 `--primary-ink`(`css/console.css:618-619`). 옛은 클래스뿐이었다(보이는 차이 0 — DESIGN 이식 기간 고침).
- **접근성** 칩은 토글 버튼(`aria-pressed`)이다. 고르면 목록만 바뀌고 포커스는 칩에 남는다(옛 표 본문만 다시 그림 — `js/menu/logs.js:54`).
- **카탈로그** `FilterChips`

### Input
- **쓰는 곳** 한 줄 입력 — 폼 칸(연결 마법사 시스템 이름 · 명세 URL · 서버 주소 · 인증 칸 `js/menu/sources.js:57,66,69,88` · 재인증 모달의 인증 칸 `:136` · 탐색 마법사 칸 `js/menu/discovery.js:43-64`)(이음 `.inp` `css/console.css:307-309`, 고정폭 `.mono` `:488`), 표 안 칸(스튜디오 매핑 이름 · 설명 · 고정값 · 코드표 — `js/menu/studio.js:20-47`, `.map .mini` `:1074-1076`), 설정 줄 오른쪽 칸(정책 호출 한도 `js/menu/studio.js:109` · 탐색 예약 시각 `js/menu/discovery.js:76` · 스테이징 주소 `:72` — `.tg .inp` `:716`).
- **쓰지 않는 곳** 여러 줄 → `Textarea` · 목록 검색 → `SearchInput` · 정해진 값 고르기 → `Select` · 금지어 → `TagInput` · 대화 → 대화 입력 줄(테스트 실행을 옮길 때 만든다).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `variant` | `InputVariant` — `form` · `cell` · `setting` | `form` | 모양 — 아래 표 |
  | `width` | `InputWidth` — `full` · `auto` · `narrow` | 변형이 정한다 | 폭. `form`은 `full`(기본 — 칸 전체) · `narrow`(120 고유 치수 — 탐색 최대 화면 수, 옛 인라인 `width:120px` `js/menu/discovery.js:64`), `setting`은 없으면 78(정책 숫자 칸) · `auto`(내용 폭 — 탐색 예약 시각, 옛 인라인 `width:auto` `:76`), `cell`은 받지 않는다(칸 전체 · 최소 90) |
  | `value` | string | 필수 | 입력 글자 |
  | `onValueChange` | `(value: string) => void` | 필수 | 입력할 때마다 바로 부른다(옛 `input` 이벤트 즉시 — `js/menu/sources.js:166-170,181-186`) |
  | `type` | `InputType` — `text` · `password` · `number` · `time` | `text` | `password`면 부품이 `autocomplete="new-password"`를 함께 넣는다 — 옛 비밀 칸이 모두 그랬다(`js/menu/sources.js:88` · `js/menu/discovery.js:39`, 브라우저가 저장된 비밀번호를 채우지 않게). `number`(정책 한도 · 탐색 최대 화면 수) · `time`(탐색 예약)의 조절 단추 · 펼침은 브라우저 기본이다 |
  | `mono` | boolean | false | 고정폭 글꼴 — 서버 주소 · 키 이름 · 토큰 URL · 매핑 이름 · 고정값 · 코드표 · 스테이징 주소(옛 `.mono` · `.map .f.mini`) |
  | 그 밖 | `<input>` 속성 · `ref` | 없음 | `id` · `placeholder` · `aria-label` · `aria-describedby` · `disabled` · `readOnly` · `min` · `max` 등. `onChange` · `size` · HTML `width`는 받지 않는다 |

  | `variant` | 모양 | 이음 근거 |
  |---|---|---|
  | `form` | `--h-md` · 칸 전체 폭 | `.inp` `:307` |
  | `cell` | `--h-xs` · 칸 전체 폭(최소 90) · 작은 글자 · 포커스는 전역 링만(테두리 그대로) | `.map .mini` `:1074-1076` |
  | `setting` | `--h-sm` · 폭 78 · 오른쪽 정렬 · 숫자 고른 폭 | `.tg .inp` `:716` |
  - 자리표시는 브라우저 기본 색이다(옛 `.inp`에 자리표시 규칙이 없다)
  - 인라인 오류 모양은 없다 — 이음은 단계 검증 실패를 경고 토스트로만 알린다(옛 `.inp.err` `:309`는 쓰는 곳이 없다)
  - 스테이징 주소 칸은 `setting` + `mono`다 — 옛 칸이 설정 줄(`.tg`) 안에 있어 `.tg .inp`의 78 × 30 · 오른쪽 정렬이 걸렸다(`js/menu/discovery.js:72`, 옛 그대로)
  - 함께 내보내는 것(`@/ui`) — 타입 `InputProps` · `InputType` · `InputVariant` · `InputWidth`
- **상태** `form` · `setting`은 포커스에 테두리가 `--primary`가 되고 전역 링을 더한다(옛 `.inp:focus`는 링을 지웠다 — DESIGN 이식 기간 고침). `cell`은 전역 링만이다(옛 `.mini`에 포커스 모양이 없다). disabled는 공통이다. `readOnly`는 모양이 바뀌지 않는다.
- **접근성** `form`의 이름은 `Field`의 라벨(`id` 연결)이다. 보이는 라벨이 없는 칸(탐색 아이디 · 비밀번호 `js/menu/discovery.js:47`, 매핑 표 칸 · 정책 한도 · 예약 시각 · 스테이징 주소)은 `aria-label`을 준다.
- **카탈로그** `Input`

### Textarea
- **쓰는 곳** 여러 줄 입력 — 연결 마법사 호출 샘플 요청 · 응답(`code` — `js/menu/sources.js:62-63`, 이음 `textarea.inp` `css/console.css:837,1078`), 도구 설명 편집(`prose` — `js/menu/studio.js:95`, 이음 `.desc-ed textarea` `css/console.css:667-668`).
- **쓰지 않는 곳** 한 줄 → `Input` · 코드 보기 → `CodeBlock`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `variant` | `TextareaVariant` — `code` · `prose` | `code` | `code` = 고정폭 작은 글자(호출 샘플), `prose` = 본문 글꼴 · 설명 글 행간 · 최소 높이 78(도구 설명) |
  | `value` | string | 필수 | 입력 글자 |
  | `onValueChange` | `(value: string) => void` | 필수 | 입력할 때마다 바로 부른다(옛 `input` 이벤트 — `js/menu/sources.js:183-184`) |
  | 그 밖 | `<textarea>` 속성 · `ref` | 없음 | `rows`(보이는 줄 수 — 옛 요청 3 · 응답 6) · `id` · `placeholder` · `aria-*` · `disabled`. `onChange`는 받지 않는다 |
  - 세로로만 늘인다. `code`는 옛 `textarea.inp`의 두 정의가 겹친 결과 그대로(`:837` 최소 높이 + `:1078` 안쪽 · 행간). `base.css`가 textarea에 글꼴을 물려주지 않아 부품이 글꼴 · 크기 · 행간 · 색을 직접 정한다(DESIGN Typography)
  - 글자 수 줄 · "AI로 다시 쓰기"는 쓰는 곳(설명 소절)이다(`js/menu/studio.js:96`)
  - 함께 내보내는 것(`@/ui`) — 타입 `TextareaProps` · `TextareaVariant`
- **상태** `Input`과 같다 — 포커스에 테두리 `--primary` + 전역 링, disabled 공통.
- **접근성** `code`의 이름은 `Field`의 라벨이다(라벨 위 정렬 — `Field align="top"`). `prose`는 보이는 라벨이 소절 제목이라 `aria-label`을 준다(옛 "도구 설명").
- **카탈로그** `Textarea`

### Field
- **쓰는 곳** 라벨 + 입력 한 줄 — 연결 마법사 · 재인증 모달의 칸(`js/menu/sources.js:57-69,88-95`) · 탐색 마법사 칸(`js/menu/discovery.js:43-64`)(이음 `.field` `css/console.css:305-306`, 760 `:472`). 칸 묶음 아래 안내(`FieldNote` — 탐색 마법사 Git · 화면 탐색 `js/menu/discovery.js:56,65`, 옛 `.pv-note` + 인라인 들여쓰기).
- **쓰지 않는 곳** 보이는 라벨이 없는 칸 → 입력의 `aria-label` · 라벨 줄 + 라디오 목록 → `RadioList`(`label`) · 칸 안 두 입력(탐색 아이디 + 비밀번호 `.two`) → `FieldPair` · 목록 위 필터 · 검색 → `Toolbar` · 미리보기 · 근거 아래 메모 → `HelpText variant="note"`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `label` | ReactNode | 필수 | 보이는 라벨 |
  | `align` | `FieldAlign` — `center` · `top` | `center` | 라벨 세로 위치 — `top`은 여러 줄 입력(호출 샘플 — 옛 인라인 `align-items:start` + 라벨 위 여백, `js/menu/sources.js:62-63`) |
  | `children` | `(control: FieldControl) => ReactNode` | 필수 | 입력을 그린다 — `control.id`를 입력의 `id`로 준다(라벨 연결) |
  | `className` | string | 없음 | 배치(바깥 여백 — 옛 인라인 위 14 `js/menu/sources.js:69`)만 |
  - 줄 — 라벨 열 `--w-field-label` + 입력 열. 줄 아래 간격은 부품이 준다(옛 `.field` 아래 여백)
  - `FieldControl` — `{ id: string }`. 필수 표시(`*` + 시각 숨김 — 테스트 실행 인자 폼) · 라벨 툴팁(테스트 실행)은 그 메뉴를 옮길 때 이 절에 prop과 `FieldControl.describedBy`를 더한다. 매핑 표의 필수 `*`는 칸 안 글이라 이 부품이 아니다(쓰는 곳이 `VisuallyHidden` + `aria-describedby`)
  - 조각 `FieldNote`(`children` · `className`) — 라벨 열만큼 들여 입력 열에 맞춘 흐린 작은 안내 `<p>`. 글자는 `HelpText variant="note"`와 같고(`<b>`는 색 그대로 굵게) 위 여백 없음 · 아래 `--s-1`(옛 인라인 `margin:0 0 4px 106px`). 어느 한 칸의 설명이 아니라 묶음 전체 안내라 입력에 잇지 않는다
  - 함께 내보내는 것(`@/ui`) — `FieldNote` · 타입 `FieldProps` · `FieldAlign` · `FieldControl` · `FieldNoteProps`
- **상태** 없다(그릇). 안의 입력이 낸다.
- **접근성** 라벨은 `<label for>`로 입력과 이어진다 — 옛 `<label>`은 입력과 이어지지 않았다(`js/menu/sources.js:57` — DESIGN 이식 기간 허용 차이, 라벨 연결). 라벨을 누르면 입력에 포커스가 간다.
- **폭**
  - 760: 라벨 위 · 입력 아래 한 열(`css/console.css:472`) · `FieldNote` 들여쓰기 없음(`:1069`)
- **카탈로그** `Field`

### FieldPair
- **쓰는 곳** 칸 하나를 두 칸으로 나누는 격자 — 반반(`half` — 탐색 마법사 테스트 계정 아이디 + 비밀번호 `js/menu/discovery.js:48`, 이음 `.two` `css/console.css:923`) · 라벨 + 값 줄(`label` — AI 연결 배포 서버 주소 · 실행 방식 · 전송 방식 `js/menu/deploy.js:73-75`, 이음 `.ep-row` `css/console.css:794-795`).
- **쓰지 않는 곳** 라벨 + 입력 한 줄 → `Field`(반반은 `Field`의 입력 열 안에 둔다) · 화면 본문 두 열 → `TwoColumn` · 드로어 안 요약 칸 → `KeyValueGrid`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `variant` | `FieldPairVariant` — `half` · `label` | 필수 | 모양 — 아래 표 |
  | `label` | ReactNode | `label`에서 필수 | 왼쪽 라벨 글자(`Field` 라벨과 같은 글자 모양). `half`는 받지 않는다 |
  | `children` | `half`: `[ReactNode, ReactNode]` / `label`: ReactNode | 필수 | 두 칸 / 값 |
  | `className` | string | 없음 | 배치만 |

  | `variant` | 열 | 칸 사이 | 바깥 | 이음 근거 |
  |---|---|---|---|---|
  | `half` | 1 : 1 | `--s-2` | 없음 | `.two` `css/console.css:923` |
  | `label` | 라벨 120(고유 치수) + 남은 폭 · 세로 가운데 | `--s-2-5` | 줄마다 위 `--s-2-5`(옛 `.ep-row` 위 여백) | `.ep-row` `css/console.css:794` |
  - 칸은 최소 폭 0으로 줄어든다
  - `label`의 라벨은 보이는 글자(`<span>`)다 — 값이 입력이 아니라 주소 칸 · 글이라 `<label>`로 잇지 않는다(옛 그대로)
  - 함께 내보내는 것(`@/ui`) — 타입 `FieldPairProps` · `FieldPairVariant`
- **상태** 없다(그릇).
- **접근성** `half`의 두 입력은 각자 `aria-label`을 가진다(옛 "아이디" · "비밀번호" — `js/menu/discovery.js:48`). 감싼 `Field`의 라벨은 첫 입력에 잇는다.
- **폭**
  - 760: 한 열 — `half`는 칸 사이 그대로(`css/console.css:1064`), `label`은 라벨 위 · 값 아래이고 사이 `--s-1`(`css/console.css:905`)
- **카탈로그** `FieldPair`

### FileDrop
- **쓰는 곳** 파일 하나 고르기 — 연결 마법사 명세 파일(`js/menu/sources.js:68`)(이음 `.drop` `css/console.css:823-827`).
- **쓰지 않는 곳** 글자 · 주소 입력 → `Input`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `label` | string | 필수 | 숨긴 파일 입력의 이름(`aria-label` — 옛 "명세 파일 선택") |
  | `title` | ReactNode | 필수 | 첫 줄 — 고르기 전 안내 또는 고른 파일 이름 문장(쓰는 곳이 `copy/`로 고른다) |
  | `description` | ReactNode | 없음 | 아래 작은 흐린 줄 — 허용 형식 · 크기 안내 |
  | `onSelect` | `(file: File) => void` | 필수 | 파일을 고르면 첫 파일로 부른다(옛 `change` — `js/menu/sources.js:190-191`). 고르지 않고 창을 닫으면 부르지 않는다 |
  | `resetKey` | string · number | 없음 | 바뀌면 숨긴 입력의 값을 비운다 — 같은 파일을 다시 골라도 `onSelect`가 불리게 |
  - 상자 — `--bw-dashed` 점선 `--line-control` · `--surface-sub` · 가운데 `upload` 아이콘(`hero` · `--primary`) + 두 줄. 숨긴 입력은 투명하게 상자 전체를 덮는다 — 누르면 파일 창, 끌어 놓기는 브라우저 기본 동작(옛 그대로 — `:825`)
  - `accept`를 두지 않는다 — 옛도 형식을 막지 않고 안내 글만 두었다
  - 쓰는 곳이 하는 일(연결 마법사 — `js/menu/sources.js:190-195`) — 파일이 10MB(10 × 1024 × 1024 바이트)를 넘으면 경고 토스트만 띄우고 상태는 그대로 둔다. 아니면 글자로 읽어 본문 · 파일 이름을 두고, 시스템 이름이 비었으면 파일 이름에서 마지막 확장자를 뺀 값으로 채운 뒤 완료 토스트를 띄운다. 읽기에 성공할 때마다 `resetKey`를 바꾼다 — 옛은 성공하면 본문을 다시 그려 입력이 새것이 됐고, 크기 거절 · 읽기 실패는 다시 그리지 않아 같은 파일을 다시 골라도 반응이 없었다(둘 다 옛 그대로)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `FileDropProps` · 상수 `FILE_DROP_MAX_BYTES`(10MB = 10 × 1024 × 1024 바이트 — 부품은 막지 않고, 쓰는 곳이 크기 거절에 이 값과 견준다)
- **상태** hover는 테두리 `--primary`(`:824`). 포커스는 숨긴 입력을 감싼 상자의 링이다(`:has(.input:focus-visible)` — 키보드 포커스에만 그리고 마우스로 눌렀을 때는 그리지 않는다. 옛은 투명 입력이라 링이 보이지 않았다, DESIGN 이식 기간 고침).
- **접근성** 숨긴 입력은 `<input type="file">` 그대로라 Tab으로 닿고 Space로 파일 창을 연다(옛 파일 입력과 같음 — Enter는 브라우저가 열지 않는다). 이름은 `label`이고 아이콘은 장식이다.
- **카탈로그** `FileDrop`

### RadioList
- **쓰는 곳** 이름 + 작은 설명 한 줄짜리 선택지 목록에서 하나 고르기 — 연결 마법사 공공데이터 "포털 API"(`js/menu/sources.js:59-60`)(이음 `.gov-list` · `.gov-row` `css/console.css:830-836`).
- **쓰지 않는 곳** 아이콘 · 긴 설명이 붙은 카드 → `RadioCard` · 설명 없는 짧은 선택지 → `Select` · 두세 모드 → `SegmentedRadio`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `label` | ReactNode | 필수 | 목록 위 라벨 줄(`Field`의 라벨과 같은 모양 · 같은 열 — 옛 라벨만 있는 `.field`) — 묶음의 이름(`aria-labelledby`) |
  | `items` | `readonly RadioListItem[]` — `{ value: string; title: ReactNode; description?: ReactNode }` | 필수 | 선택지 — 순서대로. `description`은 제목 아래 작은 흐린 글 |
  | `value` | string | 필수 | 고른 값 |
  | `onValueChange` | `(value: string) => void` | 필수 | 고르면 그 값(옛 `change` — `js/menu/sources.js:175`) |
  - 목록 — 1px `--line-divider` 상자 · 줄 사이 1px `--line-divider`. 줄은 `<label>` 안 브라우저 라디오(`accent-color` `--primary` · 고유 치수 17) + 글자라 줄 어디를 눌러도 고른다
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `RadioListProps` · `RadioListItem`
- **상태** 줄 hover는 `--surface-hover`(`:833`). 고름은 브라우저 라디오의 checked다.
- **접근성** 브라우저 라디오 묶음 그대로다(같은 `name` — Tab으로 묶음에 한 번 닿고 화살표로 고른다, 옛과 같음). 묶음은 `role="radiogroup"` + 라벨 줄 이름이다(옛은 묶음 이름이 없었다 — DESIGN 이식 기간 허용 차이, 라벨 연결).
- **카탈로그** `RadioList`

### RadioCard
- **쓰는 곳** 제목 · 설명이 붙은 선택지 카드에서 하나 고르기 — 연결 마법사 1단계 연결 방식(`card` — `js/menu/sources.js:55`, 이음 `.mode-card` `css/console.css:260-268,821-822,913`), 실행 정책 실행 방식 · 탐색 쓰기 API 검증(`option` — `js/menu/studio.js:104-105` · `js/menu/discovery.js:72-73`, 이음 `.opt` `:704-711`). 라디오 점은 둘 다 `.radio`(`:263-265`)다. 카드 격자(`CardGrid`) · 묶음 제목(`.wz-g` · `GroupLabel`) · 묶음 이름(`role="group"`)은 쓰는 곳이다.
- **쓰지 않는 곳** 설명 한 줄짜리 목록 → `RadioList` · 두세 모드 → `SegmentedRadio` · 켜고 끄기 → `Switch`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `variant` | `RadioCardVariant` — `card` · `option` | `card` | 모양 — 아래 표 |
  | `title` | ReactNode | 필수 | 제목 |
  | `description` | ReactNode | 없음 | 제목 아래 설명(`--text-muted`) |
  | `icon` | `IconName` | 없음 | `card`만 — 제목 앞 아이콘(`md` · `--primary`). 서버가 준 이름은 쓰는 곳이 `iconOf`로 바꾼다 |
  | `badges` | ReactNode | 없음 | `card`만 — 제목 뒤 표지(`Tag` — "2차" `neutral` · 추천 `ok`) |
  | `slot` | ReactNode | 없음 | `option`만 — 고른 카드에서 설명 자리를 대신하는 입력(스테이징 주소 — `js/menu/discovery.js:72`). 누르는 버튼 밖 · 카드 테두리 안 · 글 열에 그린다 |
  | `selected` | boolean | 필수 | 고른 카드 |
  | `onSelect` | `() => void` | 필수 | 누름 — 이미 고른 카드여도 부른다(옛 `wzMode` — `js/menu/sources.js:153`) |
  | `disabled` | boolean | false | 잠긴 카드(2차 · 쓰기 도구의 "바로 실행" · Git 소스 분석이 꺼진 "스테이징에서 검증") |
  | `className` | string | 없음 | 배치만 — 넓은 카드(옛 `.mode-card.wide` 줄 전체 칸 `:913`)는 쓰는 곳이 격자 칸으로 준다 |

  | `variant` | 모양 | 이음 근거 |
  |---|---|---|
  | `card` | 아이콘 · 표지 · 굵은 제목 · 설명. 고르면 `--ring-selected`까지 | `.mode-card` `:260-268` |
  | `option` | 아이콘 · 표지 없이 작은 제목(`--fw-medium`) · 작은 설명. 고르면 테두리 · 바탕만(안쪽 테 없음) · 전환 없음 | `.opt` `:704-711` |
  - 카드 — 1px `--line-control` · `--surface` · `--r-md`, 왼쪽 라디오 점(고유 치수 18 · `--bw-strong` 테 — 고르면 `--primary` 테 + 안 점)
  - `option` 카드는 세로로 쌓아 쓴다 — 카드 아래 `--s-1-5`는 부품이 가진다(옛 `.opt` 아래 여백 — 마지막 카드도). 바깥 여백은 쓰는 곳 `className`이 덮을 수 있다
  - `slot`을 주면 카드는 겉 칸(테두리 · 바탕 · hover · 고름) 안에 누르는 버튼(라디오 점 · 제목 · 설명)과 입력 칸을 차례로 둔다 — 입력이 버튼 안에 있던 옛 마크업을 고쳤다(모양 그대로 — DESIGN 이식 기간 고침). 고르기 전에는 `description`을, 고른 뒤에는 그 자리에 `slot`을 그린다(옛 그대로). 구조는 고름과 상관없이 같아 눌러도 버튼이 다시 그려지지 않는다
  - 잠긴 카드도 `badges` · `slot` 자리를 그대로 그린다 — 투명도는 카드 전체에 걸린다(옛 `.mode-card.dis` `:821` · `.opt:disabled` `:710`). 2차 카드는 `disabled` + `Tag tone="neutral"`("2차")다. 자동 탐색 카드는 넓은 카드(줄 전체 칸)이고 `badges`에 추천 표지(`Tag tone="ok"` — 옛 `.rec` `js/menu/sources.js:55`)를 둔다
  - 함께 내보내는 것(`@/ui`) — 타입 `RadioCardProps` · `RadioCardVariant`
- **상태** hover는 테두리 `--primary-line`이다(`:261` · `:705`). 고른 카드는 `aria-pressed="true"` — 테두리 `--primary` · 바탕 `--primary-bg`, `card`는 `--ring-selected`를 더한다(`:262` · `:706`). disabled는 공통(`--opacity-disabled` · 커서 `not-allowed`)이고 hover 모양이 바뀌지 않는다(`:822` · `:710-711` — 옛 .55는 DESIGN 이식 기간 허용 차이 값 정규화). 상태는 루트의 `data-state` · `data-disabled`로도 낸다 — `slot`이 있으면 루트가 버튼이 아니라 겉 칸이다.
- **접근성** 카드는 `<button type="button" aria-pressed>`다 — 옛은 선택이 클래스뿐이었다(DESIGN 이식 기간 고침 — 모드 카드 · 정책 버튼). Tab으로 카드마다 닿는다(옛과 같음 — 화살표 키 이동이 없어 `radiogroup`이 아니다). 라디오 점 · 아이콘은 장식이고 이름은 버튼 글자 전체다. 잠긴 카드는 `disabled`라 Tab이 닿지 않고 보조기기에도 비활성으로 읽힌다(옛 `disabled` 그대로 — 옛의 `aria-disabled`는 `disabled`와 겹쳐 내지 않는다). 묶음 이름이 필요하면 쓰는 곳이 `role="group"`의 `aria-labelledby`를 `GroupLabel` `id`에 잇는다. `slot`이 있으면 포커스 링은 누르는 버튼 안쪽에 그려지고(바깥 링은 겉 칸 윗부분을 둘러 입력 위를 가로지른다 — DESIGN 접근성 링 자리), 입력은 버튼 다음 Tab 자리이며 자기 `aria-label`을 가진다(옛 "스테이징 주소").
- **카탈로그** `RadioCard`

### Switch
- **쓰는 곳** 켜고 끄는 설정 하나 — 도구 상세 머리 "AI에게 공개"(`inline` — `js/menu/studio.js:79`), 실행 정책 · 탐색 안전 설정 줄의 오른쪽 스위치(`standalone` — `js/menu/studio.js:107-108` · `js/menu/discovery.js:68,74`), 탐색 마법사 영역 제목줄(`heading` — `js/menu/discovery.js:51,59`)(이음 `.sw` `css/console.css:369-375` · `.pubsw` `:638-639` · `.dz-h.ck2` `:917-922`).
- **쓰지 않는 곳** 여러 항목을 고르는 체크 · 담당자 승인 상자 → `Checkbox` · 둘 중 하나 고르기 → `RadioCard`(`variant="option"`).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `checked` | boolean | 필수 | 켜짐 |
  | `onCheckedChange` | `(checked: boolean) => void` | 필수 | 바꾸면 새 값(옛 `change` — `js/menu/studio.js:189-190`) |
  | `label` | string | 필수 | 입력 이름(`aria-label` — 옛 스위치는 모두 `aria-label`). `inline` · `heading`은 이 글자를 보이는 글자로도 그린다 |
  | `variant` | `SwitchVariant` — `standalone` · `inline` · `heading` | `standalone` | 모양 — 아래 표 |
  | `description` | ReactNode | 없음 | `heading`만 — 제목 아래 흐린 설명. 스위치 폭 + 간격만큼 들여 쓴다 |
  | `disabled` | boolean | false | 못 바꾸는 스위치 |
  | `disabledReason` | string | 없음 | `disabled`일 때만 내는 이유 — 시각 숨김 글자(`aria-describedby`)와 마우스 툴팁(`title` — 옛 `js/menu/studio.js:79`). 세 변형 모두 같다 |
  | `aria-describedby` | string | 없음 | 이유가 화면에 보이는 글일 때 그 글의 id(탐색 브라우저 없음 안내 — `js/menu/discovery.js:60`). `disabledReason`과 함께 쓰지 않는다(타입이 막는다) |
  | `id` | string | 없음 | 입력 id — `standalone`을 감싼 바깥 `<label htmlFor>`가 잇는다 |
  | `className` | string | 없음 | 배치(바깥 여백 — 공개 스위치 오른쪽 6은 쓰는 곳)만 |

  | `variant` | 모양 | 이음 근거 |
  |---|---|---|
  | `standalone` | 스위치만 — 이름은 `aria-label`. 자기 `<label>`을 만들지 않아 바깥 `<label>` 안에 들어갈 수 있다 | `.sw` `:369-375` |
  | `inline` | `<label>` 묶음 — 글자(`--text-muted`) 다음 스위치, 줄바꿈 없음 | `.pubsw` `:638` |
  | `heading` | `<label>` 묶음 — 스위치 다음 굵은 제목, 아래 줄 설명(`--text-faint`). 묶음 어디를 눌러도 바뀐다 | `.dz-h.ck2` `:917-922` |
  - 스위치 — 고유 치수 38 × 22 알약(`--r-pill`), 꺼짐 `--line-control` · 켜짐 `--primary`, 점 16(`--on-fill` · `--shadow-knob`)이 켜지면 오른쪽으로 간다. 숨긴 `<input type="checkbox">`이 스위치를 덮는다(`--z-raise`) — 역할은 체크박스 그대로다(옛 그대로)
  - 비활성 모양은 변형마다 옛 그대로다 — `inline`만 묶음 전체가 `--opacity-disabled`(옛 `.pubsw.dis`), `standalone` · `heading`은 흐리지 않고 커서만 `not-allowed`다(옛 `input[type=checkbox]:disabled` `:365` — 끌 수 없는 "쓰기 요청 차단"은 켜짐이 진하게 보여야 한다). 공통 disabled 투명도를 모든 변형에 쓰지 않는 자리다
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `SwitchProps` · `SwitchVariant`
- **상태** 켜짐은 입력의 `checked`다. 바뀔 때 바탕 · 점이 `--m-fast`로 옮겨 간다(옛 .15s — DESIGN 이식 기간 허용 차이 값 정규화). 비활성은 위 bullet대로다.
- **접근성** 포커스 링은 숨긴 입력이 아니라 스위치 표시에 그린다(옛 `:focus-visible + span` `css/console.css:375` — DESIGN 접근성 스위치). Space로 바꾼다(체크박스 기본). `disabledReason`은 시각 숨김 글자 + `aria-describedby`로 읽힌다 — 옛은 `title`에만 있어 키보드로 닿지 않았다(DESIGN 이식 기간 고침). `standalone`을 라벨로 감쌀 때는 감싸기만 하지 않고 `<label htmlFor>` + `id`로 잇는다(린트가 감싼 부품 안 입력을 보지 못한다).
- **폭**
  - 760: `heading` 설명 들여쓰기가 없다(`css/console.css:1065`)
- **카탈로그** `Switch`

### SegmentedTabs · SegmentedRadio
- **쓰는 곳** 두세 항목을 붙여 놓은 주조색 필 묶음 — 탭 역할 `SegmentedTabs`(미리보기 "MCP 도구 정의 · 원본 요청 · 응답 변환" — `js/menu/studio.js:113-115`), 라디오 역할 `SegmentedRadio`(테스트 실행 AI 모델 — `js/menu/playground.js:44`)(이음 `.seg` `css/console.css:719-723`). 모양이 같은 두 역할이라 한 절에 둔다.
- **쓰지 않는 곳** 밑줄 탭(배포 AI 연결) → 탭(AI 연결 배포를 옮길 때 만든다) · 개수 붙은 목록 필터 → `FilterChips` · 설명이 붙은 선택지 → `RadioCard` · 선택지가 많으면 → `Select`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `items` | `readonly SegmentedItem[]` — `{ value: string; label: ReactNode }` | 필수 | 항목 — 순서대로(모델은 서버 순서) |
  | `value` | string | 필수 | 고른 항목 |
  | `onValueChange` | `(value: string) => void` | 필수 | 누른 항목 — 이미 고른 항목이어도 부른다 |
  | `idPrefix` | string | `SegmentedTabs`에서 필수 | 탭 · 패널 id 앞부분 — 탭 `{idPrefix}-tab-{value}` · 패널 `{idPrefix}-panel` |
  | `label` | string | `SegmentedRadio`에서 필수 | 묶음 이름(`aria-label` — "AI 모델", 옛 그대로). `SegmentedTabs`는 받지 않는다 — 옛 탭 묶음에는 이름이 없고 곁의 소절 제목이 말한다 |
  | `className` | string | 없음 | 배치만 |
  - `SegmentedTabPanel` — `idPrefix` · `value`(지금 탭) · `children` · `className`. 탭이 바꾸는 자리 하나(`role="tabpanel"` · `aria-labelledby`는 지금 탭)이고 내용만 바꿔 그린다(옛 `#preview` 한 칸 — `js/menu/studio.js:115,150`)
  - 묶음 — `<span>`이라 소절 제목(h4) 안 동작 자리에 들어간다. 1px `--line-control` · `--r-sm` · `--surface`, 바깥 높이 `--h-sm-plus`(안쪽 버튼은 테두리를 뺀 파생 치수), 항목 사이 1px `--line-control` 세로선. 좁으면 묶음 안에서 가로 스크롤한다(옛 `max-width:100%` · `overflow-x:auto`)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — `SegmentedTabPanel` · 타입 `SegmentedTabsProps` · `SegmentedRadioProps` · `SegmentedTabPanelProps` · `SegmentedItem`
- **상태** 고른 항목은 `--primary` 필 · `--on-fill` 글자 · `--fw-medium`이다(`SegmentedTabs` `aria-selected="true"` · `SegmentedRadio` `aria-checked="true"`). hover는 글자 `--text` · 바탕 `--surface-hover`이고 고른 항목은 바뀌지 않는다(`css/console.css:722-723`).
- **접근성** `SegmentedTabs`는 `role="tablist"` 안 `<button role="tab" aria-selected aria-controls>`이고 패널은 `SegmentedTabPanel`이다 — 옛은 `tabpanel` · `aria-controls`가 없었다(DESIGN 이식 기간 고침 — 보이는 차이 0). `SegmentedRadio`는 `role="radiogroup"` 안 `<button role="radio" aria-checked>`다(옛 그대로). 둘 다 항목마다 Tab으로 닿고 Enter · Space로 고른다 — 화살표 키 이동은 두지 않는다(옛 그대로). 포커스 링은 안쪽이다(묶음이 넘침을 자른다) — 고른 항목은 주조색 필 위라 흰 링(`--on-fill`)을 한 칸 더 안쪽에 그린다(DESIGN 접근성 세그먼트).
- **카탈로그** `SegmentedTabs` · `SegmentedRadio`

### SelectableListItem
- **쓰는 곳** 목록 + 상세 왼쪽 목록의 두 줄 항목 하나 — 도구(`id` — 고정폭 도구 id + 상태 칩 / 제목 + 쓰기 표지, `js/menu/studio.js:8-11`), 도구 묶음(`name` — 묶음 이름 + 배포 상태 칩 / 도구 수 · 사용 대상, `js/menu/deploy.js:62-64`)(이음 `.tool-item` `css/console.css:621-629` · `.ts-item` `:785-790`).
- **쓰지 않는 곳** 목록 표의 행 → `Table`(`TableRow`) · 카드에서 하나 고르기 → `RadioCard` · 목록 필터 → `FilterChips`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `variant` | `SelectableListItemVariant` — `id` · `name` | 필수 | 첫 줄 글자 · 항목 간격 — 아래 표 |
  | `title` | ReactNode | 필수 | 첫 줄 왼쪽 |
  | `status` | ReactNode | 없음 | 첫 줄 오른쪽 칩(`ToolStatusChip size="sm"` · 배포 상태 칩) |
  | `description` | ReactNode | 필수 | 둘째 줄(`--text-muted` 작은 글) — 쓰기 표지(`ModeTag size="sm"`)는 이 안에 글 뒤 공백(`{' '}`)으로 띄워 둔다(옛 `.tt` 줄 흐름 그대로) |
  | `selected` | boolean | 필수 | 고른 항목 |
  | `onSelect` | `() => void` | 필수 | 누름 — 이미 고른 항목이어도 부른다 |
  | `dimmed` | boolean | false | 첫 줄 · 둘째 줄 글자를 `--text-faint`로(제외 도구 — 옛 `.tool-item.off`). 칩 · 표지 색은 그대로 |

  | `variant` | 첫 줄 | 이음 근거 |
  |---|---|---|
  | `id` | 고정폭 `--fw-medium` 한 줄 말줄임 | `.tool-item` `:621-629` |
  | `name` | 본문 글꼴 굵게 · 한 단계 큰 글자(`--fs-subhead`) · 긴 이름은 아무 곳에서나 접는다 · 항목 안쪽이 조금 넓다 | `.ts-item` `:785-790` |
  - 항목 — 전체 폭 `<button>` · 아래 1px `--line-divider` · `--surface`. 첫 줄은 제목과 칩을 양끝에 두고, 칩 칸은 첫 줄 높이를 늘리지 않는다
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `SelectableListItemProps` · `SelectableListItemVariant`
- **상태** hover는 `--surface-hover`다. 고른 항목은 `aria-pressed="true"` — `--surface-selected` + `--edge-active`(DESIGN Colors ① 선택 표시 — 목록 항목 왼쪽 막대).
- **접근성** `<button type="button" aria-pressed>`다 — 도구 항목은 옛도 `aria-pressed`였고 묶음 항목은 없었다(DESIGN 이식 기간 고침 — 묶음 선택). 이름은 항목 글자 전체다. 포커스 링은 안쪽이다 — 옛 링은 목록 스크롤 상자에 잘렸다(DESIGN 이식 기간 고침).
- **카탈로그** `SelectableListItem`

### Checkbox
- **쓰는 곳** 켜고 끄는 상자 하나 — 탐색 결과 표 선택 칸(`md` — `js/menu/discovery.js:280`, 이음 `.utbl input[type=checkbox]` `css/console.css:208`) · 탐색 마법사 담당자 승인 상자 안(`lg` — `js/menu/discovery.js:78`, 이음 `.own input` `css/console.css:933`) · AI 연결 배포 묶음 만들기 · 수정의 도구 목록 줄(`sm` + `label` — `js/menu/deploy.js:196`).
- **쓰지 않는 곳** 켜면 바로 적용되는 설정(마스킹 · 공개 · 탐색 영역 켜기) → `Switch` · 여럿 중 하나 고르기 → `RadioList` · `RadioCard` · 화면 안 목록 필터 → `FilterChips`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `checked` | boolean | 필수 | 켬 |
  | `onCheckedChange` | `(checked: boolean) => void` | 필수 | 바꾸면 그 값(옛 `change` — `js/menu/discovery.js:415,417`) |
  | `size` | `CheckboxSize` — `sm` · `md` · `lg` | `md` | 상자 고유 치수 — `sm` 브라우저 기본(옛이 크기 · 색을 적지 않은 도구 목록), `md` 17(표 칸), `lg` 18(승인 상자) |
  | `label` | ReactNode | 없음 | 있으면 `<label>` 줄 — 상자 + 글자, 줄 어디를 눌러도 바뀐다(사이 `--s-2` · 위아래 `--s-1`, 옛 인라인 `padding:3px 0` `js/menu/deploy.js:196`). 없으면 상자만이고 이름은 `aria-label`이나 바깥 `<label htmlFor>`(+ `id`)다 |
  | `disabledReason` | string | 없음 | `disabled`일 때만 내는 이유 — 마우스 툴팁(`title` — 옛 "AI 도구로 만들 수 없는 API입니다" `js/menu/discovery.js:280`)과 시각 숨김 `aria-describedby`. 이유 글은 `<label>` 밖에 둬 이름에 섞이지 않는다 |
  | 그 밖 | `<input>` 속성 · `ref` | 없음 | `aria-label` · `aria-describedby` · `disabled` · `id` · `name` · `value`. `onChange` · `type` · `size` · `title`은 받지 않는다 |
  - 상자는 브라우저 체크 상자 그대로다 — `md` · `lg`는 `accent-color` `--primary`, `md`는 바깥 여백 없음(옛 `margin:0`) · `lg`는 위 `--s-0-5`(옛 `.own input` `margin:2px 0 0` `css/console.css:933` — 두 줄 글의 첫 줄에 맞춤), `sm`은 색 · 크기를 적지 않는다(옛 그대로). 모든 크기가 flex 줄에서 줄지 않는다
  - 표 칸에서 누름이 행 동작으로 가지 않게 막는 것은 `TableCell kind="check"`다 — 이 부품은 막지 않는다
  - 상자를 라벨 · 승인 상자로 감쌀 때는 감싸기만 하지 않고 `<label htmlFor>` + 이 부품의 `id`로 잇는다 — 린트가 감싼 부품 안 입력을 보지 못한다
  - 함께 내보내는 것(`@/ui`) — 타입 `CheckboxProps` · `CheckboxSize`
- **상태** checked는 브라우저 체크 표시다. disabled는 브라우저 기본 비활성 모양 + 커서 `not-allowed`이고 투명도를 더하지 않는다(옛 `css/console.css:365` — 공통 disabled 투명도의 예외). hover 모양이 없다.
- **접근성** `<input type="checkbox">` 그대로라 Tab으로 닿고 Space로 바꾼다. 바꿔도 포커스는 상자에 남는다(옛은 표를 다시 그리지 않았다 — `js/menu/discovery.js:417-418`). `disabledReason`의 시각 숨김 글은 보이는 차이가 없는 보강이다(DESIGN 이식 기간 허용 차이 — 보이지 않는 ARIA 보강).
- **카탈로그** `Checkbox`

### TagInput
- **쓰는 곳** 단어 목록을 칩으로 늘어놓고 끝 입력칸에서 Enter로 더하기 — 탐색 마법사 안전 설정 "누르지 않을 버튼"(`js/menu/discovery.js:69-70`, 더하기 `js/main.js:57`, 빼기 `js/menu/discovery.js:405`)(이음 `.bans` `css/console.css:924-928`).
- **쓰지 않는 곳** 한 값 입력 → `Input` · 목록 위 검색 → `SearchInput` · 정해진 값 고르기 → `Select` · `FilterChips` · Enter로 보내는 대화 입력 → 대화 입력 줄(테스트 실행을 옮길 때 만든다).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `values` | `readonly string[]` | 필수 | 단어 — 순서대로 칩 |
  | `onAdd` | `(value: string) => void` | 필수 | Enter로 더한 단어 — 앞뒤 공백을 지운 값. 빈 값 · 이미 있는 값이면 부르지 않는다 |
  | `onRemove` | `(value: string) => void` | 필수 | 칩 빼기 버튼을 누른 단어 |
  | `removeLabel` | `(value: string) => string` | 필수 | 빼기 버튼 이름(`aria-label` — 옛 "{단어} 빼기", 틀은 쓰는 곳 `copy/`) |
  | `inputLabel` | string | 필수 | 입력칸 이름(`aria-label` — 옛 "누르지 않을 단어 추가") |
  | `placeholder` | string | 없음 | 입력칸 자리표시(옛 "단어 추가") |
  | `className` | string | 없음 | 배치(바깥 여백)만 |
  - 칩 — `--h-xs` 알약 · `--danger-bg` 바탕 · `--danger` 글자 · 오른쪽 빼기 버튼(고유 치수 20 원 · `close` 아이콘 `xs` · `bold`). 위험 · 차단 규칙 색이다(DESIGN Colors ③). 긴 단어는 칩 안에서 말줄임이고 전체는 `title` 툴팁이다. 옛 26은 `--h-xs`(DESIGN 이식 기간 허용 차이 — 값 정규화)
  - 입력칸 — `--h-xs` 알약 · 폭 96(고유 치수) · `Input`과 같은 면 · 테두리. 칩과 입력칸은 한 줄에 놓이고 좁으면 접는다(사이 `--s-1-5`)
  - 입력 글자는 부품이 쥔다(제어 값이 아니다 — Enter 때 입력칸 값을 읽고 비운다) — 더했든(새 단어) 안 더했든(빈 값 · 이미 있는 값) 입력칸을 비우고 포커스는 입력칸에 남는다(옛은 본문을 다시 그린 뒤 입력칸에 포커스를 돌렸다 — `js/main.js:57`). Enter는 폼을 제출하지 않는다
  - 한글 조합 중 Enter는 무시한다 — 판정은 `ui/lib/ime`(옛 `isComposing` + 조합 처리 키 `keyCode` 229 — DESIGN 이식 기간 고침)
  - 빼기 뒤 포커스는 입력칸으로 간다 — 옛은 다시 그리기로 포커스를 잃었다(DESIGN 이식 기간 허용 차이 — 렌더)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `TagInputProps`
- **상태** 입력칸은 포커스에 테두리 `--primary` + 전역 링이다(`Input`과 같다). 빼기 버튼 hover는 바탕 `--danger-hover-bg`다(`css/console.css:927`). 칩은 상태가 없다.
- **접근성** 빼기 버튼은 `<button type="button">`이고 이름은 `removeLabel(단어)`다 — 아이콘은 장식이다. 입력칸 이름은 `inputLabel`이다.
- **카탈로그** `TagInput`

## 표시

### StatusChip
- **쓰는 곳** 자원 상태(점 + 글자) — 호출 로그 표 · 상세(`js/menu/logs.js:13,38`) · 원본 목록 · 도구 목록 · 배포 · 탐색 작업(이음 `.stt` `css/console.css:511-517`, `stt()` `js/common/state.js:35`).
- **쓰지 않는 곳** 상태 값에서 라벨 · 색 고르기 → `copy/status` `statusOf`(자원 래퍼 — `SourceStatus` · `ToolStatusChip` · `JobStatusChip`) · 점만 → `StatusDot` · 상태가 아닌 표지 → `ProtocolBadge` · `ModeTag` · `RuleChip` · `Tag`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `tone` | `StatusTone` — `ok` · `warn` · `danger` · `info` · `mute` | 필수 | 색의 뜻(DESIGN Colors ③). `info` = `--primary-bg` + `--primary-ink`, `mute` = 모르는 값 · 제외(`--surface-sub` + `--text-faint` + 1px `--line-divider`) |
  | `size` | `StatusChipSize` — `md` · `sm` | `md` | `sm` = 목록 항목 안 축소(점도 작게 — `css/console.css:628-629`) |
  | `children` | ReactNode | 필수 | 라벨 — `statusOf`의 `label` |
  - 점은 글자 앞 장식(`currentColor` — `css/console.css:512`). 알약 높이는 고유 치수(22 · `sm` 18)
  - 상태 lookup — `statusOf(resource, value)` → `{ label, tone, known }`(`copy/status`, 계약은 DESIGN Copy `상태 값`). 모르는 값은 `label` = 값 그대로 · `tone` = `mute` · `known` = false이고 개발 콘솔에 값마다 한 번 경고한다
  - 함께 내보내는 것(`@/ui`) — 타입 `StatusChipProps` · `StatusChipSize` · `StatusTone`(원본은 `copy/status`)
- **상태** 없다(표시).
- **접근성** 뜻은 글자가 전한다 — 점은 장식이다(DESIGN 핵심 규칙 3).
- **카탈로그** `StatusChip`

### StatusDot
- **쓰는 곳** 글자 없는 상태 점 — 대시보드 구조도 원본 노드(이음 `.dot` `css/console.css:554-555`, `js/menu/dashboard.js:19`).
- **쓰지 않는 곳** 글자가 보이는 상태 → `StatusChip` · 원본 상태 값 → `SourceStatus variant="dot"`(라벨 · 색을 찾는다).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `tone` | `StatusTone` | 필수 | 점 색 — `ok` `--ok` · `warn` `--warn` · `danger` `--danger` · `info` `--primary` · `mute` `--text-faint`(모르는 값) |
  | `label` | string | 필수 | 상태 글자 — 시각 숨김 글자(`VisuallyHidden`)와 마우스 툴팁(`title` — 옛 그대로) |
  - 점 지름은 고유 치수(8)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `StatusDotProps`
- **상태** 없다(표시).
- **접근성** 색 점에 시각 숨김 글자를 붙인다 — 옛은 색과 `title`뿐이었다(DESIGN 이식 기간 허용 차이 — 보이지 않는 ARIA 보강). 점 자체는 장식(`aria-hidden`)이다.
- **카탈로그** `StatusDot`

### VisuallyHidden
- **쓰는 곳** 보이지 않고 읽히는 글자 · 표 — 상태 점 글자(`StatusDot`), 대시보드 시간대 차트 값 표, 필수 `*`의 대체 글 · 비활성 사유(`aria-describedby` 대상 — 변환 스튜디오), 칩 ✓ · ✕의 뜻(테스트 실행).
- **쓰지 않는 곳** 보이는 글자를 숨겼다 보이기 → `hidden` 속성 · 아이콘 버튼 이름 → `IconButton` `label`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `as` | `VisuallyHiddenElement` — `span` · `div` | `span` | 감싸는 요소 — 표처럼 블록 내용을 숨길 때 `div` |
  | `id` | string | 없음 | `aria-describedby` · `aria-labelledby` 대상 |
  | `children` | ReactNode | 필수 | 읽힐 내용 |
  - 시각 숨김 관용구(1px 상자 · 잘라냄) — px는 부품 CSS의 끄는 주석(DESIGN Layout `리터럴 px 예외 주석` 시각 숨김)이다. 화면 CSS는 시각 숨김 px를 만들 수 없어 이 부품을 쓴다
  - 함께 내보내는 것(`@/ui`) — 타입 `VisuallyHiddenProps`
- **상태** 없다.
- **접근성** 보조기기에는 보통 글자처럼 읽히고 화면에는 자리를 차지하지 않는다. 포커스를 받는 요소를 넣지 않는다.
- **카탈로그** `StatusDot`

### Tag
- **쓰는 곳** 무채색 · 상태 색의 작은 표지 — "추정" · "새 필드"(변환 스튜디오 `js/menu/studio.js:45,47`) · "2차"(원본 시스템 2차 카드 · 연결 방식 카드 `js/menu/sources.js:39,55`) · 추천 표식(연결 방식 카드 `:55`) · 탐색 네트워크 기록 결과 태그(`.ntag`) · 탐색 근거 관찰 값 칩(고정폭 값 하나 — `.codes span`), 그리고 도메인 표지 래퍼의 무채색 상태(프로토콜 배지의 샘플 · 모르는 값, 탐색 근거 없음)(이음 `.gs-tag` · `.p2` · `.rec` · `.ntag` · `.codes span` · `.pr.sample` · `.evb.off` `css/console.css:269,522,526-527,694,997-1000,1044`).
- **쓰지 않는 곳** 자원 상태(점 + 글자) → `StatusChip` · 변환 규칙 → `RuleChip` · 프로토콜 → `ProtocolBadge` · 이음 도메인 색 표지 → 읽기/쓰기 `ModeTag` · 탐색 근거 `EvidenceBadge` · 메서드 `MethodChip` · 네트워크 기록 태그 `NetLog`(도메인 색은 래퍼에서만, 래퍼의 무채색 상태는 이 부품으로).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `tone` | `TagTone` — `ok` · `warn` · `danger` · `info` · `mute` · `neutral` | 필수 | 색의 뜻 — 아래 표. `StatusTone`(상태 넷 + `mute`)에 무채색 `neutral`을 더한 것이다 |
  | `variant` | `TagVariant` — `solid` · `dashed` · `off` · `value` · `value-empty` | `solid` | 테두리 · 바탕 모양 — 아래 표 |
  | `shape` | `TagShape` — `square` · `round` | `square` | `square` = 각진 모서리 `--r-sm`, `round` = 알약(`.ntag`) |
  | `size` | `TagSize` — `sm` · `md` · `lg` | `sm` | 태그 고유 높이(18 · 20 · 22 — 컨트롤 높이 단계와 다른 축). `sm`은 `.gs-tag` · `.p2` · `.rec` · `.ntag`, `md`는 `.md-tag` · `.evb`, `lg`는 `.pr` |
  | `title` | string | 없음 | 마우스 툴팁 — 있으면 `cursor: help` |
  | `children` | ReactNode | 필수 | 글자 |
  | `className` | string | 없음 | 배치만(여백 · 정렬 — 모양을 바꾸지 않는다) |

  | `tone` | 바탕 · 테두리 | 글자 | 이음 근거 |
  |---|---|---|---|
  | `ok` · `warn` · `danger` | `--ok-bg` · `--warn-bg` · `--danger-bg` · 없음 | `--ok` · `--warn` · `--danger` | `.rec` · `.gs-tag` · `.ntag` `:269,526,998-999` |
  | `info` | `--primary-bg` · 없음 | `--primary-ink` | `.ntag.info` · `.md-tag.r` `:524,998` |
  | `mute` | `--surface-sub` · 1px `--line-divider` | `--text-faint` | 모르는 값 · 제외 — `.ntag.mute` `:1000` |
  | `neutral` | `--surface-sub` · 1px `--line-control` | `--text-muted` | 상태가 아닌 일반 표지 — `.p2` `:527` · `.pr.sample`의 면 · 글자 `:522` |

  | `variant` | 모양 | 이음 근거 |
  |---|---|---|
  | `solid` | `tone` 그대로 | — |
  | `dashed` | 테두리만 1px 점선 `--line-control`(바탕 · 글자는 `tone`) — 샘플 추론 프로토콜(`neutral` · `lg`) | `.pr.sample` `:522` |
  | `off` | 바탕 투명 · 1px 점선 `--line-control` · 취소선, 글자는 `tone`(`mute`) — "없음" 표지(탐색 근거 없음 — `md`, 자동 탐색) | `.evb.off` `:1044` |
  | `value` | `mute`의 면 · 테두리 그대로, 글자는 고정폭 · `--text` · 보통 굵기 — 관찰 값 칩(`mute` · `md`). 값 문자열만 넘긴다(옛 칩 안 글은 고정폭 값 `<i>` 하나뿐이다 — 라벨이 없다) | `.codes span` · `.codes span i` `:694-695` |
  | `value-empty` | `value`와 같은 면 · 테두리, 글자는 본문 글꼴 · `--text-muted` · `--fs-caption` · 보통 굵기 — 관찰 값이 없을 때의 칩("관찰 없음", `mute` · `md`). 옛은 흐린 글 span이 칩 선택자에 함께 걸려 칩 모양이 됐다 | `.codes span` `:694` · `js/menu/discovery.js:351` |
  - 높이는 테두리를 넣어 크기마다 같다(border-box). 옛 `.p2` · `.ntag.mute`(18 + 테두리) · `.evb.off`(20 + 테두리) · `.codes span`(고정폭 값이 든 줄 22.25)은 2px 남짓 낮아진다 — `.pr.sample`은 옛도 테두리를 빼 22로 맞췄다(DESIGN 이식 기간 허용 차이 — 값 정규화)
  - 이음에 없는 조합(상태 색 + `dashed` · `off` · `value` 등)은 쓰지 않는다 — 카탈로그는 위 표의 자리만 보인다. `value` · `value-empty`는 `mute`에만 닿는다
  - 태그는 `inline-flex`라 글과 요소(고정폭 값 등)를 섞어 넘기면 flex 항목으로 갈라져 사이 공백이 사라진다 — 섞어야 하면 한 `<span>`으로 감싸 넘긴다
  - 함께 내보내는 것(`@/ui`) — 타입 `TagProps` · `TagTone` · `TagVariant` · `TagShape` · `TagSize`
- **상태** 없다(표시).
- **접근성** 뜻은 글자가 전한다. `title`은 마우스 보조일 뿐이라 꼭 알아야 할 설명을 거기에만 두지 않는다.
- **카탈로그** `Tag`

### InlineCode
- **쓰는 곳** 문장 안 짧은 코드 · 경로 · 식별자 — 대시보드 알림 줄 도구 id · 필드 이름(`js/menu/dashboard.js:52,54`) · 빈 상태 시연 주소(`:61`) · 테스트 실행 · 배포 · 탐색 안내(이음 `.inline-code` · `.alert code` `css/console.css:593`).
- **쓰지 않는 곳** 여러 줄 코드 · 요청 · 응답 → `CodeBlock` · 표 칸 · 노드의 고정폭 글자 → 그 자리의 고정폭 글꼴(`--font-mono`).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `children` | ReactNode | 필수 | 코드 글자 |
  - `<code>` · `--font-mono` · `--surface-sub` 바탕 · 1px `--line-divider`
  - 자간은 적지 않고 부모에게서 물려받는다 — 옛 `.inline-code` · `.alert code`도 적지 않아 부모가 계산한 `body` 자간을 그대로 썼다(`css/console.css:66,593`). 부품에서 `--tracking-body`를 다시 적으면 작은 글자 기준으로 다시 계산되어 옛보다 넓어진다
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `InlineCodeProps`
- **상태** 없다.
- **카탈로그** `InlineCode`

### HelpText
- **쓰는 곳** 표 · 상자 · 칸 아래 흐린 안내 한두 줄 — 호출 로그 표 아래(`js/menu/logs.js:27`) · 원본 연결 · 테스트 실행 · 배포 안내(`hint` — 이음 `.tab-hint` `css/console.css:289-290`), 미리보기 · 근거 아래 메모(`note` — 스튜디오 미리보기 `js/menu/studio.js:53,55` · 탐색 근거 코드 상자 · 마스킹 메모 `js/menu/discovery.js:342,346` · 브라우저 없음 안내 `:60`, 이음 `.pv-note` `css/console.css:730`).
- **쓰지 않는 곳** 아이콘 · 테두리가 있는 안내 → `Notice` · 빈 자리 → `EmptyState` · 대시보드 빈 상태 큰 상자의 보조 문장 → `EmptyState size="hero"` · 칸 묶음 아래 들여쓴 안내 → `FieldNote`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `variant` | `HelpTextVariant` — `hint` · `note` | `hint` | `hint` = 표 · 상자 · 칸 아래 안내(설명 글 행간), `note` = 미리보기 · 근거 아래 메모(옛 `.pv-note` — 행간은 둘레를 물려받고 위 `--s-2`를 부품이 가진다) |
  | `size` | `HelpTextSize` — `sm` · `md` | `sm` | `hint`만 — 글자 단계. `md`는 변환 스튜디오 원본 선택 줄(옛 인라인 13px — `js/menu/studio.js:129`) |
  | `children` | ReactNode | 필수 | 문장 — 강조 `<b>`는 `hint`에서 한 단계 진한 `--text-muted`, `note`에서 색 그대로 굵게(옛 `.pv-note`에 `<b>` 규칙이 없다) |
  | `className` | string | 없음 | 배치(바깥 여백)만 — 옛 `.tab-hint`의 위아래 여백은 쓰는 곳이 주고, `note`의 위 여백(브라우저 없음 안내는 위 0 · 아래 8 — 옛 인라인 `js/menu/discovery.js:60`)도 덮을 수 있다 |
  - `<p>` · `--text-faint` · 작은 글자. 앞 아이콘(브라우저 없음 안내의 `alert` `sm`) · `InlineCode`는 쓰는 곳이 문장 안에 둔다
  - 함께 내보내는 것(`@/ui`) — 타입 `HelpTextProps` · `HelpTextSize` · `HelpTextVariant`
- **상태** 없다.
- **카탈로그** `HelpText`

### ProgressBar
- **쓰는 곳** 가로 막대 하나 — 비율 막대(대시보드 많이 쓰인 도구 `js/menu/dashboard.js:48`, `.meter` `css/console.css:583-584`) · 진행 막대(원본 연결 분석 `js/menu/sources.js:76`, `.bar-p` `css/console.css:847-848`). 두 옛 모양은 같아 하나로 둔다.
- **쓰지 않는 곳** 단계 진행 → `StepIndicator` · `ProgressList` · 도는 원 → `Spinner`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `value` | number | 필수 | 0 ~ 1 비율 — 밖의 값 · NaN은 잘라 그린다(0 · 1) |
  | `variant` | `ProgressBarVariant` — `meter` · `progress` | 필수 | `meter` = 채움 `--tool`(도구 비율 막대 — DESIGN Colors ④), `progress` = 채움 `--primary` + 폭 전환 `--m-progress` |
  | `className` | string | 없음 | 배치만(순위 줄의 격자 칸 · 위아래 여백은 쓰는 곳) |
  - 바탕 `--surface-sub` · 높이는 고유 치수(6). 비율은 CSS 사용자 속성으로 넘긴다(DESIGN Layout `TSX style`)
  - 함께 내보내는 것(`@/ui`) — 타입 `ProgressBarProps` · `ProgressBarVariant`
- **상태** 없다.
- **접근성** 장식(`aria-hidden`)이다 — 같은 정보가 곁의 수 · 단계 글자에 있다(옛도 역할이 없다).
- **카탈로그** `ProgressBar`

### Spinner
- **쓰는 곳** 진행 중 도는 원 — 연결 분석 진행 칸(`ProgressList` 안 — `css/console.css:842`), 배포 진행 안내(`js/menu/deploy.js:108`) · 탐색 현재 동작 줄(`js/menu/discovery.js:228`)(이음 `.spin` `:952` · `.an li.run .ic` `:842` · `@keyframes spin` `:846`).
- **쓰지 않는 곳** 진행 비율 → `ProgressBar` · 단계 진행 → `StepIndicator` · `ProgressList` · 첫 로딩 → `ScreenState`(스피너 없이 `aria-busy` — DESIGN 핵심 규칙 8) · 버튼 요청 중 → 버튼 `pending` + 진행형 글자(`Button` 상태).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `size` | `SpinnerSize` — `md` · `lg` | `md` | 고유 치수 — `md` 16 · 테 `--bw-strong`(`.spin`), `lg` 22 · 테 `--bw-dashed`(분석 단계 원 `.an .ic`) |
  | `className` | string | 없음 | 배치만 |
  - 원 — `--primary` 테 · 위쪽만 투명 · `--m-spin` 한 바퀴 반복(DESIGN 이식 기간 유지 — 반복 모션)
  - 함께 내보내는 것(`@/ui`) — 타입 `SpinnerProps` · `SpinnerSize`
- **상태** 없다(장식). 모션 줄이기면 멈춘 원이다(`base.css` — DESIGN Motion).
- **접근성** 장식(`aria-hidden`)이다 — 진행은 곁의 글자가 전한다(옛도 역할이 없다).
- **카탈로그** `Spinner`

### LiveIndicator
- **쓰는 곳** 진행 중임을 알리는 깜빡이는 점 + 글자 — 탐색 실시간 화면 "운영 화면 탐색" 상자 머리 오른쪽 "탐색 중"(작업이 탐색 중이고 화면 탐색 단계가 진행 중일 때만 — `js/menu/discovery.js:235,246`)(이음 `.live` `css/console.css:961-962`).
- **쓰지 않는 곳** 자원 상태 → `StatusChip` · 도는 원 → `Spinner` · 단계 진행 → `StepIndicator`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `children` | ReactNode | 필수 | 글자(쓰는 곳 `copy/` — 옛 "탐색 중") |
  - 점 — 고유 지름 7 · `--danger` · 깜빡임 `--m-blink` 한 번씩 반복(옅은 끝 `--opacity-blink` — DESIGN 이식 기간 유지, 반복 모션). 글자 `--danger`(DESIGN Colors ③ 녹화 중 점)
  - 보이고 숨기는 것은 쓰는 곳이 그릴지로 정한다(옛 `hidden`)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `LiveIndicatorProps`
- **상태** 없다(표시). 모션 줄이기면 멈춘 점이다(`base.css` — DESIGN Motion).
- **접근성** 점은 장식(`aria-hidden`)이고 뜻은 글자가 전한다. 나타나도 읽어 주지 않는다(`aria-live` 없음 — 옛 그대로).
- **카탈로그** `LiveIndicator`

### StepIndicator
- **쓰는 곳** 가로로 늘어선 번호 원 단계 — 연결 마법사 단계(`wizard` — 연결 4단계 `js/menu/sources.js:103` · 탐색 마법사 3단계 `js/menu/discovery.js:84`) · 탐색 작업 단계(`job` — `js/menu/discovery.js:179-180`)(이음 `.wz-steps` · `.ws` `css/console.css:813-819`, `.dstep` · `.ds` `:938-947,981-982`, 760 `:1062-1063`). 두 옛 모양은 같은 가로 단계라 한 부품 두 변형이다.
- **쓰지 않는 곳** 위에서 아래로 진행하는 작업 줄(연결 분석) → `ProgressList` · 진행 비율 → `ProgressBar` · 변환 과정 단계 → `TraceView`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `variant` | `StepIndicatorVariant` — `wizard` · `job` | 필수 | 모양과 받는 단계 상태 — 아래 표 |
  | `steps` | `wizard`: `readonly WizardStep[]` — `{ label: ReactNode; state: 'todo' · 'current' · 'done' }` / `job`: `readonly JobStep[]` — `{ label: ReactNode; state: 'wait' · 'run' · 'done' · 'skip' · 'fail'; note?: ReactNode }` | 필수 | 단계 — 순서대로 1부터 센다. `note`는 이름 뒤 작은 글(옛 "안 함" · "실패" — 쓰는 곳이 `copy/`로) |
  | `className` | string | 없음 | 배치(바깥 여백 — 옛 마법사 아래 22 · 탐색 위 20은 쓰는 곳)만 |

  | `variant` · 상태 | 원(안 글자) | 이름 | 이음 근거 |
  |---|---|---|---|
  | `wizard` `todo` · `job` `wait` | `--surface-sub` · 1px `--line-control`(번호 `--text-faint`) | `--text-faint` | `.ws em` `:815` · `.ds em` `:940` |
  | `wizard` `current` · `job` `run` | `--primary` 필(번호 `--on-fill`), `run`은 둘레 `--halo-current` | `--text` 굵게 | `.ws.on` `:816-817` · `.ds.run` `:942-943` |
  | `done` | `--primary-bg` · 1px `--primary-line`(`check` 아이콘 `xs` · `heavy` `--primary`) | `wizard` `--text-faint`(그대로) · `job` `--text-muted` | `.ws.done em` `:818` · `.ds.done` `:944-945` |
  | `job` `skip` | `wait`과 같은 원(글자 "–") · 단계 전체 `--opacity-skipped` | `note` | `.ds.skip` `:946` |
  | `job` `fail` | `--danger-bg` · 1px `--danger`(글자 "!" `--danger`) | `--danger` | `.ds.fail` `:981-982` |
  - 원 지름은 고유 치수(`wizard` 22 · `job` 24). 단계 사이는 남은 폭을 나누는 1px `--line-control` 선이고, 좁으면 줄을 바꾼다
  - 지난 단계 ✓ 글리프는 `check` 아이콘이다(DESIGN 이식 기간 허용 차이 — 글리프 대신 아이콘)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `StepIndicatorProps` · `StepIndicatorVariant` · `WizardStep` · `JobStep`
- **상태** 없다(표시) — 단계 상태는 데이터다.
- **접근성** 단계는 `<ol>`이고 번호 원은 보이는 글자다. `current` · `run` 단계는 `aria-current="step"`이다(옛은 클래스뿐 — 보이지 않는 ARIA 보강). 완료 아이콘은 장식이다 — 완료는 현재 단계 앞이라는 순서로 읽힌다(새 낱말 없음).
- **폭**
  - 760: `job` 사이 선을 숨기고 줄 간격을 넓힌다(`css/console.css:1062-1063`)
- **카탈로그** `StepIndicator`

### ProgressList
- **쓰는 곳** 위에서 아래로 진행하는 작업 줄 — 연결 분석 다섯 칸(`js/menu/sources.js:77`)(이음 `.an` `css/console.css:838-845`).
- **쓰지 않는 곳** 가로 번호 원 단계 → `StepIndicator` · 진행 비율 → `ProgressBar`(같은 자리 위에 함께 둔다 — 쓰는 곳).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `items` | `readonly ProgressItem[]` — `{ label: ReactNode; state: 'wait' · 'run' · 'done'; note?: ReactNode }` | 필수 | 줄 — 위에서 아래로. `note`는 오른쪽 작은 요약(옛 완료 뒤 "명세 1건" 등 — 쓰는 곳이 `copy/`로) |
  | `className` | string | 없음 | 배치(바깥 여백)만 |
  - 줄 — 아래 1px `--line-divider`. 원은 고유 치수 22 · `--bw-dashed` 테
  - `wait` — 테 `--line-control` · 이름 `--text-faint`. `run` — 원 자리에 `Spinner size="lg"` · 이름 `--text`. `done` — `--primary` 필 + `check` 아이콘(`xs` · `heavy` · `--on-fill`) · 이름 `--text`
  - 진행 연출(언제 다음 줄로 가는지)은 쓰는 곳이다 — 이 부품은 받은 상태만 그린다(연결 분석의 가짜 진행은 DESIGN 이식 기간 보존)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `ProgressListProps` · `ProgressItem`
- **상태** 없다(표시).
- **접근성** 목록은 `<ol>`이고 `run` 줄은 `aria-current="step"`이다(옛 `<ul>` · 클래스뿐 — 보이지 않는 보강). 스피너 · 완료 아이콘은 장식이다.
- **카탈로그** `ProgressList`

## 상태 표현

### EmptyState
- **쓰는 곳** 비어 있는 자리 — 종류(`kind`) × 그릇(`container`)으로 고른다(DESIGN Copy 빈 상태 · 핵심 규칙 7). 이음 표 행 `td.empty`(`css/console.css:212`) · 점선 상자 `.md-empty`(`css/console.css:366-368`) · 테두리 없는 한 줄 `.empty-s`(`css/console.css:135`) · 아이콘 안내 `.trace-empty`(`css/console.css:769-770`) · 대시보드 큰 상자(`js/menu/dashboard.js:61`).
- **쓰지 않는 곳** 설명 문단("이 도구는 입력이 필요 없습니다.") → 그 자리의 글 · 코드 상자 안 문장("아직 남은 로그가 없습니다.") → 코드 상자 내용 · 탐색 작업 0개 → 절을 그리지 않는다 · 실패 → `FailureBlock`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `kind` | `EmptyKind` — `first` · `filtered` · `section` · `idle` | 필수 | 종류(`data-kind`). 모양은 그릇이 정하고 종류는 문구 · 행동을 정한다 |
  | `container` | `EmptyContainer` — `table` · `panel` · `inline` · `area` | 필수 | 그릇(`data-container`) — 아래 표 |
  | `children` | ReactNode | 필수 | 안내 문장(`copy/`). 다른 메뉴로 가는 링크는 문장 안 `LinkButton`이다(`js/menu/studio.js:120`) |
  | `colSpan` | number | `table`에서 필수 | 표 열 수 — `<tr><td colSpan>`를 그린다 |
  | `size` | `EmptyPanelSize` — `md` · `sm` · `hero` | `md` | `panel`만. `hero`는 대시보드 큰 상자 — `kind="first"`에서만 |
  | `title` · `action` | ReactNode | `hero`에서 필수 | 큰 상자 제목(h3 — 크기는 적지 않고 h3 기본 1.17em을 물려받는다, 옛 `js/menu/dashboard.js:61` 인라인 h3와 같음) · 주 버튼(`Button variant="primary"`) |
  | `icon` | `IconName` | `area`에서 필수 | 안내 아이콘(`--line-control` 색) |
  | `iconSize` | `EmptyIconSize` — `hero` · `empty` | `empty` | `area`만. `empty`(선 `light`)는 변환 과정 칸, `hero`는 브라우저 캡처 자리 |
  | `className` | string | 없음 | 배치(바깥 여백)만 — 화면 머리 아래 점선 상자의 위아래 여백(`js/menu/studio.js:120` `margin:20px 0`)은 쓰는 곳이 준다 |

  | `container` | 모양 | 이음 근거 |
  |---|---|---|
  | `table` | 표 안 한 행 — 가운데 · 흐린 글자(위아래 `--empty-pad-y`) · 아래 1px `--line-divider`(표 본문 행과 같은 선) | `css/console.css:201,212` |
  | `panel` | 점선 상자(`--empty-pad-panel`), `sm`은 작은 판. `hero`는 실선 상자(`--empty-pad-hero`) + 제목 + 보조 문장 + 주 버튼 | `css/console.css:366-368,502` · `js/menu/dashboard.js:61` |
  | `inline` | 테두리 없는 가운데 한 줄 | `css/console.css:135` |
  | `area` | 테두리 없는 큰 자리 + 위 아이콘(위아래 `--empty-pad-y`) | `css/console.css:769-770` |
  - 글자는 흐린 글(`--text-faint`)이고 문장 안 굵은 글(`<b>`)만 한 단계 진하다(`css/console.css:368`)
  - 함께 내보내는 것(`@/ui`) — 타입 `EmptyStateProps` · `EmptyKind` · `EmptyContainer` · `EmptyPanelSize` · `EmptyIconSize`
- **상태** 없다(그릇). 문장 안 링크 · 버튼이 상태를 낸다.
- **접근성** 아이콘은 장식(`aria-hidden`)이다. 빈 상태는 알림이 아니라 `role`을 두지 않는다(이음 그대로).
- **카탈로그** `EmptyState`

### FailureBlock · ErrorBlock
- **쓰는 곳** 요청 실패를 그 자리에 보일 때 — 이음 알림 상자(`.notice` `css/console.css:270-272` + `warn` · `danger` `css/console.css:643-649`)에 경고 아이콘 + 굵은 머리 한 줄(있는 자리만) + 서버 문장 원문(DESIGN Copy 실패 · 핵심 규칙 8). `FailureBlock`은 화면 첫 조회 실패(`ScreenState`가 그린다) · 층 안 요청 실패(`js/menu/deploy.js:116,120` · `js/menu/sources.js:74` · `js/menu/discovery.js:267-268`)에, `ErrorBlock`은 화면 안 영역 첫 조회 실패(그 상자 안)에 쓴다.
- **쓰지 않는 곳** 버튼 한 번의 쓰기 실패 → 경고 `Toast`(`toast.warn`) · 새로 받기 · 폴링 실패 → 표시 없음(이전 값) · 결과의 일부인 실패(`ok: false` · 로그 상세 `note` · 변환 과정 실패 단계) → `Notice`(결과 자리 — `js/menu/logs.js:45` · `js/common/convert.js:183`) · 실패가 아닌 안내 · 정보 상자 → `Notice`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `message` | string | 필수 | 원문 — `ApiError.message`(서버 `resultMsg` 그대로 또는 `copy/errors`의 고정 문구). 줄바꿈을 지킨다(`white-space: pre-wrap` — `js/menu/deploy.js:116`) |
  | `tone` | `FailureTone` — `warn` · `danger` | 필수 | 색의 뜻 — 자리마다 이음 그대로(연결 · 탐색 · 변환 과정 `warn`, 배포 `danger`) |
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
  | `notFound` | ReactNode | 없음 | `not-found`에 그린다. 없는 탐색 작업 주소는 머리와 같은 뒤로 링크(`LinkButton variant="back"`)와 `FailureBlock tone="warn"`(머리 없이 서버 404 원문)이다 — 새 문구 없음. 없으면 `error`처럼 실패 상자를 그린다 |
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

### Notice
- **쓰는 곳** 아이콘이 붙은 안내 · 경고 상자 — 결과의 일부인 실패(로그 상세 위 서버 문장 `danger` `js/menu/logs.js:45`, 변환 과정 실패 단계 `warn` `js/common/convert.js:183` — 같은 `note`를 두 자리에 그리는 것은 옛 그대로), 원본 연결 안내(`js/menu/sources.js:71,79`), 스튜디오 알림 띠(`js/menu/studio.js:59-66` — 상태별 알림 띠는 따로 부품을 두지 않고 이 부품 조합이다: 굵은 첫 문장 `<b>` · `InlineCode` · `LinkButton` · `action` 작은 버튼), 배포 · 탐색 안내(`js/menu/deploy.js:25,150-153` · `js/menu/discovery.js:42,268,304,339-348`)(이음 `.notice` `css/console.css:270-272,643-650`).
- **쓰지 않는 곳** 요청 실패를 그 자리에 → `FailureBlock` · `ErrorBlock` · 버튼 한 번의 결과 → `Toast` · 표 · 상자 아래 한 줄 안내 → `HelpText` · 대시보드 확인 항목 줄 → 그 화면 조각(대시보드).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `tone` | `NoticeTone` — `info` · `warn` · `danger` · `mute` | `info` | 바탕 · 아이콘 색 — 아래 표 |
  | `icon` | `IconName` | tone별 | 아이콘(`lg`) — 생략하면 `info` · `mute` → `info`, `warn` · `danger` → `alert`. 자리마다 옛 아이콘을 준다(`lock` · `search` · `shield` 등) |
  | `action` | ReactNode | 없음 | 오른쪽 버튼(`Button size="sm"` — `css/console.css:650`) |
  | `children` | ReactNode | 필수 | 문장 — 굵은 글(`<b>`)은 `--text` |
  | `className` | string | 없음 | 배치(바깥 여백)만 — 옛 인라인 `margin`(`js/common/convert.js:183` `margin:0` · `js/menu/logs.js:45` 아래 8)은 쓰는 곳 |

  | `tone` | 바탕 · 테두리 | 아이콘 |
  |---|---|---|
  | `info` | `--primary-bg` · 1px `--primary-line` | `--primary` |
  | `warn` | `--warn-bg` · 테두리 투명 | `--warn` |
  | `danger` | `--danger-bg` · 테두리 투명 | `--danger` |
  | `mute` | `--surface-sub` · 1px `--line-divider` | `--text-faint` |
  - 글자는 `--text-muted`. 줄바꿈은 지금 자리 그대로 접는다(여러 줄 원문을 지켜야 하는 배포 자리는 AI 연결 배포를 옮길 때 정한다). 진행 중 도는 원(`js/menu/deploy.js:108`)도 그때 더한다
  - 함께 내보내는 것(`@/ui`) — 타입 `NoticeProps` · `NoticeTone`
- **상태** 없다(그릇). `action` 버튼이 상태를 낸다.
- **접근성** `role`을 두지 않는다(이음 그대로 — 알림이 아니라 그 자리의 글). 아이콘은 장식이고 뜻은 문장이 전한다.
- **카탈로그** `Notice`

## 층

층 공통 — `ui/layers`(안쪽 전용 — `@/ui`로 내보내는 것은 `closeAllLayers` · `useOpenLayers` 둘). 쓰는 곳은 DESIGN 쌓임 · 접근성 `층`. `Toast` · `Dock`은 층 목록 밖이다(Esc · `closeAllLayers` · 포커스 복귀와 상관없고 `useOpenLayers`에 잡히지 않는다 — `Dock`은 그 값을 읽기만 한다).
- **여는 법** — 기본 `<dialog>`를 `show()`로 연다(top layer를 쓰지 않는다). 포커스를 가두지 않는다 — Tab이 층 밖으로 나간다(이음 그대로 — 닫은 뒤 포커스 복귀만 더했다)
- **가림막 · z** — 층마다 `Overlay`를 함께 그리고 z는 DESIGN 쌓임 짝(`--z-modal-scrim` · `--z-modal`, 드로어는 `--z-drawer-scrim` · `--z-drawer`)이다. 층과 가림막은 `document.body`로 포털한다(셸의 쌓임 맥락 밖)
- **Esc** — 문서의 keydown 하나가 열린 층 중 맨 위 층만 닫는다. 맨 위는 연 순서가 아니라 z 순서다 — 모달 종류가 드로어 위(DESIGN 쌓임)이고, 같은 종류면 나중에 연 것이다(이음 `js/main.js:55` — 모달이 보이면 모달만). 모달이 열린 채(가두지 않으므로) Tab으로 닿은 버튼이 드로어를 열어도 드로어는 모달 아래에 깔리고 Esc는 모달을 먼저, 한 번 더 누르면 드로어를 닫는다. 한글 조합 중 Esc는 무시한다. 맨 위 층이 `dismissible=false`면 아무것도 하지 않는다
- **포커스 복귀** — 열 때 포커스가 있던 요소를 기억했다가 닫을 때 돌려준다. 그 요소가 사라졌으면(알림이 사라짐 · 행 삭제 · 마법사 완료 뒤 이동) 대체 자리로 — ① 쓰는 곳의 `returnFocusFallback()`(없거나 null이면 다음) ② 지금 화면의 `PageHead` 제목(h2 `tabIndex=-1` — PageHead 절) ③ 셸 본문 `<main>`(`tabIndex=-1` — 셸 절). 이 대체 순서는 두 경우에 모두 탄다 — (a) 연 컨트롤이 사라졌을 때, (b) 열 때 층 밖에 포커스된 요소가 없었을 때(포커스가 `body`에 있었음 — 닫은 뒤에도 `body`에 남지 않게 한다). 셋 다 없으면 옮기지 않는다(하나라도 있으면 그곳으로 옮긴다 — 카탈로그의 `<main>`은 `tabIndex`가 없어 `focus()`가 아무것도 하지 않으므로 포커스가 그대로다). 닫는 순간 포커스가 층 안에 있거나 사라졌을 때만 옮긴다 — 층 밖으로 Tab해 간 포커스는 빼앗지 않는다. 열린 채 다른 대상을 열면(`contentKey` — Modal · Drawer) 기억할 요소를 다시 잡는다
- **닫힌 층의 내용** — `Modal` · `Drawer`는 `open=false`여도 `children`을 그린다(닫힌 `<dialog>`라 보이지 않고 포커스를 받지 않는다). 닫힘 전환 동안 보이는 내용은 쓰는 곳이 남겨 둔다 — 닫으며 `children`을 비우면 빈 층이 사라지는 모습이 보인다. 다시 열 때 새 상태(마법사 입력)는 쓰는 곳이 새 `key`로 만든다(옛 `closeDrawer`가 마법사 상태를 버렸다 — `js/common/overlay.js:12`)
- **요청 중 닫기** — `dismissible` 기본 true라 요청 중에도 ✕ · 취소 · Esc · 가림막으로 닫힌다(옛 그대로). 요청은 이어지고 결과 안내는 요청 쪽(훅)이 토스트로 한다(DESIGN 이식 기간 고침). 요청 중 잠그는 것은 확인 버튼(`Modal` `confirmDisabled`) · 발 버튼(`Button` `pending`)뿐이다 — 잠긴 동안 포커스는 그 버튼에 남는다
- **층 호스트** — 여러 화면이 여는 층(연결 마법사 · 재인증 · 원본 삭제 확인 · 탐색 기록 삭제 확인 · 키 결과 · 탐색 근거)은 앱 층의 층 호스트(`app/LayerHost`)가 드로어 한 칸 · 모달 한 칸으로 그린다(이음 `#drawer` · `#modal` 한 칸씩 — `index.html:43,45`). 이 부품들의 계약 — 칸마다 `Drawer` · `Modal` 하나를 늘 그려 두고 내용 · prop만 바꾼다 · 같은 칸에 다른 대상을 열면 `contentKey`를 바꾼다(재인증 A → 재인증 B, 재인증 → 원본 삭제 확인) · `onOpenChange(false)`에서 칸의 `open`만 끄고 내용은 다음 열기까지 남긴다 · 드로어 칸과 모달 칸은 함께 열릴 수 있고 모달이 위다(z · Esc 맨 위 층) · `closeAllLayers()`는 층마다 `onOpenChange(false)`를 부르므로 호스트 저장소가 닫힘을 받는다. 한 화면만 여는 층(호출 로그 상세)은 그 화면이 직접 그린다
- **메뉴 이동** — `closeAllLayers()`가 열린 층을 모두 닫는다(나중에 연 것부터, `dismissible`과 상관없이). 셸이 메뉴(`menuOf`)가 바뀔 때 부른다. 화면이 쥔 층은 화면이 사라지며 함께 닫힌다
- **열린 층** — `useOpenLayers()`가 `{ modal: boolean; drawer: boolean }`을 돌려준다 — 지금 열린 층 중 모달 · 드로어가 있는지(층이 열리고 닫힐 때 다시 그려지고, 요약이 그대로면 그리지 않는다). 화면이 층 때문에 멈추거나 숨길 때 읽는다 — 모달이 열린 동안 폴링을 멈추고(이음 `js/menu/deploy.js:133`), 드로어가 열리면 도크를 숨긴다(`Dock`이 직접 읽는다 — `css/console.css:225`). 층을 열고 닫는 값이 아니라 읽기 전용이다. 카탈로그 Modal 절의 "useOpenLayers" 줄이 이 값을 보인다
- **공통 prop** — `open` · `onOpenChange`(✕ · 취소 · Esc · 가림막 모두 `onOpenChange(false)`) · `dismissible`(기본 true) · `returnFocusFallback` · `contentKey`

### Overlay
- **쓰는 곳** 층 뒤 가림막 — `Modal` · `Drawer`가 안에서 그린다(이음 `.overlay` · `.overlay.m` `css/console.css:239-241`, `index.html:42,44`).
- **쓰지 않는 곳** 화면 · 앱 층이 가림막만 쓰기 → 층 부품(`Modal` · `Drawer`) — `@/ui`로 내보내지 않는다.
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
- **쓰지 않는 곳** 여러 단계 · 긴 상세 → `Drawer` · 버튼 한 번의 결과 알림 → `Toast` · `window.confirm` · `alert` · `prompt` → 이 부품(쓰지 않는다 — oxlint `no-alert`).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `open` · `onOpenChange` | boolean · `(open: boolean) => void` | 필수 | 제어(층 공통) |
  | `title` | ReactNode | 필수 | 머리(파란 띠) 제목 — `aria-labelledby` 대상 |
  | `children` | ReactNode | 필수 | 본문(넘치면 본문만 스크롤) |
  | `size` | `ModalSize` — `md` · `wide` | `md` | 폭 `--w-modal` · `--w-modal-wide`(화면이 좁으면 화면 폭 − 양옆 `--s-4`) |
  | `confirmLabel` · `onConfirm` | ReactNode · `() => void` | 없음 | 확인 버튼(`primary`, 발 끝). 없으면 확인 버튼 없음(안내 모달). 누르면 `onConfirm`만 부른다 — 닫기는 쓰는 곳이 성공 뒤에 한다(`js/main.js:42`) |
  | `confirmDisabled` | boolean | false | 요청 중 확인 잠금(연타로 요청이 겹치지 않게) — 확인 버튼의 `Button` `pending`이다(native `disabled`가 아니다): 누름 · Enter · Space를 무시하고 포커스는 확인 버튼에 남아, 풀리면 그 자리에서 다시 누른다. 요청 중이 아닌 잠금에는 쓰지 않는다 |
  | `cancelLabel` | ReactNode | `LAYER_COPY.cancel` | 취소 버튼 글자 — 안내 모달은 "닫기" |
  | `hideCancel` | boolean | false | 취소 버튼을 없앤다(이음 `opt.noCancel`) |
  | `extra` | ReactNode | 없음 | 발에서 취소 앞에 두는 것(이음 `opt.extra`) |
  | `dismissible` | boolean | true | false면 Esc · 가림막으로 닫히지 않는다 — 한 번만 보이는 값(키 발급 결과). ✕ · 취소는 그대로 닫는다(`data-dismissible`) |
  | `returnFocusFallback` | `() => HTMLElement \| null` | 없음 | 연 컨트롤이 닫힐 때 사라졌으면 포커스를 둘 곳 — 없으면 층 공통 기본 대체 자리(화면 제목 → 본문) |
  | `contentKey` | string · number | 없음 | 보이는 대상 — 열린 채 바뀌면 다시 연 것으로 친다: 그 순간 층 밖에 있던 포커스를 복귀 대상으로 다시 잡고 · 첫 포커스 규칙(아래 상태)으로 옮기고 · 본문을 맨 위로(옛 `openModal`은 열려 있어도 부를 때마다 내용을 바꾸고 첫 포커스를 다시 잡았다 — `js/common/overlay.js:20-23`). 같은 Modal로 다른 대상을 여는 곳(층 호스트 — 재인증 A → 재인증 B, 재인증 → 원본 삭제 확인)이 준다. 없으면 `open`이 바뀔 때만 |
  - 머리 — 파란 띠(`--h-modal-head` · `--brand-band`) + 제목 + 닫기 ✕(`IconButton variant="on-band" iconSize="xl"` — `css/console.css:405-407`). 본문 — 안쪽 `--modal-pad`, 넘치면 본문만 스크롤. 발 — 가운데 정렬, 버튼 최소 폭 96(`css/console.css:408-411`)
  - 상자 — `--shadow-float` · 최대 높이는 화면 높이에서 위아래 여백을 뺀 값. 나타남 · 사라짐은 `--m-modal` 페이드 + 조금 아래에서 올라옴(`css/console.css:402-404`)
  - 열린 모달에 다른 내용을 보이기(이음 "내용 교체" — `js/menu/deploy.js:120,176`)는 같은 Modal의 `title` · `children`을 바꾼다. 다른 대상을 열면 `contentKey`도 바꾼다 — 같은 일 안의 내용 교체가 첫 포커스를 다시 잡는지는 그 메뉴를 옮길 때 이음 동작으로 정한다
  - **확인 모달**(되돌릴 수 없는 동작 — 원본 시스템 삭제 · 키 폐기 · 서버 중지 · 탐색 기록 삭제, 이음 `js/menu/sources.js:144` · `js/menu/deploy.js:162,181` · `js/menu/discovery.js:391`)은 따로 부품을 두지 않고 이 부품으로 그린다 — `title` 동작 이름 · 본문 한 문단(대상 이름 `<b>`, 문단 바깥 여백 없음) · `confirmLabel` 동작 낱말("삭제" · "폐기" · "중지"). 확인 버튼은 `primary`다 — 위험색이 아니다(이음 그대로). 본문에 입력이 없어 첫 포커스는 확인 버튼이다(DESIGN 이식 기간 — 검토하고 옛 그대로 둔 것). 요청 중 `confirmDisabled`, 닫기는 성공 뒤 쓰는 곳이 한다(`js/main.js:42`). `window.confirm`을 쓰지 않는다
  - 진행을 품은 모달(재인증 — 본문 문단 + 인증 칸)도 같은 부품이다 — 첫 포커스는 본문의 첫 `input`(인증 방식 `select`는 건너뛴다), 실패는 경고 토스트이고 모달은 열린 채 남는다(`js/menu/sources.js:136-139`)
  - 함께 내보내는 것(`@/ui`) — `closeAllLayers` · `useOpenLayers` · 타입 `ModalProps` · `ModalSize` · `OpenLayers`
- **상태** `data-size` · `data-dismissible`. 첫 포커스는 열릴 때(그리고 열린 채 `contentKey`가 바뀔 때) 다음 순서의 첫 대상이다. ① 본문의 첫 `input`(숨김 · 잠긴 것은 건너뛴다 — `select` · `textarea`는 앞에 있어도 입력으로 치지 않는다) ② 없으면 확인 버튼(주색, 잠겨 있으면 건너뛴다) ③ 둘 다 없으면 머리 ✕. 이음 `js/common/overlay.js:23`(`.m-body input` → 확인 버튼)과 같고, 확인 버튼이 없는 안내 모달만 옛은 포커스를 옮기지 않았는데 ✕로 옮긴다(DESIGN `## 이식 기간` 허용 차이 — 사용자가 확인한 결정이다). 닫혀 있어도 `children`을 그린다(층 공통 — 닫힌 층의 내용).
- **접근성** `<dialog aria-modal="true" aria-labelledby>`다(이음 `index.html:45`). 포커스를 가두지 않고, 닫으면 연 컨트롤로 돌아간다(층 공통 — 이음은 돌아가지 않았다). 머리 ✕의 링은 흰색이다.
- **카탈로그** `Modal`

### Drawer
- **쓰는 곳** 오른쪽에서 밀려오는 상세 · 여러 단계 — 호출 로그 상세(`js/menu/logs.js:35-48`) · 원본 연결 마법사(`js/menu/sources.js:101`) · 탐색 마법사 · 탐색 근거(`js/menu/discovery.js:83,329`)(이음 `openDrawer` `js/common/overlay.js:4-14`, `.drawer` · `.d-head` · `.d-body` · `.d-foot` `css/console.css:242-254`, `index.html:43`).
- **쓰지 않는 곳** 짧은 확인 · 입력 → `Modal` · 결과 알림 → `Toast` · 본문 옆 상세(목록 + 상세) → `SplitLayout`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `open` · `onOpenChange` | boolean · `(open: boolean) => void` | 필수 | 제어(층 공통) |
  | `title` | ReactNode | 필수 | 머리 제목(h3) — `aria-labelledby` 대상 |
  | `titleMono` | boolean | false | 제목을 고정폭 글꼴로(도구 id · 메서드 경로 — `js/menu/logs.js:35` `h3.mono`) |
  | `overline` | ReactNode | 없음 | 제목 위 작은 라벨(`--primary` — "호출 기록" · "원본 시스템" · "탐색 근거", `.ag` `css/console.css:247`) |
  | `description` | ReactNode | 없음 | 제목 아래 설명 한 줄(`--text-muted`) |
  | `children` | ReactNode | 필수 | 본문 — 넘치면 본문만 스크롤 |
  | `footer` | ReactNode | 없음 | 발 오른쪽 버튼들 — 닫기("닫기" `primary`)도 쓰는 곳이 넣는다(`js/menu/logs.js:48`) |
  | `footerInfo` | ReactNode | 없음 | 발 왼쪽 정보 — 굵은 글(`<b>`)은 `--primary`(선택 수 — `css/console.css:252-253`) |
  | `scrollResetKey` | string · number | 없음 | 바뀌면 본문 스크롤을 맨 위로(마법사 단계 이동) |
  | `contentKey` | string · number | 없음 | 보이는 항목(행 id) — 열린 채 바뀌면 다시 연 것으로 친다: 그 순간의 포커스를 복귀 대상으로 다시 잡고 · 첫 포커스(✕)로 옮기고 · 본문을 맨 위로(옛 `openDrawer` 재호출 — `js/common/overlay.js:5,8`). 같은 Drawer로 다른 항목을 보이는 곳(호출 로그 상세 — 기록 id)이 준다. 없으면 `open`이 바뀔 때만 |
  | `dismissible` · `returnFocusFallback` | 층 공통 | true · 없음 | Modal과 같다 |
  - 머리 — 위 `--bw-band` `--brand-band` 띠, 아래 1px `--line-divider`, 안쪽 `--drawer-head-pad`. 오른쪽 닫기 ✕(`IconButton iconSize="xl"`, 이름 `LAYER_COPY.close` — `js/menu/logs.js:35`)
  - 본문 — 안쪽 `--drawer-body-pad`. 발 — `--surface-sub` 줄 · 위 1px `--line-divider` · 안쪽 `--drawer-foot-pad` · 버튼 최소 폭 84(`css/console.css:254`). `footer` · `footerInfo`가 둘 다 없으면 발을 그리지 않는다
  - 상자 — 폭 `min(var(--w-drawer), 100vw)` · 화면 높이 · 안전 영역 위아래 여백 · `--shadow-float`. 나타남 · 사라짐은 `--m-drawer` `--ease-out`으로 오른쪽에서 밀려옴(`css/console.css:242-243`)
  - 열린 채 다른 내용은 같은 Drawer의 prop · `children`을 바꾼다 — 마법사 단계는 `scrollResetKey`, 다른 항목(다른 행 상세)은 `contentKey`도 준다
  - **드로어 마법사**(연결 마법사 — 단계 · 모드 · 검증 · 요청은 앱 층 `app/sources/SourceWizard`가 조립하고 이 문서에 절을 두지 않는다) — 이 부품이 맡는 것은 틀뿐이다: 머리(`overline` · `title` · `description`) · 본문 스크롤 · 발(`footerInfo` 단계 수 "n/4 단계" · `footer` 이전 `Button` + 다음 · 시작 `Button variant="primary"`). 본문은 맨 위 `StepIndicator variant="wizard"` 다음 단계 본문(`Field` · `Input` · `Textarea` · `FileDrop` · `RadioList` · `CardGrid` + `RadioCard` · `ProgressBar` · `ProgressList` · `Notice` · `FailureBlock`)이다. 단계 이동은 `scrollResetKey`(본문 맨 위)만 바꾸고 `contentKey`는 넘기지 않는다 — 옛 `renderWz`는 열린 드로어의 내용만 바꾸고 포커스를 옮기지 않았다(`js/menu/sources.js:110`). 탐색 모드(자동 탐색)도 같은 틀에 단계 본문만 바꾼다(`js/menu/discovery.js:80-88`) — 3단계(연결 방식 · 탐색 대상 · 안전 설정)이고 발은 "n/3 단계"다. 마지막 단계의 시작 버튼은 승인 상자를 켜기 전까지 `disabled`(조건 잠금 — `pending`이 아니다 — `js/menu/discovery.js:86,415`)이고 글자는 시작 시각에 따라 "탐색 시작" · "탐색 예약"이다. 단계 본문은 `DiscoveryZone` · `Field` · `FieldNote` · `FieldPair` · `Notice` · `SettingRow` · `TagInput` · `RadioCard`(`option`) · `Checkbox`(승인 상자는 앱 층 조각)
  - 층 종류 `drawer` — `useOpenLayers().drawer`가 켜진다(`Dock` 숨김 — 옛 `body.d-open` `css/console.css:225`)
  - 함께 내보내는 것(`@/ui`) — 타입 `DrawerProps`
- **상태** 열림은 `<dialog open>`이다. `data-dismissible`. 열린 채 `contentKey`가 바뀌어도 층은 그대로다 — 쌓임 순서 · Esc 맨 위 층 · `useOpenLayers`를 다시 등록하지 않는다. 닫혀 있어도 `children`을 그린다(층 공통 — 닫힌 층의 내용).
- **접근성** `<dialog aria-modal="true" aria-labelledby>`이고 제목이 이름이다 — 옛 `aria-labelledby="dTitle"`은 가리킬 제목이 없는 자리가 있었다(`index.html:43` · `js/menu/logs.js:35` — DESIGN 이식 기간 허용 차이, 보이지 않는 ARIA 보강). 첫 포커스는 드로어 안 문서 순서로 첫 버튼 · 입력(잠긴 것 제외)이다 — 머리 ✕가 앞이면 ✕(`js/common/overlay.js:8`). 가두지 않고, Esc는 맨 위 층만(모달이 위면 모달 먼저 — `js/main.js:55`), 닫으면 연 컨트롤(누른 행)로 돌아간다(`js/common/overlay.js:13`). 열린 채 다른 항목을 열면(`contentKey`가 바뀜) 그 순간 포커스가 있던 층 밖 요소(새로 누른 행)를 복귀 대상으로 다시 잡고 첫 포커스(✕)로 옮긴다 — 닫으면 마지막으로 연 컨트롤로, 그것이 사라졌으면 대체 자리로 간다. 그 순간 포커스가 층 안 · `body`면 앞 대상을 지킨다(옛 `openDrawer`는 열려 있어도 부를 때마다 `lastFocus`를 다시 잡고 ✕로 옮겼다 — `js/common/overlay.js:5,8`).
- **폭**
  - 760: 머리 · 본문 · 발 안쪽 여백이 줄어든다(`css/console.css:477-479`)
- **카탈로그** `Drawer`

### Toast
- **쓰는 곳** 버튼 한 번 · 요청 하나의 결과 알림 — 완료(기본) · 경고(쓰기 실패 원문 · 입력 거절 — 호출 로그 상세 조회 실패 `js/menu/logs.js:31`) · 안내(info)(이음 `toast()` `js/common/overlay.js:26-33`, `#toast` `index.html:46`, `.toast` `css/console.css:421-425`). 앱에 하나다 — 앱 층 `RootLayout`이 셸 옆에 붙이고, 띄우기는 컴포넌트 밖 `toast()` · `toast.warn()` · `toast.info()`(`app/toast`)가 한다.
- **쓰지 않는 곳** 그 자리에 남아야 하는 실패 → `FailureBlock` · `ErrorBlock` · 확인이 필요한 일 → `Modal` · 계속 보이는 안내 → `Notice` · 화면이 토스트를 직접 그리기 → `toast()`를 부른다(부품을 두 번 두지 않는다).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `item` | `ToastItem \| null`(`app/toast` 타입) | 필수 | 지금 한 칸 — `id` · `kind`(`default` · `warn` · `info`) · `message` · `open`. 한 번도 띄우지 않았으면 null |
  | `onDone` | `(id: number) => void` | 필수 | 표시 시간이 끝나면 그 `id`로 부른다 — 저장소(`dismissToast`)는 id가 같을 때만 `open`을 끄고 글자는 남긴다 |
  - 한 칸 덮어쓰기 — 새 토스트(새 `id` — 같은 글자여도 id가 바뀐다)는 내용을 바로 바꾸고 표시 시간을 처음부터 다시 센다(옛 `clearTimeout` 뒤 다시 — `js/common/overlay.js:32`). 닫혀도 글자가 남아 사라지는 전환 동안 비지 않는다
  - 표시 시간 — `--toast-duration`을 `getComputedStyle`로 읽는다. 운영 빌드가 `2800ms`를 `2.8s`로 줄여 쓰므로 `ms` · `s`를 모두 해석한다. 모션 줄이기에서도 같은 시간이다(DESIGN Motion — 토큰을 0으로 다시 정의하지 않는다). 읽지 못하면 개발 콘솔에 한 번 경고하고 다음 토스트가 덮을 때까지 둔다(값을 코드에 따로 두지 않는다). 닫기는 타이머다 — 애니메이션 끝 이벤트로 닫지 않는다
  - 종류 → 아이콘(`lg` · 선 `bold`): `default` → `check`(`--inverse-ok`) · `warn` → `alert`(`--inverse-warn`) · `info` → `info`(`--inverse-primary`)(`js/common/overlay.js:30` · `css/console.css:423-425`). 바탕 `--toast-bg` · 글자 `--on-fill` · `--shadow-float`
  - 글자는 텍스트로만 그리고 줄바꿈을 지킨다(`white-space: pre-wrap` — 서버 원문 여러 줄). 옛은 HTML을 해석했다(DESIGN 이식 기간 허용 차이 — 렌더)
  - 자리 — 화면 위 가운데(안전 영역 아래 `--s-4-5`), 최대 폭은 화면 폭 − 양옆 `--s-4`. 나타남 · 사라짐은 `--m-fade` 페이드 + 조금 위에서 내려옴(`css/console.css:421-422`)
  - 층 위 — Popover(`popover="manual"`)로 마운트할 때 한 번 최상층에 올리고 내리지 않는다(보임은 `data-open`). 모달 · 드로어(`show()` — 최상층이 아니다)보다 늘 위다(옛 z 모달 51 < 토스트 60). DESIGN 쌓임의 `--z-toast` 자리
  - 함께 내보내는 것(`@/ui`) — 타입 `ToastProps`. 저장소 · `toast()` · `dismissToast` · `useToastItem` · 타입 `ToastItem`은 `app/toast`(앱 층)
- **상태** `data-open`(`item.open`) · `data-kind`. 닫혀 있으면 투명 · 누름 통과다. `item`이 null이면 빈 그릇이다.
- **접근성** 그릇은 처음부터 문서에 있는 `role="status"` `aria-live="polite"`다(`index.html:46`) — 새 글자가 읽힌다. 포커스를 옮기지 않는다. 아이콘은 장식이고 뜻은 글자가 전한다.
- **카탈로그** `Toast`

### Dock
- **쓰는 곳** 여러 항목을 고르면 화면 아래 가운데에 떠 있는 일괄 작업 줄 — 탐색 결과 "선택한 API"(검토 대기에서만 — `js/menu/discovery.js:316`)(이음 `.dock` `css/console.css:223-236`, 760 `css/console.css:482-483`). 고르기 · 기본 선택 · 등록 요청은 쓰는 곳이다.
- **쓰지 않는 곳** 확인 · 입력 → `Modal` · 결과 알림 → `Toast` · 목록 위 도구 줄 → `Toolbar` · 밝은 바탕의 버튼 → `Button` · `LinkButton`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `label` | string | 필수 | 줄 이름(`role="region"`의 `aria-label` — 옛 "선택한 API") |
  | `open` | boolean | 필수 | 보임 — 처음 그릴 때 `true`면 올라오는 모션 없이 보인 채로 그린다(옛은 처음부터 `.show`). `true` → `false`면 `--m-dock` · `--ease-out`으로 내려가고 끝나면 숨는다, `false` → `true`면 올라온다 |
  | `summary` | ReactNode | 필수 | 왼쪽 요약 — 굵은 글(`<b>`)은 `--inverse-primary` 한 단계 큰 글자(옛 `.cnt b` — 선택 수) |
  | `children` | ReactNode | 필수 | 오른쪽 동작 — `DockLinkButton` · `DockSeparator` · `DockButton`을 순서대로 |

  | 조각 | prop | 뜻 |
  |---|---|---|
  | `DockButton` | `icon` · `pending` · 그 밖 `<button>` 속성 | 어두운 바탕의 주 버튼(높이 `--h-md`) — `--inverse-fill` 필 · `--on-fill` 글자(옛 `.dock .btn.primary` `css/console.css:233-234`). `pending`은 `Button`과 같은 계약. 쓰는 화면이 있는 주 버튼 하나뿐이라 `variant`가 없다 — 옛 보조(테두리) · 위험 버튼(`:231-232,235-236`)은 쓰는 화면이 생기면 더한다 |
  | `DockLinkButton` | `onClick` · `disabled` · `children` | 밑줄 글자 버튼(`--on-fill-quiet` — 옛 `.clr` "추천만 선택") |
  | `DockSeparator` | 없음 | 세로 구분선(1px · `--on-fill-subtle` · 고유 높이 22) — 장식 |
  | `DockSpacer` | 없음 | 도크가 마지막 행을 가리지 않게 표 아래 두는 빈 칸(고유 높이 70 — 옛 `js/menu/discovery.js:317`). 도크가 없는 등록 완료에도 두므로 도크와 따로 그린다 |
  - 줄 — `--inverse-surface` · `--on-fill` 글자 · `--r-xl` · `--shadow-float` · 가로로 놓고 좁으면 접는다(사이 `--s-2-5`). 화면 아래에서 `--s-5-5` + 안전 영역 위, 폭은 내용 폭이고 최대 폭은 화면 폭 − 양옆 `--s-3`. 가로 가운데는 좌우 0 + 자동 바깥 여백으로 잡는다 — 옛 왼쪽 50% + 옮기기는 폭이 화면 절반으로 줄어 761~840px에서 일찍 접혔다(DESIGN 이식 기간 고침)
  - 그 자리에 그린다(포털 없음 — 옛 `.dock`도 본문 안이라 Tab 순서가 표 뒤다). 위치는 화면 고정 · 쌓임 `--z-dock`(드로어 가림막 아래)
  - 층 목록 밖이다 — Esc · `closeAllLayers` · 포커스 복귀와 상관없고, 쓰는 화면이 그리고 그 화면과 함께 사라진다
  - 드로어가 열려 있는 동안(`useOpenLayers().drawer`)은 `open`과 상관없이 보이지 않는다 — 모션 없이 `visibility`만(옛 `body.d-open .dock` `css/console.css:225`). 부품이 직접 읽는다
  - 함께 내보내는 것(`@/ui`) — `DockButton` · `DockLinkButton` · `DockSeparator` · `DockSpacer` · 타입 `DockProps` · `DockButtonProps` · `DockLinkButtonProps`
- **상태** `data-open`, 드로어가 열려 있으면 `data-covered`. `DockButton` hover는 `--inverse-fill-hover`다(`css/console.css:234`). disabled · `pending`은 공통(`--opacity-disabled` — 옛 .45, DESIGN 이식 기간 허용 차이 값 정규화)이고 hover 모양이 바뀌지 않는다. `DockLinkButton` hover는 글자 `--on-fill`이다(`css/console.css:229`).
- **접근성** 줄은 `role="region"` + `aria-label`이다(옛 그대로). 숨어 있으면(닫힘 · 드로어 열림) 포커스를 받지 않고 보조기기에도 읽히지 않는다. `DockSpacer` · `DockSeparator`는 장식(`aria-hidden`)이다.
- **폭**
  - 760: 화면 좌우 `--s-3`까지 꽉 차고 안쪽 여백이 줄어든다(`css/console.css:482-483`)
- **카탈로그** `Dock`

## 레이아웃

### PageHead
- **쓰는 곳** 화면 맨 위 제목 + 설명 — 메뉴 화면 여섯(이음 `pageHead(id)` `js/common/state.js:21`, `css/console.css:109-111`). 빈 상태 화면(스튜디오 · 테스트 실행 · 배포)도 같은 머리를 쓴다(`js/menu/studio.js:120`). 탐색 작업 화면 머리(뒤로 링크 + 상태 칩 + 설명 + 오른쪽 버튼 — `js/menu/discovery.js:251-258`, `.page-head .stt` `css/console.css:937`).
- **쓰지 않는 곳** 상자 제목 → `Box` · 상자 없는 절 제목 → `SectionTitle`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `title` | ReactNode | 필수 | 제목(h2). 메뉴 화면은 `SCREEN_LABEL` |
  | `description` | ReactNode | 없음 | 설명 한 줄 — 메뉴 화면은 `copy/shell` `PAGE_DESCRIPTION` |
  | `back` | ReactNode | 없음 | 머리 줄 위 뒤로 링크(`LinkButton variant="back"`) — 제목 줄과 사이 `--s-1-5`(옛 인라인 `margin-top: 6px` `js/menu/discovery.js:257`) |
  | `status` | ReactNode | 없음 | 제목 바로 뒤 상태 칩 — 줄이 글자 바닥선에 맞춰져도 칩은 세로 가운데(옛 `.page-head .stt` `css/console.css:937`) |
  | `actions` | ReactNode | 없음 | 줄 오른쪽 끝 버튼 — 설명 뒤 남은 폭을 비운다(옛 인라인 `span.sp` `flex: 1` `js/menu/discovery.js:257`). 좁아 줄이 접히면 비운 칸(기준 폭 0)은 앞줄에 남고 버튼만 다음 줄 왼쪽으로 내려갈 수 있다(옛 그대로) |
  | `className` | string | 없음 | 배치(바깥 여백)만. `back`이 있으면 뒤로 링크와 머리 줄을 함께 감싼 바깥에 붙는다 |
  - 제목과 설명은 글자 바닥선에 맞춰 한 줄에 놓이고 좁으면 설명이 아래로 접힌다. 아래에 1px `--line-divider`. 줄 차림은 제목 · 상태 · 설명 · (남은 폭) · 동작이다
  - 제목 h2는 `tabIndex=-1`과 표지 `data-page-title`을 가진다 — 층 포커스 복귀의 기본 대체 자리다(층 공통). Tab 순서에는 들지 않는다
- **상태** 없다(그릇).
- **접근성** 제목은 h2다 — 문서의 h1은 LNB 제목 하나다(`index.html:36`). 층을 닫았는데 연 컨트롤이 사라졌으면 포커스가 이 제목으로 온다(옛은 모달 닫은 뒤 포커스를 옮기지 않았다 — DESIGN 이식 기간 고침).
- **폭**
  - 760: 제목이 한 단계 작아진다(`--fs-title-sm` — `css/console.css:462`)
- **카탈로그** `PageHead`

### SectionTitle
- **쓰는 곳** 상자 없는 절 제목 + 작은 보조 — 화면 본문의 절(`section` — 원본 시스템 "2차 개발에서 지원할 연결 방식" `js/menu/sources.js:38` · 자동 탐색 작업 `js/menu/discovery.js:27`, 이음 `.sec-t` `css/console.css:607-608`), 상세 · 드로어 안 소절(`sub` — 도구 설명 · 매핑 · 미리보기 `js/menu/studio.js:94-113`, 배포 상세 `js/menu/deploy.js:46,78,85,89`, 탐색 근거 `js/menu/discovery.js:341-350`, 이음 `.sec2>h4` `:670-673` · 드로어 `:1046-1047`).
- **쓰지 않는 곳** 화면 제목 → `PageHead` · 상세 머리 → `DetailHead` · 상자 머리 → `Box` · 선택지 묶음 라벨 → `GroupLabel`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `level` | `SectionTitleLevel` — `section` · `sub` | `section` | `section` = 절 제목 h3, `sub` = 소절 제목 h4(한 단계 작은 글자) |
  | `title` | ReactNode | 필수 | 제목 |
  | `description` | ReactNode | 없음 | 제목 곁 작은 보조 글(`--text-faint` — 옛 `small`) — 좁으면 아래로 접힌다. 안 글자 색(필수 `*`의 위험색 — 옛 인라인 `js/menu/studio.js:98`)은 쓰는 곳 |
  | `icon` | `IconName` | 없음 | `sub`만 — 제목 앞 아이콘(`md` · `--text-faint` — 탐색 근거 `code` · `globe`, `js/menu/discovery.js:341,344`) |
  | `descriptionMono` | boolean | false | `sub`만 — 보조 글을 고정폭으로(탐색 근거 파일:줄 — 옛 `.drawer .sec2>h4 small` `:1047`). 긴 경로는 좁은 폭에서 아무 곳에서나 접는다 |
  | `actions` | ReactNode | 없음 | `sub`만 — 오른쪽 끝 동작(앞 빈칸이 남은 폭을 차지 — 옛 `.sp`. 미리보기 탭 `SegmentedTabs` · "키 발급" 작은 버튼) |
  | `className` | string | 없음 | 배치만 |
  - 위 여백 · 아래 간격은 부품이 가진다 — 어느 화면에서나 같다(`section` 위 `--s-8`, `sub` 위 `--subsection-top` — 옛 `.sec-t` · `.sec2` margin)
  - 동작은 제목 요소 안에 둔다(옛 그대로 — 밖으로 빼면 좁은 폭 줄바꿈이 옛과 달라진다)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `SectionTitleProps` · `SectionTitleLevel`
- **상태** 없다(그릇). 동작이 낸다.
- **접근성** `section`은 h3(화면 h2 아래), `sub`는 h4(상세 머리 · 상자 · 드로어 h3 아래)다. 제목 이름에는 동작 글자가 함께 읽힌다(옛 그대로). 아이콘은 장식이다.
- **카탈로그** `SectionTitle`

### Box
- **쓰는 곳** 제목 줄이 있는 상자 — 대시보드 구조도 · 시간대 차트 · 확인 항목 · 많이 쓰인 도구(`js/menu/dashboard.js:20,42,47,57`), 스튜디오 · 배포 정책(`variant="policy"` — `js/menu/studio.js:102` · `js/menu/deploy.js:90`), 테스트 실행 · 탐색 화면 상자(이음 `.box` · `.box-h` · `.box-b` `css/console.css:502-506`, `.box.pol` `:702`).
- **쓰지 않는 곳** 화면 제목 → `PageHead` · 상자 없는 절 제목 → `SectionTitle` · 수치 띠 → `StatStrip` · 목록 표(자기 윗선 · 테두리) → `Table` · 점선 빈 상자 · 대시보드 큰 빈 상자 → `EmptyState` · 목록 + 상세의 왼쪽 목록 상자 → `Panel`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `variant` | `BoxVariant` — `default` · `policy` | `default` | `policy` = 정책 상자(실행 정책 · 배포 보안 정책 요약 — 옛 `.box.pol` `css/console.css:702`) — 본문을 늘 감싸고 안쪽이 `padded`보다 작다 |
  | `title` | ReactNode | 없음 | 머리 제목(h3). 없으면 머리 줄을 그리지 않는다(배포 정책 요약 — `js/menu/deploy.js:90`) |
  | `description` | ReactNode | 없음 | 제목 곁 작은 보조 글("최근 24시간" · "2건" — `css/console.css:505`) |
  | `actions` | ReactNode | 없음 | 머리 오른쪽(`LinkButton` · 작은 버튼) |
  | `padded` | boolean | false | 본문 안쪽 여백(`.box-b`). 구조도 · 차트처럼 내용이 자기 여백을 가지면 끈다. `variant="policy"`와 함께 쓰지 않는다(타입이 막는다 — 정책 상자는 늘 감싼다) |
  | `children` | ReactNode | 필수 | 본문 |
  | `className` | string | 없음 | 배치(바깥 여백 · 격자 칸)만 |
  - 상자 — 1px `--line-control` · `--surface`, 그림자 없음(DESIGN 핵심 규칙 4). 머리 — `--surface-sub` 줄 · 아래 1px `--line-divider` · 제목과 동작을 양끝에 두고 좁으면 접는다
  - 머리 두 줄(테스트 실행 대화 상자 — `css/console.css:735-738`) · `section` 이름(`js/menu/playground.js:41,56`)은 테스트 실행을 옮길 때 더한다
  - 함께 내보내는 것(`@/ui`) — 타입 `BoxProps` · `BoxVariant`
- **상태** 없다(그릇).
- **접근성** 제목은 h3다(화면 h2 아래).
- **카탈로그** `Box`

### Toolbar
- **쓰는 곳** 목록 위 한 줄 도구 — 왼쪽 필터 · 빈칸 · 오른쪽 선택 · 검색 · 버튼(호출 로그 `js/menu/logs.js:18-23` · 원본 시스템 `js/menu/sources.js:24` · 스튜디오 `js/menu/studio.js:126` · 탐색 결과 `js/menu/discovery.js:313`)(이음 `.toolbar` · `.sp` · `.lbl2` `css/console.css:596-598`).
- **쓰지 않는 곳** 상자 머리의 동작 → `Box` `actions` · 화면 머리 오른쪽 버튼 → `PageHead` `actions`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `label` | ReactNode | 없음 | 맨 앞 라벨 글자(스튜디오 "원본 시스템" — 옛 `.lbl2` `css/console.css:598`, `js/menu/studio.js:127`). 보이는 글자일 뿐 — 뒤 선택의 이름은 선택의 `aria-label`이다(옛 그대로) |
  | `children` | ReactNode | 필수 | 도구들 — 왼쪽 무리와 오른쪽 무리 사이에 `ToolbarSpacer` |
  | `className` | string | 없음 | 배치(바깥 여백 — 옛 위 22는 쓰는 곳)만 |
  - `ToolbarSpacer` — 남은 폭을 차지하는 빈칸(prop 없음)
  - 한 줄에 놓고 좁으면 접는다(간격 `--s-2`)
  - 함께 내보내는 것(`@/ui`) — `ToolbarSpacer` · 타입 `ToolbarProps`
- **상태** 없다(그릇).
- **폭**
  - 760: 빈칸을 숨긴다 — 검색(`SearchInput variant="toolbar"`)이 남은 폭을 채운다(`css/console.css:898-899`)
- **카탈로그** `Toolbar`

### TwoColumn
- **쓰는 곳** 화면 본문 두 열 — 정해 둔 다섯 조합만(이음 `.dgrid` · `.td-grid` · `.dp-grid` · `.dsum` · `.dgrid2`).
- **쓰지 않는 곳** 고정 목록 열 + 상세(스튜디오 · 배포 · 테스트 실행) → `SplitLayout` · 칸 안 두 칸 · 라벨 + 값 줄 → `FieldPair` · 새 비율 → `design-change`로 조합을 더한다.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `layout` | `TwoColumnLayout` — `main-side` · `main-aside` · `half` · `summary` · `live` | 필수 | 비율 · 간격 · 정렬 · 접는 폭 — 아래 표 |
  | `children` | `[ReactNode, ReactNode]` | 필수 | 두 칸 — 접히면 앞 칸 위, 뒤 칸 아래 |
  | `className` | string | 없음 | 배치(바깥 여백)만 |

  | `layout` | 열 | 간격 | 세로 정렬 | 접는 폭 | 쓰는 곳 · 이음 근거 |
  |---|---|---|---|---|---|
  | `main-side` | 1.55 : 1 | `--s-5` | 위 | 1360 | 대시보드 — `css/console.css:538,868` |
  | `main-aside` | 1fr + `--w-policy-aside` | `--s-7` | 위 | 1360 | 도구 상세 + 정책 — `css/console.css:674,867` |
  | `half` | 1 : 1 | `--s-6` | 위 | 1360 | 배포 상세 — `css/console.css:798,869` |
  | `summary` | 1.35 : 1 | `--s-5` | 늘임 | 1360 | 탐색 결과 요약 — `css/console.css:1019,1049` |
  | `live` | 1.15 : 1 | `--s-5` | 늘임(칸 안 상자가 높이를 채움) | 1100 | 탐색 실시간 — `css/console.css:959-960,1051` |
  - 칸은 최소 폭 0으로 줄어든다(넘치는 내용은 칸 안에서 처리)
  - 함께 내보내는 것(`@/ui`) — 타입 `TwoColumnProps` · `TwoColumnLayout`
- **상태** 없다(그릇).
- **폭**
  - 1360: `main-side` · `main-aside` · `half` · `summary` 한 열
  - 1100: `live` 한 열
- **카탈로그** `TwoColumn`

### SplitLayout
- **쓰는 곳** 왼쪽 고정 열 + 오른쪽 상세 — 변환 스튜디오(도구 목록 + 도구 상세 — `js/menu/studio.js:133`) · AI 연결 배포(묶음 목록 + 묶음 상세 — `js/menu/deploy.js:59`) · 테스트 실행(도구 호출 + 결과 — `js/menu/playground.js:40`)(이음 `.studio` · `.dp` · `.pg` `css/console.css:614,733,784,875,877`).
- **쓰지 않는 곳** 비율로 나누는 화면 두 열 → `TwoColumn` · 칸 안 두 칸 → `FieldPair` · 행을 누르면 여는 상세 → `Drawer`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `variant` | `SplitLayoutVariant` — `list` · `playground` | 필수 | 왼쪽 열 · 간격 — 아래 표 |
  | `children` | `[ReactNode, ReactNode]` | 필수 | 왼쪽 · 오른쪽 — 접히면 왼쪽이 위 |
  | `className` | string | 없음 | 배치(위 바깥 여백 — 스튜디오 16 · 배포 · 테스트 실행 22는 쓰는 곳)만 |

  | `variant` | 왼쪽 열 | 간격 | 세로 정렬 | 접는 폭 | 쓰는 곳 · 이음 근거 |
  |---|---|---|---|---|---|
  | `list` | `--w-list-aside` | `--s-7` | 위 | 1100 | 스튜디오 · 배포 — `:614,784,875` |
  | `playground` | 320 ~ 430(고유 치수) | `--s-6` | 위 | 1100 | 테스트 실행 — `:733,877` |
  - 칸은 최소 폭 0으로 줄어든다(넘치는 내용은 칸 안에서 처리)
  - **목록 + 상세** — `list`의 왼쪽은 `Panel` 안 `SelectableListItem`들(+ `FilterChips variant="band"` · `PanelBand` 안 `SearchInput variant="full"`), 오른쪽은 `<section aria-label>` 안 `DetailHead`로 시작한다. 선택이 없거나 없는 id면 첫 항목을 고르고 주소를 바꾼다(DESIGN 이식 기간 허용 차이 — 없는 id 보정). 필터 · 검색은 목록만 바꾸고 상세는 그대로 둔다 — 고른 항목이 필터 밖이어도 상세를 보인다(`js/menu/studio.js:148,181`). 고른 항목이 목록의 보이는 자리 밖에 있어도 목록을 스크롤하지 않는다. 1100 이하에서 항목을 고르면 상세로 스크롤하는 것은 스튜디오만이다(쓰는 곳 — `useMediaQuery`, 모션 줄이기면 즉시 — `js/menu/studio.js:149`). 저장하지 않은 변경은 상세 머리 동작 줄의 저장 버튼이 켜지는 것으로만 알린다 — 목록 항목 · 머리에 따로 표시를 두지 않는다(옛 그대로 — `js/menu/studio.js:81`)
  - 테스트 실행 열이 접힌 뒤 대화 상자의 최소 높이를 푸는 것은 그 상자 몫이다(`css/console.css:878`)
  - 함께 내보내는 것(`@/ui`) — 타입 `SplitLayoutProps` · `SplitLayoutVariant`
- **상태** 없다(그릇).
- **폭**
  - 1100: 한 열(`css/console.css:875,877`)
- **카탈로그** `SplitLayout`

### Panel
- **쓰는 곳** 목록 + 상세의 왼쪽 목록 상자 — 변환 스튜디오 "도구 목록"(필터 띠 · 검색 · 스크롤 목록 — `js/menu/studio.js:134-139`), AI 연결 배포 "도구 묶음"(목록 + 아래 만들기 버튼 — `js/menu/deploy.js:60-66`)(이음 `.panel` · `.p-head` · `.p-search` `css/console.css:115-118`, `.tool-list` `:620,876`).
- **쓰지 않는 곳** 제목 줄이 있는 화면 상자 → `Box` · 목록 + 상세 배치 → `SplitLayout` · 목록 항목 → `SelectableListItem`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `label` | string | 필수 | 상자 이름(`<section aria-label>` — "도구 목록" · "도구 묶음") |
  | `title` | ReactNode | 필수 | 머리 글자(제목 요소가 아니다 — 옛 `div`) |
  | `count` | ReactNode | 없음 | 머리 오른쪽 수("12개" — 서식은 쓰는 곳) |
  | `tools` | ReactNode | 없음 | 머리 아래 띠들 — `FilterChips variant="band"` · `PanelBand`. 목록 스크롤 밖에 있다 |
  | `scroll` | boolean | false | 본문(`children`)을 최대 높이 안에서 스크롤한다 — 도구 목록 |
  | `footer` | ReactNode | 없음 | 본문 아래 동작 칸 — 안 버튼은 칸 폭을 채운다(옛 인라인 `width:100%` — `js/menu/deploy.js:65`) |
  | `children` | ReactNode | 필수 | 목록(`SelectableListItem`들) 또는 빈 상태(`EmptyState container="inline"`) |
  | `className` | string | 없음 | 배치만 |
  - `PanelBand` — `children` · `className`. 머리 아래 띠 하나(아래 1px `--line-divider` — 검색 줄 `.p-search`). 필터 띠는 `FilterChips variant="band"`가 자기 띠를 가진다
  - 상자 — 1px `--line-control` · `--surface`, 그림자 없음. 머리 — `--surface-sub` · 아래 1px `--line-control` · 굵은 글자, 수는 `--primary`(DESIGN Colors ① 강조 수치)
  - `scroll` 최대 높이는 고유 치수다(760 · 1100 이하 280)
  - 함께 내보내는 것(`@/ui`) — `PanelBand` · 타입 `PanelProps` · `PanelBandProps`
- **상태** 없다(그릇).
- **접근성** `<section aria-label>`이다(옛 그대로). 머리는 제목 요소가 아니다 — 옛 `div` 그대로이고 오른쪽 상세 머리가 h3다. 스크롤 목록은 안의 항목이 포커스를 받으므로 `tabindex`를 두지 않는다.
- **폭**
  - 1100: `scroll` 최대 높이 280(`css/console.css:876`)
- **카탈로그** `Panel`

### DetailHead
- **쓰는 곳** 목록 + 상세의 상세 머리 — 도구 상세(고정폭 도구 id · 상태 칩 · 읽기/쓰기 표지 / 제목 + 작업 코드 · 공개 스위치 · 테스트 실행 · 저장 — `js/menu/studio.js:73-83`), 묶음 상세(묶음 이름 · 배포 상태 칩 / 사용 대상 · 마지막 변경 · 묶음 수정 · 서버 로그 · 중지 · 배포 — `js/menu/deploy.js:68-71`)(이음 `.td-head` `css/console.css:631-637,906`).
- **쓰지 않는 곳** 화면 제목 → `PageHead` · 상자 머리 → `Box` · 드로어 머리 → `Drawer` · 상세 안 소절 제목 → `SectionTitle`(`level="sub"`).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `title` | ReactNode | 필수 | 제목(h3) — 긴 id는 아무 글자에서나 접힌다 |
  | `titleMono` | boolean | false | 제목을 고정폭으로(도구 id). 끄면 본문 글꼴(묶음 이름 — 옛 인라인 `font-family:inherit` `js/menu/deploy.js:69`) |
  | `badges` | ReactNode | 없음 | 제목 뒤 칩 · 표지(`ToolStatusChip` · `ModeTag` · 배포 상태 칩) |
  | `description` | ReactNode | 없음 | 아래 줄 글(`--text-muted`) |
  | `code` | ReactNode | 없음 | 아래 줄 끝 작은 고정폭 글(`--text-muted` — `METHOD path` · SOAP 작업 이름). 설명 뒤에 올 때만 왼쪽에 사이를 둔다 |
  | `actions` | ReactNode | 없음 | 오른쪽 동작 줄(`Switch variant="inline"` · `Button`들) |
  | `className` | string | 없음 | 배치만 |
  - 머리 — 아래 1px `--line-divider`. 글 열은 최소 폭 260이고 동작 줄은 좁으면 아래로 접힌다
  - 제목 웨이트 — 고정폭은 `--fw-mono-strong`, 본문 글꼴은 `--fw-bold`다. 옛 묶음 이름은 600을 썼는데 Noto Sans KR 600을 불러오지 않아 브라우저가 700으로 그렸다 — 모습이 같다(DESIGN 핵심 규칙 5)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `DetailHeadProps`
- **상태** 없다(그릇). 동작 줄의 컨트롤이 낸다.
- **접근성** 제목은 h3다(화면 h2 아래 · 소절 h4 위).
- **폭**
  - 760: 동작 줄이 줄 전체 폭을 쓴다(`css/console.css:906`)
- **카탈로그** `DetailHead`

### SettingRow
- **쓰는 곳** 제목 · 설명 + 오른쪽 컨트롤 한 줄 — 실행 정책 "개인정보 마스킹" · "응답 캐시"(스위치) · 호출 한도(숫자 칸)(`js/menu/studio.js:107-109`), 배포 보안 정책 요약(오른쪽 읽기 전용 값 — `js/menu/deploy.js:91-94`), 탐색 안전 설정(스위치 · 단어 칩 · 선택 카드 · 시각 — `js/menu/discovery.js:68-76`)(이음 `.tg` `css/console.css:712-717`).
- **쓰지 않는 곳** 라벨 + 입력 폼 줄 → `Field` · 정책 상자 틀 → `Box`(`variant="policy"`) · 선택지 묶음 라벨 → `GroupLabel` · 탐색 마법사 입력 묶음 → `DiscoveryZone`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `title` | ReactNode | 필수 | 제목(`--fw-medium`) |
  | `description` | ReactNode | 없음 | 제목 아래 작은 흐린 설명 |
  | `control` | ReactNode | 없음 | 오른쪽 — `Switch` · `Input variant="setting"` · `Select variant="setting"` · 읽기 전용 값(`<b>` — "3개" · "항상" · "도구별"). 둘이면(예약 시각 + 시작 선택) 사이 `--s-4-5`(옛은 두 컨트롤이 `.tg`의 flex 항목이라 간격 12 + 시각 칸 인라인 `margin-right:6px` — `css/console.css:712` · `js/menu/discovery.js:76`). 없으면 글 열만 |
  | `children` | ReactNode | 없음 | 설명 아래 글 열 안 내용 — `TagInput` · `RadioCard variant="option"` 묶음(자동 탐색). 위 `--s-2`(옛 `.bans` · `.radios` 위 여백 `css/console.css:924,929`) |
  | `className` | string | 없음 | 배치만 |
  - 줄 — 글 열이 남은 폭을 차지하고 컨트롤은 위에 맞춘다. 이어진 줄 사이는 위 1px `--line-divider`, 묶음의 첫 줄은 선이 없고 위 여백이 작다(옛 `.tg.first` — 클래스가 아니라 앞 형제로 정한다)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `SettingRowProps`
- **상태** 없다(그릇). 컨트롤이 낸다.
- **접근성** 컨트롤의 이름은 컨트롤이 가진다(옛 `aria-label` — "개인정보 마스킹" · "분당 호출 한도"). 제목이 `children` 묶음의 이름이 되는 줄(검증 방식 선택 카드)은 쓰는 곳이 `title`에 `<span id>`를 넣고 묶음(`role="group"`)의 `aria-labelledby`로 잇는다.
- **카탈로그** `SettingRow`

### GroupLabel
- **쓰는 곳** 선택지 · 체크 묶음 위 굵은 라벨 한 줄 — 실행 정책 "실행 방식"(`sm` — `js/menu/studio.js:103`), 묶음 만들기 · 수정 "포함할 도구"(`md` — `js/menu/deploy.js:195`)(이음 `.d-label` `css/console.css:255,703`).
- **쓰지 않는 곳** 입력 칸 라벨 → `Field` · 라디오 목록 라벨 → `RadioList`(`label`) · 소절 제목 → `SectionTitle` · 상자 제목 → `Box`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `children` | ReactNode | 필수 | 라벨 글자 |
  | `size` | `GroupLabelSize` — `md` · `sm` | `md` | 글자 단계 — `sm`은 정책 상자 안(옛 `.pol .d-label` `:703`) |
  | `id` | string | 없음 | 묶음의 `aria-labelledby` 대상 |
  | `className` | string | 없음 | 배치(바깥 여백 — 정책 상자 아래 8 · 모달 위 12 아래 6은 쓰는 곳)만 |
  - 굵은 `<div>` — 제목 요소가 아니다(옛 그대로)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `GroupLabelProps` · `GroupLabelSize`
- **상태** 없다.
- **접근성** 묶음에 이름이 필요한 자리는 쓰는 곳이 묶음(`role="group"`)의 `aria-labelledby`를 이 `id`에 잇는다 — 옛 묶음에는 이름이 없었다(DESIGN 이식 기간 허용 차이 — 보이지 않는 ARIA 보강).
- **카탈로그** `GroupLabel`

### CardGrid
- **쓰는 곳** 같은 꼴의 카드 · 칸을 고른 열 수로 늘어놓고 좁으면 한 열로 접는 격자 — 정해 둔 세 조합만(이음 `.wz-cards` · `.res-grid` · `.later`).
- **쓰지 않는 곳** 화면 본문 두 열 → `TwoColumn` · 수치 띠 → `StatStrip` · 드로어 안 요약 칸 → `KeyValueGrid` · 새 열 수 · 접는 폭 → `design-change`로 조합을 더한다.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `columns` · `collapseAt` | `2` · `760` / `3` · `760` / `3` · `1100` — 세 조합만(타입이 다른 조합을 막는다) | 필수 | 열 수와 한 열로 접는 폭 — 아래 표 |
  | `children` | ReactNode | 필수 | 칸들 — 순서대로 채운다. 줄 전체를 쓰는 칸(넓은 연결 방식 카드)은 칸의 `className`이 격자 칸을 준다 |
  | `className` | string | 없음 | 배치(바깥 여백 — 옛 결과 칸 아래 14는 쓰는 곳)만 |

  | `columns` · `collapseAt` | 쓰는 곳 | 이음 근거 |
  |---|---|---|
  | `2` · `760` | 연결 방식 카드(`RadioCard`) | `.wz-cards` `css/console.css:820,900` |
  | `3` · `760` | 연결 분석 결과 칸(칸 내용은 쓰는 곳) | `.res-grid` `:849,900` |
  | `3` · `1100` | 2차 연결 방식 카드(`LaterCards` 안) | `.later` `:609,879` |
  - 칸 사이 `--s-2-5` · 열은 같은 폭(최소 폭 0으로 줄어든다)
  - 함께 내보내는 것(`@/ui`) — 타입 `CardGridProps`
- **상태** 없다(그릇).
- **폭**
  - 1100: `collapseAt` 1100이면 한 열
  - 760: `collapseAt` 760이면 한 열
- **카탈로그** `CardGrid`

### 셸
- **쓰는 곳** 모든 메뉴 화면의 틀 — 레일 · GNB · LNB · 본문(이음 `index.html:13-40`, `css/console.css:72-111,486-499`). `src/app/shell/`에 있고 `@/ui`가 아니다 — 앱 층의 `RootLayout`(`src/app/RootLayout.tsx`)이 `<Shell />`을 그린다. 카탈로그(`/_guide`)는 셸 밖이다.
- **쓰지 않는 곳** 화면 안 배치 → `Box` · `Toolbar` · `TwoColumn` · 화면 제목 → `PageHead`.
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
  - 본문 `<main>` — 안쪽 `--content-pad-top` · `--content-pad-x` · `--content-pad-bottom`. 스크롤은 문서가 한다. `tabIndex=-1`이다 — 층 포커스 복귀의 마지막 대체 자리(화면 제목이 없을 때 — 층 공통)이고 Tab 순서에는 들지 않는다
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

## 데이터

### KeyValueGrid
- **쓰는 곳** 드로어 안 요약 칸(작은 키 + 값) — 호출 로그 상세 6칸(`js/menu/logs.js:37-44`) · 탐색 근거(`js/menu/discovery.js:331-338`)(이음 `.lsum` `css/console.css:804-809`).
- **쓰지 않는 곳** 화면 수치 띠 → `StatStrip` · 목록 → `Table` · 입력 폼 → `Field`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `items` | `readonly KeyValueItem[]` — `{ label: ReactNode; value: ReactNode; mono?: boolean; small?: boolean }` | 필수 | 칸 — 순서대로 3열로 채운다. `mono`는 값을 고정폭 작은 글자로(요청 ID — 옛 인라인 12.5px `js/menu/logs.js:43`), `small`은 값을 한 단계 작은 글자로(탐색 근거 "호출된 화면" — 옛 인라인 13px `js/menu/discovery.js:337`). 둘은 함께 쓰지 않는다(타입이 막는다) |
  | `className` | string | 없음 | 배치(바깥 여백 — 옛 아래 16은 쓰는 곳)만 |
  - 상자 — 1px `--line-divider` · `--surface-sub`, 칸 사이 1px `--line-divider`(줄이 바뀐 칸은 위 선). 키는 흐린 작은 글(`--text-faint`), 값은 본문 글
  - 값이 없는 칸은 쓰는 곳이 값 없음 표기(`copy/`)를 넣는다 — 이 부품은 빈 값을 채우지 않는다
  - 긴 값은 칸 안에서 끊을 곳(공백 · 하이픈 · 슬래시)에서 접힌다. 끊을 곳이 없는 값은 칸 밖으로 넘친다 — 옛 `.lsum .v`에도 줄바꿈 규칙이 없다(`css/console.css:809`)
  - 함께 내보내는 것(`@/ui`) — 타입 `KeyValueGridProps` · `KeyValueItem`
- **상태** 없다(표시).
- **접근성** `<dl>`(칸마다 `<dt>` · `<dd>`)로 그린다 — 옛 `div`와 보이는 차이가 없다.
- **폭**
  - 760: 2열(`css/console.css:901-904`)
- **카탈로그** `KeyValueGrid`

### StatStrip
- **쓰는 곳** 화면 머리 아래 수치 띠 — 대시보드 KPI 5칸(`js/menu/dashboard.js:9-15`, `.kpi` `css/console.css:530-537`) · 탐색 실시간 6칸(`js/menu/discovery.js:184-190`, `.dk` `css/console.css:953-958`). 두 옛 띠는 같은 모양이라 하나로 둔다.
- **쓰지 않는 곳** 드로어 안 요약 → `KeyValueGrid` · 상자 안 결과 칸(원본 연결 분석 결과 `.res-grid`) → `CardGrid`(칸 내용은 쓰는 곳).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `columns` | `5` · `6` | 필수 | 칸 수 — `6`은 칸 여백 · 글자가 한 단계 작은 탐색 띠(`.dk`)를 함께 쓴다(6칸 띠는 탐색 화면 하나다) |
  | `items` | `readonly StatItem[]` | 필수 | 칸 — 아래 |
  | `failure` | `{ from: number; content: ReactNode }` | 없음 | 영역 실패 — `from`번째(0부터) 칸부터 끝까지를 그리지 않고 그 자리에 `content`(대개 `ErrorBlock`) 하나를 둔다. 기본 열 수에서는 그 칸들의 열을, 1100 이하에서는 한 줄을 다 쓴다 |
  | `className` | string | 없음 | 배치(바깥 여백 — 옛 위 24 · 14는 쓰는 곳)만 |

  | `StatItem` 필드 | 타입 | 뜻 |
  |---|---|---|
  | `label` | ReactNode | 칸 이름(흐린 작은 글) |
  | `value` | ReactNode | 수치(굵은 큰 글 · `tabular-nums`) — 서식 · 값 없음 표기는 쓰는 곳(`copy/`) |
  | `unit` | ReactNode | 수치 뒤 단위(작은 글). 값이 없으면 넘기지 않는다(DESIGN 핵심 규칙 6) |
  | `tone` | `danger` · `primary` | 수치 색 — `danger` = 차단 수(탐색 — 옛 인라인 위험색), `primary` = 강조 수치 `--primary`(탐색 "발견한 API 후보" — 옛 `.num` `js/menu/discovery.js:188`, `css/console.css:508`) |
  | `trend` | `{ direction: 'up' · 'down'; text: ReactNode }` | 보조 줄 앞 증감 — `arrow-up` · `arrow-down` 아이콘(`sm`) + 시각 숨김 ▲ · ▼ + 글자. `up`만 `--ok` 굵게(`.up` `css/console.css:537`), `down`은 색 없음 |
  | `description` | ReactNode | 보조 줄(`--text-muted`) — `trend` 뒤에 이어진다 |
  - 띠 — 1px `--line-control` · `--surface`, 칸 사이 1px `--line-divider`(줄이 바뀐 칸은 위 선 — 폭마다 열 수에 맞춘다). 그림자 없음
  - 함께 내보내는 것(`@/ui`) — 타입 `StatStripProps` · `StatItem`
- **상태** 없다(표시).
- **접근성** 증감 아이콘은 장식(`aria-hidden`)이고, 방향은 아이콘 곁의 시각 숨김 글자(`VisuallyHidden` — `up` "▲" · `down` "▼")가 읽힌다. 옛 `js/menu/dashboard.js:9-15`가 그린 글자와 같고 새 낱말은 없다. 보이는 모습은 아이콘 + `text` 그대로다(DESIGN Iconography 글리프 대신 아이콘).
- **폭**
  - 1500: `5` 칸 여백이 줄고 수치가 `--fs-figure-narrow`(`css/console.css:863-864`)
  - 1100: 3열(`css/console.css:872-874,1052-1054`)
  - 760: 2열(`css/console.css:890-893,1058-1061`)
- **카탈로그** `StatStrip`

### Table
- **쓰는 곳** 목록 표 — 호출 로그(`js/menu/logs.js:24-26`) · 원본 시스템(`js/menu/sources.js:32`) · 탐색 작업 · 결과(`js/menu/discovery.js:28,315`)(이음 `.twrap` · `.utbl` `css/console.css:196-212,599-606`).
- **쓰지 않는 곳** 테두리 작은 표(매핑 · 배포 도구 · 키 · 탐색 파라미터 — `.map` `css/console.css:676-690`) → `CompactTable`(두 표는 모양이 달라 합치지 않는다) · 빈 목록 → 본문에 `EmptyState container="table"` · 드로어 안 요약 → `KeyValueGrid`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `minWidth` | `TableMinWidth` — `820` · `960` · `980` · `1040` | 필수 | 표 최소 폭(px, 고유 치수) — 좁으면 표 상자 안에서 가로 스크롤(옛 인라인 `min-width` — 탐색 작업 820 · 호출 로그 960 · 원본 980 · 탐색 결과 1040) |
  | `density` | `TableDensity` — `fixed` · `auto` | `fixed` | `fixed` = 행 `--h-row`, `auto` = 내용 높이 + 위아래 여백(탐색 결과 `.dtbl` `css/console.css:1037`) |
  | `head` | ReactNode | 필수 | 머리 칸(`TableHeadCell`들) |
  | `children` | ReactNode | 필수 | 본문 행(`TableRow`들) 또는 빈 행 하나(`EmptyState container="table"`) |
  | `className` | string | 없음 | 배치(바깥 여백 — 옛 위 14는 쓰는 곳)만 |

  | 조각 | prop | 뜻 |
  |---|---|---|
  | `TableHeadCell` | `align`(`center` · `start`, 기본 `center`) · `kind`(`check`, 없음) · `children` | 머리 칸 `<th>`(`--h-th` · `--surface-sub` · 위 고정 `--z-sticky`). `kind="check"` = 선택 상자 칸 — 폭 48(고유 치수) · 가운데 · 머리 칸은 비어 있다(옛 `th.ck` `css/console.css:207`). `align`과 함께 쓰지 않는다(타입이 막는다) |
  | `TableRow` | `onActivate`(`() => void`, 없음) · `selected`(boolean, false) · `children` | 행. `onActivate`가 있으면 누를 수 있는 행 — 포인터 · 포커스(`tabindex="0"`) · Enter · Space(`js/main.js:58`). `selected`는 `--surface-selected` 바탕 |
  | `TableCell` | `align`(`center` · `start`, 기본 `center`) · `kind`(`check`, 없음) · `children` | 칸 `<td>` — 기본 가운데 정렬 · 한 줄(옛 `td.l`이 `start`). `kind="check"` = 선택 상자 칸 — 폭 48 · 가운데. 칸 안(여백 포함)을 눌러도 행 `onActivate`로 가지 않는다(옛 `data-act="noop"` `js/menu/discovery.js:280`, `js/main.js:49` — 칸 여백을 눌러도 근거가 열리지 않는다). 칸 안 상자의 모양은 쓰는 곳(`Checkbox`)이 준다 |
  - 상자 — 위 `--bw-strong` `--line-strong` · 아래 1px `--line-divider` · `--surface`, 가로 넘침은 상자 안 스크롤. 칸 사이 · 행 사이 1px `--line-divider`, 머리 아래 1px `--line-control`
  - 칸 글자(고정폭 도구 id · 흐린 시각 · 굵은 수치 등 — 옛 `.tn` · `.date` · `.num`)는 쓰는 곳이 토큰으로 준다
  - 함께 내보내는 것(`@/ui`) — `TableHeadCell` · `TableRow` · `TableCell` · 타입 `TableProps` · `TableMinWidth` · `TableDensity` · `TableRowProps` · `TableCellKind`
- **상태** 행 hover는 칸 바탕 `--surface-hover`(`css/console.css:205`), `selected`는 `aria-selected`가 아니라 `data-state="selected"`다(행은 목록 선택 위젯이 아니다). 빈 행은 누름 · hover 모양이 없다(`css/console.css:212`).
- **접근성** 누를 수 있는 행에 포커스가 오면 칸 바탕이 hover와 같고 안쪽 링을 더한다(옛은 링을 지웠다 — `css/console.css:605-606`, DESIGN 이식 기간 고침). Enter · Space는 행 자신에서 눌렀을 때만 `onActivate`를 부르고 기본 동작(스크롤)을 막는다 — 칸 안 버튼 · 링크에서 올라온 키는 그 요소 몫이다.
- **카탈로그** `Table`

### CompactTable
- **쓰는 곳** 테두리를 두른 작은 표 — 입력 · 응답 매핑(칸 안 입력 · 선택, 명세 변경 행 — `js/menu/studio.js:25-50`), 배포 포함된 도구 · 액세스 키(읽기 전용 — `js/menu/deploy.js:47-48,86-87`), 탐색 근거 파라미터 추론(읽기 전용 — `js/menu/discovery.js:350-352`)(이음 `.mapw` · `.map` `css/console.css:676-692`).
- **쓰지 않는 곳** 목록 표(굵은 윗선 · 고정 행 높이 · 누르는 행) → `Table` — 두 표는 모양이 달라 합치지 않는다 · 드로어 안 요약 칸 → `KeyValueGrid`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `minWidth` | `CompactTableMinWidth` — `420` · `560` · `640` | 필수 | 표 최소 폭(px, 고유 치수) — 좁으면 상자 안 가로 스크롤(배포 도구 420 · 키 · 탐색 파라미터 560 · 매핑 640) |
  | `head` | ReactNode | 필수 | 머리 칸(`CompactTableHeadCell`들) |
  | `children` | ReactNode | 필수 | 행(`CompactTableRow`들) |
  | `className` | string | 없음 | 배치만 |

  | 조각 | prop | 뜻 |
  |---|---|---|
  | `CompactTableHeadCell` | `children`(없으면 빈 머리 — 매핑 화살표 열) · `className` | 머리 칸 `<th>` — `--surface-sub` · 왼쪽 정렬 · 한 줄 · 작은 `--text-muted` · 아래 1px `--line-control` |
  | `CompactTableRow` | `tone`(`warn`, 없음) · `children` | 행. `warn`은 칸 바탕 `--warn-bg`(명세 변경 행 — DESIGN Colors ③) |
  | `CompactTableCell` | `colSpan` · `className` · `children` | 칸 `<td>` — 왼쪽 · 위 정렬. 칸 폭 · 좌우 여백 0(화살표 칸 28 · 설명 최소 130)은 `className` |
  - 상자 — 1px `--line-divider` · `--r-md` · `--surface`, 넘치면 상자 안 가로 스크롤. 행 사이 1px `--line-divider`(마지막 행 아래는 없음)
  - 칸 글자(고정폭 필드 · 타입 줄 · 흐린 설명 · 예시 값 · 키 — 옛 `.f` · `.ty` · `.dsc` · `.exv` · `.key`)는 쓰는 곳이 토큰으로 준다(`Table`과 같다). 칸 안 입력은 `Input variant="cell"` · `Select variant="cell"`, 칸 안 규칙은 `RuleChip`, 관찰 값 칩은 `Tag variant="value"`
  - 빈 표(키 0개 — `js/menu/deploy.js:48`)는 `CompactTableCell colSpan` 한 칸에 문장 그대로다 — 옛 `.map`에는 빈 행 모양이 없어 보통 칸으로 그렸다(`EmptyState container="table"`을 쓰지 않는다)
  - 함께 내보내는 것(`@/ui`) — `CompactTableHeadCell` · `CompactTableRow` · `CompactTableCell` · 타입 `CompactTableProps` · `CompactTableMinWidth` · `CompactTableHeadCellProps` · `CompactTableRowProps` · `CompactTableCellProps`
- **상태** 없다 — 행은 누르지 않고 hover 모양도 없다(옛 그대로).
- **접근성** `<table>`이다. 칸 안 입력 · 선택은 자기 `aria-label`을 가진다(옛 "AI 파라미터 이름" · "변환 규칙" 등).
- **카탈로그** `CompactTable`

### CodeBlock
- **쓰는 곳** 여러 줄 코드 · 요청 · 응답 · 로그 — 변환 과정 단계(`js/common/convert.js:159`) · 스튜디오 미리보기(`js/menu/studio.js:53-55`) · 배포 스니펫 · 서버 로그(`js/menu/deploy.js:81,167`) · 탐색 근거(`js/menu/discovery.js:321-346`)(이음 `pre.code` `css/console.css:724-726`).
- **쓰지 않는 곳** 문장 안 짧은 코드 → `InlineCode` · 코드 입력(편집) → 입력 부품(테스트 실행을 옮길 때 만든다).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `code` | `TraceCode`(`app/trace/types`) — `{ text; lang; bodyLang? }` | 필수 | 원문과 언어. `lang`은 `json` · `xml` · `http` · `java` · `plain`. `http`는 첫 빈 줄에서 머리와 본문을 나누고 본문을 `bodyLang`(`json` · `xml`)으로 강조한다. 객체는 쓰는 곳이 JSON 글(2칸 들여쓰기)로 바꿔 넘긴다 |
  | `labelledBy` · `label` | string | 둘 중 하나 필수 | 스크롤 상자의 이름 — 다른 요소의 id(변환 과정은 그 단계 제목 — 새 문구 없음) 또는 글자 |
  | `variant` | `CodeBlockVariant` — `code` · `log` | `code` | `log` = 서버 로그(강조 없음 · 긴 줄을 접음 · 최대 높이 화면 56% — 옛 인라인 `js/menu/deploy.js:167`) |
  | `className` | string | 없음 | 배치만 |

  | 언어 | 나누는 것 → 토큰 | 이음 근거 |
  |---|---|---|
  | `json` | 키(뒤에 `:`가 붙은 문자열) `--code-key` · 문자열 `--code-string` · 수 `--code-number` · `true` `false` `null` `--code-literal` | `hlJSON` `js/common/convert.js:137-141` |
  | `xml` | 주석 `--code-comment`(기울임) · 태그 `--code-tag` · 속성 이름 `--code-key` · 속성 값 `--code-string` | `hlXML` `:142-147` |
  | `http` | 첫 줄 메서드 · `HTTP/1.1` `--code-literal`(`--fw-mono-strong`) · 쿼리 키(`?k=` · `&k=`, 이어진 줄 포함) · 헤더 이름 `--code-key` · 본문은 `bodyLang` | `hlHTTP` `:148-158` |
  | `java` | 줄 주석(`//`부터 줄 끝) `--code-comment`(기울임) · 큰따옴표 문자열(같은 줄의 다음 `"`까지) `--code-string` · `@이름` `--code-key` · 예약어 10개(`public` `return` `new` `private` `void` `static` `final` `class` `if` `else`, 낱말 경계) `--code-tag`. 먼저 시작한 것이 이겨서 문자열 안 `//`는 문자열, 주석 안 예약어는 주석이다. 블록 주석 · 문자 리터럴은 나누지 않는다 | `hlJava` `js/menu/discovery.js:321-324` |
  | `plain` | 나누지 않는다 | — |
  - **토큰 분할 계약** — 같은 입력이면 옛 하이라이터와 같은 자리에서 나눈다(옛은 이스케이프한 글 위에서 정규식을 돌렸다 — 원문 위에서 같은 경계가 되게 옮긴다. 예: JSON 문자열은 첫 `"`에서 끝난다). 결과는 React 노드(`<span>`)이고 `dangerouslySetInnerHTML`을 쓰지 않는다
  - 상자 — `--surface-sub` · 1px `--line-divider` · `--font-mono` · 줄바꿈 없음(`log`는 접음) · 최대 높이 420 · 넘치면 상자 안 스크롤
  - 함께 내보내는 것(`@/ui`) — 타입 `CodeBlockProps` · `CodeBlockVariant`(언어 타입 `CodeLang` · `TraceCode`는 `app/trace/types`)
- **상태** 없다(표시).
- **접근성** 스크롤 상자는 `tabindex="0"` + 이름 + 안쪽 링이다(옛 `pre.code tabindex="0"` — `js/common/convert.js:159`, 이름은 보이지 않는 보강). 서버 로그 상자도 같다(옛은 `tabindex`가 없었다 — DESIGN 이식 기간 고침).
- **카탈로그** `CodeBlock`

### CompareGrid
- **쓰는 곳** 같은 일의 두 쪽을 나란히 — 미리보기 "응답 변환"(원본 응답 · AI에게 전달하는 결과 — `js/menu/studio.js:54`)(이음 `.cmp` `css/console.css:727,897`). 칸 머리의 색 네모 캡션 `CompareCaption`은 단독으로도 쓴다 — 탐색 근거 "캡처한 요청 · 응답"(`js/menu/discovery.js:345-346`)(이음 `.cap` `:728-729`).
- **쓰지 않는 곳** 화면 두 열 → `TwoColumn` · 변환 과정 단계 → `TraceView` · 차트 범례 → 그 화면 조각.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `children` | `[ReactNode, ReactNode]` | 필수 | 두 칸 — 칸마다 `CompareCaption` + `CodeBlock` |
  | `className` | string | 없음 | 배치만 |

  | `CompareCaption` prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `tone` | `CompareTone` — `source` · `tool` · `traffic` | 필수 | 색 네모 — `--source`(원본 응답) · `--tool`(AI에게 전달하는 결과) · `--evidence-traffic`(캡처한 요청 · 응답 — DESIGN Colors ④ · ⑤) |
  | `children` | ReactNode | 필수 | 캡션 글(`--text-muted` · `--fw-medium`) |
  | `description` | ReactNode | 없음 | 뒤에 붙는 흐린 보조 글(`--fw-regular` — "관찰 N건 중 1건") |
  | `id` | string | 없음 | 아래 `CodeBlock` `labelledBy` 대상 |
  | `className` | string | 없음 | 배치(둘째 캡션 위 12는 쓰는 곳)만 |
  - 두 칸은 같은 폭(최소 0)이다
  - 색 네모는 고유 치수 8 · `--r-xs` — 옛 인라인 `style="background:var(--…)"`이 `tone`이 된다
  - 캡션 글과 보조 글 사이에 공백 글자를 둔다 — 보이지 않고, 코드 상자 이름(`aria-labelledby`)에서 둘이 붙어 읽히지 않게 한다
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — `CompareCaption` · 타입 `CompareGridProps` · `CompareCaptionProps` · `CompareTone`
- **상태** 없다(표시).
- **접근성** 색 네모는 장식(`aria-hidden`)이고 뜻은 캡션 글이 전한다. 캡션 `id`를 코드 상자의 이름으로 쓴다(새 문구 없음).
- **폭**
  - 760: 한 열(`css/console.css:897`)
- **카탈로그** `CompareGrid`

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

## 이음 전용

연결 흐름 · 변환 과정처럼 이음에만 있는 모양 중 두 화면 이상(여러 화면이 여는 공용 층 포함)이 쓰거나 `@media` · 고유 치수(끄는 주석 px — DESIGN 핵심 규칙 1은 부품 CSS에만 허용)가 필요한 것, 그리고 이음 도메인 색 표지(읽기/쓰기 · 탐색 근거 · 메서드 — 도메인 색은 래퍼에서만)다 — 한 화면만 쓰고 둘 다 없는 조각(대시보드 시간대 차트 · 많이 쓰인 도구 · 확인 항목, 로그 상태 칩)은 그 화면 폴더에 둔다. 값 → 글자 · 색 찾기(상태 · 규칙 · 프로토콜)는 `copy/`와 앱 층이 하고, 이 부품들은 받은 글자와 색의 뜻만 그린다(원본 · 도구 · 작업 상태만 `copy/status`를 직접 읽는다). 앱 층이 `ui`를 조립한 층 내용(연결 마법사 · 인증 폼 · 재인증 · 원본 삭제 확인 — `app/sources/`)은 이 문서에 절을 두지 않는다 — 카탈로그가 앱 층을 가져오지 않게, 계약은 그 파일 머리 메모에 둔다.

### SourceStatus
- **쓰는 곳** 원본 시스템 상태 — 대시보드 구조도 원본 노드의 점(`js/menu/dashboard.js:19`) · 원본 목록의 칩(`js/menu/sources.js:32` 행)(이음 `SST` `js/common/state.js:26`).
- **쓰지 않는 곳** 상태 값 계산(오류 > 명세 변경 > 검토 > 정상) → 앱 층 `sourceStatusOf` · 다른 자원 상태 → `statusOf` + `StatusChip`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `status` | `SourceStatusValue` — `ok` · `review` · `drift` · `err` + 모르는 값 | 필수 | 원본 상태 값 — 라벨 · tone은 `statusOf('source', status)`(DESIGN Copy `상태 값`) |
  | `variant` | `SourceStatusVariant` — `dot` · `chip` | 필수 | `dot` = `StatusDot`(구조도), `chip` = `StatusChip`(원본 목록) |
  - 서버가 내지 않는 `busy`(분석 중)는 목록에 없다 — 오면 모르는 값 폴백(값 그대로 · `mute`)이다
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `SourceStatusProps` · `SourceStatusVariant`(값 타입 `SourceStatusValue`는 `copy/status`)
- **상태** 없다(표시).
- **접근성** `dot`은 시각 숨김 글자가 상태를 읽힌다(`StatusDot`). `chip`은 글자가 보인다.
- **카탈로그** `SourceStatus`

### ToolStatusChip
- **쓰는 곳** 도구 상태 칩 — 도구 상세 머리 · 도구 목록 항목(`sm` — `js/menu/studio.js:9,75`), 배포 포함된 도구 표 · 묶음 만들기 · 수정의 도구 목록(`js/menu/deploy.js:87,196`)(이음 `TST` `js/common/state.js:27`).
- **쓰지 않는 곳** 원본 상태 → `SourceStatus` · 탐색 작업 상태 → `JobStatusChip` · 다른 자원 상태 → `statusOf` + `StatusChip` · 읽기/쓰기 → `ModeTag`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `status` | `ToolStatusValue` — `done` · `review` · `drift` · `off` + 모르는 값 | 필수 | 도구 상태 값 — 라벨 · tone은 `statusOf('tool', status)`(DESIGN Copy `상태 값`) |
  | `size` | `StatusChipSize` — `md` · `sm` | `md` | `sm` = 목록 항목 안 축소 |
  - 모르는 값은 값 그대로 · `mute`다 — 옛은 렌더가 멈췄다(DESIGN 이식 기간 고침)
  - 이름 끝의 `Chip`은 같은 이름의 상태 값 타입(`api/types`의 `ToolStatus`)과 갈라 두려는 것이다
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `ToolStatusChipProps`(값 타입 `ToolStatusValue`는 `copy/status`)
- **상태** 없다(표시).
- **접근성** 글자가 보인다(점은 장식 — `StatusChip`).
- **카탈로그** `ToolStatusChip`

### JobStatusChip
- **쓰는 곳** 탐색 작업 상태 칩 — 원본 시스템 화면 아래 작업 표 상태 칸(`js/menu/discovery.js:19,23`) · 탐색 작업 화면 머리 제목 뒤(`js/menu/discovery.js:252,257`)(이음 `JOB_ST` `js/menu/discovery.js:5`).
- **쓰지 않는 곳** 원본 상태 → `SourceStatus` · 도구 상태 → `ToolStatusChip` · 다른 자원 상태 → `statusOf` + `StatusChip` · 탐색 단계 진행 → `StepIndicator` · 예약 시각 같은 칩 곁 글 → 쓰는 곳.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `status` | `JobStatusValue` — `scheduled` · `running` · `review` · `done` · `failed` · `cancelled` · `interrupted` + 모르는 값 | 필수 | 작업 상태 값 — 라벨 · tone은 `statusOf('job', status)`(DESIGN Copy `상태 값`) |
  | `size` | `StatusChipSize` — `md` · `sm` | `md` | `sm` = 목록 항목 안 축소 |
  - 서버가 내지 않는 `queued`는 목록에 없다 — 오면 모르는 값 폴백(값 그대로 · `mute`)이다
  - 이름 끝의 `Chip`은 같은 이름의 상태 값 타입(`api/types`의 `JobStatus`)과 갈라 두려는 것이다
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `JobStatusChipProps`(값 타입 `JobStatusValue`는 `copy/status`)
- **상태** 없다(표시).
- **접근성** 글자가 보인다(점은 장식 — `StatusChip`).
- **카탈로그** `JobStatusChip`

### ProtocolBadge
- **쓰는 곳** 원본 시스템의 연결 방식 배지 — 원본 목록 행(`js/menu/sources.js:11`) · 변환 스튜디오 원본 줄(`js/menu/studio.js:129`)(이음 `prBadge` `js/common/state.js:36`, `.pr` `css/console.css:518-522,1045`).
- **쓰지 않는 곳** 값 → 라벨 찾기 → `copy/protocol` `protocolLabel`(쓰는 곳) · 연결 방식 고르기 → `Select` · `RadioCard` · 상태 → `SourceStatus`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `kind` | `ProtocolKind` — `rest` · `soap` · `gov` · `sample` · `disc` · `unknown` | 필수 | 색 — 아래 표. 모르는 프로토콜 값은 쓰는 곳이 `unknown`으로 넘긴다 |
  | `label` | string | 필수 | 글자 — `protocolLabel(proto)`(모르는 값은 값 그대로 — DESIGN 이식 기간 고침) |

  | `kind` | 모양 | 이음 근거 |
  |---|---|---|
  | `rest` · `soap` · `gov` · `disc` | 바탕 `--proto-*-bg` · 글자 `--proto-*`(DESIGN Colors ⑤) | `.pr.rest` · `.soap` · `.gov` `:519-521` · `.pr.disc` `:1045` |
  | `sample` | `Tag tone="neutral" variant="dashed"`와 같은 모양 | `.pr.sample` `:522` |
  | `unknown` | `Tag tone="mute"`와 같은 모양 | — (옛은 "undefined" 글자) |
  - 모양은 `Tag` `lg` · `square`(높이 22 · `--r-sm`)와 같다 — 도메인 색이라 `Tag`의 `tone`에 넣지 않고 이 부품이 맡는다
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `ProtocolBadgeProps` · `ProtocolKind`
- **상태** 없다(표시).
- **접근성** 뜻은 글자가 전한다.
- **카탈로그** `ProtocolBadge`

### ModeTag
- **쓰는 곳** 도구의 읽기 · 쓰기 표지 — 도구 상세 머리 · 도구 목록 항목(`sm` — `js/menu/studio.js:10,75`), 배포 포함된 도구 표(`js/menu/deploy.js:87`), 탐색 결과 표(`js/menu/discovery.js:285`)(이음 `modeTag` `js/common/state.js:38`, `.md-tag` `css/console.css:523-525`).
- **쓰지 않는 곳** 값 → 글자 찾기 → 쓰는 곳의 `copy/` · 도구 상태 → `ToolStatusChip` · 메서드 표식(GET · POST) → `MethodChip`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `kind` | `ModeKind` — `read` · `write` | 필수 | 색 — `read` = 정보(`Tag tone="info"`), `write` = 주의(`Tag tone="warn"`). 쓰기가 아닌 값은 쓰는 곳이 `read`로 넘긴다(옛 `modeTag` — 쓰기가 아니면 읽기) |
  | `label` | string | 필수 | 글자 — "읽기" · "쓰기"(쓰는 곳의 `copy/`) |
  | `size` | `ModeTagSize` — `md` · `sm` | `md` | `md` = `Tag` `md`, `sm` = `Tag` `sm`(도구 목록 항목 안 — 옛 인라인 높이 16 · 글자 10.5px, DESIGN 이식 기간 허용 차이 값 정규화) |
  - 모양은 `Tag`(`square`)다 — 읽기/쓰기는 도메인 표지라 쓰는 곳이 `Tag`의 `tone`을 고르지 않고 이 부품이 맡는다(DESIGN Colors ③ 읽기/쓰기 표지)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `ModeTagProps` · `ModeKind` · `ModeTagSize`
- **상태** 없다(표시).
- **접근성** 뜻은 글자가 전한다.
- **카탈로그** `ModeTag`

### RuleChip
- **쓰는 곳** 변환 규칙 칩 — 변환 과정 단계의 규칙 줄(`js/common/convert.js:164,179,182`) · 탐색 파라미터 추론(이음 `.rl` `css/console.css:696-700`, `ruleChip()` `js/common/state.js:37`).
- **쓰지 않는 곳** 스튜디오 파이프라인 허브의 규칙 요약 칩(파란 허브 위 — `css/console.css:663-664`) → `Pipeline` · 상태 표지 → `StatusChip` · `Tag`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `label` | string | 필수 | 칩 글자(규칙 이름 — 규칙 표는 `copy/trace`) |
  | `category` | `RuleCategory`(`app/trace/types`) — `name` · `convert` · `inject` · `mask` | 필수 | 분류 색 — 옛 `nm` · `cv` · `ij` · `mk` |
  | `description` | string | 없음 | 설명 툴팁(`title`) — 있을 때만 툴팁과 도움말 커서(`cursor: help`). 고정 "이름 정리" 칩은 없다 |
  - 색 — `name` `--surface-sub` + `--text-muted` · `convert` `--primary-bg` + `--primary-ink` · `inject` `--rule-inject-bg` + `--rule-inject` · `mask` `--danger-bg` + `--danger`. 알약 · 고유 높이 20(태그 `md`와 같은 높이)
  - 모르는 규칙 키는 앱 층이 칩을 만들지 않는다(옛 조용히 건너뜀 — `js/common/state.js:37`)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `RuleChipProps`
- **상태** 없다(표시).
- **접근성** 이름은 글자다. 설명은 마우스 툴팁(`title`)이다(옛 그대로).
- **카탈로그** `RuleChip`

### FlowLine
- **쓰는 곳** 연결 흐름을 잇는 흐르는 점선 — 대시보드 구조도 열 사이(`js/menu/dashboard.js:23,26`) · 스튜디오 파이프라인 칸 사이(이음 `.tp-link i` · `.plink i` `css/console.css:557,561,883-884,894-896`).
- **쓰지 않는 곳** 변환 과정 단계 사이 세로선 → `TraceView` · 단계 표시 사이 선 → `StepIndicator`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `verticalAt` | `FlowLineBreakpoint` — `1100` · `760` | 필수 | 이 폭 이하에서 세로 점선 — 구조도 1100 · 파이프라인 760 |
  - 부모 칸이 위치 기준(`position: relative`)이고 선은 그 가운데를 가로(세로)지른다 — 연결 칸의 높이 · 라벨은 쓰는 부품(`Topology` · 파이프라인)이 정한다
  - 모양 — `--primary` 점선(한 마디 고유 치수) · `--opacity-flow` · 흐름 `--m-flow` 한 번씩 반복(DESIGN 이식 기간 유지 — 반복 모션)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `FlowLineProps` · `FlowLineBreakpoint`
- **상태** 없다(장식). 모션 줄이기면 멈춘 점선이다(`css/console.css:859`).
- **접근성** 장식(`aria-hidden`)이다 — 흐름의 뜻은 곁의 라벨 글자가 전한다.
- **폭**
  - 1100: `verticalAt` 1100이면 세로
  - 760: `verticalAt` 760이면 세로
- **카탈로그** `FlowLine`

### Topology
- **쓰는 곳** 대시보드 연결 구조도 — AI 열 · 연결 · 이음 허브 · 연결 · 원본 열(이음 `js/menu/dashboard.js:17-28`, `.topo` · `.tp-*` `css/console.css:541-565,880-882`). 상자 머리("연결 구조")는 쓰는 곳의 `Box`다.
- **쓰지 않는 곳** 스튜디오 파이프라인(원본 칸 · 허브 칸 · AI 도구 칸) → `Pipeline`(`FlowLine`을 함께 쓴다).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `labels` | `TopologyLabels` — `{ aiHeading; aiCallsHeading; aiCallsTitle; aiLink; hubTitle; sourceLink; sourceHeading }` | 필수 | 고정 글자(`copy/`) — "AI 모델, 에이전트" · "24시간 호출" · 수 툴팁 "최근 24시간 호출" · "MCP, 함수 호출" · "이음 게이트웨이" · "SOAP, REST, XML" · "원본 시스템"(`js/menu/dashboard.js:18-27`) |
  | `ai` | `readonly TopologyAiNode[]` — `{ id: string; label: string; via: string; calls: string \| null }` | 필수 | AI 노드(누를 수 없다) — 이름 · 연결 방식 · 24시간 호출 수(서식된 글자, 요약 조회만 실패하면 옛처럼 0. `null`이면 받는 중 — 칸을 비우고 `aria-busy`, 첫 로딩 규칙) |
  | `aiSlot` | ReactNode | 없음 | 있으면 AI 노드 대신 그 자리에 그린다 — 모델 조회 실패의 `ErrorBlock`(열 머리는 남는다) |
  | `hubItems` | `readonly ReactNode[]` | 필수 | 허브 목록 줄 — 굵은 수는 `<b>`("공개 도구 N개" · "AI 호출 형식 4종 변환" · "사용자 확인, 마스킹, 호출 한도") |
  | `sources` | `readonly TopologySourceNode[]` — `{ id: string; name: string; detail: string; icon: IconName; status: ReactNode }` | 필수 | 원본 노드(버튼) — 이름 · 보조 줄("{프로토콜}, 도구 N개" — `copy/`가 만든다) · 아이콘(`globe` · `server`) · 오른쪽 상태 점(`SourceStatus variant="dot"`) |
  | `onSourceClick` | `(id: string) => void` | 필수 | 원본 노드를 누름 — 재인증 층 · 스튜디오 이동 판단은 쓰는 곳 |
  - 열 — AI · 원본 노드는 1px `--line-control` 카드 · 아이콘 칸(`--ai-bg` + `--ai` · `--source-bg` + `--source`, 아이콘 `md`). 이름은 한 줄 말줄임, 보조 줄은 흐린 작은 글. AI 노드 오른쪽 수는 `tabular-nums` + `title`
  - 연결 — 칸 가운데 `FlowLine verticalAt={1100}` + 선 위 라벨(흐린 아주 작은 글, 낱말 단위 줄바꿈)
  - 허브 — `--primary` 필 · `--on-fill` · `--r-xl` · `--shadow-brand`. 머리 `Logo size={24}` + `labels.hubTitle`, 목록 위 1px `--on-fill-line`, 목록 글자 `--on-fill-soft`(굵은 글 `--on-fill`)
  - 열 폭은 고유 치수(옛 격자 `css/console.css:541`)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `TopologyProps` · `TopologyLabels` · `TopologyAiNode` · `TopologySourceNode`
- **상태** 원본 노드 hover는 테두리 `--primary-line` · 바탕 `--surface-hover`다(`css/console.css:545`). AI 노드는 hover 모양이 없고 커서도 그대로다(`css/console.css:550-551`).
- **접근성** 원본 노드는 `<button type="button">`이다(옛 그대로 — Enter · Space). 이름은 노드 글자 전체(이름 · 보조 줄 · 상태 점의 시각 숨김 글자)다. AI 노드 · 허브 · 연결 라벨은 글자일 뿐 포커스를 받지 않는다. 아이콘 · 로고 · 흐름선은 장식이다.
- **폭**
  - 1100: 한 열 세로 — 열 · 연결 · 허브가 위에서 아래로, 연결 칸은 고유 높이(44) · 라벨은 선 오른쪽 · 흐름선 세로(`css/console.css:880-884`)
- **카탈로그** `Topology`

### Pipeline
- **쓰는 곳** 도구 상세의 변환 흐름 띠 — 원본 작업 칸 · 이음 허브 칸 · AI 도구 칸(이음 `js/menu/studio.js:85-91`, `.pipe` · `.pp` · `.plink` `css/console.css:653-665,894-896`).
- **쓰지 않는 곳** 대시보드 연결 구조도 → `Topology` · 변환 과정 단계 → `TraceView` · 변환 규칙 칩(분류 색 · 설명 툴팁) → `RuleChip` — 허브 요약 칩은 분류 색 · 툴팁이 없는 다른 칩이다.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `label` | string | 필수 | 띠 이름("변환 흐름" — 옛 `aria-label`) |
  | `source` | `PipelineNode` | 필수 | 원본 칸 — 아래 표 |
  | `hubTitle` | ReactNode | 필수 | 허브 제목("이음 변압기" — 로고 뒤) |
  | `hubChips` | `readonly ReactNode[]` | 필수 | 허브 요약 칩 — 글자는 쓰는 곳이 만든다("이름 정리 2". 모르는 규칙 키는 값 그대로 + 개수). 0개면 칩 줄을 그리지 않는다 |
  | `tool` | `PipelineNode` | 필수 | AI 도구 칸 |
  | `className` | string | 없음 | 배치(위 바깥 여백 18은 쓰는 곳)만 |

  | `PipelineNode` 필드 | 타입 | 뜻 |
  |---|---|---|
  | `overline` | ReactNode | 칸 위 작은 라벨 — 칸 색 글자("원본 작업" `--source` · "AI 도구" `--tool`) |
  | `title` | string | 고정폭 굵은 이름 — 한 줄 말줄임(작업 `METHOD path` · 도구 id) |
  | `lines` | `readonly ReactNode[]` | 아래 작은 줄들(`--text-muted`) |
  - 칸 — 원본 `--source-bg` · AI 도구 `--tool-bg`(DESIGN Colors ④), 허브 `--primary` 필 · `--on-fill-soft` 글자 · `--shadow-brand-sm`, 허브 머리 `Logo size={20}` + 제목 `--on-fill`. 칸 모서리 `--r-lg`
  - 허브 요약 칩 — 알약 · `--on-fill-subtle` 바탕 · `--on-fill` 글자 · 고유 높이 20, 넘치면 줄을 바꾼다
  - 칸 사이 — 고유 폭 44 연결 칸 가운데 `FlowLine verticalAt={760}`
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `PipelineProps` · `PipelineNode`
- **상태** 없다(표시). 흐름선은 모션 줄이기면 멈춘다(`FlowLine`).
- **접근성** 띠는 `label`을 이름으로 가진 묶음(`role="group"`)이다 — 옛 `aria-label`은 역할 없는 칸에 붙어 읽히지 않았다(DESIGN 이식 기간 고침 — 보이는 차이 0). 로고 · 흐름선은 장식이다.
- **폭**
  - 760: 한 열 세로 — 칸 · 연결이 위에서 아래로, 연결 칸은 고유 높이 26 · 흐름선 세로(`css/console.css:894-896`)
- **카탈로그** `Pipeline`

### TraceView
- **쓰는 곳** 변환 과정 보기 — 호출 로그 상세 드로어(`js/menu/logs.js:46`) · 테스트 실행 결과 상자(`js/menu/playground.js:79`)(이음 `traceHTML` `js/common/convert.js:186-196`, `.trace` · `.step` `css/console.css:753-762,778-779,810`). 단계 데이터는 앱 층 `buildTraceSteps`(`app/trace`)가 만들고 이 부품은 그리기만 한다.
- **쓰지 않는 곳** 변환 과정이 없을 때 → 쓰는 곳의 `EmptyState`(로그 상세 `panel` "이 호출은 변환 과정을 남기지 못했습니다." · 테스트 실행 실행 전 `area`) · 미리보기 코드 하나 → `CodeBlock`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `steps` | `readonly TraceStep[]`(`app/trace/types`) | 필수 | 단계 — 위에서 아래로. 글자(제목 · 보조 글 · 소요 칩)는 모두 데이터에 있다 |
  | `container` | `TraceContainer` — `drawer` · `box` | 필수 | 그릇 — `drawer` = 바깥 여백 없음(`.drawer .trace` `css/console.css:810`), `box` = 상자 안 여백(`.trace` `css/console.css:753`) |
  | `holdSlot` | ReactNode | 없음 | `hold` 단계 본문(테스트 실행의 사용자 확인 상자) |

  | `kind` | 번호 원 색 | 본문(위에서 아래로) | 이음 근거 |
  |---|---|---|---|
  | `ai` | `--ai` | `CodeBlock`(`code`) → 모델 안내(`note` — `--ai-bg` 상자 · `info` 아이콘 `md-minus` `--ai`) | `js/common/convert.js:169-170` · `css/console.css:778-779` |
  | `ieum` | `--primary` | 규칙 칩 줄(`chips` → `RuleChip`) → `CodeBlock`(`code`) | `:178-179,181-182` |
  | `src` | `--source` | `CodeBlock`(`code`) | `:180` |
  | `fail` | `--primary` | `Notice tone="warn" icon="alert"`(`error` — 빈 글일 수 있다, 바깥 여백 없음) | `:183` |
  | `hold` | `--warn` | `holdSlot` | `:173-175` |
  - 머리 — 모든 단계가 `title`(굵게) · `who`(흐린 작은 글 — 실패 단계는 "오류") · `msLabel`(오른쪽 알약 소요 칩, null이면 없음)만 그린다. `ms` 수는 그리지 않는다
  - 번호 — `hold`가 아닌 단계만 1부터 센다. `hold`는 번호 대신 `user` 아이콘(`sm` · `bold`). 원 글자 `--on-fill`, 원 지름은 고유 치수(28)
  - 연결선 — 단계 사이 세로 2px `--line-divider`(마지막 단계 뒤는 없음). 위치는 고유 오프셋(`css/console.css:755`)
  - 코드 상자의 이름은 그 단계 제목이다(`CodeBlock labelledBy` — 새 문구 없음)
  - 입장 모션은 없다(옛 두 곳 모두 끈 채로 불렀다 — `js/menu/logs.js:46` · `js/menu/playground.js:79`)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `TraceViewProps` · `TraceContainer`(단계 타입 `TraceStep` · `TraceChip` · `TraceCode`는 `app/trace/types`)
- **상태** 없다(그릇). `holdSlot` 안 버튼이 상태를 낸다.
- **접근성** 단계 목록은 `<ol>`이고 번호 원은 보이는 글자다(목록 순서와 같다). `hold` 아이콘은 장식이다. 코드 상자는 단계 제목으로 이름이 붙은 스크롤 상자다.
- **카탈로그** `TraceView`

### LaterCards
- **쓰는 곳** 원본 시스템 화면 아래 2차 연결 방식 카드 — DB 직접 조회 · GraphQL · gRPC(`js/menu/sources.js:22,39`)(이음 `.later` · `.srow.avail` · `.si` `css/console.css:378-382,609-611,879`). 위 절 제목은 쓰는 곳의 `SectionTitle`이다.
- **쓰지 않는 곳** 고를 수 있는 연결 방식 → `RadioCard` · 빈 자리 안내 → `EmptyState`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `items` | `readonly LaterCardItem[]` — `{ icon: IconName; title: ReactNode; description: ReactNode }` | 필수 | 카드 — 순서대로 |
  | `badge` | ReactNode | 필수 | 카드마다 오른쪽 표지 글자("2차" — `Tag tone="neutral"`) |
  | `className` | string | 없음 | 배치만 |
  - 격자는 `CardGrid columns={3} collapseAt={1100}`. 카드 — 1px 점선 `--line-divider` · `--surface-sub`, 왼쪽 아이콘 칸(고유 치수 34 · `--surface` · 1px `--line-divider` · 아이콘 `lg` `--text-faint`) · 제목 + 흐린 설명 · 오른쪽 표지
  - 문구는 쓰는 곳의 `copy/`다(DESIGN 이식 기간 보존 — 2차 범위 안내)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `LaterCardsProps` · `LaterCardItem`
- **상태** 없다(표시) — 카드는 누를 수 없다(옛 `div`).
- **접근성** 아이콘은 장식이고 뜻은 글자가 전한다.
- **폭**
  - 1100: 한 열(`CardGrid`)
- **카탈로그** `LaterCards`

### MethodChip
- **쓰는 곳** HTTP 메서드 표식 — 탐색 네트워크 기록 줄 · Git 파일 줄(`NetLog` · `GitFileList` 안) · 탐색 결과 표 API 칸(`js/menu/discovery.js:199,206,281`)(이음 `.mth` `css/console.css:994-996`).
- **쓰지 않는 곳** 읽기 · 쓰기 표지 → `ModeTag` · 자원 상태 → `StatusChip` · 무채색 표지 → `Tag`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `method` | string | 필수 | 글자 — 받은 값 그대로. Git 파일 줄에서 메서드가 없으면 쓰는 곳이 "*"를 준다(`js/menu/discovery.js:206`) |
  - 색 — `GET`이면 `--ok-bg` + `--ok`, 그 밖은 `--warn-bg` + `--warn`(DESIGN Colors ③ 메서드 표식). 견주는 것은 글자 그대로다(옛 `x.m === 'GET'` — 소문자 `get`은 경고색)
  - 모양 — 고정폭 아주 작은 굵은 글자 · 각진 모서리 · 가운데 정렬 · 고유 행간 18. 칸 안(격자 · flex 항목)에 놓이면 칸 폭을 채운다. 옛 10.5px 글자 · 좌우 5는 이웃 단계다(DESIGN 이식 기간 허용 차이 — 값 정규화)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `MethodChipProps`
- **상태** 없다(표시).
- **접근성** 뜻은 글자가 전한다 — 색은 `GET`과 그 밖을 나눌 뿐이다.
- **카탈로그** `MethodChip`

### EvidenceBadge
- **쓰는 곳** 탐색 근거 표지 "소스" · "트래픽" — 탐색 결과 표 근거 칸(`js/menu/discovery.js:282`)(이음 `.evb` `css/console.css:1041-1044`).
- **쓰지 않는 곳** 근거 요약 문장(근거 드로어 "소스와 트래픽 모두") → 그 자리의 글 · 무채색 표지 → `Tag`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `kind` | `EvidenceKind` — `code` · `traffic` | 필수 | 근거 — 색 `--evidence-code-bg` + `--evidence-code`(Git 소스) · `--evidence-traffic-bg` + `--evidence-traffic`(운영 트래픽)(DESIGN Colors ⑤) |
  | `on` | boolean | 필수 | 이 근거가 있음. `false`면 "없음" 표지 — `Tag tone="mute" variant="off" size="md"`(점선 · 취소선)이고 이때 `kind`의 색은 쓰지 않는다 |
  | `children` | ReactNode | 필수 | 글자(쓰는 곳 `copy/` — 옛 "소스" · "트래픽") |
  - 모양 — `Tag` `md` · `square`와 같다(높이 20) — 도메인 색이라 `Tag`의 `tone`에 넣지 않고 이 부품이 맡는다. 양옆 `--s-0-5`(옛 `margin:0 2px` — 꺼진 표지도 같다)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `EvidenceBadgeProps` · `EvidenceKind`
- **상태** 없다(표시).
- **접근성** 뜻은 글자가 전한다. 꺼진 표지는 점선 · 취소선이 보이고 글자는 그대로 읽힌다(옛 그대로 — 같은 근거가 근거 드로어 문장과 필터 칩으로도 닿는다).
- **카탈로그** `EvidenceBadge`

### NetLog
- **쓰는 곳** 탐색 네트워크 기록 — 실시간 화면 "네트워크 기록" 상자 · 종료 화면(`js/menu/discovery.js:192-200,236,245,269`)(이음 `.netlog` · `.nl` · `.ntag` `css/console.css:984-1000`, 760 `css/console.css:1067-1068`). 상자 머리는 쓰는 곳의 `Box`다.
- **쓰지 않는 곳** 서버 로그 글 → `CodeBlock variant="log"` · 목록 표 → `Table` · 변환 과정 → `TraceView`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `lines` | `readonly NetLogLine[]` | 필수 | 줄 — 위에서 아래로. 최근 250개로 자르는 것은 쓰는 곳이다(`js/menu/discovery.js:194`) |
  | `label` | string | 필수 | 스크롤 상자 이름(`aria-label` — 상자 제목과 같은 글자, 새 문구 없음) |
  | `follow` | boolean | 필수 | 아래 따라가기 — `true`가 되는 순간(처음 그림 포함) 맨 아래로 내리고, 그 뒤로는 줄이 바뀌기 직전 맨 아래에서 24 안쪽이었을 때만 다시 맨 아래로 간다(옛 `js/main.js:13` · `js/menu/discovery.js:245`). 쓰는 곳은 탐색 중일 때 `true` |
  | `empty` | ReactNode | 필수 | 줄이 없을 때 상자 안 글 — 부품이 `EmptyState kind="section" container="inline"`으로 그린다(옛 "아직 기록된 요청이 없습니다.") |

  | `NetLogLine` | 필드 | 뜻 |
  |---|---|---|
  | 요청 줄 | `kind: 'request'` · `key` · `time` · `method` · `path` · `env?` · `code` · `tag` | 시각(`m:ss` — 쓰는 곳 서식) · 메서드(`MethodChip` — 칸 폭을 채운다) · 경로(고정폭 · 말줄임 · `title`에 전체) · `env`는 경로 앞 표식 글자(스테이징 호출 — `--netlog-flag-bg` + `--netlog-flag` 네모 표지) · 응답 코드(`string \| number` — 값이 없으면 쓰는 곳이 값 없음 표기를 넘긴다) · `tag` — `{ label: string; tone: NetTagTone }` |
  | 건너뜀 줄 | `kind: 'skip'` · `key` · `time` · `note` | 시각 · `alert` 아이콘(`sm` · `--warn`) + 서버 문장 |
  - `NetTagTone`(원본은 `copy/status`) — `StatusTone`(`ok` · `warn` · `danger` · `info` · `mute`)에 `flag`(네트워크 기록 표식 — "허용 (로그인)")를 더한 것. 상태 tone은 `Tag shape="round" size="sm"`이고, `flag`는 같은 모양에 `--netlog-flag-bg` + `--netlog-flag`다(도메인 색은 이 부품에서만). 값 → 라벨 · tone은 `copy/status`의 `netTagOf`(DESIGN Copy 상태 값)
  - 상자 — 칸의 남은 높이를 채우고(`TwoColumn layout="live"` 안 `Box` 바로 아래) 높이는 고유 치수 300 ~ 392, 넘치면 상자 안 스크롤. 줄 — 격자(시각 40 · 메서드 42 · 경로 · 코드 34 · 태그 — 고유 치수) · 아래 1px `--line-divider`. 메서드 칸 42에서 `DELETE`가 넘치는 것은 옛 그대로다
  - 마지막 줄은 나타날 때 한 번 `--m-enter`로 아래에서 떠오르고 바탕이 `--surface-hover`다(옛 `.nl.enter` `css/console.css:986`). 줄 `key`가 같으면 다시 돌지 않는다 — 옛은 갱신마다 다시 돌았다(DESIGN 이식 기간 허용 차이 — 렌더)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `NetLogProps` · `NetLogLine`(`NetTagTone`은 `copy/status`)
- **상태** 없다(표시) — 줄이 데이터다.
- **접근성** 스크롤 상자는 `role="region"` + `tabindex="0"` + `label` + 안쪽 링이다(옛은 `tabindex`가 없었다 — DESIGN 이식 기간 고침). 줄이 늘어도 읽어 주지 않는다(`aria-live` 없음 — 옛 그대로). 경로 전체는 `title` 툴팁이다(옛 그대로). 아이콘은 장식이다.
- **폭**
  - 760: 코드 칸을 숨기고 시각 · 메서드 칸이 줄며 줄 좌우 여백이 줄어든다(`css/console.css:1067-1068`)
- **카탈로그** `NetLog`

### GitFileList
- **쓰는 곳** 탐색 Git 소스 분석 — 끝난 단계 목록 + 파일 줄(`js/menu/discovery.js:202-208`)(이음 `.gst` · `.gfiles` · `.gf` `css/console.css:1002-1017`, 1100 `css/console.css:1055`). 상자 머리는 쓰는 곳의 `Box padded`다.
- **쓰지 않는 곳** 소스 조각 보기 → `CodeBlock` · 위에서 아래로 진행하는 작업 줄 → `ProgressList` · Git 분석을 하지 않은 작업 → 쓰는 곳의 `EmptyState container="inline"`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `stages` | `readonly GitStageItem[]` — `{ key: string; title: ReactNode; detail?: ReactNode }` | 필수 | 끝난 단계 — 완료 원(고유 지름 20 · `--primary` 필 · `check` `sm` · `heavy` · `--on-fill`) + 굵은 서버 문장 + 흐린 보조 |
  | `pending` | ReactNode | 필수 | 단계가 아직 없을 때 흐린 한 줄(옛 "저장소를 읽는 중") |
  | `files` | `readonly GitFileItem[]` | 필수 | 파일 줄 — 없으면 목록 상자를 그리지 않는다(옛 `.gfiles:empty`) |
  | `enterLast` | boolean | false | 마지막 파일 줄 등장 모션 — 쓰는 곳은 탐색 중일 때 `true`(`js/menu/discovery.js:205`) |

  | `GitFileItem` 필드 | 타입 | 뜻 |
  |---|---|---|
  | `key` | string | 줄 키 |
  | `name` | ReactNode | 파일 칸 글자(옛 "…/{파일}" — 쓰는 곳이 만든다) — 앞 `code` 아이콘(`sm` · `--evidence-code`) · 고정폭 · 말줄임 |
  | `title` | string | 파일 칸 툴팁(전체 경로) |
  | `apis` | `readonly { method: string; path: string; deprecated?: boolean }[]` | API — `MethodChip` + 고정폭 경로, `deprecated`면 뒤에 위험색 작은 "@Deprecated"(애너테이션 이름이라 부품이 쓴다) |
  | `note` | ReactNode | 없으면 그리지 않는 오른쪽 흐린 메모(서버 문장) |
  - 목록 — 1px `--line-divider` 상자 · 줄 사이 1px `--line-divider`. 줄 격자는 파일 칸 230(고유 치수) · API · 메모
  - 등장 모션 — `--m-enter` 한 번 + 바탕 `--surface-hover`(`NetLog`와 같다). 줄 `key`가 같으면 다시 돌지 않는다
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `GitFileListProps` · `GitStageItem` · `GitFileItem`
- **상태** 없다(표시).
- **접근성** 단계 · 파일은 글자로 읽힌다 — 완료 원 · 아이콘은 장식이다. 파일 전체 경로는 `title` 툴팁이다(옛 그대로).
- **폭**
  - 1100: 파일 줄이 한 열 — 파일 · API · 메모가 위에서 아래로(`css/console.css:1055`)
- **카탈로그** `GitFileList`

### BrowserView
- **쓰는 곳** 헤드리스 브라우저가 지금 보는 운영 화면 — 탐색 실시간 화면 "운영 화면 탐색" 상자(`js/menu/discovery.js:209-226`)(이음 `.bw` · `.sh-*` `css/console.css:964-980`). 상자 머리는 쓰는 곳의 `Box`다.
- **쓰지 않는 곳** 화면 탐색을 하지 않은 작업 → 쓰는 곳의 `EmptyState container="inline"` · 빈 자리 큰 안내 → `EmptyState container="area"`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `url` | ReactNode | 필수 | 주소 줄 글자(쓰는 곳이 만든다 — 옛 운영 주소 + 지금 페이지 `js/menu/discovery.js:209`) |
  | `src` | string \| null | 필수 | 캡처 이미지 주소 — `null`이면 자리 문구 |
  | `alt` | string | 필수 | 이미지 대체 글(옛 "헤드리스 브라우저가 보고 있는 운영 화면") |
  | `placeholder` | ReactNode | 필수 | 캡처가 없을 때 가운데 글(탐색 중 · 예약 · 없음 — 쓰는 곳이 `copy/`로 고른다) |
  | `highlight` | `BrowserHighlight \| null` — `{ kind: 'act' \| 'skip'; label: string; x: number; y: number; w: number; h: number }` | 없음 | 강조 상자 — 캡처가 있을 때만 그린다. 위치 · 크기는 캡처 크기에 대한 백분율(0~100). `act` 실선 `--capture-hl`, `skip` 점선 `--capture-hl-block`, 오른쪽 위 라벨(옛 "클릭" · "건너뜀"). 서버가 내는 종류는 이 둘뿐이다(옛 차단 상자 `.sh-hl.block`은 옮기지 않았다) |
  | `onImageError` | `() => void` | 없음 | 이미지를 불러오지 못하면 부른다 — 쓰는 곳이 `src`를 비우고 자리 문구를 고른다 |
  - 틀 — 바깥 `--s-3-5` · 1px `--line-control` · `--r-lg`. 주소 줄 — `lock` 아이콘(`sm`) + 고정폭 주소(말줄임) · `--surface-sub` · 아래 1px `--line-divider`
  - 캡처 영역 — 늘 밝은 화면(`--capture-bg` · 자리 문구 `--capture-text` · `globe` 아이콘 `hero` · `--capture-icon`) · 고유 최소 높이 300. 이미지는 폭 100% · 높이 자동이고, `src`가 바뀌면 같은 `<img>`의 주소만 바꾼다(옛 깜빡임 없는 교체 — `js/menu/discovery.js:219`)
  - 강조 상자 — 좌표 기준은 이미지(이미지를 감싼 틀)다 — 옛은 최소 높이 300인 캡처 영역이 기준이라 이미지가 300보다 낮은 좁은 폭에서 상자가 대상 아래로 내려갔다(`css/console.css:966,973` — DESIGN 이식 기간 고침). 좌표는 CSS 사용자 속성으로 넘긴다(DESIGN Layout `TSX style`) · 쌓임 `--z-raise` · 이동은 `--m-fade` · 둘레 맥박 `--m-pulse` 한 번씩 반복(DESIGN 이식 기간 유지 — 반복 모션). 라벨은 `--on-fill` 굵은 아주 작은 글자다(옛 10.5px — 값 정규화)
  - 틀 높이는 내용 높이다 — 칸 높이를 채우지 않는다. 옛 `.bw`의 늘이기는 감싼 칸이 늘이기 영역이 아니어서 효과가 없었다(`js/menu/discovery.js:235`)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `BrowserViewProps` · `BrowserHighlight`
- **상태** 없다(표시). 모션 줄이기면 맥박 · 이동 모션이 없다.
- **접근성** 이미지는 `alt`로 읽힌다. 강조 상자와 라벨은 장식(`aria-hidden`)이다 — 클릭 · 건너뜀은 네트워크 기록 줄이 글자로 전한다. 자물쇠 · 지구 아이콘은 장식이다.
- **카탈로그** `BrowserView`

### DiscoveryZone
- **쓰는 곳** 탐색 마법사 "탐색 대상"의 입력 묶음 — 고정 묶음(운영 접속 정보 `js/menu/discovery.js:44-49`) · 켜고 끄는 묶음(Git 소스 분석 · 운영 화면 탐색 `js/menu/discovery.js:50-66`)(이음 `.dz` · `.dz-h` `css/console.css:915-922`, 760 `css/console.css:1065`). 탐색 마법사는 여러 화면이 여는 공용 층이다.
- **쓰지 않는 곳** 제목 줄이 있는 화면 상자 → `Box` · 설정 한 줄(제목 + 설명 + 오른쪽 컨트롤) → `SettingRow` · 칸 하나 → `Field`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `title` | string | 필수 | 굵은 제목(옛 14.5px는 `--fs-subhead` — 값 정규화). 스위치가 있으면 스위치 이름(`aria-label`)도 이 글자다 |
  | `description` | ReactNode | 없음 | 제목 아래 흐린 설명 |
  | `toggle` | `DiscoveryZoneToggle` | 없음 | 있으면 머리 줄 전체가 `<label>`이고 제목 앞에 스위치(`Switch variant="heading"`)가 놓인다. 필드 — `checked` · `onCheckedChange` · `disabled`(못 바꿈) · 사유 하나: `disabledReason`(시각 숨김 글자 + 마우스 툴팁) 또는 `describedBy`(화면에 보이는 안내의 id — 옛 "브라우저 없음" 안내 `js/menu/discovery.js:60`). 사유 둘을 함께 쓰지 않는다. `disabledReason`은 `disabled`일 때만 내고, `describedBy`는 받은 대로 늘 잇는다(`Switch`의 `aria-describedby`와 같다) — 안내를 그릴 때만 넘긴다 |
  | `children` | ReactNode | 없음 | 묶음 칸(`Field` · `FieldNote` · `FieldPair`) · 안내(`HelpText variant="note"`). 꺼졌을 때 무엇을 남길지는 쓰는 곳이 고른다(옛은 칸을 빼고 브라우저 없음 안내만 남겼다 `js/menu/discovery.js:60`) |
  | `className` | string | 없음 | 배치(바깥 여백)만 |
  - 상자 — 1px `--line-control` · `--r-md` · `--surface` · 위 `--s-3`(묶음 사이). 머리 아래 `--s-3`. 꺼지면(`toggle.checked`가 false) `--surface-sub` 바탕이고 머리 아래 여백이 없어지며 아래 안쪽이 커진다(`css/console.css:916,918`)
  - 스위치 모양 · 설명 들여쓰기(스위치 폭 + 간격) · 760 이하 들여쓰기 해제는 `Switch variant="heading"`이 맡는다. 스위치 없는 고정 묶음 머리는 설명을 들이지 않는다(`css/console.css:920`)
  - 꺼지거나 잠겨도 흐리게 하지 않는다 — 옛 `.dz.off`는 바탕만 바뀌고, 잠긴 스위치도 그대로 진하다
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `DiscoveryZoneProps` · `DiscoveryZoneToggle`
- **상태** `data-state`(`on` · `off` — `toggle`이 없으면 `on`).
- **접근성** 머리 줄 `<label>`을 누르면 스위치가 바뀐다(옛 그대로). 스위치 이름은 `title`이고, 잠긴 사유가 화면에 보이는 안내로 있으면 그 id를 `describedBy`로 잇는다(보이는 차이 0 — 비활성 사유 보강).
- **폭**
  - 760: 이 부품 자체의 모양은 그대로다. 설명 들여쓰기 해제는 `Switch`가, 칸 접힘은 `Field` · `FieldPair`가 맡는다
- **카탈로그** `DiscoveryZone`
