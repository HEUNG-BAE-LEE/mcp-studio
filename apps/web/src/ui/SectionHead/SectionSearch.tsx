// 영역 머리 검색 입력(SectionHead `tools`) — Input sm-plus · 폭 150, 1024는 110. 이름은 자리표시 문구로 준다
import { forwardRef } from 'react';
import { Input, type InputProps } from '../Input';
import { cx } from '../lib/cx';
import styles from './SectionSearch.module.css';

export type SectionSearchProps = Omit<InputProps, 'size' | 'onChange' | 'value' | 'placeholder'> & {
  value: string;
  onValueChange: (value: string) => void;
  /** 자리표시 문구 = 접근 가능한 이름(`이름 · 타입 검색`) */
  placeholder: string;
  /** 1024 폭 — 폭 110 */
  narrow?: boolean;
};

export const SectionSearch = forwardRef<HTMLInputElement, SectionSearchProps>(
  function SectionSearch(
    { value, onValueChange, placeholder, narrow = false, className, ...rest },
    ref,
  ) {
    return (
      <Input
        {...rest}
        ref={ref}
        size="sm-plus"
        className={cx(styles.search, className)}
        data-narrow={narrow || undefined}
        placeholder={placeholder}
        aria-label={rest['aria-label'] ?? placeholder}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      />
    );
  },
);
