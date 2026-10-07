// 백엔드 /api/ieum 응답 타입(봉투를 푼 resultData). 필드 이름은 백엔드 그대로(o · a · loc 같은 축약 포함), 뜻은 주석에 적는다
// 기준: .superpowers/audit/api-contract.md(c114af2) 계약표 + :8010 실측. 화면(옛 콘솔 apps/web/ieum/js)이 읽는 필드만 적는다
// 시각 필드는 앱 안에서는 epoch ms다(훅 select가 서버 epoch 초를 api/time.ts secToMs로 바꾼다, D14). 소요 시간(…Ms)은 서버도 ms라 그대로다.
// 서식은 copy/에서(DESIGN Copy 절)

/** 상태 · 종류 값: 아는 값은 자동 완성되고, 모르는 값이 와도 string으로 받는다(화면은 lookup + warnOnce 폴백) */
export type Known<T extends string> = T | (string & {});
/** 서버가 원본 응답 · 예시에서 그대로 옮긴 값 — 문자열 · 숫자가 섞여 온다(gov ex "2026", ax 2026) */
export type Scalar = string | number | boolean | null;
type Dict<T> = Readonly<Record<string, T>>;

// ── 원본 시스템 GET /sources/ ──

/** 셸 GNB가 쓴다(옛 WS). slug · dept · empNo는 화면이 읽지 않는다 */
export type Workspace = Readonly<{ company: string; user: string }>;

export type SourceProto = Known<'rest' | 'soap' | 'gov' | 'sample' | 'disc'>;
export type AuthType = Known<'none' | 'key' | 'bearer' | 'basic' | 'oauth' | 'wss' | 'session'>;

export type Source = Readonly<{
  id: string;
  name: string;
  desc: string;
  proto: SourceProto;
  /** 명세 종류 표시(예: "OpenAPI 3.0.3") */
  spec: string;
  base: string;
  /** 인증 방식 표시 라벨(예: "API Key") */
  auth: string;
  authType: AuthType;
  /** 서버가 박아 둔 "방금"(R27 — 받은 값 그대로 보인다) */
  sync: string;
  /** SOAP만 */
  ns?: string;
  /** reauth · reread 뒤에만 생긴다. true면 "인증 만료" */
  err?: boolean;
}>;

/** 연결 마법사 모드 카드. rec · dis는 1일 때만 온다 */
export type WizardMode = Readonly<{
  /** 묶음 제목 */
  g: string;
  v: Known<'rest' | 'soap' | 'gov' | 'discover' | 'sample'>;
  t: string;
  d: string;
  /** 아이콘 이름 */
  ic: string;
  rec?: number;
  dis?: number;
}>;
/** [id, 이름, 설명] */
export type GovApi = readonly [id: string, name: string, desc: string];
export type Wizard = Readonly<{ modes: readonly WizardMode[]; banWords: readonly string[]; govApis: readonly GovApi[] }>;

export type SourcesResponse = Readonly<{ workspace: Workspace; sources: readonly Source[]; wizard: Wizard }>;

// ── 도구 GET /studio/ ──

export type ToolStatus = Known<'done' | 'review' | 'drift' | 'off'>;
export type ToolMode = Known<'read' | 'write'>;
export type ExecMode = Known<'auto' | 'confirm'>;
/** 변환 규칙. 숨김 규칙은 inject · page · calc · ctx(옛 common/rules.js) */
export type RuleName = Known<
  'name' | 'keep' | 'date' | 'time' | 'num' | 'code' | 'geo' | 'unit' | 'strip' | 'md' | 'filter' | 'inject' | 'page' | 'calc' | 'ctx' | 'pad' | 'mask'
>;
export type ParamLoc = Known<'query' | 'path' | 'body' | 'soap' | 'header'>;
/** 코드표 한 줄 [원본값, AI값, 설명] */
export type CodeEntry = readonly [origin: string, ai: string, note: string];

/** 입력 매핑. o/ot = 원본 이름 · 타입, a/at = AI 이름 · 타입(a가 빈 문자열이면 AI에게 안 보이는 인자) */
export type ToolParam = Readonly<{
  o: string;
  ot: string;
  a: string;
  at: string;
  loc: ParamLoc;
  rule: RuleName;
  /** AI에게 보이는 설명 */
  d: string;
  ex: Scalar;
  /** AI 쪽 예시 */
  ax?: Scalar;
  enum?: readonly string[];
  /** 1이면 필수 */
  req?: number;
  /** inject 규칙의 넣을 값 */
  v?: Scalar;
  codes?: readonly CodeEntry[];
}>;

