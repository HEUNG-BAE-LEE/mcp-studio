// 화면 상태 판정 — 쿼리 묶음을 pending · not-found · error · empty · ready 중 하나로 본다. React 노드를 그리지 않는다.
// 그리는 쪽(ScreenState · FailureBlock)은 디자인 쪽 ui 부품이고, 화면을 옮길 때 이 판정을 잇는다.
// 화면 조회와 영역(region) 조회를 나눈다:
// - screenGate: 화면 전체를 대표하는 조회만 넣는다. 실패하면 본문 자리에 보인다
// - regionGate: region 조회 하나(구조도 · 로그 필터 · 모델 라벨의 모델 목록, 대시보드 요약, 로그 상세, 탐색 작업 목록, 탐색 근거, 배포 키, 배포 서버 로그). 그 상자 · 층 안에만 보이고 화면을 막지 않는다
//   region 조회를 screenGate에 넣지 않는다 — 넣으면 영역 하나의 실패가 화면 전체를 덮는다
// - enabled:false 쿼리는 넣지 않는다 — 받지 않는 쿼리는 값도 실패도 없어 pending이 끝나지 않는다(조건이 서면 넣는다)
//
// 판정 결과를 쓰는 법:
// - pending: 문구 없이 그 자리(화면이면 본문, region이면 그 상자)를 비우고 aria-busy="true"만 단다(옛 부트 js/main.js:65-66)
// - error(screenGate): 본문 자리에 실패 상자 하나 — 문장은 (error as ApiError).message. 재시도 버튼은 두지 않는다(옛 콘솔에도 없다 — js/main.js:65-67)
// - error(regionGate): 그 상자 안에 실패 상자 — message만, 머리 문장 없이, tone warn. 화면의 나머지는 그대로 그린다
// - 이미 받은 값이 있는 쿼리의 새로 받기 · 폴링 실패는 error가 아니다 — 표시 없이 이전 값으로 ready
// - not-found(screenGate의 notFound 자원만): 없음 상태(탐색 작업 — 없는 id 주소). empty · ready는 data를 그린다
// - 실패 문장은 api/client가 만든다: 봉투 resultMsg 그대로, 그 밖은 "요청에 실패했습니다 ({status})" · "서버에 연결하지 못했습니다."
//   ApiError.raw(응답 본문 원문)는 화면에 내지 않는다
import { hasData, queryFailure, type QueryFailure, type ScreenQuery } from './screenQueries';

type GateQueries = Readonly<Record<string, ScreenQuery>>;
type DataOf<Q> = Q extends ScreenQuery<infer D> ? NonNullable<D> : never;
export type GateData<Q extends GateQueries> = { readonly [K in keyof Q]: DataOf<Q[K]> };

export type Gate<D> =
  | Readonly<{ kind: 'pending' }>
  | QueryFailure
  | Readonly<{ kind: 'empty'; data: D }>
  | Readonly<{ kind: 'ready'; data: D }>;

type GateOptions<D> = Readonly<{
  /** 경로 id의 주 자원 — 404면 not-found(예: 없는 탐색 작업 주소). 없으면 404도 error */
  notFound?: ScreenQuery;
  /** 받은 값이 비었는지 — 참이면 empty(예: 연결된 원본 시스템이 없는 대시보드) */
  isEmpty?: (data: D) => boolean;
}>;

const settle = <D>(data: D, isEmpty?: (data: D) => boolean): Gate<D> =>
  isEmpty?.(data) ? { kind: 'empty', data } : { kind: 'ready', data };

/** 판정 순서: not-found > error(값 없이 실패한 것만) > pending(받지 않은 값이 있다) > empty > ready */
export function screenGate<const Q extends GateQueries>(
  queries: Q,
  { notFound, isEmpty }: GateOptions<GateData<Q>> = {},
): Gate<GateData<Q>> {
  const all = Object.values(queries);
  const failure = queryFailure(all, notFound);
  if (failure) return failure;
  if (!all.every(hasData)) return { kind: 'pending' };
  // 위에서 모든 data가 있음을 확인했다 — 키마다 따로 좁혀지지 않아 여기서 단언한다
  const data = Object.fromEntries(Object.entries(queries).map(([key, q]) => [key, q.data])) as GateData<Q>;
  return settle(data, isEmpty);
}

/** region 조회 하나의 판정. 이미 받은 값이 있으면 새로 받기 · 폴링 실패여도 이전 값으로 ready(핵심 규칙 8 초안) */
export function regionGate<D>(
  query: ScreenQuery<D>,
  { isEmpty }: Pick<GateOptions<NonNullable<D>>, 'isEmpty'> = {},
): Gate<NonNullable<D>> {
  const failure = queryFailure([query]);
  if (failure) return failure;
  if (query.data == null) return { kind: 'pending' };
  return settle(query.data, isEmpty);
}
