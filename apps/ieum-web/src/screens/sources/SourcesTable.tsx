// 원본 시스템 표 — 옛 srcRows · vSrc의 표(apps/web/ieum/js/menu/sources.js:3-20,32-35). 8열, 원본 · 명세만 왼쪽 정렬, 최소 폭 980.
// 행 전체가 눌리고(포커스 · Enter · Space는 Table 행 계약) 누르면 그 원본을 연다 — 인증이 만료된 원본은 재인증 모달, 아니면 도구(onOpen).
// 관리 칸 버튼은 자기 동작이 이긴다: TableRow가 tr의 click에 onActivate를 달아 안쪽 버튼의 click이 올라오므로 stopPropagation으로 끊는다(옛은 가장 가까운 data-act가 이겼다 — js/main.js:48)
// 빈 목록은 표 안 한 행 — 연결된 원본이 0개면 처음 안내, 조건에 맞는 것이 0개면 조건 안내(sources.js:6)
// 명세 · 인증 · 마지막 동기화 칸은 서버 문자열 그대로다(마지막 동기화 "방금"은 시간이 지나도 받은 그대로 — sources.js:13,16)
import type { MouseEvent } from 'react';
import { protocolLabel } from '../../copy/protocol';
import { SOURCES } from '../../copy/sources';
import {
  Button,
  EmptyState,
  ProtocolBadge,
  SourceStatus,
  Table,
  TableCell,
  TableHeadCell,
  TableRow,
  type ProtocolKind,
} from '@/ui';
import { isKnownProto, type SourceRow } from './sourceRows';
import styles from './SourcesScreen.module.css';

const COLUMN_COUNT = 8;

type SourcesTableProps = Readonly<{
  /** 받은 전체 원본 수 — 빈 상태 종류를 가른다 */
  total: number;
  /** 조건에 맞는 행(서버 순서 그대로) */
  rows: readonly SourceRow[];
  /** 행 · "도구 보기" — 원본 id. 인증이 만료된 원본이면 재인증 모달을 연다(useGoSource) */
  onOpen: (sourceId: string) => void;
  onReauth: (sourceId: string) => void;
  onDelete: (sourceId: string) => void;
}>;

const head = (
  <>
    <TableHeadCell align="start">{SOURCES.table.columns.name}</TableHeadCell>
    <TableHeadCell>{SOURCES.table.columns.proto}</TableHeadCell>
    <TableHeadCell align="start">{SOURCES.table.columns.spec}</TableHeadCell>
    <TableHeadCell>{SOURCES.table.columns.auth}</TableHeadCell>
    <TableHeadCell>{SOURCES.table.columns.tools}</TableHeadCell>
    <TableHeadCell>{SOURCES.table.columns.status}</TableHeadCell>
    <TableHeadCell>{SOURCES.table.columns.sync}</TableHeadCell>
    <TableHeadCell>{SOURCES.table.columns.manage}</TableHeadCell>
  </>
);

/** 모르는 연결 방식은 배지가 모르는 값 모양이다(글자는 protocolLabel이 값 그대로) */
const protocolKindOf = (proto: string): ProtocolKind => (isKnownProto(proto) ? proto : 'unknown');

/** 칸 안 버튼의 click — 행 동작(tr의 click)으로 올라가지 않게 끊고 자기 동작만 한다 */
const withoutRowClick =
  (action: () => void) =>
  (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    action();
  };

type SourceTableRowProps = Readonly<{ row: SourceRow } & Pick<SourcesTableProps, 'onOpen' | 'onReauth' | 'onDelete'>>;

function SourceTableRow({ row, onOpen, onReauth, onDelete }: SourceTableRowProps) {
  const { source } = row;
  return (
    <TableRow onActivate={() => onOpen(source.id)}>
      <TableCell align="start">
        <b className={styles.name}>{source.name}</b>
        <span className={styles.desc}>{source.desc}</span>
      </TableCell>
      <TableCell>
        <ProtocolBadge kind={protocolKindOf(source.proto)} label={protocolLabel(source.proto)} />
      </TableCell>
      <TableCell align="start">
        <span className={styles.spec}>{source.spec}</span>
      </TableCell>
      <TableCell>
        <span className={styles.auth}>{source.auth}</span>
      </TableCell>
      <TableCell>
        <span className={styles.published}>{row.published}</span>{' '}
        <span className={styles.total}>{SOURCES.table.total(row.total)}</span>
        {row.pending > 0 ? <div className={styles.pending}>{SOURCES.table.pending(row.pending)}</div> : null}
      </TableCell>
      <TableCell>
        <SourceStatus status={row.status} variant="chip" />
      </TableCell>
      <TableCell>
        <span className={styles.sync}>{source.sync}</span>
      </TableCell>
      <TableCell>
        {source.err ? (
          <Button size="sm" onClick={withoutRowClick(() => onReauth(source.id))}>
            {SOURCES.table.reauth}
          </Button>
        ) : (
          <Button size="sm" onClick={withoutRowClick(() => onOpen(source.id))}>
            {SOURCES.table.viewTools}
          </Button>
        )}{' '}
        <Button size="sm" aria-label={SOURCES.table.deleteLabel(source.name)} onClick={withoutRowClick(() => onDelete(source.id))}>
          {SOURCES.table.delete}
        </Button>
      </TableCell>
    </TableRow>
  );
}

/** 표 안 한 행 — 받은 원본이 0개면 처음 안내, 있는데 조건에 맞는 것이 0개면 조건 안내 */
function EmptyRow({ total }: Readonly<{ total: number }>) {
  if (total > 0) {
    return (
      <EmptyState kind="filtered" container="table" colSpan={COLUMN_COUNT}>
        {SOURCES.empty.filtered}
      </EmptyState>
    );
  }
  return (
    <EmptyState kind="first" container="table" colSpan={COLUMN_COUNT}>
      {SOURCES.empty.firstPre}
      <b>{SOURCES.empty.firstStrong}</b>
      {SOURCES.empty.firstPost}
    </EmptyState>
  );
}

export function SourcesTable({ total, rows, onOpen, onReauth, onDelete }: SourcesTableProps) {
  return (
    <Table className={styles.table} minWidth={980} head={head}>
      {rows.length > 0 ? (
        rows.map((row) => (
          <SourceTableRow key={row.source.id} row={row} onOpen={onOpen} onReauth={onReauth} onDelete={onDelete} />
        ))
      ) : (
        <EmptyRow total={total} />
      )}
    </Table>
  );
}
