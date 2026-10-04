// apps/web/src/api/dummy/projects.ts — 프로젝트 목록 · 상세 · 만들기. 만든 프로젝트는 모듈 상태(재할당, 불변)
import type { Project, ProjectInput } from '../types';
import { PROJECTS, guideProject } from './data/projects';
import { ERROR_CODE, FIELD_REASON, STATUS, apiError, notFoundError, respond } from './error';
import { getScenario } from './scenario';

type ProjectsQuery = Readonly<{ q?: string; scope?: string }>;

let created: readonly Project[] = [];
/** 같은 ms 충돌이 없는 순번 id(project_new_13 …) */
const nextId = () => `project_new_${PROJECTS.length + created.length + 1}`;
const all = (): readonly Project[] =>
  getScenario() === 'empty' ? created : [...PROJECTS, ...created];
const normalize = (name: string) => name.trim().toLowerCase();

const inScope = (scope: string | undefined) => (p: Project) =>
  scope === 'shared' ? p.shared : scope === 'mine' ? !p.shared : true;

const getProject = (id: string): Project => {
  const found = all().find((p) => p.id === id);
  if (!found) throw notFoundError();
  return found;
};
/** 프로젝트가 있는지(소스 · 커넥터 더미가 쓴다) — 화면에서 만든 프로젝트도 포함한다(getProject와 같은 목록) */
export const hasProject = (id: string) => all().some((p) => p.id === id);

export const fetchProjects = ({ q = '', scope }: ProjectsQuery = {}): Promise<Project[]> =>
  respond(
    () => {
      const needle = normalize(q);
      return all()
        .filter(inScope(scope))
        .filter((p) => needle === '' || p.name.toLowerCase().includes(needle));
    },
    { region: true },
  );

export const fetchProject = (id: string): Promise<Project> =>
  respond(() => {
    const found = getProject(id);
    // empty-guide: 상세만 가이드 프로젝트로 바뀐다(목록 · LNB는 그대로)
    return getScenario() === 'empty-guide' ? guideProject(found) : found;
  });

export const createProject = (input: ProjectInput): Promise<Project> =>
  respond(
    () => {
      const name = input.name.trim();
      if (name === '')
        throw apiError(STATUS.BAD_REQUEST, ERROR_CODE.VALIDATION, { name: FIELD_REASON.REQUIRED });
      if (all().some((p) => normalize(p.name) === normalize(name)))
        throw apiError(STATUS.CONFLICT, ERROR_CODE.NAME_DUPLICATE, {
          name: FIELD_REASON.DUPLICATE,
        });
      const now = new Date().toISOString();
      const project: Project = {
        id: nextId(),
        name,
        description: input.description ?? '',
        tags: input.tags ?? [],
        shared: false,
        sourceCount: 0,
        connectorCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      created = [...created, project];
      return project;
    },
    { write: true },
  );
