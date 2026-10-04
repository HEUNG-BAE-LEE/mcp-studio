import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { AlertDialog, Dialog } from 'radix-ui';
import { cx } from '../lib/cx';
import layer from './layer.module.css';
import { LayerContainerProvider, useLayerContentRef } from './layerContainer';
import { useReturnFocus } from './useReturnFocus';

/** 층 scrim 종류. none은 scrim 없이 덮는다(알림 패널 · 카탈로그 예시) */
export type LayerScrim = 'default' | 'light' | 'none';

type LayerRootProps = {
  /** Radix 네임스페이스. Dialog 또는 AlertDialog(바깥 클릭으로 안 닫히는 확인 층) */
  primitive: typeof Dialog | typeof AlertDialog;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 포털 대상(앱 프레임 · 카탈로그 예시 상자). 없으면 body */
  container?: HTMLElement | null;
  scrim?: LayerScrim;
  /** 오버레이 `data-layer` 값. 프레임 위치가 다른 층만 준다 */
  layer?: string;
  /** Radix가 열릴 때 내용으로 포커스를 옮긴다. _guide 카탈로그 예시만 false */
  focusOnOpen?: boolean;
  /** false면 `aria-describedby`를 undefined로 덮는다(Radix 기본 id가 없는 요소를 가리켜 경고) */
  hasDescription?: boolean;
  /** 여는 컨트롤을 기억한 뒤(useReturnFocus) 불린다. SearchOverlay가 입력으로 포커스를 옮길 때 쓴다 */
  onOpenAutoFocus?: (event: Event) => void;
  /** 여는 컨트롤이 닫힐 때 사라졌으면 포커스를 둘 곳(useReturnFocus) */
  returnFocusFallback?: () => HTMLElement | null;
  /** false면 Esc · 바깥 클릭으로 닫히지 않는다(✕ · 호출자 닫기 버튼은 그대로). 기본 true */
  dismissible?: boolean;
  overlayClassName?: string;
  overlayStyle?: CSSProperties;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  /** 내용 상자에 그대로 얹는 속성(`data-*` 등) */
  contentProps?: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, unknown>;
  children?: ReactNode;
};

/**
 * Modal · Dialog · SearchOverlay · AlertPanel 공통 스캐폴드(내부 전용).
 * Root → Portal(container) → Overlay(scrim · contained) → Content(포커스 복귀 · describedby · ref).
 */
export const LayerRoot = forwardRef<HTMLDivElement, LayerRootProps>(function LayerRoot(
  {
    primitive,
    open,
    onOpenChange,
    container,
    scrim = 'default',
    layer: layerName,
    focusOnOpen = true,
    hasDescription = true,
    onOpenAutoFocus,
    returnFocusFallback,
    dismissible = true,
    overlayClassName,
    overlayStyle,
    contentClassName,
    contentStyle,
    contentProps,
    children,
  },
  ref,
) {
  const autoFocus = useReturnFocus(focusOnOpen, returnFocusFallback);
  const [contentNode, contentRef] = useLayerContentRef(ref);
  // 닫히지 않는 층 — Esc · 바깥 누름을 막는다. 기본(닫힘)일 때는 핸들러를 달지 않아 Radix 기본(AlertDialog의 바깥 막힘 포함)을 지킨다
  const blockDismiss = dismissible
    ? {}
    : {
        onEscapeKeyDown: (event: Event) => event.preventDefault(),
        onPointerDownOutside: (event: Event) => event.preventDefault(),
        onInteractOutside: (event: Event) => event.preventDefault(),
      };
  // AlertDialog의 Root · Portal · Overlay · Content는 Dialog와 같은 props를 받는다(Radix가 Dialog를 감싼 것) — 타입만 Dialog로 맞춘다
  const Primitive = primitive as typeof Dialog;
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal container={container ?? undefined}>
        <Primitive.Overlay
          className={cx(layer.overlay, overlayClassName)}
          style={overlayStyle}
          data-layer={layerName}
          data-scrim={scrim}
          data-contained={container ? true : undefined}
        >
          <Primitive.Content
            {...contentProps}
            className={contentClassName}
            style={contentStyle}
            onOpenAutoFocus={(event) => {
              autoFocus.onOpenAutoFocus(event);
              onOpenAutoFocus?.(event);
            }}
            onCloseAutoFocus={autoFocus.onCloseAutoFocus}
            {...blockDismiss}
            {...(hasDescription ? {} : { 'aria-describedby': undefined })}
            ref={contentRef}
          >
            {/* 안의 Select 목록이 이 내용 상자로 포털한다(층 막 위에 그린다) */}
            <LayerContainerProvider value={contentNode}>{children}</LayerContainerProvider>
          </Primitive.Content>
        </Primitive.Overlay>
      </Primitive.Portal>
    </Primitive.Root>
  );
});
