// apps/web/src/copy/sourceSettings.ts — 소스 설정 모달 문장(탭 · 상태 행 · 잠긴 사유 · 액션). 서버는 SourceDetail의 code · 값만 준다
import type { SourceDetail, SourceStatus, ToolGroupKind } from '../api/types';
import { CANCEL_LABEL, TAGS_LABEL } from './common';
import { aboutMinutesLabel, countUnitLabel, formatCount, formatPercentInt } from './format';
import { sourceSummary } from './output';
import { PENDING } from './pending';
import { sourceStatusOf } from './status';
import { warnOnce } from './warnOnce';
import { dateTimeLabel } from './time';

/** 탭 순서. URL `?tab=` 해석(useSettingsParam)도 이 목록을 쓴다 */
export const SETTINGS_TABS = ['status', 'connection', 'connector', 'info'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];
export type SettingsAction = 'reingest' | 'stop' | 'rotateKey' | 'createConnector' | 'save';
type StateRow = readonly [key: string, value: string];
const SEP = ' · ';
const NO_RECORD = '기록 없음';
const dateTime = (iso?: string | null) => (iso ? dateTimeLabel(iso) : NO_RECORD);
const FILE_FORMAT: Readonly<Record<string, string>> = {
  pdf: 'PDF',
  docx: 'DOCX',
  xlsx: 'XLSX',
  mixed: '파일',
};
const FIELD: Readonly<Record<string, string>> = {
  host: '접속 주소',
  schema: '스키마',
  account: '읽기 계정',
  secret: '접속 키',
  dsn: '연결 문자열',
  files: '올린 파일',
  chunk: '자르는 단위',
  storage: '보관 위치',
  dir: '폴더 경로',
  path: '하위 경로',
  repo: '저장소 주소',
  branch: '브랜치',
  token: '읽기 권한 키',
  svc: '이 서비스 주소',
  dburl: '데이터베이스 연결',
};
const TOOL: Readonly<Record<ToolGroupKind, string>> = {
  query: '조회',
  aggregate: '집계',
  write: '쓰기',
};
const FIX: ReadonlySet<SourceStatus> = new Set(['auth_failed', 'ingest_failed']);
const WAIT: ReadonlySet<SourceStatus> = new Set(['ready', 'ingesting', 'processing']);
const KNOWN_STATUS: ReadonlySet<string> = new Set([...FIX, ...WAIT, 'ingested']);

export const SETTINGS = {
  tabs: {
    status: '상태 · 수집',
    connection: '접속 정보',
    connector: '커넥터 만들기',
    info: '소스 정보',
  } satisfies Record<SettingsTab, string>,
  locked: '잠김',
  connectionCount: (n: number) => `${n}항목`,
  logTitle: '수집 로그',
  /** 상세를 불러오는 동안 · 로그 0줄(EmptyState nothing-yet) */
  loading: '소스를 불러오는 중…',
  /** 상세도 목록 행도 없을 때 대화상자 제목 — 대상 이름 자리라 동작이 아닌 대상 종류 */
  fallbackTitle: '소스',
  logEmpty: { title: '수집 로그가 아직 없다', body: '첫 수집이 끝나면 이 자리에 원문이 쌓인다.' },
  close: '닫기',
  actions: {
    reingest: '지금 다시 수집',
    stop: '수집 멈추기',
    rotateKey: '접속 키 교체',
    createConnector: '커넥터 만들기',
    save: '저장',
  } satisfies Record<SettingsAction, string>,
  rotateKeyPending: `접속 키 교체${SEP}${PENDING.title}`,
  /** 접속 정보 탭 안내(Notice `info` 본문만) */
  connectionNote:
    '접속 키는 저장하지 않고 금고 값을 참조합니다. 교체하면 다음 수집부터 새 값을 씁니다.',
  /** 커넥터 만들기 탭 잠김 안내(EmptyState `not-created`, 액션 없음) — 잠금은 평서 `…다`, 본문은 마침표(DESIGN Copy) */
  lock: {
    wait: {
      title: '아직 열 수 없다',
      body: '수집이 끝난 뒤 열린다.',
      hint: '지금은 상태 · 수집에서 진행을 본다',
    },
    fix: {
      title: '먼저 접속을 고쳐야 한다',
      body: '접속을 고친 뒤 열린다.',
      hint: '접속 정보에서 권한 키를 교체한 뒤 다시 수집한다',
    },
  },
  connector: {
    nameLabel: '커넥터 이름',
    namePlaceholder: (sourceName: string) => `${sourceName} 커넥터`,
    toolsLabel: '담을 도구',
    /** 탭 안내(Notice `info` 본문만) */
    note: '커넥터 하나는 소스 하나에서 나옵니다. 만들면 미발행 상태로 프로젝트 현황의 생성 커넥터 목록에 들어갑니다.',
    openConnector: '커넥터 구성 화면 열기 →',
    openPipeline: '파이프라인 빌더 →',
  },
  info: {
    nameLabel: '소스 이름',
    tagsLabel: TAGS_LABEL,
    disconnectTitle: '연결 해제',
    disconnectNote: '산출물과 커넥터도 함께 사라집니다',
    disconnect: '연결 해제',
    disconnecting: '연결 해제 중…',
    dialogTitle: (name: string) => `${name} 연결을 해제할까요?`,
    dialogDescription: '산출물과 커넥터도 함께 사라집니다. 되돌릴 수 없습니다.',
    cancel: CANCEL_LABEL,
  },
} as const;

