// DetailHead — 목록 + 상세의 상세 머리. 이음 .td-head(css/console.css:631-637,906)
// 제목(h3) + 칩 / 설명 + 코드 / 오른쪽 동작 줄. 글 열이 최소 폭 260이라 동작 줄은 좁으면 아래로 접히고, 760 이하에서는 줄 전체 폭을 쓴다
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './DetailHead.module.css';

export type DetailHeadProps = {
  /** 제목(h3) — 긴 id는 아무 글자에서나 접힌다 */
  title: ReactNode;
  /** 제목을 고정폭으로(도구 id). 끄면 본문 글꼴(묶음 이름) */
  titleMono?: boolean;
  /** 제목 뒤 칩 · 표지 */
  badges?: ReactNode;
  /** 아래 줄 글 */
  description?: ReactNode;
  /** 아래 줄 끝 작은 고정폭 글(METHOD path · 작업 이름) */
  code?: ReactNode;
  /** 오른쪽 동작 줄 */
  actions?: ReactNode;
  /** 배치만 */
  className?: string;
};

export function DetailHead({
  title,
  titleMono = false,
  badges,
  description,
  code,
  actions,
  className,
}: DetailHeadProps) {
  const hasSubline = description !== undefined || code !== undefined;
  return (
    <div className={cx(styles.root, className)}>
      <div className={styles.text}>
        <div className={styles.titleRow}>
          <h3 className={styles.title} data-mono={titleMono || undefined}>
            {title}
          </h3>
          {badges}
        </div>
        {hasSubline ? (
          <p className={styles.subline}>
            {description !== undefined ? <span>{description}</span> : null}
            {code !== undefined ? <code className={styles.code}>{code}</code> : null}
          </p>
        ) : null}
      </div>
      {actions !== undefined ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
