// FailureBlock — 이음 알림 상자(.notice warn · danger — css/console.css:270-272,643-649): 경고 아이콘 + 굵은 머리 한 줄(있는 자리만) + 원문.
// 원문은 서버 문장 그대로이고 줄바꿈을 지킨다(js/menu/deploy.js:116 pre-wrap을 모든 자리로 넓힘). 복사 · 재시도 버튼은 없다
import type { ReactNode } from 'react';
import { Icon } from '../icons/Icon';
import { cx } from '../lib/cx';
import styles from './FailureBlock.module.css';

/** 자리마다 이음 그대로 — 연결 · 탐색 · 변환 과정 · 조회 warn, 배포 · 로그 상세 danger */
export type FailureTone = 'warn' | 'danger';

export type FailureBlockProps = {
  /** 원문 — ApiError.message(서버 resultMsg 또는 copy/errors 고정 문구) */
  message: string;
  tone: FailureTone;
  /** 굵은 머리 한 줄(copy/). 없으면 원문만 */
  title?: ReactNode;
  /** 배치(바깥 여백)만 */
  className?: string;
};

export function FailureBlock({ message, tone, title, className }: FailureBlockProps) {
  return (
    <div className={cx(styles.root, className)} data-tone={tone}>
      <Icon name="alert" size="lg" className={styles.icon} />
      <div className={styles.text}>
        {title !== undefined ? <b className={styles.title}>{title}</b> : null}
        <span className={styles.message}>{message}</span>
      </div>
    </div>
  );
}

export type ErrorBlockProps = Pick<FailureBlockProps, 'message' | 'className'>;

/**
 * 화면 안 영역(region)의 첫 조회 실패 — 그 상자 안에 원문만 · 머리 없이 · warn.
 * FailureBlock의 머리 없는 꼴과 같은 모양이고, 영역 자리가 tone · 머리를 고를 수 없게 이름을 따로 둔다
 */
export function ErrorBlock({ message, className }: ErrorBlockProps) {
  return <FailureBlock tone="warn" message={message} className={className} />;
}
