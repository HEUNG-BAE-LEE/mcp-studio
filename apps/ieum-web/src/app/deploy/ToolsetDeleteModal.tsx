// ToolsetDeleteModal — 도구 묶음 삭제 확인 모달의 내용. 옛에는 없던 확인이다 — 수정 모달의 "삭제"가 확인 없이 바로 지웠다(js/menu/deploy.js:207,209-212)
// 수정 창 자리를 이 확인으로 바꿔 끼운다(같은 Modal의 내용 교체 — contentKey가 바뀌어 첫 포커스는 확인 "삭제"). 취소하면 닫힌다(수정 창으로 돌아가지 않는다)
//
// ── 쓰는 곳 계약 ──
// toolsetDeleteContentOf({ toolset, deleteToolset }) → ModalContent(app/sources/useModalAttempt)
//   toolset — 연 순간의 묶음(app/deploy/useDeployModalAttempt). 이름을 캐시에서 다시 찾지 않는다 — 성공하면 목록에서 먼저 빠진다
//   deleteToolset — useDeleteToolset() 인스턴스(모달 칸이 쥔다). 칸을 거쳐 남으므로 잠금은 그 요청이 이 묶음의 것일 때만
// - 확인 = mutate({ toolsetId, name }) 한 번. 목록 고침 · 자기 칸 닫기 · 토스트와 실패 토스트는 훅의 옵션 콜백(app/deploy/useToolsetMutations)
// - 확인 버튼은 주색 · 첫 포커스(다른 확인 모달과 같다 — 열자마자 Enter면 지운다)
import type { ToolsetWire } from '../../api/types';
import { DEPLOY } from '../../copy/deploy';
import { EmphasisText } from '../discovery/CopyParts';
import type { ModalContent } from '../sources/useModalAttempt';
import type { useDeleteToolset } from './useToolsetMutations';
import styles from './DeployModals.module.css';

type DeleteMutation = ReturnType<typeof useDeleteToolset>;

export type ToolsetDeleteInput = Readonly<{ toolset: ToolsetWire; deleteToolset: DeleteMutation }>;

const C = DEPLOY.deleteConfirm;

export function toolsetDeleteContentOf({ toolset, deleteToolset }: ToolsetDeleteInput): ModalContent {
  return {
    title: C.title,
    confirmLabel: C.confirm,
    onConfirm: () => deleteToolset.mutate({ toolsetId: toolset.id, name: toolset.name }),
    isLocked: deleteToolset.isPending && deleteToolset.variables?.toolsetId === toolset.id,
    body: (
      <p className={styles.text}>
        <EmphasisText parts={C.body(toolset.name)} />
      </p>
    ),
  };
}
