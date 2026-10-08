// GNB — 이음 index.html:24-34 · css/console.css:83-95,489-493. 회사 · 사용자는 useSources의 workspace(js/main.js:66) —
// 받기 전 · 실패면 비운다(아바타도 빈 원). 회사 버튼은 동작이 없어도 버튼 그대로(이음 그대로), 장식 아이콘은 포커스 없는 span(index.html:29-31)
import type { Workspace } from '../../api/types';
import { Icon, Logo } from '@/ui';
import { GNB } from '../../copy/shell';
import styles from './Gnb.module.css';

export type GnbProps = {
  /** 회사 · 사용자. 받기 전 · 실패면 undefined */
  workspace?: Workspace;
  /** "1차 개발 범위" 버튼 */
  onScopeOpen: () => void;
};

/** 아바타 글자 — 사용자 이름 첫 글자, 이름이 비면 "?"(js/main.js:66). workspace가 없으면 비운다 */
const avatarOf = (workspace?: Workspace): string =>
  workspace ? (workspace.user || GNB.avatarFallback).slice(0, 1) : '';

export function Gnb({ workspace, onScopeOpen }: GnbProps) {
  return (
    <header className={styles.gnb}>
      {/* 이음 원본과 같은 이름(aria-label) — 로고 글자와 표지를 한 이름으로 읽는다 */}
      <div className={styles.logo} aria-label={GNB.logoLabel}>
        <Logo size={26} />
        {GNB.logoName}
        <span className={styles.badge}>{GNB.logoBadge}</span>
      </div>
      <button type="button" className={styles.company}>
        <span className={styles.dot} aria-hidden="true" />
        <span>{workspace?.company}</span>
      </button>
      <div className={styles.end}>
        <button type="button" className={styles.scope} onClick={onScopeOpen}>
          {GNB.scope}
        </button>
        <span className={styles.decor} data-narrow="hide">
          <Icon name="doc" size="shell" />
        </span>
        <span className={styles.decor}>
          <Icon name="bell" size="shell" />
        </span>
        <span className={styles.decor} data-narrow="hide">
          <Icon name="help" size="shell" />
        </span>
        <span className={styles.me}>
          <span className={styles.avatar}>{avatarOf(workspace)}</span>
          <span data-narrow="hide">{workspace?.user}</span>
        </span>
      </div>
    </header>
  );
}
