// 변환 흐름 허브의 규칙 요약 — 입력 · 응답 매핑의 규칙별 개수(keep 제외, 처음 나온 순). 옛 ruleCounts(js/common/convert.js:130-134)
// 옛은 모르는 규칙 키에서 렌더가 멈췄다(RULE[k][0] — js/menu/studio.js:88). 여기는 값 그대로 라벨로 쓴다
import type { RuleName, ToolRecord } from '../../api/types';
import { warnOnce } from '../../copy/status';
import { RULES } from '../../copy/trace';

export type RuleCount = Readonly<{ rule: RuleName; label: string; count: number }>;

type Counts = Readonly<Record<string, number>>;

const KEEP: RuleName = 'keep';

/** 규칙 라벨(copy/trace RULES). 모르는 키는 값 그대로 + 개발 콘솔 경고 한 번 */
export function ruleLabel(rule: RuleName): string {
  if (Object.hasOwn(RULES, rule)) return RULES[rule as keyof typeof RULES].label;
  warnOnce(`알 수 없는 변환 규칙: ${rule}`);
  return rule;
}

const countOf = (counts: Counts, rule: string): number => (Object.hasOwn(counts, rule) ? (counts[rule] ?? 0) : 0);

/** 규칙이 비었거나 keep인 행은 세지 않는다. 키 순서는 옛 객체 대입과 같다 */
export function ruleCounts(tool: Pick<ToolRecord, 'params' | 'res'>): readonly RuleCount[] {
  const counts = [...tool.params, ...tool.res].reduce<Counts>(
    (acc, row) => (row.rule && row.rule !== KEEP ? { ...acc, [row.rule]: countOf(acc, row.rule) + 1 } : acc),
    {},
  );
  return Object.entries(counts).map(([rule, count]) => ({ rule, label: ruleLabel(rule), count }));
}
