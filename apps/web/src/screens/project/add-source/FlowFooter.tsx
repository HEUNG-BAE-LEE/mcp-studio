// apps/web/src/screens/project/add-source/FlowFooter.tsx — 하단 바: 단계 · 완료 · 체인별 버튼. 보내는 중엔 이전 · 나가기 잠김 · 일부만 끝남은 닫기
import { Button } from '@/ui';
import { ADD_SOURCE } from '../../../copy/addSource';
import type { RunPhase } from './model';
import type { FlowState } from './useAddSource';
import styles from './flow.module.css';

type Props = {
  state: FlowState;
  phase: RunPhase;
  /** 체인 대상(첫 성공 소스)이 있다 */
  canChain: boolean;
  submitting: boolean;
  onBack: () => void;
  onExit: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onClose: () => void;
  onChain: () => void;
  /** 발 note id — 비활성 주 액션이 가리킨다 */
  noteId: string;
};
const F = ADD_SOURCE.footer;
const N = ADD_SOURCE.next;

/** 주 액션이 비활성인 이유(발 note). 없으면 undefined */
export function footNoteOf(state: FlowState, submitting: boolean): string | undefined {
  if (state.step === 'type' && !state.type) return ADD_SOURCE.blocked.type;
  if (state.step === 'connect' && state.basket.length === 0 && !submitting)
    return ADD_SOURCE.blocked.connect;
  return undefined;
}

function ExitButton({ disabled, onExit }: { disabled?: boolean; onExit: () => void }) {
  return (
    <Button variant="danger" size="lg" disabled={disabled} onClick={onExit}>
      {F.exit}
    </Button>
  );
}

function ConnectFooter({ state, submitting, onBack, onExit, onSubmit, noteId }: Props) {
  const n = state.basket.length;
  return (
    <>
      <Button variant="outline" size="lg" disabled={submitting} onClick={onBack}>
        {F.back}
      </Button>
      <ExitButton disabled={submitting} onExit={onExit} />
      <Button
        variant="primary"
        size="lg"
        className={styles.push}
        disabled={n === 0}
        aria-describedby={n === 0 ? noteId : undefined}
        loading={submitting}
        onClick={onSubmit}
      >
        {submitting ? N.submitting : N.connect(n)}
      </Button>
    </>
  );
}

/** ③ 끝남: 모두 완료면 돌아가기 · 체인, 일부만 끝남이면 `닫기` · 체인은 첫 성공이 있을 때만 */
function SettledFooter({ state, phase, canChain, onClose, onChain }: Props) {
  const isPartial = phase === 'partial';
  if (state.chain && canChain)
    return (
      <>
        <Button variant="outline" size="lg" className={styles.push} onClick={onClose}>
          {isPartial ? F.close : F.doneBack}
        </Button>
        <Button variant="primary" size="lg" onClick={onChain}>
          {N.chain}
        </Button>
      </>
    );
  return (
    <Button variant="primary" size="lg" className={styles.push} onClick={onClose}>
      {isPartial ? F.close : N.back}
    </Button>
  );
}

export function FlowFooter(props: Props) {
  const { state, phase, onExit, onNext, onClose, noteId } = props;
  if (state.step === 'type')
    return (
      <>
        <ExitButton onExit={onExit} />
        <Button
          variant="primary"
          size="lg"
          className={styles.push}
          disabled={!state.type}
          aria-describedby={!state.type ? noteId : undefined}
          onClick={onNext}
        >
          {N.type}
        </Button>
      </>
    );
  if (state.step === 'connect') return <ConnectFooter {...props} />;
  if (phase === 'running')
    return (
      <>
        <ExitButton onExit={onExit} />
        <Button variant="outline" size="lg" className={styles.push} onClick={onClose}>
          {N.running}
        </Button>
      </>
    );
  return <SettledFooter {...props} />;
}
