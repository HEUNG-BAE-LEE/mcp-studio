// 모달 칸 한 시도(열 때마다 한 번)가 쥐는 값 — 연 순간의 원본 값과 재인증 입력. 모달 칸(app/LayerHost ModalSlot)이 부른다
//
// 왜 연 순간에 잡나: 삭제가 성공하면 캐시에서 원본이 먼저 빠지고 호스트는 닫힌 뒤에도 내용을 남긴다. 본문이 캐시에서 이름을 다시 찾으면
// 그 사이와 닫히는 동안 이름이 비어 보인다. 옛도 연 순간의 SRC[id]로 본문을 만들었다(js/menu/sources.js:134-136,143-144)
//
// ── 쓰는 곳 계약 ──
// useModalAttempt(layer) → { attempt, changeCred }
//   layer — 모달 칸의 지금(또는 닫히며 남긴) 층. attemptId가 바뀌면 그리기 전에 새 시도로 바꾼다(렌더 중 상태 맞추기 —
//   앞 시도의 입력이 한 번도 보이지 않는다). 같은 원본을 다시 열어도 새 시도라 입력이 비고 시작 값이 그때의 원본 값으로 다시 잡힌다
//   attempt.source — 연 순간의 원본(이름 · 연결 방식 · 도구 수). 열 때 캐시에서 못 찾았으면 null이다 — 옛은 SRC[id]가 비어
//     s.name을 읽다 예외가 나 모달이 열리지 않았다. 새도 열지 않는다(쓰는 곳이 null이면 그리지 않고 칸을 비운다).
//     삭제 확인은 도구 수가 본문에 보이므로 도구 목록도 받아 둔 뒤여야 한다(없는 수를 0개로 보이지 않는다)
//   attempt.job — 탐색 기록 삭제 확인(deleteJob)이 연 순간의 작업(id · 이름). 탐색 개요 캐시(작업 표가 그린 목록)에서 찾고,
//     못 찾았으면 null이다 — 옛도 DISC.jobs에 없으면 열지 않았다(js/menu/discovery.js:390). 원본 종류의 층에서는 늘 null, 작업 종류에서는 source가 null
//   attempt.cred — 재인증 입력. 시작 값은 원본의 인증 방식(비면 인증 없음) + 그 연결 방식의 선택지 안으로 맞춘 방식(옛 :135, :87)이고
//     비밀 칸은 늘 빈칸이다. changeCred(next)는 지금 시도의 입력만 바꾼다
// ModalContent — 종류별 내용(제목 · 확인 글자 · 확인 동작 · 확인 잠금 · 본문). 칸이 Modal 하나에 걸고 종류가 바뀌어도 Modal은 그대로다
// isPendingFor(mutation, sourceId) — 요청 훅은 시도를 거쳐 남아 앞 대상의 요청 상태를 쥔다. 지금 원본의 요청일 때만 진행 중으로 읽는다
import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { keys } from '../../api/hooks/keys';
import { useSources } from '../../api/hooks/useSources';
import { useTools, type ToolIndex } from '../../api/hooks/useTools';
import type { DiscoveryResponse, JobSummary, Source, SourceCred } from '../../api/types';
import type { ModalLayer } from '../layers';
import type { ModalSize } from '@/ui';
import { coerceAuthType, initialCred } from './authOptions';

/** 연 순간에 잡은 원본 — 본문 이름 · 도구 수와 재인증 인증 칸의 연결 방식 */
export type OpenedSource = Readonly<{
  id: string;
  name: string;
  /** 원본 연결 방식 — AuthForm mode */
  proto: string;
  /** 이 원본에서 만든 AI 도구 수(삭제 확인 본문) */
  toolCount: number;
}>;

/** 연 순간에 잡은 탐색 작업 — 기록 삭제 확인 본문의 이름 */
export type OpenedJob = Readonly<{ id: string; name: string }>;

export type ModalAttempt = Readonly<{
  /** 이 시도의 번호 — 모달 칸의 attemptId */
  attemptId: number;
  /** 연 순간의 원본. 못 찾았거나 작업 종류의 층이면 null */
  source: OpenedSource | null;
  /** 연 순간의 탐색 작업. 못 찾았거나 원본 종류의 층이면 null */
  job: OpenedJob | null;
  /** 재인증 입력 */
  cred: SourceCred;
}>;

