// 스튜디오 주소 ↔ 화면 선택 — /studio/:toolId? · ?tf= · ?src=를 읽어 지금 보일 원본 · 도구 · 필터를 정한다(옛 vStudio 보정 — js/menu/studio.js:118-124).
// 도구가 기준이고 원본은 도구에서 나온다. 주소가 정한 선택과 다르면 그 자리에서 고친 선택을 그리고 주소를 같은 화면으로 바꾼다(replace):
// - 도구 id는 원본 기준으로 먼저 찾는다 — 같은 id가 여러 원본에 있을 수 있다(명세 다시 읽기가 만든 id 충돌). 이 화면 안 이동이 실은 원본
//   (state.studioSource — 원본 선택 · 도구 선택 · 필터 · 주소 고침), 없으면 직전에 보던 원본(app/studio/studioUi — 옛 S.src)의 도구 목록에서 찾고,
//   거기 없을 때만 전역 id(같은 id면 뒤에 온 원본)로 찾는다. 원본을 고르는 이동이 원본을 싣는 까닭: 직전 원본 기록은 그린 뒤라 이동보다 늦다
// - 도구 id가 없거나 모르는 id(원본 목록에 없는 원본의 도구 포함) → 먼저 볼 원본(이동이 실은 원본 → 직전 원본)의 첫 도구,
//   그 원본에 도구가 없으면 도구가 있는 첫 원본의 첫 도구
//   (옛은 S.src를 유지했다 — 명세 다시 읽기로 보던 도구가 사라져도 같은 원본의 첫 도구로 간다)
// - ?src=는 도구 id가 없을 때만 읽는다 — 그 원본에 도구가 있으면 첫 도구로, 0개면 그 원본의 빈 목록(상세 비움), 모르는 원본이면 위와 같다
// - ?tf=는 review · done · off만 남기고 all · 모르는 값은 뺀다
// 다른 메뉴의 링크(app/studio/links)가 실은 도착 표지가 있으면 검색어를 비우고 표지를 지운다(같은 주소 replace) — LNB 재진입은 표지가 없어 검색어가 남는다.
// 화면 안 선택(원본 · 도구 · 필터)은 모두 replace다. 원본을 바꾸면 필터 · 검색어를 비운다(js/menu/studio.js:188)
import { useLayoutEffect } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { ToolIndex } from '../../api/hooks/useTools';
import type { Source, Tool } from '../../api/types';
import { isStudioArrive } from '../../app/studio/links';
import { setStudioSource, setToolQuery, useStudioSource } from '../../app/studio/studioUi';

/** 도구 목록 필터 — 전체 · 검토 필요(검토 대기 + 명세 변경) · 공개 중 · 제외 */
export type ToolFilter = 'all' | 'review' | 'done' | 'off';
export const TOOL_FILTERS: readonly ToolFilter[] = ['all', 'review', 'done', 'off'];
const ALL: ToolFilter = 'all';

/** 주소 검색 파라미터 이름 */
export const STUDIO_PARAM = { tf: 'tf', src: 'src' } as const;
const STUDIO_PATH = '/studio';

/** 화면이 그리는 선택. tool이 없으면 도구 0개 원본(?src=)의 빈 목록이다 */
export type StudioSelection = Readonly<{
  source: Source;
  /** 그 원본의 도구(서버 순서) */
  tools: readonly Tool[];
  tool: Tool | undefined;
}>;

type RouteInput = Readonly<{
  toolId: string | undefined;
  src: string | null;
  /** 먼저 볼 원본 — 이동이 실은 원본, 없으면 직전에 보던 원본. 도구 id를 이 원본에서 먼저 찾고, 모르는 도구 id는 이 원본의 첫 도구로 고친다 */
  preferredSourceId: string | undefined;
}>;

/** 이 화면 안 이동이 싣는 state — 이동이 고른 원본 */
type StudioSourceState = Readonly<{ studioSource: string }>;

const sourceStateOf = (state: unknown): string | undefined =>
  typeof state === 'object' && state !== null && 'studioSource' in state && typeof state.studioSource === 'string'
    ? state.studioSource
    : undefined;

const sourceStateFor = (sourceId: string): StudioSourceState => ({ studioSource: sourceId });

const isToolFilter = (value: string | null): value is ToolFilter =>
  value !== null && (TOOL_FILTERS as readonly string[]).includes(value);

const toolsOf = (index: ToolIndex, sourceId: string): readonly Tool[] =>
  Object.hasOwn(index.bySource, sourceId) ? (index.bySource[sourceId] ?? []) : [];

/** 도구 id를 원본 기준으로 찾는다 — 그 원본의 도구 목록에 있으면 그것, 없으면 전역 id(같은 id가 여러 원본에 있으면 뒤에 온 원본) */
export function toolOf(index: ToolIndex, toolId: string, sourceId: string | undefined): Tool | undefined {
  const own = sourceId === undefined ? undefined : toolsOf(index, sourceId).find((t) => t.id === toolId);
  return own ?? (Object.hasOwn(index.byId, toolId) ? index.byId[toolId] : undefined);
}

const selectionOf = (index: ToolIndex, source: Source): StudioSelection => {
  const tools = toolsOf(index, source.id);
  return { source, tools, tool: tools[0] };
};

