// Textarea — 이음 textarea.inp(css/console.css:837,1078). 폼의 여러 줄 입력, 늘 고정폭 · 세로로만 늘인다
import type { ComponentProps } from 'react';
import { cx } from '../lib/cx';
import styles from './Textarea.module.css';

export type TextareaProps = Omit<ComponentProps<'textarea'>, 'onChange' | 'value' | 'defaultValue'> & {
  value: string;
  /** 입력할 때마다 바로 */
  onValueChange: (value: string) => void;
};

export function Textarea({ value, onValueChange, className, ...rest }: TextareaProps) {
  return (
    <textarea
      {...rest}
      value={value}
      onChange={(event) => onValueChange(event.currentTarget.value)}
      className={cx(styles.root, className)}
    />
  );
}
