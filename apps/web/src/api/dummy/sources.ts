// apps/web/src/api/dummy/sources.ts — 소스 목록 · 배치 추가 · 상세 · 표시명 · 연결 해제 · 지금 수집 · 멈추기. 상태는 data/sourceStore
import type { Run, SourceBatchInput, SourceBatchItem, SourceDetail, SourceType } from '../types';
import {
  OUTPUT_KIND,
  addSources,
  findSource,
  listSources,
  nextSourceId,
  patchSource,
  removeSource,
} from './data/sourceStore';
import { ERROR_CODE, FIELD_REASON, STATUS, apiError, notFoundError, respond } from './error';
import { hasProject } from './projects';
import { cancelUntracked, isRunning, newRunId, startRuns, stopRun } from './realtime';
import { parseBatch } from './sourceInput';

const driverOf = (type: SourceType, item: SourceBatchItem) =>
  type === 'database'
    ? (item.config.dsn?.split(':')[0] ?? 'postgres').replace('postgresql', 'postgres')
    : type === 'code'
      ? 'git'
      : 'docs';
const repoPath = (url: string) => url.replace(/^https?:\/\/[^/]+\//, '').replace(/\.git$/, '');
function scopeOf(type: SourceType, item: SourceBatchItem): SourceDetail['scope'] {
  if (type === 'database') return item.config.schema ? { schema: item.config.schema } : {};
  if (type === 'code') return { repo: repoPath(item.config.repo ?? item.config.dir ?? '') };
  return {};
}
const machineOf = (name: string, id: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || id;

function newSource(
  projectId: string,
  type: SourceType,
  item: SourceBatchItem,
  offset: number,
): SourceDetail {
  const id = nextSourceId(offset);
  return {
    id,
    projectId,
    name: item.name.trim(),
    machineName: machineOf(item.name, id),
    type,
    driver: driverOf(type, item),
    status: 'ready',
    output: { kind: OUTPUT_KIND[type], count: 0 },
    schedule: { mode: 'manual' },
    tags: [],
    scope: scopeOf(type, item),
    connection: Object.entries({ ...item.config, ...item.runtime })
      .filter(([code, value]) => code !== 'name' && value.trim() !== '')
      .map(([code, value]) => ({ code, value })),
    log: [],
    toolGroups: [],
  };
}
const requireSource = (sourceId: string): SourceDetail => {
  const found = findSource(sourceId);
  if (!found) throw notFoundError();
  return found;
};
const runOf = (runId: string, result: Run['result']): Run => ({
  id: runId,
  kind: 'ingest',
  trigger: 'manual',
  startedAt: new Date().toISOString(),
  endedAt: result === 'running' ? null : new Date().toISOString(),
  result,
  attempt: 1,
});

export const fetchSources = (projectId: string): Promise<SourceDetail[]> =>
  respond(() => listSources(projectId));

export const createSources = (
  projectId: string,
  input: SourceBatchInput,
): Promise<SourceDetail[]> =>
  respond(
    () => {
      if (!hasProject(projectId)) throw notFoundError();
      // 바깥에서 온 값이라 타입을 믿지 않고 다시 검증한다
      const parsed = parseBatch(input);
      if (!parsed.ok) throw apiError(STATUS.BAD_REQUEST, ERROR_CODE.VALIDATION, parsed.fields);
      const created = parsed.input.items.map((item, i) =>
        newSource(projectId, parsed.input.type, item, i),
      );
      addSources(created);
      startRuns(created);
      return created.map((s) => findSource(s.id) ?? s);
    },
    { write: true },
  );

/** 설정 모달 내용 열(층 inline screenGate) — 영역 조회 */
export const fetchSource = (sourceId: string): Promise<SourceDetail> =>
  respond(() => requireSource(sourceId), { region: true });

export const updateSource = (sourceId: string, patch: { name?: unknown }): Promise<SourceDetail> =>
  respond(
    () => {
      requireSource(sourceId);
      const name = patch.name;
      if (typeof name !== 'string' || name.trim() === '')
        throw apiError(STATUS.BAD_REQUEST, ERROR_CODE.VALIDATION, { name: FIELD_REASON.REQUIRED });
      patchSource(sourceId, { name: name.trim() });
      return requireSource(sourceId);
    },
    { write: true },
  );

export const deleteSource = (sourceId: string): Promise<void> =>
  respond(
    () => {
      requireSource(sourceId);
      stopRun(sourceId);
      removeSource(sourceId);
    },
    { write: true },
  );

export const ingestSource = (sourceId: string): Promise<Run> =>
  respond(
    () => {
      const found = requireSource(sourceId);
      if (isRunning(found.id)) throw apiError(STATUS.CONFLICT, ERROR_CODE.INGEST_RUNNING);
      const [runId = newRunId()] = startRuns([found]);
      return runOf(runId, 'running');
    },
    { write: true },
  );

export const stopIngest = (sourceId: string): Promise<Run> =>
  respond(
    () => {
      const found = requireSource(sourceId);
      // 기본 데이터 src_2는 수집 중이지만 엔진 실행이 아니다 — 멈추면 연결 준비로 둔다
      if (!isRunning(found.id) && found.status === 'ingesting')
        return runOf(cancelUntracked(found), 'cancelled');
      const runId = found.lastRun?.id ?? newRunId();
      if (!stopRun(found.id)) throw apiError(STATUS.CONFLICT, ERROR_CODE.INGEST_NOT_RUNNING);
      return runOf(runId, 'cancelled');
    },
    { write: true },
  );
