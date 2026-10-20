// HelpText — 표 · 상자 · 칸 아래 흐린 안내 한두 줄. 이음 .tab-hint(hint — css/console.css:289-290) · .pv-note(note — :730) ·
// 툴바 줄 안 .muted 12.5px(inline — :507, js/menu/discovery.js:314)
// hint의 위아래 바깥 여백(옛 14 · 12)은 쓰는 곳이 className으로 준다. note는 위 8을 가진다(쓰는 곳 className이 덮을 수 있다)
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './HelpText.module.css';

export type HelpTextSize = 'sm' | 'md';
export type HelpTextVariant = 'hint' | 'note' | 'inline';

type HelpTextBaseProps = {
  /** 문장 — hint의 강조 <b>는 한 단계 진한 --text-muted, note · inline의 <b>는 색 그대로 굵게 */
  children: ReactNode;
  /** 배치(바깥 여백)만 */
  className?: string;
};

type HelpTextVariantProps =
  | {
      /** hint = 표 · 상자 · 칸 아래 안내(설명 글 행간) */
      variant?: 'hint';
      /** 글자 단계 — md는 변환 스튜디오 원본 선택 줄 */
      size?: HelpTextSize;
    }
  | {
      /** note = 미리보기 · 근거 아래 메모(행간 물려받음 · 위 8), inline = 툴바 줄 안 안내(행간 물려받음 · 여백 없음) */
      variant: 'note' | 'inline';
      size?: never;
    };

export type HelpTextProps = HelpTextBaseProps & HelpTextVariantProps;

export function HelpText({ variant = 'hint', size = 'sm', children, className }: HelpTextProps) {
  return (
    <p className={cx(styles.root, className)} data-variant={variant} data-size={size}>
      {children}
    </p>
  );
}
