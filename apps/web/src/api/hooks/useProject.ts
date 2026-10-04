// apps/web/src/api/hooks/useProject.ts — 프로젝트 상세
import { useQuery } from '@tanstack/react-query';
import { fetchProject } from '../dummy/projects';
import { keys } from './keys';

export function useProject(projectId: string) {
  return useQuery({
    queryKey: keys.project(projectId),
    queryFn: () => fetchProject(projectId),
  });
}
