// apps/web/src/api/dummy/user.ts — 현재 사용자. ?role=owner(기본) | editor | member | viewer (scenario.getRole)
import type { CurrentUser } from '../types';
import { EDITOR, MEMBER, OWNER, VIEWER } from './data/user';
import { respond } from './error';
import { getRole } from './scenario';

const USER_BY_ROLE = { owner: OWNER, editor: EDITOR, member: MEMBER, viewer: VIEWER } as const;

export const fetchUser = (): Promise<CurrentUser> =>
  respond(() => USER_BY_ROLE[getRole()], { exempt: true });
