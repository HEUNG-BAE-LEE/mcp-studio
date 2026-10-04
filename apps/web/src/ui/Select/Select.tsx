import { forwardRef, type ComponentProps } from 'react';
import { Select as RadixSelect } from 'radix-ui';
import { Icon } from '../icons';
import { useLayerContainer } from '../layers/layerContainer';
import { cx } from '../lib/cx';
import type { ControlSize } from '../lib/types';
import styles from './Select.module.css';

export type SelectOption = { value: string; label: string; group?: string };

/** 높이 단계(DESIGN 컨트롤 높이 단계) — lg 34(기본, 폼 · 다이얼로그) · sm 26(표 행 · 툴바 안) · xl 36(세로 폼 — Input xl과 나란히) */
type SelectSize = Extract<ControlSize, 'sm' | 'lg' | 'xl'>;

export type SelectProps = Pick<
  ComponentProps<typeof RadixSelect.Root>,
  'value' | 'defaultValue' | 'onValueChange' | 'disabled' | 'name'
> & {
  /** value는 비어 있으면 안 된다(Radix) */
  options: SelectOption[];
  placeholder?: string;
  size?: SelectSize;
  invalid?: boolean;
  /** 층 밖에서 목록 포털 위치(_guide · 검수용, 기본 body). 층 안이면 무시하고 그 층의 내용 상자로 포털한다 */
  container?: HTMLElement | null;
  className?: string;
  /** Label htmlFor 연결용 */
  id?: string;
  'aria-label'?: string;
  /** 검증 문구 · 사유 연결(Field가 얹는다) */
  'aria-describedby'?: string;
};

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    options,
    placeholder,
    size = 'lg',
    invalid = false,
    container,
    className,
    id,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    ...root
  },
  ref,
) {
  // 층 안이면 층 내용 상자가 먼저다 — 앱 프레임 · body로 포털하면 `--z-inline` 목록이 `--z-modal` 층 막 아래로 숨는다
  const portalTarget = useLayerContainer() ?? container ?? undefined;
  return (
    <RadixSelect.Root {...root}>
      <RadixSelect.Trigger
        ref={ref}
        id={id}
        className={cx(styles.trigger, className)}
        data-size={size}
        data-invalid={invalid || undefined}
        aria-invalid={invalid || undefined}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
      >
        <span className={styles.value}>
          <RadixSelect.Value placeholder={placeholder} />
        </span>
        <RadixSelect.Icon className={styles.chevron}>
          <Icon name="chevron-down" size={16} className={styles.chevronSvg} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal container={portalTarget}>
        <RadixSelect.Content
          className={styles.content}
          data-size={size}
          position="popper"
          sideOffset={6}
        >
          <RadixSelect.Viewport className={styles.viewport}>
            {options.map((o) => (
              <RadixSelect.Item key={o.value} value={o.value} className={styles.item}>
                <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
                {o.group && <span className={styles.note}>{o.group}</span>}
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
});
