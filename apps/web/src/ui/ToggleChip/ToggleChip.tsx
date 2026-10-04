// 여러 개 고르는 칩(설정 커넥터 만들기 담을 도구). 눌림 ink 필 · 아님 canvas 윤곽
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import styles from './ToggleChip.module.css';

export type ToggleChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
};

export const ToggleChip = forwardRef<HTMLButtonElement, ToggleChipProps>(function ToggleChip(
  { pressed, onPressedChange, className, type = 'button', onClick, ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      type={type}
      ref={ref}
      className={cx(styles.root, className)}
      aria-pressed={pressed}
      data-pressed={pressed || undefined}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onPressedChange(!pressed);
      }}
    />
  );
});
