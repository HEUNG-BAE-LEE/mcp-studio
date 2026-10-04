// apps/web/src/api/hooks/useCreateConnector.ts — 커넥터 만들기(미발행 상태로 만든다)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createConnector } from '../dummy/connectors';
import type { ConnectorDraftInput } from '../types';
import { keys } from './keys';

export function useCreateConnector(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ConnectorDraftInput) => createConnector(projectId, input),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.connectors(projectId) }),
  });
}
