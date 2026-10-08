// Modal — 이음 openModal(js/common/overlay.js:16-25) · .modal(css/console.css:402-411).
// 머리(파란 띠 + 제목 + ✕) · 본문 · 발(extra · 취소 · 확인). 층 공통 동작은 ui/layers(show() · 가두지 않음 · Esc 맨 위 · 포커스 복귀)
// 확인은 onConfirm만 부른다 — 닫기는 쓰는 곳이 성공 뒤에 한다(js/main.js:42). 첫 포커스: 본문 첫 input → 확인 버튼 → 머리 ✕
import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LAYER_COPY } from '../../copy/shell';
import { Button } from '../Button';
import { IconButton } from '../IconButton';
import { Overlay } from '../layers/Overlay';
import { useLayerDialog } from '../layers/useLayerDialog';
import styles from './Modal.module.css';

export type ModalSize = 'md' | 'wide';

export type ModalProps = {
  open: boolean;
  /** ✕ · 취소 · Esc · 가림막이 onOpenChange(false)를 부른다 */
  onOpenChange: (open: boolean) => void;
  /** 머리 제목 — aria-labelledby 대상 */
  title: ReactNode;
  children: ReactNode;
  /** 폭 --w-modal · --w-modal-wide. 기본 md */
  size?: ModalSize;
  /** 확인 버튼(primary) 글자. 없으면 확인 버튼이 없다(안내 모달) */
  confirmLabel?: ReactNode;
  onConfirm?: () => void;
  /** 요청 중 확인 잠금(연타로 요청이 겹치지 않게) */
  confirmDisabled?: boolean;
  /** 취소 버튼 글자. 기본 "취소", 안내 모달은 "닫기" */
  cancelLabel?: ReactNode;
  /** 취소 버튼을 없앤다(이음 opt.noCancel) */
  hideCancel?: boolean;
  /** 발에서 취소 앞에 두는 것(이음 opt.extra) */
  extra?: ReactNode;
  /** false면 Esc · 가림막으로 닫히지 않는다 — 한 번만 보이는 값(키 발급 결과). ✕ · 취소는 닫는다 */
  dismissible?: boolean;
  /** 연 컨트롤이 닫힐 때 사라졌으면 포커스를 둘 곳 */
  returnFocusFallback?: () => HTMLElement | null;
};

// 첫 포커스 대상(이음 js/common/overlay.js:23 — .m-body input 또는 확인 버튼). 둘 다 없으면 머리 ✕.
// 입력은 input만이다 — select · textarea는 앞에 있어도 건너뛴다. 포커스를 받지 못하는 숨김 · 잠긴 input은 뺀다
const BODY_INPUT = 'input:not([type="hidden"]):not(:disabled)';
const PART = { body: 'body', confirm: 'confirm', close: 'close' } as const;
const partSelector = (part: string) => `[data-part="${part}"]`;

const initialFocusOf = (dialog: HTMLDialogElement): HTMLElement | null =>
  dialog.querySelector<HTMLElement>(`${partSelector(PART.body)} ${BODY_INPUT}`) ??
  dialog.querySelector<HTMLElement>(`${partSelector(PART.confirm)}:not(:disabled)`) ??
  dialog.querySelector<HTMLElement>(partSelector(PART.close));

export function Modal({
  open,
  onOpenChange,
  title,
  children,
  size = 'md',
  confirmLabel,
  onConfirm,
  confirmDisabled = false,
  cancelLabel = LAYER_COPY.cancel,
  hideCancel = false,
  extra,
  dismissible = true,
  returnFocusFallback,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const close = () => onOpenChange(false);
  useLayerDialog(dialogRef, {
    layer: 'modal',
    open,
    onOpenChange,
    dismissible,
    initialFocus: initialFocusOf,
    returnFocusFallback,
  });

  const hasFoot = extra !== undefined || !hideCancel || confirmLabel !== undefined;
  return createPortal(
    <>
      <Overlay layer="modal" open={open} onDismiss={dismissible ? close : undefined} />
      <dialog
        ref={dialogRef}
        className={styles.root}
        data-size={size}
        data-dismissible={dismissible}
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.head}>
          <span id={titleId}>{title}</span>
          <IconButton
            label={LAYER_COPY.close}
            icon="close"
            iconSize="xl"
            variant="on-band"
            data-part={PART.close}
            onClick={close}
          />
        </div>
        <div className={styles.body} data-part={PART.body}>
          {children}
        </div>
        {hasFoot ? (
          <div className={styles.foot}>
            {extra}
            {hideCancel ? null : <Button onClick={close}>{cancelLabel}</Button>}
            {confirmLabel !== undefined ? (
              <Button variant="primary" data-part={PART.confirm} disabled={confirmDisabled} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </>,
    document.body,
  );
}
