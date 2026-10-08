// 호출 로그 상태 칩 — 표 · 상세 요약이 쓴다(옛 stt(l.status, LST) — apps/web/ieum/js/menu/logs.js:3,13,38).
// 라벨 · 색은 copy/status의 log 목록에서만 찾는다(성공 · 실패). 서버가 내지 않는 확인 대기 · 캐시 응답은 목록에 없어
// 오면 값 그대로 + 회색 칩 + 개발 콘솔 경고 한 번이다 — 옛은 모르는 값에서 예외로 렌더가 멈췄다(js/common/state.js:35)
import { StatusChip } from '@/ui';
import { statusOf } from '../../copy/status';

type LogStatusChipProps = Readonly<{ status: string }>;

export function LogStatusChip({ status }: LogStatusChipProps) {
  const { label, tone } = statusOf('log', status);
  return <StatusChip tone={tone}>{label}</StatusChip>;
}
