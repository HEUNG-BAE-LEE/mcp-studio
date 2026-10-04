import { forwardRef, useState } from 'react';
import { ToggleGroup } from 'radix-ui';
import { cx } from '../lib/cx';
import type { ControlSize } from '../lib/types';
import styles from './SegmentedControl.module.css';

export type SegmentItem = { value: string; label: string };

/** 높이 단계 — lg 34(기본, 폼 · 흐름 안 전환) · sm-plus 28(머리 도구 자리 필터 — SectionHead `tools` · PageHeader 화면 필터) */
export type SegmentedControlSize = Extract<ControlSize, 'sm-plus' | 'lg'>;

export type SegmentedControlProps = {
  items: readonly SegmentItem[];
  size?: SegmentedControlSize;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  className?: string;
  'aria-label'?: string;
};

export const SegmentedControl = forwardRef<HTMLDivElement, SegmentedControlProps>(
  function SegmentedControl(
    { items, size = 'lg', value, defaultValue, onValueChange, className, ...rest },
    ref,
  ) {
    // Radix single은 재클릭 시 ''를 내므로 값을 직접 쥐고 빈 값은 무시한다 — 항상 하나 선택
    const [inner, setInner] = useState(defaultValue ?? items[0]?.value ?? '');
    const isControlled = value !== undefined;
    const current = isControlled ? value : inner;
    return (
      <ToggleGroup.Root
        ref={ref}
        type="single"
        className={cx(styles.root, className)}
        data-size={size}
        value={current}
        onValueChange={(next: string) => {
          if (!next) return;
          if (!isControlled) setInner(next);
          onValueChange?.(next);
        }}
        {...rest}
      >
        {items.map((item) => (
          <ToggleGroup.Item key={item.value} value={item.value} className={styles.item}>
            {item.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    );
  },
);
