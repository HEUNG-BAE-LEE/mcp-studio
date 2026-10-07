// 메뉴별 마지막 주소(D12 Q10 가 · R22). LNB는 메뉴를 다시 누르면 그 메뉴에서 마지막으로 본 주소(id · 필터 포함)로 간다 —
// 옛 콘솔이 메뉴를 오가도 S의 필터 · 선택을 남기던 동작(js/main.js:29)을 주소로 옮긴 것.
// 모듈 저장소라 새로고침하면 비고 기본 경로로 돌아간다(설계 3절 · Z-08 — 브라우저 저장소에 쓰지 않는다).
// 원본 메뉴는 탐색 작업 주소(/sources/discovery/*)를 기록하지 않고(목록 주소가 남는다), ?log=(로그 행 상세)는 빼고 기록한다(Q10 가)
import { useCallback } from 'react';
import { SCREENS, TOP_NAV, firstSegment, type ScreenId } from './nav';
import { createStore, useStore } from './store';

type LastPaths = Readonly<Partial<Record<ScreenId, string>>>;

const lastPathStore = createStore<LastPaths>({});

const SKIPPED_PATH = /^\/sources\/discovery(\/|$)/;
const DROPPED_PARAMS: readonly string[] = ['log'];

/** 라우트 경로의 매개변수 조각을 뺀 메뉴 기본 경로('/studio/:toolId?' → '/studio') */
const basePathOf = (path: string): string => path.split('/:')[0] || '/';

const MENU_BY_SEGMENT: ReadonlyMap<string, ScreenId> = new Map(
  SCREENS.filter((s) => TOP_NAV.includes(s.id)).map((s) => [firstSegment(basePathOf(s.path)), s.id]),
);
const DEFAULT_PATH: Readonly<Partial<Record<ScreenId, string>>> = Object.fromEntries(
  SCREENS.map((s) => [s.id, basePathOf(s.path)]),
);

/** 주소가 속한 LNB 메뉴(탐색 작업은 원본). LNB 메뉴가 아니면 null */
export const menuOf = (pathname: string): ScreenId | null => MENU_BY_SEGMENT.get(firstSegment(pathname)) ?? null;

/** 버릴 키가 없으면 search를 그대로(인코딩 · 순서 보존), 있으면 남은 쌍으로 새 URLSearchParams를 만들어 직렬화한다 */
const withoutDropped = (search: string): string => {
  const entries = [...new URLSearchParams(search)];
  if (!entries.some(([key]) => DROPPED_PARAMS.includes(key))) return search;
  const rest = new URLSearchParams(entries.filter(([key]) => !DROPPED_PARAMS.includes(key))).toString();
  return rest ? `?${rest}` : '';
};

/** 위치가 바뀔 때 RootLayout이 부른다. 같은 주소면 저장소를 바꾸지 않는다(구독자에게 알리지 않음) */
export function recordLastPath(pathname: string, search: string): void {
  const menu = menuOf(pathname);
  if (!menu || SKIPPED_PATH.test(pathname)) return;
  const path = pathname + withoutDropped(search);
  lastPathStore.set((prev) => (prev[menu] === path ? prev : { ...prev, [menu]: path }));
}

/**
 * LNB 링크 주소: 그 메뉴의 마지막 주소, 없으면 nav.ts의 기본 경로. basename 없는 라우트 경로라
 * `<Link to={href}>` · `<NavLink to={href}>`에 그대로 넣는다(새 탭 · 복사 주소는 Link가 basename을 붙인다)
 */
export function useMenuHref(menu: ScreenId): string {
  const select = useCallback((paths: LastPaths) => paths[menu], [menu]);
  return useStore(lastPathStore, select) ?? DEFAULT_PATH[menu] ?? '/';
}
