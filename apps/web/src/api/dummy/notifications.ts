// apps/web/src/api/dummy/notifications.ts — 알림(시나리오별 묶음)
import type { NotificationGroups } from '../types';
import { notificationsOf } from './data/notifications';
import { respond } from './error';
import { getScenario } from './scenario';

export const fetchNotifications = (): Promise<NotificationGroups> =>
  respond(() => notificationsOf(getScenario()), { region: true });
