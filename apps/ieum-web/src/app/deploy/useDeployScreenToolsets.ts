// 배포 화면의 묶음 조회 — 4초 폴링을 모달이 열린 동안 멈춘다(옛은 #modal이 보이면 건너뛰었다 — js/menu/deploy.js:133).
// 배포 계열 층만이 아니라 셸 범위 모달까지 어떤 모달이든 열려 있으면 멈춘다(옛 #modal은 한 요소였다). 드로어는 보지 않는다(옛도 보지 않았다)
// 폴링 관찰자는 배포 화면(DeployScreen)의 이 훅 한 곳뿐이다 — 관찰자가 둘이면 4초마다 GET이 두 번 나간다. 다른 곳(층 호스트의 배포 층 ·
// 쓰기 훅)은 묶음 캐시를 구독하지 않고 연 순간 · 응답 때 읽거나 고친다(queryClient.getQueryData · setQueryData)
import { useToolsets } from '../../api/hooks/useToolsets';
import { useOpenLayers } from '@/ui';

export function useDeployScreenToolsets() {
  const { modal } = useOpenLayers();
  return useToolsets({ isPaused: modal });
}
