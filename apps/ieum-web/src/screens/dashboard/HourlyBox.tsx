// HourlyBox — "시간대별 호출" 상자. 요약 조회가 실패하면 상자 안에 원문 실패 상자(머리는 남는다). 옛 js/menu/dashboard.js:42-44
import type { DashboardSummary } from '../../api/types';
import type { Gate } from '../../app/screenGate';
import { DASH } from '../../copy/dashboard-logs';
import { Box, ScreenState } from '@/ui';
import { HourlyChart } from './HourlyChart';

export function HourlyBox({ summaryGate }: { summaryGate: Gate<DashboardSummary> }) {
  return (
    // 차트 · 범례는 자기 여백을 가지므로 받은 값을 그릴 때는 본문 여백을 끈다. 실패 · 로딩 상자는 상자 여백 안에 둔다
    <Box title={DASH.chart.title} description={DASH.chart.sub} padded={summaryGate.kind !== 'ready'}>
      <ScreenState gate={summaryGate} scope="region">
        {(summary) => <HourlyChart hourly={summary.hourly} />}
      </ScreenState>
    </Box>
  );
}
