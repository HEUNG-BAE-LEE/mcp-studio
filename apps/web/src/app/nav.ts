// apps/web/src/app/nav.ts — 내비게이션 트리를 데이터로(라우트 매칭 · 그룹 펼침 · 검색 · 알림 입구). 트리 내용은 샘플 IA다 — 언제든 바뀐다(DESIGN 용어집)
import type { IconName } from '@/ui';
import { generatePath, matchPath } from 'react-router';
import type { ActionTarget, Project } from '../api/types';

export type ScreenId =
  'dash' | 'project' | 'source' | 'connector' | 'onto' | 'ds' | 'sql' | 'pipe' | 'play';
type Screen = {
  id: ScreenId;
  path: string;
  /** 화면 이름 — PendingScreen 제목 */
  title: string;
  /** LNB 현재 항목 id(상위 · 하위). 프로젝트 화면은 null — 현재 프로젝트 항목이 대신 활성 */
  navId: string | null;
  /** 자동으로 펼칠 작업 영역 그룹 */
  groupId: string | null;
};

/** 라우트 표. 순서 = 라우트 등록 순서 */
export const SCREENS: readonly Screen[] = [
  { id: 'dash', path: '/', title: '대시보드', navId: 'dash', groupId: null },
  {
    id: 'project',
    path: '/projects/:projectId',
    title: '프로젝트 상세',
    navId: null,
    groupId: null,
  },
  {
    id: 'source',
    path: '/projects/:projectId/sources/:sourceId',
    title: '소스 상세',
    navId: null,
    groupId: null,
  },
  {
    id: 'connector',
    path: '/projects/:projectId/connectors/:connectorId',
    title: '커넥터 구성',
    navId: null,
    groupId: null,
  },
  {
    id: 'onto',
    path: '/ontology/manager',
    title: '온톨로지 매니저',
    navId: 'onto-manager',
    groupId: 'onto',
  },
  {
    id: 'ds',
    path: '/data/sources',
    title: '데이터 소스',
    navId: 'ds',
    groupId: 'proc',
  },
  {
    id: 'sql',
    path: '/data/sql',
    title: 'SQL 스튜디오',
    navId: 'sql',
    groupId: 'proc',
  },
  {
    id: 'pipe',
    path: '/data/pipeline',
    title: '파이프라인 빌더 · RAG 설정',
    navId: 'pipe',
    groupId: 'proc',
  },
  {
    id: 'play',
    path: '/playground',
    title: 'Playground',
    navId: 'play',
    groupId: null,
  },
];

const SCREEN_BY_ID = Object.fromEntries(SCREENS.map((s) => [s.id, s])) as Record<ScreenId, Screen>;
export const screenPath = (id: ScreenId) => SCREEN_BY_ID[id].path;
export const screenTitle = (id: ScreenId) => SCREEN_BY_ID[id].title;

type TopNavItem = {
  id: string;
  label: string;
  icon: IconName;
  path?: string;
  pending?: boolean;
};
/** LNBPanel 상위 항목. `new-project`는 전역 액션(라우트 없음) */
export const TOP_NAV: readonly TopNavItem[] = [
  { id: 'dash', label: '대시보드', icon: 'dashboard', path: screenPath('dash') },
  { id: 'new-project', label: '새 프로젝트 생성', icon: 'plus' },
  {
    id: 'play',
    label: 'Playground',
    icon: 'playground',
    path: screenPath('play'),
    pending: true,
  },
];

type NavLeaf = { id: string; label: string; path?: string };
type WorkGroup = {
  id: 'proc' | 'onto' | 'rag';
  label: string;
  icon: IconName;
  defaultExpanded: boolean;
  items: readonly NavLeaf[];
};

const leaf = (id: string, label: string, screen?: ScreenId): NavLeaf =>
  screen ? { id, label, path: screenPath(screen) } : { id, label };

