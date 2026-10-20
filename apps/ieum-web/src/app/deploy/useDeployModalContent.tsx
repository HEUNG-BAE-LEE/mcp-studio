// 모달 칸의 배포 층 내용 — 층 종류마다 내용(제목 · 본문 · 확인 · 폭 · 발)을 고른다. 모달 칸(app/LayerHost ModalFrame)이 늘 부른다
// (배포 층이 아니면 null). 칸이 늘 마운트돼 있으므로 쓰기 요청 인스턴스(만들기 · 수정 · 삭제 · 중지 · 키 발급 · 폐기)를 여기서 쥔다 —
// 칸을 거쳐 남으므로 내용마다 그 대상의 요청일 때만 잠근다. 배포 요청은 배포 화면이 쥐고 층의 onDeploy로 받는다(app/deploy/useDeployToolset),
// 서버 시작은 배포 화면 알림에서만 보낸다(useStartToolset)
//
// ── 쓰는 곳 계약 ──
// useDeployModalContent(layer) → ModalContent | null
//   layer — 모달 칸의 지금(또는 닫히며 남긴) 층. 배포 층이 아니면 null. 배포 층인데 대상(묶음 · 키)이나 도구 · 원본을 연 순간에 찾지 못했으면
//     null — 칸은 그리지 않고 비운다(옛은 없는 대상이면 예외로 열리지 않았다)
// - 키 발급 요청의 응답(키 원문)은 받은 즉시 요청 상태에서 비운다(reset) — 원문은 결과 층에만 남고 그 층은 닫는 순간 비운다(app/LayerHost)
import { useEffect } from 'react';
import { useSources } from '../../api/hooks/useSources';
import { useTools } from '../../api/hooks/useTools';
import { isDeployModalLayer, type ModalLayer } from '../layers';
import type { ModalContent } from '../sources/useModalAttempt';
import { useDrafts } from '../studio/drafts';
import { useToolsWithDrafts } from '../studio/toolView';
import { deployConfirmContentOf } from './DeployConfirmModal';
import { keyIssueContentOf } from './KeyIssueModal';
import { keyRevealContentOf } from './KeyRevealModal';
import { keyRevokeContentOf } from './KeyRevokeModal';
import { serverLogContentOf } from './ServerLogModal';
import { startErrorContentOf } from './StartErrorModal';
import { stopConfirmContentOf } from './StopConfirmModal';
import { toolsetDeleteContentOf } from './ToolsetDeleteModal';
import { toolsetFormContentOf } from './ToolsetFormModal';
import { deployPlan } from './toolsetView';
import { useDeployAttempt } from './useDeployToolset';
import { useDeployModalAttempt } from './useDeployModalAttempt';
import { useIssueKey, useRevokeKey } from './useKeyMutations';
import { useCreateToolset, useDeleteToolset, useStopToolset, useUpdateToolset } from './useToolsetMutations';

/** 배포 확인이 아닐 때 요청 상태를 아무것도 고르지 않게 하는 기준 시각 */
const NO_DEPLOY_SINCE = Number.POSITIVE_INFINITY;

export function useDeployModalContent(layer: ModalLayer): ModalContent | null {
  const { attempt, changeForm, changeKeyName } = useDeployModalAttempt(layer);
  const createToolset = useCreateToolset();
  const updateToolset = useUpdateToolset();
  const deleteToolset = useDeleteToolset();
  const stopToolset = useStopToolset();
  const issueKey = useIssueKey();
  const revokeKey = useRevokeKey();
  const deployLayer = layer.kind === 'deployConfirm' ? layer : null;
  const deployAttempt = useDeployAttempt(deployLayer?.toolsetId ?? '', deployLayer?.since ?? NO_DEPLOY_SINCE);
  const sources = useSources().data?.sources;
  const savedTools = useTools().data;
  const draftedTools = useToolsWithDrafts().data;
  const drafts = useDrafts();

  const isIssued = issueKey.isSuccess;
  const resetIssue = issueKey.reset;
  useEffect(() => {
    if (isIssued) resetIssue();
  }, [isIssued, resetIssue]);

  if (!isDeployModalLayer(layer)) return null;
  const { toolset } = attempt;
  switch (layer.kind) {
    case 'toolsetCreate':
    case 'toolsetEdit': {
      const isEdit = layer.kind === 'toolsetEdit';
      if (sources === undefined || savedTools === undefined || (isEdit && toolset === null)) return null;
      return toolsetFormContentOf({
        mode: isEdit ? 'edit' : 'create',
        toolset,
        form: attempt.form,
        onFormChange: changeForm,
        sources,
        tools: savedTools,
        createToolset,
        updateToolset,
      });
    }
    case 'toolsetDelete':
      return toolset === null ? null : toolsetDeleteContentOf({ toolset, deleteToolset });
    case 'deployConfirm': {
      const { plan } = attempt;
      if (toolset === null || plan === null) return null;
      const currentDirtyIds = () =>
        draftedTools === undefined ? [] : deployPlan(toolset.tools, draftedTools.byId, drafts).dirty.map((t) => t.id);
      return deployConfirmContentOf({ toolset, plan, attempt: deployAttempt, onDeploy: layer.onDeploy, currentDirtyIds });
    }
    case 'stopConfirm':
      return toolset === null ? null : stopConfirmContentOf({ toolset, stopToolset });
    case 'startError':
      return startErrorContentOf({ message: layer.message });
    case 'serverLog':
      return toolset === null ? null : serverLogContentOf({ toolset, lines: layer.lines, readAt: layer.readAt });
    case 'keyIssue':
      return keyIssueContentOf({ name: attempt.keyName, onNameChange: changeKeyName, issueKey });
    case 'keyReveal':
      return keyRevealContentOf({ secret: layer.secret });
    case 'keyRevoke':
      return attempt.key === null ? null : keyRevokeContentOf({ accessKey: attempt.key, revokeKey });
  }
}
