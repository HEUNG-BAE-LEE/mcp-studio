// 자동 탐색 개요(GET /discovery/ — 할 수 있는 것 · 기본값 · 지난 작업 목록 · 시연 값). 원본 화면 아래 작업 표 자리와 연결 마법사 탐색 단계가 기대는 영역 조회다
// 진입 자원 — 옛 콘솔은 원본 시스템 메뉴에 들어올 때마다 받았다(js/main.js:29 → js/menu/discovery.js:30 refreshJobs). 폴링은 없다.
// 같은 메뉴를 다시 누르면 app/menuRefresh가 이 키를 새로 받는다. 화면은 작업 표 자리 안이 아니라 맨 위에서(화면 판정보다 먼저) 부른다 —
// 그래야 원본 · 도구 조회를 기다리지 않고 들어올 때 한 번 나가고, 화면 조회가 실패해도 빠지지 않는다(옛 nav는 화면과 상관없이 불렀다)
// 작업 예약 시각 startAt은 select에서 epoch 초 → ms로 한 번 바꾼다(api/discoveryJob withMsStartAt). 캐시에는 서버 모양(초)이 남는다
//
// 관찰자마다 다시 받는 때가 다르다(옛 마법사는 부트 때 받은 DISC만 읽고 요청하지 않았다 — js/menu/discovery.js:3,33-35):
// - 원본 화면 useDiscoveryOverview: 들어올 때마다 새로 받는다
// - 마법사 탐색 단계 useCachedDiscoveryOverview: 드로어가 그 시도를 보이고 탐색 모드일 때만 읽는다. 캐시가 있으면 받지 않고(오래돼도),
//   없을 때(대시보드에서 연 마법사)만 한 번 받는다. 닫히면 꺼진다 — 늘 마운트된 마법사의 관찰자가 남아 있으면 메뉴 다시 받기(app/menuRefresh)의
//   무효화가 그것도 활성으로 보고 다시 받아, 원본 화면에 들어올 때의 받기와 겹쳐 두 번 나간다
// 쓰기(시작 · 다시 탐색 · 등록 · 삭제) 뒤에는 관찰자와 상관없이 fetchQuery({ ...discoveryOverviewQuery, staleTime: 0 })로 받는다
// (app/discovery/useDiscoveryMutations — 무효화는 활성 쿼리만 다시 받아, 관찰자가 없는 작업 화면에서는 요청이 나가지 않는다).
// queryFn은 signal을 넘기지 않는다 — 관찰자가 0이 되는 순간(마법사를 닫고 작업 화면으로 이동) 진행 중 요청이 끊기고 되돌려지지 않게.
// 옛 refreshJobs도 끊지 않았다
import { queryOptions, useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { withMsStartAt } from '../discoveryJob';
import type { DiscoveryResponse } from '../types';
import { keys } from './keys';

const DISCOVERY_PATH = '/discovery/';

const toOverview = (data: DiscoveryResponse): DiscoveryResponse => ({ ...data, jobs: data.jobs.map(withMsStartAt) });

export const discoveryOverviewQuery = queryOptions({
  queryKey: keys.discoveryOverview(),
  queryFn: () => api.get<DiscoveryResponse>(DISCOVERY_PATH, { region: true }),
  select: toOverview,
});

/** 원본 화면 — 메뉴에 들어올 때마다 새로 받는다. 받는 동안은 이전 값으로 그린다 */
export function useDiscoveryOverview() {
  return useQuery({ ...discoveryOverviewQuery, refetchOnMount: 'always' });
}

/**
 * 연결 마법사 탐색 단계 — isEnabled(드로어가 그 시도를 보이고 탐색 모드)일 때만 받는다. 캐시가 있으면 받지 않는다(단계 · 모드를 오가도 요청 없음).
 * 없거나 앞 조회가 실패했으면 한 번 받는다. staleTime을 무한으로 두는 것은 꺼져 있다 켜질 때(모드를 탐색으로 바꾸거나 마법사를 다시 열 때) 오래된 캐시를
 * 다시 받지 않게 하려는 것이다 — 켜지는 순간의 다시 받기는 refetchOnMount가 아니라 신선도로 정해진다
 */
export function useCachedDiscoveryOverview(isEnabled: boolean) {
  return useQuery({ ...discoveryOverviewQuery, enabled: isEnabled, refetchOnMount: false, staleTime: Infinity });
}
