// "AI에 연결하기"에서 고른 탭 — 모듈 저장소라 묶음 · 메뉴를 오가도 남고 새로고침하면 처음 값(Claude)으로 돌아간다(옛 S.client — js/common/state.js:45).
// 주소에 싣지 않는다
import { createStore, useStore } from '../store';
import type { SnippetClient } from './snippet';

const snippetTabStore = createStore<SnippetClient>('claude');

const selectClient = (client: SnippetClient) => client;

/** 지금 고른 탭 */
export const useSnippetClient = (): SnippetClient => useStore(snippetTabStore, selectClient);

/** 탭을 고른다(옛 client :140) */
export function setSnippetClient(client: SnippetClient): void {
  snippetTabStore.set(() => client);
}
