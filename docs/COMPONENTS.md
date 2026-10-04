# COMPONENTS — MCP-Studio

컴포넌트 계약 — 언제 쓰는지 · prop · 변형 · 크기 · 접근성. 규칙(언제 무엇을 쓰는지)은 `DESIGN.md`, 값의 원본은 `apps/web/src/styles/tokens.css`.
구현 기반 **Radix Primitives + CSS Modules**(`apps/web/src/ui`). 토큰은 CSS 변수 이름(`--fix-fg`)으로만 부른다. 안쪽 여백 · 글자 크기 같은 내부 치수는 각 `*.module.css`가 원본이다(여기 적는 수의 범위는 design-change 스킬 §2).

## 공통 계약

- 절 형식 — 컴포넌트 절은 아래 bullet을 이 순서로 쓴다. 해당 없는 bullet은 두지 않는다. prop이 많으면 `prop · 변형 · 크기` 아래에 표나 하위 bullet을 두고, `상태:` · `1024:`는 그 아래 마지막 하위 bullet이다(이 순서)
  - `- **언제** …` → `- **쓰지 않을 때** …` → `- **prop · 변형 · 크기** …` → `- **접근성** …` → `- **카탈로그** …`(`/_guide`의 절 이름). 언제 · 쓰지 않을 때 · 접근성은 문장이라 마침표로 끝내고, prop 줄 · 하위 bullet · 카탈로그는 마침표 없이 끝낸다
- prop 이름은 이 문서와 같고 루트 요소가 `data-variant` 같은 `data-*`를 낸다(CSS는 `.root[data-variant='primary']`). 같은 생각은 같은 이름이다 — `variant` = 모양 · `tone` = 색의 뜻 · `size` = 높이 단계 · `kind` = 판별 유니언(Modal `kind`는 크기 · 머리 모양 선택 — 판별 유니언이 아니다). 상태는 `:hover`(active = hover) · `disabled` 속성 + `[data-disabled]` · `[data-loading]` · `invalid` → `[data-invalid]`로 낸다
  - 예외 — 높이 단계가 없는 컴포넌트(CloseButton · Icon · ProgressBar)의 `size`는 그 절에 적은 값 · StatusChip `size`는 칩 크기 · `tier`는 상태 계층 · Button `variant`는 모양과 뜻을 묶는다(`danger`)
- 값 — 제어는 `value` + `onValueChange`, 비제어는 `defaultValue`. 둘 다 받는 것: Select · Tabs · SegmentedControl · Checkbox · Switch(Radix `checked` · `defaultChecked`). 제어만: 글 입력(TagInput `inputValue` · SectionSearch · SearchOverlay) · ToggleChip · 층(`open` + `onOpenChange`, Popover만 둘 다). 비제어만: InlineEdit(`defaultValue`)
- 이벤트 이름 — 누름 `on<대상>Click`(`onRowClick`) · 값 바뀜 `on<대상>Change`(`onValueChange` · `onOpenChange` · `onPressedChange`) · 고른 값 `selected<대상>`(`selectedKey`) · 그 밖 동작은 `on<동작>`(`onAdd` · `onRemove` · `onSave`)
  - 예외(지금 이름 그대로 — 새 컴포넌트는 규칙을 따른다) — `onFiles`(FileDrop) · `onAlerts`(LNBPanel) · `onResizeKey`(LNB), 자기 누름 `onClick`(RowCard · Notice `link` · NavItem · SearchOverlayItem)
- 기본값 `필수`는 반드시 주는 prop, `없음`은 생략 가능 · 기본값 없음이다. `note`는 주 내용 곁의 보조 문구 — 대개 한 줄(SectionHead · Tabs `rail` · 발 `note`)이고 Tooltip `note` · StepList `note`만 여러 줄 설명이다
- 적지 않은 HTML 속성 · `className` · `ref`는 루트 요소로 간다. 예외 — 적힌 prop만 받는 컴포넌트: Select · Tabs · SegmentedControl · FileDrop · Popover · Tooltip · RowMenu · 층(Modal · Dialog · FlowOverlay · SearchOverlay · AlertPanel) · 장식 InfoDot. `ref`가 루트가 아니거나 없으면 그 절에 적는다
- 접근성 공통 계약(포커스 링 · 키보드 · 비활성 사유 · 시각 숨김 · `role=status` · 층 포커스 · IME 조합)은 DESIGN `## 접근성`. 절마다 `접근성`에는 그 컴포넌트에만 있는 계약을 적는다
- `href` 항목(LNBPanel · SearchOverlayItem · Notice `link`)은 `<a>`라 SPA 이동은 호출자가 클릭을 가로챈다. 셸은 `screens/shell/useInterceptLinks` — 셸 내부 훅이라 화면은 가져오지 않고, 화면 안 이동은 라우터 `Link`(`Button variant="link" asChild`)

### 상태 7종
모든 인터랙티브 컴포넌트는 아래 상태를 낸다. 표와 컴포넌트 절에 없는 값은 바꾸지 않는다. 이 표와 다른 상태는 그 컴포넌트 절에 적는다. 컨테이너(Field · SettingRow · SectionHead · PageHeader · PageBody · ScreenState · StepList · FlowStepHead · MetricCard 등)는 스스로 상태가 없고 안의 컨트롤이 상태를 낸다.

| 상태 | 규칙 |
|---|---|
| default | 컴포넌트별 명세 |
| hover | 컴포넌트별 — 각 절의 표 · 줄(Button은 `variant` 표). 행 · 목록 항목은 `--surface-subtle`(RowCard · LNBPanel은 그 절) |
| focus-visible | `base.css` 전역 링 하나(DESIGN 핵심 규칙 12) |
| active | hover와 같다. 눌림 전용 색을 두지 않는다 |
| disabled | 글자 `--disabled` · 커서 `not-allowed`. 필은 각 컴포넌트 절. 사유는 DESIGN `권한` |
| loading | 라벨을 진행형으로 바꾼다 — 문구는 DESIGN Copy `진행형 라벨`, 표시 방식은 DESIGN `화면 상태 골격` |
| error | 테두리 `--fix-fg` + 아래 검증 문구 — 폼 칸은 `Field` `message`로만, 폼 칸 밖 한 줄은 `InlineMessage`로만 만든다 |

### 크기 — 컨트롤 높이 단계
단계 이름 · 높이 · 쓰는 곳은 DESIGN Layout `컨트롤 높이 단계`(토큰 `--h-*`). 컴포넌트별로 가진 단계와 기본값은 각 절 `size`(Button · IconButton · Input · Select · SegmentedControl)이고, 여기는 컴포넌트에 묶인 조합만 적는다.
- 행간은 DESIGN Typography · `리터럴 px 예외 주석`(행간 = 상자 높이)을 따른다. 예외 — Button `lg`(행간 `--h-md`) · EmptyState `filtered` 지우기 버튼(높이 − 테두리 2). 컴포넌트 고유 상자(CloseButton 22 · 24 · 26, Checkbox 16, Switch 40×22, CountDot 16, InfoDot 14)는 단계가 아니라 그 절의 고정 치수다. 컴포넌트 안에 든 버튼의 단계는 그 절에 적는다(CopyField · EmptyState `filtered` · ErrorBlock · InlineEdit)

## 기본

### Button
- **언제** 한 줄 액션 · 화면 이동 링크(`variant="link"`).
- **쓰지 않을 때** 글자 없는 도구 → IconButton · 층 ✕ → CloseButton · 행 액션 묶음 → RowMenu(DESIGN `목록과 표`).
- **prop · 변형 · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `variant` | `primary` · `secondary` · `danger` · `outline` · `quiet` · `link` | `secondary` | 뜻으로 고른다(아래 표) |
  | `size` | `sm` · `sm-plus` · `md` · `lg` | `md` | 높이 단계(조합은 아래 표) |
  | `textStyle` | `ui` · `label` | `ui` | `ui` = `--t-ui-strong` · `label` = `--t-label`(촘촘한 자리). 높이 · 행간은 `size`가 정한다 |
  | `loading` | boolean | false | `data-loading` · `aria-busy` · 클릭 막힘 · 커서 `progress`. 라벨은 호출자가 진행형으로 바꾼다(`확인 중…`) |
  | `disabled` | boolean | false | `data-disabled` · 커서 `not-allowed`. 잠긴 주 액션도 variant를 바꾸지 않는다 — `primary` + `disabled` + 보이는 사유(DESIGN `권한`) |
  | `type` · `form` | HTML 속성 | `button` · 없음 | 그대로 넘긴다. 폼 제출 버튼은 `type="submit"`(Modal `form` 제출) |
  | `asChild` | boolean | false | 자식(`<a>`)으로 렌더(Radix `Slot`). `disabled` · `loading`과 함께 쓰지 않는다 — 자식의 onClick은 막히지 않는다 |

  | `variant` | 필 · 글자 · 테두리 | hover | 비활성 | 쓰는 곳 |
  |---|---|---|---|---|
  | `primary` | `--ink` · `--on-ink` | 필 `--ink-soft` | 필 `--disabled-fill` · 글자 `--faint` | 주 액션 — 한 영역에 하나 |
  | `secondary` | `--surface-soft` · `--ink-soft` | 필 `--surface-track` | 글자 `--faint`(필 유지) | `닫기` · `취소` · 카드 안 `설정` |
  | `danger` | 투명 · `--fix-fg` · 1px `--fix-border` | 필 `--fix-bg` · 테두리 `--fix-border-strong` | 글자 `--disabled` | `나가기` · `연결 해제` · 표 행 `삭제`. 채우지 않는다 |
  | `outline` | 투명 · `--ink-soft` · 1px `--hairline` | 필 `--surface-soft` | 필 `--canvas` · 글자 `--faint` · 테두리 유지 | `이전` · `프로젝트로 돌아가기` · 진행 중 주 액션 |
  | `quiet` | 투명 · `--muted` | 글자 `--ink` | 글자 `--disabled` | `수정 취소` |
  | `link` | 글자 `--accent` · 높이 · 여백 없음 | 글자 `--accent-ink` | 글자 `--disabled` | 화면 이동 |

  허용 조합 — 이 밖은 쓰지 않는다(타입은 막지 않는다). 자리는 컴포넌트 슬롯이다.

  | `size` | `variant` | `textStyle` | 자리 |
  |---|---|---|---|
  | `sm` | `secondary` · `danger` | `ui` | Table 액션 열(`교체` · `삭제`) · InlineConfirm · ErrorBlock 복사 · PageHeader `actions` 층 열기(`secondary`) |
  | `sm` | `secondary` | `label` | 카드 안 액션 — RowCard `action`(`설정` · `열기`) · 흐름 바구니 카드(`수정`) |
  | `sm-plus` | `primary` · `secondary` | `label` | SectionHead `tools` 영역 머리 도구 — 추가(`+ 소스 추가`) · 기간 이동 · 실행 |
  | `md` | `primary` · `secondary` · `quiet` | `ui` | 기본. `quiet`은 `md`만(`수정 취소`) |
  | `md` | `danger` | `ui` | Dialog 확인(`삭제` · `연결 해제`) · 위험 작업 SettingRow `control`(Dialog를 연다) |
  | `lg` | `outline` · `danger` | `ui` | FlowOverlay `footer`(`이전` · `나가기` · `프로젝트로 돌아가기`) |
  | `lg` | `primary` | `ui` | FlowOverlay `footer` 주 액션 — 발의 마지막 버튼(`다음` · `N개 읽어오기`) |
  | `lg` | `primary` · `secondary` | `ui` | InlineEdit `저장` · `취소`(같은 줄 Input `lg`) |
  | `md` · `sm` | `link` | `ui` | 화면 이동 — `md`: PageHeader `back` · ScreenState `not-found` 돌아갈 곳 · 층 몸통 안 다른 화면 링크 / `sm`: PageHeader `actions` 하위 화면 링크 · AlertPanel `footer`. `size`가 생김새를 바꾸지 않는다 |
  - 아이콘을 붙이지 않는다. 화면 이동은 `link` — 예외는 EmptyState `action`(이동이어도 `md` `primary`)
  - 상태: default · hover · focus-visible · active(= hover) · disabled · loading. error 상태는 없다
  - 1024: 폭은 내용 폭 그대로(줄바꿈 없음)
- **카탈로그** `Button` · `Button sm-plus · label`

### IconButton
- **언제** 글자 없이 아이콘만 있는 도구(검색 · 사이드바 접기 · 화면 설정 톱니).
- **쓰지 않을 때** 글자가 있는 액션 → Button · 층 · 항목 ✕ → CloseButton · 행 메뉴 `⋯` → RowMenu.
- **prop · 변형 · 크기** `icon`(필수 — `IconName`, 아래 `아이콘`) · `title`(필수 — 툴팁 문구) · `disabled`(아이콘 `--disabled`). `variant` — `ghost`(기본: 투명 · 아이콘 `--icon` · hover `--surface-soft`) · `filled`(필 `--surface-soft` · `--ink-soft` · hover `--hairline-soft`). `size` — `sm`(기본) · `sm-plus`. 정사각 높이 단계
  - hover 바탕은 컴포넌트 지역 변수 icon-button-hover(기본 = 위 variant별 값)다. 바탕이 `--surface-soft`인 자리(LNB 레일 · LNBPanel)만 그 IconButton `className`에서 이 변수를 `--hairline-soft`로 준다 — 바깥 CSS가 IconButton의 `background`를 직접 덮지 않는다
- **접근성** `title`이 툴팁이자 접근 가능한 이름이다 — 빼지 않는다.
- **카탈로그** `IconButton` · `IconButton filled · sm-plus`

