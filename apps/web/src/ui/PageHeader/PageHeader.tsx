import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './PageHeader.module.css';

export type PageHeaderMeta = Readonly<{ label: string; value: string }>;

export type PageHeaderProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  /** h1 내용 — 글(인라인)만. 블록 요소 · 실패 블록을 넣지 않는다 */
  title: ReactNode;
  /** 하위 화면의 뒤로 링크 자리(제목 위 한 줄) — `<Button variant="link" asChild><Link>← 상위 화면</Link></Button>` */
  back?: ReactNode;
  /** 제목 바로 뒤 액션(그 자리 편집 진입 `이름 수정` 등). 편집 중에는 그리지 않는다 */
  titleAction?: ReactNode;
  /** 그 자리 편집(InlineEdit). 주면 제목 줄을 이것으로 바꾸고 h1은 보조기기용으로만 남긴다(화면당 h1 하나) */
  editor?: ReactNode;
  /** 제목 옆 표식(StatusChip 등) */
  marker?: ReactNode;
  description?: ReactNode;
  /** 우측 영역(닫기 ✕ · 화면 도구) */
  actions?: ReactNode;
  /** 태그 행(Tag variant="project"들) — 설명 아래 6 */
  tags?: ReactNode;
  /** 태그 행 우측 메타(생성일 · 기준 시각) — 라벨 muted + 값 ink-soft tabular. 값이 `''`면 라벨(사유 문구)만 */
  meta?: readonly PageHeaderMeta[];
  /** 아래 16 + 1px hairline-soft */
  divider?: boolean;
};

/**
 * 화면 머리(상세 · 하위 화면). 바깥 여백은 화면 몫 — 여백을 갖지 않는다.
 * 화면당 h1 하나 — 본문에서 또 h1을 쓰지 않는다. 편집 중에도 h1은 남는다(시각 숨김).
 */
export const PageHeader = forwardRef<HTMLElement, PageHeaderProps>(function PageHeader(
  {
    title,
    back,
    titleAction,
    editor,
    marker,
    description,
    actions,
    tags,
    meta,
    divider = false,
    className,
    ...rest
  },
  ref,
) {
  const hasMeta = meta !== undefined && meta.length > 0;
  const isEditing = editor !== undefined && editor !== null;
  const hasExtra = Boolean(tags) || hasMeta;
  return (
    <header
      {...rest}
      className={cx(styles.root, className)}
      data-divider={divider || undefined}
      data-editing={isEditing || undefined}
      ref={ref}
    >
      <div className={styles.main}>
        {back ? <div className={styles.back}>{back}</div> : null}
        <div className={styles.titleRow}>
          <h1 className={cx(styles.title, isEditing && styles.srOnly)}>{title}</h1>
          {isEditing ? (
            <div className={styles.editor}>{editor}</div>
          ) : (
            <>
              {marker}
              {titleAction}
            </>
          )}
        </div>
        {description ? <p className={styles.description}>{description}</p> : null}
        {hasExtra ? (
          <div className={styles.extra}>
            {tags ? <div className={styles.tags}>{tags}</div> : null}
            {hasMeta ? (
              <div className={styles.meta}>
                {meta.map((m) => (
                  // 라벨과 값 사이 공백 하나(`생성일 2026.…`). 값이 빈 문자열이면 라벨(사유 문구)만
                  <span key={m.label}>
                    {m.label}
                    {m.value === '' ? null : (
                      <>
                        {' '}
                        <span className={styles.metaValue}>{m.value}</span>
                      </>
                    )}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
});
