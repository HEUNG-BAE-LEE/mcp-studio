// SourceWizard — 원본 시스템 연결 마법사 드로어의 내용(옛 wzOpen · wzBody · renderWz · wzFinish — js/menu/sources.js:44-128,
// 탐색 모드 renderDiscWz — js/menu/discovery.js:80-88). Drawer는 드로어 칸(app/LayerHost)이 하나만 그리고 이 파일은 그 Drawer에 넣을
// 머리 · 본문 · 발을 만든다(근거 드로어와 같은 칸이라 종류가 바뀌어도 Drawer는 그대로다).
// 틀: 머리 "원본 시스템" · "원본 시스템 연결" · 설명(모드별), 발 왼쪽 "n/4 단계"(탐색 "n/3 단계") · 오른쪽 도크 버튼. 본문: 단계 표시 + 단계 본문
// 단계: 1 연결 방식(ModeStep) → 2 명세 불러오기(SpecStep) → 3 인증(AuthStep) → 4 분석(AnalysisStep).
// 탐색 모드: 1 연결 방식 → 2 탐색 대상(DiscoverTargetStep) → 3 안전 설정(DiscoverSafetyStep) — 탐색 개요를 받는 동안 2단계 본문은 비우고 aria-busy,
// 받지 못하면 그 자리에 실패 상자(원문만). 상태 · 요청 · 동작은 useWizardSession(탐색은 discover/useDiscoverSlot)
//
// ── 쓰는 곳 계약(층 호스트 app/LayerHost가 쓴다) ──
// useSourceWizardDrawer(attemptId, isShowing) → Drawer prop(open · onOpenChange 빼고)
//   attemptId — 드로어 칸의 마지막 마법사 시도(app/layers). 바뀌면 처음 상태로 돌아가고 본문을 새로 마운트한다(본문 key = attemptId)
//   isShowing — 드로어 칸이 지금 이 시도를 보이는가. 닫혀도 호스트가 내용을 남겨 닫히며 미끄러지는 동안 보인다
// - contentKey를 넘기지 않는다 — 열린 채 다시 열어도(가두지 않아 Tab으로 "원본 시스템 연결"에 닿는다) 포커스 · 복귀 대상이
//   그대로다(옛 renderWz는 열린 드로어의 내용만 바꿨다 :110)
// - 단계를 옮기거나 다시 열면 본문을 맨 위에서 보인다(scrollResetKey = 시도:단계 — 옛은 내용을 통째로 바꿔 스크롤이 처음이었다)
// - 도크(옛 :107-109 — wizardSteps footerOf): 연결 요청은 3단계 "연결하고 분석 시작"을 누르는 순간 4단계로 넘어가며 보낸다.
//   그 요소가 4단계 "변환 스튜디오에서 검토"가 되고, 분석이 끝나기 전에는 결과를 기다리는 잠금(pending — 포커스가 남는다)이다.
//   탐색 모드 3단계 버튼은 "탐색 시작" · "탐색 예약"(시작 시각에 따라) + 재생 아이콘이고 승인 상자를 켜기 전에는 disabled다
// - 도크 포커스: 앞으로 가는 버튼은 단계를 옮겨도 같은 요소라 포커스가 이어진다. 그 버튼이 포커스를 가진 채 disabled가 되면(탐색 2단계
//   "다음" → 3단계 승인 전 "탐색 시작" · 탐색 개요를 기다리던 "다음"이 받지 못해 막힘) 단계 본문의 첫 컨트롤로, 없으면 단계 표시부터 감싼
//   본문 틀(tabIndex -1)로 옮긴다. "이전"으로 1단계에 와 이전 버튼이 사라지면 앞으로 가는 버튼으로 옮긴다(옛은 내용을 통째로 바꿔 어느 단계에서든
//   포커스를 잃었다)
// - Enter로 다음 단계로 가지 않는다(form이 아니다 — 옛도 Enter 처리가 없었다)
import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { DISCOVERY } from '../../../copy/discovery';
import { SOURCES } from '../../../copy/sources';
import { Button, ScreenState, StepIndicator, type DrawerProps } from '@/ui';
import { AnalysisStep } from './AnalysisStep';
import { AuthStep } from './AuthStep';
import { DiscoverSafetyStep } from './discover/DiscoverSafetyStep';
import { DiscoverTargetStep } from './discover/DiscoverTargetStep';
import { ModeStep } from './ModeStep';
import { SpecStep } from './SpecStep';
import { useWizardSession, type WizardSession } from './useWizardSession';
import { isDiscoverMode } from './wizardState';
import { footerOf, stepCountOf, stepLabelsOf, stepStateOf, type FooterAction, type FooterButton } from './wizardSteps';
import shared from './wizard.module.css';

