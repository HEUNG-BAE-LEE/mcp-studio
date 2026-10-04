// apps/web/src/api/dummy/error.ts — 더미 함수 공통: 짧은 인공 지연 · 상태 · 오류 code · 필드 사유 코드 · ApiError 만들기
import { ApiError } from '../errors';
import { getScenario, type Scenario } from './scenario';

/** 응답이 오는 데 걸리는 척하는 시간 */
export const DUMMY_DELAY_MS = 150;
const delay = (ms: number = DUMMY_DELAY_MS) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** ?mock=slow — 지연 배수 */
const SLOW_FACTOR = 10;

type RespondOptions = {
  /** failed에서 빠진다(fetchUser — 앱 셸이 떠야 한다) */
  exempt?: boolean;
  /** 변경 요청 — write-failed에서 거절 */
  write?: boolean;
  /** 영역 조회(라우트 화면 본문 screenGate(inline 아님)에 묶이지 않는 읽기 — 영역 · 층 내용 열 · 셸) — region-failed에서 거절 */
  region?: boolean;
};
const failsIn = (scenario: Scenario, options: RespondOptions) =>
  (scenario === 'failed' && !options.exempt) ||
  (scenario === 'write-failed' && options.write === true) ||
  (scenario === 'region-failed' && options.region === true);
const failedRaw = (scenario: Scenario) =>
  `Internal Server Error: upstream connection refused (dummy ?mock=${scenario})`;

/**
 * 지연 뒤 값을 돌려준다 — 더미 함수의 성공 경로. 모든 더미 함수가 여기를 지난다.
 * ?mock=slow면 지연 ×10. 실패 시나리오면 지연 뒤 500 INTERNAL(원문 포함)로 거절한다 —
 * failed는 `exempt` 밖 전부, write-failed는 `write`(변경 요청), region-failed는 `region`(영역 조회) 표시가 붙은 것만.
 * 라우트 화면 본문 screenGate에 묶이는 조회는 표시하지 않는다(failed에서만 실패).
 */
export async function respond<T>(produce: () => T, options: RespondOptions = {}): Promise<T> {
  const scenario = getScenario();
  await delay(scenario === 'slow' ? DUMMY_DELAY_MS * SLOW_FACTOR : DUMMY_DELAY_MS);
  if (failsIn(scenario, options))
    throw new ApiError(STATUS.INTERNAL, ERROR_CODE.INTERNAL, undefined, failedRaw(scenario));
  return produce();
}

export const STATUS = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
} as const;
export const ERROR_CODE = {
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL: 'INTERNAL',
  VALIDATION: 'VALIDATION',
  NAME_DUPLICATE: 'PROJECT_NAME_DUPLICATE',
  INGEST_RUNNING: 'INGEST_RUNNING',
  INGEST_NOT_RUNNING: 'INGEST_NOT_RUNNING',
  SOURCE_NOT_READY: 'SOURCE_NOT_READY',
} as const;
export const FIELD_REASON = {
  REQUIRED: 'REQUIRED',
  DUPLICATE: 'DUPLICATE',
  INVALID: 'INVALID',
} as const;

export const apiError = (
  status: number,
  code: string,
  fields?: Record<string, string>,
  subjects?: readonly string[],
) => new ApiError(status, code, fields, undefined, subjects);
export const notFoundError = () => apiError(STATUS.NOT_FOUND, ERROR_CODE.NOT_FOUND);
