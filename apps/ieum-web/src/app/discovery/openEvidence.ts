// 탐색 근거를 작업 화면 밖에서 연다 — 변환 스튜디오 안내 띠 "탐색 근거 보기"(옛 discEv → discEvidenceFor, js/menu/discovery.js:357-366 ·
// js/menu/studio.js:63). 그 작업의 API 후보를 받고 나서 근거 드로어를 연다(받는 동안은 아무것도 열지 않는다). 선택 토글은 없다(옛 :364)
// 작업 화면의 결과 표는 이미 가진 값으로 바로 연다(app/layers openEvidenceDrawer) — 이 함수를 쓰지 않는다
//
// 받는 사이 다른 것이 바뀌었으면 결과를 버린다:
// - 같은 함수를 또 불렀다(앞 요청은 늦게 와도 열지 않는다 · 실패 토스트도 내지 않는다)
// - 주소(경로 · 검색 파라미터)가 바뀌었다 — 다른 메뉴로 갔거나 스튜디오에서 다른 도구를 골랐다
// - 드로어 칸에 그 사이 다른 층이 열렸다
// 실패 안내는 경고 토스트 고정 문장 둘이다 — 응답에 그 API가 없으면 "찾을 수 없습니다", 요청이 실패하면 무엇이든 "삭제되어"(옛 그대로 — 이식 기간 보존)
import { fetchDiscoveryApis } from '../../api/hooks/discoveryApis';
import { DISCOVERY } from '../../copy/discovery';
import { currentDrawerLayer, openEvidenceDrawer } from '../layers';
import { queryClient } from '../queryClient';
import { toast } from '../toast';

let lastRequest = 0;

/** 지금 주소 — 받는 사이 화면 · 대상이 바뀌었는지 견준다 */
const currentAddress = (): string => `${window.location.pathname}${window.location.search}`;

export function openEvidence(jobId: string, apiId: string): void {
  lastRequest += 1;
  const request = lastRequest;
  const address = currentAddress();
  const drawer = currentDrawerLayer();
  const isLatest = () => request === lastRequest;

  fetchDiscoveryApis(queryClient, jobId).then(
    ({ apis, opts }) => {
      if (!isLatest()) return;
      const api = apis.find((candidate) => candidate.id === apiId);
      if (api === undefined) {
        toast.warn(DISCOVERY.toast.evidenceMissing);
        return;
      }
      if (currentAddress() !== address || currentDrawerLayer() !== drawer) return;
      openEvidenceDrawer({ jobId, api, opts, canSelect: false, isSelected: false });
    },
    (error: unknown) => {
      if (!isLatest()) return;
      console.warn('[discovery] evidence fetch failed', error);
      toast.warn(DISCOVERY.toast.evidenceGone);
    },
  );
}
