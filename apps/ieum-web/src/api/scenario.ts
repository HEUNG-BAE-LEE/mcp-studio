// 개발 빌드 전용 ?mock= 시나리오. main.tsx가 시작 때 한 번 읽는다. 부르는 곳은 모두 import.meta.env.DEV 안이라 운영 빌드에서 빠진다
// failed 모든 요청 실패 · write-failed GET 아닌 요청만 실패 · region-failed region 표시 조회만 실패 · slow 지연 · empty 자원별 빈 응답
// 상태 픽스처(서버가 지금 시드로는 만들지 않는 상태를 받은 응답에서 만든다): drift 명세 변경 도구 하나 · source-without-tools 도구 0개 원본 하나
// · disc 자동 탐색 원본 하나와 그 검토 대기 도구들(근거 종류 · 검증 값마다)
// · no-browser 탐색 개요의 브라우저 없음 · git 없음 · 시연 값 없음(다른 조회는 실제)
// default 밖 시나리오에서는 탐색 개요의 시연 값 중 비밀번호 · 저장소 경로(이 컴퓨터의 절대 경로)를 [mock] 가짜 값으로 바꾼다
import { SCENARIO_SERVER_ERROR } from '../copy/errors';
import { SCENARIO_DISC } from '../copy/scenario';
import type { EvidenceKind, Source, SourcesResponse, StudioResponse, ToolMode, ToolParam, ToolRecord, ToolResField, Verify } from './types';

const SCENARIOS = [
  'default',
  'failed',
  'write-failed',
  'region-failed',
  'slow',
  'empty',
  'drift',
  'source-without-tools',
  'disc',
  'no-browser',
] as const;
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

// ── 상태 픽스처 disc — GET /sources/ 끝에 자동 탐색 원본 하나, GET /studio/에 그 원본의 검토 대기 도구들을 더한다 ──
// 서버가 탐색 등록 때 만드는 모양(discovery/jobs.py · merge.py)을 따른다. 저장 · 다시 쓰기는 서버에 없는 도구라 404로 실패한다

// 픽스처 한글(copy/scenario)은 함수 안에서만 읽는다 — 모듈 최상위에서 속성을 읽으면 번들러가 그 읽기를 부수 효과로 보고 남겨
// 운영 dist에 글자가 들어간다

const DISC_SOURCE_ID = 'mock-disc';
const DISC_JOB_ID = 'mock000001';
const DISC_BASE = 'http://localhost:8002/demo-legacy/po';

const discSource = (): Source => ({
  id: DISC_SOURCE_ID,
  name: SCENARIO_DISC.source.name,
  desc: SCENARIO_DISC.source.desc,
  proto: 'disc',
  spec: SCENARIO_DISC.source.spec,
  base: DISC_BASE,
  auth: SCENARIO_DISC.source.auth,
  authType: 'session',
  sync: SCENARIO_DISC.source.sync,
});

const discReadParams = (): readonly ToolParam[] => [
  { o: 'yyyy', ot: 'integer', a: 'yyyy', at: 'integer', loc: 'query', rule: 'keep', d: SCENARIO_DISC.params.year, ex: 2026, req: 1 },
  {
    o: 'X-Requested-With',
    ot: 'string',
    a: '',
    at: 'string',
    loc: 'header',
    rule: 'inject',
    d: SCENARIO_DISC.params.header,
    ex: 'XMLHttpRequest',
    v: 'XMLHttpRequest',
  },
];
const discWriteParams = (): readonly ToolParam[] => [
  { o: 'title', ot: 'String', a: 'title', at: 'string', loc: 'form', rule: 'keep', d: SCENARIO_DISC.params.title, ex: '' },
];
const DISC_RES: readonly ToolResField[] = [
  { o: 'RSLT', a: 'rslt', at: 'string', ov: '0000', rule: 'name', guess: 1 },
  { o: 'resultList[].PO_NO', a: 'result_list[].po_no', at: 'string', ov: 'PO-2026-0001', rule: 'name', guess: 1 },
  { o: 'resultList[].AMT', a: 'result_list[].amt', at: 'number', ov: '1200000', rule: 'num', guess: 1 },
];

type DiscCase = Readonly<{
  id: keyof typeof SCENARIO_DISC.tools;
  mode: ToolMode;
  path: string;
  ev: EvidenceKind;
  verify: Verify;
  recNote?: keyof typeof SCENARIO_DISC.recNote;
}>;

