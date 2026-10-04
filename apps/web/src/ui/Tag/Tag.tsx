import { forwardRef, type HTMLAttributes, type MouseEvent } from 'react';
import { cx } from '../lib/cx';
import styles from './Tag.module.css';

export type TagProps = HTMLAttributes<HTMLSpanElement> & {
  /** label(기본) · project(프로젝트 헤더 읽기 전용 태그). 모두 중립색 — 자원 종류를 색으로 나누지 않는다 */
  variant?: 'label' | 'project';
  /** 있으면 편집형 칩(✕ 버튼). LNB 태그 편집. variant는 무시된다 */
  onRemove?: () => void;
};

/** 짧은 분류 라벨(소스 유형 · 커넥터 유형 등). 상태를 뜻하지 않는다 — 상태는 StatusChip */
export const Tag = forwardRef<HTMLSpanElement, TagProps>(function Tag(
  { variant = 'label', onRemove, className, children, ...rest },
  ref,
) {
  const isRemovable = onRemove !== undefined;
  // ✕ 클릭이 칩(루트 onClick)으로 번지지 않게 막는다
  const onRemoveClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onRemove?.();
  };
  return (
    <span
      {...rest}
      className={cx(styles.root, className)}
      data-variant={isRemovable ? 'label' : variant}
      data-removable={isRemovable || undefined}
      ref={ref}
    >
      {children}
      {isRemovable ? (
        <button
          type="button"
          className={styles.remove}
          aria-label={`${typeof children === 'string' ? children : '태그'} 삭제`}
          onClick={onRemoveClick}
        >
          ✕
        </button>
      ) : null}
    </span>
  );
});
