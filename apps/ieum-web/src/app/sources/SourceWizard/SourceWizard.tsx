// SourceWizard — 원본 시스템 연결 마법사 드로어(옛 wzOpen · wzBody · renderWz · wzFinish — js/menu/sources.js:44-128)
// 틀(Drawer): 머리 "원본 시스템" · "원본 시스템 연결" · 설명, 발 왼쪽 "n/4 단계" · 오른쪽 도크 버튼. 본문: 단계 표시 + 단계 본문
// 단계: 1 연결 방식(ModeStep) → 2 명세 불러오기(SpecStep) → 3 인증(AuthStep) → 4 분석(AnalysisStep). 상태 · 요청 · 동작은 useWizardSession
//
// ── 쓰는 곳 계약(층 호스트 app/LayerHost가 그린다) ──
// props attemptId · open · onOpenChange
//   attemptId — 드로어 칸의 시도(app/layers). 바뀌면 처음 상태로 돌아가고 본문을 새로 마운트한다(본문 key = attemptId)
//   open — 드로어 칸이 지금 이 시도를 보이는가. 닫혀도 호스트가 이 컴포넌트를 남겨 닫히며 미끄러지는 동안 내용이 보인다
//   onOpenChange(false) — ✕ · Esc · 가림막 · 메뉴 이동(closeAllLayers). 호스트가 closeLayer('drawer')로 칸을 비운다
// - 드로어는 늘 마운트된 채 open만 바뀐다 — 열린 채 다시 열어도(가두지 않아 Tab으로 "원본 시스템 연결"에 닿는다) 포커스 · 복귀 대상이
//   그대로다(옛 renderWz는 열린 드로어의 내용만 바꿨다 :110). 그래서 contentKey를 넘기지 않는다
// - 단계를 옮기거나 다시 열면 본문을 맨 위에서 보인다(scrollResetKey = 시도:단계 — 옛은 내용을 통째로 바꿔 스크롤이 처음이었다)
// - 도크(옛 :107-109 — wizardSteps footerOf): 연결 요청은 3단계 "연결하고 분석 시작"을 누르는 순간 4단계로 넘어가며 보낸다.
//   그 요소가 4단계 "변환 스튜디오에서 검토"가 되고, 분석이 끝나기 전에는 결과를 기다리는 잠금(pending — 포커스가 남는다)이다
// - Enter로 다음 단계로 가지 않는다(form이 아니다 — 옛도 Enter 처리가 없었다)
import { useEffect, useRef, type ReactNode } from 'react';
import { SOURCES } from '../../../copy/sources';
import { Button, Drawer, StepIndicator } from '@/ui';
import { AnalysisStep } from './AnalysisStep';
import { AuthStep } from './AuthStep';
import { ModeStep } from './ModeStep';
import { SpecStep } from './SpecStep';
import { useWizardSession, type WizardActions, type WizardSession } from './useWizardSession';
import { footerOf, STEP_COUNT, stepStateOf, type FooterAction, type FooterButton } from './wizardSteps';
import shared from './wizard.module.css';

export type SourceWizardProps = Readonly<{
  /** 드로어 칸의 시도 — 바뀌면 처음부터 */
  attemptId: number;
  /** 드로어 칸이 지금 이 시도를 보이는가 */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>;

const FOOTER_LABEL: Readonly<Record<FooterAction, string>> = {
  prev: SOURCES.wizard.prev,
  next: SOURCES.wizard.next,
  start: SOURCES.wizard.start,
  finish: SOURCES.wizard.toStudio,
};

type WizardFooterProps = Readonly<{ buttons: readonly FooterButton[]; actions: WizardActions }>;

/**
 * 도크 버튼 — 드로어 발의 직접 자식으로 그린다(발 버튼 최소 폭은 Drawer가 준다).
 * 앞으로 가는 버튼(다음 · 시작 · 검토)은 같은 key라 단계를 옮겨도 같은 요소에 남아 키보드 포커스가 이어진다.
 * "이전"으로 1단계에 오면 이전 버튼이 사라져 포커스가 body로 빠진다 — 그때만 앞으로 가는 버튼으로 옮긴다
 * (옛은 내용을 통째로 바꿔 어느 단계에서든 포커스를 잃었다)
 */
function WizardFooter({ buttons, actions }: WizardFooterProps) {
  const forwardRef = useRef<HTMLButtonElement>(null);
  const prevPressed = useRef(false);
  useEffect(() => {
    if (!prevPressed.current) return;
    prevPressed.current = false;
    if (document.activeElement === document.body) forwardRef.current?.focus();
  });
  const onAction: Readonly<Record<FooterAction, () => void>> = {
    prev: () => {
      prevPressed.current = true;
      actions.prev();
    },
    next: actions.next,
    start: actions.next,
    finish: actions.finish,
  };
  return (
    <>
      {buttons.map(({ action, pending }) => (
        <Button
          key={action === 'prev' ? 'prev' : 'forward'}
          ref={action === 'prev' ? undefined : forwardRef}
          variant={action === 'prev' ? 'default' : 'primary'}
          pending={pending}
          onClick={onAction[action]}
        >
          {FOOTER_LABEL[action]}
        </Button>
      ))}
    </>
  );
}

/** 지금 단계의 본문(옛 wzBody). 시도마다 새로 마운트된다(쓰는 곳이 key = attemptId) */
function WizardStepBody({ session }: Readonly<{ session: WizardSession }>): ReactNode {
  const { state, actions } = session;
  switch (state.step) {
    case 1:
      return <ModeStep modes={session.modes} value={state.mode} onSelect={actions.selectMode} />;
    case 2:
      return <SpecStep state={state} govApis={session.govApis} actions={actions} />;
    case 3:
      return <AuthStep mode={state.mode} cred={state.cred} onChange={actions.changeCred} />;
    default:
      return <AnalysisStep analysis={session.analysis} progressIndex={session.progressIndex} />;
  }
}

export function SourceWizard({ attemptId, open, onOpenChange }: SourceWizardProps) {
  const session = useWizardSession(attemptId, open);
  const { step } = session.state;
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      overline={SOURCES.wizard.tag}
      title={SOURCES.wizard.title}
      description={SOURCES.wizard.desc}
      footerInfo={SOURCES.wizard.stepCount(step, STEP_COUNT)}
      footer={<WizardFooter buttons={footerOf(step, session.analysis)} actions={session.actions} />}
      scrollResetKey={`${attemptId}:${step}`}
    >
      <StepIndicator
        variant="wizard"
        steps={SOURCES.wizard.steps.map((label, index) => ({ label, state: stepStateOf(index, step) }))}
        className={shared.steps}
      />
      <WizardStepBody key={attemptId} session={session} />
    </Drawer>
  );
}
