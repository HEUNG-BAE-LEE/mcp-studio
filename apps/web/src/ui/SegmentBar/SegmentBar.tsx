import { forwardRef, type HTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import styles from './SegmentBar.module.css';

/** 막대 · 범례 색 — 이름이 같으면 MetricCard `MetricTone`과 같은 색. empty = 빈 구간(DESIGN Data) */
export type SegmentTone = 'ink-soft' | 'muted' | 'faint' | 'progress' | 'fix' | 'empty';
export type Segment = {
  /** 범례 라벨. 한 막대 안에서 유일해야 한다(React key) */
  label: string;
  value: number;
  tone: SegmentTone;
};
export type SegmentBarProps = HTMLAttributes<HTMLDivElement> & {
  segments: readonly Segment[];
  /** 기본은 구간 합계. 0이면 모든 구간이 0% */
  total?: number;
  /** 기본 true */
  legend?: boolean;
};

const PERCENT = 100;

/**
 * 폭 = round(n/total×100)%. total이 0 이하면 0%.
 * 구간마다 반올림하므로 합이 99% 또는 101%가 될 수 있다 — 일부러 보정하지 않는다.
 * 클램프도 없다. total 기본값은 합계라 value > total은 호출자가 더 작은 total을 줄 때만 생기며, 그 책임은 호출자에게 있다
 */
export const percentOf = (value: number, total: number) =>
  total > 0 ? Math.round((value / total) * PERCENT) : 0;

const sumOf = (segments: readonly Segment[]) => segments.reduce((acc, s) => acc + s.value, 0);

export const SegmentBar = forwardRef<HTMLDivElement, SegmentBarProps>(function SegmentBar(
  { segments, total, legend = true, className, 'aria-label': ariaLabel, ...rest },
  ref,
) {
  const sum = total ?? sumOf(segments);
  return (
    <div {...rest} className={cx(styles.root, className)} ref={ref}>
      <div className={styles.bar} role={ariaLabel ? 'img' : undefined} aria-label={ariaLabel}>
        {segments.map((s) => (
          <span
            key={s.label}
            className={styles.seg}
            data-tone={s.tone}
            style={{ width: `${percentOf(s.value, sum)}%` }}
          />
        ))}
      </div>
      {legend ? (
        <div className={styles.legend}>
          {segments.map((s) => (
            <span key={s.label} className={styles.item}>
              <span className={styles.swatch} data-tone={s.tone} />
              <span className={styles.label}>{s.label}</span>
              <span className={styles.n}>{String(s.value)}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
});
