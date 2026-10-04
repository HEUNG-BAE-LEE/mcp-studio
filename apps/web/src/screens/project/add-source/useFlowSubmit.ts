// apps/web/src/screens/project/add-source/useFlowSubmit.ts — 흐름 리듀서 + 배치 등록: 두 번 보내지 않음 · 400 fields → 항목 · 칸 사유 · 응답을 담은 항목에 짝짓기 · 이동하면 지난 오류 지움
import { useReducer } from 'react';
import { useCreateSources } from '../../../api/hooks/useSourceMutations';
import { warnOnce } from '../../../copy/warnOnce';
import { pairCreated, toBatchItem } from './model';
import { submitErrorsOf } from './submitErrors';
import { INITIAL, reduce, type FlowAction } from './useAddSource';

/** 화면을 옮기거나 바구니를 고치면 지난 등록 오류(ErrorBlock)를 지운다 */
const RESETS_ERROR: ReadonlySet<FlowAction['kind']> = new Set(['back', 'edit', 'remove', 'next']);

export function useFlowSubmit(projectId: string) {
  const [state, dispatchRaw] = useReducer(reduce, INITIAL);
  const create = useCreateSources(projectId);
  const isSubmitting = create.isPending;
  /** 칸으로 되돌리지 못한 오류만 ErrorBlock(원문, 규칙 8) */
  const blockError =
    create.isError && submitErrorsOf(create.error, state.basket).hasUnmapped ? create.error : null;
  const dispatch = (action: FlowAction) => {
    if (RESETS_ERROR.has(action.kind)) create.reset();
    dispatchRaw(action);
  };
  const submit = () => {
    if (!state.type || isSubmitting) return;
    const { basket } = state;
    create.mutate(
      { type: state.type, items: basket.map(toBatchItem) },
      {
        onSuccess: (sources) => {
          const paired = pairCreated(basket, sources);
          if (paired.isMismatch)
            warnOnce(
              'add-source:pair',
              `[add-source] 보낸 ${basket.length}건과 받은 ${sources.length}건이 다르다`,
            );
          dispatchRaw({ kind: 'submitted', created: paired.created });
        },
        onError: (error) =>
          dispatchRaw({ kind: 'rejected', errors: submitErrorsOf(error, basket).byItem }),
      },
    );
  };
  return { state, dispatch, submit, isSubmitting, blockError };
}
