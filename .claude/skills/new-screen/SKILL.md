---
name: new-screen
description: MCP-Studio에 새 화면을 만들 때 쓴다(만들 화면은 사용자가 정한다 — 샘플 IA의 준비 중 자리에 만드는 경우 포함). 요구 메모에서 시작해 화면 틀 → 컴포넌트 매핑 → 더미 데이터 · 문구 → 구현 → 검수 순서를 따르게 한다.
---

# 새 화면

근거는 `docs/DESIGN.md` · `docs/COMPONENTS.md` 둘뿐이다 — 저장소 밖 규칙(전역 설정 · 다른 프로젝트 관례)을 끌어오지 않는다. `docs/DESIGN.md` `## 핵심 규칙`을 먼저 읽는다. 참고 구현(dashboard · project · shell — 언제든 바뀌는 샘플) 코드는 구조를 읽는 예로만 보고, 문서와 다르면 문서를 따른다. 이 스킬은 절차만 적는다 — 규칙 문장은 가리키는 절에 있다.

## 0. 분기 — 기존 화면에 층(모달 · 흐름)을 더하는 경우
- 위치 `screens/<상위>/<층>/`, 파일 머리 주석 `<Name>Modal`. 라우트 · `nav.ts` 등록 없음(§6 체크리스트 건너뜀)
- URL 상태는 딥링크가 필요할 때만. 틀은 DESIGN `화면 틀`의 `설정 모달` · `단계 흐름` · `목록 (+ 다이얼로그)`

## 1. 요구 메모
화면 파일 머리 주석에 짧게 적는다(별도 문서를 만들지 않는다):
```
// <Name>Screen — 목적 한 줄
// 진입: <상위 화면 · LNB · 층 footer>
// 틀: <화면 틀> · 스크롤 page|regions
// 영역: <영역> = <컴포넌트> …
// 상태: 로딩 · 실패 · 없음 · 빈 상태(kind) · 권한
// 권한: <액션> = <권한 문자열> · 사유 <할 수 있는 역할>(DESIGN 권한 — 권한별 구체형)
```
메모는 무엇을(자원 · 상태 · 액션 · 권한), 문서는 어떻게(틀 · 컴포넌트 · 문구)를 정한다. 메모의 UI 지시(톱니 버튼 · 라벨 글 등)가 문서와 다르면 문서를 따르고 그 자리에 `// 확인 필요: 메모는 …, 문서를 따름`을 남긴다.

요구(자원 · 상태 · 액션 · 권한)가 비면 사용자에게 묻는다. 물을 사람이 없으면 결정하고 그 자리에 `// 확인 필요: …`를 남겨 마칠 때 보고에 목록으로 적는다.

## 2. 화면 틀
DESIGN `화면 틀` 표에서 하나를 고른다 — 영역 배치 · 스크롤 · 1024 · `back` · 입구는 그 절대로.
- 맞는 틀 · 컴포넌트 · 토큰 · 패턴이 없으면 `design-change`로 문서를 먼저 고친다. 새 틀은 화면 하나의 이름이 아니라 일반 이름 · 일반 예로 쓴다
- 물을 사람이 없으면 문서를 먼저 고치고 DESIGN `## 미정`에 확인 행을 남긴 뒤 진행한다

## 3. 영역 → 컴포넌트
| 영역 | 컴포넌트 | variant · size | 상태(빈 · 실패 · 권한) |
- 컨트롤 크기는 DESIGN `컨트롤 높이 단계`, Button 조합은 COMPONENTS `Button` 허용 조합
- DESIGN Patterns가 정한 것은 그대로 쓴다 — 화면 상태 골격 · 그 자리 편집 · 표 행 확인 줄 · 빈 상태 · 목록과 표 · 폼 · 실패(409 등 아는 code 포함) · 층 선택 · 권한 · 복사 결과
- 화면 CSS로 만들고 싶은 모양은 DESIGN `Do's and Don'ts` 표에서 쓸 컴포넌트를 찾는다

