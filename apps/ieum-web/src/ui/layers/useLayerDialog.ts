// 층 공통 동작(ui 안쪽 전용) — <dialog>.show()로 열고 닫기 · 쌓임 등록(Esc · closeAllLayers) · 첫 포커스 · 포커스 복귀.
// show()라 top layer를 쓰지 않고 포커스를 가두지 않는다(이음 그대로 — 닫은 뒤 포커스 복귀만 더한다). 가림막 · z는 층 부품이 직접 그린다(Overlay)
// 포커스 복귀: 열 때 포커스가 있던 요소로, 그 요소가 사라졌으면 returnFocusFallback()으로. 닫는 순간 포커스가 층 안에 있거나
// 사라졌을 때(body)만 옮긴다 — 층 밖으로 Tab해 간 포커스(예: 열린 채 LNB 링크로 메뉴 이동)는 빼앗지 않는다
// 다시 열기(contentKey): 열린 채 값이 바뀌면 그 순간 포커스가 있던 요소를 복귀 대상으로 다시 잡고 첫 포커스로 옮긴다
// (이음 openDrawer가 열려 있어도 부를 때마다 lastFocus를 잡고 ✕로 옮긴 것 — js/common/overlay.js:5,8)
import { useEffect, useRef, type RefObject } from 'react';
import { pushLayer, removeLayer, type LayerKind } from './stack';

export type LayerDialogOptions = {
  /** 층 종류 — 열린 층 요약(useOpenLayers)의 갈래 */
  layer: LayerKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** false면 Esc로 닫히지 않는다(가림막 누름은 층 부품이 막는다) */
  dismissible: boolean;
  /** 열린 뒤 포커스를 둘 요소. null이면 show()가 고른 첫 포커스 요소에 둔다 */
  initialFocus: (dialog: HTMLDialogElement) => HTMLElement | null;
  /** 연 컨트롤이 닫힐 때 사라졌으면 포커스를 둘 곳 */
  returnFocusFallback?: () => HTMLElement | null;
  /** 보이는 항목 — 열린 채 바뀌면 다시 연 것으로 친다(복귀 대상 다시 잡기 + 첫 포커스). 없으면 open 토글 때만 */
  contentKey?: string | number;
};

const focusTargetOf = (opener: HTMLElement | null, fallback?: () => HTMLElement | null): HTMLElement | null =>
  opener?.isConnected ? opener : (fallback?.() ?? null);

/** 지금 포커스가 있는 층 밖 요소 — 복귀 대상 후보. body · 층 안이면 없다 */
const outsideFocusOf = (dialog: HTMLDialogElement): HTMLElement | null => {
  const active = dialog.ownerDocument.activeElement;
  if (!(active instanceof HTMLElement) || active === dialog.ownerDocument.body) return null;
  return dialog.contains(active) ? null : active;
};

/** 닫는 순간 포커스가 층 안에 있거나 사라졌는가 — 그때만 포커스를 돌려준다 */
const ownsFocus = (dialog: HTMLDialogElement): boolean => {
  const active = dialog.ownerDocument.activeElement;
  return active === null || active === dialog.ownerDocument.body || dialog.contains(active);
};

export function useLayerDialog(dialogRef: RefObject<HTMLDialogElement | null>, options: LayerDialogOptions): void {
  // 쌓임 목록 · 효과가 늘 최신 값을 읽게 한다(열린 동안 prop이 바뀌어도 다시 등록하지 않는다)
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  const openerRef = useRef<HTMLElement | null>(null);
  // 복귀 대상을 마지막으로 잡은 때의 contentKey — 열린 채 이 값과 달라지면 다시 연 것이다
  const capturedKeyRef = useRef(options.contentKey);

  const { open, contentKey } = options;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    openerRef.current = outsideFocusOf(dialog);
    capturedKeyRef.current = latest.current.contentKey;
    if (!dialog.open) dialog.show();
    latest.current.initialFocus(dialog)?.focus();

    const id = Symbol('layer');
    pushLayer({
      id,
      layer: latest.current.layer,
      isDismissible: () => latest.current.dismissible,
      close: () => latest.current.onOpenChange(false),
    });
    return () => {
      removeLayer(id);
      // 화면이 사라지며 함께 사라지는 층(언마운트)은 이미 문서에서 빠졌다 — 닫기 · 포커스 복귀는 열린 채 남은 층만
      if (!dialog.isConnected || !dialog.open) return;
      const shouldReturnFocus = ownsFocus(dialog);
      dialog.close();
      if (!shouldReturnFocus) return;
      focusTargetOf(openerRef.current, latest.current.returnFocusFallback)?.focus();
    };
  }, [open, dialogRef]);

  // 열린 채 다른 항목을 열었다 — 그 순간의 포커스(층 밖일 때만, 아니면 앞 대상 그대로)를 복귀 대상으로 다시 잡고 첫 포커스로.
  // 여는 순간은 위 효과가 이미 잡았다(같은 값이라 건너뛴다). 쌓임 등록 · Esc · 닫기는 건드리지 않는다
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open || capturedKeyRef.current === contentKey) return;
    capturedKeyRef.current = contentKey;
    openerRef.current = outsideFocusOf(dialog) ?? openerRef.current;
    latest.current.initialFocus(dialog)?.focus();
  }, [open, contentKey, dialogRef]);
}
