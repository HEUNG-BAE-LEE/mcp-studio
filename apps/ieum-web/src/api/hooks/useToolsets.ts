// 도구 묶음 · 배포 상태(GET /deploy/toolsets/). 화면 조회다(?mock=region-failed로 실패하지 않는다).
// 캐시에는 서버 모양(ToolsetWire — runtime.startedAt epoch 초)이 남고, ms로 바꾸는 곳은 useToolsets의 select 하나뿐이다.
// 쓰기 응답(만들기 · 고치기 · 배포 · 시작 · 중지)도 서버 모양 그대로 setQueryData한다(app/deploy/toolsetCache)
//
// toolsetsQuery — 옵션만. 원본 삭제 뒤 한 번 다시 받는 데 쓴다(옛 js/menu/sources.js:148 — 삭제하면 서버가 묶음에서 그 원본의 도구를 빼므로
//   묶음을 새로 받았다). 부르는 쪽은 fetchQuery({ ...toolsetsQuery, staleTime: 0 })로 늘 네트워크에서 받는다 — 기본 staleTime(30초) 안이면
//   캐시를 돌려줘 호출이 빠진다
// useToolsets({ isPaused }) — AI 연결 배포 화면. 옛 refreshToolsets(js/menu/deploy.js:124-135)와 같게:
//   - 진입 자원 — 메뉴에 들어올 때마다 새로 받는다(refetchOnMount 'always'). 같은 메뉴 다시 누르기는 app/menuRefresh가 이 키를 새로 받는다
//   - 4초마다 다시 받는다. 층(모달)이 열린 동안은 멈춘다(isPaused — 옛은 #modal이 보이면 건너뛰었다 :133). 무엇을 멈춤으로 볼지는 쓰는 곳이 정한다
//     (app/deploy/useDeployScreenToolsets — 열린 모달). 이 훅(폴링 관찰자)은 배포 화면 한 곳에서만 부른다 — 둘이면 4초마다 GET이 두 번 나간다
//   - 숨은 탭에서는 멈춘다(옛 document.hidden :133). 돌아오면 다음 간격에 받는다
//   - 폴링 실패는 표시 없이 이전 값으로 그린다(app/screenGate) — 옛도 catch로 버렸다
//   옛은 서명(id · status · ver · runtime의 state · port · pid)이 바뀔 때만 다시 그렸다. 여기서는 구조 공유로 바뀐 필드가 바로 보인다(이름 · 대상 포함)
import { queryOptions, useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { secToMs } from '../time';
import type { Toolset, ToolsetWire } from '../types';
import { keys } from './keys';

/** 목록 · 만들기 경로. 묶음 하나의 쓰기는 toolsetApiPath 아래다(app/deploy 쓰기 훅) */
export const TOOLSETS_PATH = '/deploy/toolsets/';
/** 묶음 하나 `/deploy/toolsets/{id}/` — 고치기 · 삭제, 그 아래 deploy/ · start/ · stop/ · logs/ */
export const toolsetApiPath = (toolsetId: string): string => `${TOOLSETS_PATH}${encodeURIComponent(toolsetId)}/`;
/** 배포 화면 폴링 간격(옛 setInterval 4000 — js/menu/deploy.js:136) */
const POLL_INTERVAL_MS = 4000;

export const toolsetsQuery = queryOptions({
  queryKey: keys.toolsets(),
  queryFn: ({ signal }) => api.get<readonly ToolsetWire[]>(TOOLSETS_PATH, { signal }),
});

/** 시작 시각만 epoch 초 → ms. 시작 시각이 없으면 받은 객체 그대로 */
const withMsRuntime = (ts: ToolsetWire): Toolset =>
  ts.runtime.startedAt === undefined ? ts : { ...ts, runtime: { ...ts.runtime, startedAt: secToMs(ts.runtime.startedAt) } };

const toToolsets = (list: readonly ToolsetWire[]): readonly Toolset[] => list.map(withMsRuntime);

export type ToolsetsOptions = Readonly<{
  /** 참이면 폴링을 멈춘다(받아 둔 값은 그대로) */
  isPaused: boolean;
}>;

export function useToolsets({ isPaused }: ToolsetsOptions) {
  return useQuery({
    ...toolsetsQuery,
    refetchOnMount: 'always',
    refetchInterval: isPaused ? false : POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    select: toToolsets,
  });
}
