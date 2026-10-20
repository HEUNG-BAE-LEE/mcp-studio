// StartErrorModal — 서버 시작 실패 모달의 내용(옛 deployError — js/menu/deploy.js:119-121,159)
// 넓은 모달 · 본문은 실패 상자(위험 · 머리 없음 — 모달 제목이 머리, 서버 문장 원문의 줄바꿈을 지킨다) · "닫기"만. 확인 · 입력이 없어 첫 포커스는 머리 ✕
// 서버 시작 요청(app/deploy/useToolsetMutations useStartToolset)이 배포 화면에 있을 때만 연다 — 떠났으면 경고 토스트
//
// ── 쓰는 곳 계약 ──
// startErrorContentOf({ message }) → ModalContent(app/sources/useModalAttempt). message는 층에 실린 서버 문장 그대로
import { DEPLOY } from '../../copy/deploy';
import { LAYER_COPY } from '../../copy/shell';
import type { ModalContent } from '../sources/useModalAttempt';
import { FailureBlock } from '@/ui';

export function startErrorContentOf({ message }: Readonly<{ message: string }>): ModalContent {
  return {
    title: DEPLOY.start.failTitle,
    size: 'wide',
    cancelLabel: LAYER_COPY.close,
    body: <FailureBlock tone="danger" message={message} />,
  };
}
