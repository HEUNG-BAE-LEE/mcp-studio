// 연결 마법사 한 시도의 상태 · 연결 요청 · 가짜 진행 · 동작 — SourceWizard(드로어 틀)가 부른다(옛 js/menu/sources.js:46-50,112-128,152-196)
//
// 왜 시도마다 다시 마운트하는 본문이 아니라 틀에서 부르나: 도크 버튼(Drawer footer — 드로어 발의 직접 자식이어야 한다)이 단계와
// 연결 결과를 알아야 하는데, 드로어는 늘 마운트돼 있어야 한다(열린 채 다시 열어도 포커스 · 복귀 대상이 그대로 — 옛 renderWz는
// 열린 드로어의 내용만 바꿨다 :110). 그래서 시도가 바뀌는 일을 두 가지로 처리한다:
// - 상태: attemptId가 바뀌면 그리기 전에 처음 상태로 되돌린다(렌더 중 상태 맞추기 — 이전 시도의 입력이 한 번도 보이지 않는다)
// - 연결 요청: useConnectSource 인스턴스는 시도를 거쳐 남으므로 결과(data · error)는 그 요청의 variables.attemptId가 지금 시도일 때만 읽는다.
//   이전 시도의 요청은 끝까지 가고 그 결과는 요청 훅이 토스트로 알린다(isWizardShowing이 false — app/sources/useSourceMutations)
// 비동기로 끝나는 일(파일 읽기)은 끝났을 때 드로어 칸이 아직 이 시도를 보이는지 보고 둔다 — 옛은 닫혔으면 버리고, 다시 열었으면 새 마법사에 넣었다
// 탐색 모드(discover)는 슬롯(discover/useDiscoverSlot)이 맡는다 — 탐색 개요는 드로어가 이 시도를 보이고 탐색 모드일 때만 읽고(닫힌 마법사의
// 관찰자가 남아 메뉴 다시 받기 · 무효화에 끌려 받지 않게), 준비되면 그 시도의 탐색 입력을 한 번 만든다
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCachedDiscoveryOverview } from '../../../api/hooks/useDiscovery';
import { useSources } from '../../../api/hooks/useSources';
import type { GovApi, SourceCred, WizardMode } from '../../../api/types';
import { SOURCES } from '../../../copy/sources';
import { isWizardShowing } from '../../layers';
import { studioSrcLink, toolLink } from '../../studio/links';
import { toast } from '../../toast';
import { useConnectSource } from '../useSourceMutations';
import { useDiscoverSlot, type DiscoverSlot } from './discover/useDiscoverSlot';
import { readSpecFile } from './readSpecFile';
import { useFakeProgress } from './useFakeProgress';
import {
  ANALYSIS_STEP,
  changeCred,
  changeText,
  connectBodyOf,
  initialWizard,
  isDiscoverMode,
  loadSpecFile,
  selectGov,
  selectMode,
  toNextStep,
  toPrevStep,
  withDiscover,
  type WizardState,
  type WizardTextField,
} from './wizardState';
import { ANALYSIS_RUNNING, validateStep, type AnalysisView } from './wizardSteps';

export type WizardActions = Readonly<{
  selectMode: (mode: string) => void;
  changeText: (field: WizardTextField, value: string) => void;
  selectGov: (gov: string) => void;
  changeCred: (cred: SourceCred) => void;
  /** 명세 파일을 고름 — 10MB를 넘으면 경고 토스트, 아니면 읽어 둔 뒤 완료 토스트 */
  selectFile: (file: File) => void;
  /** 다음 · 연결하고 분석 시작 — 2단계 검증, 4단계로 들어가는 순간 연결 요청 한 번 */
  next: () => void;
  /** 이전 — 분석 실패에서 돌아가면 요청 결과를 비워 다시 시작할 수 있게 */
  prev: () => void;
  /** 변환 스튜디오에서 검토 — 새 원본 첫 도구(없으면 그 원본)로 이동 → 완료 토스트(드로어는 셸이 메뉴 이동 뒤 닫는다) */
  finish: () => void;
}>;

