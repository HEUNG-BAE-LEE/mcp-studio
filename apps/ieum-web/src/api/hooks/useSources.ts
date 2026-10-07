// 원본 시스템 · workspace · 연결 마법사 값(GET /sources/). 셸 GNB · 대시보드 · 원본 · 스튜디오 · 테스트 실행 · 배포가 함께 쓴다(R20)
// 셸 조회라 region이 아니다(audit layers-nav.md Q-01)
import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { SourcesResponse } from '../types';
import { keys } from './keys';

const SOURCES_PATH = '/sources/';

export function useSources() {
  return useQuery({
    queryKey: keys.sources(),
    queryFn: ({ signal }) => api.get<SourcesResponse>(SOURCES_PATH, { signal }),
  });
}
