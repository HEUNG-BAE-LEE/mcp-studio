// 아이콘 크기 · 선 두께 단계 이름 — 값은 tokens.css의 --icon-* · --icon-stroke-*(DESIGN Iconography).
// Icon은 숫자를 받지 않고 이 이름만 받는다. 이름 ↔ 토큰은 Icon.module.css가 잇는다

/** 크기 단계. 토큰: xs --icon-xs(12) · sm --icon-sm(14) · md-minus --icon-md-minus(15) · md --icon-md(16) · lg --icon-lg(18) · xl --icon-xl(20) · shell --icon-shell(22) · hero --icon-hero(24) · empty --icon-empty(40) */
export const ICON_SIZES = ['xs', 'sm', 'md-minus', 'md', 'lg', 'xl', 'shell', 'hero', 'empty'] as const;
export type IconSize = (typeof ICON_SIZES)[number];

/** 크기를 정하지 않았을 때 — 기본 버튼 안(--h-md)이 가장 흔한 자리다 */
export const DEFAULT_ICON_SIZE: IconSize = 'md';

/** 기본(--icon-stroke 1.8)이 아닌 선 두께 단계. 기본은 stroke를 생략한다. 토큰: light --icon-stroke-light(1.4) · bold --icon-stroke-bold(2.4) · heavy --icon-stroke-heavy(3) */
export const ICON_STROKES = ['light', 'bold', 'heavy'] as const;
export type IconStroke = (typeof ICON_STROKES)[number];
