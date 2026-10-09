// 운영체제 "동작 줄이기" 구독 — JS가 직접 움직이는 곳(부드러운 scrollIntoView 등)이 쓴다. CSS 모션은 --m-* 토큰 · 전역 규칙이 맡는다.
// 폭 조건만 받는 useMediaQuery와 따로 둔다(그쪽은 브레이크포인트 목록과 묶여 있다)
import { useCallback, useMemo, useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** 동작 줄이기를 켰으면 true — 스크롤은 behavior 'auto'(즉시)로 */
export function usePrefersReducedMotion(): boolean {
  const media = useMemo(() => window.matchMedia(REDUCED_MOTION_QUERY), []);
  const subscribe = useCallback(
    (onChange: () => void) => {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [media],
  );
  return useSyncExternalStore(subscribe, () => media.matches);
}
