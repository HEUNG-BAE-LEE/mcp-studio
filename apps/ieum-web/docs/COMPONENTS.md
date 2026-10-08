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
  | `pending` | boolean | false | 요청 중 잠금(쓰기 버튼 · 진행 중인 요청의 결과를 기다리는 버튼) — `aria-disabled="true"` · 누름 · Enter · Space를 무시(`onClick`을 부르지 않고 폼 제출도 막는다) · 비활성 모양. 포커스는 버튼에 남는다 |
  | 그 밖 | `<button>` 속성 · `ref` | 없음 | `disabled` · `onClick` · `aria-*` 등을 그대로 넘긴다 — `aria-disabled`는 받지 않는다(`pending`이 낸다) |
  - 잠금은 둘이다 — `disabled`는 조건이 안 맞아 못 누르는 것(마법사 첫 단계의 "이전" · 값이 없는 "다음" — native라 포커스를 받지 않고 Tab이 건너뛴다), `pending`은 요청 중 잠금이다. 요청 중 잠금은 쓰기 버튼과 진행 중인 요청의 결과를 기다리는 버튼(마법사에서 연결 · 분석이 끝나야 넘어가는 "변환 스튜디오에서 검토"처럼 포커스된 버튼이 그 자리에서 바뀌는 것)에만, 반드시 `pending`으로 한다 — 포커스된 버튼에 native `disabled`를 걸면 Chrome이 포커스를 `body`로 빼서 키보드 사용자가 자리를 잃고, 풀린 뒤 Enter가 아무것도 누르지 않는다
  - 이음 모달의 `.btn.danger`(`js/menu/deploy.js:207`)는 모양이 없어 `default`로 옮긴다. 도크 안 위험 버튼(`css/console.css:235-236`)은 도크 부품이 맡는다
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
- **쓰지 않는 곳** 두세 모드 고르기 → 세그먼트(변환 스튜디오를 옮길 때 만든다 — 탭 역할 · 라디오 역할을 나눈다) · 설명이 붙은 선택지 → `RadioCard` · `RadioList` · 화면 안 상태 필터 → `FilterChips`.
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
- **쓰지 않는 곳** Enter로 보내는 입력(대화 · 금지어) → 그 입력 부품(테스트 실행 · 자동 탐색을 옮길 때 만든다 — 한글 조합 중 Enter 가드는 그쪽) · 폼 칸 → `Input` + `Field`.
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
- **쓰는 곳** 폼의 한 줄 입력 — 연결 마법사 시스템 이름 · 명세 URL · 서버 주소 · 인증 칸(`js/menu/sources.js:57,66,69,88`) · 재인증 모달의 인증 칸(`:136`)(이음 `.inp` `css/console.css:307-309`, 고정폭 `.mono` `:488`).
- **쓰지 않는 곳** 여러 줄 → `Textarea` · 목록 검색 → `SearchInput` · 정해진 값 고르기 → `Select variant="form"` · Enter로 보내는 입력(대화 · 금지어) → 그 입력 부품(테스트 실행 · 자동 탐색을 옮길 때 만든다) · 표 안 작은 칸(매핑 `.map .mini`) · 정책 숫자 칸(`css/console.css:716`) → 변환 스튜디오를 옮길 때 이 절에 크기를 더한다.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `value` | string | 필수 | 입력 글자 |
  | `onValueChange` | `(value: string) => void` | 필수 | 입력할 때마다 바로 부른다(옛 `input` 이벤트 즉시 — `js/menu/sources.js:166-170,181-186`) |
  | `type` | `InputType` — `text` · `password` | `text` | `password`면 부품이 `autocomplete="new-password"`를 함께 넣는다 — 옛 비밀 칸이 모두 그랬다(`js/menu/sources.js:88` · `js/menu/discovery.js:39`, 브라우저가 저장된 비밀번호를 채우지 않게) |
  | `mono` | boolean | false | 고정폭 글꼴 — 서버 주소 · 키 이름 · 토큰 URL(옛 `.inp.mono`) |
  | 그 밖 | `<input>` 속성 · `ref` | 없음 | `id` · `placeholder` · `aria-label` · `aria-describedby` · `disabled` · `readOnly` 등. `onChange` · `size`는 받지 않는다 |
  - 높이 `--h-md` 하나 · 칸 전체 폭. 자리표시는 브라우저 기본 색이다(옛 `.inp`에 자리표시 규칙이 없다)
  - 인라인 오류 모양은 없다 — 이음은 단계 검증 실패를 경고 토스트로만 알린다(옛 `.inp.err` `:309`는 쓰는 곳이 없다)
  - `number`(정책 한도 · 탐색 최대 화면 수) · `time`(탐색 예약)은 그 메뉴를 옮길 때 `InputType`에 더한다
  - 함께 내보내는 것(`@/ui`) — 타입 `InputProps` · `InputType`
