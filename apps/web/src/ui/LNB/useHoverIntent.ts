// 접힘 레일 · 플로팅 패널의 포인터 의도(계약은 COMPONENTS LNB `플로팅 여닫기`). 진입은 잠깐 기다렸다 알린다 — 레일 버튼으로 가는 포인터가
// 지나가기만 해도 플로팅이 레일을 덮지 않게. 기다리는 사이 레일 컨트롤(검색 · 펼치기 · 알림 수) 위로 옮기면 LNB가 이탈로 알려 진입 예약을 거둔다.
// 이탈도 잠깐 미룬다 — 열 → 플로팅 패널로 넘어갈 때 leave/enter가 연달아 온다
import { useCallback, useEffect, useRef } from 'react';

/** 진입 → `onHoverChange(true)`까지(ms). Tooltip 열림 지연과 같다. 뜻을 싣는 지연이라 모션 줄이기(`--m-*` 0ms)와 무관하다 */
export const LNB_HOVER_ENTER_MS = 300;
/** 이탈 → `onHoverChange(false)`까지(ms) */
export const LNB_HOVER_LEAVE_MS = 80;

/**
 * `report(next)`를 지연해 `onChange`로 넘긴다. 같은 값이 이미 예약돼 있으면 시각을 다시 재지 않는다(레일 안 요소 경계마다 다시 불린다).
 * `isOpen`(플로팅이 떠 있음)이면 진입은 예약된 닫기만 거둔다.
 * `collapsed`가 바뀌면 예약을 거두고 `onChange(false)` — 펼침 중에 남은 진입 예약 · hovering이 다음 접힘(1024 자동 접힘)에서 포인터 없이 플로팅을 띄우지 않게
 */
export function useHoverIntent(
  isOpen: boolean,
  collapsed: boolean,
  onChange: (hovering: boolean) => void,
) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<boolean | null>(null);
  const lastCollapsed = useRef(collapsed);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (lastCollapsed.current === collapsed) return;
    lastCollapsed.current = collapsed;
    clearTimeout(timer.current);
    pending.current = null;
    onChange(false);
  }, [collapsed, onChange]);
  return useCallback(
    (next: boolean) => {
      if (pending.current === next) return;
      clearTimeout(timer.current);
      pending.current = null;
      if (next && isOpen) return;
      pending.current = next;
      timer.current = setTimeout(
        () => {
          pending.current = null;
          onChange(next);
        },
        next ? LNB_HOVER_ENTER_MS : LNB_HOVER_LEAVE_MS,
      );
    },
    [isOpen, onChange],
  );
}
