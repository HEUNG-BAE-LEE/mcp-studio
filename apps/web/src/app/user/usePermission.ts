// apps/web/src/app/user/usePermission.ts — 권한 없는 액션은 비활성 + 사유(DESIGN Patterns 권한)
// reason은 공통 문장(PERMISSION_DENIED) — 새 화면은 allowed만 쓰고 사유는 copy/<화면>.ts 구체형(DESIGN 권한)
import { PERMISSION_DENIED } from '../../copy/errors';
import type { Permission } from './permissions';
import { useCurrentUser } from './useCurrentUser';

export type PermissionState = Readonly<{ allowed: boolean; reason: string | null }>;

export function usePermission(permission: Permission): PermissionState {
  const { data } = useCurrentUser();
  if (!data) return { allowed: false, reason: null }; // 아직 모른다 — 사유 없이 잠근다
  const allowed = data.permissions.includes(permission);
  return { allowed, reason: allowed ? null : PERMISSION_DENIED };
}
