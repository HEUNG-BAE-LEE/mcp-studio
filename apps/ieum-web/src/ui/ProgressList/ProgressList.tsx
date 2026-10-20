// ProgressList — 위에서 아래로 진행하는 작업 줄(이음 .an css/console.css:838-845, 연결 분석 js/menu/sources.js:77).
// 받은 상태만 그린다 — 언제 다음 줄로 가는지(진행 연출)는 쓰는 곳이다.
// 목록은 <ol>이고 run 줄은 aria-current="step"(옛 <ul> · 클래스뿐 — 보이지 않는 보강). 스피너 · 완료 아이콘은 장식이다
import type { ReactNode } from 'react';
import { Icon } from '../icons/Icon';
import { cx } from '../lib/cx';
import { Spinner } from '../Spinner';
import styles from './ProgressList.module.css';

export type ProgressItem = {
  label: ReactNode;
  state: 'wait' | 'run' | 'done';
  /** 오른쪽 작은 요약(옛 완료 뒤 "명세 1건" 등) — 글자는 쓰는 곳이 copy/에서 준다 */
  note?: ReactNode;
};

export type ProgressListProps = {
  /** 줄 — 위에서 아래로 */
  items: readonly ProgressItem[];
  /** 배치(바깥 여백)만 */
  className?: string;
};

/** 원 자리 — run은 도는 원, done은 채운 원 + check, wait은 빈 원 */
function markOf(state: ProgressItem['state']): ReactNode {
  if (state === 'run') return <Spinner size="lg" />;
  return (
    <span className={styles.mark} aria-hidden="true">
      {state === 'done' && <Icon name="check" size="xs" stroke="heavy" />}
    </span>
  );
}

export function ProgressList({ items, className }: ProgressListProps) {
  return (
    <ol className={cx(styles.root, className)}>
      {items.map((item, index) => (
        // 줄은 순서 · 개수가 고정된 목록이라 순번을 키로 쓴다
        <li
          key={index}
          className={styles.item}
          data-state={item.state}
          aria-current={item.state === 'run' ? 'step' : undefined}
        >
          {markOf(item.state)}
          {item.label}
          {item.note !== undefined && (
            <>
              {' '}
              <span className={styles.note}>{item.note}</span>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
