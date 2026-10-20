// 묶음 서버 로그(GET /deploy/toolsets/{id}/logs/?lines=300). 영역 조회 — 실패는 화면을 막지 않는다(?mock=region-failed로 실패한다).
// 마운트된 쿼리가 아니다: "서버 로그" 버튼과 로그 창의 "새로 읽기"가 누를 때마다 네트워크에서 받는다(옛 tsLog — js/menu/deploy.js:165-171).
// staleTime 0이라 캐시가 있어도 늘 받는다. 실패는 던진다 — 경고 토스트는 부르는 쪽(app/deploy/serverLog)
import type { QueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { ToolsetLogs } from '../types';
import { keys } from './keys';
import { toolsetApiPath } from './useToolsets';

/** 옛 화면이 받던 줄 수(js/menu/deploy.js:166) — 서버 기본값(200)이 아니다 */
const LOG_LINES = 300;

const logsPath = (toolsetId: string) => `${toolsetApiPath(toolsetId)}logs/?lines=${LOG_LINES}`;

export function fetchToolsetLogs(queryClient: QueryClient, toolsetId: string): Promise<ToolsetLogs> {
  return queryClient.fetchQuery({
    queryKey: keys.toolsetLogs(toolsetId),
    queryFn: ({ signal }) => api.get<ToolsetLogs>(logsPath(toolsetId), { region: true, signal }),
    staleTime: 0,
  });
}
