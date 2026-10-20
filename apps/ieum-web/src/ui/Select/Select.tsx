// Select — 이음 .sel-f · .inp · .map .mini · .tg .inp. 네이티브 <select>에 모양(variant)만 입힌다. 바뀐 값은 onValueChange로 받는다
import type { ComponentProps } from 'react';
import { cx } from '../lib/cx';
import styles from './Select.module.css';

export type SelectVariant = 'toolbar' | 'form' | 'cell' | 'setting';
export type SelectWidth = 'wide';

type SelectBaseProps = Omit<ComponentProps<'select'>, 'onChange' | 'size' | 'multiple' | 'value' | 'defaultValue'> & {
  value: string;
  /** 바꾸면 그 값 */
  onValueChange: (value: string) => void;
};

type SelectShapeProps =
  | {
      /** toolbar = 목록 필터(최대 폭 220) */
      variant: 'toolbar';
      /** wide = 최대 폭 280(스튜디오 원본 선택) */
      width?: SelectWidth;
    }
  | {
      /** form = 폼 칸, cell = 표 안 작은 칸, setting = 설정 줄 오른쪽(내용 폭) */
      variant: Exclude<SelectVariant, 'toolbar'>;
      width?: never;
    };

export type SelectProps = SelectBaseProps & SelectShapeProps;

export function Select({ variant, width, value, onValueChange, className, children, ...rest }: SelectProps) {
  return (
    <select
      {...rest}
      value={value}
      onChange={(event) => onValueChange(event.currentTarget.value)}
      className={cx(styles.root, className)}
      data-variant={variant}
      data-width={width}
    >
      {children}
    </select>
  );
}
