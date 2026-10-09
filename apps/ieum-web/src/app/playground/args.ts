// 테스트 실행 인자 폼의 순수 함수 — 옛 argDefault · pgArgs · pgCoerce · pgArgsHTML(js/menu/playground.js:3-31)과
// 확인 상자 인자 목록(js/common/convert.js:172). 같은 입력에 옛과 같은 값을 낸다:
// 옵션 밖 초기값도 그대로 실린다 · 공백만 있는 숫자 칸은 0 · 정수 칸의 1.5도 그대로 · 필수 검사는 서버가 한다
//
// 폼 값은 도구 id별로 저장소(app/playground/store)에 글자로 남는다. 아직 채우지 않은 칸(undefined)은 초기값으로 본다 —
// 옛은 그릴 때와 실행 때마다 빈 칸을 초기값으로 채웠다(pgArgs). 한 번 채운 값은 스튜디오에서 예시가 바뀌어도 그대로다
import type { ToolParam, ToolRecord } from '../../api/types';
import { PLAYGROUND } from '../../copy/playground';
import { visibleParams } from '../convert/visibleParams';
import { own } from '../trace/own';

/** 도구 하나의 폼 값 { AI 파라미터 이름: 입력 글 } */
export type ArgValues = Readonly<Record<string, string>>;

/** 호출 인자 { AI 파라미터 이름: 타입대로 바꾼 값 } */
export type CallArgs = Readonly<Record<string, unknown>>;

export type CoerceResult = Readonly<{ ok: true; args: CallArgs }> | Readonly<{ ok: false; message: string }>;

/** 칸 모양: 고르기(코드표 AI 값 · enum) · 참/거짓 고르기 · 글자(객체 · 배열이면 고정폭). 고르기는 맨 앞 빈 옵션을 쓰는 곳이 더한다 */
export type ArgInput =
  | Readonly<{ kind: 'select'; options: readonly string[] }>
  | Readonly<{ kind: 'boolean'; options: readonly string[] }>
  | Readonly<{ kind: 'text'; mono: boolean }>;

type ParamsOf = Pick<ToolRecord, 'params'>;
type Coerced = Readonly<{ ok: true; value: unknown }> | Readonly<{ ok: false; message: string }>;

const NUMBER_TYPES: ReadonlySet<string> = new Set(['integer', 'number']);
const JSON_TYPES: ReadonlySet<string> = new Set(['object', 'array']);
const BOOLEAN_TYPE = 'boolean';
const DEFAULT_TYPE = 'string';
/** 참/거짓 칸에서 true로 보내는 글 — 그 밖(false 포함)은 false */
const BOOLEAN_TRUE = 'true';
const BOOLEAN_OPTIONS: readonly string[] = [BOOLEAN_TRUE, 'false'];

/** AI 타입의 첫 낱말("string (date)" → string). 비었으면 string */
const baseType = (p: ToolParam): string => (p.at || DEFAULT_TYPE).split(' ')[0] ?? DEFAULT_TYPE;

// 저장된 값은 자기 키만 본다 — 파라미터 이름이 'constructor' 같아도 Object.prototype 값을 폼 값으로 읽지 않게
const ownValue = (values: ArgValues | undefined, name: string): string | undefined =>
  values === undefined ? undefined : own(values, name);

/** 객체(null 포함)는 JSON 글, 나머지는 글자로 — 없으면 빈 글(옛 esc의 String(s ?? '')) */
const jsonText = (value: unknown): string =>
  typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');

/** 칸 초기값 — AI 쪽 예시(ax)가 있으면 그것, 없으면 원본 예시(ex). null · undefined는 빈 글, 객체는 JSON 글 */
export function argDefault(p: Pick<ToolParam, 'ax' | 'ex'>): string {
  const value: unknown = p.ax !== undefined ? p.ax : p.ex;
  return value === undefined || value === null ? '' : jsonText(value);
}

