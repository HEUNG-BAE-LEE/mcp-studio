import styles from './Logo.module.css';

/** 로고 크기(px) — 아이콘 크기 단계 밖의 고유 치수. 26 GNB · 24 구조도 허브 · 20 파이프라인 허브 */
export const LOGO_SIZES = [26, 24, 20] as const;
export type LogoSize = (typeof LOGO_SIZES)[number];

export type LogoProps = {
  /** 기본 26(GNB) */
  size?: LogoSize;
  className?: string;
};

const SIZE_CLASS: Record<LogoSize, string | undefined> = {
  26: styles.size26,
  24: styles.size24,
  20: styles.size20,
};

/**
 * 이음 로고 — 돼지코(변환 어댑터) 모양. 이음 원본 util.js MARK 그대로(viewBox 24 · 바깥 원 선 2.6 · 안쪽 점 둘 r 1.9).
 * Icon과 달리 루트에 fill none · round cap이 없다. 장식(aria-hidden)이고 색은 currentColor — GNB에서는 primary, 허브 카드 위에서는 흰색을 쓰는 곳이 정한다
 */
export function Logo({ size = 26, className }: LogoProps) {
  return (
    <svg
      className={[styles.logo, SIZE_CLASS[size], className].filter(Boolean).join(' ')}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <circle cx="8.7" cy="12" r="1.9" fill="currentColor" />
      <circle cx="15.3" cy="12" r="1.9" fill="currentColor" />
    </svg>
  );
}
