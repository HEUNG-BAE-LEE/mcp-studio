// apps/web/src/api/dummy/dashboard.ts — 대시보드 집계(시나리오별). 모르는 range는 400 VALIDATION fields.range INVALID
import type { DashboardUsage, UsageRange } from '../types';
import { dashboardUsageOf, isRange, periodOf } from './data/dashboard';
import { ERROR_CODE, FIELD_REASON, STATUS, apiError, respond } from './error';
import { getScenario } from './scenario';

const DEFAULT_RANGE: UsageRange = '7d';

export function fetchDashboardUsage(range: string = DEFAULT_RANGE): Promise<DashboardUsage> {
  return respond(() => {
    if (!isRange(range))
      throw apiError(STATUS.BAD_REQUEST, ERROR_CODE.VALIDATION, { range: FIELD_REASON.INVALID });
    return { ...dashboardUsageOf(getScenario()), range, period: periodOf(range) };
  });
}
