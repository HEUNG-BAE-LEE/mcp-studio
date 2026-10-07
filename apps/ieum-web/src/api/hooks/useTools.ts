// 도구 목록(GET /studio/)을 원본(GET /sources/)과 이어 화면이 쓰는 모양으로 만든다 — 옛 state.js indexTools(R20)
// 원본 id(src)를 붙이고 exec · mask · cache · limit이 없으면 기본값을 채운다. 받은 객체는 고치지 않고 새 객체를 만든다
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
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

function indexTools(studio: StudioResponse, sources: readonly Source[]): ToolIndex {
  const protoOf = new Map(sources.map((s) => [s.id, s.proto]));
  const bySource = Object.fromEntries(
    Object.entries(studio).map(([src, list]) => [src, list.map((t) => withDefaults(t, src, protoOf.get(src)))]),
  );
  const all = Object.values(bySource).flat();
  return { all, byId: Object.fromEntries(all.map((t) => [t.id, t])), bySource };
}

export function useTools(): ToolsQuery {
  const studio = useQuery({
    queryKey: keys.tools(),
    queryFn: ({ signal }) => api.get<StudioResponse>(STUDIO_PATH, { signal }),
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
