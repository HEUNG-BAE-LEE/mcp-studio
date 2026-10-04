// apps/web/src/api/hooks/useSource.ts — 소스 상세 (소스 설정 모달). id가 없으면 끈다
import { useQuery } from '@tanstack/react-query';
import { fetchSource } from '../dummy/sources';
import { keys } from './keys';

export function useSource(sourceId: string | null) {
  return useQuery({
    queryKey: keys.source(sourceId ?? ''),
    queryFn: () => fetchSource(sourceId ?? ''),
    enabled: sourceId !== null,
  });
}
