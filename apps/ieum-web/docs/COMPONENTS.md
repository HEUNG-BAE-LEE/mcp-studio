# COMPONENTS — 이음 웹 콘솔

부품 계약 — 쓰는 곳 · 쓰지 않는 곳 · prop · 크기 · 상태 · 접근성. 규칙(언제 무엇을 쓰는지)은 `DESIGN.md`, 값의 원본은 `src/styles/tokens.css`. 모양 · 동작은 이음 원본 콘솔이 기준이다.
구현은 **React + CSS Modules**(`src/ui`, 새 의존성 없음). 토큰은 CSS 변수 이름(`--primary`)으로만 부른다. 안쪽 여백 · 글자 크기 같은 내부 치수의 원본은 각 `*.module.css`다.

## 공통 계약

- **절 형식** — 부품 절은 아래 bullet을 이 순서로 쓴다. 해당 없는 bullet은 두지 않는다
  - `쓰는 곳` → `쓰지 않는 곳` → `prop · 크기` → `상태` → `접근성` → `폭` → `카탈로그`
  - 쓰는 곳 · 쓰지 않는 곳 · 상태 · 접근성은 문장이라 마침표로 끝내고, prop 줄 · 하위 bullet · 폭 · 카탈로그는 마침표 없이 끝낸다
  - 쓰지 않는 곳은 "자리 → 대신 쓸 부품" 꼴로 적는다
- **prop 표** — `prop · 크기` 아래에 표 하나를 둔다. 열은 `prop` · `타입` · `기본값` · `뜻`. 타입이 유니온이면 값을 ` · `로 늘어놓는다. 기본값 `필수`는 반드시 주는 prop, `없음`은 생략 가능 · 기본값 없음이다. 표 아래 하위 bullet에 함께 내보내는 상수 · 함수와 CSS 이음새를 적는다
- **이름** — prop 이름은 이 문서와 같다. 같은 생각은 같은 이름이다 — `variant` = 모양 · `tone` = 색의 뜻(DESIGN Colors 다섯 뜻의 하나, 또는 무채색 `mute`) · `size` = 단계 이름 · `kind` = 종류 · `container` = 그릇 · `description` = 제목 곁 보조 글 · `label` = 보이지 않는 이름(`aria-label`)이거나 칸 · 칩의 글자. 이벤트는 `on<동작>`(`onSelect` · `onClose`), 제어 값은 `value` + `onValueChange`, 층은 `open` + `onOpenChange`
- **크기** — 단계 이름으로만 받는다(숫자를 받지 않는다 — typecheck가 막는다). 컨트롤 높이는 DESIGN Layout `컨트롤 높이 단계`(`xs` · `sm` · `sm-plus` · `md` · `lg` · `xl`, 토큰 `--h-*`), 아이콘은 DESIGN Iconography. 부품 고유 치수(원 · 점 · 로고 · 태그 높이 등)는 단계가 아니라 그 절에 적는다(예외 — `Logo` `size` · `Table` `minWidth`는 고유 치수 숫자)
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
- **쓰지 않는 곳** 글자 없는 도구 → `IconButton` · 문장 · 상자 머리 안 링크 모양 → `LinkButton` · 도크(어두운 바탕) 안 버튼 → 도크 부품(자동 탐색을 옮길 때 만든다).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `variant` | `ButtonVariant` — `default` · `primary` | `default` | `default` = 테두리 버튼(1px `--line-control` · `--surface`), `primary` = 주 액션 필(`--primary` · `--on-fill`) — 한 자리에 하나 |
  | `size` | `ButtonSize` — `sm` · `md` | `md` | 높이 단계(`--h-sm` · `--h-md`). `sm`은 표 행 · 알림 줄 · 작은 판(`css/console.css:179`) |
  | `icon` | `IconName` | 없음 | 글자 앞 아이콘. 크기는 `size`를 따른다(`md` → Icon `md` · `sm` → Icon `sm`) |
  | `type` | `button` · `submit` · `reset` | `button` | HTML 속성 그대로. 기본이 `button`이라 폼 안에서 뜻밖에 제출하지 않는다 |
  | 그 밖 | `<button>` 속성 · `ref` | 없음 | `disabled` · `onClick` · `aria-*` 등을 그대로 넘긴다 |
  - 이음 모달의 `.btn.danger`(`js/menu/deploy.js:207`)는 모양이 없어 `default`로 옮긴다. 도크 안 위험 버튼(`css/console.css:235-236`)은 도크 부품이 맡는다
  - 모달 · 드로어 발 버튼의 최소 폭은 `Modal` · `Drawer`가 준다 — 버튼에 폭을 주지 않는다
  - 함께 내보내는 것(`@/ui`) — 타입 `ButtonProps` · `ButtonVariant` · `ButtonSize`
