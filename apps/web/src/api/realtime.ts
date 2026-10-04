// apps/web/src/api/realtime.ts — 실시간 이벤트 → TanStack 캐시흐름 ③ 실행 추적. 연결은 platform.events() 핸들
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { SOURCE_STATUS } from '../copy/status';
import { warnOnce } from '../copy/warnOnce';
import { platform, type EventStream } from '../platform';
import type { RunOutput } from '../platform/events';
import { isProjectSummaryKey, keys } from './hooks/keys';
import type { Source, SourceDetail, SourceStatus } from './types';

const FULL = 100;
const PHASES: ReadonlySet<string> = new Set(['ingest', 'process', 'embedding']);
/** 진행 막대를 그리는 상태. 이 밖의 상태로 바뀌면 progress를 지운다 */
const RUNNING_STATUSES: ReadonlySet<string> = new Set(['ingesting', 'processing']);
type Phase = NonNullable<Source['progress']>['phase'];
const clampPercent = (n: number) => Math.min(FULL, Math.max(0, n));
const percentOf = (done: number, total: number) =>
  total > 0 ? clampPercent(Math.round((done / total) * FULL)) : 0;

// ── 경계 검증: 서버 · 목이 보낸 값은 unknown. 깨졌으면 경고하고 버린다 ──
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v !== '';
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
function malformed(name: string, data: unknown): null {
  console.warn(`[realtime] ${name} 페이로드가 올바르지 않아 무시합니다`, data);
  return null;
}
type StatusPayload = { sourceId: string; status: string };
function readStatus(data: unknown): StatusPayload | null {
  if (!isRecord(data) || !isId(data.sourceId) || !isId(data.status))
    return malformed('source.status', data);
  return { sourceId: data.sourceId, status: data.status };
}
type ProgressPayload = { sourceId: string; phase: string; done: number; total: number };
function readProgress(data: unknown): ProgressPayload | null {
  if (
    !isRecord(data) ||
    !isId(data.sourceId) ||
    !isId(data.phase) ||
    !isCount(data.done) ||
    !isCount(data.total)
  )
    return malformed('run.progress', data);
  return { sourceId: data.sourceId, phase: data.phase, done: data.done, total: data.total };
}
type FinishedPayload = { sourceId: string; result: string; outputs: readonly RunOutput[] };
function readOutputs(raw: unknown): readonly RunOutput[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    malformed('run.finished outputs', raw);
    return [];
  }
  return raw.flatMap((item: unknown): RunOutput[] => {
    if (isRecord(item) && isId(item.code) && isCount(item.count))
      return [{ code: item.code, count: item.count }];
    malformed('run.finished outputs 항목', item);
    return [];
  });
}
/** outputs가 깨져도 결과(result)는 살린다 — 버리면 추적이 영영 running에 머문다 */
function readFinished(data: unknown): FinishedPayload | null {
  if (!isRecord(data) || !isId(data.sourceId) || !isId(data.result))
    return malformed('run.finished', data);
  return { sourceId: data.sourceId, result: data.result, outputs: readOutputs(data.outputs) };
}

type SourcePatch = (s: Source) => Source;
const withoutProgress: SourcePatch = ({ progress: _dropped, ...rest }) => rest;
function patchSource(client: QueryClient, sourceId: string, patch: SourcePatch) {
  client.setQueriesData<Source[]>({ queryKey: keys.sourcesAll() }, (list) =>
    list?.map((s) => (s.id === sourceId ? patch(s) : s)),
  );
  // 상세는 patch가 progress를 빼도 되살아나지 않게 progress를 먼저 비우고 덮는다
  client.setQueryData<SourceDetail>(keys.source(sourceId), (d) =>
    d ? ({ ...withoutProgress(d), ...patch(d) } as SourceDetail) : d,
  );
}
const invalidateSummaries = (client: QueryClient) =>
  void client.invalidateQueries({ predicate: (q) => isProjectSummaryKey(q.queryKey) });

/** 이벤트 → 캐시. 해제 함수를 돌려준다 */
function connectRealtime(client: QueryClient, stream: EventStream): () => void {
  const offs = [
    // 상태 코드는 copy/status가 모르는 값을 기본 틀로 그린다
    stream.on('source.status', (data) => {
      const event = readStatus(data);
      if (!event) return;
      const { sourceId, status } = event;
      if (!Object.hasOwn(SOURCE_STATUS, status))
        warnOnce(
          `status:${status}`,
          `[realtime] 모르는 소스 상태 코드 ${status} — 기본 틀로 그립니다`,
        );
      const next = status as SourceStatus;
      patchSource(client, sourceId, (s) =>
        RUNNING_STATUSES.has(status)
          ? { ...s, status: next }
          : { ...withoutProgress(s), status: next },
      );
    }),
    stream.on('run.progress', (data) => {
      const event = readProgress(data);
      if (!event) return;
      if (!PHASES.has(event.phase)) {
        warnOnce(`phase:${event.phase}`, `[realtime] 모르는 진행 단계 ${event.phase}`);
        return;
      }
      const progress = { phase: event.phase as Phase, percent: percentOf(event.done, event.total) };
      patchSource(client, event.sourceId, (s) => ({ ...s, progress }));
    }),
    stream.on('run.finished', (data) => {
      const event = readFinished(data);
      if (!event) return;
      void client.invalidateQueries({ queryKey: keys.source(event.sourceId) });
      void client.invalidateQueries({ queryKey: keys.sourcesAll() });
      invalidateSummaries(client);
    }),
    stream.on(
      'notification.changed',
      () => void client.invalidateQueries({ queryKey: keys.notifications() }),
    ),
    // 오류 뒤 재연결: 끊긴 사이 놓친 이벤트를 목록 · 알림 · 요약 재조회로 메운다
    stream.on('connection.reopened', () => {
      void client.invalidateQueries({ queryKey: keys.sourcesAll() });
      void client.invalidateQueries({ queryKey: keys.notifications() });
      invalidateSummaries(client);
    }),
  ];
  return () => offs.forEach((off) => off());
}
/** AppShellRoute에서 한 번 — 앱 셸이 연결을 하나만 연다 */
export function useRealtimeSync() {
  const client = useQueryClient();
  useEffect(() => {
    const stream = platform.events();
    const off = connectRealtime(client, stream);
    return () => {
      off();
      stream.close();
    };
  }, [client]);
}