/** LNBPanel PROC · ONTO · RAG 원문 순서. path 없음 = 준비 중 자리(샘플 IA — 채울 목록이 아니다) */
export const WORK_GROUPS: readonly WorkGroup[] = [
  {
    id: 'proc',
    label: '데이터 가공',
    icon: 'database',
    defaultExpanded: true,
    items: [
      leaf('ds', '데이터 소스', 'ds'),
      leaf('catalog', '데이터 카탈로그'),
      leaf('pipe', '파이프라인 빌더', 'pipe'),
      leaf('sql', 'SQL 스튜디오', 'sql'),
      leaf('dataset', '데이터셋 / 데이터 마트'),
      leaf('lineage', '데이터 리니지'),
    ],
  },
  {
    id: 'onto',
    label: '온톨로지',
    icon: 'ontology',
    defaultExpanded: false,
    items: [
      leaf('onto-overview', '온톨로지 개요'),
      leaf('onto-manager', '온톨로지 매니저', 'onto'),
      leaf('onto-object', '객체 타입'),
      leaf('onto-link', '링크 타입'),
      leaf('onto-interface', '인터페이스'),
      leaf('onto-prop', '속성'),
      leaf('onto-map', '데이터 매핑'),
      leaf('onto-action', '액션'),
      leaf('onto-fn', '함수'),
      leaf('onto-rule', '규칙'),
      leaf('onto-graph', '온톨로지 그래프'),
      leaf('onto-explorer', '객체 탐색기'),
      leaf('onto-branch', '브랜치 / 릴리스'),
    ],
  },
  {
    id: 'rag',
    label: 'RAG',
    icon: 'document',
    defaultExpanded: false,
    items: [
      leaf('rag-kb', '지식 베이스'),
      leaf('rag-src', '지식 소스'),
      leaf('rag-ingest', '인제스트 파이프라인'),
      leaf('rag-parse', '파서 / 청킹'),
      leaf('rag-embed', '임베딩 / 인덱스'),
      leaf('rag-retrieve', '검색 파이프라인'),
      leaf('rag-rerank', '리랭커'),
      leaf('rag-eval', '평가'),
      leaf('rag-monitor', '모니터링'),
    ],
  },
];

type ProjectGroupId = 'shared' | 'mine';
export const PROJECT_GROUPS: readonly { id: ProjectGroupId; label: string; icon: IconName }[] = [
  { id: 'shared', label: '공유받은 프로젝트', icon: 'folder-shared' },
  { id: 'mine', label: '내 프로젝트', icon: 'folder' },
];
export const projectGroupId = (p: Pick<Project, 'shared'>): ProjectGroupId =>
  p.shared ? 'shared' : 'mine';
const PROJECT_GROUP_LABEL: Record<ProjectGroupId, string> = {
  shared: '공유받은 프로젝트',
  mine: '내 프로젝트',
};
export const projectGroupLabel = (p: Pick<Project, 'shared'>) =>
  PROJECT_GROUP_LABEL[projectGroupId(p)];
export const projectPath = (projectId: string) =>
  generatePath(screenPath('project'), { projectId });
export const projectNavId = (id: string) => `project:${id}`;
const sourcePath = (projectId: string, sourceId: string) =>
  generatePath(screenPath('source'), { projectId, sourceId });
/** 커넥터 구성 화면 경로. `new`는 새로 만들기 자리 */
export const connectorPath = (projectId: string, connectorId: string) =>
  generatePath(screenPath('connector'), { projectId, connectorId });

const DEFAULT_EXPANDED = new Set<string>(['proc', 'shared', 'mine']);
/** 사용자 토글 → 기본 펼침 → 현재 화면의 그룹 */
export function isGroupExpanded(
  groupId: string,
  toggles: Readonly<Record<string, boolean>>,
  activeGroupId: string | null,
) {
  const toggled = toggles[groupId];
  if (toggled !== undefined) return toggled;
  return DEFAULT_EXPANDED.has(groupId) || activeGroupId === groupId;
}

