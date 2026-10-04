// apps/web/src/copy/project.ts — 프로젝트 상세 문구 틀. 서버는 값만 준다
import { NOT_FOUND } from './errors';
import { countUnitLabel } from './format';
import { noMatchLabel } from './list';
import { PENDING } from './pending';

/** 프로젝트 상세 빈 상태 상자 문구(copy/dashboard의 EmptyCopy와 달리 힌트 · 액션이 있다) */
type ProjectEmptyCopy = Readonly<{
  title: string;
  body: string;
  hint: string;
  action?: string;
}>;

const SOURCES_EMPTY: ProjectEmptyCopy = {
  title: '연결된 소스가 없다',
  body: '소스를 연결하면 수집이 시작되고, 수집이 끝나면 산출물(객체 타입 · 지식 베이스 · API 도구)이 생긴다. 커넥터는 그 산출물에서 만든다.',
  action: '소스 고르기',
  hint: '연결 가능한 타입 · DB · 문서 · Git 저장소',
};
const CONNECTORS_EMPTY_GUIDE: ProjectEmptyCopy = {
  title: '아직 만들 수 있는 커넥터가 없다',
  body: '커넥터는 소스의 산출물에서 만든다. 먼저 왼쪽에서 소스를 연결하고 수집이 끝나면 이 자리에서 만들 수 있다.',
  hint: '소스 연결 · 수집 · 산출물 정리 · 커넥터 순서로 진행한다',
};
const CONNECTORS_EMPTY_READY: ProjectEmptyCopy = {
  title: '생성한 커넥터가 없다',
  body: '정상 상태인 소스의 산출물에서 도구를 골라 커넥터를 만든다.',
  action: '+ 커넥터 만들기',
  hint: '수집 중이거나 실패한 소스에서는 만들 수 없다',
};

export const PROJECT = {
  loading: '프로젝트를 불러오는 중…',
  notFound: NOT_FOUND,
  toDashboard: '대시보드로',
  /** 설명이 비면 화면이 적는 자리표시(서버 값 아님) */
  descriptionEmpty: '아직 설명이 없다 — 프로젝트 정보에서 채운다.',
  createdLabel: '생성일',
  updatedLabel: '업데이트',
  /** 톱니 — 프로젝트 정보 모달은 범위 밖 */
  settingsTitle: `프로젝트 정보 수정 · ${PENDING.title}`,
  sources: {
    title: '연결된 소스',
    search: '이름 · 타입 검색',
    add: '+ 소스 추가',
    rowAction: '설정',
    empty: SOURCES_EMPTY,
    noMatch: (total: number) => noMatchLabel('소스가', total),
  },
  connectors: {
    title: '생성 커넥터',
    search: '이름 · 소스 검색',
    add: '+ 커넥터 만들기',
    open: '열기',
    publish: '발행',
    emptyGuide: CONNECTORS_EMPTY_GUIDE,
    emptyReady: CONNECTORS_EMPTY_READY,
    noMatch: (total: number) => noMatchLabel('커넥터가', total),
  },
  connection: {
    kicker: '연결 정보',
    endpoint: '엔드포인트',
    protocol: '프로토콜',
    authKey: '인증 키',
    copy: '복사',
    copied: '복사됨',
    copyFailed: '복사 안 됨',
    /** 발행 상태인데 접속 정보가 비었을 때(규칙 6: 빈칸 대신 사유) — Notice `warn` 본문만(이상 상태, 할 일은 있지만 막히지 않았다) */
    noFields: '접속 정보를 받지 못했다 · 커넥터 열기에서 발행 상태를 확인한다.',
    close: '닫기',
    open: '커넥터 열기',
    /** 미발행 안내 — Notice `info` 본문만 */
    unpublished: '아직 발행되지 않은 커넥터입니다. 발행하면 엔드포인트와 인증 키가 생성됩니다.',
    subtitle: (project: string, source: string, tools: number) =>
      `${project} · ${source} · 도구 ${countUnitLabel(tools, '개')}`,
  },
  /** 요약 밴드 접근성 이름(role=group) */
  metricsTitle: '프로젝트 요약',
  /** 요약 밴드 8칸. 소스가 없으면 값 자리에 사유, 한 칸의 값이 없으면 그 칸만 사유(규칙 6 — `—`를 쓰지 않는다) */
  metrics: {
    placeholder: '집계 전',
    gates: { label: '관문 통과', passed: '통과', failed: '미통과' },
    reachability: { label: '소스 도달성', reachable: '접속됨', blocked: '거절' },
    calls: { label: '호출 · 7일', ok: '성공', failed: '호출 실패' },
    latency: {
      label: 'P95 지연',
      current: '현재',
      target: '목표',
      /** 기간 안 호출이 없어 지연이 없을 때 */
      none: '호출 기록 없음',
    },
    tools: {
      label: '도구 활용',
      called: '호출됨',
      idle: '미호출',
      /** 발행한 도구가 없어 활용을 셀 수 없을 때 */
      none: '발행한 도구 없음',
    },
    objectTypes: { label: '객체 타입 승인', approved: '승인됨', pending: '대기' },
    connectors: { label: '커넥터 발행', published: '사용 중', unpublished: '미발행' },
    freshness: {
      label: '수집 신선도',
      unit: '시간 전',
      today: '오늘',
      thisWeek: '이번 주',
      stalled: '멈춤',
      /** 수집한 적이 없어 시간이 없을 때 */
      none: '수집 기록 없음',
    },
  },
} as const;
