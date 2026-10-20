// InlineCode — 문장 안 짧은 코드 · 경로 · 식별자. 이음 .inline-code · .alert code(css/console.css:593)
import type { ReactNode } from 'react';
import styles from './InlineCode.module.css';

export type InlineCodeProps = {
  /** 코드 글자 */
  children: ReactNode;
};

/** 적힌 prop만 받는다 — className · 나머지 속성은 받지 않는다 */
export function InlineCode({ children }: InlineCodeProps) {
  return <code className={styles.root}>{children}</code>;
}
