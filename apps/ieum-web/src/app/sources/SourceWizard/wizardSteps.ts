// 연결 마법사 단계 규칙 — 고를 수 있는 모드 · 단계 표시 · 다음 단계 검증 · 도크 버튼(옛 js/menu/sources.js:44,55,97-111,154-161)
// 순수 함수만 둔다. 문구는 copy/sources · copy/discovery에서 고르고, 버튼을 그리는 일은 SourceWizard가 한다
//
// 모드 슬롯 — REST · SOAP · 공공데이터 · 호출 샘플은 4단계(단계 이름 SOURCES.wizard.steps), 자동 탐색(discover)은 3단계
// (연결 방식 · 탐색 대상 · 안전 설정 — DISCOVERY.wizard.steps, 옛 js/menu/discovery.js:80-88 · 검증 discWzCheck :89-102).
// 서버가 잠그는 카드(dis)는 옛 그대로 잠근다
import type { ConnectSourceResult, WizardMode } from '../../../api/types';
import { DISCOVERY } from '../../../copy/discovery';
import { SOURCES } from '../../../copy/sources';
import { checkTarget } from './discover/discoverCheck';
import { ANALYSIS_STEP, DISCOVER_LAST_STEP, isDiscoverMode, type WizardState } from './wizardState';

/** 고를 수 없는 카드인가 — 서버가 잠근 것(2차 개발 예정) */
export const isModeLocked = (mode: WizardMode): boolean => Boolean(mode.dis);

/** 단계 이름 — 모드마다 다르다(옛 WZ_STEPS · 탐색 steps — js/menu/sources.js:44 · js/menu/discovery.js:82) */
export const stepLabelsOf = (mode: string): readonly string[] =>
  isDiscoverMode(mode) ? DISCOVERY.wizard.steps : SOURCES.wizard.steps;

/** 단계 수(옛 "n/4 단계" · "n/3 단계"의 4 · 3) */
export const stepCountOf = (mode: string): number => stepLabelsOf(mode).length;

export type WizardStepState = 'todo' | 'current' | 'done';

/** 단계 표시 줄 — 지난 단계 · 지금 단계 · 남은 단계(옛 .ws.done · .ws.on — :103) */
export const stepStateOf = (index: number, step: number): WizardStepState => {
  const number = index + 1;
  if (number === step) return 'current';
  return number < step ? 'done' : 'todo';
};

/**
 * 다음 단계로 가도 되는가 — 안 되면 경고 토스트 문장(첫 실패 하나), 되면 null. 옛 wzNext(:156-158) 그대로:
 * 2단계에서만 본다 — 호출 샘플은 요청 샘플(공백만이면 빈 것), REST · SOAP는 명세 URL(공백만이면 빈 것)도 읽은 파일 본문도 없을 때.
 * 파일 이름이 아니라 읽은 본문을 본다 — 빈 파일을 올리면 "{파일} 올림"이어도 막힌다. 공공데이터 · 1 · 3단계는 검증하지 않는다.
 * 탐색 모드는 2단계에서 탐색 대상(checkTarget)을 본다 — 3단계는 시작 버튼이 checkSafety로 본다
 */
export function validateStep(state: WizardState): string | null {
  if (state.step !== 2) return null;
  if (isDiscoverMode(state.mode)) return state.discover === null ? null : checkTarget(state.discover);
  if (state.mode === 'sample' && !state.sampleRequest.trim()) return SOURCES.toast.needSample;
  const isSpecMode = state.mode === 'rest' || state.mode === 'soap';
  if (isSpecMode && !state.url.trim() && !state.specText) return SOURCES.toast.needSpec;
  return null;
}

/** 분석 단계의 모습 — 진행 중(가짜 진행) · 끝남(연결 응답) · 실패(서버 문장) */
export type AnalysisView =
  | Readonly<{ kind: 'running' }>
  | Readonly<{ kind: 'done'; result: ConnectSourceResult }>
  | Readonly<{ kind: 'failed'; message: string }>;

export const ANALYSIS_RUNNING: AnalysisView = Object.freeze({ kind: 'running' });

/** 도크 버튼 — prev 이전 · next 다음 · start 연결하고 분석 시작 · finish 변환 스튜디오에서 검토 · discover 탐색 시작(예약) */
export type FooterAction = 'prev' | 'next' | 'start' | 'finish' | 'discover';
/**
 * pending은 진행 중인 요청의 결과를 기다리는 버튼(분석이 끝나기 전의 finish · 탐색 개요를 받는 동안의 탐색 2단계 next ·
 * 시작 요청 중인 discover)이다 — 누름을 무시하지만 포커스는 남는다. 3단계 "연결하고 분석 시작"을 누른 그 요소가 이 버튼이 되므로,
 * native disabled면 포커스가 body로 빠져 끝난 뒤 Enter가 닿지 않는다. disabled는 조건이 안 맞아 못 누르는 것(승인 전의 탐색 시작 ·
 * 탐색 개요를 받지 못한 탐색 2단계 next — 옛 :86)
 */
export type FooterButton = Readonly<{ action: FooterAction; pending: boolean; disabled: boolean }>;

const button = (action: FooterAction, pending = false, disabled = false): FooterButton => ({ action, pending, disabled });

/** 탐색 모드 도크가 기다리는 것 — 탐색 개요 조회와 시작 요청 */
export type DiscoverFooterState = Readonly<{
  /** 탐색 개요 — 받는 중 · 받지 못함(영역 실패) · 받음 */
  overview: 'pending' | 'failed' | 'ready';
  /** 담당자 승인 상자를 켰는가 — 켜야 시작 버튼이 풀린다 */
  isApproved: boolean;
  /** 이 시도의 시작 요청이 진행 중인가 */
  isStarting: boolean;
}>;

/**
 * 탐색 모드 도크(옛 renderDiscWz :85-86): 1단계 다음 · 2단계 이전 + 다음 · 3단계 이전 + 탐색 시작(승인 전 disabled).
 * 2단계 다음은 탐색 개요를 받는 동안 결과를 기다리는 잠금, 받지 못했으면 막는다 — 탐색 입력의 처음 값을 정할 수 없다
 */
function discoverFooterOf(step: number, discover: DiscoverFooterState): readonly FooterButton[] {
  if (step >= DISCOVER_LAST_STEP) return [button('prev'), button('discover', discover.isStarting, !discover.isApproved)];
  if (step === 1) return [button('next')];
  return [button('prev'), button('next', discover.overview === 'pending', discover.overview === 'failed')];
}

/**
 * 도크 버튼(옛 renderWz :107-109): 1단계 다음 · 2단계 이전 + 다음 · 3단계 이전 + 연결하고 분석 시작 ·
 * 4단계 진행 중 변환 스튜디오에서 검토(누를 수 없음) · 4단계 끝남 같은 버튼(누름) · 4단계 실패 이전 하나. 4단계에는 실패가 아니면 이전이 없다.
 * 탐색 모드는 discoverFooterOf
 */
export function footerOf(
  state: Pick<WizardState, 'step' | 'mode'>,
  analysis: AnalysisView,
  discover: DiscoverFooterState,
): readonly FooterButton[] {
  const { step } = state;
  if (isDiscoverMode(state.mode)) return discoverFooterOf(step, discover);
  if (step === ANALYSIS_STEP) {
    if (analysis.kind === 'failed') return [button('prev')];
    return [button('finish', analysis.kind !== 'done')];
  }
  const forward = button(step === ANALYSIS_STEP - 1 ? 'start' : 'next');
  return step > 1 ? [button('prev'), forward] : [forward];
}