- **상태** 포커스에 테두리가 `--primary`가 되고 전역 링을 더한다(옛 `.inp:focus`는 링을 지웠다 — DESIGN 이식 기간 고침). disabled는 공통이다. `readOnly`는 모양이 바뀌지 않는다.
- **접근성** 이름은 `Field`의 라벨(`id` 연결)이다. 보이는 라벨이 없는 칸(탐색 아이디 · 비밀번호 — `js/menu/discovery.js:47`)은 `aria-label`을 준다.
- **카탈로그** `Input`

### Textarea
- **쓰는 곳** 폼의 여러 줄 입력 — 연결 마법사 호출 샘플 요청 · 응답(`js/menu/sources.js:62-63`)(이음 `textarea.inp` `css/console.css:837,1078`).
- **쓰지 않는 곳** 한 줄 → `Input` · 도구 설명 편집(본문 글꼴 · 글자 수 줄 `.desc-ed` `:667-669`) → 변환 스튜디오를 옮길 때 이 절에 변형을 더한다 · 코드 보기 → `CodeBlock`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `value` | string | 필수 | 입력 글자 |
  | `onValueChange` | `(value: string) => void` | 필수 | 입력할 때마다 바로 부른다(옛 `input` 이벤트 — `js/menu/sources.js:183-184`) |
  | 그 밖 | `<textarea>` 속성 · `ref` | 없음 | `rows`(보이는 줄 수 — 옛 요청 3 · 응답 6) · `id` · `placeholder` · `aria-*` · `disabled`. `onChange`는 받지 않는다 |
  - 고정폭 작은 글자 · 세로로만 늘인다 — 옛 `textarea.inp`의 두 정의가 겹친 결과 그대로(`:837` 최소 높이 + `:1078` 안쪽 · 행간). `base.css`가 textarea에 글꼴을 물려주지 않아 부품이 글꼴 · 크기 · 행간 · 색을 직접 정한다(DESIGN Typography)
  - 함께 내보내는 것(`@/ui`) — 타입 `TextareaProps`
- **상태** `Input`과 같다 — 포커스에 테두리 `--primary` + 전역 링, disabled 공통.
- **접근성** 이름은 `Field`의 라벨이다(라벨 위 정렬 — `Field align="top"`).
- **카탈로그** `Textarea`

