// LayerHost — 여러 화면이 여는 층을 그리는 공용 호스트. RootLayout이 셸 옆에 한 번 둔다(옛 #drawer · #modal 한 칸씩 — index.html:43,45)
// 칸은 app/layers 저장소의 드로어 한 칸 · 모달 한 칸이다. 어느 화면(대시보드 · 원본 목록 · 탐색 작업 · 변환 스튜디오)에서 열어도 같은 층이고,
// 메뉴가 바뀌면 셸이 closeAllLayers()로 열린 층의 onOpenChange(false)를 불러 여기서 closeLayer로 칸을 비운다(pathname은 보지 않는다)
//
// 칸마다 지키는 것(COMPONENTS 층 호스트):
// - 층 부품(Drawer · Modal)을 칸마다 하나 그린 뒤로는 늘 마운트해 두고 open과 내용만 바꾼다. 칸이 비어도 마지막 층(useHeldLayer)을 쥐어
//   닫히며 미끄러지는 동안 내용이 보이게 한다 — 내용은 다음 열기까지 남는다
// - 새 시도의 새 상태는 본문 React key = attemptId로 만든다(열린 채 다시 열어도 새 시도다)
//
// 드로어 칸: 연결 마법사 · 탐색 근거. Drawer 하나에 종류별 내용(머리 · 본문 · 발)을 넣는다(app/sources/SourceWizard · app/discovery/EvidenceDrawer)
// - 마법사는 contentKey를 넘기지 않는다 — 열린 채 다시 열어도 포커스를 옮기지 않는다(옛 renderWz). 근거는 층마다 contentKey가 달라
//   열린 채 다른 근거를 열면(종류가 바뀌어도) 다시 연 것으로 친다(옛 openDrawer 재호출 — 첫 포커스 ✕ · 본문 맨 위)
// - 마법사 세션(상태 · 연결 요청 · 시작 요청)은 근거가 보이는 동안에도 마지막 마법사 시도로 남는다 — 요청 훅의 상태가 칸을 거쳐 이어지고,
//   새 마법사를 열면 attemptId가 바뀌어 처음부터다
//
// 모달 칸: 재인증 · 원본 삭제 확인 · 탐색 기록 삭제 확인 · AI 연결 배포 층(묶음 만들기 · 수정 · 삭제 확인 · 배포 확인 · 중지 확인 · 시작 실패 · 서버 로그 ·
//   키 발급 · 키 결과 · 키 폐기 확인). Modal 하나를 늘 그리고 — 종류가 바뀌어도(재인증 → 삭제 확인, 수정 → 묶음 삭제 확인, 키 발급 → 키 결과) 다시
//   마운트하지 않는다 — 제목 · 확인 글자 · 본문 · 폭 · 발만 종류별로 바꾼다(app/sources/ReauthModal · DeleteSourceModal · DeleteJobModal,
//   배포는 app/deploy/useDeployModalContent). open = 칸이 차 있는가, onOpenChange(false) → closeLayer('modal')
// - 키 결과는 "내용은 다음 열기까지 남긴다"의 예외다 — 칸이 닫히는 순간 쥔 층에서 키 원문을 비운다(useHeldModalLayer). 닫힌 <dialog>가 키를 품고 남지 않는다
// - 같은 칸에 다른 대상을 열면(종류 · 대상 · 같은 대상 다시 열기) contentKey = `${kind}:${대상 id}:${attemptId}`가 바뀌어 Modal이 첫 포커스를
//   다시 잡는다(옛 openModal은 열려 있어도 부를 때마다 내용을 바꾸고 첫 입력 · 확인으로 포커스를 옮겼다 — js/common/overlay.js:16-23). 본문 key = attemptId
// - 확인(onConfirm = mutate)과 확인 잠금(confirmDisabled = 요청 중)은 Modal prop이라 요청 훅 · 입력 상태도 이 칸이 쥔다(useModalAttempt).
//   성공 뒤 자기 칸 닫기 · 토스트는 요청 훅의 옵션 콜백이 한다(app/sources/useSourceMutations · app/discovery/useDiscoveryMutations).
//   칸을 거쳐 남는 훅 인스턴스의 요청 상태는 지금 대상의 요청일 때만 읽는다(isPendingFor) — 앞 대상 · 앞 종류의 요청이 새 모달의 확인을 잠그지 않는다
// - 본문의 이름 · 도구 수와 재인증 시작 값은 연 순간에 잡아 둔다(useModalAttempt) — 삭제가 성공해 캐시에서 대상이 빠진 뒤에도 닫히는 동안 본문이
//   그대로다. 열 때 대상을 캐시에서 못 찾으면 모달을 열지 않고 칸을 비운다(옛은 SRC[id]가 비어 예외가 나 열리지 않았다 — js/menu/sources.js:134,143,
//   탐색 기록은 DISC.jobs에 없으면 열지 않았다 — js/menu/discovery.js:390)
import { Fragment, useEffect, useState } from 'react';
import { Drawer, Modal } from '@/ui';
import { useDeleteDiscoveryJob } from './discovery/useDiscoveryMutations';
import { evidenceDrawerOf } from './discovery/EvidenceDrawer';
import { useDeployModalContent } from './deploy/useDeployModalContent';
import {
  closeLayer,
  closeModalIf,
  isDeployModalLayer,
  modalTargetIdOf,
  useDrawerLayer,
  useModalLayer,
  type ModalLayer,
} from './layers';
import { deleteJobContentOf } from './sources/DeleteJobModal';
import { deleteContentOf } from './sources/DeleteSourceModal';
import { reauthContentOf } from './sources/ReauthModal';
import { useSourceWizardDrawer } from './sources/SourceWizard';
import { useModalAttempt, type ModalContent } from './sources/useModalAttempt';
import { useDeleteSource, useReauthSource } from './sources/useSourceMutations';

