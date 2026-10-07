// 쿼리 · mutation 모두 재시도하지 않는다 — 옛 콘솔 js/common/api.js:5-15에 재시도가 없다(D11 Q7-f, 설계 3절 데이터 층).
// 실패는 바로 쿼리 상태로 돌려주고, 보이는 자리는 app/screenGate의 판정을 따른다
// 탭 포커스 · 네트워크 복귀 때 다시 받지 않는다 — 옛 콘솔에 없는 요청이다(4-A 호출 대조, Q7-a의 보이지 않는 실패를 늘리지 않게).
// 메모(3단계): 화면에 들어올 때마다 새로 받는 곳(대시보드 refreshDash · 로그 refreshLogs)은 그 훅에서
// staleTime: 0이나 refetchOnMount: 'always'로 맞춘다 — 기본 staleTime 30초면 30초 안에 다시 들어올 때 받지 않는다
import { QueryClient } from '@tanstack/react-query';

const STALE_MS = 30_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: STALE_MS, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
    mutations: { retry: false },
  },
});
