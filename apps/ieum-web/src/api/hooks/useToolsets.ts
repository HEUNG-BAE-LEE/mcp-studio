// 도구 묶음 · 배포 상태(GET /deploy/toolsets/). 지금은 쿼리 옵션만 둔다 — 원본 삭제 뒤 한 번 다시 받는 데 쓴다
// (옛 js/menu/sources.js:148 — 삭제하면 서버가 묶음에서 그 원본의 도구를 빼므로 묶음을 새로 받았다). 화면에 보이지 않는다.
// 부르는 쪽은 fetchQuery({ ...toolsetsQuery, staleTime: 0 })로 늘 네트워크에서 받는다 — 기본 staleTime(30초) 안이면 캐시를 돌려줘 호출이 빠진다.
// 영역 조회가 아니다(?mock=region-failed로 실패하지 않는다).
// 캐시에는 서버 모양이 남는다(runtime.startedAt은 epoch 초) — ms로 바꾸는 select와 폴링은 AI 연결 배포 화면 훅이 이 옵션 위에 더한다
import { queryOptions } from '@tanstack/react-query';
import { api } from '../client';
import type { Toolset } from '../types';
import { keys } from './keys';

const TOOLSETS_PATH = '/deploy/toolsets/';

export const toolsetsQuery = queryOptions({
  queryKey: keys.toolsets(),
  queryFn: ({ signal }) => api.get<readonly Toolset[]>(TOOLSETS_PATH, { signal }),
});
