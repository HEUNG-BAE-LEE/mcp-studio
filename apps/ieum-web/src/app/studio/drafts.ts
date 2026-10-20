// 변환 스튜디오 초안 저장소 — 저장하지 않은 편집을 도구별로 쌓는다(옛은 도구 객체를 그 자리에서 고치고 _dirty를 켰다 — js/main.js:23).
// 도구 · 원본 · 메뉴를 옮겨도 남고 새로고침에 사라진다(모듈 저장소 — app/store). 떠날 때 확인은 두지 않는다.
// 초안이 있으면 "저장 안 된 변경이 있다"는 뜻이고(저장 버튼 활성), 화면은 서버 도구 위에 초안을 덮어 그린다(applyDraft · app/studio/toolView).
// 바꿀 때마다 저장소 · 그 도구의 초안 · 바뀐 배열을 새로 만든다 — 저장 요청 때 잡은 초안과 지금 초안을 참조로 비교한다(saveTool).
//
// 초안이 사라지는 곳: 저장 성공(요청 때 초안과 같을 때만) · 명세 다시 읽기 성공 · 원본 삭제 · 자동 탐색 등록(clearDrafts)
import { useCallback } from 'react';
import type { ExecMode, Tool, ToolParam, ToolResField, ToolStatus } from '../../api/types';
import { createStore, useStore } from '../store';

/** 편집할 수 있는 필드만(제목 · 모드 · 메서드 · 확인 질문 · 원본 요청 모양은 못 고친다). 있는 키만 서버 도구를 덮는다 */
export type ToolDraft = Readonly<{
  desc?: string;
  params?: readonly ToolParam[];
  res?: readonly ToolResField[];
  exec?: ExecMode;
  mask?: boolean;
  cache?: boolean;
  limit?: number;
  status?: ToolStatus;
  offReason?: string;
  /** 화면 표시 전용 — AI로 다시 쓴 적이 있다(다음 다시 쓰기의 again). 서버 도구를 덮지도, 저장 본문에 실리지도 않는다 */
  rewritten?: boolean;
}>;

/** 초안에 더할 값. 함수형 편집(editDraft)이 null을 돌려주면 아무것도 바꾸지 않는다(초안도 만들지 않는다) */
export type DraftPatch = ToolDraft;

/** { 도구 id: 초안 } */
export type Drafts = Readonly<Record<string, ToolDraft>>;

const EMPTY: Drafts = Object.freeze({});
const draftStore = createStore<Drafts>(EMPTY);

// 도구 id가 'constructor' 같은 이름이어도 Object.prototype 값을 초안으로 읽지 않게 자기 키만 본다
const ownDraft = (drafts: Drafts, toolId: string): ToolDraft | undefined =>
  Object.hasOwn(drafts, toolId) ? drafts[toolId] : undefined;

/** 서버 도구 위에 초안을 덮은 도구(화면이 보는 값). 초안이 없으면 받은 도구 그대로(같은 참조) */
export function applyDraft(tool: Tool, draft: ToolDraft | undefined): Tool {
  if (draft === undefined) return tool;
  const { rewritten: _rewritten, ...fields } = draft;
  return { ...tool, ...fields };
}

// ── 읽기 ──

const selectAll = (drafts: Drafts) => drafts;

/** 초안 전체 — 바뀔 때마다 새 객체라 useMemo 의존값으로 쓴다 */
export const useDrafts = (): Drafts => useStore(draftStore, selectAll);

/** 도구 하나의 초안. 없으면 undefined(저장 버튼 비활성) */
export function useToolDraft(toolId: string): ToolDraft | undefined {
  const select = useCallback((drafts: Drafts) => ownDraft(drafts, toolId), [toolId]);
  return useStore(draftStore, select);
}

/** 지금 초안(컴포넌트 밖 — mutation 콜백 · 저장 본문) */
export const draftOf = (toolId: string): ToolDraft | undefined => ownDraft(draftStore.get(), toolId);

/** 초안이 있는 도구 id(저장 안 된 도구 — 배포 창의 "먼저 저장" 목록) */
export const draftIds = (): readonly string[] => Object.keys(draftStore.get());

// ── 쓰기 ──

const withDraft = (drafts: Drafts, toolId: string, patch: DraftPatch): Drafts => ({
  ...drafts,
  [toolId]: { ...ownDraft(drafts, toolId), ...patch },
});

/** 화면 상태와 상관없는 값을 초안에 더한다(AI로 다시 쓴 설명 — 요청한 도구 id로) */
export function patchDraft(toolId: string, patch: DraftPatch): void {
  draftStore.set((drafts) => withDraft(drafts, toolId, patch));
}

/**
 * 지금 보이는 값(서버 도구 + 지금 초안)에서 만든 값을 초안에 더한다 — 행 하나 고치기 · 상태 바꾸기처럼 앞 값이 필요한 편집.
 * base는 서버 도구(useTools)다. update가 null이면 바꾸지 않는다
 */
export function editDraft(base: Tool, update: (view: Tool) => DraftPatch | null): void {
  draftStore.set((drafts) => {
    const patch = update(applyDraft(base, ownDraft(drafts, base.id)));
    return patch === null ? drafts : withDraft(drafts, base.id, patch);
  });
}

/** 도구들의 초안을 지운다. 지울 것이 없으면 저장소를 바꾸지 않는다(구독자에게 알리지 않음) */
export function clearDrafts(toolIds: readonly string[]): void {
  draftStore.set((drafts) => {
    const remove = new Set(toolIds.filter((id) => Object.hasOwn(drafts, id)));
    if (remove.size === 0) return drafts;
    return Object.fromEntries(Object.entries(drafts).filter(([id]) => !remove.has(id)));
  });
}

/**
 * 저장 성공 뒤 — 지금 초안이 요청 때 잡은 초안과 같은 참조일 때만 지운다.
 * 저장 중에 편집했으면 초안이 새 객체라 남는다(저장 버튼이 다시 켜진다)
 */
export function clearDraftIfSame(toolId: string, requested: ToolDraft | undefined): void {
  draftStore.set((drafts) => {
    const current = ownDraft(drafts, toolId);
    if (current === undefined || current !== requested) return drafts;
    return Object.fromEntries(Object.entries(drafts).filter(([id]) => id !== toolId));
  });
}
