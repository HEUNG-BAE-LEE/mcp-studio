import { forwardRef, type HTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import styles from './LogSurface.module.css';

type LogSurfaceProps = Omit<HTMLAttributes<HTMLPreElement>, 'children'> & {
  /** 논리 줄(`\n`으로 나뉜 원문 줄). 줄마다 블록 하나 — 내어쓰기 · 빈 줄 높이가 줄마다 걸린다 */
  lines: readonly string[];
  maxHeight?: number;
  minHeight?: number;
  /** surface(ErrorBlock, 기본) · soft(설정 · 흐름 — surface-subtle · 줄 상자) */
  variant?: 'surface' | 'soft';
};

/** ErrorBlock · LogView가 함께 쓰는 <pre> 표면(COMPONENTS ErrorBlock · LogView). 패키지 밖으로 내보내지 않는다 */
export const LogSurface = forwardRef<HTMLPreElement, LogSurfaceProps>(function LogSurface(
  { lines, maxHeight, minHeight, variant = 'surface', className, style, ...rest },
  ref,
) {
  return (
    <pre
      {...rest}
      className={cx(styles.pre, className)}
      data-variant={variant}
      style={{ ...style, maxHeight, minHeight }}
      ref={ref}
    >
      {/* 줄 내용이 같을 수 있어(같은 로그 줄) 순번을 key로 쓴다 — 줄은 덧붙기만 한다 */}
      {lines.map((line, i) => (
        <span key={i} className={styles.line}>
          {line}
        </span>
      ))}
    </pre>
  );
});
