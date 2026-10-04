// apps/web/src/api/hooks/useSourceMutations.ts — 소스 추가(배치) · 표시명 · 연결 해제 · 지금 수집 · 멈추기.
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  createSources,
  deleteSource,
  ingestSource,
  stopIngest,
  updateSource,
} from '../dummy/sources';
import type { SourceBatchInput } from '../types';
import { keys } from './keys';

const refreshProject = (client: QueryClient, projectId: string) => {
  void client.invalidateQueries({ queryKey: keys.project(projectId) });
  void client.invalidateQueries({ queryKey: keys.sources(projectId) });
  void client.invalidateQueries({ queryKey: keys.projectSummary(projectId) });
};
export function useCreateSources(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SourceBatchInput) => createSources(projectId, input),
    onSuccess: () => refreshProject(client, projectId),
  });
}
export function useUpdateSource(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId, name }: { sourceId: string; name: string }) =>
      updateSource(sourceId, { name }),
    onSuccess: (detail) => {
      client.setQueryData(keys.source(detail.id), detail);
      refreshProject(client, projectId);
      // 커넥터 행 · 연결 정보가 소스 이름을 보인다
      void client.invalidateQueries({ queryKey: keys.connectors(projectId) });
    },
  });
}
export function useDeleteSource(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (sourceId: string) => deleteSource(sourceId),
    // 상세 캐시는 여기서 지우지 않는다 — 모달이 열린 채 지우면 useSource가 곧바로 재조회해 404를 맞는다.
    // 호출자가 모달을 내린 뒤 forgetSource로 지운다
    onSuccess: () => {
      refreshProject(client, projectId);
      void client.invalidateQueries({ queryKey: keys.connectors(projectId) });
    },
  });
}
/** 지운 소스의 상세 캐시를 버린다. 그 상세를 보는 화면이 내려간 뒤에 부른다 */
export const forgetSource = (client: QueryClient, sourceId: string) =>
  client.removeQueries({ queryKey: keys.source(sourceId) });
/**
 * 상세만 무효화한다. 목록 행의 상태 · 진행은 실시간 패치(api/realtime)가 맡는다.
 * 새 상세가 올 때까지 요청 중(isPending)으로 둔다 — 응답보다 실시간 상태가 먼저 바뀌어도
 * 누른 버튼이 결과가 보일 때까지 진행 중으로 남는다(설정 모달 상태 탭)
 */
const useRunAction = (run: typeof ingestSource) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (sourceId: string) => run(sourceId),
    onSuccess: (_run, sourceId) => client.invalidateQueries({ queryKey: keys.source(sourceId) }),
  });
};
export const useIngestSource = () => useRunAction(ingestSource);
export const useStopIngest = () => useRunAction(stopIngest);
