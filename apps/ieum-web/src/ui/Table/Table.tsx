// Table — 목록 표(이음 .twrap · .utbl css/console.css:196-212,599-606). 머리(TableHeadCell) · 행(TableRow) · 칸(TableCell)을 조립한다.
// 칸 글자(고정폭 id · 흐린 시각 · 굵은 수치)는 쓰는 곳이 토큰으로 준다. 빈 목록은 본문에 EmptyState container="table" 한 행
// kind="check"는 선택 상자 칸(.ck css/console.css:207) — 칸 안 누름은 행 onActivate로 가지 않는다(js/main.js:49)
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './Table.module.css';

/** 표 최소 폭(px) — 탐색 작업 820 · 호출 로그 960 · 원본 980 · 탐색 결과 1040. 간격 단계 밖의 고유 치수 */
export type TableMinWidth = 820 | 960 | 980 | 1040;
/** fixed = 행 --h-row, auto = 내용 높이 + 위아래 여백 */
export type TableDensity = 'fixed' | 'auto';
type Align = 'center' | 'start';
/** check = 선택 상자 칸 — 폭 48 · 가운데. 정렬을 따로 받지 않는다 */
export type TableCellKind = 'check';

// 정렬(align)과 종류(kind)는 함께 받지 않는다 — check 칸은 늘 가운데
type CellShape =
  | {
      kind?: undefined;
      /** 기본 center */
      align?: Align;
    }
  | {
      kind: TableCellKind;
      align?: never;
    };

const CHECK_CELL_SELECTOR = "td[data-kind='check']";

export type TableProps = {
  minWidth: TableMinWidth;
  /** 기본 fixed */
  density?: TableDensity;
  /** 머리 칸(TableHeadCell들) */
  head: ReactNode;
  /** 본문 행(TableRow들) 또는 빈 행 하나 */
  children: ReactNode;
  /** 배치(바깥 여백)만 */
  className?: string;
};

export function Table({ minWidth, density = 'fixed', head, children, className }: TableProps) {
  return (
    <div className={cx(styles.wrap, className)}>
      <table className={styles.table} data-min-width={minWidth} data-density={density}>
        <thead>
          <tr>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export type TableHeadCellProps = CellShape & {
  children?: ReactNode;
};

export function TableHeadCell({ kind, align = 'center', children }: TableHeadCellProps) {
  return (
    <th scope="col" className={styles.headCell} data-align={align} data-kind={kind}>
      {children}
    </th>
  );
}

export type TableRowProps = {
  /** 있으면 누를 수 있는 행 — 포인터 · 포커스(tabindex 0) · Enter · Space */
  onActivate?: () => void;
  selected?: boolean;
  children: ReactNode;
};

// 키는 행 자신에서 눌렀을 때만 받는다 — 칸 안 버튼 · 링크에서 올라온 키는 그 요소 몫이다
const isActivateKey = (key: string) => key === 'Enter' || key === ' ';

export function TableRow({ onActivate, selected = false, children }: TableRowProps) {
  // 체크 칸 안 누름(칸 여백 포함)은 행 동작으로 가지 않는다 — 옛 data-act="noop"(js/main.js:49)
  const onClick = (event: MouseEvent<HTMLTableRowElement>) => {
    const cell = event.target instanceof Element ? event.target.closest(CHECK_CELL_SELECTOR) : null;
    if (cell && event.currentTarget.contains(cell)) return;
    onActivate?.();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (!onActivate || event.target !== event.currentTarget || !isActivateKey(event.key)) return;
    event.preventDefault();
    onActivate();
  };
  return (
    <tr
      className={styles.row}
      data-interactive={onActivate ? '' : undefined}
      data-state={selected ? 'selected' : undefined}
      tabIndex={onActivate ? 0 : undefined}
      onClick={onActivate ? onClick : undefined}
      onKeyDown={onActivate ? onKeyDown : undefined}
    >
      {children}
    </tr>
  );
}

export type TableCellProps = CellShape & {
  children?: ReactNode;
};

export function TableCell({ kind, align = 'center', children }: TableCellProps) {
  return (
    <td className={styles.cell} data-align={align} data-kind={kind}>
      {children}
    </td>
  );
}
