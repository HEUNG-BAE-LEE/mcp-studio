import type { ComponentType, SVGProps } from 'react';
import Bell from './svg/Bell';
import ChevronDown from './svg/ChevronDown';
import Dashboard from './svg/Dashboard';
import Database from './svg/Database';
import Document from './svg/Document';
import Folder from './svg/Folder';
import FolderShared from './svg/FolderShared';
import IllustDatabase from './svg/IllustDatabase';
import IllustDocument from './svg/IllustDocument';
import IllustGit from './svg/IllustGit';
import Ontology from './svg/Ontology';
import Playground from './svg/Playground';
import Plus from './svg/Plus';
import Search from './svg/Search';
import Settings from './svg/Settings';
import SidebarCollapse from './svg/SidebarCollapse';
import SidebarExpand from './svg/SidebarExpand';

type SvgComponent = ComponentType<SVGProps<SVGSVGElement> & { title?: string; titleId?: string }>;

// COMPONENTS.md 아이콘 절 — 이름 = 뜻. svg/*.tsx를 여기에 등록한다
export const ICONS = {
  bell: Bell,
  'chevron-down': ChevronDown,
  dashboard: Dashboard,
  database: Database,
  document: Document,
  folder: Folder,
  'folder-shared': FolderShared,
  ontology: Ontology,
  playground: Playground,
  plus: Plus,
  search: Search,
  settings: Settings,
  'sidebar-collapse': SidebarCollapse,
  'sidebar-expand': SidebarExpand,
} satisfies Record<string, SvgComponent>;

// 소스 타입 카드 삽화 — 첨부 그림은 FileDrop 안 인라인
export const ILLUSTS = {
  git: IllustGit,
  database: IllustDatabase,
  document: IllustDocument,
} satisfies Record<string, SvgComponent>;

export type IconName = keyof typeof ICONS;

/**
 * 정사각형이 아닌 viewBox의 세로/가로 비율. 표시 높이 = round(size × 비율)로 viewBox 비율을 유지한다
 * (LNBPanel 종 bell 20 → 20×21). 여기 없는 아이콘은 정사각형(높이 = size).
 * chevron-down(12×8)은 호출자가 CSS로 12×8을 준다(Select · LNBPanel)
 */
export const ICON_ASPECT: Partial<Record<IconName, number>> = { bell: 16 / 15 };
export type IllustName = keyof typeof ILLUSTS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];
export const ILLUST_NAMES = Object.keys(ILLUSTS) as IllustName[];
