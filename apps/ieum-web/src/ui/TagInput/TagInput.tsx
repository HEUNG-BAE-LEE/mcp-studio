// TagInput — 단어를 위험색 알약 칩으로 늘어놓고 끝 입력칸에서 Enter로 더한다. 이음 .bans(css/console.css:924-928) · 더하기 js/main.js:57 · 빼기 js/menu/discovery.js:405
// 입력 글자는 부품이 쥔다(제어 값이 아니다 — 입력칸 값을 Enter 때 직접 읽고 비운다). Enter는 더했든(새 단어) 안 더했든(빈 값 · 이미 있는 값) 입력칸을 비우고 포커스를 입력칸에 둔다.
// 한글 조합 중 Enter는 무시한다(ui/lib/ime). 칩을 빼도 포커스는 입력칸으로 간다 — 옛은 다시 그리기로 포커스를 잃었다
import { useRef, type KeyboardEvent } from 'react';
import { Icon } from '../icons/Icon';
import { cx } from '../lib/cx';
import { isImeComposing } from '../lib/ime';
import styles from './TagInput.module.css';

export type TagInputProps = {
  /** 단어 — 순서대로 칩 */
  values: readonly string[];
  /** Enter로 더한 단어(앞뒤 공백을 지운 값). 빈 값 · 이미 있는 값이면 부르지 않는다 */
  onAdd: (value: string) => void;
  /** 칩 빼기 버튼을 누른 단어 */
  onRemove: (value: string) => void;
  /** 빼기 버튼 이름(aria-label) — 틀은 쓰는 곳 copy/ */
  removeLabel: (value: string) => string;
  /** 입력칸 이름(aria-label) */
  inputLabel: string;
  /** 입력칸 자리표시 */
  placeholder?: string;
  /** 배치(바깥 여백)만 */
  className?: string;
};

export function TagInput({
  values,
  onAdd,
  onRemove,
  removeLabel,
  inputLabel,
  placeholder,
  className,
}: TagInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || isImeComposing(event)) return;
    event.preventDefault();
    const input = event.currentTarget;
    const word = input.value.trim();
    if (word !== '' && !values.includes(word)) onAdd(word);
    input.value = '';
  };

  const handleRemove = (value: string) => {
    onRemove(value);
    inputRef.current?.focus();
  };

  return (
    <div className={cx(styles.root, className)}>
      {values.map((value) => (
        <span key={value} className={styles.chip}>
          <span className={styles.word} title={value}>
            {value}
          </span>
          <button type="button" className={styles.remove} aria-label={removeLabel(value)} onClick={() => handleRemove(value)}>
            <Icon name="close" size="xs" stroke="bold" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        placeholder={placeholder}
        aria-label={inputLabel}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
