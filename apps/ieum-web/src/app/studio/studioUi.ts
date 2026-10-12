// 스튜디오 화면 상태 중 주소에 두지 않는 셋 — 도구 검색어 · 미리보기 탭 · 직전에 보던 원본(옛 S.tq · S.ptab · S.src — js/common/state.js:46).
// 메뉴를 옮겨도 남고 새로고침에 빈다(모듈 저장소). 도구는 경로, 필터는 ?tf=, 원본은 도구에서 파생이다 — 직전 원본은 같은 도구 id가
// 여러 원본에 있을 때 주소의 도구를 그 원본 기준으로 풀고, 모르는 도구 id를 그 원본의 첫 도구로 고칠 때만 쓴다(screens/studio/useStudioRoute)
// 다른 메뉴에서 스튜디오로 오는 링크(app/studio/links 도착 표지)를 받으면 화면이 검색어를 비운다 — LNB 재진입은 검색어를 남긴다
import { createStore, useStore } from '../store';

/** 미리보기 탭 — MCP 도구 정의 · 원본 요청 · 응답 변환 */
export type PreviewTab = 'mcp' | 'req' | 'res';
export const PREVIEW_TABS: readonly PreviewTab[] = Object.freeze(['mcp', 'req', 'res']);

type StudioUi = Readonly<{ tq: string; ptab: PreviewTab; src: string | undefined }>;

const INITIAL: StudioUi = Object.freeze({ tq: '', ptab: 'mcp', src: undefined });
const studioUi = createStore<StudioUi>(INITIAL);

const selectQuery = (ui: StudioUi) => ui.tq;
const selectPreviewTab = (ui: StudioUi) => ui.ptab;
const selectSource = (ui: StudioUi) => ui.src;

/** 도구 검색어(입력 그대로 — 매칭 때 앞뒤 공백을 빼고 소문자로) */
export const useToolQuery = (): string => useStore(studioUi, selectQuery);
export const usePreviewTab = (): PreviewTab => useStore(studioUi, selectPreviewTab);
/** 직전에 보던 원본 id — 스튜디오를 한 번도 그리지 않았으면 없다 */
export const useStudioSource = (): string | undefined => useStore(studioUi, selectSource);

export function setToolQuery(tq: string): void {
  studioUi.set((ui) => (ui.tq === tq ? ui : { ...ui, tq }));
}

export function setPreviewTab(ptab: PreviewTab): void {
  studioUi.set((ui) => (ui.ptab === ptab ? ui : { ...ui, ptab }));
}

export function setStudioSource(src: string): void {
  studioUi.set((ui) => (ui.src === src ? ui : { ...ui, src }));
}
