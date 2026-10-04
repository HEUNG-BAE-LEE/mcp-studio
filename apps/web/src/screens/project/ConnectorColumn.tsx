// apps/web/src/screens/project/ConnectorColumn.tsx — 생성 커넥터 열: 검색 · + 커넥터 만들기(커넥터 구성 — 샘플 IA의 준비 중 자리 — 로 가는 입구 · 빈 상태가 액션을 가지면 머리에 두지 않는다) · 잠김 · 권한 사유 · RowCard 목록 · 빈 상태(가이드 / 소스 있음 / 검색 0건). 행 · 열기 · 발행 → 연결 정보
import { useId, useMemo } from 'react';
import { useNavigate } from 'react-router';
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
import type { Connector } from '../../api/types';
import { connectorPath } from '../../app/nav';
import { usePermission } from '../../app/user/usePermission';
import { countLabel } from '../../copy/list';
import { PROJECT } from '../../copy/project';
import { connectorRow, type Row } from './rows';

const haystackOf = (row: Row) => row.haystack;

/** 커넥터 구성(샘플 IA의 준비 중 자리)으로 가는 입구의 "새로 만들기" id — 입구 패턴의 예 */
const NEW_CONNECTOR_ID = 'new';

type Props = {
  projectId: string;
  connectors: readonly Connector[];
  hasSources: boolean;
  narrow: boolean;
  onSelect: (connectorId: string) => void;
};

export function ConnectorColumn({ projectId, connectors, hasSources, narrow, onSelect }: Props) {
  const navigate = useNavigate();
  const rows = useMemo(() => connectors.map(connectorRow), [connectors]);
  const filter = useSearchFilter(rows, haystackOf);
  const publish = usePermission('connector:publish');
  const C = PROJECT.connectors;
  const isZero = connectors.length === 0;
  // 소스가 없으면 잠긴다 — 사유는 빈 상태(가이드) 문장이 말하고 aria-describedby로 잇는다.
  // 권한이 없으면 머리 아래 보이는 한 줄(SectionHead reason) + aria-describedby. title은 hover 보조
  const canCreate = hasSources && publish.allowed;
  const reasonId = useId();
  const titleId = useId();
  const guideId = useId();
  const reason = publish.reason ?? undefined;
  const describedBy = reason ? reasonId : !hasSources ? guideId : undefined;
  // 소스는 있는데 커넥터가 없으면 빈 상태가 만들기 액션을 갖는다 — 머리에 같은 버튼을 두지 않는다
  const isHeadAdd = !(isZero && hasSources);
  const create = () => void navigate(connectorPath(projectId, NEW_CONNECTOR_ID));
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
          isHeadAdd ? (
            <>
              {!isZero ? (
                <SectionSearch
                  placeholder={C.search}
                  narrow={narrow}
                  value={filter.query}
                  onValueChange={filter.setQuery}
                />
              ) : null}
              <Button
                variant="primary"
                size="sm-plus"
                textStyle="label"
                disabled={!canCreate}
                title={reason}
                aria-describedby={describedBy}
                onClick={create}
              >
                {C.add}
              </Button>
            </>
          ) : undefined
        }
      />
      <RegionList
        empty={
          isZero && !hasSources ? (
            <EmptyState
              id={guideId}
              kind="not-created"
              title={C.emptyGuide.title}
              body={C.emptyGuide.body}
              hint={C.emptyGuide.hint}
            />
          ) : isZero ? (
            <EmptyState
              kind="not-created"
              title={C.emptyReady.title}
              body={C.emptyReady.body}
              action={
                <Button
                  variant="primary"
                  disabled={!canCreate}
                  title={reason}
                  aria-describedby={describedBy}
                  onClick={create}
                >
                  {C.emptyReady.action}
                </Button>
              }
              hint={C.emptyReady.hint}
            />
          ) : filter.isNoMatch ? (
            <EmptyState
              kind="filtered"
              body={C.noMatch(connectors.length)}
              onClear={filter.clear}
            />
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
              <Button size="sm" textStyle="label" onClick={() => onSelect(row.id)}>
                {row.action}
              </Button>
            }
            onClick={() => onSelect(row.id)}
          />
        ))}
      </RegionList>
    </Region>
  );
}
