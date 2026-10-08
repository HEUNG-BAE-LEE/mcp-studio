// CardGrid — 같은 꼴의 카드 · 칸을 고른 열 수로 늘어놓고 좁으면 한 열로 접는 격자. 이음 .wz-cards · .res-grid · .later(css/console.css:609,820,849,879,900)
// 정해 둔 세 조합(2·760 / 3·760 / 3·1100)만 받는다 — 타입이 다른 조합을 막는다
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './CardGrid.module.css';

type Combination =
  | { columns: 2; collapseAt: 760 }
  | { columns: 3; collapseAt: 760 }
  | { columns: 3; collapseAt: 1100 };

export type CardGridProps = Combination & {
  /** 칸들 — 순서대로 채운다 */
  children: ReactNode;
  /** 배치(바깥 여백)만 */
  className?: string;
};

export function CardGrid({ columns, collapseAt, children, className }: CardGridProps) {
  return (
    <div className={cx(styles.root, className)} data-columns={columns} data-collapse-at={collapseAt}>
      {children}
    </div>
  );
}
