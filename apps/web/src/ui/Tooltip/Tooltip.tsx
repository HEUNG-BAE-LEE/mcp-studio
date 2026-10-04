import { type ComponentProps, type ReactNode } from 'react';
import { Tooltip as RadixTooltip } from 'radix-ui';
import { useLayerContainer } from '../layers/layerContainer';
import styles from './Tooltip.module.css';

const OPEN_DELAY_MS = 300;
const SIDE_OFFSET = 6;

type ContentProps = ComponentProps<typeof RadixTooltip.Content>;

export type TooltipProps = {
  content: ReactNode;
  side?: ContentProps['side'];
  align?: ContentProps['align'];
  /** Radix 그대로 — note는 보통 −8(아이콘 왼쪽에 맞춘다) */
  alignOffset?: ContentProps['alignOffset'];
  /** label(기본, 한 줄) · note(자동화 수준 설명: 폭 212 · 줄바꿈) */
  variant?: 'label' | 'note';
  /** 층 밖에서 포털 위치(_guide · 검수용, 기본 body). 층 안이면 무시하고 그 층의 내용 상자로 포털한다 */
  container?: HTMLElement | null;
  /** 제어 열림 — 스스로 닫히지 않는다. _guide 카탈로그 전용이며 앱 코드는 넘기지 않는다 */
  open?: boolean;
  /** 고정 위치(충돌 회피 없음)로 그릴 때 끈다 — _guide 카탈로그 전용 */
  avoidCollisions?: boolean;
  children: ReactNode;
};

function TooltipRoot({
  content,
  side = 'top',
  align,
  alignOffset,
  variant = 'label',
  container,
  open,
  avoidCollisions,
  children,
}: TooltipProps) {
  // 층 안이면 층 내용 상자가 먼저다 — 앱 프레임 · body로 포털하면 `--z-inline` 툴팁이 `--z-modal` 층 막 아래로 숨는다(Select와 같다)
  const portalTarget = useLayerContainer() ?? container ?? undefined;
  return (
    <RadixTooltip.Root open={open}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal container={portalTarget}>
        <RadixTooltip.Content
          className={styles.content}
          side={side}
          align={align}
          alignOffset={alignOffset}
          data-variant={variant}
          sideOffset={SIDE_OFFSET}
          avoidCollisions={avoidCollisions}
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

function Provider(props: ComponentProps<typeof RadixTooltip.Provider>) {
  return <RadixTooltip.Provider delayDuration={OPEN_DELAY_MS} {...props} />;
}

export const Tooltip = Object.assign(TooltipRoot, { Provider });
