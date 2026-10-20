// EmptyState — 빈 자리. 종류(kind) × 그릇(container)으로 고른다(DESIGN 핵심 규칙 7 · Copy 빈 상태).
// 모양은 그릇이 정한다: table = 표 안 한 행(css/console.css:212) · panel = 점선 상자(css/console.css:366-368, hero는 js/menu/dashboard.js:61) ·
// inline = 테두리 없는 한 줄(css/console.css:135) · area = 아이콘 안내(css/console.css:769-770)
import type { ReactNode } from 'react';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/names';
import { cx } from '../lib/cx';
import styles from './EmptyState.module.css';

export type EmptyKind = 'first' | 'filtered' | 'section' | 'idle';
export type EmptyContainer = 'table' | 'panel' | 'inline' | 'area';
export type EmptyPanelSize = 'md' | 'sm' | 'hero';
export type EmptyIconSize = 'hero' | 'empty';

type Base = {
  /** 안내 문장(copy/). 다른 메뉴로 가는 링크 버튼은 문장 안에 둔다 */
  children: ReactNode;
  /** 배치(바깥 여백)만 */
  className?: string;
};

type ByContainer =
  | { container: 'table'; kind: EmptyKind; colSpan: number }
  | { container: 'panel'; kind: EmptyKind; size?: Exclude<EmptyPanelSize, 'hero'> }
  /** 대시보드 큰 상자 — 처음 상태에만, 제목 · 주 버튼이 있다 */
  | { container: 'panel'; kind: 'first'; size: 'hero'; title: ReactNode; action: ReactNode }
  | { container: 'inline'; kind: EmptyKind }
  | { container: 'area'; kind: EmptyKind; icon: IconName; iconSize?: EmptyIconSize };

export type EmptyStateProps = Base & ByContainer;

export function EmptyState(props: EmptyStateProps) {
  const { kind, container, className, children } = props;
  const data = { 'data-kind': kind, 'data-container': container };
  switch (props.container) {
    case 'table':
      return (
        <tr {...data} className={className}>
          <td colSpan={props.colSpan} className={styles.cell}>
            {children}
          </td>
        </tr>
      );
    case 'panel': {
      const size = props.size ?? 'md';
      if (props.size === 'hero')
        return (
          <div {...data} data-size={size} className={cx(styles.hero, className)}>
            <h3 className={styles.heroTitle}>{props.title}</h3>
            <p className={styles.heroText}>{children}</p>
            {props.action}
          </div>
        );
      return (
        <div {...data} data-size={size} className={cx(styles.panel, className)}>
          {children}
        </div>
      );
    }
    case 'inline':
      return (
        <div {...data} className={cx(styles.inline, className)}>
          {children}
        </div>
      );
    case 'area': {
      const iconSize = props.iconSize ?? 'empty';
      return (
        <div {...data} className={cx(styles.area, className)}>
          <Icon
            name={props.icon}
            size={iconSize}
            stroke={iconSize === 'empty' ? 'light' : undefined}
            className={styles.areaIcon}
          />
          <div>{children}</div>
        </div>
      );
    }
  }
}
