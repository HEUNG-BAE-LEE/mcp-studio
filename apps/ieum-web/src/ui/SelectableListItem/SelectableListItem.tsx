// SelectableListItem — 목록 + 상세 왼쪽 목록의 두 줄 항목. 이음 .tool-item(css/console.css:621-629) · .ts-item(785-790)
// 전체 폭 버튼(aria-pressed) — 고른 항목은 --surface-selected + --edge-active. 이미 고른 항목을 다시 눌러도 부른다
// 둘째 줄 안 표지(쓰기 표지 등)는 글 뒤에 공백으로 띄워 쓰는 곳이 둔다 — 줄 흐름 그대로 글 뒤에 붙는다(옛 .tt)
import type { ReactNode } from 'react';
import styles from './SelectableListItem.module.css';

/** id = 고정폭 도구 id(스튜디오), name = 본문 글꼴 묶음 이름(배포) */
export type SelectableListItemVariant = 'id' | 'name';

export type SelectableListItemProps = {
  /** 첫 줄 글자 · 항목 간격 — COMPONENTS SelectableListItem 표 */
  variant: SelectableListItemVariant;
  /** 첫 줄 왼쪽 */
  title: ReactNode;
  /** 첫 줄 오른쪽 칩(상태 칩) */
  status?: ReactNode;
  /** 둘째 줄 */
  description: ReactNode;
  /** 고른 항목 */
  selected: boolean;
  /** 누름 — 이미 고른 항목이어도 부른다 */
  onSelect: () => void;
  /** 첫 줄 · 둘째 줄 글자를 옅게(제외 도구). 칩 · 표지 색은 그대로 */
  dimmed?: boolean;
};

export function SelectableListItem({
  variant,
  title,
  status,
  description,
  selected,
  onSelect,
  dimmed = false,
}: SelectableListItemProps) {
  return (
    <button
      type="button"
      className={styles.root}
      data-variant={variant}
      data-dimmed={dimmed || undefined}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className={styles.head}>
        <span className={styles.title}>{title}</span>
        {status !== undefined ? <span className={styles.status}>{status}</span> : null}
      </span>
      <span className={styles.description}>{description}</span>
    </button>
  );
}
