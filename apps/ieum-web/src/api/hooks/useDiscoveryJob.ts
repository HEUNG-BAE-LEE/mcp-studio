// 자동 탐색 작업 하나(GET /discovery/jobs/{id}/?after=<seq>) — 작업 화면의 주 자원이다. 없는 id면 404라 화면은 없음 상태로 본다
// (screenGate({ job }, { notFound: job })). 옛 discOpenJob · discPoll(js/menu/discovery.js:140-164)과 같게:
// - 처음 열 때는 after=0부터 more가 false일 때까지 after=<받은 seq>로 이어 받아 한 번에 돌려준다 — 그동안 화면은 비우고 aria-busy
// - 그 뒤 폴링은 한 번에 요청 하나다. more여도 이어 받지 않고 다음 주기에 받는다(옛 :156-159)
// - 받은 이벤트는 쿼리 데이터 안에 쌓는다(api/discoveryJob mergeJob). 다음 after인 seq도 데이터 안이다
// - 작업마다 키가 따로라 다른 작업의 응답이 섞이지 않는다. gcTime 0이라 화면을 떠나면 버리고, 다시 열면 after=0부터다(옛도 열 때마다 처음부터 — :141)
// - 폴링 간격: running 700ms · scheduled/queued 4초 · 그 밖은 멈춤. 옛은 "응답 뒤 타이머"였고 여기는 "간격(앞 요청이 진행 중이면 건너뜀)"이다.
//   숨은 탭에서는 멈췄다가 돌아오면 after로 이어 받는다. 화면을 떠나면 멈춘다(옛은 떠나도 돌았다)
// - 폴링 실패는 표시 없이 이전 값으로 그린다(app/screenGate). 재시도는 없다(app/queryClient)
// - 받는 동안 화면을 떠나면 요청을 끊는다(signal) — 쌓던 값은 버려진다
import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { mergeJob, type JobData } from '../discoveryJob';
import type { JobStatus, JobView } from '../types';
import { keys } from './keys';

const POLL_RUNNING_MS = 700;
const POLL_WAITING_MS = 4000;
const RUNNING_STATUS = 'running';
/** 시작을 기다리는 상태 — queued는 서버가 만들 때 잠깐 쓰는 값이라 화면 목록에는 없고 폴링 간격에만 있다 */
const WAITING_STATUSES: ReadonlySet<string> = new Set(['scheduled', 'queued']);

/** 작업 하나의 경로(끝 슬래시 포함). 쓰기 · 근거 조회도 이 아래를 쓴다 */
export const jobApiPath = (jobId: string): string => `/discovery/jobs/${encodeURIComponent(jobId)}/`;

const viewPath = (jobId: string, after: number): string => `${jobApiPath(jobId)}?after=${after}`;

function pollIntervalOf(status: JobStatus | undefined): number | false {
  if (status === RUNNING_STATUS) return POLL_RUNNING_MS;
  if (status !== undefined && WAITING_STATUSES.has(status)) return POLL_WAITING_MS;
  return false;
}

/** 캐시에 쌓인 값이 있으면 그 seq 뒤로 한 번, 없으면(처음 열기) more가 끝날 때까지 이어 받는다 */
async function fetchJob(client: QueryClient, jobId: string, signal: AbortSignal): Promise<JobData> {
  const prev = client.getQueryData<JobData>(keys.discoveryJob(jobId));
  const first = await api.get<JobView>(viewPath(jobId, prev?.seq ?? 0), { signal });
  let data = mergeJob(prev, first);
  if (prev !== undefined) return data;
  let more = first.more;
  while (more) {
    const after = data.seq;
    const next = await api.get<JobView>(viewPath(jobId, after), { signal });
    data = mergeJob(data, next);
    // seq가 나아가지 않는 응답이면 멈춘다 — 같은 after로 끝없이 부르지 않게
    more = next.more && data.seq > after;
  }
  return data;
}

export const discoveryJobQuery = (jobId: string) =>
  queryOptions({
    queryKey: keys.discoveryJob(jobId),
    queryFn: ({ client, signal }) => fetchJob(client, jobId, signal),
    gcTime: 0,
    // mergeJob이 바뀌지 않은 배열은 같은 참조로 두므로 구조 공유는 끈다 — 쌓인 기록(최대 3000줄)을 폴링마다 깊게 비교하지 않게
    structuralSharing: false,
    refetchInterval: (query) => pollIntervalOf(query.state.data?.status),
    refetchIntervalInBackground: false,
  });

export function useDiscoveryJob(jobId: string) {
  return useQuery(discoveryJobQuery(jobId));
}
