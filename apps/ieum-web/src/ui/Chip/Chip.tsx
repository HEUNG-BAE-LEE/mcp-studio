// Chip — 누르면 한 가지 동작을 하는 알약 버튼. 이음 .chip(css/console.css:314-315) · 쓰는 곳 js/menu/playground.js:65
// 안은 글 흐름 그대로다(flex가 아니다) — 글 · 아이콘 · 시각 숨김 글자 사이의 공백이 그대로 남는다.
// 옛 글리프(✓ · ✕) 자리는 쓰는 곳이 장식 아이콘 + VisuallyHidden으로 채운다 — 아이콘은 aria-hidden이고 이름은 숨김 글자까지 이어 읽힌다
import type { MouseEventHandler, ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './Chip.module.css';

export type ChipProps = {
  /** 누름 */
  onClick: MouseEventHandler<HTMLButtonElement>;
  /** 글자 — 글 사이에 아이콘(Icon sm) · 시각 숨김 글자를 둘 수 있다 */
  children: ReactNode;
  /** 배치(바깥 여백 · 줄 맞춤)만 */
  className?: string;
};

export function Chip({ onClick, children, className }: ChipProps) {
  return (
    <button type="button" className={cx(styles.root, className)} onClick={onClick}>
      {children}
    </button>
  );
}
