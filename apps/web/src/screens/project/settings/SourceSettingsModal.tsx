// apps/web/src/screens/project/settings/SourceSettingsModal.tsx — 소스 설정 모달(Modal settings 820×552): 탭 레일 4 · 탭별 주 액션 · 잠긴 탭 · 연결 해제 확인 · 저장하지 않은 변경 닫기 확인. 부모가 key={sourceId}로 그린다
import { useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { Button, Modal, ModalPanel, StatusChip, useUnsavedClose, type ModalFooter } from '@/ui';
import { useSource } from '../../../api/hooks/useSource';
import { useSources } from '../../../api/hooks/useSources';
import type { SourceDetail, ToolGroupKind } from '../../../api/types';
import { useFrameContainer } from '../../../app/frame';
import { screenGate } from '../../../app/screenGate';
import {
  SETTINGS,
  lockOf,
  settingsAction,
  settingsSubtitle,
  type SettingsAction,
  type SettingsTab,
} from '../../../copy/sourceSettings';
import { sourceStatusOf } from '../../../copy/status';
import { SettingsTabs } from './SettingsTabs';
import {
  draftName,
  isNameChanged,
  useSettingsActions,
  type SettingsActions,
  type SettingsDraft,
} from './useSettingsActions';

type Props = {
  projectId: string;
  sourceId: string;
  tab: SettingsTab;
  onTab: (tab: SettingsTab) => void;
  onClose: () => void;
  /** 연 행이 사라졌을 때(연결 해제) 포커스를 둘 곳 */
  returnFocusFallback?: () => HTMLElement | null;
};
const NO_TOOLS: ReadonlySet<ToolGroupKind> = new Set();
/** 담을 도구 기본값 — 개수가 있는 묶음만 켠다 */
const defaultTools = (d: SourceDetail): ReadonlySet<ToolGroupKind> =>
  new Set(d.toolGroups.filter((g) => g.count > 0).map((g) => g.kind));
const isSameSet = <T,>(a: ReadonlySet<T>, b: ReadonlySet<T>) =>
  a.size === b.size && [...a].every((k) => b.has(k));

type ActionButtonProps = {
  kind: SettingsAction;
  tab: SettingsTab;
  detail: SourceDetail;
  draft: SettingsDraft;
  actions: SettingsActions;
  /** 발 메모 id — 비활성 사유(권한 · 준비 중)를 가리킨다 */
  reasonId: string;
  buttonRef: Ref<HTMLButtonElement>;
};
/** 접속 정보 탭의 교체 자체는 준비 중 — 상태 탭의 교체는 이 탭으로 옮긴다 */
const isComingSoon = (kind: SettingsAction, tab: SettingsTab) =>
  kind === 'rotateKey' && tab === 'connection';

function ActionButton({
  kind,
  tab,
  detail,
  draft,
  actions,
  reasonId,
  buttonRef,
}: ActionButtonProps) {
  const allowed = actions.permission[kind];
  const isLocked = !allowed.allowed || isComingSoon(kind, tab);
  // 저장은 이름이 바뀌었고 비어 있지 않을 때만(DESIGN 층 선택 — 바뀐 것이 없으면 저장 비활성)
  const isUnsavable =
    kind === 'save' && (draftName(draft, detail) === '' || !isNameChanged(draft, detail));
  return (
    <Button
      ref={buttonRef}
      variant="primary"
      disabled={isLocked || isUnsavable}
      loading={actions.busy[kind]}
      aria-describedby={isLocked ? reasonId : undefined}
      onClick={() => actions.run(kind, detail, draft)}
    >
      {SETTINGS.actions[kind]}
    </Button>
  );
}

/**
 * 탭의 주 액션. 수집 시작 · 멈추기가 진행 중이면(새 상세가 올 때까지) 그 버튼을 진행 중으로 둔다 —
 * 실시간 상태가 먼저 바뀌어 같은 자리가 반대 동작(지금 다시 수집 ↔ 수집 멈추기)이 되면 연속 클릭이 그것을 보낸다
 */
const actionOf = (tab: SettingsTab, detail: SourceDetail, actions: SettingsActions) =>
  (tab === 'status' ? actions.running : null) ?? settingsAction(tab, detail.status);

function StatusMarker({ detail }: { detail: SourceDetail | undefined }) {
  if (!detail) return null;
  const status = sourceStatusOf(detail.status);
  return (
    <StatusChip tier={status.tier} size="lg">
      {status.label}
    </StatusChip>
  );
}

/**
 * 이 탭에서 비활성인 액션(주 액션 · 정보 탭 연결 해제) 가운데 첫째의 사유(권한 · 준비 중). 없으면 null.
 * 잠긴 탭은 사유 대신 잠김 안내(EmptyState)가 말한다 — 호출자가 부르지 않는다
 */
function disabledReasonOf(
  tab: SettingsTab,
  action: SettingsAction | null,
  actions: SettingsActions,
): string | null {
  const denied = action ? actions.permission[action] : null;
  if (denied && !denied.allowed && denied.reason) return denied.reason;
  if (action && isComingSoon(action, tab)) return SETTINGS.rotateKeyPending;
  if (tab === 'info') return actions.canDisconnect.reason;
  return null;
}

/** 발: 메모 · 닫기 · 탭별 주 액션. 닫기를 막는 동안(isCloseBlocked) 닫기는 비활성 — 조용히 무시되지 않게 */
const footerOf = (
  note: string,
  noteId: string,
  close: Readonly<{ onClose: () => void; isCloseBlocked: boolean }>,
  primary: ReactNode,
): ModalFooter => ({
  note,
  noteId,
  actions: (
    <>
      <Button disabled={close.isCloseBlocked} onClick={close.onClose}>
        {SETTINGS.close}
      </Button>
      {primary}
    </>
  ),
});

/**
 * 닫기 전에 끝나야 하는 요청 — 저장 · 커넥터 만들기 · 연결 해제(결과를 이 모달이 보인다).
 * 수집 시작 · 중지는 넣지 않는다 — 닫아도 이어지고 결과는 목록 · 알림이 보인다(COMPONENTS useUnsavedClose)
 */
const isCloseBlockedBy = (actions: SettingsActions) =>
  actions.busy.save || actions.busy.createConnector || actions.isRemoving;

function useDraft(detail: SourceDetail | undefined) {
  const [name, setName] = useState<string | null>(null);
  const [connectorName, setConnectorName] = useState('');
  const [tools, setTools] = useState<ReadonlySet<ToolGroupKind> | null>(null);
  const draft: SettingsDraft = {
    name,
    connectorName,
    tools: tools ?? (detail ? defaultTools(detail) : NO_TOOLS),
  };
  const on = { onName: setName, onConnectorName: setConnectorName, onTools: setTools };
  // 바뀐 값 — 이름 · 커넥터 이름 · 담을 도구(기본값과 다르면). 닫기 확인(useUnsavedClose)에 쓴다
  const isDirty =
    detail !== undefined &&
    (isNameChanged(draft, detail) ||
      connectorName.trim() !== '' ||
      (tools !== null && !isSameSet(tools, defaultTools(detail))));
  return { draft, on, isDirty, clearName: () => setName(null) };
}

export function SourceSettingsModal({
  projectId,
  sourceId,
  tab,
  onTab,
  onClose,
  returnFocusFallback,
}: Props) {
  const container = useFrameContainer();
  const source = useSource(sourceId);
  const d = source.data;
  // 제목 = 대상 이름(DESIGN 화면 틀 · COMPONENTS Modal). 상세가 없으면(실패 · 로딩) 이미 받은 목록 행의 이름, 목록에도 없으면(딥링크로 없는 id) 대상 종류
  const listedName = useSources(projectId).data?.find((s) => s.id === sourceId)?.name;
  const title = d?.name ?? listedName ?? (source.error ? SETTINGS.fallbackTitle : SETTINGS.loading);
  const { draft, on, isDirty, clearName } = useDraft(d);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  // 저장이 끝나면 바뀐 것이 없어 저장 버튼이 잠기고 그 위의 포커스가 모달 밖(body)으로 빠진다 —
  // 방금 고친 이름 칸으로 돌려준다(DESIGN 접근성 — 요청 중 · 완료 뒤). 저장 중 다른 곳으로 옮긴 포커스는 건드리지 않는다
  const onSaved = () => {
    const button = primaryRef.current;
    const isOnSave = button !== null && button.ownerDocument.activeElement === button;
    clearName();
    if (isOnSave) nameRef.current?.focus();
  };
  const actions = useSettingsActions({ projectId, onTab, onClose, onSaved });
  const isCloseBlocked = isCloseBlockedBy(actions);
  const unsaved = useUnsavedClose({ isDirty, isBusy: isCloseBlocked, onClose, container });
  const gate = screenGate({ source }, { loading: SETTINGS.loading, inline: true });
  const locked = d !== undefined && tab === 'connector' && lockOf(d.status) !== null;
  const action = d && !locked ? actionOf(tab, d, actions) : null;
  const noteId = useId();
  const primary =
    d && action ? (
      <ActionButton
        kind={action}
        tab={tab}
        detail={d}
        draft={draft}
        actions={actions}
        reasonId={noteId}
        buttonRef={primaryRef}
      />
    ) : null;
  // 발 메모 한 문장(COMPONENTS Modal `footer.note`) — 사유 > 저장하지 않은 변경(DESIGN 권한)
  const note = (locked ? null : disabledReasonOf(tab, action, actions)) ?? unsaved.note ?? '';
  return (
    <>
      <Modal
        kind="settings"
        open
        onOpenChange={(open) => {
          if (!open) unsaved.requestClose();
        }}
        container={container}
        title={title}
        marker={<StatusMarker detail={d} />}
        subtitle={d ? settingsSubtitle(d) : undefined}
        footer={footerOf(note, noteId, { onClose: unsaved.requestClose, isCloseBlocked }, primary)}
        returnFocusFallback={returnFocusFallback}
      >
        {gate.ready ? (
          <SettingsTabs
            projectId={projectId}
            tab={tab}
            detail={gate.data.source}
            draft={draft}
            actions={actions}
            reasonId={noteId}
            nameRef={nameRef}
            {...on}
          />
        ) : (
          <ModalPanel>{gate.state}</ModalPanel>
        )}
      </Modal>
      {unsaved.dialog}
    </>
  );
}
