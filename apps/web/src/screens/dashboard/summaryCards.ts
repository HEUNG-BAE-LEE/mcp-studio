// apps/web/src/screens/dashboard/summaryCards.ts — 구성 총합 4칸 뷰모델. 점검 필요 = 실패 + 갱신 중(0이면 faint). 발행 수 = 전체 − 미발행
import type { Segment, SummaryValueTone } from '@/ui';
import type { DashboardComposition } from '../../api/types';
import { DASHBOARD } from '../../copy/dashboard';
import { CONNECTOR_STATUS, SOURCE_TYPE } from '../../copy/status';

type SummaryCardModel = Readonly<{
  key: 'sources' | 'connectors' | 'tools' | 'attention';
  title: string;
  value: string;
  valueTone: SummaryValueTone;
  /** 폭 = round(n / total × 100)% — 칸 총합이 분모 */
  total: number;
  segments: readonly Segment[];
}>;

/** 발행된 커넥터 수 — 빈 상태 문구 분기(발행 없음 / 호출 없음) */
export const publishedCount = (c: DashboardComposition) =>
  c.connectors.total - c.connectors.byStatus.unpublished;

export function toSummaryCards(c: DashboardComposition): SummaryCardModel[] {
  const { byType } = c.sources;
  const { byStatus } = c.connectors;
  const attention = byStatus.failed + byStatus.updating;
  const notCalled = c.tools.published - c.tools.called;
  return [
    {
      key: 'sources',
      title: DASHBOARD.composition.sources,
      value: String(c.sources.total),
      valueTone: 'ink',
      total: c.sources.total,
      segments: [
        { label: SOURCE_TYPE.database, value: byType.database, tone: 'ink-soft' },
        { label: SOURCE_TYPE.document, value: byType.document, tone: 'muted' },
        { label: SOURCE_TYPE.code, value: byType.code, tone: 'faint' },
      ],
    },
    {
      key: 'connectors',
      title: DASHBOARD.composition.connectors,
      value: String(c.connectors.total),
      valueTone: 'ink',
      total: c.connectors.total,
      segments: [
        { label: CONNECTOR_STATUS.live.label, value: byStatus.live, tone: 'ink-soft' },
        { label: CONNECTOR_STATUS.updating.label, value: byStatus.updating, tone: 'progress' },
        { label: CONNECTOR_STATUS.failed.label, value: byStatus.failed, tone: 'fix' },
        // 미발행은 데이터 색 faint(상태 색 idle이 아니다)
        { label: CONNECTOR_STATUS.unpublished.label, value: byStatus.unpublished, tone: 'faint' },
      ],
    },
    {
      key: 'tools',
      title: DASHBOARD.composition.tools,
      value: String(c.tools.published),
      valueTone: 'ink',
      total: c.tools.published,
      segments: [
        { label: DASHBOARD.composition.called, value: c.tools.called, tone: 'ink-soft' },
        { label: DASHBOARD.composition.notCalled, value: notCalled, tone: 'empty' },
      ],
    },
    {
      key: 'attention',
      title: DASHBOARD.composition.attention,
      value: String(attention),
      valueTone: attention > 0 ? 'fix' : 'faint',
      total: attention,
      segments: [
        { label: CONNECTOR_STATUS.failed.label, value: byStatus.failed, tone: 'fix' },
        { label: CONNECTOR_STATUS.updating.label, value: byStatus.updating, tone: 'progress' },
      ],
    },
  ];
}
