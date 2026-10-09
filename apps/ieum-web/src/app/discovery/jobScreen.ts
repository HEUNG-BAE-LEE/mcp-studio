// 작업 화면 · 작업 표가 상태에서 고르는 것 — 순수 함수만 둔다(옛 js/menu/discovery.js 화면 함수의 판단 부분). 문구는 copy/discovery
import type { JobData, NetLogEntry } from '../../api/discoveryJob';
import type { JobOpts, JobStage, JobStats, JobStatus, JobSummary, StageKey, StageState } from '../../api/types';
import { withoutScheme } from '../convert/url';

/** 최대 화면 수가 설정에 없을 때 — 서버 기본과 같다(옛 `|| 50` — :35,185) */
export const FALLBACK_MAX_PAGES = 50;
/** 네트워크 기록은 최근 이만큼만 그린다(옛 :194). 전체는 쿼리 데이터에 남는다 */
export const MAX_LOG_ROWS = 250;
const PERCENT = 100;

/** 단계 줄 순서(옛 D_STAGES :8) */
export const STAGE_KEYS: readonly StageKey[] = ['src', 'web', 'merge', 'verify', 'review'];

/** 단계 상태 — 비었으면 대기(옛 :179) */
export const stageStateOf = (stage: JobStage, key: StageKey): StageState => stage[key] || 'wait';

// ── 화면 모습 ──

/** 실시간(예약 · 대기 · 탐색 중) · 종료(실패 · 취소 · 중단) · 결과 검토(그 밖 — 검토 대기 · 등록 완료 · 모르는 값)(옛 vDisc :262-264) */
export type JobViewKind = 'live' | 'ended' | 'result';
const LIVE_STATUSES: ReadonlySet<string> = new Set(['running', 'scheduled', 'queued']);
const ENDED_STATUSES: ReadonlySet<string> = new Set(['failed', 'cancelled', 'interrupted']);

export function viewOf(status: JobStatus): JobViewKind {
  if (LIVE_STATUSES.has(status)) return 'live';
  return ENDED_STATUSES.has(status) ? 'ended' : 'result';
}

/** 실시간 화면의 동작 줄 · 캡처 전 자리가 고르는 갈래 — running 스피너 · scheduled 예약 시각 · idle 그 밖(옛 :213,227) */
export type LiveMode = 'running' | 'scheduled' | 'idle';
export function liveModeOf(status: JobStatus): LiveMode {
  if (status === 'running') return 'running';
  return status === 'scheduled' ? 'scheduled' : 'idle';
}

/** 머리 오른쪽 버튼 — 탐색 중 "탐색 중단" · 예약됨 "예약 취소" · 그 밖(queued 포함) "같은 설정으로 다시 탐색"(옛 :254-255) */
export type HeadAction = 'cancel' | 'cancelScheduled' | 'rerun';
export function headActionOf(status: JobStatus): HeadAction {
  if (status === 'running') return 'cancel';
  return status === 'scheduled' ? 'cancelScheduled' : 'rerun';
}

/** "탐색 중" 점멸 — 탐색 중이고 화면 탐색 단계가 진행 중일 때만(옛 :235,246) */
export const isCrawlingNow = (job: Pick<JobData, 'status' | 'stage'>): boolean =>
  job.status === 'running' && job.stage.web === 'run';

/** 작업 표 "찾은 API" — 검토 대기 · 등록 완료는 찾은 API 수, 탐색 중은 실시간 수, 그 밖은 null(값 없음 표기)(옛 :20) */
export function foundOf(job: JobSummary): number | null {
  if (job.status === 'review' || job.status === 'done') return job.apiCount;
  return job.status === 'running' ? job.stats.found : null;
}

/** 카운터 여섯 칸 — 쓰지 않은 쪽(화면 탐색 · Git)의 칸은 null(값 없음 표기). 차단이 하나라도 있으면 위험색(옛 dCounters :182-191) */
export type Counters = Readonly<{
  pages: number | null;
  maxPages: number;
  requests: number | null;
  controllers: number | null;
  found: number;
  blocked: number | null;
  skipped: number | null;
  isBlockedAlert: boolean;
}>;

export function countersOf(stats: JobStats, opts: JobOpts): Counters {
  const crawl = (value: number | undefined) => (opts.crawl ? (value ?? 0) : null);
  return {
    pages: crawl(stats.pages),
    maxPages: opts.maxPages || FALLBACK_MAX_PAGES,
    requests: crawl(stats.requests),
    controllers: opts.git ? (stats.controllers ?? 0) : null,
    found: stats.found ?? 0,
    blocked: crawl(stats.blocked),
    skipped: crawl(stats.skipped),
    isBlockedAlert: Boolean(stats.blocked),
  };
}

// ── 실시간 화면 칸 ──

/** 브라우저 주소 줄 — 운영 주소(스킴 뗌) + 화면 주소(http로 시작하는 절대 주소면 붙이지 않는다)(옛 dShownUrl :209) */
export const shownUrl = (base: string | undefined, pageUrl: string): string =>
  withoutScheme(base ?? '') + (pageUrl.startsWith('http') ? '' : pageUrl);

/** 그릴 기록 줄 — 최근 MAX_LOG_ROWS줄. 줄 key는 seq(새로 붙은 줄만 등장 모션) */
export const recentLog = (log: readonly NetLogEntry[]): readonly NetLogEntry[] => log.slice(-MAX_LOG_ROWS);

/** 캡처 위 강조 상자 — 위치 · 크기는 캡처 크기에 대한 퍼센트, 종류는 건너뜀이 아니면 누름 */
export type Highlight = Readonly<{ kind: 'act' | 'skip'; left: number; top: number; width: number; height: number }>;

/**
 * 강조 상자 — 상자가 있고 캡처가 하나라도 있을 때만(옛 d.hl && d.shot — js/menu/discovery.js:221). 이미지도 이벤트의 캡처 번호로만 바뀌므로
 * 상자와 이미지는 늘 짝이다(JobTrail shot)
 */
export function highlightOf(job: Pick<JobData, 'hl' | 'hlKind' | 'shot'>): Highlight | null {
  const { hl } = job;
  if (hl === null || job.shot <= 0) return null;
  return {
    kind: job.hlKind === 'skip' ? 'skip' : 'act',
    left: (hl.x / hl.vw) * PERCENT,
    top: (hl.y / hl.vh) * PERCENT,
    width: (hl.w / hl.vw) * PERCENT,
    height: (hl.h / hl.vh) * PERCENT,
  };
}
