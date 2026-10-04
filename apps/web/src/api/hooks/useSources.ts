// apps/web/src/api/hooks/useSources.ts — 프로젝트의 소스 목록 (프로젝트 상세 소스 열)
import { useQuery } from '@tanstack/react-query';
import { fetchSources } from '../dummy/sources';
import { keys } from './keys';

export function useSources(projectId: string) {
  return useQuery({
    queryKey: keys.sources(projectId),
    queryFn: () => fetchSources(projectId),
  });
}
