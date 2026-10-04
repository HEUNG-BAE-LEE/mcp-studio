import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './HelperPanel.module.css';

export type HelperPanelProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  /** 문자열이면 `aria-label`로도 쓴다 */
  title?: ReactNode;
  children?: ReactNode;
};

/** 흐름 우측 안내(제목 500 13 `muted`). 단계 목록 · 현재 안내는 화면 몫 */
export const HelperPanel = forwardRef<HTMLElement, HelperPanelProps>(function HelperPanel(
  { title, children, className, ...rest },
  ref,
) {
  return (
    <aside
      {...rest}
      aria-label={typeof title === 'string' ? title : rest['aria-label']}
      className={cx(styles.root, className)}
      ref={ref}
    >
      {title !== undefined ? <span className={styles.title}>{title}</span> : null}
      {children}
    </aside>
  );
});
