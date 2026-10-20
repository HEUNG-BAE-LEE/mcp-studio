// 테스트 실행 화면 상태(옛 S.pg — js/common/state.js:45). 모듈 저장소(app/store)라 메뉴를 옮겨도 남고 새로고침하면 빈다(브라우저 저장소에 쓰지 않는다).
// 고른 도구는 여기 두지 않고 주소 ?tool=에 둔다. 옛 S.pg.hold는 쓰지 않던 필드라 만들지 않는다. 바꿀 때마다 새 객체를 만든다
//
// phase 하나를 직접 호출과 대화가 같이 쓴다 — 늦게 끝난 쪽이 덮는다(옛 그대로). 확인 대기 그림은 out 모양이 아니라 phase === 'hold'로만
// 가른다(옛 renderTrace — js/menu/playground.js:78-79): 확인 대기 중 대화 칩이 out을 바꾸면 그 호출이 확인 대기 모양으로 그려지고,
// 확인 대기 중 대화가 호출 없이 끝나면 out이 남은 채 phase만 idle이 되어 실패 단계(빈 문장)로 그려진다
//
// ── 그린 phase(drawn) ──
// 옛은 동작마다 다시 그리는 범위가 달라 칸마다 "마지막으로 그린 때의 phase"를 보였다. 그 때를 그대로 따른다:
// - 전체 다시 그리기(render — 세 칸 모두): 실행 시작 · 응답 · 실패, 모델 · 도구 바꿈, 초기화, 그만두기, 스튜디오에서 들어옴, 메뉴에 들어옴(redraw)
// - 대화 시작: 대화 칸만(renderChat — :95) → 실행 버튼 · 변환 과정은 그 전 그림 그대로(실행 중이면 "호출하는 중…" · 확인 대기면 확인 상자가 남는다)
// - 대화 끝 · 실패: 대화 칸 + 변환 과정(renderChat + renderTrace — :102) / 대화 칩: 변환 과정만(renderTrace — :110)
// drawn.call = 도구 호출 칸(실행 버튼 · 실행 가드)이 본 phase, drawn.trace = 변환 과정 칸(확인 대기 그림)이 본 phase.
// 대화 칸(입력 중 표시 · 보내기 잠금)은 phase가 바뀌는 모든 곳에서 다시 그려져(전체 또는 renderChat) 지금 phase를 그대로 본다.
// out은 바뀌는 곳마다 변환 과정을 다시 그려 지금 값을 그대로 본다
//
// ── 쓰는 곳 계약(화면) ──
// 읽기: usePlaygroundModel · useDrawnCallPhase(실행 버튼) · useDrawnTracePhase(확인 대기 그림) · usePlaygroundPhase(대화 칸) · usePlaygroundOut ·
//   usePlaygroundChat · useStoredArgs(toolId). 컴포넌트 밖은 playgroundState()
// redraw() — 화면이 들어올 때(마운트) 한 번. 옛은 메뉴에 들어오면 전체를 다시 그렸다(js/main.js:15) — 떠나 있는 동안 바뀐 phase를 칸마다 다시 맞춘다
// setModel(model) — 모델 버튼. 이미 있는 결과는 그대로, 다음 실행부터(옛 :109)
// ensureArgs(tool) — 화면 effect가 [도구, 그 도구의 저장 값]이 바뀔 때마다 부른다. 아직 채우지 않은 칸만 초기값으로 채운다(채울 것이 없으면 그대로)
// setArg(toolId, name, value) — 칸 입력 · 고르기(옛 :115,118)
// selectTool() — 도구 select 바꿈. 주소 ?tool=은 화면이 replace로 바꾸고 여기서는 결과를 비우고 idle로(옛 :117). 대화 · 모델 · 다른 도구 인자는 그대로
// clearOut() — 변환 스튜디오 "테스트 실행"이 이동 전에 부른다. 결과만 비우고 phase는 그대로(옛 js/menu/studio.js:167)
// reset() — "초기화". 모든 도구 인자 · phase · 결과 · 대화를 비우고 모델은 둔다. 요청 중이어도 막지 않는다 — 늦은 응답이 다시 결과를 쓴다(옛 :113)
// reject() — 확인 상자 "그만두기". 결과를 비우고 idle, 정보 토스트. 요청은 없다(옛 :112)
// showCall(call) — 대화 호출 칩. 그 호출을 결과로(모델 claude, 실패면 고정 문장), phase는 그대로(옛 :110)
// 실행 · 대화 요청의 상태 바꿈(begin · settle · fail)은 app/playground/usePlaygroundMutations만 부른다
import { useCallback } from 'react';
import type { CallTrace, ChatCall, ModelId, PlaygroundCallBody, PlaygroundCallResult, PlaygroundChatResult, ToolRecord } from '../../api/types';
import { PLAYGROUND } from '../../copy/playground';
import { createStore, useStore } from '../store';
import { toast } from '../toast';
import { own } from '../trace/own';
import { fillArgs, type ArgValues } from './args';

