// StatusDot — 글자 없는 상태 점(이음 .dot css/console.css:554-555). 색 점에 시각 숨김 글자를 붙인다 — 점 자체는 장식이다
import type { StatusTone } from '../../copy/status';
import { VisuallyHidden } from '../VisuallyHidden';
import styles from './StatusDot.module.css';

export type StatusDotProps = {
  /** 점 색의 뜻 */
  tone: StatusTone;
  /** 상태 글자 — 시각 숨김 글자와 마우스 툴팁(title) */
  label: string;
};

export function StatusDot({ tone, label }: StatusDotProps) {
  return (
    <span className={styles.root} title={label}>
      <span className={styles.dot} data-tone={tone} aria-hidden="true" />
      <VisuallyHidden>{label}</VisuallyHidden>
    </span>
  );
}
