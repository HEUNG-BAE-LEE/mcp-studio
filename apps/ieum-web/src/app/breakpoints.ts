// 이음 브레이크포인트 — JS가 폭을 알아야 하는 곳이 쓰는 폭 값의 원본 목록.
// 부품 · 레이아웃 CSS의 @media 조건(lint/values.js ALLOWED_MEDIA)과 같은 집합이어야 한다 — check-docs가 대조한다
export const BREAKPOINTS = [1680, 1500, 1360, 1100, 760] as const;

export type Breakpoint = (typeof BREAKPOINTS)[number];
export type MaxWidthQuery = `(max-width: ${Breakpoint}px)`;

/** useMediaQuery에 넘길 폭 조건 — maxWidth(760) → '(max-width: 760px)' */
export const maxWidth = (px: Breakpoint): MaxWidthQuery => `(max-width: ${px}px)`;
