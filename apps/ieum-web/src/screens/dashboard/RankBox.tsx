// RankBox — "많이 쓰인 도구" 상자: 지금도 있는 도구만 호출 수 순으로, 첫 항목 대비 비율 막대와 함께. 옛 js/menu/dashboard.js:46-48
// 머리 오른쪽 "호출 로그 보기"는 로그 메뉴의 마지막 주소로 가고 로그를 다시 받는다(옛 nav — js/main.js:29)
import type { DashboardSummary, Source } from '../../api/types';
import type { ToolIndex } from '../../api/hooks/useTools';
import { useMenuHref } from '../../app/lastPath';
import { refreshMenu } from '../../app/menuRefresh';
import type { Gate } from '../../app/screenGate';
import { DASH } from '../../copy/dashboard-logs';
import { fmtNum } from '../../copy/format';
import { Box, EmptyState, LinkButton, ProgressBar, ScreenState } from '@/ui';
import styles from './RankBox.module.css';
import { sourceNameOf } from './sourceName';

// 옛은 막대 폭을 백분율 소수 첫째 자리까지 잘라 썼다(toFixed(1)) — 같은 비율을 0~1로 건넨다
const PERCENT = 100;
const PERCENT_DIGITS = 1;
const ratioOf = (calls: number, max: number): number => Number(((calls / max) * PERCENT).toFixed(PERCENT_DIGITS)) / PERCENT;

type RankListProps = Readonly<{
  summary: DashboardSummary;
  sources: readonly Source[];
  tools: ToolIndex;
}>;

function RankList({ summary, sources, tools }: RankListProps) {
  // 호출 뒤 지워진 도구는 순위에서 뺀다
  const visible = summary.topTools.filter((t) => Object.hasOwn(tools.byId, t.id));
  if (visible.length === 0) {
    return (
      <EmptyState kind="section" container="inline">
        {DASH.rank.empty}
      </EmptyState>
    );
  }
  const max = visible[0]?.calls || 1;
  return (
    <ul className={styles.list}>
      {visible.map((t) => (
        <li key={t.id} className={styles.row}>
          <span className={styles.name}>
            <b className={styles.toolId}>{t.id}</b>
            <span className={styles.source}>{sourceNameOf(sources, t.src)}</span>
          </span>
          <span className={styles.count}>{fmtNum(t.calls)}</span>
          <ProgressBar value={ratioOf(t.calls, max)} variant="meter" className={styles.meter} />
        </li>
      ))}
    </ul>
  );
}

type RankBoxProps = Readonly<{
  sources: readonly Source[];
  tools: ToolIndex;
  summaryGate: Gate<DashboardSummary>;
}>;

export function RankBox({ sources, tools, summaryGate }: RankBoxProps) {
  const logsHref = useMenuHref('logs');
  return (
    <Box
      title={DASH.rank.title}
      description={DASH.rank.sub}
      actions={
        <LinkButton to={logsHref} onClick={() => refreshMenu('logs')}>
          {DASH.rank.toLogs}
        </LinkButton>
      }
      padded={summaryGate.kind !== 'ready'}
    >
      <ScreenState gate={summaryGate} scope="region">
        {(summary) => <RankList summary={summary} sources={sources} tools={tools} />}
      </ScreenState>
    </Box>
  );
}
