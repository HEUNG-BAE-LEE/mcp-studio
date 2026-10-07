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
