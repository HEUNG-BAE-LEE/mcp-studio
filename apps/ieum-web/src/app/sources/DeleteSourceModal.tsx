// DeleteSourceModal — 원본 시스템 삭제 확인 모달의 내용(옛 srcDel — js/menu/sources.js:142-151)
// 제목 · 본문(원본 이름 강조 + 도구 수 문장) · 확인 "삭제"를 만든다. Modal은 모달 칸(app/LayerHost ModalSlot)이 하나만 그린다
//
// ── 쓰는 곳 계약 ──
// deleteContentOf({ source, deleteSource }) → ModalContent(app/sources/useModalAttempt)
//   source — 연 순간에 잡은 원본. 본문 이름 · 도구 수를 캐시에서 다시 찾지 않는다 — 삭제가 성공하면 캐시에서 원본이 먼저 빠지고
//     호스트는 닫힌 뒤에도 내용을 남기므로, 다시 찾으면 이름이 비고 도구 수가 0으로 바뀐다(옛은 연 때 만든 HTML 그대로였다 — :144)
//   deleteSource — useDeleteSource() 인스턴스. 칸을 거쳐 남으므로 isLocked는 그 요청이 이 원본의 것일 때만 켠다(isPendingFor).
//     묶음을 다시 받는 동안도 요청 중이라 잠금이 이어진다
// - 확인 = deleteSource.mutate({ sourceId, name }) 한 번. name은 연 순간의 이름(성공 토스트가 쓴다 — :149). 캐시 · 묶음 받기 · 자기 칸
//   닫기 · 토스트와 실패 토스트는 훅의 옵션 콜백이 한다(useSourceMutations) — 실패하면 모달은 열린 채 남는다
// - 이 Modal이 확인이다 — window.confirm을 쓰지 않는다. 확인 버튼은 위험색이 아니라 주색이다(옛 그대로 — js/common/overlay.js:22 .btn.primary)
// - 본문에 input이 없어 첫 포커스는 확인 버튼이다(Modal 규칙 — 옛 js/common/overlay.js:23)
// - 조사 "과"는 옛 그대로 고정이다(copy/sources deleteSource)
import { SOURCES } from '../../copy/sources';
import { isPendingFor, type ModalContent, type OpenedSource } from './useModalAttempt';
import type { useDeleteSource } from './useSourceMutations';
import styles from './DeleteSourceModal.module.css';

type DeleteMutation = ReturnType<typeof useDeleteSource>;

export type DeleteContentInput = Readonly<{
  source: OpenedSource;
  deleteSource: DeleteMutation;
}>;

function DeleteSourceBody({ source }: Readonly<{ source: OpenedSource }>) {
  return (
    <p className={styles.text}>
      <b>{source.name}</b>
      {SOURCES.deleteSource.bodyPost(source.toolCount)}
    </p>
  );
}

export function deleteContentOf({ source, deleteSource }: DeleteContentInput): ModalContent {
  return {
    title: SOURCES.deleteSource.title,
    confirmLabel: SOURCES.deleteSource.ok,
    onConfirm: () => deleteSource.mutate({ sourceId: source.id, name: source.name }),
    isLocked: isPendingFor(deleteSource, source.id),
    body: <DeleteSourceBody source={source} />,
  };
}
