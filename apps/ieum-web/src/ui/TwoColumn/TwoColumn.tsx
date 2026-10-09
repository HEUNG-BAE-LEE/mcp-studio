// TwoColumn — 화면 본문 두 열. 이음 .dgrid · .td-grid · .dp-grid · .dsum · .dgrid2(css/console.css:538,674,798,959,1019)
// 비율 · 간격 · 정렬 · 접는 폭은 layout이 정한다(CSS의 data-layout). 접히면 앞 칸 위 · 뒤 칸 아래
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './TwoColumn.module.css';

export type TwoColumnLayout = 'main-side' | 'main-aside' | 'half' | 'summary' | 'live';

export type TwoColumnProps = {
  /** 비율 · 간격 · 정렬 · 접는 폭 — COMPONENTS TwoColumn 표 */
  layout: TwoColumnLayout;
  /** 두 칸 — 접히면 앞 칸 위, 뒤 칸 아래 */
  children: [ReactNode, ReactNode];
  /** 배치(바깥 여백)만 */
  className?: string;
};

export function TwoColumn({ layout, children, className }: TwoColumnProps) {
  return (
    <div className={cx(styles.root, className)} data-layout={layout}>
      {children}
    </div>
  );
}
