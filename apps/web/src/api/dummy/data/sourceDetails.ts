// apps/web/src/api/dummy/data/sourceDetails.ts — 설정 모달 값. Source 위에 얹는다 — 상태 · 산출물은 sources.ts
import type { Source, SourceDetail } from '../../types';

type SourceExtras = Omit<SourceDetail, keyof Source> & Pick<Source, 'schedule' | 'lastRun'>;
const kst = (dateTime: string) => `${dateTime}+09:00`;

export const SOURCE_EXTRAS: Readonly<Record<string, SourceExtras>> = {
  src_1: {
    tags: ['인수심사', 'DB'],
    scope: { schema: 'contract', tables: 34 },
    connection: [
      { code: 'host', value: 'db-contract.internal:5432' },
      { code: 'schema', value: 'contract' },
      { code: 'account', value: 'svc_reader' },
      { code: 'secret', value: '${vault:db/contract}' },
    ],
    schedule: { mode: 'daily', at: '03:00' },
    lastRun: {
      id: 'run_1',
      kind: 'ingest',
      trigger: 'schedule',
      startedAt: kst('2026-09-10T03:00:02'),
      endedAt: kst('2026-09-10T03:02:44'),
      result: 'done',
      attempt: 1,
    },
    log: [
      '03:00:02  수집 시작 — 스키마 contract',
      '03:00:14  표 34개 확인',
      '03:02:41  객체 타입 12개 만듦',
      '03:02:44  승인 대기 2건 — 온톨로지 › 객체 타입에서 확인',
    ],
    toolGroups: [
      { kind: 'query', count: 7 },
      { kind: 'aggregate', count: 3 },
      { kind: 'write', count: 0 },
    ],
    suggestedConnectorName: '계약 조회 커넥터',
  },
  src_2: {
    tags: ['인수심사', '문서검색'],
    scope: { files: 5, fileFormat: 'pdf' },
    connection: [
      { code: 'files', value: '인수지침_2026.pdf 외 4' },
      { code: 'chunk', value: '문단' },
      { code: 'storage', value: 'obj://src/doc_2' },
    ],
    schedule: { mode: 'daily', at: '03:00' },
    lastRun: {
      id: 'run_2',
      kind: 'ingest',
      trigger: 'manual',
      startedAt: kst('2026-09-10T09:41:10'),
      endedAt: null,
      result: 'running',
      attempt: 1,
    },
    remainingMinutes: 4,
    log: [
      '09:41:10  파일 5개 올라옴',
      '09:41:22  자르기 시작',
      '09:44:03  청크 1,204개 — 임베딩 중',
    ],
    toolGroups: [],
  },
  src_3: {
    tags: ['코어뱅킹', 'Git'],
    scope: { repo: 'core/banking' },
    connection: [
      { code: 'repo', value: 'https://git.internal/core/banking' },
      { code: 'branch', value: 'release' },
      { code: 'token', value: '${vault:git/read_token}' },
    ],
    schedule: { mode: 'daily', at: '03:00' },
    lastRun: {
      id: 'run_3',
      kind: 'ingest',
      trigger: 'schedule',
      startedAt: kst('2026-09-10T11:20:03'),
      endedAt: kst('2026-09-10T11:20:09'),
      result: 'failed',
      attempt: 1,
      errorCode: 'AUTH_REJECTED',
    },
    log: ['11:20:03  저장소 접속 시도', '11:20:09  인증 거절 — 401', '11:20:09  멈춤'],
    toolGroups: [],
  },
};
export const EMPTY_EXTRAS: SourceExtras = {
  tags: [],
  scope: {},
  connection: [],
  log: [],
  toolGroups: [],
};
