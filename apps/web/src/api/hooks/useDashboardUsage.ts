// apps/web/src/api/hooks/useDashboardUsage.ts — 대시보드 집계. staleTime 기본 30s
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardUsage } from '../dummy/dashboard';
import type { UsageRange } from '../types';
import { keys } from './keys';

export function useDashboardUsage(range: UsageRange) {
  return useQuery({
    queryKey: keys.dashboardUsage(range),
    queryFn: () => fetchDashboardUsage(range),
  });
}
