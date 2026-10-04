// apps/web/src/copy/notifications.ts — 알림 문구 틀. 서버는 code · count · subjects · since · meta만 준다
import type { NoticeTone } from '@/ui';
import type { Notification, NotificationGroups } from '../api/types';
import { aboutMinutesLabel, countUnitLabel, formatPercentInt } from './format';
import { PHASE_LABEL } from './status';
import { hhmm, mmdd, relativeDayTime } from './time';
import { warnOnce } from './warnOnce';

type NotificationGroup = 'action' | 'progress' | 'recent';
type FormatContext = { now: Date };
export type FormattedNotification = {
  code: string;
  tone: NoticeTone;
  title: string;
  body: string;
  link: string | null;
};

type Template = {
  group: NotificationGroup;
  tone: NoticeTone;
  title: (n: Notification) => string;
  body: (n: Notification, ctx: FormatContext) => string;
  link: string;
};

/** `오늘 03:00` · `어제 23:10` · `09-05 08:00` — copy/time의 relativeDayTime */
const dayTime = relativeDayTime;

const names = (n: Notification) => n.subjects.map((s) => s.name).join(' · ');
const count = (n: Notification) => countUnitLabel(n.count, '건');
const meta = (n: Notification) => n.meta ?? {};
const DRAFT_REASON: Readonly<Record<string, string>> = {
  NAME_DUPLICATE: '이름이 원본과 같아 호출 로그에서 구분되지 않는다.',
};
const DRAFT_DEFAULT = '발행 전이라 호출할 수 없다.';
const LINK_STATUS = '상태 · 수집 열기 →';
const LINK_CONNECTION = '접속 정보 열기 →';
const LINK_CONNECTOR = '커넥터 열기 →';
const LINK_OUTPUT = '산출물 보기 →';

const template = (
  group: NotificationGroup,
  tone: NoticeTone,
  title: (n: Notification) => string,
  body: Template['body'],
  link: string,
): Template => ({ group, tone, title, body, link });

const NOTIFICATION_COPY: Readonly<Record<string, Template>> = {
  // 처리 필요
  SOURCE_AUTH_FAILED: template(
    'action',
    'risk',
    (n) => `인증 실패 소스 ${count(n)}`,
    (n) => `${names(n)}. 인증이 거절돼 ${hhmm(n.since)} 이후 멈춰 있다.`,
    LINK_CONNECTION,
  ),
  SOURCE_INGEST_FAILED: template(
    'action',
    'risk',
    (n) => `수집 실패 소스 ${count(n)}`,
    (n) => `${names(n)}. ${hhmm(n.since)} 수집 실패 뒤 멈춰 있다.`,
    LINK_STATUS,
  ),
  INGEST_OVERDUE: template(
    'action',
    'warn',
    (n) => `수집 예정이 지난 소스 ${count(n)}`,
    (n) => `${names(n)}. 예정 ${hhmm(meta(n).scheduledAt ?? n.since)}, 아직 시작하지 않았다.`,
    LINK_STATUS,
  ),
  OBJECT_TYPE_PENDING: template(
    'action',
    'warn',
    (n) => `객체 타입 승인 대기 ${count(n)}`,
    (n) => `${names(n)}에서 추론한 제안을 사람이 확인해야 한다.`,
    '온톨로지 매니저 열기 →',
  ),
  SCHEMA_CHANGED: template(
    'action',
    'warn',
    (n) => `원본 구조가 바뀐 소스 ${count(n)}`,
    (n) => `${names(n)}. 표 · 열 변경을 확인해야 한다.`,
    LINK_STATUS,
  ),
  ACCESS_KEY_EXPIRING: template(
    'action',
    'warn',
    (n) => `접속 키 만료 임박 ${count(n)}`,
    (n) => `${names(n)}. ${mmdd(meta(n).expiresAt ?? n.since)} 만료 예정.`,
    LINK_CONNECTION,
  ),
  CALL_ERROR_RATE: template(
    'action',
    'risk',
    (n) => `호출 오류율 초과 커넥터 ${count(n)}`,
    (n) => `${names(n)}. 7일 오류율 ${formatPercentInt(meta(n).percent ?? 0)}.`,
    '호출 로그 열기 →',
  ),
  CONNECTOR_DRAFT: template(
    'action',
    'info',
    (n) => `발행하지 않은 커넥터 ${count(n)}`,
    (n) => `${names(n)} · ${DRAFT_REASON[meta(n).reason ?? ''] ?? DRAFT_DEFAULT}`,
    LINK_CONNECTOR,
  ),
  PROCESS_FAILED: template(
    'action',
    'risk',
    (n) => `가공이 멈춘 소스 ${count(n)}`,
    (n) => `${names(n)}. 수집은 끝났지만 가공이 멈췄다. 산출물은 이전 것이 남아 있다.`,
    '파이프라인 열기 →',
  ),
  // 진행 중
  SOURCE_CREATING: template(
    'progress',
    'going',
    (n) => `연결 준비 중인 소스 ${count(n)}`,
    (n) => `${names(n)}. 첫 수집을 준비하고 있다.`,
    LINK_STATUS,
  ),
  INGEST_RUNNING: template(
    'progress',
    'going',
    (n) => `수집 중인 소스 ${count(n)}`,
    (n) => {
      const m = meta(n);
      if (m.percent === undefined) return `${names(n)} · 수집 중.`;
      const phase = PHASE_LABEL[m.phase ?? 'ingest'] ?? '수집';
      const remain =
        m.remainingMinutes === undefined ? '' : ` ${aboutMinutesLabel(m.remainingMinutes)} 남았다.`;
      return `${names(n)} · ${phase} ${formatPercentInt(m.percent)}.${remain}`;
    },
    LINK_STATUS,
  ),
  PROCESS_RUNNING: template(
    'progress',
    'going',
    (n) => `가공 중인 소스 ${count(n)}`,
    (n) => `${names(n)}. 수집한 데이터를 가공하고 있다.`,
    LINK_STATUS,
  ),
  // 지난 24시간(INGEST_SKIPPED는 진행 중 — 맨 아래)
  SOURCE_READY: template(
    'recent',
    'done',
    (n) => `첫 수집을 마친 소스 ${count(n)}`,
    (n, ctx) => `${names(n)} · ${dayTime(n.since, ctx.now)} 수집. 산출물을 확인할 수 있다.`,
    LINK_OUTPUT,
  ),
  INGEST_DONE: template(
    'recent',
    'done',
    (n) => `정기 수집 완료 ${count(n)}`,
    (n, ctx) => {
      const objectTypes = meta(n).objectTypes;
      return `${names(n)} · ${dayTime(n.since, ctx.now)} 수집.${objectTypes === undefined ? '' : ` 객체 타입 ${countUnitLabel(objectTypes, '개')}.`}`;
    },
    LINK_OUTPUT,
  ),
  CONNECTOR_PUBLISHED: template(
    'recent',
    'done',
    (n) => `발행한 커넥터 ${count(n)}`,
    (n, ctx) => `${names(n)} · ${dayTime(n.since, ctx.now)} 발행.`,
    LINK_CONNECTOR,
  ),
  KEY_ROTATED: template(
    'recent',
    'done',
    (n) => `접속 키를 교체한 소스 ${count(n)}`,
    (n) => `${names(n)} · 교체 뒤 첫 수집에 성공했다.`,
    LINK_STATUS,
  ),
  // 건너뜀은 진행 중 묶음(이전 수집이 아직 도는 상태)
  INGEST_SKIPPED: template(
    'progress',
    'going',
    (n) => `수집을 건너뛴 소스 ${count(n)}`,
    (n, ctx) =>
      `${names(n)} · ${dayTime(n.since, ctx.now)} 예정. 이전 수집이 아직 돌고 있어 건너뛰었다.`,
    LINK_STATUS,
  ),
};

