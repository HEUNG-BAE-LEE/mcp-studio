// RuleChip — 이음 변환 규칙 칩(.rl — css/console.css:696-700, ruleChip() js/common/state.js:37). 받은 글자와 분류 색만 그린다.
// 설명이 있을 때만 툴팁(title)과 도움말 커서를 낸다 — 고정 "이름 정리" 칩은 설명이 없다
import type { RuleCategory } from '@/app/trace/types';
import styles from './RuleChip.module.css';

export type RuleChipProps = {
  /** 칩 글자(규칙 이름) */
  label: string;
  /** 분류 색 — 옛 nm · cv · ij · mk */
  category: RuleCategory;
  /** 설명 툴팁(title) */
  description?: string;
};

export function RuleChip({ label, category, description }: RuleChipProps) {
  return (
    <span className={styles.root} data-category={category} title={description}>
      {label}
    </span>
  );
}
