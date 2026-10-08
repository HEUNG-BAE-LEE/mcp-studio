// 변환 스튜디오 도구 쓰기 둘 — 저장 · AI로 다시 쓰기(옛 js/menu/studio.js:151-166)
// 캐시 · 초안 고침과 토스트는 saveTool · useMutation **옵션** 콜백에 둔다(mutate 호출 쪽 콜백이 아니다) — 요청 중에 도구 · 메뉴를 옮겨 화면이 사라져도 돈다.
// 성공하면 도구(['studio'])를 다시 받지 않고 응답으로 setQueryData만 한다(캐시가 아직 없으면 만들지 않는다)
// 요청 중 잠금(pending — 포커스 유지)은 쓰는 곳(저장 버튼 · 다시 쓰기 링크)이 isPending · variables로 한다
//
// ── 쓰는 곳 계약 ──
// saveTool(queryClient, toolId, body) — 토스트 없는 저장. body는 saveBodyOf(toolId)(app/studio/saveBody).
//   요청 때의 초안은 이 함수가 요청을 보내기 전(첫 await 전)에 잡는다.
//   성공: 그 도구를 응답으로 바꾸고(호출 수 calls는 캐시 값 유지) → 지금 초안이 요청 때 초안과 같은 참조면 지운다(저장 중에 고친 편집은
//   초안으로 남아 저장 버튼이 다시 켜진다) → 응답을 돌려준다. 실패: 초안은 그대로, 오류를 그대로 던진다.
//   배포 창은 saveTool을 자기 요청 안에서 차례로 부른다(토스트 없음 — 옛 deploy.js:110)
// useSaveTool() — 스튜디오 저장 버튼. mutate({ toolId, body: saveBodyOf(toolId) }) — mutationFn이 saveTool을 부른다.
//   성공: toast(saved). 실패: toast.warn(saveFailed(서버 문장))
// useRewriteTool() — mutate({ toolId, desc, again }): desc는 초안을 덮은 지금 설명, again은 초안의 rewritten 표시.
//   성공: **요청한 도구**의 초안에 desc · rewritten을 쓴다(그사이 다른 도구로 옮겼어도 보이는 도구는 그대로) → toast.info(rewriteDone).
//   "쓰는 중…"은 isPending && variables.toolId === 지금 도구일 때만. 실패: toast.warn(서버 문장 그대로)
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { keys } from '../../api/hooks/keys';
import type { RewriteResponse, SavedTool, StudioResponse, ToolRecord } from '../../api/types';
import { STUDIO } from '../../copy/studio';
import { toast } from '../toast';
import { clearDraftIfSame, draftOf, patchDraft } from './drafts';
import type { SaveBody } from './saveBody';

const toolPath = (toolId: string) => `/studio/${encodeURIComponent(toolId)}/`;
const rewritePath = (toolId: string) => `${toolPath(toolId)}rewrite/`;

export type SaveToolVars = Readonly<{ toolId: string; body: SaveBody }>;
export type RewriteToolVars = Readonly<{
  toolId: string;
  /** 초안을 덮은 지금 설명 */
  desc: string;
  /** 이 도구를 AI로 다시 쓴 적이 있으면 true — 서버가 "이전과 다른 표현"을 붙인다 */
  again: boolean;
}>;

/** 그 도구를 저장 응답으로 바꾼다 — 원본 id(src)는 캐시 모양에 없고, 호출 수는 저장값이 아니라 캐시 값을 둔다 */
function replaceSaved(queryClient: QueryClient, toolId: string, saved: SavedTool): void {
  const { src: _src, ...record } = saved;
  const swap = (t: ToolRecord): ToolRecord => (t.id === toolId ? { ...record, calls: t.calls } : t);
  queryClient.setQueryData<StudioResponse>(keys.tools(), (prev) =>
    prev === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(prev).map(([src, list]) => [src, list.some((t) => t.id === toolId) ? list.map(swap) : list]),
        ),
  );
}

/** 도구 하나를 저장하고 캐시 · 초안을 고친다. 토스트는 부르는 쪽이 한다 */
export async function saveTool(queryClient: QueryClient, toolId: string, body: SaveBody): Promise<SavedTool> {
  const requested = draftOf(toolId);
  const saved = await api.put<SavedTool>(toolPath(toolId), body);
  replaceSaved(queryClient, toolId, saved);
  clearDraftIfSame(toolId, requested);
  return saved;
}

export function useSaveTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ toolId, body }: SaveToolVars) => saveTool(queryClient, toolId, body),
    onSuccess: () => {
      toast(STUDIO.toast.saved);
    },
    onError: (error) => {
      toast.warn(STUDIO.toast.saveFailed(error.message));
    },
  });
}

export function useRewriteTool() {
  return useMutation({
    mutationFn: ({ toolId, desc, again }: RewriteToolVars) =>
      api.post<RewriteResponse>(rewritePath(toolId), { desc, again }),
    onSuccess: ({ desc }, { toolId }) => {
      patchDraft(toolId, { desc, rewritten: true });
      toast.info(STUDIO.toast.rewriteDone);
    },
    onError: (error) => {
      toast.warn(error.message);
    },
  });
}
