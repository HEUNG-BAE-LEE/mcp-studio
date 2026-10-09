// 원본 id로 원본 이름을 찾는다 — 확인 항목 · 많이 쓰인 도구가 도구의 원본(src)을 이름으로 보일 때 쓴다
// 확인 필요: 도구가 가리키는 원본이 원본 목록에 없을 때 옛 콘솔은 예외로 화면이 멈췄다(js/menu/dashboard.js:48,52,56). 여기서는 id를 그대로 보인다
import type { Source } from '../../api/types';

export function sourceNameOf(sources: readonly Source[], id: string): string {
  return sources.find((s) => s.id === id)?.name ?? id;
}