- **상태** hover는 테두리 · 글자가 `--primary`이고 `primary`는 바탕이 `--primary-hover`다(`css/console.css:176-178`). disabled는 공통(`--opacity-disabled` · 커서 `not-allowed`)이고 hover 모양이 바뀌지 않는다(`css/console.css:640-642`). 요청 중에는 쓰는 곳이 `disabled`를 켜고 글자를 진행형으로 바꾼다("배포하는 중…" — `js/menu/deploy.js:107`) — 부품은 스피너를 더하지 않는다.
- **접근성** 아이콘은 장식이라 이름은 글자가 가진다. 누름은 `<button>` 기본 동작(Enter · Space)이다.
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
- **쓰지 않는 곳** 테두리 · 필이 있는 액션 · 알림 줄 작은 버튼 → `Button`(`size="sm"`) · 도크 "선택 해제"(어두운 바탕 `.dock .clr`) → 도크 부품 · LNB 메뉴 → `셸`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `to` | `To`(react-router) | 없음 | 있으면 이동 링크 — 라우터 `Link`(`<a href>`). 주소는 쓰는 곳이 앱 층 도우미로 만든다 |
  | `onClick` | 마우스 이벤트 처리기 | `to`가 없으면 필수 | `to`가 없으면 `<button type="button">`의 동작. `to`와 함께면 이동 전에 부른다(메뉴 다시 받기 등) |
  | `disabled` | boolean | false | 버튼일 때만(`to`와 함께 쓰지 않는다 — 타입이 막는다) |
  | `variant` | `LinkButtonVariant` — `underline` · `mono` · `back` | `underline` | `underline` = 밑줄 글자(`.link`), `mono` = 밑줄 없는 고정폭 작은 글자(도구 id — `js/menu/deploy.js:87`), `back` = 밑줄 없음 + 앞 `back` 아이콘(`md-minus`) 한 단계 큰 글자(`js/menu/discovery.js:256`) |
  | `children` | ReactNode | 필수 | 글자 |
  - 색은 `--primary` 하나. 모양 · 글자 크기는 `variant`가 정한다(`size` 없음)
  - 함께 내보내는 것(`@/ui`) — 타입 `LinkButtonProps` · `LinkButtonVariant`
- **상태** hover 모양이 없다 — 옛 `.link`에 `:hover`가 없다(포커스 링만). disabled도 모양이 바뀌지 않는다(옛 `.link`에 비활성 모양이 없다 — 쓰는 곳이 글자를 진행형으로 바꿔 알린다, "쓰는 중…" `js/menu/studio.js:152`). 공통 disabled(`--opacity-disabled`)를 쓰지 않는 자리다.
- **접근성** `to`면 링크(Enter로 이동), 아니면 버튼(Enter · Space)이다 — 옛은 모두 `<button>`이었고 이동하는 것만 링크가 된다(DESIGN 이식 기간 허용 차이 — LNB와 같은 갈래). `back` 아이콘은 장식이다.
- **카탈로그** `LinkButton`

## 입력

### Select
- **쓰는 곳** 여러 값 중 하나 고르기 — 툴바 필터(호출 로그 AI 클라이언트 `js/menu/logs.js:21` · 원본 시스템 `js/menu/sources.js:26` · 스튜디오 원본 `js/menu/studio.js:128`), 폼 칸(테스트 실행 도구 · 탐색 마법사 — `js/menu/playground.js:47`), 표 안 칸(스튜디오 매핑 — `css/console.css:1074-1077`).
- **쓰지 않는 곳** 두세 모드 고르기 → 세그먼트(변환 스튜디오를 옮길 때 만든다 — 탭 역할 · 라디오 역할을 나눈다) · 설명이 붙은 선택지 → 라디오 카드(변환 스튜디오를 옮길 때 만든다) · 화면 안 상태 필터 → `FilterChips`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `variant` | `SelectVariant` — `toolbar` · `form` · `cell` | 필수 | 모양과 높이 — 아래 표 |
  | `value` | string | 필수 | 고른 값 |
  | `onValueChange` | `(value: string) => void` | 필수 | 바꾸면 그 값(옛 `change` — `js/menu/logs.js:64-66`) |
  | `children` | ReactNode | 필수 | `<option>` · `<optgroup>`(테스트 실행 도구 목록) |
  | 그 밖 | `<select>` 속성 · `ref` | 없음 | `aria-label` · `id` · `disabled` 등. `onChange` · `size` · `multiple`은 받지 않는다 |

  | `variant` | 모양 | 이음 근거 |
  |---|---|---|
  | `toolbar` | `--h-lg` · 각진 모서리 · 최대 폭 220 | `.sel-f` `css/console.css:399` |
  | `form` | `--h-md` · 칸 전체 폭 | `.inp` `css/console.css:307` |
  | `cell` | `--h-xs` · 칸 전체 폭(최소 90) · 작은 글자 | `.map .mini` `css/console.css:1074-1077` |
  - 펼침 화살표는 브라우저 기본 그대로(옛도 `appearance`를 바꾸지 않았다). 선택지 밖 값도 브라우저 기본 처리 그대로다
  - 함께 내보내는 것(`@/ui`) — 타입 `SelectProps` · `SelectVariant`
