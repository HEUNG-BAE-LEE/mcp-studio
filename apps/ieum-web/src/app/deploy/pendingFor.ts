// 묶음 id별 요청 상태 — 배포 · 시작은 요청을 낸 컴포넌트(모달 · 알림 버튼)가 아니라 mutation 캐시에서 묶음 id로 읽는다.
// 모달을 닫았다 다시 열거나 화면을 떠났다 돌아와도 같은 묶음이 요청 중이면 "배포하는 중…" · "시작하는 중…"이 이어지고 버튼이 잠긴다
// (옛은 처음 모달 버튼만 잠가, 다시 연 모달의 "배포하기"가 살아 중복 배포가 됐다 — js/menu/deploy.js:106-107,141-154)
import { useMutationState, type MutationKey } from '@tanstack/react-query';

/** 배포 · 시작 요청 변수의 공통 — 요청을 보낸 묶음 */
export type ToolsetTarget = Readonly<{ toolsetId: string }>;

/** mutation 변수(unknown)에서 묶음 id. 모양이 다르면 undefined */
export function toolsetIdOf(variables: unknown): string | undefined {
  if (typeof variables !== 'object' || variables === null || !('toolsetId' in variables)) return undefined;
  const { toolsetId } = variables;
  return typeof toolsetId === 'string' ? toolsetId : undefined;
}

/** 그 mutationKey의 요청 중 그 묶음의 것이 있는가 */
export function useIsPendingFor(mutationKey: MutationKey, toolsetId: string): boolean {
  const pendingIds = useMutationState({
    filters: { mutationKey, status: 'pending' },
    select: (mutation) => toolsetIdOf(mutation.state.variables),
  });
  return pendingIds.includes(toolsetId);
}
