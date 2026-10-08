// 원본 시스템의 상태 값 계산(옛 js/common/state.js:18-26 srcStat). 값만 계산한다 — 라벨 · 색 · 점은 copy/status와 디자인 부품이 맡는다
// 대시보드 KPI · 구조도 · 원본 목록이 같은 값을 쓴다. 공개 수 · 검토 수도 여기서 센다(원본 목록 AI 도구 칸)
// 값 목록은 copy/status의 원본 상태 하나뿐이다(SourceStatusValue) — 서버가 내는 값만 두고, 옛 `busy`(분석 중)는
// 서버가 내지 않는 값이라 뺐다(옛 js/common/state.js:20,26 — 이식 기간 고침). 모르는 상태가 새로 생기면 그 목록만 늘린다
import type { Source, ToolRecord } from '../../api/types';
import type { SourceStatusValue } from '../../copy/status';

/**
 * 판정 순서는 인증 만료(err) → 명세 변경(drift) → 검토 필요(review) → 정상(ok)이다.
 * tools는 그 원본의 도구 목록 — 한 도구라도 drift면 원본이 drift, review면 review다
 */
export function sourceStatusOf(source: Source, tools: readonly ToolRecord[]): SourceStatusValue {
  if (source.err) return 'err';
  if (tools.some((t) => t.status === 'drift')) return 'drift';
  if (tools.some((t) => t.status === 'review')) return 'review';
  return 'ok';
}

/** 공개 중인 도구 수(status done) — 옛 srcPub(js/common/state.js:31) */
export const publishedCount = (tools: readonly ToolRecord[]): number => tools.filter((t) => t.status === 'done').length;

/** 검토가 필요한 도구 수(status review · drift) — 옛 srcPending(js/common/state.js:32) */
export const pendingCount = (tools: readonly ToolRecord[]): number =>
  tools.filter((t) => t.status === 'review' || t.status === 'drift').length;