- **상태** `form`은 포커스에 테두리가 `--primary`가 되고 전역 링을 더한다(옛 `.inp:focus`는 링을 지웠다 — DESIGN 이식 기간 고침). `toolbar` · `cell`은 전역 링만이다(옛에 포커스 모양이 따로 없다). disabled는 공통이다.
- **접근성** `toolbar` · `cell`은 보이는 라벨이 없어 `aria-label`을 반드시 준다("AI 클라이언트" — `js/menu/logs.js:21`). `form`은 폼 칸의 라벨(`id` 연결)이 이름이다.
- **카탈로그** `Select`

### SearchInput
- **쓰는 곳** 목록 위 글자 검색 — 툴바형(호출 로그 `js/menu/logs.js:22` · 원본 시스템 `js/menu/sources.js:25`), 패널 전폭형(변환 스튜디오 도구 목록 `js/menu/studio.js:137`)(이음 `.search` `css/console.css:138-144`).
- **쓰지 않는 곳** Enter로 보내는 입력(대화 · 금지어) → 그 입력 부품(테스트 실행 · 원본 연결을 옮길 때 만든다 — 한글 조합 중 Enter 가드는 그쪽) · 폼 칸 → 입력 부품(원본 시스템을 옮길 때 만든다).
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

## 표시

### StatusChip
- **쓰는 곳** 자원 상태(점 + 글자) — 호출 로그 표 · 상세(`js/menu/logs.js:13,38`) · 원본 목록 · 도구 목록 · 배포 · 탐색 작업(이음 `.stt` `css/console.css:511-517`, `stt()` `js/common/state.js:35`).
- **쓰지 않는 곳** 상태 값에서 라벨 · 색 고르기 → `copy/status` `statusOf`(자원 래퍼 — `SourceStatus` 등) · 점만 → `StatusDot` · 상태가 아닌 표지(프로토콜 · 모드 · 규칙) → `Tag` · `RuleChip`.
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
- **쓰는 곳** 상태 색만 쓰는 작은 표지 — "추정" · "새 필드"(변환 스튜디오 `js/menu/studio.js:45,47`) · "2차"(원본 시스템) · 추천 표식 · 탐색 네트워크 기록 결과 태그(`.ntag`)(이음 `.gs-tag` · `.p2` · `.rec` · `.ntag` `css/console.css:269,526-527,997-1000`).
- **쓰지 않는 곳** 자원 상태(점 + 글자) → `StatusChip` · 변환 규칙 → `RuleChip` · 이음 도메인 색 표지(프로토콜 · 읽기/쓰기 · 탐색 근거 · 메서드) → 그 표지 래퍼(그 메뉴를 옮길 때 만든다 — 도메인 색은 래퍼에서만).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `tone` | `StatusTone` | 필수 | 색 — 상태 넷 + `mute`(`.ntag.mute` `css/console.css:1000`) |
  | `shape` | `TagShape` — `square` · `round` | `square` | `square` = 각진 모서리 `--r-sm`, `round` = 알약(`.ntag`) |
  | `size` | `TagSize` — `sm` · `md` · `lg` | `sm` | 태그 고유 높이(18 · 20 · 22 — 컨트롤 높이 단계와 다른 축). `sm`은 `.gs-tag` 17 · `.p2` · `.rec` · `.ntag` 18, `md`는 `.md-tag` · `.evb` 20, `lg`는 `.pr` 22 |
  | `dashed` | boolean | false | 점선 테두리(`.pr.sample` · `.evb.off`) |
  | `strike` | boolean | false | 취소선(`.evb.off`) |
  | `title` | string | 없음 | 마우스 툴팁 — 있으면 `cursor: help` |
  | `children` | ReactNode | 필수 | 글자 |
  | `className` | string | 없음 | 배치만(여백 · 정렬 — 모양을 바꾸지 않는다) |
  - 함께 내보내는 것(`@/ui`) — 타입 `TagProps` · `TagShape` · `TagSize`
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
- **쓰는 곳** 표 · 상자 · 칸 아래 흐린 안내 한두 줄 — 호출 로그 표 아래(`js/menu/logs.js:27`) · 원본 연결 · 테스트 실행 · 배포 안내(이음 `.tab-hint` `css/console.css:289-290`).
- **쓰지 않는 곳** 아이콘 · 테두리가 있는 안내 → `Notice` · 빈 자리 → `EmptyState` · 대시보드 빈 상태 큰 상자의 보조 문장 → `EmptyState size="hero"`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `size` | `HelpTextSize` — `sm` · `md` | `sm` | 글자 단계 — `md`는 변환 스튜디오 원본 선택 줄(옛 인라인 13px — `js/menu/studio.js:129`) |
  | `children` | ReactNode | 필수 | 문장 — 강조 `<b>`는 한 단계 진한 `--text-muted` |
  | `className` | string | 없음 | 배치(바깥 여백)만 — 옛 `.tab-hint`의 위아래 여백은 쓰는 곳이 준다 |
  - `<p>` · `--text-faint`. 미리보기 아래 메모(`.pv-note`)는 변환 스튜디오를 옮길 때 이 부품과 대조한다
  - 함께 내보내는 것(`@/ui`) — 타입 `HelpTextProps` · `HelpTextSize`