/** idle 처음 · 초기화 뒤 / running 직접 호출 중 / hold 확인 대기 / done 직접 호출 끝 / chat 대화 중 */
export type PlaygroundPhase = 'idle' | 'running' | 'hold' | 'done' | 'chat';

/**
 * 변환 과정 칸에 그릴 결과 하나 — 직접 호출 응답 · 확인 대기(보낸 인자만) · 대화 호출에서 만든다. 응답의 로그 id는 화면이 쓰지 않아 담지 않는다.
 * error는 실패 단계 문장(성공 · 확인 대기면 빈 글), result는 성공 결과(trace.aiResult가 비면 그린다). model은 1단계 라벨 · 호출 형식
 */
export type PlaygroundOut = Readonly<{
  tool: string;
  model: ModelId;
  ok: boolean;
  trace: CallTrace;
  error: string;
  result?: unknown;
}>;

/** 대화 한 줄 — 사용자 질문 · Claude 답(호출 칩) · 요청 실패(서버 문장 — 화자 "오류") */
export type ChatTurn =
  | Readonly<{ kind: 'question'; text: string }>
  | Readonly<{ kind: 'answer'; text: string; calls: readonly ChatCall[] }>
  | Readonly<{ kind: 'error'; text: string }>;

export type PlaygroundState = Readonly<{
  model: ModelId;
  /** { 도구 id: 폼 값 } — 도구를 바꾸거나 메뉴를 옮겨도 남는다 */
  args: Readonly<Record<string, ArgValues>>;
  phase: PlaygroundPhase;
  /** 칸마다 마지막으로 그린 때의 phase(머리 주석 "그린 phase") */
  drawn: Readonly<{ call: PlaygroundPhase; trace: PlaygroundPhase }>;
  out: PlaygroundOut | null;
  chat: readonly ChatTurn[];
}>;

/** 처음 고른 모델(옛 S.pg.model) */
const INITIAL_MODEL: ModelId = 'claude';
/** 대화는 늘 Claude가 부른다 — 대화 결과의 모델(옛 :100,110) */
const CHAT_MODEL: ModelId = 'claude';

const EMPTY_ARGS: PlaygroundState['args'] = Object.freeze({});
const EMPTY_CHAT: readonly ChatTurn[] = Object.freeze([]);

const store = createStore<PlaygroundState>({
  model: INITIAL_MODEL,
  args: EMPTY_ARGS,
  phase: 'idle',
  drawn: { call: 'idle', trace: 'idle' },
  out: null,
  chat: EMPTY_CHAT,
});

/** 전체 다시 그리기(옛 render) — 두 칸 모두 지금 phase로. 이미 같으면 그대로 */
const drawAll = (s: PlaygroundState): PlaygroundState =>
  s.drawn.call === s.phase && s.drawn.trace === s.phase ? s : { ...s, drawn: { call: s.phase, trace: s.phase } };

