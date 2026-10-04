// 여러 값 입력 — Input xl(Field 안 높이 단계)에 적고 Enter(IME 조합 중 제외)로 하나씩 더한다 · 아래 줄에 Tag(✕ 삭제). 라벨 · 칸은 Field(gap 6)
import { forwardRef, type KeyboardEvent } from 'react';
import { Input, type InputProps } from '../Input';
import { isImeComposing } from '../lib/ime';
import { Tag } from '../Tag';
import styles from './TagInput.module.css';

export type TagInputProps = Omit<InputProps, 'size' | 'value' | 'onChange' | 'trailing'> & {
  /** 더한 값(순서 그대로 Tag로 그린다) */
  values: readonly string[];
  /** 적는 중인 글(제어) */
  inputValue: string;
  onInputValueChange: (text: string) => void;
  /** Enter — 앞뒤 공백을 뗀 값. 빈 값이면 부르지 않는다. 중복 거르기 · 입력 비우기는 호출자 몫 */
  onAdd: (value: string) => void;
  /** Tag ✕(`{값} 삭제`) */
  onRemove: (value: string) => void;
};

/** 조각 둘(입력 + 값 줄)을 돌려준다 — Field 안에 두면 라벨 · 입력 · 값 줄 · 검증 문구가 gap 6으로 쌓인다 */
export const TagInput = forwardRef<HTMLInputElement, TagInputProps>(function TagInput(
  { values, inputValue, onInputValueChange, onAdd, onRemove, onKeyDown, ...rest },
  ref,
) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || e.key !== 'Enter') return;
    if (isImeComposing(e)) return;
    // 빈 값이어도 막는다 — 안 막으면 감싼 폼이 Enter로 제출된다
    e.preventDefault();
    const value = inputValue.trim();
    if (value !== '') onAdd(value);
  };
  return (
    <>
      <Input
        {...rest}
        ref={ref}
        size="xl"
        value={inputValue}
        onChange={(e) => onInputValueChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {values.length > 0 ? (
        <div className={styles.values}>
          {values.map((value) => (
            <Tag key={value} onRemove={() => onRemove(value)}>
              {value}
            </Tag>
          ))}
        </div>
      ) : null}
    </>
  );
});
