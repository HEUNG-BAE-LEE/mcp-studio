import { forwardRef, type ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { LayerContainerProvider, useLayerContentRef } from '../layers/layerContainer';
import { useReturnFocus } from '../layers/useReturnFocus';
import { cx } from '../lib/cx';
import styles from './FlowOverlay.module.css';

export type FlowOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Radix Title */
  title: ReactNode;
  /** 단계 머리(FlowStepHead). 내용 열 위에 고정 — 스크롤하지 않는다 */
  heading?: ReactNode;
  /** 내용 열(스크롤 영역). 실패 블록 · InlineMessage는 맨 끝(= 발 바로 위) */
  children?: ReactNode;
  /** 우측 슬롯(HelperPanel). 없으면 내용 열이 전체 폭 */
  aside?: ReactNode;
  /** undefined면 발 없음, 빈 노드라도 주면 발 표시. `null`을 주면 빈 발이 그려진다(`null !== undefined`) */
  footer?: ReactNode;
  /** 발 한 줄(caption muted) — 주 액션(발의 마지막 버튼) 바로 왼쪽. 비활성 주 액션의 사유 */
  note?: ReactNode;
  /** 메모 id — 비활성 주 액션 `aria-describedby`가 가리킨다 */
  noteId?: string;
  /** 포털 대상(AppShell 본문 열). 없으면 body에 fixed로 뷰포트를 덮는다 */
  container?: HTMLElement | null;
  /** Radix가 열릴 때 내용으로 포커스를 옮긴다. _guide 카탈로그 예시만 false */
  focusOnOpen?: boolean;
  className?: string;
};

/** 여러 단계 흐름(소스 추가). scrim 없이 본문 열 전체를 canvas로 덮는다 */
export const FlowOverlay = forwardRef<HTMLDivElement, FlowOverlayProps>(function FlowOverlay(
  {
    open,
    onOpenChange,
    title,
    heading,
    children,
    aside,
    footer,
    note,
    noteId,
    container,
    focusOnOpen = true,
    className,
  },
  ref,
) {
  const autoFocus = useReturnFocus(focusOnOpen);
  const [contentNode, contentRef] = useLayerContentRef(ref);
  const hasNote = note !== undefined && note !== null && note !== false;
  return (
    // modal은 기본값 true를 일부러 유지한다 — 흐름이 본문 열을 덮는 동안 LNB는 조작할 수 없고,
    // 나가기 · Esc가 유일한 출구다. modal={false}로 바꾸지 않는다
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container ?? undefined}>
        <Dialog.Content
          className={cx(styles.root, className)}
          data-contained={container ? true : undefined}
          onOpenAutoFocus={autoFocus.onOpenAutoFocus}
          onCloseAutoFocus={autoFocus.onCloseAutoFocus}
          // 설명이 없으므로 undefined를 명시해 Radix 기본 describedby id(없는 요소를 가리킴 · 경고)를 덮는다
          aria-describedby={undefined}
          ref={contentRef}
        >
          {/* 안의 Select 목록이 이 내용 상자로 포털한다(층 위에 그린다) */}
          <LayerContainerProvider value={contentNode}>
            <div className={styles.head}>
              <Dialog.Title className={styles.title}>{title}</Dialog.Title>
            </div>
            <div className={styles.body}>
              <div className={styles.content}>
                {heading !== undefined ? <div className={styles.heading}>{heading}</div> : null}
                <div className={styles.scroll} data-headed={heading !== undefined || undefined}>
                  {children}
                </div>
              </div>
              {aside}
            </div>
            {footer !== undefined ? (
              <div className={styles.foot} data-part="foot" data-note={hasNote || undefined}>
                {footer}
                {hasNote ? (
                  <span id={noteId} className={styles.note}>
                    {note}
                  </span>
                ) : null}
              </div>
            ) : null}
          </LayerContainerProvider>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
