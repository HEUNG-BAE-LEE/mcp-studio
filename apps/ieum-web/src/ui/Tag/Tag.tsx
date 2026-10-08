// Tag — 상태 색만 쓰는 작은 표지. 이음 .gs-tag · .p2 · .rec · .ntag · .md-tag · .evb · .pr.sample(css/console.css:269,518-527,997-1000,1041-1044)
// 색은 tone(상태 넷 + mute), 모양은 shape · size · dashed · strike. 뜻은 글자가 전하고 title은 마우스 보조일 뿐이다
import type { ReactNode } from 'react';
import type { StatusTone } from '../../copy/status';
import { cx } from '../lib/cx';
import styles from './Tag.module.css';

export type TagShape = 'square' | 'round';
export type TagSize = 'sm' | 'md' | 'lg';

export type TagProps = {
  /** 색 — 상태 넷 + mute */
  tone: StatusTone;
  /** square = 각진 모서리, round = 알약 */
  shape?: TagShape;
  /** 태그 고유 높이 — sm 18 · md 20 · lg 22(컨트롤 높이 단계와 다른 축) */
  size?: TagSize;
  /** 점선 테두리 */
  dashed?: boolean;
  /** 취소선 */
  strike?: boolean;
  /** 마우스 툴팁 — 있으면 cursor: help */
  title?: string;
  /** 글자 */
  children: ReactNode;
  /** 배치(바깥 여백 · 줄 맞춤)만 */
  className?: string;
};

export function Tag({
  tone,
  shape = 'square',
  size = 'sm',
  dashed = false,
  strike = false,
  title,
  children,
  className,
}: TagProps) {
  return (
    <span
      className={cx(styles.root, className)}
      data-tone={tone}
      data-shape={shape}
      data-size={size}
      data-dashed={dashed || undefined}
      data-strike={strike || undefined}
      title={title}
    >
      {children}
    </span>
  );
}
