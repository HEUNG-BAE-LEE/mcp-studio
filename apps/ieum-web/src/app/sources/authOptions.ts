// 원본 인증 방식 — 연결 방식(모드)마다 고를 수 있는 방식 · 시작 값 · 전달 위치 바꾸기(옛 js/menu/sources.js:81-84,135,189)
// 연결 마법사 3단계와 재인증 모달이 함께 쓴다. 순수 함수만 둔다 — 받은 인증 정보는 고치지 않고 새로 만든다
//
// ── 쓰는 곳 계약 ──
// initialCred(type?) — 인증 칸의 시작 값. 마법사는 인자 없이(인증 없음), 재인증은 원본의 authType(비었으면 인증 없음 — 옛 :135)
// coerceAuthType(mode, cred) — 그 모드의 선택지에 없는 방식이면 첫 선택지로 바꾼다(그 밖의 칸은 그대로). 옛은 인증 칸을 그릴 때 바꿨다(:87) —
//   그 순간에 맞춰 마법사는 3단계로 들어갈 때, 재인증은 모달을 열 때 한 번 부른다. 모드를 고를 때 바로 바꾸지 않는다
//   (REST에서 OAuth → SOAP 카드 → 다시 REST로 돌아오면 옛은 OAuth가 남았다)
// authOptionsOf(mode) — 선택지. 표에 없는 모드는 REST 목록이다(옛 AUTH_OPTS[w.mode] || AUTH_OPTS.rest)
// changeKeyLocation(cred, location) — API Key 전달 위치를 바꾼다. 이름이 비었거나 기본 이름이면 새 위치의 기본 이름으로(옛 :189)
import type { AuthType, SourceCred } from '../../api/types';
import { SOURCES } from '../../copy/sources';

export type AuthOption = Readonly<{ value: AuthType; label: string }>;
/** API Key 전달 위치 — 요청 헤더 · 쿼리 파라미터 */
export type KeyLocation = 'header' | 'query';

/** 헤더로 보낼 때의 기본 키 이름 — 이름 칸 자리표시이기도 하다(옛 :48,90) */
export const KEY_HEADER_DEFAULT = 'X-API-KEY';
/** 쿼리로 보낼 때의 기본 키 이름(옛 :189) */
export const KEY_QUERY_DEFAULT = 'api_key';
export const KEY_LOCATIONS: readonly KeyLocation[] = ['header', 'query'];

const DEFAULT_AUTH_TYPE: AuthType = 'none';
const DEFAULT_KEY_LOCATION: KeyLocation = 'header';
const M = SOURCES.auth.methods;

const option = (value: AuthType, label: string): AuthOption => ({ value, label });

// REST · 호출 샘플 · 표에 없는 모드(옛 :82-83)
const REST_OPTIONS: readonly AuthOption[] = [
  option('none', M.none),
  option('key', M.key),
  option('bearer', M.bearer),
  option('basic', M.basic),
  option('oauth', M.oauth),
];

// 공공데이터의 key 선택지 글자는 "서비스키"다(옛 :81). disc는 자동 탐색으로 만든 원본의 재인증(옛 :84)
const AUTH_OPTIONS: Readonly<Record<string, readonly AuthOption[]>> = {
  gov: [option('key', SOURCES.auth.serviceKey)],
  soap: [option('none', M.none), option('wss', M.wss), option('basic', M.basic)],
  rest: REST_OPTIONS,
  sample: REST_OPTIONS,
  disc: [option('session', M.session)],
};

/** 그 모드에서 고를 수 있는 인증 방식 — 화면 순서 그대로 */
export function authOptionsOf(mode: string): readonly AuthOption[] {
  return (Object.hasOwn(AUTH_OPTIONS, mode) ? AUTH_OPTIONS[mode] : undefined) ?? REST_OPTIONS;
}

/** 인증 칸의 시작 값 — 방식(비었으면 인증 없음) · 헤더 · 기본 키 이름. 비밀 칸은 비어 있다 */
export function initialCred(type?: AuthType): SourceCred {
  return { type: type || DEFAULT_AUTH_TYPE, in: DEFAULT_KEY_LOCATION, name: KEY_HEADER_DEFAULT };
}

/** 그 모드의 선택지에 없는 방식이면 첫 선택지로. 있으면 받은 값을 그대로 돌려준다 */
export function coerceAuthType(mode: string, cred: SourceCred): SourceCred {
  const options = authOptionsOf(mode);
  if (options.some((o) => o.value === cred.type)) return cred;
  const [first] = options;
  return first === undefined ? cred : { ...cred, type: first.value };
}

const isDefaultKeyName = (name: string | undefined): boolean =>
  !name || name === KEY_HEADER_DEFAULT || name === KEY_QUERY_DEFAULT;

/** 전달 위치를 바꾼다. 사용자가 바꾼 이름은 두고, 비었거나 기본 이름이면 새 위치의 기본 이름으로 */
export function changeKeyLocation(cred: SourceCred, location: KeyLocation): SourceCred {
  const defaultName = location === 'header' ? KEY_HEADER_DEFAULT : KEY_QUERY_DEFAULT;
  return { ...cred, in: location, name: isDefaultKeyName(cred.name) ? defaultName : cred.name };
}

/** select 값을 전달 위치로 — 선택지 밖 값은 헤더로 본다 */
export const keyLocationOf = (value: string | undefined): KeyLocation =>
  KEY_LOCATIONS.find((l) => l === value) ?? DEFAULT_KEY_LOCATION;
