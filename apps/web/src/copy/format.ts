// apps/web/src/copy/format.ts — 수 · 비율 · 지연 · 증감 문구의 유일한 자리. 화면은 여기서 가져다 쓴다
// 조사 규칙: 이름 · 값 뒤에 조사를 붙이지 않는다 — 문장 구조로 피한다(`X 연결을 해제할까요?`)

const MINUS = '−';
const MS_PER_SECOND = 1000;
const PERCENT = 100;
const NO_PREVIOUS = '이전 기간 없음';

/** 천 단위 쉼표 — `12,340` */
export const formatCount = (n: number) => n.toLocaleString('en-US');

/** 비율(0–1) → `3.2%` */
export const formatPercent = (ratio: number, digits = 1) => `${(ratio * PERCENT).toFixed(digits)}%`;

const signed = (value: number, body: string) => `${value < 0 ? MINUS : '+'}${body}`;

/** 퍼센트포인트 차이(비율 차, 0–1) → `+0.4%p` / `−0.4%p` */
export const formatPercentPoint = (delta: number, digits = 1) =>
  signed(delta, `${Math.abs(delta * PERCENT).toFixed(digits)}%p`);

type LatencyParts = { value: string; unit: 'ms' | 's' };

/** 값과 단위를 따로 그리는 자리(MetricCard `value` · `unit`) — 412 → `{ '412', 'ms' }`, 1200 → `{ '1.2', 's' }` */
export const formatLatencyParts = (ms: number): LatencyParts =>
  ms >= MS_PER_SECOND
    ? { value: (ms / MS_PER_SECOND).toFixed(1), unit: 's' }
    : { value: String(Math.round(ms)), unit: 'ms' };

/** 412 → `412ms`, 1200 → `1.2s`. 소수가 와도 반올림한다 — 경계 · 자릿수는 `formatLatencyParts` 하나 */
export const formatLatency = (ms: number): string => {
  const { value, unit } = formatLatencyParts(ms);
  return `${value}${unit}`;
};

/** 7 → `최근 7일` */
export const rangeLabel = (days: number) => `최근 ${days}일`;

type DeltaKind = 'count' | 'latency' | 'percent';

/**
 * `이전 7일 대비 +8.2%` — count · latency는 상대 %, percent(비율 0–1)는 %p.
 * 이전 값이 없거나 0이면(percent는 없을 때만) `이전 기간 없음`
 */
export function deltaLabel(
  current: number,
  previous: number | undefined,
  kind: DeltaKind,
  rangeDays: number,
): string {
  const head = `이전 ${rangeDays}일 대비`;
  if (previous === undefined) return NO_PREVIOUS;
  if (kind === 'percent') return `${head} ${formatPercentPoint(current - previous)}`;
  if (previous === 0) return NO_PREVIOUS;
  const relative = (current - previous) / previous;
  return `${head} ${signed(relative, `${Math.abs(relative * PERCENT).toFixed(1)}%`)}`;
}

/** 이미 퍼센트인 값(0–100, 진행률 등) → 정수 `42%`. 소수가 와도 반올림한다 */
export const formatPercentInt = (percent: number) => `${Math.round(percent)}%`;

type CountUnit = '건' | '개' | '회';

/** 수 + 단위 `12,340건` · `3개` · `5회` */
export const countUnitLabel = (n: number, unit: CountUnit) => `${formatCount(n)}${unit}`;

/** 5 → `약 5분` */
export const aboutMinutesLabel = (min: number) => `약 ${formatCount(min)}분`;
