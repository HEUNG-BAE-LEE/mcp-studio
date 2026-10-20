// 사라진 컨트롤의 포커스 대체 자리 — 묶음 상세 안에서 포커스가 있던 버튼이 다시 그리기로 사라지면(서버 알림의 "시작" · "다시 시작"이 성공해
// 실행 중 안내로 바뀜, 폴링으로 상태가 바뀌어 "중지"가 사라짐) 상세 머리 제목(tabIndex -1)으로 옮긴다. 옛은 화면을 통째로 다시 그려 포커스를 잃었다
// (js/menu/deploy.js:134,158) — 사라진 컨트롤의 포커스는 대체 자리로 간다(층 포커스 복귀 · 변환 스튜디오 상세와 같은 규칙).
// 상세 안에서 마지막으로 포커스를 받은 요소를 기억하고, 그리기마다(layout) 그 요소가 문서에서 빠졌고 포커스가 body로 떨어졌을 때만 옮긴다 —
// 층(모달)로 옮겨 간 포커스는 다른 요소로 간 것이라 잊는다(층의 복귀는 층 공통이 맡는다)
import { useLayoutEffect, useRef, type FocusEvent } from 'react';

export function useVanishedFocus() {
  const titleRef = useRef<HTMLSpanElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const last = lastFocused.current;
    if (last === null || last.isConnected || document.activeElement !== document.body) return;
    lastFocused.current = null;
    titleRef.current?.focus();
  });

  const onFocus = (event: FocusEvent<HTMLElement>) => {
    lastFocused.current = event.target;
  };
  // 다른 요소로 옮겨 가면 잊는다. 옮겨 갈 곳이 없으면(요소가 사라짐 · 빈 곳 누름) 남겨 두고 다음 그리기에서 본다
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (event.relatedTarget !== null) lastFocused.current = null;
  };

  return { titleRef, onFocus, onBlur };
}
