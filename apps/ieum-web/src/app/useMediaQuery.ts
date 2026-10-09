// 미디어 쿼리 구독 — JS가 폭을 알아야 하는 곳만 쓴다. 폭에 따른 모양은 부품 · 레이아웃 CSS @media가 맡는다
// 폭 조건은 breakpoints.ts의 maxWidth로만 만든다(값이 lint/values.js ALLOWED_MEDIA와 같은 목록이어야 한다)
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { MaxWidthQuery } from './breakpoints';

export function useMediaQuery(query: MaxWidthQuery): boolean {
  const media = useMemo(() => window.matchMedia(query), [query]);
  const subscribe = useCallback(
    (onChange: () => void) => {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [media],
  );
  return useSyncExternalStore(subscribe, () => media.matches);
}
