// Input — 이음 .inp(css/console.css:307-309) · .inp.mono(:488). 폼의 한 줄 입력. 입력할 때마다 바로 onValueChange를 부른다
import type { ComponentProps } from 'react';
import { cx } from '../lib/cx';
import styles from './Input.module.css';

export type InputType = 'text' | 'password';

export type InputProps = Omit<ComponentProps<'input'>, 'onChange' | 'size' | 'type' | 'value' | 'defaultValue'> & {
  value: string;
  /** 입력할 때마다 바로 */
  onValueChange: (value: string) => void;
  /** password면 autocomplete="new-password"를 함께 넣는다(브라우저가 저장된 비밀번호를 채우지 않게) */
  type?: InputType;
  /** 고정폭 글꼴 — 서버 주소 · 키 이름 · 토큰 URL */
  mono?: boolean;
};

export function Input({ value, onValueChange, type = 'text', mono = false, className, ...rest }: InputProps) {
  return (
    <input
      {...rest}
      type={type}
      autoComplete={type === 'password' ? 'new-password' : rest.autoComplete}
      value={value}
      onChange={(event) => onValueChange(event.currentTarget.value)}
      className={cx(styles.root, className)}
      data-mono={mono ? 'true' : undefined}
    />
  );
}
