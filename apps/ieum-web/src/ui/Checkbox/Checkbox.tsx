// Checkbox — 켜고 끄는 상자 하나. 이음 .utbl input[type=checkbox](css/console.css:208) · .own input(:933) · 도구 목록 줄 인라인(js/menu/deploy.js:196)
// 상자는 브라우저 체크 상자 그대로다. label이 있으면 <label> 줄(상자 + 글자), 없으면 상자만이고 이름은 aria-label이나 쓰는 곳이 감싼 <label>이다
import { useId, type ComponentProps, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import { VisuallyHidden } from '../VisuallyHidden';
import styles from './Checkbox.module.css';

/** sm = 브라우저 기본 모양(옛이 크기 · 색을 적지 않은 도구 목록) · md = 17(표 칸) · lg = 18(승인 상자) */
export type CheckboxSize = 'sm' | 'md' | 'lg';

export type CheckboxProps = Omit<
  ComponentProps<'input'>,
  'checked' | 'defaultChecked' | 'onChange' | 'type' | 'size' | 'title' | 'children'
> & {
  /** 켬 */
  checked: boolean;
  /** 바꾸면 그 값 */
  onCheckedChange: (checked: boolean) => void;
  /** 상자 고유 치수 */
  size?: CheckboxSize;
  /** 있으면 <label> 줄 — 줄 어디를 눌러도 바뀐다. 없으면 상자만 */
  label?: ReactNode;
  /** disabled일 때 이유 — 마우스 툴팁(title) + 시각 숨김 aria-describedby */
  disabledReason?: string;
};

const joinIds = (...ids: (string | undefined)[]): string | undefined => {
  const joined = ids.filter((id): id is string => id !== undefined && id !== '').join(' ');
  return joined === '' ? undefined : joined;
};

export function Checkbox({
  checked,
  onCheckedChange,
  size = 'md',
  label,
  disabledReason,
  disabled = false,
  className,
  'aria-describedby': describedBy,
  ...rest
}: CheckboxProps) {
  const reasonId = useId();
  const hasLabel = label !== undefined;
  const reason = disabled && disabledReason !== undefined && disabledReason !== '' ? disabledReason : undefined;

  const input = (
    <input
      {...rest}
      type="checkbox"
      className={hasLabel ? styles.root : cx(styles.root, className)}
      data-size={size}
      checked={checked}
      disabled={disabled}
      title={hasLabel ? undefined : reason}
      aria-describedby={joinIds(describedBy, reason === undefined ? undefined : reasonId)}
      onChange={(event) => onCheckedChange(event.currentTarget.checked)}
    />
  );

  // 이유 글은 <label> 밖에 둔다 — 안에 두면 상자의 이름에 섞인다
  return (
    <>
      {hasLabel ? (
        <label className={cx(styles.label, className)} data-disabled={disabled ? 'true' : undefined} title={reason}>
          {input}
          {label}
        </label>
      ) : (
        input
      )}
      {reason === undefined ? null : <VisuallyHidden id={reasonId}>{reason}</VisuallyHidden>}
    </>
  );
}
