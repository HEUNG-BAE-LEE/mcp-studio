// DashboardScreen — 전체 자원의 구성 · 호출 집계를 한눈에 본다(기간 7일 고정) · 샘플 IA(언제든 바뀐다 — DESIGN 용어집)
// 진입: LNB 대시보드 항목(`/`) — 상위 화면이 없어 back 없음
// 틀: 대시보드형 · 스크롤 page
// 영역: 머리 = PageHeader(meta 기준 줄) · 구성 총합 = SummaryBand + SummaryCard + SegmentBar · 왼쪽 열 = Stack(Heatmap · Reserved) · 오른쪽 열 = Stack(LiveCalls Table · Ranking Table)
// 상태: 로딩 · 실패 = screenGate(ScreenState) · 없음 = 해당 없음(경로 id 없음) · 빈 상태 = EmptyState nothing-yet(순위 · 실시간) · 권한 = 읽기 전용이라 해당 없음
import { PageBody, PageColumns, PageHeader, Stack } from '@/ui';
import { useDashboardUsage } from '../../api/hooks/useDashboardUsage';
import type { UsageRange } from '../../api/types';
import { screenTitle } from '../../app/nav';
import { screenGate } from '../../app/screenGate';
import { useAppStore } from '../../app/store';
import { DASHBOARD } from '../../copy/dashboard';
import { asOfMeta } from './asOfMeta';
import { Composition } from './Composition';
import { Heatmap } from './Heatmap';
import { LiveCalls } from './LiveCalls';
import { Ranking } from './Ranking';
import { Reserved } from './Reserved';
import { publishedCount } from './summaryCards';

/** 기간은 7일 고정 — 샘플이라 전환을 두지 않는다 */
const RANGE: UsageRange = '7d';

export function DashboardScreen() {
  const usage = useDashboardUsage(RANGE);
  const narrow = useAppStore((s) => s.narrow);
  const gate = screenGate({ usage }, { loading: DASHBOARD.loading });
  if (!gate.ready) return <PageBody narrow={narrow}>{gate.state}</PageBody>;
  const data = gate.data.usage;
  const published = publishedCount(data.composition);
  return (
    <PageBody narrow={narrow}>
      <PageHeader
        title={screenTitle('dash')}
        meta={asOfMeta(data.asOf, data.range, data.hasCalls)}
      />
      <Composition composition={data.composition} narrow={narrow} />
      <PageColumns narrow={narrow}>
        <Stack>
          <Heatmap heatmap={data.heatmap} period={data.period} hasCalls={data.hasCalls} />
          <Reserved />
        </Stack>
        <Stack>
          <LiveCalls
            calls={data.live}
            hasCalls={data.hasCalls}
            published={published}
            narrow={narrow}
          />
          <Ranking
            ranking={data.ranking}
            range={data.range}
            hasCalls={data.hasCalls}
            published={published}
            narrow={narrow}
          />
        </Stack>
      </PageColumns>
    </PageBody>
  );
}
