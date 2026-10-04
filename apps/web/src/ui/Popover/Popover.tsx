import { type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { Popover as RadixPopover } from 'radix-ui';
import { useLayerContainer } from '../layers/layerContainer';
import { cx } from '../lib/cx';
import styles from './Popover.module.css';

const SIDE_OFFSET = 6;

type ContentProps = ComponentProps<typeof RadixPopover.Content>;

export type PopoverProps = {
  /** 단일 요소 — asChild로 트리거가 된다 */
  trigger: ReactElement;
  children: ReactNode;
  side?: ContentProps['side'];
  align?: ContentProps['align'];
  /** 층 밖에서 포털 위치(_guide · 검수용, 기본 body). 층 안이면 무시하고 그 층의 내용 상자로 포털한다 */
  container?: HTMLElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

/**
 * 트리거 아래에 뜨는 작은 층. 화살표 없음.
 * Radix Popover는 Trigger가 있어 닫을 때 포커스를 트리거로 돌려주므로 useReturnFocus가 필요 없다.
 */
export function Popover({
  trigger,
  children,
  side = 'bottom',
  align = 'start',
  container,
  open,
  onOpenChange,
  className,
}: PopoverProps) {
  // 층 안이면 층 내용 상자가 먼저다 — 앱 프레임 · body로 포털하면 `--z-inline` 층이 `--z-modal` 층 막 아래로 숨는다(Select와 같다)
  const portalTarget = useLayerContainer() ?? container ?? undefined;
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal container={portalTarget}>
        <RadixPopover.Content
          className={cx(styles.content, className)}
          side={side}
          align={align}
          sideOffset={SIDE_OFFSET}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
