// apps/web/src/screens/dashboard/Ranking.tsx — 호출 순위(최근 7일 상위 7): Table single 36 · 순위 numeric muted · 수 500 numeric. 빈 상태 2종(발행 없음 / 호출 없음)
import { useId } from 'react';
import { EmptyState, Region, SectionHead, Table, type TableColumn } from '@/ui';
import type { DashboardRank, UsageRange } from '../../api/types';
import { DASHBOARD, rankingEmpty, usageRangeLabel } from '../../copy/dashboard';
import { formatCount } from '../../copy/format';
import styles from './Ranking.module.css';

type Row = DashboardRank & { rank: number };
const HEAD = DASHBOARD.rankingColumns;
const COLUMNS: TableColumn<Row>[] = [
  {
    key: 'rank',
    header: HEAD.rank,
    width: '16px',
    priority: 'high',
    numeric: true,
    cell: (r) => <span className={styles.rank}>{formatCount(r.rank)}</span>,
  },
  { key: 'name', header: HEAD.connector, width: 'minmax(0,1fr)', priority: 'high' },
  {
    key: 'calls',
    header: HEAD.calls,
    width: '66px',
    priority: 'high',
    numeric: true,
    cell: (r) => <span className={styles.calls}>{formatCount(r.calls)}</span>,
  },
];

type Props = {
  ranking: readonly DashboardRank[];
  range: UsageRange;
  hasCalls: boolean;
  published: number;
  /** 1024 — 표 low 열을 뺀다(DESIGN 화면 틀 대시보드형 1024 열) */
  narrow: boolean;
};

export function Ranking({ ranking, range, hasCalls, published, narrow }: Props) {
  const titleId = useId();
  const rows: Row[] = ranking.map((r, i) => ({ ...r, rank: i + 1 }));
  // 호출이 없거나 발행된 커넥터가 없으면 빈 상태
  const isEmpty = !hasCalls || published === 0;
  return (
    <Region aria-labelledby={titleId}>
      <SectionHead title={DASHBOARD.rankingTitle} titleId={titleId} note={usageRangeLabel(range)} />
      <div>
        {rows.length > 0 ? (
          <Table
            density="single"
            headless
            narrow={narrow}
            aria-label={DASHBOARD.rankingTitle}
            columns={COLUMNS}
            rows={rows}
            rowKey={(r) => r.connectorId}
          />
        ) : null}
        {isEmpty ? <EmptyState kind="nothing-yet" {...rankingEmpty(published, range)} /> : null}
      </div>
    </Region>
  );
}
