// CompactTable — 테두리를 두른 작은 표(이음 .mapw · .map css/console.css:676-692,1074-1077). 머리(CompactTableHeadCell) · 행(CompactTableRow) · 칸(CompactTableCell)을 조립한다.
// 칸 글자(고정폭 필드 · 타입 줄 · 흐린 설명 · 예시 값 · 키)는 쓰는 곳이 토큰으로 준다(Table과 같다). 칸 안 입력 · 선택은 Input · Select의 cell 모양. 빈 표는 칸 하나에 평문
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './CompactTable.module.css';

/** 표 최소 폭(px) — 배포 포함된 도구 420 · 액세스 키 · 탐색 파라미터 추론 560 · 입력 · 응답 매핑 640. 간격 단계 밖의 고유 치수 */
export type CompactTableMinWidth = 420 | 560 | 640;

export type CompactTableProps = {
  /** 표 최소 폭 — 좁으면 상자 안에서 가로 스크롤 */
  minWidth: CompactTableMinWidth;
  /** 머리 칸(CompactTableHeadCell들) */
  head: ReactNode;
  /** 행(CompactTableRow들) */
  children: ReactNode;
  /** 배치(바깥 여백)만 */
  className?: string;
};

export function CompactTable({ minWidth, head, children, className }: CompactTableProps) {
  return (
    <div className={cx(styles.box, className)}>
      <table className={styles.table} data-min-width={minWidth}>
        <thead>
          <tr>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export type CompactTableHeadCellProps = {
  /** 없으면 빈 머리 — 매핑 화살표 열 */
  children?: ReactNode;
  /** 칸 폭 · 좌우 여백(화살표 칸 28)만 */
  className?: string;
};

export function CompactTableHeadCell({ children, className }: CompactTableHeadCellProps) {
  return (
    <th scope="col" className={cx(styles.headCell, className)}>
      {children}
    </th>
  );
}

export type CompactTableRowProps = {
  /** warn = 변경 행 바탕(명세 변경 — DESIGN Colors ③) */
  tone?: 'warn';
  children: ReactNode;
};

export function CompactTableRow({ tone, children }: CompactTableRowProps) {
  return (
    <tr className={styles.row} data-tone={tone}>
      {children}
    </tr>
  );
}

export type CompactTableCellProps = {
  colSpan?: number;
  /** 칸 폭 · 좌우 여백(화살표 칸 28 · 설명 최소 130)만 */
  className?: string;
  children?: ReactNode;
};

export function CompactTableCell({ colSpan, className, children }: CompactTableCellProps) {
  return (
    <td colSpan={colSpan} className={cx(styles.cell, className)}>
      {children}
    </td>
  );
}
