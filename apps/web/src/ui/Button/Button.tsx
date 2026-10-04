import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { Slot } from 'radix-ui';
import { cx } from '../lib/cx';
import type { ControlSize } from '../lib/types';
import styles from './Button.module.css';

/** 허용 조합은 docs/COMPONENTS.md Button '허용 조합' 표. `quiet`의 좌우 10은 md에서만 적용된다 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'link' | 'outline' | 'quiet';

/** 높이 단계(DESIGN 컨트롤 높이 단계) */
export type ButtonSize = Extract<ControlSize, 'sm' | 'sm-plus' | 'md' | 'lg'>;

/** 글자 역할 — ui 500 13(기본) · label 500 12(촘촘한 자리: 카드 안 · 영역 머리 도구). 행간은 높이 단계를 따른다 */
export type ButtonTextStyle = 'ui' | 'label';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  textStyle?: ButtonTextStyle;
  /** 진행 중. 클릭을 막고 aria-busy. 라벨은 호출자가 진행형 문장으로 바꾼다(스피너 없음) */
  loading?: boolean;
  /** 자식 요소(<a> 등)를 그대로 쓴다 — Radix Slot. asChild + disabled/loading은 best-effort다
   * (자식 자신의 onClick은 막히지 않고 가운데 클릭은 링크를 연다). 함께 쓰지 않는다 */
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    textStyle = 'ui',
    loading = false,
    asChild = false,
    className,
    disabled,
    onClick,
    type = 'button',
    ...rest
  },
  ref,
) {
  const Comp = asChild ? Slot.Root : 'button';
  const isBlocked = disabled || loading;
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isBlocked) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  return (
    <Comp
      {...rest}
      type={asChild ? undefined : type}
      className={cx(styles.root, className)}
      data-variant={variant}
      data-size={size}
      data-text-style={textStyle}
      data-loading={loading || undefined}
      data-disabled={disabled || undefined}
      aria-busy={loading || undefined}
      disabled={asChild ? undefined : disabled}
      aria-disabled={asChild && isBlocked ? true : undefined}
      tabIndex={asChild && isBlocked ? -1 : rest.tabIndex}
      ref={ref}
      onClick={handleClick}
    />
  );
});
