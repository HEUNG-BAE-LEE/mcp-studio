import { QueryClient } from '@tanstack/react-query';
import { ApiError, NETWORK_STATUS } from '../api/errors';
import { isFailureScenario } from '../api/scenario';

const MAX_RETRY = 1;
const HTTP_SERVER_ERROR = 500;
const STALE_MS = 30_000;

/** 5xx · 네트워크 실패만 1회 재시도. 4xx와 ?mock 실패 시나리오는 재시도하지 않는다 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (import.meta.env.DEV && isFailureScenario()) return false;
  if (error instanceof ApiError && error.status !== NETWORK_STATUS && error.status < HTTP_SERVER_ERROR) return false;
  return failureCount < MAX_RETRY;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: STALE_MS, retry: shouldRetry },
    mutations: { retry: 0 },
  },
});
