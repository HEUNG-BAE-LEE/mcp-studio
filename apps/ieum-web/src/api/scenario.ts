// 개발 빌드 전용 ?mock= 시나리오. main.tsx가 시작 때 한 번 읽는다. 부르는 곳은 모두 import.meta.env.DEV 안이라 운영 빌드에서 빠진다
// failed 모든 요청 실패 · write-failed GET 아닌 요청만 실패 · region-failed region 표시 조회만 실패 · slow 지연 · empty 자원별 빈 응답
import { SCENARIO_FAILED } from '../copy/errors';

const SCENARIOS = ['default', 'failed', 'write-failed', 'region-failed', 'slow', 'empty'] as const;
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
export const getScenario = (): Scenario => current;
export const isFailureScenario = () =>
  current === 'failed' || current === 'write-failed' || current === 'region-failed';

export type ScenarioRequest = Readonly<{ method: string; path: string; region?: boolean }>;
export type ScenarioFailure = Readonly<{ status: number; message: string; raw: string }>;

export function scenarioFailure(req: ScenarioRequest): ScenarioFailure | null {
  const fails =
    current === 'failed' ||
    (current === 'write-failed' && req.method !== 'GET') ||
    (current === 'region-failed' && req.region === true);
  if (!fails) return null;
  const raw = JSON.stringify({ resultCode: HTTP_INTERNAL, resultMsg: SCENARIO_FAILED, resultData: null });
  return { status: HTTP_INTERNAL, message: SCENARIO_FAILED, raw };
}

export const scenarioDelay = () =>
  current === 'slow' ? new Promise<void>((r) => setTimeout(r, SLOW_DELAY_MS)) : Promise.resolve();

/** 자원별 빈 응답. 셸에 필요한 필드(workspace · wizard)는 비우지 않는다. T2B.5에서 api-contract.md와 대조해 채운다 */
const EMPTY_OF: Readonly<Record<string, (data: unknown) => unknown>> = {
  'GET /sources/': (d) => ({ ...(d as object), sources: [] }),
  'GET /studio/': () => [],
  'GET /deploy/toolsets/': () => [],
  'GET /deploy/keys/': () => [],
  'GET /logs/': (d) => ({ ...(d as object), rows: [] }),
};
export function emptyOf(method: string, path: string, data: unknown): unknown {
  if (current !== 'empty') return data;
  const make = EMPTY_OF[`${method} ${path.split('?')[0]}`];
  return make ? make(data) : data;
}
