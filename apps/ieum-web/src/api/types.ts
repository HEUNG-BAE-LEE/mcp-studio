// 백엔드 /api/ieum 응답 타입(봉투를 푼 resultData). 필드 이름은 백엔드 그대로(o · a · loc 같은 축약 포함), 뜻은 주석에 적는다
// 기준: 백엔드 라우터(apps/backend, c114af2)와 :8010 실측. 화면(옛 콘솔 apps/web/ieum/js)이 읽는 필드만 적는다
// 시각 필드는 앱 안에서는 epoch ms다(훅 select가 서버 epoch 초를 api/time.ts secToMs로 바꾼다). 소요 시간(…Ms)은 서버도 ms라 그대로다.
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
  /** 서버가 박아 둔 "방금"(받은 값 그대로 보인다) */
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

// ── 원본 시스템 쓰기 POST /sources/connect/ · /sources/{id}/reauth/ · DELETE /sources/{id}/ ──

/** 연결 마법사에서 고르는 연결 방식(카드 v 중 연결 요청으로 가는 것). 서버는 이 값을 원본의 proto로 저장한다 */
export type ConnectMode = Known<'rest' | 'soap' | 'gov' | 'sample'>;

/**
 * 인증 정보 — 마법사 · 재인증 입력 그대로. 방식을 바꿔도 다른 방식의 칸이 남아 함께 간다(옛 js/menu/sources.js:185,188).
 * 서버가 type에 맞는 칸만 골라 검사 · 저장한다(routers/sources.py _clean_cred)
 */
export type SourceCred = Readonly<{
  type: AuthType;
  /** key 방식의 전달 위치 */
  in?: 'header' | 'query';
  /** key 방식의 헤더 · 쿼리 이름 */
  name?: string;
  /** key 방식의 키 · bearer 방식의 토큰 */
  key?: string;
  /** basic · wss · session 방식 */
  username?: string;
  password?: string;
  /** oauth 방식 */
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
}>;

/** POST /sources/connect/ 본문 — 모드와 상관없이 아홉 칸을 모두 보낸다(옛 js/menu/sources.js:117-118). 서버가 모드에 맞는 칸만 읽는다 */
export type ConnectSourceBody = Readonly<{
  mode: ConnectMode;
  /** 비면 서버가 명세의 이름을 쓴다 */
  name: string;
  specUrl: string;
  /** 올린 명세 파일 본문. 있으면 서버는 specUrl보다 이것을 쓴다 */
  specText: string;
  base: string;
  /** 공공데이터포털 API id(wizard.govApis의 첫 칸). 목록이 비면 없다 — JSON에서 빠진다(옛과 같다) */
  gov: string | undefined;
  auth: SourceCred;
  sampleRequest: string;
  sampleResponse: string;
}>;
/** 연결 응답(201) — 새 원본과 그 원본의 도구. 도구는 모두 review로 시작한다 */
export type ConnectSourceResult = Readonly<{ source: Source; tools: readonly ToolRecord[] }>;

/** POST /sources/{id}/reauth/ 본문. 응답은 고친 원본 전체(Source, err:false — repositories/sources.py upsert_source) */
export type ReauthBody = Readonly<{ auth: SourceCred }>;

/** DELETE /sources/{id}/ 응답 */
export type DeletedResult = Readonly<{ deleted: string }>;

// ── 도구 GET /studio/ ──

export type ToolStatus = Known<'done' | 'review' | 'drift' | 'off'>;
export type ToolMode = Known<'read' | 'write'>;
export type ExecMode = Known<'auto' | 'confirm'>;
/** 변환 규칙. 숨김 규칙은 inject · page · calc · ctx(옛 common/rules.js) */
export type RuleName = Known<
  'name' | 'keep' | 'date' | 'time' | 'num' | 'code' | 'geo' | 'unit' | 'strip' | 'md' | 'filter' | 'inject' | 'page' | 'calc' | 'ctx' | 'pad' | 'mask'
