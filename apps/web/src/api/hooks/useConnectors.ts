// apps/web/src/api/hooks/useConnectors.ts — 프로젝트의 커넥터 목록 (프로젝트 상세 커넥터 열)
import { useQuery } from '@tanstack/react-query';
import { fetchConnectors } from '../dummy/connectors';
import { keys } from './keys';

export function useConnectors(projectId: string) {
  return useQuery({
    queryKey: keys.connectors(projectId),
    queryFn: () => fetchConnectors(projectId),
  });
}
