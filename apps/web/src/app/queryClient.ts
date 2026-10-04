import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/errors';
import { isFailureScenario } from '../api/dummy/scenario';

const MAX_RETRY = 1;
const HTTP_SERVER_ERROR = 500;

// 5xx는 1회(~1s) 재시도한 뒤 실패를 보인다 — 단 실패 시나리오(?mock=failed · write-failed · region-failed)는 재시도 없이 더미 지연 뒤 바로 뜬다
/** 5xx · 네트워크만 재시도한다. 4xx(404 찾을 수 없음 등)는 다시 물어도 결과가 같다 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  // 숨은 탭에서는 TanStack이 재시도를 멈춰 실패 상태가 영영 안 뜬다 — 실패 시나리오는 재시도하지 않는다
  if (isFailureScenario()) return false;
  if (error instanceof ApiError && error.status < HTTP_SERVER_ERROR) return false;
  return failureCount < MAX_RETRY;
}

// staleTime 30s · GET만 1회 재시도(4xx 제외), 변경 요청은 재시도하지 않는다
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: shouldRetry },
    mutations: { retry: 0 },
  },
});
