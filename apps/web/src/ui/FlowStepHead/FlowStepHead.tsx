import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './FlowStepHead.module.css';

export type FlowStepHeadProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  /** 단계 제목 — --t-h2 */
  title: ReactNode;
  /** 설명 한 줄(prose muted). 없으면 그리지 않는다 */
  description?: ReactNode;
  /** 제목 요소 */
  as?: 'h2' | 'h3';
};

const hasValue = (node: ReactNode) => node !== undefined && node !== null && node !== false;

/** 단계 흐름의 단계 머리 — FlowOverlay `heading`에 둔다 */
export const FlowStepHead = forwardRef<HTMLDivElement, FlowStepHeadProps>(function FlowStepHead(
  { title, description, as: Heading = 'h2', className, ...rest },
  ref,
) {
  return (
    <div {...rest} className={cx(styles.root, className)} ref={ref}>
      <Heading className={styles.title}>{title}</Heading>
      {hasValue(description) ? <p className={styles.description}>{description}</p> : null}
    </div>
  );
});
