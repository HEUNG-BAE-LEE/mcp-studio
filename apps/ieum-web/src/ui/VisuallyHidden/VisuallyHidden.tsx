// VisuallyHidden — 화면에는 자리를 차지하지 않고 보조기기에는 읽히는 글자 · 표. 포커스를 받는 요소를 넣지 않는다
import type { ReactNode } from 'react';
import styles from './VisuallyHidden.module.css';

export type VisuallyHiddenElement = 'span' | 'div';

export type VisuallyHiddenProps = {
  /** 감싸는 요소 — 표처럼 블록 내용을 숨길 때 div */
  as?: VisuallyHiddenElement;
  /** aria-describedby · aria-labelledby 대상 */
  id?: string;
  children: ReactNode;
};

export function VisuallyHidden({ as: Element = 'span', id, children }: VisuallyHiddenProps) {
  return (
    <Element id={id} className={styles.root}>
      {children}
    </Element>
  );
}
