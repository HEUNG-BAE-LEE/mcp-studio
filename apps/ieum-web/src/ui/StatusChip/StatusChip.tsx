// StatusChip — 자원 상태 칩, 점 + 글자(이음 .stt css/console.css:511-517). 뜻은 글자가 전하고 점은 장식이다
import type { ReactNode } from 'react';
import type { StatusTone } from '../../copy/status';
import styles from './StatusChip.module.css';

export type { StatusTone };
/** sm = 목록 항목 안 축소(css/console.css:628-629) */
export type StatusChipSize = 'md' | 'sm';

export type StatusChipProps = {
  tone: StatusTone;
  size?: StatusChipSize;
  /** 라벨 — statusOf의 label */
  children: ReactNode;
};

export function StatusChip({ tone, size = 'md', children }: StatusChipProps) {
  return (
    <span className={styles.root} data-tone={tone} data-size={size}>
      {children}
    </span>
  );
}
