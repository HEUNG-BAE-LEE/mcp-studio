import { forwardRef, type ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { CloseButton } from '../layers/CloseButton';
import { LayerRoot } from '../layers/LayerRoot';
import { cx } from '../lib/cx';
import { LNB_WIDTH } from '../LNB/width';
import styles from './AlertPanel.module.css';

/** LNB 오른쪽 끝에서 알림 패널까지 간격 */
export const ALERT_PANEL_GAP = 12;
/** LNB 기본 폭 + 간격 */
const DEFAULT_LEFT = LNB_WIDTH.default + ALERT_PANEL_GAP;
/** 프레임 아래 여백 */
const DEFAULT_BOTTOM = 16;
/** 알림 ✕ */
const CLOSE_SIZE = 22;

export type AlertPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  /** 컨테이너 왼쪽에서 패널까지(px) */
  left?: number;
  /** 컨테이너 아래에서 패널까지(px) */
  bottom?: number;
  /** 알림 목록 — Notice는 기본(live 아님) 그대로(목록이 live 영역 하나를 가진다) */
  children?: ReactNode;
  /** 목록 밖 아래 줄(스크롤하지 않는다) — `모든 알림 보기` 같은 링크(Button link sm) */
  footer?: ReactNode;
  /** 포털 대상(앱 프레임 · 카탈로그 예시 상자). 없으면 body */
  container?: HTMLElement | null;
  /** 열릴 때 패널에 포커스. _guide 카탈로그 예시만 false */
  focusOnOpen?: boolean;
  className?: string;
};

/** LNB 종에서 여는 알림 패널. 프레임 기준 절대 배치 + 투명 scrim. 목록 내용은 호출자 */
export const AlertPanel = forwardRef<HTMLDivElement, AlertPanelProps>(function AlertPanel(
  {
    open,
    onOpenChange,
    title = '알림',
    left = DEFAULT_LEFT,
    bottom = DEFAULT_BOTTOM,
    children,
    footer,
    container,
    focusOnOpen = true,
    className,
  },
  ref,
) {
  return (
    <LayerRoot
      primitive={Dialog}
      open={open}
      onOpenChange={onOpenChange}
      container={container}
      scrim="none"
      layer="alert"
      focusOnOpen={focusOnOpen}
      // 설명 요소가 없으므로 Radix 기본 describedby id(없는 요소를 가리킴 · 경고)를 덮는다
      hasDescription={false}
      overlayClassName={styles.overlay}
      contentClassName={cx(styles.panel, className)}
      contentStyle={{ left, bottom }}
      ref={ref}
    >
      <div className={styles.head}>
        <Dialog.Title className={styles.title}>{title}</Dialog.Title>
        <Dialog.Close asChild>
          <CloseButton size={CLOSE_SIZE} className={styles.close} />
        </Dialog.Close>
      </div>
      {/* 목록 하나가 live 영역 — 카드(Notice)마다 두지 않는다(COMPONENTS AlertPanel) */}
      <div className={styles.list} aria-live="polite">
        {children}
      </div>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </LayerRoot>
  );
});
