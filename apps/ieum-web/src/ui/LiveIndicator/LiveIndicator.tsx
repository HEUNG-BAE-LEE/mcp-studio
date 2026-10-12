// LiveIndicator — 진행 중임을 알리는 깜빡이는 점 + 글자. 이음 .live(css/console.css:961-962) · 쓰는 곳 js/menu/discovery.js:235,246
// 점은 장식(aria-hidden)이고 뜻은 글자가 전한다. 보이고 숨기는 것은 쓰는 곳이 그릴지로 정한다(옛 hidden)
import type { ReactNode } from 'react';
import styles from './LiveIndicator.module.css';

export type LiveIndicatorProps = {
  /** 글자 — 쓰는 곳 copy/에서 온다 */
  children: ReactNode;
};

export function LiveIndicator({ children }: LiveIndicatorProps) {
  return (
    <span className={styles.root}>
      <span className={styles.dot} aria-hidden="true" />
      {children}
    </span>
  );
}
