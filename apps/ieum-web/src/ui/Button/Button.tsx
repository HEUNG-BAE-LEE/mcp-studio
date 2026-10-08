// Button — 이음 .btn(css/console.css:175-179 · 640-642). 변형 · 크기는 data-* 로 내고 CSS가 그 속성으로 고른다(COMPONENTS 공통 계약)
import type { ComponentProps } from 'react';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/names';
import type { IconSize } from '../icons/steps';
import { cx } from '../lib/cx';
import styles from './Button.module.css';

export type ButtonVariant = 'default' | 'primary';
export type ButtonSize = 'sm' | 'md';

export type ButtonProps = Omit<ComponentProps<'button'>, 'type'> & {
  /** default = 테두리 버튼, primary = 주 액션 필(한 자리에 하나) */
  variant?: ButtonVariant;
  /** 높이 단계 — sm --h-sm · md --h-md */
  size?: ButtonSize;
  /** 글자 앞 아이콘. 크기는 size를 따른다 */
  icon?: IconName;
  /** 기본 button — 폼 안에서 뜻밖에 제출하지 않는다 */
  type?: 'button' | 'submit' | 'reset';
};

// 버튼 높이 단계 ↔ 아이콘 단계(DESIGN Iconography — sm 버튼 안 sm, 기본 버튼 안 md)
const ICON_SIZE_OF: Record<ButtonSize, IconSize> = { sm: 'sm', md: 'md' };

export function Button({
  variant = 'default',
  size = 'md',
  icon,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button {...rest} type={type} className={cx(styles.root, className)} data-variant={variant} data-size={size}>
      {icon ? <Icon name={icon} size={ICON_SIZE_OF[size]} /> : null}
      {children}
    </button>
  );
}
