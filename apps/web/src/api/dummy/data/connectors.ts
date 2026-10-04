// apps/web/src/api/dummy/data/connectors.ts — 기본 커넥터 2건. id는 머신 이름. 발행된 것만 접속값
import type { Connector } from '../../types';

const PROJECT = 'project_2';
export const CONNECTORS_BY_PROJECT: Readonly<Record<string, readonly Connector[]>> = {
  [PROJECT]: [
    {
      id: 'db_connector',
      projectId: PROJECT,
      sourceId: 'src_1',
      sourceName: '계약 원장 DB',
      name: '계약 조회 커넥터',
      status: 'live',
      toolCount: 7,
      calls7d: 1284,
      endpoint: 'https://mcp.internal/db_connector',
      protocol: 'MCP / streamable-http',
      authKeyMasked: 'sk_live_••••••••db_c',
    },
    {
      id: 'db_connector_copy',
      projectId: PROJECT,
      sourceId: 'src_1',
      sourceName: '계약 원장 DB',
      name: '계약 조회 커넥터 (복제)',
      status: 'unpublished',
      toolCount: 7,
      calls7d: 0,
    },
  ],
};