>;
export type ParamLoc = Known<'query' | 'path' | 'body' | 'soap' | 'header'>;
/** 코드표 한 줄 [원본값, AI값, 설명]. AI값은 불리언 · 숫자로도 온다(공공데이터 isHoliday ['Y', true, '쉬는 날']) */
export type CodeEntry = readonly [origin: string, ai: Scalar, note: string];

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
  /** 공공데이터 항목형 응답의 category 값 — 원본 응답 미리보기만 읽는다 */
  cat?: string;
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
  // ── 스튜디오 미리보기 · 저장이 읽는 것(화면에 그대로 보이지 않는 필드). 저장 본문은 이 밖의 키도 받은 그대로 싣는다 ──
  /** 쓰기 도구의 MCP destructiveHint(gateway/spec.py) */
  destructive?: boolean;
  /** 공공데이터 원본 응답 미리보기 본문(있으면 그대로 보인다) */
  resXml?: string;
  /** 공공데이터 항목형 응답에서 값이 든 요소 이름 */
  valKey?: string;
  /** 응답 변환 미리보기의 AI 결과(있으면 응답 매핑 대신 그대로 보인다) */
  aiOut?: unknown;
  /** SOAP만 — 화면은 읽지 않고 저장 본문에 받은 그대로 싣는다 */
  soapAction?: string;
  inEl?: string;
  outEl?: string;
}>;

/** { 원본 id: 그 원본의 도구[] } — 빈 시드는 {} */
export type StudioResponse = Dict<readonly ToolRecord[]>;

/** 화면이 쓰는 도구: 원본 id(src)를 붙이고 기본값을 채운 것(옛 indexTools) */
export type Tool = ToolRecord &
  Readonly<{ src: string; exec: ExecMode; mask: boolean; cache: boolean; limit: number }>;

// ── 변환 스튜디오 쓰기 PUT /studio/{id}/ · POST /studio/{id}/rewrite/ · POST /sources/{id}/reread/ ──

/** PUT /studio/{id}/ 응답 — 서버가 얕게 병합해 저장한 도구 + 원본 id(routers/studio.py tool_save) */
export type SavedTool = ToolRecord & Readonly<{ src: string }>;
/** POST /studio/{id}/rewrite/ 응답 — Claude가 다시 쓴 설명 */
export type RewriteResponse = Readonly<{ desc: string }>;
/** POST /sources/{id}/reread/ 응답 — 고친 원본, 그 원본의 도구 전체(바뀐 것 · 새것 포함), 새 도구 id · 명세가 바뀐 도구 id */
export type RereadResponse = Readonly<{
  source: Source;
  tools: readonly ToolRecord[];
  added: readonly string[];
  drifted: readonly string[];
}>;

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
  // log는 호출 로그를 남긴 실패에만 — 도구를 찾지 못함 · 공개되지 않음은 로그 없이 끝난다(gateway/runner.py run_tool :43,45)
  | Readonly<{ ok: false; error: string; trace: CallTrace; log?: string }>;
/** 대화 중 Claude가 부른 도구 하나. log는 확인이 필요한 쓰기 도구라 실행하지 않았으면 null이다(routers/playground.py:75,78 out.get("log")) */
export type ChatCall = Readonly<{ tool: string; ok: boolean; log: string | null; trace: CallTrace }>;
export type PlaygroundChatResult = Readonly<{ answer: string; calls: readonly ChatCall[] }>;

/**
 * POST /playground/call/ 본문(옛 js/menu/playground.js:86 — 키 순서도 같게). args는 인자 폼 값을 타입대로 바꾼 것이고 빈 칸은 빠진다.
 * model이 서버 목록에 없으면 서버가 mcp로 본다. approved는 확인 대기 상자의 "실행"에서만 true. user는 workspace.user(로그 사용자)
 */
export type PlaygroundCallBody = Readonly<{
  tool: string;
  args: Readonly<Record<string, unknown>>;
  model: ModelId;
  approved: boolean;
  user: string;
}>;
/** POST /playground/chat/ 본문 — 이전 대화는 싣지 않는다(서버가 기억하지 않음 — 옛 js/menu/playground.js:97) */
export type PlaygroundChatBody = Readonly<{ message: string; user: string }>;

// ── AI 연결 배포 GET /deploy/toolsets/ · /deploy/keys/ ──

