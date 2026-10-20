// 자연어 대화 — 도구 호출 상자의 대화 목록 + 질문 입력 줄(옛 PG_CHAT 갈래 · renderChat · pgSend — js/menu/playground.js:52-53,62-68,92-103).
// 서버에 대화 키가 있을 때(chatEnabled)만 그린다. 두 부품은 상자 본문에 감싸지 않고 넣는다 — 감싸면 목록이 상자의 남은 높이를 채우지 못한다.
// 말풍선: 질문(사용자) · 답(화자 "Claude" + 글 + 호출 칩 — 칩마다 한 줄) · 실패(화자 "오류" + 서버 문장) · 대화 중이면 기다림 줄.
// 호출 칩 = "{도구} ✓/✕ 변환 과정 보기" — 글리프 자리는 장식 아이콘이고 같은 글리프를 시각 숨김으로 두어 이름이 옛 글자 그대로 읽힌다.
// 칩을 누르면 그 호출을 변환 과정 칸에 그린다(phase는 그대로 — 옛 :110). 목록은 말풍선 수 · 기다림이 바뀔 때만 맨 아래로 내린다.
// 쓰다 만 질문은 입력 줄이 쥔다(모델 · 도구를 바꿔도 남고 화면을 떠나면 사라진다). 보내기는 대화 중 요청 중 잠금(Button pending)
import type { ChatCall } from '../../api/types';
import { showCall, usePlaygroundChat, usePlaygroundPhase, type ChatTurn } from '../../app/playground/store';
import { useChat } from '../../app/playground/usePlaygroundMutations';
import { PLAYGROUND } from '../../copy/playground';
import { ChatBubble, ChatInput, ChatLog, Chip, Icon, VisuallyHidden } from '@/ui';

const C = PLAYGROUND.chat;

function CallChip({ call }: { call: ChatCall }) {
  return (
    <Chip onClick={() => showCall(call)}>
      {call.tool}{' '}
      <Icon name={call.ok ? 'check' : 'close'} size="sm" />
      <VisuallyHidden>{call.ok ? C.glyph.ok : C.glyph.fail}</VisuallyHidden>
      {C.showTrace}
    </Chip>
  );
}

function TurnBubble({ turn }: { turn: ChatTurn }) {
  switch (turn.kind) {
    case 'question':
      return <ChatBubble variant="user">{turn.text}</ChatBubble>;
    case 'error':
      return (
        <ChatBubble variant="assistant" by={C.byError}>
          {turn.text}
        </ChatBubble>
      );
    case 'answer':
      return (
        <ChatBubble variant="assistant" by={C.byAssistant}>
          {turn.text}
          {turn.calls.map((call, index) => (
            // 같은 도구를 한 답에서 여러 번 부를 수 있어 순서를 키로 쓴다(바뀌지 않는 기록)
            <div key={index}>
              <CallChip call={call} />
            </div>
          ))}
        </ChatBubble>
      );
  }
}

type ChatPanelProps = Readonly<{
  /** workspace.user — 요청 본문 user */
  user: string;
}>;

export function ChatPanel({ user }: ChatPanelProps) {
  const chat = usePlaygroundChat();
  const phase = usePlaygroundPhase();
  const send = useChat();
  const isWaiting = phase === 'chat';

  return (
    <>
      <ChatLog label={C.logLabel} followKey={`${chat.length}:${isWaiting ? 'wait' : 'idle'}`}>
        {chat.map((turn, index) => (
          // 대화는 뒤에만 더해지고 초기화로만 빈다 — 순서를 키로 쓴다
          <TurnBubble key={index} turn={turn} />
        ))}
        {isWaiting ? <ChatBubble variant="typing">{C.typing}</ChatBubble> : null}
      </ChatLog>
      <ChatInput
        onSend={(text) => send(text, user)}
        pending={isWaiting}
        placeholder={C.placeholder}
        inputLabel={C.inputAria}
        sendLabel={C.sendAria}
      />
    </>
  );
}