### Input · Textarea · Label
- **언제** 한 줄(Input) · 여러 줄(Textarea) 글 입력. 라벨(Label) · 검증 문구는 `Field`가 붙인다.
- **쓰지 않을 때** 정해진 목록에서 고르기 → Select · 같은 종류 값 여럿 → TagInput · 값 하나를 그 자리에서 고치기 → InlineEdit · 영역 머리 검색 → SectionSearch.
- **prop · 변형 · 크기**

  | 컴포넌트 | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|---|
  | Input | `size` | `sm-plus` · `lg` · `xl` · `2xl` | `xl` | 높이 단계. 컴포넌트에 묶인 단계 — SectionSearch `sm-plus` · InlineEdit `lg` |
  | Input | `textStyle` | `ui` · `heading` | `ui` | `heading` = `--t-h1` — 화면 제목 그 자리 편집(InlineEdit, `lg`와 쓴다) |
  | Input | `mono` | boolean | false | 식별자(기계 이름) 입력. 글꼴만 `--font-mono` — 크기 · 행간은 `size` · `textStyle`을 따른다 |
  | Input | `trailing` | ReactNode | 없음 | 입력 안 우측 장식 슬롯. prop을 주면(`null`이어도) 루트가 `<span>` 래퍼(`ref`는 input)가 되고 오른쪽 여백을 비워 둔다 — 표식이 생겨도 input이 재마운트되지 않는다 |
  | Textarea | `rows` | number | 2 | 크기 조절 없음(`resize: none`) |
  | 둘 다 | `invalid` · `readOnly` | boolean | false | `invalid` 테두리 `--fix-fg` · `readOnly` 편집 권한이 없을 때 — 바탕 `--surface-subtle` · 글자 `--ink-soft`(값은 읽히고 복사된다) |
  | Label | `requirement` | `required` · `optional` | 없음 | 라벨 옆 칩 `필수` · `선택` — 둘 다 `--surface-soft` · `--muted`(액센트를 쓰지 않는다) |
  | Label | `hint` | ReactNode | 없음 | 칩 뒤 `--t-caption` `--muted`. `undefined`일 때만 건너뛴다 — 빈 문자열은 빈 요소(gap)를 남긴다 |
  | Label | `htmlFor` · `as` | string · `label` \| `legend` | 없음 · `label` | `legend`는 Field `group`이 쓴다 |
  - 읽기 전용이 없는 컨트롤(Switch · Checkbox · ToggleChip · Select)은 권한이 없으면 `disabled`(DESIGN `폼` · `권한`)
  - Label은 글 · 칩 · 힌트를 한 줄에 두고, 폭이 모자라면 조각 단위로 다음 줄에 접는다(`flex-wrap` — 글자 중간에서 끊지 않는다)
- **카탈로그** `Input` · `Input sm-plus` · `Label hint` · `Input · Textarea readOnly`

### Field
- **언제** 폼 칸 하나 = `Label` + 컨트롤 하나 + 검증 문구. 폼(모달 `form` · 설정 탭 · 흐름 칸 grid)의 칸은 모두 Field로 만든다.
- **쓰지 않을 때** 영역 머리 검색 → SectionSearch · 표 행 안 컨트롤 · 라벨 없는 단독 컨트롤 → 컨트롤만.
- **prop · 변형 · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `label` | ReactNode | 필수 | Label 글(`group`이면 `legend`) |
  | `requirement` · `hint` | Label과 같다 | 없음 | Label 칩 · 힌트 |
  | `message` | ReactNode | 없음 | 검증 문구(`copy`의 `fieldMessage` 등) — `InlineMessage`로 그린다. `undefined` · `null` · `false`면 그리지 않고 `invalid`도 얹지 않는다. 있으면 루트 `data-invalid` |
  | `description` | ReactNode | 없음 | 칸 한 줄 설명(`--t-caption` `--muted`) — 컨트롤 아래 · 검증 문구 위. `undefined` · `null` · `false` · `''`면 그리지 않는다. 언제 쓰는지는 DESIGN `폼` |
  | `children` | 컨트롤 요소 하나 | 필수 | `id` · `aria-describedby` · `invalid`를 받는 요소 — Input · Textarea · Select · TagInput. `group`이면 ReactNode |
  | `group` | boolean | false | 묶음 칸 — 컨트롤이 여럿이거나 `id`를 받는 요소 하나가 아닌 칸(SegmentedControl · Checkbox 묶음). 루트 `fieldset`(테두리 · 여백 없음) + 라벨 `legend` · `data-group`. 자식은 칸 폭을 채운다(SegmentedControl 트랙은 제 절대로 내용 폭) |
  - 칸 안 간격은 모든 컨트롤이 같다(TagInput도 Field 안에 둔다). 루트 `data-part="field"` — 칸 최대 폭을 이 표식으로 건다: 설정 모달 내용 열은 `ModalPanel`이 걸고, 화면 안 폼은 칸 묶음 CSS에서 `> [data-part='field']`에 `max-width: var(--w-field)`를 건다. `className`은 루트에 합친다(grid `data-span` 등) · `ref`는 루트(`group`이면 fieldset)
  - **칸 grid 정렬** — 칸은 두 줄(라벨 · 컨트롤 + 설명 + 검증 문구)이다. 부모가 grid(흐름 2열 칸 grid)면 칸이 두 행을 subgrid로 차지해 같은 행 칸끼리 라벨 줄 높이를 나눈다 — 한쪽 라벨(힌트 포함)이 두 줄로 접히거나 한쪽에만 검증 문구가 있어도 컨트롤 윗변이 맞는다. 부모가 grid가 아니면 위에서 아래로 쌓인다. 칸 grid에는 Field만 둔다(칸이 아닌 것은 한 행만 차지해 자리 배치가 어긋난다). `group`은 legend가 subgrid 행이 될 수 없어 두 행 자리만 차지하고 안은 위에서 아래로 쌓는다
  - 상태: 컨트롤의 상태 + error(`message`)
  - 1024: 폭은 부모 몫 · 칸 grid에서 라벨이 접혀도 컨트롤 줄은 맞는다
- **접근성** 컨트롤에 `id`(있으면 그대로, 없으면 `useId`) · `aria-describedby`(컨트롤 값 + 설명 id + 검증 문구 id) · `invalid`(`message`가 있을 때)를 얹고 Label `htmlFor`를 그 id로 잇는다. `group`이면 얹지 않고 설명 · 검증 문구 `aria-describedby`를 fieldset에 건다.
- **카탈로그** `Field` · `Field group` · `Field + TagInput`

### InlineMessage
- **언제** 폼 칸 밖 검증 · 거절 한 줄(Field · InlineEdit · InlineConfirm의 검증 문구도 안에서 이것을 쓴다). 자리는 DESIGN `실패 블록 자리`.
- **쓰지 않을 때** 모르는 code의 실패 → ErrorBlock · 비활성 사유 → SectionHead `reason` · ReasonLine · 발 `note`(중립 `--muted`) · 안내 문단 → Notice.
- **prop · 변형 · 크기** `children`(한 줄 문장 — `copy`의 code 틀) · `id`(`aria-describedby` 대상). `<p>` · `--t-label` `--fix-fg` · 마진 0
  - 1024: 부모 폭에서 줄바꿈
- **접근성** `role="alert"`(덮을 수 없다). `id`는 호출자가 `useId()`로 만들어 그 입력 · 버튼 `aria-describedby`에 준다.
- **카탈로그** `InlineMessage`

### ReasonLine
- **언제** 잠긴(비활성) 액션 바로 아래 사유 한 줄 — 영역 머리 · 층 발이 아닌 자리의 액션(폼 안 묶음 버튼). 자리 고르기는 DESIGN `권한`.
- **쓰지 않을 때** 영역 머리 도구 → SectionHead `reason` · 층 발 액션 → Modal `footer.note` · FlowOverlay `note` · 검증 · 거절 → InlineMessage · 보일 자리가 없다 → VisuallyHidden.
- **prop · 변형 · 크기** `id`(필수 — 잠긴 컨트롤 `aria-describedby` 대상) · `children`(사유 — `copy`의 한 줄 사유) · `live`(기본 false — 입력에 따라 사유가 바뀌는 자리면 true, `aria-live="polite"`) · `reserve`(기본 false — 아래). `<p>` · `--t-caption` `--muted` · 마진 0 — SectionHead `reason`과 같은 글자. 위 간격은 부모가 준다(머리 줄 → 사유 `--s-1`)
  - 사유가 없으면(`undefined` · `null` · `false` · `''`) 자리를 차지하지 않는다(`reserve` 제외) — `live`가 아니면 그리지 않고, `live`면 요소를 시각 숨김으로 남긴다(`data-empty`)
  - `reserve` — 사유가 없어도 한 줄 높이(`1lh`)를 비워 둔다(`data-reserve`). 사유가 칸 입력에 따라 생기고 사라지는 자리(흐름 폼 머리)에서 아래 칸이 뛰지 않게 한다. `live`와 함께 쓰면 빈 영역도 그 자리에 남는다
  - 1024: 부모 폭에서 줄바꿈
- **접근성** `live` 영역은 사유가 없을 때도 남아 있어야 바뀐 사유가 읽힌다. 컨트롤 `aria-describedby`는 사유가 있을 때만 `id`를 건다.
- **카탈로그** `ReasonLine`

### InlineEdit
- **언제** 값 하나를 그 자리에서 고친다(화면 제목 · 설정 값 하나). 진입 · 결과 처리는 DESIGN `그 자리 편집`.
- **쓰지 않을 때** 여러 칸 폼 → Modal `form` · 되돌릴 수 없는 변경 → Dialog.
- **prop · 변형 · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `defaultValue` · `label` | string | 필수 | 시작 값 · 입력과 묶음의 접근 가능한 이름 |
  | `onSave` · `onCancel` | `(value) => void` · `() => void` | 필수 | Enter · 저장 = 앞뒤 공백을 뗀 값으로 `onSave`(처음 값과 같으면 `onCancel`) · Esc · 취소 = `onCancel`. 검증(빈 값 · 형식)은 호출자 — 실패면 `invalid` + `message` |
  | `saving` | boolean | false | 저장 `loading`(라벨 `저장 중…`) · 취소 비활성 · 입력 읽기 전용 · Enter · Esc 무시 · `data-saving` |
  | `invalid` · `message` | boolean · ReactNode | false · 없음 | 테두리 `--fix-fg` · 입력 아래 검증 문구(아는 code) |
  | `error` | ReactNode | 없음 | 칸으로 못 가는 실패(`ErrorBlock` 원문) — 검증 문구 아래. PageHeader `editor` 안이라도 h1 밖이다 |
  | `textStyle` | `ui` · `heading` | `ui` | `heading` = 화면 제목(Input `textStyle="heading"`) |
  | `labels` | `{ save, cancel, saving }` | `저장` · `취소` · `저장 중…` | 버튼 문구(DESIGN Copy `UI 공용 어휘`) |
  - 한 줄 = Input `lg`(남은 폭) + `저장` Button `lg` primary + `취소` Button `lg` secondary. 편집이 열릴 때만 렌더하고, 포커스를 잃어도 저장하지 않는다
  - 상태: default · focus-visible(입력 · 버튼) · disabled(저장 중 취소) · loading(저장) · error(`invalid` + 검증 문구)
  - 1024: 입력이 줄어든다(버튼은 내용 폭)
- **접근성** 묶음 `role="group"`(`aria-label` = `label`) · 열리면(마운트) 입력에 포커스 + 전체 선택 · 검증 문구는 입력 `aria-describedby`.
- **카탈로그** `InlineEdit` · `PageHeader back · 그 자리 편집`

### TagInput
- **언제** 같은 종류 값 여럿(이메일 · 태그)을 한 칸에서 받는다. 라벨 · 칸은 `Field`.
- **쓰지 않을 때** 정해진 목록에서 고르기 → Select · Checkbox 묶음.
- **prop · 변형 · 크기** `values`(필수 — `readonly string[]`) — 입력 아래 값 줄에 순서대로 `Tag onRemove`. 값이 키라 중복 없이 준다. `inputValue` · `onInputValueChange`(필수 — 적는 중인 글, 제어) · `onAdd` · `onRemove`(필수 — Enter · Tag ✕). 그 밖 Input 속성 · `className` · `ref`는 입력으로 간다(루트는 Fragment). `size`는 `xl` 고정(Field 안 높이 단계 — Input 기본과 같다)
  - Enter면 `preventDefault` 후 앞뒤 공백을 뗀 값으로 `onAdd`(빈 값이면 부르지 않는다). 호출자 `onKeyDown`이 먼저 불리고 `preventDefault`하면 더하지 않는다. 중복 거르기 · 형식 검증 · 입력 비우기는 호출자
  - 상태: default · focus-visible · error(`invalid` — 검증 문구는 호출자)
  - 1024: 값 줄이 줄바꿈된다
- **카탈로그** `TagInput` · `Field + TagInput`

### VisuallyHidden
- **언제** 보조기기에만 읽히는 글 — 복사 · 즉시 실행 결과 `role=status` 안내 · 보이는 자리가 없는 비활성 사유(`aria-describedby` 대상). 상자를 차지하지 않는다.
- **쓰지 않을 때** 사유를 보일 자리가 있으면 → SectionHead `reason` · ReasonLine · Modal `footer.note` · FlowOverlay `note`(DESIGN `권한`).
- **prop · 변형 · 크기** `span` 속성 · `ref`
- **카탈로그** `VisuallyHidden`

### Select
- **언제** 정해진 목록에서 하나 고르기 — 선택지가 5개 이상이거나, 늘 보일 필요가 없거나, 저장해야 적용되는 값.
- **쓰지 않을 때** 선택지 2–4개를 늘 보이고 고르는 즉시 적용 → SegmentedControl · 여러 개 고르기 → Checkbox 묶음(폼 값) · ToggleChip(필터) · 검색되는 목록(Combobox) → 아직 없다, 쓰는 화면이 생길 때 Popover로 만든다.
- **prop · 변형 · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `options` | `{ value, label, group? }[]` | 필수 | `group`이 있으면 항목 오른쪽에 그룹명. `value`는 비어 있으면 안 된다(Radix — `''`는 "선택 없음") |
  | `value` · `defaultValue` · `onValueChange` · `name` | string | 없음 | Radix Select 그대로(`name`은 폼 값 이름) |
  | `size` | `lg` · `sm` · `xl` | `lg` | 높이 단계. 트리거와 목록에 `data-size`. `sm`은 표 셀 안에서 셀 폭을 채운다 |
  | `placeholder` · `invalid` · `disabled` | string · boolean · boolean | 없음 · false · false | 자리표시 `--placeholder`(Input과 같다) · 테두리 `--fix-fg` · 글자 `--disabled` |
  | `id` · `aria-label` · `aria-describedby` | string | 없음 | 트리거에 붙는다(`Label htmlFor` · Field 연결) |
  | `container` | `HTMLElement \| null` | body | 층 밖에서만 — 목록 포털 위치(카탈로그 · 검수용). 층 안에서는 무시된다(`층`) |
  - 목록은 넘치면 스크롤(그림자 · z는 `층` 표). 선택 항목 `--accent-soft` + `--accent`, 강조 `--surface-subtle`. Radix `Select` · `ref`는 트리거
  - 1024: 열이 줄면 값이 말줄임
