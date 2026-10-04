// apps/web/src/api/dummy/connectors.ts — 커넥터 목록(빈 시나리오 · no-connectors는 []) · 미발행 커넥터 만들기. 만든 것은 모듈 상태
import type { Connector, ConnectorDraftInput, ToolGroupKind } from '../types';
import { CONNECTORS_BY_PROJECT } from './data/connectors';
import { findSource } from './data/sourceStore';
import { ERROR_CODE, FIELD_REASON, STATUS, apiError, notFoundError, respond } from './error';
import { hasProject } from './projects';
import { getScenario, isEmptyScenario } from './scenario';

let created: readonly Connector[] = [];
const seeded = (projectId: string): readonly Connector[] =>
  isEmptyScenario() || getScenario() === 'no-connectors'
    ? []
    : (CONNECTORS_BY_PROJECT[projectId] ?? []);
const KINDS: ReadonlySet<string> = new Set<ToolGroupKind>(['query', 'aggregate', 'write']);

/**
 * 소스와 잇는다(서버 조인 자리) — 연결 해제한 소스의 커넥터는 함께 사라지고(확인 Dialog 문구 · useDeleteSource 무효화),
 * 소스 이름은 지금 이름이다(이름을 고치면 행 · 연결 정보에 바로 보인다)
 */
const joinSource = (connector: Connector): Connector[] => {
  const source = findSource(connector.sourceId);
  return source ? [{ ...connector, sourceName: source.name }] : [];
};

export const fetchConnectors = (projectId: string): Promise<Connector[]> =>
  respond(() =>
    [...seeded(projectId), ...created.filter((c) => c.projectId === projectId)].flatMap(joinSource),
  );

export const createConnector = (
  projectId: string,
  input: ConnectorDraftInput,
): Promise<Connector> =>
  respond(
    () => {
      if (!hasProject(projectId)) throw notFoundError();
      const invalid = (fields: Record<string, string>) =>
        apiError(STATUS.BAD_REQUEST, ERROR_CODE.VALIDATION, fields);
      const name = input.name.trim();
      const groups = input.toolGroups.filter((g) => KINDS.has(g));
      if (name === '') throw invalid({ name: FIELD_REASON.REQUIRED });
      if (groups.length === 0) throw invalid({ toolGroups: FIELD_REASON.REQUIRED });
      // sourceId는 본문 필드 — 없거나 이 프로젝트의 소스가 아니면 name처럼 필드 사유로 알린다
      const sourceId = input.sourceId.trim();
      if (sourceId === '') throw invalid({ sourceId: FIELD_REASON.REQUIRED });
      const source = findSource(sourceId);
      if (!source || source.projectId !== projectId)
        throw invalid({ sourceId: FIELD_REASON.INVALID });
      if (source.status !== 'ingested')
        throw apiError(STATUS.CONFLICT, ERROR_CODE.SOURCE_NOT_READY);
      const connector: Connector = {
        id: `con_new_${created.length + 1}`,
        projectId,
        sourceId: source.id,
        sourceName: source.name,
        name,
        status: 'unpublished',
        toolCount: source.toolGroups
          .filter((g) => groups.includes(g.kind))
          .reduce((sum, g) => sum + g.count, 0),
        calls7d: 0,
      };
      created = [...created, connector];
      return connector;
    },
    { write: true },
  );
