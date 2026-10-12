// 배포 모달 칸 한 시도(열 때마다 한 번)가 쥐는 값 — 연 순간의 묶음 · 키 · 배포 확인 계산과 만들기 · 수정 · 키 발급 입력.
// 모달 칸(app/LayerHost ModalFrame → app/deploy/useDeployModalContent)이 부른다
//
// 왜 연 순간에 잡나: 쓰기가 성공하면 캐시가 먼저 바뀌고(배포는 버전 · 상태, 삭제는 묶음이 빠지고, 저장은 초안이 지워진다) 칸은 닫힌 뒤에도 내용을 남긴다.
// 다시 찾으면 닫히는 동안 제목 · 본문이 바뀌거나 비어 보인다. 옛도 연 순간의 값으로 모달 HTML을 만들었다(js/menu/deploy.js:141-155,161-163,180-181,190-197)
//
// ── 쓰는 곳 계약 ──
// useDeployModalAttempt(layer) → { attempt, changeForm, changeKeyName }
//   layer — 모달 칸의 지금(또는 닫히며 남긴) 층. attemptId가 바뀌면 그리기 전에 새 시도로 바꾼다(app/sources/useModalAttempt와 같은 렌더 중 맞추기).
//     같은 시도 안의 내용 교체(서버 로그 "새로 읽기" — replaceServerLog)는 attemptId가 그대로라 다시 잡지 않는다
//   attempt.toolset — 묶음 층(수정 · 삭제 확인 · 배포 확인 · 중지 확인 · 시작 실패 · 서버 로그)이 연 순간의 묶음(서버 모양). 목록 캐시에 없으면 null —
//     쓰는 곳은 그리지 않고 칸을 비운다(옛 curTs는 없는 id면 첫 묶음으로 떨어졌지만 여는 곳이 늘 지금 묶음이다)
//   attempt.key — 키 폐기 확인이 연 순간의 키. 없으면 null
//   attempt.plan — 배포 확인이 연 순간의 세 목록(공개 · 빠짐 · 먼저 저장 — 초안을 덮은 도구로 센다, app/deploy/toolsetView deployPlan).
//     도구를 아직 받지 못했으면 null. 누르는 순간 보낼 "먼저 저장" 목록은 쓰는 곳이 다시 센다(앞 시도에서 저장된 도구는 빠진다)
//   attempt.form — 만들기(빈 칸 + 사용 대상 "전 직원") · 수정(그 묶음 값) 입력. tools는 고른 도구 id — 보낼 때 목록 순서로 다시 줄 세운다
//   attempt.keyName — 키 발급 이름 입력(빈 칸에서 시작)
//   changeForm · changeKeyName — 지금 시도의 입력만 바꾼다(그사이 새 시도로 바뀌었으면 두지 않는다)
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { keys } from '../../api/hooks/keys';
import type { ToolIndex } from '../../api/hooks/useTools';
import type { AccessKey, ToolsetBody, ToolsetWire } from '../../api/types';
import { DEPLOY } from '../../copy/deploy';
import type { ModalLayer } from '../layers';
import { useDrafts, type Drafts } from '../studio/drafts';
import { useToolsWithDrafts } from '../studio/toolView';
import { deployPlan, type DeployPlan } from './toolsetView';

export type DeployModalAttempt = Readonly<{
  /** 이 시도의 번호 — 모달 칸의 attemptId */
  attemptId: number;
  /** 연 순간의 묶음. 묶음 층이 아니거나 목록에 없으면 null */
  toolset: ToolsetWire | null;
  /** 연 순간의 키. 키 폐기 확인이 아니거나 목록에 없으면 null */
  key: AccessKey | null;
  /** 연 순간의 배포 확인 세 목록. 배포 확인이 아니거나 도구를 아직 받지 못했으면 null */
  plan: DeployPlan | null;
  /** 만들기 · 수정 입력 */
  form: ToolsetBody;
  /** 키 발급 이름 입력 */
  keyName: string;
}>;

type AttemptHook = Readonly<{
  attempt: DeployModalAttempt;
  changeForm: (form: ToolsetBody) => void;
  changeKeyName: (name: string) => void;
}>;

type AttemptCache = Readonly<{
  toolsets: readonly ToolsetWire[] | undefined;
  accessKeys: readonly AccessKey[] | undefined;
  /** 초안을 덮은 도구 */
  tools: ToolIndex | undefined;
  drafts: Drafts;
}>;

const EMPTY_FORM: ToolsetBody = Object.freeze({ name: '', slug: '', audience: '', tools: [] });

const formOf = (ts: ToolsetWire): ToolsetBody => ({ name: ts.name, slug: ts.slug, audience: ts.audience, tools: ts.tools });

/** 열 때의 캐시로 새 시도를 만든다 */
function startAttempt(layer: ModalLayer, cache: AttemptCache): DeployModalAttempt {
  const empty: DeployModalAttempt = {
    attemptId: layer.attemptId,
    toolset: null,
    key: null,
    plan: null,
    form: EMPTY_FORM,
    keyName: '',
  };
  if (layer.kind === 'toolsetCreate') return { ...empty, form: { ...EMPTY_FORM, audience: DEPLOY.form.audienceDefault } };
  if (layer.kind === 'keyRevoke') return { ...empty, key: cache.accessKeys?.find((k) => k.id === layer.keyId) ?? null };
  if (!('toolsetId' in layer)) return empty;
  const toolset = cache.toolsets?.find((t) => t.id === layer.toolsetId) ?? null;
  if (toolset === null) return empty;
  if (layer.kind === 'toolsetEdit') return { ...empty, toolset, form: formOf(toolset) };
  if (layer.kind === 'deployConfirm') {
    const plan = cache.tools === undefined ? null : deployPlan(toolset.tools, cache.tools.byId, cache.drafts);
    return { ...empty, toolset, plan };
  }
  return { ...empty, toolset };
}

export function useDeployModalAttempt(layer: ModalLayer): AttemptHook {
  const queryClient = useQueryClient();
  const tools = useToolsWithDrafts().data;
  const drafts = useDrafts();
  // 묶음 · 키 목록은 구독하지 않고 연 순간에만 읽는다 — 모달 칸이 배포 화면의 조회를 받게 하지 않는다(여는 곳은 목록을 받은 뒤에만 보인다)
  const cacheNow = (): AttemptCache => ({
    toolsets: queryClient.getQueryData<readonly ToolsetWire[]>(keys.toolsets()),
    accessKeys: queryClient.getQueryData<readonly AccessKey[]>(keys.accessKeys()),
    tools,
    drafts,
  });
  const [stored, setStored] = useState(() => startAttempt(layer, cacheNow()));
  const attempt = stored.attemptId === layer.attemptId ? stored : startAttempt(layer, cacheNow());
  if (attempt !== stored) setStored(attempt);
  const changeForm = (form: ToolsetBody) =>
    setStored((prev) => (prev.attemptId === layer.attemptId ? { ...prev, form } : prev));
  const changeKeyName = (keyName: string) =>
    setStored((prev) => (prev.attemptId === layer.attemptId ? { ...prev, keyName } : prev));
  return { attempt, changeForm, changeKeyName };
}