export type RouteMatch = { screen: Screen; params: Readonly<Record<string, string | undefined>> };
export function matchRoute(pathname: string): RouteMatch | null {
  for (const screen of SCREENS) {
    const m = matchPath({ path: screen.path, end: true }, pathname);
    if (m) return { screen, params: m.params };
  }
  return null;
}

/** 소문자 substring, 앞뒤 공백 제거 */
const normalizeQuery = (q: string) => q.trim().toLowerCase();
const hit = (label: string, q: string) => q !== '' && label.toLowerCase().includes(q);

type NavHit = {
  id: string;
  label: string;
  group: string;
  path?: string;
  /** 라우트 없음 = faint(LNB의 준비 중 메모와 다름) */
  pending: boolean;
};
/** 상위(대시보드 · Playground) → 데이터 가공 → 온톨로지 → RAG */
const SEARCH_TOP_GROUP_LABEL = '상위';
export function searchNav(query: string): NavHit[] {
  const q = normalizeQuery(query);
  if (q === '') return [];
  const top = TOP_NAV.filter((t) => t.path !== undefined && hit(t.label, q)).map((t): NavHit => ({
    id: t.id,
    label: t.label,
    group: SEARCH_TOP_GROUP_LABEL,
    path: t.path,
    // 상위 검색 대상은 라우트 있는 항목뿐 — 라우트가 있으면 ink-soft라 Playground도 faint가 아니다
    pending: false,
  }));
  const work = WORK_GROUPS.flatMap((g) =>
    g.items
      .filter((it) => hit(it.label, q))
      .map((it): NavHit => ({
        id: it.id,
        label: it.label,
        group: g.label,
        path: it.path,
        pending: it.path === undefined,
      })),
  );
  return [...top, ...work];
}

/** 검색 대상 항목 수(라우트 있는 상위 + 작업 영역 항목 전부) — 0건 문구의 분모 */
export const searchableNavCount = () =>
  TOP_NAV.filter((t) => t.path !== undefined).length +
  WORK_GROUPS.reduce((sum, g) => sum + g.items.length, 0);

type ProjectHit = { id: string; label: string; group: string; path: string | null };
/** 현재 프로젝트는 링크 없이(href '') */
export function searchProjects(
  query: string,
  projects: readonly Project[],
  currentProjectId: string | null,
): ProjectHit[] {
  const q = normalizeQuery(query);
  if (q === '') return [];
  return projects
    .filter((p) => hit(p.name, q))
    .map((p) => ({
      id: p.id,
      label: p.name,
      group: projectGroupLabel(p),
      path: p.id === currentProjectId ? null : projectPath(p.id),
    }));
}

const withTab = (path: string, tab?: string) => (tab ? `${path}?tab=${tab}` : path);
/** 알림 입구: 라우트 + 탭 파라미터. 소스 + 탭은 프로젝트 상세의 소스 설정 모달 */
export function entranceHref(target: ActionTarget): string {
  switch (target.screen) {
    case 'source':
      if (!target.projectId) break;
      // 탭이 있으면 프로젝트 상세 위에 소스 설정 모달, 없으면 소스 상세(샘플 IA의 준비 중 자리)
      return target.tab
        ? `${projectPath(target.projectId)}?source=${encodeURIComponent(target.id)}&tab=${target.tab}`
        : sourcePath(target.projectId, target.id);
    case 'connector':
      if (!target.projectId) break;
      return withTab(connectorPath(target.projectId, target.id), target.tab);
    case 'project':
      return projectPath(target.id);
    case 'ontology':
      return screenPath('onto');
    case 'pipeline':
      return screenPath('pipe');
    default:
      break;
  }
  console.warn('[nav] 알림 입구를 만들 수 없습니다', target);
  return screenPath('dash');
}
