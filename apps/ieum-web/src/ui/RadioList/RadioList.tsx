// RadioList — 이음 .gov-list · .gov-row(css/console.css:830-836). 이름 + 작은 설명 한 줄짜리 선택지에서 하나 고르기
import { useId, type ReactNode } from 'react';
import styles from './RadioList.module.css';

export type RadioListItem = {
  value: string;
  title: ReactNode;
  /** 제목 아래 작은 흐린 글 */
  description?: ReactNode;
};

export type RadioListProps = {
  /** 목록 위 라벨 줄 — 묶음의 이름 */
  label: ReactNode;
  items: readonly RadioListItem[];
  value: string;
  /** 고르면 그 값 */
  onValueChange: (value: string) => void;
};

export function RadioList({ label, items, value, onValueChange }: RadioListProps) {
  const name = useId();
  const labelId = `${name}-label`;
  return (
    <div role="radiogroup" aria-labelledby={labelId}>
      <div className={styles.head}>
        <span id={labelId} className={styles.label}>
          {label}
        </span>
      </div>
      <div className={styles.list}>
        {items.map((item) => (
          <label key={item.value} className={styles.row}>
            <input
              type="radio"
              className={styles.radio}
              name={name}
              value={item.value}
              checked={item.value === value}
              onChange={() => onValueChange(item.value)}
            />
            <span className={styles.text}>
              {item.title}
              {item.description !== undefined && <small className={styles.description}>{item.description}</small>}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
