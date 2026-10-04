// apps/web/src/screens/shell/ShellNewProject.tsx — 새 프로젝트 데이터 · 생성: ['projects'] + POST → /projects/:id
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '@/api/errors';
import { useCreateProject } from '../../api/hooks/useCreateProject';
import { useProjects } from '../../api/hooks/useProjects';
import type { ProjectInput } from '../../api/types';
import { projectPath } from '../../app/nav';
import { useAppStore } from '../../app/store';
import { errorRaw } from '../../copy/errors';
import { NewProjectDialog } from './NewProjectDialog';

const DUPLICATE_REASON = 'DUPLICATE';

export function ShellNewProject({ container }: { container: HTMLElement | null }) {
  const open = useAppStore((s) => s.overlay === 'new-project');
  const closeOverlay = useAppStore((s) => s.closeOverlay);
  const projects = useProjects();
  const create = useCreateProject();
  const navigate = useNavigate();
  const [duplicateFromServer, setDuplicateFromServer] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const clearErrors = () => {
    setDuplicateFromServer(false);
    setFailure(null);
  };
  const onCreate = async (input: ProjectInput) => {
    // 요청 중이면 다시 보내지 않는다(DESIGN 접근성 — 요청 중 · 완료 뒤)
    if (create.isPending) return;
    clearErrors();
    try {
      const project = await create.mutateAsync(input);
      closeOverlay();
      void navigate(projectPath(project.id));
    } catch (error) {
      if (error instanceof ApiError && error.fields?.name === DUPLICATE_REASON) {
        setDuplicateFromServer(true);
        return;
      }
      setFailure(errorRaw(error));
    }
  };
  return (
    <NewProjectDialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        clearErrors();
        closeOverlay();
      }}
      projects={projects.data ?? []}
      onCreate={onCreate}
      busy={create.isPending}
      duplicateFromServer={duplicateFromServer}
      errorRaw={failure}
      container={container}
    />
  );
}