- **상태** 없다.
- **카탈로그** `HelpText`

### ProgressBar
- **쓰는 곳** 가로 막대 하나 — 비율 막대(대시보드 많이 쓰인 도구 `js/menu/dashboard.js:48`, `.meter` `css/console.css:583-584`) · 진행 막대(원본 연결 분석 `js/menu/sources.js:76`, `.bar-p` `css/console.css:847-848`). 두 옛 모양은 같아 하나로 둔다.
- **쓰지 않는 곳** 단계 목록 진행 → 단계 표시(원본 시스템 · 자동 탐색을 옮길 때 만든다) · 도는 원 → 그 자리 부품.
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

### Notice
- **쓰는 곳** 아이콘이 붙은 안내 · 경고 상자 — 결과의 일부인 실패(로그 상세 위 서버 문장 `danger` `js/menu/logs.js:45`, 변환 과정 실패 단계 `warn` `js/common/convert.js:183` — 같은 `note`를 두 자리에 그리는 것은 옛 그대로), 원본 연결 안내(`js/menu/sources.js:71,79`), 스튜디오 알림 띠(`js/menu/studio.js:59-66`), 배포 · 탐색 안내(`js/menu/deploy.js:25,150-153` · `js/menu/discovery.js:42,268,304,339-348`)(이음 `.notice` `css/console.css:270-272,643-650`).
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

층 공통 — `ui/layers`(안쪽 전용 — `@/ui`로 내보내는 것은 `closeAllLayers` · `useOpenLayers` 둘). 쓰는 곳은 DESIGN 쌓임 · 접근성 `층`. `Toast`는 층 목록 밖이다(Esc · `closeAllLayers` · `useOpenLayers`와 상관없다).
- **여는 법** — 기본 `<dialog>`를 `show()`로 연다(top layer를 쓰지 않는다). 포커스를 가두지 않는다 — Tab이 층 밖으로 나간다(이음 그대로 — 닫은 뒤 포커스 복귀만 더했다)
- **가림막 · z** — 층마다 `Overlay`를 함께 그리고 z는 DESIGN 쌓임 짝(`--z-modal-scrim` · `--z-modal`, 드로어는 `--z-drawer-scrim` · `--z-drawer`)이다. 층과 가림막은 `document.body`로 포털한다(셸의 쌓임 맥락 밖)
- **Esc** — 문서의 keydown 하나가 열린 층 목록의 맨 위 층만 닫는다(이음 `js/main.js:55` — 모달이 있으면 모달만). 한글 조합 중 Esc는 무시한다. 맨 위 층이 `dismissible=false`면 아무것도 하지 않는다
- **포커스 복귀** — 열 때 포커스가 있던 요소를 기억했다가 닫을 때 돌려준다. 그 요소가 사라졌으면 `returnFocusFallback()`이 준 곳으로. 닫는 순간 포커스가 층 안에 있거나 사라졌을 때만 옮긴다 — 층 밖으로 Tab해 간 포커스는 빼앗지 않는다. 드로어는 열린 채 다른 항목을 열면(`contentKey`) 기억할 요소를 다시 잡는다(Drawer 절)
- **메뉴 이동** — `closeAllLayers()`가 열린 층을 위에서부터 모두 닫는다(`dismissible`과 상관없이). 셸이 메뉴(`menuOf`)가 바뀔 때 부른다. 화면이 쥔 층은 화면이 사라지며 함께 닫힌다
- **열린 층** — `useOpenLayers()`가 `{ modal: boolean; drawer: boolean }`을 돌려준다 — 지금 열린 층 중 모달 · 드로어가 있는지(층이 열리고 닫힐 때 다시 그려지고, 요약이 그대로면 그리지 않는다). 화면이 층 때문에 멈추거나 숨길 때 읽는다 — 모달이 열린 동안 폴링을 멈추고(이음 `js/menu/deploy.js:133`), 드로어가 열리면 도크를 숨긴다(`css/console.css:225`). 층을 열고 닫는 값이 아니라 읽기 전용이다. 카탈로그 Modal 절의 "useOpenLayers" 줄이 이 값을 보인다
- **공통 prop** — `open` · `onOpenChange`(✕ · 취소 · Esc · 가림막 모두 `onOpenChange(false)`) · `dismissible`(기본 true) · `returnFocusFallback`

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