// 알림 종류는 상태 값이 아니다 — 칩으로 그리지 않는다. 알림 목록 · 패널이 같은 명사형 라벨을 쓴다
// 상태 어휘와 맞춘다(커넥터는 `미발행` — `발행 전 커넥터`로 쓰지 않는다)
const NOTIFICATION_KIND: Readonly<Record<string, string>> = {
  SOURCE_AUTH_FAILED: '인증 실패',
  SOURCE_INGEST_FAILED: '수집 실패',
  INGEST_OVERDUE: '수집 지연',
  OBJECT_TYPE_PENDING: '승인 대기',
  SCHEMA_CHANGED: '구조 변경',
  ACCESS_KEY_EXPIRING: '키 만료 임박',
  CALL_ERROR_RATE: '호출 오류율 초과',
  CONNECTOR_DRAFT: '미발행 커넥터',
  PROCESS_FAILED: '가공 중단',
  SOURCE_CREATING: '연결 준비',
  INGEST_RUNNING: '수집 중',
  PROCESS_RUNNING: '가공 중',
  SOURCE_READY: '첫 수집 완료',
  INGEST_DONE: '정기 수집 완료',
  CONNECTOR_PUBLISHED: '커넥터 발행',
  KEY_ROTATED: '키 교체',
  INGEST_SKIPPED: '수집 건너뜀',
};
/** 알림 code → 종류 라벨(명사형). 모르는 code는 경고 + 기본 틀 */
export function notificationKindLabel(code: string): string {
  const known = NOTIFICATION_KIND[code];
  if (known) return known;
  warnOnce(`notification-kind:${code}`, `[copy] 모르는 알림 코드 ${code} — 종류 라벨 없음`);
  return `알 수 없는 알림 · ${code}`;
}

/** 알림 수 색은 처리 필요 가운데 실패가 하나라도 있으면 fix */
const RISK_CODES = new Set([
  'SOURCE_AUTH_FAILED',
  'SOURCE_INGEST_FAILED',
  'CALL_ERROR_RATE',
  'PROCESS_FAILED',
]);

export function formatNotification(n: Notification, ctx: FormatContext): FormattedNotification {
  const t = NOTIFICATION_COPY[n.code];
  if (!t) {
    warnOnce(`notification:${n.code}`, `[copy] 모르는 알림 코드 ${n.code} — 기본 틀로 그립니다`);
    return {
      code: n.code,
      tone: 'info',
      title: `알 수 없는 알림 · ${n.code}`,
      body: names(n),
      link: null,
    };
  }
  return { code: n.code, tone: t.tone, title: t.title(n), body: t.body(n, ctx), link: t.link };
}

/** 패널 순서: 처리 필요 → 진행 중 → 지난 24시간(그룹 헤더 없음) */
export const flattenNotifications = (g: NotificationGroups): Notification[] => [
  ...g.action,
  ...g.progress,
  ...g.recent,
];

type AlertSummary = { count: number; tone: 'fix' | 'progress' };
/** 알림 수 = 처리 필요 **항목 수**. 0이면 null → 표식 없음 */
export function alertSummary(groups: NotificationGroups | undefined): AlertSummary | null {
  if (!groups || groups.action.length === 0) return null;
  return {
    count: groups.action.length,
    tone: groups.action.some((a) => RISK_CODES.has(a.code)) ? 'fix' : 'progress',
  };
}
