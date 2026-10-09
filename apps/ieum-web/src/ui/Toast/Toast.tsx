// Toast — 이음 toast()(js/common/overlay.js:26-33) · #toast(index.html:46) · .toast(css/console.css:421-426). 앱에 하나 — 앱 층이 셸 옆에 붙인다.
// 한 칸 덮어쓰기: 새 id가 오면 내용을 바로 바꾸고 표시 시간(--toast-duration)을 처음부터 다시 센다(옛 clearTimeout 뒤 다시).
// 끝나면 onDone(id) — 저장소가 open만 끄고 글자는 남겨 사라지는 전환 동안 비지 않는다. 닫기는 타이머다(애니메이션 끝 이벤트가 아니다 —
// 모션 줄이기의 animation: none에서도 닫힌다). 마운트할 때 Popover(manual)로 한 번 최상층에 올리고 내리지 않는다 — 보임은 data-open
import { useEffect, useRef } from 'react';
import type { ToastItem, ToastKind } from '@/app/toast';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/names';
import styles from './Toast.module.css';

export type ToastProps = {
  /** 지금 한 칸. 한 번도 띄우지 않았으면 null(빈 그릇) */
  item: ToastItem | null;
  /** 표시 시간이 끝나면 그 id로 부른다 */
  onDone: (id: number) => void;
};

// 종류 → 아이콘(js/common/overlay.js:30). 색은 CSS가 data-kind로 고른다
const ICON_OF: Record<ToastKind, IconName> = { default: 'check', warn: 'alert', info: 'info' };

const DURATION_TOKEN = '--toast-duration';
const MS_PER_SECOND = 1000;
// 운영 빌드는 2800ms를 2.8s로 줄여 쓴다 — ms · s를 모두 받는다(DESIGN Motion JS에서 시간 토큰 읽기)
const TIME_VALUE = /^(\d*\.?\d+)(ms|s)$/;

/** 시간 값(2800ms · 2.8s)을 ms로. 읽지 못하면 null */
function parseTime(value: string): number | null {
  const match = TIME_VALUE.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  return match[2] === 's' ? amount * MS_PER_SECOND : amount;
}

// 이미 경고했는가 — 토스트마다 콘솔이 넘치지 않게 한 번만
let hasWarnedDuration = false;

function durationOf(element: HTMLElement): number | null {
  const raw = getComputedStyle(element).getPropertyValue(DURATION_TOKEN);
  const ms = parseTime(raw);
  if (ms === null && import.meta.env.DEV && !hasWarnedDuration) {
    hasWarnedDuration = true;
    console.warn(`${DURATION_TOKEN} 값 "${raw}"을 읽지 못했습니다 — 다음 토스트가 덮을 때까지 그대로 둡니다`);
  }
  return ms;
}

export function Toast({ item, onDone }: ToastProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  // 타이머가 늘 최신 onDone을 부르게 한다(쓰는 곳이 매번 새 함수를 넘겨도 시간을 다시 세지 않는다)
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  // 최상층에 한 번 올린다 — 모달 · 드로어(show() — 최상층 아님)보다 늘 위
  useEffect(() => {
    const root = rootRef.current;
    if (root && !root.matches(':popover-open')) root.showPopover();
  }, []);

  const id = item?.id;
  const isOpen = item?.open ?? false;
  useEffect(() => {
    const root = rootRef.current;
    if (!root || id === undefined || !isOpen) return;
    const ms = durationOf(root);
    if (ms === null) return;
    const timer = window.setTimeout(() => onDoneRef.current(id), ms);
    return () => window.clearTimeout(timer);
  }, [id, isOpen]);

  return (
    <div
      ref={rootRef}
      className={styles.root}
      popover="manual"
      role="status"
      aria-live="polite"
      data-open={isOpen}
      data-kind={item?.kind}
    >
      {item ? (
        <>
          <Icon name={ICON_OF[item.kind]} size="lg" stroke="bold" className={styles.icon} />
          <span className={styles.message}>{item.message}</span>
        </>
      ) : null}
    </div>
  );
}
