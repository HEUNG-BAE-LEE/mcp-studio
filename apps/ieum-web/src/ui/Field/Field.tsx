// Field — 이음 .field(css/console.css:305-306, 760 :472). 라벨 + 입력 한 줄. 라벨은 <label for>로 입력과 이어진다
// FieldNote — 칸 묶음 아래 흐린 안내. 옛 .pv-note + 인라인 margin:0 0 4px 106px(js/menu/discovery.js:56,65, 760 css/console.css:1069)
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

export type FieldNoteProps = {
  /** 안내 문장 — 강조 <b>는 굵게(색은 그대로) */
  children: ReactNode;
  /** 배치만 */
  className?: string;
};

/** 라벨 열만큼 들여 입력 열에 맞춘 안내 — 어느 한 칸이 아니라 묶음 전체 안내라 입력에 잇지 않는다 */
export function FieldNote({ children, className }: FieldNoteProps) {
  return <p className={cx(styles.note, className)}>{children}</p>;
}