## 4. 데이터
- 타입: `api/types.ts`
- 더미: 데이터는 `api/dummy/data/<자원>.ts`(모듈 안 상태 · 불변 갱신), 비동기 함수는 `api/dummy/<자원>.ts`. 함수는 모두 `respond()`(`api/dummy/error.ts`)를 지난다 — 쓰기는 `respond(fn, { write: true })`, 영역 조회는 `{ region: true }`(라우트 화면 본문 `screenGate`(inline 아님)에 묶이지 않는 읽기 — 영역 · 층 내용 열 · 셸) — 지연 · `?mock=` 실패 · 느림을 거기서 받으므로 함수마다 `setTimeout`을 두지 않는다. 실패 · 충돌은 `apiError`(status · code · fields)로 던진다
- 시드의 주체 · 시각은 `api/dummy/data/seed.ts`(`src` · `con` · `localIso` · `todayAt` · `daysFromNow`). 더미 규약(시각 ISO + `Date.parse` 정렬 · 새 레코드 `toISOString`)은 `scenario.ts` 머리 주석
- 공통 시나리오 · 역할은 새 화면이 따로 만들지 않는다 — 뜻은 `api/dummy/scenario.ts`(`SCENARIOS` · 역할 축). 새 화면에서 쓰는 곳
  - `?mock=failed` — 화면 실패(`ScreenState failed`)
  - `?mock=slow` — 로딩
  - `?mock=write-failed` — 폼 · 확인 줄 · Dialog 실패 자리
  - `?mock=region-failed` — 영역 · 층 내용 열 실패
  - `?role=editor|member|viewer` — 권한 비활성 · 사유(`viewer`로 모든 비활성 상태를 본다)
- 그 화면만의 시나리오(빈 상태 등)만 `scenario.ts`에 `?mock=` 값을 더한다 — 표는 `Partial<Record<Scenario, …>>` + 기본값 폴백
- 시드 상태를 바꾸는 시나리오는 해당 `data/*` 안에서 분기한다. 새 409 code는 `copy/errors.ts` `KNOWN_FAILURE` + 더미 `apiError(STATUS.CONFLICT, code)` — 화면은 `FailureBlock`(DESIGN `실패`)으로 그린다
- 권한 문자열은 `app/user/permissions.ts` + `api/dummy/data/user.ts`
- 훅: `api/hooks/use<자원>.ts` · 쿼리 키 `keys.ts`. 화면은 훅으로만 받는다
- 화면 전용 UI 상태는 컴포넌트 state, 화면 간 공유는 Zustand(`app/store`)

## 5. 문구 (`copy/<화면>.ts`)
DESIGN Copy를 따른다 — 문체 · 상태 값 · 시각 서식 · 숫자 · 단위 서식 · 조사 · 공용 어휘. 수 · 0건은 `copy/list`, 오류 · 재시도는 `copy/errors`, 저장하지 않은 변경은 `useUnsavedClose`(`@/ui` — 기본 문구 `UNSAVED_LABELS`) · 화면 안 폼의 나가기 확인은 `useLeaveGuard`(`app/`).

## 6. 구현
- `screens/<name>/<Name>Screen.tsx`(named export) · `<Name>Screen.module.css`. `<name>`은 화면 이름 영문 kebab-case, 번호를 붙이지 않는다. 영역 조각은 같은 폴더 `<Region>.tsx`, 층 · 흐름은 하위 폴더
- 등록 체크리스트
  - [ ] `app/nav.ts` — `ScreenId` 유니언 · `SCREENS` 행 · 경로 헬퍼(준비 중 자리에 만들면 이미 있다 — 건너뛴다)
  - [ ] `app/routes.tsx` — `SCREEN_ELEMENTS`에 행
  - [ ] 최상위 화면이면 `TOP_NAV` 행 + 아이콘(DESIGN Iconography) — 이미 있으면 건너뛴다
  - [ ] 입구 — DESIGN `화면 틀` 공통의 입구 줄(상위 `PageHeader actions` 링크 또는 층 `footer` 링크)
- 레이아웃은 DESIGN `화면 틀` 공통
- `.module.css` 값은 DESIGN `## 핵심 규칙` 1 · `리터럴 px 예외 주석`
- 다른 화면 폴더를 import하지 않는다. 둘이 쓰면 UI `ui` · 쿼리 `api` · 문구 `copy` · 도메인 순수 로직 · 폼 조각 `app/<도메인>/` · 앱 전역 `app`으로 옮긴다(README `## 구조`)

## 7. 보기 · 검수
- `pnpm dev` → `http://localhost:5173/<경로>?mock=<시나리오>`, 컴포넌트는 `/_guide` — Node 버전 · 명령 · 시나리오 목록은 README `## 명령`
- ui-review `## 완료 확인`을 따른다