- **카탈로그** `Select` · `Select xl`

### Checkbox · Switch
- **언제** Checkbox — 표 선택 열 · 폼 값 여럿 고르기(Checkbox 묶음 `Field group`). Switch — 설정 한 줄의 켜고 끄기(SettingRow `control`).
- **쓰지 않을 때** 목록을 거르는 조건 → ToggleChip · 하나만 고르기 → SegmentedControl · Select. 설정 한 줄 켜고 끄기를 Checkbox로, 폼 값 고르기를 Switch로 만들지 않는다.
- **prop · 변형 · 크기** Radix 그대로 — `checked` · `defaultChecked` · `onCheckedChange` · `disabled` · `id`. 고정 치수 Checkbox 16×16 · Switch 40×22. 전환 `--m-fast`. 선택 · 켜짐은 `--ink` 필. Checkbox 테두리 `--disabled` · Switch 꺼짐 `--hairline`. 비활성 바탕 `--disabled-fill`(선택된 채 비활성이면 `--disabled`)
  - Checkbox `label`(ReactNode, 없음) — 상자 + 보이는 라벨 한 줄(Checkbox 묶음 항목 · 표 밖 단독 Checkbox). 라벨 `--t-ui` `--ink`, 비활성이면 `--disabled` · 루트 `<span>` 래퍼(`data-disabled`) — `className`은 래퍼, `ref` · 나머지 속성은 상자(Input `trailing`과 같다). 라벨 글을 누르면 상자가 바뀐다. 표 선택 열은 `label` 없이 `aria-label`(`Table`)
- **접근성** `label`이면 상자 `id`(없으면 `useId`)를 `<label htmlFor>`로 잇는다 — 화면이 `Label` · `<label>`을 따로 붙이지 않는다.
- **카탈로그** `Checkbox · Switch`

### ToggleChip
- **언제** 여러 개 고르는 필터 칩 — 목록을 거르는 조건.
- **쓰지 않을 때** 폼 값 여럿 → Checkbox 묶음 · 설정 한 줄 켜고 끄기 → SettingRow + Switch · 하나만 고르기 → SegmentedControl · 상태 표식 → StatusChip.
- **prop · 변형 · 크기** `pressed`(필수 — `aria-pressed` · `data-pressed`) · `onPressedChange`(필수 — 클릭하면 반대값) · `disabled`. 네이티브 `<button aria-pressed>`(Radix Toggle과 같은 계약). 눌림 `--ink` 필 · `--on-ink` · 테두리 `--ink` / 아님 `--canvas` · `--ink-soft` · 테두리 `--hairline`
  - 상태: default · hover(눌리지 않았을 때만 `--surface-subtle`) · focus-visible · disabled
- **카탈로그** `ToggleChip`

### Tabs
- **언제** 서로 다른 내용 패널 사이 전환(`line` — 패널은 `Tabs.Content`) · 설정 모달 세로 레일(`rail`).
- **쓰지 않을 때** 같은 내용의 보기 · 필터 · 범위 전환 → SegmentedControl.
- **prop · 변형 · 크기** `items`(필수 — `{ value, label, disabled?, reason?, note?, title? }[]`) — `title`이 있으면 그것을, 없고 잠긴 탭이면 `reason`을 `title`로 낸다. 잠긴 항목 글자 `--disabled`. `note`는 `rail`에서만 그린다(빈 문자열도 자리를 남긴다). `value` · `defaultValue` · `onValueChange`는 Radix Tabs 그대로
  - `variant` — `line`(기본: 활성 `--ink` + 아래 `--accent` 선 · 비활성 `--muted`) · `rail`(설정 모달 세로 레일 — `--surface-subtle` · 활성 `--accent` + `--canvas` 필). 내용은 자식 `<Tabs.Content value>`. `rail`이면 `Tabs.Content`가 설정 모달 **내용 열**(Modal `ModalPanel`과 같은 상자)이고 화면은 내용 열 CSS를 쓰지 않는다
- **접근성** `rail`은 `aria-orientation=vertical` · 트리거의 접근 가능한 이름은 `label`뿐(`aria-label`)이고 비어 있지 않은 `note`는 `aria-describedby`로 잇는다. 내용 패널(`Tabs.Content`)은 Tab으로 닿고 전역 포커스 링을 그린다 — `rail` 내용 열은 모달 가장자리에 잘리지 않게 링을 안쪽에 그린다(Modal `ModalPanel`).
- **카탈로그** `Tabs` · `Tabs rail`

### SegmentedControl
- **언제** 선택지 2–4개를 늘 보이고 고르는 즉시 적용하는 하나 고르기 — 같은 내용의 보기 · 필터 · 범위 전환. 항상 하나가 선택된다.
- **쓰지 않을 때** 선택지 5개 이상 · 늘 보일 필요가 없는 값 · 저장해야 적용되는 값 → Select · 여러 개 고르기 → ToggleChip(필터) · 폼 값 여럿 → Checkbox 묶음 · 서로 다른 내용 패널 전환 → Tabs.
- **prop · 변형 · 크기** `items`(필수 — `{ value, label }[]`) · `disabled`(묶음 전체) · `aria-label`(묶음 이름 — `Field group` 밖이면 필수)
  - `value` · `defaultValue` · `onValueChange` — `defaultValue`가 없으면 첫 항목. 같은 항목 재클릭은 무시한다(빈 값이 되지 않는다). `size` — `lg`(기본) · `sm-plus`(SectionHead `tools` · PageHeader 화면 필터). `data-size`. 트랙은 내용 폭(부모 폭으로 늘이지 않는다) · `--surface-track`. 선택 항목 `--canvas` 필 + `--accent`, 비선택 `--muted`. Radix `ToggleGroup`(single)
- **카탈로그** `SegmentedControl` · `SegmentedControl size`

### Tooltip
- **언제** 컨트롤 · 표식의 짧은 이름(`label`)이나 긴 설명(`note`)을 호버 · 포커스로 보인다.
- **쓰지 않을 때** 비활성 사유 · 꼭 읽어야 하는 정보 → 보이는 문장(DESIGN `권한`).
- **prop · 변형 · 크기** `content`(필수 — 문구는 호출자) · `container`(기본 body — 층 밖에서만, `층`) · `ref` 없음. `variant` — `label`(기본, 한 줄) · `note`(긴 설명 — 줄바꿈 · 왼쪽 정렬). `side`(기본 `top`) · `align`(기본 `center`) · `alignOffset`. `open` · `avoidCollisions`는 카탈로그 고정 표시 전용 — 앱 코드는 넘기지 않는다
  - `--ink` 필 · `--on-ink`(그림자는 `층` 표) · 열림 지연 300ms · 페이드 `--m-fade` · 화살표 없음. Radix `Tooltip` — `Tooltip.Provider`는 AppShell이 한 번 감싼다
- **카탈로그** `Tooltip` · `Tooltip note · InfoDot`

### FileDrop
- **언제** 파일 첨부 상자 — 끌어다 놓기 · 클릭 둘 다 같은 `onFiles`로 받는다.
- **쓰지 않을 때** 파일 목록 · 진행 표시 → 호출자가 상자 밖에 그린다.
- **prop · 변형 · 크기** `lines`(필수 — `[string, string]` 안내 두 줄 `--muted`) · `formats`(필수 — 둘째 줄 뒤 `--faint` 형식 목록 `PDF · DOCX · XLSX`) · `description`(필수 — 입력 `aria-describedby` 설명). `onFiles`(필수 — `(files: readonly File[]) => void`, 0개면 부르지 않는다) · `accept` · `multiple`(기본 false). 드롭은 `multiple`이 아니면 첫 파일만, `accept`(확장자 · MIME · `type/*`)에 안 맞는 파일은 버린다. 파일 내용은 읽지 않는다. `ref`는 입력
  - 1px dashed `--disabled` 상자 · `--surface-faint` · 그림(선 `--disabled` · 종이 `--canvas` · 원 `--illust` · 더하기 `--on-ink`). hover는 바탕 `--surface-subtle`(테두리 그대로) — 액센트를 쓰지 않는다. 끌어다 놓는 중 상태는 따로 없다. 기반 `<label>` + `<input type="file">`(Radix 없음)
  - 상태: default · hover · focus-visible(상자 링)뿐
  - 1024: 호출자 폭을 채운다
- **접근성** 입력은 시각 숨김(Tab으로 닿는다)이고 포커스 링은 상자가 그린다(DESIGN 핵심 규칙 12 예외). 이름은 보이는 두 줄이다.
- **카탈로그** `FileDrop`

## 표식

### StatusChip
- **언제** 자원의 상태 값 하나(DESIGN Copy 상태 값 목록).
- **쓰지 않을 때** 자원 종류 · 태그 → Tag · 알림 수 → CountDot · 흐름 단계 진행 · 알림 종류 → 중립 글자(DESIGN Copy).
- **prop · 변형 · 크기** `children`(필수 — 상태 값 문자열. 점 · 아이콘을 넣지 않는다). `tier`(필수) — `fix` `--fix-*` · `progress` `--progress-*` · `done` · `idle`. `done`은 `idle`과 같은 `--idle-*`로 그린다(이유는 DESIGN Status)
  - `surface` — `bg`(기본) · `soft`(표 · 카드 안, 바탕 `--*-soft`). `done` · `idle`의 `soft`는 테두리 `--idle-soft-border`(표 안 `미발행` 등). `size` — `md`(기본: 표 · 카드 · SectionHead `marker`) · `lg`(PageHeader `marker` · Modal `marker`만)
- **카탈로그** `StatusChip` · `StatusChip idle`

### CountDot
- **언제** 알림 수(종 위 카운트 점).
- **쓰지 않을 때** 상태 표식 → StatusChip · 안내 표식 → InfoDot.
- **prop · 변형 · 크기** `count`(필수 — 0 이하면 렌더하지 않는다 · 99 초과는 `99+`) · `tone`(`fix` 기본 — 바탕 `--fix-fg` · `progress` — 바탕 `--progress-fg`). 고정 치수 16(최소 폭 · 높이) pill · 글자 `--on-ink` mono. 위치는 호출자가 `style`로 준다(LNBPanel 종)
- **접근성** `aria-label="알림 N"`.
- **카탈로그** `CountDot`

### Tag
- **언제** 자원 종류 · 이름 붙은 값 · 화면 머리 읽기 전용 태그 · 편집형 태그(TagInput).
- **쓰지 않을 때** 상태 → StatusChip · 여러 개 고르기 → ToggleChip.
- **prop · 변형 · 크기** `variant` — `label`(기본: `--surface-soft` · `--muted`) · `project`(PageHeader `tags` 읽기 전용 태그 — 1px `--hairline-soft` · `--ink-soft`). 모두 중립색이다(DESIGN Status). `onRemove`(`() => void`) — 있으면 편집형 칩: ✕ 버튼이 붙고 `variant`는 무시된다
- **접근성** ✕는 `<button aria-label="{태그} 삭제">`.
- **카탈로그** `Tag` · `Tag project`

### InfoDot
- **언제** 안내 점 — Tooltip 트리거(`interactive`) · 장식 안내 표식.
- **쓰지 않을 때** 상태 표식 → StatusChip · 알림 수 → CountDot.
- **prop · 변형 · 크기** `glyph`(필수 — `!` · `i`) · `aria-label`(`interactive`면 필수 — 타입이 막는다). `interactive`(기본 false) — true면 `<button>`(hover `--ink` 테두리 · 글자), 아니면 장식 `<span>`으로 `className` · `title`만 받는다(장식이면 `ref` 없음). 고정 치수 14 · 1px `--disabled` · `--muted`
  - 상태: default · hover · focus-visible — `interactive`일 때만
- **접근성** `interactive`는 키보드로 닿는 버튼이고 `aria-label` 필수, 장식은 `aria-hidden`.
- **카탈로그** `Tooltip note · InfoDot`

## 데이터

