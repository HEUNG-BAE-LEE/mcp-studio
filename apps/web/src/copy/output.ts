// apps/web/src/copy/output.ts — 산출물 한 줄 · 커넥터 요약(프로젝트 상세 행 둘째 줄). 서버는 kind · count · reasonCode · 수만 준다
import type { Connector, Source } from '../api/types';
import { formatCount, formatPercentInt } from './format';
import { phaseLabel } from './status';
import { warnOnce } from './warnOnce';

type OutputKind = Source['output']['kind'];
export const OUTPUT_KIND: Readonly<Record<OutputKind, string>> = {
  tools: '도구',
  object_types: '객체 타입',
  knowledge: '청크',
};
const OUTPUT_NONE = '산출물 없음';
const PENDING_APPROVALS = '승인 대기';
const UNPUBLISHED = '발행 전';
const SEP = ' · ';

const REASON: Readonly<Record<string, (source: Source) => string>> = {
  SCOPE_EMPTY: () => '읽을 범위에 맞는 표가 없다',
  SOURCE_EMPTY: () => '원본이 비어 있다',
  PIPELINE_UNSAVED: () => '파이프라인 저장 전',
  AUTH_REJECTED: (source) => {
    const status = source.lastError?.httpStatus;
    return status === undefined ? '인증 거절' : `인증 거절 ${status}`;
  },
};

function reasonOf(source: Source): string | null {
  const code = source.output.reasonCode;
  if (code === undefined) return null;
  const known = REASON[code];
  if (known) return known(source);
  warnOnce(`reason:${code}`, `[copy] 모르는 산출물 사유 코드 ${code}`);
  return `알 수 없는 사유${SEP}${code}`;
}

/** `객체 타입 12 · 승인 대기 2` · `청크 1,204 · 임베딩 62%` · `산출물 없음 · 인증 거절 401` */
export function sourceSummary(source: Source): string {
  const { output } = source;
  if (output.count === 0) {
    const reason = reasonOf(source);
    return reason === null ? OUTPUT_NONE : `${OUTPUT_NONE}${SEP}${reason}`;
  }
  const parts = [`${OUTPUT_KIND[output.kind]} ${formatCount(output.count)}`];
  if (source.progress) {
    parts.push(`${phaseLabel(source.progress.phase)} ${formatPercentInt(source.progress.percent)}`);
  }
  if (source.pendingApprovals) parts.push(`${PENDING_APPROVALS} ${source.pendingApprovals}`);
  return parts.join(SEP);
}

/** `계약 원장 DB · 7일 1,284 호출` / `계약 원장 DB · 발행 전` */
export const connectorSummary = (connector: Connector) =>
  `${connector.sourceName}${SEP}${
    connector.status === 'unpublished' ? UNPUBLISHED : `7일 ${formatCount(connector.calls7d)} 호출`
  }`;
export const toolCountLabel = (count: number) => `도구 ${count}`;
