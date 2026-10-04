// apps/web/src/screens/dashboard/Composition.tsx — 구성 총합 4칸(SummaryBand + SummaryCard + SegmentBar). 1024(`narrow`)면 2열
import { SegmentBar, SummaryBand, SummaryCard } from '@/ui';
import type { DashboardComposition } from '../../api/types';
import { DASHBOARD } from '../../copy/dashboard';
import { toSummaryCards } from './summaryCards';

type Props = { composition: DashboardComposition; narrow: boolean };

export function Composition({ composition, narrow }: Props) {
  return (
    <SummaryBand narrow={narrow} role="group" aria-label={DASHBOARD.compositionTitle}>
      {toSummaryCards(composition).map((card) => (
        <SummaryCard
          key={card.key}
          title={card.title}
          value={card.value}
          valueTone={card.valueTone}
        >
          <SegmentBar segments={card.segments} total={card.total} />
        </SummaryCard>
      ))}
    </SummaryBand>
  );
}
