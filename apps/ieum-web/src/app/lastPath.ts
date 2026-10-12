// 메뉴별 마지막 주소. LNB는 다른 메뉴에서 돌아올 때 그 메뉴에서 마지막으로 본 주소(id · 필터 포함)로 간다 —
// 옛 콘솔이 메뉴를 오가도 S의 필터 · 선택을 남기던 동작(js/main.js:29)을 주소로 옮긴 것.
// 모듈 저장소라 새로고침하면 비고 기본 경로로 돌아간다(브라우저 저장소에 쓰지 않는다).
// 원본 메뉴는 탐색 작업 주소(/sources/discovery/*)를 기록하지 않고(목록 주소가 남는다), ?log=(로그 행 상세)는 빼고 기록한다 —
// 다른 메뉴에서 돌아오면 드로어 없이 목록이 열린다.
// 지금 보고 있는 메뉴를 다시 누르면 지금 주소 그대로(log 포함) 간다 — 옛 go(js/main.js:15)는 열린 드로어를 닫지 않았다.
// 탐색 작업 주소에서는 지금처럼 원본 목록 주소로 간다. 다시 누르기의 새로 받기는 app/menuRefresh가 한다
import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
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

/** 지금 주소의 경로 — RootLayout의 위치 effect가 바꾼다(noteLocation). 마지막 주소 기록과 따로 둔다(만들기 성공 뒤 recordLastPath가 지금 주소를 바꾸지 않게) */
let currentPathname: string | null = null;

/** 위치가 바뀔 때 RootLayout이 부른다(바꾸기 라우트도 — 지금 주소는 늘 지금 주소다) */
export function noteLocation(pathname: string): void {
  currentPathname = pathname;
}

/**
 * 지금 주소가 속한 LNB 메뉴. React 밖(쓰기 요청 콜백)이 응답 순간 어느 화면에 있는지 묻는다 — 부른 컴포넌트의 마운트가 아니라 주소로 본다
 * (요청 중 다른 메뉴에 갔다 돌아와도 돌아온 화면이 답이다). 아직 그린 적이 없으면 null
 */
export const currentMenu = (): ScreenId | null => (currentPathname === null ? null : menuOf(currentPathname));

/** 위치가 바뀔 때 RootLayout이 부른다. 같은 주소면 저장소를 바꾸지 않는다(구독자에게 알리지 않음) */
export function recordLastPath(pathname: string, search: string): void {
  const menu = menuOf(pathname);
  if (!menu || SKIPPED_PATH.test(pathname)) return;
  const path = pathname + withoutDropped(search);
  lastPathStore.set((prev) => (prev[menu] === path ? prev : { ...prev, [menu]: path }));
}

/**
 * LNB 링크 주소: 지금 주소가 그 메뉴의 화면이면(탐색 작업 주소 제외) 지금 주소 그대로, 아니면 그 메뉴의 마지막 주소,
 * 그것도 없으면 nav.ts의 기본 경로. basename 없는 라우트 경로라 `<Link to={href}>` · `<NavLink to={href}>`에 그대로 넣는다
 * (새 탭 · 복사 주소는 Link가 basename을 붙인다). 지금 주소로 가는 링크는 react-router가 히스토리를 쌓지 않고 replace한다
 */
export function useMenuHref(menu: ScreenId): string {
  const { pathname, search } = useLocation();
  const select = useCallback((paths: LastPaths) => paths[menu], [menu]);
  const lastPath = useStore(lastPathStore, select);
  if (menuOf(pathname) === menu && !SKIPPED_PATH.test(pathname)) return pathname + search;
  return lastPath ?? DEFAULT_PATH[menu] ?? '/';
}
