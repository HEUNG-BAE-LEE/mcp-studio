// 저장하지 않은 변경 닫기 확인(DESIGN 층 선택) — form · settings 모달이 바뀐 값을 가진 채 닫히려 하면 확인 Dialog를 연다
import { useState, type ReactElement } from 'react';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { CANCEL_LABEL } from './labels';

/** 기본 문구(DESIGN Copy UI 공용 어휘) — 발 note · 확인 Dialog 제목 · 확인(`danger`) · 취소 */
export const UNSAVED_LABELS = {
  note: '저장하지 않은 변경이 있다',
  title: '저장하지 않고 닫을까요?',
  discard: '닫기',
  cancel: CANCEL_LABEL,
} as const;
export type UnsavedLabels = Record<keyof typeof UNSAVED_LABELS, string>;

export type UseUnsavedCloseOptions = {
  /** 바뀐 값이 있다 — 닫기 전에 확인한다 */
  isDirty: boolean;
  /** 닫기 전에 끝나야 하는 요청 중(저장 · 만들기 · 삭제) — 닫기를 받지 않는다. 호출자는 발 닫기 · 취소를 disabled로 보인다 */
  isBusy?: boolean;
  /** 실제로 닫는다(층 open을 내린다) */
  onClose: () => void;
  /** 층의 open(기본 true) — 닫혀 있으면 확인 Dialog를 그리지 않고, 닫히면 확인 상태를 거둔다 */
  open?: boolean;
  /** 확인 Dialog 포털 대상 — 층과 같게(앱 프레임) */
  container?: HTMLElement | null;
  labels?: Partial<UnsavedLabels>;
};

export type UnsavedClose = {
  /** ✕ · Esc · 바깥 클릭(층 onOpenChange(false)) · 발 닫기 · 취소가 부른다 */
  requestClose: () => void;
  /** 바뀐 값이 있으면 발 note 문구, 없으면 null */
  note: string | null;
  /** 확인 Dialog — 층과 형제로 그린다 */
  dialog: ReactElement;
};

export function useUnsavedClose({
  isDirty,
  isBusy = false,
  onClose,
  open = true,
  container,
  labels,
}: UseUnsavedCloseOptions): UnsavedClose {
  const [isConfirming, setIsConfirming] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  // 층이 밖에서 닫히면(경로 이동 등) 확인도 거둔다 — 다시 열 때 확인이 먼저 뜨지 않게.
  // effect 대신 렌더 중 이전 값 비교(React 권장 패턴)
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setIsConfirming(false);
  }
  const text = { ...UNSAVED_LABELS, ...labels };
  const requestClose = () => {
    if (isBusy) return;
    if (isDirty) setIsConfirming(true);
    else onClose();
  };
  const discard = () => {
    setIsConfirming(false);
    onClose();
  };
  const dialog = (
    <Dialog
      open={isConfirming && open}
      onOpenChange={setIsConfirming}
      container={container}
      title={text.title}
      actions={{
        cancel: <Button>{text.cancel}</Button>,
        confirm: (
          <Button variant="danger" onClick={discard}>
            {text.discard}
          </Button>
        ),
      }}
    />
  );
  return { requestClose, note: isDirty ? text.note : null, dialog };
}
