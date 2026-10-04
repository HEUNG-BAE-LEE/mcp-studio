// apps/web/src/api/dummy/data/user.ts — 더미 사용자. 역할별 권한(DESIGN `권한`)을 권한 문자열로 옮긴 것 — ?role=owner(기본)|editor|member|viewer
// 새 권한 문자열을 더할 때: app/user/permissions.ts의 PERMISSIONS + 여기 OWNER.permissions(editor · member에 줄 것만 EDITOR · MEMBER에도)
import type { CurrentUser } from '../../types';

export const OWNER: CurrentUser = {
  id: 'u_1',
  name: '김서연',
  role: 'owner',
  permissions: [
    'project:create',
    'project:edit',
    'project:delete',
    'project:share',
    'source:connect',
    'source:edit',
    'source:ingest',
    'source:delete',
    'ontology:approve',
    'query:run',
    'connector:publish',
  ],
};

/** 소유자 전용 — 프로젝트 삭제 · 공유(멤버 관리) · 소스 연결 해제. 이것만 빼고 모두 준다 */
export const EDITOR: CurrentUser = {
  id: 'u_4',
  name: '정하린',
  role: 'editor',
  permissions: [
    'project:create',
    'project:edit',
    'source:connect',
    'source:edit',
    'source:ingest',
    'ontology:approve',
    'query:run',
    'connector:publish',
  ],
};

export const MEMBER: CurrentUser = {
  id: 'u_2',
  name: '박지훈',
  role: 'member',
  permissions: ['query:run'],
};

/** 권한이 하나도 없다 — 모든 동작의 비활성 상태 확인용 */
export const VIEWER: CurrentUser = {
  id: 'u_3',
  name: '이도윤',
  role: 'viewer',
  permissions: [],
};
