// PageHead — 화면 맨 위 제목 + 설명. 이음 pageHead(id)(js/common/state.js:21) · .page-head(css/console.css:109-111)
// 제목 h2는 tabIndex=-1 · data-page-title — 층을 닫았는데 연 컨트롤이 사라졌을 때 포커스가 오는 기본 대체 자리다(ui/layers useLayerDialog).
// Tab 순서에는 들지 않고, 링은 전역 :focus-visible 그대로라 키보드로 닫았을 때만 보인다
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './PageHead.module.css';

export type PageHeadProps = {
  /** 제목(h2). 메뉴 화면은 copy/shell SCREEN_LABEL */
  title: ReactNode;
  /** 설명 한 줄. 메뉴 화면은 copy/shell PAGE_DESCRIPTION */
  description?: ReactNode;
  /** 배치(바깥 여백)만 */
  className?: string;
};

export function PageHead({ title, description, className }: PageHeadProps) {
  return (
    <div className={cx(styles.root, className)}>
      <h2 className={styles.title} tabIndex={-1} data-page-title>
        {title}
      </h2>
      {description !== undefined ? <p className={styles.description}>{description}</p> : null}
    </div>
  );
}
