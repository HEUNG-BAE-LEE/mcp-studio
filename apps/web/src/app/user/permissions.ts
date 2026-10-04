// apps/web/src/app/user/permissions.ts — 권한 문자열. 역할(소유자 · 편집자 · 멤버 · 보기 전용)과 역할별 권한은 DESIGN `권한`. 화면은 권한만 본다
// 새 권한을 더할 때: 1) 아래 PERMISSIONS에 `대상:동작` 문자열 추가
//   2) api/dummy/data/user.ts의 OWNER.permissions에 추가(editor · member에도 줄 권한만 EDITOR · MEMBER에)
//   3) 화면은 usePermission('대상:동작')으로만 확인한다
//   4) DESIGN `권한`의 역할별 목록(소유자 전용 · 편집자 · 멤버 · 보기 전용)을 함께 고친다
export const PERMISSIONS = [
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
] as const;
export type Permission = (typeof PERMISSIONS)[number];
