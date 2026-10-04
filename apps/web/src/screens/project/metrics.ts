// apps/web/src/screens/project/metrics.ts — 요약 밴드 8칸 뷰모델. 소스가 없으면 사유(`집계 전`) 카드, 서버가 값 없음(null)을 준 칸은 그 칸만 사유. P95 눈금 = 목표 × 1.4
import type { MetricCardProps, MetricLegendItem, MetricSegment } from '@/ui';
import type { ProjectSummary } from '../../api/types';
import { formatCount, formatLatency, formatLatencyParts } from '../../copy/format';
import { PROJECT } from '../../copy/project';

type MetricCardModel = Readonly<
  Pick<
    MetricCardProps,
    'label' | 'value' | 'unit' | 'tail' | 'valueTone' | 'segments' | 'mark' | 'legend'
  > & {
    key: string;
  }
>;

const M = PROJECT.metrics;
const PERCENT = 100;
/** 눈금 = 목표 × 1.4 → 현재 round(180/280×100)=64 · 목표 표시 71% */
const LATENCY_SCALE = 1.4;
/** `flex: n || 0.001` — 0인 구간도 자리(gap)를 남긴다(도달성 거절 · 커넥터 발행) */
const HAIR = 0.001;
const sliver = (n: number) => n || HAIR;
const seg = (weight: number, tone: MetricSegment['tone']): MetricSegment => ({ weight, tone });
const item = (
  label: string,
  value: number | string,
  tone: MetricLegendItem['tone'],
  swatch?: MetricLegendItem['swatch'],
): MetricLegendItem => ({
  label,
  value: typeof value === 'number' ? String(value) : value,
  tone,
  ...(swatch ? { swatch } : {}),
});
const ofTotal = (total: number) => `/ ${total}`;

const LABELS = [
  ['gates', M.gates.label],
  ['reachability', M.reachability.label],
  ['calls', M.calls.label],
  ['latency', M.latency.label],
  ['tools', M.tools.label],
  ['objectTypes', M.objectTypes.label],
  ['connectors', M.connectors.label],
  ['freshness', M.freshness.label],
] as const;

/** 값이 없는 칸 — 값 자리에 사유(faint) · 빈 막대 · 범례 없음(MetricCard `value`) */
const noValue = (key: string, label: string, reason: string): MetricCardModel => ({
  key,
  label,
  value: reason,
  valueTone: 'faint',
  segments: [seg(1, 'empty')],
  legend: [],
});

function latencyCard({ p95Ms, targetMs }: ProjectSummary['latency']): MetricCardModel {
  if (p95Ms === null) return noValue('latency', M.latency.label, M.latency.none);
  const scale = targetMs * LATENCY_SCALE;
  const now = Math.round((p95Ms / scale) * PERCENT);
  return {
    key: 'latency',
    label: M.latency.label,
    // 값 · 단위를 나눠도 범례(formatLatency)와 같은 경계 · 자릿수 — 1000ms 이상은 `1.2` + `s`
    ...formatLatencyParts(p95Ms),
    valueTone: 'ink',
    segments: [seg(now, 'ink-soft'), seg(PERCENT - now, 'empty')],
    mark: { left: `${Math.round((targetMs / scale) * PERCENT)}%` },
    legend: [
      item(M.latency.current, formatLatency(p95Ms), 'ink-soft'),
      item(M.latency.target, formatLatency(targetMs), 'fix', 'line'),
    ],
  };
}

function toolsCard(tools: ProjectSummary['tools']): MetricCardModel {
  if (tools === null) return noValue('tools', M.tools.label, M.tools.none);
  const idle = tools.published - tools.called;
  return {
    key: 'tools',
    label: M.tools.label,
    value: String(tools.called),
    tail: ofTotal(tools.published),
    valueTone: 'ink',
    segments: [seg(tools.called, 'ink-soft'), seg(idle, 'empty')],
    legend: [item(M.tools.called, tools.called, 'ink-soft'), item(M.tools.idle, idle, 'empty')],
  };
}

