// 도구 목록(GET /studio/)을 원본(GET /sources/)과 이어 화면이 쓰는 모양으로 만든다 — 옛 state.js indexTools
// 원본 id(src)를 붙이고 exec · mask · cache · limit이 없으면 기본값을 채운다. 받은 객체는 고치지 않고 새 객체를 만든다
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { BOOT_STALE_TIME } from '../../app/queryClient';
import { api } from '../client';
import type { Source, StudioResponse, Tool, ToolRecord } from '../types';
import { keys } from './keys';
import { useSources } from './useSources';

const STUDIO_PATH = '/studio/';
const WRITE_LIMIT = 10;
const READ_LIMIT = 60;
const CACHED_PROTO = 'gov';

/** 화면이 도구를 찾는 세 길: 전체 · id · 원본 id */
export type ToolIndex = Readonly<{
  all: readonly Tool[];
  byId: Readonly<Record<string, Tool>>;
  bySource: Readonly<Record<string, readonly Tool[]>>;
}>;

/** 쿼리 둘을 하나로 합친 결과 — app/screenQueries의 ScreenQuery 모양과 같다 */
export type ToolsQuery = Readonly<{
  data: ToolIndex | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
}>;

const isWrite = (t: ToolRecord) => t.mode === 'write';

/** 옛 indexTools의 기본값(state.js:11-14). 원본이 목록에 없으면 proto를 모르므로 cache는 false */
const withDefaults = (t: ToolRecord, src: string, proto: string | undefined): Tool => ({
  ...t,
  src,
  exec: t.exec ?? (isWrite(t) ? 'confirm' : 'auto'),
  mask: t.mask ?? true,
  cache: t.cache ?? proto === CACHED_PROTO,
  limit: t.limit ?? (isWrite(t) ? WRITE_LIMIT : READ_LIMIT),
});

/** 컴포넌트 밖에서 캐시 값으로 같은 도구를 만들 때도 쓴다(스튜디오 저장 본문 — app/studio/saveBody) */
export function indexTools(studio: StudioResponse, sources: readonly Source[]): ToolIndex {
  const protoOf = new Map(sources.map((s) => [s.id, s.proto]));
  const bySource = Object.fromEntries(
    Object.entries(studio).map(([src, list]) => [src, list.map((t) => withDefaults(t, src, protoOf.get(src)))]),
  );
  const all = Object.values(bySource).flat();
  return { all, byId: Object.fromEntries(all.map((t) => [t.id, t])), bySource };
}

/** 도구 캐시에서 그 원본의 도구 id(캐시가 없거나 그 원본이 없으면 빈 배열) — 쓰기 뒤 스튜디오 초안을 지울 때 쓴다 */
export function sourceToolIds(queryClient: QueryClient, sourceId: string): readonly string[] {
  const studio = queryClient.getQueryData<StudioResponse>(keys.tools());
  const tools = studio !== undefined && Object.hasOwn(studio, sourceId) ? (studio[sourceId] ?? []) : [];
  return tools.map((t) => t.id);
}

export function useTools(): ToolsQuery {
  const studio = useQuery({
    queryKey: keys.tools(),
    // 부팅 자원 — 한 번 받은 뒤에는 쓰기 응답으로만 고친다(app/queryClient). 화면이 사라져도 요청을 끊지 않는다(signal 안 씀) —
    // 받는 중에 다른 화면으로 옮기면 그 화면이 같은 요청을 이어 받는다(끊으면 다시 보내 두 번이 된다)
    queryFn: () => api.get<StudioResponse>(STUDIO_PATH),
    staleTime: BOOT_STALE_TIME,
  });
  const sources = useSources();
  const studioData = studio.data;
  const sourceList = sources.data?.sources;
  const data = useMemo(
    () => (studioData && sourceList ? indexTools(studioData, sourceList) : undefined),
    [studioData, sourceList],
  );
  return {
    data,
    isPending: studio.isPending || sources.isPending,
    isError: studio.isError || sources.isError,
    error: studio.error ?? sources.error,
  };
}