/** 주소가 정한 선택. 도구가 있는 원본이 하나도 없고 ?src=로 고른 원본도 없으면 null(처음 빈 상태) */
function resolveSelection(sources: readonly Source[], index: ToolIndex, input: RouteInput): StudioSelection | null {
  const { toolId, src, preferredSourceId } = input;
  const withTools = sources.filter((s) => toolsOf(index, s.id).length > 0);
  const tool = toolId === undefined ? undefined : toolOf(index, toolId, preferredSourceId);
  const toolSource = tool === undefined ? undefined : withTools.find((s) => s.id === tool.src);
  if (tool !== undefined && toolSource !== undefined) return { source: toolSource, tools: toolsOf(index, toolSource.id), tool };
  const asked = toolId === undefined && src !== null ? sources.find((s) => s.id === src) : undefined;
  if (asked !== undefined) return selectionOf(index, asked);
  const fallback = withTools.find((s) => s.id === preferredSourceId) ?? withTools[0];
  return fallback === undefined ? null : selectionOf(index, fallback);
}

/** 처음 빈 상태인지 — 화면 판정(screenGate isEmpty)이 쓴다 */
export const isStudioEmpty = (
  sources: readonly Source[],
  index: ToolIndex,
  toolId: string | undefined,
  src: string | null,
): boolean => resolveSelection(sources, index, { toolId, src, preferredSourceId: undefined }) === null;

/** 선택을 그리는 주소 — 도구면 /studio/<id>, 도구 0개 원본이면 /studio?src=<id>. 필터는 전체가 아니면 붙인다 */
function hrefOf(selection: Pick<StudioSelection, 'source' | 'tool'>, tf: ToolFilter): string {
  const search = new URLSearchParams();
  if (selection.tool === undefined) search.set(STUDIO_PARAM.src, selection.source.id);
  if (tf !== ALL) search.set(STUDIO_PARAM.tf, tf);
  const path = selection.tool === undefined ? STUDIO_PATH : `${STUDIO_PATH}/${encodeURIComponent(selection.tool.id)}`;
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export type StudioRoute = Readonly<{
  selection: StudioSelection;
  /** 원본 선택지 — 도구가 있는 원본(서버 순서) + 지금 보는 도구 0개 원본 */
  sourceOptions: readonly Source[];
  filter: ToolFilter;
  pickTool: (toolId: string) => void;
  pickSource: (sourceId: string) => void;
  setFilter: (filter: string) => void;
}>;

/** 화면이 준비(도구 · 원본을 받음)된 뒤 부른다. 처음 빈 상태면 null */
export function useStudioRoute(sources: readonly Source[], index: ToolIndex): StudioRoute | null {
  const { toolId } = useParams();
  const [params] = useSearchParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const lastSourceId = useStudioSource();

  const rawFilter = params.get(STUDIO_PARAM.tf);
  const src = params.get(STUDIO_PARAM.src);
  const filter: ToolFilter = isToolFilter(rawFilter) ? rawFilter : ALL;
  const preferredSourceId = sourceStateOf(state) ?? lastSourceId;
  const selection = resolveSelection(sources, index, { toolId, src, preferredSourceId });
  const target = selection === null ? null : hrefOf(selection, filter);
  // 주소가 이미 이 선택을 그리는지 — 경로 id는 useParams가 푼 값끼리 견준다
  const isCanonical =
    selection !== null &&
    toolId === selection.tool?.id &&
    src === (selection.tool === undefined ? selection.source.id : null) &&
    rawFilter === (filter === ALL ? null : filter);
  const arrived = isStudioArrive(state);
  const sourceId = selection?.source.id;

  useLayoutEffect(() => {
    if (sourceId !== undefined) setStudioSource(sourceId);
  }, [sourceId]);

  // 그리기 전에 고친다 — 도착 표지의 검색어가 한 번 그려지거나 고치기 전 주소가 남지 않게
  useLayoutEffect(() => {
    if (target === null || sourceId === undefined) return;
    if (arrived) setToolQuery('');
    if (arrived || !isCanonical) void navigate(target, { replace: true, state: sourceStateFor(sourceId) });
  }, [arrived, isCanonical, target, sourceId, navigate]);

  if (selection === null) return null;

  // 화면 안 이동은 모두 replace이고 그 선택의 원본을 싣는다
  const go = (next: Pick<StudioSelection, 'source' | 'tool'>, tf: ToolFilter) => {
    void navigate(hrefOf(next, tf), { replace: true, state: sourceStateFor(next.source.id) });
  };
  // 도구를 고르면 그 도구 주소(필터 유지, ?src= 버림) — 목록은 지금 원본의 도구라 그 원본에서 먼저 찾는다
  const pickTool = (id: string) => {
    const tool = toolOf(index, id, selection.source.id);
    if (tool !== undefined) go({ source: selection.source, tool }, filter);
  };
  // 원본을 바꾸면 그 원본의 첫 도구 · 필터 전체 · 검색어 비움
  const pickSource = (id: string) => {
    const source = sources.find((s) => s.id === id);
    if (source === undefined) return;
    setToolQuery('');
    go(selectionOf(index, source), ALL);
  };
  // 필터는 목록만 바꾼다 — 상세는 고른 도구 그대로(필터 밖이어도)
  const setFilter = (next: string) => {
    go(selection, isToolFilter(next) ? next : ALL);
  };

  const sourceOptions = sources.filter((s) => toolsOf(index, s.id).length > 0 || s.id === selection.source.id);
  return { selection, sourceOptions, filter, pickTool, pickSource, setFilter };
}
