// Box — 제목 줄이 있는 상자. 이음 .box · .box-h · .box-b(css/console.css:502-506)
// 제목(h3)이 있어야 머리 줄을 그린다 — 제목이 없으면 description · actions도 그리지 않는다(배포 정책 요약 js/menu/deploy.js:90)
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './Box.module.css';

export type BoxProps = {
  /** 머리 제목(h3). 없으면 머리 줄을 그리지 않는다 */
  title?: ReactNode;
  /** 제목 곁 작은 보조 글("최근 24시간" · "2건"). 제목이 있을 때만 */
  description?: ReactNode;
  /** 머리 오른쪽(LinkButton · 작은 버튼). 제목이 있을 때만 */
  actions?: ReactNode;
  /** 본문 안쪽 여백. 구조도 · 차트처럼 내용이 자기 여백을 가지면 끈다 */
  padded?: boolean;
  children: ReactNode;
  /** 배치(바깥 여백 · 격자 칸)만 */
  className?: string;
};

export function Box({ title, description, actions, padded = false, children, className }: BoxProps) {
  return (
    <section className={cx(styles.root, className)}>
      {title !== undefined ? (
        <div className={styles.head}>
          <h3 className={styles.title}>
            {title}
            {description !== undefined ? <small className={styles.description}>{description}</small> : null}
          </h3>
          {actions !== undefined ? <div className={styles.actions}>{actions}</div> : null}
        </div>
      ) : null}
      {padded ? <div className={styles.body}>{children}</div> : children}
    </section>
  );
}
