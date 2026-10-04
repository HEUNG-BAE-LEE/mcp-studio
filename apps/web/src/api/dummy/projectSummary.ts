// apps/web/src/api/dummy/projectSummary.ts — 프로젝트 요약. 데이터 없는 프로젝트 · 빈 시나리오는 ZERO
import type { ProjectSummary } from '../types';
import { NO_CONNECTORS_SUMMARY, PROJECT_SUMMARY, ZERO_SUMMARY } from './data/projectSummary';
import { respond } from './error';
import { getScenario, isEmptyScenario } from './scenario';

function summaryOf(projectId: string): ProjectSummary {
  if (isEmptyScenario()) return ZERO_SUMMARY;
  const found = PROJECT_SUMMARY[projectId];
  if (!found) return ZERO_SUMMARY;
  return getScenario() === 'no-connectors' ? NO_CONNECTORS_SUMMARY : found;
}

export const fetchProjectSummary = (projectId: string): Promise<ProjectSummary> =>
  respond(() => summaryOf(projectId));
