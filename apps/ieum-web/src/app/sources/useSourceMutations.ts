// 원본 시스템 쓰기 넷 — 연결 · 인증 다시 입력 · 삭제(옛 js/menu/sources.js:112-150) · 명세 다시 읽기(옛 js/menu/studio.js:168-176)
// 캐시 고침 · 토스트 · 자기 층 닫기는 useMutation **옵션** 콜백에 둔다 — 층을 닫거나 메뉴를 옮겨 화면이 사라져도 돈다
// (옛도 요청은 이어졌다. 층을 닫은 뒤의 결과 안내를 더한 것이 이식 기간 고침이다). mutate(vars, { onSuccess })의 호출 쪽 콜백은 쓰지 않는다.
// 성공하면 원본(['sources']) · 도구(['studio'])를 다시 받지 않고 응답으로 setQueryData만 한다 — 옛은 메모리만 고쳤고
// 삭제 뒤의 GET은 묶음(/deploy/toolsets/) 하나뿐이었다(js/menu/sources.js:119,138,145-148). 캐시가 아직 없으면 만들지 않는다(다음 구독이 받는다).
// 요청 중 잠금(확인 버튼 confirmDisabled 등)은 쓰는 곳이 isPending으로 한다
//
// ── 쓰는 곳 계약 ──
// useConnectSource() — 연결 마법사 드로어 틀이 부른다(app/sources/SourceWizard/useWizardSession — 도크 버튼이 결과를 알아야 해서
//   늘 마운트된 드로어 쪽에 둔다. 그래서 한 인스턴스를 여러 시도가 거친다).
//   mutate({ attemptId, body }): attemptId는 지금 드로어 칸의 attemptId(useDrawerLayer), body는 마법사 입력 그대로(이름 · 명세 URL ·
//   서버 주소의 앞뒤 공백은 여기서 뺀다 — js/menu/sources.js:117). 4단계로 넘어가는 순간 한 번 부른다.
//   결과는 마법사가 이 훅의 반환값에서 읽되 variables.attemptId가 지금 시도일 때만 읽는다 — 다른 시도의 결과가 새 마법사에 들어오지 않게:
//   isPending(진행 중) · data { source, tools }(성공 — 요약 · 결과 칸 · 완료 이동) · error.message(실패 상자 본문 — 서버 문장 그대로) ·
//   reset()(실패 뒤 "이전"으로 3단계에 돌아갈 때 — 다시 시작하면 처음부터)
//   마법사가 그 시도를 더는 보이지 않으면(닫힘 · 다시 열기 · 메뉴 이동 — isWizardShowing) 이 훅이 대신 알린다:
//   성공 toast(connected(이름, 도구 수)) — 이동하지 않는다, 실패 toast.warn(connectFailed(서버 문장)). 보이는 동안은 토스트를 띄우지 않는다
//   완료 이동은 마법사가 data로 한다(이 파일은 이동하지 않는다):
//   tools[0] ? toolLink(tools[0].id) : studioSrcLink(source.id)(app/studio/links — 스튜디오 도착 표지 포함) →
//   navigate(to, { state }) → toast(SOURCES.toast.connected(source.name, tools.length)). 드로어는 셸이 메뉴 이동 뒤 닫는다(useWizardSession useFinish).
//   이름 · 도구는 쿼리 캐시가 아니라 이 응답에서 읽는다
// useReauthSource() — 재인증 모달 본문이 부른다. mutate({ sourceId, auth }).
//   성공: 그 원본을 응답(고친 원본 전체)으로 바꾸고 → 모달 칸이 그 원본의 재인증이면 닫고 → toast(reauthSaved(이름)).
//   실패: toast.warn(서버 문장), 모달은 그대로
// useDeleteSource() — 삭제 확인 모달 본문이 부른다. mutate({ sourceId, name }) — name은 모달을 연 순간의 이름(본문에 보인 값)이다.
//   성공: 그 원본 도구의 스튜디오 초안을 지우고 원본 목록 · 도구 맵에서 뺀다 → 묶음을 네트워크에서 한 번 받는다(실패는 무시 — 삭제는 이미 됐다) → 모달 칸이 그 원본의
//   삭제 확인이면 닫는다 → toast(deleted(name)). 묶음을 받는 동안에도 isPending이라 확인 버튼 잠금이 이어진다.
//   실패: toast.warn(서버 문장), 모달은 그대로
// useRereadSource() — 스튜디오 선택줄 "명세 다시 읽기"가 부른다. mutate({ sourceId }) — 본문 {}는 client 기본값(api.post — 옛 api.post 기본 본문).
//   성공: 그 원본을 응답으로 고치고 도구 맵의 그 원본 도구를 응답 도구로 바꾼다 → 그 원본 도구(옛 · 새 id)의 스튜디오 초안을 지운다
//   (옛도 도구 객체를 통째로 바꿔 저장 안 한 편집이 사라졌다) → 명세가 바뀐 도구가 있으면 toast.warn, 없으면 toast(reread).
//   선택 도구 보정은 스튜디오 화면이 한다. 실패: 서버가 그 원본에 err를 남겼을 수 있어 원본 목록을 다시 받고(옛은 화면에서
//   err를 박았다 — 이식 기간 고침), toast.warn(서버 문장). 요청 중 버튼은 잠금(pending — 포커스 유지)만(글자 그대로)
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { keys } from '../../api/hooks/keys';
import { sourceToolIds } from '../../api/hooks/useTools';
import { toolsetsQuery } from '../../api/hooks/useToolsets';
import type {
  ConnectSourceBody,
  ConnectSourceResult,
  DeletedResult,
  ReauthBody,
  RereadResponse,
  Source,
  SourceCred,
  SourcesResponse,
  StudioResponse,
  ToolRecord,
} from '../../api/types';
import { SOURCES } from '../../copy/sources';
import { STUDIO } from '../../copy/studio';
import { closeModalIf, isWizardShowing } from '../layers';
import { SECRET_MUTATION_GC_TIME } from '../queryClient';
import { clearDrafts } from '../studio/drafts';
import { toast } from '../toast';