/** 응답 매핑. ov = 원본 예시 값, av = 변환한 AI 값. drift(1)면 newO가 새 원본 필드, fixed면 새 필드로 고친 것 */
export type ToolResField = Readonly<{
  o: string;
  a: string;
  at: string;
  ov: Scalar;
  rule: RuleName;
  av?: Scalar;
  codes?: readonly CodeEntry[];
  guess?: number;
  drift?: number;
  newO?: string;
  fixed?: boolean;
}>;

export type EvidenceKind = Known<'src' | 'tr' | 'both' | 'out'>;
export type VerifyKind = Known<'ok' | 'file' | '404' | 'err' | 'stg' | 'stgerr' | 'block' | 'out' | 'none'>;
export type Verify = Readonly<{ k: VerifyKind; code?: number; ms?: number; note?: string }>;
/** 자동 탐색에서 등록한 도구의 근거(스튜디오 안내 띠). job · id로 근거 드로어를 연다 */
export type ToolDiscovery = Readonly<{ job: string; id: string; ev: EvidenceKind; verify: Verify; recNote?: string }>;

/** 서버가 저장한 도구 그대로. exec · mask · cache · limit이 빠진 옛 데이터는 useTools가 기본값을 채운다 */
export type ToolRecord = Readonly<{
  id: string;
  title: string;
  status: ToolStatus;
  mode: ToolMode;
  desc: string;
  params: readonly ToolParam[];
  res: readonly ToolResField[];
  exec?: ExecMode;
  mask?: boolean;
  cache?: boolean;
  /** 분당 호출 한도 */
  limit?: number;
  /** 최근 24시간 호출 수(목록 조회가 매번 덮어쓴다 — 저장값 아님) */
  calls: number;
  /** REST · gov · sample · disc */
  method?: string;
  path?: string;
  /** SOAP · gov 오퍼레이션 이름 */
  op?: string;
  /** 쓰기 도구의 사용자 확인 질문 */
  confirmQ?: string;
  /** 1이면 샘플 · 탐색으로 추론한 도구 */
  guess?: number;
  disc?: ToolDiscovery;
  driftMsg?: string;
  offReason?: string;
}>;

/** { 원본 id: 그 원본의 도구[] } — 빈 시드는 {} */
export type StudioResponse = Dict<readonly ToolRecord[]>;

/** 화면이 쓰는 도구: 원본 id(src)를 붙이고 기본값을 채운 것(옛 indexTools) */
export type Tool = ToolRecord &
  Readonly<{ src: string; exec: ExecMode; mask: boolean; cache: boolean; limit: number }>;

// ── 테스트 실행 GET /playground/ · POST /playground/call/ · /playground/chat/ ──

export type ModelId = Known<'claude' | 'gemini' | 'gpt' | 'mcp'>;
export type ModelInfo = Readonly<{ label: string; via: string }>;
export type PlaygroundResponse = Readonly<{ models: Dict<ModelInfo>; chatEnabled: boolean }>;

export type OriginRequest = Readonly<{ method: string; url: string; headers: Dict<string>; body: string }>;
export type OriginResponse = Readonly<{ status: number; headers: Dict<string>; body: string }>;
/** 호출 기록. 실패면 aiResult · rulesReq · rulesRes가 없을 수 있고, 연결 실패 · 한도 초과면 {}다 */
export type CallTrace = Readonly<{
  args?: Dict<unknown>;
  originRequest?: OriginRequest;
  convertMs?: number;
  sourceMs?: number | null;
  originResponse?: OriginResponse;
  aiResult?: unknown;
  rulesReq?: readonly RuleName[];
  rulesRes?: readonly RuleName[];
}>;
/** 세 모양 모두 HTTP 200 — 실행 실패(ok:false)도 오류가 아니라 결과의 일부로 그린다. log = 로그 id */
export type PlaygroundCallResult =
  | Readonly<{ hold: true; tool: string }>
  | Readonly<{ ok: true; result: unknown; trace: CallTrace; log: string }>
  | Readonly<{ ok: false; error: string; trace: CallTrace; log: string }>;
export type ChatCall = Readonly<{ tool: string; ok: boolean; log: string; trace: CallTrace }>;
export type PlaygroundChatResult = Readonly<{ answer: string; calls: readonly ChatCall[] }>;

// ── AI 연결 배포 GET /deploy/toolsets/ · /deploy/keys/ ──

