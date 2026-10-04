import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './SummaryCard.module.css';

export type SummaryValueTone = 'ink' | 'fix' | 'faint';

export type SummaryCardProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  title: string;
  /** 서식을 마친 문자열(호출자 몫) */
  value: string;
  /** fix는 점검 필요 수(손봐야 함), faint는 0 */
  valueTone?: SummaryValueTone;
  /** 값 아래 한 줄(`이전 7일 대비 +8.2%`) — `--t-caption` `muted`. 증감에 색을 쓰지 않는다 */
  delta?: ReactNode;
  /** 보통 SegmentBar */
  children?: ReactNode;
};

export const SummaryCard = forwardRef<HTMLDivElement, SummaryCardProps>(function SummaryCard(
  { title, value, valueTone = 'ink', delta, children, className, ...rest },
  ref,
) {
  return (
    <div {...rest} className={cx(styles.card, className)} ref={ref}>
      <div className={styles.head}>
        <span className={styles.title}>{title}</span>
        <span className={styles.value} data-tone={valueTone}>
          {value}
        </span>
      </div>
      {delta !== undefined && delta !== null ? <span className={styles.delta}>{delta}</span> : null}
      {children}
    </div>
  );
});
