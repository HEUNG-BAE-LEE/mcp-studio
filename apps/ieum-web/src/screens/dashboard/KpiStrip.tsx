// KpiStrip — KPI 다섯 칸. 앞 두 칸(원본 · 공개 도구 수)은 화면이 원본 · 도구 목록에서 세고(옛 js/menu/dashboard.js:5-8),
// 뒤 세 칸(호출 · 성공률 · 변환 시간)은 요약 조회 값이다. 요약이 실패하면 뒤 세 칸 자리에 원문 실패 상자 하나를 둔다
import type { DashboardKpi, DashboardSummary, Source } from '../../api/types';
import type { ToolIndex } from '../../api/hooks/useTools';
import type { Gate } from '../../app/screenGate';
import { sourceStatusOf } from '../../app/status/sourceStatus';
import { DASH } from '../../copy/dashboard-logs';
import { fmtNum, NONE_REASON, orNone } from '../../copy/format';
import { ScreenState, StatStrip, type StatItem } from '@/ui';

/** 요약과 무관하게 화면이 세는 앞 칸 수 */
const COUNT_CELLS = 2;
const KPI_COLUMNS = 5;

function countItems(sources: readonly Source[], tools: ToolIndex): readonly StatItem[] {
  const healthy = sources.filter((s) => sourceStatusOf(s, tools.bySource[s.id] ?? []) === 'ok').length;
  const published = tools.all.filter((t) => t.status === 'done').length;
  const pending = tools.all.filter((t) => t.status === 'review' || t.status === 'drift').length;
  return [
    {
      label: DASH.kpi.sources.label,
      value: sources.length,
      unit: DASH.kpi.sources.unit,
      description: DASH.kpi.sources.detail(healthy, sources.length - healthy),
    },
    { label: DASH.kpi.tools.label, value: published, unit: DASH.kpi.tools.unit, description: DASH.kpi.tools.detail(pending) },
  ];
}

/** 전일 대비: 기록이 없으면 사유 문구, 있으면 0 이상은 위 · 미만은 아래 방향 + 크기 */
function callsItem(kpi: DashboardKpi): StatItem {
  const { label, unit, delta, deltaTail } = DASH.kpi.calls;
  const pct = kpi.callsDeltaPct;
  const trend: StatItem['trend'] = pct === null ? undefined : { direction: pct >= 0 ? 'up' : 'down', text: delta(pct) };
  return {
    label,
    value: fmtNum(kpi.calls24h),
    unit,
    trend,
    description: pct === null ? NONE_REASON.noPrevDay : deltaTail,
  };
}

function summaryItems(kpi: DashboardKpi): readonly StatItem[] {
  const { success, convert } = DASH.kpi;
  return [
    callsItem(kpi),
    {
      label: success.label,
      value: orNone(kpi.successRate),
      unit: kpi.successRate === null ? undefined : success.unit,
      description: success.failed(kpi.failedCalls),
    },
    {
      label: convert.label,
      value: orNone(kpi.convertMs),
      unit: kpi.convertMs === null ? undefined : convert.unit,
      description: kpi.sourceMs === null ? NONE_REASON.noCallsYet : convert.sourceAvg(kpi.sourceMs),
    },
  ];
}

type KpiStripProps = Readonly<{
  sources: readonly Source[];
  tools: ToolIndex;
  summaryGate: Gate<DashboardSummary>;
  /** 배치(바깥 여백)만 */
  className?: string;
}>;

export function KpiStrip({ sources, tools, summaryGate, className }: KpiStripProps) {
  const counts = countItems(sources, tools);
  if (summaryGate.kind === 'ready') {
    return <StatStrip columns={KPI_COLUMNS} items={[...counts, ...summaryItems(summaryGate.data.kpi)]} className={className} />;
  }
  return (
    <StatStrip
      columns={KPI_COLUMNS}
      items={counts}
      failure={{
        from: COUNT_CELLS,
        content: (
          <ScreenState gate={summaryGate} scope="region">
            {() => null}
          </ScreenState>
        ),
      }}
      className={className}
    />
  );
}