const CONNECT_PATH = '/sources/connect/';
const sourcePath = (sourceId: string) => `/sources/${encodeURIComponent(sourceId)}/`;
const reauthPath = (sourceId: string) => `${sourcePath(sourceId)}reauth/`;
const rereadPath = (sourceId: string) => `${sourcePath(sourceId)}reread/`;

export type ConnectSourceVars = Readonly<{
  /** 요청을 보낸 마법사 시도 — 드로어 칸의 attemptId */
  attemptId: number;
  /** 마법사 입력 그대로 */
  body: ConnectSourceBody;
}>;
export type ReauthSourceVars = Readonly<{ sourceId: string; auth: SourceCred }>;
export type DeleteSourceVars = Readonly<{
  sourceId: string;
  /** 모달을 연 순간의 원본 이름 — 성공 토스트에 쓴다(옛은 연 때 잡은 이름 그대로 — js/menu/sources.js:143,149) */
  name: string;
}>;

/** 옛 본문 그대로 아홉 칸 · 같은 순서. 이름 · 명세 URL · 서버 주소만 앞뒤 공백을 뺀다(js/menu/sources.js:117-118) */
const trimmedConnectBody = (b: ConnectSourceBody): ConnectSourceBody => ({
  mode: b.mode,
  name: b.name.trim(),
  specUrl: b.specUrl.trim(),
  specText: b.specText,
  base: b.base.trim(),
  gov: b.gov,
  auth: b.auth,
  sampleRequest: b.sampleRequest,
  sampleResponse: b.sampleResponse,
});

// ── 캐시 고침(받은 객체는 고치지 않고 새로 만든다. 캐시가 없으면 undefined를 돌려줘 만들지 않는다) ──

/** 새 원본은 목록 끝에(서버 추가 순과 같다 — js/menu/sources.js:119 push), 도구는 그 원본 id 아래에 */
function addConnected(queryClient: QueryClient, source: Source, tools: readonly ToolRecord[]): void {
  queryClient.setQueryData<SourcesResponse>(keys.sources(), (prev) =>
    prev === undefined ? undefined : { ...prev, sources: [...prev.sources, source] },
  );
  queryClient.setQueryData<StudioResponse>(keys.tools(), (prev) =>
    prev === undefined ? undefined : { ...prev, [source.id]: tools },
  );
}

/** 그 원본에 응답을 덮는다(옛 Object.assign — js/menu/sources.js:138) */
function mergeSource(queryClient: QueryClient, sourceId: string, next: Source): void {
  queryClient.setQueryData<SourcesResponse>(keys.sources(), (prev) =>
    prev === undefined
      ? undefined
      : { ...prev, sources: prev.sources.map((s) => (s.id === sourceId ? { ...s, ...next } : s)) },
  );
}

