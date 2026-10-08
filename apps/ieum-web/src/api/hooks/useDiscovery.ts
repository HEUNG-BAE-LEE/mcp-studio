// 자동 탐색 개요(GET /discovery/ — 할 수 있는 것 · 기본값 · 지난 작업 목록 · 시연 값). 원본 화면 아래 작업 표 자리가 기대는 영역 조회다
// 진입 자원 — 옛 콘솔은 원본 시스템 메뉴에 들어올 때마다 받았다(js/main.js:29 → js/menu/discovery.js:30 refreshJobs). 폴링은 없다.
// 같은 메뉴를 다시 누르면 app/menuRefresh가 이 키를 새로 받는다. 화면은 작업 표 자리 안이 아니라 맨 위에서(화면 판정보다 먼저) 부른다 —
// 그래야 원본 · 도구 조회를 기다리지 않고 들어올 때 한 번 나가고, 화면 조회가 실패해도 빠지지 않는다(옛 nav는 화면과 상관없이 불렀다)
// 작업 예약 시각 startAt은 select에서 epoch 초 → ms로 한 번 바꾼다(api/time.ts). 캐시에는 서버 모양(초)이 남는다
import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { secToMs } from '../time';
import type { DiscoveryResponse, JobSummary } from '../types';
import { keys } from './keys';

const DISCOVERY_PATH = '/discovery/';

const withMsStartAt = (job: JobSummary): JobSummary => ({ ...job, startAt: secToMs(job.startAt) });
const toOverview = (data: DiscoveryResponse): DiscoveryResponse => ({ ...data, jobs: data.jobs.map(withMsStartAt) });

export function useDiscoveryOverview() {
  return useQuery({
    queryKey: keys.discoveryOverview(),
    queryFn: ({ signal }) => api.get<DiscoveryResponse>(DISCOVERY_PATH, { region: true, signal }),
    // 메뉴에 들어올 때마다 새로 받는다. 받는 동안은 이전 값으로 그린다
    refetchOnMount: 'always',
    select: toOverview,
  });
}
