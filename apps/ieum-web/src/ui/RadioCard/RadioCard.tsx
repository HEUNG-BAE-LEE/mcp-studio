// RadioCard — 아이콘 · 제목 · 설명이 붙은 선택지 카드. 이음 .mode-card · .radio(css/console.css:260-268,821-822,913)
// 카드는 <button aria-pressed>다. 라디오 점 · 아이콘은 장식이고 이름은 카드 글자 전체다. 잠긴 카드는 disabled라 Tab이 닿지 않는다
import type { ReactNode } from 'react';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/names';
import { cx } from '../lib/cx';
import styles from './RadioCard.module.css';

export type RadioCardProps = {
  /** 제목(굵게) */
  title: ReactNode;
  /** 제목 아래 설명 */
  description?: ReactNode;
  /** 제목 앞 아이콘(md · 주조색) */
  icon?: IconName;
  /** 제목 뒤 표지(Tag) */
  badges?: ReactNode;
  /** 고른 카드 */
  selected: boolean;
  /** 누름 — 이미 고른 카드여도 부른다 */
  onSelect: () => void;
  /** 잠긴 카드 — 표지까지 카드 전체가 흐려진다 */
  disabled?: boolean;
  /** 배치만(격자 칸) */
  className?: string;
};

export function RadioCard({
  title,
  description,
  icon,
  badges,
  selected,
  onSelect,
  disabled = false,
  className,
}: RadioCardProps) {
  return (
    <button
      type="button"
      className={cx(styles.root, className)}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
    >
      <span className={styles.radio} aria-hidden="true" />
      <span className={styles.body}>
        <span className={styles.head}>
          {icon !== undefined ? <Icon name={icon} size="md" className={styles.icon} /> : null}
          {title}
          {badges}
        </span>
        {description !== undefined ? <span className={styles.description}>{description}</span> : null}
      </span>
    </button>
  );
}
