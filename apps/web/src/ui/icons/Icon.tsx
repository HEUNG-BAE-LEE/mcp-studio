import { useId } from 'react';
import { ICON_ASPECT, ICONS, type IconName } from './names';

export type IconProps = {
  name: IconName;
  /** 표시 가로 크기. viewBox는 원본 유지(bell 15×16 · settings 24×24), 높이는 viewBox 비율을 따른다(bell 20 → 21). 17은 IconButton sm-plus */
  size?: 16 | 17 | 18 | 20;
  /** 있으면 role=img + <title>, 없으면 장식(aria-hidden) */
  title?: string;
  className?: string;
};

export function Icon({ name, size = 18, title, className }: IconProps) {
  const Svg = ICONS[name];
  const titleId = useId();
  // title이 비었거나 없으면 장식 아이콘이다 — 이름을 내지 않고 보조기기에서 숨긴다
  const hasTitle = Boolean(title);
  const height = Math.round(size * (ICON_ASPECT[name] ?? 1));
  return (
    <Svg
      width={size}
      height={height}
      className={className}
      title={title}
      titleId={hasTitle ? titleId : undefined}
      role={hasTitle ? 'img' : undefined}
      aria-hidden={hasTitle ? undefined : true}
      focusable="false"
    />
  );
}
