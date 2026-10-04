// apps/web/src/screens/project/SourceColumn.tsx — 연결된 소스 열(Region + SectionHead + RegionList): 검색 · 추가(흐름 열기 — 소스 0이면 빈 상태 액션만) · 권한 사유 줄 · RowCard 목록 · 빈 상태(소스 0 / 검색 0건). 행 · 설정은 설정 모달을 연다
import { useId, useMemo, type Ref } from 'react';
import {
  Button,
  EmptyState,
  Region,
  RegionList,
  RowCard,
  SectionHead,
  SectionSearch,
  StatusChip,
  useSearchFilter,
} from '@/ui';
import type { Source } from '../../api/types';
import { usePermission } from '../../app/user/usePermission';
import { countLabel } from '../../copy/list';
import { PROJECT } from '../../copy/project';
import { sourceRow, type Row } from './rows';

const haystackOf = (row: Row) => row.haystack;

type Props = {
  sources: readonly Source[];
  narrow: boolean;
  onAdd: () => void;
  /** 행 · `설정` — 설정 모달(기본 탭은 부모가 상태로 정한다) */
  onOpen: (sourceId: string) => void;
  /** 추가 버튼(머리 · 소스가 없으면 빈 상태) — 설정 모달을 연 행이 사라지면(연결 해제) 포커스가 돌아올 곳 */
  addRef?: Ref<HTMLButtonElement>;
};

export function SourceColumn({ sources, narrow, onAdd, onOpen, addRef }: Props) {
  const rows = useMemo(() => sources.map(sourceRow), [sources]);
  const filter = useSearchFilter(rows, haystackOf);
  const connect = usePermission('source:connect');
  const isZero = sources.length === 0;
  const C = PROJECT.sources;
  // 권한이 없을 때만 사유 — 머리 아래 보이는 한 줄(SectionHead reason) + aria-describedby. title은 hover 보조
  const reasonId = useId();
  const titleId = useId();
  const reason = connect.reason ?? undefined;
  const describedBy = reason ? reasonId : undefined;
  return (
    <Region data-narrow={narrow || undefined} aria-labelledby={titleId}>
      <SectionHead
        divider
        title={C.title}
        titleId={titleId}
        count={countLabel(filter.shown.length, filter.total)}
        reason={reason}
        reasonId={reasonId}
        tools={
          // 소스가 없으면 빈 상태가 만들기 액션을 갖는다 — 머리에 같은 버튼을 두지 않는다(영역당 주 액션 하나)
          isZero ? undefined : (
            <>
              <SectionSearch
                placeholder={C.search}
                narrow={narrow}
                value={filter.query}
                onValueChange={filter.setQuery}
              />
              <Button
                variant="primary"
                size="sm-plus"
                textStyle="label"
                disabled={!connect.allowed}
                title={reason}
                aria-describedby={describedBy}
                onClick={onAdd}
                ref={addRef}
              >
                {C.add}
              </Button>
            </>
          )
        }
      />
      <RegionList
        empty={
          isZero ? (
            <EmptyState
              kind="not-created"
              title={C.empty.title}
              body={C.empty.body}
              action={
                <Button
                  variant="primary"
                  disabled={!connect.allowed}
                  title={reason}
                  aria-describedby={describedBy}
                  onClick={onAdd}
                  ref={addRef}
                >
                  {C.empty.action}
                </Button>
              }
              hint={C.empty.hint}
            />
          ) : filter.isNoMatch ? (
            <EmptyState kind="filtered" body={C.noMatch(sources.length)} onClear={filter.clear} />
          ) : null
        }
      >
        {filter.shown.map((row) => (
          <RowCard
            key={row.id}
            title={row.title}
            type={row.type}
            status={
              <StatusChip tier={row.tier} surface="soft">
                {row.statusLabel}
              </StatusChip>
            }
            summary={row.summary}
            action={
              <Button size="sm" textStyle="label" onClick={() => onOpen(row.id)}>
                {row.action}
              </Button>
            }
            onClick={() => onOpen(row.id)}
          />
        ))}
      </RegionList>
    </Region>
  );
}
