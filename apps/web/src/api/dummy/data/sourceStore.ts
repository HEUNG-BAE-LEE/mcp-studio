// apps/web/src/api/dummy/data/sourceStore.ts — 더미 소스 저장소: 기본 소스(시나리오) + 이번 세션에 만든 소스 + 고친 값 · 지운 id. 소스 더미와 실시간 더미가 같이 쓴다(재할당 — 불변)
import type { SourceDetail, SourceType } from '../../types';
import { isEmptyScenario } from '../scenario';
import { EMPTY_EXTRAS, SOURCE_EXTRAS } from './sourceDetails';
import { SOURCES_BY_PROJECT } from './sources';

let created: readonly SourceDetail[] = [];
let patches: Readonly<Record<string, Partial<SourceDetail>>> = {};
let removed: ReadonlySet<string> = new Set();

const seeded = (): SourceDetail[] =>
  isEmptyScenario()
    ? []
    : Object.values(SOURCES_BY_PROJECT)
        .flat()
        .map((s) => ({ ...s, ...(SOURCE_EXTRAS[s.id] ?? EMPTY_EXTRAS) }));
const everything = (): SourceDetail[] =>
  [...seeded(), ...created]
    .filter((s) => !removed.has(s.id))
    .map((s) => ({ ...s, ...patches[s.id] }));

export const listSources = (projectId: string) =>
  everything().filter((s) => s.projectId === projectId);
export const findSource = (sourceId: string) => everything().find((s) => s.id === sourceId);
/** 산출물 종류 — 소스 종류별 고정(핸들러 생성 · 실시간 완료가 같이 쓴다) */
export const OUTPUT_KIND: Readonly<Record<SourceType, SourceDetail['output']['kind']>> = {
  code: 'tools',
  database: 'object_types',
  document: 'knowledge',
};
/**
 * 묶음 안 순번 id(같은 ms 충돌 없음). removed는 id를 걸러낼 뿐 created를 줄이지 않아 created.length가 단조 증가한다 —
 * 그 전제에서 id가 겹치지 않는다. 지울 때 created를 줄이게 바꾸면 깨진다.
 */
export const nextSourceId = (offset: number) => `src_new_${created.length + offset + 1}`;
export function addSources(list: readonly SourceDetail[]) {
  created = [...created, ...list];
}
export function patchSource(sourceId: string, patch: Partial<SourceDetail>) {
  patches = { ...patches, [sourceId]: { ...patches[sourceId], ...patch } };
}
export function removeSource(sourceId: string) {
  removed = new Set([...removed, sourceId]);
}
