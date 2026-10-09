// ResultTable — 결과 검토 표 7열(최소 1040 · 내용 높이 행 — 옛 discRows · .dtbl, js/menu/discovery.js:273-287,315)
// 열: 선택 · API(메서드 + 경로 / 제목 + 도구 이름) · 근거(소스 · 트래픽 표지 — 없는 쪽은 점선 취소선) · 호출된 화면 · 검증 · 방식 · 추천(+ 이유)
// - 줄은 필터에 맞는 것을 추천 순으로(같은 추천 안은 서버 순서 — app/discovery/results). 맞는 것이 없으면 표 안 한 행 "이 조건에 맞는 API가 없습니다."
// - 행 전체(클릭 · Enter · Space)는 근거 드로어를 연다. 선택 칸은 행 동작으로 올라가지 않는다(TableCell check)
// - 선택 상자는 도구 이름이 있고 아직 등록 전인 작업에서만 켜고 끌 수 있다 — 도구 이름이 없으면 "AI 도구로 만들 수 없는 API입니다"(마우스 툴팁 · 읽기 보강).
//   바꿔도 표를 다시 그리지 않아 포커스가 상자에 남는다(옛 :417-418). 고른 행은 선택 바탕
import type { DiscoveryApi, JobStatus } from '../../api/types';
import { canSelectApi } from '../../app/discovery/evidence';
import { RecommendChip, VerifyChip } from '../../app/discovery/DiscoveryChips';
import { DISCOVERY } from '../../copy/discovery';
import { modeKindOf, modeLabel } from '../../copy/mode';
import {
  Checkbox,
  EmptyState,
  EvidenceBadge,
  MethodChip,
  ModeTag,
  Table,
  TableCell,
  TableHeadCell,
  TableRow,
} from '@/ui';
import type { Selection } from './useSelection';
import styles from './ResultTable.module.css';

const K = DISCOVERY.result;
const COLUMN_COUNT = 7;

const HEAD = (
  <>
    <TableHeadCell kind="check" />
    <TableHeadCell align="start">{K.columns.api}</TableHeadCell>
    <TableHeadCell>{K.columns.evidence}</TableHeadCell>
    <TableHeadCell align="start">{K.columns.screen}</TableHeadCell>
    <TableHeadCell>{K.columns.verify}</TableHeadCell>
    <TableHeadCell>{K.columns.mode}</TableHeadCell>
    <TableHeadCell align="start">{K.columns.recommend}</TableHeadCell>
  </>
);

type RowProps = Readonly<{
  api: DiscoveryApi;
  status: JobStatus;
  selection: Selection;
  onOpen: (api: DiscoveryApi) => void;
}>;

function ResultRow({ api, status, selection, onOpen }: RowProps) {
  const isSelected = selection.ids.has(api.id);
  const hasSource = api.ev === 'src' || api.ev === 'both';
  const hasTraffic = api.ev === 'tr' || api.ev === 'both';
  return (
    <TableRow onActivate={() => onOpen(api)} selected={isSelected}>
      <TableCell kind="check">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(on) => selection.set(api.id, on)}
          disabled={!canSelectApi(api, status)}
          disabledReason={api.tool ? undefined : K.cannotTool}
          aria-label={K.selectAria(api.title)}
        />
      </TableCell>
      <TableCell align="start">
        <div className={styles.api}>
          <MethodChip method={api.m} />
          <span className={styles.path}>{api.path}</span>
        </div>
        <div className={styles.apiSub}>
          {api.title}
          {api.tool ? (
            <>
              {' '}
              <span className={styles.tool}>{api.tool}</span>
            </>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <EvidenceBadge kind="code" on={hasSource}>
          {K.badge.src}
        </EvidenceBadge>
        <EvidenceBadge kind="traffic" on={hasTraffic}>
          {K.badge.tr}
        </EvidenceBadge>
      </TableCell>
      <TableCell align="start">
        <div className={styles.screen}>
          {api.tr ? api.tr.screen : <span className={styles.faint}>{K.noScreen}</span>}
        </div>
      </TableCell>
      <TableCell>
        <VerifyChip verify={api.verify} />
      </TableCell>
      <TableCell>
        <ModeTag kind={modeKindOf(api.mode)} label={modeLabel(api.mode)} />
      </TableCell>
      <TableCell align="start">
        <div className={styles.recommend}>
          <RecommendChip rec={api.rec} />
          {api.recNote ? <div className={styles.recNote}>{api.recNote}</div> : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

export type ResultTableProps = Readonly<{
  rows: readonly DiscoveryApi[];
  status: JobStatus;
  selection: Selection;
  onOpen: (api: DiscoveryApi) => void;
}>;

export function ResultTable({ rows, status, selection, onOpen }: ResultTableProps) {
  return (
    <Table minWidth={1040} density="auto" head={HEAD} className={styles.table}>
      {rows.length === 0 ? (
        <EmptyState kind="filtered" container="table" colSpan={COLUMN_COUNT}>
          {K.emptyFiltered}
        </EmptyState>
      ) : (
        rows.map((api) => <ResultRow key={api.id} api={api} status={status} selection={selection} onOpen={onOpen} />)
      )}
    </Table>
  );
}
