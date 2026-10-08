// ProgressBar — 가로 막대 하나. 비율 막대(.meter css/console.css:583-584)와 진행 막대(.bar-p css/console.css:847-848)는 같은 모양이라 하나로 둔다.
// 장식(aria-hidden)이다 — 같은 정보가 곁의 수 · 단계 글자에 있다
import { cx } from '../lib/cx';
import styles from './ProgressBar.module.css';

export type ProgressBarVariant = 'meter' | 'progress';

export type ProgressBarProps = {
  /** 0 ~ 1 비율 — 밖의 값 · NaN은 잘라 그린다(0 · 1) */
  value: number;
  /** meter = 채움 --tool(도구 비율), progress = 채움 --primary + 폭 전환 */
  variant: ProgressBarVariant;
  /** 배치(격자 칸 · 위아래 여백)만 */
  className?: string;
};

const MIN_RATIO = 0;
const MAX_RATIO = 1;

const clampRatio = (value: number): number => {
  if (Number.isNaN(value)) return MIN_RATIO;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, value));
};

export function ProgressBar({ value, variant, className }: ProgressBarProps) {
  return (
    <div className={cx(styles.root, className)} data-variant={variant} aria-hidden="true">
      <i className={styles.fill} style={{ '--progress': clampRatio(value) }} />
    </div>
  );
}
