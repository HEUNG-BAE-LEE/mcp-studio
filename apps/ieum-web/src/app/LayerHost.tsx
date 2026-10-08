// LayerHost — 여러 화면이 여는 층을 그리는 공용 호스트. RootLayout이 셸 옆에 한 번 둔다(옛 #drawer · #modal 한 칸씩 — index.html:43,45)
// 칸은 app/layers 저장소의 드로어 한 칸 · 모달 한 칸이다. 어느 화면(대시보드 · 원본 목록)에서 열어도 같은 층이고,
// 메뉴가 바뀌면 셸이 closeAllLayers()로 열린 층의 onOpenChange(false)를 불러 여기서 closeLayer로 칸을 비운다(pathname은 보지 않는다)
//
// 칸마다 지키는 것(COMPONENTS 층 호스트):
// - 층 부품(Drawer · Modal)을 한 번 그린 뒤로는 늘 마운트해 두고 open만 바꾼다. 칸이 비어도 마지막 층(useHeldLayer)을 쥐어
//   닫히며 미끄러지는 동안 내용이 보이게 한다 — 내용은 다음 열기까지 남는다
// - 새 시도의 새 상태는 본문 React key = attemptId로 만든다(열린 채 다시 열어도 새 시도다)
// - 드로어 칸: 연결 마법사. contentKey를 넘기지 않는다 — 열린 채 다시 열어도 포커스를 옮기지 않는다(옛 renderWz)
//
// 모달 칸: 재인증 · 원본 삭제 확인. Modal 하나를 늘 그리고 — 종류가 바뀌어도(재인증 → 삭제 확인) 다시 마운트하지 않는다 — 제목 · 확인 글자 ·
//   본문만 종류별로 바꾼다(app/sources/ReauthModal · DeleteSourceModal). open = 칸이 차 있는가, onOpenChange(false) → closeLayer('modal')
// - 같은 칸에 다른 대상을 열면(종류 · 원본 · 같은 원본 다시 열기) contentKey = `${kind}:${sourceId}:${attemptId}`가 바뀌어 Modal이 첫 포커스를
//   다시 잡는다(옛 openModal은 열려 있어도 부를 때마다 내용을 바꾸고 첫 입력 · 확인으로 포커스를 옮겼다 — js/common/overlay.js:16-23). 본문 key = attemptId
// - 확인(onConfirm = mutate)과 확인 잠금(confirmDisabled = 요청 중)은 Modal prop이라 요청 훅 · 입력 상태도 이 칸이 쥔다(useModalAttempt).
//   성공 뒤 자기 칸 닫기 · 토스트는 요청 훅의 옵션 콜백이 한다(app/sources/useSourceMutations). 칸을 거쳐 남는 훅 인스턴스의 요청 상태는
//   지금 원본의 요청일 때만 읽는다(isPendingFor) — 앞 원본 · 앞 종류의 요청이 새 모달의 확인을 잠그지 않는다
// - 본문의 이름 · 도구 수와 재인증 시작 값은 연 순간에 잡아 둔다(useModalAttempt) — 삭제가 성공해 캐시에서 원본이 빠진 뒤에도 닫히는 동안 본문이
//   그대로다. 열 때 원본을 캐시에서 못 찾으면 모달을 열지 않고 칸을 비운다(옛은 SRC[id]가 비어 예외가 나 열리지 않았다 — js/menu/sources.js:134,143)
import { Fragment, useEffect, useState } from 'react';
import { Modal } from '@/ui';
import { closeLayer, closeModalIf, useDrawerLayer, useModalLayer, type ModalLayer } from './layers';
import { deleteContentOf } from './sources/DeleteSourceModal';
import { reauthContentOf } from './sources/ReauthModal';
import { SourceWizard } from './sources/SourceWizard';
import { useModalAttempt, type ModalContent } from './sources/useModalAttempt';
import { useDeleteSource, useReauthSource } from './sources/useSourceMutations';

/** 칸의 마지막 층을 쥔다 — 칸이 비어도 그 층을 돌려줘 닫히는 동안 내용이 남는다. 새 층이 오면 그리기 전에 바꾼다. 한 번도 열지 않았으면 null */
function useHeldLayer<T>(layer: T | null): T | null {
  const [held, setHeld] = useState<T | null>(layer);
  if (layer !== null && layer !== held) setHeld(layer);
  return layer ?? held;
}

/**
 * 드로어 칸 — 지금 종류는 연결 마법사 하나다(다른 종류를 더하면 shown.kind로 고른다). 칸이 비면 open만 끄고 그 시도를 남긴다 —
 * 마법사는 open이 꺼지는 순간 진행 타이머를 멈춘다
 */
function DrawerSlot() {
  const layer = useDrawerLayer();
  const shown = useHeldLayer(layer);
  if (shown === null) return null;
  return (
    <SourceWizard
      attemptId={shown.attemptId}
      open={layer !== null}
      onOpenChange={(next) => {
        if (!next) closeLayer('drawer');
      }}
    />
  );
}

type ModalFrameProps = Readonly<{
  /** 칸의 지금(또는 닫히며 남긴) 층 */
  layer: ModalLayer;
  /** 칸이 지금 이 층을 보이는가 */
  isOpen: boolean;
}>;

/** 모달 칸의 틀 — 종류가 바뀌어도 Modal 하나를 그대로 두고 내용(제목 · 확인 · 본문)만 바꾼다 */
function ModalFrame({ layer, isOpen }: ModalFrameProps) {
  const { attempt, changeCred } = useModalAttempt(layer);
  const reauth = useReauthSource();
  const deleteSource = useDeleteSource();
  const { source } = attempt;

  // 열 때 원본을 못 찾았다 — 그리지 않고 칸을 비운다
  useEffect(() => {
    if (source === null) closeModalIf(layer);
  }, [source, layer]);
  if (source === null) return null;

  const content: ModalContent =
    layer.kind === 'reauth'
      ? reauthContentOf({ source, cred: attempt.cred, onCredChange: changeCred, reauth })
      : deleteContentOf({ source, deleteSource });
  return (
    <Modal
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) closeLayer('modal');
      }}
      title={content.title}
      confirmLabel={content.confirmLabel}
      onConfirm={content.onConfirm}
      confirmDisabled={content.isLocked}
      contentKey={`${layer.kind}:${layer.sourceId}:${layer.attemptId}`}
    >
      <Fragment key={layer.attemptId}>{content.body}</Fragment>
    </Modal>
  );
}

/** 모달 칸 — 재인증 · 원본 삭제 확인. 칸이 비면 open만 끄고 그 시도의 내용을 남긴다 */
function ModalSlot() {
  const layer = useModalLayer();
  const shown = useHeldLayer(layer);
  if (shown === null) return null;
  return <ModalFrame layer={shown} isOpen={layer !== null} />;
}

export function LayerHost() {
  return (
    <>
      <DrawerSlot />
      <ModalSlot />
    </>
  );
}
