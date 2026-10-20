// 자동 탐색 쓰기 다섯 — 시작 · 중단(예약 취소) · 다시 탐색 · 도구 후보 등록 · 기록 삭제(옛 js/menu/discovery.js:103-115,369-396)
// 캐시 고침 · 개요 다시 받기 · 토스트 · 층 닫기 · 이동은 useMutation **옵션** 콜백에 둔다 — 화면이 사라져도 돈다(app/sources/useSourceMutations와 같다).
// 이동은 출발한 곳에 아직 있을 때만 한다(이식 기간 고침 — 옛은 떠났어도 끌고 갔다):
// - 시작: 그 시도의 마법사 드로어가 아직 열려 있을 때만(isWizardShowing). 떠났으면 "지금 바로"는 안내 없이 작업 표에만 나타난다
// - 다시 탐색 · 등록: 이 훅을 부른 작업 화면이 아직 마운트돼 있고, 그 화면이 지금 보는 작업(훅에 넘긴 jobId)이 요청을 보낸 작업일 때만.
//   같은 화면 컴포넌트가 경로만 바뀌어 다른 작업으로 옮기면 마운트가 이어지므로 작업 id까지 본다
// 요청 중 잠금(pending — 포커스 유지)은 쓰는 곳이 isPending으로 한다. 실패는 모두 경고 토스트(서버 문장 그대로)이고 층 · 선택은 그대로 둔다
//
// 원본(['sources']) · 도구(['studio'])는 응답으로 setQueryData만 한다 — 캐시가 아직 없으면 만들지 않는다(다음 구독이 받는다).
// 작업 캐시도 같다: 없는데 만들면 다시 열 때 처음 이어 받기를 건너뛴다(api/hooks/useDiscoveryJob).
// 탐색 개요(작업 표)는 무효화가 아니라 fetchQuery로 늘 네트워크에서 받는다 — 무효화는 활성 쿼리만 다시 받는데 작업 화면 · 층을 닫은 뒤에는
// 개요 관찰자가 없다. 기다리지 않고 실패는 알리지 않는다(옛 refreshJobs — :30)
// 응답 작업 요약의 예약 시각은 mutationFn에서 ms로 바꾼다(api/discoveryJob withMsStartAt — 시작 · 중단 · 다시 탐색)
//
// ── 쓰는 곳 계약 ──
// useStartDiscovery() — 마법사 탐색 모드의 시작 버튼. mutate({ attemptId, body }) — body는 toStartBody(탐색 입력)
//   (app/sources/SourceWizard/discover/startBody). 단계 검증(checkSafety)은 부르는 쪽이 먼저 한다.
//   성공: 그 시도의 드로어가 열려 있으면 작업 화면으로 이동한 뒤 드로어를 닫는다(moveToJob — 포커스가 새 화면 대체 자리로) →
//   개요 받기 → 예약이면 info 토스트(예약 시각)
// useCancelDiscovery() — 작업 화면 머리 "탐색 중단" · "예약 취소". mutate({ jobId }). 확인 없이 보낸다(이식 기간 보존).
//   성공: info 토스트. 작업은 폴링이 새 상태를 받는다(응답은 아직 running일 수 있다)
// useRerunDiscovery(jobId) — 작업 화면 머리 "같은 설정으로 다시 탐색". jobId는 지금 화면의 작업(경로의 :jobId). mutate({ jobId }).
//   성공: 개요 받기 → 그 화면이 아직 요청한 작업을 보고 있으면 새 작업 화면으로(push)
// useRegisterDiscovery(jobId) — 작업 화면 선택 도크 "도구 후보로 등록". jobId는 지금 화면의 작업. mutate({ jobId, ids }) — ids는 고른 API id
//   (선택 집합 그대로). 성공: 원본 · 도구 캐시 고침 · 그 원본 도구의 스튜디오 초안 버림 → 작업 캐시 등록 완료 → 개요 받기 →
//   그 화면이 아직 요청한 작업을 보고 있으면 스튜디오 첫 도구로 → 토스트 하나
//   (새로 더한 것이 있으면 완료, 없으면 info. 로그인 방법을 모르면 두 문장을 붙여 경고 하나)
// useDeleteDiscoveryJob() — 기록 삭제 확인 모달의 "삭제". mutate({ jobId }). 성공 토스트는 없다.
//   성공: 작업 표에서 그 행을 뺀다(개요 캐시 — 서버가 지웠다) · 모달 칸이 그 작업의 삭제 확인일 때만 닫기(옛은 지금 모달을 무엇이든 닫았다 — :392)
//   → 그 작업 캐시를 버림 → 개요 받기. 행 빼기와 모달 닫기는 같은 그리기에 들어가게 쿼리 알림 차례에 닫는다 — 모달이 먼저 닫히면 포커스가
//   곧 사라질 "삭제" 버튼으로 돌아갔다가 body로 빠진다. 같이 그려지면 연 버튼이 이미 없어 대체 자리(화면 제목)로 간다(옛은 포커스를 돌려주지 않았다)
import { notifyManager, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { api } from '../../api/client';
import { withMsStartAt, type JobData } from '../../api/discoveryJob';
import { keys } from '../../api/hooks/keys';
import { discoveryOverviewQuery } from '../../api/hooks/useDiscovery';
import { jobApiPath } from '../../api/hooks/useDiscoveryJob';
import { sourceToolIds } from '../../api/hooks/useTools';
import type {
  DeletedResult,
  DiscoveryResponse,
  JobSummary,
  RegisterBody,
  RegisterResult,
  Source,
  SourcesResponse,
  StartJobBody,
  StudioResponse,
} from '../../api/types';
import { DISCOVERY } from '../../copy/discovery';
import { closeLayer, closeModalIf, isWizardShowing } from '../layers';
import { SECRET_MUTATION_GC_TIME } from '../queryClient';
import { clearDrafts } from '../studio/drafts';
import { studioSrcLink, toolLink } from '../studio/links';
import { toast } from '../toast';
import { jobPath } from './links';

const JOBS_PATH = '/discovery/jobs/';
const cancelPath = (jobId: string) => `${jobApiPath(jobId)}cancel/`;
const rerunPath = (jobId: string) => `${jobApiPath(jobId)}rerun/`;
const registerPath = (jobId: string) => `${jobApiPath(jobId)}register/`;

export type StartDiscoveryVars = Readonly<{
  /** 요청을 보낸 마법사 시도 — 드로어 칸의 attemptId */
  attemptId: number;
  body: StartJobBody;
}>;
/** 작업 하나에 보내는 쓰기(중단 · 다시 탐색 · 삭제)의 변수 — 요청을 보낸 작업 */
export type JobVars = Readonly<{ jobId: string }>;
export type RegisterDiscoveryVars = Readonly<{
  jobId: string;
  /** 고른 API id */
  ids: readonly string[];
}>;

/** 탐색 개요를 네트워크에서 한 번 받는다 — 관찰자가 없어도 나간다. 기다리지 않고, 실패는 개발 콘솔에만(옛도 조용히 버렸다) */
function refetchOverview(queryClient: QueryClient): void {
  queryClient.fetchQuery({ ...discoveryOverviewQuery, staleTime: 0 }).catch((error: unknown) => {
    console.warn('[discovery] overview refetch failed', error);
  });
}

/**
 * 요청이 끝났을 때 출발한 작업 화면에 아직 있는지 묻는 함수 — 이 훅을 부른 화면이 마운트돼 있고 그 화면의 작업(screenJobId)이
 * 요청의 작업(jobId)일 때만 true. 화면의 작업은 ref로 들고 있어 요청 중에 경로가 바뀌어도 끝난 순간의 값을 본다
 */
function useIsOnJobScreen(screenJobId: string): (jobId: string) => boolean {
  const mounted = useRef(false);
  const screenJob = useRef(screenJobId);
  useEffect(() => {
    screenJob.current = screenJobId;
  }, [screenJobId]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return useCallback((jobId: string) => mounted.current && screenJob.current === jobId, []);
}

// ── 등록 뒤 캐시 고침(받은 객체는 고치지 않고 새로 만든다. 캐시가 없으면 undefined를 돌려줘 만들지 않는다) ──

/** 응답 원본을 목록에서 바꾸거나(같은 id) 끝에 더하고, 그 원본의 도구를 응답 도구로 바꾼다(옛 :374-376) */
function applyRegistered(queryClient: QueryClient, source: Source, tools: RegisterResult['tools']): void {
  queryClient.setQueryData<SourcesResponse>(keys.sources(), (prev) => {
    if (prev === undefined) return undefined;
    const exists = prev.sources.some((s) => s.id === source.id);
    const sources = exists ? prev.sources.map((s) => (s.id === source.id ? source : s)) : [...prev.sources, source];
    return { ...prev, sources };
  });
  queryClient.setQueryData<StudioResponse>(keys.tools(), (prev) =>
    prev === undefined ? undefined : { ...prev, [source.id]: tools },
  );
}

/**
 * 그 원본 도구의 스튜디오 초안을 버린다 — 옛은 그 원본의 도구 객체를 통째로 서버 응답으로 갈아 화면에서 고친 값이 사라졌다(:374).
 * 응답 도구(서버의 그 원본 도구 전체)와 캐시에 있던 그 원본 도구를 함께 넘긴다 — 도구 캐시가 없어도 초안은 남아 있을 수 있다
 */
function dropDrafts(queryClient: QueryClient, sourceId: string, tools: RegisterResult['tools']): void {
  clearDrafts([...sourceToolIds(queryClient, sourceId), ...tools.map((t) => t.id)]);
}

/** 작업을 등록 완료로(옛 :377 — 서버도 같은 값으로 바꾼다) */
function markRegistered(queryClient: QueryClient, jobId: string, count: number, sourceId: string): void {
  queryClient.setQueryData<JobData>(keys.discoveryJob(jobId), (prev) =>
    prev === undefined
      ? undefined
      : { ...prev, status: 'done', registered: count, sourceId, stage: { ...prev.stage, review: 'done' } },
  );
}

/** 등록 토스트 하나(옛 :381-382 — 옛은 로그인 모름 경고를 3초 뒤 따로 띄웠다) */
function announceRegistered({ added, loginKnown }: RegisterResult): void {
  const message = added > 0 ? DISCOVERY.toast.registered(added) : DISCOVERY.toast.alreadyRegistered;
  if (!loginKnown) toast.warn(DISCOVERY.toast.withLoginUnknown(message));
  else if (added > 0) toast(message);
  else toast.info(message);
}

const warnFailure = (error: Error): void => {
  toast.warn(error.message);
};

/**
 * 탐색 시작 성공 뒤 작업 화면으로 — 드로어를 먼저 닫으면 포커스가 곧 사라질 원본 화면 버튼으로 돌아갔다가 body로 빠진다
 * (연결 마법사 완료 이동 app/sources/SourceWizard/useWizardSession useFinish와 같은 까닭). 그래서 먼저 이동해 새 화면을 그린 뒤 닫는다 —
 * 그때 연 버튼이 이미 사라져 포커스가 새 화면의 대체 자리(제목 → 본문)로 간다.
 * 마법사 완료와 다른 점: 작업 화면은 원본과 같은 메뉴라 셸이 층을 닫지 않는다(대시보드에서 연 마법사만 셸이 닫는다). 그래서 여기서 닫되,
 * 이동은 flushSync로 그린다 — 기본 이동은 startTransition이라 닫기(동기 갱신)가 새 화면보다 먼저 그려진다
 */
async function moveToJob(navigate: NavigateFunction, jobId: string, attemptId: number): Promise<void> {
  await navigate(jobPath(jobId), { flushSync: true });
  if (isWizardShowing(attemptId)) closeLayer('drawer');
}

export function useStartDiscovery() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    // 본문에 계정 비밀번호 · Git 토큰이 있다
    gcTime: SECRET_MUTATION_GC_TIME,
    mutationFn: async ({ body }: StartDiscoveryVars) => withMsStartAt(await api.post<JobSummary>(JOBS_PATH, body)),
    onSuccess: (job, { attemptId }) => {
      if (isWizardShowing(attemptId)) void moveToJob(navigate, job.id, attemptId);
      refetchOverview(queryClient);
      if (job.status === 'scheduled' && job.startAt !== null) toast.info(DISCOVERY.toast.scheduled(job.startAt));
    },
    onError: warnFailure,
  });
}

