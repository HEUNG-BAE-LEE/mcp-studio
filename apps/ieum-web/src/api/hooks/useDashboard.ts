// 대시보드 요약(GET /dashboard/summary/ — KPI · 시간대별 호출 · 모델별 호출 수 · 많이 쓰인 도구). 화면 일부 상자들이 함께 기대는 영역 조회다
// 진입 자원 — 옛 콘솔이 메뉴에 들어올 때마다 받았다(js/main.js:29). 폴링은 없다(옛에도 setInterval이 없다).
// 원본이 0개인 빈 상태에서도 받는다(js/main.js:66) — 화면이 이 훅을 맨 위에서 불러야 한다
import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { DashboardSummary } from '../types';
import { keys } from './keys';

const SUMMARY_PATH = '/dashboard/summary/';

export function useDashboardSummary() {
  return useQuery({
    queryKey: keys.dashboardSummary(),
    queryFn: ({ signal }) => api.get<DashboardSummary>(SUMMARY_PATH, { region: true, signal }),
    // 메뉴에 들어올 때마다 새로 받는다. 받는 동안은 이전 값으로 그린다
    refetchOnMount: 'always',
  });
}
