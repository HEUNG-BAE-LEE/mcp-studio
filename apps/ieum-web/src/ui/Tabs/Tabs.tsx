// Tabs — 밑줄 탭 줄과 그 아래 패널 하나. 이음 .rtabs · .rtab(css/console.css:317-319,321,323) — AI 연결 배포 "AI에 연결하기"(js/menu/deploy.js:3,79)
// 탭 줄과 패널이 붙어 있어 부품이 둘 다 그린다(id는 useId) — 탭 · 패널 id 모양은 SegmentedTabs와 같다({id}-tab-{value} · {id}-panel).
// 항목마다 Tab으로 닿고 Enter · Space로 고른다 — 화살표 키 이동은 두지 않는다(옛 그대로 — SegmentedTabs와 같은 판정)
import { useId, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './Tabs.module.css';

export type TabItem = {
  /** 고르는 값 — 탭 id를 만든다(영문 소문자 · 숫자 · -) */
  value: string;
  label: ReactNode;
};

export type TabsProps = {
  /** 탭 — 순서대로 */
  items: readonly TabItem[];
  /** 고른 탭 */
  value: string;
  /** 누른 탭 — 이미 고른 탭이어도 부른다 */
  onValueChange: (value: string) => void;
  /** 고른 탭의 패널 내용 — 패널은 하나이고 내용만 바꿔 그린다 */
  children: ReactNode;
  /** 배치(바깥 여백)만 */
  className?: string;
};

const tabIdOf = (id: string, value: string) => `${id}-tab-${value}`;

export function Tabs({ items, value, onValueChange, children, className }: TabsProps) {
  const id = useId();
  const panelId = `${id}-panel`;
  return (
    <div className={cx(styles.root, className)}>
      <div role="tablist" className={styles.list}>
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={tabIdOf(id, item.value)}
            className={styles.tab}
            aria-selected={item.value === value}
            aria-controls={panelId}
            onClick={() => onValueChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={tabIdOf(id, value)}>
        {children}
      </div>
    </div>
  );
}