### Field
- **쓰는 곳** 라벨 + 입력 한 줄 — 연결 마법사 · 재인증 모달의 칸(`js/menu/sources.js:57-69,88-95`)(이음 `.field` `css/console.css:305-306`, 760 `:472`).
- **쓰지 않는 곳** 보이는 라벨이 없는 칸 → 입력의 `aria-label` · 라벨 줄 + 라디오 목록 → `RadioList`(`label`) · 칸 안 두 입력(탐색 아이디 + 비밀번호 `.two`) → `FieldPair`(자동 탐색을 옮길 때 만든다) · 목록 위 필터 · 검색 → `Toolbar`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `label` | ReactNode | 필수 | 보이는 라벨 |
  | `align` | `FieldAlign` — `center` · `top` | `center` | 라벨 세로 위치 — `top`은 여러 줄 입력(호출 샘플 — 옛 인라인 `align-items:start` + 라벨 위 여백, `js/menu/sources.js:62-63`) |
  | `children` | `(control: FieldControl) => ReactNode` | 필수 | 입력을 그린다 — `control.id`를 입력의 `id`로 준다(라벨 연결) |
  | `className` | string | 없음 | 배치(바깥 여백 — 옛 인라인 위 14 `js/menu/sources.js:69`)만 |
  - 줄 — 라벨 열 `--w-field-label` + 입력 열. 줄 아래 간격은 부품이 준다(옛 `.field` 아래 여백)
  - `FieldControl` — `{ id: string }`. 필수 표시(`*` + 시각 숨김 — 변환 스튜디오) · 입력 열 아래 안내(자동 탐색) · 라벨 툴팁(테스트 실행)은 그 메뉴를 옮길 때 이 절에 prop과 `FieldControl.describedBy`를 더한다
  - 함께 내보내는 것(`@/ui`) — 타입 `FieldProps` · `FieldAlign` · `FieldControl`
- **상태** 없다(그릇). 안의 입력이 낸다.
- **접근성** 라벨은 `<label for>`로 입력과 이어진다 — 옛 `<label>`은 입력과 이어지지 않았다(`js/menu/sources.js:57` — DESIGN 이식 기간 허용 차이, 라벨 연결). 라벨을 누르면 입력에 포커스가 간다.
- **폭**
  - 760: 라벨 위 · 입력 아래 한 열(`css/console.css:472`)
- **카탈로그** `Field`

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
- **쓰지 않는 곳** 아이콘 · 긴 설명이 붙은 카드 → `RadioCard` · 설명 없는 짧은 선택지 → `Select` · 두세 모드 → 세그먼트(변환 스튜디오를 옮길 때 만든다).
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
- **쓰는 곳** 아이콘 · 제목 · 설명이 붙은 선택지 카드에서 하나 고르기 — 연결 마법사 1단계 연결 방식(`js/menu/sources.js:55`)(이음 `.mode-card` · `.radio` `css/console.css:260-268,821-822,913`). 카드 격자(`CardGrid`) · 묶음 제목(`.wz-g`)은 쓰는 곳이다.
- **쓰지 않는 곳** 설명 한 줄짜리 목록 → `RadioList` · 정책 실행 방식 · 탐색 스테이징 선택(작은 카드 `.opt` `:704-711`) → 변환 스튜디오를 옮길 때 이 절에 `variant`를 더한다 · 두세 모드 → 세그먼트.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `title` | ReactNode | 필수 | 제목(굵게) |
  | `description` | ReactNode | 없음 | 제목 아래 설명(`--text-muted`) |
  | `icon` | `IconName` | 없음 | 제목 앞 아이콘(`md` · `--primary`). 서버가 준 이름은 쓰는 곳이 `iconOf`로 바꾼다 |
  | `badges` | ReactNode | 없음 | 제목 뒤 표지 — `Tag`("2차" `neutral` · 추천 `ok`) |
  | `selected` | boolean | 필수 | 고른 카드 |
  | `onSelect` | `() => void` | 필수 | 누름 — 이미 고른 카드여도 부른다(옛 `wzMode` — `js/menu/sources.js:153`) |
  | `disabled` | boolean | false | 잠긴 카드(2차 · 아직 열지 않은 모드) |
  | `className` | string | 없음 | 배치만 — 넓은 카드(옛 `.mode-card.wide` 줄 전체 칸 `:913`)는 쓰는 곳이 격자 칸으로 준다 |
  - 카드 — 1px `--line-control` · `--surface` · `--r-md`, 왼쪽 라디오 점(고유 치수 18 · `--bw-strong` 테 — 고르면 `--primary` 테 + 안 점)
  - 잠긴 카드도 `badges`를 그대로 그린다 — 투명도는 표지까지 카드 전체에 걸린다(옛 `.mode-card.dis` `:821`). 2차 카드는 `disabled` + `Tag tone="neutral"`("2차"), 자동 탐색 카드는 자동 탐색을 옮기기 전까지 `disabled` + `Tag tone="ok"`(추천)만 둔 같은 잠긴 모양이다 — 새 문구가 없다(사용자 결정)
  - 함께 내보내는 것(`@/ui`) — 타입 `RadioCardProps`
