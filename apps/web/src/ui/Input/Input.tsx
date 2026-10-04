import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import type { ControlSize } from '../lib/types';
import styles from './Input.module.css';

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  /** 높이 단계(DESIGN 컨트롤 높이 단계) — sm-plus 28(영역 머리 검색 · 400 12) · lg 34(400 14) · xl 36(폼 기본) · 2xl 38(흐름 입력) */
  size?: Extract<ControlSize, 'sm-plus' | 'lg' | 'xl' | '2xl'>;
  /** `ui`(기본) · `heading` = 화면 제목 그 자리 편집(`h1` 600 24/1.35 — InlineEdit, `lg`와 쓴다) */
  textStyle?: 'ui' | 'heading';
  mono?: boolean;
  invalid?: boolean;
  /**
   * 입력 안 우측 장식 슬롯(중복 표식 등). prop을 주면(값이 `null`이어도) 루트가 래퍼 `<span>`이 되고 우 여백 38을 유지한다 —
   * 표식이 생기고 사라져도 `<input>`이 재마운트되지 않아 포커스가 끊기지 않는다.
   * 이때 `className`은 래퍼 `<span>`에 붙고(입력 폭은 래퍼가 100%), `ref`와 나머지 속성은 `<input>`에 간다
   */
  trailing?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'xl', textStyle = 'ui', mono = false, invalid = false, trailing, className, ...rest },
  ref,
) {
  const hasTrailing = trailing !== undefined;
  const input = (
    <input
      {...rest}
      className={cx(styles.root, !hasTrailing && className)}
      data-size={size}
      data-text-style={textStyle}
      data-mono={mono || undefined}
      data-invalid={invalid || undefined}
      data-trailing={hasTrailing || undefined}
      aria-invalid={invalid || undefined}
      ref={ref}
    />
  );
  if (!hasTrailing) return input;
  return (
    <span className={cx(styles.wrap, className)}>
      {input}
      <span className={styles.trailing}>{trailing}</span>
    </span>
  );
});
