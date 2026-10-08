// 호출 기록 상세 드로어 — 옛 openLog(apps/web/ieum/js/menu/logs.js:32-48)의 모양 그대로.
// 머리: "호출 기록" · 도구 id(고정폭) · "{시각}, {사용자}가 {클라이언트}에서 호출"(사용자가 없으면 사용자 조각을 뺀다)
// 본문: 요약 6칸 → (실패 + 서버 문장이면) 빨간 안내 → 변환 과정(trace가 null이면 "남기지 못했습니다" 빈 상자)
// 발: "{원본}, {프로토콜}"(원본을 알 때) · "변환 스튜디오에서 열기"(도구가 남아 있을 때) · "닫기"
// 열림 · 받기 · 실패는 useLogDrawer가 정한다 — 이 파일은 받은 기록을 그리기만 한다
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { LogDetail, Tool } from '../../api/types';
import { buildTraceSteps, outcomeFromLog } from '../../app/trace/buildTraceSteps';
import { toolLink } from '../../app/studio/links';
import { LOGS } from '../../copy/dashboard-logs';
import { Button, Drawer, EmptyState, KeyValueGrid, Notice, TraceView } from '@/ui';
import { LOG_PARAM, withParam } from './logFilter';
import { LogStatusChip } from './LogStatusChip';
import { logDetailText, toolSourceOf, type LogContext, type LogDetailText } from './logView';
import styles from './LogDetailDrawer.module.css';

type LogSummaryProps = Readonly<{ status: LogDetail['status']; text: LogDetailText }>;

/** 요약 6칸 — 상태 · AI 클라이언트 · 원본 시스템 · 변환 시간 · 원본 응답 시간 · 요청 ID(logs.js:38-43) */
function LogSummary({ status, text }: LogSummaryProps) {
  return (
    <KeyValueGrid
      className={styles.summary}
      items={[
        { label: LOGS.detail.sum.status, value: <LogStatusChip status={status} /> },
        { label: LOGS.detail.sum.client, value: text.client },
        { label: LOGS.detail.sum.source, value: text.source },
        { label: LOGS.detail.sum.convert, value: text.convert },
        { label: LOGS.detail.sum.sourceMs, value: text.sourceMs },
        { label: LOGS.detail.sum.reqId, value: text.reqId, mono: true },
      ]}
    />
  );
}

type LogDetailFootProps = Readonly<{ tool: Tool | undefined; onClose: () => void }>;

/** 발 버튼 — "변환 스튜디오에서 열기"(도구가 남아 있을 때) · "닫기" */
function LogDetailFoot({ tool, onClose }: LogDetailFootProps) {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // 옛 goTool은 드로어를 닫고 스튜디오로 갔다(js/menu/studio.js:147). 주소에서 log를 replace로 빼 드로어를 닫은 뒤 스튜디오로 push한다 —
  // 뒤로가기가 드로어 없는 목록으로 돌아와 상세를 다시 받지 않는다. 닫기 이동이 끝난 뒤 가야 한다: 끝나기 전에 다음 이동을 부르면
  // 앞 이동이 끊겨 replace가 히스토리에 남지 않는다
  const openStudio = async () => {
    if (!tool) return;
    const link = toolLink(tool.id);
    const rest = withParam(params, LOG_PARAM.log, null).toString();
    await navigate({ search: rest ? `?${rest}` : '' }, { replace: true });
    await navigate(link.to, { state: link.state });
  };

  return (
    <>
      {tool ? <Button onClick={() => void openStudio()}>{LOGS.detail.openStudio}</Button> : null}
      <Button variant="primary" onClick={onClose}>
        {LOGS.detail.close}
      </Button>
    </>
  );
}

type LogDetailDrawerProps = Readonly<{
  log: LogDetail;
  open: boolean;
  onClose: () => void;
  context: LogContext;
}>;

export function LogDetailDrawer({ log, open, onClose, context }: LogDetailDrawerProps) {
  const { tool, source } = toolSourceOf(log.tool, context);
  const text = logDetailText(log, context, Date.now());
  const { models } = context;
  const steps = useMemo(
    () => buildTraceSteps({ toolId: log.tool, tool, source, client: log.client, models, outcome: outcomeFromLog(log) }),
    [log, tool, source, models],
  );
  const hasNote = log.status === 'err' && Boolean(log.note);

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      contentKey={log.id}
      overline={LOGS.detail.label}
      title={log.tool}
      titleMono
      description={text.description}
      footerInfo={text.footInfo}
      footer={<LogDetailFoot tool={tool} onClose={onClose} />}
    >
      <LogSummary status={log.status} text={text} />
      {/* 결과의 일부인 실패 — 서버 문장 그대로(logs.js:45). 변환 과정의 실패 단계에도 같은 문장이 노란 안내로 한 번 더 나온다(옛 그대로) */}
      {hasNote ? (
        <Notice tone="danger" className={styles.note}>
          {log.note}
        </Notice>
      ) : null}
      {steps.length > 0 ? (
        <TraceView steps={steps} container="drawer" />
      ) : (
        <EmptyState kind="section" container="panel">
          {LOGS.detail.noTrace}
        </EmptyState>
      )}
    </Drawer>
  );
}
