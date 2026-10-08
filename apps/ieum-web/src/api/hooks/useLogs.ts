// 호출 로그 목록(GET /logs/)과 한 건(GET /logs/{id}/). 서버 시각(epoch 초)은 select에서 epoch ms로 한 번 바꾼다(api/time.ts).
// 캐시에는 서버 모양(초)이 남는다 — select만 ms로 바꾸므로 setQueryData로 값을 넣을 때도 서버 모양을 넣는다
import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { secToMs } from '../time';
import type { LogDetail, LogRow, LogsResponse } from '../types';
import { keys } from './keys';

const LOGS_PATH = '/logs/';
// 로그 id는 uuid4 hex의 앞 12자다(repositories/logs.py). 주소 값은 믿을 수 없는 입력이라 요청 전에 이 모양인지 본다 —
// `..` 같은 점 세그먼트는 브라우저가 경로를 정규화해 다른 자원으로 가므로 encodeURIComponent만으로는 막지 못한다
const LOG_ID_PATTERN = /^[0-9a-f]{12}$/;

/** 로그 id 모양(12자 hex)인지. 맞지 않으면 요청하지 않고 상세 실패 경로로 보낸다(주소 `?log=` 판정에도 쓴다) */
export const isLogId = (id: string | null | undefined): id is string => id != null && LOG_ID_PATTERN.test(id);

const withMsTs = <T extends Readonly<{ ts: number }>>(row: T): T => ({ ...row, ts: secToMs(row.ts) });
const toRows = (data: LogsResponse): readonly LogRow[] => data.rows.map(withMsTs);
const toDetail = (data: LogDetail): LogDetail => withMsTs(data);

/** 목록은 파라미터 없이 받고 필터 · 검색은 화면이 거른다. 화면 조회라 실패하면 본문 자리에 보인다 */
export function useLogs() {
  return useQuery({
    queryKey: keys.logs(),
    queryFn: ({ signal }) => api.get<LogsResponse>(LOGS_PATH, { signal }),
    // 메뉴에 들어올 때마다 새로 받는다(옛 js/main.js:29). 폴링은 없다
    refetchOnMount: 'always',
    select: toRows,
  });
}

/**
 * 상세는 열 때마다 새로 받는다(옛 js/menu/logs.js:30 — 행을 누를 때마다 GET).
 * staleTime · gcTime을 0으로 두어 같은 행을 다시 열어도, 키만 바뀌어도 캐시를 그대로 쓰지 않는다.
 * trace는 null이면 null 그대로 둔다 — 변환 과정을 남기지 못한 호출의 신호다
 */
export function useLogDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: keys.log(id ?? ''),
    queryFn: ({ signal }) =>
      api.get<LogDetail>(`${LOGS_PATH}${encodeURIComponent(id ?? '')}/`, { region: true, signal }),
    enabled: isLogId(id),
    staleTime: 0,
    gcTime: 0,
    select: toDetail,
  });
}
