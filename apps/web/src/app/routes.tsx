// apps/web/src/app/routes.tsx — 라우트 정의는 이 배열 하나. 셸은 레이아웃 라우트, 화면은 Outlet. _guide는 DEV에서만(따로 받는다)
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { PageBody, ScreenState } from '@/ui';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { ProjectScreen } from '../screens/project/ProjectScreen';
import { PendingScreen } from '../screens/pending/PendingScreen';
import { AppShellRoute } from '../screens/shell/AppShellRoute';
import { GUIDE } from '../copy/guide';
import { SCREENS, screenPath, type ScreenId } from './nav';

/** 샘플 화면. 화면이 없는 id는 PendingScreen — 샘플 IA의 빈 자리(채울 목록이 아니다) */
const SCREEN_ELEMENTS: Partial<Record<ScreenId, ReactNode>> = {
  dash: <DashboardScreen />,
  project: <ProjectScreen />,
};
const screenRoutes: RouteObject[] = SCREENS.map((s) => {
  const element = SCREEN_ELEMENTS[s.id] ?? <PendingScreen screen={s.id} />;
  return s.path === '/' ? { index: true, element } : { path: s.path.slice(1), element };
});

const shellRoute: RouteObject = {
  path: '/',
  element: <AppShellRoute />,
  children: [...screenRoutes, { path: '*', element: <Navigate to={screenPath('dash')} replace /> }],
};

// 카탈로그는 처음 열 때 받는다. 빌드에서는 DEV가 false라 이 분기가 사라져 번들에 들지 않는다
const GuideScreen = import.meta.env.DEV
  ? lazy(() => import('../screens/_guide/GuideScreen').then((m) => ({ default: m.GuideScreen })))
  : null;
const dev: RouteObject[] = GuideScreen
  ? [
      {
        path: '/_guide',
        element: (
          <Suspense
            fallback={
              <PageBody>
                <ScreenState kind="loading" label={GUIDE.loading} />
              </PageBody>
            }
          >
            <GuideScreen />
          </Suspense>
        ),
      },
    ]
  : [];

export const routes: RouteObject[] = [shellRoute, ...dev];