/** 근거 종류(both · src · tr)마다 검증 값 여러 종 + 모르는 값, recNote 있음 · 없음. 쓰기 도구는 쓰기 안내 띠가 먼저 보인다 */
const DISC_CASES: readonly DiscCase[] = [
  { id: 'mock_disc_both_ok', mode: 'read', path: '/po/list.do', ev: 'both', verify: { k: 'ok', code: 200, ms: 12 }, recNote: 'screen' },
  { id: 'mock_disc_src_file', mode: 'read', path: '/po/print.do', ev: 'src', verify: { k: 'file', code: 200 } },
  { id: 'mock_disc_tr_stg', mode: 'read', path: '/chart/monthly.do', ev: 'tr', verify: { k: 'stg', code: 200, ms: 34 }, recNote: 'traffic' },
  { id: 'mock_disc_both_err', mode: 'read', path: '/vend/list.do', ev: 'both', verify: { k: 'err', code: 500 } },
  { id: 'mock_disc_src_err', mode: 'read', path: '/item/price.do', ev: 'src', verify: { k: 'err' }, recNote: 'screen' },
  { id: 'mock_disc_tr_404', mode: 'read', path: '/budget/remain.do', ev: 'tr', verify: { k: '404', code: 404 } },
  { id: 'mock_disc_both_stgerr', mode: 'read', path: '/pr/list.do', ev: 'both', verify: { k: 'stgerr', code: 502 }, recNote: 'screen' },
  { id: 'mock_disc_src_none', mode: 'read', path: '/code/list.do', ev: 'src', verify: { k: 'none' } },
  { id: 'mock_disc_tr_unknown', mode: 'read', path: '/po/detail.do', ev: 'tr', verify: { k: 'mystery' }, recNote: 'traffic' },
  { id: 'mock_disc_write_block', mode: 'write', path: '/prDraftSave.do', ev: 'both', verify: { k: 'block' }, recNote: 'write' },
];

function discTool({ id, mode, path, ev, verify, recNote }: DiscCase, index: number): ToolRecord {
  const text: Readonly<{ title: string; desc: string; confirmQ?: string }> = SCENARIO_DISC.tools[id];
  const isWrite = mode === 'write';
  return {
    id,
    method: isWrite ? 'POST' : 'GET',
    path,
    title: text.title,
    status: 'review',
    mode,
    desc: text.desc,
    ...(text.confirmQ === undefined ? {} : { confirmQ: text.confirmQ }),
    params: isWrite ? discWriteParams() : discReadParams(),
    res: DISC_RES,
    guess: 1,
    disc: {
      job: DISC_JOB_ID,
      id: `mock_api_${index + 1}`,
      ev,
      verify,
      ...(recNote === undefined ? {} : { recNote: SCENARIO_DISC.recNote[recNote] }),
    },
    calls: 0,
  };
}

/** disc — 원본 목록 끝에 자동 탐색 원본 하나(원본 화면 · 대시보드 구조도에도 보인다) */
function withDiscSource(d: unknown): unknown {
  const data = fieldsOf(d) as Partial<SourcesResponse>;
  return { ...data, sources: [...(data.sources ?? []), discSource()] };
}

/** disc — 그 원본의 도구들 */
function withDiscTools(d: unknown): unknown {
  return { ...studioOf(d), [DISC_SOURCE_ID]: DISC_CASES.map(discTool) };
}

// ── 자동 탐색 개요 GET /discovery/ — 받은 객체는 고치지 않는다 ──

const DISCOVERY_OVERVIEW = 'GET /discovery/';

/**
 * default 밖 — 시연 값의 비밀번호 · 저장소 경로만 가짜 값으로(시연 값이 없으면 그대로). [mock] 표식은 화면 · 증거에서 실제 값이 아님이 보이게 한다.
 * 가짜 값은 이 함수 안에서만 만든다 — 최상위 값으로 두면 운영 번들에 글자가 남는다
 */
function withMockDemo(d: unknown): unknown {
  const data = fieldsOf(d);
  if (typeof data.demo !== 'object' || data.demo === null) return d;
  const mark = '[mock]';
  return { ...data, demo: { ...fieldsOf(data.demo), password: mark, repo: `/${mark}/po-web` } };
}

/** no-browser — 이 서버에 쓸 수 있는 브라우저 · git이 없고 시연 값도 없다 */
function withoutBrowser(d: unknown): unknown {
  const data = fieldsOf(d);
  return { ...data, capabilities: { ...fieldsOf(data.capabilities), browser: null, git: false }, demo: null };
}

type Transform = (data: unknown) => unknown;

/** 시나리오별로 바꾸는 응답 — 키는 `메서드 경로`(쿼리 뺌) */
const TRANSFORMS: Readonly<Partial<Record<Scenario, Readonly<Record<string, Transform>>>>> = {
  empty: EMPTY_OF,
  drift: { 'GET /studio/': withDriftTool },
  'source-without-tools': { 'GET /studio/': withoutTools },
  disc: { 'GET /sources/': withDiscSource, 'GET /studio/': withDiscTools },
  'no-browser': { [DISCOVERY_OVERVIEW]: withoutBrowser },
};

/** 받은 성공 응답을 지금 시나리오에 맞게 바꾼다. 바꿀 것이 없으면 그대로 */
export function scenarioData(method: string, path: string, data: unknown): unknown {
  const key = `${method} ${path.split('?')[0]}`;
  const make = TRANSFORMS[current]?.[key];
  const shaped = make ? make(data) : data;
  return current !== 'default' && key === DISCOVERY_OVERVIEW ? withMockDemo(shaped) : shaped;
}
