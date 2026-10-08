// 공용 층 저장소 — 드로어 한 칸 · 모달 한 칸. 옛 콘솔의 #drawer · #modal 두 자리와 같다(옛 js/common/overlay.js)
// 칸은 따로라 함께 열릴 수 있고 모달이 위다(옛은 마법사를 연 채 재인증 모달을 띄웠다 — js/menu/sources.js:179 credTarget).
// 여는 쪽: 대시보드 "원본 시스템 연결" · 알림 "다시 인증" · 구조도 err 원본, 원본 목록 행 · 툴바 · 관리 버튼.
// 칸을 그리는 것은 앱 층의 층 호스트(RootLayout의 셸 옆)다. 메뉴가 바뀌면 열린 층을 닫는 일은 셸(ui/layers closeAllLayers)이 하고,
// 호스트가 그때 closeLayer로 칸을 비운다. 층 종류는 그 메뉴를 옮길 때 이 유니온에 더한다
//
// 층마다 attemptId — 열 때마다 늘어나는 번호다(두 칸이 같은 수열을 쓴다). 열린 채 다시 열어도 새 번호가 된다:
// 같은 마법사 · 같은 원본의 모달을 다시 열면 새 시도라 이전 입력 · 진행 중 요청이 새 층에 섞이지 않는다(옛 wzOpen · reauth가
// 부를 때마다 상태를 새로 만들었다 — js/menu/sources.js:46-50,135). 호스트는 층 본문의 React key로 쓴다
//
// 쓰기 요청의 옵션 콜백(화면이 사라져도 돈다 — app/sources/useSourceMutations)은 React 밖이라 훅 대신 아래 읽기 · 조건부 닫기를 쓴다:
// - isWizardShowing(attemptId): 드로어 칸이 아직 그 시도의 마법사인가 — 아니면(닫힘 · 다시 열기 · 메뉴 이동) 결과를 토스트로 알린다
// - closeModalIf(target): 모달 칸이 그 종류 · 그 원본일 때만 비운다 — 요청 중 다른 대상의 모달로 바뀌었으면 그 모달은 두고,
//   옛은 성공하면 지금 모달을 무엇이든 닫았다(js/menu/sources.js:138,149 closeModal)
// 모듈 상태라 새로고침하면 빈다
import { createStore, useStore } from './store';

export type DrawerLayer = Readonly<{
  kind: 'wizard';
  /** 열 때마다 늘어난다 — 같은 마법사를 다시 열면 새 시도라 이전 입력 · 진행 중 요청이 새 마법사에 섞이지 않는다 */
  attemptId: number;
}>;
/** 모달 칸이 보이는 대상 — 종류와 원본. 조건부 닫기가 이 둘로 자기 칸인지 알아본다 */
export type ModalTarget = Readonly<{ kind: 'reauth'; sourceId: string }> | Readonly<{ kind: 'deleteSource'; sourceId: string }>;
export type ModalLayer = ModalTarget &
  Readonly<{
    /** 열 때마다 늘어난다 — 같은 원본의 모달을 다시 열어도 새 입력 · 새 요청 상태로 시작한다 */
    attemptId: number;
  }>;
export type LayerSlot = 'drawer' | 'modal';

type Layers = Readonly<{ drawer: DrawerLayer | null; modal: ModalLayer | null }>;

const layerStore = createStore<Layers>({ drawer: null, modal: null });
let lastAttemptId = 0;

const nextAttemptId = (): number => {
  lastAttemptId += 1;
  return lastAttemptId;
};

const openModal = (target: ModalTarget): void => {
  const modal: ModalLayer = { ...target, attemptId: nextAttemptId() };
  layerStore.set((prev) => ({ ...prev, modal }));
};

/** 연결 마법사 드로어를 연다. 이미 열려 있어도 새 시도로 다시 연다 */
export function openWizard(): void {
  const drawer: DrawerLayer = { kind: 'wizard', attemptId: nextAttemptId() };
  layerStore.set((prev) => ({ ...prev, drawer }));
}

/** 원본 시스템 인증 다시 입력 모달을 연다 */
export function openReauth(sourceId: string): void {
  openModal({ kind: 'reauth', sourceId });
}

/** 원본 시스템 삭제 확인 모달을 연다 */
export function openDeleteSource(sourceId: string): void {
  openModal({ kind: 'deleteSource', sourceId });
}

/** 그 칸만 비운다. 이미 비었으면 알리지 않는다 */
export function closeLayer(slot: LayerSlot): void {
  layerStore.set((prev) => {
    if (prev[slot] === null) return prev;
    return slot === 'drawer' ? { ...prev, drawer: null } : { ...prev, modal: null };
  });
}

/** 드로어 칸이 아직 그 시도의 마법사인가. React 밖(쓰기 요청 콜백)에서 읽는다 — 화면은 useDrawerLayer */
export function isWizardShowing(attemptId: number): boolean {
  const { drawer } = layerStore.get();
  return drawer !== null && drawer.kind === 'wizard' && drawer.attemptId === attemptId;
}

const isSameTarget = (layer: ModalLayer, target: ModalTarget): boolean =>
  layer.kind === target.kind && layer.sourceId === target.sourceId;

/** 모달 칸이 그 종류 · 그 원본일 때만 비운다(다른 대상으로 바뀌었으면 둔다). 비웠으면 true */
export function closeModalIf(target: ModalTarget): boolean {
  const { modal } = layerStore.get();
  if (modal === null || !isSameTarget(modal, target)) return false;
  closeLayer('modal');
  return true;
}

const selectDrawer = (state: Layers) => state.drawer;
const selectModal = (state: Layers) => state.modal;

/** 드로어 칸의 지금 층. 비었으면 null */
export const useDrawerLayer = (): DrawerLayer | null => useStore(layerStore, selectDrawer);
/** 모달 칸의 지금 층. 비었으면 null */
export const useModalLayer = (): ModalLayer | null => useStore(layerStore, selectModal);
