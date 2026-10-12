// 서버가 남긴 호출 기록(trace)을 변환 과정 단계로 — 옛 buildRealTrace(js/common/convert.js:166-185).
// 로그 상세와 테스트 실행 결과가 같이 쓴다. 단계 순서: AI 호출 → (원본 요청) → (원본 응답) → 결과 또는 실패.
// 테스트 실행의 확인 대기(hold)는 AI 호출 → 사용자 확인 두 단계로 끝난다(convert.js:171-176)
import type { CallTrace, ModelInfo, Source, Tool } from '../../api/types';
import { TRACE } from '../../copy/trace';
import { protocolDesc } from '../../copy/protocol';
import { httpCode, httpRequestText, httpResponseText } from './httpText';
import { modelCall } from './modelCall';
import { own } from './own';
import { AUTH_INJECT_CHIP, NAME_FALLBACK_CHIP, ruleChips } from './ruleChip';
import type { AiStep, FailStep, HoldStep, IeumStep, SourceStep, TraceCode, TraceStep } from './types';

/** 테스트 실행 조회의 models. null이면 모델 목록 조회가 실패한 것이다 */
export type TraceModels = Readonly<Record<string, ModelInfo>> | null;

export type TraceOutcome = Readonly<{
  ok: boolean;
  /** 실패 문장(서버 원문). 없으면 빈 글 */
  error: string;
  /** null이면 서버가 변환 과정을 남기지 못한 것이다 — 단계가 없다. {}(실행 실패)면 AI 호출 + 실패 단계 */
  trace: CallTrace | null;
  /** 성공 결과 — trace.aiResult가 비면 이것을 그린다(테스트 실행 result · 로그는 trace.aiResult) */
  result?: unknown;
}>;

export type TraceInput = Readonly<{
  /** 호출한 도구 id(지워진 도구여도 있다) */
  toolId: string;
  /** 지금 있는 도구 — 지워졌으면 undefined이고, 그러면 2 · 3단계 보조 글이 빈다 */
  tool: Tool | undefined;
  /** 그 도구의 원본(tool.src) */
  source: Pick<Source, 'name' | 'proto'> | undefined;
  /** 호출한 AI 클라이언트(모델 id) */
  client: string;
  models: TraceModels;
  outcome: TraceOutcome;
  /**
   * 테스트 실행 확인 대기 — 화면 phase가 'hold'일 때만 true(결과 모양이 아니라 phase로 가른다 — js/menu/playground.js:79).
   * true면 원본 단계 · 결과 대신 사용자 확인 단계(보낸 인자 trace.args)로 끝난다. 로그 상세는 넘기지 않는다
   */
  isHold?: boolean;
}>;

/** 로그 상세 → 결과(옛 js/menu/logs.js:33-34) */
export const outcomeFromLog = (
  log: Readonly<{ status: string; note: string | null; trace?: CallTrace | null }>,
): TraceOutcome => ({
  ok: log.status === 'ok',
  error: log.note || '',
  trace: log.trace ?? null,
  result: log.trace?.aiResult,
});

/** 소요 칩 글자 — 값이 없으면 칩이 없다 */
const msLabelOf = (ms: number | null): string | null => (ms === null ? null : TRACE.ms(ms));

/** 1단계 라벨: 클라이언트 → mcp → "AI"(convert.js:168). 모델 목록 조회가 실패했으면 클라이언트 값 그대로 */
const aiLabel = (client: string, models: TraceModels): string => {
  if (models === null) return client;
  const info = own(models, client) ?? own(models, 'mcp');
  return info ? info.label : TRACE.aiFallback;
};

/** 문자열은 그대로, 나머지는 2칸 들여쓴 JSON(옛 code() — convert.js:159) */
const jsonCode = (value: unknown): TraceCode => ({
  text: typeof value === 'string' ? value : (JSON.stringify(value, null, 2) ?? ''),
  lang: 'json',
});

const aiStep = ({ toolId, client, models }: TraceInput, trace: CallTrace): AiStep => ({
  kind: 'ai',
  title: TRACE.aiPicked(aiLabel(client, models)),
  who: toolId,
  ms: null,
  msLabel: null,
  code: jsonCode(modelCall(client, toolId, trace.args || {})),
  note: TRACE.modelNote,
});

// 도구가 지워졌으면 원본을 알 수 없어 보조 글이 빈다(convert.js:178,180)
const knownSource = ({ tool, source }: TraceInput) => (tool ? source : undefined);

const requestStep = (input: TraceInput, trace: CallTrace): IeumStep | null => {
  if (!trace.originRequest) return null;
  const source = knownSource(input);
  const ms = trace.convertMs ?? 0;
  return {
    kind: 'ieum',
    title: TRACE.ieumConverted,
    who: source ? protocolDesc(source.proto) : '',
    ms,
    msLabel: msLabelOf(ms),
    chips: [...ruleChips(trace.rulesReq), AUTH_INJECT_CHIP],
    code: httpCode(httpRequestText(trace.originRequest)),
  };
};

const responseStep = (input: TraceInput, trace: CallTrace): SourceStep | null => {
  if (!trace.originResponse) return null;
  const source = knownSource(input);
  const ms = trace.sourceMs ?? 0;
  return {
    kind: 'src',
    title: TRACE.sourceReplied,
    who: source ? source.name : '',
    ms,
    msLabel: msLabelOf(ms),
    code: httpCode(httpResponseText(trace.originResponse)),
  };
};

// 결과는 trace.aiResult → result → {} 순서이고 빈 값(0 · '' · false · null)도 다음으로 넘긴다(convert.js:182의 ||)
const resultStep = ({ outcome }: TraceInput, trace: CallTrace): IeumStep => {
  const chips = ruleChips(trace.rulesRes);
  return {
    kind: 'ieum',
    title: TRACE.aiResult,
    who: TRACE.json,
    ms: null,
    msLabel: null,
    chips: chips.length > 0 ? chips : [NAME_FALLBACK_CHIP],
    code: jsonCode(trace.aiResult || outcome.result || {}),
  };
};

const failStep = ({ outcome }: TraceInput): FailStep => ({
  kind: 'fail',
  title: TRACE.failed,
  who: TRACE.error,
  ms: null,
  msLabel: null,
  error: outcome.error || '',
});

/** 사용자 확인 단계 — 번호를 세지 않고 소요 칩이 없다. 본문(확인 상자)은 그리는 쪽 슬롯이 args로 그린다(convert.js:171-176) */
const holdStep = (trace: CallTrace): HoldStep => ({
  kind: 'hold',
  title: TRACE.hold.title,
  who: TRACE.hold.who,
  ms: null,
  msLabel: null,
  args: trace.args || {},
});

/**
 * 변환 과정 단계. trace가 null이면 빈 배열이다 — 로그 상세가 LOGS.detail.noTrace 빈 상태를 보인다(js/menu/logs.js:34,46).
 * 테스트 실행은 옛에서 trace가 없어도 {}로 그렸다(convert.js:167) — 그 자리는 trace ?? {}를 넘긴다
 */
export const buildTraceSteps = (input: TraceInput): readonly TraceStep[] => {
  const { trace } = input.outcome;
  if (trace === null) return [];
  if (input.isHold === true) return [aiStep(input, trace), holdStep(trace)];
  const middle = [requestStep(input, trace), responseStep(input, trace)].filter((step) => step !== null);
  const last = input.outcome.ok ? resultStep(input, trace) : failStep(input);
  return [aiStep(input, trace), ...middle, last];
};
