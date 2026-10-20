// Notice — 이음 알림 상자(.notice · warn · mute · danger — css/console.css:270-272,643-650): 아이콘 + 문장 + 오른쪽 버튼(있는 자리만).
// role을 두지 않는다(알림이 아니라 그 자리의 글). 아이콘은 장식이고 뜻은 문장이 전한다
// variant line은 한 줄 상태 줄이다(탐색 실시간 "지금 하는 일" 줄 — .dact css/console.css:948-951). 모양은 variant로만 바뀌고,
// 오른쪽 끝 글(trailing)은 line에서만 받는다. 아이콘 선 굵기는 아이콘마다 쓰는 곳이 iconStroke로 준다 —
// 옛 한 줄 상태 줄은 완료 체크만 굵고(svg('check', 15, 2.6)) 예약 history는 기본 굵기였다(js/menu/discovery.js:228)
import type { ReactNode } from 'react';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/names';
import type { IconStroke } from '../icons/steps';
import { cx } from '../lib/cx';
import { Spinner } from '../Spinner';
import styles from './Notice.module.css';

export type NoticeTone = 'info' | 'warn' | 'danger' | 'mute';

/** default = 안내 · 경고 상자, line = 한 줄 상태 줄(앞자리 · 문장 · 끝 글을 가운데 맞춤으로 한 줄에) */
export type NoticeVariant = 'default' | 'line';

/** 앞자리 — 아이콘 또는 도는 원, 둘을 함께 쓰지 않는다. 선 굵기(iconStroke)는 아이콘을 줄 때만 */
type NoticeLead =
  | { icon?: IconName; iconStroke?: never; spinner?: false }
  | {
      icon: IconName;
      /** 아이콘 선 굵기 단계 — 생략하면 Icon 기본 */
      iconStroke: IconStroke;
      spinner?: false;
    }
  | { icon?: never; iconStroke?: never; spinner: true };

/** 변형별 오른쪽 자리 — default는 작은 버튼, line은 끝 글 */
type NoticeShape =
  | {
      variant?: 'default';
      /** 오른쪽 버튼(Button size="sm") */
      action?: ReactNode;
      trailing?: never;
    }
  | {
      variant: 'line';
      action?: never;
      /** 오른쪽 끝 글(경과 시간) */
      trailing?: ReactNode;
    };

export type NoticeProps = NoticeLead &
  NoticeShape & {
    /** 바탕 · 아이콘 색. 기본 info */
    tone?: NoticeTone;
    /**
     * 문장의 줄바꿈 · 이어진 공백을 지킨다(pre-wrap) — 서버가 준 여러 줄 문장(배포 서버 상태 알림).
     * 긴 낱말은 그대로 상자 안에서 접는다
     */
    preserveLines?: boolean;
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

export function Notice({
  variant = 'default',
  tone = 'info',
  icon,
  iconStroke,
  spinner = false,
  preserveLines = false,
  action,
  trailing,
  children,
  className,
}: NoticeProps) {
  const isLine = variant === 'line';
  return (
    <div className={cx(styles.root, className)} data-variant={variant} data-tone={tone}>
      {spinner ? (
        <Spinner />
      ) : (
        <Icon
          name={icon ?? DEFAULT_ICON[tone]}
          size={isLine ? 'md-minus' : 'lg'}
          stroke={iconStroke}
          className={styles.icon}
        />
      )}
      <div className={styles.text} data-preserve-lines={preserveLines || undefined}>
        {children}
      </div>
      {action !== undefined ? <div className={styles.action}>{action}</div> : null}
      {trailing !== undefined ? <div className={styles.trailing}>{trailing}</div> : null}
    </div>
  );
}
