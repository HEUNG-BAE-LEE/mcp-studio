// 카탈로그 ChatInput 절 — 기본(보내면 잠깐 요청 중이 되는 흉내 + 보낸 글 기록) · 요청 중 고정(pending). 옛 글자 그대로(테스트 실행 js/menu/playground.js:53)
// 확인: Enter · 보내기 누름으로 보낸다 · 앞뒤 공백을 지운 글이 찍힌다 · 빈 글은 보내지 않고 입력칸도 그대로 · 한글 조합 중 Enter는 무시한다(조합을 끝내는 키) ·
// 요청 중에는 Enter · 누름을 무시하고 입력칸 글이 그대로 남는다 · 입력칸은 요청 중에도 쓸 수 있다.
// 포커스: Enter로 보내면 입력칸에, 보내기를 누르면 보내기에 남는다 — 잠긴 동안에도(pending은 native disabled가 아니다)
import { useEffect, useState } from 'react';
import { ChatInput } from '../../ui';
import catalog from './catalog.module.css';
import styles from './ChatInputSection.module.css';

// 기본 예시의 요청 시간(대화 요청 하나를 흉내 낸다)
const FAKE_REQUEST_MS = 1500;

const PLACEHOLDER = '자연어로 질문하면 Claude가 도구를 골라 실행합니다';
const INPUT_LABEL = '질문 입력';
const SEND_LABEL = '보내기';

function SendingDemo() {
  const [sent, setSent] = useState<readonly string[]>([]);
  const [isPending, setPending] = useState(false);
  useEffect(() => {
    if (!isPending) return;
    const timer = window.setTimeout(() => setPending(false), FAKE_REQUEST_MS);
    return () => window.clearTimeout(timer);
  }, [isPending]);
  const handleSend = (text: string) => {
    setSent((prev) => [...prev, text]);
    setPending(true);
  };
  return (
    <>
      <div className={styles.well}>
        <ChatInput
          onSend={handleSend}
          pending={isPending}
          placeholder={PLACEHOLDER}
          inputLabel={INPUT_LABEL}
          sendLabel={SEND_LABEL}
        />
      </div>
      <p className={catalog.note}>
        {isPending ? '요청 중(pending) — 보내기 잠김' : '대기'} · 보낸 글 {sent.length}개
      </p>
      {sent.length > 0 ? (
        <ol className={styles.sent}>
          {sent.map((text, index) => (
            // 같은 글을 두 번 보낼 수 있어 순서를 키로 쓴다(지우지 않는 기록)
            <li key={index}>
              <code>{JSON.stringify(text)}</code>
            </li>
          ))}
        </ol>
      ) : null}
    </>
  );
}

export function ChatInputSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        이음 .ask — 대화 상자의 아래 줄. 입력칸(남은 폭 · --h-xl)과 보내기(Button primary xl — 아이콘만)가 가로로 놓이고, 줄이 안쪽 여백을 가진다.
        입력 글자는 부품이 쥐고, 보내면 입력칸을 비운 뒤 앞뒤 공백을 지운 글을 넘긴다. 한글 조합 중 Enter는 무시한다. 요청 중에는 보내기가 잠기고
        Enter도 무시하지만 입력칸은 쓸 수 있다. 점선 상자는 대화 상자 자리를 보이는 카탈로그 테두리다.
      </p>
      <h3 className={catalog.heading}>기본 — 보내면 잠깐 요청 중이 된다(흉내)</h3>
      <SendingDemo />
      <h3 className={catalog.heading}>pending — 요청 중 고정</h3>
      <div className={styles.well}>
        <ChatInput
          onSend={() => undefined}
          pending
          placeholder={PLACEHOLDER}
          inputLabel={INPUT_LABEL}
          sendLabel={SEND_LABEL}
        />
      </div>
    </div>
  );
}
