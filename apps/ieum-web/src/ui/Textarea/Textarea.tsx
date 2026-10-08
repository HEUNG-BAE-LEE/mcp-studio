// Textarea — 폼의 여러 줄 입력, 세로로만 늘인다. 이음 textarea.inp(code — css/console.css:837,1078) · .desc-ed textarea(prose — :667-668)
import type { ComponentProps } from 'react';
import { cx } from '../lib/cx';
import styles from './Textarea.module.css';

export type TextareaVariant = 'code' | 'prose';

export type TextareaProps = Omit<ComponentProps<'textarea'>, 'onChange' | 'value' | 'defaultValue'> & {
  value: string;
  /** 입력할 때마다 바로 */
  onValueChange: (value: string) => void;
  /** code = 고정폭 작은 글자(호출 샘플), prose = 본문 글꼴 · 설명 글 행간(도구 설명) */
  variant?: TextareaVariant;
};

export function Textarea({ variant = 'code', value, onValueChange, className, ...rest }: TextareaProps) {
  return (
    <textarea
      {...rest}
      value={value}
      onChange={(event) => onValueChange(event.currentTarget.value)}
      className={cx(styles.root, className)}
      data-variant={variant}
    />
  );
}