/** 부제 — 비어 있는 값은 조각을 빼고 잇는다 */
export function settingsSubtitle(d: SourceDetail): string {
  const percent = d.progress?.percent ?? 0;
  const last =
    d.status === 'ingesting'
      ? `진행 ${formatPercentInt(percent)}`
      : FIX.has(d.status)
        ? `마지막 시도 ${dateTime(d.lastRun?.startedAt)}`
        : `마지막 수집 ${dateTime(d.lastRun?.startedAt)}`;
  const parts =
    d.type === 'database'
      ? [
          d.scope.schema && `스키마 ${d.scope.schema}`,
          d.scope.tables !== undefined && `표 ${countUnitLabel(d.scope.tables, '개')}`,
          last,
        ]
      : d.type === 'document'
        ? [
            d.scope.files !== undefined &&
              `${FILE_FORMAT[d.scope.fileFormat ?? 'mixed'] ?? '파일'} ${countUnitLabel(d.scope.files, '개')}`,
            d.output.count > 0 && `청크 ${formatCount(d.output.count)}`,
            last,
          ]
        : [d.scope.repo && `저장소 ${d.scope.repo}`, last];
  return parts.filter((p): p is string => typeof p === 'string' && p !== '').join(SEP);
}
const scheduleText = (d: SourceDetail) =>
  d.schedule?.mode === 'daily' && d.schedule.at ? `매일 ${d.schedule.at}` : '수동';
const authReason = (d: SourceDetail) =>
  d.lastError?.httpStatus === undefined ? '인증 거절' : `인증 거절 (${d.lastError.httpStatus})`;

/** 상태 · 수집 탭 4행(상태별 키가 다르다) */
export function stateRows(d: SourceDetail): readonly StateRow[] {
  const label = sourceStatusOf(d.status).label;
  const started = dateTime(d.lastRun?.startedAt);
  switch (d.status) {
    case 'ingested':
      return [
        ['상태', `${label} — 정상`],
        ['마지막 수집', started],
        ['다음 예정', scheduleText(d)],
        ['산출물', sourceSummary(d)],
      ];
    case 'ingesting':
      return [
        ['상태', `${label} — ${formatPercentInt(d.progress?.percent ?? 0)}`],
        ['시작', started],
        [
          '남은 시간',
          d.remainingMinutes === undefined ? '계산 중' : aboutMinutesLabel(d.remainingMinutes),
        ],
        ['산출물', '수집이 끝난 뒤 나옵니다'],
      ];
    case 'auth_failed':
      return [
        ['상태', `${label} — ${authReason(d)}`],
        ['마지막 시도', started],
        ['재시도', '멈춤'],
        ['산출물', '없음'],
      ];
    case 'ingest_failed':
      return [
        ['상태', `${label} — 읽기 중단`],
        ['마지막 시도', started],
        ['재시도', `${countUnitLabel(d.lastRun?.attempt ?? 1, '회')} 시도 뒤 멈춤`],
        ['산출물', sourceSummary(d)],
      ];
    case 'ready':
      return [
        ['상태', `${label} — 첫 수집 대기`],
        ['다음 예정', scheduleText(d)],
        ['산출물', '수집이 끝난 뒤 나옵니다'],
      ];
    default:
      return [
        ['상태', `${label} — 이전 색인으로 응답`],
        ['마지막 수집', started],
        ['다음 예정', scheduleText(d)],
        ['산출물', sourceSummary(d)],
      ];
  }
}
export function tabNote(tab: SettingsTab, d: SourceDetail): string {
  if (tab === 'status') return sourceStatusOf(d.status).label;
  if (tab === 'connection') return SETTINGS.connectionCount(d.connection.length);
  if (tab === 'connector') return d.status === 'ingested' ? '' : SETTINGS.locked;
  return '';
}
/** 모르는 상태 코드는 경고. 판정은 fix 쪽 기본값을 따른다 */
function warnIfUnknown(status: string) {
  if (KNOWN_STATUS.has(status)) return;
  warnOnce(`status:${status}`, `[copy] 모르는 소스 상태 코드 ${status} — 기본 판정을 씁니다`);
}
/** 커넥터 만들기 탭 잠김 사유. 수집 완료면 null */
export function lockOf(status: SourceStatus) {
  if (status === 'ingested') return null;
  warnIfUnknown(status);
  return WAIT.has(status) ? SETTINGS.lock.wait : SETTINGS.lock.fix;
}
/** 탭별 주 액션. null = 주 액션 없음 */
export function settingsAction(tab: SettingsTab, status: SourceStatus): SettingsAction | null {
  if (tab === 'connection') return 'rotateKey';
  if (tab === 'info') return 'save';
  warnIfUnknown(status);
  if (tab === 'connector') return status === 'ingested' ? 'createConnector' : null;
  if (status === 'ingesting') return 'stop';
  if (status === 'auth_failed') return 'rotateKey';
  if (status === 'ready' || status === 'processing') return null;
  return 'reingest';
}
export function fieldLabel(code: string): string {
  const known = FIELD[code];
  if (known) return known;
  warnOnce(`field:${code}`, `[copy] 모르는 접속 항목 코드 ${code}`);
  return code;
}
export const toolLabel = (kind: ToolGroupKind, count: number) => `${TOOL[kind]} ${count}`;
/** 손봐야 함 계층은 접속 정보 탭으로 연다 */
export const defaultTab = (status: SourceStatus): SettingsTab =>
  FIX.has(status) ? 'connection' : 'status';
/** 설정 모달 URL의 `?source=`가 이 프로젝트에 없는 소스일 때 개발 경고(같은 id는 1회) */
export const warnUnknownSource = (id: string) =>
  warnOnce(`settings-source:${id}`, `[settings] 이 프로젝트에 없는 소스 ${id}`);
/** 설정 모달 URL의 `?tab=`을 모를 때 개발 경고(같은 값은 1회) */
export const warnUnknownTab = (raw: string) =>
  warnOnce(`settings-tab:${raw}`, `[settings] 모르는 탭 ${raw} — status로 엽니다`);
