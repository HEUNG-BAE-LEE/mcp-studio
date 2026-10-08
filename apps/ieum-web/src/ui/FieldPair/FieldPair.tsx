// FieldPair — 칸 하나를 두 칸으로 나누는 격자. half = 반반(이음 .two css/console.css:923, 760 :1064) · label = 라벨 + 값 줄(이음 .ep-row :794-795, 760 :905)
// 라벨은 보이는 글자(<span>)다 — 값이 입력이 아니라 주소 칸 · 글이라 <label>로 잇지 않는다(옛 그대로)
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './FieldPair.module.css';

export type FieldPairVariant = 'half' | 'label';

type FieldPairBase = {
  /** 배치(바깥 여백)만 */
  className?: string;
};

export type FieldPairProps =
  | (FieldPairBase & {
      /** 반반 — 두 칸 */
      variant: 'half';
      children: [ReactNode, ReactNode];
    })
  | (FieldPairBase & {
      /** 라벨 + 값 줄 */
      variant: 'label';
      /** 왼쪽 라벨 글자 */
      label: ReactNode;
      /** 값 */
      children: ReactNode;
    });

export function FieldPair(props: FieldPairProps) {
  if (props.variant === 'half') {
    return (
      <div className={cx(styles.root, props.className)} data-variant="half">
        {props.children}
      </div>
    );
  }
  return (
    <div className={cx(styles.root, props.className)} data-variant="label">
      <span className={styles.label}>{props.label}</span>
      <div>{props.children}</div>
    </div>
  );
}