### Table
- **언제** 한 자원의 같은 단위 값을 나란히 대는 목록(DESIGN `목록과 표`).
- **쓰지 않을 때** 타입마다 단위가 다른 목록 → RowCard · 키 · 값 목록 → KeyValue.
- **prop · 변형 · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `columns` | `readonly TableColumn[]`(아래) | 필수 | 열 정의 |
  | `rows` · `rowKey` | `readonly T[]` · `(row) => string` | 필수 | `rowKey`는 행마다 유일 |
  | `density` | `double` · `single` | `double` | 행 높이 `--h-row` · `--h-row-single`(구분선 1px 별도). 두 줄 행은 `double`, 한 줄 행은 `single` |
  | `headless` · `narrow` | boolean | false | 헤더 행 없음(목록) · 1024에 `priority: 'low'` 열을 DOM에서 뺀다 |
  | `selectedKey` · `onRowClick` | string · `(row) => void` | 없음 | `selectedKey`를 주면 선택 표(선택 행 `--accent-soft`). `onRowClick`이 있을 때만 행 클릭 = 상세 열기(hover `--surface-subtle`) |
  | `TableColumn.key` · `header` · `width` | string · ReactNode · string | 필수 | `width`는 grid 트랙(`minmax(0,1.4fr)` · `56px`) |
  | `TableColumn.priority` | `high` · `low` | 필수 | `high` = 행을 알아보는 데 필요한 열(이름 · 상태 · 액션) · `low` = 없어도 되는 메타 열(설명 · 날짜 · 보조 수). 시각이 행을 구분하는 기록 목록이면 시각 열 `high` |
  | `TableColumn.numeric` · `mono` | boolean | false | `numeric` = `tabular-nums` + 우측 정렬(mono 아님), 수(순위 · 호출 · 개수 · 지연)에만 — 날짜 · 시각 열에는 주지 않는다. `mono` = 식별자 · 기계 값 열(`--t-mono`). `numeric`이면 `cell` 필수(타입이 막는다) — 서식(`copy/format`)을 거친 글을 돌려준다 |
  | `TableColumn.minWidth` | string | 없음 | 동적 결과 표의 열 최소 폭(고정 px) |
  | `TableColumn.emptyReason` | string | 없음 | 값이 없을 때 셀 사유(`산출물 없음` · `발행 전` · `호출 없음`, `--muted`) — 기호로 비우지 않는다 |
  | `TableColumn.cell` | `(row) => ReactNode` | `row[key]`(`numeric`이면 필수) | 문자열 · 숫자(0 포함). 조작되는 내용(버튼 등)은 스스로 `stopPropagation()` |
  - 표는 `<table>`이 아니라 CSS grid 행이다(`div[role=table]` + `row` · `columnheader` · `cell`). 정렬 UI는 없다(DESIGN `목록과 표`). **열 폭** — 글 열은 `minmax(0,Nfr)`(줄면 말줄임 — 글 셀은 `title`에 전체 값). 고정 px는 칩 · 버튼 · 날짜 · 숫자 · 선택 · 셀 안 Select 열에만. 컨트롤 셀(`<button>` · 입력이 든 셀 — Checkbox · Switch · RowMenu · Button · Select)은 자르지 않는다(포커스 링이 셀 밖으로 나온다) — 그래서 고정 px 열에 둔다
  - **액션 열** — Button `sm` 하나 또는 `RowMenu` 하나(고르는 기준은 DESIGN `목록과 표`). 액션이 없는 행은 셀을 비워 둔다(`cell`이 `null` — 사유 · 비활성 버튼을 채우지 않는다). 액션 열을 두지 않아도 된다
  - **선택 열** — 맨 앞 Checkbox 열 하나 · 폭 `16px` · `high`. 헤더는 전체 선택 Checkbox 또는 비운다. 행 Checkbox는 `onClick`에서 `stopPropagation()`. 고를 수 없는 행은 `disabled` + 사유를 이름 셀 `TableCellLines` `sub`(`<span id>`)에 적는다. 선택 수 · 일괄 액션은 SectionHead `count` · `tools`. **셀 안 Select 열** — Select `sm`. 열 폭은 고정 px = 가장 긴 옵션 라벨 폭(`--t-ui`) + 36(트리거 좌우 안쪽 · gap · chevron · 테두리), 4의 배수로 올린다
  - **동적 결과 표**(열이 데이터로 정해지는 표) — 열마다 `minWidth` + 모든 열 `high`. 트랙은 `minmax(minWidth, <width의 최대값>)`(`width`가 `minmax(0,1fr)`이면 `1fr`). 최소 폭 합이 표 폭보다 크면 자기 상자 안에서 가로 스크롤한다(헤더 함께 · `data-scroll-x`). `narrow`로 열을 빼지 않는다
  - **두 줄 셀** — `TableCellLines`(`main` · `sub` 둘 다 필수 · 줄마다 말줄임)를 `cell`에서 돌려준다. `density="double"`에만: `cell: (r) => <TableCellLines main={r.name} sub={r.source} />`
- **접근성** 헤더가 없으면 `aria-label` 필수 · `selectedKey`를 줄 때만 행 `aria-selected`(행 클릭만 있는 표는 선택 표가 아니다) · 행 Checkbox `aria-label` = 행 이름, 헤더는 `전체 선택` · 고를 수 없는 행의 사유 `id`는 Checkbox `aria-describedby`.
- **카탈로그** `Table` · `Table 두 줄 셀` · `RowMenu · 선택 열` · `Table 동적 열`

### RowCard
- **언제** 타입마다 단위가 다른 목록의 행 — 이름 · 타입 · 상태 · 산출물 한 줄 · 액션. 테두리 카드이고 구분선 행이 아니다. 기계 이름 줄은 없다.
- **쓰지 않을 때** 같은 단위 값을 나란히(상세 열 안 목록 포함) → Table. RowCard의 같은 단위 목록은 작업 + 보조 열의 보조 열만(DESIGN `목록과 표`).
- **prop · 변형 · 크기** `title`(필수 — 말줄임) · `status`(필수 — `<StatusChip surface="soft">`) · `summary`(필수 — 둘째 줄 산출물 한 줄). `type`(`{ label }`) — 타입 칩(중립색 — DESIGN Status). `action` — 우측 끝 Button `sm` `textStyle="label"`. 누름 버튼의 형제라 누름이 카드로 번지지 않는다
  - `onClick`(있으면 제목이 누름 버튼 · 누름 자리는 카드 전체 · hover `--hairline` 테두리 + `--surface-faint`) · `selected`(기본 false · `data-selected` — `--accent-soft` + `--accent-line`)
- **접근성** `onClick`이 있으면 제목이 `<button>`이고 카드 이름 = 제목이다. 카드 루트는 역할이 없다 — 누름 자리만 카드 전체로 넓히고(`::after`), `action`은 그 위에 놓인 형제라 컨트롤이 컨트롤 안에 들지 않는다. 포커스 링은 제목 버튼에 보인다. 상태 칩 · 산출물 줄은 버튼 밖 글이다. `selected`는 시각 표시만이다.
- **카탈로그** `RowCard`

### SummaryCard
- **언제** 대시보드형 요약 밴드 — 여러 자원의 집계 수치를 한 줄 카드로(`SummaryBand` 안 `SummaryCard`, 카드 아래 SegmentBar).
- **쓰지 않을 때** 한 자원의 지표 카드(목표 표시 · 가중치 막대 · 범례) → MetricCard · 표 → Table.
- **prop · 변형 · 크기** SummaryBand `narrow`(기본 false) — 2열 줄바꿈 · `data-narrow`. 자식은 SummaryCard, 카드 높이는 밴드가 맞춘다. SummaryCard `title` · `value`(필수 — 값 서식은 호출자) · `children`(아래 SegmentBar)
  - `valueTone` — `ink`(기본) · `fix`(할 일이 있다 — 쓰는 조건은 DESIGN Status) · `faint`(0). 값에 `data-tone`. `delta` — 값 아래 증감 한 줄(`copy/format` `deltaLabel`). **색 · 화살표를 쓰지 않는다**. `undefined` · `null`이면 그리지 않는다. 밴드는 1px `--hairline` 상자 4열(카드 사이 1px), 카드에는 테두리가 없다
  - 1024: 화면은 앱 스토어 `narrow`를 SummaryBand `narrow`로 넘긴다
- **접근성** 밴드 이름은 호출자 몫이다 — SummaryBand에 `role="group"` + `aria-label`(밴드 제목)을 준다.
- **카탈로그** `SummaryCard` · `SummaryCard delta`

### MetricCard
- **언제** 상세형 요약 밴드의 카드 하나 = 한 자원의 지표 하나(라벨 · 큰 값 + 단위 · 꼬리 · 가중치 막대 + 목표 표시 · 우측 범례). 밴드 상자는 컴포넌트가 아니라 화면 grid다(`screens/project/MetricBand.tsx`) — 두 번째 화면이 쓰면 `ui/MetricBand`로 올린다(design-change).
- **쓰지 않을 때** 여러 자원의 집계 → SummaryCard · 표 → Table.
- **prop · 변형 · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `label` · `value` | string | 필수 | 값 서식은 호출자(`1,284`). 값이 없으면 사유 문구(`집계 전`, `valueTone="faint"`) |
  | `unit` · `tail` | string | 없음 | 단위는 값 바로 뒤(`ms`) · 꼬리는 공백 뒤(`/ 3` · `시간 전`) |
  | `valueTone` | `ink` · `progress` · `fix` · `faint` | `ink` | 값에 `data-tone` |
  | `segments` | `{ weight: number; tone }[]` | 필수 | 비지 않아야 한다. `flex: weight` — 0 구간은 호출자가 작은 가중치(0.001)로 준다 |
  | `mark` | `{ left: string }` | 없음 | 목표 표시(`'71%'`) — `--fix-fg` |
  | `legend` | `{ label; value: string; tone; swatch?: 'square' \| 'line' }[]` | `[]` | 값은 서식 마친 문자열. 비어도 자리는 남는다 |
  - 막대 · 범례 `tone` — `ink` · `ink-soft` · `faint` · `progress` · `fix` · `empty`(`--data-empty`, 빈 구간). 이름이 같으면 SegmentBar `tone`과 같은 색이다. 조합 규칙은 DESIGN Data. 테두리 카드(1px `--hairline-soft`)
  - 1024: 범례는 줄바꿈된다. 밴드 grid는 지금 4열 그대로다
- **접근성** 막대는 장식(`aria-hidden`)이고 값 · 범례 글이 같은 정보를 준다. 밴드 이름은 호출자 몫이다 — 밴드 grid에 `role="group"` + `aria-label`을 준다.
- **카탈로그** `MetricCard`

### CopyField
- **언제** 연결 정보 · 복사할 수 있는 기계값 한 줄 — 라벨 · 값(mono, 한 줄 말줄임 · `title`에 원문) · 복사.
- **쓰지 않을 때** 복사할 일이 없는 설정 · 상세 값 목록 → KeyValue · 표 → Table · 입력 칸 사이 → Field(한 번만 보이는 값의 `form` 결과 단계에는 쓴다 — DESIGN `층 선택`).
- **prop · 변형 · 크기** `label` · `value`(필수) — 라벨 열 폭 92(레이아웃 고정폭 — 여러 행의 값 열이 나란해진다). `onCopy`(`CopyHandler` — `false` · 거부 = 실패) — 없으면 복사 버튼 · 결과 안내가 없다(읽기 전용). `copiedMs` — `복사됨` 유지 시간(기본값 · `복사 안 됨` 2초 고정은 `공용 훅` `useCopyState`). `null`이면 다음 누름 · 언마운트까지 유지되므로 호출자가 대상마다 `key`로 새로 만든다
  - `copyLabel` · `copiedLabel` · `failedLabel`(기본 `복사` · `복사됨` · `복사 안 됨`). 복사 버튼은 높이 단계 `sm-plus` — Button이 아니라 컴포넌트 안 `<button>`. 결과 표시는 DESIGN `복사 결과`(`useCopyState`) · 버튼 `data-copy-state`(`idle` · `copied` · `failed`)
  - 상태: default · hover · focus-visible — 복사 버튼에만
  - 1024: 값 열이 줄고 말줄임
- **접근성** 복사 버튼 이름 `{라벨} {버튼 문구}` · 결과 안내 `{라벨} 복사됨` · `{라벨} 복사 안 됨`.
- **카탈로그** `CopyField` · `KeyValue plain · CopyField 읽기 전용`

### SegmentBar
- **언제** 구성 비율 막대 + 범례(SummaryCard 안).
- **쓰지 않을 때** 진행률 하나 → ProgressBar · 목표가 있는 지표 카드 → MetricCard.
- **prop · 변형 · 크기** `segments`(필수 — `{ label; value: number; tone }[]`) — 폭 = `round(value/total×100)%`(0%도 렌더). 수는 `String(value)`(천 단위 구분 없음). `total`(기본 합계 — 0이면 모든 구간 0%) · `legend`(기본 true — 범례 2열) · `aria-label`. `tone` — `ink-soft` · `muted` · `faint` · `progress` · `fix` · `empty`(`--data-empty`). 이름이 같으면 MetricCard `tone`과 같은 색이다. 조합 규칙은 DESIGN Data
- **접근성** `aria-label`이 있을 때만 막대가 `role="img"` + 그 문구다. 없으면 범례가 텍스트를 준다.
- **카탈로그** `SegmentBar`

### KeyValue
- **언제** 설정 · 상세 값 목록(키 · 값 · 행 액션).
- **쓰지 않을 때** 편집 폼 → Field(읽기 전용 보기를 따로 만들지 않는다 — DESIGN `폼`) · 같은 단위 목록 → Table · 연결 정보 · 복사할 수 있는 기계값 → CopyField.
- **prop · 변형 · 크기** `items`(필수 — `{ key; id?; value: ReactNode; mono?; action?; truncate? }[]`) — `key` = 키 글(`dt`). React key는 `id ?? key`(키 글이 겹칠 수 있으면 `id`). 항목 `mono`는 값 mono · `action`은 행 우측 액션(`data-action`) · `truncate`는 아래. `variant` — `box`(기본: 1px `--hairline` 상자 · 행 `--h-row` · 키 열 150) · `plain`(설정 모달 상태 영역: 상자 · 구분선 없음 · 키 열 96)
  - **`truncate`** — 긴 값(주소 · 경로 · 연결 문자열)을 값 열 폭 안에서 한 줄 말줄임(`action`은 오른쪽에 남는다). 없으면 마크업을 바꾸지 않는다. 값이 문자열이면 원문을 `title`로 준다(노드면 호출자가 원문을 따로 보인다). 마크업은 `<dl>` > `<div>` > `<dt>` + `<dd>`. 마스킹 값(`••••••••`)의 `--faint` 색은 호출자가 값 노드에 준다
  - 1024: 값 열이 줄수록 `truncate` 값이 더 잘린다 — 줄바꿈이 필요하면 `truncate`를 주지 않는다
- **카탈로그** `KeyValue` · `KeyValue plain · CopyField 읽기 전용`

### SettingRow
- **언제** 설정 한 줄 — 왼쪽 제목(+ 설명) · 오른쪽 컨트롤 하나: 켜고 끄기(Switch) · 되돌릴 수 있는 삭제성 변경 입구(Button `md` → 바로 아래 InlineConfirm) · 위험 작업 입구(Button `md` `danger` → Dialog).
- **쓰지 않을 때** 값 목록 → KeyValue · 폼 칸 → Field · 표 행 → Table.
- **prop · 변형 · 크기** `title`(필수) · `control`(필수 — Switch · Button `md`) · `description`(설명 한 줄) · `descriptionId`(설명 줄 `id` — 컨트롤 `aria-describedby`로 잇는다). 변형이 없다 — 위험 작업 입구(되돌릴 수 없는 작업)는 컨트롤을 Button `md` `danger`로 두는 것으로 나타내고, 줄의 상자 · 글자 색은 바꾸지 않는다. 앞에 형제가 있으면 위에 1px `--hairline-soft` 구분선. 권한이 없으면 컨트롤 `disabled`(사유 자리는 DESIGN `권한`)
  - 1024: 왼쪽 열이 줄고 컨트롤은 줄지 않는다
