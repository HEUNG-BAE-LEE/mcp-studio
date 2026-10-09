// Segmented — 두세 항목을 붙여 놓은 주조색 필 묶음. 이음 .seg(css/console.css:719-723). 모양이 같은 두 역할이다
// SegmentedTabs = 탭(미리보기 — js/menu/studio.js:113-115) + SegmentedTabPanel, SegmentedRadio = 라디오(테스트 실행 AI 모델 — js/menu/playground.js:44).
// 항목마다 Tab으로 닿고 Enter · Space로 고른다 — 화살표 키 이동은 두지 않는다(옛 그대로). 묶음은 <span>이라 제목(h4) 안 동작 자리에 들어갈 수 있다
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './Segmented.module.css';

export type SegmentedItem = {
  /** 고르는 값 — SegmentedTabs는 이 값으로 탭 id를 만든다(영문 소문자 · 숫자 · -) */
  value: string;
  label: ReactNode;
};

type SegmentedCommon = {
  /** 항목 — 순서대로 */
  items: readonly SegmentedItem[];
  /** 고른 항목 */
  value: string;
  /** 누른 항목 — 이미 고른 항목이어도 부른다 */
  onValueChange: (value: string) => void;
  /** 배치만 */
  className?: string;
};

export type SegmentedTabsProps = SegmentedCommon & {
  /** 탭 · 패널 id 앞부분 — 탭 {idPrefix}-tab-{value} · 패널 {idPrefix}-panel. SegmentedTabPanel에 같은 값을 준다 */
  idPrefix: string;
};

export type SegmentedRadioProps = SegmentedCommon & {
  /** 묶음 이름(aria-label) */
  label: string;
};

export type SegmentedTabPanelProps = {
  /** SegmentedTabs와 같은 값 */
  idPrefix: string;
  /** 지금 탭 — 패널 이름(aria-labelledby)이 된다 */
  value: string;
  children: ReactNode;
  /** 배치만 */
  className?: string;
};

const tabIdOf = (idPrefix: string, value: string) => `${idPrefix}-tab-${value}`;
const panelIdOf = (idPrefix: string) => `${idPrefix}-panel`;

export function SegmentedTabs({ items, value, onValueChange, idPrefix, className }: SegmentedTabsProps) {
  return (
    <span role="tablist" className={cx(styles.root, className)}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          id={tabIdOf(idPrefix, item.value)}
          className={styles.item}
          aria-selected={item.value === value}
          aria-controls={panelIdOf(idPrefix)}
          onClick={() => onValueChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </span>
  );
}

/** 탭이 바꾸는 자리 하나 — 내용만 바꿔 그린다(옛 #preview 한 칸 — js/menu/studio.js:115,150) */
export function SegmentedTabPanel({ idPrefix, value, children, className }: SegmentedTabPanelProps) {
  return (
    <div role="tabpanel" id={panelIdOf(idPrefix)} aria-labelledby={tabIdOf(idPrefix, value)} className={className}>
      {children}
    </div>
  );
}

export function SegmentedRadio({ items, value, onValueChange, label, className }: SegmentedRadioProps) {
  return (
    <span role="radiogroup" aria-label={label} className={cx(styles.root, className)}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="radio"
          className={styles.item}
          aria-checked={item.value === value}
          onClick={() => onValueChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </span>
  );
}
