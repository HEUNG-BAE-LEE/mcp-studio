// ToolStatusChip — 도구 상태 칩(이음 TST js/common/state.js:27). 라벨 · tone은 copy/status에서 찾는다
import { statusOf, type ToolStatusValue } from '../../copy/status';
import { StatusChip, type StatusChipSize } from '../StatusChip';

export type ToolStatusChipProps = {
  /** 도구 상태 값 — 아는 값 넷 + 모르는 값(값 그대로 · mute) */
  status: ToolStatusValue | (string & {});
  /** sm = 목록 항목 안 축소(StatusChip과 같다) */
  size?: StatusChipSize;
};

export function ToolStatusChip({ status, size = 'md' }: ToolStatusChipProps) {
  const { label, tone } = statusOf('tool', status);
  return (
    <StatusChip tone={tone} size={size}>
      {label}
    </StatusChip>
  );
}
