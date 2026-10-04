import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './KeyValue.module.css';

export type KeyValueItem = {
  /** 키 글(dt). `id`가 없으면 React key로도 쓴다 */
  key: string;
  /** 행 식별자(React key) — 키 글이 겹칠 수 있으면 준다. 목록 안에서 유일 */
  id?: string;
  value: ReactNode;
  /** 식별자 · 주소처럼 고정폭으로 읽을 값 */
  mono?: boolean;
  /** 값 오른쪽 액션(예: 자격증명 `교체`). 있으면 행 높이 52 */
  action?: ReactNode;
  /** 긴 값을 한 줄로 자르고 `…`(주소 · 경로). 값이 문자열이면 원문을 `title`로 준다 */
  truncate?: boolean;
};

export type KeyValueProps = HTMLAttributes<HTMLDListElement> & {
  items: KeyValueItem[];
  /** box(상자, 기본) · plain(설정 상태 · 수집 — 상자 없는 키 96 · 값 줄) */
  variant?: 'box' | 'plain';
};

export const KeyValue = forwardRef<HTMLDListElement, KeyValueProps>(function KeyValue(
  { items, variant = 'box', className, ...rest },
  ref,
) {
  return (
    <dl {...rest} className={cx(styles.root, className)} data-variant={variant} ref={ref}>
      {items.map((it) => (
        <div
          key={it.id ?? it.key}
          className={styles.row}
          data-action={it.action !== undefined ? true : undefined}
        >
          <dt className={styles.key}>{it.key}</dt>
          <dd className={styles.value} data-mono={it.mono || undefined}>
            {it.truncate ? (
              <span
                className={styles.truncate}
                title={typeof it.value === 'string' ? it.value : undefined}
              >
                {it.value}
              </span>
            ) : (
              it.value
            )}
            {it.action}
          </dd>
        </div>
      ))}
    </dl>
  );
});
