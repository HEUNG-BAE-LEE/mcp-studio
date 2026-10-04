// apps/web/src/screens/shell/ProjectFields.tsx — 이름(중복이면 Field 검증 문구) · 설명 · 태그 입력. 폼 기본(Field — Label + 컨트롤 · 칸 gap 6, 태그 칸도 Field)
import { Field, Input, TagInput, Textarea } from '@/ui';
import { fieldMessage } from '../../copy/errors';
import { SHELL } from '../../copy/shell';
import { addTag, removeTag, type ProjectDraft } from './projectDraft';

const FIELDS = SHELL.projectFields;
const DUPLICATE_MESSAGE = fieldMessage('DUPLICATE');
const DESCRIPTION_ROWS = 2;

type Props = {
  draft: ProjectDraft;
  onChange: (next: ProjectDraft) => void;
  duplicate: boolean;
  idPrefix: string;
};

export function ProjectFields({ draft, onChange, duplicate, idPrefix }: Props) {
  const nameId = `${idPrefix}-name`;
  const descId = `${idPrefix}-desc`;
  const tagId = `${idPrefix}-tag`;
  const set = (patch: Partial<ProjectDraft>) => onChange({ ...draft, ...patch });
  return (
    <>
      <Field label={FIELDS.name} message={duplicate ? DUPLICATE_MESSAGE : undefined}>
        <Input id={nameId} value={draft.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label={FIELDS.description}>
        <Textarea
          id={descId}
          rows={DESCRIPTION_ROWS}
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </Field>
      {/* Enter(IME 조합 중 제외)로 추가 — 중복 거르기 · 입력 비우기는 addTag */}
      <Field label={FIELDS.tags}>
        <TagInput
          id={tagId}
          placeholder={FIELDS.tagPlaceholder}
          values={draft.tags}
          inputValue={draft.tagDraft}
          onInputValueChange={(tagDraft) => set({ tagDraft })}
          onAdd={(tag) => onChange(addTag(draft, tag))}
          onRemove={(tag) => onChange(removeTag(draft, tag))}
        />
      </Field>
    </>
  );
}
