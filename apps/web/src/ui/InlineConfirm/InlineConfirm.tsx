import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Button } from '../Button';
import { InlineMessage } from '../InlineMessage';
import { cx } from '../lib/cx';
import styles from './InlineConfirm.module.css';

export type InlineConfirmProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 확인 문장. 문자열이면 group의 접근 가능한 이름이 된다 */
  message: ReactNode;
  confirmLabel: string;
  /** `취소`. 확인 라벨에 `취소`가 들어가면(`초대 취소`) `닫기` */
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** 진행 중. 확인 버튼 loading(라벨은 호출자가 진행형으로) · 취소 disabled · Esc 무시 */
  busy?: boolean;
  /** 열릴 때 확인 버튼으로 포커스를 옮긴다(DESIGN 접근성 · 표 행 확인 줄). 확인 줄이 열리는 순간에만 렌더한다. 카탈로그처럼 정적으로 여러 개를 그릴 때는 false */
  focusOnMount?: boolean;
  /** 아는 code로 거부된 한 줄(copy 틀) — 줄 안 아래 InlineMessage · 확인 버튼 aria-describedby */
  rejection?: ReactNode;
};

export const InlineConfirm = forwardRef<HTMLDivElement, InlineConfirmProps>(function InlineConfirm(
  {
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    busy = false,
    focusOnMount = true,
    rejection,
    className,
    onKeyDown,
    ...rest
  },
  ref,
) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const rejectionId = useId();
  const isRejected = rejection !== undefined && rejection !== null && rejection !== false;

  // 확인 줄이 열릴 때 포커스를 옮긴다 — DESIGN 접근성 · 표 행 확인 줄
  useEffect(() => {
    if (focusOnMount) confirmRef.current?.focus();
  }, [focusOnMount]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.key !== 'Escape' || busy) return;
    event.stopPropagation();
    onCancel();
  };

  return (
    // Esc는 안쪽 버튼에서 버블링된 키를 받는다 — 그룹 자체는 포커스를 받지 않는다
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      {...rest}
      role="group"
      aria-label={typeof message === 'string' ? message : rest['aria-label']}
      className={cx(styles.root, className)}
      data-busy={busy || undefined}
      data-rejected={isRejected || undefined}
      onKeyDown={handleKeyDown}
      ref={ref}
    >
      <span className={styles.message}>{message}</span>
      <span className={styles.actions}>
        <Button
          variant="danger"
          size="sm"
          loading={busy}
          onClick={onConfirm}
          aria-describedby={isRejected ? rejectionId : undefined}
          ref={confirmRef}
        >
          {confirmLabel}
        </Button>
        <Button size="sm" disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </Button>
      </span>
      {isRejected ? (
        <InlineMessage id={rejectionId} className={styles.rejection}>
          {rejection}
        </InlineMessage>
      ) : null}
    </div>
  );
});