export type WizardSession = Readonly<{
  state: WizardState;
  /** 서버 wizard.modes(연결 방식 카드) */
  modes: readonly WizardMode[];
  /** 서버 wizard.govApis(공공데이터 API 목록) */
  govApis: readonly GovApi[];
  /** 분석 단계의 모습 — 4단계에서만 읽는다 */
  analysis: AnalysisView;
  /** 가짜 진행의 지금 칸(0부터) */
  progressIndex: number;
  actions: WizardActions;
  /** 탐색 모드 슬롯 — 탐색 개요 판정 · 도크가 기다리는 것 · 탐색 입력 동작 */
  discover: DiscoverSlot;
}>;

type ConnectMutation = ReturnType<typeof useConnectSource>;

const NO_MODES: readonly WizardMode[] = [];
const NO_GOV_APIS: readonly GovApi[] = [];
const LAST_PROGRESS_INDEX = SOURCES.analysis.steps.length - 1;

/** 이 시도의 연결 요청 결과 — 다른 시도의 요청이거나 아직 보내지 않았으면 진행 중으로 본다(4단계는 들어가는 순간 보낸다) */
function analysisOf(connect: ConnectMutation, attemptId: number): AnalysisView {
  if (connect.variables?.attemptId !== attemptId) return ANALYSIS_RUNNING;
  if (connect.isSuccess) return { kind: 'done', result: connect.data };
  if (connect.isError) return { kind: 'failed', message: connect.error.message };
  return ANALYSIS_RUNNING;
}

type AttemptState = Readonly<{
  state: WizardState;
  /** 받은 상태로 바꾼다(이 시도의 지금 상태에서 만든 값) */
  replace: (next: WizardState) => void;
  /** 이 시도의 상태만 바꾼다 — 그사이 새 시도로 바뀌었으면 두지 않는다 */
  update: (change: (prev: WizardState) => WizardState) => void;
}>;

/** 시도의 상태 — attemptId가 바뀌면 그리기 전에 처음 상태로 되돌린다(이전 시도의 입력이 한 번도 보이지 않게) */
function useAttemptState(attemptId: number, govApis: readonly GovApi[]): AttemptState {
  const [stored, setStored] = useState(() => initialWizard(attemptId, govApis));
  const state = stored.attemptId === attemptId ? stored : initialWizard(attemptId, govApis);
  if (state !== stored) setStored(state);
  const update = (change: (prev: WizardState) => WizardState) =>
    setStored((prev) => (prev.attemptId === attemptId ? change(prev) : prev));
  return { state, replace: setStored, update };
}

/**
 * 명세 파일 고르기(옛 wzFile — :190-196). 10MB를 넘으면 경고 토스트만. 읽기가 끝났을 때 드로어가 이 시도를 더는 보이지 않으면 버린다
 * (옛은 닫혔으면 버렸고, 다시 열었으면 새 마법사에 넣었다 — 새 시도에는 넣지 않는다)
 */
const fileSelectorOf =
  (attemptId: number, update: AttemptState['update']) =>
  (file: File): void => {
    void readSpecFile(file).then((read) => {
      if (read.kind === 'tooBig') {
        toast.warn(SOURCES.toast.fileTooBig);
        return;
      }
      if (read.kind !== 'read' || !isWizardShowing(attemptId)) return;
      update((prev) => loadSpecFile(prev, read.fileName, read.specText));
      toast(SOURCES.toast.fileLoaded(read.fileName));
    });
  };

