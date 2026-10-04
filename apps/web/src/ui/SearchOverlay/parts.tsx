// 검색 결과 조각(LNB 검색 오버레이). SPA 이동은 호출자가 클릭을 가로챈다
import type { MouseEvent, ReactNode } from 'react';
import { Icon, type IconName } from '../icons';
import styles from './SearchOverlay.module.css';

export function SearchOverlayGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.group}>
      <div className={styles.groupLabel}>{label}</div>
      {children}
    </div>
  );
}

export type SearchOverlayItemProps = {
  href?: string;
  /** 호출자가 `preventDefault`로 SPA 이동을 가로챌 수 있다 */
  onClick?: (e: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
  icon?: IconName;
  /** 우측 소속 그룹명 */
  note?: string;
  /** 준비 중 — 글자 faint. href가 없으면 버튼으로 남는다 */
  pending?: boolean;
  children: ReactNode;
};

export function SearchOverlayItem({
  href,
  onClick,
  icon,
  note,
  pending,
  children,
}: SearchOverlayItemProps) {
  const body = (
    <>
      {icon ? (
        <span className={styles.itemIcon}>
          <Icon name={icon} size={16} />
        </span>
      ) : null}
      <span className={styles.itemLabel}>{children}</span>
      {note ? <span className={styles.itemNote}>{note}</span> : null}
    </>
  );
  const common = { className: styles.item, 'data-pending': pending || undefined };
  if (href !== undefined) {
    return (
      <a {...common} href={href} onClick={onClick}>
        {body}
      </a>
    );
  }
  // 준비 중(pending)도 no-op <button> — aria-disabled 없이 클릭을 막지 않는다(준비 중 항목은 클릭 가능)
  return (
    <button {...common} type="button" onClick={onClick}>
      {body}
    </button>
  );
}

export function SearchOverlayEmpty({ children }: { children: ReactNode }) {
  return (
    <div className={styles.empty} role="status">
      {children}
    </div>
  );
}
