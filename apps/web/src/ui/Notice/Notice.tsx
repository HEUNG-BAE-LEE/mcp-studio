import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import { devWarnOnce } from '../lib/devWarnOnce';
import styles from './Notice.module.css';

/** tone 고르기는 DESIGN Colors Status. done은 무채색(왼쪽 선 --hairline) */
export type NoticeTone = 'risk' | 'warn' | 'going' | 'info' | 'done';
/** `href`와 `onClick`을 함께 줘도 된다 — onClick이 먼저 돌고 이동 여부는 호출자가 정한다 */
export type NoticeLink = { label: string; href?: string; onClick?: () => void };

/** 비어 있지 않은 글 — `null` · `undefined` · boolean은 타입이 막는다(빈 문자열은 렌더에서 거른다) */
type NoticeContent = Exclude<ReactNode, null | undefined | boolean>;
/** 제목 · 본문 중 하나는 필수. 한 문장 안내는 `body`만 — 제목을 억지로 떼어 내지 않는다 */
type NoticeText =
  { title: NoticeContent; body?: ReactNode } | { title?: undefined; body: NoticeContent };

type NoticeBaseProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  tone: NoticeTone;
  /** href면 `<a>`, 아니면 `<button>`. 라벨의 `→`는 호출자 문구에 포함한다 */
  link?: NoticeLink;
  /**
   * 루트를 live 영역(`role="status"`)으로 둔다. 기본 false — 바뀌어 나타나는 한 줄일 때만 켠다.
   * 정적 안내 · 카드 목록(AlertPanel — 목록이 live 영역 하나를 가진다) 안 카드는 live가 아니다.
   * 실행 결과 알림은 Notice를 live로 바꾸지 않고 늘 마운트된 `VisuallyHidden role="status"`가 한다(DESIGN 즉시 실행 완료)
   */
  live?: boolean;
};

export type NoticeProps = NoticeBaseProps & NoticeText;

const hasContent = (node: ReactNode) => node !== undefined && node !== null && node !== '';

function NoticeLinkElement({ link }: { link: NoticeLink }) {
  if (link.href) {
    return (
      <a className={styles.link} href={link.href} onClick={link.onClick}>
        {link.label}
      </a>
    );
  }
  return (
    <button type="button" className={styles.link} onClick={link.onClick}>
      {link.label}
    </button>
  );
}

/** 알림 카드 · 안내 문단. 사용자가 닫지 못한다 — 조건이 해제되면 목록에서 사라진다. 카드 사이 구분선은 목록 상자(AlertPanel)가 긋는다 */
export const Notice = forwardRef<HTMLDivElement, NoticeProps>(function Notice(
  { tone, title, body, link, live = false, className, ...rest },
  ref,
) {
  // 제목 · 본문이 둘 다 비면(빈 문자열) 빈 카드를 그리지 않는다
  if (!hasContent(title) && !hasContent(body)) {
    devWarnOnce('notice-empty', '[Notice] title · body가 둘 다 비어 그리지 않는다');
    return null;
  }
  return (
    <div
      {...rest}
      role={live ? 'status' : undefined}
      className={cx(styles.root, className)}
      data-tone={tone}
      ref={ref}
    >
      <div className={styles.body}>
        {/* 제목 행(flex · baseline) — 우측 요소가 붙을 수 있다 */}
        {hasContent(title) ? (
          <div className={styles.head}>
            <span className={styles.title}>{title}</span>
          </div>
        ) : null}
        {hasContent(body) ? <span className={styles.text}>{body}</span> : null}
        {link ? <NoticeLinkElement link={link} /> : null}
      </div>
    </div>
  );
});
