// 공용 층 저장소(최소판) — 드로어 한 칸 · 모달 한 칸. 옛 콘솔의 #drawer · #modal 두 자리와 같다(옛 js/common/overlay.js)
// 지금은 여는 쪽(대시보드 "원본 시스템 연결" · 알림 "다시 인증" · 구조도 err 원본 · 원본 목록 행)만 이어 둔 상태다.
// 칸을 그리는 호스트(마법사 드로어 · 재인증 모달)는 원본 시스템 메뉴에서 만든다 — 그 전까지는 눌러도 층이 뜨지 않는 것이 정상이다.
// 층 종류는 그 메뉴를 옮길 때 이 유니온에 더한다. 메뉴가 바뀌면 열린 층을 닫는 일은 셸(ui/layers closeAllLayers)이 하고, 호스트가 그때 칸을 비운다
// 모듈 상태라 새로고침하면 빈다
import { createStore, useStore } from './store';

export type DrawerLayer = Readonly<{
  kind: 'wizard';
  /** 열 때마다 늘어난다 — 같은 마법사를 다시 열면 새 시도라 이전 입력 · 진행 중 요청이 새 마법사에 섞이지 않는다 */
  attemptId: number;
}>;
export type ModalLayer = Readonly<{ kind: 'reauth'; sourceId: string }>;
export type LayerSlot = 'drawer' | 'modal';

type Layers = Readonly<{ drawer: DrawerLayer | null; modal: ModalLayer | null }>;

const layerStore = createStore<Layers>({ drawer: null, modal: null });
let lastAttemptId = 0;

/** 연결 마법사 드로어를 연다. 이미 열려 있어도 새 시도로 다시 연다 */
export function openWizard(): void {
  lastAttemptId += 1;
  const drawer: DrawerLayer = { kind: 'wizard', attemptId: lastAttemptId };
  layerStore.set((prev) => ({ ...prev, drawer }));
}

/** 원본 시스템 인증 다시 입력 모달을 연다 */
export function openReauth(sourceId: string): void {
  const modal: ModalLayer = { kind: 'reauth', sourceId };
  layerStore.set((prev) => ({ ...prev, modal }));
}

/** 그 칸만 비운다. 이미 비었으면 알리지 않는다 */
export function closeLayer(slot: LayerSlot): void {
  layerStore.set((prev) => {
    if (prev[slot] === null) return prev;
    return slot === 'drawer' ? { ...prev, drawer: null } : { ...prev, modal: null };
  });
}

const selectDrawer = (state: Layers) => state.drawer;
const selectModal = (state: Layers) => state.modal;

/** 드로어 칸의 지금 층. 비었으면 null */
export const useDrawerLayer = (): DrawerLayer | null => useStore(layerStore, selectDrawer);
/** 모달 칸의 지금 층. 비었으면 null */
export const useModalLayer = (): ModalLayer | null => useStore(layerStore, selectModal);
