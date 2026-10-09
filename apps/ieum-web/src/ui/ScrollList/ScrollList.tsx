// ScrollList — 테두리 상자 안 스크롤 목록. 이음 묶음 만들기 · 수정의 "포함할 도구"(js/menu/deploy.js:196 — 인라인 max-height:240px · overflow:auto · 1px 테두리 · padding 6px 10px).
// children은 ScrollListHeading(소제목)과 줄(Checkbox size="sm" label)을 순서대로. 안의 체크 상자가 포커스를 받아 상자에 tabindex를 두지 않는다 —
// 포커스가 옮겨 가면 브라우저가 상자를 스크롤한다. 묶음 이름은 위 GroupLabel의 id로 잇는다(옛 상자에는 이름이 없었다 — 보이지 않는 ARIA 보강)
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './ScrollList.module.css';

export type ScrollListProps = {
  /** 묶음 이름 — 위 GroupLabel의 id */
  labelledBy: string;
  /** ScrollListHeading과 줄을 순서대로 */
  children: ReactNode;
  /** 배치만 */
  className?: string;
};

export type ScrollListHeadingProps = {
  /** 소제목 글자(원본 이름) */
  children: ReactNode;
};

export function ScrollList({ labelledBy, children, className }: ScrollListProps) {
  return (
    <div role="group" aria-labelledby={labelledBy} className={cx(styles.root, className)}>
      {children}
    </div>
  );
}

/** 원본 이름 소제목 — 제목 요소가 아니다(옛 div). 줄이 없는 소제목도 그대로 그린다 */
export function ScrollListHeading({ children }: ScrollListHeadingProps) {
  return <div className={styles.heading}>{children}</div>;
}
