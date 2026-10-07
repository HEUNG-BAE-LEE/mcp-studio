// RootLayout — 모든 화면을 감싸는 레이아웃 라우트. 지금은 Outlet만 그린다.
// 디자인 세션의 src/app/shell/Shell.tsx(레일 · GNB · LNB)가 생기면 그것으로 Outlet을 감싼다(T2B.5)
// 위치가 바뀔 때 두 가지를 한다(D12 Q10 · R22):
// - 메뉴별 마지막 주소 기록(app/lastPath — LNB는 useMenuHref로 읽는다). 바꾸기 라우트(nav.ts REDIRECT_ROUTE_IDS)에 걸린 주소는 건너뛴다 —
//   자식 <Navigate>가 이동을 예약한 같은 커밋에서 이 effect가 옛 주소로 돌기 때문(/sources/bogus가 원본 메뉴 주소로 남던 것)
// - 첫 경로 조각이 바뀔 때만 맨 위로 스크롤. 같은 조각 안 이동(탐색 작업 열기 · 뒤로)과 검색 파라미터만 바뀐 것은 스크롤을 둔다(Q10-c)
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation, useMatches } from 'react-router-dom';
import { recordLastPath } from './lastPath';
import { REDIRECT_ROUTE_IDS, firstSegment } from './nav';

/** 첫 렌더는 브라우저 스크롤을 그대로 두고, 그 뒤 첫 조각이 바뀌면 그려지기 전에 맨 위로 */
function useScrollTopOnSegmentChange(pathname: string) {
  const segment = firstSegment(pathname);
  const previous = useRef(segment);
  useLayoutEffect(() => {
    if (previous.current === segment) return;
    previous.current = segment;
    window.scrollTo({ top: 0 });
  }, [segment]);
}

export function RootLayout() {
  const { pathname, search } = useLocation();
  useScrollTopOnSegmentChange(pathname);
  const leafId = useMatches().at(-1)?.id;
  const isRedirect = leafId !== undefined && REDIRECT_ROUTE_IDS.has(leafId);
  useEffect(() => {
    if (!isRedirect) recordLastPath(pathname, search);
  }, [pathname, search, isRedirect]);
  return <Outlet />;
}
