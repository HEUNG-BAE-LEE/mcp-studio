// 상태 값 → 라벨 · 색의 뜻 lookup. 화면은 상태 맵을 따로 두지 않고 여기서만 찾는다(docs/DESIGN.md Copy `상태 값`)
// 모르는 값은 값 그대로 + mute로 그리고 개발 콘솔에 값마다 한 번만 경고한다 — 렌더를 멈추지 않는다

/** 상태 색의 뜻 — StatusChip · StatusDot · Tag가 같이 쓴다(DESIGN Colors) */
export type StatusTone = 'ok' | 'warn' | 'danger' | 'info' | 'mute';

/** 상태 값을 가진 자원. 메뉴를 옮기며 더한다 */
export type StatusResource = 'log' | 'source';

export type StatusInfo = Readonly<{
  label: string;
  tone: StatusTone;
  /** 목록에 있는 값이면 true. false면 label은 값 그대로, tone은 mute */
  known: boolean;
}>;

type Entry = Readonly<{ label: string; tone: StatusTone }>;

/** 호출 로그 상태(옛 js/menu/logs.js:3) */
type LogValue = 'ok' | 'err';
/** 원본 시스템 상태(옛 js/common/state.js:26) */
export type SourceStatusValue = 'ok' | 'review' | 'drift' | 'err';

type ValuesOf = {
  log: LogValue;
  source: SourceStatusValue;
};

const TABLE: { readonly [R in StatusResource]: Readonly<Record<ValuesOf[R], Entry>> } = {
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
};

/** 자원별 아는 값 목록 — 카탈로그가 전 값을 늘어놓는 데 쓴다 */
export const STATUS_VALUES: { readonly [R in StatusResource]: readonly ValuesOf[R][] } = {
  log: ['ok', 'err'],
  source: ['ok', 'review', 'drift', 'err'],
};

const warned = new Set<string>();

/** 같은 메시지는 한 번만 개발 콘솔에 경고한다 — 메시지 자체가 중복 판정 키다. 다른 copy 모듈도 같은 코드를 쓴다 */
export function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

const hasOwn = (record: object, key: string): boolean => Object.prototype.hasOwnProperty.call(record, key);

/** 자원 · 값으로 라벨 · tone을 찾는다. 모르는 값은 값 그대로 + mute + known false */
export function statusOf(resource: StatusResource, value: string): StatusInfo {
  const table: Readonly<Record<string, Entry>> = TABLE[resource];
  const entry = hasOwn(table, value) ? table[value] : undefined;
  if (entry) return { label: entry.label, tone: entry.tone, known: true };
  warnOnce(`알 수 없는 ${resource} 상태 값: ${value}`);
  return { label: value, tone: 'mute', known: false };
}
