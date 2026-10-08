import { DEFAULT_ICON_SIZE, type IconSize, type IconStroke } from './steps';
import { ICONS, type IconName } from './names';
import styles from './Icon.module.css';

export type IconProps = {
  name: IconName;
  /** 크기 단계 이름(숫자 불가) — 값은 --icon-*. 기본 md */
  size?: IconSize;
  /** 선 두께 단계 이름(숫자 불가) — 값은 --icon-stroke-*. 생략하면 기본(1.8) */
  stroke?: IconStroke;
  /** 배치용(여백 · flex)만. 크기 · 선은 size · stroke로 정한다 */
  className?: string;
};

// 단계 이름 → 클래스. Record 키가 단계 이름 전부를 요구하므로 단계를 더하면 여기서 타입 오류로 알려 준다
const SIZE_CLASS: Record<IconSize, string | undefined> = {
  xs: styles.xs,
  sm: styles.sm,
  'md-minus': styles.mdMinus, // vite css.modules.localsConvention=camelCaseOnly — .md-minus는 mdMinus로 나온다
  md: styles.md,
  lg: styles.lg,
  xl: styles.xl,
  shell: styles.shell,
  hero: styles.hero,
  empty: styles.empty,
};
const STROKE_CLASS: Record<IconStroke, string | undefined> = {
  light: styles.light,
  bold: styles.bold,
  heavy: styles.heavy,
};

/**
 * 장식 아이콘. 이음 원본 svg() 규격: viewBox 0 0 24 24 · fill none · currentColor · round cap/join · aria-hidden.
 * 의미는 곁의 글이나 버튼 aria-label이 가진다. 색은 currentColor — 쓰는 곳의 color를 따른다
 */
export function Icon({ name, size = DEFAULT_ICON_SIZE, stroke, className }: IconProps) {
  const Shapes = ICONS[name];
  const classNames = [styles.icon, SIZE_CLASS[size], stroke ? STROKE_CLASS[stroke] : undefined, className];
  return (
    <svg
      className={classNames.filter(Boolean).join(' ')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <Shapes />
    </svg>
  );
}