/** 원본 목록과 도구 맵에서 그 원본을 뺀다(js/menu/sources.js:146-147) */
function removeSource(queryClient: QueryClient, sourceId: string): void {
  queryClient.setQueryData<SourcesResponse>(keys.sources(), (prev) =>
    prev === undefined ? undefined : { ...prev, sources: prev.sources.filter((s) => s.id !== sourceId) },
  );
  queryClient.setQueryData<StudioResponse>(keys.tools(), (prev) =>
    prev === undefined ? undefined : Object.fromEntries(Object.entries(prev).filter(([id]) => id !== sourceId)),
  );
}

/** 그 원본의 도구를 다시 읽은 도구로 바꾼다(js/menu/studio.js:172 TOOLS[s.id] = r.tools) */
function replaceSourceTools(queryClient: QueryClient, sourceId: string, tools: readonly ToolRecord[]): void {
  queryClient.setQueryData<StudioResponse>(keys.tools(), (prev) =>
    prev === undefined ? undefined : { ...prev, [sourceId]: tools },
  );
}

/**
 * 삭제하면 서버가 묶음에서 그 원본의 도구를 빼므로 묶음을 새로 받는다(js/menu/sources.js:148). staleTime 0이라 캐시가 새것이어도 늘 받는다.
 * 실패는 삭제 결과를 바꾸지 않으므로 알리지 않는다 — 원문은 개발 콘솔에만(옛은 이 실패로 모달이 닫히지 않았다)
 */
async function refetchToolsets(queryClient: QueryClient): Promise<void> {
  try {
    await queryClient.fetchQuery({ ...toolsetsQuery, staleTime: 0 });
  } catch (error) {
    console.warn('[sources] toolsets refetch after delete failed', error);
  }
}

export function useConnectSource() {
  const queryClient = useQueryClient();
  return useMutation({
    // 본문에 인증값이 있다. 마법사 틀이 늘 붙어 있어 결과(data · variables)는 그대로 읽힌다
    gcTime: SECRET_MUTATION_GC_TIME,
    mutationFn: ({ body }: ConnectSourceVars) => api.post<ConnectSourceResult>(CONNECT_PATH, trimmedConnectBody(body)),
    onSuccess: ({ source, tools }, { attemptId }) => {
      addConnected(queryClient, source, tools);
      if (!isWizardShowing(attemptId)) toast(SOURCES.toast.connected(source.name, tools.length));
    },
    onError: (error, { attemptId }) => {
      if (!isWizardShowing(attemptId)) toast.warn(SOURCES.toast.connectFailed(error.message));
    },
  });
}

export function useReauthSource() {
  const queryClient = useQueryClient();
  return useMutation({
    // 본문이 인증값이다. 모달 칸(LayerHost)이 붙어 있는 동안은 결과가 남는다
    gcTime: SECRET_MUTATION_GC_TIME,
    mutationFn: ({ sourceId, auth }: ReauthSourceVars) => {
      const body: ReauthBody = { auth };
      return api.post<Source>(reauthPath(sourceId), body);
    },
    onSuccess: (source, { sourceId }) => {
      mergeSource(queryClient, sourceId, source);
      closeModalIf({ kind: 'reauth', sourceId });
      toast(SOURCES.toast.reauthSaved(source.name));
    },
    onError: (error) => {
      toast.warn(error.message);
    },
  });
}

export function useDeleteSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId }: DeleteSourceVars) => api.del<DeletedResult>(sourcePath(sourceId)),
    onSuccess: async (_result, { sourceId, name }) => {
      clearDrafts(sourceToolIds(queryClient, sourceId));
      removeSource(queryClient, sourceId);
      await refetchToolsets(queryClient);
      closeModalIf({ kind: 'deleteSource', sourceId });
      toast(SOURCES.toast.deleted(name));
    },
    onError: (error) => {
      toast.warn(error.message);
    },
  });
}

export type RereadSourceVars = Readonly<{ sourceId: string }>;

export function useRereadSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId }: RereadSourceVars) => api.post<RereadResponse>(rereadPath(sourceId)),
    onSuccess: ({ source, tools, added, drifted }, { sourceId }) => {
      const staleIds = sourceToolIds(queryClient, sourceId);
      mergeSource(queryClient, sourceId, source);
      replaceSourceTools(queryClient, sourceId, tools);
      clearDrafts([...staleIds, ...tools.map((t) => t.id)]);
      const message = STUDIO.toast.reread(added.length, drifted.length);
      if (drifted.length > 0) toast.warn(message);
      else toast(message);
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: keys.sources() });
      toast.warn(error.message);
    },
  });
}
