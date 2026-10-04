import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
} from 'react';
import { isAtBottom } from './follow';
import { LogSurface } from './LogSurface';

export type LogViewProps = Omit<HTMLAttributes<HTMLPreElement>, 'children'> & {
  /** 줄 배열 — 줄마다 span 블록(surface는 줄마다 내어쓰기, soft는 줄 gap 4) (변경하지 않는다). 새 배열을 주면 효과가 다시 돌지만 바닥에 있을 때만 스크롤한다 */
  lines: readonly string[];
  /** 최소 높이(px). soft는 생략 가능 */
  maxHeight?: number;
  /** 흐름 진행 로그 110 */
  minHeight?: number;
  /** surface(ErrorBlock, 기본) · soft(설정 · 흐름) */
  variant?: 'surface' | 'soft';
  /** 바닥에 있을 때만 새 줄을 따라간다. 기본 true */
  follow?: boolean;
};

export const LogView = forwardRef<HTMLPreElement, LogViewProps>(function LogView(
  { lines, maxHeight, minHeight, variant = 'surface', follow = true, onScroll, ...rest },
  ref,
) {
  const pre = useRef<HTMLPreElement>(null);
  const atBottom = useRef(true);
  // 호출은 마운트 뒤에만 일어나므로 pre.current는 null이 아니다
  useImperativeHandle(ref, () => pre.current as HTMLPreElement);
  useLayoutEffect(() => {
    const el = pre.current;
    if (el && follow && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [lines, follow]);
  return (
    <LogSurface
      {...rest}
      maxHeight={maxHeight}
      minHeight={minHeight}
      variant={variant}
      onScroll={(e) => {
        atBottom.current = isAtBottom(e.currentTarget);
        onScroll?.(e);
      }}
      lines={lines}
      ref={pre}
    />
  );
});
