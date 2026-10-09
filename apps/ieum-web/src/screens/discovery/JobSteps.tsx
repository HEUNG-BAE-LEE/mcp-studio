// JobSteps — 탐색 작업 단계 줄 다섯 칸(옛 dStepper — js/menu/discovery.js:178-181). 실시간 · 종료 · 결과 세 모습이 맨 위에 같이 쓴다
// 칸마다 대기(번호) · 진행(후광) · 끝(체크) · 안 함("안 함" 작게 · 흐림) · 실패("실패" · 위험색). 모르는 단계 값은 대기(번호)로 그린다
import type { JobStage } from '../../api/types';
import { STAGE_KEYS, stageStateOf } from '../../app/discovery/jobScreen';
import { DISCOVERY } from '../../copy/discovery';
import { StepIndicator, type JobStep } from '@/ui';
import styles from './JobSteps.module.css';

type JobStepState = JobStep['state'];
const KNOWN_STATES: ReadonlySet<string> = new Set<JobStepState>(['wait', 'run', 'done', 'skip', 'fail']);
const isKnownState = (state: string): state is JobStepState => KNOWN_STATES.has(state);

const noteOf = (state: JobStepState): string | undefined => {
  if (state === 'skip') return DISCOVERY.stageState.skip;
  return state === 'fail' ? DISCOVERY.stageState.fail : undefined;
};

const stepsOf = (stage: JobStage): readonly JobStep[] =>
  STAGE_KEYS.map((key) => {
    const raw = stageStateOf(stage, key);
    const state: JobStepState = isKnownState(raw) ? raw : 'wait';
    return { label: DISCOVERY.stages[key], state, note: noteOf(state) };
  });

export function JobSteps({ stage }: Readonly<{ stage: JobStage }>) {
  return <StepIndicator variant="job" steps={stepsOf(stage)} className={styles.root} />;
}
