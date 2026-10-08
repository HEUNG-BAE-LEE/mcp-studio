// RootLayout — 모든 화면을 감싸는 레이아웃 라우트. 셸(shell/Shell — 레일 · GNB · LNB)을 그리고, 셸이 본문 자리에 Outlet을 그린다.
// 앱에 하나인 토스트를 셸 옆에 붙인다(값은 app/toast 저장소, 그리기는 ui Toast). 여러 화면이 여는 층(드로어 · 모달 칸)도 셸 옆 LayerHost가 그린다
// 위치가 바뀔 때 두 가지를 한다:
// - 메뉴별 마지막 주소 기록(app/lastPath — LNB는 useMenuHref로 읽는다). 바꾸기 라우트(nav.ts REDIRECT_ROUTE_IDS)에 걸린 주소는 건너뛴다 —
//   자식 <Navigate>가 이동을 예약한 같은 커밋에서 이 effect가 옛 주소로 돌기 때문(/sources/bogus가 원본 메뉴 주소로 남던 것)
// - 첫 경로 조각이 바뀔 때만 맨 위로 스크롤(옛 js/main.js:15의 go와 같음). 같은 조각 안 이동(탐색 작업 열기 · 뒤로)과
//   검색 파라미터만 바뀐 것은 스크롤을 둔다. 스크롤 대상은 window다 — 셸이 본문 영역 스크롤로 바뀌면 대상을 바꾼다
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useMatches } from 'react-router-dom';
import { Toast } from '@/ui';
import { LayerHost } from './LayerHost';
import { recordLastPath } from './lastPath';
import { REDIRECT_ROUTE_IDS, firstSegment } from './nav';
import { Shell } from './shell/Shell';
import { dismissToast, useToastItem } from './toast';

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

/** 토스트 한 칸 — 따로 둬서 토스트가 바뀔 때 셸이 다시 그려지지 않게 한다 */
function AppToast() {
  return <Toast item={useToastItem()} onDone={dismissToast} />;
}

export function RootLayout() {
  const { pathname, search } = useLocation();
  useScrollTopOnSegmentChange(pathname);
  const leafId = useMatches().at(-1)?.id;
  const isRedirect = leafId !== undefined && REDIRECT_ROUTE_IDS.has(leafId);
  useEffect(() => {
    if (!isRedirect) recordLastPath(pathname, search);
  }, [pathname, search, isRedirect]);
  return (
    <>
      <Shell />
      <LayerHost />
      <AppToast />
    </>
  );
}
