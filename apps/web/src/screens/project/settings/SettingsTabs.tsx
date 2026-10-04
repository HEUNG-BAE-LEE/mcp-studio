// apps/web/src/screens/project/settings/SettingsTabs.tsx — 설정 모달 탭 레일 4 · 탭 본문(Tabs rail 내용 열). 실패는 DESIGN 실패 블록 자리(몸통 끝 = 발 바로 위, 마지막 하나만 — 아는 code 한 줄 · 모르는 code 원문)
import type { ReactNode, Ref } from 'react';
import { Tabs } from '@/ui';
import type { SourceDetail, ToolGroupKind } from '../../../api/types';
import { FailureBlock } from '../../../app/FailureBlock';
import { SETTINGS, SETTINGS_TABS, tabNote, type SettingsTab } from '../../../copy/sourceSettings';
import { TabConnection } from './TabConnection';
import { TabConnector } from './TabConnector';
import { TabInfo } from './TabInfo';
import { TabStatus } from './TabStatus';
import type { SettingsActions, SettingsDraft } from './useSettingsActions';

type Props = {
  projectId: string;
  tab: SettingsTab;
  detail: SourceDetail;
  draft: SettingsDraft;
  actions: SettingsActions;
  onName: (v: string) => void;
  onConnectorName: (v: string) => void;
  onTools: (tools: ReadonlySet<ToolGroupKind>) => void;
  /** 발 메모(권한 사유) id — 비활성 액션이 aria-describedby로 가리킨다 */
  reasonId: string;
  /** 소스 정보 탭 이름 입력 — 저장 뒤 포커스를 돌려받는다 */
  nameRef: Ref<HTMLInputElement>;
};

function Panel({
  value,
  failure,
  children,
}: {
  value: SettingsTab;
  failure: unknown;
  children: ReactNode;
}) {
  return (
    <Tabs.Content value={value}>
      {children}
      <FailureBlock failure={failure} />
    </Tabs.Content>
  );
}

export function SettingsTabs({
  projectId,
  tab,
  detail,
  draft,
  actions,
  reasonId,
  nameRef,
  ...on
}: Props) {
  const { failure } = actions;
  const toggleTool = (kind: ToolGroupKind, isOn: boolean) =>
    on.onTools(new Set([...draft.tools].filter((k) => k !== kind).concat(isOn ? [kind] : [])));
  return (
    <Tabs
      variant="rail"
      value={tab}
      onValueChange={(v) => actions.changeTab(v as SettingsTab)}
      items={SETTINGS_TABS.map((t) => ({
        value: t,
        label: SETTINGS.tabs[t],
        note: tabNote(t, detail),
      }))}
    >
      <Panel value="status" failure={failure}>
        <TabStatus detail={detail} />
      </Panel>
      <Panel value="connection" failure={failure}>
        <TabConnection detail={detail} />
      </Panel>
      <Panel value="connector" failure={failure}>
        <TabConnector
          projectId={projectId}
          detail={detail}
          name={draft.connectorName}
          onName={on.onConnectorName}
          selected={draft.tools}
          onToggle={toggleTool}
          readOnly={!actions.permission.createConnector.allowed}
        />
      </Panel>
      <Panel value="info" failure={failure}>
        <TabInfo
          detail={detail}
          name={draft.name ?? detail.name}
          onName={on.onName}
          readOnly={!actions.permission.save.allowed}
          nameRef={nameRef}
          reasonId={reasonId}
          canDisconnect={actions.canDisconnect}
          isRemoving={actions.isRemoving}
          removeFailure={actions.removeFailure}
          onOpenDisconnect={actions.resetDisconnect}
          onDisconnect={() => actions.disconnect(detail.id)}
        />
      </Panel>
    </Tabs>
  );
}
