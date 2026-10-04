// 가는 진행 막대(단계 흐름 진행): md 4 · sm 3, 채움 ink(완료에도 색을 바꾸지 않는다)
import { forwardRef, type HTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import styles from './ProgressBar.module.css';

const MIN = 0;
const MAX = 100;

export type ProgressBarProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  value: number;
  size?: 'md' | 'sm';
  'aria-label': string;
};

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(function ProgressBar(
  { value, size = 'md', className, ...rest },
  ref,
) {
  const clamped = Math.min(MAX, Math.max(MIN, Math.round(Number.isFinite(value) ? value : MIN)));
  return (
    <div
      {...rest}
      ref={ref}
      role="progressbar"
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      aria-valuenow={clamped}
      className={cx(styles.track, className)}
      data-size={size}
    >
      <div className={styles.fill} style={{ width: `${clamped}%` }} />
    </div>
  );
});
