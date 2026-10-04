import { forwardRef, useId, type ComponentProps, type ReactNode } from 'react';
import { Checkbox as RadixCheckbox } from 'radix-ui';
import { cx } from '../lib/cx';
import styles from './Checkbox.module.css';

export type CheckboxProps = ComponentProps<typeof RadixCheckbox.Root> & {
  /**
   * 보이는 라벨 한 줄(Checkbox 묶음 항목 · 표 밖 단독 Checkbox). 주면 루트가 `<span>` 래퍼가 되고
   * `className`은 래퍼, `ref` · 나머지 속성은 상자에 간다(Input `trailing`과 같다). 표 선택 열은 `aria-label`
   */
  label?: ReactNode;
};

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
  { className, label, id, ...rest },
  ref,
) {
  const autoId = useId();
  const hasLabel = label !== undefined;
  const boxId = id ?? (hasLabel ? autoId : undefined);
  const box = (
    <RadixCheckbox.Root
      ref={ref}
      id={boxId}
      className={cx(styles.root, !hasLabel && className)}
      {...rest}
    >
      <RadixCheckbox.Indicator className={styles.indicator}>✓</RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
  if (!hasLabel) return box;
  return (
    <span className={cx(styles.field, className)} data-disabled={rest.disabled || undefined}>
      {box}
      <label htmlFor={boxId} className={styles.label}>
        {label}
      </label>
    </span>
  );
});
