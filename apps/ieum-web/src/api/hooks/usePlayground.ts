// 테스트 실행 설정(GET /playground/ — models · chatEnabled). 테스트 실행 · 대시보드 구조도 · 로그 필터 · 변환 과정 모델 라벨이 쓴다(R20)
// 테스트 실행에서는 화면 조회, 나머지에서는 region 조회 — 키를 나눠 한쪽 실패가 다른 쪽 캐시에 남지 않게 한다(audit layers-nav.md Q-03)
import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { PlaygroundResponse } from '../types';
import { keys } from './keys';

const PLAYGROUND_PATH = '/playground/';

type PlaygroundOptions = Readonly<{
  /** 화면의 일부(구조도 상자 · 필터 select · 라벨)만 쓰면 true — ?mock=region-failed가 이 조회만 실패시킨다 */
  region?: boolean;
}>;

export function usePlayground({ region = false }: PlaygroundOptions = {}) {
  return useQuery({
    queryKey: keys.playground(region),
    queryFn: ({ signal }) => api.get<PlaygroundResponse>(PLAYGROUND_PATH, { region, signal }),
  });
}
