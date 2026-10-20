// Overlay — 층 뒤 가림막(이음 .overlay · .overlay.m — css/console.css:239-241, index.html:42,44). 층 부품 안쪽 전용
import styles from './Overlay.module.css';
import type { LayerKind } from './stack';

export type OverlayProps = {
  layer: LayerKind;
  open: boolean;
  /** 누르면 부른다. 층이 dismissible=false면 주지 않는다 */
  onDismiss?: () => void;
};

export function Overlay({ layer, open, onDismiss }: OverlayProps) {
  // 장식이라 보조기기에 숨긴다. 키보드는 Esc로 닫는다(ui/layers/stack)
  return (
    <div
      className={styles.root}
      data-layer={layer}
      data-open={open}
      aria-hidden="true"
      role="presentation"
      onClick={open ? onDismiss : undefined}
    />
  );
}
