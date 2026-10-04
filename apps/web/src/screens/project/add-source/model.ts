// apps/web/src/screens/project/add-source/model.ts — 소스 추가 뷰모델(순수): 모드 · 자동화 · 제목/부제 · 배치 변환 · 진행 합계 · 단계 머리
import type { Source, SourceBatchItem, SourceMode, SourceType } from '../../../api/types';
import type { RunOutput } from '../../../platform/events';
import type { RunTracks } from '../../../api/realtime';
import { ADD_SOURCE, RUNTIME_FIELDS, formOf, type FieldCopy } from '../../../copy/addSource';

export const SOURCE_TYPES: readonly SourceType[] = ['code', 'database', 'document'];
export const MODES: Readonly<Record<SourceType, readonly SourceMode[]>> = {
  code: ['url', 'dir'],
  database: ['conn', 'dsn'],
  document: ['upload', 'dir'],
};
/** 자동화 수준 5칸 중 켜진 칸 */
export const AUTOMATION: Readonly<Record<SourceType, number>> = {
  code: 5,
  database: 2,
  document: 3,
};
export const AUTOMATION_STEPS = 5;
export const PEEK_COUNT = 3;
const LOG_STEP_PERCENT = 20;
export type BasketItem = Readonly<{
  id: string;
  type: SourceType;
  mode: SourceMode;
  values: Readonly<Record<string, string>>;
}>;
export type FlowStep = 'type' | 'connect' | 'run';

export const runtimeOf = (type: SourceType): readonly FieldCopy[] =>
  type === 'code' ? RUNTIME_FIELDS : [];
export const missingOf = (fields: readonly FieldCopy[], values: Readonly<Record<string, string>>) =>
  fields.filter((f) => f.required && (values[f.code] ?? '').trim() === '');
const LOCATION = ['repo', 'dir', 'dsn', 'host', 'files'] as const;
const locationOf = (v: Readonly<Record<string, string>>) =>
  LOCATION.map((k) => v[k]).find((x) => x !== undefined && x !== '') ?? '';

/** 카드 제목: 이름 → (DB면 스키마) → 위치 끝 조각(.git · 끝 / 제거) → 이름 없음 */
export function titleOf(item: BasketItem): string {
  const named = (item.values.name ?? '').trim();
  if (named !== '') return named;
  if (item.type === 'database' && item.values.schema) return item.values.schema;
  const auto =
    locationOf(item.values)
      .replace(/\/+$/, '')
      .split('/')
      .pop()
      ?.replace(/\.git$/, '') ?? '';
  return auto === '' ? ADD_SOURCE.basket.unnamed : auto;
}
/** 카드 부제: 위치 + (DB 접속 정보면 · 스키마, 아니면 · 브랜치) */
export function subOf(item: BasketItem): string {
  const v = item.values;
  const extra =
    item.type === 'database' && v.schema && !v.dsn
      ? ` · ${v.schema}`
      : v.branch
        ? ` · ${v.branch}`
        : '';
  return `${locationOf(v) || '-'}${extra}`;
}
export function runtimeLine(item: BasketItem): string | null {
  const filled = runtimeOf(item.type).filter((f) => (item.values[f.code] ?? '') !== '');
  return filled.length === 0 ? null : ADD_SOURCE.basket.runtimeFilled(filled.map((f) => f.label));
}
export function toBatchItem(item: BasketItem): SourceBatchItem {
  const pick = (codes: readonly string[]) =>
    Object.fromEntries(codes.flatMap((c) => (item.values[c] ? [[c, item.values[c]]] : [])));
  const config = pick(
    formOf(item.type, item.mode)
      .map((f) => f.code)
      .filter((c) => c !== 'name'),
  );
  const runtime = pick(runtimeOf(item.type).map((f) => f.code));
  const base = { mode: item.mode, name: titleOf(item), config };
  return Object.keys(runtime).length > 0 ? { ...base, runtime } : base;
}
const percentsOf = (tracks: RunTracks, ids: readonly string[]) =>
  ids.map((id) => tracks[id]?.percent ?? 0);
/** 항목 % 평균 */
export function overallPercent(tracks: RunTracks, ids: readonly string[]): number {
  const list = percentsOf(tracks, ids);
  return list.length === 0 ? 0 : Math.round(list.reduce((a, b) => a + b, 0) / list.length);
}
export const logCount = (percent: number) => Math.max(1, Math.ceil(percent / LOG_STEP_PERCENT));
const isRunDone = (tracks: RunTracks, ids: readonly string[]) =>
  ids.length > 0 && ids.every((id) => tracks[id]?.result === 'done');
/** 모든 항목이 끝났다(완료 · 수집 실패 · 멈춤) */
const isRunSettled = (tracks: RunTracks, ids: readonly string[]) =>
  ids.length > 0 && ids.every((id) => (tracks[id]?.result ?? 'running') !== 'running');
/** ③ 단계: 읽는 중 · 모두 완료 · 일부만 완료 */
export type RunPhase = 'running' | 'done' | 'partial';
export function runPhaseOf(tracks: RunTracks, ids: readonly string[]): RunPhase {
  if (isRunDone(tracks, ids)) return 'done';
  return isRunSettled(tracks, ids) ? 'partial' : 'running';
}
/** 체인은 첫 성공 소스로 — 성공이 없으면 null */
export const chainTargetOf = (tracks: RunTracks, ids: readonly string[]): string | null =>
  ids.find((id) => tracks[id]?.result === 'done') ?? null;
type Created = Pick<Source, 'id' | 'name'>;
type Pairing = Readonly<{ created: Readonly<Record<string, string>>; isMismatch: boolean }>;
/**
 * 201 Source[]를 담은 항목에 짝짓는다: 보낸 이름(titleOf)과 같은 응답 중 아직 안 쓴 첫 것,
 * 이름이 바뀌어 짝이 없으면 남은 응답을 보낸 순서대로. 수가 다르면 isMismatch(남는 항목은 짝 없음)
 */
export function pairCreated(basket: readonly BasketItem[], sources: readonly Created[]): Pairing {
  const byName = basket.reduce<{
    pairs: Readonly<Record<string, string>>;
    used: readonly string[];
  }>(
    (acc, item) => {
      const hit = sources.find((s) => s.name === titleOf(item) && !acc.used.includes(s.id));
      return hit
        ? { pairs: { ...acc.pairs, [item.id]: hit.id }, used: [...acc.used, hit.id] }
        : acc;
    },
    { pairs: {}, used: [] },
  );
  const rest = sources.filter((s) => !byName.used.includes(s.id));
  const unpaired = basket.filter((item) => byName.pairs[item.id] === undefined);
  const fallback = Object.fromEntries(
    unpaired.flatMap((item, i) => (rest[i] ? [[item.id, rest[i].id]] : [])),
  );
  return {
    created: { ...byName.pairs, ...fallback },
    isMismatch: basket.length !== sources.length,
  };
}
export function outputTotals(tracks: RunTracks, ids: readonly string[]): RunOutput[] {
  const all = ids.flatMap((id) => tracks[id]?.outputs ?? []);
  const codes = [...new Set(all.map((o) => o.code))];
  return codes.map((code) => ({
    code,
    count: all.filter((o) => o.code === code).reduce((sum, o) => sum + o.count, 0),
  }));
}
export function headingOf(step: FlowStep, type: SourceType | null, phase: RunPhase) {
  const S = ADD_SOURCE.steps;
  if (step === 'type') return S.type;
  if (step === 'connect')
    return { title: type ? ADD_SOURCE.types[type].connectTitle : S.type.title, sub: S.connectSub };
  return phase === 'running' ? S.running : S[phase];
}
