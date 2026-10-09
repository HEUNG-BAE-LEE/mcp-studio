// 카탈로그 ChatLog 절 — 말풍선 여덟(처음부터 스크롤이 보이게) + "하나 더" · "기다림" · "마지막 글만 고치기" · 빈 목록.
// followKey는 말풍선 수 + 기다림 여부로 만든다(쓰는 곳도 그렇게 만든다) — 바뀌면 맨 아래로 내려가고, 마지막 글만 고치면 그대로다.
// 760 이하 최대 높이 420은 폭 전환으로 본다. 스크롤 상자는 Tab으로 닿으면 안쪽 링이 보인다
import { useState } from 'react';
import { Box, Button, ChatBubble, ChatLog } from '../../ui';
import { ChatCallChip } from './ChatCallChip';
import catalog from './catalog.module.css';

const LABEL = '대화';
const BOX_TITLE = '도구 호출';
const BY_ANSWER = 'Claude';
const BY_ERROR = '오류';

const noop = (): void => undefined;

type Call = Readonly<{ tool: string; isOk: boolean }>;

type Turn = Readonly<{
  id: number;
  role: 'user' | 'assistant';
  text: string;
  isError?: boolean;
  calls?: readonly Call[];
}>;

const SEED: readonly Turn[] = [
  { id: 1, role: 'user', text: '홍길동 사원의 부서를 알려 줘.' },
  { id: 2, role: 'assistant', text: '홍길동 사원은 구매관리팀 소속입니다.', calls: [{ tool: 'search_employee', isOk: true }] },
  { id: 3, role: 'user', text: '그 부서의 이번 달 발주 건수는?' },
  { id: 4, role: 'assistant', text: '원본 시스템이 응답하지 않습니다.', isError: true },
  { id: 5, role: 'user', text: '다시 조회해 줘.' },
  {
    id: 6,
    role: 'assistant',
    text: '이번 달 발주를 조회했습니다.',
    calls: [
      { tool: 'list_purchase_orders', isOk: true },
      { tool: 'get_vendor', isOk: false },
    ],
  },
  { id: 7, role: 'user', text: '발주 건수를 부서별로 나눠 줘.' },
  { id: 8, role: 'assistant', text: '부서별로 집계했습니다.', calls: [{ tool: 'group_orders_by_department', isOk: true }] },
];

/** 하나 더 — 번호가 홀수면 사용자, 짝수면 도우미 */
const nextTurn = (turns: readonly Turn[]): Turn => {
  const id = turns.length + 1;
  return id % 2 === 1
    ? { id, role: 'user', text: `추가 질문 ${id}` }
    : { id, role: 'assistant', text: `추가 답변 ${id}`, calls: [{ tool: 'search_employee', isOk: true }] };
};

function TurnBubble({ turn, editCount }: { turn: Turn; editCount: number }) {
  const text = editCount > 0 ? `${turn.text} (고침 ${editCount})` : turn.text;
  if (turn.role === 'user') return <ChatBubble variant="user">{text}</ChatBubble>;
  return (
    <ChatBubble variant="assistant" by={turn.isError ? BY_ERROR : BY_ANSWER}>
      {text}
      {(turn.calls ?? []).map((call) => (
        <div key={call.tool}>
          <ChatCallChip tool={call.tool} isOk={call.isOk} onPress={noop} />
        </div>
      ))}
    </ChatBubble>
  );
}

function FollowDemo() {
  const [turns, setTurns] = useState<readonly Turn[]>(SEED);
  const [isTyping, setIsTyping] = useState(false);
  const [editCount, setEditCount] = useState(0);
  const lastId = turns[turns.length - 1]?.id;

  return (
    <div className={catalog.stack}>
      <div className={catalog.row}>
        <Button size="sm" onClick={() => setTurns((current) => [...current, nextTurn(current)])}>
          하나 더
        </Button>
        <Button size="sm" aria-pressed={isTyping} onClick={() => setIsTyping((value) => !value)}>
          {isTyping ? '기다림 줄 끄기' : '기다림 줄 켜기'}
        </Button>
        <Button size="sm" onClick={() => setEditCount((value) => value + 1)}>
          마지막 글만 고치기(followKey 그대로)
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setTurns(SEED);
            setIsTyping(false);
            setEditCount(0);
          }}
        >
          처음으로
        </Button>
      </div>
      <Box title={BOX_TITLE}>
        <ChatLog label={`${LABEL} — 말풍선`} followKey={`${turns.length}:${isTyping}`}>
          {turns.map((turn) => (
            <TurnBubble key={turn.id} turn={turn} editCount={turn.id === lastId ? editCount : 0} />
          ))}
          {isTyping ? <ChatBubble variant="typing">도구를 호출하는 중</ChatBubble> : null}
        </ChatLog>
      </Box>
    </div>
  );
}

export function ChatLogSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        대화 말풍선을 세로로 쌓는 스크롤 목록. 말풍선 사이 --s-3 · 안쪽 --s-4 · 높이 최소 300 ~ 최대 540(고유 치수)이고 넘치면 상자 안 스크롤이다.
        followKey가 바뀔 때(처음 그림 포함)만 맨 아래로 즉시 내린다 — 위로 올려 두고 마지막 글만 고치면 제자리에 머문다. aria-live="polite"라 새
        말풍선 · 기다림 줄이 읽히고, role="region" + tabindex=0 + 이름(쓰는 곳이 "대화"를 준다)이라 Tab으로 닿으면 안쪽 링이 보인다. 760 이하에서
        최대 높이가 420이다.
      </p>
      <h3 className={catalog.heading}>말풍선 여덟 — 스크롤 · followKey</h3>
      <FollowDemo />
      <h3 className={catalog.heading}>빈 목록 — 빈 자리만 남는다</h3>
      <Box title={BOX_TITLE}>
        <ChatLog label={`${LABEL} — 빈 목록`} followKey={0}>
          {null}
        </ChatLog>
      </Box>
    </div>
  );
}
