// 탐색 결과의 상태 칩 둘 — 검증 칩 · 추천 칩. 결과 표(screens/discovery)와 근거 드로어(app/discovery/EvidenceDrawer)가 같이 쓴다
// 모양은 StatusChip(점 + 글자)이다. 검증 칩의 글자 · 색은 verifyLabel(서버 코드 · ms가 들어간 틀, 모르는 종류는 "미검증" — 옛 dVerify
// js/menu/discovery.js:169-173), 추천 칩은 copy/status 추천 목록(모르는 값은 값 그대로 · mute — 옛은 렌더가 멈췄다, :174 · 이식 기간 고침)
import type { RecommendKind, Verify } from '../../api/types';
import { statusOf } from '../../copy/status';
import { StatusChip } from '@/ui';
import { verifyLabel } from './verifyLabel';

export function VerifyChip({ verify }: Readonly<{ verify: Verify | undefined }>) {
  const { label, tone } = verifyLabel(verify);
  return <StatusChip tone={tone}>{label}</StatusChip>;
}

export function RecommendChip({ rec }: Readonly<{ rec: RecommendKind }>) {
  const { label, tone } = statusOf('recommend', rec);
  return <StatusChip tone={tone}>{label}</StatusChip>;
}