/** 칸의 마지막 층을 쥔다 — 칸이 비어도 그 층을 돌려줘 닫히는 동안 내용이 남는다. 새 층이 오면 그리기 전에 바꾼다. 한 번도 열지 않았으면 null */
function useHeldLayer<T>(layer: T | null): T | null {
  const [held, setHeld] = useState<T | null>(layer);
  if (layer !== null && layer !== held) setHeld(layer);
  return layer ?? held;
}

/**
 * 모달 칸의 마지막 층을 쥔다(useHeldLayer와 같다). 다만 키 결과가 닫히면 쥔 층의 키 원문을 그 그리기에서 비운다 —
 * 닫힘 전환 동안 키 줄이 먼저 사라지고, 닫힌 층에 원문이 남지 않는다
 */
function useHeldModalLayer(layer: ModalLayer | null): ModalLayer | null {
  const [held, setHeld] = useState<ModalLayer | null>(layer);
  let next = layer ?? held;
  if (layer === null && next !== null && next.kind === 'keyReveal' && next.secret !== '') next = { ...next, secret: '' };
  if (next !== held) setHeld(next);
  return next;
}

/** 아직 마법사를 연 적이 없을 때의 시도 번호 — 실제 시도는 1부터다 */
const NO_WIZARD_ATTEMPT = 0;

const closeDrawer = () => closeLayer('drawer');

/**
 * 드로어 칸 — 연결 마법사 · 탐색 근거를 Drawer 하나에 그린다. 칸이 비면 open만 끄고 그 층을 남긴다 —
 * 마법사는 open이 꺼지는 순간 진행 타이머를 멈춘다
 */
function DrawerSlot() {
  const layer = useDrawerLayer();
  const shown = useHeldLayer(layer);
  const lastWizard = useHeldLayer(layer?.kind === 'wizard' ? layer : null);
  const wizard = useSourceWizardDrawer(
    lastWizard?.attemptId ?? NO_WIZARD_ATTEMPT,
    layer !== null && layer.kind === 'wizard',
  );
  if (shown === null) return null;
  const content = shown.kind === 'wizard' ? wizard : evidenceDrawerOf(shown, closeDrawer);
  return (
    <Drawer
      {...content}
      open={layer !== null}
      onOpenChange={(next) => {
        if (!next) closeDrawer();
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
  const deleteJob = useDeleteDiscoveryJob();
  const deployContent = useDeployModalContent(layer);
  const { source, job } = attempt;

  let content: ModalContent | null = null;
  if (isDeployModalLayer(layer)) {
    content = deployContent;
  } else if (layer.kind === 'deleteJob') {
    if (job !== null) content = deleteJobContentOf({ job, deleteJob });
  } else if (source !== null) {
    content =
      layer.kind === 'reauth'
        ? reauthContentOf({ source, cred: attempt.cred, onCredChange: changeCred, reauth })
        : deleteContentOf({ source, deleteSource });
  }

  // 열 때 대상을 못 찾았다 — 그리지 않고 칸을 비운다
  const isMissing = content === null;
  useEffect(() => {
    if (isMissing) closeModalIf(layer);
  }, [isMissing, layer]);
  if (content === null) return null;

  return (
    <Modal
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) closeLayer('modal');
      }}
      title={content.title}
      size={content.size}
      confirmLabel={content.confirmLabel}
      onConfirm={content.onConfirm}
      confirmDisabled={content.isLocked}
      cancelLabel={content.cancelLabel}
      hideCancel={content.hideCancel}
      extra={content.extra}
      dismissible={content.dismissible}
      contentKey={`${layer.kind}:${modalTargetIdOf(layer)}:${layer.attemptId}`}
    >
      <Fragment key={layer.attemptId}>{content.body}</Fragment>
    </Modal>
  );
}

/** 모달 칸 — 재인증 · 원본 삭제 확인 · 탐색 기록 삭제 확인 · 배포 층. 칸이 비면 open만 끄고 그 시도의 내용을 남긴다(키 결과는 원문을 비운다) */
function ModalSlot() {
  const layer = useModalLayer();
  const shown = useHeldModalLayer(layer);
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
