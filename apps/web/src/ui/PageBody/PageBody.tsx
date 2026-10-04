// 화면 본문 틀 — AppShell <main> 안쪽 여백(body-*) · 영역 사이 세로 리듬(gap-section) · 스크롤 범위. 두 열은 PageColumns(gap-column)
import { forwardRef, type HTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import styles from './PageBody.module.css';

export type PageBodyProps = HTMLAttributes<HTMLDivElement> & {
  /** 1024 폭 — 좌우 여백 body-x-narrow 24 */
  narrow?: boolean;
  /**
   * 무엇이 스크롤하는가. `page`(기본) = 본문 전체가 세로로 스크롤(하위 화면 · 한 열 · 폼).
   * `regions` = 본문은 고정, 마지막 영역(PageColumns)이 남은 높이를 채우고 열 안 목록 · 로그가 각자 스크롤(상세 + 두 열)
   */
  scroll?: 'page' | 'regions';
};

export const PageBody = forwardRef<HTMLDivElement, PageBodyProps>(function PageBody(
  { narrow = false, scroll = 'page', className, ...rest },
  ref,
) {
  return (
    <div
      {...rest}
      ref={ref}
      className={cx(styles.body, className)}
      data-narrow={narrow || undefined}
      data-scroll={scroll}
    />
  );
});

export type PageColumnsProps = HTMLAttributes<HTMLDivElement> & {
  /** 1024 폭 — 열 사이 gap-column-narrow 24 */
  narrow?: boolean;
  /** `equal`(기본) = 같은 폭 두 열 · `aside` = 넓은 작업 열 + 오른쪽 고정 보조 열(`--w-aside`) */
  variant?: 'equal' | 'aside';
};

/** 나란한 두 열. 자식 둘 — 각 열은 min-width 0으로 줄어든다 */
export const PageColumns = forwardRef<HTMLDivElement, PageColumnsProps>(function PageColumns(
  { narrow = false, variant = 'equal', className, ...rest },
  ref,
) {
  return (
    <div
      {...rest}
      ref={ref}
      className={cx(styles.columns, className)}
      data-narrow={narrow || undefined}
      data-variant={variant}
    />
  );
});

export type StackProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section';
  /** 마지막 자식이 남은 높이를 채운다(flex 1 · min-height 0) — `scroll="regions"` 열 안에서 */
  fill?: boolean;
};

/** 한 열 안에 세로로 쌓인 영역들 — 사이 gap-section. 화면 CSS가 gap-section을 직접 쓰지 않게 한다 */
export const Stack = forwardRef<HTMLElement, StackProps>(function Stack(
  { as: Tag = 'div', fill = false, className, ...rest },
  ref,
) {
  return (
    <Tag
      {...rest}
      ref={ref as never}
      className={cx(styles.stack, className)}
      data-fill={fill || undefined}
    />
  );
});
