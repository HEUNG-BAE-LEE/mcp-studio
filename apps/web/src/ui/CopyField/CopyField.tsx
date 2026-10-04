// 연결 정보의 복사 행 — 라벨 · mono 값 칸 · 복사 버튼
import { forwardRef, type HTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import { COPY_LABELS, useCopyState, type CopyHandler, type CopyState } from '../lib/useCopyState';
import { VisuallyHidden } from '../VisuallyHidden';
import styles from './CopyField.module.css';

export type CopyFieldProps = Omit<HTMLAttributes<HTMLDivElement>, 'onCopy'> & {
  label: string;
  value: string;
  /**
   * 복사(호출자가 `platform.copyText(value)` 결과를 그대로 돌려준다). 성공 `복사됨` · 실패(`false` · 거부) 2초 `복사 안 됨`.
   * 없으면 복사 버튼 · `role=status` 안내 없이 값만(읽기 전용 — 설정 접속 정보)
   */
  onCopy?: CopyHandler;
  /** `복사됨` 유지 시간 — 기본 2초, `null`이면 다음 누름 · 언마운트까지(연결 정보 모달) */
  copiedMs?: number | null;
  copyLabel?: string;
  copiedLabel?: string;
  failedLabel?: string;
};

/** 연결 정보의 복사 행(라벨 92 + 값 + 복사). 복사 자체는 호출자(platform.copyText)가 한다 */
export const CopyField = forwardRef<HTMLDivElement, CopyFieldProps>(function CopyField(
  {
    label,
    value,
    onCopy,
    copiedMs,
    copyLabel = COPY_LABELS.idle,
    copiedLabel = COPY_LABELS.copied,
    failedLabel = COPY_LABELS.failed,
    className,
    ...rest
  },
  ref,
) {
  const { state, copy } = useCopyState(onCopy, { copiedMs });
  const text: Record<CopyState, string> = {
    idle: copyLabel,
    copied: copiedLabel,
    failed: failedLabel,
  };
  return (
    <div {...rest} className={cx(styles.root, className)} ref={ref}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value} title={value}>
        {value}
      </span>
      {onCopy && (
        <>
          <button
            type="button"
            className={styles.copy}
            onClick={() => void copy()}
            aria-label={`${label} ${text[state]}`}
            data-copy-state={state}
          >
            {text[state]}
          </button>
          {/* 결과를 보조기기에 알린다(시각적으로는 버튼 문구가 바뀐다) */}
          <VisuallyHidden role="status">
            {state === 'idle' ? '' : `${label} ${text[state]}`}
          </VisuallyHidden>
        </>
      )}
    </div>
  );
});
