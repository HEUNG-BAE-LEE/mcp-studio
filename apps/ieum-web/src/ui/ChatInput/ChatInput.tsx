// ChatInput — 대화 질문 입력 줄. 이음 .ask(css/console.css:750-752) · 입력 + 보내기 js/menu/playground.js:53 · Enter js/main.js:56 · 보내기 js/menu/playground.js:92-94
// 입력 글자는 부품이 쥔다(제어 값이 아니다 — TagInput과 같다). 보낼 때 입력칸 값을 읽어 앞뒤 공백을 지우고, 빈 글이거나 요청 중이면 아무것도 하지 않는다(입력칸 글도 그대로).
// 보내면 입력칸을 먼저 비우고 onSend를 부른다(옛 순서). 한글 조합 중 Enter는 무시한다(ui/lib/ime).
// 보내기는 Button xl이다 — 요청 중 잠금(pending)은 Button이 맡아 누름을 무시하고 포커스를 버튼에 남긴다. 입력칸은 잠그지 않는다(옛 그대로 — 다음 질문을 쓸 수 있다)
import { useRef, type KeyboardEvent } from 'react';
import { Button } from '../Button';
import { cx } from '../lib/cx';
import { isImeComposing } from '../lib/ime';
import styles from './ChatInput.module.css';

export type ChatInputProps = {
  /** 보낸 질문 — 앞뒤 공백을 지운 글. 빈 글이거나 pending이면 부르지 않고 입력칸 글도 그대로 둔다 */
  onSend: (text: string) => void;
  /** 대화 요청 중 — 보내기를 요청 중 잠금(Button pending)으로 두고 Enter도 무시한다. 입력칸은 잠그지 않는다 */
  pending: boolean;
  /** 입력칸 자리표시 — 글자는 쓰는 곳 copy/ */
  placeholder: string;
  /** 입력칸 이름(aria-label) */
  inputLabel: string;
  /** 보내기 버튼 이름(aria-label) — 버튼에는 아이콘만 있다 */
  sendLabel: string;
  /** 배치만 */
  className?: string;
};

export function ChatInput({ onSend, pending, placeholder, inputLabel, sendLabel, className }: ChatInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Enter와 보내기 누름이 같이 쓴다. 포커스는 옮기지 않는다 — Enter면 입력칸에, 누름이면 보내기에 남는다
  const send = () => {
    const input = inputRef.current;
    if (input === null || pending) return;
    const text = input.value.trim();
    if (text === '') return;
    input.value = '';
    onSend(text);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || isImeComposing(event)) return;
    event.preventDefault();
    send();
  };

  return (
    <div className={cx(styles.root, className)}>
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        placeholder={placeholder}
        aria-label={inputLabel}
        onKeyDown={handleKeyDown}
      />
      <Button variant="primary" size="xl" icon="send" aria-label={sendLabel} pending={pending} onClick={send} />
    </div>
  );
}
