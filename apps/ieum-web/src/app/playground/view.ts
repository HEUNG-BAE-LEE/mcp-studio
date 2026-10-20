// 테스트 실행 화면이 데이터에서 만드는 값 — 도구 select 묶음 · 고를 도구 · 변환 과정 입력 · 부제(옛 vPlay · renderTrace — js/menu/playground.js:33-79).
// 그리기와 상관없는 순수 함수다. 도구는 useTools(서버 저장본)만 본다 — 스튜디오 초안은 읽지 않는다
import type { ToolIndex } from '../../api/hooks/useTools';
import type { ModelId, Source, Tool } from '../../api/types';
import { PLAYGROUND } from '../../copy/playground';
import type { TraceInput, TraceModels } from '../trace/buildTraceSteps';
import { own } from '../trace/own';
import type { PlaygroundOut, PlaygroundPhase } from './store';

export type ToolOption = Readonly<{ id: string; label: string }>;
/** 원본 하나의 optgroup — 공개 대상 도구가 없어도 빈 묶음으로 남는다(옛 그대로) */
export type ToolGroup = Readonly<{ sourceId: string; label: string; options: readonly ToolOption[] }>;

/** 테스트할 수 있는 도구 — 제외(off)만 빠진다. 검토 중(review · drift)도 부를 수 있다 */
export const isPlayable = (tool: Pick<Tool, 'status'>): boolean => tool.status !== 'off';

const isReviewing = (tool: Pick<Tool, 'status'>): boolean => tool.status === 'review' || tool.status === 'drift';

/** 옵션 글 = id + 쓰기 표시 + 검토 중 표시(다른 화면의 상태 라벨과 다르다 — 옛 :47 그대로) */
export const toolOptionLabel = (tool: Pick<Tool, 'id' | 'mode' | 'status'>): string =>
  `${tool.id}${tool.mode === 'write' ? PLAYGROUND.tool.writeSuffix : ''}${isReviewing(tool) ? PLAYGROUND.tool.reviewSuffix : ''}`;

/** 도구 select 묶음 — 원본 순서(GET /sources/), 원본마다 공개 대상 도구를 원본 응답 순서로 */
export function toolGroups(sources: readonly Pick<Source, 'id' | 'name'>[], bySource: ToolIndex['bySource']): readonly ToolGroup[] {
  return sources.map((source) => ({
    sourceId: source.id,
    label: source.name,
    options: (own(bySource, source.id) ?? []).filter(isPlayable).map((t) => ({ id: t.id, label: toolOptionLabel(t) })),
  }));
}

/**
 * 고를 도구 id — 주소의 도구가 있고 제외가 아니면 그것, 아니면 공개 대상 첫 도구(id 표 순서 — 옛 allTools(), 드롭다운 순서와 다를 수 있다).
 * 공개 대상이 하나도 없으면 null(빈 상태). 결과가 주소와 다르면 화면이 주소를 replace로 고친다
 */
export function pickToolId(requested: string | null, byId: ToolIndex['byId']): string | null {
  const current = requested === null ? undefined : own(byId, requested);
  if (current !== undefined && isPlayable(current)) return current.id;
  return Object.values(byId).find(isPlayable)?.id ?? null;
}

export type TraceContext = Readonly<{
  /** 변환 과정 칸이 마지막으로 그린 phase(useDrawnTracePhase) — 지금 phase가 아니다. 대화를 보낸 동안에도 확인 상자가 남는다(옛 :95) */
  drawnPhase: PlaygroundPhase;
  /** 지금 고른 모델 — 결과에 모델이 없을 때만 쓴다(옛 o.model || S.pg.model) */
  model: ModelId;
  byId: ToolIndex['byId'];
  sources: readonly Pick<Source, 'id' | 'name' | 'proto'>[];
  models: TraceModels;
}>;

/** 결과의 도구와 그 원본 — 도구가 지워졌으면 둘 다 없다 */
function toolAndSource(out: PlaygroundOut, byId: ToolIndex['byId'], sources: TraceContext['sources']) {
  const tool = own(byId, out.tool);
  const source = tool === undefined ? undefined : sources.find((s) => s.id === tool.src);
  return { tool, source };
}

/** 결과 → 변환 과정 단계 입력(buildTraceSteps). 확인 대기 그림은 결과 모양이 아니라 그린 phase로만 가른다(옛 renderTrace — :78-79) */
export function playgroundTraceInput(out: PlaygroundOut, ctx: TraceContext): TraceInput {
  const { tool, source } = toolAndSource(out, ctx.byId, ctx.sources);
  return {
    toolId: out.tool,
    tool,
    source,
    client: out.model || ctx.model,
    models: ctx.models,
    outcome: { ok: out.ok, error: out.error, trace: out.trace, result: out.result },
    isHold: ctx.drawnPhase === 'hold',
  };
}

/** 확인 상자 질문 — 결과 도구의 confirmQ, 없거나 도구가 지워졌으면 기본 질문(옛 convert.js:175) */
export function holdQuestion(out: PlaygroundOut, byId: ToolIndex['byId']): string {
  return own(byId, out.tool)?.confirmQ || PLAYGROUND.hold.defaultQuestion;
}

/** 변환 과정 부제 "{도구 id}, {원본 이름}" — 결과가 없거나 도구 · 원본을 찾지 못하면 빈 글(옛 :77) */
export function traceSubtitle(out: PlaygroundOut | null, byId: ToolIndex['byId'], sources: TraceContext['sources']): string {
  if (out === null) return '';
  const { tool, source } = toolAndSource(out, byId, sources);
  return tool === undefined || source === undefined ? '' : PLAYGROUND.trace.sub(tool.id, source.name);
}
