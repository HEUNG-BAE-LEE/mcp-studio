// 메뉴 · 경로 한 곳. 라우트 경로는 basename('/ieum') 없이 쓴다 — 링크는 react-router-dom useHref로 만든다
export const SCREENS = [
  { id: 'dashboard', path: '/' },
  { id: 'sources', path: '/sources' },
  { id: 'discovery', path: '/sources/discovery/:jobId' },
  { id: 'studio', path: '/studio/:toolId?' },
  { id: 'playground', path: '/playground' },
  { id: 'deploy', path: '/deploy/:toolsetId?' },
  { id: 'logs', path: '/logs' },
  { id: 'guide', path: '/_guide' },
] as const;
export type ScreenId = (typeof SCREENS)[number]['id'];
export const TOP_NAV: readonly ScreenId[] = ['dashboard', 'sources', 'studio', 'playground', 'deploy', 'logs'];
/** 주소의 첫 경로 조각('/sources/discovery/x' → 'sources', '/' → '') — 메뉴 판정 · 스크롤 판정이 같이 쓴다 */
export const firstSegment = (pathname: string): string => pathname.split('/')[1] ?? '';
/**
 * 다른 주소로 바꾸기만 하는 라우트의 id(routes.tsx가 붙인다). 바뀌기 전 주소는 메뉴별 마지막 주소로 기록하지 않는다(RootLayout) —
 * 자식 <Navigate>와 같은 커밋에서 옛 주소가 기록돼 LNB가 대시보드로 튕기던 것을 막는다
 */
export const REDIRECT_ROUTE = { unknown: 'redirect-unknown', discovery: 'redirect-discovery' } as const;
export const REDIRECT_ROUTE_IDS: ReadonlySet<string> = new Set(Object.values(REDIRECT_ROUTE));
