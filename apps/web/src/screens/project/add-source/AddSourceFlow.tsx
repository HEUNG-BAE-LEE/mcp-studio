// apps/web/src/screens/project/add-source/AddSourceFlow.tsx — 소스 추가 흐름(단계 흐름 틀): 앱 프레임을 덮는 FlowOverlay · ①타입 ②담기 ③읽어오기 · 하단 바 · 나가기 확인 · 등록 거부 · 일부만 끝남
import { useId, useState } from 'react';
import { Button, Dialog, FlowOverlay, FlowStepHead, HelperPanel } from '@/ui';
import { useRunTracker } from '../../../api/realtime';
import { FailureBlock } from '../../../app/FailureBlock';
import { useFrameContainer } from '../../../app/frame';
import { ADD_SOURCE } from '../../../copy/addSource';
import { FlowFooter, footNoteOf } from './FlowFooter';
import { FlowGuide } from './FlowGuide';
import { StepConnect } from './StepConnect';
import { StepRun } from './StepRun';
import { StepType } from './StepType';
import { chainTargetOf, headingOf, runPhaseOf } from './model';
import { createdIdsOf, isDirty } from './useAddSource';
import { useFlowSubmit } from './useFlowSubmit';

type Props = { projectId: string; onClose: () => void; onChain: (sourceId: string) => void };

/** 부모가 열 때만 그린다 — 닫으면 상태가 사라진다 */
export function AddSourceFlow({ projectId, onClose, onChain }: Props) {
  const container = useFrameContainer();
  const { state, dispatch, submit, isSubmitting, blockError } = useFlowSubmit(projectId);
  const [confirming, setConfirming] = useState(false);
  const ids = createdIdsOf(state);
  const tracks = useRunTracker(projectId, ids);
  const phase = state.step === 'run' ? runPhaseOf(tracks, ids) : 'running';
  const chainTarget = chainTargetOf(tracks, ids);
  const heading = headingOf(state.step, state.type, phase);
  const noteId = useId();
  // 보내는 중엔 나가지 않는다 — 응답이 오기 전에 닫으면 만든 소스를 놓친다
  const requestExit = () => {
    if (isSubmitting) return;
    if (state.step === 'connect' && isDirty(state)) setConfirming(true);
    else onClose();
  };
  const chain = () => {
    if (chainTarget) onChain(chainTarget);
  };
  return (
    <>
      <FlowOverlay
        open
        onOpenChange={(open) => {
          if (!open) requestExit();
        }}
        container={container}
        title={ADD_SOURCE.title}
        heading={<FlowStepHead title={heading.title} description={heading.sub} />}
        note={footNoteOf(state, isSubmitting)}
        noteId={noteId}
        aside={
          <HelperPanel title={ADD_SOURCE.guide.title}>
            <FlowGuide step={state.step} />
          </HelperPanel>
        }
        footer={
          <FlowFooter
            state={state}
            phase={phase}
            canChain={chainTarget !== null}
            submitting={isSubmitting}
            onBack={() => dispatch({ kind: 'back' })}
            onExit={requestExit}
            onNext={() => dispatch({ kind: 'next' })}
            onSubmit={submit}
            onClose={onClose}
            onChain={chain}
            noteId={noteId}
          />
        }
      >
        {state.step === 'type' ? (
          <StepType selected={state.type} onPick={(type) => dispatch({ kind: 'pick', type })} />
        ) : null}
        {state.step === 'connect' ? <StepConnect state={state} dispatch={dispatch} /> : null}
        {state.step === 'run' ? <StepRun state={state} tracks={tracks} phase={phase} /> : null}
        {/* 실패 블록 자리 — 내용 열 끝(= 발 바로 위) */}
        <FailureBlock failure={blockError} />
      </FlowOverlay>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        container={container}
        title={ADD_SOURCE.exit.title}
        description={ADD_SOURCE.exit.description}
        actions={{
          cancel: <Button>{ADD_SOURCE.exit.cancel}</Button>,
          confirm: (
            <Button variant="danger" onClick={onClose}>
              {ADD_SOURCE.exit.confirm}
            </Button>
          ),
        }}
      />
    </>
  );
}
