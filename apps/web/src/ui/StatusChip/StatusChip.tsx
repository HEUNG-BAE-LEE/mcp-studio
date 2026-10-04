import { forwardRef, type HTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import styles from './StatusChip.module.css';

/** done은 평상시 상태라 idle과 같은 중립색으로 그린다(DESIGN Colors Status) */
export type StatusTier = 'done' | 'progress' | 'fix' | 'idle';

export type StatusChipProps = HTMLAttributes<HTMLSpanElement> & {
  tier: StatusTier;
  /** bg(기본) · soft(표 안) */
  surface?: 'bg' | 'soft';
  /** md(기본, 목록 행 칩) · lg(머리 상태 태그 — 모달 · 화면 머리) */
  size?: 'md' | 'lg';
};

export const StatusChip = forwardRef<HTMLSpanElement, StatusChipProps>(function StatusChip(
  { tier, surface = 'bg', size = 'md', className, ...rest },
  ref,
) {
  return (
    <span
      {...rest}
      className={cx(styles.root, className)}
      data-tier={tier}
      data-surface={surface}
      data-size={size}
      ref={ref}
    />
  );
});
