// 묶음 캐시(['deploy','toolsets']) 고침 — 쓰기 응답으로 setQueryData한 뒤 무효화한다(배포 화면이 보고 있으면 바로 다시 받는다).
// 캐시는 서버 모양(ToolsetWire — runtime.startedAt epoch 초)이다. 응답도 서버 모양이라 바꾸지 않고 넣는다 — ms로 바꾸는 곳은 useToolsets select뿐이다.
// 받은 배열 · 객체는 고치지 않고 새로 만든다. 캐시가 아직 없으면 만들지 않는다(다음 구독이 받는다)
import type { QueryClient } from '@tanstack/react-query';
import { keys } from '../../api/hooks/keys';
import type { ToolsetWire } from '../../api/types';

type ToolsetList = readonly ToolsetWire[];

/** 새 묶음은 목록 끝에(서버 추가 순과 같다 — 옛 TOOLSETS.push :201) */
export function addToolset(queryClient: QueryClient, toolset: ToolsetWire): void {
  queryClient.setQueryData<ToolsetList>(keys.toolsets(), (prev) => (prev === undefined ? undefined : [...prev, toolset]));
}

/** 같은 id의 묶음을 응답으로 바꾼다(옛 Object.assign(ts, r) — 응답이 묶음 전체다) */
export function replaceToolset(queryClient: QueryClient, toolset: ToolsetWire): void {
  queryClient.setQueryData<ToolsetList>(keys.toolsets(), (prev) =>
    prev === undefined ? undefined : prev.map((t) => (t.id === toolset.id ? toolset : t)),
  );
}

/** 목록에서 그 묶음을 뺀다(옛 TOOLSETS.splice :211) */
export function removeToolset(queryClient: QueryClient, toolsetId: string): void {
  queryClient.setQueryData<ToolsetList>(keys.toolsets(), (prev) =>
    prev === undefined ? undefined : prev.filter((t) => t.id !== toolsetId),
  );
}

/** 목록만 무효화한다(exact — 같은 접두의 서버 로그 키는 건드리지 않는다). 기다리지 않는다 — 실패는 폴링 실패와 같이 이전 값으로 남는다 */
export function invalidateToolsets(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: keys.toolsets(), exact: true });
}
