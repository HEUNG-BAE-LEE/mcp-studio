// apps/web/src/api/dummy/realtime.ts — 가짜 실시간. 240ms마다 +6%씩 진행하며 사용자 동작으로 시작한 실행만 재생한다.
// platform/web.ts가 subscribe()로 붙는다. ingesting 시나리오는 42%에서 멈춘다
import type { SourceDetail, SourceStatus, SourceType } from '../types';
import type { AppEventMap, AppEventName, RunOutput } from '../../platform/events';
import { OUTPUT_KIND, findSource, patchSource } from './data/sourceStore';
import { getScenario } from './scenario';

const TICK_MS = 240;
const STEP_PERCENT = 6;
const FREEZE_PERCENT = 42;
const FULL = 100;

type MockListener = (name: AppEventName, data: unknown) => void;
type ActiveRun = Readonly<{ runId: string; previous: SourceStatus }>;

let listeners: ReadonlySet<MockListener> = new Set();
let timers: ReadonlySet<ReturnType<typeof setInterval>> = new Set();
let active: ReadonlyMap<string, ActiveRun> = new Map();
let runSeq = 0;

export function subscribe(listener: MockListener): () => void {
  listeners = new Set([...listeners, listener]);
  return () => {
    listeners = new Set([...listeners].filter((l) => l !== listener));
  };
}
function emit<E extends AppEventName>(name: E, data: AppEventMap[E]) {
  for (const listener of listeners) {
    try {
      listener(name, data);
    } catch (error) {
      // 구독자 하나의 오류가 다른 구독자 · 타이머를 끊지 않게 한다
      console.error('[mock realtime] 구독자 오류', error);
    }
  }
}
/** 실행 id 하나를 새로 낸다 — 엔진 실행이 아닌 취소(기본 데이터 수집 중)도 빈 id를 쓰지 않게 */
export function newRunId(): string {
  runSeq += 1;
  return `run_mock_${runSeq}`;
}

/** 소스 유형별 산출물 */
function outputsOf(type: SourceType, index: number): RunOutput[] {
  if (type === 'code')
    return [
      { code: 'api_tools', count: 5 + index * 3 },
      { code: 'internal_functions', count: 2 + index },
    ];
  if (type === 'database')
    return [
      { code: 'object_types', count: 7 + index * 4 },
      { code: 'tables_read', count: 18 + index * 9 },
    ];
  return [
    { code: 'documents', count: 5 + index },
    { code: 'chunks', count: 1204 + index * 318 },
  ];
}
/** 항목별 진행률: 전체 %를 항목 순서대로 나눠 가진다 */
function localPercent(overall: number, index: number, count: number): number {
  const share = FULL / count;
  return Math.max(0, Math.min(FULL, Math.round(((overall - index * share) / share) * FULL)));
}
/** 산출물 한 줄의 수가 되는 결과 코드 */
const PRIMARY: Readonly<Record<SourceType, string>> = {
  code: 'api_tools',
  database: 'object_types',
  document: 'chunks',
};
const countOf = (outputs: readonly RunOutput[], code: string) =>
  outputs.find((o) => o.code === code)?.count ?? 0;

/** 이미 산출물이 있는 소스(다시 수집)는 같은 수를 유지한다 */
const resultOf = (source: SourceDetail, index: number): RunOutput[] =>
  source.output.count > 0
    ? [{ code: PRIMARY[source.type], count: source.output.count }]
    : outputsOf(source.type, index);

function finish(source: SourceDetail, runId: string, outputs: readonly RunOutput[]) {
  const at = new Date().toISOString();
  const scope =
    source.type === 'database'
      ? { ...source.scope, tables: countOf(outputs, 'tables_read') || source.scope.tables }
      : source.type === 'document'
        ? { ...source.scope, files: countOf(outputs, 'documents') || source.scope.files }
        : source.scope;
  active = new Map([...active].filter(([id]) => id !== source.id));
  patchSource(source.id, {
    status: 'ingested',
    progress: undefined,
    output: { kind: OUTPUT_KIND[source.type], count: countOf(outputs, PRIMARY[source.type]) },
    scope,
    lastRun: {
      id: runId,
      kind: 'ingest',
      trigger: 'manual',
      startedAt: source.lastRun?.startedAt ?? at,
      endedAt: at,
      result: 'done',
      attempt: 1,
    },
  });
  emit('source.status', { sourceId: source.id, status: 'ingested', runId, at });
  emit('run.finished', { sourceId: source.id, runId, result: 'done', outputs: [...outputs] });
}

