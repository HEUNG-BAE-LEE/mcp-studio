---
name: new-screen
description: 이음 웹 콘솔(apps/ieum-web)에 화면을 새로 만들거나 옛 이음 콘솔(apps/web/ieum) 화면을 옮길 때 쓴다 — MCP-Studio design-guide판 new-screen이 아니다. 요구 메모 → 배치 → 부품 매핑 → 실제 API 데이터 · ?mock 상태 → 문구 → 구현 → 옛 화면과 동등성 → 라이트 · 다크 · 다섯 폭 검수 순서를 따르게 한다.
---

# 새 화면 (이음)

근거는 `docs/DESIGN.md` · `docs/COMPONENTS.md`와 이음 원본 화면이다 — 다른 저장소의 규칙(같은 이름 스킬을 가진 `design-guide` 포함) · 전역 관례를 끌어오지 않는다. `docs/DESIGN.md` `## 핵심 규칙`을 먼저 읽는다. 이 스킬은 절차만 적는다 — 규칙 문장은 가리키는 절에 있다.

## 0. 분기 — 기존 화면에 층(모달 · 드로어)을 더하는 경우
- 위치는 그 화면 폴더(`screens/<menu>/`)의 `<Name>Modal.tsx` · `<Name>Drawer.tsx`(크면 하위 폴더), 파일 머리 주석을 단다. 라우트 · `nav.ts` 등록 없음(§6 체크리스트 건너뜀)
- 층은 COMPONENTS의 층 부품으로 연다 — 가림막 · Esc · 포커스 복귀는 부품이 맡는다(DESIGN `## 접근성` 층). 확인은 앱 안 확인 모달이다
- 층을 주소에 넣는 것은 딥링크가 필요할 때만(로그 상세 같은)

## 1. 요구 메모
화면 파일 머리 주석에 짧게 적는다(별도 문서를 만들지 않는다):
```
// <Name>Screen — 목적 한 줄
// 진입: <LNB · 다른 화면의 링크 · 주소>
// 주소: <경로 id · 검색 파라미터> — 화면 안 선택 replace · 새 흐름 push
// 영역: <영역> = <부품> …
// 조회: 화면 <훅> · 영역(region) <훅> · 쓰기 <mutation>
// 상태: 첫 로딩 · 실패(자리) · 없음 · 빈 상태(kind × container)
// 옛 근거: apps/web/ieum/js/menu/<menu>.js (이식 기간)
```
메모는 무엇을(자원 · 상태 · 동작), 문서는 어떻게(부품 · 문구 · 자리)를 정한다. 메모가 문서와 다르면 문서를 따르고 그 자리에 `// 확인 필요: 메모는 …, 문서를 따름`을 남긴다. 요구가 비면 사용자에게 묻고, 물을 사람이 없으면 결정한 뒤 `// 확인 필요: …`를 남겨 마칠 때 보고에 목록으로 적는다. 권한 단계는 없다 — 이음 콘솔에는 로그인 · 역할이 없다.

## 2. 배치
- 본문은 셸(레일 · GNB · LNB) 안에 그린다 — 셸은 `app/RootLayout`이 감싼다. 옮기는 화면은 옛 화면 배치 그대로, 새 화면은 가까운 이음 화면의 배치를 따른다
- 폭에 따라 접히는 배치는 레이아웃 부품(목록 + 상세 · 두 열 · 필드 짝 · 격자)에 맡긴다. 폭마다 무엇이 바뀌는지는 DESIGN Layout `폭 구간` 표 — 화면 CSS에 `@media`를 쓰지 않는다
- 맞는 부품 · 변형 · 토큰이 없으면 `design-change`로 문서부터 고친다. 이식 기간에는 가이드 쪽 몫이라 요청하고, 그동안 `ui`를 만들지 않는다(`design-change` `## 7`)

## 3. 영역 → 부품
| 영역 | 부품 | variant · size | 상태(첫 로딩 · 실패 · 빈) |
- 크기는 숫자가 아니라 단계 이름 — 컨트롤 높이는 DESIGN Layout `컨트롤 높이 단계`, 아이콘은 DESIGN Iconography
- 부품은 `@/ui`에서만 가져온다. 화면 CSS로 부품 모양(버튼 · 칩 · 표 · 층)을 흉내 내지 않는다(DESIGN `## Components`)
- 빈 상태는 DESIGN Copy `빈 상태`(kind × container), 실패 자리는 DESIGN Copy `실패`, 상태 칩은 `copy/status`(핵심 규칙 3 · 10)

