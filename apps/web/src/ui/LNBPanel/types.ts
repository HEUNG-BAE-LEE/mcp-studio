import type { CountDotTone } from '../CountDot';
import type { IconName } from '../icons';

/** 상위 항목(대시보드 · 새 프로젝트 · Playground). `href`면 `<a>`, 아니면 `<button>` */
export type NavItem = {
  id: string;
  label: string;
  icon: IconName;
  href?: string;
  onClick?: () => void;
  /** 현재 화면 — `canvas` 필 + `accent` 글자, `aria-current="page"` */
  active?: boolean;
  /** 준비 중 메모 문구(예: `준비 중`). 있으면 글자 400 `faint` + 우측 메모 */
  pending?: string;
  /** 툴팁. `disabled`면 비활성 사유 — 같은 글을 시각 숨김 + `aria-describedby`로도 잇는다 */
  title?: string;
  /** 권한 없음 — `<button disabled>`, 사유는 `title`(DESIGN 권한). `href`보다 우선 */
  disabled?: boolean;
};

/** 그룹 아래 하위 항목. `href`면 `<a>`, 아니면 `<button>` */
export type NavSubItem = {
  id: string;
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  /** 준비 중 — faint, 클릭 가능(문서 규칙). `href` · `onClick`이 없으면 버튼으로 남는다 */
  pending?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  icon: IconName;
  expanded: boolean;
  items: readonly NavSubItem[];
};

export type NavSection = {
  id: string;
  label: string;
  groups: readonly NavGroup[];
};

/** 종 알림 수. null이거나 count 0이면 그리지 않는다 */
export type LNBPanelAlert = { count: number; tone: CountDotTone } | null;
