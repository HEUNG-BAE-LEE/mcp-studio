// 테스트 실행 쓰기 둘 — 도구 직접 호출(실행 · 확인 대기의 "실행") · 자연어 대화(옛 pgExec · pgSend — js/menu/playground.js:80-103)
// 상태 바꿈 · 토스트는 useMutation **옵션** 콜백에 둔다(mutate 호출 쪽 콜백이 아니다) — 요청 중에 메뉴를 옮겨 화면이 사라져도 응답이
// 저장소에 남고 실패 토스트가 뜬다(옛도 응답을 S.pg에 쓰고 화면에 있을 때만 다시 그렸다). 무효화는 없다 — 도구 · 원본 · 설정이 바뀌지 않는다.
// 요청 중 잠금은 쓰는 곳이 isPending이 아니라 저장소로 한다(다시 마운트하면 isPending이 사라진다): 실행 = 도구 호출 칸이 그린 phase(drawn.call)가
// 'running', 보내기 = 지금 phase 'chat'(둘 다 Button pending — 포커스가 버튼에 남는다). phase 하나를 둘이 같이 쓰므로 늦게 끝난 쪽이 덮는다(옛 그대로).
// 실행 버튼은 옛이 전체를 다시 그릴 때만 바뀌었다 — 실행 중에 대화를 보내거나 대화가 끝나도 "호출하는 중…" 잠금이 남는다(store 머리 "그린 phase")
//
// ── 쓰는 곳 계약 ──
// useRunTool() → run({ tool, user, approved }) — tool은 지금 고른 도구(주소 ?tool=), user는 workspace.user.
//   "실행"은 approved false, 확인 상자 "실행"은 true. 누른 순간의 폼 값 · 모델을 읽는다 — 확인 상자에 보인 인자 · 그때 모델이 아니라
//   지금 폼 값 · 지금 모델이다(옛 :82-86,111 그대로). 인자 변환이 틀리면 요청 없이 경고 토스트(phase 그대로). 실행 버튼이 잠긴 그림(drawn.call running)이면 무시
//   시작: 결과 비움 · running. 성공: 확인 대기면 hold + 보낸 인자만 결과로, 아니면 done + 응답(ok:false도 결과 — 실패 단계로 그린다).
//   실패(봉투 · 네트워크): idle + 경고 토스트(서버 문장 그대로)
// useChat() → send(text, user) — ChatInput onSend가 준 글(앞뒤 공백을 지운 글). 빈 글이거나 대화 중(chat)이면 무시.
//   시작: 질문 말풍선 · chat. 성공: 답 말풍선(호출 칩) · 마지막 호출을 결과로 · idle. 실패: 오류 말풍선(토스트 아님) · idle
import { useMutation } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '../../api/client';
import type {
  PlaygroundCallBody,
  PlaygroundCallResult,
  PlaygroundChatBody,
  PlaygroundChatResult,
  ToolRecord,
} from '../../api/types';
import { toast } from '../toast';
import { argValues, coerceArgs } from './args';
import {
  beginChat,
  beginRun,
  ensureArgs,
  failChat,
  failRun,
  playgroundState,
  settleChat,
  settleRun,
  storedArgs,
} from './store';

const CALL_PATH = '/playground/call/';
const CHAT_PATH = '/playground/chat/';

export type RunRequest = Readonly<{
  /** 지금 고른 도구 — 폼 값은 이 도구 id로 저장소에서 읽는다 */
  tool: Pick<ToolRecord, 'id' | 'params'>;
  /** workspace.user — 머리의 "호출 사용자"와 같은 값 */
  user: string;
  /** 확인 상자 "실행"이면 true */
  approved: boolean;
}>;

/**
 * 누른 순간의 요청 본문. 보내지 않을 때는 null — 실행 버튼이 잠긴 그림이거나(옛은 disabled라 눌리지 않았다), 인자 변환이 틀렸을 때(경고 토스트를 여기서 띄운다).
 * 옛 pgCoerce처럼 빈 칸을 초기값으로 먼저 채운다(pgArgs)
 */
export function prepareRun({ tool, user, approved }: RunRequest): PlaygroundCallBody | null {
  if (playgroundState().drawn.call === 'running') return null;
  ensureArgs(tool);
  const coerced = coerceArgs(tool, argValues(tool, storedArgs(tool.id)));
  if (!coerced.ok) {
    toast.warn(coerced.message);
    return null;
  }
  return { tool: tool.id, args: coerced.args, model: playgroundState().model, approved, user };
}

/** 대화 요청 본문. 빈 글이거나 대화 중이면 null(옛 :93 — 입력은 ChatInput이 이미 비웠다) */
export function prepareChat(text: string, user: string): PlaygroundChatBody | null {
  const message = text.trim();
  if (message === '' || playgroundState().phase === 'chat') return null;
  return { message, user };
}

export function useRunTool(): (request: RunRequest) => void {
  const { mutate } = useMutation({
    mutationFn: (body: PlaygroundCallBody) => api.post<PlaygroundCallResult>(CALL_PATH, body),
    onMutate: () => {
      beginRun();
    },
    onSuccess: (result, body) => {
      settleRun(result, body);
    },
    onError: (error) => {
      failRun();
      toast.warn(error.message);
    },
  });

  return useCallback(
    (request: RunRequest) => {
      const body = prepareRun(request);
      if (body !== null) mutate(body);
    },
    [mutate],
  );
}

export function useChat(): (text: string, user: string) => void {
  const { mutate } = useMutation({
    mutationFn: (body: PlaygroundChatBody) => api.post<PlaygroundChatResult>(CHAT_PATH, body),
    onMutate: ({ message }) => {
      beginChat(message);
    },
    onSuccess: (result) => {
      settleChat(result);
    },
    onError: (error) => {
      failChat(error.message);
    },
  });

  return useCallback(
    (text: string, user: string) => {
      const body = prepareChat(text, user);
      if (body !== null) mutate(body);
    },
    [mutate],
  );
}
