import { forwardRef, type LabelHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './Label.module.css';

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  requirement?: 'required' | 'optional';
  /** 칩 뒤 보조 문구 — 400 12/1.4 muted */
  hint?: ReactNode;
  /** legend — 묶음 칸(Field `group`)의 fieldset 라벨. `htmlFor`는 쓰지 않는다 */
  as?: 'label' | 'legend';
};

const REQUIREMENT_TEXT = { required: '필수', optional: '선택' } as const;

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { requirement, hint, as = 'label', className, children, htmlFor, ...rest },
  ref,
) {
  const content = (
    <>
      {children}
      {requirement && (
        <span className={styles.chip} data-requirement={requirement}>
          {REQUIREMENT_TEXT[requirement]}
        </span>
      )}
      {/* undefined만 건너뛴다 — 빈 문자열 hint도 빈 요소(gap)를 남기는 공통 규칙 */}
      {hint !== undefined && <span className={styles.hint}>{hint}</span>}
    </>
  );
  if (as === 'legend')
    return (
      <legend className={cx(styles.root, styles.legend, className)} id={rest.id}>
        {content}
      </legend>
    );
  return (
    <label {...rest} htmlFor={htmlFor} className={cx(styles.root, className)} ref={ref}>
      {content}
    </label>
  );
});
