import { useId } from 'react';
import { Icon } from '../icons';
import { VisuallyHidden } from '../VisuallyHidden';
import type { NavGroup, NavItem, NavSubItem } from './types';
import styles from './LNBPanel.module.css';

/** 상위 항목 행. 라벨은 flex 1 · ellipsis, `pending` 메모는 우측 flex none(Playground 행 `준비 중`) */
export function NavRow({ item }: { item: NavItem }) {
  const reasonId = useId();
  const isPending = item.pending !== undefined;
  // 비활성 사유 — title은 호버 보조, 같은 글을 시각 숨김으로 두고 aria-describedby로 잇는다(DESIGN 권한)
  const reason = item.disabled ? item.title : undefined;
  const common = {
    className: styles.item,
    title: item.title,
    'data-active': item.active || undefined,
    'data-pending': isPending || undefined,
    'aria-current': item.active ? ('page' as const) : undefined,
  };
  const body = (
    <>
      <span className={styles.icon}>
        <Icon name={item.icon} size={18} />
      </span>
      <span className={styles.label}>{item.label}</span>
      {isPending ? <span className={styles.note}>{item.pending}</span> : null}
    </>
  );
  if (item.href !== undefined && !item.disabled) {
    return (
      <a {...common} href={item.href} onClick={item.onClick}>
        {body}
      </a>
    );
  }
  return (
    <>
      <button
        {...common}
        type="button"
        disabled={item.disabled}
        aria-describedby={reason === undefined ? undefined : reasonId}
        onClick={item.onClick}
      >
        {body}
      </button>
      {reason === undefined ? null : <VisuallyHidden id={reasonId}>{reason}</VisuallyHidden>}
    </>
  );
}

type GroupRowProps = {
  group: NavGroup;
  subId: string;
  onToggle: (groupId: string) => void;
};

/** 그룹 행(버튼) + 펼쳤을 때 하위 목록 */
export function GroupRow({ group, subId, onToggle }: GroupRowProps) {
  return (
    <>
      <button
        type="button"
        className={styles.group}
        aria-expanded={group.expanded}
        aria-controls={group.expanded ? subId : undefined}
        onClick={() => onToggle(group.id)}
      >
        <span className={styles.icon}>
          <Icon name={group.icon} size={18} />
        </span>
        <span className={styles.groupLabel}>{group.label}</span>
        <span className={styles.chevron} data-open={group.expanded || undefined}>
          <Icon name="chevron-down" size={16} className={styles.chevronSvg} />
        </span>
      </button>
      {group.expanded ? (
        <div id={subId} className={styles.sub}>
          {group.items.map((it) => (
            <SubItem key={it.id} item={it} />
          ))}
        </div>
      ) : null}
    </>
  );
}

function SubItem({ item }: { item: NavSubItem }) {
  const common = {
    className: styles.subItem,
    'data-active': item.active || undefined,
    'data-pending': item.pending || undefined,
    'aria-current': item.active ? ('page' as const) : undefined,
  };
  if (item.href !== undefined) {
    return (
      <a {...common} href={item.href} onClick={item.onClick}>
        {item.label}
      </a>
    );
  }
  return (
    <button {...common} type="button" onClick={item.onClick}>
      {item.label}
    </button>
  );
}
