// HelpText — 표 · 상자 · 칸 아래 흐린 안내 한두 줄. 이음 .tab-hint(css/console.css:289-290)
// 위아래 바깥 여백(옛 14 · 12)은 쓰는 곳이 className으로 준다
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './HelpText.module.css';

export type HelpTextSize = 'sm' | 'md';

export type HelpTextProps = {
  /** 글자 단계 — md는 변환 스튜디오 원본 선택 줄 */
  size?: HelpTextSize;
  /** 문장 — 강조 <b>는 한 단계 진한 --text-muted */
  children: ReactNode;
  /** 배치(바깥 여백)만 */
  className?: string;
};

export function HelpText({ size = 'sm', children, className }: HelpTextProps) {
  return (
    <p className={cx(styles.root, className)} data-size={size}>
      {children}
    </p>
  );
}
