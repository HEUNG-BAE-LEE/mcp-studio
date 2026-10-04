// apps/web/src/copy/status.ts — 상태 · 타입 어휘(DESIGN Copy). 서버 code → 한국어 라벨 + 계층(StatusChip tier)
import type { StatusTier } from '@/ui';
import type { ConnectorStatus, SourceStatus, SourceType } from '../api/types';
import { warnOnce } from './warnOnce';

type StatusCopy = Readonly<{ label: string; tier: StatusTier }>;
// 계층 규칙(상태 코드마다 라벨 + 계층 하나):
//   할 일이 있다 → fix · 시간이 지나면 바뀐다 → progress · 끝났거나 할 일이 없다 → done · idle(색 없음)
//   done = 성공으로 끝남(성공 완료만) · idle = 할 일이 없는 중립
//   사용자가 멈춘 것(취소) = idle — 손볼 일이 아니다
//   어휘: 멈추기(동작) → 멈춤(결과)
// 새 상태 코드는 아래 표에 행을 더하고 api/types.ts 유니온에도 더한다
const status = (label: string, tier: StatusTier): StatusCopy => ({ label, tier });

export const SOURCE_STATUS: Readonly<Record<SourceStatus, StatusCopy>> = {
  ready: status('연결 준비', 'progress'),
  ingesting: status('수집 중', 'progress'),
  processing: status('가공 중', 'progress'),
  ingested: status('수집 완료', 'done'),
  ingest_failed: status('수집 실패', 'fix'),
  auth_failed: status('인증 실패', 'fix'),
};
/** 커넥터 상태. 맨 `실패`는 커넥터에만 쓴다(DESIGN Copy) */
export const CONNECTOR_STATUS: Readonly<Record<ConnectorStatus, StatusCopy>> = {
  live: status('사용 중', 'done'),
  updating: status('갱신 중', 'progress'),
  failed: status('실패', 'fix'),
  unpublished: status('미발행', 'idle'),
};
/** 수집 진행 단계(알림 · 소스 행 공용) */
export const PHASE_LABEL: Readonly<Record<string, string>> = {
  ingest: '수집',
  process: '가공',
  embedding: '임베딩',
};
/** 모르는 단계 코드는 기본 틀 + 경고 */
export function phaseLabel(code: string): string {
  const known = PHASE_LABEL[code];
  if (known) return known;
  warnOnce(`phase-label:${code}`, `[copy] 모르는 진행 단계 코드 ${code}`);
  return `알 수 없는 단계 · ${code}`;
}
/** 소스 타입 라벨(구성 총합 범례 · 타입 칩) */
export const SOURCE_TYPE: Readonly<Record<SourceType, string>> = {
  database: 'DB',
  document: '문서',
  code: 'Git',
};

/** 모르는 상태 · 타입 코드는 기본 틀 + 경고 — 서버가 값을 늘려도 화면이 깨지지 않는다 */
function lookup<T>(table: Readonly<Record<string, T>>, code: string, kind: string, fallback: T): T {
  const known = table[code];
  if (known) return known;
  warnOnce(`lookup:${kind}:${code}`, `[copy] 모르는 ${kind} 코드 ${code}`);
  return fallback;
}
export const sourceStatusOf = (code: string): StatusCopy =>
  lookup(SOURCE_STATUS, code, '소스 상태', status(`알 수 없는 상태 · ${code}`, 'idle'));
export const connectorStatusOf = (code: string): StatusCopy =>
  lookup(CONNECTOR_STATUS, code, '커넥터 상태', status(`알 수 없는 상태 · ${code}`, 'idle'));
export const sourceTypeLabel = (code: string): string =>
  lookup(SOURCE_TYPE, code, '소스 타입', `알 수 없는 타입 · ${code}`);
