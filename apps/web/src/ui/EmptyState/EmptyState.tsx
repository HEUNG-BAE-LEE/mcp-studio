import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './EmptyState.module.css';

const CLEAR_LABEL = '검색 · 필터 지우기';

type Base = Omit<HTMLAttributes<HTMLDivElement>, 'title'>;
export type EmptyStateProps =
  | (Base & {
      kind: 'not-created';
      title: string;
      body: ReactNode;
      /** 없으면(undefined · null) 액션 래퍼(위 4)를 그리지 않는다 */
      action?: ReactNode;
      hint?: ReactNode;
    })
  | (Base & {
      kind: 'nothing-yet';
      title: string;
      body: ReactNode;
    })
  | (Base & { kind: 'filtered'; body: ReactNode; onClear: () => void; clearLabel?: string });

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  function EmptyState(props, ref) {
    switch (props.kind) {
      case 'filtered': {
        const { kind, className, body, onClear, clearLabel = CLEAR_LABEL, ...rest } = props;
        return (
          <div
            {...rest}
            className={cx(styles.root, className)}
            data-kind={kind}
            role="status"
            ref={ref}
          >
            <span className={styles.body}>{body}</span>
            <button type="button" className={styles.clear} onClick={onClear}>
              {clearLabel}
            </button>
          </div>
        );
      }
      case 'nothing-yet': {
        const { kind, className, title, body, ...rest } = props;
        return (
          <div
            {...rest}
            className={cx(styles.root, className)}
            data-kind={kind}
            role="status"
            ref={ref}
          >
            <span className={styles.title}>{title}</span>
            <span className={styles.body}>{body}</span>
          </div>
        );
      }
      case 'not-created': {
        const { kind, className, title, body, action, hint, ...rest } = props;
        return (
          <div
            {...rest}
            className={cx(styles.root, className)}
            data-kind={kind}
            role="status"
            ref={ref}
          >
            <span className={styles.title}>{title}</span>
            <span className={styles.body}>{body}</span>
            {action != null ? <span className={styles.action}>{action}</span> : null}
            {hint ? <span className={styles.hint}>{hint}</span> : null}
          </div>
        );
      }
    }
  },
);
