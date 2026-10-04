// apps/web/src/api/hooks/useProjectSummary.ts — 프로젝트 요약 (프로젝트 상세 요약 밴드)
import { useQuery } from '@tanstack/react-query';
import { fetchProjectSummary } from '../dummy/projectSummary';
import { keys } from './keys';

export function useProjectSummary(projectId: string) {
  return useQuery({
    queryKey: keys.projectSummary(projectId),
    queryFn: () => fetchProjectSummary(projectId),
  });
}
