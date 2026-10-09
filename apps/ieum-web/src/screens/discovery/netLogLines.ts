// 네트워크 기록 줄 — 쌓인 기록(캡처한 요청 · 건너뜀 · 검증 호출)의 최근 250줄을 NetLog 줄로(옛 dNetLog — js/menu/discovery.js:192-200)
// 줄 키는 이벤트 번호(seq)라 새로 붙은 줄만 등장 모션이 돈다. 시각은 "m:ss", 응답 코드가 없으면 값 없음 표기, 스테이징 검증 호출은 경로 앞 "스테이징"
// 태그는 copy/status netTagOf — 모르는 값은 값 그대로 · 흐림(옛은 "기록" — 이식 기간 고침)
import type { NetLogEntry } from '../../api/discoveryJob';
import { recentLog } from '../../app/discovery/jobScreen';
import { DISCOVERY, fmtMinSec } from '../../copy/discovery';
import { NONE } from '../../copy/format';
import { netTagOf } from '../../copy/status';
import type { NetLogLine } from '@/ui';

const STAGING_ENV = 'stg';

function lineOf(entry: NetLogEntry): NetLogLine {
  const key = String(entry.seq);
  const time = fmtMinSec(entry.t);
  if (entry.l === 'web' && entry.k === 'skip') return { kind: 'skip', key, time, note: entry.msg };
  const { label, tone } = netTagOf(entry.tag);
  const env = entry.l === 'vfy' && entry.env === STAGING_ENV ? DISCOVERY.live.stgMark : undefined;
  return { kind: 'request', key, time, method: entry.m, path: entry.p, env, code: entry.code ?? NONE, tag: { label, tone } };
}

export const netLogLinesOf = (log: readonly NetLogEntry[]): readonly NetLogLine[] => recentLog(log).map(lineOf);
