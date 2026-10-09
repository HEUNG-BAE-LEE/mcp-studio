// DeployScreen — 도구를 묶어 MCP 서버(이 컴퓨터의 프로세스)로 배포하고, 서버를 시작 · 중지하고, AI 앱에 연결할 설정 예시와 액세스 키를 다룬다
// 진입: LNB "AI 연결 배포"(마지막 주소 — 고른 묶음 유지) · 주소. 다른 메뉴에서 이 화면으로 오는 링크는 없다
// 주소: /deploy/:toolsetId? — 묶음을 고르면 replace. id가 없거나 목록에 없으면 첫 묶음 주소로 고쳐 replace(옛 처음 선택은 하드코딩한 시연 묶음 ts-hr이었다 —
//       이식 기간 허용 차이 · 라우터), 묶음이 하나도 없으면 /deploy로 replace. 만들기 성공은 새 묶음, 삭제 성공은 첫 묶음(같은 보정)으로 간다
// 영역: 머리 = PageHead · 빈 상태 = 점선 상자(문장 + 주 버튼 "도구 묶음 만들기" — 도구가 하나도 없으면 비활성) + 액세스 키 ·
//       목록 + 상세 = SplitLayout(ToolsetList = Panel · SelectableListItem / ToolsetDetail = DetailHead · FieldPair · ServerStatusNotice · ConnectSnippet(Tabs ·
//       CodeBlock) · TwoColumn(IncludedTools = CompactTable / PolicySummary = Box policy · SettingRow) · AccessKeys = CompactTable). 1100 이하는 목록이 위이고
//       묶음을 골라도 상세로 스크롤하지 않는다(옛 그대로). 층(모달)은 앱 층의 층 호스트가 그린다(app/layers · app/deploy/useDeployModalContent)
// 조회: 화면 useDeployScreenToolsets(4초 폴링 — 모달이 열린 동안 · 숨은 탭에서 멈춤, 들어올 때마다 받기) · useTools(저장본) · useSources ·
//       영역 useAccessKeysOnEntry(이 화면이 들어올 때 받기 — 키 상자는 useAccessKeys로 그 값만 그려 빈 상태 ↔ 상세로 다시 붙어도 다시 받지 않는다). 쓰기: 배포(useDeployToolset) · 서버 시작(useStartToolset)은 이 화면에 하나씩 둔다 —
//       요청 상태를 묶음 id로 읽어 창을 다시 열거나 묶음 · 메뉴를 오가도 진행이 이어진다. 그 밖의 쓰기는 층 호스트가 쥔다
// 상태: 첫 로딩 = 본문 비움 + aria-busy · 화면 실패 = 본문 자리 실패 상자 · 폴링 실패 = 표시 없이 이전 값 · 묶음 0개 = 빈 상태(키 상자는 그대로) ·
//       키 상자 첫 로딩 · 실패는 그 상자 안
// 옛 근거: apps/web/ieum/js/menu/deploy.js
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSources } from '../../api/hooks/useSources';
import { useTools, type ToolIndex } from '../../api/hooks/useTools';
import type { Source, Toolset } from '../../api/types';
import { DEPLOY_PATH, toolsetPath } from '../../app/deploy/links';
import { toolsetTools } from '../../app/deploy/toolsetView';
import { useDeployToolset } from '../../app/deploy/useDeployToolset';
import { useDeployScreenToolsets } from '../../app/deploy/useDeployScreenToolsets';
import { useStartToolset } from '../../app/deploy/useToolsetMutations';
import { openToolsetCreate } from '../../app/layers';
import { screenGate } from '../../app/screenGate';
import { DEPLOY } from '../../copy/deploy';
import { PAGE_DESCRIPTION, SCREEN_LABEL } from '../../copy/shell';
import { Button, EmptyState, PageHead, ScreenState, SplitLayout } from '@/ui';
import { useAccessKeysOnEntry } from '../../api/hooks/useAccessKeys';
import { AccessKeys } from './AccessKeys';
import { ToolsetDetail } from './ToolsetDetail';
import { ToolsetList } from './ToolsetList';
import styles from './DeployScreen.module.css';

const PAGE_HEAD = <PageHead title={SCREEN_LABEL.deploy} description={PAGE_DESCRIPTION.deploy} />;

/** 묶음이 하나도 없을 때 — 점선 상자 + 키 상자(옛 :52). 도구가 하나도 없으면 문장이 바뀌고 만들기 버튼이 잠긴다 */
function DeployEmpty({ hasTools }: Readonly<{ hasTools: boolean }>) {
  return (
    <>
      {PAGE_HEAD}
      <EmptyState kind="first" container="panel" className={styles.empty}>
        {DEPLOY.empty.none}
        {hasTools ? DEPLOY.empty.hasTools : DEPLOY.empty.noTools}
        <br />
        <br />
        <Button variant="primary" disabled={!hasTools} onClick={openToolsetCreate}>
          {DEPLOY.createToolset}
        </Button>
      </EmptyState>
      <AccessKeys />
    </>
  );
}

/** 고쳐 갈 주소 — 고른 묶음이 주소와 같으면 null */
function fixedPathOf(selected: Toolset | undefined, toolsetId: string | undefined): string | null {
  if (selected === undefined) return toolsetId === undefined ? null : DEPLOY_PATH;
  return selected.id === toolsetId ? null : toolsetPath(selected.id);
}

/** 주소의 묶음 id를 목록에 맞춘다 — 없거나 모르는 id는 첫 묶음으로, 묶음이 없으면 id 없는 주소로(모두 replace) */
function useToolsetRoute(toolsets: readonly Toolset[]): Toolset | undefined {
  const { toolsetId } = useParams();
  const navigate = useNavigate();
  const selected = toolsets.find((t) => t.id === toolsetId) ?? toolsets[0];
  const target = fixedPathOf(selected, toolsetId);
  useEffect(() => {
    if (target !== null) void navigate(target, { replace: true });
  }, [target, navigate]);
  return selected;
}

type DeployBodyProps = Readonly<{
  toolsets: readonly Toolset[];
  tools: ToolIndex;
  sources: readonly Source[];
}>;

function DeployBody({ toolsets, tools, sources }: DeployBodyProps) {
  const navigate = useNavigate();
  const selected = useToolsetRoute(toolsets);
  const deploy = useDeployToolset();
  const start = useStartToolset();

  if (selected === undefined) return <DeployEmpty hasTools={tools.all.length > 0} />;
  const pick = (toolsetId: string) => void navigate(toolsetPath(toolsetId), { replace: true });

  return (
    <>
      {PAGE_HEAD}
      <SplitLayout variant="list" className={styles.split}>
        <ToolsetList toolsets={toolsets} selectedId={selected.id} onPick={pick} />
        <ToolsetDetail
          toolset={selected}
          tools={toolsetTools(selected.tools, tools.byId)}
          sources={sources}
          onDeploy={(toolsetId, dirtyIds) => deploy.mutate({ toolsetId, dirtyIds })}
          onStart={(toolsetId) => start.mutate({ toolsetId })}
        />
      </SplitLayout>
    </>
  );
}

export function DeployScreen() {
  useAccessKeysOnEntry();
  const toolsets = useDeployScreenToolsets();
  const tools = useTools();
  const sources = useSources();
  const gate = screenGate({ toolsets, tools, sources });

  return (
    <ScreenState gate={gate}>
      {(data) => <DeployBody toolsets={data.toolsets} tools={data.tools} sources={data.sources.sources} />}
    </ScreenState>
  );
}
