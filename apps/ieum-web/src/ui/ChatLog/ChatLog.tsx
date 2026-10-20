// ChatLog — 대화 말풍선을 세로로 쌓는 스크롤 목록. 이음 .msgs(css/console.css:739, 760 :907) · 쓰는 곳 js/menu/playground.js:52,62-67
// 스크롤 상자는 role="region" + tabindex=0 + 이름 + 안쪽 링이다(옛은 tabindex가 없었다 — DESIGN 이식 기간 고침). 이름이 붙도록 role="region"(보이지 않는 ARIA 보강).
// aria-live="polite"라 새 말풍선 · 기다림 줄이 읽힌다(옛 그대로). 맨 아래로는 followKey가 바뀔 때만 내린다 — 다시 그려진다고 내리지 않는다
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './ChatLog.module.css';

export type ChatLogProps = {
  /** 목록 이름(aria-label) — 쓰는 곳 copy/ */
  label: string;
  /** 바뀔 때마다(처음 그림 포함) 목록을 맨 아래로 즉시 내린다 — 쓰는 곳이 말풍선 수 · 기다림 여부로 만든다 */
  followKey: string | number;
  /** ChatBubble들 — 위에서 아래로. 비어 있으면 빈 자리만 남는다(빈 상태 글 없음 — 옛 그대로) */
  children: ReactNode;
};

export function ChatLog({ label, followKey, children }: ChatLogProps) {
  const boxRef = useRef<HTMLDivElement>(null);

  // 처음 그림도 한 번 돈다 — 이미 쌓인 대화가 있는 채로 열려도 맨 아래에서 시작한다
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (box !== null) box.scrollTop = box.scrollHeight;
  }, [followKey]);

  return (
    <div
      ref={boxRef}
      className={styles.root}
      role="region"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- 스크롤 상자는 키보드로 스크롤하도록 tabindex=0 + 이름(DESIGN 핵심 규칙 12 · 접근성 키보드)
      tabIndex={0}
      aria-label={label}
      aria-live="polite"
    >
      {children}
    </div>
  );
}
