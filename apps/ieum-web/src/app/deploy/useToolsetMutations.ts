// 도구 묶음 쓰기 다섯 — 만들기 · 고치기 · 삭제 · 서버 시작 · 서버 중지(옛 js/menu/deploy.js:156-164,198-212). 배포는 useDeployToolset.
// 캐시 고침 · 토스트 · 자기 층 닫기 · 이동은 useMutation **옵션** 콜백에 둔다 — 층을 닫거나 메뉴를 옮겨 화면이 사라져도 돈다
// (app/sources/useSourceMutations와 같다). mutate(vars, { onSuccess })의 호출 쪽 콜백은 쓰지 않는다.
// 성공하면 응답(서버 모양 ToolsetWire)으로 setQueryData한 뒤 목록을 무효화한다(app/deploy/toolsetCache — 배포 화면이 보고 있으면 바로 다시 받는다).
// 요청 중 잠금(확인 버튼 confirmDisabled 등)은 쓰는 곳이 isPending으로 하고, 시작만 묶음 id별 요청 상태(useIsStarting)로 읽는다.
// 본문 없는 POST는 client 기본값 {}를 보낸다(옛 api.post 기본 본문 — js/common/api.js:18)
// 층은 앱 층 모달 칸(app/layers)을 직접 부른다 — 종류와 대상이 맞을 때만 닫는다(closeModalIf)
//
// ── 쓰는 곳 계약 ──
// useCreateToolset() — 만들기 창의 "만들기". mutate({ body }) — body는 폼 입력 그대로(옛 tsRead :198 — 다듬지 않는다, 검증은 서버).
//   성공: 목록 끝에 더함 → 무효화 → 만들기 창이면 닫기 → 배포 화면에 아직 있으면 새 묶음 주소로(replace), 떠났으면 배포 메뉴의 마지막 주소를
//   새 묶음으로 남긴다(옛은 떠났어도 선택 S.ts만 바꿔 두어 돌아오면 새 묶음이 열렸다 :201) → toast(created(이름)).
//   실패: toast.warn(서버 문장), 창은 그대로(이름 · 주소 이름 · 도구 검증 문장도 서버가 준다)
// useUpdateToolset() — 수정 창의 "저장". mutate({ toolsetId, body }).
//   성공: 그 묶음을 응답으로 → 무효화 → 그 묶음의 수정 창이면 닫기 → toast(saved). 실패: toast.warn(서버 문장), 창은 그대로
// useDeleteToolset() — 삭제 확인 창(수정 창 자리를 바꿔 끼운 것)의 "삭제". mutate({ toolsetId, name }) — name은 확인 창을 연 순간의 이름.
//   서버는 떠 있는 서버를 먼저 내리고 지운다. 성공: 목록에서 뺌 · 그 묶음 서버 로그 캐시 버림 → 무효화 → 그 묶음의 삭제 확인 창이면 닫기
//   (목록 고침과 같은 그리기에 — 쿼리 알림 차례) → toast(deleted(이름)). 지운 묶음 주소의 보정(첫 묶음으로 replace)은 배포 화면이 한다.
//   실패: toast.warn(서버 문장), 확인 창은 그대로
// useStartToolset() — 서버 알림의 "시작" · "다시 시작". **배포 화면(DeployScreen)에서 한 번** 부른다(알림이 묶음마다 바뀌어도 요청이 이어진다).
//   mutate({ toolsetId }). 요청 중 글자 "시작하는 중…" · 잠금은 useIsStarting(toolsetId)로 읽는다.
//   성공: 그 묶음을 응답으로 → 무효화 → toast(start.done(주소)). 실패: 응답 순간 배포 화면에 있으면(지금 주소 — app/lastPath currentMenu.
//   요청 중 다른 메뉴에 갔다 돌아왔어도 배포 화면이다) 서버 시작 실패 창(openStartError — 원문), 떠났으면 toast.warn(서버 문장)
// useStopToolset() — 중지 확인 창의 "중지". mutate({ toolsetId }).
//   성공: 그 묶음을 응답으로 → 무효화 → 그 묶음의 중지 확인 창이면 닫기(목록 고침과 같은 그리기에 — "중지" 버튼이 사라지는 그리기라,
//   창이 먼저 닫히면 포커스가 곧 사라질 버튼으로 돌아갔다가 빠진다. 같이 그려지면 층 공통 대체 자리로 간다) → toast(stop.done(이름)).
//   실패: toast.warn(서버 문장), 창은 그대로
import { notifyManager, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { keys } from '../../api/hooks/keys';
import { TOOLSETS_PATH, toolsetApiPath } from '../../api/hooks/useToolsets';
import type { DeletedResult, ToolsetBody, ToolsetWire } from '../../api/types';
import { DEPLOY } from '../../copy/deploy';
import { currentMenu, recordLastPath } from '../lastPath';
import { closeModalIf, openStartError } from '../layers';
import { toast } from '../toast';
import { toolsetPath } from './links';
import { useIsPendingFor, type ToolsetTarget } from './pendingFor';
import { addToolset, invalidateToolsets, removeToolset, replaceToolset } from './toolsetCache';
import { endpointOf } from './toolsetView';
import { warnFailure } from './warnFailure';

/** 시작 요청의 mutation 키 — 묶음 id별 요청 상태(useIsStarting)를 이 키로 찾는다 */
export const START_MUTATION_KEY = ['deploy', 'toolsets', 'start'] as const;

const startPath = (toolsetId: string) => `${toolsetApiPath(toolsetId)}start/`;
const stopPath = (toolsetId: string) => `${toolsetApiPath(toolsetId)}stop/`;

export type CreateToolsetVars = Readonly<{ body: ToolsetBody }>;
export type UpdateToolsetVars = Readonly<{ toolsetId: string; body: ToolsetBody }>;
export type DeleteToolsetVars = Readonly<{
  toolsetId: string;
  /** 확인 창을 연 순간의 묶음 이름 — 완료 토스트에 쓴다(옛 :211은 지우기 전 ts.name) */
  name: string;
}>;
export type ToolsetVars = ToolsetTarget;

/** 응답 순간 배포 화면에 있는가 — 지금 주소로 본다(요청을 보낸 컴포넌트가 아니라). 서버 시작 실패 자리 · 만들기 성공 뒤 이동이 가른다 */
const isOnDeployScreen = (): boolean => currentMenu() === 'deploy';

/** 다시 들어올 때 열릴 주소에는 검색 파라미터가 없다(배포 화면은 주소에 묶음 id만 둔다) */
const NO_SEARCH = '';

export function useCreateToolset() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: ({ body }: CreateToolsetVars) => api.post<ToolsetWire>(TOOLSETS_PATH, body),
    onSuccess: (created) => {
      addToolset(queryClient, created);
      invalidateToolsets(queryClient);
      closeModalIf({ kind: 'toolsetCreate' });
      if (isOnDeployScreen()) void navigate(toolsetPath(created.id), { replace: true });
      else recordLastPath(toolsetPath(created.id), NO_SEARCH);
      toast(DEPLOY.form.created(created.name));
    },
    onError: warnFailure,
  });
}

