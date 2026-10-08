// 카탈로그 CardGrid 절 — 세 조합(2·760 / 3·760 / 3·1100). 뷰어 폭을 760 · 1100 이하로 바꾸면 그 격자만 한 열로 접힌다
import type { ReactNode } from 'react';
import { CardGrid } from '../../ui';
import catalog from './catalog.module.css';
import styles from './CardGridSection.module.css';

const cells = (count: number): ReactNode[] =>
  Array.from({ length: count }, (_, index) => (
    <div key={index} className={styles.cell}>
      칸 {index + 1}
    </div>
  ));

export function CardGridSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        정해 둔 세 조합만. 칸 사이 --s-2-5이고 열은 같은 폭(최소 폭 0)이다. 새 열 수 · 접는 폭은 design-change로 조합을 더한다.
      </p>
      <h3 className={catalog.heading}>columns=2 · collapseAt=760</h3>
      <CardGrid columns={2} collapseAt={760}>
        {cells(4)}
      </CardGrid>
      <h3 className={catalog.heading}>columns=3 · collapseAt=760</h3>
      <CardGrid columns={3} collapseAt={760}>
        {cells(6)}
      </CardGrid>
      <h3 className={catalog.heading}>columns=3 · collapseAt=1100</h3>
      <CardGrid columns={3} collapseAt={1100}>
        {cells(3)}
      </CardGrid>
    </div>
  );
}
