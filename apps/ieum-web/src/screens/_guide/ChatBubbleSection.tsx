// 카탈로그 ChatBubble 절 — user · assistant(화자 + 글 + 호출 칩 줄 둘) · assistant 오류 · "(답변 없음)" · 긴 낱말 접힘 · typing.
// 말풍선은 ChatLog 안에서만 좌우로 붙으므로 이 절은 같은 세로 흐름의 점선 틀에 늘어놓는다
import { ChatBubble } from '../../ui';
import { ChatCallChip } from './ChatCallChip';
import catalog from './catalog.module.css';
import styles from './ChatBubbleSection.module.css';

const BY_ANSWER = 'Claude';
const BY_ERROR = '오류';
const NO_ANSWER = '(답변 없음)';
const LONG_WORD = 'ORD-2026-10-09-ACME-KOREA-0001-APPROVAL-HISTORY-by_vendor_and_period-2026Q3-2026Q4';

const noop = (): void => undefined;

/** 말풍선 안 호출 칩 — 칩마다 한 줄이다(쓰는 곳이 블록으로 감싼다, 칩 사이 간격 없음) */
function CallChipLine({ tool, isOk }: { tool: string; isOk: boolean }) {
  return (
    <div>
      <ChatCallChip tool={tool} isOk={isOk} onPress={noop} />
    </div>
  );
}

export function ChatBubbleSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        대화 목록의 말풍선 하나. 최대 폭 88% · --r-bubble이고 낱말 단위로 접되 긴 낱말은 아무 곳에서나 접는다. user는 오른쪽 · --primary 바탕 ·
        --on-fill 글자 · 오른쪽 아래 모서리만 작고, assistant는 왼쪽 · --surface-sub 바탕 · 1px --line-divider · 왼쪽 아래 모서리만 작다. typing은
        assistant 모양에 글자 --text-muted · --fs-ui-sm + 점 셋(--m-blink 반복 · --m-stagger 시차 — 모션 줄이기를 켜면 멈춘 점)이다. 점은 장식이다.
      </p>
      <h3 className={catalog.heading}>user · assistant(호출 칩 줄 둘) · typing</h3>
      <div className={styles.stage}>
        <ChatBubble variant="user">홍길동 사원의 부서와 이번 달 발주 건수를 알려 줘.</ChatBubble>
        <ChatBubble variant="assistant" by={BY_ANSWER}>
          홍길동 사원은 구매관리팀 소속이고 이번 달 발주는 12건입니다.
          <CallChipLine tool="search_employee" isOk />
          <CallChipLine tool="list_purchase_orders" isOk={false} />
        </ChatBubble>
        <ChatBubble variant="typing">도구를 호출하는 중</ChatBubble>
      </div>
      <h3 className={catalog.heading}>assistant 오류 · 답변 없음</h3>
      <div className={styles.stage}>
        <ChatBubble variant="assistant" by={BY_ERROR}>
          원본 시스템이 응답하지 않습니다. (연결 시간 초과)
        </ChatBubble>
        <ChatBubble variant="assistant" by={BY_ANSWER}>
          {NO_ANSWER}
        </ChatBubble>
      </div>
      <h3 className={catalog.heading}>긴 낱말 접힘</h3>
      <div className={styles.stage}>
        <ChatBubble variant="user">{LONG_WORD}</ChatBubble>
        <ChatBubble variant="assistant" by={BY_ANSWER}>
          {LONG_WORD}
        </ChatBubble>
      </div>
    </div>
  );
}
