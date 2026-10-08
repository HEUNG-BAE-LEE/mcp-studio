// AnalysisStep — 4단계 분석(옛 wzBody step 4 — js/menu/sources.js:72-79)
// - 진행 중: 진행 막대(칸/5) + 다섯 줄 — 지난 줄 완료 · 지금 줄 도는 원 · 남은 줄 대기. 언제 다음 줄로 가는지는 useFakeProgress(가짜 진행)
// - 끝남: 막대 가득 · 모든 줄 완료 + 줄마다 요약 · 결과 세 칸(찾은 작업 · AI 도구 후보 · 쓰기 작업) · 검토 안내
// - 실패: 경고 상자 "연결하지 못했습니다." + 서버 문장(줄바꿈 그대로) · 이전 단계 안내. 막대 · 줄은 그리지 않는다
// 수는 연결 응답의 도구에서 센다 — 작업 = 도구 수, 파라미터 = 도구마다 파라미터 수의 합, 쓰기 = mode write인 도구 수
import type { ToolRecord } from '../../../api/types';
import { SOURCES } from '../../../copy/sources';
import { CardGrid, FailureBlock, HelpText, Notice, ProgressBar, ProgressList, type ProgressItem } from '@/ui';
import type { AnalysisView } from './wizardSteps';
import shared from './wizard.module.css';
import styles from './AnalysisStep.module.css';

const STEPS = SOURCES.analysis.steps;
const S = SOURCES.analysis.summary;
const R = SOURCES.analysis.result;

type Counts = Readonly<{ tools: number; params: number; writes: number }>;

const countsOf = (tools: readonly ToolRecord[]): Counts => ({
  tools: tools.length,
  params: tools.reduce((sum, t) => sum + t.params.length, 0),
  writes: tools.filter((t) => t.mode === 'write').length,
});

/** 줄마다 끝난 뒤 요약 — 단계 순서와 같다(옛 ems — :73) */
const summaryOf = (c: Counts): readonly string[] => [
  S.spec,
  S.ops(c.tools),
  S.params(c.params),
  S.descs(c.tools),
  S.writes(c.writes),
];

/** 진행 중 줄 — 지난 줄 done · 지금 줄 run · 남은 줄 wait(옛 :77) */
const runningItems = (index: number): readonly ProgressItem[] =>
  STEPS.map((label, i): ProgressItem => ({ label, state: i < index ? 'done' : i === index ? 'run' : 'wait' }));

const doneItems = (counts: Counts): readonly ProgressItem[] => {
  const notes = summaryOf(counts);
  return STEPS.map((label, i): ProgressItem => ({ label, state: 'done', note: notes[i] }));
};

type ResultCellProps = Readonly<{ label: string; value: number; isWarn?: boolean }>;

function ResultCell({ label, value, isWarn = false }: ResultCellProps) {
  return (
    <div className={styles.result}>
      <span className={styles.resultLabel}>{label}</span>
      <b className={styles.resultValue} data-tone={isWarn ? 'warn' : undefined}>
        {value}
      </b>
    </div>
  );
}

/** 끝난 뒤 — 결과 세 칸 + 검토 안내(옛 :78-79) */
function AnalysisResult({ counts }: Readonly<{ counts: Counts }>) {
  return (
    <>
      <CardGrid columns={3} collapseAt={760} className={styles.results}>
        <ResultCell label={R.found} value={counts.tools} />
        <ResultCell label={R.candidates} value={counts.tools} />
        <ResultCell label={R.writes} value={counts.writes} isWarn />
      </CardGrid>
      <Notice>
        {SOURCES.analysis.reviewPre}
        <b>{SOURCES.analysis.reviewStrong}</b>
        {SOURCES.analysis.reviewPost}
      </Notice>
    </>
  );
}

export type AnalysisStepProps = Readonly<{
  analysis: AnalysisView;
  /** 가짜 진행의 지금 줄(0부터) — 진행 중에만 쓴다 */
  progressIndex: number;
}>;

export function AnalysisStep({ analysis, progressIndex }: AnalysisStepProps) {
  if (analysis.kind === 'failed') {
    return (
      <>
        <FailureBlock tone="warn" title={SOURCES.analysis.failTitle} message={analysis.message} />
        <HelpText className={shared.hint}>{SOURCES.analysis.failHint}</HelpText>
      </>
    );
  }
  const counts = analysis.kind === 'done' ? countsOf(analysis.result.tools) : null;
  return (
    <>
      <ProgressBar
        variant="progress"
        value={counts ? 1 : progressIndex / STEPS.length}
        className={styles.bar}
      />
      <ProgressList items={counts ? doneItems(counts) : runningItems(progressIndex)} className={styles.list} />
      {counts ? <AnalysisResult counts={counts} /> : null}
    </>
  );
}
