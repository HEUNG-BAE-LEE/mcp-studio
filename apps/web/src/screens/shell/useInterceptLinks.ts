// apps/web/src/screens/shell/useInterceptLinks.ts — ui의 <a href>(LNBPanel · 검색 결과 · Notice 링크)를 SPA 이동으로
import { useCallback, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';

const PRIMARY_BUTTON = 0;

export function useInterceptLinks(afterNavigate?: () => void) {
  const navigate = useNavigate();
  return useCallback(
    (e: MouseEvent<HTMLElement>) => {
      if (e.defaultPrevented || e.button !== PRIMARY_BUTTON) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element).closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || !e.currentTarget.contains(anchor)) return;
      const href = anchor.getAttribute('href') ?? '';
      // '//host'는 프로토콜 상대 외부 주소 — 통과
      if (!href.startsWith('/') || href.startsWith('//') || anchor.target === '_blank') return;
      e.preventDefault();
      void navigate(href);
      afterNavigate?.();
    },
    [navigate, afterNavigate],
  );
}
