// TraceView — 이음 변환 과정 보기(traceHTML — js/common/convert.js:186-196, .trace · .step css/console.css:753-762,778-779,810).
// 단계 데이터는 앱 층 buildTraceSteps가 만들고 여기서는 그리기만 한다. 머리는 모든 단계가 title · who · msLabel만 그린다.
// 번호 원은 hold가 아닌 단계만 1부터 세고, hold는 번호 대신 user 아이콘이다. 입장 모션은 없다(옛 두 자리 모두 끈 채로 불렀다)
import { useId, type ReactNode } from 'react';
import type { TraceStep } from '@/app/trace/types';
import { CodeBlock } from '../CodeBlock';
import { Icon } from '../icons/Icon';
import { Notice } from '../Notice';
import { RuleChip } from '../RuleChip';
import styles from './TraceView.module.css';

/** drawer = 바깥 여백 없음(.drawer .trace — css/console.css:810), box = 상자 안 여백(.trace — :753) */
export type TraceContainer = 'drawer' | 'box';

export type TraceViewProps = {
  /** 단계 — 위에서 아래로 */
  steps: readonly TraceStep[];
  container: TraceContainer;
  /** hold 단계 본문(테스트 실행의 사용자 확인 상자) */
  holdSlot?: ReactNode;
};

/** 단계별 번호 — hold는 null이고 세지 않는다 */
const stepNumbers = (steps: readonly TraceStep[]): readonly (number | null)[] =>
  steps.reduce<{ count: number; numbers: readonly (number | null)[] }>(
    ({ count, numbers }, step) =>
      step.kind === 'hold'
        ? { count, numbers: [...numbers, null] }
        : { count: count + 1, numbers: [...numbers, count + 1] },
    { count: 0, numbers: [] },
  ).numbers;

function StepBody({ step, titleId, holdSlot }: { step: TraceStep; titleId: string; holdSlot: ReactNode }) {
  switch (step.kind) {
    case 'ai':
      return (
        <>
          <CodeBlock code={step.code} labelledBy={titleId} />
          <div className={styles.modelNote}>
            <Icon name="info" size="md-minus" className={styles.modelNoteIcon} />
            <span>{step.note}</span>
          </div>
        </>
      );
    case 'ieum':
      return (
        <>
          <div className={styles.rules}>
            {step.chips.map((chip, index) => (
              <RuleChip key={`${chip.rule ?? chip.label}-${index}`} label={chip.label} category={chip.category} description={chip.description} />
            ))}
          </div>
          <CodeBlock code={step.code} labelledBy={titleId} />
        </>
      );
    case 'src':
      return <CodeBlock code={step.code} labelledBy={titleId} />;
    case 'fail':
      return (
        <Notice tone="warn" icon="alert">
          {step.error}
        </Notice>
      );
    case 'hold':
      return holdSlot;
  }
}

export function TraceView({ steps, container, holdSlot }: TraceViewProps) {
  const baseId = useId();
  const numbers = stepNumbers(steps);
  return (
    <ol className={styles.root} data-container={container}>
      {steps.map((step, index) => {
        const titleId = `${baseId}-step-${index}`;
        const number = numbers[index];
        return (
          <li key={`${step.kind}-${index}`} className={styles.step} data-kind={step.kind}>
            <span className={styles.no}>{number ?? <Icon name="user" size="sm" stroke="bold" />}</span>
            <div className={styles.head}>
              <b id={titleId} className={styles.title}>
                {step.title}
              </b>
              <span className={styles.who}>{step.who}</span>
              {step.msLabel !== null ? <span className={styles.ms}>{step.msLabel}</span> : null}
            </div>
            <StepBody step={step} titleId={titleId} holdSlot={holdSlot} />
          </li>
        );
      })}
    </ol>
  );
}
