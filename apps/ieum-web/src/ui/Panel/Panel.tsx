// Panel — 목록 + 상세의 왼쪽 목록 상자. 이음 .panel · .p-head · .p-search · .tool-list(css/console.css:115-118,620,876)
// 머리(제목 + 수) → 띠(tools — 목록 스크롤 밖) → 본문(scroll이면 최대 높이 안에서 스크롤) → 아래 동작 칸(footer)
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './Panel.module.css';

export type PanelProps = {
  /** 상자 이름(section의 aria-label) */
  label: string;
  /** 머리 글자 — 제목 요소가 아니다(옛 div) */
  title: ReactNode;
  /** 머리 오른쪽 수 — 서식은 쓰는 곳 */
  count?: ReactNode;
  /** 머리 아래 띠들(FilterChips band · PanelBand) — 목록 스크롤 밖 */
  tools?: ReactNode;
  /** 본문을 최대 높이 안에서 스크롤한다 */
  scroll?: boolean;
  /** 본문 아래 동작 칸 — 안 버튼이 칸 폭을 채운다 */
  footer?: ReactNode;
  /** 목록 또는 빈 상태 */
  children: ReactNode;
  /** 배치만 */
  className?: string;
};

export type PanelBandProps = {
  children: ReactNode;
  /** 배치만 */
  className?: string;
};

export function Panel({ label, title, count, tools, scroll = false, footer, children, className }: PanelProps) {
  return (
    <section aria-label={label} className={cx(styles.root, className)}>
      <div className={styles.head}>
        <span>{title}</span>
        {count !== undefined ? <span className={styles.count}>{count}</span> : null}
      </div>
      {tools}
      <div className={styles.body} data-scroll={scroll || undefined}>
        {children}
      </div>
      {footer !== undefined ? <div className={styles.footer}>{footer}</div> : null}
    </section>
  );
}

/** 머리 아래 띠 하나 — 검색 줄(이음 .p-search) */
export function PanelBand({ children, className }: PanelBandProps) {
  return <div className={cx(styles.band, className)}>{children}</div>;
}
