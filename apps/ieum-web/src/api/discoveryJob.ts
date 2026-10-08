// 자동 탐색 작업 한 건의 누적 모델 — 폴링 응답(JobView)을 이전 값에 더한다. 옛 discBlank · discApply · discSync(js/menu/discovery.js:118-139)
// 순수 함수만 둔다. 받은 객체는 고치지 않고 새로 만든다 — 새 이벤트가 없는 배열은 같은 참조로 둬서 그 줄들을 다시 그리지 않는다.
// 기록 배열은 응답 하나에 한 번만 복사한다: 이벤트는 최대 3000개라 이벤트마다 배열을 새로 만들면 700ms 폴링마다 수천 칸을 거듭 옮긴다.
// 그래서 한 응답의 새 줄은 이 파일 안에서 새로 만든 배열에 모은 뒤 이전 배열 뒤에 한 번 붙인다(받은 배열은 건드리지 않는다)
// 시각 단위는 받는 순간 여기서 맞춘다: 예약 시각 startAt epoch 초 → ms, 경과 elapsed · 이벤트 t 초 → ms(api/types 자동 탐색 절).
// 작업 요약(JobSummary — 개요의 작업 표 · 쓰기 응답)의 예약 시각도 여기 withMsStartAt 하나로 바꾼다
import { MS_PER_SEC, secToMs } from './time';
import type {
  DiscoveryApi,
  GitFileEvent,
  GitStageEvent,
  HlBox,
  HlKind,
  JobEvent,
  JobOpts,
  JobStage,
  JobStats,
  JobStatus,
  JobSummary,
  JobView,
  VfyCallEvent,
  WebReqEvent,
  WebSkipEvent,
} from './types';

/** 네트워크 기록 한 줄 — 캡처한 요청 · 검증 호출 · 건너뛴 동작(옛 d.log — discApply :126-128). 화면은 최근 250줄만 그린다 */
export type NetLogEntry = WebReqEvent | WebSkipEvent | VfyCallEvent;

/** 이벤트로 쌓는 것 */
export type JobTrail = Readonly<{
  log: readonly NetLogEntry[];
  /** Git 소스 분석에서 읽은 컨트롤러 파일 */
  files: readonly GitFileEvent[];
  /** Git 소스 분석 단계 문장 */
  gitStages: readonly GitStageEvent[];
  /** 헤드리스 브라우저가 마지막으로 연 화면 주소(운영 주소 기준) */
  pageUrl: string;
  /** 캡처 위 강조 상자와 종류 — 화면을 새로 열거나 화면 탐색이 끝나면 상자를 비운다 */
  hl: HlBox | null;
  hlKind: HlKind | null;
  /**
   * 마지막으로 받은 화면 탐색 이벤트의 캡처 번호(없으면 0) — 캡처 이미지 주소의 ?v=(app/discovery/shotUrl). 이미지는 캡처 번호를 가진
   * 이벤트가 올 때만 바뀌어 강조 상자와 늘 짝이다(옛 d.shot — js/menu/discovery.js:130,219). 크롤러가 누른 뒤 이벤트 없이 다시 찍은
   * 화면(서버 crawler._shot_quiet — 작업의 shotSeq)으로는 이미지를 바꾸지 않는다 — 바꾸면 상자가 다른 화면 위에 놓인다
   */
  shot: number;
}>;

/** 작업 화면이 그리는 값 — 마지막 응답의 필드 + 쌓은 이벤트 */
export type JobData = JobTrail &
  Readonly<{
    id: string;
    name: string;
    status: JobStatus;
    stage: JobStage;
    /** 지금 하는 일(서버 문장). 아직 없으면 빈 문자열(옛 esc(null)과 같다) */
    act: string;
    opts: JobOpts;
    stats: JobStats;
    /** 작업 시작 뒤 지난 시간(ms) — 서버 값 그대로 쓴다(브라우저가 세지 않는다) */
    elapsed: number;
    error: string | null;
    notes: readonly string[];
    registered: number;
    sourceId: string | null;
    browser: string;
    framework: string;
    /** 예약 시각(epoch ms) */
    startAt: number | null;
    /** 서버가 마지막으로 찍은 캡처 번호(이벤트 없이 찍은 것 포함) — 화면은 이미지에 이 번호가 아니라 trail의 shot을 쓴다 */
    shotSeq: number;
    /** 받은 마지막 이벤트 번호 — 다음 요청의 after */
    seq: number;
    /** 찾은 API — 작업이 review · done이 된 뒤의 응답부터 온다. 오지 않은 응답은 이전 값을 둔다(옛 :137) */
    apis?: readonly DiscoveryApi[];
  }>;

