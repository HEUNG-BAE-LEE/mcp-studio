// 쿼리 · mutation 모두 재시도하지 않는다 — 옛 콘솔 js/common/api.js:5-15에 재시도가 없다.
// 실패는 바로 쿼리 상태로 돌려주고, 보이는 자리는 app/screenGate의 판정을 따른다
// 탭 포커스 · 네트워크 복귀 때 다시 받지 않는다 — 옛 콘솔에 없는 요청이다(옛 콘솔과 호출이 달라지지 않게, 보이지 않는 실패를 늘리지 않게).
// 자원 신선도는 두 가지다(옛 콘솔과 요청이 같아지게):
// - 부팅 자원(원본 · 도구 · 테스트 실행 설정): 옛은 부팅 때 한 번 받고(js/common/api.js:24-37) 그 뒤에는 메모리만 고쳤다.
//   처음 필요한 화면이 받고 BOOT_STALE_TIME으로 다시 받지 않는다. 쓰기 뒤에는 응답으로 setQueryData — 무효화하지 않는다
// - 진입 자원(대시보드 요약 · 로그 · 탐색 개요 · 묶음 · 키): 옛은 메뉴에 들어올 때마다 받았다(js/main.js:29).
//   그 훅에서 refetchOnMount: 'always'로 맞추고, 같은 메뉴를 다시 누르면 app/menuRefresh가 새로 받는다
import { QueryClient } from '@tanstack/react-query';

const STALE_MS = 30_000;
/** 부팅 자원의 staleTime — 한 번 받으면 쓰기 응답으로만 고친다 */
export const BOOT_STALE_TIME = Infinity;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: STALE_MS, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
    mutations: { retry: false },
  },
});
