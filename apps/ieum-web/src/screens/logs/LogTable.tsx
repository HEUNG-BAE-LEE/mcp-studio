// 호출 로그 표 — 옛 logRows · vLogs의 표(apps/web/ieum/js/menu/logs.js:11-13,24-26). 8열, 도구 · 원본만 왼쪽 정렬, 최소 폭 960.
// 행 전체가 눌리고(포커스 · Enter · Space는 Table 행 계약) 누르면 그 행의 상세를 연다. 행은 id로 그려 드로어를 닫으면 누른 행으로 포커스가 돌아온다.
// 빈 목록은 표 안 한 행 — 로그가 0개면 처음 안내, 조건에 맞는 것이 0개면 조건 안내(logs.js:11)
import type { LogRow } from '../../api/types';
import { LOGS } from '../../copy/dashboard-logs';
import { EmptyState, Table, TableCell, TableHeadCell, TableRow } from '@/ui';
import { LogStatusChip } from './LogStatusChip';
import { logRowText, type LogContext } from './logView';
import styles from './LogsScreen.module.css';

const COLUMN_COUNT = 8;

type LogTableProps = Readonly<{
  /** 받은 전체 행 — 빈 상태 종류를 가른다 */
  total: number;
  /** 조건에 맞는 행(서버 순서 그대로) */
  rows: readonly LogRow[];
  context: LogContext;
  onOpen: (id: string) => void;
}>;

const head = (
  <>
    <TableHeadCell>{LOGS.cols.time}</TableHeadCell>
    <TableHeadCell>{LOGS.cols.user}</TableHeadCell>
    <TableHeadCell>{LOGS.cols.client}</TableHeadCell>
    <TableHeadCell align="start">{LOGS.cols.tool}</TableHeadCell>
    <TableHeadCell align="start">{LOGS.cols.source}</TableHeadCell>
    <TableHeadCell>{LOGS.cols.convert}</TableHeadCell>
    <TableHeadCell>{LOGS.cols.sourceMs}</TableHeadCell>
    <TableHeadCell>{LOGS.cols.status}</TableHeadCell>
  </>
);

type LogTableRowProps = Readonly<{ row: LogRow; context: LogContext; now: number; onOpen: (id: string) => void }>;

function LogTableRow({ row, context, now, onOpen }: LogTableRowProps) {
  const text = logRowText(row, context, now);
  return (
    <TableRow onActivate={() => onOpen(row.id)}>
      <TableCell>
        <span className={styles.time}>{text.time}</span>
      </TableCell>
      <TableCell>{text.user}</TableCell>
      <TableCell>{text.client}</TableCell>
      <TableCell align="start">
        <span className={styles.toolId}>{text.tool}</span>
      </TableCell>
      <TableCell align="start">
        <span className={styles.source}>{text.source}</span>
      </TableCell>
      <TableCell>
        <span className={styles.figure}>{text.convert}</span>
      </TableCell>
      <TableCell>
        <span className={styles.figure}>{text.sourceMs}</span>
      </TableCell>
      <TableCell>
        <LogStatusChip status={row.status} />
      </TableCell>
    </TableRow>
  );
}

export function LogTable({ total, rows, context, onOpen }: LogTableProps) {
  // 오늘인지 가르는 기준 — 한 번 그릴 때 모든 행이 같은 기준을 쓴다(옛은 그릴 때마다 지금 시각)
  const now = Date.now();
  return (
    <Table className={styles.table} minWidth={960} head={head}>
      {rows.length > 0 ? (
        rows.map((row) => <LogTableRow key={row.id} row={row} context={context} now={now} onOpen={onOpen} />)
      ) : (
        <EmptyState kind={total > 0 ? 'filtered' : 'first'} container="table" colSpan={COLUMN_COUNT}>
          {total > 0 ? LOGS.empty.filtered : LOGS.empty.first}
        </EmptyState>
      )}
    </Table>
  );
}
