// 카탈로그 테마 — tokens.css 셀렉터와 같다: [data-theme='light'] · [data-theme='dark']가 강제, 속성이 없으면 시스템(prefers-color-scheme)
export const THEME_CHOICES = ['light', 'dark', 'system'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export const DEFAULT_THEME: ThemeChoice = 'system';
const THEME_ATTRIBUTE = 'data-theme';

/** 문서 뿌리(<html>)의 data-theme을 고른 테마로 맞춘다. 시스템이면 속성을 지운다 */
export function applyTheme(root: HTMLElement, theme: ThemeChoice): void {
  if (theme === 'system') {
    root.removeAttribute(THEME_ATTRIBUTE);
    return;
  }
  root.setAttribute(THEME_ATTRIBUTE, theme);
}
