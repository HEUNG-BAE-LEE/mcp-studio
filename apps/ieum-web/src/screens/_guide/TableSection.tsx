// 카탈로그 Table 절 — 정렬(center · start) · 밀도(fixed · auto) · 행 상태(기본 · hover · selected · 누를 수 있는 행) · 체크 칸(kind="check") · 빈 행 · 최소 폭 넷
import { useState } from 'react';
import { fmtNum } from '../../copy/format';
import { Checkbox, EmptyState, Table, TableCell, TableHeadCell, TableRow, type TableMinWidth } from '../../ui';
import catalog from './catalog.module.css';
import styles from './TableSection.module.css';

const MIN_WIDTHS: readonly TableMinWidth[] = [820, 960, 980, 1040];

const ROWS = [
  { id: 'orders.search', name: '주문 검색', calls: 1284, time: '2026-10-08 14:32' },
  { id: 'orders.create', name: '주문 생성', calls: 312, time: '2026-10-08 14:30' },
  { id: 'items.list', name: '품목 목록', calls: 87, time: '2026-10-08 13:58' },
] as const;

const HEAD = (
  <>
    <TableHeadCell align="start">도구</TableHeadCell>
    <TableHeadCell>이름</TableHeadCell>
    <TableHeadCell>호출 수</TableHeadCell>
    <TableHeadCell>최근 호출</TableHeadCell>
  </>
);

const CHECK_HEAD = (
  <>
    <TableHeadCell kind="check" />
    <TableHeadCell align="start">도구</TableHeadCell>
    <TableHeadCell>이름</TableHeadCell>
    <TableHeadCell>최근 호출</TableHeadCell>
  </>
);

// 마지막 행은 선택할 수 없다(AI 도구로 만들 수 없는 API — 비활성 상자)
const LOCKED_ID: string = ROWS[2].id;

export function TableSection() {
  const [selectedId, setSelectedId] = useState<string>(ROWS[1].id);
  const [activated, setActivated] = useState<string>('');
  const [checked, setChecked] = useState<readonly string[]>([ROWS[0].id]);
  const [opened, setOpened] = useState<string>('');
  const toggleChecked = (id: string) =>
    setChecked((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        칸 글자(고정폭 · 흐린 시각 · 굵은 수치)는 쓰는 곳이 준다 — 여기서는 카탈로그 전용 클래스로 흉내 낸다. 좁으면 표 상자 안에서
        가로 스크롤한다.
      </p>

      <h3 className={catalog.heading}>fixed · 정렬 start / center · 일반 행</h3>
      <Table minWidth={820} head={HEAD}>
        {ROWS.map((row) => (
          <TableRow key={row.id}>
            <TableCell align="start">
              <span className={styles.mono}>{row.id}</span>
            </TableCell>
            <TableCell>{row.name}</TableCell>
            <TableCell>
              <b className={styles.num}>{fmtNum(row.calls)}</b>
            </TableCell>
            <TableCell>
              <span className={styles.date}>{row.time}</span>
            </TableCell>
          </TableRow>
        ))}
      </Table>

      <h3 className={catalog.heading}>누를 수 있는 행 · selected (Tab · Enter · Space — 누른 행: {activated || '없음'})</h3>
      <Table minWidth={960} head={HEAD}>
        {ROWS.map((row) => (
          <TableRow
            key={row.id}
            selected={row.id === selectedId}
            onActivate={() => {
              setSelectedId(row.id);
              setActivated(row.id);
            }}
          >
            <TableCell align="start">
              <span className={styles.mono}>{row.id}</span>
            </TableCell>
            <TableCell>{row.name}</TableCell>
            <TableCell>
              <b className={styles.num}>{fmtNum(row.calls)}</b>
            </TableCell>
            <TableCell>
              <span className={styles.date}>{row.time}</span>
            </TableCell>
          </TableRow>
        ))}
      </Table>

      <h3 className={catalog.heading}>체크 칸(kind=&quot;check&quot;) · selected · 비활성 상자 (행을 누른 곳: {opened || '없음'})</h3>
      <p className={catalog.note}>
        폭 48 · 가운데. 칸 안(여백 포함)을 눌러도 행 onActivate로 가지 않는다 — 행의 다른 칸을 누르면 그 행이 열린다. 머리 칸은 비어
        있다. 칸 안 상자는 Checkbox(md)다.
      </p>
      <Table minWidth={1040} head={CHECK_HEAD}>
        {ROWS.map((row) => (
          <TableRow key={row.id} selected={checked.includes(row.id)} onActivate={() => setOpened(row.id)}>
            <TableCell kind="check">
              <Checkbox
                aria-label={`${row.name} 선택`}
                checked={checked.includes(row.id)}
                disabled={row.id === LOCKED_ID}
                disabledReason={row.id === LOCKED_ID ? 'AI 도구로 만들 수 없는 API입니다' : undefined}
                onCheckedChange={() => toggleChecked(row.id)}
              />
            </TableCell>
            <TableCell align="start">
              <span className={styles.mono}>{row.id}</span>
            </TableCell>
            <TableCell>{row.name}</TableCell>
            <TableCell>
              <span className={styles.date}>{row.time}</span>
            </TableCell>
          </TableRow>
        ))}
      </Table>

      <h3 className={catalog.heading}>auto 밀도 · 두 줄 칸</h3>
      <Table minWidth={1040} density="auto" head={HEAD}>
        {ROWS.map((row) => (
          <TableRow key={row.id}>
            <TableCell align="start">
              <span className={styles.mono}>{row.id}</span>
            </TableCell>
            <TableCell align="start">
              <b className={styles.strong}>{row.name}</b>
              <span className={styles.sub}>호출 {fmtNum(row.calls)}건</span>
            </TableCell>
            <TableCell>{fmtNum(row.calls)}</TableCell>
            <TableCell>
              <span className={styles.date}>{row.time}</span>
            </TableCell>
          </TableRow>
        ))}
      </Table>

      <h3 className={catalog.heading}>빈 행 · first / filtered</h3>
      <Table minWidth={980} head={HEAD}>
        <EmptyState kind="first" container="table" colSpan={4}>
          호출 기록이 없습니다.
        </EmptyState>
      </Table>
      <Table minWidth={820} head={HEAD}>
        <EmptyState kind="filtered" container="table" colSpan={4}>
          조건에 맞는 호출 기록이 없습니다.
        </EmptyState>
      </Table>

      <h3 className={catalog.heading}>최소 폭 {MIN_WIDTHS.join(' · ')}</h3>
      <div className={catalog.stack}>
        {MIN_WIDTHS.map((minWidth) => (
          <Table key={minWidth} minWidth={minWidth} head={<TableHeadCell>{minWidth}</TableHeadCell>}>
            <TableRow>
              <TableCell>최소 폭 {minWidth}px</TableCell>
            </TableRow>
          </Table>
        ))}
      </div>
    </div>
  );
}
