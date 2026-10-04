// apps/web/src/app/user/useCurrentUser.ts — ['user'] 쿼리. 세션 동안 바뀌지 않는다
import { useQuery } from '@tanstack/react-query';
import { keys } from '../../api/hooks/keys';
import { fetchUser } from '../../api/dummy/user';

export function useCurrentUser() {
  return useQuery({
    queryKey: keys.user(),
    queryFn: () => fetchUser(),
    staleTime: Infinity,
  });
}
