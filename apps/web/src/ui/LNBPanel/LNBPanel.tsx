import { forwardRef, Fragment, useId, type HTMLAttributes } from 'react';
import { CountDot } from '../CountDot';
import { IconButton } from '../IconButton';
import { Icon } from '../icons';
import { cx } from '../lib/cx';
import { LNBLogo } from './Logo';
import { GroupRow, NavRow } from './parts';
import type { LNBPanelAlert, NavItem, NavSection } from './types';
import styles from './LNBPanel.module.css';

const DEFAULT_APP_NAME = 'MCP-Studio';
const DEFAULT_TOGGLE_TITLE = '사이드바 접기';
/** 접기 버튼 표식 — LNB가 펼친 뒤 포커스를 옮길 곳을 찾는다(COMPONENTS LNB `접근성`). `ui` 밖으로 내보내지 않는다 */
export const PANEL_TOGGLE_SELECTOR = '[data-lnb-toggle]';
/** CountDot 위치는 호출자 몫(COMPONENTS.md CountDot) — 아이콘 위 −5 · 우 −7. 기준 상자가 아이콘 둘레 hover 상자(안쪽 4)라 4씩 더한다 */
const BELL_DOT_STYLE = { position: 'absolute', top: -1, right: -3 } as const;

export type LNBPanelProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  appName?: string;
  onSearch?: () => void;
  onToggle?: () => void;
  toggleTitle?: string;
  topItems: readonly NavItem[];
  sections: readonly NavSection[];
  onToggleGroup: (groupId: string) => void;
  alert: LNBPanelAlert;
  onAlerts?: () => void;
};

/** LNB 안쪽 내용(머리 · 상위 항목 · 구역 스크롤 · 종). 배경은 LNB 열이 칠한다 */
export const LNBPanel = forwardRef<HTMLDivElement, LNBPanelProps>(function LNBPanel(
  {
    appName = DEFAULT_APP_NAME,
    onSearch,
    onToggle,
    toggleTitle = DEFAULT_TOGGLE_TITLE,
    topItems,
    sections,
    onToggleGroup,
    alert,
    onAlerts,
    className,
    ...rest
  },
  ref,
) {
  const baseId = useId();
  const hasAlert = alert !== null && alert.count > 0;
  return (
    <div {...rest} ref={ref} className={cx(styles.root, className)}>
      <div className={styles.head}>
        <LNBLogo />
        <span className={styles.appName}>{appName}</span>
        <IconButton className={styles.headButton} icon="search" title="검색" onClick={onSearch} />
        <IconButton
          className={styles.headButton}
          icon="sidebar-collapse"
          title={toggleTitle}
          data-lnb-toggle=""
          onClick={onToggle}
        />
      </div>
      <div className={styles.top}>
        {topItems.map((item) => (
          <NavRow key={item.id} item={item} />
        ))}
      </div>
      <div className={styles.scroll}>
        {sections.map((section) => (
          <Fragment key={section.id}>
            <div className={styles.sectionLabel}>{section.label}</div>
            {section.groups.map((group) => (
              <GroupRow
                key={group.id}
                group={group}
                subId={`${baseId}-${section.id}-${group.id}`}
                onToggle={onToggleGroup}
              />
            ))}
          </Fragment>
        ))}
      </div>
      <button
        type="button"
        className={styles.bell}
        title="알림"
        aria-label={hasAlert ? `알림 ${alert.count}` : '알림'}
        onClick={onAlerts}
      >
        <span className={styles.bellIcon}>
          <Icon name="bell" size={20} />
          {hasAlert ? (
            <CountDot count={alert.count} tone={alert.tone} style={BELL_DOT_STYLE} />
          ) : null}
        </span>
      </button>
    </div>
  );
});