- **카탈로그** `SettingRow`

### ProgressBar
- **언제** 가는 진행 막대(전체 · 항목 진행률).
- **쓰지 않을 때** 구성 비율 → SegmentBar.
- **prop · 변형 · 크기** `value`(필수 — 0–100으로 자르고 반올림) · `size`(`md` 기본 높이 4 — 전체 · `sm` 3 — 항목) · `aria-label`(필수). 바탕 `--data-empty` · 채움 `--ink` · pill
- **접근성** `role="progressbar"` · `aria-valuemin 0` · `aria-valuemax 100` · `aria-valuenow` · `aria-label` 필수.
- **카탈로그** `ProgressBar`

## 상태 표현

### EmptyState
- **언제** 빈 상태 세 종 — 잠김 안내도 `not-created`(`action` 없음)다. 어느 kind를 쓰는지 · 머리 버튼과 겹치지 않기는 DESIGN `빈 상태`.
- **쓰지 않을 때** 불러오지 못함 → ScreenState `failed`(화면 · 영역) · 데이터 전 → ScreenState `loading` · 값 하나가 없음 → 사유 문구.
- **prop · 변형 · 크기**

  | `kind` | 생김새 | prop |
  |---|---|---|
  | `not-created` | 1px dashed `--hairline` 상자 · `--surface-faint` · 제목 · 본문(최대 38ch) · 주 액션 · 힌트 | `title` `body` `action?` `hint?` — `action`은 Button `md` `primary`(화면 이동이어도 `link`가 아니다). 없으면 액션 자리를 그리지 않는다 |
  | `nothing-yet` | 상자 없음 · 제목 · 본문(최대 36ch) | `title` `body` |
  | `filtered` | 한 줄(`copy/list` `noMatchLabel` — `조건에 맞는 소스가 없다 · 3건 가운데 0건`) + 지우기 버튼 | `body` `onClear` `clearLabel?`(기본 `검색 · 필터 지우기`) |
  - 판별 유니언이라 kind별 prop만 받는다 · 루트 `data-kind`. `filtered` 지우기 버튼은 높이 단계 `sm-plus`(영역 머리 도구와 같은 단계) — Button이 아니라 컴포넌트 안 `<button>`
- **접근성** 루트 `role="status"`(호출자가 덮을 수 없다).
- **카탈로그** `EmptyState`

### ErrorBlock
- **언제** 실패 원문 그대로 + 복사. 자리는 DESIGN `실패 블록 자리`.
- **쓰지 않을 때** 아는 code의 검증 · 거절 → Field `message` · InlineMessage.
- **prop · 변형 · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `raw` | string | 필수 | 원문. 파싱 · 색 입히기를 하지 않는다. `\n`으로 나눈 논리 줄마다 블록(빈 줄도 한 줄 높이) · 접힌 줄은 내어쓰기 |
  | `onCopy` | `CopyHandler` | 필수 | 타입이 막는다. `() => void \| boolean \| Promise<void \| boolean>` — `false` · 거부 = 실패, 그 밖 = 성공. `onCopy={() => platform.copyText(raw)}`처럼 결과를 그대로 돌려준다 |
  | `meta` | ReactNode | 없음 | 머리 줄 문장(타임스탬프 · 드라이버 · 시도 횟수 — 호출자 서식) |
  | `maxHeight` · `labels` | number · `{ copy, copied, failed }` | 372 · `복사` · `복사됨` · `복사 안 됨` | 넘으면 스크롤 · 복사 버튼 문구 |
  - 머리 줄은 늘 있다 — 우측 정렬 `meta` + 복사 Button `sm`(결과는 DESIGN `복사 결과` · `useCopyState` · `data-copy-state`). `<pre>` 표면(`--field` · `--t-mono`)은 LogView와 공용(`LogView/LogSurface`, `ui` 밖으로 내보내지 않는다)
- **카탈로그** `ErrorBlock`

### LogView
- **언제** 실행 · 진행 로그 줄(기계값).
- **쓰지 않을 때** 실패 원문 하나 → ErrorBlock.
- **prop · 변형 · 크기** `lines`(필수 — `readonly string[]`) — 줄마다 블록(빈 문자열 줄도 한 줄 높이). 배열은 바꾸지 않는다. `variant` — `surface`(기본: ErrorBlock과 같은 `<pre>` 표면 · 줄마다 내어쓰기) · `soft`(설정 모달 · 흐름: `--surface-subtle` · 공백 접힘 · 내어쓰기 없음)
  - `maxHeight` · `minHeight`(인라인 style) — 생략하면 높이 제한 없음. `minHeight`는 진행 로그 최소 높이. `follow`(기본 true) — **바닥에 있을 때만** 새 줄을 따라간다. 사용자가 위로 올렸으면 그대로 둔다. `ref`는 `<pre>`(`맨 아래로` 버튼이 `scrollTop`을 옮길 때) · `onScroll`은 그대로 전달된다. 바닥 판정(`follow.ts`)은 내부 구현이라 내보내지 않는다
  - 머리 줄(제목 · 메타 · 복사 · `맨 아래로`)은 화면이 만든다 — `SectionHead` 도구에 복사 Button(`sm-plus` `textStyle="label"`) + `useCopyState(() => platform.copyText(lines.join('\n')))`
- **카탈로그** `LogView` · `LogView soft`

### InlineConfirm
- **언제** 되돌릴 수 있는 삭제성 변경의 그 자리 확인 줄 — 목록 카드 · 표 · 설정 줄(`SettingRow`) 바로 아래. 위치 · 문장은 DESIGN `표 행 확인 줄`.
- **쓰지 않을 때** 되돌릴 수 없는 변경 → Dialog.
- **prop · 변형 · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `message` · `confirmLabel` · `cancelLabel` | ReactNode · string · string | 필수 | 문구는 호출자. `cancelLabel`은 `취소` — 확인 라벨에 `취소`가 들어가면(`초대 취소`) `닫기` |
  | `onConfirm` · `onCancel` | `() => void` | 필수 | Esc → `onCancel`. 호출자 `onKeyDown`이 먼저 불린다 |
  | `rejection` | ReactNode | 없음 | 아는 code로 거부된 한 줄(`copy/errors` 틀) — 줄 안 아래 `InlineMessage`(폭 전체) · 루트 `data-rejected`. 모르는 code는 호출자(DESIGN `실패 블록 자리`) |
  | `busy` | boolean | false | 확인 `loading`(라벨은 호출자가 진행형으로) · 취소 disabled · Esc 무시 · 루트 `data-busy` |
  | `focusOnMount` | boolean | true | 열릴 때(마운트 때만) 확인 버튼으로 포커스. 확인 줄이 열리는 순간에만 렌더한다 |
  - 한 줄 = 문장 + 확인 Button `sm` `danger` + 취소 Button `sm` `secondary` · 바탕 `--fix-soft` · 1px `--fix-border`
- **접근성** `message`가 문자열이면 `role="group"`의 `aria-label` · `rejection`은 확인 버튼 `aria-describedby`.
- **카탈로그** `InlineConfirm` · `InlineConfirm rejection`

### Notice
- **언제** 알림 카드(AlertPanel 목록) · 화면 · 층 안 안내 문단(상태 · 다음 할 일).
- **쓰지 않을 때** 검증 · 거절 한 줄 → InlineMessage · 잘림 같은 수치 안내 → SectionHead `note`.
- **prop · 변형 · 크기** `tone`(필수 — 아래 표, 고르는 기준은 DESIGN Status `알림 카드 tone`) · `title` · `body`(둘 중 하나는 필수 — 타입이 `null` · `undefined` · boolean을 막고, 둘 다 빈 문자열이면 그리지 않고 개발 빌드에서 경고. 한 문장 안내는 `body`만, 제목을 억지로 떼어 내지 않는다)
  - `link`(`{ label; href?; onClick? }` 우측 끝 링크 — `href`면 `<a>`, 아니면 `<button>`) · `live`(기본 false — true면 루트가 live 영역. 지금 쓰는 곳 없음 — 결과 알림은 VisuallyHidden `role=status`, 카드 목록은 AlertPanel)

  | `tone` | 왼쪽 선 | 바탕 | 제목 · 본문 · 링크 |
  |---|---|---|---|
  | `risk` | `--fix-fg` | `--fix-soft` | `--fix-fg` · `--fix-body` · `--fix-fg` |
  | `warn` | `--progress-fg` | `--progress-soft` | `--progress-fg` · `--progress-body` · `--progress-fg` |
  | `going` | `--progress-fg` | `--canvas` | `--ink` · `--muted` · `--accent` |
  | `info` | `--faint` | `--canvas` | `--ink` · `--muted` · `--accent` |
  | `done` | `--hairline` | `--canvas` | `--ink-soft` · `--muted` · `--accent` |
  - Notice는 구분선을 긋지 않는다 — 카드 사이 선은 목록 상자(AlertPanel)가 긋고, 홀로 놓인 Notice(폼 · 층 안)에는 선이 없다. 문구(제목 · 본문 · 링크 `… →`)는 `code`별 틀에서 호출자가 만든다(`src/copy`). 사용자가 닫지 못한다
- **접근성** `live`면 루트 `role="status"`(호출자가 `role`로 덮을 수 없다).
- **카탈로그** `Notice`

### ScreenState
- **언제** 데이터를 받기 전 · 받지 못했을 때의 골격(화면 · 층 · 영역). 쓰는 곳 · 쿼리 묶기는 DESIGN `화면 상태 골격`.
- **쓰지 않을 때** 빈 목록 → EmptyState · 즉시 실행 결과의 실패(`다시 시도` 없음) → ErrorBlock.
- **prop · 변형 · 크기**

  | `kind` | 그리는 것 | prop |
  |---|---|---|
  | `loading` | 진행형 한 줄(DESIGN `화면 상태 골격`). `inline`이면 영역 안 한 줄(쌓기 · 간격 없음 · `data-inline`) | `label` `inline?` |
  | `failed` | `ErrorBlock`(원문 + 머리 줄 복사 · `meta`) + `다시 시도` Button `md` secondary | `raw` `onRetry` `retryLabel` `onCopy`(필수 — `() => platform.copyText(raw)`) `meta?` |
  | `not-found` | 한 줄(`찾을 수 없음`) + 돌아갈 곳(호출자 노드 — `Button variant="link" asChild` + 라우터 링크) | `message` `action` |
  - 세로 쌓기 · 왼쪽 정렬. 여백은 감싸는 자리(PageBody · 영역 · 층 내용 열)가 준다. 판별 유니언 · 루트 `data-kind`
  - 1024: 그대로(ErrorBlock은 내용 폭, 넘치면 줄바꿈)
- **접근성** `loading`은 루트 `aria-busy` + `role="status"`.
- **카탈로그** `ScreenState`

## 층

어느 층을 쓰는지는 DESIGN `층 선택`, 그림자 · z 순서의 뜻은 DESIGN Elevation. 컴포넌트별 그림자 · z는 아래 표가 원본이다.

| 컴포넌트 | 고정 치수 | 그림자 | scrim | z | Radix |
|---|---|---|---|---|---|
| `Modal` | `settings` 820×552 · `form` 폭 520 · `info` 폭 560(`form` · `info` 높이 auto) | `--shadow-modal` | `--scrim` | `--z-modal` | Dialog |
| `Dialog`(확인) | 폭 520 content-box(바깥 568) | `--shadow-modal` | `--scrim` | `--z-modal` | AlertDialog |
| `FlowOverlay`(전체 덮기) | 앱 프레임 전체(LNB 포함) · 머리 · 발 높이 56 | 없음 | 없음(`--canvas`로 덮는다) | `--z-modal` | Dialog |
| `SearchOverlay` | 폭 460 · 최대 높이 540 · 위 104 | `--shadow-modal` | `--scrim-light` | `--z-search` | Dialog |
| `AlertPanel` | 폭 424 · 목록 최대 높이 396 · 프레임 기준 left · bottom | `--shadow-panel` | 투명 | `--z-alert-scrim` · `--z-alert-panel` | Dialog(비가운데) |
| `HelperPanel` | 폭 272 | 없음 | 없음 | 흐름 안 | 없음 |
| `Popover` · `RowMenu` | 내용 폭 · 트리거에서 6 | `--shadow-popover` | 없음 | `--z-inline` | Popover · DropdownMenu |
| `Tooltip` | `label` 한 줄 · `note` 폭 212(content-box) | `--shadow-popover` | 없음 | `--z-inline` | Tooltip |
| `Select` 목록 | 폭 = 트리거 폭 · 최대 높이 216 | `--shadow-panel` | 없음 | `--z-inline` | Select |
| `LNB` 플로팅(접힘 + 레일 빈 곳에 포인터 300ms · `narrow` 펼침) | `width` · 프레임 왼쪽 상자 전체 높이 | `--shadow-popover` | 없음 | `--z-modal` | 없음 |
- 닫기(✕ · Esc · 바깥 클릭)는 모두 `onOpenChange(false)`(Radix). 따로 `onClose`를 두지 않는다. 포커스 복귀 — Radix는 `Dialog.Trigger`로만 돌려주므로 Modal · Dialog · FlowOverlay · SearchOverlay · AlertPanel은 `layers/useReturnFocus`로 열릴 때의 포커스 요소를 기억해 돌려준다. Popover · RowMenu는 Radix가 트리거로 돌려준다
- 오버레이는 `container`가 있으면 그 상자를(absolute, `data-contained="true"`), 없으면 뷰포트를(fixed) 덮는다. Modal · Dialog · SearchOverlay · AlertPanel은 내부 스캐폴드 `layers/LayerRoot`를 공유한다(`ui` 안 비공개). 층의 `ref`는 내용 상자다
- 트리거 층 포털 — Select · Tooltip · Popover · RowMenu는 층(Modal · Dialog · FlowOverlay · SearchOverlay · AlertPanel) 안이면 `layers/layerContainer`로 그 층 내용 상자에 포털한다(`container`보다 먼저) — 층의 쌓임 맥락 안에서 위에 보인다. 앱 프레임 · body로 포털하면 `--z-inline`이 `--z-modal` 층 막 아래로 숨는다

