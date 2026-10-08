// Input — 한 줄 입력. 이음 .inp(form — css/console.css:307-309) · .map .mini(cell — :1074-1076) · .tg .inp(setting — :716) · .mono(:488)
// 입력할 때마다 바로 onValueChange를 부른다. 모양은 variant, 폭은 width 하나로 정한다
import type { ComponentProps } from 'react';
import { cx } from '../lib/cx';
import styles from './Input.module.css';

export type InputType = 'text' | 'password' | 'number' | 'time';
export type InputVariant = 'form' | 'cell' | 'setting';
export type InputWidth = 'full' | 'auto' | 'narrow';

type InputBaseProps = Omit<ComponentProps<'input'>, 'onChange' | 'size' | 'type' | 'value' | 'defaultValue' | 'width'> & {
  value: string;
  /** 입력할 때마다 바로 */
  onValueChange: (value: string) => void;
  /** password면 autocomplete="new-password"를 함께 넣는다(브라우저가 저장된 비밀번호를 채우지 않게) */
  type?: InputType;
  /** 고정폭 글꼴 — 서버 주소 · 키 이름 · 토큰 URL · 매핑 이름 */
  mono?: boolean;
};

type InputShapeProps =
  | {
      /** form = 폼 칸(--h-md) */
      variant?: 'form';
      /** full = 칸 전체(기본), narrow = 120(탐색 최대 화면 수) */
      width?: Extract<InputWidth, 'full' | 'narrow'>;
    }
  | {
      /** setting = 정책 · 설정 줄 오른쪽 칸(--h-sm · 오른쪽 정렬 · 숫자 고른 폭) */
      variant: 'setting';
      /** 없으면 78(정책 숫자 칸), auto = 내용 폭(탐색 예약 시각) */
      width?: Extract<InputWidth, 'auto'>;
    }
  | {
      /** cell = 표 안 작은 칸(--h-xs · 칸 전체 · 최소 90) */
      variant: 'cell';
      width?: never;
    };

export type InputProps = InputBaseProps & InputShapeProps;

export function Input({ variant = 'form', width, value, onValueChange, type = 'text', mono = false, className, ...rest }: InputProps) {
  return (
    <input
      {...rest}
      type={type}
      autoComplete={type === 'password' ? 'new-password' : rest.autoComplete}
      value={value}
      onChange={(event) => onValueChange(event.currentTarget.value)}
      className={cx(styles.root, className)}
      data-variant={variant}
      data-width={width}
      data-mono={mono ? 'true' : undefined}
    />
  );
}
