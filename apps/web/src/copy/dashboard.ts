// apps/web/src/copy/dashboard.ts — 대시보드 문구 틀. 서버는 code · 수 · 시각만 준다
import type { DashboardCall, UsageRange } from '../api/types';
import { formatLatency, rangeLabel } from './format';
import { dayRangeLabel } from './time';
import { warnOnce } from './warnOnce';

const RANGE_DAYS: Readonly<Record<UsageRange, number>> = { '7d': 7, '30d': 30 };
/** `최근 7일` — copy/format의 rangeLabel */
export const usageRangeLabel = (range: UsageRange) => rangeLabel(RANGE_DAYS[range]);

export const DASHBOARD = {
  loading: '집계를 불러오는 중…',
  asOfLabel: '기준',
  asOfNone: '호출 기록 없음',
  compositionTitle: '구성 총합',
  composition: {
    sources: '소스',
    connectors: '커넥터',
    tools: '도구 (발행 기준)',
    attention: '점검 필요',
    called: '호출됨',
    notCalled: '호출 없음',
  },
  heatmapTitle: '요일 · 시간대별 호출',
  heatmapNoteNone: '집계할 호출이 없다',
  /** 히트맵 격자의 접근성 이름(role=img) */
  heatmapAlt: '요일 · 시간대별 호출 밀도 — 짙을수록 호출이 많다',
  reservedTitle: '제목 미정',
  reservedNote: '빈 영역',
  rankingTitle: '호출 순위',
  rankingColumns: { rank: '순위', connector: '커넥터', calls: '호출' },
  liveTitle: '실시간 호출',
  liveMarker: '실시간',
  liveColumns: { at: '시각', connector: '커넥터', tool: '도구', result: '결과' },
} as const;

export type EmptyCopy = Readonly<{ title: string; body: string }>;
const RANKING_EMPTY_NO_CONNECTORS: EmptyCopy = {
  title: '발행된 커넥터가 없다',
  body: '커넥터를 발행하면 순위가 집계된다.',
};
const RANKING_EMPTY_NO_CALLS_TITLE = '집계된 호출이 없다';
const LIVE_EMPTY_TITLE = '들어온 호출이 없다';
const LIVE_EMPTY_NO_CONNECTORS = '커넥터를 발행하면 호출이 표시된다.';
const LIVE_EMPTY_NO_CALLS = '호출이 들어오면 실시간으로 표시된다.';

/** 히트맵 머리 메모 — 기간(`YYYY-MM-DD – YYYY-MM-DD`, copy/time의 dayRangeLabel) */
export const formatHeatmapNote = (period: { from: string; to: string }, hasCalls: boolean) =>
  hasCalls ? dayRangeLabel(period.from, period.to) : DASHBOARD.heatmapNoteNone;
/** 발행된 커넥터가 없으면 첫째, 있는데 호출이 없으면 둘째 */
export const rankingEmpty = (published: number, range: UsageRange): EmptyCopy =>
  published === 0
    ? RANKING_EMPTY_NO_CONNECTORS
    : {
        title: RANKING_EMPTY_NO_CALLS_TITLE,
        body: `${usageRangeLabel(range)}간 호출 기록이 없다.`,
      };
export const liveEmpty = (published: number): EmptyCopy => ({
  title: LIVE_EMPTY_TITLE,
  body: published === 0 ? LIVE_EMPTY_NO_CONNECTORS : LIVE_EMPTY_NO_CALLS,
});

const WEEKDAY = ['월', '화', '수', '목', '금', '토', '일'] as const;
/** ISO 요일 1–7 → 월…일. 범위 밖은 수 그대로(깨지지 않게) */
export const weekdayLabel = (weekday: number) => WEEKDAY[weekday - 1] ?? String(weekday);
export const hourLabel = (hour: number) => String(hour);

const CALL_ERROR: Readonly<Record<string, string>> = {
  PERMISSION_DENIED: '권한 거부',
  TIMEOUT: '시간 초과',
};
const UNKNOWN_CODE = 'UNKNOWN';
const NO_LATENCY = '기록 없음';
/** 결과 셀 문구. 모르는 코드는 기본 틀 + console.warn, 지연이 없으면 사유 */
export function formatCallResult(
  call: Pick<DashboardCall, 'result' | 'latencyMs' | 'errorCode'>,
): string {
  if (call.result === 'failed') {
    const code = call.errorCode ?? UNKNOWN_CODE;
    const known = CALL_ERROR[code];
    if (known) return known;
    warnOnce(`call-error:${code}`, `[copy] 모르는 호출 오류 코드 ${code}`);
    return `알 수 없는 오류 · ${code}`;
  }
  return call.latencyMs === undefined ? NO_LATENCY : formatLatency(call.latencyMs);
}
