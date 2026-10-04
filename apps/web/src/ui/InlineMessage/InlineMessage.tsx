import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './InlineMessage.module.css';

export type InlineMessageProps = Omit<HTMLAttributes<HTMLParagraphElement>, 'role' | 'children'> & {
  /** 한 줄 문장(copy의 code 틀) */
  children: ReactNode;
  /** `aria-describedby` 대상 — 호출자가 useId()로 만든다 */
  id?: string;
};

/** 폼 칸 밖 검증 · 거부 한 줄(label 500 12 fix-fg). 나타날 때 role=alert — Field · InlineEdit도 안에서 쓴다 */
export const InlineMessage = forwardRef<HTMLParagraphElement, InlineMessageProps>(
  function InlineMessage({ children, className, ...rest }, ref) {
    return (
      <p {...rest} role="alert" className={cx(styles.root, className)} ref={ref}>
        {children}
      </p>
    );
  },
);
