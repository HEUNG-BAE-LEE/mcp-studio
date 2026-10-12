// SectionTitle — 상자 없는 절 제목 + 작은 보조. 이음 h3.sec-t(section — css/console.css:607-608) · .sec2>h4(sub — :670-673, 드로어 :1046-1047)
// section은 h3(화면 h2 아래), sub는 h4(상세 머리 · 상자 · 드로어 h3 아래)다. 동작은 제목 요소 안에 둔다(옛 그대로)
import type { ReactNode } from 'react';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/names';
import { cx } from '../lib/cx';
import styles from './SectionTitle.module.css';

export type SectionTitleLevel = 'section' | 'sub';

type SectionTitleBaseProps = {
  /** 제목 */
  title: ReactNode;
  /** 제목 곁 작은 보조 글 — 좁으면 아래로 접힌다 */
  description?: ReactNode;
  /** 배치만 */
  className?: string;
};

type SectionTitleLevelProps =
  | {
      /** section = 화면 본문의 절 제목(h3) */
      level?: 'section';
      icon?: never;
      descriptionMono?: never;
      actions?: never;
    }
  | {
      /** sub = 상세 · 상자 · 드로어 안 소절 제목(h4) */
      level: 'sub';
      /** 제목 앞 아이콘(md · 흐림) — 탐색 근거 */
      icon?: IconName;
      /** 보조 글을 고정폭으로 — 파일:줄 */
      descriptionMono?: boolean;
      /** 오른쪽 끝 동작 — 앞 빈칸이 남은 폭을 차지한다 */
      actions?: ReactNode;
    };

export type SectionTitleProps = SectionTitleBaseProps & SectionTitleLevelProps;

export function SectionTitle({
  level = 'section',
  title,
  description,
  icon,
  descriptionMono = false,
  actions,
  className,
}: SectionTitleProps) {
  const Heading = level === 'sub' ? 'h4' : 'h3';
  return (
    <Heading className={cx(styles.root, className)} data-level={level}>
      {icon !== undefined ? <Icon name={icon} size="md" className={styles.icon} /> : null}
      {title}
      {description !== undefined ? (
        <small className={styles.description} data-mono={descriptionMono ? 'true' : undefined}>
          {description}
        </small>
      ) : null}
      {actions !== undefined ? (
        <>
          <span className={styles.spacer} />
          {actions}
        </>
      ) : null}
    </Heading>
  );
}
