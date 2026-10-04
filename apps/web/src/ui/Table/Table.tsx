import {
  forwardRef,
  type CSSProperties,
  type ForwardedRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cx } from '../lib/cx';
import styles from './Table.module.css';

type TableColumnBase = {
  key: string;
  header: ReactNode;
  /** grid 트랙 문자열: 'minmax(0,1.4fr)' · '56px' */
  width: string;
  /** 1024 폭(narrow)에서 low 열은 DOM에서 뺀다 */
  priority: 'high' | 'low';
  /**
   * 최소 폭(고정 px, `'120px'`). 주면 트랙이 `minmax(minWidth, <width의 최대값>)`이 되고,
   * 열 최소 폭 합이 표 폭보다 크면 표가 자기 상자 안에서 가로 스크롤한다(헤더 함께) — 동적 결과 표
   */
  minWidth?: string;
  /** 셀 글자 `--t-mono`(식별자 · 기계 값) */
  mono?: boolean;
  /** 값이 null · undefined · ''일 때 보여 줄 사유 */
  emptyReason?: string;
};

/** 셀 내용 — 버튼 · 링크처럼 조작되는 내용은 행 클릭(onRowClick)으로 번지지 않도록 자기 핸들러에서 e.stopPropagation()을 부른다 */
type TableCellRender<T> = (row: T) => ReactNode;

/** `numeric` 열은 `cell`이 필수다(타입이 막는다) — 서식(copy/format)을 거친 글을 돌려준다 */
export type TableColumn<T> = TableColumnBase &
  (
    | {
        /** 글 열(기본) */
        numeric?: false;
        /** 셀 내용. 없으면 row[key](문자열 · 숫자만, 0 포함) */
        cell?: TableCellRender<T>;
      }
    | {
        /** tabular-nums + 우측 정렬 */
        numeric: true;
        /** 셀 내용(필수) — 서식(copy/format)을 거친 글 */
        cell: TableCellRender<T>;
      }
  );

export type TableCellLinesProps = {
  /** 첫 줄 — 행 글자(double `body` 400 14 `ink-soft`) 그대로 */
  main: ReactNode;
  /** 둘째 줄 — `--t-caption` 400 12/1.4 `muted` */
  sub: ReactNode;
};

/** 두 줄 셀(column `cell`에서 쓴다). 줄마다 ellipsis. `density="double"` 행에 둔다 */
export function TableCellLines({ main, sub }: TableCellLinesProps) {
  return (
    <span className={styles.lines}>
      <span className={styles.line}>{main}</span>
      <span className={cx(styles.line, styles.sub)}>{sub}</span>
    </span>
  );
}

/** double 두 줄 행 `h-row` 44(기본) · single 한 줄 행 `h-row-single` 36 */
export type TableDensity = 'double' | 'single';

export type TableProps<T> = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
  /** 행마다 유일해야 한다(React key · selectedKey 비교) */
  rowKey: (row: T) => string;
  density?: TableDensity;
  /** 헤더 행 없음(순위 · 실시간 목록). 이때 aria-label 필수 */
  headless?: boolean;
  /** 1024 폭: priority 'low' 열 제거 */
  narrow?: boolean;
  /** 선택 표 — 주면 행마다 `aria-selected`(선택 행 `accent-soft`). 없으면 `aria-selected`를 달지 않는다 */
  selectedKey?: string;
  /** 있을 때만 행이 포인터 · 포커스 · Enter · Space를 받는다 */
  onRowClick?: (row: T) => void;
};

const isEmptyValue = (v: unknown): boolean => v === null || v === undefined || v === '';

/** row[key]가 문자열 · 숫자(0 포함)면 그대로, 그 밖(불리언 · 객체 · null)은 값 없음 → emptyReason이 있으면 사유, 없으면 빈 칸 */
function defaultCell<T>(row: T, key: string): ReactNode {
  const v = (row as Record<string, unknown>)[key];
  return typeof v === 'string' || typeof v === 'number' ? v : null;
}

function TableCell<T>({ column, row }: { column: TableColumn<T>; row: T }) {
  const value = column.cell ? column.cell(row) : defaultCell(row, column.key);
  const isEmpty = isEmptyValue(value) && column.emptyReason !== undefined;
  // 글 셀은 말줄임될 수 있다 — 전체 값을 title로(숫자 열 · 노드 셀 제외)
  const title = !column.numeric && typeof value === 'string' && value !== '' ? value : undefined;
  return (
    <div
      role="cell"
      className={styles.cell}
      title={title}
      data-numeric={column.numeric || undefined}
      data-mono={column.mono || undefined}
      data-empty={isEmpty || undefined}
    >
      {isEmpty ? column.emptyReason : value}
    </div>
  );
}

