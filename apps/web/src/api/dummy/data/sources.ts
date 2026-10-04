// apps/web/src/api/dummy/data/sources.ts — 기본 소스 3건. 소스 id는 알림 목(src_1 · src_2 · src_3)과 같다
import type { Source } from '../../types';

const PROJECT = 'project_2';
export const SOURCES_BY_PROJECT: Readonly<Record<string, readonly Source[]>> = {
  [PROJECT]: [
    {
      id: 'src_1',
      projectId: PROJECT,
      name: '계약 원장 DB',
      machineName: 'policy_core',
      type: 'database',
      driver: 'postgres',
      status: 'ingested',
      output: { kind: 'object_types', count: 12 },
      pendingApprovals: 2,
    },
    {
      id: 'src_2',
      projectId: PROJECT,
      name: '인수지침 문서',
      machineName: 'uw_guidelines',
      type: 'document',
      driver: 'docs',
      status: 'ingesting',
      output: { kind: 'knowledge', count: 1204 },
      progress: { phase: 'embedding', percent: 62 },
    },
    {
      id: 'src_3',
      projectId: PROJECT,
      name: '코어뱅킹 API',
      machineName: 'core_banking_api',
      type: 'code',
      driver: 'git',
      status: 'auth_failed',
      output: { kind: 'tools', count: 0, reasonCode: 'AUTH_REJECTED' },
      lastError: { code: 'AUTH_REJECTED', httpStatus: 401 },
    },
  ],
};