- **상태** hover는 테두리 `--primary-line`(`:261`). 고른 카드는 `aria-pressed="true"` — 테두리 `--primary` · 바탕 `--primary-bg` · `--ring-selected`(`:262`). disabled는 공통(`--opacity-disabled` · 커서 `not-allowed`)이고 hover 모양이 바뀌지 않는다(`:822` — 옛 .55는 DESIGN 이식 기간 허용 차이 값 정규화).
- **접근성** 카드는 `<button type="button" aria-pressed>`다 — 옛은 선택이 클래스뿐이었다(DESIGN 이식 기간 고침 — 모드 카드). Tab으로 카드마다 닿는다(옛과 같음). 라디오 점 · 아이콘은 장식이고 이름은 카드 글자 전체(제목 · 표지 · 설명)다. 잠긴 카드는 `disabled`라 Tab이 닿지 않는다(옛 `disabled aria-disabled` 그대로).
- **카탈로그** `RadioCard`

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
- **쓰는 곳** 무채색 · 상태 색의 작은 표지 — "추정" · "새 필드"(변환 스튜디오 `js/menu/studio.js:45,47`) · "2차"(원본 시스템 2차 카드 · 연결 방식 카드 `js/menu/sources.js:39,55`) · 추천 표식(연결 방식 카드 `:55`) · 탐색 네트워크 기록 결과 태그(`.ntag`), 그리고 도메인 표지 래퍼의 무채색 상태(프로토콜 배지의 샘플 · 모르는 값, 탐색 근거 없음)(이음 `.gs-tag` · `.p2` · `.rec` · `.ntag` · `.pr.sample` · `.evb.off` `css/console.css:269,522,526-527,997-1000,1044`).
- **쓰지 않는 곳** 자원 상태(점 + 글자) → `StatusChip` · 변환 규칙 → `RuleChip` · 프로토콜 → `ProtocolBadge` · 그 밖 이음 도메인 색 표지(읽기/쓰기 · 탐색 근거 · 메서드) → 그 표지 래퍼(그 메뉴를 옮길 때 만든다 — 도메인 색은 래퍼에서만, 래퍼의 무채색 상태는 이 부품으로).
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `tone` | `TagTone` — `ok` · `warn` · `danger` · `info` · `mute` · `neutral` | 필수 | 색의 뜻 — 아래 표. `StatusTone`(상태 넷 + `mute`)에 무채색 `neutral`을 더한 것이다 |
  | `variant` | `TagVariant` — `solid` · `dashed` · `off` | `solid` | 테두리 · 바탕 모양 — 아래 표 |
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
  - 높이는 테두리를 넣어 크기마다 같다(border-box). 옛 `.p2` · `.ntag.mute`(18 + 테두리) · `.evb.off`(20 + 테두리)는 2px 낮아진다 — `.pr.sample`은 옛도 테두리를 빼 22로 맞췄다(DESIGN 이식 기간 허용 차이 — 값 정규화)
  - 이음에 없는 조합(상태 색 + `dashed` · `off` 등)은 쓰지 않는다 — 카탈로그는 위 표의 자리만 보인다
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
- **Esc** — 문서의 keydown 하나가 열린 층 중 맨 위 층만 닫는다. 맨 위는 연 순서가 아니라 z 순서다 — 모달 종류가 드로어 위(DESIGN 쌓임)이고, 같은 종류면 나중에 연 것이다(이음 `js/main.js:55` — 모달이 보이면 모달만). 모달이 열린 채(가두지 않으므로) Tab으로 닿은 버튼이 드로어를 열어도 드로어는 모달 아래에 깔리고 Esc는 모달을 먼저, 한 번 더 누르면 드로어를 닫는다. 한글 조합 중 Esc는 무시한다. 맨 위 층이 `dismissible=false`면 아무것도 하지 않는다
- **포커스 복귀** — 열 때 포커스가 있던 요소를 기억했다가 닫을 때 돌려준다. 그 요소가 사라졌으면(알림이 사라짐 · 행 삭제 · 마법사 완료 뒤 이동) 대체 자리로 — ① 쓰는 곳의 `returnFocusFallback()`(없거나 null이면 다음) ② 지금 화면의 `PageHead` 제목(h2 `tabIndex=-1` — PageHead 절) ③ 셸 본문 `<main>`(`tabIndex=-1` — 셸 절). 이 대체 순서는 두 경우에 모두 탄다 — (a) 연 컨트롤이 사라졌을 때, (b) 열 때 층 밖에 포커스된 요소가 없었을 때(포커스가 `body`에 있었음 — 닫은 뒤에도 `body`에 남지 않게 한다). 셋 다 없으면 옮기지 않는다(하나라도 있으면 그곳으로 옮긴다 — 카탈로그의 `<main>`은 `tabIndex`가 없어 `focus()`가 아무것도 하지 않으므로 포커스가 그대로다). 닫는 순간 포커스가 층 안에 있거나 사라졌을 때만 옮긴다 — 층 밖으로 Tab해 간 포커스는 빼앗지 않는다. 열린 채 다른 대상을 열면(`contentKey` — Modal · Drawer) 기억할 요소를 다시 잡는다
- **닫힌 층의 내용** — `Modal` · `Drawer`는 `open=false`여도 `children`을 그린다(닫힌 `<dialog>`라 보이지 않고 포커스를 받지 않는다). 닫힘 전환 동안 보이는 내용은 쓰는 곳이 남겨 둔다 — 닫으며 `children`을 비우면 빈 층이 사라지는 모습이 보인다. 다시 열 때 새 상태(마법사 입력)는 쓰는 곳이 새 `key`로 만든다(옛 `closeDrawer`가 마법사 상태를 버렸다 — `js/common/overlay.js:12`)
- **요청 중 닫기** — `dismissible` 기본 true라 요청 중에도 ✕ · 취소 · Esc · 가림막으로 닫힌다(옛 그대로). 요청은 이어지고 결과 안내는 요청 쪽(훅)이 토스트로 한다(DESIGN 이식 기간 고침). 요청 중 잠그는 것은 확인 버튼(`Modal` `confirmDisabled`) · 발 버튼(`Button` `pending`)뿐이다 — 잠긴 동안 포커스는 그 버튼에 남는다
- **층 호스트** — 여러 화면이 여는 층(연결 마법사 · 재인증 · 원본 삭제 확인 · 키 결과 · 탐색 근거)은 앱 층의 층 호스트(`app/LayerHost`)가 드로어 한 칸 · 모달 한 칸으로 그린다(이음 `#drawer` · `#modal` 한 칸씩 — `index.html:43,45`). 이 부품들의 계약 — 칸마다 `Drawer` · `Modal` 하나를 늘 그려 두고 내용 · prop만 바꾼다 · 같은 칸에 다른 대상을 열면 `contentKey`를 바꾼다(재인증 A → 재인증 B, 재인증 → 원본 삭제 확인) · `onOpenChange(false)`에서 칸의 `open`만 끄고 내용은 다음 열기까지 남긴다 · 드로어 칸과 모달 칸은 함께 열릴 수 있고 모달이 위다(z · Esc 맨 위 층) · `closeAllLayers()`는 층마다 `onOpenChange(false)`를 부르므로 호스트 저장소가 닫힘을 받는다. 한 화면만 여는 층(호출 로그 상세)은 그 화면이 직접 그린다
- **메뉴 이동** — `closeAllLayers()`가 열린 층을 모두 닫는다(나중에 연 것부터, `dismissible`과 상관없이). 셸이 메뉴(`menuOf`)가 바뀔 때 부른다. 화면이 쥔 층은 화면이 사라지며 함께 닫힌다
- **열린 층** — `useOpenLayers()`가 `{ modal: boolean; drawer: boolean }`을 돌려준다 — 지금 열린 층 중 모달 · 드로어가 있는지(층이 열리고 닫힐 때 다시 그려지고, 요약이 그대로면 그리지 않는다). 화면이 층 때문에 멈추거나 숨길 때 읽는다 — 모달이 열린 동안 폴링을 멈추고(이음 `js/menu/deploy.js:133`), 드로어가 열리면 도크를 숨긴다(`css/console.css:225`). 층을 열고 닫는 값이 아니라 읽기 전용이다. 카탈로그 Modal 절의 "useOpenLayers" 줄이 이 값을 보인다
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
  - **드로어 마법사**(연결 마법사 — 단계 · 모드 · 검증 · 요청은 앱 층 `app/sources/SourceWizard`가 조립하고 이 문서에 절을 두지 않는다) — 이 부품이 맡는 것은 틀뿐이다: 머리(`overline` · `title` · `description`) · 본문 스크롤 · 발(`footerInfo` 단계 수 "n/4 단계" · `footer` 이전 `Button` + 다음 · 시작 `Button variant="primary"`). 본문은 맨 위 `StepIndicator variant="wizard"` 다음 단계 본문(`Field` · `Input` · `Textarea` · `FileDrop` · `RadioList` · `CardGrid` + `RadioCard` · `ProgressBar` · `ProgressList` · `Notice` · `FailureBlock`)이다. 단계 이동은 `scrollResetKey`(본문 맨 위)만 바꾸고 `contentKey`는 넘기지 않는다 — 옛 `renderWz`는 열린 드로어의 내용만 바꾸고 포커스를 옮기지 않았다(`js/menu/sources.js:110`). 탐색 모드(자동 탐색)도 같은 틀에 단계 본문만 바꾼다(`js/menu/discovery.js:80-88`)
  - 층 종류 `drawer` — `useOpenLayers().drawer`가 켜진다(도크 숨김 — 옛 `body.d-open` `css/console.css:225`)
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