/** 변환 과정만 다시 그리기(옛 renderTrace) */
const drawTrace = (s: PlaygroundState): PlaygroundState =>
  s.drawn.trace === s.phase ? s : { ...s, drawn: { ...s.drawn, trace: s.phase } };

// ── 읽기 ──

/** 지금 상태(컴포넌트 밖 — 실행 · 대화 함수가 누른 순간의 모델 · 폼 값 · phase를 읽는다) */
export const playgroundState = (): PlaygroundState => store.get();

/** 그 도구의 저장된 폼 값(컴포넌트 밖). 아직 없으면 undefined */
export const storedArgs = (toolId: string): ArgValues | undefined => own(store.get().args, toolId);

const selectModel = (s: PlaygroundState) => s.model;
const selectPhase = (s: PlaygroundState) => s.phase;
const selectDrawnCall = (s: PlaygroundState) => s.drawn.call;
const selectDrawnTrace = (s: PlaygroundState) => s.drawn.trace;
const selectOut = (s: PlaygroundState) => s.out;
const selectChat = (s: PlaygroundState) => s.chat;

export const usePlaygroundModel = (): ModelId => useStore(store, selectModel);
/** 지금 phase — 대화 칸(입력 중 표시 · 보내기 잠금)만 본다. 실행 버튼 · 확인 대기 그림은 그린 phase를 본다 */
export const usePlaygroundPhase = (): PlaygroundPhase => useStore(store, selectPhase);
/** 도구 호출 칸이 마지막으로 그린 phase — "실행" 요청 중 잠금 · "호출하는 중…" */
export const useDrawnCallPhase = (): PlaygroundPhase => useStore(store, selectDrawnCall);
/** 변환 과정 칸이 마지막으로 그린 phase — 확인 대기 그림(hold) */
export const useDrawnTracePhase = (): PlaygroundPhase => useStore(store, selectDrawnTrace);
export const usePlaygroundOut = (): PlaygroundOut | null => useStore(store, selectOut);
export const usePlaygroundChat = (): readonly ChatTurn[] => useStore(store, selectChat);

/** 그 도구의 저장된 폼 값 — 그리는 값은 args.argValues(tool, 이 값)로 만든다(아직 채우지 않은 칸은 초기값) */
export function useStoredArgs(toolId: string): ArgValues | undefined {
  const select = useCallback((s: PlaygroundState) => own(s.args, toolId), [toolId]);
  return useStore(store, select);
}

// ── 화면이 부르는 쓰기 ──

export function redraw(): void {
  store.set(drawAll);
}

export function setModel(model: ModelId): void {
  store.set((prev) => drawAll(prev.model === model ? prev : { ...prev, model }));
}

export function ensureArgs(tool: Pick<ToolRecord, 'id' | 'params'>): void {
  store.set((prev) => {
    const filled = fillArgs(tool, own(prev.args, tool.id));
    return filled === null ? prev : { ...prev, args: { ...prev.args, [tool.id]: filled } };
  });
}

export function setArg(toolId: string, name: string, value: string): void {
  store.set((prev) => ({
    ...prev,
    args: { ...prev.args, [toolId]: { ...own(prev.args, toolId), [name]: value } },
  }));
}

export function selectTool(): void {
  store.set((prev) => drawAll({ ...prev, out: null, phase: 'idle' }));
}

/** 옛은 결과를 비우고 테스트 실행 메뉴로 가며 전체를 다시 그렸다(go('play')) */
export function clearOut(): void {
  store.set((prev) => drawAll(prev.out === null ? prev : { ...prev, out: null }));
}

export function reset(): void {
  store.set((prev) => drawAll({ ...prev, args: EMPTY_ARGS, phase: 'idle', out: null, chat: EMPTY_CHAT }));
}

export function reject(): void {
  store.set((prev) => drawAll({ ...prev, phase: 'idle', out: null }));
  toast.info(PLAYGROUND.hold.rejected);
}

