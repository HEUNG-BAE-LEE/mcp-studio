// 원본 시스템 · workspace · 연결 마법사 값(GET /sources/). 셸 GNB · 대시보드 · 원본 · 스튜디오 · 테스트 실행 · 배포가 함께 쓴다
// 셸 조회라 region이 아니다. 부팅 자원이라 한 번 받은 뒤에는 쓰기 응답으로만 고친다(app/queryClient)
import { useQuery } from '@tanstack/react-query';
import { BOOT_STALE_TIME } from '../../app/queryClient';
import { api } from '../client';
import type { SourcesResponse } from '../types';
import { keys } from './keys';

const SOURCES_PATH = '/sources/';

export function useSources() {
  return useQuery({
    queryKey: keys.sources(),
    // 부팅 자원 — 화면이 사라져도 요청을 끊지 않는다(api/hooks/useTools와 같은 까닭)
    queryFn: () => api.get<SourcesResponse>(SOURCES_PATH),
    staleTime: BOOT_STALE_TIME,
  });
}
