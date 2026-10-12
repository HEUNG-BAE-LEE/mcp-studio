// FilterChips — 이음 .tl-f(css/console.css:615-619). 칩은 토글 버튼(aria-pressed)이고, 이미 고른 칩을 다시 눌러도 부른다
import type { ReactNode } from 'react';
import styles from './FilterChips.module.css';

export type FilterChipsVariant = 'toolbar' | 'band';

export type FilterChipItem = {
  value: string;
  label: ReactNode;
  /** 서식 없이 그대로 */
  count?: number;
};

export type FilterChipsProps = {
  items: readonly FilterChipItem[];
  /** 고른 칩 값 */
  value: string;
  /** 누른 칩 값 */
  onValueChange: (value: string) => void;
  /** toolbar = 툴바 안, band = 패널 머리 띠 */
  variant?: FilterChipsVariant;
  /** 묶음 이름(role="group"의 aria-label) — 있는 자리만 */
  label?: string;
};

export function FilterChips({ items, value, onValueChange, variant = 'toolbar', label }: FilterChipsProps) {
  return (
    <div role="group" aria-label={label} className={styles.root} data-variant={variant}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={styles.chip}
          aria-pressed={item.value === value}
          onClick={() => onValueChange(item.value)}
        >
          {item.label}
          {item.count === undefined ? null : <b className={styles.count}>{item.count}</b>}
        </button>
      ))}
    </div>
  );
}
