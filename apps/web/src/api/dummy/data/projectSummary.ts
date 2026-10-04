// apps/web/src/api/dummy/data/projectSummary.ts — 요약 띠 8칸 값. 데이터 없는 프로젝트는 ZERO
import type { ProjectSummary } from '../../types';

export const ZERO_SUMMARY: ProjectSummary = {
  gates: { passed: 0, total: 0 },
  reachability: { reachable: 0, blocked: 0 },
  calls7d: { ok: 0, failed: 0 },
  latency: { p95Ms: null, targetMs: 0 },
  tools: null,
  objectTypes: { approved: 0, pending: 0 },
  connectors: { published: 0, unpublished: 0 },
  freshness: { hoursAgo: null, today: 0, thisWeek: 0, stalled: 0 },
};
const PROJECT_2: ProjectSummary = {
  gates: { passed: 1, total: 3 },
  reachability: { reachable: 2, blocked: 1 },
  calls7d: { ok: 1276, failed: 8 },
  latency: { p95Ms: 180, targetMs: 200 },
  tools: { called: 5, published: 7 },
  objectTypes: { approved: 10, pending: 2 },
  connectors: { published: 1, unpublished: 1 },
  freshness: { hoursAgo: 3, today: 1, thisWeek: 1, stalled: 1 },
};
export const PROJECT_SUMMARY: Readonly<Record<string, ProjectSummary>> = { project_2: PROJECT_2 };
/** no-connectors: 커넥터가 없으니 호출 · 커넥터는 0, 지연 · 도구는 없음(null — 목표는 프로젝트 설정이라 둔다) */
export const NO_CONNECTORS_SUMMARY: ProjectSummary = {
  ...PROJECT_2,
  calls7d: { ok: 0, failed: 0 },
  latency: { p95Ms: null, targetMs: PROJECT_2.latency.targetMs },
  tools: null,
  connectors: { published: 0, unpublished: 0 },
};
