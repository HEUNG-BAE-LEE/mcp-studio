// 층 내용 상자 컨텍스트(내부 전용) — 층 안에서 트리거에 붙는 층(Select 목록 · Tooltip · Popover · RowMenu)이 이 상자로 포털해 층과 같은 쌓임 맥락에 그린다.
// 층 밖(앱 프레임 · body)으로 포털하면 `--z-inline` 목록이 `--z-modal` 층 막 아래로 숨는다
import { createContext, useContext, useState, type ForwardedRef } from 'react';
import { useMergedRefs } from '../lib/mergeRefs';

const LayerContainerContext = createContext<HTMLElement | null>(null);

/** 층(LayerRoot · FlowOverlay)이 내용 상자를 내려준다 */
export const LayerContainerProvider = LayerContainerContext.Provider;

/** 가장 가까운 층의 내용 상자. 층 밖이면 null */
export const useLayerContainer = () => useContext(LayerContainerContext);

/** 내용 상자 노드를 state로 잡아(컨텍스트 값) 바깥 `ref`에도 그대로 넘긴다 */
export function useLayerContentRef<T extends HTMLElement>(ref: ForwardedRef<T>) {
  const [node, setNode] = useState<T | null>(null);
  const contentRef = useMergedRefs<T>(setNode, ref);
  return [node, contentRef] as const;
}
