// Notice — 이음 알림 상자(.notice · warn · mute · danger — css/console.css:270-272,643-650): 아이콘 + 문장 + 오른쪽 버튼(있는 자리만).
// role을 두지 않는다(알림이 아니라 그 자리의 글). 아이콘은 장식이고 뜻은 문장이 전한다
import type { ReactNode } from 'react';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/names';
import { cx } from '../lib/cx';
import styles from './Notice.module.css';

export type NoticeTone = 'info' | 'warn' | 'danger' | 'mute';

export type NoticeProps = {
  /** 바탕 · 아이콘 색. 기본 info */
  tone?: NoticeTone;
  /** 아이콘(lg). 생략하면 tone별 기본 — info · mute → info, warn · danger → alert */
  icon?: IconName;
  /** 오른쪽 버튼(Button size="sm") */
  action?: ReactNode;
  /** 문장 — 굵은 글(<b>)은 --text */
  children: ReactNode;
  /** 배치(바깥 여백)만 */
  className?: string;
};

const DEFAULT_ICON: Readonly<Record<NoticeTone, IconName>> = {
  info: 'info',
  mute: 'info',
  warn: 'alert',
  danger: 'alert',
};

export function Notice({ tone = 'info', icon, action, children, className }: NoticeProps) {
  return (
    <div className={cx(styles.root, className)} data-tone={tone}>
      <Icon name={icon ?? DEFAULT_ICON[tone]} size="lg" className={styles.icon} />
      <div className={styles.text}>{children}</div>
      {action !== undefined ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
