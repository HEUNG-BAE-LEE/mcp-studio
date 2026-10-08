// 자동 탐색 작업 표 자리 — 옛 discJobsHTML(apps/web/ieum/js/menu/discovery.js:16-30)이 표를 그리던 자리다. 표는 자동 탐색 메뉴를 옮길 때 이 자리에 채운다.
// 지금은 작업이 있든 없든 아무것도 그리지 않는다(옛도 작업이 0개면 아무것도 그리지 않았다 — discovery.js:17).
// 조회는 화면이 맨 위에서 한 번 받아 넘긴다(useDiscoveryOverview — 화면 조회와 따로 나가고 실패해도 목록을 막지 않는다).
// 첫 조회가 실패하면 이 자리 안에만 실패 상자가 보인다(원문만 · 머리 문장 없음) — 목록 · 2차 안내는 그대로다. 받는 동안은 비어 있다
import type { DiscoveryResponse } from '../../api/types';
import type { Gate } from '../../app/screenGate';
import { ScreenState } from '@/ui';

type DiscoveryJobsSlotProps = Readonly<{
  /** regionGate(useDiscoveryOverview())의 판정 */
  gate: Gate<DiscoveryResponse>;
}>;

export function DiscoveryJobsSlot({ gate }: DiscoveryJobsSlotProps) {
  return (
    <ScreenState gate={gate} scope="region">
      {() => null}
    </ScreenState>
  );
}
