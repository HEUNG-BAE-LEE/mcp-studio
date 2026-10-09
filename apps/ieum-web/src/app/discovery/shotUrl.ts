// 헤드리스 브라우저 캡처 이미지 주소(`<img src>` — api/client와 ?mock= 시나리오 층을 지나지 않는다). 백엔드 경로 중 이것만 끝 슬래시가 없다.
// 캡처 번호가 바뀔 때만 주소가 바뀐다 — 서버가 no-store로 주므로 ?v=가 새 화면을 받게 한다.
// 번호는 마지막 화면 탐색 이벤트의 캡처 번호다(api/discoveryJob JobTrail shot — 옛 d.shot, js/menu/discovery.js:219).
// 작업의 shotSeq(이벤트 없이 다시 찍은 것 포함)를 쓰지 않는다 — 이미지가 강조 상자보다 앞서 바뀌어 상자가 다른 화면 위에 놓인다
import { API_ROOT } from '../../api/client';
import { jobApiPath } from '../../api/hooks/useDiscoveryJob';

const SHOT = 'shot';

/** 캡처가 아직 없으면(번호 0) null — 화면은 자리 문구를 그린다 */
export const shotUrl = (jobId: string, shot: number): string | null =>
  shot > 0 ? `${API_ROOT}${jobApiPath(jobId)}${SHOT}?v=${shot}` : null;