export type ToolsetStatus = Known<'draft' | 'live' | 'stopped'>;
export type RuntimeState = Known<'none' | 'stopped' | 'starting' | 'running' | 'crashed'>;
type ToolsetRuntimeBase = Readonly<{
  state: RuntimeState;
  port?: number;
  url?: string;
  pid?: number;
  /** crashed — 프로세스 종료 코드. 복구를 기다리다 실패하면 null(runtime/supervisor.py exit_code Optional) */
  exitCode?: number | null;
  message?: string;
}>;
/** 서버 프로세스. none은 초안일 때만. pid는 running, startedAt은 프로세스 기록이 있을 때, exitCode · message는 crashed */
export type ToolsetRuntime = ToolsetRuntimeBase &
  Readonly<{
    /** 시작 시각(epoch ms) — useToolsets select가 서버 epoch 초를 바꾼 값 */
    startedAt?: number;
  }>;
/**
 * epoch 초 — 서버 모양 쪽 표지. 화면이 읽는 ms(number)와 섞이면 컴파일러가 막는다(ms에 넣으려면 api/time secToMs를 거친다).
 * 응답을 받는 타입에만 붙이고 값을 만들지 않는다
 */
export type EpochSec = number & { readonly __unit: 'sec' };
/** 서버 모양의 런타임 — startedAt이 epoch 초(time.time() 그대로) */
export type ToolsetRuntimeWire = ToolsetRuntimeBase &
  Readonly<{
    /** 시작 시각(epoch 초) */
    startedAt?: EpochSec;
  }>;
type ToolsetBase = Readonly<{
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
}>;
/** 화면이 읽는 묶음 — useToolsets select 결과(runtime.startedAt epoch ms) */
export type Toolset = ToolsetBase & Readonly<{ runtime: ToolsetRuntime }>;
/**
 * 서버 모양의 묶음(runtime.startedAt epoch 초). 쿼리 캐시 ['deploy','toolsets']와 쓰기 응답(만들기 · 고치기 · 시작 · 중지 · 배포)은 이 모양이고,
 * ms로 바꾸는 곳은 useToolsets의 select 하나뿐이다 — 쓰기 응답을 setQueryData로 넣을 때도 이 모양 그대로 넣는다
 */
export type ToolsetWire = ToolsetBase & Readonly<{ runtime: ToolsetRuntimeWire }>;
/** POST …/deploy/ 만 래퍼가 있다(start · stop은 ToolsetWire 그대로). skipped = 공개 상태가 아니어서 빠진 도구 id */
export type DeployResultWire = Readonly<{ toolset: ToolsetWire; deployed: readonly string[]; skipped: readonly string[] }>;
/** POST /deploy/toolsets/ · PUT /deploy/toolsets/{id}/ 본문 — 폼 입력 그대로(검증은 서버 — routers/deploy.py _validate) */
export type ToolsetBody = Readonly<{ name: string; slug: string; audience: string; tools: readonly string[] }>;
/** GET /deploy/toolsets/{id}/logs/?lines=N — 서버 프로세스 로그의 마지막 줄들 */
export type ToolsetLogs = Readonly<{ lines: readonly string[] }>;

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
/** POST /deploy/keys/ 본문 */
export type KeyIssueBody = Readonly<{ name: string }>;

// ── 호출 로그 GET /logs/ · /logs/{id}/ ──

export type LogStatus = Known<'ok' | 'err'>;
export type LogRow = Readonly<{
  /** 12자 hex — 화면은 req_<id>로 보인다 */
  id: string;
  /** 호출 시각 — 앱 안에서는 epoch ms(서버는 epoch 초 — 로그 훅에서 select로 바꾼다) */
  ts: number;
  client: ModelId;
  tool: string;
  status: LogStatus;
  /** 서버는 값이 없는 호출에 0을 넣지만(gateway/runner.py), 옛 화면이 null도 받아 `??`로 처리해 타입은 null을 막지 않는다 */
  convertMs: number | null;
  sourceMs: number | null;
  /** MCP 호출이면 키 이름, 테스트 실행이면 workspace.user. 없으면 빈 문자열 */
  user: string;
  note: string | null;
}>;
/** 화면은 rows만 읽는다(필터는 화면에서) */
export type LogsResponse = Readonly<{ rows: readonly LogRow[] }>;
/**
 * 서버는 변환 과정을 남기지 못한 호출(도구 한도 초과 · 예기치 못한 오류)에 trace를 null로 저장한다.
 * 도구 실행 실패는 {} 또는 부분 trace다 — "남기지 못했습니다"(null)와 "단계를 그린다"({})를 섞지 않는다
 */
