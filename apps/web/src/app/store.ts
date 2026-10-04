// apps/web/src/app/store.ts — 전역 상태 하나: LNB 폭 · 접힘 · 플로팅 재료 · 열린 층 · 그룹 토글. persist는 폭 · 접힘만
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { LNB_WIDTH } from '@/ui';
import { platform } from '../platform';

const LNB_MIN_WIDTH = LNB_WIDTH.min;
const LNB_MAX_WIDTH = LNB_WIDTH.max;
const LNB_DEFAULT_WIDTH = LNB_WIDTH.default;
export const LNB_COLLAPSED_WIDTH = LNB_WIDTH.collapsed;
/** 키보드 ←/→ 한 번에 바꾸는 폭 */
export const LNB_KEY_STEP = 8;
const STORAGE_KEY = 'mcp-studio.lnb';
const STORAGE_VERSION = 1;

export type Overlay = 'search' | 'new-project' | 'alerts' | null;

type AppState = {
  /** 펼침 폭(저장) */
  width: number;
  /** 1280 이상에서의 접힘(저장) */
  collapsed: boolean;
  /** 뷰포트 1280 미만 */
  narrow: boolean;
  /** narrow에서 사용자가 바꾼 접힘 — 세션만 */
  narrowCollapsed: boolean | null;
  hovering: boolean;
  overlay: Overlay;
  /** 사용자가 토글한 그룹 — 기본값 · 자동 펼침보다 우선 */
  groupToggles: Readonly<Record<string, boolean>>;
  setWidth: (width: number) => void;
  toggleCollapsed: () => void;
  /** narrow 펼침을 닫는다(항목으로 이동한 뒤 — 본문 위에 뜬 패널이라). 1280 접힘은 그대로 */
  collapseNarrow: () => void;
  setNarrow: (narrow: boolean) => void;
  setHovering: (hovering: boolean) => void;
  openOverlay: (overlay: Exclude<Overlay, null>) => void;
  closeOverlay: () => void;
  toggleGroup: (groupId: string, expanded: boolean) => void;
};

export const clampWidth = (width: number) =>
  Math.min(LNB_MAX_WIDTH, Math.max(LNB_MIN_WIDTH, Math.round(width)));

export const selectCollapsed = (s: Pick<AppState, 'narrow' | 'narrowCollapsed' | 'collapsed'>) =>
  s.narrow ? (s.narrowCollapsed ?? true) : s.collapsed;

/** isFloating = !open && hov && !searching */
export const selectFloating = (s: AppState) =>
  selectCollapsed(s) && s.hovering && s.overlay !== 'search';

type Persisted = Pick<AppState, 'width' | 'collapsed'>;

/** 저장값은 외부 입력 — 모양을 검사해 깨진 값은 기본값으로 */
function sanitize(persisted: unknown): Partial<Persisted> {
  if (typeof persisted !== 'object' || persisted === null) return {};
  const { width, collapsed } = persisted as Record<string, unknown>;
  return {
    ...(typeof width === 'number' && Number.isFinite(width) ? { width: clampWidth(width) } : {}),
    ...(typeof collapsed === 'boolean' ? { collapsed } : {}),
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      width: LNB_DEFAULT_WIDTH,
      collapsed: false,
      narrow: false,
      narrowCollapsed: null,
      hovering: false,
      overlay: null,
      groupToggles: {},
      setWidth: (width) => set({ width: clampWidth(width) }),
      toggleCollapsed: () =>
        set((s) =>
          s.narrow
            ? { narrowCollapsed: !selectCollapsed(s), hovering: false }
            : { collapsed: !s.collapsed, hovering: false },
        ),
      // 펼쳐 있을 때만 쓴다 — 화면 이동마다 불리므로 값이 그대로면 구독자 알림 · persist 쓰기를 만들지 않는다
      collapseNarrow: () => {
        if (get().narrowCollapsed === false) set({ narrowCollapsed: null });
      },
      setNarrow: (narrow) =>
        set((s) => (s.narrow === narrow ? {} : { narrow, narrowCollapsed: null })),
      setHovering: (hovering) => set({ hovering }),
      openOverlay: (overlay) => set({ overlay, hovering: false }),
      closeOverlay: () => set({ overlay: null }),
      toggleGroup: (groupId, expanded) =>
        set((s) => ({ groupToggles: { ...s.groupToggles, [groupId]: !expanded } })),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => ({
        getItem: (key) => platform.storage.get(key),
        setItem: (key, value) => platform.storage.set(key, value),
        removeItem: (key) => platform.storage.remove(key),
      })),
      partialize: (s): Persisted => ({ width: s.width, collapsed: s.collapsed }),
      merge: (persisted, current) => ({ ...current, ...sanitize(persisted) }),
    },
  ),
);