export type ToolsetStatus = Known<'draft' | 'live' | 'stopped'>;
export type RuntimeState = Known<'none' | 'stopped' | 'starting' | 'running' | 'crashed'>;
/** 서버 프로세스. none은 초안일 때만. pid · startedAt은 running, exitCode · message는 crashed */
export type ToolsetRuntime = Readonly<{
  state: RuntimeState;
  port?: number;
  url?: string;
  pid?: number;
  /** 시작 시각 — 앱 안에서는 epoch ms(서버는 epoch 초 — 3단계 배포 훅에서 select로 바꾼다) */
  startedAt?: number;
  exitCode?: number;
  message?: string;
}>;
export type Toolset = Readonly<{
  /** "ts-<slug>" */
  id: string;
  name: string;
  slug: string;
  /** 표시 전용 — MCP 인증에 쓰이지 않는다 */
  audience: string;
  tools: readonly string[];
  ver: string;
  status: ToolsetStatus;
  /** 서버가 박아 둔 "방금" */
  updated: string;
  runtime: ToolsetRuntime;
}>;
/** POST …/deploy/ 만 래퍼가 있다(start · stop은 Toolset 그대로) */
export type DeployResult = Readonly<{ toolset: Toolset; deployed: readonly string[]; skipped: readonly string[] }>;

/** 액세스 키. key는 가린 값, 전체 키는 발급 응답(KeyCreated.secret)에서 한 번만 */
export type AccessKey = Readonly<{
  id: string;
  name: string;
  key: string;
  /** YYYY-MM-DD */
  created: string;
  /** "사용 전" 또는 "MM-DD HH:MM" */
  last: string;
  on: boolean;
}>;
export type KeyCreated = AccessKey & Readonly<{ secret: string }>;

// ── 호출 로그 GET /logs/ · /logs/{id}/ ──

export type LogStatus = Known<'ok' | 'err'>;
export type LogRow = Readonly<{
  /** 12자 hex — 화면은 req_<id>로 보인다 */
  id: string;
  /** 호출 시각 — 앱 안에서는 epoch ms(서버는 epoch 초 — 3단계 로그 훅에서 select로 바꾼다) */
  ts: number;
  client: ModelId;
  tool: string;
  status: LogStatus;
  convertMs: number;
  sourceMs: number | null;
  /** MCP 호출이면 키 이름, 테스트 실행이면 workspace.user */
  user: string;
  note: string | null;
}>;
/** 화면은 rows만 읽는다(필터는 화면에서, R21) */
export type LogsResponse = Readonly<{ rows: readonly LogRow[] }>;
export type LogDetail = LogRow & Readonly<{ trace: CallTrace }>;

// ── 자동 탐색 GET /discovery/ (원본 화면의 작업 표 · 탐색 마법사) ──

export type JobStatus = Known<'scheduled' | 'running' | 'review' | 'done' | 'failed' | 'cancelled' | 'interrupted'>;
/** 작업 목록 한 줄(JobSummary 중 표가 읽는 것). seq · more는 목록에서 누수된 값이라 넣지 않는다 */
export type JobSummary = Readonly<{
  /** 10자 hex */
  id: string;
  name: string;
  status: JobStatus;
  opts: Readonly<{ git: boolean; crawl: boolean; base?: string; repo?: string }>;
  /** 예약 시각(scheduled일 때) — 앱 안에서는 epoch ms(서버는 epoch 초 — 3단계 탐색 훅에서 select로 바꾼다) */
  startAt: number | null;
  stats: Readonly<{ found: number }>;
  /** 찾은 API 수(범위 밖 제외) */
  apiCount: number;
  registered: number;
}>;
/** 마법사 "시연용 값 채우기" — 시연 계정 비밀번호가 평문으로 온다(시연용, 감사 §7-1) */
export type DiscoveryDemo = Readonly<{
  name: string;
  base: string;
  start: string;
  account: string;
  password: string;
  repo: string;
  branch: string;
  stgUrl: string;
  owner: string;
}>;
export type DiscoveryResponse = Readonly<{
  /** browser는 쓸 수 있는 브라우저 이름이거나 null */
  capabilities: Readonly<{ playwright: boolean; browser: string | null; git: boolean }>;
  defaults: Readonly<{ ban: readonly string[]; maxPages: number; frameworks: readonly string[] }>;
  jobs: readonly JobSummary[];
  demo: DiscoveryDemo | null;
}>;
