// StepIndicator — 가로로 늘어선 번호 원 단계. 연결 마법사(wizard — 이음 .wz-steps · .ws css/console.css:813-819)와
// 탐색 작업 단계(job — .dstep · .ds :938-947,981-982)는 같은 가로 단계라 한 부품 두 변형이다.
// 단계는 <ol>이고 current · run 단계는 aria-current="step"(옛은 클래스뿐 — 보이지 않는 ARIA 보강). 완료 아이콘은 장식이다.
// 단계 사이 선은 단계와 나란한 <li>다(옛 .ws-line · .ds-line이 단계 옆 형제 항목 — js/menu/sources.js:103 · discovery.js:179).
// 그래야 좁은 폭에서 단계만 다음 줄로 내려가고 선은 앞 줄 끝에 남는다. 선 <li>는 목록 항목으로 세지 않게 숨긴다
import { Fragment, type ReactNode } from 'react';
import { Icon } from '../icons/Icon';
import { cx } from '../lib/cx';
import styles from './StepIndicator.module.css';

type WizardStepState = 'todo' | 'current' | 'done';
type JobStepState = 'wait' | 'run' | 'done' | 'skip' | 'fail';

export type WizardStep = {
  label: ReactNode;
  state: WizardStepState;
};

export type JobStep = {
  label: ReactNode;
  state: JobStepState;
  /** 이름 뒤 작은 글(옛 "안 함" · "실패") — 글자는 쓰는 곳이 copy/에서 준다 */
  note?: ReactNode;
};

type CommonProps = {
  /** 배치(바깥 여백)만 — 마법사 아래 · 탐색 위 여백은 쓰는 곳 */
  className?: string;
};

export type StepIndicatorProps =
  | (CommonProps & { variant: 'wizard'; steps: readonly WizardStep[] })
  | (CommonProps & { variant: 'job'; steps: readonly JobStep[] });

export type StepIndicatorVariant = StepIndicatorProps['variant'];

// 원 안 글자 — 옛 dStepper(js/menu/discovery.js:180)의 건너뜀 · 실패 표시. 낱말이 아닌 기호라 copy/로 옮기지 않는다
const SKIP_MARK = '–';
const FAIL_MARK = '!';

type StepView = {
  label: ReactNode;
  state: WizardStepState | JobStepState;
  note?: ReactNode;
};

const isCurrent = (state: StepView['state']): boolean => state === 'current' || state === 'run';

/** 원 안 — 완료는 check 아이콘(옛 ✓ 글리프 — DESIGN 이식 기간 허용 차이), 건너뜀 "–", 실패 "!", 그 밖은 번호 */
function markOf(state: StepView['state'], index: number): ReactNode {
  if (state === 'done') return <Icon name="check" size="xs" stroke="heavy" />;
  if (state === 'skip') return SKIP_MARK;
  if (state === 'fail') return FAIL_MARK;
  return index + 1;
}

export function StepIndicator({ variant, steps, className }: StepIndicatorProps) {
  const views: readonly StepView[] = steps;
  return (
    <ol className={cx(styles.root, className)} data-variant={variant}>
      {views.map((step, index) => (
        // 단계는 순서 · 개수가 고정된 목록이라 순번을 키로 쓴다
        <Fragment key={index}>
          {index > 0 && <li className={styles.line} role="presentation" aria-hidden="true" />}
          <li
            className={styles.step}
            data-state={step.state}
            aria-current={isCurrent(step.state) ? 'step' : undefined}
          >
            <span className={styles.mark}>{markOf(step.state, index)}</span>
            {step.label}
            {step.note !== undefined && (
              <>
                {' '}
                <small className={styles.note}>{step.note}</small>
              </>
            )}
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
