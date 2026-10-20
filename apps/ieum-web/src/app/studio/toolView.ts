// 초안을 덮은 도구 목록 — useTools()와 같은 모양(all · byId · bySource)에 저장 안 된 편집을 덮는다.
// 스튜디오 화면과 배포 확인 창(공개 수 · 빠지는 도구 — 옛은 메모리의 고친 도구로 셌다, js/menu/deploy.js:142-144)이 쓴다.
// 대시보드 · 테스트 실행 목록 · 배포 도구 표는 저장본(useTools)을 쓴다
import { useMemo } from 'react';
import { useTools, type ToolIndex, type ToolsQuery } from '../../api/hooks/useTools';
import { applyDraft, useDrafts, type Drafts } from './drafts';

function indexWithDrafts(index: ToolIndex, drafts: Drafts): ToolIndex {
  if (Object.keys(drafts).length === 0) return index;
  const bySource = Object.fromEntries(
    Object.entries(index.bySource).map(([src, list]) => [
      src,
      list.map((t) => applyDraft(t, Object.hasOwn(drafts, t.id) ? drafts[t.id] : undefined)),
    ]),
  );
  const all = Object.values(bySource).flat();
  return { all, byId: Object.fromEntries(all.map((t) => [t.id, t])), bySource };
}

/** 초안을 덮은 도구 — 로딩 · 실패 상태는 useTools 그대로 */
export function useToolsWithDrafts(): ToolsQuery {
  const tools = useTools();
  const drafts = useDrafts();
  const index = tools.data;
  const data = useMemo(() => (index ? indexWithDrafts(index, drafts) : undefined), [index, drafts]);
  return { ...tools, data };
}
