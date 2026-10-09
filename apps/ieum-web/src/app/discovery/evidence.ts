// 근거 드로어가 API 후보 하나에서 고르는 것 — 순수 함수만 둔다(옛 discEvidenceOpen의 판단 부분 — js/menu/discovery.js:326-355). 문구는 copy/discovery
import type { ApiParam, DiscoveryApi, EvidenceKind, JobStatus, RecommendKind, Scalar } from '../../api/types';

/** 근거 조각을 그리는 강조 — 옛 hlSrc는 java만 강조하고 나머지(js 등)는 글자 그대로였다(:326). CodeBlock 언어로 그대로 넘긴다 */
export type EvidenceCodeLang = 'java' | 'plain';
export const codeLangOf = (lang: string): EvidenceCodeLang => (lang === 'java' ? 'java' : 'plain');

/** 파라미터 추론 표 "관찰한 값" — 관찰 값이 있으면 그것, 없고 헤더면 헤더 고정 값 하나, 그 밖은 비움("관찰 없음")(옛 :351) */
export function observedOf(param: ApiParam): readonly Scalar[] {
  if (param.obs !== undefined && param.obs.length > 0) return param.obs;
  return param.loc === 'header' && param.v !== undefined ? [param.v] : [];
}

/** 파라미터 추론 표 "소스 타입" — 소스 근거가 있거나 헤더면 원본 타입, 아니면 null("소스 없음")(옛 :351) */
export const sourceTypeOf = (param: ApiParam, hasSource: boolean): string | null =>
  hasSource || param.loc === 'header' ? param.ot : null;

/** 근거가 소스와 트래픽 둘 다인가 — 아니면(범위 밖 포함) 발에 "한 가지라…"(옛 :354 — 이식 기간 보존) */
export const isBothEvidence = (ev: EvidenceKind): boolean => ev === 'both';

/** 추천 이유 상자 색 — 추천은 기본, 확인 필요는 경고, 그 밖(제외 · 모르는 값)은 흐림(옛 :339) */
export type RecommendNoticeTone = 'info' | 'warn' | 'mute';
export function recommendNoticeToneOf(rec: RecommendKind): RecommendNoticeTone {
  if (rec === 'yes') return 'info';
  return rec === 'check' ? 'warn' : 'mute';
}

/** 선택할 수 있는 API — 도구 이름이 있고 아직 등록 전인 작업(옛 :280,359) */
export const canSelectApi = (api: DiscoveryApi, status: JobStatus): boolean => Boolean(api.tool) && status !== 'done';
