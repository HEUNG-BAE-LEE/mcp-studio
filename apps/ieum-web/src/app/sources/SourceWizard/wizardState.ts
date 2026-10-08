// 연결 마법사 상태와 바꾸기 — 순수 함수 · 불변(받은 상태는 고치지 않고 새로 만든다). 옛 S.wz(js/menu/sources.js:46-50)와 그 동작(:153-196)
// 시도(attemptId)마다 처음부터다 — 열 때마다 새로 만들고 닫으면 버린다(옛 wzOpen · closeDrawer — js/common/overlay.js:12).
// 입력은 글자마다 쌓이고 단계를 오가도 남는다. 모드를 바꿔도 이름 · 주소 · 파일 · 샘플 · 인증 값은 그대로다(옛 wzMode는 mode만 바꿨다)
// 탐색 모드의 입력(옛 w.d · w.ban — discWzInit)은 자동 탐색을 옮길 때 더한다
import type { ConnectSourceBody, GovApi, SourceCred } from '../../../api/types';
import { coerceAuthType, initialCred } from '../authOptions';

export type WizardState = Readonly<{
  /** 이 상태를 만든 시도 — 드로어 칸의 attemptId */
  attemptId: number;
  /** 1 연결 방식 · 2 명세 불러오기 · 3 인증 · 4 분석 */
  step: number;
  /** 고른 연결 방식(서버 wizard.modes의 v) */
  mode: string;
  name: string;
  /** 명세 URL */
  url: string;
  /** 서버 주소 */
  base: string;
  /** 올린 명세 파일 본문 · 파일 이름 — 비어 있으면 올리지 않은 것 */
  specText: string;
  fileName: string;
  /** 명세 파일을 읽어 낸 횟수 — 파일 상자 resetKey(성공할 때만 늘어 같은 파일을 다시 골라도 읽는다) */
  fileReads: number;
  sampleRequest: string;
  sampleResponse: string;
  /** 고른 공공데이터 API id — 목록이 비면 없다 */
  gov: string | undefined;
  cred: SourceCred;
  /** 분석을 시작한 횟수 — 가짜 진행을 처음부터 다시 세는 표지(옛 wzAnalyze가 w.an = 0) */
  runs: number;
}>;

/** 마법사 입력 중 글자 칸 하나로 고치는 것 */
export type WizardTextField = 'name' | 'url' | 'base' | 'sampleRequest' | 'sampleResponse';

export const FIRST_STEP = 1;
/** 분석 단계 — 들어가는 순간 연결 요청을 보낸다 */
export const ANALYSIS_STEP = 4;
const AUTH_STEP = 3;
/** 열 때 고른 연결 방식(옛 :47) */
export const DEFAULT_MODE = 'rest';

/** 새 시도의 처음 상태 — 1단계 · REST · 인증 없음(헤더 · X-API-KEY) · 공공데이터 첫 API(옛 :47-48) */
export function initialWizard(attemptId: number, govApis: readonly GovApi[]): WizardState {
  return {
    attemptId,
    step: FIRST_STEP,
    mode: DEFAULT_MODE,
    name: '',
    url: '',
    base: '',
    specText: '',
    fileName: '',
    fileReads: 0,
    sampleRequest: '',
    sampleResponse: '',
    gov: govApis[0]?.[0],
    cred: initialCred(),
    runs: 0,
  };
}

/** 연결 방식 카드를 고른다 — 다른 입력은 그대로(인증 방식은 3단계로 들어갈 때 맞춘다) */
export const selectMode = (state: WizardState, mode: string): WizardState => ({ ...state, mode });

export const changeText = (state: WizardState, field: WizardTextField, value: string): WizardState => ({
  ...state,
  [field]: value,
});

export const selectGov = (state: WizardState, gov: string): WizardState => ({ ...state, gov });

export const changeCred = (state: WizardState, cred: SourceCred): WizardState => ({ ...state, cred });

/** 파일 이름에서 마지막 확장자를 뺀다(옛 f.name.replace(/\.[^.]+$/, '')) */
const withoutExtension = (fileName: string): string => fileName.replace(/\.[^.]+$/, '');

/** 읽은 명세 파일을 둔다. 시스템 이름이 비었으면 파일 이름(확장자 뺌)으로 채운다(옛 :194) */
export function loadSpecFile(state: WizardState, fileName: string, specText: string): WizardState {
  return {
    ...state,
    specText,
    fileName,
    name: state.name === '' ? withoutExtension(fileName) : state.name,
    fileReads: state.fileReads + 1,
  };
}

/**
 * 다음 단계로. 인증 단계로 들어갈 때 그 모드에 없는 인증 방식을 첫 선택지로 맞추고(옛은 인증 칸을 그릴 때 — :87),
 * 분석 단계로 들어갈 때 진행을 처음부터 센다. 단계 검증은 부르는 쪽이 먼저 한다(wizardSteps validateStep)
 */
export function toNextStep(state: WizardState): WizardState {
  if (state.step >= ANALYSIS_STEP) return state;
  const step = state.step + 1;
  if (step === AUTH_STEP) return { ...state, step, cred: coerceAuthType(state.mode, state.cred) };
  if (step === ANALYSIS_STEP) return { ...state, step, runs: state.runs + 1 };
  return { ...state, step };
}

/** 이전 단계로(옛 wzPrev — 분석 실패에서 3단계로 돌아가면 다시 시작할 수 있다) */
export const toPrevStep = (state: WizardState): WizardState =>
  state.step <= FIRST_STEP ? state : { ...state, step: state.step - 1 };

/**
 * 연결 요청 본문 — 모드와 상관없이 아홉 칸을 옛 순서 그대로(옛 :117-118). 앞뒤 공백은 요청 훅이 뺀다(useConnectSource).
 * 공공데이터 모드에도 앞 모드에서 넣은 이름이 그대로 간다 — 서버는 프리셋 이름보다 그 이름을 쓴다(옛 그대로)
 */
export const connectBodyOf = (state: WizardState): ConnectSourceBody => ({
  mode: state.mode,
  name: state.name,
  specUrl: state.url,
  specText: state.specText,
  base: state.base,
  gov: state.gov,
  auth: state.cred,
  sampleRequest: state.sampleRequest,
  sampleResponse: state.sampleResponse,
});
