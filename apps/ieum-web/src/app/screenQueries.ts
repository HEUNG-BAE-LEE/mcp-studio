// 쿼리 여럿의 실패 판정 — 주 자원 404면 not-found, 받은 값이 없는 쿼리가 실패했으면 error.
// 다시 받기(retry · refetch)는 두지 않는다 — 첫 화면 실패에 재시도 버튼이 없다(D11 Q7-c — 옛 js/main.js:65-67). 필요해지면 그때 더한다
// design-guide api/screenQueries.ts의 코드 경로를 옮겼다. 이음 ApiError에는 code가 없어 "아는 code" 갈래는 뺀다(설계 2절 오류 파이프라인)
import { ApiError } from '../api/errors';

const HTTP_NOT_FOUND = 404;

/** TanStack 쿼리 결과에서 판정에 쓰는 것만 */
export type ScreenQuery<D = unknown> = Readonly<{
  data: D | undefined;
  isError: boolean;
  error: unknown;
}>;

export type QueryFailure = Readonly<{ kind: 'not-found' }> | Readonly<{ kind: 'error'; error: unknown }>;

/** 받은 값이 있다 — null도 없음으로 본다. 받은 값이 있는 쿼리의 다시 받기 실패는 화면을 막지 않는다(이전 데이터 유지) */
export const hasData = (q: ScreenQuery): boolean => q.data != null;

const isNotFound = (error: unknown) => error instanceof ApiError && error.status === HTTP_NOT_FOUND;

/**
 * `primary`(경로 id의 자원 — 탐색 작업 등)가 값 없이 404면 not-found. 아니면 받은 값 없이 실패한 쿼리가 있으면 error.
 * 둘 다 아니면 null — 로딩 · 준비는 부르는 쪽(screenGate)이 data로 가른다
 */
export function queryFailure(queries: readonly ScreenQuery[], primary?: ScreenQuery): QueryFailure | null {
  if (primary && !hasData(primary) && primary.isError && isNotFound(primary.error)) return { kind: 'not-found' };
  const failed = queries.find((q) => !hasData(q) && q.isError);
  return failed ? { kind: 'error', error: failed.error } : null;
}
