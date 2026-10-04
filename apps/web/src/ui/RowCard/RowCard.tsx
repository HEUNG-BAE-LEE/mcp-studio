import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './RowCard.module.css';

/** 제목 뒤 중립 타입 칩(소스 타입 · 도구 수) */
export type RowCardType = { label: string };

export type RowCardProps = Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'onClick'> & {
  title: string;
  type?: RowCardType;
  /** 보통 `<StatusChip surface="soft">` */
  status: ReactNode;
  summary: ReactNode;
  /** 우측 끝. 누름 버튼의 형제라 누름이 카드로 번지지 않는다 */
  action?: ReactNode;
  /** 있으면 제목이 누름 버튼(이름 = 제목)이 되고 누름 자리는 카드 전체로 넓어진다 */
  onClick?: () => void;
  /** 시각 표시만(aria 없음) */
  selected?: boolean;
};

export const RowCard = forwardRef<HTMLDivElement, RowCardProps>(function RowCard(
  { title, type, status, summary, action, onClick, selected = false, className, ...rest },
  ref,
) {
  const isClickable = onClick !== undefined;
  return (
    // 루트는 역할 없는 상자 — 버튼(제목)과 action을 형제로 두어 컨트롤이 컨트롤 안에 들지 않는다
    <div
      {...rest}
      className={cx(styles.root, className)}
      data-clickable={isClickable || undefined}
      data-selected={selected || undefined}
      ref={ref}
    >
      <div className={styles.body}>
        <div className={styles.line}>
          {isClickable ? (
            <button type="button" className={cx(styles.title, styles.press)} onClick={onClick}>
              {title}
            </button>
          ) : (
            <span className={styles.title}>{title}</span>
          )}
          {type ? <span className={styles.type}>{type.label}</span> : null}
        </div>
        <div className={styles.line}>
          {status}
          <span className={styles.summary}>{summary}</span>
        </div>
      </div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
});
