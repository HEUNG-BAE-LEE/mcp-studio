import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import styles from './Textarea.module.css';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid = false, rows = 2, className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cx(styles.root, className)}
      data-invalid={invalid || undefined}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});
