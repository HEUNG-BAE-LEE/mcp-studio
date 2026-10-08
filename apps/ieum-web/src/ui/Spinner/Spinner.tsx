// Spinner — 진행 중 도는 원(이음 .spin css/console.css:952 · .an li.run .ic :842).
// 장식(aria-hidden)이다 — 진행은 곁의 글자가 전한다(옛도 역할이 없다)
import { cx } from '../lib/cx';
import styles from './Spinner.module.css';

export type SpinnerSize = 'md' | 'lg';

export type SpinnerProps = {
  /** 고유 치수 — md 16 · 테 --bw-strong(.spin), lg 22 · 테 --bw-dashed(분석 단계 원) */
  size?: SpinnerSize;
  /** 배치만 */
  className?: string;
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return <span className={cx(styles.root, className)} data-size={size} aria-hidden="true" />;
}
