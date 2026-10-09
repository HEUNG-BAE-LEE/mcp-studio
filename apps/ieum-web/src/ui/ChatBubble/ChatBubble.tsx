// ChatBubble — 대화 목록의 말풍선 하나. 이음 .msg · .msg.u · .msg.a · .msg.typing(css/console.css:740-747) · 쓰는 곳 js/menu/playground.js:64-66
// user = 사용자 질문(오른쪽 · 주조 바탕), assistant = 도우미 답 · 오류(왼쪽 · 화자 줄 + 글 + 호출 칩), typing = 답을 기다리는 줄(assistant 모양 + 점 셋).
// 좌우로 붙는 것은 align-self라 ChatLog의 세로 흐름 안에서만 맞는다. 새 말풍선을 읽어 주는 것은 ChatLog의 aria-live다
import type { ReactNode } from 'react';
import styles from './ChatBubble.module.css';

export type ChatBubbleVariant = 'user' | 'assistant' | 'typing';

/** 점 셋 — 깜빡임의 시차는 CSS가 순서로 정한다 */
const TYPING_DOT_COUNT = 3;
const TYPING_DOTS: readonly number[] = Array.from({ length: TYPING_DOT_COUNT }, (_, index) => index);

type ChatBubbleBaseProps = {
  /** 글. assistant의 호출 칩은 글 뒤에 칩마다 한 줄로 쓰는 곳이 놓는다(Chip) */
  children: ReactNode;
};

export type ChatBubbleProps = ChatBubbleBaseProps &
  (
    | {
        variant: 'user' | 'typing';
        by?: never;
      }
    | {
        variant: 'assistant';
        /** 위 작은 화자 줄 — 쓰는 곳 copy/(답 · 오류) */
        by?: ReactNode;
      }
  );

export function ChatBubble({ variant, by, children }: ChatBubbleProps) {
  return (
    <div className={styles.root} data-variant={variant}>
      {by !== undefined ? <span className={styles.by}>{by}</span> : null}
      {children}
      {variant === 'typing' ? (
        // 점은 장식이다 — 기다림은 글자가 전한다
        <span className={styles.dots} aria-hidden="true">
          {TYPING_DOTS.map((index) => (
            <i key={index} className={styles.dot} />
          ))}
        </span>
      ) : null}
    </div>
  );
}