export type LogDetail = LogRow & Readonly<{ trace: CallTrace | null }>;

// ── 대시보드 GET /dashboard/summary/ ──

/** 화면이 읽는 KPI만. 서버의 sources · sourcesOk · publishedTools · pendingTools는 화면이 원본 · 도구 조회로 직접 센다 */
export type DashboardKpi = Readonly<{
  /** 최근 24시간 호출 수 */
  calls24h: number;
  /** 전일 대비 증감 %(소수 첫째 자리, 음수 가능). 전일 기록이 없으면 null */
  callsDeltaPct: number | null;
  /** 변환 성공률 %. 호출이 없으면 null */
  successRate: number | null;
  failedCalls: number;
  /** 평균 변환 시간 ms. 호출이 없으면 null */
  convertMs: number | null;
  /** 평균 원본 응답 시간 ms. 원본 응답을 받은 호출이 없으면 null */
  sourceMs: number | null;
}>;
/** 시간대 한 칸. hour는 서버 로컬 시(0~23 정수)라 시각 변환 대상이 아니다. 배열은 오래된 칸이 앞(24칸) */
export type HourlyBucket = Readonly<{ hour: number; calls: number; errors: number }>;
/** 많이 쓰인 도구 한 줄. 서버가 호출 수 내림차순 최대 6개를 준다 */
export type TopTool = Readonly<{ id: string; src: string; calls: number }>;
/** clientCalls는 { 모델 키: 최근 24시간 호출 수 } — 호출이 없는 모델은 키가 없다 */
export type DashboardSummary = Readonly<{
  kpi: DashboardKpi;
  hourly: readonly HourlyBucket[];
  clientCalls: Dict<number>;
  topTools: readonly TopTool[];
}>;

// ── 자동 탐색 GET /discovery/ (원본 화면의 작업 표 · 탐색 마법사) ──

export type JobStatus = Known<'scheduled' | 'running' | 'review' | 'done' | 'failed' | 'cancelled' | 'interrupted'>;
/** 작업 목록 한 줄(JobSummary 중 표가 읽는 것). seq · more는 목록에서 누수된 값이라 넣지 않는다 */
export type JobSummary = Readonly<{
  /** 10자 hex */
  id: string;
  name: string;
  status: JobStatus;
  opts: Readonly<{ git: boolean; crawl: boolean; base?: string; repo?: string }>;
  /** 예약 시각(scheduled일 때) — 앱 안에서는 epoch ms(서버는 epoch 초 — 탐색 훅에서 select로 바꾼다) */
  startAt: number | null;
  stats: Readonly<{ found: number }>;
  /** 찾은 API 수(범위 밖 제외) */
  apiCount: number;
  registered: number;
}>;
/** 마법사 "시연용 값 채우기" — 시연 계정 비밀번호가 평문으로 온다(시연용) */
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

// ── 자동 탐색 작업 GET /discovery/jobs/{id}/?after=<seq> · 쓰기(시작 · 중단 · 다시 탐색 · 등록 · 삭제) ──
// 시각: startAt은 앱 안에서 epoch ms(서버는 epoch 초). 경과 elapsed와 이벤트 t는 서버가 초(소수 첫째 자리)로 주는 소요 시간인데
// 앱 안에서는 ms다 — 둘 다 api/discoveryJob의 mergeJob이 받는 순간 한 번 바꾼다(필드 이름은 그대로)

/** 단계 하나의 상태 — wait 대기 · run 진행 · done 끝 · skip 안 함 · fail 실패 */
export type StageState = Known<'wait' | 'run' | 'done' | 'skip' | 'fail'>;
/** 단계 다섯 — 소스 분석 · 화면 탐색 · 교차 확인 · 호출 검증 · 결과 검토(옛 D_STAGES 순서, js/menu/discovery.js:8) */
export type StageKey = 'src' | 'web' | 'merge' | 'verify' | 'review';
export type JobStage = Readonly<Record<StageKey, StageState>>;

