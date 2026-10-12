// 변환 스튜디오로 가는 주소 만들기 — 다른 메뉴(대시보드 구조도 · 알림, 호출 로그 드로어, 원본 목록)가 같이 쓴다.
// 옛 콘솔은 스튜디오로 갈 때마다 검색어를 비웠다(js/menu/sources.js:132 goSrc · js/menu/studio.js:147 goTool).
// 링크에 도착 표지(state.studioArrive)를 실어 스튜디오가 그 표지를 보면 검색어를 비운다. LNB로 다시 들어올 때는 표지가 없어 검색어가 남는다
// 표지를 읽고 지우는 일(검색어 비우기 · 같은 주소 replace로 state 비우기)은 스튜디오 화면이 한다

/**
 * 스튜디오 도착 표지 — 링크의 state로 넘어간다. 읽는 쪽은 isStudioArrive로 본다.
 * studioSource는 출발 쪽이 아는 그 도구의 원본 — 같은 도구 id가 두 원본에 있어도 그 원본에서 먼저 찾는다(옛 goSrc는 그 원본의 첫 도구를 보였다)
 */
export type StudioArriveState = Readonly<{ studioArrive: true; studioSource?: string }>;
/** `<Link to state>` · `navigate(to, { state })`에 그대로 넘긴다 */
export type StudioLink = Readonly<{ to: string; state: StudioArriveState }>;

const ARRIVE_STATE: StudioArriveState = Object.freeze({ studioArrive: true });
/** 필터 "전체"는 주소에서 뺀다(스튜디오 기본값) */
const DEFAULT_FILTER = 'all';

export const isStudioArrive = (state: unknown): state is StudioArriveState =>
  typeof state === 'object' && state !== null && 'studioArrive' in state && state.studioArrive === true;

type ToolLinkOptions = Readonly<{
  /** 스튜디오 도구 필터(예: 검토 대기 `review`). 없거나 전체면 주소에 넣지 않는다 */
  tf?: string;
  /** 그 도구의 원본 id — 아는 출발 쪽(원본 이동 · 연결 완료 · 탐색 등록)만 넘긴다 */
  src?: string;
}>;

/** 도구 하나를 연 스튜디오 `/studio/<도구 id>[?tf=…]` */
export function toolLink(id: string, { tf, src }: ToolLinkOptions = {}): StudioLink {
  const path = `/studio/${encodeURIComponent(id)}`;
  const hasFilter = tf !== undefined && tf !== '' && tf !== DEFAULT_FILTER;
  const to = hasFilter ? `${path}?${new URLSearchParams({ tf }).toString()}` : path;
  return { to, state: src === undefined ? ARRIVE_STATE : { studioArrive: true, studioSource: src } };
}

/** 도구가 0개인 원본의 스튜디오 `/studio?src=<원본 id>` — 스튜디오가 빈 상태로 그린다 */
export function studioSrcLink(srcId: string): StudioLink {
  return { to: `/studio?${new URLSearchParams({ src: srcId }).toString()}`, state: ARRIVE_STATE };
}
