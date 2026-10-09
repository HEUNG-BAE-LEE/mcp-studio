// 호출 로그 필터 — 주소 상태 읽기 · 행 거르기 · 상태별 개수(순수 함수). 런타임 import가 없다(타입만).
// 거르는 식은 옛 logRows(apps/web/ieum/js/menu/logs.js:7-11)와 같은 입력에 같은 결과를 낸다:
// 상태 · 클라이언트 · 검색어를 모두 만족(AND), 검색어는 앞뒤 공백을 떼고 소문자로, 대상은 도구 id + 사용자 + 원본 이름을
// 구분자 없이 이은 한 문자열(경계에 걸친 검색어도 맞는다 — logs.js:10). 서버 순서(최신 위)를 그대로 두고 정렬하지 않는다
import type { LogRow } from '../../api/types';

/** 주소 검색 파라미터 이름 — 전체 · 빈 값이면 주소에서 뺀다 */
export const LOG_PARAM = Object.freeze({ status: 'status', client: 'client', q: 'q', log: 'log' } as const);

/** 필터 "전체" 값 — 칩 · 선택지의 값이고 주소에는 쓰지 않는다 */
export const ALL = 'all';

export type LogStatusFilter = typeof ALL | 'ok' | 'err';

export type LogFilter = Readonly<{
  status: LogStatusFilter;
  /** "all" 또는 모델 키 */
  client: string;
  /** 입력 원문 — 거를 때 trim · 소문자 */
  q: string;
}>;

export type LogCounts = Readonly<{ all: number; ok: number; err: number }>;

const STATUS_FILTERS: readonly LogStatusFilter[] = ['ok', 'err'];

const isStatusFilter = (value: string | null): value is LogStatusFilter =>
  value !== null && (STATUS_FILTERS as readonly string[]).includes(value);

/**
 * 주소의 status · client. 모르는 값 · 빈 값은 전체로 보고 주소는 고치지 않는다.
 * 모델 조회가 실패했으면 빈 목록을 넘긴다(선택지가 "전체"뿐이라 어떤 client든 전체). 화면은 모델 조회가 끝난 뒤에 그린다
 */
export function parseLogFilter(params: URLSearchParams, modelKeys: readonly string[]): Pick<LogFilter, 'status' | 'client'> {
  const status = params.get(LOG_PARAM.status);
  const client = params.get(LOG_PARAM.client);
  const isKnownClient = client !== null && client !== '' && modelKeys.includes(client);
  return {
    status: isStatusFilter(status) ? status : ALL,
    client: isKnownClient ? client : ALL,
  };
}

/**
 * 조건에 맞는 행. sourceNameOf는 도구 id → 원본 이름이고, 지워진 도구면 빈 문자열이다(옛 TOOL[l.tool] ? … : '').
 * user가 비면 빈 문자열로 잇는다(옛 l.user || '')
 */
export function filterLogs(
  rows: readonly LogRow[],
  filter: LogFilter,
  sourceNameOf: (toolId: string) => string,
): readonly LogRow[] {
  const q = filter.q.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (filter.status === ALL || row.status === filter.status) &&
      (filter.client === ALL || row.client === filter.client) &&
      (!q || (row.tool + (row.user || '') + sourceNameOf(row.tool)).toLowerCase().includes(q)),
  );
}

/** 상태 칩 개수 — 받은 전체 기준이고 필터와 상관없다(옛 logs.js:16,19). 서버 counts는 쓰지 않는다 */
export function countLogs(rows: readonly LogRow[]): LogCounts {
  return {
    all: rows.length,
    ok: rows.filter((row) => row.status === 'ok').length,
    err: rows.filter((row) => row.status === 'err').length,
  };
}