export type WizardDrawerContent = Omit<DrawerProps, 'open' | 'onOpenChange'>;

const FOOTER_LABEL: Readonly<Record<Exclude<FooterAction, 'discover'>, string>> = {
  prev: SOURCES.wizard.prev,
  next: SOURCES.wizard.next,
  start: SOURCES.wizard.start,
  finish: SOURCES.wizard.toStudio,
};

type WizardFooterProps = Readonly<{
  buttons: readonly FooterButton[];
  session: WizardSession;
  /** 단계 표시 + 단계 본문을 감싼 틀 — 앞 버튼이 잠겨 포커스를 옮길 곳을 여기서 찾는다 */
  frameRef: RefObject<HTMLDivElement | null>;
}>;

// 단계 본문에서 포커스를 받을 입력 칸(잠긴 것 제외) — 버튼보다 먼저 본다. 첫 컨트롤이 칩 빼기 같은 버튼이면
// 앞 버튼을 Enter로 누른 키보드 사용자가 한 번 더 누르는 순간 금지어가 빠질 수 있어서다
const STEP_FIELD = ['input:not([type="hidden"]):not(:disabled)', 'select:not(:disabled)', 'textarea:not(:disabled)'].join(', ');
// 입력 칸이 없는 단계의 컨트롤
const STEP_CONTROL = ['a[href]', 'button:not(:disabled)'].join(', ');

/** 단계 본문의 첫 입력 칸, 없으면 첫 컨트롤, 그것도 없으면 틀(단계 표시부터) */
const stepFocusTargetOf = (frame: HTMLDivElement | null): HTMLElement | null =>
  frame?.querySelector<HTMLElement>(STEP_FIELD) ?? frame?.querySelector<HTMLElement>(STEP_CONTROL) ?? frame;

/** 버튼 글자 — 탐색 시작은 시작 시각이 "시각 예약"이면 "탐색 예약"(옛 :86,416) */
const labelOf = (action: FooterAction, session: WizardSession): string => {
  if (action !== 'discover') return FOOTER_LABEL[action];
  return session.state.discover?.when === 'at' ? DISCOVERY.wizard.schedule : DISCOVERY.wizard.start;
};

/**
 * 도크 버튼 — 드로어 발의 직접 자식으로 그린다(발 버튼 최소 폭은 Drawer가 준다).
 * 앞으로 가는 버튼(다음 · 시작 · 검토 · 탐색 시작)은 같은 key라 단계를 옮겨도 같은 요소에 남아 키보드 포커스가 이어진다.
 * 포커스가 빠지는 두 경우만 옮긴다(옛은 내용을 통째로 바꿔 어느 단계에서든 포커스를 잃었다):
 * - "이전"으로 1단계에 오면 이전 버튼이 사라져 포커스가 body로 빠진다 — 그때만 앞으로 가는 버튼으로
 * - 앞으로 가는 버튼이 포커스를 가진 채 disabled가 된다(탐색 3단계 승인 전 · 탐색 개요를 받지 못함) — 단계 본문의 첫 컨트롤(없으면 틀)로.
 *   잠긴 버튼의 포커스는 브라우저가 다음 그리기 때 body로 빼므로, 아직 버튼에 있을 때(그린 직후 — layout) 옮긴다
 */