/**
 * 모달 칸에 보이는 내용 한 종류 — 칸의 Modal 하나에 그대로 건다. 확인이 없으면(안내 · 오류 · 서버 로그) confirmLabel을 비운다.
 * 폭 · 취소 글자 · 취소 없음 · 발 앞 버튼 · 닫힘 막기는 배포 층(app/deploy)만 쓴다 — 없으면 Modal 기본값
 */
export type ModalContent = Readonly<{
  title: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  /** 이 대상의 요청이 진행 중인가 — Modal confirmDisabled(확인 버튼 pending) */
  isLocked?: boolean;
  /** 본문 — 시도마다 새로 마운트되도록 칸이 key = attemptId를 단다 */
  body: ReactNode;
  size?: ModalSize;
  cancelLabel?: string;
  hideCancel?: boolean;
  extra?: ReactNode;
  dismissible?: boolean;
}>;

type PendingState = Readonly<{ isPending: boolean; variables: Readonly<{ sourceId: string }> | undefined }>;

/** 요청이 진행 중이고 그 요청이 이 원본의 것인가 */
export const isPendingFor = (mutation: PendingState, sourceId: string): boolean =>
  mutation.isPending && mutation.variables?.sourceId === sourceId;

type AttemptHook = Readonly<{
  attempt: ModalAttempt;
  /** 재인증 입력을 새 값 전체로 바꾼다. 그사이 새 시도로 바뀌었으면 두지 않는다 */
  changeCred: (cred: SourceCred) => void;
}>;

const openedOf = (source: Source, tools: ToolIndex | undefined): OpenedSource => ({
  id: source.id,
  name: source.name,
  proto: source.proto,
  toolCount: tools?.bySource[source.id]?.length ?? 0,
});

type AttemptCache = Readonly<{
  sources: readonly Source[] | undefined;
  tools: ToolIndex | undefined;
  /** 탐색 개요의 작업 목록 — 작업 표가 그린 것 */
  jobs: readonly JobSummary[] | undefined;
}>;

/**
 * 열 때의 캐시로 새 시도를 만든다 — 원본이 없거나 원본 삭제 확인인데 도구 목록이 아직 없으면 source는 null,
 * 탐색 기록 삭제 확인인데 작업이 목록에 없으면 job은 null
 */
function startAttempt(layer: ModalLayer, { sources, tools, jobs }: AttemptCache): ModalAttempt {
  const empty: ModalAttempt = { attemptId: layer.attemptId, source: null, job: null, cred: initialCred() };
  if (layer.kind === 'deleteJob') {
    const job = jobs?.find((j) => j.id === layer.jobId);
    return job === undefined ? empty : { ...empty, job: { id: job.id, name: job.name } };
  }
  // 배포 층은 원본 · 작업을 잡지 않는다(app/deploy/useDeployModalAttempt)
  if (layer.kind !== 'reauth' && layer.kind !== 'deleteSource') return empty;
  const found = sources?.find((s) => s.id === layer.sourceId);
  const isReady = found !== undefined && (layer.kind === 'reauth' || tools !== undefined);
  if (!isReady) return empty;
  return {
    ...empty,
    source: openedOf(found, tools),
    cred: coerceAuthType(found.proto, initialCred(found.authType)),
  };
}

export function useModalAttempt(layer: ModalLayer): AttemptHook {
  const queryClient = useQueryClient();
  const sources = useSources().data?.sources;
  const tools = useTools().data;
  // 작업 목록은 구독하지 않고 연 순간에만 읽는다 — 모달 칸이 탐색 개요를 받게 하지 않는다(작업 표 "삭제"는 목록을 받은 뒤에만 보인다)
  const cacheNow = (): AttemptCache => ({
    sources,
    tools,
    jobs: queryClient.getQueryData<DiscoveryResponse>(keys.discoveryOverview())?.jobs,
  });
  const [stored, setStored] = useState(() => startAttempt(layer, cacheNow()));
  const attempt = stored.attemptId === layer.attemptId ? stored : startAttempt(layer, cacheNow());
  if (attempt !== stored) setStored(attempt);
  const changeCred = (cred: SourceCred) =>
    setStored((prev) => (prev.attemptId === layer.attemptId ? { ...prev, cred } : prev));
  return { attempt, changeCred };
}