/** 대화 호출 → 결과. 서버 오류 문장은 쓰지 않고 고정 문장이다(옛 그대로) */
const chatCallOut = (call: ChatCall): PlaygroundOut => ({
  tool: call.tool,
  model: CHAT_MODEL,
  ok: call.ok,
  trace: call.trace ?? {},
  error: call.ok ? '' : PLAYGROUND.chat.callFailed,
});

/** 칩은 변환 과정만 다시 그린다(renderTrace) — 그때 phase가 hold면 그 호출이 확인 대기 모양으로 그려진다 */
export function showCall(call: ChatCall): void {
  store.set((prev) => drawTrace({ ...prev, out: chatCallOut(call) }));
}

// ── 실행 · 대화 요청(app/playground/usePlaygroundMutations만 부른다) ──

/** 확인 대기 응답인가(서버가 실행하지 않고 {hold, tool}만 돌려줌) */
const isHoldResult = (result: PlaygroundCallResult): result is Extract<PlaygroundCallResult, { hold: true }> =>
  'hold' in result && result.hold;

/** 직접 호출 응답 → 결과. 모델은 응답을 처리하는 때 고른 모델이다(옛 :87-88 — 요청 중 모델을 바꿨으면 바뀐 값) */
function callOut(result: PlaygroundCallResult, body: PlaygroundCallBody, model: ModelId): PlaygroundOut {
  if (isHoldResult(result)) return { tool: body.tool, model, ok: false, trace: { args: body.args }, error: '' };
  const trace = result.trace ?? {};
  return result.ok
    ? { tool: body.tool, model, ok: true, trace, error: '', result: result.result }
    : { tool: body.tool, model, ok: false, trace, error: result.error };
}

export function beginRun(): void {
  store.set((prev) => drawAll({ ...prev, phase: 'running', out: null }));
}

/**
 * 응답이 오면 화면에 없어도 쓴다. 그사이 도구를 바꿨거나 초기화했어도 요청한 도구의 결과로 덮는다(옛 그대로).
 * 옛은 화면에 있을 때만 다시 그렸지만(:90) 떠나 있었으면 들어올 때 redraw가 다시 맞추므로 늘 전체로 둔다
 */
export function settleRun(result: PlaygroundCallResult, body: PlaygroundCallBody): void {
  store.set((prev) =>
    drawAll({ ...prev, phase: isHoldResult(result) ? 'hold' : 'done', out: callOut(result, body, prev.model) }),
  );
}

/** 요청 실패 — idle로만(결과는 시작 때 비웠다). 토스트는 부르는 쪽 */
export function failRun(): void {
  store.set((prev) => drawAll({ ...prev, phase: 'idle' }));
}

/** 대화 칸만 다시 그린다(renderChat — :95) — 실행 버튼 · 변환 과정의 그린 phase는 그대로 */
export function beginChat(question: string): void {
  store.set((prev) => ({ ...prev, phase: 'chat', chat: [...prev.chat, { kind: 'question', text: question }] }));
}

/** 답을 더하고 마지막 호출을 결과로(호출이 없으면 결과 그대로). 호출 수와 상관없이 idle. 대화 칸 + 변환 과정만 다시 그린다(:98-102) */
export function settleChat(result: PlaygroundChatResult): void {
  store.set((prev) => {
    const last = result.calls.at(-1);
    return drawTrace({
      ...prev,
      phase: 'idle',
      out: last === undefined ? prev.out : chatCallOut(last),
      chat: [...prev.chat, { kind: 'answer', text: result.answer || PLAYGROUND.chat.noAnswer, calls: result.calls }],
    });
  });
}

/** 요청 실패 — 토스트가 아니라 오류 말풍선(서버 문장 그대로)으로 남기고 idle. 대화 칸 + 변환 과정만 다시 그린다(:101-102) */
export function failChat(message: string): void {
  store.set((prev) => drawTrace({ ...prev, phase: 'idle', chat: [...prev.chat, { kind: 'error', text: message }] }));
}
