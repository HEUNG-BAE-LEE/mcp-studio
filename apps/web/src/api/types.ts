// apps/web/src/api/types.ts — 데이터 타입의 원본(손으로 쓴다). 화면 · 훅 · 더미 데이터가 같이 쓴다

export type Role = 'owner' | 'editor' | 'member' | 'viewer';
export type CurrentUser = {
  id: string;
  name: string;
  role: Role;
  permissions: string[];
};

export type Project = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  /** 공유받은 프로젝트 */
  shared: boolean;
  sourceCount?: number;
  connectorCount?: number;
  createdAt: string;
  updatedAt: string;
};
export type ProjectInput = {
  name: string;
  description?: string;
  tags?: string[];
};

export type SourceType = 'code' | 'database' | 'document';
/** 화면 표기 — 연결 준비 · 수집 중 · 가공 중 · 수집 완료 · 수집 실패 · 인증 실패 (copy/status) */
export type SourceStatus =
  'ready' | 'ingesting' | 'processing' | 'ingested' | 'ingest_failed' | 'auth_failed';
/** 입력 방식 — code url · dir / database conn · dsn / document upload · dir */
export type SourceMode = 'url' | 'dir' | 'conn' | 'dsn' | 'upload';
export type ToolGroupKind = 'query' | 'aggregate' | 'write';

export type Run = {
  id?: string;
  kind?: 'ingest' | 'process';
  trigger?: 'manual' | 'schedule' | 'retry';
  startedAt?: string;
  endedAt?: string | null;
  result?: 'running' | 'done' | 'failed' | 'skipped' | 'cancelled';
  attempt?: number;
  driver?: string;
  errorCode?: string | null;
  errorRaw?: string | null;
};

/** 산출물 한 줄. count가 0이면 reasonCode(SCOPE_EMPTY · SOURCE_EMPTY · PIPELINE_UNSAVED · AUTH_REJECTED)로 사유 문구를 만든다 */
type OutputSummary = {
  kind: 'tools' | 'object_types' | 'knowledge';
  count: number;
  reasonCode?: string;
};

/** 프로젝트 상세 소스 행. 문장은 copy/output.ts가 만든다 */
export type Source = {
  id: string;
  projectId: string;
  name: string;
  machineName?: string;
  type: SourceType;
  driver?: string;
  status: SourceStatus;
  output: OutputSummary;
  /** 승인 대기 객체 타입 수(object_types) */
  pendingApprovals?: number;
  /** 수집 중일 때 */
  progress?: {
    phase: 'ingest' | 'process' | 'embedding';
    percent: number;
  };
  /** 실패 · 인증 실패일 때 */
  lastError?: {
    code: string;
    httpStatus?: number;
  };
  schedule?: {
    mode?: 'manual' | 'daily';
    at?: string;
  };
  lastRun?: Run;
};

/** 소스 설정 모달. log는 실행 로그 원문 */
export type SourceDetail = Source & {
  tags: string[];
  scope: {
    schema?: string;
    tables?: number;
    repo?: string;
    files?: number;
    fileFormat?: 'pdf' | 'docx' | 'xlsx' | 'mixed';
  };
  connection: {
    code: string;
    value: string;
  }[];
  remainingMinutes?: number;
  log: string[];
  toolGroups: {
    kind: ToolGroupKind;
    count: number;
  }[];
  suggestedConnectorName?: string;
};

/** 소스 추가 ② 바구니. 타입은 묶음 안에서 하나. 접속 키는 금고 참조 문자열(${vault:…}) */
export type SourceBatchInput = {
  type: SourceType;
  items: {
    mode: SourceMode;
    name: string;
    config: Record<string, string>;
    /** 코드 타입의 부를 때 필요한 정보(svc · dburl) */
    runtime?: Record<string, string>;
  }[];
};
export type SourceBatchItem = SourceBatchInput['items'][number];
export type SourcePatch = { name?: string };

/** 화면 표기 — 사용 중 · 갱신 중 · 실패 · 미발행 (copy/status) */
export type ConnectorStatus = 'live' | 'updating' | 'failed' | 'unpublished';
export type Connector = {
  id: string;
  projectId: string;
  sourceId: string;
  sourceName: string;
  name: string;
  status: ConnectorStatus;
  toolCount: number;
  calls7d: number;
  endpoint?: string;
  protocol?: string;
  /** 마스킹된 인증 키 표시값 */
  authKeyMasked?: string;
};
export type ConnectorDraftInput = {
  sourceId: string;
  name: string;
  toolGroups: ToolGroupKind[];
};

