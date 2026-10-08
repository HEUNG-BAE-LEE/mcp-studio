// KeyValueGrid — 드로어 안 요약 칸(이음 .lsum css/console.css:804-809). 키 + 값 칸을 3열로 채운다(760 이하 2열)
// 값이 없는 칸은 쓰는 곳이 값 없음 표기(copy/)를 넣는다 — 이 부품은 빈 값을 채우지 않는다
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './KeyValueGrid.module.css';

export type KeyValueItem = {
  label: ReactNode;
  value: ReactNode;
  /** 값을 고정폭 작은 글자로(요청 ID) */
  mono?: boolean;
};

export type KeyValueGridProps = {
  /** 칸 — 순서대로 채운다 */
  items: readonly KeyValueItem[];
  /** 배치(바깥 여백)만 */
  className?: string;
};

export function KeyValueGrid({ items, className }: KeyValueGridProps) {
  return (
    <dl className={cx(styles.root, className)}>
      {items.map((item, index) => (
        <div key={index} className={styles.item}>
          <dt className={styles.key}>{item.label}</dt>
          <dd className={styles.value} data-mono={item.mono ? '' : undefined}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