type RunResult = 'running' | 'done' | 'failed' | 'cancelled';
export type RunTrack = Readonly<{
  percent: number;
  result: RunResult;
  outputs: readonly RunOutput[];
}>;
export type RunTracks = Readonly<Record<string, RunTrack>>;
type TrackEvent =
  | { kind: 'progress'; sourceId: string; done: number; total: number }
  | { kind: 'finished'; sourceId: string; result: string; outputs?: readonly RunOutput[] };
const START: RunTrack = { percent: 0, result: 'running', outputs: [] };
const RESULTS: ReadonlySet<string> = new Set(['done', 'failed', 'cancelled']);
const resultOf = (code: string): RunResult => {
  if (RESULTS.has(code)) return code as RunResult;
  warnOnce(`result:${code}`, `[realtime] 모르는 실행 결과 ${code}`);
  return 'failed';
};
/** 순수 갱신 — 남의 소스 이벤트는 같은 객체를 돌려준다 */
function trackerReducer(tracks: RunTracks, ids: ReadonlySet<string>, event: TrackEvent): RunTracks {
  if (!ids.has(event.sourceId)) return tracks;
  const prev = tracks[event.sourceId] ?? START;
  // 끝난 트랙에 늦게 도착한 progress는 결과를 되돌리지 못한다
  if (event.kind === 'progress' && prev.result !== 'running') return tracks;
  const next: RunTrack =
    event.kind === 'progress'
      ? { ...prev, percent: percentOf(event.done, event.total) }
      : {
          result: resultOf(event.result),
          outputs: event.outputs ?? [],
          percent: event.result === 'done' ? FULL : prev.percent,
        };
  return { ...tracks, [event.sourceId]: next };
}
const NO_TRACKS: RunTracks = {};
type TrackerState = Readonly<{ key: string; tracks: RunTracks }>;
const FAILED_STATUSES: ReadonlySet<string> = new Set(['ingest_failed', 'auth_failed']);
/** 캐시의 소스 상태 → 끝난 트랙. 아직 도는 상태는 null(트랙을 만들지 않는다) */
function seedOf(status: string): RunTrack | null {
  if (status === 'ingested') return { percent: FULL, result: 'done', outputs: [] };
  if (FAILED_STATUSES.has(status)) return { percent: 0, result: 'failed', outputs: [] };
  return null;
}
/** 구독 전에 놓친 끝남을 캐시로 채운다. 이미 트랙이 있으면(실시간 데이터) 덮지 않는다 */
function seedTracks(
  tracks: RunTracks,
  ids: ReadonlySet<string>,
  sources: readonly Source[] | undefined,
): RunTracks {
  const seeded = (sources ?? []).flatMap((s): [string, RunTrack][] => {
    const seed = ids.has(s.id) && tracks[s.id] === undefined ? seedOf(s.status) : null;
    return seed ? [[s.id, seed]] : [];
  });
  return seeded.length === 0 ? tracks : { ...tracks, ...Object.fromEntries(seeded) };
}
/** 흐름 ③: 만든 소스들의 진행 · 결과. ids가 바뀌면 처음부터(상태를 idKey로 묶어 이전 묶음을 가린다) */
export function useRunTracker(projectId: string, sourceIds: readonly string[]): RunTracks {
  const client = useQueryClient();
  const [state, setState] = useState<TrackerState>({ key: '', tracks: NO_TRACKS });
  const idKey = sourceIds.join(',');
  useEffect(() => {
    const ids: ReadonlySet<string> = new Set(idKey === '' ? [] : idKey.split(','));
    if (ids.size === 0) return undefined;
    const update = (fn: (tracks: RunTracks) => RunTracks) =>
      setState((s) => ({ key: idKey, tracks: fn(s.key === idKey ? s.tracks : NO_TRACKS) }));
    const apply = (event: TrackEvent) => update((tracks) => trackerReducer(tracks, ids, event));
    const seed = () => {
      const sources = client.getQueryData<Source[]>(keys.sources(projectId));
      update((tracks) => seedTracks(tracks, ids, sources));
    };
    const stream = platform.events();
    const offProgress = stream.on('run.progress', (data) => {
      const e = readProgress(data);
      if (e) apply({ kind: 'progress', sourceId: e.sourceId, done: e.done, total: e.total });
    });
    const offFinished = stream.on('run.finished', (data) => {
      const e = readFinished(data);
      if (e)
        apply({ kind: 'finished', sourceId: e.sourceId, result: e.result, outputs: e.outputs });
    });
    // 구독 전 · 끊긴 사이에 끝난 소스는 이벤트가 없다 — 캐시로 메운다(재연결 뒤 재조회분도 캐시 구독으로)
    const offReopened = stream.on('connection.reopened', seed);
    const offCache = client.getQueryCache().subscribe((e) => {
      if (e.type === 'updated' && e.query.queryHash === JSON.stringify(keys.sources(projectId)))
        seed();
    });
    seed();
    return () => {
      offProgress();
      offFinished();
      offReopened();
      offCache();
      stream.close();
    };
  }, [idKey, client, projectId]);
  return state.key === idKey ? state.tracks : NO_TRACKS;
}
