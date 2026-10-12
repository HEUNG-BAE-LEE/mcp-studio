// StopConfirmModal — 서버 중지 확인 모달의 내용(옛 tsStop — js/menu/deploy.js:161-164)
//
// ── 쓰는 곳 계약 ──
// stopConfirmContentOf({ toolset, stopToolset }) → ModalContent(app/sources/useModalAttempt)
//   toolset — 연 순간의 묶음. stopToolset — useStopToolset() 인스턴스(모달 칸이 쥔다), 잠금은 그 요청이 이 묶음의 것일 때만
// - 확인 = mutate({ toolsetId }) 한 번. 목록 고침 · 자기 칸 닫기 · 토스트와 실패 토스트(창은 그대로)는 훅의 옵션 콜백(app/deploy/useToolsetMutations)
// - 확인 "중지"는 주색 · 첫 포커스(옛 그대로). 닫은 뒤 "중지" 버튼은 사라졌을 수 있다 — 포커스는 층 공통 대체 자리(화면 제목)로 간다
import type { ToolsetWire } from '../../api/types';
import { DEPLOY } from '../../copy/deploy';
import { EmphasisText } from '../discovery/CopyParts';
import type { ModalContent } from '../sources/useModalAttempt';
import type { useStopToolset } from './useToolsetMutations';
import styles from './DeployModals.module.css';

type StopMutation = ReturnType<typeof useStopToolset>;

export type StopConfirmInput = Readonly<{ toolset: ToolsetWire; stopToolset: StopMutation }>;

const C = DEPLOY.stop;

export function stopConfirmContentOf({ toolset, stopToolset }: StopConfirmInput): ModalContent {
  return {
    title: C.title,
    confirmLabel: C.confirm,
    onConfirm: () => stopToolset.mutate({ toolsetId: toolset.id }),
    isLocked: stopToolset.isPending && stopToolset.variables?.toolsetId === toolset.id,
    body: (
      <p className={styles.text}>
        <EmphasisText parts={C.body(toolset.name)} />
      </p>
    ),
  };
}
