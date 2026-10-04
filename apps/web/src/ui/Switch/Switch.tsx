import { forwardRef, type ComponentProps } from 'react';
import { Switch as RadixSwitch } from 'radix-ui';
import { cx } from '../lib/cx';
import styles from './Switch.module.css';

export type SwitchProps = ComponentProps<typeof RadixSwitch.Root>;

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { className, ...rest },
  ref,
) {
  return (
    <RadixSwitch.Root ref={ref} className={cx(styles.root, className)} {...rest}>
      <RadixSwitch.Thumb className={styles.thumb} />
    </RadixSwitch.Root>
  );
});
