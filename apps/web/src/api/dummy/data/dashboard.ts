// apps/web/src/api/dummy/data/dashboard.ts — DashboardUsage 더미 값(사용량 · 실시간 로그 · 히트맵). 시각은 로컬 기준
import type {
  DashboardCall,
  DashboardComposition,
  DashboardHeatmap,
  DashboardRank,
  DashboardUsage,
  UsageRange,
} from '../../types';
import type { Scenario } from '../scenario';
import { localIso } from './seed';

/** `기준 09-11 09:00` — 기간 끝 날짜 */
const AS_OF_DATE = '2026-09-11';
const AS_OF_TIME = '09:00:00';
// copy/time.ts와 같은 값 — 목 데이터는 화면 copy에 의존하지 않는다(셋째 복사가 생기면 src/lib로)
const pad2 = (v: number) => String(v).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const RANGE_DAYS: Readonly<Record<UsageRange, number>> = { '7d': 7, '30d': 30 };
/** 요청 ?range= 검증 — 유효 목록은 RANGE_DAYS 하나(핸들러와 중복 선언하지 않는다) */
export const isRange = (value: string): value is UsageRange => Object.hasOwn(RANGE_DAYS, value);
/** 기간 = 끝 날짜(asOf)에서 일수 − 1 만큼 앞으로(달력 기준 — ms 뺄셈은 DST에서 하루 어긋날 수 있다) */
export function periodOf(range: UsageRange, to = AS_OF_DATE): { from: string; to: string } {
  const [y = 0, mo = 1, d = 1] = to.split('-').map(Number);
  const from = new Date(y, mo - 1, d);
  from.setDate(from.getDate() - (RANGE_DAYS[range] - 1));
  return { from: isoDate(from), to };
}

/** range · period는 핸들러가 요청값으로 채운다 */
type DashboardUsageBase = Omit<DashboardUsage, 'range' | 'period'>;

const COMPOSITION: DashboardComposition = {
  sources: { total: 8, byType: { database: 3, document: 4, code: 1 } },
  connectors: { total: 16, byStatus: { live: 8, updating: 2, failed: 2, unpublished: 4 } },
  tools: { published: 52, called: 8 },
};
const COMPOSITION_EMPTY: DashboardComposition = {
  sources: { total: 0, byType: { database: 0, document: 0, code: 0 } },
  connectors: { total: 0, byStatus: { live: 0, updating: 0, failed: 0, unpublished: 0 } },
  tools: { published: 0, called: 0 },
};
const COMPOSITION_NO_CALLS: DashboardComposition = {
  ...COMPOSITION,
  tools: { published: COMPOSITION.tools.published, called: 0 },
};

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
/** LCG(hx = 9173 · core 10–16시 1 · 17–18시 .55 · 그 밖 .25 · 주말 .06–.18)를 돌린 값, toFixed(2) */
const HEAT_CELLS: readonly (readonly number[])[] = [
  [0.29, 0.83, 0.92, 0.57, 0.92, 0.82, 0.84, 0.67, 0.3, 0.42, 0.21, 0.16],
  [0.17, 0.92, 0.69, 0.87, 0.92, 0.92, 0.92, 0.82, 0.59, 0.63, 0.24, 0.14],
  [0.27, 0.89, 0.46, 0.92, 0.92, 0.92, 0.65, 0.79, 0.32, 0.5, 0.15, 0.17],
  [0.16, 0.76, 0.92, 0.9, 0.8, 0.92, 0.52, 0.92, 0.58, 0.3, 0.27, 0.19],
  [0.14, 0.92, 0.92, 0.87, 0.92, 0.92, 0.92, 0.62, 0.41, 0.33, 0.15, 0.14],
  [0.09, 0.17, 0.12, 0.1, 0.16, 0.16, 0.17, 0.11, 0.13, 0.11, 0.18, 0.08],
  [0.08, 0.18, 0.07, 0.14, 0.16, 0.13, 0.1, 0.18, 0.08, 0.12, 0.16, 0.09],
];
/** 호출이 없으면 모든 칸 0.04 */
const HEAT_NONE = 0.04;
const heatmap = (cells: readonly (readonly number[])[]): DashboardHeatmap => ({
  hours: [...HOURS],
  rows: WEEKDAYS.map((weekday, i) => ({ weekday, cells: [...(cells[i] ?? [])] })),
});
const HEATMAP = heatmap(HEAT_CELLS);
const HEATMAP_NONE = heatmap(WEEKDAYS.map(() => HOURS.map(() => HEAT_NONE)));

