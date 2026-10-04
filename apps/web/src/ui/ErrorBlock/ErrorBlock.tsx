import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { Button } from '../Button';
import { LogSurface } from '../LogView/LogSurface';
import { cx } from '../lib/cx';
import { COPY_LABELS, useCopyState, type CopyHandler, type CopyState } from '../lib/useCopyState';
import { VisuallyHidden } from '../VisuallyHidden';
import styles from './ErrorBlock.module.css';

/** 실패 블록 최대 높이(COMPONENTS ErrorBlock `maxHeight`) */
const MAX_HEIGHT = 372;

export type ErrorBlockLabels = { copy: string; copied: string; failed: string };

export type ErrorBlockProps = HTMLAttributes<HTMLDivElement> & {
  /** 실패 원문. 파싱하거나 색을 입히지 않는다 */
  raw: string;
  /** 머리 줄 문장(타임스탬프 · 드라이버 · 시도 횟수). 호출자가 서식을 만든다 */
  meta?: ReactNode;
  /** 복사(필수 — DESIGN Patterns 실패). 성공이면 2초 `복사됨`, `false`를 돌려주거나(platform.copyText 실패) 거부하면 2초 `복사 안 됨` */
  onCopy: CopyHandler;
  maxHeight?: number;
  labels?: Partial<ErrorBlockLabels>;
};

const LABELS: ErrorBlockLabels = {
  copy: COPY_LABELS.idle,
  copied: COPY_LABELS.copied,
  failed: COPY_LABELS.failed,
};
const labelOf = (state: CopyState, text: ErrorBlockLabels) =>
  state === 'copied' ? text.copied : state === 'failed' ? text.failed : text.copy;

export const ErrorBlock = forwardRef<HTMLDivElement, ErrorBlockProps>(function ErrorBlock(
  { raw, meta, onCopy, maxHeight = MAX_HEIGHT, labels, className, ...rest },
  ref,
) {
  const { state, copy } = useCopyState(onCopy);
  const text = { ...LABELS, ...labels };
  return (
    <div {...rest} className={cx(styles.root, className)} ref={ref}>
      <div className={styles.head}>
        {meta !== undefined ? <span className={styles.meta}>{meta}</span> : null}
        <Button size="sm" onClick={() => void copy()} data-copy-state={state}>
          {labelOf(state, text)}
        </Button>
        {/* 결과를 보조기기에 알린다(시각적으로는 버튼 문구가 바뀐다) */}
        <VisuallyHidden role="status">
          {state === 'idle' ? '' : labelOf(state, text)}
        </VisuallyHidden>
      </div>
      <LogSurface maxHeight={maxHeight} lines={raw.split('\n')} />
    </div>
  );
});
