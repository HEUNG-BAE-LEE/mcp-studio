import {
  cloneElement,
  forwardRef,
  useId,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { InlineMessage } from '../InlineMessage';
import { Label, type LabelProps } from '../Label';
import { cx } from '../lib/cx';
import styles from './Field.module.css';

/** Field가 컨트롤에 얹는 속성 — Input · Textarea · Select · TagInput이 받는다 */
export type FieldControlProps = {
  id?: string;
  'aria-describedby'?: string;
  invalid?: boolean;
};

type FieldBaseProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  /** 라벨 글 — Label `htmlFor`는 컨트롤 id로 잇는다(group이면 legend) */
  label: ReactNode;
  requirement?: LabelProps['requirement'];
  /** Label `hint`(칩 뒤 400 12/1.4 muted) */
  hint?: ReactNode;
  /** 검증 문구(InlineMessage). 있으면 컨트롤에 `invalid` · `aria-describedby`를 얹는다(group이면 fieldset에 describedby만) */
  message?: ReactNode;
  /** 칸 한 줄 설명(caption muted) — 컨트롤 아래 · 검증 문구 위. 컨트롤(group이면 fieldset) `aria-describedby`에 잇는다 */
  description?: ReactNode;
};

export type FieldProps = FieldBaseProps &
  (
    | {
        group?: false;
        /** 컨트롤 하나. `id`가 있으면 그대로, 없으면 Field가 만든다 */
        children: ReactElement<FieldControlProps>;
      }
    | {
        /** 묶음 칸 — 루트 fieldset + legend. SegmentedControl · Checkbox 묶음 */
        group: true;
        children: ReactNode;
      }
  );

const hasValue = (node: ReactNode) => node !== undefined && node !== null && node !== false;
/** 설명은 빈 문자열도 그리지 않는다(사유가 없는 자리) */
const hasText = (node: ReactNode) => hasValue(node) && node !== '';

const joinIds = (...ids: (string | undefined)[]) => ids.filter(Boolean).join(' ') || undefined;

/** 폼 칸 = Label + 컨트롤 하나 + 설명 + 검증 문구. id · aria-describedby · aria-invalid를 Field가 잇는다 */
export const Field = forwardRef<HTMLElement, FieldProps>(function Field(props, ref) {
  const { label, requirement, hint, message, description, children, className, group, ...rest } =
    props;
  const autoId = useId();
  const messageId = `${autoId}message`;
  const descriptionId = `${autoId}description`;
  const isInvalid = hasValue(message);
  const hasDescription = hasText(description);
  const messageNode = isInvalid ? <InlineMessage id={messageId}>{message}</InlineMessage> : null;
  const descriptionNode = hasDescription ? (
    <p id={descriptionId} className={styles.description}>
      {description}
    </p>
  ) : null;
  const ownIds = [hasDescription ? descriptionId : undefined, isInvalid ? messageId : undefined];
  if (group) {
    return (
      <fieldset
        {...rest}
        ref={ref as Ref<HTMLFieldSetElement>}
        className={cx(styles.root, styles.group, className)}
        data-part="field"
        data-group
        data-invalid={isInvalid || undefined}
        aria-describedby={joinIds(rest['aria-describedby'], ...ownIds)}
      >
        <Label as="legend" requirement={requirement} hint={hint}>
          {label}
        </Label>
        {children}
        {descriptionNode}
        {messageNode}
      </fieldset>
    );
  }
  const control = children;
  const controlId = control.props.id ?? `${autoId}control`;
  const describedBy = joinIds(control.props['aria-describedby'], ...ownIds);
  return (
    <div
      {...rest}
      ref={ref as Ref<HTMLDivElement>}
      className={cx(styles.root, className)}
      data-part="field"
      data-invalid={isInvalid || undefined}
    >
      <Label htmlFor={controlId} requirement={requirement} hint={hint}>
        {label}
      </Label>
      {/* 컨트롤 + 설명 + 검증 문구 = 둘째 줄. 칸 grid 안에서는 라벨 줄 · 이 줄이 subgrid로 옆 칸과 맞는다 */}
      <div className={styles.body}>
        {cloneElement(control, {
          id: controlId,
          'aria-describedby': describedBy,
          ...(isInvalid ? { invalid: true } : {}),
        })}
        {descriptionNode}
        {messageNode}
      </div>
    </div>
  );
});
