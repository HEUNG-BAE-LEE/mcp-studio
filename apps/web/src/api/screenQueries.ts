// apps/web/src/api/screenQueries.ts — 화면 쿼리 여럿을 화면 상태 골격(ui ScreenState) 하나로 모은다: 없음(주 자원 404) · 실패(첫 오류 + 실패한 것만 다시) · 그 밖은 null
import { ApiError } from './errors';

const HTTP_NOT_FOUND = 404;

/** TanStack 쿼리 결과에서 쓰는 것만 */
export type ScreenQuery = Readonly<{
  isError: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
}>;

type ScreenFailure =
  Readonly<{ kind: 'not-found' }> | Readonly<{ kind: 'failed'; error: unknown; retry: () => void }>;

const isNotFound = (error: unknown) => error instanceof ApiError && error.status === HTTP_NOT_FOUND;

/**
 * `primary`(경로 id의 자원 — 프로젝트 · 소스)가 404면 `not-found`, 아니면 실패한 쿼리가 하나라도 있으면 `failed`.
 * 둘 다 아니면 null — 로딩 여부는 화면이 `data`로 직접 좁힌다(쿼리마다 타입이 따로 좁혀진다)
 */
export function screenFailure(
  queries: readonly ScreenQuery[],
  primary?: ScreenQuery,
): ScreenFailure | null {
  if (primary?.isError && isNotFound(primary.error)) return { kind: 'not-found' };
  const failed = queries.find((q) => q.isError);
  if (!failed) return null;
  const retry = () => {
    for (const q of queries) if (q.isError) void q.refetch();
  };
  return { kind: 'failed', error: failed.error, retry };
}