export function useCancelDiscovery() {
  return useMutation({
    mutationFn: async ({ jobId }: JobVars) => withMsStartAt(await api.post<JobSummary>(cancelPath(jobId))),
    onSuccess: () => {
      toast.info(DISCOVERY.toast.stopping);
    },
    onError: warnFailure,
  });
}

export function useRerunDiscovery(screenJobId: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isOnJobScreen = useIsOnJobScreen(screenJobId);
  return useMutation({
    mutationFn: async ({ jobId }: JobVars) => withMsStartAt(await api.post<JobSummary>(rerunPath(jobId))),
    onSuccess: (job, { jobId }) => {
      refetchOverview(queryClient);
      if (isOnJobScreen(jobId)) void navigate(jobPath(job.id));
    },
    onError: warnFailure,
  });
}

export function useRegisterDiscovery(screenJobId: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isOnJobScreen = useIsOnJobScreen(screenJobId);
  return useMutation({
    mutationFn: ({ jobId, ids }: RegisterDiscoveryVars) => {
      const body: RegisterBody = { ids: [...ids] };
      return api.post<RegisterResult>(registerPath(jobId), body);
    },
    onSuccess: (result, { jobId, ids }) => {
      const { source, tools } = result;
      dropDrafts(queryClient, source.id, tools);
      applyRegistered(queryClient, source, tools);
      markRegistered(queryClient, jobId, ids.length, source.id);
      refetchOverview(queryClient);
      if (isOnJobScreen(jobId)) {
        const [first] = tools;
        const { to, state } = first ? toolLink(first.id, { src: source.id }) : studioSrcLink(source.id);
        void navigate(to, { state });
      }
      announceRegistered(result);
    },
    onError: warnFailure,
  });
}

export function useDeleteDiscoveryJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId }: JobVars) => api.del<DeletedResult>(jobApiPath(jobId)),
    onSuccess: (_result, { jobId }) => {
      queryClient.setQueryData<DiscoveryResponse>(keys.discoveryOverview(), (prev) =>
        prev === undefined ? undefined : { ...prev, jobs: prev.jobs.filter((job) => job.id !== jobId) },
      );
      notifyManager.schedule(() => closeModalIf({ kind: 'deleteJob', jobId }));
      queryClient.removeQueries({ queryKey: keys.discoveryJob(jobId) });
      refetchOverview(queryClient);
    },
    onError: warnFailure,
  });
}