### Drawer
- **쓰는 곳** 오른쪽에서 밀려오는 상세 · 여러 단계 — 호출 로그 상세(`js/menu/logs.js:35-48`) · 원본 연결 마법사(`js/menu/sources.js:101`) · 탐색 마법사 · 탐색 근거(`js/menu/discovery.js:83,329`)(이음 `openDrawer` `js/common/overlay.js:4-14`, `.drawer` · `.d-head` · `.d-body` · `.d-foot` `css/console.css:242-254`, `index.html:43`).
- **쓰지 않는 곳** 짧은 확인 · 입력 → `Modal` · 결과 알림 → `Toast` · 본문 옆 상세(목록 + 상세) → 목록 + 상세 레이아웃(변환 스튜디오를 옮길 때 만든다).
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
  - 층 종류 `drawer` — `useOpenLayers().drawer`가 켜진다(도크 숨김 — 옛 `body.d-open` `css/console.css:225`)
  - 함께 내보내는 것(`@/ui`) — 타입 `DrawerProps`
- **상태** 열림은 `<dialog open>`이다. `data-dismissible`. 열린 채 `contentKey`가 바뀌어도 층은 그대로다 — 쌓임 순서 · Esc 맨 위 층 · `useOpenLayers`를 다시 등록하지 않는다.
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

## 레이아웃

### PageHead
- **쓰는 곳** 화면 맨 위 제목 + 설명 — 메뉴 화면 여섯(이음 `pageHead(id)` `js/common/state.js:21`, `css/console.css:109-111`). 빈 상태 화면(스튜디오 · 테스트 실행 · 배포)도 같은 머리를 쓴다(`js/menu/studio.js:120`).
- **쓰지 않는 곳** 탐색 작업 화면 머리(뒤로 링크 + 상태 칩 + 오른쪽 버튼 — `js/menu/discovery.js:251-258`) → 자동 탐색을 옮길 때 이 부품에 변형을 더한다 · 상자 · 절 제목 → `Box`.
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

### Box
- **쓰는 곳** 제목 줄이 있는 상자 — 대시보드 구조도 · 시간대 차트 · 확인 항목 · 많이 쓰인 도구(`js/menu/dashboard.js:20,42,47,57`), 스튜디오 · 배포 정책(`js/menu/studio.js:102` · `js/menu/deploy.js:90`), 테스트 실행 · 탐색 화면 상자(이음 `.box` · `.box-h` · `.box-b` `css/console.css:502-506`).
- **쓰지 않는 곳** 화면 제목 → `PageHead` · 수치 띠 → `StatStrip` · 목록 표(자기 윗선 · 테두리) → `Table` · 점선 빈 상자 · 대시보드 큰 빈 상자 → `EmptyState`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `title` | ReactNode | 없음 | 머리 제목(h3). 없으면 머리 줄을 그리지 않는다(배포 정책 요약 — `js/menu/deploy.js:90`) |
  | `description` | ReactNode | 없음 | 제목 곁 작은 보조 글("최근 24시간" · "2건" — `css/console.css:505`) |
  | `actions` | ReactNode | 없음 | 머리 오른쪽(`LinkButton` · 작은 버튼) |
  | `padded` | boolean | false | 본문 안쪽 여백(`.box-b`). 구조도 · 차트처럼 내용이 자기 여백을 가지면 끈다 |
  | `children` | ReactNode | 필수 | 본문 |
  | `className` | string | 없음 | 배치(바깥 여백 · 격자 칸)만 |
  - 상자 — 1px `--line-control` · `--surface`, 그림자 없음(DESIGN 핵심 규칙 4). 머리 — `--surface-sub` 줄 · 아래 1px `--line-divider` · 제목과 동작을 양끝에 두고 좁으면 접는다
  - 머리 두 줄(테스트 실행 대화 상자 — `css/console.css:735-738`) · `section` 이름(`js/menu/playground.js:41,56`)은 테스트 실행을 옮길 때 더한다
  - 함께 내보내는 것(`@/ui`) — 타입 `BoxProps`
