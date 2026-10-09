// 묶음 배포 상태 칩 — 묶음 목록 항목 · 상세 머리(옛 tsChip — js/menu/deploy.js:9-13)
// 값은 초안이면 draft, 아니면 서버 상태(runtime.state — app/deploy/toolsetView chipValueOf), 라벨 · 색은 copy/status toolset.
// 글자는 초안이면 라벨만, 그 밖은 라벨 + 공백 + 버전(copy/deploy chip). 모르는 상태 값은 값 그대로 + 회색(옛은 "중지됨"으로 떨어졌다 — 이식 기간 고침).
// 목록 · 상세 모두 md(옛 .ts-item에는 칩 축소 규칙이 없다)
import type { Toolset } from '../../api/types';
import { chipValueOf, isDeployed } from '../../app/deploy/toolsetView';
import { DEPLOY } from '../../copy/deploy';
import { statusOf } from '../../copy/status';
import { StatusChip } from '@/ui';

export function DeployStateChip({ toolset }: Readonly<{ toolset: Toolset }>) {
  const { label, tone } = statusOf('toolset', chipValueOf(toolset));
  return <StatusChip tone={tone}>{isDeployed(toolset) ? DEPLOY.chip(label, toolset.ver) : label}</StatusChip>;
}
