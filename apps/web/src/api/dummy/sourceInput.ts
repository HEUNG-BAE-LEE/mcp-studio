// apps/web/src/api/dummy/sourceInput.ts — 소스 배치 추가 입력 검증(시스템 경계). 형식이 틀리면 필드별 사유 코드
import type { SourceBatchInput, SourceMode, SourceType } from '../types';
import { FIELD_REASON } from './error';

const MODES: Readonly<Record<SourceType, readonly SourceMode[]>> = {
  code: ['url', 'dir'],
  database: ['conn', 'dsn'],
  document: ['upload', 'dir'],
};
/** 필수 칸(copy/addSource FORMS required와 같다) */
const REQUIRED: Readonly<Record<SourceMode, readonly string[]>> = {
  url: ['repo'],
  dir: ['dir'],
  conn: ['host', 'schema', 'account'],
  dsn: ['dsn'],
  upload: ['files'],
};
type Parsed = { ok: true; input: SourceBatchInput } | { ok: false; fields: Record<string, string> };
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStringMap = (v: unknown): v is Record<string, string> =>
  isRecord(v) && Object.values(v).every((x) => typeof x === 'string');
const isType = (v: unknown): v is SourceType =>
  v === 'code' || v === 'database' || v === 'document';

const isMode = (type: SourceType, v: unknown): v is SourceMode =>
  typeof v === 'string' && (MODES[type] as readonly string[]).includes(v);

/** 한 항목의 필드 오류를 모두 모은다(첫 오류에서 멈추지 않는다) */
function itemErrors(type: SourceType, item: unknown, index: number): Record<string, string> {
  const at = `items.${index}`;
  if (!isRecord(item)) return { [at]: FIELD_REASON.INVALID };
  const errors: Record<string, string> = {};
  const { mode, config } = item;
  if (!isMode(type, mode)) errors[`${at}.mode`] = FIELD_REASON.INVALID;
  if (typeof item.name !== 'string' || item.name.trim() === '')
    errors[`${at}.name`] = FIELD_REASON.REQUIRED;
  if (!isStringMap(config)) errors[`${at}.config`] = FIELD_REASON.INVALID;
  if (item.runtime !== undefined && !isStringMap(item.runtime))
    errors[`${at}.runtime`] = FIELD_REASON.INVALID;
  // 필수 칸은 모드와 config가 둘 다 올바를 때만 센다
  if (isMode(type, mode) && isStringMap(config))
    for (const code of REQUIRED[mode])
      if ((config[code] ?? '').trim() === '')
        errors[`${at}.config.${code}`] = FIELD_REASON.REQUIRED;
  return errors;
}

export function parseBatch(body: unknown): Parsed {
  if (!isRecord(body) || !isType(body.type))
    return { ok: false, fields: { type: FIELD_REASON.INVALID } };
  const { type, items } = body;
  if (!Array.isArray(items) || items.length === 0)
    return { ok: false, fields: { items: FIELD_REASON.REQUIRED } };
  const fields = Object.assign({}, ...items.map((item, i) => itemErrors(type, item, i))) as Record<
    string,
    string
  >;
  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return { ok: true, input: { type, items: items as SourceBatchInput['items'] } };
}
