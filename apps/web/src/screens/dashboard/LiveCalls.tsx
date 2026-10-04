// apps/web/src/screens/dashboard/LiveCalls.tsx — 실시간 호출 13행 + LIVE 메모(정적): Table single 36 · 시각 mono · 도구 mono low · 결과 ink-soft. 빈 상태는 hasCalls=false
import { useId } from 'react';
import { EmptyState, Region, SectionHead, Table, type TableColumn } from '@/ui';
import type { DashboardCall } from '../../api/types';
import { DASHBOARD, formatCallResult, liveEmpty } from '../../copy/dashboard';
import { clockLabel } from '../../copy/time';
import styles from './LiveCalls.module.css';

const HEAD = DASHBOARD.liveColumns;
const COLUMNS: TableColumn<DashboardCall>[] = [
  {
    key: 'at',
    header: HEAD.at,
    width: '60px',
    priority: 'high',
    mono: true,
    cell: (c) => <span className={styles.muted}>{clockLabel(c.at)}</span>,
  },
  {
    key: 'connector',
    header: HEAD.connector,
    // 커넥터와 도구가 같은 폭(1fr)을 나눠, 12px mono 도구 이름(`search_payout_rule`)이 잘리지 않는다
    width: 'minmax(0,1fr)',
    priority: 'high',
    cell: (c) => <span className={styles.connector}>{c.connector}</span>,
  },
  {
    key: 'tool',
    header: HEAD.tool,
    width: 'minmax(0,1fr)',
    priority: 'low',
    mono: true,
    cell: (c) => <span className={styles.muted}>{c.tool}</span>,
  },
  {
    key: 'result',
    header: HEAD.result,
    width: '62px',
    priority: 'high',
    numeric: true,
    cell: (c) => <span className={styles.result}>{formatCallResult(c)}</span>,
  },
];

type Props = {
  calls: readonly DashboardCall[];
  hasCalls: boolean;
  published: number;
  narrow: boolean;
};

export function LiveCalls({ calls, hasCalls, published, narrow }: Props) {
  const titleId = useId();
  return (
    <Region aria-labelledby={titleId}>
      <SectionHead title={DASHBOARD.liveTitle} titleId={titleId} note={DASHBOARD.liveMarker} />
      <div>
        {calls.length > 0 ? (
          <Table
            density="single"
            headless
            narrow={narrow}
            aria-label={DASHBOARD.liveTitle}
            columns={COLUMNS}
            rows={calls}
            rowKey={(c) => c.id}
          />
        ) : null}
        {!hasCalls ? <EmptyState kind="nothing-yet" {...liveEmpty(published)} /> : null}
      </div>
    </Region>
  );
}
