// DeleteJobModal — 자동 탐색 기록 삭제 확인 모달의 내용(옛 discDel — js/menu/discovery.js:389-394)
// 제목 · 본문(작업 이름 강조 + 문장) · 확인 "삭제"를 만든다. Modal은 모달 칸(app/LayerHost ModalSlot)이 하나만 그린다
//
// ── 쓰는 곳 계약 ──
// deleteJobContentOf({ job, deleteJob }) → ModalContent(app/sources/useModalAttempt)
//   job — 연 순간에 잡은 작업(id · 이름). 본문 이름을 캐시에서 다시 찾지 않는다 — 삭제가 성공하면 작업 목록을 다시 받아 그 작업이 빠지고,
//     호스트는 닫힌 뒤에도 내용을 남긴다(옛도 연 순간의 이름으로 본문을 만들었다 — :391)
//   deleteJob — useDeleteDiscoveryJob() 인스턴스. 칸을 거쳐 남으므로 isLocked는 그 요청이 이 작업의 것일 때만 켠다
// - 확인 = deleteJob.mutate({ jobId }) 한 번. 성공 뒤 자기 칸 닫기 · 작업 캐시 버림 · 목록 다시 받기와 실패 토스트는 훅의 옵션 콜백이 한다
//   (app/discovery/useDiscoveryMutations) — 실패하면 모달은 열린 채 남는다. 성공 토스트는 없다(옛 그대로)
// - 이 Modal이 확인이다 — window.confirm을 쓰지 않는다. 확인 버튼은 주색이다(옛 그대로 — js/common/overlay.js:22)
// - 본문에 input이 없어 첫 포커스는 확인 버튼이다(Modal 규칙 — 옛 js/common/overlay.js:23)
import { DISCOVERY } from '../../copy/discovery';
import type { useDeleteDiscoveryJob } from '../discovery/useDiscoveryMutations';
import type { ModalContent, OpenedJob } from './useModalAttempt';
import styles from './DeleteJobModal.module.css';

type DeleteJobMutation = ReturnType<typeof useDeleteDiscoveryJob>;

export type DeleteJobContentInput = Readonly<{
  job: OpenedJob;
  deleteJob: DeleteJobMutation;
}>;

function DeleteJobBody({ job }: Readonly<{ job: OpenedJob }>) {
  const { pre, strong, post } = DISCOVERY.del.body(job.name);
  return (
    <p className={styles.text}>
      {pre}
      <b>{strong}</b>
      {post}
    </p>
  );
}

export function deleteJobContentOf({ job, deleteJob }: DeleteJobContentInput): ModalContent {
  return {
    title: DISCOVERY.del.title,
    confirmLabel: DISCOVERY.del.confirm,
    onConfirm: () => deleteJob.mutate({ jobId: job.id }),
    isLocked: deleteJob.isPending && deleteJob.variables?.jobId === job.id,
    body: <DeleteJobBody job={job} />,
  };
}
