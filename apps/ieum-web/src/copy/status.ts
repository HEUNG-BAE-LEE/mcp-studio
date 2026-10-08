// 상태 값 → 라벨 · 색의 뜻 lookup. 화면은 상태 맵을 따로 두지 않고 여기서만 찾는다(docs/DESIGN.md Copy `상태 값`)
// 모르는 값은 값 그대로 + mute로 그리고 개발 콘솔에 값마다 한 번만 경고한다 — 렌더를 멈추지 않는다

/** 상태 색의 뜻 — StatusChip · StatusDot · Tag가 같이 쓴다(DESIGN Colors) */
export type StatusTone = 'ok' | 'warn' | 'danger' | 'info' | 'mute';

/**
 * 네트워크 기록 태그 색의 뜻 — 상태 색 다섯에 기록 표식(flag, DESIGN Colors ⑤)을 더한 것.
 * flag가 StatusChip · StatusDot · Tag로 새지 않게 StatusTone에 넣지 않고 이 타입으로 따로 둔다
 */
export type NetTagTone = StatusTone | 'flag';

/** 상태 값을 가진 자원. 메뉴를 옮기며 더한다 */
export type StatusResource = 'log' | 'source' | 'tool' | 'job' | 'recommend';

export type StatusInfo = Readonly<{
  label: string;
  tone: StatusTone;
  /** 목록에 있는 값이면 true. false면 label은 값 그대로, tone은 mute */
  known: boolean;
}>;

export type NetTagInfo = Readonly<{
  label: string;
  tone: NetTagTone;
  /** 목록에 있는 값이면 true. false면 label은 값 그대로, tone은 mute */
  known: boolean;
}>;

type Entry<Tone extends NetTagTone> = Readonly<{ label: string; tone: Tone }>;

/** 호출 로그 상태(옛 js/menu/logs.js:3) */
type LogValue = 'ok' | 'err';
/** 원본 시스템 상태(옛 js/common/state.js:26) */
export type SourceStatusValue = 'ok' | 'review' | 'drift' | 'err';
/** 도구 상태(옛 js/common/state.js:27) */
export type ToolStatusValue = 'done' | 'review' | 'drift' | 'off';
/** 탐색 작업 상태(옛 js/menu/discovery.js:5) — 서버가 내지 않는 queued는 두지 않는다(옛 :9,19 폴링 판정에만 남는다) */
export type JobStatusValue = 'scheduled' | 'running' | 'review' | 'done' | 'failed' | 'cancelled' | 'interrupted';
/** 탐색 결과 추천(옛 js/menu/discovery.js:10) */
export type RecommendValue = 'yes' | 'check' | 'no';
/** 탐색 네트워크 기록 태그(옛 js/menu/discovery.js:7) */
export type NetTagValue = 'cap' | 'allow' | 'out' | 'block' | 'ok' | 'stg' | 'err' | 'file' | 'nf';

type ValuesOf = {
  log: LogValue;
  source: SourceStatusValue;
  tool: ToolStatusValue;
  job: JobStatusValue;
  recommend: RecommendValue;
};

const TABLE: { readonly [R in StatusResource]: Readonly<Record<ValuesOf[R], Entry<StatusTone>>> } = {
  log: {
    ok: { label: '성공', tone: 'ok' },
    err: { label: '실패', tone: 'danger' },
  },
  source: {
    ok: { label: '정상', tone: 'ok' },
    review: { label: '검토 필요', tone: 'warn' },
    drift: { label: '명세 변경 감지', tone: 'warn' },
    err: { label: '인증 만료', tone: 'danger' },
  },
  tool: {
    done: { label: '공개 중', tone: 'ok' },
    review: { label: '검토 필요', tone: 'warn' },
    drift: { label: '명세 변경', tone: 'warn' },
    off: { label: '제외', tone: 'mute' },
  },
  job: {
    scheduled: { label: '예약됨', tone: 'info' },
    running: { label: '탐색 중', tone: 'info' },
    review: { label: '검토 대기', tone: 'warn' },
    done: { label: '등록 완료', tone: 'ok' },
    failed: { label: '실패', tone: 'danger' },
    cancelled: { label: '취소됨', tone: 'mute' },
    interrupted: { label: '중단됨', tone: 'danger' },
  },
  recommend: {
    yes: { label: '등록 추천', tone: 'ok' },
    check: { label: '확인 필요', tone: 'warn' },
    no: { label: '제외 추천', tone: 'mute' },
  },
};

