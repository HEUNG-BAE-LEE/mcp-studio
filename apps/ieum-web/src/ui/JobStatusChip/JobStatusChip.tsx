// JobStatusChip — 탐색 작업 상태 칩(이음 JOB_ST js/menu/discovery.js:5). 라벨 · tone은 copy/status에서 찾는다
import { statusOf, type JobStatusValue } from '../../copy/status';
import { StatusChip, type StatusChipSize } from '../StatusChip';

export type JobStatusChipProps = {
  /** 작업 상태 값 — 아는 값 일곱 + 모르는 값(값 그대로 · mute). 서버가 내지 않는 queued는 모르는 값이다 */
  status: JobStatusValue | (string & {});
  /** sm = 목록 항목 안 축소(StatusChip과 같다) */
  size?: StatusChipSize;
};

export function JobStatusChip({ status, size = 'md' }: JobStatusChipProps) {
  const { label, tone } = statusOf('job', status);
  return (
    <StatusChip tone={tone} size={size}>
      {label}
    </StatusChip>
  );
}
