// apps/web/src/app/user/UserProvider.tsx — /user를 먼저 받는다. 로딩 중엔 셸만, 실패는 ErrorBlock + 다시 시도
import type { ReactNode } from 'react';
import { Button, ErrorBlock } from '@/ui';
import { RETRY, errorRaw } from '../../copy/errors';
import { platform } from '../../platform';
import { useCurrentUser } from './useCurrentUser';
import styles from './UserProvider.module.css';

export function UserProvider({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  if (user.isPending) return null;
  if (user.isError) {
    return (
      <div className={styles.error}>
        <ErrorBlock
          raw={errorRaw(user.error)}
          onCopy={() => platform.copyText(errorRaw(user.error))}
        />
        <Button onClick={() => void user.refetch()}>{RETRY}</Button>
      </div>
    );
  }
  return <>{children}</>;
}
