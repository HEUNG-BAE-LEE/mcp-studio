// 결과 검토 표 — 개수 · 필터 · 정렬 · 기본 선택. 순수 함수만 둔다(옛 discRows · discResultHTML · discDefaultSel — js/menu/discovery.js:138,167,175,273-277,289,313,398)
// 받은 배열은 고치지 않고 새로 만든다
import type { DiscoveryApi } from '../../api/types';

/** 필터 칩 — 전체 · 등록 추천 · 모두 확인 · 소스에만 · 트래픽에만(옛 :313). 화면 안 state다(열 때마다 전체 — 주소에 두지 않는다) */
export type ResultFilter = 'all' | 'rec' | 'both' | 'src' | 'tr';
export const RESULT_FILTERS: readonly ResultFilter[] = ['all', 'rec', 'both', 'src', 'tr'];
export const DEFAULT_FILTER: ResultFilter = 'all';

const OUT_OF_SCOPE = 'out';
const isFound = (api: DiscoveryApi): boolean => api.ev !== OUT_OF_SCOPE;
const isRecommended = (api: DiscoveryApi): boolean => api.rec === 'yes';

/** "찾은 API N개"(found — 범위 밖 제외)와 칩 수. 전체 칩(all)은 범위 밖까지 센다 — 두 수가 다르다(옛 :289,313) */
export type ResultCounts = Readonly<Record<ResultFilter, number> & { found: number }>;

export function countsOf(apis: readonly DiscoveryApi[]): ResultCounts {
  const found = apis.filter(isFound);
  const withEvidence = (ev: string) => found.filter((api) => api.ev === ev).length;
  return {
    all: apis.length,
    found: found.length,
    rec: found.filter(isRecommended).length,
    both: withEvidence('both'),
    src: withEvidence('src'),
    tr: withEvidence('tr'),
  };
}

/** 같은 칩을 다시 누르면 전체로(전체는 그대로)(옛 :398) */
export const toggleFilter = (current: ResultFilter, next: ResultFilter): ResultFilter =>
  current === next && next !== DEFAULT_FILTER ? DEFAULT_FILTER : next;

function matches(api: DiscoveryApi, filter: ResultFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'rec') return isFound(api) && isRecommended(api);
  return api.ev === filter;
}

// 등록 추천 → 확인 필요 → 제외 추천. 모르는 추천 값은 끝으로(옛은 비교값이 NaN이라 순서가 정해지지 않았다 — 서버가 내지 않는 값)
const REC_ORDER: Readonly<Record<string, number>> = Object.freeze({ yes: 0, check: 1, no: 2 });
const UNKNOWN_REC_ORDER = 3;
const recOrderOf = (api: DiscoveryApi): number => REC_ORDER[api.rec] ?? UNKNOWN_REC_ORDER;

/** 표에 그릴 줄 — 필터에 맞는 것을 추천 순으로. 같은 추천 안은 서버 순서 그대로(안정 정렬) */
export const resultRowsOf = (apis: readonly DiscoveryApi[], filter: ResultFilter): readonly DiscoveryApi[] =>
  apis.filter((api) => matches(api, filter)).toSorted((a, b) => recOrderOf(a) - recOrderOf(b));

/** 기본 선택 — 범위 밖이 아니고 도구 이름이 있고 등록 추천인 것(옛 discDefaultSel). 처음 결과가 올 때와 "추천만 선택"이 쓴다 */
export const defaultSelection = (apis: readonly DiscoveryApi[]): ReadonlySet<string> =>
  new Set(apis.filter((api) => isFound(api) && Boolean(api.tool) && isRecommended(api)).map((api) => api.id));