/** 그릴 · 보낼 폼 값 — 보이는 파라미터마다 저장된 글, 아직 채우지 않은 칸은 초기값. 저장소는 바꾸지 않는다 */
export function argValues(tool: ParamsOf, stored: ArgValues | undefined): ArgValues {
  return Object.fromEntries(visibleParams(tool).map((p) => [p.a, ownValue(stored, p.a) ?? argDefault(p)]));
}

/** 채울 칸이 있으면 저장된 값에 초기값을 더한 새 객체, 없으면 null(저장소를 바꾸지 않는다). 처음 보는 도구는 빈 객체라도 만든다(옛 pgArgs) */
export function fillArgs(tool: ParamsOf, stored: ArgValues | undefined): ArgValues | null {
  const missing = visibleParams(tool).filter((p) => ownValue(stored, p.a) === undefined);
  if (missing.length === 0) return stored === undefined ? {} : null;
  return { ...stored, ...Object.fromEntries(missing.map((p) => [p.a, argDefault(p)])) };
}

/** 칸 하나의 글을 인자 타입대로 */
function coerceOne(p: ToolParam, raw: string): Coerced {
  const type = baseType(p);
  if (NUMBER_TYPES.has(type)) {
    const n = Number(raw);
    return Number.isNaN(n) ? { ok: false, message: PLAYGROUND.args.notNumber(p.a) } : { ok: true, value: n };
  }
  if (type === BOOLEAN_TYPE) return { ok: true, value: raw === BOOLEAN_TRUE };
  if (!JSON_TYPES.has(type)) return { ok: true, value: raw };
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, message: PLAYGROUND.args.notJson(p.a) };
  }
}

/**
 * 폼 값 → 호출 인자(옛 pgCoerce). 보이는 파라미터 순서로 보고, 빈 칸은 보내지 않으며, 처음 틀린 칸의 문장으로 실패한다(요청은 보내지 않는다).
 * values는 argValues의 결과(아직 채우지 않은 칸도 초기값으로 들어 있다)
 */
export function coerceArgs(tool: ParamsOf, values: ArgValues): CoerceResult {
  const entries: [string, unknown][] = [];
  for (const p of visibleParams(tool)) {
    const raw = ownValue(values, p.a);
    if (raw === undefined || raw === '') continue;
    const coerced = coerceOne(p, raw);
    if (!coerced.ok) return coerced;
    entries.push([p.a, coerced.value]);
  }
  return { ok: true, args: Object.fromEntries(entries) };
}

/**
 * 칸 모양(옛 pgArgsHTML). 코드표가 있으면 AI 값, 없으면 enum(빈 배열이어도 고르기 — 빈 옵션 하나뿐), 그 밖은 타입으로.
 * 옵션 글은 옛 esc(o)와 같이 String(o ?? '')다. 저장된 값이 옵션에 없으면 화면은 빈 옵션을 보이고 호출에는 그 값이 실린다(옛 그대로).
 * 옵션 값은 그 글 원문이다 — 옛 <option>은 value 속성이 없어 HTML이 앞뒤 · 겹친 공백을 다듬은 값을 보냈다(js/menu/playground.js:28,118)
 */
export function inputKind(p: ToolParam): ArgInput {
  const options = p.codes && p.codes.length > 0 ? p.codes.map((c) => c[1]) : p.enum;
  if (options) return { kind: 'select', options: options.map((o) => String(o ?? '')) };
  const type = baseType(p);
  if (type === BOOLEAN_TYPE) return { kind: 'boolean', options: BOOLEAN_OPTIONS };
  return { kind: 'text', mono: JSON_TYPES.has(type) };
}

/** 확인 상자 인자 목록 [이름, 보이는 글] — 보낸 인자(trace.args) 순서 그대로. 객체는 JSON 글(옛 convert.js:172) */
export function holdRows(args: Readonly<Record<string, unknown>> | undefined): readonly (readonly [string, string])[] {
  return Object.entries(args || {}).map(([name, value]) => [name, jsonText(value)] as const);
}
