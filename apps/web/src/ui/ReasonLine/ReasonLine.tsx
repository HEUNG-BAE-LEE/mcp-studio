import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './ReasonLine.module.css';

export type ReasonLineProps = Omit<
  HTMLAttributes<HTMLParagraphElement>,
  'id' | 'children' | 'aria-live'
> & {
  /** 잠긴 컨트롤 `aria-describedby` 대상 — 호출자가 useId()로 만든다 */
  id: string;
  /** 사유 한 줄(copy). 없으면(`undefined` · `null` · `false` · `''`) 자리를 차지하지 않는다 */
  children?: ReactNode;
  /** 입력에 따라 사유가 바뀌는 자리 — `aria-live="polite"`. 사유가 없을 때도 요소를 시각 숨김으로 남긴다 */
  live?: boolean;
  /** 사유가 없어도 한 줄 높이(`1lh`)를 비워 둔다 — 사유가 생기고 사라질 때 아래 내용이 뛰지 않게(`data-reserve`) */
  reserve?: boolean;
};

const isEmptyReason = (node: ReactNode) =>
  node === undefined || node === null || node === false || node === '';

/** 잠긴 액션 바로 아래 사유 한 줄(caption muted — SectionHead `reason`과 같은 글자). 영역 머리 · 층 발 밖의 액션 */
export const ReasonLine = forwardRef<HTMLParagraphElement, ReasonLineProps>(function ReasonLine(
  { id, children, live = false, reserve = false, className, ...rest },
  ref,
) {
  const isEmpty = isEmptyReason(children);
  if (isEmpty && !live && !reserve) return null;
  return (
    <p
      {...rest}
      ref={ref}
      id={id}
      className={cx(styles.root, className)}
      data-empty={isEmpty || undefined}
      data-reserve={reserve || undefined}
      aria-live={live ? 'polite' : undefined}
    >
      {isEmpty ? null : children}
    </p>
  );
});
