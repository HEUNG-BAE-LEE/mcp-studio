import type { KeyboardEvent } from 'react';

/** IME 조합 중 keydown의 keyCode — Safari는 조합을 끝내는 Enter에서 isComposing을 이미 false로 내린다 */
const IME_KEY_CODE = 229;

/**
 * IME(한글 등) 조합 중 키 입력인지. Enter로 확정 · 제출하는 입력은 이것이 참이면 무시한다(DESIGN 접근성 IME).
 * `isComposing`과 keyCode 229를 함께 본다
 */
export function isImeComposing(event: KeyboardEvent): boolean {
  return event.nativeEvent.isComposing || event.nativeEvent.keyCode === IME_KEY_CODE;
}
