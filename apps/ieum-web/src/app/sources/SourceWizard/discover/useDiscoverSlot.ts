// 연결 마법사 탐색 모드 슬롯 — 탐색 입력의 동작 · 시작 요청 · 도크가 기다리는 것. 마법사 한 시도의 세션(useWizardSession)이 부른다
// (옛 wzDemo · wzDisc · wzStg · wzBanDel · wzDChk · wzDSel · wzOk · wzWhen — js/menu/discovery.js:402-416)
//
// 탐색 개요(GET /discovery/ — 할 수 있는 것 · 기본값 · 시연 값)는 탐색 모드일 때만 읽는다. 받는 동안 2단계 본문은 비우고 aria-busy,
// 받지 못하면 2단계 본문 자리에 실패 상자(원문만)이고 "다음"을 막는다 — 처음 값(화면 탐색 켬 · 금지어 · 최대 화면 수)을 정할 수 없다
// 시작(탐색 시작 · 탐색 예약): 안전 설정 검증(checkSafety)의 첫 실패만 경고 토스트, 통과하면 시작 요청 한 번. 성공 뒤 드로어 닫기 · 작업 화면 이동 ·
// 개요 다시 받기 · 예약 안내와 실패 토스트는 요청 훅의 옵션 콜백이 한다(app/discovery/useDiscoveryMutations useStartDiscovery) —
// 같은 시도의 드로어가 열려 있을 때만 이동한다. 요청 중에는 시작 버튼이 결과를 기다리는 잠금이다(포커스가 남는다)
import type { UseQueryResult } from '@tanstack/react-query';
import type { DiscoveryResponse } from '../../../../api/types';
import { DISCOVERY } from '../../../../copy/discovery';
import { useStartDiscovery } from '../../../discovery/useDiscoveryMutations';
import { regionGate, type Gate } from '../../../screenGate';
import { toast } from '../../../toast';
import { updateDiscover, type WizardState } from '../wizardState';
import type { DiscoverFooterState } from '../wizardSteps';
import { checkSafety } from './discoverCheck';
import {
  addBanWord,
  changeDiscoverText,
  fillDemo,
  removeBanWord,
  selectFramework,
  selectWhen,
  setDiscoverFlag,
  toggleSource,
  type DiscoverFlag,
  type DiscoverSource,
  type DiscoverState,
  type DiscoverTextField,
} from './discoverState';
import { toStartBody } from './startBody';

export type DiscoverActions = Readonly<{
  changeText: (field: DiscoverTextField, value: string) => void;
  /** Git 소스 분석 · 운영 화면 탐색 스위치 — 둘 다 끄려 하면 그대로 두고 경고 토스트 */
  toggleSource: (source: DiscoverSource, on: boolean) => void;
  setFlag: (flag: DiscoverFlag, on: boolean) => void;
  selectFramework: (framework: string) => void;
  selectWhen: (value: string) => void;
  addBan: (word: string) => void;
  removeBan: (word: string) => void;
  /** 시연용 값 채우기 — 채운 뒤 안내 토스트 */
  fillDemo: () => void;
  /** 탐색 시작 · 예약 */
  start: () => void;
}>;

export type DiscoverSlot = Readonly<{
  /** 탐색 개요의 판정 — 2단계 본문 자리가 쓴다(영역 조회) */
  gate: Gate<DiscoveryResponse>;
  /** 도크가 기다리는 것 */
  footer: DiscoverFooterState;
  actions: DiscoverActions;
}>;

type SlotInput = Readonly<{
  attemptId: number;
  state: WizardState;
  update: (change: (prev: WizardState) => WizardState) => void;
  overview: UseQueryResult<DiscoveryResponse>;
}>;

const overviewStateOf = (gate: Gate<DiscoveryResponse>): DiscoverFooterState['overview'] => {
  if (gate.kind === 'pending') return 'pending';
  return gate.kind === 'ready' || gate.kind === 'empty' ? 'ready' : 'failed';
};

export function useDiscoverSlot({ attemptId, state, update, overview }: SlotInput): DiscoverSlot {
  const startDiscovery = useStartDiscovery();
  const gate = regionGate(overview);
  const d = state.discover;
  const change = (fn: (prev: DiscoverState) => DiscoverState) => update((s) => updateDiscover(s, fn));

  const actions: DiscoverActions = {
    changeText: (field, value) => change((prev) => changeDiscoverText(prev, field, value)),
    toggleSource: (source, on) => {
      if (d === null) return;
      // 둘 다 끄게 되는 것은 지금 값으로 미리 본다 — 거절하면 스위치는 켜진 채 남는다(옛 :411)
      if (toggleSource(d, source, on) === null) {
        toast.warn(DISCOVERY.check.needOne);
        return;
      }
      change((prev) => toggleSource(prev, source, on) ?? prev);
    },
    setFlag: (flag, on) => change((prev) => setDiscoverFlag(prev, flag, on)),
    selectFramework: (framework) => change((prev) => selectFramework(prev, framework)),
    selectWhen: (value) => change((prev) => selectWhen(prev, value)),
    addBan: (word) => change((prev) => addBanWord(prev, word)),
    removeBan: (word) => change((prev) => removeBanWord(prev, word)),
    fillDemo: () => {
      const data = overview.data;
      if (data === undefined || data.demo === null) return;
      const { demo, capabilities } = data;
      change((prev) => fillDemo(prev, demo, capabilities));
      toast.info(DISCOVERY.toast.demoFilled);
    },
    start: () => {
      if (d === null) return;
      const problem = checkSafety(d);
      if (problem !== null) {
        toast.warn(problem);
        return;
      }
      startDiscovery.mutate({ attemptId, body: toStartBody(d) });
    },
  };

  const isStarting = startDiscovery.isPending && startDiscovery.variables?.attemptId === attemptId;
  return {
    gate,
    footer: { overview: overviewStateOf(gate), isApproved: d?.ok ?? false, isStarting },
    actions,
  };
}
