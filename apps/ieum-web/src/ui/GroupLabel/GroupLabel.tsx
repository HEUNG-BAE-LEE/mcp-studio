// GroupLabel — 선택지 · 체크 묶음 위 굵은 라벨 한 줄. 이음 .d-label(css/console.css:255,703)
// 제목 요소가 아니라 굵은 <div>다(옛 그대로). 묶음에 이름이 필요하면 쓰는 곳이 role="group"의 aria-labelledby를 id에 잇는다
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './GroupLabel.module.css';

/** md = 본문 단계(묶음 만들기 "포함할 도구"), sm = 정책 상자 안(실행 방식 — 옛 .pol .d-label) */
export type GroupLabelSize = 'md' | 'sm';

export type GroupLabelProps = {
  /** 라벨 글자 */
  children: ReactNode;
  /** 글자 단계 */
  size?: GroupLabelSize;
  /** 묶음의 aria-labelledby 대상 */
  id?: string;
  /** 배치(바깥 여백)만 */
  className?: string;
};

export function GroupLabel({ children, size = 'md', id, className }: GroupLabelProps) {
  return (
    <div id={id} className={cx(styles.root, className)} data-size={size}>
      {children}
    </div>
  );
}
