// 묶음 배포(옛 deployNow — js/menu/deploy.js:104-117). 서버는 저장된 도구만 알므로, 이 묶음 도구 중 저장하지 않은 초안이 있는 것을
// 먼저 하나씩 차례로 저장하고(app/studio/useToolMutations saveTool — 토스트 없음, 서버 필드만) POST …/deploy/를 보낸다.
// 다른 도구의 초안은 건드리지 않는다. 저장이 실패하면 거기서 멈추고 배포를 보내지 않는다 — 앞서 저장한 도구는 저장된 채 남는다(옛과 같다).
// 배포는 처음 띄울 때 수십 초가 걸릴 수 있다(서버가 프로세스가 응답할 때까지 기다린다).
//
// 요청 상태는 묶음 id별로 mutation 캐시에서 읽는다(app/deploy/pendingFor) — 확인 창을 닫았다 다시 열어도 같은 요청의 진행 · 실패가 이어진다.
// 그래서 이 훅의 인스턴스는 확인 창이 아니라 **배포 화면(DeployScreen)에 한 번** 둔다.
//
// ── 쓰는 곳 계약 ──
// useDeployToolset() — 배포 확인 창의 "배포하기" · "다시 시도". mutate({ toolsetId, dirtyIds }) — dirtyIds는 누르는 순간의
//   deployPlan(…).dirty의 id(app/deploy/toolsetView — 이 묶음 도구 중 초안이 있는 것, 묶음 순서). "다시 시도"도 그때 다시 센다
//   (앞 시도에서 저장된 도구는 초안이 없어져 빠진다).
//   성공: 그 묶음을 응답 묶음으로 → 무효화 → 그 묶음의 배포 확인 창이면 닫기 → 완료 토스트(빠진 도구가 있으면 info).
//   실패: 그 묶음의 배포 확인 창이 열려 있으면 아무것도 하지 않는다 — 창이 useDeployAttempt로 실패 상자를 그린다.
//   창이 닫혀 있으면(배포 화면 안이든 밖이든) toast.warn(서버 문장). 저장에서 멈췄으면 오류가 ToolSaveStoppedError이고 toolId가 멈춘 도구다
// deployBaseline(queryClient, toolsetId) + useDeployAttempt(toolsetId, since) — 배포 확인 창이 그릴 요청 상태.
//   창을 열 때 since = deployBaseline(…)을 한 번 잡아 둔다: 그 묶음이 배포 요청 중이면 그 요청을 보낸 시각(다시 연 창도 "배포하는 중…"을 잇고
//   그 요청의 실패를 그린다), 아니면 연 시각(지난 실패 없이 새로 시작한다 — 옛도 새 모달이었다).
//   useDeployAttempt는 since 뒤에 보낸 마지막 요청만 본다: isPending("배포하는 중…" · 진행 문구 · 확인 잠금) · hasDirty(그 요청에 먼저 저장할
//   도구가 있었는가 — 진행 문구) · error(실패 상자 원문 — "다시 시도") · stoppedToolId(저장에서 멈춘 도구 — 실패 상자 머리에 인라인 코드)
import { useMutation, useMutationState, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '../../api/client';
import { toolsetApiPath } from '../../api/hooks/useToolsets';
import type { DeployResultWire } from '../../api/types';
import { DEPLOY } from '../../copy/deploy';
import { NOT_FOUND } from '../../copy/errors';
import { saveBodyOf } from '../studio/saveBody';
import { saveTool } from '../studio/useToolMutations';
import { closeModalIf, isModalShowing } from '../layers';
import { toast } from '../toast';
import { toolsetIdOf } from './pendingFor';
import { invalidateToolsets, replaceToolset } from './toolsetCache';
import { endpointOf } from './toolsetView';

/** 배포 요청의 mutation 키 — 묶음 id별 요청 상태를 이 키로 찾는다 */
export const DEPLOY_MUTATION_KEY = ['deploy', 'toolsets', 'deploy'] as const;

const deployPath = (toolsetId: string) => `${toolsetApiPath(toolsetId)}deploy/`;

export type DeployToolsetVars = Readonly<{
  toolsetId: string;
  /** 먼저 저장할 도구 id — 이 묶음 도구 중 초안이 있는 것(묶음 순서) */
  dirtyIds: readonly string[];
}>;

/**
 * 배포 전 저장이 멈춘 도구. message는 그 저장 실패의 서버 문장 그대로라 다른 실패와 같이 원문을 그리면 된다.
 * tsconfig erasableSyntaxOnly라 생성자 매개변수 속성 대신 필드를 직접 적는다
 */
export class ToolSaveStoppedError extends Error {
  /** 저장에서 멈춘 도구 id */
  readonly toolId: string;

  constructor(toolId: string, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = 'ToolSaveStoppedError';
    this.toolId = toolId;
  }
}

/** 초안이 있는 도구를 묶음 순서대로 하나씩 저장한다. 첫 실패에서 멈추고 그 도구 id를 실어 던진다 */
async function saveDraftsInOrder(queryClient: QueryClient, toolIds: readonly string[]): Promise<void> {
  for (const toolId of toolIds) {
    const body = saveBodyOf(toolId);
    // 도구 · 원본 캐시에 그 도구가 없으면 보낼 본문을 만들 수 없다 — 저장 실패처럼 거기서 멈추고 배포를 보내지 않는다
    // (실패 상자 머리는 그 도구 id, 원문은 "찾을 수 없습니다."). 배포 화면은 도구를 보고 있어 닿기 어렵다
    if (body === undefined) throw new ToolSaveStoppedError(toolId, new Error(NOT_FOUND));
    try {
      await saveTool(queryClient, toolId, body);
    } catch (error) {
      throw new ToolSaveStoppedError(toolId, error);
    }
  }
}

export function useDeployToolset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: DEPLOY_MUTATION_KEY,
    mutationFn: async ({ toolsetId, dirtyIds }: DeployToolsetVars) => {
      await saveDraftsInOrder(queryClient, dirtyIds);
      return api.post<DeployResultWire>(deployPath(toolsetId));
    },
    onSuccess: ({ toolset, skipped }, { toolsetId }) => {
      replaceToolset(queryClient, toolset);
      invalidateToolsets(queryClient);
      closeModalIf({ kind: 'deployConfirm', toolsetId });
      const message = DEPLOY.deployModal.done(toolset.name, toolset.ver, endpointOf(toolset), skipped.length);
      if (skipped.length > 0) toast.info(message);
      else toast(message);
    },
    onError: (error, { toolsetId }) => {
      if (isModalShowing({ kind: 'deployConfirm', toolsetId })) return;
      toast.warn(error.message);
    },
  });
}

