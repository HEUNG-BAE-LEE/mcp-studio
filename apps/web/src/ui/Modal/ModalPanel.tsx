// Modal settings 내용 열 — 레일 옆 몸통. Tabs rail의 Tabs.Content가 같은 상자를 쓴다(탭 없이 그릴 때 — 불러오는 중 · 원문 — 이것을 직접 쓴다)
import { forwardRef, type HTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import styles from './ModalPanel.module.css';

/** 내용 열 상자 클래스 — Tabs rail 내용이 같은 상자를 쓴다(ui 안 공용) */
export const modalPanelClass = styles.panel;

export type ModalPanelProps = HTMLAttributes<HTMLDivElement>;

export const ModalPanel = forwardRef<HTMLDivElement, ModalPanelProps>(function ModalPanel(
  { className, ...rest },
  ref,
) {
  return <div {...rest} ref={ref} className={cx(styles.panel, className)} />;
});
