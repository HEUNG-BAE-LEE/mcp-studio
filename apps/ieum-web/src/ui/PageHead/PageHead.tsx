// PageHead — 화면 맨 위 제목 + 설명. 이음 pageHead(id)(js/common/state.js:21) · .page-head(css/console.css:109-111) · 탐색 작업 머리(js/menu/discovery.js:251-258)
// 제목 h2는 tabIndex=-1 · data-page-title — 층을 닫았는데 연 컨트롤이 사라졌을 때 포커스가 오는 기본 대체 자리다(ui/layers useLayerDialog).
// Tab 순서에는 들지 않고, 링은 전역 :focus-visible 그대로라 키보드로 닫았을 때만 보인다
// 한 줄 차림은 제목 · 상태 · 설명 · (남은 폭) · 동작이다. 뒤로 링크가 있으면 머리 줄 위에 따로 놓이고 className은 그 둘을 감싼 바깥에 붙는다
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './PageHead.module.css';

export type PageHeadProps = {
  /** 제목(h2). 메뉴 화면은 copy/shell SCREEN_LABEL */
  title: ReactNode;
  /** 설명 한 줄. 메뉴 화면은 copy/shell PAGE_DESCRIPTION */
  description?: ReactNode;
  /** 머리 위 뒤로 링크(LinkButton variant="back") — 제목 줄과 사이 --s-1-5 */
  back?: ReactNode;
  /** 제목 바로 뒤 상태 칩 — 세로 가운데 */
  status?: ReactNode;
  /** 줄 오른쪽 끝 버튼 — 설명 뒤 남은 폭을 비운다 */
  actions?: ReactNode;
  /** 배치(바깥 여백)만 */
  className?: string;
};

export function PageHead({ title, description, back, status, actions, className }: PageHeadProps) {
  const head = (
    <div className={cx(styles.root, back === undefined ? className : undefined)}>
      <h2 className={styles.title} tabIndex={-1} data-page-title>
        {title}
      </h2>
      {status !== undefined ? <span className={styles.status}>{status}</span> : null}
      {description !== undefined ? <p className={styles.description}>{description}</p> : null}
      {actions !== undefined ? (
        <>
          <span className={styles.spacer} aria-hidden="true" />
          <div className={styles.actions}>{actions}</div>
        </>
      ) : null}
    </div>
  );
  if (back === undefined) return head;
  return (
    <div className={className}>
      <div className={styles.back}>{back}</div>
      {head}
    </div>
  );
}