type TableRowProps<T> = {
  row: T;
  columns: readonly TableColumn<T>[];
  tracks: CSSProperties;
  /** 선택 표가 아니면 undefined — aria-selected를 달지 않는다 */
  isSelected: boolean | undefined;
  onRowClick?: (row: T) => void;
};

function TableRow<T>({ row, columns, tracks, isSelected, onRowClick }: TableRowProps<T>) {
  const isClickable = onRowClick !== undefined;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // 셀 안 버튼 등에서 올라온 키는 그 요소 몫이다(행 중복 호출 · 기본 동작 막기 방지)
    if (e.target !== e.currentTarget) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onRowClick?.(row);
  };
  return (
    <div
      role="row"
      className={styles.row}
      style={tracks}
      data-clickable={isClickable || undefined}
      aria-selected={isSelected}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? () => onRowClick(row) : undefined}
      onKeyDown={isClickable ? onKeyDown : undefined}
    >
      {columns.map((c) => (
        <TableCell key={c.key} column={c} row={row} />
      ))}
    </div>
  );
}

function TableHead<T>({
  columns,
  tracks,
}: {
  columns: readonly TableColumn<T>[];
  tracks: CSSProperties;
}) {
  return (
    <div role="rowgroup">
      <div role="row" className={styles.head} style={tracks}>
        {columns.map((c) => (
          <div
            key={c.key}
            role="columnheader"
            className={styles.cell}
            data-numeric={c.numeric || undefined}
          >
            {c.header}
          </div>
        ))}
      </div>
    </div>
  );
}

const FIXED_PX = /^\d+(\.\d+)?px$/;
const MINMAX_ZERO = /^minmax\(\s*0(px)?\s*,\s*(.+)\)$/;

/** grid 트랙 — minWidth가 있으면 minmax(minWidth, <width의 최대값>) */
function trackOf<T>(c: TableColumn<T>): string {
  if (c.minWidth === undefined) return c.width;
  const max = MINMAX_ZERO.exec(c.width)?.[2] ?? c.width;
  return `minmax(${c.minWidth}, ${max})`;
}

/** 가로 스크롤 기준 폭 = 열 최소 폭(없으면 고정 px 폭 · 그 밖 0) 합 + 열 간격 + 행 좌우 안쪽 */
function minTrackWidth<T>(columns: readonly TableColumn<T>[]): string {
  const mins = columns.map((c) => c.minWidth ?? (FIXED_PX.test(c.width) ? c.width : '0px'));
  return `calc(${mins.join(' + ')} + ${columns.length - 1} * var(--table-gap) + 2 * var(--s-2-5))`;
}

function TableInner<T>(
  {
    columns,
    rows,
    rowKey,
    density = 'double',
    headless = false,
    narrow = false,
    selectedKey,
    onRowClick,
    className,
    ...rest
  }: TableProps<T>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const visible = narrow ? columns.filter((c) => c.priority === 'high') : columns;
  const tracks: CSSProperties = { gridTemplateColumns: visible.map(trackOf).join(' ') };
  const isScrollX = visible.some((c) => c.minWidth !== undefined);
  const content = (
    <>
      {!headless && <TableHead columns={visible} tracks={tracks} />}
      <div role="rowgroup">
        {rows.map((row) => {
          const key = rowKey(row);
          return (
            <TableRow
              key={key}
              row={row}
              columns={visible}
              tracks={tracks}
              isSelected={selectedKey === undefined ? undefined : key === selectedKey}
              onRowClick={onRowClick}
            />
          );
        })}
      </div>
    </>
  );
  return (
    <div
      {...rest}
      role="table"
      className={cx(styles.root, className)}
      data-density={density}
      data-narrow={narrow || undefined}
      data-scroll-x={isScrollX || undefined}
      ref={ref}
    >
      {isScrollX ? (
        <div className={styles.track} style={{ minWidth: minTrackWidth(visible) }}>
          {content}
        </div>
      ) : (
        content
      )}
    </div>
  );
}

/** grid 행 표(<table> 아님). 제네릭 forwardRef라 캐스트가 필요하다 */
export const Table = forwardRef(TableInner) as <T>(
  props: TableProps<T> & { ref?: ForwardedRef<HTMLDivElement> },
) => ReactNode;
