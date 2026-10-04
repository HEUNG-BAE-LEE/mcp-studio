// 요약 밴드 카드 — 라벨 · 큰 값 + 단위 · 꼬리 · 가중치 막대 + 목표 표시 · 우측 범례
import { forwardRef, type HTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import styles from './MetricCard.module.css';

/** 막대 · 범례 색 — 이름이 같으면 SegmentBar `SegmentTone`과 같은 색. empty = 빈 구간(DESIGN Data) */
export type MetricTone = 'ink' | 'ink-soft' | 'faint' | 'progress' | 'fix' | 'empty';
export type MetricValueTone = 'ink' | 'progress' | 'fix' | 'faint';
export type MetricSegment = { weight: number; tone: MetricTone };
export type MetricLegendItem = {
  label: string;
  /** 서식을 마친 문자열(호출자 몫) */
  value: string;
  tone: MetricTone;
  /** square 6×6(기본) · line 2×9(목표 표시) */
  swatch?: 'square' | 'line';
};
export type MetricCardProps = HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: string;
  /** 값 바로 뒤(ms · 시간 전) */
  unit?: string;
  /** 공백 뒤(/ 3) */
  tail?: string;
  valueTone?: MetricValueTone;
  /** flex 가중치 막대. 비어 있지 않아야 한다 */
  segments: readonly MetricSegment[];
  /** 목표 표시(막대 위 2×11 fix) — left는 '71%' 같은 CSS 길이 */
  mark?: { left: string };
  /** 없거나 비어도 범례 컨테이너는 남는다(카드 gap 8 유지) */
  legend?: readonly MetricLegendItem[];
};

export const MetricCard = forwardRef<HTMLDivElement, MetricCardProps>(function MetricCard(
  { label, value, unit, tail, valueTone = 'ink', segments, mark, legend = [], className, ...rest },
  ref,
) {
  return (
    <div {...rest} className={cx(styles.root, className)} ref={ref}>
      <span className={styles.label}>{label}</span>
      {/* `</span> <span` 사이 공백은 단위와 꼬리를 띄우는 글자 — 지우지 않는다 */}
      <span className={styles.value} data-tone={valueTone}>
        {value}
        <span className={styles.unit}>{unit}</span> <span className={styles.unit}>{tail}</span>
      </span>
      {/* 막대는 장식 — 값 · 범례 글이 같은 정보를 갖는다 */}
      <div className={styles.bar} aria-hidden="true">
        {segments.map((s, i) => (
          // 같은 톤이 반복될 수 있어 key는 순서
          <span
            key={i}
            className={styles.seg}
            data-part="seg"
            data-tone={s.tone}
            style={{ flex: s.weight }}
          />
        ))}
        {mark ? (
          <span className={styles.mark} data-part="mark" style={{ left: mark.left }} />
        ) : null}
      </div>
      <div className={styles.legend} data-part="legend">
        {legend.map((l) => (
          <span key={l.label} className={styles.item}>
            <span className={styles.swatch} data-tone={l.tone} data-swatch={l.swatch ?? 'square'} />
            {l.label} <span className={styles.n}>{l.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
});