/** POST /projects/:id/sources · /sources/:id/ingest가 부른다. 첫 눈금은 TICK_MS 뒤. 실행 id 목록을 돌려준다 */
export function startRuns(sources: readonly SourceDetail[]): readonly string[] {
  const at = new Date().toISOString();
  const runs = sources.map((source) => {
    return { source, runId: newRunId() };
  });
  for (const { source, runId } of runs) {
    active = new Map([...active, [source.id, { runId, previous: source.status }]]);
    patchSource(source.id, {
      status: 'ingesting',
      progress: { phase: 'ingest', percent: 0 },
      lastRun: {
        id: runId,
        kind: 'ingest',
        trigger: 'manual',
        startedAt: at,
        endedAt: null,
        result: 'running',
        attempt: 1,
      },
    });
    emit('source.status', { sourceId: source.id, status: 'ingesting', runId, at });
  }
  const freeze = getScenario() === 'ingesting';
  let overall = 0;
  let done: ReadonlySet<string> = new Set();
  const timer = setInterval(() => {
    overall = Math.min(FULL, overall + STEP_PERCENT);
    runs.forEach(({ source, runId }, index) => {
      if (done.has(runId) || active.get(source.id)?.runId !== runId) return;
      const percent = localPercent(overall, index, runs.length);
      patchSource(source.id, { progress: { phase: 'ingest', percent } });
      emit('run.progress', {
        sourceId: source.id,
        runId,
        phase: 'ingest',
        done: percent,
        total: FULL,
      });
      if (percent < FULL) return;
      done = new Set([...done, runId]);
      finish(findSource(source.id) ?? source, runId, resultOf(source, index));
    });
    // 멈추기로 모두 빠졌으면(끝난 것 포함) 더 돌릴 실행이 없다. 멈추지 않은 ingesting은 42%에서 그대로 얼린다
    const isAlive = runs.some(({ source, runId }) => active.get(source.id)?.runId === runId);
    const stop = !isAlive || overall >= FULL || (freeze && overall >= FREEZE_PERCENT);
    if (!stop) return;
    clearInterval(timer);
    timers = new Set([...timers].filter((t) => t !== timer));
    // 화면은 알림 수를 무효화만 한다 — 목은 수를 세지 않는다. 끝난 실행이 없으면(모두 멈춤 · 얼림) 알릴 것이 없다
    if (done.size > 0)
      emit('notification.changed', { groups: { action: 0, progress: 0, recent: 0 } });
  }, TICK_MS);
  timers = new Set([...timers, timer]);
  return runs.map((r) => r.runId);
}

/** POST /sources/:id/ingest/stop — 진행 중이면 cancelled로 끝내고 이전 상태로 되돌린다 */
export function stopRun(sourceId: string): boolean {
  const run = active.get(sourceId);
  if (!run) return false;
  active = new Map([...active].filter(([id]) => id !== sourceId));
  const at = new Date().toISOString();
  patchSource(sourceId, { status: run.previous, progress: undefined });
  emit('source.status', { sourceId, status: run.previous, runId: run.runId, at });
  emit('run.finished', { sourceId, runId: run.runId, result: 'cancelled' });
  return true;
}
/** 엔진 실행이 아닌 수집 중 소스(기본 데이터 src_2)를 멈춘다 — stopRun과 같은 이벤트. 실행 id를 돌려준다 */
export function cancelUntracked(source: SourceDetail): string {
  const runId = source.lastRun?.id || newRunId();
  const at = new Date().toISOString();
  patchSource(source.id, { status: 'ready', progress: undefined });
  emit('source.status', { sourceId: source.id, status: 'ready', runId, at });
  emit('run.finished', { sourceId: source.id, runId, result: 'cancelled' });
  return runId;
}
export const isRunning = (sourceId: string) => active.has(sourceId);
