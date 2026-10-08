// 근거 드로어가 쓰는 작업의 API 후보(apis)와 설정(opts) — 작업 화면 밖(스튜디오 "탐색 근거 보기")에서 근거를 열 때 받는다
// (옛 discEvidenceFor, js/menu/discovery.js:357-366). 작업 화면은 쿼리 데이터에 apis가 있어 이 함수를 쓰지 않는다
// 이벤트 없이 apis만 받으려고 after를 아주 크게 주는 우회는 이 함수 하나에만 둔다 — 서버는 그 뒤 이벤트가 없어 events []로 준다
// 영역 조회다(?mock=region-failed로 실패한다). 마운트된 쿼리가 아니라 여는 순간 한 번, 늘 네트워크에서 받는다(staleTime 0).
// 받는 사이 화면 · 대상이 바뀌었는지는 부르는 쪽이 본다. 실패 문구는 부르는 쪽이 고정 문장으로 알린다(옛 :365)
import type { QueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { DiscoveryApi, JobOpts, JobView } from '../types';
import { keys } from './keys';
import { jobApiPath } from './useDiscoveryJob';

const AFTER_ALL_EVENTS = 999999999;

/** 근거 드로어의 재료 — 작업이 찾은 API 후보와 그 작업의 설정 */
export type EvidenceApis = Readonly<{ apis: readonly DiscoveryApi[]; opts: JobOpts }>;

export function fetchDiscoveryApis(queryClient: QueryClient, jobId: string): Promise<EvidenceApis> {
  return queryClient.fetchQuery({
    queryKey: keys.discoveryApis(jobId),
    queryFn: async ({ signal }) => {
      const view = await api.get<JobView>(`${jobApiPath(jobId)}?after=${AFTER_ALL_EVENTS}`, { region: true, signal });
      return { apis: view.apis ?? [], opts: view.opts };
    },
    staleTime: 0,
  });
}