| 층 공통 prop | 타입 | 기본값 | 뜻 |
|---|---|---|---|
| `open` · `onOpenChange` | `boolean` · `(open: boolean) => void` | 필수 | 제어 |
| `container` | `HTMLElement \| null` | body | 포털 대상(앱 프레임 — 화면은 `app/frame.tsx`의 `useFrameContainer()`로 받는다) |
| `focusOnOpen` | boolean | true | 열릴 때 내용으로 포커스. 카탈로그에서 정적으로 열어 둘 때만 false |
| `returnFocusFallback` | `() => HTMLElement \| null` | 없음 | Modal · Dialog. 여는 컨트롤이 닫힐 때 사라졌으면(여는 행이 삭제된 경우) 포커스를 둘 곳. 없으면 Radix 기본(body) |
| `scrim` | `default` · `light` · `none` | 층마다 | Modal · Dialog · SearchOverlay만. 카탈로그에서 scrim 없이 열어 둘 때 `none` |
| `className` | string | 없음 | 내용 상자에 덧붙인다 |

### CloseButton
- **언제** 층 · 화면 머리의 ✕(`filled`) · 목록 항목을 빼는 ✕(`ghost` — 흐름 바구니 항목).
- **쓰지 않을 때** 발의 글자 `닫기` → Button `secondary` · 태그 값 지우기 → Tag `onRemove` · ✕가 아닌 아이콘 도구 → IconButton.
- **prop · 변형 · 크기** `size`(`22` AlertPanel · `24` Modal — 기본 · `26` PageHeader) · `aria-label`(기본 `닫기` — `ghost`는 대상을 넣는다 `{항목} 빼기`). 글리프 ✕ — 아이콘을 쓰지 않는다(DESIGN Iconography). `variant` — `filled`(기본: `--surface-soft` 필 · `--ink-soft` · hover `--surface-track`) · `ghost`(투명 · `--faint` · hover `--surface-soft` + `--ink`)
- **카탈로그** `CloseButton`

### Modal
- **언제** 입력 · 만들기 `form` · 읽기 전용 열람 `info` · 한 대상의 여러 작업 `settings`(DESIGN `층 선택`).
- **쓰지 않을 때** 되돌릴 수 없는 확인 → Dialog · 여러 단계 → FlowOverlay.
- **prop · 변형 · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `kind` | `settings` · `form` · `info` | `settings` | 크기는 `층` 표. `settings` 머리 = 제목 + `marker` + ✕ · 부제, 발 = 메모 좌 + 액션 우 / `form` 머리 = 키커 + ✕ / `info` 머리 = 키커 행 + 이름(`--t-h2`) + `marker` · `subtitle` |
  | `width` · `height` | number | kind별 | 인라인 style(호출자 값) |
  | `title` | ReactNode | 필수 | Radix Title. `settings` · `info`는 이름, `form`은 키커 |
  | `kicker` | ReactNode | 없음 | `info`만. 머리 첫 행(`연결 정보`) |
  | `marker` · `subtitle` | ReactNode | 없음 | `settings` · `info` — 제목 옆 표식 StatusChip `lg`(PageHeader · SectionHead `marker`와 같은 자리) · 부제(Radix Description) |
  | `children` | ReactNode | 없음 | 몸통. `settings`는 여백 없이 `Tabs variant="rail"` 하나(탭 없이 그릴 때 — 불러오는 중 · 원문 — 는 `ModalPanel`) |
  | `footer` | `{ note?; noteId?; actions? }` | 없음 | 없으면 발 없음. `note`는 발 한 문장(무엇을 쓰는지 · 우선순위는 DESIGN `권한`) · `noteId`는 메모 `id`(비활성 액션 `aria-describedby` 대상) |
  | `dismissible` | boolean | true | `false`면 Esc · 바깥 클릭으로 닫히지 않는다 — **한 번만 보이는 값**(발급된 비밀 값 · 인증 키)을 보일 때만. 머리 ✕ · 호출자 `닫기`는 그대로 `onOpenChange(false)` · `data-dismissible="false"` |
  | 층 공통 | `층` 공통 prop | `scrim` `default` | `open` · `onOpenChange` · `container` · `focusOnOpen` · `returnFocusFallback` · `scrim` |
  - **settings 머리** — `title` = 대상 이름(`계약 원장 DB`), `marker` = 대상 상태(StatusChip `lg`), `subtitle` = 종류 · 요약 한 줄(`PostgreSQL · 표 34개 · 마지막 수집 …`). 탭 이름 · 동작 이름을 제목에 쓰지 않는다
  - **`form` 제출** — Modal은 `<form>`을 그리지 않고 `footer.actions`는 `children` 밖이다. Enter 제출이 필요하면 `children`을 `<form id={formId} onSubmit>`으로 감싸고 확인 버튼에 `type="submit" form={formId}`(Button이 그대로 넘긴다)
  - **`ModalPanel`** — `settings` 내용 열 상자(Tabs `rail`의 `Tabs.Content`가 같은 상자): 남은 폭 · 세로 스크롤 · `[hidden]` 숨김 · 안의 Field(`data-part="field"`) 최대 폭 `--w-field` · 포커스 링은 안쪽(`outline-offset` −3 = 전역 링 2 + 1을 뒤집은 값 — 열이 모달 가장자리에 붙어 바깥 링은 잘린다). 화면은 내용 열 여백 · 간격 · 스크롤 · 칸 폭 CSS를 쓰지 않는다
- **카탈로그** `Modal` · `Modal dismissible` · `ModalPanel` · `Modal 저장하지 않은 변경`

### Dialog
- **언제** 되돌릴 수 없는 확인. 확인 버튼 variant · 이름 입력 확인은 DESIGN `층 선택`.
- **쓰지 않을 때** 되돌릴 수 있는 삭제성 변경 → InlineConfirm · 입력 · 열람 → Modal.
- **prop · 변형 · 크기** `title`(필수 — Radix Title, `--t-h2`) · `description`(Radix Description, `--t-prose` `--ink-soft`) · 층 공통(`scrim` 기본 `default`). Radix `AlertDialog` — 바깥 클릭으로 닫히지 않는다. `children` — 요약 상자 · 이름 입력 · 실패 `ErrorBlock`(화면 몫). `actions`(`{ cancel?: ReactElement; confirm?: ReactElement }`) — 각각 **요소 하나, Button만**(`md`). 없으면 액션 행을 그리지 않는다. Button이 아니면 개발 빌드에서 콘솔 경고(`busy` 속성을 받지 못한다)
  - Dialog가 `cancel`은 `AlertDialog.Cancel`, `confirm`은 `AlertDialog.Action`으로 감싼다 — 조각 · 문자열은 `asChild`가 닫힘 동작을 잃어 쓸 수 없다. 예: `actions={{ cancel: <Button>취소</Button>, confirm: <Button variant="primary">발행</Button> }}`
  - `busy`(boolean, false) — 비동기 확인 진행 중. Dialog가 확인 `loading` · 취소 `disabled`를 얹고 Esc로 닫히지 않는다(`onOpenChange`를 부르지 않는다) · 내용 상자 `data-busy`. 호출자는 확인 `onClick`에서 `e.preventDefault()`(Radix Action의 닫힘을 막는다) 뒤 요청을 보내고, 라벨을 진행형으로 바꾼다(`삭제하는 중…`). 성공하면 호출자가 `onOpenChange(false)`, 실패하면 열어 둔 채 `children`에 `ErrorBlock`(원문). 확인으로 여는 행이 사라지면 `returnFocusFallback`
- **접근성** `description`이 없으면 `aria-describedby`를 달지 않는다.
- **카탈로그** `Dialog` · `Dialog 비동기 확인`

### FlowOverlay
- **언제** 여러 단계를 거쳐 만드는 흐름 — 앱 프레임 전체(LNB 포함)를 `--canvas`로 덮는다.
- **쓰지 않을 때** 한 번에 끝나는 입력 → Modal `form`.
- **prop · 변형 · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `title` | ReactNode | 필수 | Radix Title(머리) |
  | `heading` | ReactNode | 없음 | 단계 머리(`FlowStepHead`). 내용 열 위에 고정 — 스크롤하지 않는다 |
  | `children` · `aside` | ReactNode | 없음 | 내용 열(스크롤 영역) · 우측 슬롯(HelperPanel — 없으면 내용 열이 전체 폭) |
  | `footer` | ReactNode | 없음 | 버튼(Button `lg`) — 주 액션은 마지막. `undefined`면 발 없음, 빈 노드라도 주면 발 표시 |
  | `note` · `noteId` | ReactNode · string | 없음 | 발 한 줄(Modal `footer.note`와 같은 계약) — 주 액션 바로 왼쪽 · 한 줄 말줄임 · 발 `data-note`. 비활성 주 액션의 사유(`소스 종류를 고르면 다음으로 갈 수 있다`) |
  | 층 공통 | `층` 공통 prop | `focusOnOpen` true | `open` · `onOpenChange` · `container`(= 앱 프레임) · `focusOnOpen`. `scrim` 없음 |
  - 내용 열과 HelperPanel은 따로 스크롤한다. 상단 스텝 레일은 없다 — 단계는 HelperPanel(`StepList`)이 보인다. scrim 없이 Content가 컨테이너를 덮으므로 `container`(앱 프레임 — `app/frame.tsx`의 `useFrameContainer()`)를 넘기는 것이 전제다. 없으면 `position: fixed`로 뷰포트를 덮는다. 바깥 클릭은 없다(전체 덮음) — Esc만 `onOpenChange(false)`
- **카탈로그** `FlowOverlay`

### FlowStepHead
- **언제** 단계 흐름의 단계 머리 — 제목 + 설명 한 줄. FlowOverlay `heading`에 둔다.
- **쓰지 않을 때** 화면 제목 → PageHeader · 영역 머리 → SectionHead · 다이얼로그 제목 → Dialog `title`.
- **prop · 변형 · 크기** `title`(필수 — 단계 제목 `어떤 소스를 연결할까요?`, `--t-h2`) · `description`(설명 한 줄 `--t-prose` `--muted`) · `as`(`h2` 기본 · `h3`)
  - 1024: 줄바꿈
- **카탈로그** `FlowStepHead`

### SearchOverlay
- **언제** 앱 전역 검색(LNB 검색에서 연다).
- **쓰지 않을 때** 영역 안 목록 거르기 → SectionSearch.
- **prop · 변형 · 크기** `value` · `onValueChange`(필수 — 입력, 제어) · `placeholder` · `children`(결과 — 아래 조각). `onSubmit` — 입력에서 Enter. 호출자가 첫 결과로 이동. `top`(기본 104) — 상자 위 여백. 카탈로그에서만 바꾼다. 층 공통(`focusOnOpen`이면 입력에 포커스 · `scrim` 기본 `light`). 머리 = 검색 아이콘 + 입력(테두리 · 배경 없음) + `esc` 키캡, 아래 결과 영역이 스크롤한다. 결과 목록 · 단축키 · 라우팅은 호출자
  - 결과 조각 — `SearchOverlayGroup { label }`(mono `--faint` + `--tracking-label-mono`) · `SearchOverlayItem { href?, onClick?, icon?: IconName, note?, pending? }` · `SearchOverlayEmpty`. `SearchOverlayItem`은 `href`면 `<a>`(SPA 이동은 `공통 계약`), 아니면 `<button>` · `pending` 글자 `--faint` · hover `--surface-subtle`
- **접근성** Title `검색`은 시각 숨김(`layers` `.srOnly`)이다.
- **카탈로그** `SearchOverlay`

### AlertPanel
- **언제** LNB 종에서 여는 알림 목록(Notice 카드).
- **쓰지 않을 때** 화면 안 안내 → Notice · 알림 전체 목록 → 화면(`footer` 링크로 들어간다).
- **prop · 변형 · 크기** `title`(기본 `알림` — 머리 제목 + ✕ CloseButton `22`) · 층 공통(`container` = 앱 프레임 · `scrim` 없음, 투명 고정). 투명 scrim 클릭 · Esc로 닫힌다
  - `left` · `bottom`(기본 252 · 16) — 컨테이너에서 패널까지 px, 인라인 style. 프레임 기준 절대 배치(Popover 앵커 아님). 화면은 LNB 폭 + 간격으로 `left`를 준다. `children` — 목록(Notice 카드). 목록 상자가 바로 아래 자식 사이에 1px `--hairline-soft`를 긋는다 — 카드는 하나씩 직접 자식으로 둔다(감쌀 때는 카드마다, 목록 전체를 한 요소로 감싸지 않는다). 최대 높이를 넘으면 스크롤. `footer` — 목록 밖 한 줄, 스크롤하지 않는다. 화면 입구 링크 Button `link` `sm`(`모든 알림 보기`)
- **접근성** 목록 상자 하나가 live 영역(`aria-live="polite"`)이다 — 안의 Notice는 `live`를 주지 않는다(기본 false, 카드마다 live 영역을 두지 않는다).
- **카탈로그** `AlertPanel`

### HelperPanel
- **언제** 흐름 우측 안내(FlowOverlay `aside`) — 제목 + `StepList`.
- **쓰지 않을 때** 화면 보조 열 → PageColumns `aside`.
- **prop · 변형 · 크기** `title`(제목 `--muted`) · `children`(`StepList`). 폭은 `층` 표 · `--surface-subtle` · 왼쪽 1px `--hairline-soft` · 스스로 스크롤. 단계 목록은 `StepList`(현재 안내는 그 `note`) — 화면이 단계 점 · 목록 CSS를 따로 만들지 않는다
- **접근성** 루트 `aside`(`complementary`) · 문자열 `title`은 `aria-label`로도 쓴다.
- **카탈로그** `HelperPanel`

