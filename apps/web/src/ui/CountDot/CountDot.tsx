import { forwardRef, type HTMLAttributes } from 'react';
import { cappedCount } from '../lib/cappedCount';
import { cx } from '../lib/cx';
import styles from './CountDot.module.css';

export type CountDotTone = 'fix' | 'progress';
export type CountDotProps = HTMLAttributes<HTMLSpanElement> & {
  count: number;
  /** fix(기본): 실패 있음 `--fix-fg` · progress: 처리 필요만 `--progress-fg` */
  tone?: CountDotTone;
};

/** LNB 알림 수(종 위 카운트 점). 0 이하면 그리지 않는다 */
export const CountDot = forwardRef<HTMLSpanElement, CountDotProps>(function CountDot(
  { count, tone = 'fix', className, ...rest },
  ref,
) {
  if (count <= 0) return null;
  return (
    <span
      {...rest}
      className={cx(styles.root, className)}
      data-tone={tone}
      aria-label={`알림 ${count}`}
      ref={ref}
    >
      {cappedCount(count)}
    </span>
  );
});