- **상태** 없다(그릇).
- **접근성** 제목은 h3다(화면 h2 아래).
- **카탈로그** `Box`

### Toolbar
- **쓰는 곳** 목록 위 한 줄 도구 — 왼쪽 필터 · 빈칸 · 오른쪽 선택 · 검색 · 버튼(호출 로그 `js/menu/logs.js:18-23` · 원본 시스템 `js/menu/sources.js:24` · 스튜디오 `js/menu/studio.js:126` · 탐색 결과 `js/menu/discovery.js:313`)(이음 `.toolbar` · `.sp` `css/console.css:596-598`).
- **쓰지 않는 곳** 상자 머리의 동작 → `Box` `actions` · 화면 머리 오른쪽 버튼 → `PageHead`(자동 탐색에서 더한다).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `children` | ReactNode | 필수 | 도구들 — 왼쪽 무리와 오른쪽 무리 사이에 `ToolbarSpacer` |
  | `className` | string | 없음 | 배치(바깥 여백 — 옛 위 22는 쓰는 곳)만 |
  - `ToolbarSpacer` — 남은 폭을 차지하는 빈칸(prop 없음)
  - 한 줄에 놓고 좁으면 접는다(간격 `--s-2`). 맨 앞 라벨 칸(`.lbl2` — 변환 스튜디오)은 변환 스튜디오를 옮길 때 더한다
  - 함께 내보내는 것(`@/ui`) — `ToolbarSpacer` · 타입 `ToolbarProps`
- **상태** 없다(그릇).
- **폭**
  - 760: 빈칸을 숨긴다 — 검색(`SearchInput variant="toolbar"`)이 남은 폭을 채운다(`css/console.css:898-899`)
- **카탈로그** `Toolbar`

### TwoColumn
- **쓰는 곳** 화면 본문 두 열 — 정해 둔 다섯 조합만(이음 `.dgrid` · `.td-grid` · `.dp-grid` · `.dsum` · `.dgrid2`).
- **쓰지 않는 곳** 고정 목록 열 + 상세(스튜디오 · 배포 · 테스트 실행) → 목록 + 상세 레이아웃(변환 스튜디오를 옮길 때 만든다) · 칸 안 두 칸 · 라벨 + 값 줄 → 칸 묶음(AI 연결 배포를 옮길 때 만든다) · 새 비율 → `design-change`로 조합을 더한다.
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

## 데이터

### KeyValueGrid
- **쓰는 곳** 드로어 안 요약 칸(작은 키 + 값) — 호출 로그 상세 6칸(`js/menu/logs.js:37-44`) · 탐색 근거(`js/menu/discovery.js:331-338`)(이음 `.lsum` `css/console.css:804-809`).
- **쓰지 않는 곳** 화면 수치 띠 → `StatStrip` · 목록 → `Table` · 입력 폼 → 폼 칸(원본 시스템을 옮길 때 만든다).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `items` | `readonly KeyValueItem[]` — `{ label: ReactNode; value: ReactNode; mono?: boolean }` | 필수 | 칸 — 순서대로 3열로 채운다. `mono`는 값을 고정폭 작은 글자로(요청 ID — 옛 인라인 12.5px `js/menu/logs.js:43`) |
  | `className` | string | 없음 | 배치(바깥 여백 — 옛 아래 16은 쓰는 곳)만 |
  - 상자 — 1px `--line-divider` · `--surface-sub`, 칸 사이 1px `--line-divider`(줄이 바뀐 칸은 위 선). 키는 흐린 작은 글(`--text-faint`), 값은 본문 글
  - 값이 없는 칸은 쓰는 곳이 값 없음 표기(`copy/`)를 넣는다 — 이 부품은 빈 값을 채우지 않는다
  - 함께 내보내는 것(`@/ui`) — 타입 `KeyValueGridProps` · `KeyValueItem`
- **상태** 없다(표시).
- **접근성** `<dl>`(칸마다 `<dt>` · `<dd>`)로 그린다 — 옛 `div`와 보이는 차이가 없다.
- **폭**
  - 760: 2열(`css/console.css:901-904`)
