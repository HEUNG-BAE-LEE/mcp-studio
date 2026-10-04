// apps/web/src/api/dummy/data/notifications.ts — 시나리오별 알림(기본 5장 + 나머지 코드 자리). since는 오늘 기준(본문 "11:20" · "오늘 03:00")
import type { Notification, NotificationGroups } from '../../types';
import type { Scenario } from '../scenario';
import { con, daysFromNow, src, todayAt, type Subject } from './seed';

const PROJECT = 'project_2';
const KEY_EXPIRES_IN_DAYS = 5;

type Target = Notification['actionTarget'];
const source = (id: string, tab: NonNullable<Target['tab']>): Target => ({
  screen: 'source',
  projectId: PROJECT,
  id,
  tab,
});
const connector = (id: string, projectId = PROJECT): Target => ({
  screen: 'connector',
  projectId,
  id,
});

const n = (
  code: string,
  severity: Notification['severity'],
  count: number,
  subjects: Subject[],
  actionTarget: Target,
  since: string,
  meta?: Notification['meta'],
): Notification => ({
  code,
  severity,
  count,
  subjects,
  actionTarget,
  since,
  ...(meta ? { meta } : {}),
});

// 알림 패널 기본 5장(원문은 copy/notifications.ts 틀이 재현)
const AUTH_FAILED = n(
  'SOURCE_AUTH_FAILED',
  'action',
  1,
  [src('src_3', '코어뱅킹 API')],
  source('src_3', 'connection'),
  todayAt('11:20'),
);
const OBJECT_TYPE_PENDING = n(
  'OBJECT_TYPE_PENDING',
  'action',
  2,
  [src('src_1', '계약 원장 DB')],
  { screen: 'ontology', id: 'src_1' },
  todayAt('09:00'),
);
const CONNECTOR_DRAFT = n(
  'CONNECTOR_DRAFT',
  'action',
  1,
  [con('db_connector_copy', '계약 조회 커넥터 (복제)')],
  connector('db_connector_copy'),
  todayAt('10:12'),
  { reason: 'NAME_DUPLICATE' },
);
const INGEST_RUNNING = n(
  'INGEST_RUNNING',
  'progress',
  1,
  [src('src_2', '인수지침 문서')],
  source('src_2', 'status'),
  todayAt('09:41'),
  { phase: 'embedding', percent: 62, remainingMinutes: 4 },
);
const INGEST_DONE = n(
  'INGEST_DONE',
  'recent',
  1,
  [src('src_1', '계약 원장 DB')],
  source('src_1', 'status'),
  todayAt('03:00'),
  { objectTypes: 12 },
);

// 나머지 12코드 — alerts-risk 시나리오에서 틀 17종을 전부 본다
const EXTRA_ACTION: readonly Notification[] = [
  n(
    'SOURCE_INGEST_FAILED',
    'action',
    1,
    [src('src_5', '청구 이력 DB')],
    source('src_5', 'status'),
    todayAt('07:30'),
  ),
  n(
    'INGEST_OVERDUE',
    'action',
    1,
    [src('src_6', '민원 이력 DB')],
    source('src_6', 'status'),
    todayAt('04:10'),
    { scheduledAt: todayAt('03:00') },
  ),
  n(
    'SCHEMA_CHANGED',
    'action',
    1,
    [src('src_1', '계약 원장 DB')],
    source('src_1', 'status'),
    todayAt('08:05'),
  ),
  n(
    'ACCESS_KEY_EXPIRING',
    'action',
    1,
    [src('src_7', '상품 약관 저장소')],
    source('src_7', 'connection'),
    daysFromNow(-1),
    { expiresAt: daysFromNow(KEY_EXPIRES_IN_DAYS) },
  ),
  n(
    'CALL_ERROR_RATE',
    'action',
    1,
    [con('db_connector', '계약 조회 커넥터')],
    connector('db_connector'),
    daysFromNow(-2),
    { percent: 12 },
  ),
  n(
    'PROCESS_FAILED',
    'action',
    1,
    [src('src_8', '재보험 정산 원장')],
    { screen: 'pipeline', id: 'src_8' },
    todayAt('06:20'),
  ),
];
const EXTRA_PROGRESS: readonly Notification[] = [
  n(
    'SOURCE_CREATING',
    'progress',
    1,
    [src('src_9', '해외 지점 원장')],
    source('src_9', 'status'),
    todayAt('10:40'),
  ),
  n(
    'PROCESS_RUNNING',
    'progress',
    1,
    [src('src_5', '청구 이력 DB')],
    source('src_5', 'status'),
    todayAt('10:55'),
  ),
  n(
    'INGEST_SKIPPED',
    'progress',
    1,
    [src('src_2', '인수지침 문서')],
    source('src_2', 'status'),
    todayAt('03:00'),
  ),
];
const EXTRA_RECENT: readonly Notification[] = [
  n(
    'SOURCE_READY',
    'recent',
    1,
    [src('src_10', '영업 교육 문서')],
    source('src_10', 'status'),
    todayAt('02:15'),
  ),
  n(
    'CONNECTOR_PUBLISHED',
    'recent',
    1,
    [con('terms_search', '약관 검색 커넥터')],
    connector('terms_search', 'project_7'),
    todayAt('01:30'),
  ),
  n(
    'KEY_ROTATED',
    'recent',
    1,
    [src('src_11', '지급 통계 DB')],
    source('src_11', 'status'),
    todayAt('00:45'),
  ),
];

const EMPTY: NotificationGroups = { action: [], progress: [], recent: [] };
const DEFAULT_GROUPS: NotificationGroups = {
  action: [AUTH_FAILED, OBJECT_TYPE_PENDING, CONNECTOR_DRAFT],
  progress: [INGEST_RUNNING],
  recent: [INGEST_DONE],
};
/** 시나리오별 알림. 항목이 없는 시나리오는 default로 떨어진다(notificationsOf) */
const NOTIFICATIONS: Readonly<Partial<Record<Scenario, NotificationGroups>>> = {
  default: DEFAULT_GROUPS,
  'no-calls': DEFAULT_GROUPS,
  'no-alerts': EMPTY,
  empty: EMPTY,
  'empty-guide': EMPTY,
  'no-connectors': DEFAULT_GROUPS,
  ingesting: DEFAULT_GROUPS,
  'alerts-risk': {
    action: [AUTH_FAILED, OBJECT_TYPE_PENDING, CONNECTOR_DRAFT, ...EXTRA_ACTION],
    progress: [INGEST_RUNNING, ...EXTRA_PROGRESS],
    recent: [INGEST_DONE, ...EXTRA_RECENT],
  },
  'alerts-warn': {
    action: [OBJECT_TYPE_PENDING, CONNECTOR_DRAFT],
    progress: [INGEST_RUNNING],
    recent: [INGEST_DONE],
  },
};
export const notificationsOf = (scenario: Scenario): NotificationGroups =>
  NOTIFICATIONS[scenario] ?? DEFAULT_GROUPS;
