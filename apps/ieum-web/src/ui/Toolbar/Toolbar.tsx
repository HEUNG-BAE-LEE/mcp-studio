// Toolbar · ToolbarSpacer — 목록 위 한 줄 도구. 이음 .toolbar · .sp(css/console.css:596-598)
// 왼쪽 무리와 오른쪽 무리 사이에 ToolbarSpacer를 둔다. 위 바깥 여백(옛 22)은 쓰는 곳이 준다
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './Toolbar.module.css';

export type ToolbarProps = {
  /** 도구들 — 왼쪽 무리와 오른쪽 무리 사이에 ToolbarSpacer */
  children: ReactNode;
  /** 배치(바깥 여백)만 */
  className?: string;
};

export function Toolbar({ children, className }: ToolbarProps) {
  return <div className={cx(styles.root, className)}>{children}</div>;
}

/** 남은 폭을 차지하는 빈칸 — 760 이하에서는 숨긴다 */
export function ToolbarSpacer() {
  return <span className={styles.spacer} aria-hidden="true" />;
}
