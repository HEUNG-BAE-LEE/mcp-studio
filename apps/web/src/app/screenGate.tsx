// apps/web/src/app/screenGate.tsx — 화면 상태 골격(DESIGN): 이름 붙인 쿼리 묶음을 받아 없음 · 실패 · 로딩이면 ScreenState 하나를, 다 받았으면 이름별 데이터를 돌려준다.
// 감싸는 자리(PageBody · 층 내용 열)는 호출자가 준다. 판정은 api/screenQueries, 그리기는 ui ScreenState — ui가 api를 모르게 여기서 잇는다
import type { ReactElement, ReactNode } from 'react';
import { ScreenState } from '@/ui';
import { screenFailure, type ScreenQuery } from '../api/screenQueries';
import { RETRY, errorRaw } from '../copy/errors';
import { platform } from '../platform';

/** TanStack 쿼리 결과에서 쓰는 것 — 판정(ScreenQuery) + 받은 값 */
type GateQuery = ScreenQuery & Readonly<{ data: unknown }>;
/** `{ project, sources }` — 이름이 곧 `data`의 키 */
type GateQueries = Readonly<Record<string, GateQuery>>;
/** 쿼리 결과 유니언에서 받은 값의 타입. `undefined` · `null`은 없음(로딩)으로 본다 — 아래 hasData와 같은 기준 */
type DataOf<Q> = Q extends { data: infer D } ? NonNullable<D> : never;
type ScreenData<Q extends GateQueries> = { readonly [K in keyof Q]: DataOf<Q[K]> };

type ScreenGateOptions = Readonly<{
  /** 로딩 한 줄 — `{대상}을 불러오는 중…`(화면 copy) */
  loading: ReactNode;
  /** 영역 · 층 내용 열 안 — 로딩을 `inline` 한 줄로 */
  inline?: boolean;
  /** 경로 id의 주 자원 — 404면 `not-found` + 돌아갈 곳(Button link). 없으면 404도 `failed` */
  notFound?: Readonly<{ query: ScreenQuery; message: ReactNode; action: ReactNode }>;
}>;

type ScreenGate<Q extends GateQueries> =
  Readonly<{ ready: true; data: ScreenData<Q> }> | Readonly<{ ready: false; state: ReactElement }>;

/** 받은 값이 있다 — `null`도 없음으로 본다(DataOf의 NonNullable과 같은 기준. `null`을 돌려주는 쿼리는 묶지 않는다) */
const hasData = (q: GateQuery) => q.data != null;

function failedState(error: unknown, retry: () => void): ReactElement {
  const raw = errorRaw(error);
  return (
    <ScreenState
      kind="failed"
      raw={raw}
      onCopy={() => platform.copyText(raw)}
      retryLabel={RETRY}
      onRetry={retry}
    />
  );
}

/**
 * 없음(주 자원 404) > 실패(받은 값이 없는 쿼리만 — 실패한 것만 다시) > 로딩(받지 않은 값이 있다) > 준비.
 * 받은 값이 있는 쿼리의 실패(다시 받기 실패 — TanStack은 `data`를 둔 채 `isError`)는 그린 화면을 막지 않는다
 */
export function screenGate<const Q extends GateQueries>(
  queries: Q,
  { loading, inline = false, notFound }: ScreenGateOptions,
): ScreenGate<Q> {
  const all = Object.values(queries);
  const failure = screenFailure(
    all.filter((q) => !hasData(q)),
    notFound?.query,
  );
  if (failure?.kind === 'not-found' && notFound) {
    return {
      ready: false,
      state: <ScreenState kind="not-found" message={notFound.message} action={notFound.action} />,
    };
  }
  if (failure?.kind === 'failed') {
    return { ready: false, state: failedState(failure.error, failure.retry) };
  }
  if (!all.every(hasData)) {
    return { ready: false, state: <ScreenState kind="loading" inline={inline} label={loading} /> };
  }
  // 위에서 모든 data가 있음을 확인했다 — 키마다 따로 좁혀지지 않아 여기서 단언한다
  const data = Object.fromEntries(Object.entries(queries).map(([key, q]) => [key, q.data]));
  return { ready: true, data: data as ScreenData<Q> };
}
