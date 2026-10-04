import { cloneElement, forwardRef, type ReactElement, type ReactNode } from 'react';
import { AlertDialog } from 'radix-ui';
import { Button } from '../Button';
import { LayerRoot, type LayerScrim } from '../layers/LayerRoot';
import { cx } from '../lib/cx';
import { devWarnOnce } from '../lib/devWarnOnce';
import styles from './Dialog.module.css';

/** Dialog가 `busy`일 때 액션 요소에 얹는 속성 — Button이 받는다 */
type DialogActionProps = { disabled?: boolean; loading?: boolean };

export type DialogActions = {
  /** 요소 하나(Button). 조각 · 문자열 불가. Radix Cancel로 감싼다 — 누르면 onOpenChange(false). `busy`면 disabled */
  cancel?: ReactElement<DialogActionProps>;
  /**
   * 요소 하나(Button). 조각 · 문자열 불가. Radix Action으로 감싼다 — 호출자 onClick이 돈 뒤 닫힌다.
   * 비동기 확인은 onClick에서 `e.preventDefault()`(닫힘 막기) 뒤 요청 → `busy`. `busy`면 loading
   */
  confirm?: ReactElement<DialogActionProps>;
};

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Radix Title */
  title: ReactNode;
  /** Radix Description. 없으면 aria-describedby를 달지 않는다 */
  description?: ReactNode;
  /** 요약 상자 등(화면 몫) */
  children?: ReactNode;
  /** 없으면 액션 행을 그리지 않는다 */
  actions?: DialogActions;
  /**
   * 비동기 확인 진행 중 — 확인 loading · 취소 disabled · Esc로 닫히지 않는다(onOpenChange를 부르지 않는다) · `data-busy`.
   * 성공하면 호출자가 onOpenChange(false), 실패하면 열어 둔 채 children에 ErrorBlock
   */
  busy?: boolean;
  /** 포털 대상(앱 프레임 · 카탈로그 예시 상자). 없으면 body */
  container?: HTMLElement | null;
  /** Radix가 열릴 때 내용으로 포커스를 옮긴다. _guide 카탈로그 예시만 false */
  focusOnOpen?: boolean;
  /** scrim 종류 — none은 scrim 없이 덮는다(카탈로그 예시) */
  scrim?: LayerScrim;
  /** 여는 컨트롤이 닫힐 때 사라졌으면(확인으로 행이 삭제된 경우) 포커스를 둘 곳 */
  returnFocusFallback?: () => HTMLElement | null;
  className?: string;
};

/** 액션은 Button만(COMPONENTS Dialog) — 다른 요소는 busy 속성(disabled · loading)을 받지 못한다. 개발 빌드에서 한 번 경고 */
const warnIfNotButton = (slot: keyof DialogActions, element: ReactElement | undefined) => {
  if (element === undefined || element.type === Button) return;
  devWarnOnce(
    `dialog-action:${slot}`,
    `[Dialog] actions.${slot}는 Button 요소 하나만 받는다 — busy일 때 disabled · loading을 얹지 못한다`,
  );
};

/** 진행 중이면 액션 요소에 속성을 얹는다(요소 하나 — Radix asChild가 감싼다) */
const withBusy = (
  element: ReactElement<DialogActionProps>,
  busy: boolean,
  props: DialogActionProps,
) => (busy ? cloneElement(element, props) : element);

/** 되돌릴 수 없는 확인 다이얼로그(Radix AlertDialog). 바깥 클릭으로는 닫히지 않는다 */
export const Dialog = forwardRef<HTMLDivElement, DialogProps>(function Dialog(
  {
    open,
    onOpenChange,
    title,
    description,
    children,
    actions,
    busy = false,
    container,
    focusOnOpen = true,
    scrim = 'default',
    returnFocusFallback,
    className,
  },
  ref,
) {
  warnIfNotButton('cancel', actions?.cancel);
  warnIfNotButton('confirm', actions?.confirm);
  return (
    <LayerRoot
      primitive={AlertDialog}
      open={open}
      onOpenChange={(next) => {
        // 진행 중에는 닫지 않는다 — 결과(성공 · 실패)를 보고 호출자가 닫는다
        if (busy && !next) return;
        onOpenChange(next);
      }}
      container={container}
      scrim={scrim}
      focusOnOpen={focusOnOpen}
      returnFocusFallback={returnFocusFallback}
      dismissible={!busy}
      // 설명이 없으면 Radix 기본 describedby id(없는 요소)를 덮는다
      hasDescription={description !== undefined}
      contentClassName={cx(styles.content, className)}
      contentProps={{ 'data-busy': busy || undefined }}
      ref={ref}
    >
      <AlertDialog.Title className={styles.title}>{title}</AlertDialog.Title>
      {description !== undefined ? (
        <AlertDialog.Description className={styles.description}>
          {description}
        </AlertDialog.Description>
      ) : null}
      {children}
      {actions ? (
        <div className={styles.actions} data-part="actions">
          {actions.cancel ? (
            <AlertDialog.Cancel asChild>
              {withBusy(actions.cancel, busy, { disabled: true })}
            </AlertDialog.Cancel>
          ) : null}
          {actions.confirm ? (
            <AlertDialog.Action asChild>
              {withBusy(actions.confirm, busy, { loading: true })}
            </AlertDialog.Action>
          ) : null}
        </div>
      ) : null}
    </LayerRoot>
  );
});
