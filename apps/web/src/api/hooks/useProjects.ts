// apps/web/src/api/hooks/useProjects.ts — 프로젝트 목록. 키는 필터를 포함한다
import { useQuery } from '@tanstack/react-query';
import { fetchProjects } from '../dummy/projects';
import { keys, type ProjectsFilter } from './keys';

export function useProjects(filter?: ProjectsFilter) {
  return useQuery({
    queryKey: keys.projects(filter),
    queryFn: () => fetchProjects(filter),
  });
}
