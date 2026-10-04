// apps/web/src/api/hooks/useNotifications.ts — 알림 묶음. staleTime 0(실시간이 갱신)
import { useQuery } from '@tanstack/react-query';
import { fetchNotifications } from '../dummy/notifications';
import { keys } from './keys';

export function useNotifications() {
  return useQuery({
    queryKey: keys.notifications(),
    queryFn: () => fetchNotifications(),
    staleTime: 0,
  });
}
