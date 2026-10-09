// 폭 전환 값 — 카탈로그 본문 iframe의 폭(px)
import { BREAKPOINTS } from '../../app/breakpoints';

/** 폭을 정하지 않고 뷰어 상자를 가득 채운다 */
export const FIT_WIDTH = 'fit';
export type FrameWidth = typeof FIT_WIDTH | number;
export const DEFAULT_WIDTH: FrameWidth = FIT_WIDTH;

/** 검수 폭(DESIGN 핵심 규칙 11) — 브레이크포인트가 만드는 폭 구간마다 대표 하나 */
export const REVIEW_WIDTHS: readonly number[] = [1920, 1440, 1280, 1024, 390];

/** 경계 폭 — 브레이크포인트(max-width 조건이 참인 마지막 폭)와 그 +1px(거짓이 되는 첫 폭). 값은 app/breakpoints.ts에서 온다 */
export const BOUNDARY_WIDTHS: readonly number[] = BREAKPOINTS.toSorted((a, b) => a - b).flatMap((px) => [px, px + 1]);