/** 배포 확인 창을 열 때 잡는 기준 시각 — 그 묶음의 배포가 요청 중이면 그 요청을 보낸 시각, 아니면 지금 */
export function deployBaseline(queryClient: QueryClient, toolsetId: string): number {
  const [pending] = queryClient.getMutationCache().findAll({
    mutationKey: DEPLOY_MUTATION_KEY,
    status: 'pending',
    predicate: (mutation) => toolsetIdOf(mutation.state.variables) === toolsetId,
  });
  return pending === undefined ? Date.now() : pending.state.submittedAt;
}

export type DeployAttempt = Readonly<{
  isPending: boolean;
  /** 그 요청에 먼저 저장할 도구가 있었는가 — 진행 문구(copy/deploy deployModal.progress) */
  hasDirty: boolean;
  /** 실패했으면 그 오류(원문은 message) */
  error: Error | null;
  /** 배포 전 저장에서 멈췄으면 그 도구 id */
  stoppedToolId: string | null;
}>;

const NO_ATTEMPT: DeployAttempt = Object.freeze({ isPending: false, hasDirty: false, error: null, stoppedToolId: null });

const dirtyCountOf = (variables: unknown): number => {
  if (typeof variables !== 'object' || variables === null || !('dirtyIds' in variables)) return 0;
  const { dirtyIds } = variables;
  return Array.isArray(dirtyIds) ? dirtyIds.length : 0;
};

/**
 * 기준 시각(since — deployBaseline) 뒤에 그 묶음으로 보낸 마지막 배포 요청의 상태. 없거나 성공했으면 아무 상태도 아니다.
 * 거르기는 그릴 때 한다 — useMutationState는 mutation 캐시가 바뀔 때만 다시 고르므로 필터에 인자를 넣으면 인자가 바뀌어도 앞 결과가 남는다
 */
export function useDeployAttempt(toolsetId: string, since: number): DeployAttempt {
  const attempts = useMutationState({
    filters: { mutationKey: DEPLOY_MUTATION_KEY },
    select: (mutation) => ({
      toolsetId: toolsetIdOf(mutation.state.variables),
      submittedAt: mutation.state.submittedAt,
      status: mutation.state.status,
      error: mutation.state.error,
      hasDirty: dirtyCountOf(mutation.state.variables) > 0,
    }),
  });
  const latest = attempts.findLast((a) => a.toolsetId === toolsetId && a.submittedAt >= since);
  const isPending = latest?.status === 'pending';
  const error = latest?.status === 'error' ? latest.error : null;
  const hasDirty = (isPending || error !== null) && latest !== undefined && latest.hasDirty;
  // 같은 상태면 같은 객체 — 캐시가 바뀔 때마다 새 객체를 돌려주지 않는다
  return useMemo((): DeployAttempt => {
    if (!isPending && error === null) return NO_ATTEMPT;
    const stoppedToolId = error instanceof ToolSaveStoppedError ? error.toolId : null;
    return { isPending, hasDirty, error, stoppedToolId };
  }, [isPending, hasDirty, error]);
}
