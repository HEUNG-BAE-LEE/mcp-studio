// 카탈로그 TwoColumn 절 — layout 다섯(main-side · main-aside · half · summary · live) 한 줄씩. 비율 · 간격 · 정렬(위 / 늘임) · 접힘은
// 폭 전환으로 본다(1360 이하 live 외 한 열, 1100 이하 live 한 열). 칸은 높이가 달라 정렬 차이가 보인다
import type { ReactNode } from 'react';
import { Box } from '../../ui/Box';
import { TwoColumn, type TwoColumnLayout } from '../../ui/TwoColumn';
import catalog from './catalog.module.css';
import styles from './TwoColumnSection.module.css';

type LayoutRow = { layout: TwoColumnLayout; note: string };

const ROWS: readonly LayoutRow[] = [
  { layout: 'main-side', note: '1.55 : 1 · 간격 --s-5 · 위 정렬 · 1360에서 접힘' },
  { layout: 'main-aside', note: '1fr + --w-policy-aside · 간격 --s-7 · 위 정렬 · 1360에서 접힘' },
  { layout: 'half', note: '1 : 1 · 간격 --s-6 · 위 정렬 · 1360에서 접힘' },
  { layout: 'summary', note: '1.35 : 1 · 간격 --s-5 · 늘임 · 1360에서 접힘' },
  { layout: 'live', note: '1.15 : 1 · 간격 --s-5 · 늘임(칸 안 상자가 높이를 채움) · 1100에서 접힘' },
];

const cell = (text: string, tall = false): ReactNode => (
  <div className={tall ? `${styles.cell} ${styles.tall}` : styles.cell}>{text}</div>
);

export function TwoColumnSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        정해 둔 다섯 조합만. 칸은 최소 폭 0으로 줄어들고, 접히면 앞 칸 위 · 뒤 칸 아래다. 새 비율은 design-change로 조합을 더한다.
      </p>
      {ROWS.map(({ layout, note }) => (
        <div key={layout} className={catalog.stack}>
          <h3 className={catalog.heading}>layout={layout}</h3>
          <p className={catalog.note}>{note}</p>
          <TwoColumn layout={layout}>
            {cell('앞 칸', true)}
            {cell('뒤 칸')}
          </TwoColumn>
        </div>
      ))}
      <h3 className={catalog.heading}>live — 칸 안 Box가 높이를 채운다</h3>
      <TwoColumn layout="live">
        <Box title="실시간 호출" padded>
          앞 칸 — 뒤 칸이 길어도 상자 바닥이 같다.
        </Box>
        <Box title="기록" padded>
          뒤 칸
          <br />
          더 긴 내용
          <br />
          셋째 줄
        </Box>
      </TwoColumn>
    </div>
  );
}
