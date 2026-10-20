// DashboardScreen — 원본 시스템이 AI 도구로 얼마나, 어떻게 쓰이고 있는지 한눈에 보는 첫 화면
// 진입: LNB 대시보드 · 주소 / (없는 주소도 여기로 바뀐다)
// 주소: 경로 인자 · 검색 파라미터 없음 — 알 수 없는 파라미터는 무시한다
// 영역: 머리 = PageHead · KPI 띠 = StatStrip(KpiStrip) · 연결 구조 = Box + Topology(TopologyBox) · 시간대별 호출 = Box + 막대 그래프(HourlyBox)
//       · 확인이 필요한 항목 = Box + 알림 줄(AlertsBox) · 많이 쓰인 도구 = Box + 순위 줄(RankBox) · 원본 0개 = EmptyState hero(DashboardEmpty)
// 조회: 화면 useSources · useTools(screenGate, 원본 0개면 빈 상태) · 영역(region) useDashboardSummary · usePlayground({ region: true }) · 쓰기 없음
// 상태: 첫 로딩 = 본문을 비우고 aria-busy · 화면 조회 실패 = 본문 자리 실패 상자
//       · 요약 대기 = KPI 3~5칸 자리 · 차트 · 순위 상자를 비우고 aria-busy, 구조도 AI 호출 수 칸은 비움 · 요약 실패 = KPI 3~5칸 자리 · 차트 · 순위 상자 안 원문 상자
//       · 모델 조회 대기 = 구조도 AI 열을 비우고 aria-busy · 모델 조회 실패 = 구조도 AI 열 안 원문 상자(요약만 실패하면 AI 호출 수는 옛처럼 0)
//       · 원본 0개 = 큰 빈 상태 상자(KPI · 상자는 그리지 않는다)
// 옛 근거: apps/web/ieum/js/menu/dashboard.js (이식 기간)
import type { DashboardSummary, PlaygroundResponse, Source } from '../../api/types';
import { useDashboardSummary } from '../../api/hooks/useDashboard';
import { usePlayground } from '../../api/hooks/usePlayground';
import { useSources } from '../../api/hooks/useSources';
import { useTools, type ToolIndex } from '../../api/hooks/useTools';
import { regionGate, screenGate, type Gate } from '../../app/screenGate';
import { PAGE_DESCRIPTION, SCREEN_LABEL } from '../../copy/shell';
import { PageHead, ScreenState, TwoColumn } from '@/ui';
import { AlertsBox } from './AlertsBox';
import { DashboardEmpty } from './DashboardEmpty';
import styles from './DashboardScreen.module.css';
import { HourlyBox } from './HourlyBox';
import { KpiStrip } from './KpiStrip';
import { RankBox } from './RankBox';
import { TopologyBox } from './TopologyBox';

const DashboardHead = () => <PageHead title={SCREEN_LABEL.dashboard} description={PAGE_DESCRIPTION.dashboard} />;

type DashboardBodyProps = Readonly<{
  sources: readonly Source[];
  tools: ToolIndex;
  summaryGate: Gate<DashboardSummary>;
  modelsGate: Gate<PlaygroundResponse>;
}>;

function DashboardBody({ sources, tools, summaryGate, modelsGate }: DashboardBodyProps) {
  return (
    <>
      <DashboardHead />
      <KpiStrip sources={sources} tools={tools} summaryGate={summaryGate} className={styles.kpi} />
      <TwoColumn layout="main-side" className={styles.columns}>
        <div className={styles.column}>
          <TopologyBox sources={sources} tools={tools} summaryGate={summaryGate} modelsGate={modelsGate} />
          <HourlyBox summaryGate={summaryGate} />
        </div>
        <div className={styles.column}>
          <AlertsBox sources={sources} tools={tools} />
          <RankBox sources={sources} tools={tools} summaryGate={summaryGate} />
        </div>
      </TwoColumn>
    </>
  );
}

export function DashboardScreen() {
  // 원본이 0개인 빈 상태에서도 요약을 받는다(옛 js/main.js:29,66) — 빈 상태 판정보다 앞, 화면 맨 위에서 조회한다
  const summary = useDashboardSummary();
  const models = usePlayground({ region: true });
  const sources = useSources();
  const tools = useTools();

  const gate = screenGate({ sources, tools }, { isEmpty: (data) => data.sources.sources.length === 0 });

  return (
    <ScreenState
      gate={gate}
      empty={() => (
        <>
          <DashboardHead />
          <DashboardEmpty />
        </>
      )}
    >
      {(data) => (
        <DashboardBody
          sources={data.sources.sources}
          tools={data.tools}
          summaryGate={regionGate(summary)}
          modelsGate={regionGate(models)}
        />
      )}
    </ScreenState>
  );
}
