import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import styles from './CloseButton.module.css';

export type CloseButtonSize = 22 | 24 | 26;
export type CloseButtonVariant = 'filled' | 'ghost';

export type CloseButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** 22(AlertPanel) · 24(Modal, 기본) · 26(PageHeader) */
  size?: CloseButtonSize;
  /** filled(층 머리, 기본) · ghost(바구니 빼기 — 투명 · faint) */
  variant?: CloseButtonVariant;
};

/** 층 · 헤더의 ✕. 글리프 규칙에 따라 아이콘 대신 문자 ✕를 쓴다 */
export const CloseButton = forwardRef<HTMLButtonElement, CloseButtonProps>(function CloseButton(
  { size = 24, variant = 'filled', className, ...rest },
  ref,
) {
  return (
    <button
      type="button"
      aria-label="닫기"
      {...rest}
      className={cx(styles.root, className)}
      data-size={size}
      data-variant={variant}
      ref={ref}
    >
      ✕
    </button>
  );
});
