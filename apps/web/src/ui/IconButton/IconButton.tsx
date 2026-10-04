import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from '../icons';
import { cx } from '../lib/cx';
import type { ControlSize } from '../lib/types';
import styles from './IconButton.module.css';

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'title' | 'children'
> & {
  icon: IconName;
  /** 툴팁이자 접근 가능한 이름. 필수 */
  title: string;
  /** ghost(기본, 투명) · filled(헤더 톱니 — surface-soft 필) */
  variant?: 'ghost' | 'filled';
  /** 높이 단계(DESIGN 컨트롤 높이 단계) — sm 26(기본, 아이콘 18) · sm-plus 28(아이콘 17 — 헤더 톱니) */
  size?: Extract<ControlSize, 'sm' | 'sm-plus'>;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, title, variant = 'ghost', size = 'sm', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      title={title}
      aria-label={title}
      className={cx(styles.root, className)}
      data-variant={variant}
      data-size={size}
      {...rest}
    >
      <Icon name={icon} size={size === 'sm-plus' ? 17 : 18} />
    </button>
  );
});
