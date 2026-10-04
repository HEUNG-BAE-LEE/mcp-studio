// ProjectScreen — 프로젝트 하나의 요약과 그 소스 · 커넥터 목록을 보고 소스를 연결한다 · 샘플 IA(언제든 바뀐다 — DESIGN 용어집)
// 진입: LNB 프로젝트 항목(`/projects/:projectId`) · 알림 입구(`?source=&tab=` 설정 모달) — back 없음
// 틀: 상세형 · 스크롤 regions
// 영역: 머리 = PageHeader divider · 요약 = MetricBand(MetricCard) · 두 열 = SourceColumn · ConnectorColumn(Region + RowCard) · 층 = ConnectorInfoDialog · SourceSettingsModal(설정 모달) · AddSourceFlow(단계 흐름)
// 상태: 로딩 · 실패 · 없음 = screenGate(ScreenState) · 빈 상태 = EmptyState(소스 not-created · 커넥터 안내 · 검색 filtered) · 권한 = 추가 · 행 액션 비활성 + 사유 · 값 없음 = 그 요약 칸 사유(MetricCard)
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button, PageBody, PageColumns } from '@/ui';
import { useConnectors } from '../../api/hooks/useConnectors';
import { useProject } from '../../api/hooks/useProject';
import { useProjectSummary } from '../../api/hooks/useProjectSummary';
import { useSources } from '../../api/hooks/useSources';
import { screenPath } from '../../app/nav';
import { screenGate } from '../../app/screenGate';
import { useAppStore } from '../../app/store';
import { PROJECT } from '../../copy/project';
import { defaultTab, warnUnknownSource } from '../../copy/sourceSettings';
import { ConnectorColumn } from './ConnectorColumn';
import { ConnectorInfoDialog } from './ConnectorInfoDialog';
import { MetricBand } from './MetricBand';
import { ProjectHeader } from './ProjectHeader';
import { SourceColumn } from './SourceColumn';
import { AddSourceFlow } from './add-source/AddSourceFlow';
import { SourceSettingsModal } from './settings/SourceSettingsModal';
import { useSettingsParam } from './settings/useSettingsParam';

export function ProjectScreen() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const project = useProject(projectId);
  const sources = useSources(projectId);
  const connectors = useConnectors(projectId);
  const summary = useProjectSummary(projectId);
  const narrow = useAppStore((s) => s.narrow);
  // id만 쥐고 목록에서 찾는다 — 다시 불러오면 열린 다이얼로그도 새 값을 보인다
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // 설정 모달을 연 행이 사라지면(연결 해제) 포커스를 머리 추가 버튼으로
  const addRef = useRef<HTMLButtonElement>(null);
  const settings = useSettingsParam();
  const openId =
    settings.sourceId !== null && sources.data?.some((s) => s.id === settings.sourceId)
      ? settings.sourceId
      : null;
  const isUnknownSource =
    settings.sourceId !== null && sources.data !== undefined && openId === null;
  const { close: closeSettings, sourceId: paramSourceId } = settings;
  // 모르는 id(지운 소스 · 다른 프로젝트 알림)는 열지 않고 파라미터를 지운다.
  // 소스 추가 흐름의 이어 열기도 이 검사를 지난다 — 흐름이 끝나 목록이 다시 불려 새 id가 들어 있다고 본다
  useEffect(() => {
    if (!isUnknownSource) return;
    warnUnknownSource(paramSourceId ?? '');
    closeSettings();
  }, [isUnknownSource, paramSourceId, closeSettings]);

  const gate = screenGate(
    { project, sources, connectors, summary },
    {
      loading: PROJECT.loading,
      notFound: {
        query: project,
        message: PROJECT.notFound,
        action: (
          <Button variant="link" asChild>
            <Link to={screenPath('dash')}>{PROJECT.toDashboard}</Link>
          </Button>
        ),
      },
    },
  );
  if (!gate.ready) return <PageBody narrow={narrow}>{gate.state}</PageBody>;
  const {
    project: projectData,
    sources: sourceList,
    connectors: connectorList,
    summary: summaryData,
  } = gate.data;
  const hasSources = sourceList.length > 0;
  const selected = connectorList.find((c) => c.id === selectedId) ?? null;
  const openSettings = (sourceId: string) => {
    const found = sourceList.find((s) => s.id === sourceId);
    if (found) settings.open(found.id, defaultTab(found.status));
  };
  return (
    <PageBody scroll="regions" narrow={narrow}>
      <ProjectHeader project={projectData} />
      <MetricBand summary={summaryData} hasSources={hasSources} />
      <PageColumns narrow={narrow}>
        <SourceColumn
          sources={sourceList}
          narrow={narrow}
          onAdd={() => setAdding(true)}
          onOpen={openSettings}
          addRef={addRef}
        />
        <ConnectorColumn
          projectId={projectId}
          connectors={connectorList}
          hasSources={hasSources}
          narrow={narrow}
          onSelect={setSelectedId}
        />
      </PageColumns>
      {/* key로 커넥터마다 복사 상태를 새로 시작한다 */}
      <ConnectorInfoDialog
        key={selectedId ?? ''}
        connector={selected}
        projectName={projectData.name}
        onClose={() => setSelectedId(null)}
      />
      {/* key로 소스마다 입력 · 확인 상태를 새로 시작한다 */}
      {openId ? (
        <SourceSettingsModal
          key={openId}
          projectId={projectId}
          sourceId={openId}
          tab={settings.tab}
          onTab={settings.setTab}
          onClose={settings.close}
          returnFocusFallback={() => addRef.current}
        />
      ) : null}
      {/* 열 때만 그린다 — 닫으면 흐름 상태가 사라진다 */}
      {adding ? (
        <AddSourceFlow
          projectId={projectId}
          onClose={() => setAdding(false)}
          onChain={(sourceId) => {
            setAdding(false);
            settings.open(sourceId, 'status');
          }}
        />
      ) : null}
    </PageBody>
  );
}
