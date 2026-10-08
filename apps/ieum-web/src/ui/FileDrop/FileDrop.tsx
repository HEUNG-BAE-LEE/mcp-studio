// FileDrop — 파일 하나 고르기 상자. 이음 .drop(css/console.css:823-827)
// 숨긴 <input type="file">이 상자 전체를 투명하게 덮는다 — 누르면 파일 창이 열리고 끌어 놓기는 브라우저 기본 동작이다.
// 글자(title · description · label)는 쓰는 곳이 copy/에서 골라 props로 준다
import type { ChangeEvent, ReactNode } from 'react';
import { Icon } from '../icons/Icon';
import styles from './FileDrop.module.css';

/** 고를 수 있는 파일 크기 한도(10MB) — 부품은 막지 않고, 쓰는 곳이 이 값과 견줘 경고만 띄운다(옛 js/menu/sources.js:190-195) */
export const FILE_DROP_MAX_BYTES = 10 * 1024 * 1024;

export type FileDropProps = {
  /** 숨긴 파일 입력의 이름(aria-label) */
  label: string;
  /** 첫 줄 — 고르기 전 안내 또는 고른 파일 이름 문장 */
  title: ReactNode;
  /** 아래 작은 흐린 줄 — 허용 형식 · 크기 안내 */
  description?: ReactNode;
  /** 파일을 고르면 첫 파일로 부른다. 고르지 않고 창을 닫으면 부르지 않는다 */
  onSelect: (file: File) => void;
  /** 바뀌면 숨긴 입력을 새로 마운트해 값을 비운다 — 같은 파일을 다시 골라도 onSelect가 불리게 */
  resetKey?: string | number;
};

export function FileDrop({ label, title, description, onSelect, resetKey }: FileDropProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file !== undefined) onSelect(file);
  };

  return (
    <label className={styles.root}>
      <span className={styles.icon}>
        <Icon name="upload" size="hero" />
      </span>
      <span className={styles.title}>{title}</span>
      {description !== undefined ? <small className={styles.description}>{description}</small> : null}
      <input key={resetKey} type="file" className={styles.input} aria-label={label} onChange={handleChange} />
    </label>
  );
}
