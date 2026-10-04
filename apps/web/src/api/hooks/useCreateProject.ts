// apps/web/src/api/hooks/useCreateProject.ts — 프로젝트 만들기. 성공 시 상세 캐시 + 목록 무효화
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createProject } from '../dummy/projects';
import type { ProjectInput } from '../types';
import { keys } from './keys';

export function useCreateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectInput) => createProject(input),
    onSuccess: (project) => {
      client.setQueryData(keys.project(project.id), project);
      void client.invalidateQueries({ queryKey: keys.projects() });
    },
  });
}
