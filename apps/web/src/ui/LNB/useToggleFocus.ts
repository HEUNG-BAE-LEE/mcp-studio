// 펼침 ↔ 접힘 뒤 포커스(계약은 COMPONENTS LNB `접근성`). 토글 버튼은 바뀌는 쪽(레일 · 패널)과 함께 사라지므로, 바꾸는 동작(누름 · Esc)
// 직전에 포커스가 LNB 안에 있었는지 적어 두고, 바뀐 뒤 지금 보이는 토글 버튼으로 옮긴다. 포인터 클릭으로 포커스가 없었거나
// 그사이 포커스가 LNB 밖으로 나갔으면 건드리지 않는다. 토글 없이 끝난 누름의 표시는 일부러 남긴다 — LNB에서 연 층(검색 · 알림 · 새 프로젝트)이
// 이동하며 닫히고 포커스가 패널로 돌아온 뒤 1024 펼침이 닫힐 때 레일 펼치기로 옮기려는 것이다
import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';

/** 포커스가 빠졌거나(body) 아직 LNB 안이면 옮겨도 된다 — 사용자가 다른 곳에 둔 포커스는 빼앗지 않는다 */
const canMoveFocus = (root: HTMLElement) => {
  const { activeElement, body } = root.ownerDocument;
  return activeElement === null || activeElement === body || root.contains(activeElement);
};

/**
 * `markFocus`를 바꾸는 동작 직전에 부른다(루트 click capture · Esc). `expanded`가 바뀌면
 * `findToggle(expanded)`(펼침 = 패널 접기 버튼 · 접힘 = 레일 펼치기 버튼)으로 포커스를 옮긴다
 */
export function useToggleFocus(
  rootRef: RefObject<HTMLElement | null>,
  expanded: boolean,
  findToggle: (expanded: boolean) => HTMLElement | null,
) {
  const hadFocus = useRef(false);
  const lastExpanded = useRef(expanded);
  useLayoutEffect(() => {
    if (lastExpanded.current === expanded) return;
    lastExpanded.current = expanded;
    const root = rootRef.current;
    const shouldMove = hadFocus.current && root !== null && canMoveFocus(root);
    hadFocus.current = false;
    if (shouldMove) findToggle(expanded)?.focus();
  });
  return useCallback(() => {
    const root = rootRef.current;
    hadFocus.current = root !== null && root.contains(root.ownerDocument.activeElement);
  }, [rootRef]);
}
