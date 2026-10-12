// 액세스 키 목록(GET /deploy/keys/). 배포 화면 아래 키 상자만 기대는 영역 조회다 — 실패하면 그 상자 안에만 보인다(app/screenGate regionGate).
// 옛 콘솔은 부트 때 한 번 받고(js/common/api.js:33) 쓰기 뒤 메모리만 고쳤다. 여기서는 화면에 들어올 때마다 받는다(이식 기간 허용 차이 —
// 데이터를 화면 진입 때 받기) — 기본 staleTime(30초)을 이 쿼리만 덮는다. 받는 동안은 이전 값으로 그린다. 폴링은 없다(옛 폴링은 묶음만 — js/menu/deploy.js:134).
// created · last는 서버가 만든 문자열("YYYY-MM-DD" · "사용 전" · "MM-DD HH:MM")이라 바꾸지 않는다.
// 발급 · 폐기 뒤에는 응답으로 setQueryData하고 이 키를 무효화한다(app/deploy/useKeyMutations)
import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { AccessKey } from '../types';
import { keys } from './keys';

/** 발급 · 폐기 쓰기도 이 경로 아래다(app/deploy/useKeyMutations) */
export const KEYS_PATH = '/deploy/keys/';

const accessKeysQuery = {
  queryKey: keys.accessKeys(),
  queryFn: ({ signal }: { signal: AbortSignal }) => api.get<readonly AccessKey[]>(KEYS_PATH, { region: true, signal }),
};

/** 배포 화면이 들어올 때 한 번 받는 관찰자 — 화면 최상위에서 부른다(키 상자가 빈 상태 ↔ 상세로 다시 붙어도 다시 받지 않게) */
export function useAccessKeysOnEntry(): void {
  useQuery({ ...accessKeysQuery, refetchOnMount: 'always' });
}

/** 키 상자가 그리는 값 — 붙을 때 다시 받지 않는다(받는 때는 useAccessKeysOnEntry · 쓰기 뒤 무효화) */
export function useAccessKeys() {
  return useQuery({ ...accessKeysQuery, refetchOnMount: false });
}
