// apps/web/src/platform/events.ts — 실시간 이벤트 이름 · 페이로드. 문장은 없고 code와 값만
type SourceStatusEvent = { sourceId: string; status: string; runId?: string; at: string };
type RunProgressEvent = {
  sourceId: string;
  runId: string;
  phase: string;
  done: number;
  total: number;
};
/** run.finished 결과 합계(코드 · 값). 라벨은 copy/addSource ADD_SOURCE.outputs */
export type RunOutput = { code: string; count: number };
type RunFinishedEvent = {
  sourceId: string;
  runId: string;
  result: string;
  errorCode?: string;
  outputs?: RunOutput[];
};
type NotificationChangedEvent = {
  groups: { action: number; progress: number; recent: number };
};
type ConnectorStatusEvent = { connectorId: string; status: string };

/** 합성 이벤트 — 서버가 보내지 않는다. 오류 뒤 연결이 다시 열렸을 때 platform이 쏜다 */
type ConnectionReopenedEvent = Record<string, never>;

export type AppEventMap = {
  'source.status': SourceStatusEvent;
  'run.progress': RunProgressEvent;
  'run.finished': RunFinishedEvent;
  'notification.changed': NotificationChangedEvent;
  'connector.status': ConnectorStatusEvent;
  'connection.reopened': ConnectionReopenedEvent;
};
export type AppEventName = keyof AppEventMap;
