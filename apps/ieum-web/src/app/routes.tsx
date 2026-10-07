import type { RouteObject } from 'react-router-dom';
import { PendingScreen } from '../screens/pending/PendingScreen';
import { SCREENS } from './nav';

// 3단계에서 메뉴를 옮길 때마다 해당 행의 element를 실제 화면으로 바꾼다. 셸(레이아웃 라우트)은 T2B.5에서 감싼다
export const routes: RouteObject[] = SCREENS.map((s) => ({
  path: s.path,
  element: <PendingScreen id={s.id} />,
}));
