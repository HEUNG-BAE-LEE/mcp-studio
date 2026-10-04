// apps/web/src/screens/shell/NewProjectDialog.tsx — 새 프로젝트 다이얼로그(표시 · 초안 상태). 데이터 · 생성은 ShellNewProject
import { useId, useState } from 'react';
import {
  Button,
  ErrorBlock,
  Field,
  Modal,
  Select,
  VisuallyHidden,
  useUnsavedClose,
  type ModalScrim,
} from '@/ui';
import type { Project, ProjectInput } from '../../api/types';
import { projectGroupLabel } from '../../app/nav';
import { CANCEL_LABEL } from '../../copy/common';
import { SHELL } from '../../copy/shell';
import { platform } from '../../platform';
import { ProjectFields } from './ProjectFields';
import {
  EMPTY_DRAFT,
  canCreate,
  draftFrom,
  isDraftDirty,
  isDuplicateName,
  normalizeName,
  type ProjectDraft,
} from './projectDraft';

const COPY = SHELL.newProject;
/** Radix Select는 빈 value를 못 쓴다 — "가져오지 않음" 항목의 값 */
const NONE_VALUE = '__none__';

type NewProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: readonly Project[];
  onCreate: (input: ProjectInput) => void | Promise<void>;
  busy?: boolean;
  /** 서버가 중복(409)을 돌려줬다 — 보낸 이름 그대로인 동안만 표식 유지(이름을 고치면 다시 생성 가능) */
  duplicateFromServer?: boolean;
  /** 그 밖의 실패 원문(ErrorBlock) */
  errorRaw?: string | null;
  container?: HTMLElement | null;
  focusOnOpen?: boolean;
  scrim?: ModalScrim;
};

export function NewProjectDialog({
  open,
  onOpenChange,
  projects,
  onCreate,
  busy = false,
  duplicateFromServer = false,
  errorRaw = null,
  container,
  focusOnOpen,
  scrim,
}: NewProjectDialogProps) {
  const id = useId();
  const [source, setSource] = useState('');
  const [draft, setDraft] = useState<ProjectDraft>(EMPTY_DRAFT);
  const [imported, setImported] = useState<Project | null>(null);
  const [submittedName, setSubmittedName] = useState('');
  const [wasOpen, setWasOpen] = useState(open);

  const reset = () => {
    setSource('');
    setDraft(EMPTY_DRAFT);
    setImported(null);
    setSubmittedName('');
  };
  // 열 때마다 새로 시작한다 — open prop이 닫힘으로 바뀌면(취소 · Esc · 생성 성공 모두) 비운다.
  // effect 대신 렌더 중 이전 값 비교(React 권장 패턴)라 닫힌 뒤 한 번 더 그리지 않는다
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) reset();
  }
  // ✕ · Esc · 바깥 클릭 · 취소 — 입력한 것이 있으면 확인 Dialog(DESIGN 층 선택 · 저장하지 않은 변경). 생성 중엔 닫지 않는다(취소 비활성).
  // open을 넘긴다 — 층이 밖에서 닫혀도(경로 이동) 확인 Dialog가 남지 않는다
  const unsaved = useUnsavedClose({
    isDirty: source !== '' || isDraftDirty(draft),
    isBusy: busy,
    onClose: () => onOpenChange(false),
    open,
    container,
  });
  const handleOpenChange = (next: boolean) => {
    if (next) onOpenChange(true);
    else unsaved.requestClose();
  };
  const pick = (value: string) => {
    const project = projects.find((p) => p.id === value);
    if (value === NONE_VALUE || !project) {
      reset();
      return;
    }
    setSource(value);
    setDraft(draftFrom(project, projects));
    setImported(project);
  };
  const options = [
    { value: NONE_VALUE, label: COPY.importNone },
    ...projects.map((p) => ({ value: p.id, label: p.name, group: projectGroupLabel(p) })),
  ];
  const isServerDuplicate =
    duplicateFromServer && normalizeName(draft.name) === normalizeName(submittedName);
  const duplicate = isDuplicateName(draft.name, projects) || isServerDuplicate;
  const isReady = canCreate(draft, projects) && !isServerDuplicate && !busy;
  const submit = () => {
    if (!isReady) return;
    setSubmittedName(draft.name);
    void onCreate({
      name: draft.name.trim(),
      description: draft.description,
      tags: [...draft.tags],
    });
  };
  return (
    <>
      <Modal
        kind="form"
        open={open}
        onOpenChange={handleOpenChange}
        title={COPY.title}
        container={container}
        focusOnOpen={focusOnOpen}
        scrim={scrim}
        // 발 한 줄(DESIGN 권한 — 발 한 줄 우선순위) — 권한 사유가 없는 폼이라 저장하지 않은 변경만
        footer={{
          note: unsaved.note ?? undefined,
          actions: (
            <>
              <Button disabled={busy} onClick={() => handleOpenChange(false)}>
                {CANCEL_LABEL}
              </Button>
              <Button variant="primary" disabled={!isReady} loading={busy} onClick={submit}>
                {busy ? COPY.creating : COPY.create}
              </Button>
            </>
          ),
        }}
      >
        <Field
          label={COPY.importLabel}
          description={imported ? COPY.importNote(imported.name) : undefined}
        >
          <Select
            size="xl"
            options={options}
            placeholder={COPY.importNone}
            value={source}
            onValueChange={pick}
          />
        </Field>
        {/* 가져오기 결과는 칸 설명(live 아님) — 알림은 늘 마운트된 시각 숨김 status 한 줄이 한다(DESIGN 즉시 실행 완료) */}
        <VisuallyHidden role="status">
          {imported ? COPY.importNote(imported.name) : null}
        </VisuallyHidden>
        <ProjectFields draft={draft} onChange={setDraft} duplicate={duplicate} idPrefix={id} />
        {errorRaw ? <ErrorBlock raw={errorRaw} onCopy={() => platform.copyText(errorRaw)} /> : null}
      </Modal>
      {unsaved.dialog}
    </>
  );
}