- **카탈로그** `KeyValueGrid`

### StatStrip
- **쓰는 곳** 화면 머리 아래 수치 띠 — 대시보드 KPI 5칸(`js/menu/dashboard.js:9-15`, `.kpi` `css/console.css:530-537`) · 탐색 실시간 6칸(`js/menu/discovery.js:184-190`, `.dk` `css/console.css:953-958`). 두 옛 띠는 같은 모양이라 하나로 둔다.
- **쓰지 않는 곳** 드로어 안 요약 → `KeyValueGrid` · 상자 안 결과 칸(원본 연결 분석 결과 `.res-grid`) → 원본 시스템을 옮길 때 정한다.
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
  | `tone` | `danger` | 수치 색 — 차단 수(탐색 — 옛 인라인 위험색) |
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
- **쓰지 않는 곳** 테두리 작은 표(매핑 · 배포 도구 · 키 · 탐색 파라미터 — `.map` `css/console.css:676-690`) → 작은 표 부품(변환 스튜디오를 옮길 때 만든다 — 두 표는 모양이 달라 합치지 않는다) · 빈 목록 → 본문에 `EmptyState container="table"` · 드로어 안 요약 → `KeyValueGrid`.
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
  | `TableHeadCell` | `align`(`center` · `start`, 기본 `center`) · `children` | 머리 칸 `<th>`(`--h-th` · `--surface-sub` · 위 고정 `--z-sticky`) |
  | `TableRow` | `onActivate`(`() => void`, 없음) · `selected`(boolean, false) · `children` | 행. `onActivate`가 있으면 누를 수 있는 행 — 포인터 · 포커스(`tabindex="0"`) · Enter · Space(`js/main.js:58`). `selected`는 `--surface-selected` 바탕 |
  | `TableCell` | `align`(`center` · `start`, 기본 `center`) · `children` | 칸 `<td>` — 기본 가운데 정렬 · 한 줄(옛 `td.l`이 `start`) |
  - 상자 — 위 `--bw-strong` `--line-strong` · 아래 1px `--line-divider` · `--surface`, 가로 넘침은 상자 안 스크롤. 칸 사이 · 행 사이 1px `--line-divider`, 머리 아래 1px `--line-control`
  - 칸 글자(고정폭 도구 id · 흐린 시각 · 굵은 수치 등 — 옛 `.tn` · `.date` · `.num`)는 쓰는 곳이 토큰으로 준다. 체크 칸(`.ck` — 탐색 결과)은 자동 탐색을 옮길 때 더한다
  - 함께 내보내는 것(`@/ui`) — `TableHeadCell` · `TableRow` · `TableCell` · 타입 `TableProps` · `TableMinWidth` · `TableDensity` · `TableRowProps`
- **상태** 행 hover는 칸 바탕 `--surface-hover`(`css/console.css:205`), `selected`는 `aria-selected`가 아니라 `data-state="selected"`다(행은 목록 선택 위젯이 아니다). 빈 행은 누름 · hover 모양이 없다(`css/console.css:212`).
- **접근성** 누를 수 있는 행에 포커스가 오면 칸 바탕이 hover와 같고 안쪽 링을 더한다(옛은 링을 지웠다 — `css/console.css:605-606`, DESIGN 이식 기간 고침). Enter · Space는 행 자신에서 눌렀을 때만 `onActivate`를 부르고 기본 동작(스크롤)을 막는다 — 칸 안 버튼 · 링크에서 올라온 키는 그 요소 몫이다.
- **카탈로그** `Table`

