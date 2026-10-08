// 같은 메뉴를 다시 누르면 그 메뉴의 자료를 다시 받는다 — 옛 콘솔 nav(js/main.js:29)가 메뉴마다 다시 받던 것.
// 같은 주소로의 링크는 react-router가 화면을 다시 마운트하지 않아 refetchOnMount가 돌지 않으므로 여기서 무효화한다.
// 활성 쿼리만 다시 받으므로 다른 메뉴로 가는 링크에서 불러도 도착 화면이 한 번만 받는다.
// 부르는 곳: 셸 LNB 링크 onClick, 화면 안의 메뉴 이동 링크(대시보드 "호출 로그 보기" · 탐색 "← 원본 시스템")
import type { QueryKey } from '@tanstack/react-query';
import { keys } from '../api/hooks/keys';
import type { ScreenId } from './nav';
import { queryClient } from './queryClient';

// 변환 스튜디오 · 테스트 실행은 옛 콘솔도 다시 받지 않는다
const REFRESH_KEYS: Readonly<Partial<Record<ScreenId, readonly QueryKey[]>>> = {
  dashboard: [keys.dashboardSummary()],
  logs: [keys.logs()],
  sources: [keys.discoveryOverview()],
  deploy: [keys.toolsets()],
};

export function refreshMenu(menu: ScreenId): void {
  const targets = REFRESH_KEYS[menu] ?? [];
  for (const queryKey of targets) {
    // exact — 상세 · 서버 로그처럼 같은 접두의 하위 키는 다시 받지 않는다
    void queryClient.invalidateQueries({ queryKey, exact: true });
  }
}
