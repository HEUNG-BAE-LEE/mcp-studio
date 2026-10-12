// 지금 열린 층 중 모달 · 드로어가 있는가 — 층이 열리고 닫힐 때 다시 그려진다.
// 쓰는 곳은 층 때문에 멈추거나 숨는 것: 모달이 열린 동안 폴링을 멈추고(이음 js/menu/deploy.js:133), 드로어가 열리면 도크를 숨긴다(css/console.css:225)
import { useSyncExternalStore } from 'react';
import { getOpenLayers, subscribeOpenLayers, type OpenLayers } from './stack';

export function useOpenLayers(): OpenLayers {
  return useSyncExternalStore(subscribeOpenLayers, getOpenLayers);
}
