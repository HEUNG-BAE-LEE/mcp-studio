// 결과 검토의 선택 — 도구 후보로 등록할 API id 집합. 화면 안 상태다(주소에 두지 않는다 — 열 때마다 기본 선택, 옛 discOpenJob :138)
// 처음 결과를 그릴 때 한 번 기본 선택(범위 밖 아님 · 도구 이름 있음 · 등록 추천 — app/discovery/results defaultSelection)으로 시작한다.
// "추천만 선택"은 다시 기본 선택으로 되돌린다(옛 dselRec :400). 체크 상자 · 근거 드로어 토글은 하나씩 넣고 뺀다(옛 dsel · dselToggle :399,417)
// 바꿀 때마다 새 집합을 만든다(받은 집합은 고치지 않는다)
import { useState } from 'react';
import type { DiscoveryApi } from '../../api/types';
import { defaultSelection } from '../../app/discovery/results';

export type Selection = Readonly<{
  ids: ReadonlySet<string>;
  /** 하나를 넣거나 뺀다 */
  toggle: (id: string) => void;
  /** 체크 상자 값대로 넣거나 뺀다 */
  set: (id: string, on: boolean) => void;
  /** 기본 선택으로 되돌린다 */
  resetToDefault: () => void;
}>;

const withId = (ids: ReadonlySet<string>, id: string, on: boolean): ReadonlySet<string> => {
  if (ids.has(id) === on) return ids;
  return on ? new Set([...ids, id]) : new Set([...ids].filter((x) => x !== id));
};

export function useSelection(apis: readonly DiscoveryApi[]): Selection {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => defaultSelection(apis));
  return {
    ids,
    toggle: (id) => setIds((prev) => withId(prev, id, !prev.has(id))),
    set: (id, on) => setIds((prev) => withId(prev, id, on)),
    resetToDefault: () => setIds(defaultSelection(apis)),
  };
}
