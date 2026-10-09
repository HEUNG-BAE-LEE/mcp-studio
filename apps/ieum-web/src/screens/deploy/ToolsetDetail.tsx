// 묶음 상세(section "묶음 상세") — 머리(이름 · 배포 상태 칩 / 사용 대상 · 마지막 변경 · 묶음 수정 · 서버 로그 · 중지 · 배포) · 라벨 줄 셋(MCP 서버 주소 · 실행 방식 · 전송 방식) ·
// 서버 상태 알림 · AI에 연결하기 · 두 열(포함된 도구 / 보안 정책) · 액세스 키(옛 js/menu/deploy.js:53-99)
// - "서버 로그"는 한 번이라도 배포한 묶음, "중지"는 실행 중일 때만. 배포 버튼 글자는 초안이면 "처음 배포하기", 아니면 "새 버전 배포"
// - "서버 로그"는 받고 나서 창을 연다 — 받는 사이 다른 묶음을 골랐거나 화면을 떠났으면 열지 않는다. 실패는 경고 토스트(app/deploy/serverLog)
// - "배포"는 배포 확인 창을 연다 — 그 묶음이 배포 요청 중이면 다시 연 창이 진행을 잇는다(기준 시각 — app/deploy/useDeployToolset deployBaseline).
//   보내기는 배포 화면이 쥔 요청(onDeploy)이다. 버튼은 잠그지 않는다 — 요청 중에도 창을 다시 열어 진행을 본다
// - 주소는 서버가 준 runtime.url(중지 · 비정상 종료에도 남는다), 없으면 "처음 배포하면 주소가 발급됩니다." 복사는 클립보드 + 토스트(app/deploy/copyWithToast)
// - 실행 방식: 배포한 묶음 "이 컴퓨터의 프로세스 · 포트 · PID · 오전/오후 hh:mm에 시작"(있는 조각만 — 시작 시각은 실행 중일 때만), 초안 안내
// - 사라진 컨트롤의 포커스는 머리 제목으로(useVanishedFocus)
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { Source, Toolset, Tool } from '../../api/types';
import { copyWithToast } from '../../app/deploy/copyWithToast';
import { loadServerLog } from '../../app/deploy/serverLog';
import { endpointOf, isDeployed, runtimeInfo } from '../../app/deploy/toolsetView';
import { deployBaseline } from '../../app/deploy/useDeployToolset';
import {
  openDeployConfirm,
  openServerLog,
  openStopConfirm,
  openToolsetEdit,
  type DeployRequest,
} from '../../app/layers';
import { DEPLOY } from '../../copy/deploy';
import { Button, CopyField, DetailHead, FieldPair, TwoColumn } from '@/ui';
import { AccessKeys } from './AccessKeys';
import { ConnectSnippet } from './ConnectSnippet';
import { DeployStateChip } from './DeployStateChip';
import { IncludedTools } from './IncludedTools';
import { PolicySummary } from './PolicySummary';
import { ServerStatusNotice } from './ServerStatusNotice';
import { useVanishedFocus } from './useVanishedFocus';
import styles from './DeployScreen.module.css';

const D = DEPLOY.detail;
const RUNNING = 'running';

type ToolsetDetailProps = Readonly<{
  toolset: Toolset;
  /** 이 묶음의 도구(저장본, 묶음 순서) */
  tools: readonly Tool[];
  sources: readonly Source[];
  /** 배포 확인 창의 "배포하기" — 먼저 저장할 도구 id를 받아 배포 요청을 보낸다 */
  onDeploy: (toolsetId: string, dirtyIds: readonly string[]) => void;
  /** 서버 알림의 "시작" · "다시 시작" */
  onStart: (toolsetId: string) => void;
}>;

/** 받은 뒤에 열 때 — 그 사이 화면을 떠났거나 다른 묶음을 골랐으면 열지 않는다 */
function useStillShowing(toolsetId: string): (id: string) => boolean {
  const current = useRef<string | null>(toolsetId);
  useEffect(() => {
    current.current = toolsetId;
  }, [toolsetId]);
  useEffect(
    () => () => {
      current.current = null;
    },
    [],
  );
  return (id) => current.current === id;
}

export function ToolsetDetail({ toolset, tools, sources, onDeploy, onStart }: ToolsetDetailProps) {
  const queryClient = useQueryClient();
  const focus = useVanishedFocus();
  const isStillShowing = useStillShowing(toolset.id);
  const deployed = isDeployed(toolset);
  const url = endpointOf(toolset);

  const openDeploy = () => {
    const request: DeployRequest = (dirtyIds) => onDeploy(toolset.id, dirtyIds);
    openDeployConfirm(toolset.id, deployBaseline(queryClient, toolset.id), request);
  };
  const showServerLog = async () => {
    const toolsetId = toolset.id;
    const lines = await loadServerLog(toolsetId);
    if (lines !== null && isStillShowing(toolsetId)) openServerLog(toolsetId, lines, Date.now());
  };

  return (
    <section aria-label={D.aria} onFocus={focus.onFocus} onBlur={focus.onBlur}>
      <DetailHead
        title={
          <span ref={focus.titleRef} tabIndex={-1}>
            {toolset.name}
          </span>
        }
        badges={<DeployStateChip toolset={toolset} />}
        description={D.meta(toolset.audience, toolset.updated)}
        actions={
          <>
            <Button onClick={() => openToolsetEdit(toolset.id)}>{D.edit}</Button>
            {deployed ? (
              <Button icon="code" onClick={() => void showServerLog()}>
                {D.serverLog}
              </Button>
            ) : null}
            {toolset.runtime.state === RUNNING ? (
              <Button icon="stop" onClick={() => openStopConfirm(toolset.id)}>
                {D.stop}
              </Button>
            ) : null}
            <Button variant="primary" icon="rocket" onClick={openDeploy}>
              {deployed ? D.deployNext : D.deployFirst}
            </Button>
          </>
        }
      />
      <FieldPair variant="label" label={D.endpointLabel}>
        <CopyField
          variant="inline"
          value={url || null}
          emptyText={D.endpointNone}
          copyLabel={D.copyEndpointAria}
          onCopy={(value) => void copyWithToast(value)}
        />
      </FieldPair>
      <FieldPair variant="label" label={D.runLabel}>
        <div className={styles.runValue}>{deployed ? D.runDeployed(runtimeInfo(toolset.runtime)) : D.runDraft}</div>
      </FieldPair>
      <FieldPair variant="label" label={D.transportLabel}>
        <div className={styles.runValue}>{D.transportValue}</div>
      </FieldPair>
      <ServerStatusNotice toolset={toolset} onStart={() => onStart(toolset.id)} />
      <ConnectSnippet toolset={toolset} />
      <TwoColumn layout="half">
        <IncludedTools tools={tools} sources={sources} />
        <PolicySummary tools={tools} />
      </TwoColumn>
      <AccessKeys />
    </section>
  );
}
