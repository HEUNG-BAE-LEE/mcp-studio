// TopologyBox — "연결 구조" 상자: AI 모델 열 · 이음 허브 · 원본 시스템 열을 데이터로 모아 Topology에 넘긴다. 옛 js/menu/dashboard.js:17-28
// AI 열은 모델 조회(영역)를 받는 동안 비우고(aria-busy) 실패하면 그 자리에 원문 실패 상자(열 머리는 남는다).
// 호출 수는 요약 조회에서 온다 — 요약을 받는 동안은 KPI 3~5칸 · 차트처럼 비우고, 요약만 실패하면 옛처럼 0이다(js/menu/dashboard.js:18)
// 원본 노드를 누르면 인증 만료는 재인증 층, 도구가 있으면 첫 도구 스튜디오, 도구가 0개면 그 원본의 빈 스튜디오(app/sources/useGoSource)
import { Fragment } from 'react';
import type { DashboardSummary, PlaygroundResponse, Source, Tool } from '../../api/types';
import type { ToolIndex } from '../../api/hooks/useTools';
import { useGoSource } from '../../app/sources/useGoSource';
import type { Gate } from '../../app/screenGate';
import { sourceStatusOf } from '../../app/status/sourceStatus';
import { DASH } from '../../copy/dashboard-logs';
import { fmtNum } from '../../copy/format';
import { protocolLabel } from '../../copy/protocol';
import {
  Box,
  ScreenState,
  SourceStatus,
  Topology,
  type TopologyAiNode,
  type TopologyLabels,
  type TopologySourceNode,
} from '@/ui';

const LABELS: TopologyLabels = {
  aiHeading: DASH.topology.aiHead,
  aiCallsHeading: DASH.topology.aiHeadCalls,
  aiCallsTitle: DASH.topology.callsTitle,
  aiLink: DASH.topology.linkAi,
  hubTitle: DASH.topology.hub.name,
  sourceLink: DASH.topology.linkSource,
  sourceHeading: DASH.topology.sourceHead,
};

type ClientCalls = Readonly<Record<string, number>>;
/** 요약 실패면 빈 표 — 모든 모델이 0(옛 js/menu/dashboard.js:18) */
const NO_CLIENT_CALLS: ClientCalls = {};

/** 모델 하나의 24시간 호출 수 글자. 요약을 받는 동안은 null(부품이 그 칸을 비우고 aria-busy를 단다), 호출이 없는 모델 · 요약 실패는 0이다 */
function callsText(id: string, summaryGate: Gate<DashboardSummary>): string | null {
  if (summaryGate.kind === 'pending') return null;
  const clientCalls = summaryGate.kind === 'ready' ? summaryGate.data.clientCalls : NO_CLIENT_CALLS;
  const calls = Object.hasOwn(clientCalls, id) ? clientCalls[id] : undefined;
  return fmtNum(calls ?? 0);
}

function aiNodes(models: PlaygroundResponse['models'], summaryGate: Gate<DashboardSummary>): readonly TopologyAiNode[] {
  return Object.entries(models).map(([id, model]) => ({
    id,
    label: model.label,
    via: model.via,
    calls: callsText(id, summaryGate),
  }));
}

const publishedCount = (tools: readonly Tool[]): number => tools.filter((t) => t.status === 'done').length;

function sourceNodes(sources: readonly Source[], tools: ToolIndex): readonly TopologySourceNode[] {
  return sources.map((source) => {
    const own = tools.bySource[source.id] ?? [];
    return {
      id: source.id,
      name: source.name,
      detail: DASH.topology.sourceSub(protocolLabel(source.proto), publishedCount(own)),
      icon: source.proto === 'gov' ? 'globe' : 'server',
      status: <SourceStatus status={sourceStatusOf(source, own)} variant="dot" />,
    };
  });
}

type TopologyBoxProps = Readonly<{
  sources: readonly Source[];
  tools: ToolIndex;
  summaryGate: Gate<DashboardSummary>;
  modelsGate: Gate<PlaygroundResponse>;
}>;

export function TopologyBox({ sources, tools, summaryGate, modelsGate }: TopologyBoxProps) {
  const goSource = useGoSource();
  const hubItems = [
    <Fragment key="published">
      {DASH.topology.hub.publishedPre}
      <b>{DASH.topology.hub.published(publishedCount(tools.all))}</b>
    </Fragment>,
    <Fragment key="formats">
      {DASH.topology.hub.formatsPre}
      <b>{DASH.topology.hub.formatsCount}</b>
      {DASH.topology.hub.formatsPost}
    </Fragment>,
    DASH.topology.hub.guards,
  ];

  return (
    <Box title={DASH.topology.title} description={DASH.topology.sub}>
      <Topology
        labels={LABELS}
        ai={modelsGate.kind === 'ready' ? aiNodes(modelsGate.data.models, summaryGate) : []}
        aiSlot={
          modelsGate.kind === 'ready' ? undefined : (
            <ScreenState gate={modelsGate} scope="region">
              {() => null}
            </ScreenState>
          )
        }
        hubItems={hubItems}
        sources={sourceNodes(sources, tools)}
        onSourceClick={goSource}
      />
    </Box>
  );
}
