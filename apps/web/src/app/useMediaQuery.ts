// apps/web/src/app/useMediaQuery.ts — platform.media를 React 구독으로
import { useMemo, useSyncExternalStore } from 'react';
import { platform } from '../platform';

export function useMediaQuery(query: string): boolean {
  const media = useMemo(() => platform.media(query), [query]);
  return useSyncExternalStore(
    (onChange) => media.subscribe(onChange),
    () => media.matches,
    () => false,
  );
}
