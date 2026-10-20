// AlertsBox — "확인이 필요한 항목" 상자: 줄마다 아이콘 · 굵은 제목 · 본문 · 오른쪽 작은 버튼. 옛 js/menu/dashboard.js:50-59
// 인증 만료 줄의 버튼은 재인증 층을 열고(공용 층 호스트 app/LayerHost가 그린다), 나머지는 도구를 연 스튜디오로 간다
import { Fragment } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import type { Source } from '../../api/types';
import type { ToolIndex } from '../../api/hooks/useTools';
import { openReauth } from '../../app/layers';
import { toolLink } from '../../app/studio/links';
import { DASH } from '../../copy/dashboard-logs';
import { Box, Button, EmptyState, Icon, InlineCode } from '@/ui';
import styles from './AlertsBox.module.css';
import { buildDashboardAlerts, type AlertPart, type AlertTarget, type DashboardAlert } from './dashboardAlerts';

function runTarget(target: AlertTarget, navigate: NavigateFunction): void {
  if (target.kind === 'reauth') {
    openReauth(target.sourceId);
    return;
  }
  const { to, state } = toolLink(target.toolId, { tf: target.filter });
  void navigate(to, { state });
}

function Body({ parts }: { parts: readonly AlertPart[] }) {
  return (
    <>
      {parts.map((part, index) => (
        // 고정 조각 목록 — 순서가 바뀌거나 끼어들지 않아 자리 번호를 키로 쓴다
        <Fragment key={index}>{typeof part === 'string' ? part : <InlineCode>{part.code}</InlineCode>}</Fragment>
      ))}
    </>
  );
}

function AlertRow({ alert, onAction }: { alert: DashboardAlert; onAction: () => void }) {
  return (
    <div className={styles.row}>
      <span className={styles.icon} data-tone={alert.tone}>
        <Icon name={alert.tone === 'info' ? 'info' : 'alert'} size="lg" />
      </span>
      <div className={styles.text}>
        <b className={styles.title}>{alert.title}</b>
        <span className={styles.body}>
          <Body parts={alert.body} />
        </span>
      </div>
      <Button size="sm" onClick={onAction}>
        {alert.actionLabel}
      </Button>
    </div>
  );
}

type AlertsBoxProps = Readonly<{ sources: readonly Source[]; tools: ToolIndex }>;

export function AlertsBox({ sources, tools }: AlertsBoxProps) {
  const navigate = useNavigate();
  const alerts = buildDashboardAlerts(sources, tools.all);
  return (
    <Box title={DASH.alerts.title} description={DASH.alerts.count(alerts.length)}>
      {alerts.length === 0 ? (
        <EmptyState kind="section" container="inline">
          {DASH.alerts.empty}
        </EmptyState>
      ) : (
        alerts.map((alert) => (
          <AlertRow key={alert.key} alert={alert} onAction={() => runTarget(alert.target, navigate)} />
        ))
      )}
    </Box>
  );
}
