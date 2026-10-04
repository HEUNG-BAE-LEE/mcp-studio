// apps/web/src/screens/project/rows.ts — 소스 · 커넥터 행 뷰모델(RowCard props + 검색 건초) · 검색 건초(필터는 ui useSearchFilter — 소문자 substring)
import type { RowCardType, StatusTier } from '@/ui';
import type { Connector, Source } from '../../api/types';
import { connectorSummary, sourceSummary, toolCountLabel } from '../../copy/output';
import { PROJECT } from '../../copy/project';
import { connectorStatusOf, sourceStatusOf, sourceTypeLabel } from '../../copy/status';

export type Row = Readonly<{
  id: string;
  title: string;
  type: RowCardType;
  statusLabel: string;
  tier: StatusTier;
  summary: string;
  action: string;
  /** 검색 대상 문자열(소스 `이름 타입`, 커넥터 `이름 요약`) */
  haystack: string;
}>;

export function sourceRow(source: Source): Row {
  const typeLabel = sourceTypeLabel(source.type);
  const status = sourceStatusOf(source.status);
  return {
    id: source.id,
    title: source.name,
    type: { label: typeLabel },
    statusLabel: status.label,
    tier: status.tier,
    summary: sourceSummary(source),
    action: PROJECT.sources.rowAction,
    haystack: `${source.name} ${typeLabel}`,
  };
}
export function connectorRow(connector: Connector): Row {
  const status = connectorStatusOf(connector.status);
  const summary = connectorSummary(connector);
  return {
    id: connector.id,
    title: connector.name,
    type: { label: toolCountLabel(connector.toolCount) },
    statusLabel: status.label,
    tier: status.tier,
    summary,
    action:
      connector.status === 'unpublished' ? PROJECT.connectors.publish : PROJECT.connectors.open,
    haystack: `${connector.name} ${summary}`,
  };
}
