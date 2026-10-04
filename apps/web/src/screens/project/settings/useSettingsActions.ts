// apps/web/src/screens/project/settings/useSettingsActions.ts — 설정 모달의 요청 · 권한 · 진행 · 실패(규칙 8). 실패는 마지막 하나만: 새 요청 · 탭 이동 전에 지난 실패를 지운다
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateConnector } from '../../../api/hooks/useCreateConnector';
import {
  forgetSource,
  useDeleteSource,
  useIngestSource,
  useStopIngest,
  useUpdateSource,
} from '../../../api/hooks/useSourceMutations';
import type { SourceDetail, ToolGroupKind } from '../../../api/types';
import { usePermission, type PermissionState } from '../../../app/user/usePermission';
import { SETTINGS, type SettingsAction, type SettingsTab } from '../../../copy/sourceSettings';

/** 탭 입력 초안. name이 null이면 서버 이름 그대로 */
export type SettingsDraft = Readonly<{
  name: string | null;
  connectorName: string;
  tools: ReadonlySet<ToolGroupKind>;
}>;
type Args = {
  projectId: string;
  onTab: (tab: SettingsTab) => void;
  onClose: () => void;
  /** 저장 성공 — 초안을 비운다 */
  onSaved: () => void;
};

export const draftName = (draft: SettingsDraft, detail: SourceDetail) =>
  (draft.name ?? detail.name).trim();
/** 이름이 서버 값과 다르다 — 저장 켜기 · 저장하지 않은 변경 */
export const isNameChanged = (draft: SettingsDraft, detail: SourceDetail) =>
  draftName(draft, detail) !== detail.name;
const connectorNameOf = (draft: SettingsDraft, detail: SourceDetail) =>
  draft.connectorName.trim() ||
  (detail.suggestedConnectorName ?? SETTINGS.connector.namePlaceholder(detail.name));

function useActionPermissions(): Record<SettingsAction, PermissionState> {
  const ingest = usePermission('source:ingest');
  const edit = usePermission('source:edit');
  const publish = usePermission('connector:publish');
  return { reingest: ingest, stop: ingest, rotateKey: edit, save: edit, createConnector: publish };
}

/** 지운 소스의 상세 캐시는 모달이 내려간 뒤에 버린다(useDeleteSource 주석) */
function useForgetDeleted() {
  const client = useQueryClient();
  const deleted = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (deleted.current !== null) forgetSource(client, deleted.current);
    },
    [client],
  );
  return (sourceId: string) => {
    deleted.current = sourceId;
  };
}

function useSettingsMutations(projectId: string) {
  return {
    ingest: useIngestSource(),
    stop: useStopIngest(),
    update: useUpdateSource(projectId),
    remove: useDeleteSource(projectId),
    createConnector: useCreateConnector(projectId),
  };
}
type SettingsMutations = ReturnType<typeof useSettingsMutations>;
const busyOf = (m: SettingsMutations): Record<SettingsAction, boolean> => ({
  reingest: m.ingest.isPending,
  stop: m.stop.isPending,
  rotateKey: false,
  save: m.update.isPending,
  createConnector: m.createConnector.isPending,
});
/** 수집 시작 · 멈추기가 진행 중(새 상세가 올 때까지)이면 그 동작 — 상태 탭 버튼을 그 자리에 둔다(SourceSettingsModal) */
const runningOf = (m: SettingsMutations): SettingsAction | null => {
  if (m.ingest.isPending) return 'reingest';
  if (m.stop.isPending) return 'stop';
  return null;
};

/** 가드 자리 — 탭 주 액션 · 정보 탭 연결 해제 */
type GuardSlot = SettingsAction | 'disconnect';
/** 같은 자리(버튼)의 연속 클릭만 막는다 — 수집 시작 · 멈추기는 상태 탭 주 액션 한 자리 */
const slotOf = (kind: GuardSlot): GuardSlot => (kind === 'stop' ? 'reingest' : kind);

/**
 * 요청 중이면 다시 보내지 않는다(DESIGN 접근성 — 요청 중 · 완료 뒤). isPending이 그려지기 전의 연속 클릭도 막는다.
 * 자리별로 막는다 — 다른 자리의 요청은 함께 보낼 수 있다. 가드는 요청 promise가 끝나면 푼다
 */
function useInFlightGuard() {
  const inFlight = useRef<ReadonlySet<GuardSlot>>(new Set());
  const isInFlight = (kind: GuardSlot) => inFlight.current.has(slotOf(kind));
  const send = (kind: GuardSlot, request: Promise<unknown>) => {
    const slot = slotOf(kind);
    inFlight.current = new Set([...inFlight.current, slot]);
    // 실패는 mutation 상태(failure)가 보인다 — 여기서는 가드만 푼다
    void request
      .catch(() => undefined)
      .finally(() => {
        inFlight.current = new Set([...inFlight.current].filter((s) => s !== slot));
      });
  };
  return { isInFlight, send };
}

export function useSettingsActions({ projectId, onTab, onClose, onSaved }: Args) {
  const m = useSettingsMutations(projectId);
  const permission = useActionPermissions();
  const canDisconnect = usePermission('source:delete');
  const markDeleted = useForgetDeleted();
  const guard = useInFlightGuard();
  const all = [m.ingest, m.stop, m.update, m.createConnector];
  // 진행 중인 요청은 지우지 않는다 — 지우면 isPending · 호출별 onSuccess가 끊겨 닫기 막기 · 진행 표시가 풀린다. 지난 실패 · 성공만 지운다
  const resetAll = () => {
    for (const mutation of [...all, m.remove]) if (!mutation.isPending) mutation.reset();
  };
  const changeTab = (next: SettingsTab) => {
    resetAll();
    onTab(next);
  };
  const run = (kind: SettingsAction, detail: SourceDetail, draft: SettingsDraft) => {
    if (kind === 'rotateKey') return changeTab('connection');
    if (guard.isInFlight(kind) || busyOf(m)[kind]) return;
    // 저장은 이름이 바뀌었을 때만 켜진다(SourceSettingsModal ActionButton)
    const name = draftName(draft, detail);
    resetAll();
    if (kind === 'reingest') guard.send(kind, m.ingest.mutateAsync(detail.id));
    else if (kind === 'stop') guard.send(kind, m.stop.mutateAsync(detail.id));
    else if (kind === 'save')
      guard.send(kind, m.update.mutateAsync({ sourceId: detail.id, name }, { onSuccess: onSaved }));
    else {
      const input = { sourceId: detail.id, name: connectorNameOf(draft, detail) };
      const request = { ...input, toolGroups: [...draft.tools] };
      guard.send(kind, m.createConnector.mutateAsync(request, { onSuccess: onClose }));
    }
  };
  const disconnect = (sourceId: string) => {
    if (guard.isInFlight('disconnect') || m.remove.isPending) return;
    resetAll();
    const onSuccess = () => {
      markDeleted(sourceId);
      onClose();
    };
    guard.send('disconnect', m.remove.mutateAsync(sourceId, { onSuccess }));
  };
  return {
    permission,
    canDisconnect,
    busy: busyOf(m),
    running: runningOf(m),
    isRemoving: m.remove.isPending,
    removeFailure: m.remove.isError ? m.remove.error : null,
    resetDisconnect: m.remove.reset,
    failure: all.find((mutation) => mutation.isError)?.error,
    run,
    changeTab,
    disconnect,
  };
}
export type SettingsActions = ReturnType<typeof useSettingsActions>;