## 4. 데이터 — 실제 API
- 타입 `api/types.ts`, 훅 `api/hooks/use<자원>.ts` · 쿼리 키 `api/hooks/keys.ts`. 경로는 백엔드 라우터 그대로(끝 슬래시 포함). 화면은 훅으로만 받는다 — `fetch`를 직접 부르지 않는다(oxlint · `lint:source`)
- 화면을 대표하는 조회만 `screenGate`에 넣고, 화면 일부 상자 · 층 내용 조회는 `{ region: true }`로 받아 `regionGate`로 본다(`app/screenGate.ts` 머리 주석)
- 서버 시각(epoch 초)은 훅의 `select`에서 `secToMs`로 한 번 바꾼다(`api/time.ts`). 소요 시간은 ms 그대로
- **첫 로딩** — 본문 · 상자를 비우고 `aria-busy`만 켠다. 문구 · 스피너를 더하지 않는다
- **실패** — 화면 첫 조회는 본문 자리 실패 상자(셸은 남김 · 재시도 버튼 없음). 영역 첫 조회는 그 상자 안 원문 상자(원문만 · 머리 문장 없음 · warn). 층 안 요청은 그 층 안, 버튼 한 번의 쓰기는 경고 토스트(원문), 새로 받기 · 폴링 실패는 표시 없이 이전 값(DESIGN Copy `실패`)
- **재시도 없음** — 훅에서 `retry`를 켜지 않고 재시도 버튼을 두지 않는다(`app/queryClient.ts`). 들어올 때마다 새로 받는 화면만 그 훅에서 `staleTime: 0` 또는 `refetchOnMount: 'always'`
- **떠날 때 확인 없음** — 저장 안 한 변경의 나가기 확인 훅을 만들지 않는다. 이음에 없다
- 화면 안 UI 상태는 컴포넌트 state, 화면 간 공유는 `app/store`의 `createStore`(`set(prev => next)`로 늘 새 객체). 브라우저 저장소에 쓰지 않는다
- id · 필터는 주소에 둔다. 화면 안 선택은 `replace`, 새 흐름(다시 탐색 같은)은 `push`. 없는 id는 이음 동작대로 첫 항목으로 보정하거나 없음 상태
- **`?mock` 시나리오로 상태를 본다** — 화면이 따로 시나리오를 만들지 않는다(`api/scenario.ts`, 화면별 확인 자리는 README)
  - `slow` — 첫 로딩 · `failed` — 화면 첫 조회 실패 · `region-failed` — 영역 · 층 내용 실패(화면 나머지는 그대로)
  - `write-failed` — 쓰기 실패(토스트 · 층 안) · `empty` — 빈 상태(사용자가 만든 자원만 빔)
  - 새 목록 자원이면 `empty`의 빈 응답 표(`EMPTY_OF`)에 행이 필요하다

## 5. 문구 (`copy/<menu>.ts`)
DESIGN Copy를 따른다. 서버 문장(`resultMsg` · 서버 라벨)은 받은 그대로 그린다. 값 없음은 `NONE` · `orNone` · `NONE_REASON`, 상태 라벨은 `copy/status`, 숫자 · 시각 서식은 `copy/` 함수, 실패 고정 문구는 `copy/errors`. 새 숫자 · 문구는 실제 데이터로 뒷받침한다.

## 6. 구현
- `screens/<menu>/<Name>Screen.tsx`(named export) · `<Name>Screen.module.css`. `<menu>`는 `app/nav.ts`의 화면 id. 영역 조각은 같은 폴더 `<Region>.tsx`, 층은 같은 폴더나 하위 폴더
- 등록 체크리스트
  - [ ] `app/nav.ts` — `SCREENS` 행 · 최상위 메뉴면 `TOP_NAV`(이음 메뉴는 이미 있다 — 건너뛴다)
  - [ ] `copy/shell.ts` `SCREEN_LABEL` — 이미 있으면 건너뛴다
  - [ ] `app/routes.tsx` — 그 화면 행의 `PendingScreen`을 실제 화면으로
- `.module.css` 값은 DESIGN 핵심 규칙 1 · Layout `리터럴 px 예외 주석`. 화면 CSS는 `@media` · 줄임 속성 `font`를 쓰지 않고 글자 값은 축 토큰 하나(핵심 규칙 5 · 11). 인라인 `style`은 `'--…'` 키만(Layout `TSX style`)
- 다른 화면 폴더를 import하지 않는다 — 둘이 쓰면 부품 `ui` · 쿼리 `api` · 문구 `copy` · 두 화면 이상이 쓰는 순수 로직 · 폼 조각 `app/<도메인>/`으로 옮긴다(README `## 구조`)

## 7. 이식 기간 — 옛 화면을 옮길 때
옛 콘솔을 지우는 전환 때 이 절을 지운다.
- 기준은 옛 화면(`apps/web/ieum/js/menu/<menu>.js` · `css/console.css`)이다. 모습 · 동작 · 문구 · 호출(경로 · 본문 · 순서)이 같아야 한다. 옛 문구는 다듬지 않고 그대로 `copy/<menu>.ts`로 옮긴다
- 메뉴의 동등성 체크리스트(이식 작업 지시문이 준다)에서 이번 메뉴가 닫는 행을 모두 구현하고, 행마다 구현 자리(파일:줄)를 남긴다. 뒤 메뉴로 넘긴 행은 건드리지 않는다
- 옛 화면과 다르게 하는 것은 정해 둔 예외뿐이다(종류와 항목은 `docs/DESIGN.md` `## 이식 기간`). 체크리스트가 고치기로 한 행만 고치고, 그 밖의 차이가 생기면 멈추고 보고한다
- **서버 사실과 다른 옛 문구 · 출력은 고치지 않는다** — 이식 기간 동안 그대로 옮기고 전환 뒤 서버 데이터로 고친다. 목록은 `docs/DESIGN.md` `## 이식 기간` 보존
- 옛 콘솔과 나란히 본다 — 같은 백엔드 상태에서 옛 `/ieum/`(백엔드 주소)과 새 `http://localhost:5174/ieum/`을 같은 폭 · 테마로

## 8. 보기 · 검수
- `npm run dev` → `http://localhost:5174/ieum/<경로>?mock=<시나리오>`(시나리오는 시작 때 한 번 읽는다 — 바꾸면 새로고침). 부품은 `/ieum/_guide`. 명령 · 백엔드 지정(`IEUM_BACKEND`) · 시나리오별 확인 자리는 README
- **다크도 본다** — 화면에는 테마 전환이 없으니 브라우저의 `prefers-color-scheme: dark` 흉내로 라이트 · 다크를 둘 다 본다. 폭은 1920 · 1440 · 1280 · 1024 · 390
- ui-review `## 완료 확인`을 따른다
