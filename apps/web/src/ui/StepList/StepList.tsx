import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './StepList.module.css';

export type StepState = 'done' | 'current' | 'upcoming';

export type StepItem = {
  /** React key. 없으면 순번 */
  id?: string;
  label: ReactNode;
  description?: ReactNode;
};

export type StepNote = { title: ReactNode; body?: ReactNode };

export type StepListProps = HTMLAttributes<HTMLDivElement> & {
  items: readonly StepItem[];
  /** 현재 단계 순번(0부터). 앞은 done, 뒤는 upcoming. 길이 이상이면 모두 done */
  current: number;
  /** 현재 단계 안내. 없으면 그리지 않는다 */
  note?: StepNote;
};

const stateOf = (index: number, current: number): StepState =>
  index < current ? 'done' : index === current ? 'current' : 'upcoming';

/** HelperPanel 안 단계 목록 + 현재 안내. 지난 · 현재 점은 ink 필 — 상태 색 없음 */
export const StepList = forwardRef<HTMLDivElement, StepListProps>(function StepList(
  { items, current, note, className, ...rest },
  ref,
) {
  return (
    <div {...rest} className={cx(styles.root, className)} ref={ref}>
      <ol className={styles.list}>
        {items.map((item, i) => {
          const state = stateOf(i, current);
          return (
            <li
              key={item.id ?? i}
              className={styles.step}
              data-state={state}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className={styles.dotCol}>
                <span className={styles.dot}>{i + 1}</span>
              </span>
              <span className={styles.text}>
                <span className={styles.label}>{item.label}</span>
                {item.description !== undefined ? (
                  <span className={styles.description}>{item.description}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      {note ? (
        <div className={styles.note}>
          <span className={styles.noteTitle}>{note.title}</span>
          {note.body !== undefined ? <span className={styles.noteBody}>{note.body}</span> : null}
        </div>
      ) : null}
    </div>
  );
});
