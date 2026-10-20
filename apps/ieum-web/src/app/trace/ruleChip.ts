// 규칙 키 → 칩 데이터(라벨 · 설명 · 색 분류). 옛 ruleChip(js/common/state.js:37) · RULE(js/common/rules.js:2-20)
import { RULES, TRACE, type RuleKey } from '../../copy/trace';
import type { RuleName } from '../../api/types';
import type { RuleCategory, TraceChip } from './types';

/** 규칙별 색 분류 — 옛 rules.js 두 번째 값(nm · cv · ij · mk) */
const RULE_CATEGORY: Readonly<Record<RuleKey, RuleCategory>> = Object.freeze({
  name: 'name',
  keep: 'name',
  date: 'convert',
  time: 'convert',
  num: 'convert',
  code: 'convert',
  geo: 'convert',
  unit: 'convert',
  strip: 'convert',
  md: 'convert',
  filter: 'convert',
  inject: 'inject',
  page: 'inject',
  calc: 'inject',
  ctx: 'inject',
  pad: 'convert',
  mask: 'mask',
});

const isRuleKey = (rule: RuleName): rule is RuleKey => Object.hasOwn(RULES, rule);

/** 모르는 규칙 키는 null — 옛은 빈 글자로 건너뛰었다(state.js:37) */
export const ruleChip = (rule: RuleName): TraceChip | null =>
  isRuleKey(rule)
    ? { rule, label: RULES[rule].label, description: RULES[rule].description, category: RULE_CATEGORY[rule] }
    : null;

/** 목록의 아는 규칙만 칩으로(순서 그대로). 목록이 없으면 빈 배열 */
export const ruleChips = (rules: readonly RuleName[] | null | undefined): readonly TraceChip[] =>
  (rules ?? []).flatMap((rule) => {
    const chip = ruleChip(rule);
    return chip ? [chip] : [];
  });

/** 2단계 끝에 늘 붙는 고정 칩(js/common/convert.js:179) */
export const AUTH_INJECT_CHIP: TraceChip = Object.freeze({
  label: TRACE.authInject,
  description: TRACE.authInjectDesc,
  category: 'inject',
});

/** 결과 단계에 그릴 칩이 없을 때의 고정 칩 — 설명이 없다(js/common/convert.js:182) */
export const NAME_FALLBACK_CHIP: TraceChip = Object.freeze({ label: TRACE.nameFallback, category: 'name' });