/**
 * 변환 스튜디오에서 검토(옛 wzFinish — :122-128): 새 원본의 첫 도구(없으면 그 원본의 빈 스튜디오)로 이동 → 완료 토스트.
 * 드로어는 여기서 닫지 않는다 — 스튜디오는 다른 메뉴라 셸이 새 화면을 그린 뒤 열린 층을 닫고(closeAllLayers), 그때 연 버튼이
 * 이미 사라져 포커스가 새 화면의 대체 자리(제목 → 본문)로 간다. 먼저 닫으면 포커스가 사라질 툴바 버튼으로 돌아갔다가 body로 빠진다.
 * 이름 · 도구는 쿼리 캐시가 아니라 이 연결 응답에서 읽는다(옛도 응답 r을 그대로 썼다). 맨 위 스크롤은 하지 않는다 —
 * 첫 경로 조각이 바뀌면 RootLayout이 한다
 */
function useFinish(analysis: AnalysisView): () => void {
  const navigate = useNavigate();
  return () => {
    if (analysis.kind !== 'done') return;
    const { source, tools } = analysis.result;
    const [first] = tools;
    const link = first ? toolLink(first.id, { src: source.id }) : studioSrcLink(source.id);
    void navigate(link.to, { state: link.state });
    toast(SOURCES.toast.connected(source.name, tools.length));
  };
}

/**
 * attemptId — 드로어 칸이 보이는(또는 닫히며 남긴) 시도. isShowing — 드로어 칸이 지금 이 시도를 보이는가(닫히면 false).
 * 서버 wizard 값은 셸이 이미 받아 둔 GET /sources/ 캐시에서 읽는다
 */
export function useWizardSession(attemptId: number, isShowing: boolean): WizardSession {
  const wizard = useSources().data?.wizard;
  const govApis = wizard?.govApis ?? NO_GOV_APIS;
  const attempt = useAttemptState(attemptId, govApis);
  const { replace, update } = attempt;
  const overview = useCachedDiscoveryOverview(isShowing && isDiscoverMode(attempt.state.mode));
  // 탐색 모드인데 탐색 입력이 아직 없고 개요가 준비됐으면 지금 만든다(그리기 전에 — 빈 입력이 한 번도 보이지 않게)
  const state = withDiscover(attempt.state, overview.data);
  if (state !== attempt.state) replace(state);
  const discover = useDiscoverSlot({ attemptId, state, update, overview });

  const connect = useConnectSource();
  const analysis = analysisOf(connect, attemptId);
  const isAnalyzing = isShowing && state.step === ANALYSIS_STEP && analysis.kind === 'running';
  const progressIndex = useFakeProgress(`${attemptId}:${state.runs}`, isAnalyzing, LAST_PROGRESS_INDEX);
  const finish = useFinish(analysis);

  // 다음 · 연결하고 분석 시작(옛 wzNext — :154-160): 2단계 검증의 첫 실패만 경고 토스트, 4단계로 들어가는 순간 연결 요청 한 번.
  // 탐색 모드 2단계는 탐색 입력이 준비돼야 간다(도크 버튼도 잠겨 있다)
  const next = () => {
    if (state.step >= ANALYSIS_STEP) return;
    if (isDiscoverMode(state.mode) && state.step === 2 && state.discover === null) return;
    const problem = validateStep(state);
    if (problem !== null) {
      toast.warn(problem);
      return;
    }
    const nextState = toNextStep(state);
    replace(nextState);
    if (nextState.step === ANALYSIS_STEP) connect.mutate({ attemptId, body: connectBodyOf(nextState) });
  };

  // 이전(옛 wzPrev — :161): 분석 실패에서 돌아가면 요청 결과를 비운다 — 다시 시작하면 진행도 처음부터
  const prev = () => {
    if (state.step === ANALYSIS_STEP && analysis.kind === 'failed') connect.reset();
    update(toPrevStep);
  };

  const actions: WizardActions = {
    selectMode: (mode) => update((s) => selectMode(s, mode)),
    changeText: (field, value) => update((s) => changeText(s, field, value)),
    selectGov: (gov) => update((s) => selectGov(s, gov)),
    changeCred: (cred) => update((s) => changeCred(s, cred)),
    selectFile: fileSelectorOf(attemptId, update),
    next,
    prev,
    finish,
  };

  return { state, modes: wizard?.modes ?? NO_MODES, govApis, analysis, progressIndex, actions, discover };
}
