// Box — 제목 줄이 있는 상자. 이음 .box · .box-h · .box-b · .box.pol(css/console.css:502-506,702)
// 제목(h3)이 있어야 머리 줄을 그린다 — 제목이 없으면 description · actions도 그리지 않는다(배포 정책 요약 js/menu/deploy.js:90)
// variant policy는 본문을 늘 감싸고 안쪽이 padded보다 작다 — padded와 함께 쓰지 않는다(타입이 막는다)
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './Box.module.css';

/** default = 일반 상자, policy = 정책 상자(실행 정책 · 보안 정책 요약) */
export type BoxVariant = 'default' | 'policy';

type BoxBaseProps = {
  /** 머리 제목(h3). 없으면 머리 줄을 그리지 않는다 */
  title?: ReactNode;
  /** 제목 곁 작은 보조 글("최근 24시간" · "2건"). 제목이 있을 때만 */
  description?: ReactNode;
  /** 머리 오른쪽(LinkButton · 작은 버튼). 제목이 있을 때만 */
  actions?: ReactNode;
  children: ReactNode;
  /** 배치(바깥 여백 · 격자 칸)만 */
  className?: string;
};

type BodyProps =
  | {
      /** 기본 default */
      variant?: 'default';
      /** 본문 안쪽 여백. 구조도 · 차트처럼 내용이 자기 여백을 가지면 끈다 */
      padded?: boolean;
    }
  | {
      /** 본문을 늘 정책 안쪽 여백(위 14 · 좌우 16 · 아래 16)으로 감싼다 */
      variant: 'policy';
      padded?: never;
    };

export type BoxProps = BoxBaseProps & BodyProps;

export function Box({ title, description, actions, variant = 'default', padded = false, children, className }: BoxProps) {
  const isPolicy = variant === 'policy';
  return (
    <section className={cx(styles.root, className)} data-variant={variant}>
      {title !== undefined ? (
        <div className={styles.head}>
          <h3 className={styles.title}>
            {title}
            {description !== undefined ? <small className={styles.description}>{description}</small> : null}
          </h3>
          {actions !== undefined ? <div className={styles.actions}>{actions}</div> : null}
        </div>
      ) : null}
      {padded || isPolicy ? <div className={styles.body}>{children}</div> : children}
    </section>
  );
}
