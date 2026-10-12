// Tag — 상태 색만 쓰는 작은 표지. 이음 .gs-tag · .p2 · .rec · .ntag · .md-tag · .evb · .pr.sample · .codes span(css/console.css:269,518-527,694,997-1000,1041-1044)
// 색은 tone(상태 넷 + mute + neutral), 테두리 · 바탕 모양은 variant, 그 밖 shape · size. 뜻은 글자가 전하고 title은 마우스 보조일 뿐이다
import type { ReactNode } from 'react';
import type { StatusTone } from '../../copy/status';
import { cx } from '../lib/cx';
import styles from './Tag.module.css';

/** 상태 색의 뜻(StatusTone)에 무채색 neutral을 더한 것 */
export type TagTone = StatusTone | 'neutral';
/** solid = tone 그대로, dashed = 테두리만 점선, off = 바탕 투명 + 점선 + 취소선, value = mute의 면 · 테두리에 고정폭 --text 보통 굵기 글자(관찰 값 칩), value-empty = 같은 면 · 테두리에 본문 글꼴 --text-muted(관찰 값이 없을 때의 칩) */
export type TagVariant = 'solid' | 'dashed' | 'off' | 'value' | 'value-empty';
export type TagShape = 'square' | 'round';
export type TagSize = 'sm' | 'md' | 'lg';

/** 색 × 모양 — value · value-empty(관찰 값 칩)는 mute의 면 · 테두리만 다시 쓰므로 tone mute와만 받는다(다른 tone이면 타입 오류) */
type TagLook =
  | {
      /** 색의 뜻 */
      tone: TagTone;
      /** 테두리 · 바탕 모양 */
      variant?: Exclude<TagVariant, 'value' | 'value-empty'>;
    }
  | {
      tone: 'mute';
      variant: 'value' | 'value-empty';
    };

export type TagProps = TagLook & {
  /** square = 각진 모서리, round = 알약 */
  shape?: TagShape;
  /** 태그 고유 높이 — sm 18 · md 20 · lg 22(컨트롤 높이 단계와 다른 축) */
  size?: TagSize;
  /** 마우스 툴팁 — 있으면 cursor: help */
  title?: string;
  /** 글자 */
  children: ReactNode;
  /** 배치(바깥 여백 · 줄 맞춤)만 */
  className?: string;
};

export function Tag({
  tone,
  variant = 'solid',
  shape = 'square',
  size = 'sm',
  title,
  children,
  className,
}: TagProps) {
  return (
    <span
      className={cx(styles.root, className)}
      data-tone={tone}
      data-variant={variant}
      data-shape={shape}
      data-size={size}
      title={title}
    >
      {children}
    </span>
  );
}