const rank = (connectorId: string, name: string, calls: number): DashboardRank => ({
  connectorId,
  name,
  calls,
});
/** 상위 커넥터 7 — 발행 커넥터 ok 내림차순 7 */
const RANKING: DashboardRank[] = [
  rank('search_payout', '지급 기준 검색', 2610),
  rank('payout_calc', '보험금 산출 커넥터', 1902),
  rank('db_connector', '계약 조회 커넥터', 1284),
  rank('insured_lookup', '피보험자 조회 커넥터', 996),
  rank('medical_ref', '의료자문 이력 조회', 742),
  rank('payout_hist', '지급 이력 요약', 318),
  rank('policy_search', '사규 검색 커넥터', 204),
];

type CallSpec = [
  time: string,
  connectorId: string,
  connector: string,
  tool: string,
  outcome: number | string,
];
/** 지연(ms)이 이 값 이상이면 slow */
const SLOW_MS = 800;
/** outcome이 문자열이면 errorCode, 숫자면 latencyMs */
const call = (
  [time, connectorId, connector, tool, outcome]: CallSpec,
  i: number,
): DashboardCall => {
  const base = {
    id: `call_${pad2(i + 1)}`,
    at: localIso(AS_OF_DATE, time),
    connectorId,
    connector,
    tool,
  };
  if (typeof outcome === 'string') return { ...base, result: 'failed', errorCode: outcome };
  return { ...base, result: outcome >= SLOW_MS ? 'slow' : 'ok', latencyMs: outcome };
};
/** 실시간 로그 13행(최신순). 412ms · 1.2s · 권한 거부 · … */
const CALL_SPECS: readonly CallSpec[] = [
  ['08:58:42', 'search_payout', '지급 기준 검색', 'search_payout_rule', 412],
  ['08:58:39', 'payout_calc', '보험금 산출 커넥터', 'calc_payout', 1200],
  ['08:58:31', 'claim_history', '청구 이력 조회', 'list_claims', 'PERMISSION_DENIED'],
  ['08:58:22', 'db_connector', '계약 조회 커넥터', 'get_contract', 208],
  ['08:58:07', 'insured_lookup', '피보험자 조회 커넥터', 'get_insured', 266],
  ['08:57:58', 'medical_ref', '의료자문 이력 조회', 'list_medical_ref', 354],
  ['08:57:44', 'search_payout', '지급 기준 검색', 'search_payout_rule', 389],
  ['08:57:31', 'payout_calc', '보험금 산출 커넥터', 'calc_payout', 874],
  ['08:57:19', 'db_connector', '계약 조회 커넥터', 'get_contract', 231],
  ['08:57:02', 'insured_lookup', '피보험자 조회 커넥터', 'get_insured', 'TIMEOUT'],
  ['08:56:50', 'claim_history', '청구 이력 조회', 'list_claims', 331],
  ['08:56:37', 'search_payout', '지급 기준 검색', 'search_payout_rule', 402],
  ['08:56:25', 'medical_ref', '의료자문 이력 조회', 'list_medical_ref', 298],
];
const LIVE: DashboardCall[] = CALL_SPECS.map(call);

const DEFAULT: DashboardUsageBase = {
  asOf: localIso(AS_OF_DATE, AS_OF_TIME),
  hasCalls: true,
  composition: COMPOSITION,
  heatmap: HEATMAP,
  ranking: RANKING,
  live: LIVE,
};
const EMPTY: DashboardUsageBase = {
  asOf: DEFAULT.asOf,
  hasCalls: false,
  composition: COMPOSITION_EMPTY,
  heatmap: HEATMAP_NONE,
  ranking: [],
  live: [],
};
/** 발행된 커넥터는 있는데 기간 안 호출이 0 — 순위 · 실시간 빈 문구의 둘째 분기 */
const NO_CALLS: DashboardUsageBase = { ...EMPTY, composition: COMPOSITION_NO_CALLS };

/** 시나리오별 값. 항목이 없는 시나리오는 default로 떨어진다(dashboardUsageOf) */
const DASHBOARD_USAGE: Readonly<Partial<Record<Scenario, DashboardUsageBase>>> = {
  default: DEFAULT,
  empty: EMPTY,
  'no-alerts': DEFAULT,
  'alerts-risk': DEFAULT,
  'alerts-warn': DEFAULT,
  'no-calls': NO_CALLS,
  'empty-guide': DEFAULT,
  'no-connectors': DEFAULT,
  ingesting: DEFAULT,
};
export const dashboardUsageOf = (scenario: Scenario): DashboardUsageBase =>
  DASHBOARD_USAGE[scenario] ?? DEFAULT;
