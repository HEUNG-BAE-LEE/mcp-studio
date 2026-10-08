// 카탈로그 StepIndicator 절 — 변형(wizard · job) × 단계 상태(wizard: todo · current · done / job: wait · run · done · skip · fail + note).
// 크기 단계는 없다(원 지름은 변형의 고유 치수). 760 이하에서 job은 사이 선을 숨긴다 — 폭은 카탈로그 뷰어가 바꾼다
import { StepIndicator, type JobStep, type WizardStep } from '../../ui';
import catalog from './catalog.module.css';

const WIZARD_LABELS = ['연결 방식', '명세 불러오기', '인증', '분석'] as const;

/** 현재 단계(1부터) 앞은 done, 그 단계는 current, 뒤는 todo — 옛 마법사와 같은 규칙 */
const wizardAt = (current: number): readonly WizardStep[] =>
  WIZARD_LABELS.map((label, index) => {
    const no = index + 1;
    const state: WizardStep['state'] = no < current ? 'done' : no === current ? 'current' : 'todo';
    return { label, state };
  });

const WIZARD_CASES: readonly number[] = [1, 2, 4];

const JOB_CASES: readonly { title: string; steps: readonly JobStep[] }[] = [
  {
    title: 'wait · run · done',
    steps: [
      { label: '소스 분석', state: 'done' },
      { label: '화면 탐색', state: 'done' },
      { label: '교차 확인', state: 'run' },
      { label: '호출 검증', state: 'wait' },
      { label: '결과 검토', state: 'wait' },
    ],
  },
  {
    title: 'skip · fail + note',
    steps: [
      { label: '소스 분석', state: 'skip', note: '안 함' },
      { label: '화면 탐색', state: 'done' },
      { label: '교차 확인', state: 'done' },
      { label: '호출 검증', state: 'fail', note: '실패' },
      { label: '결과 검토', state: 'wait' },
    ],
  },
  {
    title: '모두 done',
    steps: [
      { label: '소스 분석', state: 'done' },
      { label: '화면 탐색', state: 'done' },
      { label: '교차 확인', state: 'done' },
      { label: '호출 검증', state: 'done' },
      { label: '결과 검토', state: 'done' },
    ],
  },
];

export function StepIndicatorSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        가로 번호 원 단계. 단계는 &lt;ol&gt;이고 current · run 단계에 aria-current=&quot;step&quot;. 완료 ✓는 check 아이콘(장식)이다. 단계 사이 선은
        남은 폭을 나누고, 좁으면 줄을 바꾼다. 760 이하에서 job은 선을 숨기고 줄 간격을 넓힌다.
      </p>
      <h3 className={catalog.heading}>variant=wizard — 원 22 · todo · current · done</h3>
      {WIZARD_CASES.map((current) => (
        <div key={current} className={catalog.stack}>
          <span className={catalog.token}>{`${current}/${WIZARD_LABELS.length} 단계`}</span>
          <div className={catalog.frame}>
            <StepIndicator variant="wizard" steps={wizardAt(current)} />
          </div>
        </div>
      ))}
      <h3 className={catalog.heading}>variant=job — 원 24 · wait · run · done · skip · fail</h3>
      {JOB_CASES.map(({ title, steps }) => (
        <div key={title} className={catalog.stack}>
          <span className={catalog.token}>{title}</span>
          <div className={catalog.frame}>
            <StepIndicator variant="job" steps={steps} />
          </div>
        </div>
      ))}
    </div>
  );
}
