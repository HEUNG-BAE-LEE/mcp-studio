// IconButton — 이음 .icon-btn(css/console.css:182-183) · 모달 머리 위(css/console.css:406-407). 이름(aria-label)은 필수다
import type { ComponentProps } from 'react';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/names';
import { cx } from '../lib/cx';
import styles from './IconButton.module.css';

export type IconButtonVariant = 'default' | 'on-band';
/** 층 머리 닫기는 xl, 그 밖은 lg(DESIGN Iconography) */
export type IconButtonIconSize = 'lg' | 'xl';

export type IconButtonProps = Omit<ComponentProps<'button'>, 'children' | 'type' | 'aria-label'> & {
  /** 이름(aria-label) — 아이콘만 있어 반드시 준다 */
  label: string;
  icon: IconName;
  iconSize?: IconButtonIconSize;
  /** on-band = 파란 띠(모달 머리) 위 — 흰 아이콘 · 흰 포커스 링 */
  variant?: IconButtonVariant;
};

export function IconButton({ label, icon, iconSize = 'lg', variant = 'default', className, ...rest }: IconButtonProps) {
  return (
    <button {...rest} type="button" aria-label={label} className={cx(styles.root, className)} data-variant={variant}>
      <Icon name={icon} size={iconSize} />
    </button>
  );
}
