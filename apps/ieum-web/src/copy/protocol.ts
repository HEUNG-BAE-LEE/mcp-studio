// 원본 시스템 프로토콜 표시 — 옛 js/common/state.js:28-29(PRL · PDESC) 문구 그대로
import type { SourceProto } from '../api/types';
import { warnOnce } from './status';

type KnownProto = 'soap' | 'rest' | 'gov' | 'sample' | 'disc';

/** 프로토콜 배지 라벨(옛 PRL) */
export const PROTOCOL_LABEL: Readonly<Record<KnownProto, string>> = Object.freeze({
  soap: 'SOAP',
  rest: 'REST',
  gov: '공공데이터',
  sample: '샘플 추론',
  disc: '자동 탐색',
});

/** 프로토콜 설명(옛 PDESC) — 변환 과정 2단계 보조 글 등 */
export const PROTOCOL_DESC: Readonly<Record<KnownProto, string>> = Object.freeze({
  soap: 'SOAP 1.1, XML 메시지',
  rest: 'REST, JSON',
  gov: '공공데이터포털, XML 응답',
  sample: 'HTTP, 명세 없음',
  disc: 'HTTP, 소스와 트래픽으로 추론',
});

// 표 자신의 키만 찾는다 — 'constructor' 같은 이름이 Object.prototype 값을 돌려주지 않게
const lookup = (table: Readonly<Record<KnownProto, string>>, proto: SourceProto): string | undefined =>
  Object.hasOwn(table, proto) ? table[proto as KnownProto] : undefined;

/**
 * 모르는 프로토콜은 값 그대로 + 개발 콘솔 경고 — 옛은 "undefined"가 됐다(js/common/state.js:36 · js/menu/logs.js:48).
 * 경고는 값마다 한 번이다(warnOnce — 메시지에 값이 들어 있어 메시지가 곧 값마다의 키다)
 */
export const protocolLabel = (proto: SourceProto): string => {
  const label = lookup(PROTOCOL_LABEL, proto);
  if (label !== undefined) return label;
  warnOnce(`알 수 없는 프로토콜 값: ${proto}`);
  return proto;
};

/** 모르는 프로토콜은 빈 문자열 — 옛 esc(undefined)가 빈 글자였다(js/common/convert.js:178) */
export const protocolDesc = (proto: SourceProto): string => lookup(PROTOCOL_DESC, proto) ?? '';
