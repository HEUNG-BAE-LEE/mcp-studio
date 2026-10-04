import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './SectionHead.module.css';

export type SectionHeadProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  /** 영역 제목 — `--t-section` 600 16/1.4 */
  title: ReactNode;
  /** 제목 단계. 화면 h1(PageHeader) 아래 영역은 h2(기본), 그 안의 하위 영역은 h3 */
  as?: 'h2' | 'h3';
  /** 제목 옆 표식(StatusChip `md`) */
  marker?: ReactNode;
  /** 수 — mono 500 14 `ink-soft` tabular-nums. 서식은 호출자(`3` · `0 / 3`) */
  count?: ReactNode;
  /** 머리 줄 우측 메모 한 줄(`--t-caption` `muted`) — 기간 · 정렬 기준(`호출 많은 순`) · 표식. 도구 바로 앞에 놓인다 */
  note?: ReactNode;
  /** 우측 도구 자리(검색 Input sm-plus · Button sm-plus 등) */
  tools?: ReactNode;
  /** 아래 10 + 1px `hairline` 구분선 */
  divider?: boolean;
  /** 머리 아래 한 줄 사유(`--t-caption` `muted`) — 도구가 비활성인 이유. 비활성 컨트롤은 `aria-describedby={reasonId}` */
  reason?: ReactNode;
  /** 사유 줄의 id. `reason`과 함께 준다(호출자가 `useId`로 만든다) */
  reasonId?: string;
  /** 제목 요소(h2 · h3)의 id — 영역 상자(`<section>` · `<aside>`)가 `aria-labelledby`로 이름을 얻는다 */
  titleId?: string;
};

export const SectionHead = forwardRef<HTMLDivElement, SectionHeadProps>(function SectionHead(
  {
    title,
    as: Heading = 'h2',
    marker,
    count,
    note,
    tools,
    divider = false,
    reason,
    reasonId,
    titleId,
    className,
    ...rest
  },
  ref,
) {
  const line = (
    <>
      <Heading id={titleId} className={styles.title}>
        {title}
      </Heading>
      {marker}
      {count !== undefined ? <span className={styles.count}>{count}</span> : null}
      {note !== undefined && note !== null ? <span className={styles.note}>{note}</span> : null}
      {tools !== undefined ? <div className={styles.tools}>{tools}</div> : null}
    </>
  );
  const hasReason = reason !== undefined && reason !== null && reason !== false;
  if (!hasReason) {
    return (
      <div
        {...rest}
        ref={ref}
        className={cx(styles.root, className)}
        data-divider={divider || undefined}
      >
        {line}
      </div>
    );
  }
  // 사유가 있으면 머리 줄 + 사유 줄 두 줄 — 구분선은 바깥 상자가 갖는다
  return (
    <div
      {...rest}
      ref={ref}
      className={cx(styles.stack, className)}
      data-divider={divider || undefined}
      data-reason="true"
    >
      <div className={styles.root}>{line}</div>
      <p id={reasonId} className={styles.reason}>
        {reason}
      </p>
    </div>
  );
});
