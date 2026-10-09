// 토스트 한 칸(옛 js/common/overlay.js:26-33). 새 토스트는 내용을 바꾸고 표시 시간을 처음부터 다시 센다 — 같은 글자여도 id가 바뀐다
// 화면 밖(쿼리 · mutation 콜백, 화면을 떠난 뒤)에서도 부른다. 여기는 값만 들고, 표시 시간과 나타남 · 사라짐은 그리는 쪽(ui/Toast)이 맡는다
// 닫아도 글자는 남긴다(open만 false) — 옛 콘솔도 show 클래스만 떼서 글자가 남은 채 사라졌다
import { createStore, useStore } from './store';

export type ToastKind = 'default' | 'warn' | 'info';
export type ToastItem = Readonly<{ id: number; kind: ToastKind; message: string; open: boolean }>;

const toastStore = createStore<ToastItem | null>(null);
let lastId = 0;

const show =
  (kind: ToastKind) =>
  (message: string): void => {
    lastId += 1;
    const next: ToastItem = { id: lastId, kind, message, open: true };
    toastStore.set(() => next);
  };

/** 완료 알림(체크 아이콘). 경고는 toast.warn, 안내는 toast.info */
export const toast = Object.assign(show('default'), { warn: show('warn'), info: show('info') });

/** 표시 시간이 끝난 토스트를 닫는다. 그 사이 새 토스트가 떴으면(id가 다르면) 그대로 둔다 */
export function dismissToast(id: number): void {
  toastStore.set((current) => (current?.id === id && current.open ? { ...current, open: false } : current));
}

const selectCurrent = (state: ToastItem | null) => state;

/** 지금 토스트 한 칸. 한 번도 띄우지 않았으면 null */
export const useToastItem = (): ToastItem | null => useStore(toastStore, selectCurrent);
