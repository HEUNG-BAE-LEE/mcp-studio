// SplitLayout — 왼쪽 고정 열 + 오른쪽 상세. 이음 .studio · .dp · .pg(css/console.css:614,733,784,875,877)
// 왼쪽 열 · 간격 · 접는 폭은 variant가 정한다(CSS의 data-variant). 접히면 왼쪽이 위 · 오른쪽이 아래다
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './SplitLayout.module.css';

export type SplitLayoutVariant = 'list' | 'playground';

export type SplitLayoutProps = {
  /** 왼쪽 열 · 간격 — COMPONENTS SplitLayout 표 */
  variant: SplitLayoutVariant;
  /** 왼쪽 · 오른쪽 — 접히면 왼쪽이 위 */
  children: [ReactNode, ReactNode];
  /** 배치(위 바깥 여백)만 */
  className?: string;
};

export function SplitLayout({ variant, children, className }: SplitLayoutProps) {
  return (
    <div className={cx(styles.root, className)} data-variant={variant}>
      {children}
    </div>
  );
}