/** 서버가 센 수. 실행 중에는 pages · requests · blocked · skipped · controllers · found가 실시간 값이다 */
export type JobStats = Readonly<{
  pages?: number;
  requests?: number;
  blocked?: number;
  skipped?: number;
  controllers?: number;
  masked?: number;
  found?: number;
  both?: number;
  src?: number;
  tr?: number;
  /** 스테이징에서 부른 쓰기 API 수 */
  stgVerified?: number;
}>;

/** 작업을 시작한 설정 중 화면이 읽는 것. 비밀번호 · 토큰은 오지 않는다(서버 금고) */
export type JobOpts = Readonly<{
  git: boolean;
  crawl: boolean;
  base?: string;
  repo?: string;
  maxPages?: number;
  mask?: boolean;
  stg?: boolean;
  stgUrl?: string;
  /** 승인해 준 담당자 — 사용자가 입력해 서버에 저장한 값 */
  owner?: string;
}>;

/** 캡처 화면 위 강조 상자 — 화면 좌표(px)와 그때의 화면 크기 */
export type HlBox = Readonly<{ x: number; y: number; w: number; h: number; vw: number; vh: number }>;
/** act 누름 · skip 건너뜀. block은 서버가 보내지 않는다 */
export type HlKind = Known<'act' | 'skip' | 'block'>;
/** 네트워크 기록 태그 — 캡처 · 허용(로그인) · 범위 밖 · 차단 · 검증 · 스테이징 검증 · 검증 실패 · 파일 응답 · 없음(옛 D_TAG, js/menu/discovery.js:7) */
export type NetTagValue = Known<'cap' | 'allow' | 'out' | 'block' | 'ok' | 'stg' | 'err' | 'file' | 'nf'>;

type EventBase = Readonly<{
  seq: number;
  /** 작업 시작 뒤 지난 시간 — 앱 안에서는 ms(서버는 초) */
  t: number;
}>;
/** 준비 · 교차 확인 · 검증 같은 전체 단계와 메모 — 화면은 쓰지 않는다(옛 discApply도 버렸다) */
export type SysEvent = EventBase & Readonly<{ l: 'sys'; k: Known<'note' | 'stage'>; st?: string; msg?: string; det?: string }>;
export type GitStageEvent = EventBase & Readonly<{ l: 'git'; k: 'stage'; msg: string; det?: string }>;
/** 컨트롤러 파일에서 찾은 API — m이 비면 화면은 `*` */
export type GitFileApi = Readonly<{ m: string; path: string; dep: boolean }>;
export type GitFileEvent = EventBase &
  Readonly<{ l: 'git'; k: 'file'; f: string; dir: string; apis: readonly GitFileApi[]; note: string }>;
/** 화면 탐색 이벤트의 캡처 번호 — 그 이벤트 때 찍은 화면(작업의 shotSeq와 같은 번호 수열) */
type WebBase = EventBase & Readonly<{ l: 'web'; shot?: number }>;
export type WebPageEvent = WebBase & Readonly<{ k: 'page'; url: string; title: string; cnt: number; msg: string }>;
export type WebActEvent = WebBase & Readonly<{ k: 'act'; msg: string; hl?: HlBox; hlKind?: HlKind }>;
export type WebSkipEvent = WebBase & Readonly<{ k: 'skip'; msg: string; hl?: HlBox; hlKind?: HlKind }>;
/** 캡처한 요청. ms는 원본 응답 시간(ms — 서버도 ms) */
export type WebReqEvent = WebBase & Readonly<{ k: 'req'; m: string; p: string; tag: NetTagValue; code?: number; ms?: number }>;
export type WebDoneEvent = WebBase & Readonly<{ k: 'done'; cnt: number; msg: string }>;
/** 검증 호출. env가 stg면 스테이징에 보낸 것 */
export type VfyCallEvent = EventBase &
  Readonly<{ l: 'vfy'; k: 'call'; api: string; m: string; p: string; tag: NetTagValue; code?: number; ms?: number; env?: string }>;
export type JobEvent =
  | SysEvent
  | GitStageEvent
  | GitFileEvent
  | WebPageEvent
  | WebActEvent
  | WebSkipEvent
  | WebReqEvent
  | WebDoneEvent
  | VfyCallEvent;

