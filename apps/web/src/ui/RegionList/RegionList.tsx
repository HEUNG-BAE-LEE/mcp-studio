// 영역 틀 — Region(머리 + 내용을 세로로 담는 열 · 머리 → 내용 --s-2-5 · 남은 높이를 받는다) · RegionList(SectionHead 아래 남은 높이를 채우고 스크롤하는 목록)
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './RegionList.module.css';

export type RegionProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'div';
};

/** 영역 하나(SectionHead + 내용 — 목록 · 표 · 격자). 세로 flex · 머리 → 내용 --s-2-5(자식 사이 gap — RegionList는 스스로 위 여백을 가져 겹치지 않는다) · min-height 0 — 부모가 준 높이 안에서 목록이 스크롤한다 */
export const Region = forwardRef<HTMLElement, RegionProps>(function Region(
  { as: Tag = 'section', className, ...rest },
  ref,
) {
  return <Tag {...rest} ref={ref as never} className={cx(styles.region, className)} />;
});

export type RegionListProps = HTMLAttributes<HTMLDivElement> & {
  /** 빈 상태(EmptyState) — 목록 자리 세로 가운데. 항목이 없을 때만 준다 */
  empty?: ReactNode;
};

/** 머리 아래 목록: 위 10 · 남은 높이 채움 · 세로 스크롤 · 항목 gap 8 · 포커스 링이 잘리지 않는 좌우 · 아래 안쪽 여백(머리와 가장자리를 맞춘다) */
export const RegionList = forwardRef<HTMLDivElement, RegionListProps>(function RegionList(
  { empty, className, children, ...rest },
  ref,
) {
  return (
    <div {...rest} ref={ref} className={cx(styles.list, className)}>
      {empty ? <div className={styles.empty}>{empty}</div> : null}
      {children}
    </div>
  );
});
