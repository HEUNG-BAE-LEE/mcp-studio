// 카탈로그 ProgressList 절 — 줄 상태(wait · run · done) × note 유무. 크기 단계는 없다(원 22는 고유 치수).
// 진행 연출은 쓰는 곳이라 여기서는 받은 상태만 늘어놓는다. 연결 분석처럼 ProgressBar를 위에 함께 둔 자리도 보인다
import { ProgressBar, ProgressList, type ProgressItem } from '../../ui';
import catalog from './catalog.module.css';

const LABELS = ['명세 읽기', '작업 목록 추출', '파라미터 형식 분석', 'AI 설명 초안 작성', '쓰기, 민감 작업 분류'] as const;
const NOTES = ['명세 1건', '작업 12개', '파라미터 48개', '설명 12개', '쓰기 작업 3개'] as const;

/** 진행 중인 줄 순번 앞은 done, 그 줄은 run, 뒤는 wait */
const runningAt = (run: number): readonly ProgressItem[] =>
  LABELS.map((label, index) => {
    const state: ProgressItem['state'] = index < run ? 'done' : index === run ? 'run' : 'wait';
    return { label, state };
  });

const ALL_DONE: readonly ProgressItem[] = LABELS.map((label, index) => ({ label, state: 'done', note: NOTES[index] }));

const ALL_WAIT: readonly ProgressItem[] = LABELS.map((label) => ({ label, state: 'wait' }));

const RUN_AT = 2;

export function ProgressListSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        위에서 아래로 진행하는 작업 줄. 목록은 &lt;ol&gt;이고 run 줄에 aria-current=&quot;step&quot;. run은 원 자리에 Spinner lg, done은 --primary
        필 + check, wait은 빈 테다. note는 오른쪽 작은 요약이다.
      </p>
      <h3 className={catalog.heading}>wait · run · done</h3>
      <div className={catalog.frame}>
        <ProgressList items={runningAt(RUN_AT)} />
      </div>
      <h3 className={catalog.heading}>모두 wait</h3>
      <div className={catalog.frame}>
        <ProgressList items={ALL_WAIT} />
      </div>
      <h3 className={catalog.heading}>모두 done + note</h3>
      <div className={catalog.frame}>
        <ProgressList items={ALL_DONE} />
      </div>
      <h3 className={catalog.heading}>ProgressBar(progress)와 함께 — 연결 분석 자리</h3>
      <div className={catalog.frame}>
        <div className={catalog.stack}>
          <ProgressBar variant="progress" value={RUN_AT / LABELS.length} />
          <ProgressList items={runningAt(RUN_AT)} />
        </div>
      </div>
    </div>
  );
}
