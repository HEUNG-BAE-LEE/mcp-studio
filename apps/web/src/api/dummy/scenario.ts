// apps/web/src/api/dummy/scenario.ts — ?mock= 시나리오 · ?role= 역할. 앱 시작 때 한 번 읽고, 더미 함수가 getScenario() · getRole()로 고른다
// 더미 규약(api/dummy/** 공통)
//   지연: 응답은 error.ts의 respond()가 한 상수 지연(DUMMY_DELAY_MS)을 거쳐 돌려준다 — 핸들러마다 따로 setTimeout을 쓰지 않는다
//   상태: 모듈 상태는 불변으로 다룬다(새 배열 · 객체로 바꿔 끼운다)
//   시각: 시드는 오프셋(`+09:00`) 또는 `Z`가 붙은 ISO 문자열만. 시각 정렬 · 비교는 Date.parse로(문자열 비교 금지). 새 기록은 new Date().toISOString()
//   ?mock=failed · write-failed · region-failed · slow: respond()가 중앙에서 처리한다(쓰기 · 영역 조회는 respond 옵션 write · region으로 표시) — 화면마다 따로 만들지 않아도 실패 · 로딩 상태를 볼 수 있다. 데이터 표는 default로 떨어진다
//   시드 상태를 바꾸는 시나리오: 해당 data/*Store(또는 data 모듈) 안에서 분기한다
//   부모 자원: 읽기 조회(목록 · 요약)는 부모(프로젝트)가 있는지 검사하지 않는다 — 없는 id는 빈 결과. 쓰기만 hasProject로 검사해 404
//   날짜 키 · 기간: 로컬 달력으로 계산해 copy/time.ts와 같은 글자를 낸다(ms 뺄셈 금지). 더미는 서버 자리라 copy를 import하지 않는다
//   실패: 거절은 apiError(status, code, fields)를 던진다(error.ts). 서버 문장이 아니라 code만 준다
import type { Role } from '../types';

/** 시나리오 목록과 뜻. 새 시나리오를 더해도 data/ 표는 항목이 없으면 default로 떨어진다(Partial<Record>) */
const SCENARIOS = [
  'default', // 기본 — 프로젝트 · 소스 · 커넥터 · 알림 · 호출이 고루 있다
  'empty', // 프로젝트까지 비움 — 자원이 하나도 없다
  'no-alerts', // 알림 0건(처리 필요 · 진행 중 · 지난 24시간 모두 빔)
  'alerts-risk', // 처리 필요에 실패 계열이 섞인 알림 많은 상태(수 표식 fix 색)
  'alerts-warn', // 처리 필요가 경고 계열뿐(수 표식 progress 색)
  'no-calls', // 발행된 커넥터는 있는데 기간 안 호출이 0
  'empty-guide', // 프로젝트는 있고 그 안이 비어 소스 연결 가이드가 열린다
  'no-connectors', // 소스는 있고 커넥터가 없다
  'ingesting', // 수집이 진행 중인 채로 멈춰 있다(실시간 진행이 앞으로 가지 않는다)
  'write-failed', // 변경 요청(만들기 · 고치기 · 지우기 · 수집 시작 · 중지)만 500 INTERNAL — 조회는 정상. 폼 · 확인 줄 · Dialog 실패 자리 확인용
  'region-failed', // 영역 조회(라우트 화면 본문 screenGate(inline 아님)에 묶이지 않는 읽기 — 영역 · 층 내용 열 · 셸)만 500 INTERNAL — 화면 본문은 뜨고 영역 · 층 내용 열이 ScreenState failed. LNB 프로젝트 목록 · 검색은 실패 자리가 없어 빈 목록이 된다
  'failed', // 모든 더미 요청이 500 INTERNAL(원문 포함)로 거절된다 — 실패 상태 확인용. 재시도 없이 더미 지연 뒤 바로 뜬다. fetchUser만 예외(앱 셸이 떠야 한다)
  'slow', // 모든 더미 응답 지연이 10배 — 로딩 상태 확인용
] as const;
export type Scenario = (typeof SCENARIOS)[number];
const PARAM = 'mock';
const DEFAULT_SCENARIO: Scenario = 'default';

let current: Scenario = DEFAULT_SCENARIO;

const isScenario = (value: string): value is Scenario =>
  (SCENARIOS as readonly string[]).includes(value);

export function parseScenario(search: string): Scenario {
  const value = new URLSearchParams(search).get(PARAM);
  if (value === null) return DEFAULT_SCENARIO;
  if (isScenario(value)) return value;
  console.warn(
    `[dummy] 모르는 시나리오 ?${PARAM}=${value} — 기본값 ${DEFAULT_SCENARIO} 사용 (${SCENARIOS.join(' · ')})`,
  );
  return DEFAULT_SCENARIO;
}
export const setScenario = (scenario: Scenario) => {
  current = scenario;
};
export const getScenario = (): Scenario => current;
/** 자원이 비는 시나리오(프로젝트 상세 가이드 모드 포함). 핸들러마다 따로 세지 않는다 */
const EMPTY_SCENARIOS: ReadonlySet<Scenario> = new Set<Scenario>(['empty', 'empty-guide']);
export const isEmptyScenario = () => EMPTY_SCENARIOS.has(current);
/** 요청을 500으로 거절하는 시나리오. 재시도 판정(app/queryClient)이 쓴다 — 재시도 없이 실패 자리가 바로 보이게 */
const FAILURE_SCENARIOS: ReadonlySet<Scenario> = new Set<Scenario>([
  'failed',
  'write-failed',
  'region-failed',
]);
export const isFailureScenario = () => FAILURE_SCENARIOS.has(current);

/** 역할 축 — ?mock=과 별개, 기본 `owner`. 역할별 권한은 DESIGN `권한`이 원본이고 권한 문자열 목록은 `data/user.ts` */
const ROLES = ['owner', 'editor', 'member', 'viewer'] as const satisfies readonly Role[];
const ROLE_PARAM = 'role';
const DEFAULT_ROLE: Role = 'owner';
const isRole = (value: string): value is Role => (ROLES as readonly string[]).includes(value);
function parseRole(search: string): Role {
  const value = new URLSearchParams(search).get(ROLE_PARAM);
  if (value === null) return DEFAULT_ROLE;
  if (isRole(value)) return value;
  console.warn(
    `[dummy] 모르는 역할 ?${ROLE_PARAM}=${value} — 기본값 ${DEFAULT_ROLE} 사용 (${ROLES.join(' · ')})`,
  );
  return DEFAULT_ROLE;
}
// 시작 때 한 번 URL에서 읽는다(main.tsx 호출 없이도 동작)
const currentRole: Role = parseRole(globalThis.location?.search ?? '');
export const getRole = (): Role => currentRole;
