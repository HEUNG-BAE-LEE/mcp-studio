// 열린 층의 쌓임(ui 안쪽 전용 — closeAllLayers · useOpenLayers만 @/ui로 내보낸다).
// Esc는 맨 위 층만 닫는다 — 맨 위는 z 순서다: 모달 종류가 드로어 위(DESIGN 쌓임), 같은 종류면 나중에 연 것.
// 연 순서가 아니다 — 모달이 열린 채(가두지 않으므로) Tab으로 닿은 버튼이 드로어를 열어도 드로어는 모달 아래에 깔리고 Esc는 모달 먼저다
// (이음 js/main.js:55 — 모달이 보이면 모달만). 층은 <dialog>.show()라 브라우저가 Esc를 처리하지 않는다 —
// 문서의 keydown 하나로 받는다. 열린 층이 없으면 듣지 않는다
// 목록은 바꿀 때마다 새 배열로 만든다 — 닫는 도중의 등록 · 해제가 순회를 흔들지 않는다
// 열린 층의 요약(모달 · 드로어가 있는가)은 구독으로 내보낸다 — useOpenLayers가 쓴다
import { isImeComposing } from '../lib/ime';

/** 층 종류 — z 짝을 고르고(DESIGN 쌓임) 열린 층 요약의 갈래가 된다 */
export type LayerKind = 'modal' | 'drawer';

/** 지금 열린 층 중 모달 · 드로어가 있는가 */
export type OpenLayers = Readonly<{ modal: boolean; drawer: boolean }>;

export type LayerEntry = Readonly<{
  id: symbol;
  layer: LayerKind;
  /** false면 Esc로 닫히지 않는다(맨 위일 때 Esc는 아무것도 하지 않는다) */
  isDismissible: () => boolean;
  /** 층을 닫는다 — 층이 onOpenChange(false)를 부른다 */
  close: () => void;
}>;

const NO_OPEN_LAYERS: OpenLayers = { modal: false, drawer: false };

let stack: readonly LayerEntry[] = [];
let openLayers: OpenLayers = NO_OPEN_LAYERS;
let listeners: readonly (() => void)[] = [];

// z 순위 — 클수록 위에 그린다(--z-drawer < --z-modal)
const Z_RANK: Readonly<Record<LayerKind, number>> = { drawer: 0, modal: 1 };

/** 맨 위 층 — 순위가 가장 높은 종류 중 나중에 연 것(목록은 연 순서) */
const topOf = (entries: readonly LayerEntry[]): LayerEntry | undefined =>
  entries.reduce<LayerEntry | undefined>(
    (top, entry) => (top === undefined || Z_RANK[entry.layer] >= Z_RANK[top.layer] ? entry : top),
    undefined,
  );

const onKeyDown = (event: KeyboardEvent) => {
  // 한글 조합 중 Esc는 조합을 끝내는 키다 — 층을 닫지 않는다(판정은 금지어 입력과 같은 ui/lib/ime)
  if (event.key !== 'Escape' || isImeComposing(event)) return;
  const top = topOf(stack);
  if (!top || !top.isDismissible()) return;
  event.preventDefault();
  top.close();
};

/** 요약이 그대로면 같은 객체를 돌려준다 — 구독하는 쪽이 바뀐 때만 다시 그린다 */
const summarize = (entries: readonly LayerEntry[]): OpenLayers => {
  const modal = entries.some((entry) => entry.layer === 'modal');
  const drawer = entries.some((entry) => entry.layer === 'drawer');
  return modal === openLayers.modal && drawer === openLayers.drawer ? openLayers : { modal, drawer };
};

const replaceStack = (next: readonly LayerEntry[]): void => {
  const summary = summarize(next);
  stack = next;
  if (summary === openLayers) return;
  openLayers = summary;
  for (const listener of listeners) listener();
};

export function pushLayer(entry: LayerEntry): void {
  if (stack.length === 0) document.addEventListener('keydown', onKeyDown);
  replaceStack([...stack.filter((e) => e.id !== entry.id), entry]);
}

export function removeLayer(id: symbol): void {
  replaceStack(stack.filter((e) => e.id !== id));
  if (stack.length === 0) document.removeEventListener('keydown', onKeyDown);
}

/** useSyncExternalStore용 — 열린 층 요약이 바뀔 때 부른다. 돌려주는 함수가 구독을 푼다 */
export function subscribeOpenLayers(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export const getOpenLayers = (): OpenLayers => openLayers;

/**
 * 열린 층을 나중에 연 것부터 모두 닫는다(dismissible과 상관없이 — 모두 닫으므로 순서는 결과를 바꾸지 않는다). 셸이 메뉴가 바뀔 때 부른다.
 * 화면이 쥔 층은 화면이 사라지며 함께 닫히고, 셸 · 저장소가 쥔 층은 이것으로 닫힌다
 */
export function closeAllLayers(): void {
  for (const entry of stack.toReversed()) entry.close();
}