const EMPTY_TRAIL: JobTrail = Object.freeze({
  log: Object.freeze([]),
  files: Object.freeze([]),
  gitStages: Object.freeze([]),
  pageUrl: '',
  hl: null,
  hlKind: null,
  shot: 0,
});

/** 작업 요약의 예약 시각을 ms로(서버 epoch 초 — 옛 fmtAt(ts) js/menu/discovery.js:13,113). 개요 select와 쓰기 응답이 쓴다 */
export const withMsStartAt = (job: JobSummary): JobSummary => ({ ...job, startAt: secToMs(job.startAt) });

/** 서버가 초(소수 첫째 자리)로 주는 소요 시간 → ms. 서식은 초로 반올림해 옛 mmss(Math.round(s))와 같은 글자가 된다 */
const durationToMs = (sec: number): number => Math.round(sec * MS_PER_SEC);

const withMsTime = (event: JobEvent): JobEvent => ({ ...event, t: durationToMs(event.t) });

type Marks = Pick<JobTrail, 'pageUrl' | 'hl' | 'hlKind' | 'shot'>;

/** 화면 위치 · 강조 상자(옛 discApply :124-126,129) — 화면 탐색 이벤트만 바꾼다 */
function boxOf(marks: Marks, event: JobEvent & { l: 'web' }): Marks {
  switch (event.k) {
    case 'page':
      return { ...marks, pageUrl: event.url, hl: null };
    case 'act':
    case 'skip':
      return { ...marks, hl: event.hl ?? null, hlKind: event.hlKind ?? null };
    case 'done':
      return { ...marks, hl: null };
    default:
      return marks;
  }
}

/** 위에 더해 캡처 번호가 있는 이벤트면 그 번호로(옛 if (e.shot) d.shot = e.shot — :130) */
function markOf(marks: Marks, event: JobEvent): Marks {
  if (event.l !== 'web') return marks;
  const next = boxOf(marks, event);
  return event.shot ? { ...next, shot: event.shot } : next;
}

/** 기록 줄이 되는 이벤트 — 캡처한 요청 · 건너뜀 · 검증 호출(옛 :126-128). sys는 쓰지 않는다 */
function logEntryOf(event: JobEvent): NetLogEntry | null {
  if (event.l === 'vfy') return event;
  if (event.l === 'web' && (event.k === 'req' || event.k === 'skip')) return event;
  return null;
}

const appended = <T>(prev: readonly T[], added: readonly T[]): readonly T[] =>
  added.length === 0 ? prev : [...prev, ...added];

/** 이벤트 여럿을 순서대로 더한다. 새 줄은 이 함수가 만든 배열에 모아 이전 배열 뒤에 한 번 붙인다 */
function applyEvents(trail: JobTrail, events: readonly JobEvent[]): JobTrail {
  if (events.length === 0) return trail;
  const log: NetLogEntry[] = [];
  const files: GitFileEvent[] = [];
  const gitStages: GitStageEvent[] = [];
  let marks: Marks = trail;
  for (const event of events) {
    const entry = logEntryOf(event);
    if (entry) log.push(entry);
    if (event.l === 'git' && event.k === 'file') files.push(event);
    if (event.l === 'git' && event.k === 'stage') gitStages.push(event);
    marks = markOf(marks, event);
  }
  return {
    log: appended(trail.log, log),
    files: appended(trail.files, files),
    gitStages: appended(trail.gitStages, gitStages),
    pageUrl: marks.pageUrl,
    hl: marks.hl,
    hlKind: marks.hlKind,
    shot: marks.shot,
  };
}

/**
 * 응답 하나를 이전 값에 더한다(옛 discSync). 처음이면 prev 없이 부른다.
 * 필드는 응답 값으로 덮고, 새 이벤트(seq > after)만 쌓고, seq를 응답 값으로 둔다. 시각은 여기서 ms로 바꾼다
 */
export function mergeJob(prev: JobData | undefined, view: JobView): JobData {
  const trail = applyEvents(prev ?? EMPTY_TRAIL, view.events.map(withMsTime));
  return {
    ...trail,
    id: view.id,
    name: view.name,
    status: view.status,
    stage: view.stage,
    act: view.act ?? '',
    opts: view.opts,
    stats: view.stats,
    elapsed: durationToMs(view.elapsed),
    error: view.error,
    notes: view.notes,
    registered: view.registered,
    sourceId: view.sourceId,
    browser: view.browser,
    framework: view.framework,
    startAt: secToMs(view.startAt),
    shotSeq: view.shotSeq,
    seq: view.seq,
    apis: view.apis ?? prev?.apis,
  };
}