### StepList
- **언제** HelperPanel 안 단계 목록 + 현재 단계 안내.
- **쓰지 않을 때** 상태 표식 → StatusChip(단계 목록은 상태 색을 쓰지 않는다).
- **prop · 변형 · 크기** `items`(필수 — `readonly { id?; label: ReactNode; description?: ReactNode }[]`) — React key = `id ?? 순번`. `current`(필수 — 현재 순번 0부터) — 앞은 `done`, 뒤는 `upcoming`, 길이 이상이면 모두 `done` · 항목 `data-state`. `note`(`{ title; body? }`) — 현재 단계 안내. `<ol>` · 번호 점 — `done` · `current`는 `--ink` 필
- **접근성** 현재 항목 `aria-current="step"`.
- **카탈로그** `StepList`

### Popover
- **언제** 트리거에 붙는 작은 층(내용 · 항목 스타일은 호출자).
- **쓰지 않을 때** 행 작업 메뉴 → RowMenu · 값 고르기 → Select · 짧은 설명 → Tooltip.
- **prop · 변형 · 크기** `trigger`(필수 — 단일 요소, asChild) · `children`(필수) · `container`(기본 body — 층 밖에서만, `층`) · `className` · `ref` 없음. `side`(기본 `bottom`) · `align`(기본 `start`) · `open` · `onOpenChange`(생략하면 트리거 클릭으로 열고 닫는다). `focusOnOpen` · `scrim` 없음. 표면 `--canvas` · 1px `--hairline` · 화살표 없음. Radix `Popover`
- **카탈로그** `Popover`

### RowMenu
- **언제** 표 · 카드 행의 액션 묶음 — 액션 열에 이것 하나(언제 묶는지는 DESIGN `목록과 표`).
- **쓰지 않을 때** 액션이 하나인 행 → Button `sm` · 화면 도구 → PageHeader `actions` · 값 고르기 → Select.
- **prop · 변형 · 크기** `rowLabel`(필수 — 행 이름, 트리거 이름 `{rowLabel} 작업`) · `container`(기본 body — 층 밖에서만, `층`) · `disabled`(트리거 비활성) · `ref`는 트리거. `items`(필수 — `readonly { id?; label; onSelect; tone?: 'danger'; disabled?; reason? }[]`) — React key = `id ?? label` · 항목 `data-tone`
  - 항목 `danger`는 글자 `--fix-fg`(Button `danger`와 같은 뜻 — 되돌리는 Dialog · 확인 줄을 연다). 비활성 항목은 글자 `--disabled` + `reason` 둘째 줄(보이는 문장). 트리거는 IconButton `sm` `ghost`와 같은 상자에 글리프 `⋯`(아이콘 아님 — DESIGN Iconography). 목록은 Popover와 같은 표면 · 오른쪽 정렬(`align="end"`) · 최소 폭 = 트리거 폭. Radix `DropdownMenu`. 클릭은 행 클릭으로 번지지 않는다(트리거 · 항목이 `stopPropagation`)
  - 상태: 트리거 default · hover · focus-visible · active = 열림(`data-state="open"` 필 `--surface-soft`) · disabled
- **접근성** 트리거 `aria-label` · `title` = `{행 이름} 작업` · 키보드 ↑↓ · Enter · Esc(Radix). 항목 `onSelect`는 메뉴가 닫히고 포커스가 ⋯ 트리거로 돌아온 뒤 불린다 — 거기서 연 Modal · Dialog는 트리거를 여는 컨트롤로 기억해 닫히면(Esc · `취소`) 트리거로 돌아간다. 열 때마다 지난 고름을 비우고, 닫히는 사이 트리거가 문서에서 사라졌으면(실시간 갱신으로 행이 빠짐) `onSelect`를 부르지 않는다.
- **카탈로그** `RowMenu · 선택 열`

## 레이아웃

AppShell · LNB · LNBPanel은 **제어 컴포넌트**다 — 펼침 · 폭 · 열린 그룹 · 검색어 같은 상태는 모두 prop으로 받고, 스토어 · 드래그 계산 · 저장 · 라우트 · 포커스 이동 정책은 호출자가 쥔다(펼침 ↔ 접힘 뒤 토글로 옮기는 포커스만 LNB — LNB `접근성`).

### AppShell
- **언제** 앱 프레임 = `lnb` + `<main role="main">`(`children`). 층의 컨테이너(`position: relative`)다.
- **prop · 변형 · 크기** `lnb`(`<LNB>`) · `narrow`(기본 false — 프레임 폭 `--viewport-min`, 아니면 `--viewport-base`)
  - `fill`(기본 false) — 앱 루트용: `border-box`로 부모 상자를 채운다(폭 auto · 높이 100%). 카탈로그는 고정 폭 content-box. 최소 폭은 앱 루트가 쥔다. 1px `--hairline` 프레임 · overflow hidden. 높이는 부모(앱 루트)가 준다. `Tooltip.Provider`를 감싼다. 프레임 바깥 여백은 앱 루트(`--page-*`), 본문 여백은 `PageBody`(DESIGN Layout)
  - 1024: 뷰포트에서 프레임 976, 가로 넘침 없음
- **카탈로그** `AppShell`

### LNB
- **언제** 앱 셸 왼쪽 내비게이션 열 — 펼침 · 접힘 레일 · 플로팅.
- **prop · 변형 · 크기**

  | 상태 | 폭 | 내용 |
  |---|---|---|
  | 펼침 | `width`(드래그 범위 `LNB_WIDTH.min`–`LNB_WIDTH.max`) · `--surface-soft` · 우측 1px `--hairline` + 드래그 핸들(`narrow`면 핸들 없이 플로팅 꼴 — 아래 `1024`) | LNBPanel |
  | 접힘 | `LNB_WIDTH.collapsed`(인라인 style) | 레일: 로고 · 검색 IconButton · 펼치기 IconButton(`sidebar-expand`, `title` `사이드바 펼치기`) · 알림 수(count > 0 — 99 초과는 `99+` · IconButton `sm`과 같은 26 상자). 레일 컨트롤 hover는 `--hairline-soft`(IconButton hover 지역 변수 — IconButton 절) |
  | 접힘 + 레일 빈 곳에 포인터 | `width` 플로팅 · `--canvas`(그림자 · z는 `층` 표) | LNBPanel(`toggleTitle="사이드바 고정"`) |

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `width` | number | 필수 | 펼침 폭(호출자 값, 처음 값 `LNB_WIDTH.default`) → 인라인 style. 플로팅 폭도 같은 값 |
  | `collapsed` · `floating` | boolean | 필수 | 접힘 레일 / 접힘 + 포인터 진입 시 플로팅 |
  | `narrow` | boolean | false | 1024(앱 스토어 `narrow`) — 펼침도 레일 폭 열을 두고 패널을 플로팅과 같은 꼴로 본문 위에 띄운다(본문을 밀지 않는다 · 핸들 없음). 패널 안 Esc는 `onToggle` · `data-narrow` |
  | `onToggle` · `onHoverChange` | `() => void` · `(hovering) => void` | 필수 | 레일 펼치기의 기본 동작(`rail.onExpand`가 없을 때) · 접힘 레일 · 플로팅 진입/이탈(지연은 LNB가 한다 — 아래). 호출자는 받은 값을 그대로 상태에 둔다 |
  | `onResizeStart` | `(e: PointerEvent) => void` | 필수 | 핸들 `pointerdown`. 폭 계산 · 저장은 호출자 |
  | `onResizeKey` | `(direction: -1 \| 1) => void` | 없음 | 핸들 포커스 ←/→. 없으면 키를 가로채지 않는다. clamp(`LNB_WIDTH.min`–`max`)는 호출자 |
  | `minWidth` · `maxWidth` | number | `LNB_WIDTH.min` · `LNB_WIDTH.max` | 핸들 `aria-valuemin` · `aria-valuemax` |
  | `panel` · `rail` | ReactNode · `{ onSearch, onExpand?, alertCount, onAlerts? }` | 필수 | `<LNBPanel>` — 펼침 열과 플로팅에 같은 노드 · 접힘 레일 |
  - 폭 값(기본 · 접힘 · 최소 · 최대)은 `ui/LNB/width.ts`의 `LNB_WIDTH` 한 곳에 둔다 — CSS 토큰이 없다. 플로팅은 `position: absolute`라 AppShell 프레임 기준
  - **플로팅 여닫기** — 플로팅은 레일을 덮으므로 레일 컨트롤(검색 · 펼치기 · 알림 수) 위 포인터는 진입으로 치지 않는다. 레일 빈 곳 진입 · 이탈은 지연 뒤 `onHoverChange(true)` · `false` — 지연 값 · 이유와 `collapsed`가 바뀔 때 예약 거두기는 `ui/LNB/useHoverIntent.ts` 머리 주석. 펼침 열은 hover를 알리지 않는다. 키보드는 플로팅을 열지 않고 레일 컨트롤에 Tab으로 바로 닿는다
  - 1024: 접힘이 기본이고 펼침은 `narrow`다. 닫기는 패널 접기 버튼 · Esc · 항목으로 이동한 뒤(이동 뒤 닫기는 호출자)
- **접근성** 루트 `<nav aria-label="사이드바">` · 핸들 `role="separator"`(`aria-label` `사이드바 폭` · `tabIndex=0` · `aria-valuenow=width`) · 레일 알림 수는 `<button title="알림">`(이름 `알림 N` — N은 `99+`로 자르지 않은 실제 수). LNB 안에서 누르거나 Esc를 눌러 펼침 ↔ 접힘이 바뀌고 포커스가 있던 컨트롤이 사라지면 LNB가 지금 보이는 토글 버튼(펼치면 패널 접기 · 접으면 레일 펼치기)으로 옮긴다 — 포커스가 없던 포인터 클릭은 그대로.
- **카탈로그** `LNB`

### LNBPanel
- **언제** LNB 안 내용 — 머리(로고 · 앱 이름 · 검색 · 접기) · 상위 항목 · 구역 > 그룹 > 하위 항목 · 종 발.
- **prop · 변형 · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `appName` · `toggleTitle` | string | `MCP-Studio` · `사이드바 접기` | 앱 이름 · 접기 버튼 `title` |
  | `onSearch` · `onToggle` · `onAlerts` | `() => void` | 없음 | 머리 검색 · 접기 IconButton · 종 |
  | `topItems` | `NavItem[]` | 필수 | `{ id, label, icon, href?, onClick?, active?, pending?: string, title?, disabled? }` — `pending`은 메모 문구(`준비 중`) · `disabled`는 권한 없음 — `<button disabled>`, 사유는 `title`(호버 보조)과 같은 글을 `VisuallyHidden` + `aria-describedby`로 잇는다(DESIGN `권한` (2)) |
  | `sections` | `NavSection[]` | 필수 | `{ id, label, groups: { id, label, icon, expanded, items: { id, label, href?, onClick?, active?, pending?: boolean }[] }[] }[]` |
  | `onToggleGroup` | `(groupId: string) => void` | 필수 | 펼침 상태는 호출자가 갖는다(제어) |
  | `alert` | `{ count: number; tone: 'fix' \| 'progress' } \| null` | 필수 | 종 위 CountDot. null · 0이면 그리지 않는다 |
  - `href` 항목은 `<a>`(SPA 이동은 `공통 계약`). 항목 높이 `--h-nav-item` · 아이콘 색 = 글자색. 현재 상위 항목은 `--canvas` 필 + `--accent` 글자, 현재 하위 항목은 1px `--accent` 테두리 + `--canvas` 필 + `--accent` 글자. `pending` 항목은 글자만 `--faint`이고 클릭은 그대로 된다
  - 그룹 chevron은 `--faint` — Select chevron(`--muted`)과 다르다. 구역 라벨은 mono `--faint` + `--tracking-label-mono`. 종은 `bell` 아이콘 + CountDot. 로고(`LNBLogo`)는 LNBPanel 머리와 LNB 레일이 함께 쓴다
  - 상태: hover — 상위 · 그룹 · 하위 항목 바탕, 종은 아이콘 둘레, 머리 IconButton은 hover 지역 변수로 — 모두 `--hairline-soft`(루트 지역 변수 lnb-hover 하나. 펼침 `--surface-soft` · 플로팅 `--canvas` 어느 바탕에서도 보인다). 현재 · 비활성 항목은 hover 바탕이 없다
- **접근성** 항목은 `href`면 `<a>`, 아니면 `<button>` · 현재 항목 `aria-current="page"` · `pending` 항목에 `aria-disabled`를 달지 않는다 · 그룹 행 `<button aria-expanded>`(펼치면 `aria-controls`) · 종 `<button>`(이름 `알림`, 알림 수가 있으면 `알림 N`).
- **카탈로그** `LNBPanel`

### PageHeader
- **언제** 화면 머리 — 화면당 하나(h1).
- **쓰지 않을 때** 영역 머리 → SectionHead · 층 머리 → Modal · Dialog `title` · 흐름 단계 머리 → FlowStepHead.
- **prop · 변형 · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `title` | ReactNode | 필수 | h1(`--t-h1`) — 글(인라인)만. 블록 요소 · 버튼 · 검증 문구 · ErrorBlock을 넣지 않는다 |
  | `back` | ReactNode | 없음 | 제목 위 뒤로 링크 — 언제 두는지는 DESIGN `화면 틀` 공통. `<Button variant="link" asChild><Link to={상위}>← {상위 화면 h1 글}</Link></Button>` |
  | `marker` · `titleAction` | ReactNode | 없음 | 제목 옆 표식(StatusChip `lg`) · 그 뒤 h1 밖 진입 버튼(Button `sm` secondary `이름 수정`). 편집 중에는 둘 다 그리지 않는다 |
  | `editor` | ReactNode | 없음 | `null` · `undefined`가 아니면 편집 상태 — 제목 줄이 InlineEdit(`textStyle="heading"`)로 바뀌고 남은 폭을 채운다 · 루트 `data-editing`. 입력 · 버튼 · 검증 문구 · ErrorBlock은 모두 h1 밖이다 |
  | `description` | ReactNode | 없음 | 제목 아래 설명(`--muted`) |
  | `actions` | ReactNode | 없음 | 우측 한 줄 — 아래 `actions` 자리 |
  | `tags` | ReactNode | 없음 | 설명 아래 태그 행(`Tag variant="project"`) |
  | `meta` | `readonly { label: string; value: string }[]` | 없음 | 태그 행 우측 메타(`생성일` + 날짜 · 대시보드 `기준` + 기준 시각) — 라벨과 값 사이 공백 하나. `value`가 `''`면 라벨(사유 문구 — `호출 기록 없음`)만. 기준 시각 줄을 본문에 따로 두지 않는다 |
  | `divider` | boolean | false | 아래 1px `--hairline-soft` |
  - **`actions` 자리** — 넣을 수 있는 것은 넷뿐이고 왼쪽부터 (1) 화면 필터 — `SegmentedControl sm-plus`(화면 전체를 거르는 기간 등. 영역 하나만 거르면 SectionHead `tools`) (2) 하위 화면 링크 (3) 층 열기 — Button `sm` `secondary`(`내보내기`) (4) 화면 도구 — IconButton(설정 톱니 `filled` `sm-plus`) · CloseButton `26`
  - 하위 화면 링크는 `<Button variant="link" size="sm" asChild><Link to={하위}>{하위 화면 이름}</Link></Button>`(짧은 이름 `멤버`). 하위 화면 입구는 본문 영역 안에 따로 두지 않는다. 주 액션(`primary`) · 행 액션은 `actions`에 두지 않는다. 여백은 갖지 않는다(`PageBody` 안에 둔다) · 본문에서 또 h1을 쓰지 않는다
  - 1024: 제목 줄이 줄고 `actions`는 줄지 않는다
