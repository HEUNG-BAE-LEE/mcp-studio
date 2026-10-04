// apps/web/src/screens/shell/buildNav.ts — 라우트 · 프로젝트 목록 · 그룹 토글 → LNBPanel 데이터(순수)
import type { NavItem, NavSection } from '@/ui';
import type { Project } from '../../api/types';
import {
  PROJECT_GROUPS,
  TOP_NAV,
  WORK_GROUPS,
  isGroupExpanded,
  projectGroupId,
  projectNavId,
  projectPath,
  type RouteMatch,
} from '../../app/nav';
import type { PermissionState } from '../../app/user/usePermission';
import { SHELL } from '../../copy/shell';

type ActiveIds = { navId: string | null; groupId: string | null };
/** 프로젝트 화면이면 현재 프로젝트 항목 + 그 그룹, 아니면 화면의 navId · groupId */
export function activeIds(match: RouteMatch | null, projects: readonly Project[]): ActiveIds {
  const projectId = match?.params.projectId;
  if (projectId) {
    const project = projects.find((p) => p.id === projectId);
    return { navId: projectNavId(projectId), groupId: project ? projectGroupId(project) : null };
  }
  return { navId: match?.screen.navId ?? null, groupId: match?.screen.groupId ?? null };
}

type NavContext = {
  projects: readonly Project[];
  groupToggles: Readonly<Record<string, boolean>>;
  onNewProject: () => void;
  newProject: PermissionState;
};

export function buildTopItems(
  { onNewProject, newProject }: NavContext,
  active: ActiveIds,
): NavItem[] {
  return TOP_NAV.map((t) => {
    if (t.path === undefined) {
      return {
        id: t.id,
        label: t.label,
        icon: t.icon,
        onClick: onNewProject,
        title: newProject.reason ?? t.label,
        disabled: !newProject.allowed,
      };
    }
    return {
      id: t.id,
      label: t.label,
      icon: t.icon,
      href: t.path,
      active: active.navId === t.id,
      ...(t.pending ? { pending: SHELL.nav.pending } : {}),
    };
  });
}

export function buildSections(
  { projects, groupToggles }: NavContext,
  active: ActiveIds,
): NavSection[] {
  const expanded = (id: string) => isGroupExpanded(id, groupToggles, active.groupId);
  return [
    {
      id: 'work',
      label: SHELL.nav.workSection,
      groups: WORK_GROUPS.map((g) => ({
        id: g.id,
        label: g.label,
        icon: g.icon,
        expanded: expanded(g.id),
        items: g.items.map((it) => ({
          id: it.id,
          label: it.label,
          active: active.navId === it.id,
          ...(it.path === undefined ? { pending: true } : { href: it.path }),
        })),
      })),
    },
    {
      id: 'projects',
      label: SHELL.nav.projectsSection,
      groups: PROJECT_GROUPS.map((g) => ({
        id: g.id,
        label: g.label,
        icon: g.icon,
        expanded: expanded(g.id),
        items: projects
          .filter((p) => projectGroupId(p) === g.id)
          .map((p) => ({
            id: projectNavId(p.id),
            label: p.name,
            href: projectPath(p.id),
            active: active.navId === projectNavId(p.id),
          })),
      })),
    },
  ];
}
