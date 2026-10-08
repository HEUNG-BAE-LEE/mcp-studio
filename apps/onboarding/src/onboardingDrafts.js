// 온보딩 임시저장(draft) — 위자드 도중 나가도 프로젝트 목록에 "진행중" 카드로 남긴다.
//
// 위자드는 4번째 스텝(변환 시작)에서야 서버에 프로젝트를 만든다. 그 전에 닫으면
// 서버엔 아무것도 없어 목록에 띄울 게 없었고, 진행상태는 sessionStorage 단일 키라
// 모달을 닫는 순간 지워졌다. 여기서 draft 를 localStorage 에 여러 벌 보관해
// "이어서 진행"을 가능하게 한다. 잡 추적(jobStore.js)과 같은 방식 — 서버 없이 클라만.
//
// localStorage(drafts): 탭·새로고침을 넘어 남는 진행분. 목록 카드의 원천.
// sessionStorage(active): 이번 탭에서 열려 있던 draft. SSO 팝업이 앱을 리로드해도
//   그 자리에서 위자드가 다시 열리게 하되, 새 탭에서 제멋대로 뜨지는 않게 한다.
import { useSyncExternalStore } from "react";

const KEY = "ember_onb_drafts";      // { [draftId]: {__v, updatedAt, step, name, ...위자드 state} }
const ACTIVE = "ember_onb_active";   // 이번 탭에서 열려있던 draftId

// 위자드 state 구조를 바꾸면 반드시 올린다 — 구버전 draft 는 읽을 때 폐기되어
// 옛 데이터로 새 코드가 렌더하다 죽는 문제를 원천 차단한다.
export const DRAFT_VERSION = 6;   // v6: 위자드 v2(상단 스텝·복수 선택) 로 state 구조 변경
const MAX_AGE = 14 * 864e5;          // 2주 넘은 draft 는 읽을 때 청소(시연 잔여물 누적 방지)

const subs = new Set();
let map = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(raw).filter(([, d]) => d?.__v === DRAFT_VERSION && now - (d.updatedAt || 0) < MAX_AGE),
    );
  } catch { return {}; }
}
function commit(next) {
  map = next;
  // 용량초과(discoveryCache 가 큼)면 저장만 포기 — 위자드 진행 자체엔 지장 없다.
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* noop */ }
  subs.forEach((f) => f());
}

export const newDraftId = () => "d" + Math.random().toString(36).slice(2, 10);
export const readDraft = (id) => (id && map[id]) || null;
export const saveDraft = (id, snap) =>
  commit({ ...map, [id]: { ...snap, __v: DRAFT_VERSION, updatedAt: Date.now() } });
export function dropDraft(id) {
  if (!(id in map)) return;
  const { [id]: _drop, ...rest } = map;
  commit(rest);
}

export const activeDraftId = () => sessionStorage.getItem(ACTIVE) || null;
export const setActiveDraft = (id) =>
  id ? sessionStorage.setItem(ACTIVE, id) : sessionStorage.removeItem(ACTIVE);

function subscribe(f) { subs.add(f); return () => subs.delete(f); }

/** 전체 draft 맵 (map 식별자는 commit 때만 교체 → 카드 map() 안에서 안전) */
export const useDrafts = () => useSyncExternalStore(subscribe, () => map);