function WizardFooter({ buttons, session, frameRef }: WizardFooterProps) {
  const { actions } = session;
  const forwardRef = useRef<HTMLButtonElement>(null);
  const prevPressed = useRef(false);
  useEffect(() => {
    if (!prevPressed.current) return;
    prevPressed.current = false;
    if (document.activeElement === document.body) forwardRef.current?.focus();
  });
  useLayoutEffect(() => {
    const forward = forwardRef.current;
    if (forward === null || !forward.disabled || document.activeElement !== forward) return;
    stepFocusTargetOf(frameRef.current)?.focus();
  });
  const onAction: Readonly<Record<FooterAction, () => void>> = {
    prev: () => {
      prevPressed.current = true;
      actions.prev();
    },
    next: actions.next,
    start: actions.next,
    finish: actions.finish,
    discover: session.discover.actions.start,
  };
  return (
    <>
      {buttons.map(({ action, pending, disabled }) => (
        <Button
          key={action === 'prev' ? 'prev' : 'forward'}
          ref={action === 'prev' ? undefined : forwardRef}
          variant={action === 'prev' ? 'default' : 'primary'}
          icon={action === 'discover' ? 'play' : undefined}
          pending={pending}
          disabled={disabled}
          onClick={onAction[action]}
        >
          {labelOf(action, session)}
        </Button>
      ))}
    </>
  );
}

/** 탐색 모드 2 · 3단계 — 탐색 개요를 받는 동안 비우고(aria-busy) 받지 못하면 그 자리 실패 상자 */
function DiscoverStepBody({ session }: Readonly<{ session: WizardSession }>): ReactNode {
  const { state, discover } = session;
  return (
    <ScreenState gate={discover.gate} scope="region">
      {(overview) => {
        if (state.discover === null) return null;
        return state.step === 2 ? (
          <DiscoverTargetStep discover={state.discover} overview={overview} actions={discover.actions} />
        ) : (
          <DiscoverSafetyStep discover={state.discover} actions={discover.actions} />
        );
      }}
    </ScreenState>
  );
}

/** 지금 단계의 본문(옛 wzBody). 시도마다 새로 마운트된다(쓰는 곳이 key = attemptId) */
function WizardStepBody({ session }: Readonly<{ session: WizardSession }>): ReactNode {
  const { state, actions } = session;
  if (state.step === 1) return <ModeStep modes={session.modes} value={state.mode} onSelect={actions.selectMode} />;
  if (isDiscoverMode(state.mode)) return <DiscoverStepBody session={session} />;
  switch (state.step) {
    case 2:
      return <SpecStep state={state} govApis={session.govApis} actions={actions} />;
    case 3:
      return <AuthStep mode={state.mode} cred={state.cred} onChange={actions.changeCred} />;
    default:
      return <AnalysisStep analysis={session.analysis} progressIndex={session.progressIndex} />;
  }
}

type WizardBodyProps = Readonly<{
  attemptId: number;
  session: WizardSession;
  /** 틀 — 도크가 잠긴 앞 버튼의 포커스를 옮길 곳을 찾는다 */
  frameRef: RefObject<HTMLDivElement | null>;
}>;

/**
 * 단계 표시 + 단계 본문. 둘을 감싼 틀은 모양이 없는 블록이고(바깥 여백 겹침도 감싸기 전과 같다) tabIndex -1이다 —
 * 단계 본문에 컨트롤이 없을 때(탐색 개요 실패 상자) 도크의 포커스를 받는 대체 자리다. Tab 순서에는 들지 않는다
 */
function WizardBody({ attemptId, session, frameRef }: WizardBodyProps) {
  const { step, mode } = session.state;
  return (
    <div ref={frameRef} tabIndex={-1}>
      <StepIndicator
        variant="wizard"
        steps={stepLabelsOf(mode).map((label, index) => ({ label, state: stepStateOf(index, step) }))}
        className={shared.steps}
      />
      <WizardStepBody key={attemptId} session={session} />
    </div>
  );
}

export function useSourceWizardDrawer(attemptId: number, isShowing: boolean): WizardDrawerContent {
  const session = useWizardSession(attemptId, isShowing);
  const frameRef = useRef<HTMLDivElement>(null);
  const { step, mode } = session.state;
  const isDiscover = isDiscoverMode(mode);
  const buttons = footerOf(session.state, session.analysis, session.discover.footer);
  return {
    overline: SOURCES.wizard.tag,
    title: SOURCES.wizard.title,
    description: isDiscover ? DISCOVERY.wizard.desc : SOURCES.wizard.desc,
    footerInfo: SOURCES.wizard.stepCount(step, stepCountOf(mode)),
    footer: <WizardFooter buttons={buttons} session={session} frameRef={frameRef} />,
    scrollResetKey: `${attemptId}:${step}`,
    children: <WizardBody attemptId={attemptId} session={session} frameRef={frameRef} />,
  };
}
