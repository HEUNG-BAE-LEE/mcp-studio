// apps/web/src/api/hooks/keys.ts — 쿼리 키 팩토리. 무효화는 접두로(['projects'])
import type { UsageRange } from '../types';

export type ProjectsFilter = Readonly<{ q?: string; scope?: 'mine' | 'shared' }>;

export const keys = {
  user: () => ['user'] as const,
  projects: (filter?: ProjectsFilter) =>
    filter ? (['projects', filter] as const) : (['projects'] as const),
  project: (projectId: string) => ['project', projectId] as const,
  /** 모든 프로젝트의 소스 목록 접두(무효화 · 일괄 패치용) */
  sourcesAll: () => ['sources'] as const,
  sources: (projectId: string) => ['sources', { projectId }] as const,
  source: (sourceId: string) => ['source', sourceId] as const,
  connectors: (projectId: string) => ['connectors', projectId] as const,
  projectSummary: (projectId: string) => ['project', projectId, 'summary'] as const,
  notifications: () => ['notifications'] as const,
  dashboardUsage: (range: UsageRange) => ['dashboard', 'usage', range] as const,
};
/** 모든 프로젝트의 요약 키 판별 — keys.projectSummary(id)의 모양(['project', id, 'summary'])과 짝이다 */
export const isProjectSummaryKey = (key: readonly unknown[]): boolean =>
  key[0] === 'project' && key[2] === 'summary';