## 레이아웃

### PageHead
- **쓰는 곳** 화면 맨 위 제목 + 설명 — 메뉴 화면 여섯(이음 `pageHead(id)` `js/common/state.js:21`, `css/console.css:109-111`). 빈 상태 화면(스튜디오 · 테스트 실행 · 배포)도 같은 머리를 쓴다(`js/menu/studio.js:120`).
- **쓰지 않는 곳** 탐색 작업 화면 머리(뒤로 링크 + 상태 칩 + 오른쪽 버튼 — `js/menu/discovery.js:251-258`) → 자동 탐색을 옮길 때 이 부품에 변형을 더한다 · 상자 제목 → `Box` · 상자 없는 절 제목 → `SectionTitle`.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `title` | ReactNode | 필수 | 제목(h2). 메뉴 화면은 `SCREEN_LABEL` |
  | `description` | ReactNode | 없음 | 설명 한 줄 — 메뉴 화면은 `copy/shell` `PAGE_DESCRIPTION` |
  | `className` | string | 없음 | 배치(바깥 여백)만 |
  - 제목과 설명은 글자 바닥선에 맞춰 한 줄에 놓이고 좁으면 설명이 아래로 접힌다. 아래에 1px `--line-divider`
  - 제목 h2는 `tabIndex=-1`과 표지 `data-page-title`을 가진다 — 층 포커스 복귀의 기본 대체 자리다(층 공통). Tab 순서에는 들지 않는다
