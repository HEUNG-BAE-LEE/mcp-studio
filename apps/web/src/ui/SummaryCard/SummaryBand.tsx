import { forwardRef, type HTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import styles from './SummaryCard.module.css';

export type SummaryBandProps = HTMLAttributes<HTMLDivElement> & {
  /** 1024 폭: 2열로 줄바꿈 */
  narrow?: boolean;
};

/** 요약 칸을 4열(narrow면 2열)로 묶는 밴드. 칸 사이 선은 gap 1px + 밴드 배경이다 */
export const SummaryBand = forwardRef<HTMLDivElement, SummaryBandProps>(function SummaryBand(
  { narrow = false, className, ...rest },
  ref,
) {
  return (
    <div
      {...rest}
      className={cx(styles.band, className)}
      data-narrow={narrow || undefined}
      ref={ref}
    />
  );
});
