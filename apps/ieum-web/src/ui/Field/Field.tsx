// Field — 이음 .field(css/console.css:305-306, 760 :472). 라벨 + 입력 한 줄. 라벨은 <label for>로 입력과 이어진다
// 필수 칸 — 옛 라벨 뒤 빨간 " *"(js/menu/playground.js:31). 별표는 장식(aria-hidden)이고 뜻은 라벨 밖 시각 숨김 글이
// 입력의 설명(aria-describedby)으로 전한다 — 입력 이름은 라벨 글자 그대로(옛 aria-label = 인자 이름 :30)
// FieldNote — 칸 묶음 아래 흐린 안내. 옛 .pv-note + 인라인 margin:0 0 4px 106px(js/menu/discovery.js:56,65, 760 css/console.css:1069)
import { useId, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import { VisuallyHidden } from '../VisuallyHidden';
import styles from './Field.module.css';

export type FieldAlign = 'center' | 'top';

export type FieldControl = {
  /** 입력의 id로 준다 — 라벨 연결 */
  id: string;
  /** 입력의 aria-describedby로 준다 — requiredLabel이 있을 때만(시각 숨김 글의 id). 다른 설명이 있으면 공백으로 잇는다 */
  describedBy?: string;
};

export type FieldProps = {
  /** 보이는 라벨 */
  label: ReactNode;
  /** 라벨 세로 위치 — top은 여러 줄 입력 */
  align?: FieldAlign;
  /** 있으면 필수 칸 — 라벨 뒤 위험색 " *"(장식) + 이 글자를 시각 숨김 설명으로. 글자는 쓰는 곳 copy */
  requiredLabel?: string;
  /** 라벨 마우스 툴팁(<label title>) — 입력 이름 · 설명에 들어가지 않는다 */
  labelTitle?: string;
  /** 입력을 그린다 */
  children: (control: FieldControl) => ReactNode;
  /** 배치(바깥 여백)만 */
  className?: string;
};

export function Field({ label, align = 'center', requiredLabel, labelTitle, children, className }: FieldProps) {
  const id = useId();
  const requiredId = `${id}-required`;
  const isRequired = requiredLabel !== undefined;
  return (
    <div className={cx(styles.root, className)} data-align={align}>
      <label className={styles.label} htmlFor={id} title={labelTitle}>
        {label}
        {isRequired ? (
          <span className={styles.required} aria-hidden="true">
            {' *'}
          </span>
        ) : null}
      </label>
      {children({ id, describedBy: isRequired ? requiredId : undefined })}
      {/* 라벨 밖 — 이름에 섞이지 않고, 절대 위치라 격자 칸을 차지하지 않는다 */}
      {isRequired ? <VisuallyHidden id={requiredId}>{requiredLabel}</VisuallyHidden> : null}
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
