// Select — 이음 .sel-f · .inp · .map .mini. 네이티브 <select>에 모양(variant)만 입힌다. 바뀐 값은 onValueChange로 받는다
import type { ComponentProps } from 'react';
import { cx } from '../lib/cx';
import styles from './Select.module.css';

export type SelectVariant = 'toolbar' | 'form' | 'cell';

export type SelectProps = Omit<ComponentProps<'select'>, 'onChange' | 'size' | 'multiple' | 'value' | 'defaultValue'> & {
  /** toolbar = 목록 필터, form = 폼 칸, cell = 표 안 작은 칸 */
  variant: SelectVariant;
  value: string;
  /** 바꾸면 그 값 */
  onValueChange: (value: string) => void;
};

export function Select({ variant, value, onValueChange, className, children, ...rest }: SelectProps) {
  return (
    <select
      {...rest}
      value={value}
      onChange={(event) => onValueChange(event.currentTarget.value)}
      className={cx(styles.root, className)}
      data-variant={variant}
    >
      {children}
    </select>
  );
}
