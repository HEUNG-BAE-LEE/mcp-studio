// Field — 이음 .field(css/console.css:305-306, 760 :472). 라벨 + 입력 한 줄. 라벨은 <label for>로 입력과 이어진다
import { useId, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './Field.module.css';

export type FieldAlign = 'center' | 'top';

export type FieldControl = {
  /** 입력의 id로 준다 — 라벨 연결 */
  id: string;
};

export type FieldProps = {
  /** 보이는 라벨 */
  label: ReactNode;
  /** 라벨 세로 위치 — top은 여러 줄 입력 */
  align?: FieldAlign;
  /** 입력을 그린다 */
  children: (control: FieldControl) => ReactNode;
  /** 배치(바깥 여백)만 */
  className?: string;
};

export function Field({ label, align = 'center', children, className }: FieldProps) {
  const id = useId();
  return (
    <div className={cx(styles.root, className)} data-align={align}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children({ id })}
    </div>
  );
}