export type RecommendKind = Known<'yes' | 'check' | 'no'>;
/** 파라미터 추론 한 줄. o/ot = 원본 이름 · 소스 타입, a/at = AI 이름 · 타입(a가 비면 AI에게 안 보임), obs = 관찰한 값, v = 헤더 고정 값 */
export type ApiParam = Readonly<{
  o: string;
  ot: string;
  a: string;
  at: string;
  loc: ParamLoc;
  rule: RuleName;
  v?: Scalar;
  obs?: readonly Scalar[];
}>;
/** 소스 근거 — sql · mapper는 매퍼까지 따라갔을 때만 */
export type ApiSource = Readonly<{
  file: string;
  line: number;
  /** 조각 언어(java · js 등) — 옛은 java만 강조했다 */
  lang: string;
  snippet: string;
  sql: string | null;
  mapper: string | null;
}>;
/** 트래픽 근거 — req · res는 HTTP 원문(가린 값 포함), res가 비면 blocked · file로 사유를 보인다 */
export type ApiTraffic = Readonly<{
  screen: string;
  samples: number;
  req: string;
  res: string;
  blocked: boolean;
  file: boolean;
}>;
/** 탐색이 찾은 API 하나(작업이 review · done일 때만 온다). tool이 null이면 AI 도구로 만들 수 없다 */
export type DiscoveryApi = Readonly<{
  id: string;
  m: string;
  path: string;
  mode: ToolMode;
  ev: EvidenceKind;
  title: string;
  tool: string | null;
  rec: RecommendKind;
  recNote: string;
  src: ApiSource | null;
  tr: ApiTraffic | null;
  verify: Verify;
  params: readonly ApiParam[];
}>;

/**
 * 작업 상세(폴링 응답). events는 seq > after인 것만 최대 600개, seq는 받은 마지막 이벤트(없으면 after 그대로),
 * more는 남은 이벤트가 더 있음. apis는 review · done일 때만
 */
export type JobView = Readonly<{
  id: string;
  name: string;
  status: JobStatus;
  stage: JobStage;
  /** 지금 하는 일(서버 문장) — 아직 없으면 null */
  act: string | null;
  opts: JobOpts;
  error: string | null;
  notes: readonly string[];
  registered: number;
  sourceId: string | null;
  /** 쓴 브라우저 이름 · 감지한 프레임워크 — 실행 중에 채워진다 */
  browser: string;
  framework: string;
  /** 예약 시각 — 앱 안에서는 epoch ms(서버는 epoch 초) */
  startAt: number | null;
  /** 마지막 캡처 번호(0이면 아직 없음) */
  shotSeq: number;
  events: readonly JobEvent[];
  seq: number;
  more: boolean;
  stats: JobStats;
  /** 작업 시작 뒤 지난 시간 — 앱 안에서는 ms(서버는 초) */
  elapsed: number;
  apis?: readonly DiscoveryApi[];
}>;

/** POST /discovery/jobs/ 본문 — 마법사 값 전체 + ban · approved, maxPages는 숫자(옛 js/menu/discovery.js:109 — 키 순서도 그대로) */
export type StartJobBody = Readonly<{
  name: string;
  base: string;
  start: string;
  account: string;
  password: string;
  git: boolean;
  repo: string;
  branch: string;
  token: string;
  framework: string;
  crawl: boolean;
  scope: string;
  exclude: string;
  readPost: string;
  maxPages: number;
  stg: boolean;
  stgUrl: string;
  mask: boolean;
  when: Known<'now' | 'at'>;
  /** HH:MM(서버 지역 시각) */
  startTime: string;
  owner: string;
  ok: boolean;
  ban: readonly string[];
  approved: boolean;
}>;

/** POST …/register/ 본문 */
export type RegisterBody = Readonly<{ ids: readonly string[] }>;
/** 등록 응답(201) — 원본 하나(새로 만들거나 같은 운영 주소의 것)와 그 원본의 도구 전체, 새로 더한 수, 로그인 방법을 알아냈는지 */
export type RegisterResult = Readonly<{
  source: Source;
  tools: readonly ToolRecord[];
  added: number;
  loginKnown: boolean;
}>;
