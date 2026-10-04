// apps/web/src/screens/shell/ShellAlerts.tsx — 알림 패널 데이터: useNotifications → 카드. 입구 → 라우트 이동 + 닫기. 받기 전 · 조회 실패 = screenGate(층 내용 열 — 로딩 inline · failed 다시 시도)
import { useMemo } from 'react';
import { ALERT_PANEL_GAP, AlertPanel } from '@/ui';
import { useNotifications } from '../../api/hooks/useNotifications';
import { screenGate } from '../../app/screenGate';
import { LNB_COLLAPSED_WIDTH, selectCollapsed, useAppStore } from '../../app/store';
import { SHELL } from '../../copy/shell';
import { AlertList, toAlertItems } from './AlertList';
import styles from './ShellAlerts.module.css';

export function ShellAlerts({ container }: { container: HTMLElement | null }) {
  const open = useAppStore((s) => s.overlay === 'alerts');
  const closeOverlay = useAppStore((s) => s.closeOverlay);
  const collapsed = useAppStore(selectCollapsed);
  const width = useAppStore((s) => s.width);
  // 패널 left = LNB 폭 + 간격. 접힘(1024 기본)이면 레일 폭 기준, 드래그 폭도 따라간다
  const left = (collapsed ? LNB_COLLAPSED_WIDTH : width) + ALERT_PANEL_GAP;
  const notifications = useNotifications();
  const items = useMemo(
    () => (notifications.data ? toAlertItems(notifications.data, new Date()) : []),
    [notifications.data],
  );
  const gate = screenGate({ notifications }, { loading: SHELL.alerts.loading, inline: true });
  return (
    <AlertPanel
      open={open}
      onOpenChange={(next) => {
        if (!next) closeOverlay();
      }}
      container={container}
      left={left}
    >
      {gate.ready ? (
        <AlertList items={items} onNavigate={closeOverlay} />
      ) : (
        <div className={styles.state}>{gate.state}</div>
      )}
    </AlertPanel>
  );
}
