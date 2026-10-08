// SourceStatus — 원본 시스템 상태(이음 SST js/common/state.js:26). 라벨 · tone은 copy/status에서 찾는다
import { statusOf, type SourceStatusValue } from '../../copy/status';
import { StatusChip } from '../StatusChip';
import { StatusDot } from '../StatusDot';

/** dot = 구조도 점(StatusDot), chip = 원본 목록 칩(StatusChip) */
export type SourceStatusVariant = 'dot' | 'chip';

export type SourceStatusProps = {
  /** 원본 상태 값 — 아는 값 넷 + 모르는 값(값 그대로 · mute) */
  status: SourceStatusValue | (string & {});
  variant: SourceStatusVariant;
};

export function SourceStatus({ status, variant }: SourceStatusProps) {
  const { label, tone } = statusOf('source', status);
  if (variant === 'dot') return <StatusDot tone={tone} label={label} />;
  return <StatusChip tone={tone}>{label}</StatusChip>;
}
