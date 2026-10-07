import { Navigate, type RouteObject } from 'react-router-dom';
import { PendingScreen } from '../screens/pending/PendingScreen';
import { REDIRECT_ROUTE, SCREENS, type ScreenId } from './nav';
import { RootLayout } from './RootLayout';
import { RouteError } from './RouteError';

// 3단계에서 메뉴를 옮길 때마다 해당 행의 element를 실제 화면으로 바꾼다
// 카탈로그(/_guide)는 셸 밖에 둔다 — 화면이 아니라 부품 목록이다(T2B.6)
const OUTSIDE_SHELL: ReadonlySet<ScreenId> = new Set(['guide']);

const toRoute = (s: (typeof SCREENS)[number]): RouteObject => ({ path: s.path, element: <PendingScreen id={s.id} /> });

const shellScreens = SCREENS.filter((s) => !OUTSIDE_SHELL.has(s.id)).map(toRoute);
const outsideScreens = SCREENS.filter((s) => OUTSIDE_SHELL.has(s.id)).map((s) => ({
  ...toRoute(s),
  errorElement: <RouteError />,
}));

// 없는 주소는 대시보드로 바꾼다(주소도 replace) — 옛 콘솔은 모르는 화면 이름을 대시보드로 대체한다(js/main.js:5)
// id는 nav.ts REDIRECT_ROUTE — RootLayout이 이 라우트에 걸린 주소를 마지막 주소로 기록하지 않는다
const unknownRoute: RouteObject = { id: REDIRECT_ROUTE.unknown, path: '*', element: <Navigate to="/" replace /> };
// 작업 id 없는 탐색 주소는 원본 목록으로 바꾼다(주소도 replace) — 옛 콘솔은 작업 없는 disc 화면을 src로 대체한다(js/main.js:6, D14)
const discoveryWithoutJob: RouteObject = {
  id: REDIRECT_ROUTE.discovery,
  path: '/sources/discovery',
  element: <Navigate to="/sources" replace />,
};

// 화면 예외는 안쪽 errorElement가 받아 셸 안(Outlet 자리)에 보이고, 셸 자체의 예외는 바깥 errorElement가 받는다
const shellRoute: RouteObject = {
  element: <RootLayout />,
  errorElement: <RouteError />,
  children: [{ errorElement: <RouteError />, children: [...shellScreens, discoveryWithoutJob, unknownRoute] }],
};

export const routes: RouteObject[] = [shellRoute, ...outsideScreens];
