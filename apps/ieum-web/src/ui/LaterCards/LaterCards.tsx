// LaterCards — 원본 시스템 화면 아래 2차 연결 방식 카드. 이음 .later · .srow.avail · .si(css/console.css:378-382,609-611,879)
// 누를 수 없는 표시용 카드다(옛 div). 글자는 쓰는 곳의 copy/에서 받는다
import type { ReactNode } from 'react';
import { CardGrid } from '../CardGrid';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/names';
import { Tag } from '../Tag';
import styles from './LaterCards.module.css';

export type LaterCardItem = {
  icon: IconName;
  title: ReactNode;
  description: ReactNode;
};

export type LaterCardsProps = {
  /** 카드 — 순서대로 */
  items: readonly LaterCardItem[];
  /** 카드마다 오른쪽 표지 글자("2차") */
  badge: ReactNode;
  /** 배치만 */
  className?: string;
};

export function LaterCards({ items, badge, className }: LaterCardsProps) {
  return (
    <CardGrid columns={3} collapseAt={1100} className={className}>
      {items.map((item, index) => (
        <div key={index} className={styles.card}>
          <span className={styles.icon}>
            <Icon name={item.icon} size="lg" />
          </span>
          <span className={styles.text}>
            <b className={styles.title}>{item.title}</b>
            <span className={styles.description}>{item.description}</span>
          </span>
          <Tag tone="neutral">{badge}</Tag>
        </div>
      ))}
    </CardGrid>
  );
}
