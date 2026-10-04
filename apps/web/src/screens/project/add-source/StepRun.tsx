// apps/web/src/screens/project/add-source/StepRun.tsx — ③ 읽어오기: 전체 진행(막대 · 로그) · 완료 상자(합계 · 일부만 끝남) + 연결한 소스 항목별 진행
import { useId } from 'react';
import { LogView, ProgressBar, SectionHead, Tag } from '@/ui';
import type { RunTrack, RunTracks } from '../../../api/realtime';
import { ADD_SOURCE, outputLabel } from '../../../copy/addSource';
import { formatCount, formatPercentInt } from '../../../copy/format';
import type { RunOutput } from '../../../platform/events';
import { PanelFoot } from './Basket';
import {
  logCount,
  outputTotals,
  overallPercent,
  subOf,
  titleOf,
  type BasketItem,
  type RunPhase,
} from './model';
import { createdIdsOf, type FlowState } from './useAddSource';
import styles from './flow.module.css';

const R = ADD_SOURCE.run;
/** 로그 최소 높이 — 내용 110 + 위아래 padding 12×2(LogView는 border-box) */
const RUN_LOG_MIN_HEIGHT = 134;
const SHOWN_OUTPUTS = 2;
const RUN_TITLE: Readonly<Record<RunPhase, string>> = {
  running: R.running,
  done: R.done,
  partial: R.settled,
};
const outputText = (o: RunOutput) => `${outputLabel(o.code)} ${formatCount(o.count)}`;
const stateOf = (track?: RunTrack) =>
  track?.result === 'done'
    ? 'done'
    : track?.result === 'failed' || track?.result === 'cancelled'
      ? 'failed'
      : (track?.percent ?? 0) > 0
        ? 'reading'
        : 'waiting';

function RunItem({ item, track }: { item: BasketItem; track?: RunTrack }) {
  const state = stateOf(track);
  const title = titleOf(item);
  return (
    <div className={styles.runItem}>
      <div className={styles.cardRow}>
        <span className={styles.cardTitle}>{title}</span>
        <Tag>{ADD_SOURCE.types[item.type].tag}</Tag>
        <span className={styles.runState} data-state={state}>
          {R.state[state]}
        </span>
      </div>
      <span className={styles.cardSub}>{subOf(item)}</span>
      {state === 'done' ? (
        <div className={styles.outputs}>
          {(track?.outputs ?? []).slice(0, SHOWN_OUTPUTS).map((o) => (
            <Tag key={o.code}>{outputText(o)}</Tag>
          ))}
        </div>
      ) : null}
      <ProgressBar value={track?.percent ?? 0} size="sm" aria-label={R.item(title)} />
    </div>
  );
}

type OverallProps = { phase: RunPhase; count: number; percent: number };
function RunOverall({ phase, count, percent }: OverallProps) {
  const titleId = useId();
  return (
    <section className={styles.runCard} aria-labelledby={titleId}>
      <SectionHead
        as="h3"
        title={RUN_TITLE[phase]}
        titleId={titleId}
        count={R.count(count)}
        note={formatPercentInt(percent)}
      />
      <ProgressBar value={percent} aria-label={R.overall} />
      <LogView
        variant="soft"
        minHeight={RUN_LOG_MIN_HEIGHT}
        lines={ADD_SOURCE.runLog(count).slice(0, logCount(percent))}
      />
    </section>
  );
}

type DoneProps = { head: string; tracks: RunTracks; ids: readonly string[] };
function DoneBox({ head, tracks, ids }: DoneProps) {
  const titleId = useId();
  return (
    <section className={styles.doneBox} aria-labelledby={titleId}>
      <SectionHead as="h3" title={head} titleId={titleId} />
      <div className={styles.totals}>
        {outputTotals(tracks, ids).map((o) => (
          <div key={o.code} className={styles.total}>
            <span className={styles.totalKey}>{outputLabel(o.code)}</span>
            <span className={styles.totalValue}>{formatCount(o.count)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const doneHeadOf = (phase: RunPhase, tracks: RunTracks, ids: readonly string[], n: number) =>
  phase === 'done'
    ? R.doneHead(n)
    : R.partialHead(ids.filter((id) => tracks[id]?.result === 'done').length, n);

type StepRunProps = { state: FlowState; tracks: RunTracks; phase: RunPhase };
export function StepRun({ state, tracks, phase }: StepRunProps) {
  const titleId = useId();
  if (!state.type) return null;
  const n = state.basket.length;
  const ids = createdIdsOf(state);
  return (
    <div className={styles.connect}>
      <div className={styles.runMain}>
        <RunOverall phase={phase} count={n} percent={overallPercent(tracks, ids)} />
        {phase !== 'running' ? (
          <DoneBox head={doneHeadOf(phase, tracks, ids, n)} tracks={tracks} ids={ids} />
        ) : null}
      </div>
      <aside className={styles.panel} aria-labelledby={titleId}>
        <SectionHead as="h3" title={R.title} titleId={titleId} count={n} />
        <div className={styles.runList}>
          {state.basket.map((item) => {
            const sourceId = state.created[item.id];
            return (
              <RunItem key={item.id} item={item} track={sourceId ? tracks[sourceId] : undefined} />
            );
          })}
        </div>
        <PanelFoot text={ADD_SOURCE.types[state.type].foot} />
      </aside>
    </div>
  );
}
