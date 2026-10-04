// apps/web/src/screens/shell/projectDraft.ts — 새 프로젝트 · 프로젝트 정보 공용 초안 로직(순수 · 불변)
import type { Project } from '../../api/types';
import { SHELL } from '../../copy/shell';

export type ProjectDraft = {
  name: string;
  description: string;
  tags: readonly string[];
  tagDraft: string;
};
export const EMPTY_DRAFT: ProjectDraft = { name: '', description: '', tags: [], tagDraft: '' };
/** 입력한 것이 하나라도 있다 — 닫을 때 저장하지 않은 변경 확인 */
export const isDraftDirty = (draft: ProjectDraft) =>
  draft.name !== '' || draft.description !== '' || draft.tags.length > 0 || draft.tagDraft !== '';
const FIRST_COPY_NUMBER = 2;

type Named = Pick<Project, 'name'>;
/** 중복 비교용 정규화: trim + 소문자 */
export const normalizeName = (value: string) => value.trim().toLowerCase();
export const isDuplicateName = (name: string, projects: readonly Named[]) =>
  normalizeName(name) !== '' && projects.some((p) => normalizeName(p.name) === normalizeName(name));

/** 가져오기 이름: `○○ 사본`, 충돌하면 ` 2` · ` 3`… */
function copyName(base: string, projects: readonly Named[]): string {
  const root = `${base}${SHELL.newProject.copySuffix}`;
  let name = root;
  for (let n = FIRST_COPY_NUMBER; isDuplicateName(name, projects); n += 1) name = `${root} ${n}`;
  return name;
}
export const draftFrom = (source: Project, projects: readonly Named[]): ProjectDraft => ({
  name: copyName(source.name, projects),
  description: source.description,
  tags: [...source.tags],
  tagDraft: '',
});
export function addTag(draft: ProjectDraft, raw: string): ProjectDraft {
  const tag = raw.trim();
  if (tag === '') return draft;
  const tags = draft.tags.includes(tag) ? draft.tags : [...draft.tags, tag];
  return { ...draft, tags, tagDraft: '' };
}
export const removeTag = (draft: ProjectDraft, tag: string): ProjectDraft => ({
  ...draft,
  tags: draft.tags.filter((t) => t !== tag),
});
export const canCreate = (draft: ProjectDraft, projects: readonly Named[]) =>
  draft.name.trim() !== '' && !isDuplicateName(draft.name, projects);
