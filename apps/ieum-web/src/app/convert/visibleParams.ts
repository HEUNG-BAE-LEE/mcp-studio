// AI에게 보이는 입력 파라미터 — 옛 visibleParams(js/common/convert.js:3-6) · HIDDEN(js/common/rules.js:21).
// 스튜디오(변환 흐름 노출 수 · 매핑 표 · MCP 정의)와 테스트 실행(인자 폼)이 같이 쓴다
import type { RuleName, ToolRecord } from '../../api/types';

/** AI에게 보이지 않는 규칙 — 값은 이음이 넣는다(자동 주입 · 페이지 수집 · 자동 계산 · 로그인 사용자) */
export const HIDDEN_RULES: ReadonlySet<RuleName> = new Set<RuleName>(['inject', 'page', 'calc', 'ctx']);

export const isHiddenRule = (rule: RuleName): boolean => HIDDEN_RULES.has(rule);

type ParamsOf = Pick<ToolRecord, 'params'>;

const isExposable = (p: ToolRecord['params'][number]): boolean => Boolean(p.a) && !isHiddenRule(p.rule);

/** AI 이름(a)이 있고 숨김 규칙이 아닌 파라미터. 같은 AI 이름은 처음 것만 남긴다(옛 seen 집합과 같은 순서 · 같은 결과) */
export function visibleParams(tool: ParamsOf): ToolRecord['params'] {
  return tool.params.filter(
    (p, index) => isExposable(p) && tool.params.findIndex((q) => isExposable(q) && q.a === p.a) === index,
  );
}