export function toMetricCards(s: ProjectSummary, hasSources: boolean): MetricCardModel[] {
  if (!hasSources) return LABELS.map(([key, label]) => noValue(key, label, M.placeholder));
  const gatesLeft = s.gates.total - s.gates.passed;
  const sourcesTotal = s.reachability.reachable + s.reachability.blocked;
  const callsTotal = s.calls7d.ok + s.calls7d.failed;
  const typesTotal = s.objectTypes.approved + s.objectTypes.pending;
  const connectorsTotal = s.connectors.published + s.connectors.unpublished;
  const hours = s.freshness.hoursAgo;
  return [
    {
      key: 'gates',
      label: M.gates.label,
      value: String(s.gates.passed),
      tail: ofTotal(s.gates.total),
      valueTone: s.gates.passed < s.gates.total ? 'progress' : 'ink',
      segments: [seg(s.gates.passed, 'ink'), seg(gatesLeft, 'empty')],
      legend: [
        item(M.gates.passed, s.gates.passed, 'ink'),
        item(M.gates.failed, gatesLeft, 'empty'),
      ],
    },
    {
      key: 'reachability',
      label: M.reachability.label,
      value: String(s.reachability.reachable),
      tail: ofTotal(sourcesTotal),
      valueTone: s.reachability.blocked > 0 ? 'fix' : 'ink',
      segments: [
        seg(s.reachability.reachable, 'ink-soft'),
        seg(sliver(s.reachability.blocked), 'fix'),
      ],
      legend: [
        item(M.reachability.reachable, s.reachability.reachable, 'ink-soft'),
        item(M.reachability.blocked, s.reachability.blocked, 'fix'),
      ],
    },
    {
      key: 'calls',
      label: M.calls.label,
      value: formatCount(callsTotal),
      valueTone: 'ink',
      segments: [seg(s.calls7d.ok, 'ink-soft'), seg(s.calls7d.failed, 'fix')],
      legend: [
        item(M.calls.ok, formatCount(s.calls7d.ok), 'ink-soft'),
        item(M.calls.failed, formatCount(s.calls7d.failed), 'fix'),
      ],
    },
    latencyCard(s.latency),
    toolsCard(s.tools),
    {
      key: 'objectTypes',
      label: M.objectTypes.label,
      value: String(s.objectTypes.approved),
      tail: ofTotal(typesTotal),
      valueTone: s.objectTypes.pending > 0 ? 'progress' : 'ink',
      segments: [seg(s.objectTypes.approved, 'ink-soft'), seg(s.objectTypes.pending, 'progress')],
      legend: [
        item(M.objectTypes.approved, s.objectTypes.approved, 'ink-soft'),
        item(M.objectTypes.pending, s.objectTypes.pending, 'progress'),
      ],
    },
    {
      key: 'connectors',
      label: M.connectors.label,
      value: String(s.connectors.published),
      tail: ofTotal(connectorsTotal),
      valueTone: 'ink',
      segments: [
        seg(sliver(s.connectors.published), 'ink-soft'),
        seg(sliver(s.connectors.unpublished), 'faint'),
      ],
      legend: [
        item(M.connectors.published, s.connectors.published, 'ink-soft'),
        item(M.connectors.unpublished, s.connectors.unpublished, 'faint'),
      ],
    },
    {
      key: 'freshness',
      label: M.freshness.label,
      value: hours === null ? M.freshness.none : String(hours),
      ...(hours === null ? {} : { unit: M.freshness.unit }),
      valueTone: hours === null ? 'faint' : 'ink',
      segments: [
        seg(s.freshness.today, 'ink-soft'),
        seg(s.freshness.thisWeek, 'progress'),
        seg(s.freshness.stalled, 'empty'),
      ],
      legend: [
        item(M.freshness.today, s.freshness.today, 'ink-soft'),
        item(M.freshness.thisWeek, s.freshness.thisWeek, 'progress'),
        item(M.freshness.stalled, s.freshness.stalled, 'empty'),
      ],
    },
  ];
}