- **상태** 없다(그릇).
- **접근성** 제목은 h2다 — 문서의 h1은 LNB 제목 하나다(`index.html:36`). 층을 닫았는데 연 컨트롤이 사라졌으면 포커스가 이 제목으로 온다(옛은 모달 닫은 뒤 포커스를 옮기지 않았다 — DESIGN 이식 기간 고침).
- **폭**
  - 760: 제목이 한 단계 작아진다(`--fs-title-sm` — `css/console.css:462`)
- **카탈로그** `PageHead`

### SectionTitle
- **쓰는 곳** 화면 본문 안 상자 없는 절 제목 + 작은 보조 — 원본 시스템 "2차 개발에서 지원할 연결 방식"(`js/menu/sources.js:38`) · 자동 탐색 작업(`js/menu/discovery.js:27`)(이음 `.sec-t` `css/console.css:607-608`).
- **쓰지 않는 곳** 화면 제목 → `PageHead` · 상자 머리 → `Box` · 상자 · 드로어 안 소절(`.sec2>h4` — 한 단계 작은 제목 · 오른쪽 동작, `:670-673`) → 변환 스튜디오를 옮길 때 이 절에 `level`을 더한다.
- **prop · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `title` | ReactNode | 필수 | 제목(h3) |
  | `description` | ReactNode | 없음 | 제목 곁 작은 보조 글(`--text-faint` — 옛 `small`) — 좁으면 아래로 접힌다 |
  | `className` | string | 없음 | 배치만 |
  - 위 `--s-8` · 아래 간격은 부품이 가진다 — 절 제목은 어느 화면에서나 같은 간격이다(옛 `.sec-t` margin)
  - 적힌 prop만 받는다
  - 함께 내보내는 것(`@/ui`) — 타입 `SectionTitleProps`