/** 프로젝트 상세 요약 밴드. 라벨 · 단위는 copy/project.ts. 소스가 0이면 화면이 자리표시로 그린다 */
export type ProjectSummary = {
  gates: { passed: number; total: number };
  reachability: { reachable: number; blocked: number };
  calls7d: { ok: number; failed: number };
  /** 기간 안 호출이 없으면 p95Ms null. 목표는 프로젝트 설정이라 늘 있다 */
  latency: { p95Ms: number | null; targetMs: number };
  /** 발행한 도구가 없으면 null */
  tools: { called: number; published: number } | null;
  objectTypes: { approved: number; pending: number };
  connectors: { published: number; unpublished: number };
  freshness: {
    /** 마지막 수집으로부터 시간. 수집 없음은 null */
    hoursAgo: number | null;
    today: number;
    thisWeek: number;
    stalled: number;
  };
};

/** 기본 7d */
export type UsageRange = '7d' | '30d';
/** 구성 총합 — 소스(타입별) · 커넥터(상태별) · 도구(발행 · 호출됨) */
export type DashboardComposition = {
  sources: {
    total: number;
    byType: { database: number; document: number; code: number };
  };
  connectors: {
    total: number;
    byStatus: { live: number; updating: number; failed: number; unpublished: number };
  };
  tools: {
    /** 발행된 커넥터의 도구 수 */
    published: number;
    /** 기간 안 1번 이상 호출된 도구 수 */
    called: number;
  };
};
export type DashboardHeatmap = {
  /** 열(시) — 9…20 */
  hours: number[];
  rows: {
    /** ISO 요일 1 월 … 7 일 */
    weekday: number;
    /** hours 순서의 밀도 0–1(소수 2자리) */
    cells: number[];
  }[];
};
export type DashboardRank = {
  connectorId: string;
  /** 커넥터 표시 이름 */
  name: string;
  calls: number;
};
/** 실시간 호출 한 건. ok · slow는 latencyMs, failed는 errorCode(PERMISSION_DENIED · TIMEOUT …) */
export type DashboardCall = {
  id: string;
  at: string;
  connectorId: string;
  /** 커넥터 표시 이름 */
  connector: string;
  /** 도구 기계 이름 */
  tool: string;
  result: 'ok' | 'slow' | 'failed';
  latencyMs?: number;
  errorCode?: string;
};
/** 대시보드 집계. 문장은 없다 — copy/dashboard.ts가 code · 값으로 만든다 */
export type DashboardUsage = {
  /** 집계 기준 시각(`기준 09-11 09:00`) */
  asOf: string;
  range: UsageRange;
  /** 집계 기간. 시각이 아니라 날짜만(`YYYY-MM-DD`) 온다 — 시각처럼 `new Date`로 읽지 않는다 */
  period: { from: string; to: string };
  /** 기간 안 호출(성공 · 실패 합)이 1건 이상 */
  hasCalls: boolean;
  composition: DashboardComposition;
  heatmap: DashboardHeatmap;
  /** 호출 많은 순 */
  ranking: DashboardRank[];
  /** 최신순 */
  live: DashboardCall[];
};

/** 입구. 화면 + id(+ 프로젝트 · 탭) */
export type ActionTarget = {
  screen: 'source' | 'project' | 'connector' | 'ontology' | 'pipeline';
  projectId?: string;
  id: string;
  tab?: 'status' | 'connection' | 'connector' | 'info';
};
/** 문장은 없다. copy/notifications.ts가 code별 틀에 값을 넣는다 */
export type Notification = {
  code: string;
  severity: 'action' | 'progress' | 'recent';
  /** 건수(제목 "… N건") */
  count: number;
  subjects: {
    kind: 'source' | 'connector' | 'project' | 'object_type';
    id: string;
    name: string;
  }[];
  actionTarget: ActionTarget;
  /** 조건이 생긴 시각(본문의 시각) */
  since: string;
  /** 코드별 값. phase · percent · remainingMinutes(INGEST_RUNNING) · objectTypes(INGEST_DONE) · reason(CONNECTOR_DRAFT) · expiresAt(ACCESS_KEY_EXPIRING) · scheduledAt(INGEST_OVERDUE) */
  meta?: {
    phase?: 'ingest' | 'process' | 'embedding';
    percent?: number;
    remainingMinutes?: number;
    objectTypes?: number;
    reason?: string;
    expiresAt?: string;
    scheduledAt?: string;
  };
};
export type NotificationGroups = {
  action: Notification[];
  progress: Notification[];
  recent: Notification[];
};
