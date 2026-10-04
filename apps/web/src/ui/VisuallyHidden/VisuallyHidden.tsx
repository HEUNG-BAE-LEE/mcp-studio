// 보조기기에만 읽히는 글(시각 숨김). 복사 결과 안내 · 권한 비활성 사유(aria-describedby 대상) 등
import { forwardRef, type HTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import styles from './VisuallyHidden.module.css';

export type VisuallyHiddenProps = HTMLAttributes<HTMLSpanElement>;

export const VisuallyHidden = forwardRef<HTMLSpanElement, VisuallyHiddenProps>(
  function VisuallyHidden({ className, ...rest }, ref) {
    return <span {...rest} className={cx(styles.root, className)} ref={ref} />;
  },
);
