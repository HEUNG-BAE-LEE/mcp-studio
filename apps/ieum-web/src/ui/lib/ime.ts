// 한글 등 조합(IME) 입력 판정 — 조합 중 Enter · Esc는 글자를 확정하는 키라 동작(더하기 · 닫기)으로 쓰지 않는다.
// 층의 Esc 닫기(layers/stack.ts)와 금지어 입력(TagInput)이 같은 판정을 쓴다. 옛 콘솔은 isComposing만 봤다(js/main.js:56-57) —
// Safari는 조합을 확정하는 키를 isComposing false + keyCode 229로 보내서, 그 값만 보면 반쯤 된 글자가 태그로 들어갔다.
// 그래서 keyCode 229(조합 처리 중 — 브라우저 공통 값)도 조합 중으로 본다
type NativeKeyEvent = Pick<KeyboardEvent, 'isComposing' | 'keyCode'>;
/** React 합성 이벤트 — 조합 여부는 원본 이벤트에 있다 */
type ReactKeyEvent = { nativeEvent: NativeKeyEvent };

/** 조합 처리 중인 키 이벤트의 keyCode */
const IME_PROCESS_KEY_CODE = 229;

/** 키 이벤트가 조합 입력 중에 온 것인가. 원본(`KeyboardEvent`)과 React 합성 이벤트를 모두 받는다 */
export function isImeComposing(event: NativeKeyEvent | ReactKeyEvent): boolean {
  const native = 'nativeEvent' in event ? event.nativeEvent : event;
  return native.isComposing || native.keyCode === IME_PROCESS_KEY_CODE;
}
