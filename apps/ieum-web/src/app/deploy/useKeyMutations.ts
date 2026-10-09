// 액세스 키 쓰기 둘 — 발급 · 폐기(옛 js/menu/deploy.js:172-182). 캐시 고침 · 토스트 · 층은 useMutation **옵션** 콜백에 둔다(화면이 사라져도 돈다).
// 성공하면 응답으로 setQueryData한 뒤 키 목록(['deploy','keys'])을 무효화한다 — 키 상자가 보이고 있으면 바로 다시 받는다.
// 키 원문(secret)은 발급 응답에서 한 번만 온다: 목록 캐시에는 원문을 뺀 행만 넣고, 원문은 결과 층(app/layers openKeyReveal)에만 넘긴다.
//
// ── 쓰는 곳 계약 ──
// useIssueKey() — 발급 창의 "발급". mutate({ name }) — name은 입력 그대로(앞뒤 공백을 빼고, 비면 "새 액세스 키" — 옛 :173).
//   성공: 원문을 뺀 행을 목록 맨 앞에(옛 KEYS.unshift — 서버도 맨 앞에 넣는다) → 무효화 → 결과 층을 연다(모달 칸을 결과로 바꾼다 —
//   발급 창이 닫혔거나 메뉴를 옮겼어도 연다. 발급 창 닫기는 따로 하지 않는다). 토스트는 없다(옛과 같다).
//   실패: toast.warn(서버 문장), 발급 창은 그대로.
//   원문은 이 요청의 data에도 남는다(gcTime 0 — 관찰자가 없어지면 mutation 캐시에서 바로 빠진다). 이 훅은 늘 붙은 모달 칸이 쥐므로
//   (app/deploy/useDeployModalContent) 칸이 성공을 받은 즉시 reset()으로 비운다 — 원문은 결과 층에만 남고, 그 층은 닫는 순간 비운다(app/LayerHost)
// useRevokeKey() — 폐기 확인 창의 "폐기". mutate({ keyId }).
//   성공: 그 행을 응답(on:false)으로 → 무효화 → 그 키의 폐기 확인 창이면 닫기(행 고침과 같은 그리기에 — "폐기" 버튼이 사라지므로 포커스가
//   층 공통 대체 자리로 간다, app/deploy/useToolsetMutations 중지와 같다) → toast(keyRevoke.done(이름)). 실패: toast.warn(서버 문장), 창은 그대로
import { notifyManager, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { keys } from '../../api/hooks/keys';
import { KEYS_PATH } from '../../api/hooks/useAccessKeys';
import type { AccessKey, KeyCreated, KeyIssueBody } from '../../api/types';
import { DEPLOY } from '../../copy/deploy';
import { closeModalIf, openKeyReveal } from '../layers';
import { SECRET_MUTATION_GC_TIME } from '../queryClient';
import { toast } from '../toast';
import { warnFailure } from './warnFailure';

const revokePath = (keyId: string) => `${KEYS_PATH}${encodeURIComponent(keyId)}/revoke/`;

export type IssueKeyVars = Readonly<{
  /** 키 이름 입력 그대로 */
  name: string;
}>;
export type RevokeKeyVars = Readonly<{ keyId: string }>;

type KeyList = readonly AccessKey[];

/** 새 키는 목록 맨 앞에. 캐시가 없으면 만들지 않는다 */
function addKey(queryClient: QueryClient, row: AccessKey): void {
  queryClient.setQueryData<KeyList>(keys.accessKeys(), (prev) => (prev === undefined ? undefined : [row, ...prev]));
}

/** 같은 id의 키를 응답으로 바꾼다(옛 k.on = false :181 — 응답이 행 전체다) */
function replaceKey(queryClient: QueryClient, row: AccessKey): void {
  queryClient.setQueryData<KeyList>(keys.accessKeys(), (prev) =>
    prev === undefined ? undefined : prev.map((k) => (k.id === row.id ? row : k)),
  );
}

function invalidateKeys(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: keys.accessKeys(), exact: true });
}

export function useIssueKey() {
  const queryClient = useQueryClient();
  return useMutation({
    // 응답에 키 원문이 있다
    gcTime: SECRET_MUTATION_GC_TIME,
    mutationFn: ({ name }: IssueKeyVars) => {
      const body: KeyIssueBody = { name: name.trim() || DEPLOY.keyIssue.defaultName };
      return api.post<KeyCreated>(KEYS_PATH, body);
    },
    onSuccess: ({ secret, ...row }) => {
      addKey(queryClient, row);
      invalidateKeys(queryClient);
      openKeyReveal(secret);
    },
    onError: warnFailure,
  });
}

export function useRevokeKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ keyId }: RevokeKeyVars) => api.post<AccessKey>(revokePath(keyId)),
    onSuccess: (row, { keyId }) => {
      replaceKey(queryClient, row);
      invalidateKeys(queryClient);
      notifyManager.schedule(() => closeModalIf({ kind: 'keyRevoke', keyId }));
      toast(DEPLOY.keyRevoke.done(row.name));
    },
    onError: warnFailure,
  });
}
