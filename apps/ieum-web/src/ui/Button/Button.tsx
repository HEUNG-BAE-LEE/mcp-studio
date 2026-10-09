// Button — 이음 .btn(css/console.css:175-179 · 640-642). 변형 · 크기는 data-* 로 내고 CSS가 그 속성으로 고른다(COMPONENTS 공통 계약)
// 잠금 두 가지: disabled = 조건이 안 맞아 못 누름(native — 포커스를 받지 않는다), pending = 요청 중 잠금(쓰기 버튼).
// pending은 native disabled를 쓰지 않는다 — 포커스된 버튼이 disabled가 되면 Chrome이 포커스를 body로 뺀다(키보드 사용자가 자리를 잃는다).
// aria-disabled="true"로 내고 누름(Enter · Space는 click으로 온다)을 무시해 포커스를 버튼에 남긴다. 모양은 disabled와 같다
import type { ComponentProps, MouseEvent } from 'react';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/names';
import type { IconSize } from '../icons/steps';
import { cx } from '../lib/cx';
import styles from './Button.module.css';

export type ButtonVariant = 'default' | 'primary';
export type ButtonSize = 'sm' | 'md' | 'xl';

export type ButtonProps = Omit<ComponentProps<'button'>, 'type' | 'aria-disabled'> & {
  /** default = 테두리 버튼, primary = 주 액션 필(한 자리에 하나) */
  variant?: ButtonVariant;
  /** 높이 단계 — sm --h-sm · md --h-md · xl --h-xl(대화 보내기 — 안쪽 · 글자는 md와 같다) */
  size?: ButtonSize;
  /** 글자 앞 아이콘. 크기는 size를 따른다 */
  icon?: IconName;
  /** 기본 button — 폼 안에서 뜻밖에 제출하지 않는다 */
  type?: 'button' | 'submit' | 'reset';
  /** 요청 중 잠금(쓰기 버튼) — aria-disabled · 누름 무시 · 비활성 모양, 포커스는 버튼에 남는다. 조건이 안 맞아 못 누르는 것은 disabled */
  pending?: boolean;
};

// 버튼 높이 단계 ↔ 아이콘 단계(DESIGN Iconography — sm 버튼 안 sm, 기본 버튼 안 md). xl은 높이만 다르고 아이콘은 md(옛 .ask .btn 안 send 16)
const ICON_SIZE_OF: Record<ButtonSize, IconSize> = { sm: 'sm', md: 'md', xl: 'md' };

export function Button({
  variant = 'default',
  size = 'md',
  icon,
  type = 'button',
  pending = false,
  className,
  children,
  onClick,
  ...rest
}: ButtonProps) {
  // 잠긴 동안은 쓰는 곳의 onClick을 부르지 않고 기본 동작(폼 제출)도 막는다
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (pending) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  return (
    <button
      {...rest}
      type={type}
      className={cx(styles.root, className)}
      data-variant={variant}
      data-size={size}
      aria-disabled={pending || undefined}
      onClick={handleClick}
    >
      {icon ? <Icon name={icon} size={ICON_SIZE_OF[size]} /> : null}
      {children}
    </button>
  );
}
