// 개발 빌드 전용 ?mock= 시나리오. main.tsx가 시작 때 한 번 읽는다. 부르는 곳은 모두 import.meta.env.DEV 안이라 운영 빌드에서 빠진다
// failed 모든 요청 실패 · write-failed GET 아닌 요청만 실패 · region-failed region 표시 조회만 실패 · slow 지연 · empty 자원별 빈 응답
// 상태 픽스처(서버가 지금 시드로는 만들지 않는 상태를 받은 응답에서 만든다): drift 명세 변경 도구 하나 · source-without-tools 도구 0개 원본 하나
import { SCENARIO_SERVER_ERROR } from '../copy/errors';
import type { StudioResponse, ToolRecord } from './types';

const SCENARIOS = ['default', 'failed', 'write-failed', 'region-failed', 'slow', 'empty', 'drift', 'source-without-tools'] as const;
export type Scenario = (typeof SCENARIOS)[number];
const PARAM = 'mock';
const SLOW_DELAY_MS = 1500;
const HTTP_INTERNAL = 500;

let current: Scenario = 'default';

const isScenario = (v: string): v is Scenario => (SCENARIOS as readonly string[]).includes(v);

export function initScenario(search: string): void {
  const value = new URLSearchParams(search).get(PARAM);
  if (value === null) return;
  if (isScenario(value)) current = value;
  else console.warn(`[mock] unknown scenario "${value}" — using default (${SCENARIOS.join(' · ')})`);
}

export type ScenarioRequest = Readonly<{ method: string; path: string; region?: boolean }>;
/** 지어낸 실패 응답. client가 실제 응답과 같은 길(failureOf)로 ApiError를 만든다 */
export type ScenarioFailure = Readonly<{ status: number; body: string }>;

export function scenarioFailure(req: ScenarioRequest): ScenarioFailure | null {
  const fails =
    current === 'failed' ||
    (current === 'write-failed' && req.method !== 'GET') ||
    (current === 'region-failed' && req.region === true);
  if (!fails) return null;
  // 실제 백엔드 실패와 같은 봉투(responses.py fail) — 서버 resultMsg를 그대로 그리는 주된 경로를 지난다
  const body = { resultCode: HTTP_INTERNAL, resultMsg: SCENARIO_SERVER_ERROR, resultData: null };
  return { status: HTTP_INTERNAL, body: JSON.stringify(body) };
}

export const scenarioDelay = () =>
  current === 'slow' ? new Promise<void>((r) => setTimeout(r, SLOW_DELAY_MS)) : Promise.resolve();

// 자원별 빈 응답 = 상태 폴더가 빈 백엔드(:8010)가 실제로 내는 응답이다.
// 사용자가 만든 자원(원본 · 도구 · 묶음 · 키 · 로그 · 탐색 작업)만 비우고 서버 설정 값은 남긴다 —
// /sources/의 workspace · wizard, /discovery/의 capabilities · defaults · demo, /dashboard/summary/의 24칸 hourly.
// /playground/(models · chatEnabled)는 설정 값뿐이라 표에 없다
type Fields = Readonly<Record<string, unknown>>;
const fieldsOf = (d: unknown): Fields => (typeof d === 'object' && d !== null ? (d as Fields) : {});
const EMPTY_LOG_COUNTS = { ok: 0, err: 0, wait: 0, cache: 0 };
const EMPTY_KPI = {
  sources: 0,
  sourcesOk: 0,
  publishedTools: 0,
  pendingTools: 0,
  calls24h: 0,
  callsDeltaPct: null,
  successRate: null,
  failedCalls: 0,
  convertMs: null,
  sourceMs: null,
};
/** 시(時) 칸은 지금 시각 기준이라 받은 값을 두고 수만 0으로 */
const emptyHourly = (hourly: unknown) =>
  Array.isArray(hourly) ? hourly.map((h) => ({ ...fieldsOf(h), calls: 0, errors: 0 })) : [];

const EMPTY_OF: Readonly<Record<string, (data: unknown) => unknown>> = {
  'GET /sources/': (d) => ({ ...fieldsOf(d), sources: [] }),
  'GET /studio/': () => ({}),
  'GET /discovery/': (d) => ({ ...fieldsOf(d), jobs: [] }),
  'GET /deploy/toolsets/': () => [],
  'GET /deploy/keys/': () => [],
  'GET /logs/': () => ({ total: 0, counts: { ...EMPTY_LOG_COUNTS }, rows: [] }),
  'GET /dashboard/summary/': (d) => ({
    kpi: { ...EMPTY_KPI },
    hourly: emptyHourly(fieldsOf(d).hourly),
    clientShare: {},
    clientCalls: {},
    topTools: [],
  }),
};
// ── 상태 픽스처 — GET /studio/ 응답({ 원본 id: 도구[] })의 첫 원본(응답 순서로 도구가 있는 것)을 고친다. 받은 객체는 고치지 않는다 ──

/** 명세가 바뀐 응답 필드의 새 이름 표식 — 서버는 같은 끝 이름의 새 경로를 고른다(routers/sources.py _drift). 가짜 값임이 보이게 붙인다 */
const DRIFT_FIELD_SUFFIX = '_mock';

const studioOf = (d: unknown): StudioResponse => fieldsOf(d) as StudioResponse;
const firstSourceWithTools = (studio: StudioResponse): string | undefined =>
  Object.keys(studio).find((id) => (studio[id]?.length ?? 0) > 0);

/** 서버의 응답 필드 변경 감지와 같은 모양 — 도구 status drift, 고치지 않은 첫 응답 필드에 drift · newO(routers/sources.py _drift) */
const driftedTool = (tool: ToolRecord): ToolRecord => {
  const index = tool.res.findIndex((r) => !r.fixed);
  const res = tool.res.map((r, i) => (i === index ? { ...r, drift: 1, newO: `${r.o}${DRIFT_FIELD_SUFFIX}` } : r));
  return { ...tool, status: 'drift', res };
};

/** drift — 첫 원본의 첫 도구를 명세 변경으로(원본 목록 상태 "명세 변경 감지" · 검토 수, 대시보드 알림, 스튜디오 표시) */
function withDriftTool(d: unknown): unknown {
  const studio = studioOf(d);
  const id = firstSourceWithTools(studio);
  const [first, ...rest] = id === undefined ? [] : (studio[id] ?? []);
  if (id === undefined || first === undefined) return d;
  return { ...studio, [id]: [driftedTool(first), ...rest] };
}

/** source-without-tools — 첫 원본의 도구를 비운다(원본 행 · 구조도 노드 → 그 원본의 빈 스튜디오 /studio?src=) */
function withoutTools(d: unknown): unknown {
  const studio = studioOf(d);
  const id = firstSourceWithTools(studio);
  return id === undefined ? d : { ...studio, [id]: [] };
}

type Transform = (data: unknown) => unknown;

/** 시나리오별로 바꾸는 응답 — 키는 `메서드 경로`(쿼리 뺌) */
const TRANSFORMS: Readonly<Partial<Record<Scenario, Readonly<Record<string, Transform>>>>> = {
  empty: EMPTY_OF,
  drift: { 'GET /studio/': withDriftTool },
  'source-without-tools': { 'GET /studio/': withoutTools },
};

/** 받은 성공 응답을 지금 시나리오에 맞게 바꾼다. 바꿀 것이 없으면 그대로 */
export function scenarioData(method: string, path: string, data: unknown): unknown {
  const make = TRANSFORMS[current]?.[`${method} ${path.split('?')[0]}`];
  return make ? make(data) : data;
}
