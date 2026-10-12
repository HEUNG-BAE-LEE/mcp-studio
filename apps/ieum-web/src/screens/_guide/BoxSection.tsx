// 카탈로그 Box 절 — 제목 · 제목 + 보조 글 + 동작 · 제목 없음 · padded 켬/끔 · 정책 상자(policy) · 이름 붙은 상자(label) ·
// 대화 상자(chat — 머리 두 줄 · 최소 높이 660, 1100 이하 해제) · 머리가 좁아 접히는 모양(폭 전환으로 본다)
import { useState } from 'react';
import { Box, Button, ChatBubble, ChatInput, ChatLog, Icon, SegmentedRadio, type SegmentedItem } from '../../ui';
import { ChatCallChip } from './ChatCallChip';
import catalog from './catalog.module.css';
import styles from './BoxSection.module.css';

// 서버 모델 목록 순서(app/ieum/data/playground/models.json)
const MODELS: readonly SegmentedItem[] = [
  { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'gpt', label: 'GPT' },
  { value: 'mcp', label: '사내 Agent' },
];

// 대화 상자 예시의 처음 대화 — 보낸 질문은 아래에 사용자 말풍선으로 더해진다(카탈로그 흉내 — 답은 오지 않는다)
const SEED_QUESTION = '홍길동 사원의 부서를 알려 줘.';
const SEED_ANSWER = '홍길동 사원은 구매관리팀 소속입니다.';
const noop = (): void => undefined;

function ChatBody() {
  const [questions, setQuestions] = useState<readonly string[]>([]);
  return (
    <>
      <div className={styles.chatForm}>폼 칸 자리 — 도구 · 인자 · 실행(쓰는 곳)</div>
      <ChatLog label="대화" followKey={questions.length}>
        <ChatBubble variant="user">{SEED_QUESTION}</ChatBubble>
        <ChatBubble variant="assistant" by="Claude">
          {SEED_ANSWER}
          <div>
            <ChatCallChip tool="search_employee" isOk onPress={noop} />
          </div>
        </ChatBubble>
        {questions.map((question, index) => (
          // 같은 글을 두 번 보낼 수 있어 순서를 키로 쓴다(지우지 않는 기록)
          <ChatBubble key={index} variant="user">
            {question}
          </ChatBubble>
        ))}
      </ChatLog>
      <ChatInput
        onSend={(text) => setQuestions((prev) => [...prev, text])}
        pending={false}
        placeholder="자연어로 질문하면 Claude가 도구를 골라 실행합니다"
        inputLabel="질문 입력"
        sendLabel="보내기"
      />
    </>
  );
}

export function BoxSection() {
  const [model, setModel] = useState('claude');
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        1px --line-control 테두리 · --surface · 그림자 없음. 제목(h3)이 있어야 머리 줄을 그린다. padded를 끄면 내용이 자기
        여백을 가진다(구조도 · 차트). 머리는 좁으면 제목 아래로 동작이 접힌다. policy는 정책 상자 — 본문을 늘 감싸고 안쪽이
        padded보다 작다(위 14 · 좌우 16 · 아래 16). label은 상자 이름(section aria-label)이다.
      </p>
      <div className={styles.demo}>
        <h3 className={catalog.heading}>제목만 · padded</h3>
        <Box title="확인이 필요한 항목" padded>
          본문 — padded가 안쪽 여백을 준다.
        </Box>
        <h3 className={catalog.heading}>제목 + description + actions · padded</h3>
        <Box
          title="시간대별 호출"
          description="최근 24시간"
          actions={
            <Button size="sm" icon="refresh">
              새로 받기
            </Button>
          }
          padded
        >
          본문
        </Box>
        <h3 className={catalog.heading}>padded 끔 — 본문이 자기 여백을 가짐</h3>
        <Box title="구조도" description="2건">
          <div className={styles.fill}>여백 없는 자리 — 내용이 가장자리까지 간다</div>
        </Box>
        <h3 className={catalog.heading}>제목 없음 — 머리 줄 없음</h3>
        <Box padded>배포 정책 요약처럼 머리가 없는 상자.</Box>
        <h3 className={catalog.heading}>policy — 제목 + 정책 안쪽 여백</h3>
        <Box title="실행 정책" variant="policy">
          정책 상자 본문 — 안쪽이 padded보다 작다.
        </Box>
        <h3 className={catalog.heading}>policy — 제목 없음(배포 보안 정책 요약)</h3>
        <Box variant="policy">머리가 없는 정책 상자 본문.</Box>
        <h3 className={catalog.heading}>label — 이름 붙은 상자(테스트 실행 변환 과정)</h3>
        <Box title="변환 과정" description="search_employee, 인사 시스템" label="변환 과정">
          <div className={styles.fill}>변환 과정 단계 자리</div>
        </Box>
        <h3 className={catalog.heading}>chat — 머리 두 줄 · 세로 흐름 · 최소 높이 660(1100 이하 해제)</h3>
        <p className={catalog.note}>
          첫 줄은 제목 + actions(접지 않음), 둘째 줄 headBelow는 머리 폭으로 늘어난다(묶음 테두리가 머리 폭을 채우고 항목은
          왼쪽). 본문은 감싸지 않는다 — 폼 칸 · 대화 목록(ChatLog — 남은 높이를 채움) · 입력 줄(ChatInput)을 쓰는 곳이 차례로 넣는다.
          아래 폼 칸은 자리표시이고(쓰는 곳 화면 몫), 그 윗선은 쓰는 곳이 그려 머리 아랫선과 겹쳐 2px로 보인다(옛 그대로). 질문을 보내면
          대화 목록 아래에 사용자 말풍선이 더해지고 맨 아래로 내려간다.
        </p>
        <Box
          variant="chat"
          label="도구 호출"
          title="도구 호출"
          actions={
            <span className={styles.ctx}>
              <Icon name="user" size="sm" className={styles.ctxIcon} />
              호출 사용자 관리자
            </span>
          }
          headBelow={<SegmentedRadio label="AI 모델" items={MODELS} value={model} onValueChange={setModel} />}
        >
          <ChatBody />
        </Box>
      </div>
    </div>
  );
}
