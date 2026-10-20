// EvidenceBadge — 탐색 근거 표지("소스" · "트래픽"). 이음 .evb(css/console.css:1041-1044) · 쓰는 곳 js/menu/discovery.js:282
// 근거가 있으면 도메인 색(--evidence-*)이고, 없으면 Tag의 "없음" 모양(mute · off — 점선 + 취소선)이다.
// 도메인 색이라 Tag의 tone에 넣지 않고 이 부품이 맡는다. 글자는 쓰는 곳이 넘긴다
import type { ReactNode } from 'react';
import { Tag } from '../Tag';
import styles from './EvidenceBadge.module.css';

/** code = Git 소스 근거, traffic = 운영 트래픽 근거 */
export type EvidenceKind = 'code' | 'traffic';

export type EvidenceBadgeProps = {
  /** 근거 — 색이 갈린다 */
  kind: EvidenceKind;
  /** 이 근거가 있음. false면 "없음" 표지(점선 · 취소선) — 이때 kind의 색은 쓰지 않는다 */
  on: boolean;
  /** 글자 */
  children: ReactNode;
};

export function EvidenceBadge({ kind, on, children }: EvidenceBadgeProps) {
  if (!on) {
    return (
      <Tag tone="mute" variant="off" size="md" className={styles.root}>
        {children}
      </Tag>
    );
  }
  return (
    <span className={styles.root} data-kind={kind}>
      {children}
    </span>
  );
}
