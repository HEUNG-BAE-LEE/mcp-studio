// SectionTitle — 화면 본문 안 상자 없는 절 제목 + 작은 보조. 이음 h3.sec-t(css/console.css:607-608). 제목은 h3(화면 h2 아래)다
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './SectionTitle.module.css';

export type SectionTitleProps = {
  /** 제목(h3) */
  title: ReactNode;
  /** 제목 곁 작은 보조 글 — 좁으면 아래로 접힌다 */
  description?: ReactNode;
  /** 배치만 */
  className?: string;
};

export function SectionTitle({ title, description, className }: SectionTitleProps) {
  return (
    <h3 className={cx(styles.root, className)}>
      {title}
      {description !== undefined ? <small className={styles.description}>{description}</small> : null}
    </h3>
  );
}