- **접근성** 편집 중에도 h1은 시각 숨김으로 남는다(제목 글만 — 화면 outline 유지).
- **카탈로그** `PageHeader` · `PageHeader tags · meta · divider` · `PageHeader back · 그 자리 편집`

### PageBody · PageColumns · Stack · Region · RegionList
- **언제** 화면 본문 틀 — AppShell `<main>` 안. 언제 무엇을 쓰는지는 DESIGN `화면 틀`, 이 컴포넌트들이 주는 여백 · 간격(화면 CSS는 쓰지 않는다)은 DESIGN `본문 여백 · 세로 리듬`.
- **쓰지 않을 때** 층(모달 · 흐름) 안 → 층의 몸통 · `ModalPanel`.
- **prop · 변형 · 크기**

  | 컴포넌트 | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|---|
  | PageBody | `scroll` | `page` · `regions` | `page` | `page` = 본문 전체가 세로 스크롤(자식은 줄지 않는다) · `regions` = 본문은 넘치지 않고 바로 아래 `PageColumns`가 남은 높이를 채운다 — 열 안 `RegionList` · `LogView`가 각자 스크롤. `data-scroll` |
  | PageBody | `narrow` | boolean | false | 1024(앱 스토어 `narrow`) — 좌우 `--body-x-narrow` · `data-narrow` |
  | PageColumns | `variant` | `equal` · `aside` | `equal` | `equal` 같은 폭 두 열 · `aside` 넓은 작업 열 + 오른쪽 고정 보조 열 `--w-aside` · `data-variant` |
  | PageColumns | `narrow` | boolean | false | 열 사이 `--gap-column-narrow` · `data-narrow` |
  | Stack | `fill` · `as` | boolean · `div` \| `section` | false · `div` | 한 열 안 세로 영역 쌓기. `fill`이면 마지막 자식이 남은 높이를 채운다(`regions` 열) · `data-fill` |
  | Region | `as` | `section` · `div` | `section` | `SectionHead` + 내용(목록 · 표 · 격자)을 담는 세로 영역. 머리 → 내용 `--s-2-5`를 준다(`RegionList`는 스스로 위 여백을 가져 겹치지 않는다) |
  | RegionList | `empty` | ReactNode | 없음 | 남은 높이를 채우고 스크롤하는 목록(스크롤 없는 `page` 본문에서는 내용 높이). 포커스 링 자리로 좌우 `--s-1`씩 열 밖으로 나간다 — 부모가 가로를 자르면 링이 다시 잘린다. `empty`(EmptyState)는 항목이 없을 때만 준다 — 목록 자리 세로 가운데 |
  - 1024: 두 열을 유지한다(한 열로 접지 않는다 — `aside`면 보조 열 폭 그대로). 열 폭 = 프레임 폭 − LNB 폭 − 본문 좌우 여백 − 열 사이(`equal`은 그 반, `aside` 작업 열은 거기서 `--w-aside`를 뺀 값)
- **접근성** 넘치는 `PageBody`는 키보드로 닿는 스크롤 상자다 — 앱 프레임 가장자리에 잘리지 않게 포커스 링을 안쪽에 그린다(Modal `ModalPanel`과 같다).
- **카탈로그** `PageBody` · `Stack · Region · RegionList · PageColumns aside`

### SectionHead
- **언제** 화면 안 영역 · 열의 머리 한 줄: 제목 + (표식) + (수) + 우측 (메모) + (도구), 아래 (사유 줄).
- **쓰지 않을 때** 화면 제목 → PageHeader · 흐름 단계 머리 → FlowStepHead · 다이얼로그 제목 → Dialog · 카드 제목 → 카드 `title`.
- **prop · 변형 · 크기**

  | prop | 타입 | 기본값 | 뜻 |
  |---|---|---|---|
  | `title` · `as` | ReactNode · `h2` \| `h3` | 필수 · `h2` | `--t-section` · 줄바꿈 없음. 화면 h1 아래 영역은 h2, 그 안 하위 영역은 h3(글자는 같다) |
  | `marker` · `count` | ReactNode | 없음 | 제목 옆 표식 StatusChip `md`(`lg`는 PageHeader · Modal `marker`만) · 수(mono `tabular-nums`, 서식은 호출자 `3` · `0 / 3`) |
  | `note` | ReactNode | 없음 | 머리 줄 메모 한 줄(`--t-caption` `--muted`) — 기간(`최근 7일`) · 정렬 기준(`호출 많은 순` — DESIGN `목록과 표`) · 표식(`실시간`). 우측, 도구 바로 앞. 화면이 메모 조각을 따로 만들지 않는다 |
  | `tools` | ReactNode | 없음 | 우측 도구 — 컨트롤은 높이 단계 `sm-plus`(SectionSearch · 추가 Button `textStyle="label"` · 필터 SegmentedControl) |
  | `divider` | boolean | false | 아래 1px `--hairline`(열 머리) · 줄 최소 높이 `--h-sm-plus` — 도구가 없어도 나란한 열 머리 구분선이 맞는다 · `data-divider` |
  | `reason` · `reasonId` | ReactNode · string | 없음 | 도구가 비활성인 이유 한 줄(권한 없음 등 — 언제 쓰는지는 DESIGN `권한`) — 머리 줄 아래 · 구분선 위, `undefined` · `null` · `false`면 그리지 않는다 · `data-reason`. `reasonId`는 호출자가 `useId()`로 만들어 비활성 컨트롤 `aria-describedby`에도 준다 |
  | `titleId` | string | 없음 | 제목 요소(`h2` · `h3`)의 `id` — 영역 상자(`<section>` · `<aside>`)가 `aria-labelledby`로 이름을 얻는다. 같은 글을 `aria-label`로 다시 쓰지 않는다 |
  - 1024: 제목 · 수는 줄지 않고 도구 폭은 호출자가 줄인다(SectionSearch `narrow`)
- **카탈로그** `SectionHead` · `SectionHead note`

### SectionSearch
- **언제** 영역 머리 검색 입력(SectionHead `tools` 자리) — 영역 안 목록을 거른다.
- **쓰지 않을 때** 앱 전역 검색 → SearchOverlay · 폼 칸 → Field + Input.
- **prop · 변형 · 크기** `value` · `onValueChange`(필수 — 제어 입력) · `placeholder`(필수) · 그 밖 Input 속성(입력으로 간다 · `size`는 `sm-plus` 고정). 검색 상태는 `useSearchFilter`(`## 공용 훅`). 수는 `copy/list` `countLabel(shown.length, total)`, `isNoMatch`면 EmptyState `filtered`(`onClear={clear}`). 행이 0이면 검색 입력을 그리지 않는다
  - 1024: `narrow`(기본 false · `data-narrow`) — 폭 150 → 110(레이아웃 고정폭)
- **접근성** `placeholder`가 접근 가능한 이름이다(`aria-label`로 덮을 수 있다).
- **카탈로그** `SectionSearch`

## 공용 훅

`apps/web/src/ui/lib`에 두고 `@/ui`로 내보낸다. 같은 동작을 화면이 따로 만들지 않는다. 라우터가 필요한 훅만 `app/`에 둔다(`useLeaveGuard`).
- **`useCopyState(onCopy?, { copiedMs? })`**(`ui/lib/useCopyState.ts`) → `{ state: 'idle' \| 'copied' \| 'failed', copied, copy }` — 복사 버튼의 `복사` → `복사됨` · `복사 안 됨` 전환(DESIGN `복사 결과`). ErrorBlock · CopyField 안과 화면이 만드는 로그 머리 줄 복사 버튼이 쓴다
  - `copy()`는 성공 여부(boolean)를 돌려주고 거부를 밖으로 던지지 않는다. 실패하면 `복사됨`이 떠 있던 중이어도 곧바로 `failed`. 타이머는 언마운트 때 지운다. `copiedMs` 기본 `COPY_RESULT_MS`(2초, `null`이면 다음 누름 · 언마운트까지) · `복사 안 됨`은 늘 2초 · 기본 문구 `COPY_LABELS`
- **`useSearchFilter(rows, haystackOf)`**(`ui/lib/useSearchFilter.ts`) → `{ query, setQuery, clear, shown, total, isNoMatch }` — 영역 목록 검색 상태(SectionSearch + EmptyState `filtered`). 공백 trim · 소문자 substring, 빈 질의는 전부. 검색 대상 문자열(`haystackOf`)은 호출자가 정한다 · `isNoMatch` = 행은 있는데 질의가 모두 걸러냄
- **`isImeComposing(event)`**(`ui/lib/ime.ts`) → boolean — React keydown이 IME 조합 중인지(`isComposing` 또는 keyCode 229 — Safari는 조합을 끝내는 Enter에서 `isComposing`을 이미 내린다). Enter로 확정 · 제출하는 입력은 참이면 무시한다(DESIGN 접근성 IME). TagInput · InlineEdit · SearchOverlay가 쓴다
- **`useUnsavedClose({ isDirty, isBusy?, onClose, open?, container?, labels? })`**(`ui/lib/useUnsavedClose.tsx`) → `{ requestClose, note, dialog }` — form · settings 모달의 저장하지 않은 변경 닫기 확인(DESIGN `층 선택`). 층 `onOpenChange(false)`(✕ · Esc · 바깥 클릭)와 발 `닫기` · `취소`가 `requestClose`를 부른다 — `isBusy`면 아무것도 하지 않고, `isDirty`면 확인 Dialog를 열고, 아니면 `onClose`
  - `isBusy`는 닫기 전에 끝나야 하는 요청(저장 · 만들기 · 삭제)만 넣는다 — 모달이 닫혀도 이어지는 요청(수집 시작 · 중지)은 넣지 않는다. 막는 동안 발 `닫기` · `취소`는 `disabled`(조용히 무시되지 않게)
  - `open`(기본 true) — 층의 `open`. 층이 닫혀 있는 동안 확인 Dialog를 그리지 않고, 닫히면 확인 상태를 거둔다(층을 마운트한 채 `open`만 내리는 호출자는 넘긴다)
  - `dialog`는 층과 형제로 그린다(`container`는 층과 같게). 확인 `닫기`(`danger`)가 `onClose`, `취소`는 확인만 닫는다. `note`는 `isDirty`일 때 발 `note` 문구, 아니면 `null`(발 우선순위는 DESIGN `권한`). 저장 · 만들기 성공처럼 확인 없이 닫을 때는 `onClose`를 바로 부른다. 기본 문구 `UNSAVED_LABELS`(DESIGN Copy `UI 공용 어휘`)
- **`useLeaveGuard({ isDirty })`**(`app/useLeaveGuard.tsx` — 라우터가 필요해 `app/`에 둔다) → `{ dialog, allowLeave }` — 화면 안 폼의 나가기 확인(DESIGN `층 선택`). 바뀐 값이 있는 채 다른 경로로 가면 확인 Dialog(`나가기` `danger` · `취소`), 같은 경로 안 이동(검색 문자열)은 막지 않는다. 저장 · 삭제 성공 뒤 의도한 이동은 같은 핸들러에서 `allowLeave()` 바로 다음에 보낸다(허용은 그 이동 한 번 — 값이 바뀌거나 경로가 바뀌면 거둔다). 문구 `LEAVE_LABELS`(`copy/common`)
- **카탈로그** `화면 나가기 확인`(useLeaveGuard)

## 아이콘

`<Icon name size? title? />` — `size` `16` · `17` · `18`(기본) · `20`, 색은 `currentColor`(기본 `--icon`). `title`이 있으면 `role="img"`, 없으면 장식(`aria-hidden`)으로 그린다. 규격 · 크기별 쓰는 곳 · 등록(`names.ts`) · 세로 비율(`ICON_ASPECT`)은 DESIGN Iconography.
- 이름 = 뜻: `search` = 찾기 · `plus` = 만들기 · `bell` = 알림 · `settings` = 설정 · `sidebar-collapse` / `sidebar-expand` = 사이드바 접기 / 펼치기 · `chevron-down` = 펼치고 접는 목록(열리면 뒤집힌다) · `dashboard` = 대시보드(집계) · `playground` = 시험 실행. `database` = 데이터 가공 · `ontology` = 온톨로지 · `document` = 문서(RAG) · `folder` / `folder-shared` = 내 프로젝트 / 공유받은 프로젝트
- 삽화 `<Illust name />` 150×74 — `git` · `database` · `document` = 소스 종류(코드 저장소 · DB · 문서). 첨부 그림은 FileDrop 안에 있다
- **카탈로그** `Icon` · `Illust`

## 컴포넌트 추가 절차

`.claude/skills/design-change`를 따른다(명세 먼저 → 구현 → `_guide` 카탈로그 → `ui-review`). 이미 있는 컴포넌트의 값을 바꿀 때도 같다.