- **상태** 없다(그릇).
- **접근성** 제목은 h3다(화면 h2 아래 — 옛 `h3.sec-t`).
- **카탈로그** `SectionTitle`

### Box
- **쓰는 곳** 제목 줄이 있는 상자 — 대시보드 구조도 · 시간대 차트 · 확인 항목 · 많이 쓰인 도구(`js/menu/dashboard.js:20,42,47,57`), 스튜디오 · 배포 정책(`js/menu/studio.js:102` · `js/menu/deploy.js:90`), 테스트 실행 · 탐색 화면 상자(이음 `.box` · `.box-h` · `.box-b` `css/console.css:502-506`).
- **쓰지 않는 곳** 화면 제목 → `PageHead` · 상자 없는 절 제목 → `SectionTitle` · 수치 띠 → `StatStrip` · 목록 표(자기 윗선 · 테두리) → `Table` · 점선 빈 상자 · 대시보드 큰 빈 상자 → `EmptyState`.
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
  | `items` | `readonly KeyValueItem[]` — `{ label: ReactNode; value: ReactNode; mono?: boolean }` | 필수 | 칸 — 순서대로 3열로 채운다. `mono`는 값을 고정폭 작은 글자로(요청 ID — 옛 인라인 12.5px `js/menu/logs.js:43`) |
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

연결 흐름 · 변환 과정처럼 이음에만 있는 모양 중 두 화면 이상이 쓰거나 `@media` · 고유 치수(끄는 주석 px — DESIGN 핵심 규칙 1은 부품 CSS에만 허용)가 필요한 것이다 — 한 화면만 쓰고 둘 다 없는 조각(대시보드 시간대 차트 · 많이 쓰인 도구 · 확인 항목, 로그 상태 칩)은 그 화면 폴더에 둔다. 값 → 글자 · 색 찾기(상태 · 규칙 · 프로토콜)는 `copy/`와 앱 층이 하고, 이 부품들은 받은 글자와 색의 뜻만 그린다(원본 상태만 `copy/status`를 직접 읽는다). 앱 층이 `ui`를 조립한 층 내용(연결 마법사 · 인증 폼 · 재인증 · 원본 삭제 확인 — `app/sources/`)은 이 문서에 절을 두지 않는다 — 카탈로그가 앱 층을 가져오지 않게, 계약은 그 파일 머리 메모에 둔다.

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