/** 네트워크 기록 태그 — 자원 상태가 아니라 기록 줄 표식이라 statusOf 밖에 따로 둔다(allow의 flag 때문) */
const NET_TAG_TABLE: Readonly<Record<NetTagValue, Entry<NetTagTone>>> = {
  cap: { label: '캡처', tone: 'info' },
  allow: { label: '허용 (로그인)', tone: 'flag' },
  out: { label: '범위 밖', tone: 'mute' },
  block: { label: '차단', tone: 'danger' },
  ok: { label: '검증', tone: 'ok' },
  stg: { label: '스테이징 검증', tone: 'ok' },
  err: { label: '검증 실패', tone: 'danger' },
  file: { label: '파일 응답', tone: 'warn' },
  nf: { label: '없음', tone: 'warn' },
};

/** 자원별 아는 값 목록 — 카탈로그가 전 값을 늘어놓는 데 쓴다 */
export const STATUS_VALUES: { readonly [R in StatusResource]: readonly ValuesOf[R][] } = {
  log: ['ok', 'err'],
  source: ['ok', 'review', 'drift', 'err'],
  tool: ['done', 'review', 'drift', 'off'],
  job: ['scheduled', 'running', 'review', 'done', 'failed', 'cancelled', 'interrupted'],
  recommend: ['yes', 'check', 'no'],
};

/** 네트워크 기록 태그의 아는 값 목록 — NetLog 카탈로그가 전 값을 늘어놓는 데 쓴다 */
export const NET_TAG_VALUES: readonly NetTagValue[] = ['cap', 'allow', 'out', 'block', 'ok', 'stg', 'err', 'file', 'nf'];

const warned = new Set<string>();

/** 같은 메시지는 한 번만 개발 콘솔에 경고한다 — 메시지 자체가 중복 판정 키다. 다른 copy 모듈도 같은 코드를 쓴다 */
export function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

const hasOwn = (record: object, key: string): boolean => Object.prototype.hasOwnProperty.call(record, key);

/** 표에서 값을 찾는다. 모르는 값은 값 그대로 + mute + known false + 개발 콘솔 경고 한 번 — statusOf · netTagOf가 같은 폴백을 쓴다 */
function lookup<Tone extends NetTagTone>(
  table: Readonly<Record<string, Entry<Tone>>>,
  kind: string,
  value: string,
): Readonly<{ label: string; tone: Tone | 'mute'; known: boolean }> {
  const entry = hasOwn(table, value) ? table[value] : undefined;
  if (entry) return { label: entry.label, tone: entry.tone, known: true };
  warnOnce(`알 수 없는 ${kind} 상태 값: ${value}`);
  return { label: value, tone: 'mute', known: false };
}

/** 자원 · 값으로 라벨 · tone을 찾는다. 모르는 값은 값 그대로 + mute + known false */
export function statusOf(resource: StatusResource, value: string): StatusInfo {
  return lookup<StatusTone>(TABLE[resource], resource, value);
}

/** 네트워크 기록 태그 값으로 라벨 · tone을 찾는다. 폴백은 statusOf와 같다 — 모르는 값은 값 그대로 + mute + known false */
export function netTagOf(value: string): NetTagInfo {
  return lookup<NetTagTone>(NET_TAG_TABLE, 'netTag', value);
}
