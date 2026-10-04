import { useCallback, useRef } from 'react';

type AutoFocusHandlers = {
  onOpenAutoFocus: (event: Event) => void;
  onCloseAutoFocus: (event: Event) => void;
};

/**
 * Radix Dialog는 닫힐 때 `Dialog.Trigger`로만 포커스를 돌려준다. 층은 Trigger 없이 호출자가 open을 쥐므로,
 * 열리는 순간 포커스가 있던 요소를 기억했다가 닫힐 때 그 요소로 돌려준다.
 * `focusOnOpen`이 false면 열릴 때 내용으로 포커스를 옮기지 않는다(_guide 카탈로그 예시 — `:focus-visible` 링 방지).
 */
export function useReturnFocus(
  focusOnOpen: boolean,
  /** 여는 컨트롤이 닫힐 때 사라졌으면(행 삭제 등) 포커스를 둘 곳 */
  returnFocusFallback?: () => HTMLElement | null,
): AutoFocusHandlers {
  const openerRef = useRef<HTMLElement | null>(null);

  const onOpenAutoFocus = useCallback(
    (event: Event) => {
      // FocusScope가 포커스를 옮기기 전에 불린다 — activeElement는 아직 여는 컨트롤이다
      const doc = event.target instanceof Node ? event.target.ownerDocument : null;
      const active = doc?.activeElement ?? null;
      openerRef.current = active instanceof HTMLElement && active !== doc?.body ? active : null;
      if (!focusOnOpen) event.preventDefault();
    },
    [focusOnOpen],
  );

  const onCloseAutoFocus = useCallback(
    (event: Event) => {
      const opener = openerRef.current;
      openerRef.current = null;
      const target = opener?.isConnected ? opener : (returnFocusFallback?.() ?? null);
      if (!target) return; // 기본 동작(Trigger 복귀)에 맡긴다
      event.preventDefault();
      target.focus();
    },
    [returnFocusFallback],
  );

  return { onOpenAutoFocus, onCloseAutoFocus };
}
