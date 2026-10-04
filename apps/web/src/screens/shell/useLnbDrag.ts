// apps/web/src/screens/shell/useLnbDrag.ts — 드래그 폭: w = clamp(w0 + clientX − x0). window 대신 핸들 + 포인터 캡처
import { useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import { clampWidth } from '../../app/store';

export function useLnbDrag(width: number, setWidth: (width: number) => void) {
  return useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const handle = e.currentTarget;
      const { pointerId } = e;
      const x0 = e.clientX;
      const w0 = width;
      handle.setPointerCapture(pointerId);
      const move = (ev: PointerEvent) => setWidth(clampWidth(w0 + ev.clientX - x0));
      const stop = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', stop);
        handle.removeEventListener('pointercancel', stop);
        if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', stop);
      handle.addEventListener('pointercancel', stop);
    },
    [width, setWidth],
  );
}