export function useUpdateToolset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ toolsetId, body }: UpdateToolsetVars) => api.put<ToolsetWire>(toolsetApiPath(toolsetId), body),
    onSuccess: (updated, { toolsetId }) => {
      replaceToolset(queryClient, updated);
      invalidateToolsets(queryClient);
      closeModalIf({ kind: 'toolsetEdit', toolsetId });
      toast(DEPLOY.form.saved);
    },
    onError: warnFailure,
  });
}

export function useDeleteToolset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ toolsetId }: DeleteToolsetVars) => api.del<DeletedResult>(toolsetApiPath(toolsetId)),
    onSuccess: (_result, { toolsetId, name }) => {
      removeToolset(queryClient, toolsetId);
      queryClient.removeQueries({ queryKey: keys.toolsetLogs(toolsetId) });
      invalidateToolsets(queryClient);
      notifyManager.schedule(() => closeModalIf({ kind: 'toolsetDelete', toolsetId }));
      toast(DEPLOY.form.deleted(name));
    },
    onError: warnFailure,
  });
}

export function useStartToolset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: START_MUTATION_KEY,
    mutationFn: ({ toolsetId }: ToolsetVars) => api.post<ToolsetWire>(startPath(toolsetId)),
    onSuccess: (started) => {
      replaceToolset(queryClient, started);
      invalidateToolsets(queryClient);
      toast(DEPLOY.start.done(endpointOf(started)));
    },
    onError: (error, { toolsetId }) => {
      if (isOnDeployScreen()) openStartError(toolsetId, error.message);
      else toast.warn(error.message);
    },
  });
}

/** 그 묶음의 서버 시작이 요청 중인가 — 알림 버튼 "시작하는 중…" · 잠금 */
export const useIsStarting = (toolsetId: string): boolean => useIsPendingFor(START_MUTATION_KEY, toolsetId);

export function useStopToolset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ toolsetId }: ToolsetVars) => api.post<ToolsetWire>(stopPath(toolsetId)),
    onSuccess: (stopped, { toolsetId }) => {
      replaceToolset(queryClient, stopped);
      invalidateToolsets(queryClient);
      notifyManager.schedule(() => closeModalIf({ kind: 'stopConfirm', toolsetId }));
      toast(DEPLOY.stop.done(stopped.name));
    },
    onError: warnFailure,
  });
}