### CodeBlock
- **쓰는 곳** 여러 줄 코드 · 요청 · 응답 · 로그 — 변환 과정 단계(`js/common/convert.js:159`) · 스튜디오 미리보기(`js/menu/studio.js:53-55`) · 배포 스니펫 · 서버 로그(`js/menu/deploy.js:81,167`) · 탐색 근거(`js/menu/discovery.js:321-346`)(이음 `pre.code` `css/console.css:724-726`).
- **쓰지 않는 곳** 문장 안 짧은 코드 → `InlineCode` · 코드 입력(편집) → 입력 부품(테스트 실행을 옮길 때 만든다).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `code` | `TraceCode`(`app/trace/types`) — `{ text; lang; bodyLang? }` | 필수 | 원문과 언어. `lang`은 `json` · `xml` · `http` · `plain`. `http`는 첫 빈 줄에서 머리와 본문을 나누고 본문을 `bodyLang`(`json` · `xml`)으로 강조한다. 객체는 쓰는 곳이 JSON 글(2칸 들여쓰기)로 바꿔 넘긴다 |
  | `labelledBy` · `label` | string | 둘 중 하나 필수 | 스크롤 상자의 이름 — 다른 요소의 id(변환 과정은 그 단계 제목 — 새 문구 없음) 또는 글자 |
  | `variant` | `CodeBlockVariant` — `code` · `log` | `code` | `log` = 서버 로그(강조 없음 · 긴 줄을 접음 · 최대 높이 화면 56% — 옛 인라인 `js/menu/deploy.js:167`) |
  | `className` | string | 없음 | 배치만 |

  | 언어 | 나누는 것 → 토큰 | 이음 근거 |
  |---|---|---|
  | `json` | 키(뒤에 `:`가 붙은 문자열) `--code-key` · 문자열 `--code-string` · 수 `--code-number` · `true` `false` `null` `--code-literal` | `hlJSON` `js/common/convert.js:137-141` |
  | `xml` | 주석 `--code-comment`(기울임) · 태그 `--code-tag` · 속성 이름 `--code-key` · 속성 값 `--code-string` | `hlXML` `:142-147` |
  | `http` | 첫 줄 메서드 · `HTTP/1.1` `--code-literal`(`--fw-mono-strong`) · 쿼리 키(`?k=` · `&k=`, 이어진 줄 포함) · 헤더 이름 `--code-key` · 본문은 `bodyLang` | `hlHTTP` `:148-158` |
  | `plain` | 나누지 않는다 | — |
  - **토큰 분할 계약** — 같은 입력이면 옛 하이라이터와 같은 자리에서 나눈다(옛은 이스케이프한 글 위에서 정규식을 돌렸다 — 원문 위에서 같은 경계가 되게 옮긴다. 예: JSON 문자열은 첫 `"`에서 끝난다). 결과는 React 노드(`<span>`)이고 `dangerouslySetInnerHTML`을 쓰지 않는다
  - 상자 — `--surface-sub` · 1px `--line-divider` · `--font-mono` · 줄바꿈 없음(`log`는 접음) · 최대 높이 420 · 넘치면 상자 안 스크롤. 고정폭 `java` 강조(탐색 근거 `js/menu/discovery.js:320-323`)는 자동 탐색을 옮길 때 `lang`에 더한다
  - 함께 내보내는 것(`@/ui`) — 타입 `CodeBlockProps` · `CodeBlockVariant`(언어 타입 `CodeLang` · `TraceCode`는 `app/trace/types`)
- **상태** 없다(표시).
- **접근성** 스크롤 상자는 `tabindex="0"` + 이름 + 안쪽 링이다(옛 `pre.code tabindex="0"` — `js/common/convert.js:159`, 이름은 보이지 않는 보강). 서버 로그 상자도 같다(옛은 `tabindex`가 없었다 — DESIGN 이식 기간 고침).
- **카탈로그** `CodeBlock`

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

연결 흐름 · 변환 과정처럼 이음에만 있는 모양 중 두 화면 이상이 쓰거나 `@media`가 필요한 것이다 — 한 화면만 쓰고 `@media`가 없는 조각(대시보드 시간대 차트 · 많이 쓰인 도구 · 확인 항목, 로그 상태 칩)은 그 화면 폴더에 둔다. 값 → 글자 · 색 찾기(상태 · 규칙 · 프로토콜)는 `copy/`와 앱 층이 하고, 이 부품들은 받은 글자와 색의 뜻만 그린다(원본 상태만 `copy/status`를 직접 읽는다).

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

### RuleChip
- **쓰는 곳** 변환 규칙 칩 — 변환 과정 단계의 규칙 줄(`js/common/convert.js:164,179,182`) · 탐색 파라미터 추론(이음 `.rl` `css/console.css:696-700`, `ruleChip()` `js/common/state.js:37`).
- **쓰지 않는 곳** 스튜디오 파이프라인 허브의 규칙 요약 칩(파란 허브 위 — `css/console.css:663-664`) → 파이프라인(변환 스튜디오를 옮길 때 만든다) · 상태 표지 → `StatusChip` · `Tag`.
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
- **쓰지 않는 곳** 변환 과정 단계 사이 세로선 → `TraceView` · 단계 표시 사이 선 → 단계 표시(원본 시스템을 옮길 때 만든다).
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
- **쓰지 않는 곳** 스튜디오 파이프라인(원본 칸 · 허브 칸 · AI 도구 칸) → 파이프라인(변환 스튜디오를 옮길 때 만든다 — `FlowLine`을 함께 쓴다).
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
