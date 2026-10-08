// SelectionDock — 결과 검토 아래 선택 도크 "선택한 API"(옛 :316 — 검토 대기 등 등록 전에만). "N개 선택" · "추천만 선택" · 구분선 · "도구 후보로 등록"
// - 고른 것이 없으면 등록 버튼은 disabled. 요청 중에는 결과를 기다리는 잠금이다(포커스가 남는다 — 옛은 막지 않았다, 이식 기간 고침)
// - 등록 성공 뒤 캐시 · 개요 · 토스트와 스튜디오 이동은 요청 훅이 한다 — 요청 중 화면을 떠났거나 다른 작업으로 옮겼으면 이동하지 않는다
//   (app/discovery/useDiscoveryMutations useRegisterDiscovery). 실패는 경고 토스트(서버 문장)이고 선택은 그대로다
// - 드로어(근거 · 마법사)가 열려 있는 동안은 Dock이 스스로 숨는다(열린 층 신호)
import { useRegisterDiscovery } from '../../app/discovery/useDiscoveryMutations';
import { EmphasisText } from '../../app/discovery/CopyParts';
import { DISCOVERY } from '../../copy/discovery';
import { Dock, DockButton, DockLinkButton, DockSeparator } from '@/ui';
import type { Selection } from './useSelection';

const K = DISCOVERY.dock;

type SelectionDockProps = Readonly<{ jobId: string; selection: Selection }>;

export function SelectionDock({ jobId, selection }: SelectionDockProps) {
  const register = useRegisterDiscovery(jobId);
  const count = selection.ids.size;
  const submit = () => {
    if (count === 0) return;
    register.mutate({ jobId, ids: [...selection.ids] });
  };
  return (
    <Dock label={K.region} open summary={<EmphasisText parts={K.count(count)} />}>
      <DockLinkButton onClick={selection.resetToDefault}>{K.recOnly}</DockLinkButton>
      <DockSeparator />
      <DockButton disabled={count === 0} pending={register.isPending} onClick={submit}>
        {K.register}
      </DockButton>
    </Dock>
  );
}
