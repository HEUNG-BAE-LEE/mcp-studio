// apps/web/src/copy/errors.ts — 아는 실패 code · 필드 사유 코드 → 문구(DESIGN Patterns 실패 · 권한)
// 새 409 · 검증 code는 여기에 틀을 더한다(KNOWN_FAILURE). 틀이 없는 code는 ErrorBlock 원문으로 보인다
import { ApiError } from '@/api/errors';
import { warnOnce } from './warnOnce';

export const PERMISSION_DENIED = '권한이 없다 · 소유자에게 요청';
export const RETRY = '다시 시도';
/** 404 한 줄(화면 상태 골격 · HTTP 404) */
export const NOT_FOUND = '찾을 수 없음';
/** 폼 검증 문구(Error.fields 값) — 한 줄 상태라 평서 `…다` */
const FIELD: Readonly<Record<string, string>> = {
  DUPLICATE: '중복된 이름이 있다',
  REQUIRED: '필수 항목이다',
  INVALID: '허용되지 않는 값이다',
};

/** 알려진 code → 한 줄 상태 문장 틀(`…다`). 보간한 이름 · 값 바로 뒤에 조사를 붙이지 않는다 */
export const KNOWN_FAILURE: Readonly<Record<string, (e: ApiError) => string>> = {
  // 필드 사유(`fields`)가 오면 fieldMessage, 필드 없이 code만 오면 이 틀 — 같은 뜻은 같은 문장
  PROJECT_NAME_DUPLICATE: () => FIELD.DUPLICATE ?? '',
  INGEST_RUNNING: () => '이미 수집 중이다',
  INGEST_NOT_RUNNING: () => '수집 중이 아니다',
  SOURCE_NOT_READY: () => '수집이 끝난 소스만 커넥터를 만들 수 있다',
};
/** 알려진 code면 문장, 아니면 null — ErrorBlock 원문으로 돌린다(갈래는 app/FailureBlock 하나) */
export function knownFailure(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const template = KNOWN_FAILURE[error.code];
  return template ? template(error) : null;
}

export function fieldMessage(code: string): string {
  const known = FIELD[code];
  if (known) return known;
  warnOnce(`field:${code}`, `[copy] 모르는 필드 사유 코드 ${code}`);
  return `알 수 없는 오류 · ${code}`;
}
/** ErrorBlock용 원문(규칙 8): code · status · 드라이버 원문 */
export function errorRaw(error: unknown): string {
  if (error instanceof ApiError)
    return [`${error.code} (${error.status})`, error.raw].filter(Boolean).join('\n');
  return error instanceof Error ? error.message : String(error);
}
